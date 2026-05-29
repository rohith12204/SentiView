from transformers import pipeline

# Load summarization model (lightweight)
summarizer = pipeline(
    "summarization",
    model="facebook/bart-large-cnn"
)


def generate_summary(reviews):
    """
    Generate AI summary from reviews
    """

    # join top reviews
    text = " ".join(reviews[:20])  # limit for performance

    if len(text) < 50:
        return "Not enough data for summary"

    summary = summarizer(
        text,
        max_length=120,
        min_length=40,
        do_sample=False
    )

    return summary[0]["summary_text"]

from collections import Counter


def extract_pros_cons(df):
    """
    Extract pros & cons using sentiment + keywords
    """

    positive_reviews = df[df["sentiment"] == "Positive"]["review_text"]
    negative_reviews = df[df["sentiment"] == "Negative"]["review_text"]

    def get_keywords(texts):
        words = " ".join(texts).lower().split()
        common = Counter(words).most_common(10)
        return [w for w, _ in common if len(w) > 3]

    return {
        "pros": get_keywords(positive_reviews),
        "cons": get_keywords(negative_reviews)
    }