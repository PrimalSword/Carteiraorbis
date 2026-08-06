"use client";

import { useEffect, useMemo, useState } from "react";
import { ReportView } from "@/components/report-view";
import { usePortfolio } from "@/components/portfolio-provider";
import { currency, formatPercent } from "@/lib/format";
import type { AiReport } from "@/lib/types";

export function IntelligenceTab({ onNavigate, requestedTicker }: { onNavigate: (tab: string) => void; requestedTicker?: string }) {
  const { reports, setReport, runAnalysis, quotes, history, secrets, refreshMarket } = usePortfolio();
  const [ticker, setTicker] = useState(requestedTicker ?? "");
  useEffect(() => { if (requestedTicker) setTicker(requestedTicker); }, [requestedTicker]);
  const [years, setYears] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const normalized = ticker.trim().toUpperCase();
  const report = normalized ? reports[`asset:${normalized}`] ?? null : null;
  const quote = quotes[normalized];
  const points = history[normalized] ?? [];

  const yearly = useMemo(() => {
    const grouped = new Map<string, { first: number; last: number }>();
    for (const point of points) {
      const year = point.date.slice(0, 4);
      const current = grouped.get(year);
      if (!current) grouped.set(year, { first: point.close, last: point.close });
      else current.last = point.close;
    }
    return [...grouped.entries()].map(([year, values]) => ({
      year,
      returnPercent: values.first ? ((values.last - values.first) / values.first) * 100 : 0,
    })).slice(-years);
  }, [points, years]);

  async function generate() {
    if (!normalized) return setError("Informe um ticker.");
    setLoading(true);
    setError("");
    try {
      if (secrets.brapiToken) await refreshMarket("5y");
      const result = await runAnalysis({ mode: "asset", ticker: normalized, compareYears: years });
      setReport(`asset:${normalized}`, result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao gerar o relatório.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="tab-stack">
      <div className="page-heading">
        <div><span className="eyebrow">Dossiê vivo</span><h1>Inteligência de ativos</h1><p>Pesquise qualquer ativo, mesmo que ele não esteja na sua carteira.</p></div>
      </div>

      <div className="search-panel panel">
        <div className="search-row">
          <label className="grow"><span>Ticker do ativo</span><input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="Ex.: HGLG11" autoCapitalize="characters" onKeyDown={(e) => { if (e.key === "Enter") void generate(); }} /></label>
          <label><span>Comparar</span><select value={years} onChange={(e) => setYears(Number(e.target.value))}><option value={1}>1 ano</option><option value={3}>3 anos</option><option value={5}>5 anos</option><option value={10}>10 anos</option></select></label>
          <button className="button primary search-button" onClick={() => void generate()} disabled={loading}>{loading ? "Pesquisando…" : "Gerar relatório completo"}</button>
        </div>
        {error && <div className="field-error">{error}</div>}
        <p className="helper">A IA pesquisa fontes atuais, compara períodos e separa fatos de interpretações. O relatório não é recomendação de investimento.</p>
      </div>

      {normalized && (
        <div className="asset-summary-grid">
          <div className="metric-card"><span>Ativo consultado</span><strong>{normalized}</strong><small>{quote?.name || "Aguardando dados de mercado"}</small></div>
          <div className="metric-card"><span>Cotação</span><strong>{quote ? currency.format(quote.price) : "—"}</strong><small>{quote ? `${formatPercent(quote.changePercent ?? 0)} no dia` : "Token brapi opcional"}</small></div>
          <div className="metric-card"><span>Histórico recebido</span><strong>{points.length}</strong><small>pregões disponíveis</small></div>
        </div>
      )}

      {!!yearly.length && (
        <div className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Comparação objetiva</span><h2>Variação por ano</h2></div></div>
          <div className="year-grid">{yearly.map((item) => <div key={item.year} className={item.returnPercent >= 0 ? "positive" : "negative"}><span>{item.year}</span><strong>{formatPercent(item.returnPercent)}</strong></div>)}</div>
        </div>
      )}

      {!((secrets.openaiKey || secrets.geminiKey)) && (
        <div className="notice info">Configure uma chave GPT ou Gemini na aba Conta para gerar o dossiê. <button onClick={() => onNavigate("conta")}>Abrir Conta</button></div>
      )}

      <ReportView report={report as AiReport | null} />
    </section>
  );
}
