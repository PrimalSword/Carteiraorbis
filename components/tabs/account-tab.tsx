"use client";

import { useRef, useState } from "react";
import { usePortfolio } from "@/components/portfolio-provider";
import type { AiProvider } from "@/lib/types";

export function AccountTab() {
  const { settings, setSettings, secrets, setSecrets, exportData, importData, resetAll } = usePortfolio();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [dangerOpen, setDangerOpen] = useState(false);

  function downloadBackup() {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `carteira-orbis-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(file?: File) {
    if (!file) return;
    try {
      importData(await file.text());
      setMessage("Backup importado com sucesso.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível importar o arquivo.");
    }
  }

  const hybridMode = settings.geminiModel.startsWith("gemini-3") && settings.geminiWebSearch;

  return (
    <section className="tab-stack">
      <div className="page-heading"><div><span className="eyebrow">Preferências e segurança</span><h1>Conta</h1><p>Escolha o provedor de IA, configure as chaves e gerencie seus dados locais.</p></div></div>

      <div className="split-layout">
        <div className="panel form-panel">
          <div className="panel-heading"><div><span className="eyebrow">Provedor</span><h2>Inteligência artificial</h2></div></div>
          <div className="provider-switch">
            <button className={settings.provider === "openai" ? "active" : ""} onClick={() => setSettings((current) => ({ ...current, provider: "openai" as AiProvider }))}><strong>GPT</strong><span>OpenAI · pesquisa na web</span></button>
            <button className={settings.provider === "gemini" ? "active" : ""} onClick={() => setSettings((current) => ({ ...current, provider: "gemini" as AiProvider }))}><strong>Gemini</strong><span>Google · pesquisa gratuita disponível</span></button>
          </div>
          <div className="form-grid single">
            <label><span>Modelo GPT</span><input value={settings.openaiModel} onChange={(e) => setSettings((current) => ({ ...current, openaiModel: e.target.value }))} placeholder="gpt-5-mini" /></label>
            <label><span>Chave da OpenAI</span><input type="password" autoComplete="off" value={secrets.openaiKey} onChange={(e) => setSecrets((current) => ({ ...current, openaiKey: e.target.value }))} placeholder="Cole sua chave da OpenAI" /></label>
            <label>
              <span>Modelo Gemini</span>
              <select value={settings.geminiModel} onChange={(e) => setSettings((current) => ({ ...current, geminiModel: e.target.value, geminiSearchVersion: 2 }))}>
                <option value="gemini-2.5-flash">2.5 Flash — pesquisa gratuita recomendada</option>
                <option value="gemini-2.5-flash-lite">2.5 Flash-Lite — mais rápido e econômico</option>
                <option value="gemini-3.5-flash">3.5 Flash — modo híbrido</option>
              </select>
            </label>
            <label><span>Chave do Gemini</span><input type="password" autoComplete="off" value={secrets.geminiKey} onChange={(e) => setSecrets((current) => ({ ...current, geminiKey: e.target.value }))} placeholder="Cole sua chave do Google AI Studio" /></label>
          </div>

          {settings.provider === "gemini" && (
            <>
              <label className="checkbox-row"><input type="checkbox" checked={settings.geminiWebSearch} onChange={(e) => setSettings((current) => ({ ...current, geminiWebSearch: e.target.checked, geminiSearchVersion: 2 }))} /><span><strong>Pesquisar na internet com Google Search</strong><small>Nos modelos Gemini 2.5, o nível gratuito oferece até 500 pesquisas fundamentadas por dia, compartilhadas entre Flash e Flash-Lite.</small></span></label>
              {settings.geminiWebSearch && !hybridMode && <div className="notice info">Modo gratuito com pesquisa: o Gemini 2.5 consulta a web e produz o relatório em uma única chamada. O limite diário pertence ao projeto da chave.</div>}
              {hybridMode && <div className="notice info">Modo híbrido: o Gemini 2.5 Flash pesquisa a web gratuitamente e o Gemini 3.5 Flash organiza o relatório final. As duas etapas usam a mesma chave.</div>}
              {!settings.geminiWebSearch && <div className="notice info">Pesquisa desativada: a IA usará somente os dados da brapi e o conhecimento do modelo, sem confirmar acontecimentos recentes.</div>}
            </>
          )}

          <label className="checkbox-row"><input type="checkbox" checked={settings.rememberKeys} onChange={(e) => setSettings((current) => ({ ...current, rememberKeys: e.target.checked }))} /><span><strong>Lembrar chaves neste dispositivo</strong><small>Desativado: ficam apenas até a sessão terminar. Ativado: são salvas localmente neste aparelho.</small></span></label>
          <div className="notice subtle">As chaves são enviadas ao provedor somente durante a solicitação e não são armazenadas em servidores da Carteira Orbis.</div>
        </div>

        <div className="panel form-panel">
          <div className="panel-heading"><div><span className="eyebrow">Dados de mercado</span><h2>Cotações da B3</h2></div></div>
          <label><span>Token da brapi.dev</span><input type="password" autoComplete="off" value={secrets.brapiToken} onChange={(e) => setSecrets((current) => ({ ...current, brapiToken: e.target.value }))} placeholder="Token opcional" /></label>
          <p className="helper">Usado para consultar cotações e históricos de ações, FIIs, ETFs e BDRs. Sem token, a disponibilidade depende dos limites públicos da fonte.</p>
          <div className="divider" />
          <label><span>Nome exibido</span><input value={settings.displayName} onChange={(e) => setSettings((current) => ({ ...current, displayName: e.target.value }))} /></label>
          <div className="divider" />
          <div className="backup-actions"><button className="button secondary" onClick={downloadBackup}>Exportar backup</button><button className="button secondary" onClick={() => fileRef.current?.click()}>Importar backup</button><input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => void importBackup(e.target.files?.[0])} /></div>
          {message && <div className="notice info">{message}</div>}
        </div>
      </div>

      <div className="panel legal-panel">
        <div><span className="eyebrow">Governança</span><h2>Limites do produto</h2></div>
        <p>A Carteira Orbis organiza dados, produz comparações e destaca pontos para investigação. Ela não administra recursos, não executa ordens, não promete rentabilidade e não substitui avaliação profissional autorizada quando aplicável.</p>
      </div>

      <div className="panel danger-zone">
        <div><span className="eyebrow">Zona de risco</span><h2>Apagar os dados locais</h2><p>Remove lançamentos, radar, alertas e relatórios deste dispositivo.</p></div>
        {!dangerOpen ? <button className="button danger" onClick={() => setDangerOpen(true)}>Iniciar limpeza</button> : <div className="row-actions"><button className="button secondary" onClick={() => setDangerOpen(false)}>Cancelar</button><button className="button danger" onClick={() => { resetAll(); setDangerOpen(false); setMessage("Dados locais apagados."); }}>Confirmar exclusão</button></div>}
      </div>
    </section>
  );
}
