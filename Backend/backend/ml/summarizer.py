import pandas as pd
from pathlib import Path
from collections import Counter
import re

BASE_DIR = Path(__file__).resolve().parent
# FIX: Correct path — data lives in ml/data/reviews.csv
DATA_PATH = BASE_DIR / "data" / "reviews.csv"


def clean_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-zA-Z ]", "", text)
    return text


def extract_keywords(texts, top_n: int = 5):
    stopwords = {"this", "that", "with", "have", "from", "they", "will", "just",
                 "been", "were", "some", "when", "than", "then", "also", "more",
                 "very", "good", "great", "nice", "best", "well", "like", "really"}
    words = []
    for t in texts:
        if isinstance(t, str):
            words.extend(clean_text(t).split())

    common = Counter(words).most_common(top_n * 3)
    result = [w for w, _ in common if len(w) > 3 and w not in stopwords]
    return result[:top_n]


def generate_summary(product_name: str) -> dict:
    """
    Generate a keyword-based AI summary for a product.
    FIX: was reading column 'review' — corrected to 'review_text'.
    """
    try:
        df = pd.read_csv(DATA_PATH)
    except FileNotFoundError:
        return {"summary": "Dataset not found.", "pros": [], "cons": []}

    # FIX: use correct column name 'review_text'
    if "review_text" not in df.columns:
        return {"summary": "Review data unavailable.", "pros": [], "cons": []}

    # Filter by product name
    df = df[df["model"].str.contains(product_name, case=False, na=False)]

    if df.empty:
        # Try brand match
        parts = product_name.strip().split()
        if len(parts) >= 2:
            brand, model = parts[0], " ".join(parts[1:])
            df_orig = pd.read_csv(DATA_PATH)
            df = df_orig[
                df_orig["brand"].str.contains(brand, case=False, na=False) &
                df_orig["model"].str.contains(model, case=False, na=False)
            ]

    if df.empty:
        return {"summary": "No sufficient data available for this product.", "pros": [], "cons": []}

    positive_reviews = df[df["sentiment"] == "Positive"]["review_text"].tolist()
    negative_reviews = df[df["sentiment"] == "Negative"]["review_text"].tolist()

    pros = extract_keywords(positive_reviews, 5)
    cons = extract_keywords(negative_reviews, 5)

    total = len(df)
    pos_pct = round((df["sentiment"] == "Positive").sum() / total * 100, 1) if total > 0 else 0

    pros_str = ", ".join(pros[:3]) if pros else "overall usability"
    cons_str = ", ".join(cons[:3]) if cons else "minor issues"

    summary = (
        f"Based on {total} reviews, {product_name} holds a {pos_pct}% positive sentiment. "
        f"Users most frequently highlight {pros_str} as standout strengths. "
        f"Some users raise concerns about {cons_str}. "
        f"Overall, it is well-received in its category."
    )

    return {"summary": summary, "pros": pros, "cons": cons}
