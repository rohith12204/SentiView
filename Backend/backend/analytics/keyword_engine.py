"""
keyword_engine.py  —  Keyword Drilldown, Impact Scoring, Explainability
========================================================================

Provides 3 public functions used by analytics/views.py:

  get_keyword_impact()
      → list of all keywords with mention count, sentiment %, impact level

  get_keyword_drilldown(keyword, product_filter)
      → full insight panel data for a single keyword

  explain_review(text)
      → predicted aspect, confidence, influencing words, category probabilities
"""

from __future__ import annotations

import re
import pandas as pd
from pathlib import Path
from collections import Counter, defaultdict
from typing import Optional

# ── Data path — uses reviews_with_fake.csv (pre-labeled is_fake column) ──────
BASE_DIR  = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "ml" / "data" / "reviews_with_fake.csv"


# ══════════════════════════════════════════════════════════════════════════════
# ASPECT KEYWORD DEFINITIONS
# Each aspect has: direct keywords + indirect synonym terms
# ══════════════════════════════════════════════════════════════════════════════

ASPECT_KEYWORDS = {

    # 🔋 Battery & Charging
    "battery": [
        "battery", "mah", "backup", "drain", "power", "battery life",
        "lasting", "endurance"
    ],
    "charging": [
        "charging", "fast charge", "charger", "charge speed",
        "quick charge", "turbo charge", "type-c", "usb-c", "wireless charging"
    ],

    # Camera (ENHANCED)
    "camera": [
        "camera", "photo", "picture", "video", "selfie", "lens",
        "night mode", "portrait", "hdr", "zoom",
        "1080p", "4k", "8k", "resolution", "megapixel", "mp",
        "ultrawide", "wide angle", "stabilization", "ois", "eis",
        "low light", "night photography"
    ],

    # Performance
    "performance": [
        "performance", "speed", "fast", "slow", "lag", "smooth",
        "processor", "chipset", "snapdragon", "mediatek",
        "ram", "benchmark"
    ],
    "gaming": [
        "gaming", "fps", "game", "pubg", "cod", "bgmi",
        "graphics", "high settings"
    ],
    "heating": [
        "heat", "heating", "overheat", "temperature", "warm"
    ],

    # Display (ENHANCED 🔥)
    "display": [
        "display", "screen", "brightness", "resolution",
        "amoled", "oled", "lcd", "ips",
        "1080p", "2k", "4k", "hd", "full hd",
        "refresh rate", "120hz", "90hz", "60hz",
        "touch", "touch response",
        "curved display", "edge display", "bezel",
        "color", "contrast", "pixel"
    ],

    # Design & Build
    "design": [
        "design", "look", "style", "appearance", "premium", "finish"
    ],
    "build_quality": [
        "build", "quality", "material", "glass", "plastic", "metal",
        "sturdy"
    ],

    # Software & UX
    "software": [
        "software", "os", "android", "system", "firmware"
    ],
    "ui_ux": [
        "ui", "ux", "interface", "experience", "smooth ui"
    ],
    "updates": [
        "update", "updates", "security patch", "upgrade"
    ],
    "bugs": [
        "bug", "issue", "glitch", "error", "crash", "freeze"
    ],

    # Audio & Calls
    "audio": [
        "sound", "speaker", "audio", "volume", "bass", "loud",
        "dolby", "stereo"
    ],
    "call_quality": [
        "call", "voice", "mic", "calling", "voice clarity"
    ],

    # Connectivity
    "network": [
        "network", "signal", "5g", "4g", "lte", "reception"
    ],
    "wifi": [
        "wifi", "internet", "connection"
    ],
    "bluetooth": [
        "bluetooth", "pairing"
    ],

    # Pricing
    "price": [
        "price", "cost", "expensive", "cheap", "pricing"
    ],
    "value_for_money": [
        "value", "worth", "budget", "affordable"
    ],

    # Physical experience
    "durability": [
        "durable", "strong", "break", "damage", "scratch"
    ],
    "weight": [
        "weight", "heavy", "light"
    ],
    "portability": [
        "portable", "easy to carry", "compact"
    ],
}
# Flat list of all keywords for quick lookup
ALL_KEYWORDS = list(ASPECT_KEYWORDS.keys())

# Related terms per aspect (shown as synonym chips in the UI)
RELATED_TERMS: dict[str, list[str]] = {
    "battery":     ["mah", "backup", "charging", "drains", "fast charge"],
    "camera":      ["zoom", "selfie", "portrait", "nightmode", "megapixel"],
    "performance": ["lag", "smooth", "heating", "gaming", "snapdragon"],
    "display":     ["amoled", "120hz", "brightness", "resolution", "notch"],
    "design":      ["build", "slim", "premium", "metal", "fingerprint"],
    "price":       ["value", "worth", "affordable", "overpriced", "budget"],
    "software":    ["update", "bloatware", "ui", "glitch", "android"],
}


# ══════════════════════════════════════════════════════════════════════════════
# DATA LOADER  (cached at module level — reads CSV once per server lifecycle)
# ══════════════════════════════════════════════════════════════════════════════

_df_cache: Optional[pd.DataFrame] = None


def _load_data() -> pd.DataFrame:
    global _df_cache
    if _df_cache is not None:
        return _df_cache

    df = pd.read_csv(DATA_PATH)

    # Keep only genuine reviews
    df = df[df["is_fake"] == 0].copy()

    # Normalise text
    df["review_text"] = df["review_text"].fillna("").astype(str)
    df["sentiment"]   = df["sentiment"].fillna("Neutral").astype(str)
    df["model"]       = df["model"].fillna("").astype(str)
    df["brand"]       = df["brand"].fillna("").astype(str)
    df["full_name"]   = (df["brand"] + " " + df["model"]).str.strip()

    # Parse dates — format is DD-MM-YYYY
    df["review_date"] = pd.to_datetime(df["review_date"], format="%d-%m-%Y", errors="coerce")
    df["year_month"]  = df["review_date"].dt.to_period("M").astype(str)

    # Tag each review with which aspects it mentions
    df["_text_lower"] = df["review_text"].str.lower()
    for aspect, keywords in ASPECT_KEYWORDS.items():
        df[f"_asp_{aspect}"] = df["_text_lower"].apply(
            lambda t: any(kw in t for kw in keywords)
        )

    _df_cache = df
    return df


# ══════════════════════════════════════════════════════════════════════════════
# IMPACT SCORE CALCULATOR
# Impact = how badly a keyword affects sentiment × how often it appears
# HIGH: talked about a lot AND mostly negatively
# LOW:  talked about a lot AND mostly positively
# ══════════════════════════════════════════════════════════════════════════════

def _compute_impact(mentions: int, sentiment_pct: float) -> str:
    """
    impact_score = volume_factor × negative_weight × 100

    volume_factor  : normalised 0–1 (capped at 5000 mentions = 1.0)
    negative_weight: 1 - (sentiment_pct / 100)
                     → low sentiment = high weight = HIGH impact
    """
    volume_factor   = min(mentions / 5000, 1.0)
    negative_weight = 1.0 - (sentiment_pct / 100.0)
    impact_score    = volume_factor * negative_weight * 100

    if impact_score >= 35:
        return "HIGH"
    elif impact_score >= 18:
        return "MEDIUM"
    else:
        return "LOW"


# ══════════════════════════════════════════════════════════════════════════════
# PUBLIC FUNCTION 1 — KEYWORD IMPACT LIST
# Returns all keywords with mention count, sentiment %, impact level
# Used by: InsightsDashboard keyword list view
# ══════════════════════════════════════════════════════════════════════════════

def get_keyword_impact() -> list[dict]:
    """
    Returns a list of dicts, one per aspect keyword:
    {
        keyword        : str,
        mentions       : int,
        sentiment_pct  : float,   # % positive among genuine reviews
        positive_count : int,
        negative_count : int,
        neutral_count  : int,
        impact         : str,     # HIGH | MEDIUM | LOW
    }
    """
    df = _load_data()
    results = []

    for aspect in ALL_KEYWORDS:
        col = f"_asp_{aspect}"
        subset = df[df[col] == True]

        mentions  = len(subset)
        if mentions == 0:
            continue

        pos = int((subset["sentiment"] == "Positive").sum())
        neu = int((subset["sentiment"] == "Neutral").sum())
        neg = int((subset["sentiment"] == "Negative").sum())
        sentiment_pct = round(pos / mentions * 100, 1)
        impact = _compute_impact(mentions, sentiment_pct)

        results.append({
            "keyword":        aspect,
            "mentions":       mentions,
            "sentiment_pct":  sentiment_pct,
            "positive_count": pos,
            "neutral_count":  neu,
            "negative_count": neg,
            "impact":         impact,
        })

    # Sort by mentions descending
    results.sort(key=lambda x: x["mentions"], reverse=True)
    return results


# ══════════════════════════════════════════════════════════════════════════════
# PUBLIC FUNCTION 2 — KEYWORD DRILLDOWN
# Full insight panel for a single keyword, optionally filtered by product
# Used by: KeywordDrilldown panel when user clicks a keyword
# ══════════════════════════════════════════════════════════════════════════════

def get_keyword_drilldown(keyword: str, product_filter: str = "all") -> dict:
    """
    Parameters
    ----------
    keyword        : one of the ASPECT_KEYWORDS keys (e.g. "battery")
    product_filter : "all"  OR  lowercase full product name (e.g. "samsung galaxy note 20")

    Returns
    -------
    {
        keyword           : str,
        selected_product  : str,
        summary           : { mentions, sentiment_pct, impact },
        distribution      : { positive_pct, neutral_pct, negative_pct,
                              positive, neutral, negative },
        trend             : [ { month, positive, neutral, negative, total }, ... ],
        top_reviews       : { positive: str, negative: str },
        related_terms     : [ str, ... ],
        top_products      : [ { name, mentions, sentiment_pct }, ... ],
    }
    """
    keyword = keyword.lower().strip()
    if keyword not in ASPECT_KEYWORDS:
        return {"error": f"Unknown keyword '{keyword}'. Valid: {ALL_KEYWORDS}"}

    df = _load_data()
    col = f"_asp_{keyword}"

    # Filter to reviews mentioning this keyword
    subset = df[df[col] == True].copy()

    # Apply product filter
    selected_product = "All Products"
    if product_filter and product_filter.lower() != "all":
        pf = product_filter.lower().strip()
        mask = subset["full_name"].str.lower().str.contains(pf, na=False)
        if mask.any():
            subset = subset[mask]
            selected_product = subset.iloc[0]["full_name"]
        # if no match, fall back to all products silently

    mentions = len(subset)
    if mentions == 0:
        return {
            "keyword":          keyword,
            "selected_product": selected_product,
            "error":            "No reviews found for this combination.",
        }

    # ── Summary metrics ──────────────────────────────────────────────────────
    pos = int((subset["sentiment"] == "Positive").sum())
    neu = int((subset["sentiment"] == "Neutral").sum())
    neg = int((subset["sentiment"] == "Negative").sum())
    sentiment_pct = round(pos / mentions * 100, 1)
    impact = _compute_impact(mentions, sentiment_pct)

    # ── Sentiment distribution ────────────────────────────────────────────────
    distribution = {
        "positive":     pos,
        "neutral":      neu,
        "negative":     neg,
        "positive_pct": round(pos / mentions * 100, 1),
        "neutral_pct":  round(neu / mentions * 100, 1),
        "negative_pct": round(neg / mentions * 100, 1),
    }

    # ── Trend over time (monthly, last 12 months) ─────────────────────────────
    trend_df = subset.dropna(subset=["review_date"])
    trend = []
    if not trend_df.empty:
        monthly = (
            trend_df.groupby("year_month")["sentiment"]
            .value_counts()
            .unstack(fill_value=0)
            .reset_index()
        )
        # Ensure all sentiment columns exist
        for col_name in ["Positive", "Neutral", "Negative"]:
            if col_name not in monthly.columns:
                monthly[col_name] = 0

        monthly = monthly.sort_values("year_month").tail(12)
        for _, row in monthly.iterrows():
            total_m = int(row.get("Positive", 0) + row.get("Neutral", 0) + row.get("Negative", 0))
            trend.append({
                "month":    str(row["year_month"]),
                "positive": int(row.get("Positive", 0)),
                "neutral":  int(row.get("Neutral", 0)),
                "negative": int(row.get("Negative", 0)),
                "total":    total_m,
            })

    # ── Top reviews ───────────────────────────────────────────────────────────
    pos_reviews = subset[subset["sentiment"] == "Positive"]["review_text"]
    neg_reviews = subset[subset["sentiment"] == "Negative"]["review_text"]

    def _best_review(series: pd.Series) -> str:
        """Pick the most informative review (longest under 300 chars)."""
        candidates = series.dropna().tolist()
        candidates = [r for r in candidates if 30 < len(r) < 300]
        if not candidates:
            return ""
        # Prefer reviews that contain the keyword itself
        keyword_hits = [r for r in candidates if keyword in r.lower()]
        pool = keyword_hits if keyword_hits else candidates
        return max(pool, key=len)

    top_reviews = {
        "positive": _best_review(pos_reviews),
        "negative": _best_review(neg_reviews),
    }

    # ── Related terms ─────────────────────────────────────────────────────────
    related_terms = RELATED_TERMS.get(keyword, [])

    # ── Top products for this keyword ─────────────────────────────────────────
    product_stats = []
    for product_name, prod_df in subset.groupby("full_name"):
        p_total = len(prod_df)
        p_pos   = int((prod_df["sentiment"] == "Positive").sum())
        p_pct   = round(p_pos / p_total * 100, 1)
        product_stats.append({
            "name":          product_name,
            "mentions":      p_total,
            "sentiment_pct": p_pct,
        })

    # Sort: worst sentiment first (most impacted products)
    product_stats.sort(key=lambda x: x["sentiment_pct"])
    top_products = product_stats[:8]

    return {
        "keyword":          keyword,
        "selected_product": selected_product,
        "summary": {
            "mentions":      mentions,
            "sentiment_pct": sentiment_pct,
            "impact":        impact,
        },
        "distribution":  distribution,
        "trend":         trend,
        "top_reviews":   top_reviews,
        "related_terms": related_terms,
        "top_products":  top_products,
    }


# ══════════════════════════════════════════════════════════════════════════════
# PUBLIC FUNCTION 3 — REVIEW EXPLAINABILITY (XAI)
# Shows WHY the model classified a review into an aspect category
# No external ML needed — uses keyword presence as interpretable signal
# ══════════════════════════════════════════════════════════════════════════════

def explain_review(text: str) -> dict:
    """
    Parameters
    ----------
    text : raw review text

    Returns
    -------
    {
        predicted_category    : str,
        confidence            : float,   # 0–100
        influencing_words     : [ str ],
        category_probabilities: { aspect: float },
        review_text           : str,
    }
    """
    text_lower = text.lower()

    # Count keyword hits per aspect
    raw_scores: dict[str, int] = {}
    for aspect, keywords in ASPECT_KEYWORDS.items():
        hits = [kw for kw in keywords if kw in text_lower]
        raw_scores[aspect] = len(hits)

    total_hits = sum(raw_scores.values())

    if total_hits == 0:
        # No keywords found — return uniform distribution
        uniform = round(100 / len(ALL_KEYWORDS), 1)
        return {
            "review_text":             text,
            "predicted_category":      "general",
            "confidence":              uniform,
            "influencing_words":       [],
            "category_probabilities":  {asp: uniform for asp in ALL_KEYWORDS},
        }

    # Convert raw counts to percentages
    probabilities = {
        asp: round(count / total_hits * 100, 1)
        for asp, count in raw_scores.items()
    }

    # Predicted = highest scoring aspect
    predicted = max(raw_scores, key=raw_scores.get)
    confidence = probabilities[predicted]

    # Influencing words = keywords that actually appeared in the text
    influencing_words = [
        kw for kw in ASPECT_KEYWORDS[predicted]
        if kw in text_lower
    ]

    # Sort probabilities descending for UI display
    sorted_probs = dict(
        sorted(probabilities.items(), key=lambda x: x[1], reverse=True)
    )

    return {
        "review_text":            text,
        "predicted_category":     predicted,
        "confidence":             confidence,
        "influencing_words":      influencing_words,
        "category_probabilities": sorted_probs,
    }


# ══════════════════════════════════════════════════════════════════════════════
# HELPER — Product list for frontend dropdown
# ══════════════════════════════════════════════════════════════════════════════

def get_all_products() -> list[str]:
    """Returns sorted list of all unique product full names in the dataset."""
    df = _load_data()
    return sorted(df["full_name"].dropna().unique().tolist())