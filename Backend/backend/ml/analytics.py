import pandas as pd
from pathlib import Path

BASE_DIR  = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "reviews.csv"

# BUG FIX: import from correct module names
from ml.summarizer import generate_summary as _gen_summary
from ml.fake_detector import detect_fake_review


def sentiment_percentage(group):
    positive = (group["sentiment"] == "Positive").sum()
    total = len(group)
    return round((positive / total) * 100, 1) if total > 0 else 0


def aspect_score(series):
    return round(float(series.mean()) * 20, 1)


def _extract_pros_cons(g):
    """Extract pros and cons from review dataframe."""
    from collections import Counter
    import re

    def keywords(texts):
        stopwords = {
            "this", "that", "with", "have", "from", "they", "will", "just",
            "been", "were", "some", "when", "than", "then", "also", "more",
            "very", "good", "great", "nice", "best", "well", "like", "really"
        }
        words = []
        for t in texts:
            if isinstance(t, str):
                cleaned = re.sub(r"[^a-zA-Z ]", "", t.lower())
                words.extend(cleaned.split())
        common = Counter(words).most_common(20)
        return [w for w, _ in common if len(w) > 3 and w not in stopwords][:5]

    pos_reviews = g[g["sentiment"] == "Positive"]["review_text"].tolist()
    neg_reviews = g[g["sentiment"] == "Negative"]["review_text"].tolist()
    return {
        "pros": keywords(pos_reviews),
        "cons": keywords(neg_reviews),
    }


def generate_product_analytics():
    # BUG FIX: wrap CSV load in try/except
    try:
        df = pd.read_csv(DATA_PATH)
    except FileNotFoundError:
        return []

    results = []

    for (brand, model), g in df.groupby(["brand", "model"]):
        g = g.copy()

        def is_fake(text):
            try:
                result = detect_fake_review(str(text))
                return result.get("is_fake", False)
            except Exception:
                return False

        g["is_fake"] = g["review_text"].apply(is_fake)
        g = g[~g["is_fake"]]

        if g.empty:
            continue

        # BUG FIX: generate_summary returns dict — extract "summary" key
        try:
            summary_result = _gen_summary(f"{brand} {model}")
            summary = summary_result.get("summary", "") if isinstance(summary_result, dict) else str(summary_result)
        except Exception:
            summary = f"{brand} {model} analytics summary."

        pros_cons = _extract_pros_cons(g)

        camera_score      = aspect_score(g["camera_rating"])      if "camera_rating"      in g.columns and g["camera_rating"].notna().any()      else 0
        battery_score     = aspect_score(g["battery_life_rating"]) if "battery_life_rating" in g.columns and g["battery_life_rating"].notna().any() else 0
        performance_score = aspect_score(g["performance_rating"])  if "performance_rating"  in g.columns and g["performance_rating"].notna().any()  else 0
        design_score      = aspect_score(g["design_rating"])       if "design_rating"       in g.columns and g["design_rating"].notna().any()       else 0
        display_score     = aspect_score(g["display_rating"])      if "display_rating"      in g.columns and g["display_rating"].notna().any()      else 0

        results.append({
            "name":             f"{brand} {model}",
            "brand":            brand,
            "model":            model,
            "total_reviews":    len(g),
            "sentiment_score":  sentiment_percentage(g),
            "avg_rating":       round(float(g["rating"].mean()), 2),
            "camera_score":     camera_score,
            "battery_score":    battery_score,
            "performance_score": performance_score,
            "aspects": {
                "Camera":      camera_score,
                "Battery":     battery_score,
                "Performance": performance_score,
                "Design":      design_score,
                "Display":     display_score,
            },
            "summary": summary,
            "pros":    pros_cons["pros"][:5],
            "cons":    pros_cons["cons"][:5],
        })

    return results
