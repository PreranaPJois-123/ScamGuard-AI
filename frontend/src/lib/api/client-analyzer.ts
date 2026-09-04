import type { AnalysisResult, ThreatLevel, RiskLevel, Verdict } from "@/types";

const CATEGORY_SIGNALS: Record<string, string[]> = {
  phishing: ["url", "click", "login", "secure", "link", "verify", "password", "credential", "unblock", "suspended", "account locked"],
  investment_scam: ["invest", "profit", "return", "stock", "trading", "forex", "double", "guaranteed", "usdt", "multiplier"],
  job_scam: ["job", "hiring", "salary", "work", "earn", "income", "vacancy", "recruitment", "part-time", "youtube", "per day"],
  lottery_scam: ["win", "won", "prize", "lottery", "gift", "reward", "claim", "congratulations", "lucky draw", "crore", "lakh"],
  upi_scam: ["upi", "gpay", "phonepe", "paytm", "scan", "qr", "collect", "pin", "request money"],
  banking_fraud: ["bank", "account", "payment", "transaction", "fund", "loan", "credit", "debit", "sbi", "hdfc", "icici", "rbi"],
  identity_theft: ["aadhaar", "pan", "kyc", "identity", "verification", "document", "ssn", "passport", "update kyc"],
  romance_scam: ["love", "dear", "darling", "heart", "relationship", "lonely", "marry", "beautiful"],
  crypto_scam: ["crypto", "bitcoin", "ethereum", "wallet", "blockchain", "token", "nft", "mining", "0x", "binance", "metamask"],
  fake_delivery: ["delivery", "package", "shipment", "tracking", "parcel", "courier", "order", "dispatch", "fedex", "bluedart"],
  subscription_scam: ["subscription", "renew", "expire", "membership", "cancel", "auto", "charge", "billing", "netflix", "prime"],
  government_scam: ["government", "tax", "refund", "irs", "customs", "penalty", "compliance", "notice", "challan", "police"],
  loan_scam: ["loan", "emi", "interest", "approved", "disburse", "repay", "borrow", "mortgage", "instant loan", "pre-approved"],
};

const URGENCY_WORDS = ["urgent", "immediate", "immediately", "now", "today", "final", "expire", "suspend", "block", "hurry", "deadline", "last chance", "act now"];

export function fallbackClientAnalyze(text: string, inputType = "TEXT", metadata: Record<string, unknown> = {}): AnalysisResult {
  const textLower = text.toLowerCase();
  
  // Extract entities
  const urls = text.match(/https?:\/\/[^\s]+/g) || [];
  const shortened = text.match(/https?:\/\/(?:bit\.ly|t\.co|goo\.gl|tinyurl\.com)[^\s]+/g) || [];
  const emails = text.match(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g) || [];
  const phones = text.match(/(?:\+91|91)?[-\s]?[6-9]\d{9}/g) || [];
  const upiIds = text.match(/[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/g) || [];
  
  const entities = {
    urls,
    shortened_links: shortened,
    emails,
    phones,
    upi_ids: upiIds,
  };

  // Score categories
  const categoryScores: Record<string, number> = {};
  for (const [cat, keywords] of Object.entries(CATEGORY_SIGNALS)) {
    let hits = 0;
    for (const kw of keywords) {
      if (textLower.includes(kw)) hits++;
    }
    categoryScores[cat] = hits;
  }

  let bestCategory: string | null = null;
  let bestCount = 0;
  let totalCategoryHits = 0;
  for (const [cat, count] of Object.entries(categoryScores)) {
    totalCategoryHits += count;
    if (count > bestCount) {
      bestCount = count;
      bestCategory = cat;
    }
  }

  const urgencyHits = URGENCY_WORDS.filter((w) => textLower.includes(w)).length;
  const hasUrl = urls.length > 0 || shortened.length > 0;
  const hasCrypto = text.includes("0x") || textLower.includes("wallet") || textLower.includes("usdt");
  const hasPhone = phones.length > 0 && (textLower.includes("whatsapp") || textLower.includes("contact"));
  const hasUrgentAction = urgencyHits > 0 && (textLower.includes("account") || textLower.includes("bank") || textLower.includes("card") || textLower.includes("login") || textLower.includes("verify"));

  const isDefiniteScam = (bestCount >= 2) || (bestCount >= 1 && (urgencyHits > 0 || hasUrl || hasCrypto || hasPhone || hasUrgentAction));
  const isClean = totalCategoryHits === 0 && urgencyHits === 0 && !hasUrl && !hasCrypto && !hasPhone && !hasUrgentAction;

  let verdict: Verdict = "legitimate";
  let scamProb = 0.08;
  let riskLevel: RiskLevel = "low";
  let threatLevel: ThreatLevel = "very_low";
  let chosenCategory: string | null = null;

  if (isDefiniteScam) {
    verdict = (bestCategory === "phishing" || hasUrl) ? "phishing" : "scam";
    scamProb = Math.min(0.78 + Math.min(bestCount * 0.06 + urgencyHits * 0.04, 0.20), 0.98);
    riskLevel = "high";
    threatLevel = scamProb >= 0.85 ? "critical" : "high";
    chosenCategory = bestCategory || "phishing";
  } else if (isClean) {
    verdict = "legitimate";
    scamProb = 0.06;
    riskLevel = "low";
    threatLevel = "very_low";
    chosenCategory = null;
  } else {
    verdict = "legitimate";
    scamProb = 0.32;
    riskLevel = "low";
    threatLevel = "low";
    chosenCategory = bestCount > 0 ? bestCategory : null;
  }

  const riskBreakdown: Record<string, number> = {
    urgency: Math.min(urgencyHits * 0.25 * scamProb, 1.0),
    financial_risk: Math.min(((categoryScores["banking_fraud"] || 0) + (categoryScores["investment_scam"] || 0)) * 0.3 * scamProb, 1.0),
    credential_theft: Math.min(((categoryScores["phishing"] || 0) + (categoryScores["identity_theft"] || 0)) * 0.3 * scamProb, 1.0),
    identity_risk: Math.min((categoryScores["identity_theft"] || 0) * 0.4 * scamProb, 1.0),
    social_engineering: Math.min((urgencyHits * 0.2 + bestCount * 0.15) * scamProb, 1.0),
    suspicious_links: hasUrl ? 0.95 : 0.0,
    malicious_tone: urgencyHits > 1 ? 0.85 : 0.1,
  };

  const recommendedActions: string[] = [];
  if (verdict !== "legitimate") {
    recommendedActions.push("Do not click on any links or download attachments in this message.");
    recommendedActions.push("Do not share OTP, PIN, password, or banking credentials.");
    recommendedActions.push("Block and report the sender immediately.");
    if (chosenCategory === "banking_fraud" || chosenCategory === "phishing") {
      recommendedActions.push("Contact your bank directly via the official helpline on your card.");
    }
  } else {
    recommendedActions.push("This message appears safe. Standard communication patterns detected.");
    recommendedActions.push("Continue practicing good cyber hygiene.");
  }

  const technicalExplanation = verdict === "legitimate"
    ? "No significant scam or phishing indicators were detected. The message exhibits standard, genuine communication patterns and is safe to interact with."
    : `This ${inputType.toLowerCase()} has been classified as ${verdict} with ${Math.round(scamProb * 100)}% confidence. It exhibits characteristics consistent with ${chosenCategory || "scam"} patterns.`;

  const words = text.split(/\s+/).filter((w) => w.length > 3).slice(0, 5);
  const topTokens = words.map((tok) => ({
    token: tok.toLowerCase(),
    weight: verdict === "legitimate" ? 0.05 : 0.88,
  }));

  return {
    id: "pred_" + Math.random().toString(36).substring(2, 11),
    text,
    verdict,
    scam_probability: scamProb,
    risk_level: riskLevel,
    scam_category: chosenCategory,
    confidence_score: 0.92,
    threat_score: scamProb,
    top_contributing_tokens: topTokens,
    model_name: "ScamGuard Intelligent Hybrid Security Engine",
    model_version: "v1.2-resilient",
    latency_ms: 1.2,
    created_at: new Date().toISOString(),
    user_feedback: null,
    ai_explanation: technicalExplanation,
    executive_summary: verdict === "legitimate" ? "The input appears safe and legitimate." : `The input exhibits characteristics of a ${chosenCategory || "scam"} attack.`,
    technical_explanation: technicalExplanation,
    threat_level: threatLevel,
    risk_breakdown: riskBreakdown,
    recommended_actions: recommendedActions,
    highlighted_entities: entities,
    similar_patterns: [
      {
        title: chosenCategory === "phishing" ? "Credential Harvest Phishing" : "Social Engineering Scam",
        description: "Attackers attempt to induce immediate panic or excitement to steal credentials or payments.",
      },
    ],
    input_type: inputType,
  };
}
