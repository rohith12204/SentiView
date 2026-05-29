import pandas as pd
import torch
from sklearn.model_selection import train_test_split
from transformers import (
    DistilBertTokenizerFast,
    DistilBertForSequenceClassification,
    Trainer,
    TrainingArguments
)

# =========================
# 1. LOAD & CLEAN DATA
# =========================
DATA_PATH = "ml/data/reviews.csv"

df = pd.read_csv(DATA_PATH)

# Keep only required columns
df = df[["review_text", "sentiment"]].dropna()

# Encode labels
label_map = {
    "negative": 0,
    "neutral": 1,
    "positive": 2
}

df["label"] = df["sentiment"].map(label_map)

# Drop rows where label mapping failed
df = df.dropna(subset=["label"])
df["label"] = df["label"].astype(int)

print("Label distribution:")
print(df["label"].value_counts())

# =========================
# 2. TRAIN / TEST SPLIT
# =========================
train_texts, test_texts, train_labels, test_labels = train_test_split(
    df["review_text"],
    df["label"],
    test_size=0.2,
    stratify=df["label"],
    random_state=42
)

# =========================
# 3. TOKENIZATION
# =========================
tokenizer = DistilBertTokenizerFast.from_pretrained(
    "distilbert-base-uncased"
)

train_encodings = tokenizer(
    train_texts.tolist(),
    truncation=True,
    padding=True,
    max_length=128
)

test_encodings = tokenizer(
    test_texts.tolist(),
    truncation=True,
    padding=True,
    max_length=128
)

# =========================
# 4. DATASET CLASS
# =========================
class ReviewDataset(torch.utils.data.Dataset):
    def __init__(self, encodings, labels):
        self.encodings = encodings
        self.labels = labels.tolist()

    def __getitem__(self, idx):
        item = {k: torch.tensor(v[idx]) for k, v in self.encodings.items()}
        item["labels"] = torch.tensor(self.labels[idx])
        return item

    def __len__(self):
        return len(self.labels)

train_dataset = ReviewDataset(train_encodings, train_labels)
test_dataset = ReviewDataset(test_encodings, test_labels)

# =========================
# 5. MODEL
# =========================
model = DistilBertForSequenceClassification.from_pretrained(
    "distilbert-base-uncased",
    num_labels=3
)

# =========================
# 6. TRAINING ARGUMENTS
# =========================
training_args = TrainingArguments(
    output_dir="ml/results",
    num_train_epochs=3,
    per_device_train_batch_size=16,
    per_device_eval_batch_size=16,
    logging_dir="ml/logs",
    logging_steps=100,
    save_strategy="epoch",
    eval_strategy="epoch",     # ✅ correct for your transformers version
    load_best_model_at_end=True,
    report_to="none"
)

# =========================
# 7. TRAINER
# =========================
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=test_dataset
)

# =========================
# 8. TRAIN
# =========================
trainer.train()

# =========================
# 9. SAVE MODEL
# =========================
SAVE_PATH = "ml/sentiview_model"

model.save_pretrained(SAVE_PATH)
tokenizer.save_pretrained(SAVE_PATH)

print(f"\n✅ Training completed successfully.")
print(f"✅ Model saved to: {SAVE_PATH}")
