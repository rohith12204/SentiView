export interface Product {
  id: string;
  name: string;
  image: string;
  brand: string;
  model: string;
  rating: number;
  sentimentScore: number;
  price: string;
  specs: {
    ram?: string;
    battery?: string;
    display?: string;
    processor?: string;
  };
  aspects: AspectSentiment[];
  pros: string[];
  cons: string[];
  summary: string;
  trendData?: TrendPoint[];
}

export interface AspectSentiment {
  aspect: string;
  score: number;
  positiveCount: number;
  negativeCount: number;
}

export interface TrendPoint {
  month: string;
  positive: number;
  negative: number;
  neutral: number;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

export type Theme = 'light' | 'dark';
