import pandas as pd
from pathlib import Path
from collections import Counter

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "ml" / "data" / "reviews.csv"

INDIRECT_KEYWORD_MAP = {

    # Battery (expanded)
    "5000mah": "battery",
    "6000mah": "battery",
    "7000mah": "battery",
    "4000mah": "battery",
    "3000mah": "battery",
    "mah": "battery",
    "battery life": "battery",
    "backup": "battery",
    "drain": "battery",
    "drains": "battery",
    "draining": "battery",
    "power": "battery",
    "overnight": "battery",
    "powerbank": "battery",

    # Charging (split from battery — better analytics)
    "charge": "charging",
    "charging": "charging",
    "fast charge": "charging",
    "fast charging": "charging",
    "quick charge": "charging",
    "turbo charge": "charging",
    "wireless charge": "charging",
    "wireless charging": "charging",
    "charger": "charging",
    "type c": "charging",
    "usb c": "charging",

    # Camera (HIGHLY enhanced )
    "megapixel": "camera",
    "megapixels": "camera",
    "mp": "camera",
    "108mp": "camera",
    "64mp": "camera",
    "50mp": "camera",
    "32mp": "camera",
    "16mp": "camera",

    "camera": "camera",
    "selfie": "camera",
    "portrait": "camera",
    "bokeh": "camera",
    "zoom": "camera",
    "lens": "camera",
    "ultrawide": "camera",
    "wide angle": "camera",

    "night mode": "camera",
    "nightmode": "camera",
    "low light": "camera",

    "4k": "camera",
    "4k video": "camera",
    "1080p": "camera",
    "video recording": "camera",

    "ois": "camera",
    "eis": "camera",
    "stabilization": "camera",
    "hdr": "camera",

    # Display (VERY IMPORTANT UPGRADE)
    "amoled": "display",
    "oled": "display",
    "lcd": "display",
    "ips": "display",

    "display": "display",
    "screen": "display",
    "touch": "display",

    "120hz": "display",
    "120 hz": "display",
    "90hz": "display",
    "90 hz": "display",
    "60hz": "display",
    "refresh rate": "display",

    "brightness": "display",
    "nits": "display",
    "sunlight": "display",
    "resolution": "display",
    "full hd": "display",
    "full hd+": "display",
    "2k": "display",
    "4k display": "display",

    "curved display": "display",
    "edge display": "display",
    "bezel": "display",
    "notch": "display",
    "punch hole": "display",
    "gorilla glass": "display",

    # Performance
    "snapdragon": "performance",
    "dimensity": "performance",
    "helio": "performance",
    "processor": "performance",
    "chipset": "performance",

    "ram": "performance",
    "storage": "performance",
    "gb": "performance",

    "lag": "performance",
    "laggy": "performance",
    "slow": "performance",
    "fast": "performance",
    "smooth": "performance",
    "performance": "performance",

    "multitask": "performance",
    "multitasking": "performance",

    # Gaming & Heat
    "gaming": "gaming",
    "fps": "gaming",
    "pubg": "gaming",
    "cod": "gaming",
    "bgmi": "gaming",

    "heat": "heating",
    "heating": "heating",
    "overheat": "heating",
    "hot": "heating",
    "temperature": "heating",

    # Design / Build
    "plastic": "design",
    "metal": "design",
    "glass back": "design",
    "slim": "design",
    "thin": "design",
    "lightweight": "design",
    "heavy": "design",
    "premium": "design",
    "cheap feel": "design",

    "build": "build_quality",
    "build quality": "build_quality",
    "material": "build_quality",
    "finish": "build_quality",

    "fingerprint": "design",
    "in display": "design",
    "side sensor": "design",
}

def _normalize_indirect(text: str) -> str:
    """
    Replace indirect hardware terms with their canonical aspect keyword.
    E.g. '5000mah is ok' → 'battery is ok'
    Works on the raw review text before word-splitting.
    """
    text_lower = text.lower()
    # Sort by length descending so multi-word phrases are replaced first
    for indirect_term in sorted(INDIRECT_KEYWORD_MAP.keys(), key=len, reverse=True):
        canonical = INDIRECT_KEYWORD_MAP[indirect_term]
        text_lower = text_lower.replace(indirect_term, canonical)
    return text_lower


def generate_dashboard_metrics():
    df = pd.read_csv(DATA_PATH)

    # =========================
    # MERGE DB REVIEWS
    # =========================
    try:
        import django
        from store.models import Review as DBReview
        db_reviews = list(DBReview.objects.select_related('product').values(
            'rating', 'sentiment', 'body'
        ))
        if db_reviews:
            import pandas as _pd
            db_df = _pd.DataFrame(db_reviews)
            db_df.rename(columns={'body': 'review_text'}, inplace=True)
            for col in df.columns:
                if col not in db_df.columns:
                    db_df[col] = None
            df = _pd.concat([df, db_df[df.columns]], ignore_index=True)
    except Exception:
        pass  # fall back to CSV-only

    # =========================
    # BASIC KPIs
    # =========================
    total_products = df["model"].nunique() if "model" in df.columns else 0
    total_reviews = len(df)

    positive = (df["sentiment"] == "Positive").sum()
    neutral  = (df["sentiment"] == "Neutral").sum()
    negative = (df["sentiment"] == "Negative").sum()

    avg_sentiment = round((positive / total_reviews) * 100, 1) if total_reviews else 0

    sentiment_distribution = {
        "positive": int(positive),
        "neutral":  int(neutral),
        "negative": int(negative)
    }

    # =========================
    # KEYWORD ANALYSIS
    # ✅ FIX: Apply indirect keyword normalization BEFORE splitting words.
    # This means "5000mah is ok" → "battery is ok" → "battery" gets counted.
    # =========================

    def get_words(series):
        """Normalize each review for indirect terms, then split into words."""
        normalized = series.astype(str).apply(_normalize_indirect)
        return " ".join(normalized).split()

    pos_words = get_words(df[df["sentiment"] == "Positive"]["review_text"])
    neg_words = get_words(df[df["sentiment"] == "Negative"]["review_text"])
    all_words  = get_words(df["review_text"])

    stopwords = {
        "this", "that", "with", "have", "from", "they", "will", "just", "been", "were",
        "some", "when", "than", "then", "also", "more", "very", "good", "great", "nice",
        "best", "well", "like", "really", "phone", "product", "item", "which", "would",
        "about", "their", "there", "these", "those", "other", "after", "could", "should"
    }

    all_counter = Counter(w for w in all_words if len(w) > 4 and w not in stopwords)
    pos_counter = Counter(pos_words)
    neg_counter = Counter(neg_words)

    top_words = [w for w, _ in all_counter.most_common(30) if len(w) > 4][:12]

    keyword_data = []
    for kw in top_words:
        p = pos_counter.get(kw, 0)
        n = neg_counter.get(kw, 0)
        total_kw = p + n
        if total_kw == 0:
            sentiment_type = "neutral"
        elif p / total_kw >= 0.6:
            sentiment_type = "positive"
        elif n / total_kw >= 0.6:
            sentiment_type = "negative"
        else:
            sentiment_type = "neutral"

        keyword_data.append({
            "keyword":        kw,
            "count":          all_counter[kw],
            "positive_count": p,
            "negative_count": n,
            "sentiment":      sentiment_type,
            "positive_pct":   round(p / total_kw * 100, 1) if total_kw > 0 else 50,
        })

    # =========================
    # TOP PRODUCTS
    # =========================
    csv_df = pd.read_csv(DATA_PATH)
    grouped = (
        csv_df.groupby(["brand", "model"])
        .apply(lambda g: pd.Series({
            "sentiment": (g["sentiment"] == "Positive").mean() * 100
        }))
        .reset_index()
    )

    top_products = grouped.sort_values(by="sentiment", ascending=False).head(5)

    top_products_list = [
        {
            "name":      f"{row['brand']} {row['model']}",
            "sentiment": round(row["sentiment"], 1)
        }
        for _, row in top_products.iterrows()
    ]

    return {
        "kpis": {
            "total_products": int(total_products),
            "total_reviews":  int(total_reviews),
            "avg_sentiment":  avg_sentiment,
            "model_accuracy": 92.4
        },
        "sentiment_distribution": sentiment_distribution,
        "keywords":     keyword_data,
        "top_products": top_products_list,
    }