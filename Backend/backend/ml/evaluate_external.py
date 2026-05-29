import os
import pandas as pd
import torch
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from transformers import DistilBertTokenizerFast, DistilBertForSequenceClassification
from langdetect import detect, LangDetectException

# =========================================================
# Paths
# =========================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATA_PATH = os.path.join(
    BASE_DIR,
    "data",
    "external_reviews.csv"
)

MODEL_PATH = os.path.join(
    BASE_DIR,
    "sentiview_model"
)

# =========================================================
# Helper functions
# =========================================================
def is_ascii(text: str) -> bool:
    """Fast heuristic: removes most non-English text"""
    return text.isascii()

def is_english(text: str) -> bool:
    """Accurate language detection (slow, use after ASCII filter)"""
    try:
        return detect(text) == "en"
    except LangDetectException:
        return False

def map_sentiment(rating):
    """Map ratings to binary sentiment"""
    if rating <= 2:
        return 0  # Negative
    elif rating >= 4:
        return 1  # Positive
    else:
        return None  # Ignore neutral (rating == 3)

# =========================================================
# Load Dataset B
# =========================================================
df = pd.read_csv(DATA_PATH)

print("\n🔎 Dataset B columns:")
print(df.columns)

print("\n🔎 Sample review:")
print(df["review"].iloc[0])

# Ensure text is string
df["review"] = df["review"].astype(str)

# Remove empty / very short reviews
df = df[df["review"].str.strip().str.len() > 3]

# =========================================================
# 🔥 Language filtering (FAST → SLOW)
# =========================================================

# 1️⃣ Fast ASCII filter
df = df[df["review"].apply(is_ascii)]
print(f"\n🧹 After ASCII filter: {len(df)}")

# 2️⃣ Accurate English filter
df = df[df["review"].apply(is_english)]
print(f"🧹 After langdetect filter: {len(df)}")

# =========================================================
# Rating → Sentiment mapping
# =========================================================
df["label"] = df["rating"].apply(map_sentiment)
df = df.dropna(subset=["label"])

# Optional size cap (recommended)
MAX_SAMPLES = 10000
df = df.sample(n=min(MAX_SAMPLES, len(df)), random_state=42)

print(f"\n🧪 Final evaluation size: {len(df)}")

texts = df["review"].tolist()
labels = df["label"].astype(int).tolist()

# =========================================================
# Load model & tokenizer
# =========================================================
tokenizer = DistilBertTokenizerFast.from_pretrained(
    MODEL_PATH,
    local_files_only=True
)

model = DistilBertForSequenceClassification.from_pretrained(
    MODEL_PATH,
    local_files_only=True
)

model.eval()

# =========================================================
# Run inference
# =========================================================
predictions = []

with torch.no_grad():
    for i, text in enumerate(texts):

        if i % 1000 == 0:
            print(f"Processed {i} samples...")

        inputs = tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            padding=True,
            max_length=128
        )

        outputs = model(**inputs)
        pred = torch.argmax(outputs.logits, dim=1).item()

        # Map 3-class → binary
        if pred == 1:          # Neutral
            predictions.append(1)  # Treat as Positive
        else:
            predictions.append(pred)

# =========================================================
# Metrics
# =========================================================
print("\n✅ External Dataset (English-only) Accuracy:")
print(accuracy_score(labels, predictions))

print("\n📊 Classification Report (English-only):")
print(
    classification_report(
        labels,
        predictions,
        target_names=["Negative", "Positive"],
        labels=[0, 1]
    )
)

print("\n🧩 Confusion Matrix (English-only):")
print(confusion_matrix(labels, predictions))
