// ==========================================
// MODELOS DEL BACKEND (FASTAPI)
// ==========================================

export interface APIStrategy {
  id: number;
  name: string;
  description: string | null;
  risk_profile: string;
}

export interface APIInvestment {
  id: number;
  ticker: string;
  shares_quantity: number;
  entry_price: number;
  strategy_id: number;
  status: string;
}

export interface APIAnalysisRecord {
  id: number;
  ticker: string;
  execution_date: string;
  pred_base_lstm: number;
  last_real_close: number;
  recomendacion: 'INVERTIR' | 'ESPERAR' | 'NO INVERTIR' | string;
  confianza_analisis: number;
  justificacion_llm: string;
  target_price?: number;
}

export interface APIStockInfo {
  shortName?: string;
  longName?: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
  trailingPE?: number;
  trailingEps?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  currentPrice?: number;
  [key: string]: any; // Comodín por si se mandan campos extr ao diferentes
}

export interface APIStockHistoryPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  sma_20?: number | null;
  sma_50?: number | null;
  rsi?: number | null;
  macd?: number | null;
  macd_signal?: number | null;
}

export interface InvestmentPayload {
  ticker: string;
  shares_quantity: number;
  entry_price: number;
  strategy_id?: number;
}

// ==========================================
// MODELOS DEL FRONTEND (COMPONENTES)
// ==========================================

export interface DashboardStockCard {
  ticker: string;
  name: string;
  price: string;
  change: string;
  isUp: boolean;
  data: number[];
}

export interface DashboardPipelineFeed {
  id: number;
  ticker: string;
  lstm_base: string;
  sentiment: string;
  verdict: string;
  confidence: number;
  time: string;
}

export interface RecentMovement {
  date: string;
  asset: string;
  type: string;
  amount: string;
  shares: string;
  totalValue: number;
}

export interface DistributionItem {
  name: string;
  value: number;
  color: string;
}

export interface PortfolioInvestment {
  id: number;
  ticker: string;
  name: string;
  date: string;
  shares: number;
  entryPrice: number;
  currentPrice: number;
  strategy: string;
  strategyId: number;
}