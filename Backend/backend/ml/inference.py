import os
import torch
from transformers import DistilBertTokenizerFast, DistilBertForSequenceClassification
from django.conf import settings

# =========================================================
# Model path
# =========================================================
MODEL_PATH = os.path.join(
    settings.BASE_DIR,
    "ml",
    "sentiview_model"
)

# =========================================================
# Load tokenizer & model (LOCAL) — lazy so startup never blocks
# =========================================================
_tokenizer = None
_model = None

def _get_model():
    global _tokenizer, _model
    if _model is None:
        try:
            _tokenizer = DistilBertTokenizerFast.from_pretrained(
                MODEL_PATH,
                local_files_only=True
            )
            _model = DistilBertForSequenceClassification.from_pretrained(
                MODEL_PATH,
                local_files_only=True
            )
            _model.eval()
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to load sentiview_model: {e}")
            _model = None
            _tokenizer = None
    return _tokenizer, _model

# =========================================================
# Label mapping
# =========================================================
LABEL_MAP = {
    0: "negative",
    1: "neutral",
    2: "positive"
}

CONFIDENCE_THRESHOLD = 0.6


def is_english(text: str) -> bool:
    try:
        from langdetect import detect, LangDetectException
        return detect(text) == "en"
    except Exception:
        return True   # BUG FIX: if langdetect fails, don't block all texts


def predict_sentiment(text: str):
    """
    Predict sentiment with:
    - language filtering
    - confidence thresholding
    - graceful fallback when model is not loaded
    """

    # 1. Language filter
    if not is_english(text):
        return {
            "label": "uncertain",
            "raw_prediction": None,
            "confidence": 0.0,
            "scores": {"negative": 0.0, "neutral": 0.0, "positive": 0.0},
            "reason": "Non-English text detected"
        }

    tokenizer, model = _get_model()

    # BUG FIX: Graceful fallback if model not available
    if model is None or tokenizer is None:
        return {
            "label": "uncertain",
            "raw_prediction": None,
            "confidence": 0.0,
            "scores": {"negative": 0.0, "neutral": 0.0, "positive": 0.0},
            "reason": "Model not loaded"
        }

    # 2. Model inference
    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=128
    )

    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits
        probs = torch.softmax(logits, dim=1)[0]

        predicted_class = torch.argmax(probs).item()
        confidence = probs[predicted_class].item()

    raw_label = LABEL_MAP[predicted_class]

    # 3. Confidence logic
    if raw_label == "neutral" or confidence < CONFIDENCE_THRESHOLD:
        final_label = "uncertain"
    else:
        final_label = raw_label

    return {
        "label": final_label,
        "raw_prediction": raw_label,
        "confidence": round(confidence, 4),
        "scores": {
            "negative": round(probs[0].item(), 4),
            "neutral":  round(probs[1].item(), 4),
            "positive": round(probs[2].item(), 4)
        }
    }
