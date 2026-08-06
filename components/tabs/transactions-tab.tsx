"use client";

import { useMemo, useState } from "react";
import { usePortfolio } from "@/components/portfolio-provider";
import { assetClassLabel, currency, formatDate, number } from "@/lib/format";
import type { AssetClass, PortfolioTransaction, TransactionKind } from "@/lib/types";

const emptyForm = {
  ticker: "",
  name: "",
  assetClass: "fii" as AssetClass,
  kind: "buy" as TransactionKind,
  quantity: "",
  unitPrice: "",
  fees: "0",
  date: new Date().toISOString().slice(0, 10),
  notes: "",
};

export function TransactionsTab() {
  const { transactions, setTransactions, holdings, refreshMarket } = usePortfolio();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  const sorted = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date)),
    [transactions],
  );

  function addTransaction(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const quantity = Number(form.quantity.replace(",", "."));
    const unitPrice = Number(form.unitPrice.replace(",", "."));
    const fees = Number(form.fees.replace(",", ".")) || 0;
    if (!form.ticker.trim()) return setError("Informe o ticker ou nome curto do ativo.");
    if (!Number.isFinite(quantity) || quantity <= 0) return setError("A quantidade deve ser maior que zero.");
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return setError("Informe um valor unitário válido.");

    const transaction: PortfolioTransaction = {
      id: crypto.randomUUID(),
      ticker: form.ticker.trim().toUpperCase(),
      name: form.name.trim() || undefined,
      assetClass: form.assetClass,
      kind: form.kind,
      quantity,
      unitPrice,
      fees,
      date: form.date,
      notes: form.notes.trim() || undefined,
    };
    setTransactions((current) => [...current, transaction]);
    setForm({ ...emptyForm, assetClass: form.assetClass, date: form.date });
    setTimeout(() => void refreshMarket("1y"), 0);
  }

  return (
    <section className="tab-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Dados sob seu controle</span>
          <h1>Lançamentos manuais</h1>
          <p>Compras, vendas e proventos sem conexão com corretora ou Open Finance.</p>
        </div>
      </div>

      <div className="split-layout wide-form">
        <form className="panel form-panel" onSubmit={addTransaction}>
          <div className="panel-heading"><div><span className="eyebrow">Novo registro</span><h2>Adicionar movimentação</h2></div></div>
          <div className="form-grid">
            <label><span>Ticker</span><input value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} placeholder="HGLG11" autoCapitalize="characters" /></label>
            <label><span>Nome opcional</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="CSHG Logística" /></label>
            <label><span>Classe</span><select value={form.assetClass} onChange={(e) => setForm({ ...form, assetClass: e.target.value as AssetClass })}><option value="fii">FII</option><option value="acao">Ação</option><option value="etf">ETF</option><option value="bdr">BDR</option><option value="renda-fixa">Renda fixa</option><option value="cripto">Cripto</option><option value="outro">Outro</option></select></label>
            <label><span>Movimentação</span><select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as TransactionKind })}><option value="buy">Compra</option><option value="sell">Venda</option><option value="income">Provento</option></select></label>
            <label><span>Quantidade</span><input inputMode="decimal" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="10" /></label>
            <label><span>{form.kind === "income" ? "Valor por cota/ação" : "Preço unitário"}</span><input inputMode="decimal" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} placeholder="100,00" /></label>
            <label><span>Taxas</span><input inputMode="decimal" value={form.fees} onChange={(e) => setForm({ ...form, fees: e.target.value })} /></label>
            <label><span>Data</span><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label className="full"><span>Observações</span><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Corretora, tese, lote, vencimento…" /></label>
          </div>
          {error && <div className="field-error">{error}</div>}
          <button className="button primary" type="submit">Salvar movimentação</button>
        </form>

        <div className="panel holdings-panel">
          <div className="panel-heading"><div><span className="eyebrow">Posição consolidada</span><h2>Ativos em carteira</h2></div></div>
          {!holdings.length ? <div className="empty-state compact"><strong>Nenhuma posição aberta.</strong><span>As posições são calculadas a partir dos lançamentos.</span></div> : (
            <div className="holding-list">
              {holdings.map((holding) => (
                <div className="holding-row" key={holding.ticker}>
                  <div><strong>{holding.ticker}</strong><span>{assetClassLabel(holding.assetClass)} · {number.format(holding.quantity)} unidades</span></div>
                  <div className="align-right"><strong>{currency.format(holding.currentValue)}</strong><span>PM {currency.format(holding.averagePrice)}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel table-panel">
        <div className="panel-heading"><div><span className="eyebrow">Histórico</span><h2>Movimentações registradas</h2></div></div>
        {!sorted.length ? <div className="empty-state compact"><strong>Sem lançamentos.</strong><span>Os dados permanecerão apenas neste navegador.</span></div> : (
          <div className="responsive-table"><table><thead><tr><th>Data</th><th>Ativo</th><th>Tipo</th><th>Quantidade</th><th>Valor unitário</th><th>Total</th><th /></tr></thead><tbody>{sorted.map((item) => (
            <tr key={item.id}><td>{formatDate(item.date)}</td><td><strong>{item.ticker}</strong><small>{assetClassLabel(item.assetClass)}</small></td><td>{item.kind === "buy" ? "Compra" : item.kind === "sell" ? "Venda" : "Provento"}</td><td>{number.format(item.quantity)}</td><td>{currency.format(item.unitPrice)}</td><td>{currency.format(item.quantity * item.unitPrice + item.fees)}</td><td><button className="icon-button danger" aria-label={`Excluir ${item.ticker}`} onClick={() => setTransactions((current) => current.filter((entry) => entry.id !== item.id))}>×</button></td></tr>
          ))}</tbody></table></div>
        )}
      </div>
    </section>
  );
}
