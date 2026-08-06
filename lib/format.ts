export const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

export const compactCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

export const number = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 4,
});

export const percent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPercent(value: number): string {
  return percent.format(value / 100);
}

export function formatDate(value: string): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR").format(date);
}

export function assetClassLabel(value: string): string {
  const labels: Record<string, string> = {
    acao: "Ação",
    fii: "FII",
    etf: "ETF",
    bdr: "BDR",
    "renda-fixa": "Renda fixa",
    cripto: "Cripto",
    outro: "Outro",
  };
  return labels[value] ?? value;
}
