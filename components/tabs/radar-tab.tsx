"use client";

import { useMemo, useState } from "react";
import { usePortfolio } from "@/components/portfolio-provider";
import { currency, formatPercent } from "@/lib/format";
import type { AlertRule, AssetClass, WatchItem } from "@/lib/types";

export function RadarTab({ onOpenAsset }: { onOpenAsset: (ticker: string) => void }) {
  const { watchlist, setWatchlist, alerts, setAlerts, quotes, refreshMarket, marketLoading } = usePortfolio();
  const [ticker, setTicker] = useState("");
  const [assetClass, setAssetClass] = useState<AssetClass>("fii");
  const [notes, setNotes] = useState("");
  const [alertTicker, setAlertTicker] = useState("");
  const [alertKind, setAlertKind] = useState<AlertRule["kind"]>("below");
  const [threshold, setThreshold] = useState("");

  const triggered = useMemo(() => alerts.filter((alert) => {
    if (!alert.enabled) return false;
    const quote = quotes[alert.ticker];
    if (!quote) return false;
    if (alert.kind === "above") return quote.price >= alert.threshold;
    if (alert.kind === "below") return quote.price <= alert.threshold;
    return Math.abs(quote.changePercent ?? 0) >= alert.threshold;
  }), [alerts, quotes]);

  function addWatch(event: React.FormEvent) {
    event.preventDefault();
    const normalized = ticker.trim().toUpperCase();
    if (!normalized || watchlist.some((item) => item.ticker === normalized)) return;
    const item: WatchItem = {
      id: crypto.randomUUID(),
      ticker: normalized,
      assetClass,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    setWatchlist((current) => [...current, item]);
    setTicker("");
    setNotes("");
    setTimeout(() => void refreshMarket("1y"), 0);
  }

  function addAlert(event: React.FormEvent) {
    event.preventDefault();
    const normalized = alertTicker.trim().toUpperCase();
    const parsed = Number(threshold.replace(",", "."));
    if (!normalized || !Number.isFinite(parsed) || parsed <= 0) return;
    setAlerts((current) => [...current, {
      id: crypto.randomUUID(),
      ticker: normalized,
      kind: alertKind,
      threshold: parsed,
      enabled: true,
    }]);
    setAlertTicker("");
    setThreshold("");
  }

  return (
    <section className="tab-stack">
      <div className="page-heading">
        <div><span className="eyebrow">Lista de observação</span><h1>Radar de mercado</h1><p>Acompanhe ativos fora da carteira e critérios objetivos definidos por você.</p></div>
        <button className="button secondary" onClick={() => void refreshMarket("1y")} disabled={marketLoading}>{marketLoading ? "Atualizando…" : "Verificar agora"}</button>
      </div>

      {!!triggered.length && (
        <div className="notice warning"><strong>{triggered.length} alerta{triggered.length === 1 ? "" : "s"} atingido{triggered.length === 1 ? "" : "s"}.</strong> A conferência ocorre quando o aplicativo atualiza os dados.</div>
      )}

      <div className="split-layout">
        <form className="panel form-panel" onSubmit={addWatch}>
          <div className="panel-heading"><div><span className="eyebrow">Watchlist</span><h2>Adicionar ao radar</h2></div></div>
          <div className="form-grid">
            <label><span>Ticker</span><input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="XPLG11" /></label>
            <label><span>Classe</span><select value={assetClass} onChange={(e) => setAssetClass(e.target.value as AssetClass)}><option value="fii">FII</option><option value="acao">Ação</option><option value="etf">ETF</option><option value="bdr">BDR</option><option value="cripto">Cripto</option><option value="outro">Outro</option></select></label>
            <label className="full"><span>Motivo para acompanhar</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Emissão, vacância, novo galpão, resultado…" /></label>
          </div>
          <button className="button primary" type="submit">Adicionar ao radar</button>
        </form>

        <form className="panel form-panel" onSubmit={addAlert}>
          <div className="panel-heading"><div><span className="eyebrow">Critérios locais</span><h2>Criar alerta</h2></div></div>
          <div className="form-grid">
            <label><span>Ticker</span><input value={alertTicker} onChange={(e) => setAlertTicker(e.target.value)} placeholder="HGLG11" /></label>
            <label><span>Condição</span><select value={alertKind} onChange={(e) => setAlertKind(e.target.value as AlertRule["kind"])}><option value="below">Preço abaixo de</option><option value="above">Preço acima de</option><option value="daily-change">Variação diária absoluta</option></select></label>
            <label className="full"><span>{alertKind === "daily-change" ? "Percentual" : "Valor em reais"}</span><input inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder={alertKind === "daily-change" ? "3" : "100"} /></label>
          </div>
          <button className="button primary" type="submit">Salvar alerta</button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-heading"><div><span className="eyebrow">Ativos observados</span><h2>Seu radar</h2></div></div>
        {!watchlist.length ? <div className="empty-state compact"><strong>Radar vazio.</strong><span>Adicione ativos que você deseja estudar sem incluí-los na carteira.</span></div> : (
          <div className="watch-grid">{watchlist.map((item) => {
            const quote = quotes[item.ticker];
            return <article className="watch-card" key={item.id}>
              <header><div><strong>{item.ticker}</strong><span>{item.assetClass.toUpperCase()}</span></div><button className="icon-button danger" onClick={() => setWatchlist((current) => current.filter((entry) => entry.id !== item.id))}>×</button></header>
              <div className="watch-price"><strong>{quote ? currency.format(quote.price) : "—"}</strong><span className={(quote?.changePercent ?? 0) >= 0 ? "positive-text" : "negative-text"}>{quote ? formatPercent(quote.changePercent ?? 0) : "Sem cotação"}</span></div>
              <p>{item.notes || "Sem observação registrada."}</p>
              <button className="text-button" onClick={() => onOpenAsset(item.ticker)}>Abrir dossiê →</button>
            </article>;
          })}</div>
        )}
      </div>

      <div className="panel">
        <div className="panel-heading"><div><span className="eyebrow">Regras configuradas</span><h2>Alertas</h2></div></div>
        {!alerts.length ? <div className="empty-state compact"><strong>Nenhum alerta.</strong><span>As regras são avaliadas quando os dados de mercado são atualizados.</span></div> : (
          <div className="alert-list">{alerts.map((alert) => {
            const active = triggered.some((item) => item.id === alert.id);
            return <div className={`alert-row ${active ? "triggered" : ""}`} key={alert.id}><div><strong>{alert.ticker}</strong><span>{alert.kind === "above" ? "Acima de" : alert.kind === "below" ? "Abaixo de" : "Variação diária ≥"} {alert.kind === "daily-change" ? `${alert.threshold}%` : currency.format(alert.threshold)}</span></div><div className="row-actions"><button className="toggle-button" onClick={() => setAlerts((current) => current.map((item) => item.id === alert.id ? { ...item, enabled: !item.enabled } : item))}>{alert.enabled ? "Ativo" : "Pausado"}</button><button className="icon-button danger" onClick={() => setAlerts((current) => current.filter((item) => item.id !== alert.id))}>×</button></div></div>;
          })}</div>
        )}
      </div>
    </section>
  );
}
