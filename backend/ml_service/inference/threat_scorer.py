"""Threat score and scam-category inference (step 18).

The classical TF-IDF models output a single scalar: P(scam). They do not
natively output a scam *category* (OTP scam, banking, lottery, ...) or a
discrete risk level. This module derives both from the raw probability
plus a small, explicit, versioned keyword-signal taxonomy -- the same
"urgency indicators, fake rewards, malicious links" signal groups named
in the report's Proposed System section. This keeps category inference
transparent and auditable, rather than another opaque model.
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class ThreatScoreConfig:
    low_risk_ceiling: float = 0.4
    medium_risk_ceiling: float = 0.7


# Each category maps to a set of *stemmed* signal tokens (matching the
# same stemming rules ml_common.preprocessing.tokenizer applies), so
# category inference runs on the identically-preprocessed token list the
# model itself scored.
_CATEGORY_SIGNALS: dict[str, frozenset[str]] = {
    "phishing": frozenset({"__url__", "click", "login", "secure", "link", "verify", "password", "credential"}),
    "investment_scam": frozenset({"invest", "profit", "return", "stock", "trading", "forex", "double", "guaranteed"}),
    "job_scam": frozenset({"job", "hiring", "salary", "work", "earn", "income", "vacancy", "recruitment"}),
    "lottery_scam": frozenset({"win", "won", "prize", "lottery", "gift", "reward", "claim", "congratulations"}),
    "upi_scam": frozenset({"upi", "gpay", "phonepe", "paytm", "scan", "qr", "collect", "request"}),
    "banking_fraud": frozenset({"bank", "account", "payment", "transaction", "fund", "loan", "credit", "debit"}),
    "identity_theft": frozenset({"aadhaar", "pan", "kyc", "identity", "verification", "document", "ssn", "passport"}),
    "romance_scam": frozenset({"love", "dear", "darling", "heart", "relationship", "lonely", "marry", "beautiful"}),
    "crypto_scam": frozenset({"crypto", "bitcoin", "ethereum", "wallet", "blockchain", "token", "nft", "mining"}),
    "fake_delivery": frozenset({"delivery", "package", "shipment", "tracking", "parcel", "courier", "order", "dispatch"}),
    "subscription_scam": frozenset({"subscription", "renew", "expire", "membership", "cancel", "auto", "charge", "billing"}),
    "government_scam": frozenset({"government", "tax", "refund", "irs", "customs", "penalty", "compliance", "notice"}),
    "loan_scam": frozenset({"loan", "emi", "interest", "approved", "disburse", "repay", "borrow", "mortgage"}),
}

_URGENCY_SIGNALS: frozenset[str] = frozenset(
    {"urgent", "immediate", "immediately", "now", "today", "final", "expire", "suspend", "block"}
)


@dataclass(frozen=True)
class ThreatAssessment:
    threat_score: float
    risk_level: str
    scam_category: str | None
    matched_signal_count: int
    calibrated_probability: float = 0.0


class ThreatScorer:
    """Derives risk level and category from the model's probability plus
    a transparent, rule-based signal count over the preprocessed tokens.
    """

    def __init__(self, config: ThreatScoreConfig | None = None):
        self._config = config or ThreatScoreConfig()

    def assess(self, scam_probability: float, tokens: list[str], raw_text: str = "") -> ThreatAssessment:
        token_set = set(tokens)
        text_lower = raw_text.lower() if raw_text else " ".join(tokens).lower()

        urgency_hits = len(token_set & _URGENCY_SIGNALS)
        category_scores: dict[str, int] = {}
        for category, signals in _CATEGORY_SIGNALS.items():
            hits = len(token_set & signals)
            for sig in signals:
                if sig in text_lower:
                    hits += 1
            category_scores[category] = hits

        total_category_hits = sum(category_scores.values())
        best_category, best_count = max(category_scores.items(), key=lambda item: item[1])

        has_url = "http://" in text_lower or "https://" in text_lower or "__url__" in token_set or "bit.ly" in text_lower or "t.co" in text_lower or "tinyurl.com" in text_lower
        has_crypto = "0x" in raw_text or "wallet" in text_lower or "usdt" in text_lower or "bitcoin" in text_lower or "btc" in text_lower
        has_phone = any(c.isdigit() for c in raw_text) and ("whatsapp" in text_lower or "call" in text_lower or "+91" in raw_text or "contact" in text_lower)
        has_urgent_action = urgency_hits > 0 and any(kw in text_lower for kw in ["account", "bank", "card", "login", "verify", "suspend", "block"])

        is_definite_scam = (
            (best_count >= 2)
            or (best_count >= 1 and (urgency_hits > 0 or has_url or has_crypto or has_phone or has_urgent_action))
            or (scam_probability >= 0.55)
        )

        is_clean_innocent = (
            total_category_hits == 0
            and urgency_hits == 0
            and not has_url
            and not has_crypto
            and not has_phone
            and not has_urgent_action
            and scam_probability < 0.55
        )

        if is_definite_scam:
            # Boost confirmed scam patterns
            calibrated_prob = min(max(scam_probability + 0.35 + min(best_count * 0.05, 0.20), 0.72), 0.98)
            chosen_category = best_category if best_count > 0 else ("phishing" if has_url else "banking_fraud")
            threat_score = min(calibrated_prob + (0.05 if urgency_hits > 0 else 0.0), 1.0)
            risk_level = "high" if threat_score >= 0.70 else "medium"
        elif is_clean_innocent:
            # Normalize innocent messages from Naive Bayes prior down to real baseline (<10%)
            calibrated_prob = round(scam_probability * 0.18, 4)
            chosen_category = None
            threat_score = calibrated_prob
            risk_level = "low"
        else:
            # Borderline single-keyword message
            calibrated_prob = round(scam_probability * 0.70, 4)
            chosen_category = best_category if best_count > 0 else None
            threat_score = calibrated_prob
            risk_level = "low" if threat_score < 0.40 else "medium"

        return ThreatAssessment(
            threat_score=round(threat_score, 4),
            risk_level=risk_level,
            scam_category=chosen_category,
            matched_signal_count=urgency_hits + total_category_hits,
            calibrated_probability=round(calibrated_prob, 4),
        )

    def _risk_level_for(self, threat_score: float) -> str:
        if threat_score < self._config.low_risk_ceiling:
            return "low"
        if threat_score < self._config.medium_risk_ceiling:
            return "medium"
        return "high"

    @staticmethod
    def _best_category(category_scores: dict[str, int]) -> str | None:
        best_category, best_count = max(category_scores.items(), key=lambda item: item[1])
        return best_category if best_count > 0 else None
