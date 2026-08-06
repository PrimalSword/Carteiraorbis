"use client";

import { LineChart } from "@/components/line-chart";
import { usePortfolio } from "@/components/portfolio-provider";
import { currency, formatPercent } from "@/lib/format";

export function DashboardTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { holdings, snapshots, summary, marketLoading, marketError, refreshMarket, setTransactions } = usePortfolio();

  return (
    <section className="tab-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Visão geral</span>
          <h1>Evolução da sua carteira</h1>
          <p>Patrimônio, aportes e resultado em uma leitura limpa.</p>
        </div>
        <button className="button secondary" onClick={() => void refreshMarket("1y")} disabled={marketLoading}>
          {marketLoading ? "Atualizando…" : "Atualizar mercado"}
        </button>
      </div>

      {marketError && <div className="notice warning">{marketError}</div>}

      <div className="metric-grid">
        <div className="metric-card featured">
          <span>Patrimônio atual</span>
          <strong>{currency.format(summary.value)}</strong>
          <small>{holdings.length} ativo{holdings.length === 1 ? "" : "s"} em carteira</small>
        </div>
        <div className="metric-card">
          <span>Aportes líquidos</span>
          <strong>{currency.format(summary.invested)}</strong>
          <small>Base de custo remanescente</small>
        </div>
        <div className={`metric-card ${summary.profit >= 0 ? "positive" : "negative"}`}>
          <span>Resultado não realizado</span>
          <strong>{currency.format(summary.profit)}</strong>
          <small>{formatPercent(summary.profitPercent)}</small>
        </div>
        <div className="metric-card">
          <span>Proventos lançados</span>
          <strong>{currency.format(summary.income)}</strong>
          <small>Informados manualmente</small>
        </div>
      </div>

      <div className="panel chart-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Linha patrimonial</span>
            <h2>Valor de mercado x aportes</h2>
          </div>
          <span className="status-pill">Dados locais + mercado</span>
        </div>
        <LineChart points={snapshots} />
      </div>

      {!holdings.length && (
        <div className="empty-state action-state">
          <div>
            <strong>Sua carteira ainda está vazia.</strong>
            <span>O cadastro é manual: você controla exatamente o que entra no aplicativo.</span>
          </div>
          <div className="row-actions"><button className="button secondary" onClick={() => setTransactions([
            { id: crypto.randomUUID(), ticker: "PETR4", name: "Petrobras PN", assetClass: "acao", kind: "buy", quantity: 20, unitPrice: 34.5, fees: 0, date: "2026-01-15", notes: "Demonstração" },
            { id: crypto.randomUUID(), ticker: "VALE3", name: "Vale ON", assetClass: "acao", kind: "buy", quantity: 10, unitPrice: 58.2, fees: 0, date: "2026-03-12", notes: "Demonstração" },
          ])}>Carregar demonstração</button><button className="button primary" onClick={() => onNavigate("lancamentos")}>Adicionar primeiro ativo</button></div>
        </div>
      )}
    </section>
  );
}
