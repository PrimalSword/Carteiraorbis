"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { buildHoldings, buildPortfolioHistory, summarizePortfolio } from "@/lib/portfolio";
import { readJson, readSecrets, STORAGE_KEYS, writeJson, writeSecrets } from "@/lib/storage";
import type {
  AccountSettings,
  AiReport,
  AlertRule,
  ApiSecrets,
  PortfolioTransaction,
  PricePoint,
  Quote,
  WatchItem,
} from "@/lib/types";

interface PortfolioContextValue {
  hydrated: boolean;
  transactions: PortfolioTransaction[];
  setTransactions: React.Dispatch<React.SetStateAction<PortfolioTransaction[]>>;
  watchlist: WatchItem[];
  setWatchlist: React.Dispatch<React.SetStateAction<WatchItem[]>>;
  alerts: AlertRule[];
  setAlerts: React.Dispatch<React.SetStateAction<AlertRule[]>>;
  settings: AccountSettings;
  setSettings: React.Dispatch<React.SetStateAction<AccountSettings>>;
  secrets: ApiSecrets;
  setSecrets: React.Dispatch<React.SetStateAction<ApiSecrets>>;
  quotes: Record<string, Quote>;
  history: Record<string, PricePoint[]>;
  holdings: ReturnType<typeof buildHoldings>;
  snapshots: ReturnType<typeof buildPortfolioHistory>;
  summary: ReturnType<typeof summarizePortfolio>;
  marketLoading: boolean;
  marketError: string;
  refreshMarket: (range?: "1y" | "5y") => Promise<void>;
  reports: Record<string, AiReport>;
  setReport: (key: string, report: AiReport) => void;
  runAnalysis: (input: {
    mode: "asset" | "portfolio" | "question";
    ticker?: string;
    compareYears?: number;
    question?: string;
  }) => Promise<AiReport>;
  exportData: () => string;
  importData: (raw: string) => void;
  resetAll: () => void;
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

const defaultSettings: AccountSettings = {
  provider: "openai",
  openaiModel: "gpt-5-mini",
  geminiModel: "gemini-3.5-flash",
  rememberKeys: false,
  displayName: "Investidor",
};

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([]);
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [settings, setSettings] = useState<AccountSettings>(defaultSettings);
  const [secrets, setSecrets] = useState<ApiSecrets>({ openaiKey: "", geminiKey: "", brapiToken: "" });
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [history, setHistory] = useState<Record<string, PricePoint[]>>({});
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState("");
  const [reports, setReports] = useState<Record<string, AiReport>>({});

  useEffect(() => {
    setTransactions(readJson(STORAGE_KEYS.transactions, []));
    setWatchlist(readJson(STORAGE_KEYS.watchlist, []));
    setAlerts(readJson(STORAGE_KEYS.alerts, []));
    setSettings({ ...defaultSettings, ...readJson(STORAGE_KEYS.settings, defaultSettings) });
    setSecrets(readSecrets());
    setReports(readJson(STORAGE_KEYS.reports, {}));
    setHydrated(true);
  }, []);

  useEffect(() => { if (hydrated) writeJson(STORAGE_KEYS.transactions, transactions); }, [hydrated, transactions]);
  useEffect(() => { if (hydrated) writeJson(STORAGE_KEYS.watchlist, watchlist); }, [hydrated, watchlist]);
  useEffect(() => { if (hydrated) writeJson(STORAGE_KEYS.alerts, alerts); }, [hydrated, alerts]);
  useEffect(() => { if (hydrated) writeJson(STORAGE_KEYS.settings, settings); }, [hydrated, settings]);
  useEffect(() => { if (hydrated) writeSecrets(secrets, settings.rememberKeys); }, [hydrated, secrets, settings.rememberKeys]);
  useEffect(() => { if (hydrated) writeJson(STORAGE_KEYS.reports, reports); }, [hydrated, reports]);

  const holdings = useMemo(() => buildHoldings(transactions, quotes), [transactions, quotes]);
  const snapshots = useMemo(() => buildPortfolioHistory(transactions, history, quotes), [transactions, history, quotes]);
  const summary = useMemo(() => summarizePortfolio(holdings), [holdings]);

  const refreshMarket = useCallback(async (range: "1y" | "5y" = "1y") => {
    const symbols = [...new Set([
      ...transactions.map((item) => item.ticker.toUpperCase()),
      ...watchlist.map((item) => item.ticker.toUpperCase()),
    ])].filter(Boolean);
    if (!symbols.length) return;
    setMarketLoading(true);
    setMarketError("");
    try {
      const [quoteResponse, historyResponse] = await Promise.all([
        fetch("/api/market/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbols, token: secrets.brapiToken }),
        }),
        fetch("/api/market/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbols, token: secrets.brapiToken, range }),
        }),
      ]);
      const quotePayload = await quoteResponse.json();
      const historyPayload = await historyResponse.json();
      if (quoteResponse.ok) {
        setQuotes(Object.fromEntries((quotePayload.quotes ?? []).map((quote: Quote) => [quote.ticker, quote])));
      }
      if (historyResponse.ok) setHistory(historyPayload.history ?? {});
      if (!quoteResponse.ok && !historyResponse.ok) {
        throw new Error(quotePayload.error || historyPayload.error || "Falha ao consultar o mercado.");
      }
      if (!quoteResponse.ok || !historyResponse.ok) {
        setMarketError(quotePayload.error || historyPayload.error || "Parte dos dados não pôde ser atualizada.");
      }
    } catch (error) {
      setMarketError(error instanceof Error ? error.message : "Falha ao consultar o mercado.");
    } finally {
      setMarketLoading(false);
    }
  }, [secrets.brapiToken, transactions, watchlist]);

  useEffect(() => {
    if (!hydrated || !transactions.length) return;
    void refreshMarket("1y");
  }, [hydrated, refreshMarket, transactions.length]);

  const setReport = useCallback((key: string, report: AiReport) => {
    setReports((current) => ({ ...current, [key]: report }));
  }, []);

  const runAnalysis = useCallback(async (input: {
    mode: "asset" | "portfolio" | "question";
    ticker?: string;
    compareYears?: number;
    question?: string;
  }) => {
    const apiKey = settings.provider === "openai" ? secrets.openaiKey : secrets.geminiKey;
    const model = settings.provider === "openai" ? settings.openaiModel : settings.geminiModel;
    const response = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...input,
        provider: settings.provider,
        apiKey,
        model,
        portfolio: holdings.map((holding) => ({
          ticker: holding.ticker,
          classe: holding.assetClass,
          quantidade: holding.quantity,
          precoMedio: holding.averagePrice,
          precoAtual: holding.currentPrice,
          valorAtual: holding.currentValue,
          participacaoPercentual: summary.value ? (holding.currentValue / summary.value) * 100 : 0,
          resultadoPercentual: holding.profitPercent,
        })),
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Não foi possível concluir a análise.");
    return payload as AiReport;
  }, [holdings, secrets.geminiKey, secrets.openaiKey, settings.geminiModel, settings.openaiModel, settings.provider, summary.value]);

  const exportData = useCallback(() => JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions,
    watchlist,
    alerts,
    settings: { ...settings, rememberKeys: false },
    reports,
  }, null, 2), [alerts, reports, settings, transactions, watchlist]);

  const importData = useCallback((raw: string) => {
    const payload = JSON.parse(raw);
    if (!payload || payload.version !== 1) throw new Error("Arquivo incompatível com a Carteira Orbis.");
    setTransactions(Array.isArray(payload.transactions) ? payload.transactions : []);
    setWatchlist(Array.isArray(payload.watchlist) ? payload.watchlist : []);
    setAlerts(Array.isArray(payload.alerts) ? payload.alerts : []);
    setSettings({ ...defaultSettings, ...(payload.settings ?? {}) });
    setReports(payload.reports && typeof payload.reports === "object" ? payload.reports : {});
  }, []);

  const resetAll = useCallback(() => {
    setTransactions([]);
    setWatchlist([]);
    setAlerts([]);
    setReports({});
    setQuotes({});
    setHistory({});
  }, []);

  const value: PortfolioContextValue = {
    hydrated,
    transactions,
    setTransactions,
    watchlist,
    setWatchlist,
    alerts,
    setAlerts,
    settings,
    setSettings,
    secrets,
    setSecrets,
    quotes,
    history,
    holdings,
    snapshots,
    summary,
    marketLoading,
    marketError,
    refreshMarket,
    reports,
    setReport,
    runAnalysis,
    exportData,
    importData,
    resetAll,
  };

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (!context) throw new Error("usePortfolio deve ser usado dentro de PortfolioProvider.");
  return context;
}
