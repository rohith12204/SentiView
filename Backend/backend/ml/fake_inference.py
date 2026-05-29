import torch
from transformers import DistilBertTokenizerFast, DistilBertForSequenceClassification
from django.conf import settings
import os
import logging

logger = logging.getLogger(__name__)

MODEL_PATH = os.path.join(settings.BASE_DIR, "ml", "fake_model")


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
            logger.info("fake_model loaded successfully.")
        except Exception as e:
            logger.error(f"Could not load fake_model: {e}")
            _model = None
            _tokenizer = None
    return _tokenizer, _model


LABELS = {0: "real", 1: "fake"}


def predict_fake_review(text: str):
    tokenizer, model = _get_model()

    
    if model is None or tokenizer is None:
        return {
            "label": "unknown",
            "confidence": 0.5,
            "scores": {"real": 0.5, "fake": 0.5}
        }

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=128
    )

    with torch.no_grad():
        outputs = model(**inputs)
        probs = torch.softmax(outputs.logits, dim=1)[0]

        pred = torch.argmax(probs).item()
        confidence = probs[pred].item()

    return {
        "label": LABELS[pred],
        "confidence": round(confidence, 4),
        "scores": {
            "real": round(probs[0].item(), 4),
            "fake": round(probs[1].item(), 4)
        }
    }
