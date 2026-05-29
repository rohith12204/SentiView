"""
build_dataset.py
================
Run this script ONCE to build the unified reviews_with_fake.csv
that your SentiView project reads.

Usage (from inside sentiview_fixed/Backend/backend/):
    python ml/build_dataset.py

Output:
    ml/data/reviews_with_fake.csv
"""

import sys
import os
import re
import pandas as pd
from pathlib import Path
from textblob import TextBlob

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR  = Path(__file__).resolve().parent          # ml/
RAW_DIR   = BASE_DIR / "raw_csvs"                    # ml/raw_csvs/
OUT_DIR   = BASE_DIR / "data"                        # ml/data/
OUT_FILE  = OUT_DIR / "reviews_with_fake.csv"

OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── ASIN → iPhone model lookup (Amazon India ASINs) ──────────────────────────
ASIN_MODEL = {
    "B09G9BL5CP": "iPhone 13",
    "B09P82T3PZ": "iPhone 13 Pro",
    "B09G9J5JZX": "iPhone 13 mini",
    "B0CHX1W1XY": "iPhone 15",
    "B0BDK8LKPJ": "iPhone 14",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def get_sentiment(text: str) -> str:
    """Derive sentiment from review text using TextBlob."""
    try:
        polarity = TextBlob(str(text)).sentiment.polarity
        if polarity > 0.1:
            return "Positive"
        elif polarity < -0.1:
            return "Negative"
        else:
            return "Neutral"
    except Exception:
        return "Neutral"


def rating_to_sentiment(rating) -> str:
    """Fallback: derive sentiment from numeric rating."""
    try:
        r = float(rating)
        if r >= 4:
            return "Positive"
        elif r <= 2:
            return "Negative"
        else:
            return "Neutral"
    except Exception:
        return "Neutral"


def clean_model_name(raw: str) -> str:
    """Normalize 'APPLE iPhone 14 Plus' → 'iPhone 14 Plus'."""
    raw = str(raw).strip()
    raw = re.sub(r"(?i)^apple\s+", "", raw)   # remove leading 'Apple'
    raw = re.sub(r"\s+", " ", raw)
    # Ensure 'iPhone' is always correctly cased (not 'Iphone')
    raw = re.sub(r"(?i)\biphone\b", "iPhone", raw)
    return raw.strip()


def detect_fake(text: str, rating=None) -> int:
    """
    Simple rule-based fake detector.
    Returns 1 (fake) or 0 (genuine).

    Replace this with your ML model if preferred — just keep the signature.
    """
    if not isinstance(text, str) or len(text.strip()) < 10:
        return 1                           # too short → suspicious

    text_lower = text.lower()

    # Suspiciously short + extreme rating
    if len(text.split()) < 5:
        return 1

    # All-caps rant (likely spam)
    alpha = [c for c in text if c.isalpha()]
    if alpha and sum(1 for c in alpha if c.isupper()) / len(alpha) > 0.7:
        return 1

    # Repetitive filler phrases
    spam_phrases = [
        "best product", "must buy", "worst product", "pathetic", "fake product",
        "totally worth", "superb product", "amazing product", "good product",
        "very good product", "nice product", "worst experience",
    ]
    hits = sum(1 for p in spam_phrases if p in text_lower)
    if hits >= 2:
        return 1

    # Rating-sentiment mismatch (strong signal of manipulation)
    if rating is not None:
        try:
            r = float(rating)
            polarity = TextBlob(text).sentiment.polarity
            if r >= 4 and polarity < -0.3:
                return 1
            if r <= 2 and polarity > 0.3:
                return 1
        except Exception:
            pass

    return 0


# ── Per-CSV adapter functions ─────────────────────────────────────────────────
# Each returns a DataFrame with EXACTLY these columns:
#   brand | model | review_text | rating | sentiment | is_fake | review_date

UNIFIED_COLS = ["brand", "model", "review_text", "rating",
                "sentiment", "is_fake", "review_date"]


def load_iphone_1(path: Path) -> pd.DataFrame:
    """
    iphone__1_.csv  —  Amazon-style with productAsin + reviewDescription
    Products: iPhone 13, 13 Pro, 13 mini, 14, 15
    """
    df = pd.read_csv(path)
    df["model"]       = df["productAsin"].map(ASIN_MODEL).fillna("iPhone 13")
    df["brand"]       = "Apple"
    df["review_text"] = df["reviewDescription"].fillna("").astype(str)
    df["rating"]      = pd.to_numeric(df["ratingScore"], errors="coerce")
    df["review_date"] = pd.to_datetime(df["date"], dayfirst=True, errors="coerce")
    df["sentiment"]   = df.apply(
        lambda r: get_sentiment(r["review_text"]) if r["review_text"] else
                  rating_to_sentiment(r["rating"]), axis=1)
    df["is_fake"]     = df.apply(
        lambda r: detect_fake(r["review_text"], r["rating"]), axis=1)
    return df[UNIFIED_COLS].copy()


def load_iphone11(path: Path) -> pd.DataFrame:
    """
    apple_iphone_11_reviews.csv  —  Amazon India, product = 'Apple iPhone XR ...'
    All rows are iPhone XR reviews.
    """
    df = pd.read_csv(path)
    df["brand"]       = "Apple"
    df["model"]       = "iPhone XR"
    df["review_text"] = df["review_text"].fillna("").astype(str)
    df["rating"]      = pd.to_numeric(
        df["review_rating"].astype(str).str.extract(r"([\d.]+)")[0],
        errors="coerce")
    df["review_date"] = pd.to_datetime(df["reviewed_at"], dayfirst=True, errors="coerce")
    df["sentiment"]   = df.apply(
        lambda r: get_sentiment(r["review_text"]) if r["review_text"] else
                  rating_to_sentiment(r["rating"]), axis=1)
    df["is_fake"]     = df.apply(
        lambda r: detect_fake(r["review_text"], r["rating"]), axis=1)
    return df[UNIFIED_COLS].copy()


def load_iphone14_part1(path: Path) -> pd.DataFrame:
    """
    iphone14_review_PART1.csv  —  Flipkart-style, title/rating/review/dates
    All rows are iPhone 14 reviews.
    """
    df = pd.read_csv(path)
    df["brand"]       = "Apple"
    df["model"]       = "iPhone 14"
    df["review_text"] = df["review"].fillna("").astype(str)
    df["rating"]      = pd.to_numeric(df["rating"], errors="coerce")
    df["review_date"] = pd.to_datetime(df.get("dates", pd.Series(dtype=str)),
                                       errors="coerce")
    df["sentiment"]   = df.apply(
        lambda r: get_sentiment(r["review_text"]) if r["review_text"] else
                  rating_to_sentiment(r["rating"]), axis=1)
    df["is_fake"]     = df.apply(
        lambda r: detect_fake(r["review_text"], r["rating"]), axis=1)
    return df[UNIFIED_COLS].copy()


def load_iphone14_part2(path: Path) -> pd.DataFrame:
    """
    iphone-14-blue-128__PART2.csv  —  Only Review + Rating columns
    All rows are iPhone 14 reviews.
    """
    df = pd.read_csv(path)
    df["brand"]       = "Apple"
    df["model"]       = "iPhone 14"
    df["review_text"] = df["Review"].fillna("").astype(str)
    df["rating"]      = pd.to_numeric(df["Rating"], errors="coerce").round()
    df["review_date"] = pd.NaT
    df["sentiment"]   = df.apply(
        lambda r: get_sentiment(r["review_text"]) if r["review_text"] else
                  rating_to_sentiment(r["rating"]), axis=1)
    df["is_fake"]     = df.apply(
        lambda r: detect_fake(r["review_text"], r["rating"]), axis=1)
    return df[UNIFIED_COLS].copy()


def load_iphone14_15(path: Path) -> pd.DataFrame:
    """
    Iphone_14_15.csv  —  Has 'Model Name', 'Review', 'Sentiment of Review'
    Products: iPhone 14, 14 Plus, 14 Pro, 14 Pro Max, 15, 15 Plus, 15 Pro, 15 Pro Max
    Pre-labeled sentiment — no need to re-compute.
    """
    df = pd.read_csv(path)
    df["brand"]       = "Apple"
    df["model"]       = df["Model Name"].apply(clean_model_name)
    df["review_text"] = df["Review"].fillna("").astype(str)
    df["rating"]      = None   # not available in this CSV

    # Normalize pre-labeled sentiment
    sentiment_map = {"positive": "Positive", "negative": "Negative", "neutral": "Neutral"}
    df["sentiment"] = (df["Sentiment of Review"]
                       .str.strip().str.lower()
                       .map(sentiment_map)
                       .fillna("Neutral"))

    df["review_date"] = pd.to_datetime(df.get("Posted Date", pd.Series(dtype=str)),
                                       errors="coerce")
    df["is_fake"]     = df["review_text"].apply(lambda t: detect_fake(t))
    return df[UNIFIED_COLS].copy()


def load_iphone16_s24(path: Path) -> pd.DataFrame:
    """
    iphone16_vs_samsung_S24.csv  —  Product Name, Review, Rating, Sentiment
    Products: iPhone 16 Pro, Samsung Galaxy S24 Ultra
    Pre-labeled sentiment.
    """
    df = pd.read_csv(path)

    def parse_brand_model(name: str):
        name = str(name).strip()
        if name.lower().startswith("samsung"):
            return "Samsung", name.replace("Samsung ", "").strip()
        return "Apple", name.strip()

    df[["brand", "model"]] = df["Product Name"].apply(
        lambda n: pd.Series(parse_brand_model(n)))

    df["review_text"] = df["Review"].fillna("").astype(str)
    df["rating"]      = pd.to_numeric(df["Rating"], errors="coerce")

    sentiment_map = {"positive": "Positive", "negative": "Negative", "neutral": "Neutral"}
    df["sentiment"] = (df["Sentiment"]
                       .str.strip().str.lower()
                       .map(sentiment_map)
                       .fillna("Neutral"))

    df["review_date"] = pd.NaT
    df["is_fake"]     = df.apply(
        lambda r: detect_fake(r["review_text"], r["rating"]), axis=1)
    return df[UNIFIED_COLS].copy()


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("\n=== SentiView Dataset Builder ===\n")

    # Map filename patterns to loader functions
    loaders = [
        ("iphone__1_.csv",                    load_iphone_1),
        ("apple_iphone_11_reviews.csv",        load_iphone11),
        ("iphone14_review_PART1.csv",          load_iphone14_part1),
        ("iphone-14-blue-128-gb__PART2.csv",   load_iphone14_part2),
        ("Iphone_14_15.csv",                   load_iphone14_15),
        ("iphone16_vs_samsung_S24.csv",        load_iphone16_s24),
    ]

    frames = []
    for filename, loader_fn in loaders:
        csv_path = RAW_DIR / filename
        if not csv_path.exists():
            print(f"  [SKIP]  {filename}  — not found in {RAW_DIR}")
            continue
        try:
            df = loader_fn(csv_path)
            # Drop rows with empty review text
            df = df[df["review_text"].str.strip().str.len() > 5]
            print(f"  [OK]    {filename:<45} {len(df):>5} rows")
            frames.append(df)
        except Exception as e:
            print(f"  [ERROR] {filename}: {e}")

    if not frames:
        print("\nNo CSV files found! Put your CSVs inside:  ml/raw_csvs/")
        sys.exit(1)

    # Combine all
    combined = pd.concat(frames, ignore_index=True)

    # Deduplicate on review text + model
    before = len(combined)
    combined = combined.drop_duplicates(subset=["model", "review_text"])
    after = len(combined)
    print(f"\n  Removed {before - after} duplicate rows")

    # Fill missing ratings from sentiment
    rating_fill = {"Positive": 4.0, "Neutral": 3.0, "Negative": 2.0}
    combined["rating"] = combined.apply(
        lambda r: rating_fill.get(r["sentiment"], 3.0)
        if pd.isna(r["rating"]) else r["rating"], axis=1)

    # Ensure is_fake is int
    combined["is_fake"] = combined["is_fake"].fillna(0).astype(int)

    # Save
    combined.to_csv(OUT_FILE, index=False)

    # Summary report
    print(f"\n{'='*55}")
    print(f"  Output saved → {OUT_FILE}")
    print(f"  Total reviews : {len(combined):,}")
    print(f"  Fake reviews  : {combined['is_fake'].sum():,}")
    print(f"\n  Reviews per product:")
    print(f"  {'Brand':<10} {'Model':<25} {'Count':>6}  {'Fake':>5}")
    print(f"  {'-'*50}")
    for (brand, model), grp in combined.groupby(["brand", "model"]):
        fake_count = grp["is_fake"].sum()
        flag = " ✓" if len(grp) >= 2000 else " (< 2000)"
        print(f"  {brand:<10} {model:<25} {len(grp):>6}  {fake_count:>5}{flag}")
    print(f"{'='*55}\n")


if __name__ == "__main__":
    main()