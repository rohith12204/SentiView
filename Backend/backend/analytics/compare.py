import pandas as pd
from pathlib import Path

BASE_DIR  = Path(__file__).resolve().parent.parent
# BUG FIX: use reviews_with_fake.csv (contains is_fake column) for consistency
# Falls back to reviews.csv if the enriched file is missing
_DATA_PRIORITY = [
    BASE_DIR / "ml" / "data" / "reviews_with_fake.csv",
    BASE_DIR / "ml" / "data" / "reviews.csv",
]


def _load_df():
    for path in _DATA_PRIORITY:
        if path.exists():
            df = pd.read_csv(path)
            df["_full"] = (df["brand"] + " " + df["model"]).str.lower().str.strip()
            return df
    raise FileNotFoundError("No reviews CSV found in ml/data/")


def _find_product(df, name: str):
    """
    Fuzzy match a product name string against the CSV.
    Tries several strategies in order of strictness.
    """
    name_lower = name.lower().strip()
    tokens = [t for t in name_lower.split() if len(t) > 1]

    # Strategy 1 — exact
    exact = df[df["_full"] == name_lower]
    if not exact.empty:
        return exact

    # Strategy 2 — CSV full-name is contained in what the user typed
    mask2 = df["_full"].apply(lambda x: x in name_lower)
    if mask2.any():
        return df[mask2]

    # Strategy 3 — what the user typed is contained in CSV full-name
    mask3 = df["_full"].apply(lambda x: name_lower in x)
    if mask3.any():
        return df[mask3]

    # Strategy 4 — every token appears in the full name
    mask4 = df["_full"].apply(lambda full: all(t in full for t in tokens))
    if mask4.any():
        return df[mask4]

    # Strategy 5 — model column alone contains every token
    model_lower = df["model"].str.lower()
    mask5 = model_lower.apply(lambda m: all(t in m for t in tokens))
    if mask5.any():
        return df[mask5]

    return pd.DataFrame()


def _safe_mean(series):
    """Return rounded mean * 20 or 0 if missing/all-NaN."""
    try:
        v = series.dropna()
        return round(float(v.mean()) * 20, 1) if not v.empty else 0.0
    except Exception:
        return 0.0


import pandas as pd
import pandas as pd
from pathlib import Path

REVIEWS_PATH = Path(__file__).resolve().parent.parent / "ml" / "data" / "reviews.csv"

def _load_csv():
    return pd.read_csv(REVIEWS_PATH)

def compare_products(product_names):
    df = _load_csv()

    # Normalize
    df["full_name"] = (df["brand"] + " " + df["model"]).str.lower()

    results = []

    for name in product_names:
        clean_name = name.lower().strip()

        # 🔥 Match product correctly
        product_df = df[df["full_name"].str.contains(clean_name, na=False)].copy()

        if product_df.empty:
            # fallback (important!)
            results.append({
                "name": name,
                "sentiment": 0,
                "avg_rating": 0,
                "aspects": {},
                "pros": [],
                "cons": []
            })
            continue

        total = len(product_df)

        # ✅ Sentiment
        positive = (product_df["sentiment"] == "Positive").sum()
        sentiment_score = round((positive / total) * 100, 1) if total else 0

        # ✅ Rating
        avg_rating = round(float(product_df["rating"].mean()), 2)

        # ✅ Aspect scores
        def aspect_score(col):
            if col in product_df.columns and product_df[col].notna().any():
                return round(float(product_df[col].mean()) * 20, 1)
            return 0

        aspects = {
            "Camera": aspect_score("camera_rating"),
            "Battery": aspect_score("battery_life_rating"),
            "Performance": aspect_score("performance_rating"),
            "Design": aspect_score("design_rating"),
            "Display": aspect_score("display_rating"),
        }

        # ✅ Simple pros/cons from text
        texts = product_df["review_text"].fillna("").str.lower()

        pros = []
        cons = []

        for t in texts[:50]:  # limit for speed
            if any(word in t for word in ["good", "great", "excellent", "love", "amazing"]):
                pros.append(t[:120])
            if any(word in t for word in ["bad", "poor", "worst", "issue", "problem"]):
                cons.append(t[:120])

        results.append({
            "name": name,
            "sentiment": sentiment_score,
            "avg_rating": avg_rating,
            "aspects": aspects,
            "pros": pros[:3],
            "cons": cons[:3],
        })

    return results