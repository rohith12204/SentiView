export interface SentimentScores {
  negative: number;
  neutral: number;
  positive: number;
}

export interface SentimentResult {
  sentiment: "positive" | "negative" | "uncertain";
  confidence: number;
  scores: SentimentScores;
  reason?: string;          // ✅ optional backend reason
  raw_prediction?: string;  // ✅ optional (neutral/positive/negative)
}
