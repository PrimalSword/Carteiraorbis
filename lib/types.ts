export type AssetClass =
  | "acao"
  | "fii"
  | "etf"
  | "bdr"
  | "renda-fixa"
  | "cripto"
  | "outro";

export type TransactionKind = "buy" | "sell" | "income";
export type AiProvider = "openai" | "gemini";

export interface PortfolioTransaction {
  id: string;
  ticker: string;
  name?: string;
  assetClass: AssetClass;
  kind: TransactionKind;
  quantity: number;
  unitPrice: number;
  fees: number;
  date: string;
  notes?: string;
}

export interface Quote {
  ticker: string;
  name?: string;
  price: number;
  previousClose?: number;
  changePercent?: number;
  currency: string;
  updatedAt?: string;
  logoUrl?: string;
  source: string;
}

export interface PricePoint {
  date: string;
  close: number;
}

export interface Holding {
  ticker: string;
  name?: string;
  assetClass: AssetClass;
  quantity: number;
  averagePrice: number;
  costBasis: number;
  income: number;
  currentPrice: number;
  currentValue: number;
  profit: number;
  profitPercent: number;
  changePercent?: number;
  source: string;
}

export interface WatchItem {
  id: string;
  ticker: string;
  assetClass: AssetClass;
  notes?: string;
  createdAt: string;
  lastReportAt?: string;
}

export interface AlertRule {
  id: string;
  ticker: string;
  kind: "above" | "below" | "daily-change";
  threshold: number;
  enabled: boolean;
}

export interface AccountSettings {
  provider: AiProvider;
  openaiModel: string;
  geminiModel: string;
  geminiWebSearch: boolean;
  geminiSearchVersion: number;
  rememberKeys: boolean;
  displayName: string;
}

export interface ApiSecrets {
  openaiKey: string;
  geminiKey: string;
  brapiToken: string;
}

export interface AiSource {
  title: string;
  url: string;
}

export interface AiReport {
  text: string;
  sources: AiSource[];
  provider: AiProvider;
  model: string;
  generatedAt: string;
  webSearchUsed?: boolean;
  notice?: string;
}

export interface PortfolioSnapshot {
  date: string;
  value: number;
  invested: number;
}
