import re
import fake_review
import torch
from transformers import DistilBertTokenizerFast, DistilBertForSequenceClassification
from django.conf import settings
import logging,os

logger = logging.getLogger(__name__)

MODEL_PATH = os.path.join(settings.BASE_DIR, "ml", "fake_model")

def is_fake_review(text: str) -> bool:

    if not text or not isinstance(text, str):
        return True

    words = text.lower().split()

    # Too short
    if len(words) < 3:
        return True

    # Excessive punctuation patterns
    if len(re.findall(r"[!?.]{3,}", text)) > 0:
        return True

    # FIXED: Only flag if >40% 
    unique_ratio = len(set(words)) / len(words)
    if unique_ratio < 0.6:
        return True

    return False
