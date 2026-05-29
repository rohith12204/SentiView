import pandas as pd
import torch
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    classification_report,
    confusion_matrix
)
from transformers import (
    DistilBertTokenizerFast,
    DistilBertForSequenceClassification
)

# =========================
# 1. LOAD DATA
# =========================
DATA_PATH = "ml/data/reviews.csv"
MODEL_PATH = "ml/sentiview_model"

df = pd.read_csv(DATA_PATH)

df = df[["review_text", "sentiment"]].dropna()

label_map = {
    "negative": 0,
    "neutral": 1,
    "positive": 2
}

df["label"] = df["sentiment"].map(label_map)
df = df.dropna(subset=["label"])
df["label"] = df["label"].astype(int)

# =========================
# 2. TRAIN / TEST SPLIT (same as training)
# =========================
_, test_texts, _, test_labels = train_test_split(
    df["review_text"],
    df["label"],
    test_size=0.2,
    stratify=df["label"],
    random_state=42
)

# =========================
# 3. LOAD MODEL & TOKENIZER
# =========================
tokenizer = DistilBertTokenizerFast.from_pretrained(MODEL_PATH)
model = DistilBertForSequenceClassification.from_pretrained(MODEL_PATH)

model.eval()

# =========================
# 4. TOKENIZE TEST DATA
# =========================
encodings = tokenizer(
    test_texts.tolist(),
    truncation=True,
    padding=True,
    max_length=128,
    return_tensors="pt"
)

# =========================
# 5. INFERENCE
# =========================
with torch.no_grad():
    outputs = model(**encodings)
    logits = outputs.logits
    predictions = torch.argmax(logits, dim=1).numpy()

true_labels = test_labels.to_numpy()

# =========================
# 6. METRICS
# =========================
accuracy = accuracy_score(true_labels, predictions)
precision, recall, f1, _ = precision_recall_fscore_support(
    true_labels, predictions, average="weighted"
)

print("\n===== MODEL EVALUATION RESULTS =====\n")
print(f"Accuracy  : {accuracy:.4f}")
print(f"Precision : {precision:.4f}")
print(f"Recall    : {recall:.4f}")
print(f"F1-score  : {f1:.4f}")

print("\n--- Classification Report ---")
print(classification_report(
    true_labels,
    predictions,
    target_names=["Negative", "Neutral", "Positive"]
))

# =========================
# 7. CONFUSION MATRIX
# =========================
cm = confusion_matrix(true_labels, predictions)

print("\n--- Confusion Matrix ---")
print(cm)

# =========================
# 8. SAVE RESULTS (optional)
# =========================
results = {
    "accuracy": accuracy,
    "precision": precision,
    "recall": recall,
    "f1_score": f1
}

results_df = pd.DataFrame([results])
results_df.to_csv("ml/results/evaluation_metrics.csv", index=False)

print("\n✅ Evaluation completed successfully.")
print("✅ Metrics saved to ml/results/evaluation_metrics.csv")
