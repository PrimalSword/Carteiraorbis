"use client";

import { useState } from "react";
import { ReportView } from "@/components/report-view";
import { usePortfolio } from "@/components/portfolio-provider";
import type { AiReport } from "@/lib/types";

const suggestions = [
  "Onde minha carteira está mais concentrada?",
  "Quais eventos recentes dos meus ativos merecem acompanhamento?",
  "Como uma alta da Selic pode afetar as posições atuais?",
  "Minha diversificação é real ou os ativos se comportam de forma parecida?",
];

export function CopilotTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { holdings, reports, setReport, runAnalysis, settings, secrets } = usePortfolio();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const report = reports.copilot ?? null;
  const hasKey = settings.provider === "openai" ? !!secrets.openaiKey : !!secrets.geminiKey;

  async function ask(customQuestion?: string) {
    const text = (customQuestion ?? question).trim();
    if (!text) return;
    setQuestion(text);
    setLoading(true);
    setError("");
    try {
      const result = await runAnalysis({ mode: "question", question: text });
      setReport("copilot", result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao consultar o copiloto.");
    } finally {
      setLoading(false);
    }
  }

  async function diagnose() {
    setLoading(true);
    setError("");
    try {
      const result = await runAnalysis({ mode: "portfolio" });
      setReport("copilot", result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao analisar a carteira.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="tab-stack">
      <div className="page-heading">
        <div><span className="eyebrow">IA com contexto</span><h1>Copiloto da carteira</h1><p>Pergunte sobre risco, concentração, cenários e eventos — sem terceirizar a decisão.</p></div>
        <button className="button secondary" onClick={() => void diagnose()} disabled={loading || !holdings.length || !hasKey}>{loading ? "Analisando…" : "Gerar diagnóstico completo"}</button>
      </div>

      {!holdings.length && <div className="notice info">Adicione pelo menos um ativo para o copiloto entender a sua carteira.</div>}
      {!hasKey && <div className="notice info">A chave do provedor selecionado ainda não foi configurada. <button onClick={() => onNavigate("conta")}>Configurar agora</button></div>}

      <div className="panel copilot-panel">
        <div className="prompt-suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => void ask(suggestion)}>{suggestion}</button>)}</div>
        <label className="chat-box"><span>Sua pergunta</span><textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ex.: O que mudou nos FIIs da minha carteira neste mês?" onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void ask(); }} /></label>
        {error && <div className="field-error">{error}</div>}
        <div className="chat-actions"><small>Ctrl/⌘ + Enter para enviar</small><button className="button primary" disabled={loading || !hasKey} onClick={() => void ask()}>{loading ? "Pesquisando…" : "Perguntar ao copiloto"}</button></div>
      </div>

      <ReportView report={report as AiReport | null} />
    </section>
  );
}
