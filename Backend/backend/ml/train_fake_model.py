import pandas as pd
import torch
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
from transformers import (
    DistilBertTokenizerFast,
    DistilBertForSequenceClassification,
    Trainer,
    TrainingArguments
)

# =====================
# CONFIG
# =====================
DATA_PATH = "data/reviews_with_fake_labeled.csv"
MODEL_SAVE_PATH = "ml/fake_model"

# =====================
# LOAD DATA
# =====================
df = pd.read_csv(DATA_PATH)

# 🔥 KEEP ONLY REQUIRED COLUMNS
df = df[["text", "label"]]

# Rename column
df = df.rename(columns={"text": "review"})

# Remove nulls safely
df = df.dropna(subset=["review", "label"])

# 🔥 FIX LABELS (YOUR DATA ALREADY 0/1)
df["label"] = df["label"].astype(int)

# Remove invalid labels (safety)
df = df[df["label"].isin([0, 1])]

print("✅ Dataset loaded:", df.shape)
print("✅ Label distribution:\n", df["label"].value_counts())

# =====================
# TRAIN / VAL SPLIT
# =====================
train_texts, val_texts, train_labels, val_labels = train_test_split(
    df["review"],
    df["label"],
    test_size=0.2,
    stratify=df["label"],
    random_state=42
)

# =====================
# TOKENIZER
# =====================
tokenizer = DistilBertTokenizerFast.from_pretrained(
    "distilbert-base-uncased"
)

train_enc = tokenizer(
    train_texts.tolist(),
    truncation=True,
    padding=True,
    max_length=128
)

val_enc = tokenizer(
    val_texts.tolist(),
    truncation=True,
    padding=True,
    max_length=128
)

# =====================
# DATASET CLASS
# =====================
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

train_dataset = ReviewDataset(train_enc, train_labels)
val_dataset = ReviewDataset(val_enc, val_labels)

# =====================
# MODEL
# =====================
model = DistilBertForSequenceClassification.from_pretrained(
    "distilbert-base-uncased",
    num_labels=2
)

# =====================
# METRICS
# =====================
def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = torch.argmax(torch.tensor(logits), dim=1).numpy()

    acc = accuracy_score(labels, preds)

    return {"accuracy": acc}

# =====================
# TRAINING CONFIG
# =====================
training_args = TrainingArguments(
    output_dir=MODEL_SAVE_PATH,
    num_train_epochs=3,
    per_device_train_batch_size=16,
    per_device_eval_batch_size=16,
    evaluation_strategy="epoch",
    save_strategy="epoch",
    logging_steps=100,
    load_best_model_at_end=True,
    report_to="none"
)

# =====================
# TRAINER
# =====================
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=val_dataset,
    compute_metrics=compute_metrics
)

# =====================
# TRAIN
# =====================
print("\n🚀 Training started...\n")
trainer.train()

# =====================
# EVALUATION
# =====================
predictions = trainer.predict(val_dataset)
preds = torch.argmax(torch.tensor(predictions.predictions), dim=1).numpy()

print("\n📊 Classification Report:")
print(classification_report(val_labels, preds, target_names=["Real", "Fake"]))

# =====================
# SAVE MODEL
# =====================
model.save_pretrained(MODEL_SAVE_PATH)
tokenizer.save_pretrained(MODEL_SAVE_PATH)

print("\n✅ Fake Review Model Training Completed!")
print(f"📦 Model saved at: {MODEL_SAVE_PATH}")