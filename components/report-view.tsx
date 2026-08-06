"use client";

import type { AiReport } from "@/lib/types";
import { formatDate } from "@/lib/format";

function renderLine(line: string, index: number) {
  if (line.startsWith("### ")) return <h4 key={index}>{line.slice(4)}</h4>;
  if (line.startsWith("## ")) return <h3 key={index}>{line.slice(3)}</h3>;
  if (line.startsWith("# ")) return <h2 key={index}>{line.slice(2)}</h2>;
  if (/^[-*]\s/.test(line)) return <li key={index}>{line.replace(/^[-*]\s/, "")}</li>;
  if (/^\d+\.\s/.test(line)) return <li key={index}>{line.replace(/^\d+\.\s/, "")}</li>;
  if (!line.trim()) return <div className="report-spacer" key={index} />;
  return <p key={index}>{line.replace(/\*\*/g, "")}</p>;
}

export function ReportView({ report }: { report: AiReport | null }) {
  if (!report) {
    return (
      <div className="empty-state compact">
        <strong>Nenhum relatório gerado ainda.</strong>
        <span>A análise mostrará claramente se utilizou pesquisa web ou apenas os dados de mercado disponíveis.</span>
      </div>
    );
  }

  return (
    <article className="report-card">
      <header>
        <div>
          <span className="eyebrow">Relatório Orbis</span>
          <strong>{report.provider === "openai" ? "GPT" : "Gemini"} · {report.model}</strong>
        </div>
        <small>{formatDate(report.generatedAt)}</small>
      </header>
      {report.notice && <div className="notice info">{report.notice}</div>}
      <div className="report-body">{report.text.split("\n").map(renderLine)}</div>
      {!!report.sources.length && (
        <footer>
          <strong>Fontes recuperadas</strong>
          <div className="source-list">
            {report.sources.map((source) => (
              <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>
                {source.title}
              </a>
            ))}
          </div>
        </footer>
      )}
    </article>
  );
}
