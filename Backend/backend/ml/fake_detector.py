"""
fake_detector.py  —  Improved Fake Review Detector for SentiView
=================================================================

Signals Detected:
  1.  Promotional Language        → discount codes, buy now, referral, affiliate
  2.  Spam / Contact Info         → URLs, emails, phone numbers, social handles
  3.  Gift / Incentive            → "got this free", "sponsored", "pr sample"
  4.  Rating–Sentiment Mismatch   → 1★ + positive text, 5★ + negative text
  5.  Hollow Generic Review       → short, no real pronoun context, no detail
  6.  Imperative Push Language    → "must buy", "just go for it", command tone
  7.  Platform-Addressed Review   → "thank you Amazon", "thanks seller"
  8.  Competitor Attack / Troll   → short 1★ attack with no real experience
  9.  Robotic Repetition          → repeated superlatives / word loops

Genuine Signals (reduce risk score):
  - Real experience phrases (bought, used for X weeks, I've been using)
  - Contrast words (but, however, although) with specifics
  - Measurements / numbers (40 minutes, 20% to 80%)
  - Feature-specific vocabulary (battery, camera, lag, display)
  - Personal pronoun WITH real context (not just "I've ever used")
"""

from __future__ import annotations

import re
from collections import Counter
from typing import Optional


# ══════════════════════════════════════════════════════════════════════════════
# PATTERN LIBRARIES
# ══════════════════════════════════════════════════════════════════════════════

PROMO_PATTERNS = [
    r"\b(use|apply|enter)\s+(code|coupon|promo|discount)\b",
    r"\b(discount|coupon|promo)\s*(code|offer|deal)\b",
    r"\b(buy\s+now|order\s+now|shop\s+now|click\s+here|visit\s+us)\b",
    r"\b(limited\s+time\s+offer|exclusive\s+deal|special\s+price)\b",
    r"\b(referral|affiliate|commission)\b",
]

SPAM_PATTERNS = [
    r"https?://\S+",
    r"\bwww\.\S+\.\S+\b",
    r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b",
    r"\b\d{10}\b",
    r"\b(whatsapp|telegram|instagram|facebook|tiktok)\s*(me|us|at|:\s*@)\b",
    r"\b(contact\s+us|dm\s+us|message\s+us|call\s+us)\b",
    r"\b(check\s+out\s+our|visit\s+our\s+website|our\s+store)\b",
]

GIFT_PATTERNS = [
    r"\b(got\s+this|received\s+(this|it))?\s*(for\s+free|free\s+of\s+charge)\b",
    r"\b(complimentary|gifted|freebie|giveaway)\b",
    r"\b(in\s+exchange\s+for|in\s+return\s+for)\s*(a\s+)?(review|feedback|rating)\b",
    r"\b(sponsored\s+(review|post|by))\b",
    r"\b(paid\s+(to\s+review|review|partnership))\b",
    r"\b(received\s+.{0,20}(for|to)\s+(review|test|evaluate))\b",
    r"\b(asked\s+to\s+write|requested\s+a\s+review)\b",
    r"\b(brand\s+(sent|gave|provided)|company\s+(sent|gave|provided))\b",
    r"\b(pr\s+(sample|product|unit))\b",
    r"\b(got\s+it\s+free|given\s+for\s+free|provided\s+free)\b",
]

PLATFORM_ADDRESS_PATTERNS = [
    r"\b(thank\s+you|thanks)\s+(amazon|flipkart|meesho|myntra|snapdeal|ebay"
    r"|walmart|seller|brand|company|store|shop|team)\b",
    r"\b(amazon|flipkart|meesho)\s+(is\s+)?(great|amazing|best|awesome|excellent)\b",
    r"\bthank\s+you\s+for\s+(this|the)\s+(amazing|great|wonderful|excellent|fantastic)\b",
]

IMPERATIVE_PATTERNS = [
    r"^(must|just|go|totally|absolutely)\b",
    r"\b(just\s+(go\s+for\s+it|buy\s+it|get\s+it))\b",
    r"\b(don[\'']?t\s+miss|without\s+thinking|blindly\s+buy)\b",
    r"\b(everyone\s+(must|should)\s+buy)\b",
    r"\b(go\s+for\s+it|grab\s+it\s+now|get\s+it\s+now)\b",
    r"\b(must\s+buy|must\s+have)\b",
]

STRONG_POSITIVE_WORDS = [
    "excellent", "amazing", "perfect", "outstanding", "superb", "fantastic",
    "brilliant", "wonderful", "love it", "best product", "highly recommend",
    "absolutely love", "great product", "very happy", "totally satisfied",
    "no complaints", "five star", "top notch", "best purchase", "awesome",
    "incredible", "exceptional", "unbelievable", "mind-blowing", "mind blowing",
    "best ever", "best phone", "best deal", "must buy",
]

STRONG_NEGATIVE_WORDS = [
    "terrible", "horrible", "worst", "awful", "disgusting", "pathetic",
    "useless", "complete waste", "total waste", "money waste", "do not buy",
    "don't buy", "never buy", "disappointed", "defective", "broken", "fraud",
    "scam", "fake product", "very bad", "extremely bad", "poor quality",
    "trash", "garbage", "junk", "regret buying", "return immediately",
    "absolute garbage", "waste of money", "rubbish", "zero performance",
    "totally useless", "avoid at all costs", "don't even consider",
    "cheap quality", "fake specs", "very disappointing",
    "not worth", "not good", "very poor",
]

SUPERLATIVE_WORDS = [
    "best", "greatest", "amazing", "excellent", "perfect", "wonderful",
    "fantastic", "outstanding", "superb", "awesome", "incredible",
    "mind-blowing", "unbelievable", "exceptional", "brilliant", "extraordinary",
    "magnificent", "phenomenal", "spectacular", "flawless",
]

# Generic positive filler phrases — hallmarks of fake/bot reviews
GENERIC_POSITIVE_PHRASES = [
    r"\b(highly recommend(ed)?(\s+to\s+(everyone|all|anybody)))\b",
    r"\bno\s+complaints\s+(at\s+all)?\b",
    r"\b(loved?\s+it\s+so\s+much)\b",
    r"\b(everything\s+is\s+perfect)\b",
    r"\b(100\s*%\s*(satisfied|happy|recommend))\b",
    r"\b(best\s+(deal|product|phone|buy)\s+(ever|in\s+the\s+market))\b",
    r"\b(don[\'']?t\s+miss\s+this)\b",
    r"\b(worth\s+every\s+(penny|rupee|cent))\b",
    r"\b(totally\s+worth\s+it)\b",
    r"\b(it[\'']?s\s+the\s+best)\b",
    r"\bmust\s+buy\b",
    # "The most X I've ever used/seen/owned" — superlative template, not real experience
    r"\b(the\s+most\s+\w+(\s+\w+)?\s+i[\'']?ve\s+ever\s+(used|seen|owned|had|tried|bought))\b",
]

# Generic negative filler phrases — hallmarks of troll/competitor-attack reviews
GENERIC_NEGATIVE_PHRASES = [
    r"\b(worst\s+(phone|product|purchase|buy)\s+ever)\b",
    r"\b(don[\'']?t\s+(buy|even\s+consider)\s+this)\b",
    r"\b(avoid\s+at\s+all\s+costs)\b",
    r"\b(complete(ly)?\s+useless)\b",
    r"\b(total(ly)?\s+(waste|useless))\b",
    r"\b(zero\s+performance)\b",
    r"\b(very\s+bad\s+experience)\b",
    r"\b(not\s+worth\s+anything)\b",
    r"\b(very\s+poor\s+phone)\b",
    r"\b(not\s+good\s+at\s+all)\b",
    r"\b(fake\s+specs)\b",
    r"\b(cheap\s+quality)\b",
    r"\b(very\s+disappointing)\b",
    r"\b(i\s+regret\s+buying)\b",
]

# Real experience patterns (not just feature-word presence)
# KEY FIX: single-word features like "camera" are NOT genuine signals —
# they must appear WITH context (usage verbs, time refs, measurements).
GENUINE_PATTERNS = [
    r"\b(i\s+(bought|purchased|ordered|received|got|have\s+been|had))\b",
    r"\bi[\'']ve\s+(been\s+using|used\s+(it|this|for)|had\s+(it|this)|owned)\b",
    r"\b(after\s+\d+\s+(days|weeks|months|years)\s+of\s+(use|using))\b",
    r"\b(in\s+my\s+experience)\b",
    r"\b(i\s+have\s+been\s+using)\b",
    r"\b(compared\s+to\s+my\s+(old|previous|last))\b",
    r"\b(customer\s+service|delivery|packaging|unboxing)\b",
    r"\b(pros\s*:|cons\s*:|update\s*:)\b",
    r"\b\d+\s*(minutes?|hours?|days?|weeks?|months?)\b",
    r"\b(\d+%|\d+\s*(mb|gb|hz|mp|mm|mah|watt|watts))\b",
    r"\b(from\s+\d+%\s+to\s+\d+%|goes\s+from\s+\d+)\b",
    # Feature + verb context = genuine (not bare feature-word alone)
    r"\b(battery\s+(lasts?|drains?|life|health|backup))\b",
    r"\b(camera\s+(quality|performance|is|takes?|captures?|shoots?))\b",
    r"\b(display\s+(is|looks?|feels?|brightness))\b",
    r"\b(speaker\s+(is|sounds?|lacks?|quality))\b",
    r"\b(charging\s+(is|speed|takes?|fast|slow))\b",
    r"\b(fingerprint\s+(sensor|works?|fails?|scanner))\b",
    r"\b(performance\s+is|gaming\s+performance|multitasking)\b",
    r"\b(heats?\s+up|gets?\s+hot|overheats?)\b",
    r"\b(lag(s|ging)?|stutter(s|ing)?|freeze|crash(es|ing)?)\b",
    r"\b(it\s+(works|runs|feels|looks|sounds|heats|drains))\b",
]

# Feature vocabulary for bonus deduction (lighter weight — not a genuine experience alone)
FEATURE_VOCAB = [
    r"\b(battery|camera|display|screen|processor|ram|storage|speaker"
    r"|fingerprint|charging|ui|software|hardware|build|design|weight)\b",
    r"\b(lag|stutter|freeze|crash|heat|overheat|drain|blur|noise|bass)\b",
    r"\b(daylight|low.light|night\s+mode|portrait|zoom|selfie)\b",
    r"\b(fast\s+charging|wireless\s+charging|usb.c|headphone\s+jack)\b",
]


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _matches_any(text: str, patterns: list[str]) -> list[str]:
    return [p for p in patterns if re.search(p, text, re.IGNORECASE)]

def _count_words(text: str) -> int:
    return len(text.strip().split())

def _count_strong_positive(text: str) -> int:
    tl = text.lower()
    return sum(1 for w in STRONG_POSITIVE_WORDS if w in tl)

def _count_strong_negative(text: str) -> int:
    tl = text.lower()
    return sum(1 for w in STRONG_NEGATIVE_WORDS if w in tl)

def _count_superlatives(text: str) -> int:
    tl = text.lower()
    return sum(1 for w in SUPERLATIVE_WORDS if re.search(r'\b' + re.escape(w) + r'\b', tl))

def _count_generic_positive(text: str) -> int:
    return sum(1 for p in GENERIC_POSITIVE_PHRASES if re.search(p, text, re.IGNORECASE))

def _count_generic_negative(text: str) -> int:
    return sum(1 for p in GENERIC_NEGATIVE_PHRASES if re.search(p, text, re.IGNORECASE))

def _has_genuine_signal(text: str) -> bool:
    return any(re.search(p, text, re.IGNORECASE) for p in GENUINE_PATTERNS)

def _has_feature_vocab(text: str) -> bool:
    return any(re.search(p, text, re.IGNORECASE) for p in FEATURE_VOCAB)

def _has_personal_pronoun(text: str) -> bool:
    return bool(re.search(r"\b(i|my|me|we|our|i've|i'm|i'd)\b", text, re.IGNORECASE))

def _has_real_pronoun_context(text: str) -> bool:
    """True only if the pronoun appears with real experience context — not just
    in superlative templates like 'the most X I've ever used'."""
    if not _has_personal_pronoun(text):
        return False
    # Discount superlative-template usage of pronouns
    superlative_template = r"\b(the\s+most\s+\w+(\s+\w+)?\s+i[\'']?ve\s+ever\s+\w+)\b"
    if re.search(superlative_template, text, re.IGNORECASE):
        return False
    return True

def _has_contrast_word(text: str) -> bool:
    return bool(re.search(
        r"\b(but|however|although|though|except|despite|yet|still|whereas)\b",
        text, re.IGNORECASE
    ))

def _has_specific_numbers(text: str) -> bool:
    return bool(re.search(
        r"\b(\d+\s*(minutes?|hours?|days?|weeks?|months?|%|mb|gb|hz|mp|mm|mah|watt)"
        r"|\d+\s+to\s+\d+)\b",
        text, re.IGNORECASE
    ))

def _superlative_density(text: str) -> float:
    wc = _count_words(text)
    return _count_superlatives(text) / wc if wc else 0.0

def _has_robotic_repetition(text: str) -> bool:
    stopwords = {
        'this','that','with','have','from','they','what','when','your',
        'just','dont','very','also','than','been','were','will','each',
        'more','most','some','even','only','such',
    }
    words = [w for w in text.lower().split() if len(w) > 3 and w not in stopwords]
    return any(c >= 3 for c in Counter(words).values())


# ══════════════════════════════════════════════════════════════════════════════
# MAIN DETECTOR
# ══════════════════════════════════════════════════════════════════════════════

def detect_fake_review(text: str, rating: Optional[int] = None) -> dict:
    """
    Analyze a review and return a fake detection result.

    Parameters
    ----------
    text   : Review text string
    rating : Numeric star rating 1–5 (optional, improves accuracy)

    Returns
    -------
    dict with keys:
        is_fake        : bool
        confidence     : float  (0–100)
        label          : "Fake" | "Genuine"
        fake_type      : str | None
        reasons        : list[str]
        risk_score     : float  (0–100)
        signals        : dict[str, bool]
    """
    if not text or not text.strip():
        return _empty_result()

    text = text.strip()
    wc = _count_words(text)
    reasons: list[str] = []
    risk_score = 0.0
    fake_type: Optional[str] = None

    signals: dict[str, bool] = {
        "promotional":        False,
        "spam_content":       False,
        "gift_incentive":     False,
        "rating_mismatch":    False,
        "hollow_generic":     False,
        "imperative_push":    False,
        "platform_address":   False,
        "competitor_attack":  False,
        "robotic_repetition": False,
        "genuine_signals":    False,
    }

    # ── Pre-compute all features ───────────────────────────────────────────────
    genuine         = _has_genuine_signal(text)
    feature_vocab   = _has_feature_vocab(text)
    real_pronoun    = _has_real_pronoun_context(text)   # pronoun WITH real context
    contrast        = _has_contrast_word(text)
    specific_nums   = _has_specific_numbers(text)
    sup_count       = _count_superlatives(text)
    sup_density     = _superlative_density(text)
    pos_count       = _count_strong_positive(text)
    neg_count       = _count_strong_negative(text)
    gen_pos         = _count_generic_positive(text)
    gen_neg         = _count_generic_negative(text)

    signals["genuine_signals"] = genuine

    is_short    = wc <= 14
    no_pronoun  = not real_pronoun        # uses real_pronoun, not raw pronoun
    no_contrast = not contrast
    no_specific = not specific_nums
    no_genuine  = not genuine

    # ── Signal 1: Spam / Contact Info ─────────────────────────────────────────
    if _matches_any(text, SPAM_PATTERNS):
        signals["spam_content"] = True
        risk_score += 50
        reasons.append("Contains URLs, contact details, or social media handles — spam pattern")
        fake_type = "Spam / Contact Info"

    # ── Signal 2: Promotional Language ───────────────────────────────────────
    if _matches_any(text, PROMO_PATTERNS):
        signals["promotional"] = True
        risk_score += 40
        reasons.append("Contains promotional language (discount codes, 'buy now', referral links)")
        if not fake_type:
            fake_type = "Promotional Content"

    # ── Signal 3: Gift / Incentive ────────────────────────────────────────────
    if _matches_any(text, GIFT_PATTERNS):
        signals["gift_incentive"] = True
        risk_score += 50
        reasons.append("Review appears incentivized (free product, sponsored, or gifted for review)")
        if not fake_type:
            fake_type = "Incentivized Review"

    # ── Signal 4: Platform-Addressed Review ──────────────────────────────────
    if _matches_any(text, PLATFORM_ADDRESS_PATTERNS) and wc <= 15:
        signals["platform_address"] = True
        risk_score += 55
        reasons.append(
            "Review addresses platform/seller directly (e.g. 'thank you Amazon') — bot/incentivized pattern"
        )
        if not fake_type:
            fake_type = "Platform-Addressed / Bot Review"

    # ── Signal 5: Rating–Sentiment Mismatch ──────────────────────────────────
    if rating is not None:
        if rating == 1 and pos_count >= 2 and neg_count == 0:
            signals["rating_mismatch"] = True
            risk_score += 55
            reasons.append(
                f"Rating–sentiment mismatch: 1★ with {pos_count} positive phrase(s), zero negative"
            )
            if not fake_type:
                fake_type = "Rating–Sentiment Mismatch (1★ + Positive Text)"

        elif rating == 5 and neg_count >= 2 and pos_count == 0:
            signals["rating_mismatch"] = True
            risk_score += 55
            reasons.append(
                f"Rating–sentiment mismatch: 5★ with {neg_count} negative phrase(s), zero positive"
            )
            if not fake_type:
                fake_type = "Rating–Sentiment Mismatch (5★ + Negative Text)"

    # ── Signal 6: Hollow / Generic Positive Review ────────────────────────────
    #
    # Evidence scoring — fire when hollow_pos_score >= 3
    #
    # Covers:
    #   "Amazing phone, unbelievable performance!"         → sup + short + no pronoun
    #   "The most fantastic smartphone I've ever used!"    → gen_pos (superlative template)
    #   "Loved it so much, highly recommend to everyone!"  → gen_pos phrase
    #   "Excellent product, no complaints at all!"         → gen_pos phrase
    #   "Best phone in the market right now!"              → gen_pos phrase
    #   "Mind-blowing camera and performance!"             → density + short + no pronoun
    #   "Superb quality, everything is perfect!"           → gen_pos phrase
    #   "Must buy this phone, best product ever!"          → gen_pos (must buy) + sup
    #   "Don't miss this, it's the best deal ever!"        → gen_pos + sup
    #   "Mind-blowing camera and performance!"             → density>=25%
    #
    hollow_pos_score = 0

    if is_short and sup_count >= 1 and no_pronoun and no_genuine:
        hollow_pos_score += 3       # short + superlative + no-real-pronoun + no-experience

    if gen_pos >= 1 and no_genuine:
        hollow_pos_score += 3       # generic filler phrase with no real experience

    if is_short and sup_density >= 0.20 and no_genuine:
        hollow_pos_score += 2       # high superlative density — pure hype

    if is_short and pos_count >= 2 and no_pronoun and no_specific:
        hollow_pos_score += 2       # multiple strong-positive terms, no specifics

    if hollow_pos_score >= 3:
        signals["hollow_generic"] = True
        risk_score += 48 if hollow_pos_score >= 5 else 40
        reasons.append(
            f"Hollow generic positive review — {wc} words, {sup_count} superlative(s), "
            f"{gen_pos} filler phrase(s), no personal usage experience or specific detail"
        )
        if not fake_type:
            fake_type = "Hollow Generic Review"

    # ── Signal 7: Hollow / Generic Negative Review ───────────────────────────
    #
    # Covers:
    #   "Worst phone ever, don't buy this!"             → gen_neg + short + no genuine
    #   "Totally useless product, waste of money!"      → gen_neg + neg_count
    #   "Very bad experience, not worth anything!"      → gen_neg
    #   "Horrible phone, I regret buying it!"           → gen_neg (regret buying)
    #   "Cheap quality, very disappointing!"            → gen_neg
    #   "Zero performance, totally fake specs!"         → gen_neg (zero performance, fake specs)
    #   "Completely useless, avoid at all costs!"       → gen_neg
    #   "Not good at all, very poor phone!"             → gen_neg
    #   "This phone is trash, don't even consider it!" → gen_neg + neg_count
    #
    hollow_neg_score = 0

    if is_short and neg_count >= 1 and no_genuine and no_specific:
        hollow_neg_score += 3

    if gen_neg >= 1 and no_genuine and no_specific:
        hollow_neg_score += 3

    if is_short and neg_count >= 2 and no_specific:
        hollow_neg_score += 2

    # Pronoun doesn't redeem "I regret buying it" — no specific detail given
    if _has_personal_pronoun(text) and no_genuine and no_specific and is_short and neg_count >= 1:
        hollow_neg_score += 1

    if hollow_neg_score >= 3:
        signals["competitor_attack"] = True
        risk_score += 48 if hollow_neg_score >= 5 else 40
        reasons.append(
            f"Hollow generic negative review / competitor attack — {wc} words, "
            f"{neg_count} negative phrase(s), {gen_neg} filler phrase(s), "
            f"no real usage detail or specific information"
        )
        if not fake_type:
            fake_type = "Competitor Attack / Troll Review"

    # ── Signal 8: Imperative Push Language ───────────────────────────────────
    if _matches_any(text, IMPERATIVE_PATTERNS) and pos_count >= 1 and wc <= 15 and no_genuine:
        signals["imperative_push"] = True
        risk_score += 32
        reasons.append(
            "Imperative/command tone ('must buy', 'just go for it', 'don't miss') "
            "with no personal experience — marketing language"
        )
        if not fake_type:
            fake_type = "Promotional Push Review"

    # ── Signal 9: Robotic Repetition ─────────────────────────────────────────
    if _has_robotic_repetition(text) or sup_count >= 6:
        signals["robotic_repetition"] = True
        risk_score += 35
        reasons.append(
            "Robotic repetition of words or excessive superlatives — non-human writing pattern"
        )
        if not fake_type:
            fake_type = "Robotic Repetition / Bot Review"

    # ── Genuine Signal Deductions ─────────────────────────────────────────────
    # Only deduct when the genuine signal is strong enough to matter.
    deduction = 0.0
    if genuine:
        deduction += 15
    if contrast:
        deduction += 8
    if specific_nums:
        deduction += 8
    if feature_vocab and genuine:      # feature vocab only counts alongside real experience
        deduction += 6
    if real_pronoun and wc > 10:
        deduction += 5
    if real_pronoun and contrast and genuine:
        deduction += 5                 # compound bonus

    risk_score = max(0.0, min(risk_score - deduction, 100.0))

    # ── Final Decision ────────────────────────────────────────────────────────
    FAKE_THRESHOLD = 40.0
    is_fake = risk_score >= FAKE_THRESHOLD

    if is_fake:
        confidence = min(risk_score, 95.0)
        label = "Fake"
    else:
        confidence = max(5.0, 95.0 - risk_score)
        label = "Genuine"
        fake_type = None
        if not reasons:
            reasons.append("No fake signals detected — review appears genuine")

    return {
        "is_fake":    is_fake,
        "confidence": round(confidence, 1),
        "label":      label,
        "fake_type":  fake_type,
        "reasons":    reasons,
        "risk_score": round(risk_score, 1),
        "signals":    signals,
    }


def _empty_result() -> dict:
    return {
        "is_fake": False, "confidence": 0.0, "label": "Genuine",
        "fake_type": None, "reasons": ["Empty review text"], "risk_score": 0.0,
        "signals": {k: False for k in [
            "promotional","spam_content","gift_incentive","rating_mismatch",
            "hollow_generic","imperative_push","platform_address",
            "competitor_attack","robotic_repetition","genuine_signals"
        ]},
    }


# ══════════════════════════════════════════════════════════════════════════════
# TEST SUITE
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    test_cases = [
        # FAKE — hollow positive
        ("Must buy this phone, best product ever!",                          5, True),
        ("Amazing phone, unbelievable performance!",                         5, True),
        ("The most fantastic smartphone I've ever used!",                    5, True),
        ("Totally worth it, just go for it without thinking!",               5, True),
        ("Superb quality, everything is perfect!",                           5, True),
        ("Best phone in the market right now!",                              5, True),
        ("Loved it so much, highly recommend to everyone!",                  5, True),
        ("Mind-blowing camera and performance!",                             5, True),
        ("Excellent product, no complaints at all!",                         5, True),
        ("Don't miss this, it's the best deal ever!",                        5, True),
        # FAKE — hollow negative / troll attack
        ("Worst phone ever, don't buy this!",                                1, True),
        ("Totally useless product, waste of money!",                         1, True),
        ("Very bad experience, not worth anything!",                         1, True),
        ("Horrible phone, I regret buying it!",                              1, True),
        ("Cheap quality, very disappointing!",                               1, True),
        ("Zero performance, totally fake specs!",                            1, True),
        ("Completely useless, avoid at all costs!",                          1, True),
        ("Not good at all, very poor phone!",                                1, True),
        ("This phone is trash, don't even consider it!",                     1, True),
        # FAKE — platform-addressed
        ("Thank you Amazon for this amazing product!",                       5, True),
        # GENUINE — balanced, experience-based
        ("Bought this phone mainly for the camera, and daylight photos are really sharp, but low-light needs improvement.", 4, False),
        ("Battery lasts around a full day with moderate use, but heavy gaming drains it faster.", 4, False),
        ("Performance is smooth for daily apps, but I noticed slight lag while multitasking.", 3, False),
        ("Display is bright and colors look good, especially while watching videos.", 4, False),
        ("The phone feels premium in hand, but the back panel attracts fingerprints easily.", 4, False),
        ("Camera quality is decent for the price, not flagship level but acceptable.", 3, False),
        ("Charging is quite fast, goes from 20% to 80% in about 40 minutes.", 4, False),
        ("Speakers are loud but lack bass compared to other phones in this range.", 3, False),
        ("I've been using it for 2 weeks, no major issues so far.", 4, False),
        ("Gaming performance is okay for casual games, but heats up during long sessions.", 3, False),
        ("Fingerprint sensor works fast most of the time, but fails occasionally with wet hands.", 4, False),
        ("Overall satisfied, but could have been better with stereo speakers.", 4, False),
    ]

    print(f"\n{'='*84}")
    print(f"{'REVIEW':<54} {'R':<3} {'EXPECTED':<10} {'RESULT':<10} {'SCORE':<7} STATUS")
    print(f"{'='*84}")

    passed = 0
    for review, rating, expected_fake in test_cases:
        r = detect_fake_review(review, rating)
        ok = r["is_fake"] == expected_fake
        if ok:
            passed += 1
        short = (review[:51] + "...") if len(review) > 51 else review
        print(
            f"{short:<54} {rating}★  "
            f"{'Fake' if expected_fake else 'Genuine':<10} "
            f"{r['label']:<10} "
            f"{r['risk_score']:<7} "
            f"{'✓' if ok else '✗ FAIL'}"
        )

    total = len(test_cases)
    print(f"\n{'='*84}")
    print(f"  Result: {passed}/{total} passed  ({passed/total*100:.1f}% accuracy)")
    print(f"{'='*84}\n")