"use client";

import { useState } from "react";
import { AccountTab } from "@/components/tabs/account-tab";
import { CopilotTab } from "@/components/tabs/copilot-tab";
import { DashboardTab } from "@/components/tabs/dashboard-tab";
import { IntelligenceTab } from "@/components/tabs/intelligence-tab";
import { RadarTab } from "@/components/tabs/radar-tab";
import { TransactionsTab } from "@/components/tabs/transactions-tab";
import { usePortfolio } from "@/components/portfolio-provider";

const tabs = [
  { id: "visao", label: "Visão geral", icon: "⌁" },
  { id: "lancamentos", label: "Lançamentos", icon: "+" },
  { id: "inteligencia", label: "Inteligência", icon: "◎" },
  { id: "radar", label: "Radar", icon: "◇" },
  { id: "copiloto", label: "Copiloto", icon: "✦" },
  { id: "conta", label: "Conta", icon: "◉" },
];

export function AppShell() {
  const { hydrated, settings, holdings } = usePortfolio();
  const [activeTab, setActiveTab] = useState("visao");
  const [requestedTicker, setRequestedTicker] = useState("");

  if (!hydrated) {
    return <div className="boot-screen"><div className="orbis-mark">O</div><span>Preparando sua carteira…</span></div>;
  }

  function openAsset(ticker: string) {
    setRequestedTicker(ticker);
    setActiveTab("inteligencia");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="orbis-mark">O</div>
          <div><strong>Carteira Orbis</strong><span>Inteligência patrimonial</span></div>
        </div>
        <nav aria-label="Navegação principal">
          {tabs.map((tab) => (
            <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>
              <i>{tab.icon}</i><span>{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div><span>Posições abertas</span><strong>{holdings.length}</strong></div>
          <small>Dados manuais. Decisão humana.</small>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><div className="orbis-mark">O</div><strong>Carteira Orbis</strong></div>
          <div className="topbar-user"><span>Olá,</span><strong>{settings.displayName || "Investidor"}</strong></div>
        </header>
        <div className="mobile-tabs">
          {tabs.map((tab) => <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
        </div>
        <div className="content-area">
          {activeTab === "visao" && <DashboardTab onNavigate={setActiveTab} />}
          {activeTab === "lancamentos" && <TransactionsTab />}
          {activeTab === "inteligencia" && <IntelligenceTab onNavigate={setActiveTab} requestedTicker={requestedTicker} />}
          {activeTab === "radar" && <RadarTab onOpenAsset={openAsset} />}
          {activeTab === "copiloto" && <CopilotTab onNavigate={setActiveTab} />}
          {activeTab === "conta" && <AccountTab />}
        </div>
      </main>
    </div>
  );
}
