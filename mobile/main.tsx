import React from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "@/components/app-shell";
import { PortfolioProvider } from "@/components/portfolio-provider";
import "@/app/globals.css";
import "./mobile.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Elemento raiz do aplicativo não foi encontrado.");
}

createRoot(root).render(
  <React.StrictMode>
    <PortfolioProvider>
      <AppShell />
    </PortfolioProvider>
  </React.StrictMode>,
);
