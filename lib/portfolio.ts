import type {
  Holding,
  PortfolioSnapshot,
  PortfolioTransaction,
  PricePoint,
  Quote,
} from "@/lib/types";

function dateKey(value: string): string {
  return value.slice(0, 10);
}

export function buildHoldings(
  transactions: PortfolioTransaction[],
  quotes: Record<string, Quote>,
): Holding[] {
  const grouped = new Map<string, PortfolioTransaction[]>();

  for (const transaction of transactions) {
    const ticker = transaction.ticker.trim().toUpperCase();
    const list = grouped.get(ticker) ?? [];
    list.push({ ...transaction, ticker });
    grouped.set(ticker, list);
  }

  const holdings: Holding[] = [];

  for (const [ticker, list] of grouped) {
    const ordered = [...list].sort((a, b) => a.date.localeCompare(b.date));
    let quantity = 0;
    let costBasis = 0;
    let income = 0;
    let fallbackPrice = 0;

    for (const item of ordered) {
      fallbackPrice = item.unitPrice || fallbackPrice;
      if (item.kind === "buy") {
        quantity += item.quantity;
        costBasis += item.quantity * item.unitPrice + item.fees;
      } else if (item.kind === "sell") {
        const averageBeforeSale = quantity > 0 ? costBasis / quantity : 0;
        const soldQuantity = Math.min(item.quantity, quantity);
        quantity -= soldQuantity;
        costBasis = Math.max(0, costBasis - soldQuantity * averageBeforeSale);
      } else {
        income += item.unitPrice * Math.max(item.quantity, 1) - item.fees;
      }
    }

    if (quantity <= 0.0000001) continue;

    const quote = quotes[ticker];
    const currentPrice = quote?.price ?? fallbackPrice;
    const currentValue = currentPrice * quantity;
    const profit = currentValue - costBasis;
    const last = ordered.at(-1)!;

    holdings.push({
      ticker,
      name: quote?.name || last.name,
      assetClass: last.assetClass,
      quantity,
      averagePrice: quantity ? costBasis / quantity : 0,
      costBasis,
      income,
      currentPrice,
      currentValue,
      profit,
      profitPercent: costBasis ? (profit / costBasis) * 100 : 0,
      changePercent: quote?.changePercent,
      source: quote?.source ?? "Preço informado manualmente",
    });
  }

  return holdings.sort((a, b) => b.currentValue - a.currentValue);
}

export function buildPortfolioHistory(
  transactions: PortfolioTransaction[],
  history: Record<string, PricePoint[]>,
  quotes: Record<string, Quote>,
): PortfolioSnapshot[] {
  if (!transactions.length) return [];

  const start = new Date(
    `${transactions.map((item) => item.date).sort()[0].slice(0, 10)}T12:00:00`,
  );
  const end = new Date();
  const totalDays = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / 86_400_000),
  );
  const step = totalDays > 730 ? 7 : totalDays > 180 ? 2 : 1;

  const priceMaps: Record<string, Map<string, number>> = {};
  const sortedPriceDates: Record<string, string[]> = {};

  for (const [ticker, points] of Object.entries(history)) {
    priceMaps[ticker] = new Map(points.map((point) => [dateKey(point.date), point.close]));
    sortedPriceDates[ticker] = points.map((point) => dateKey(point.date)).sort();
  }

  function priceAt(ticker: string, date: string, fallback: number): number {
    const map = priceMaps[ticker];
    if (!map) return quotes[ticker]?.price ?? fallback;
    if (map.has(date)) return map.get(date)!;
    const dates = sortedPriceDates[ticker] ?? [];
    let selected = "";
    for (const candidate of dates) {
      if (candidate > date) break;
      selected = candidate;
    }
    return (selected && map.get(selected)) || quotes[ticker]?.price || fallback;
  }

  const snapshots: PortfolioSnapshot[] = [];
  for (let day = 0; day <= totalDays; day += step) {
    const current = new Date(start);
    current.setDate(start.getDate() + day);
    const key = current.toISOString().slice(0, 10);
    const relevant = transactions.filter((item) => dateKey(item.date) <= key);
    const perTicker = new Map<
      string,
      { quantity: number; invested: number; average: number }
    >();

    for (const item of [...relevant].sort((a, b) => a.date.localeCompare(b.date))) {
      const ticker = item.ticker.toUpperCase();
      const currentPosition = perTicker.get(ticker) ?? {
        quantity: 0,
        invested: 0,
        average: item.unitPrice,
      };
      if (item.kind === "buy") {
        currentPosition.quantity += item.quantity;
        currentPosition.invested += item.quantity * item.unitPrice + item.fees;
        currentPosition.average = currentPosition.quantity
          ? currentPosition.invested / currentPosition.quantity
          : item.unitPrice;
      } else if (item.kind === "sell") {
        const sold = Math.min(item.quantity, currentPosition.quantity);
        currentPosition.quantity -= sold;
        currentPosition.invested = Math.max(
          0,
          currentPosition.invested - sold * currentPosition.average,
        );
      }
      perTicker.set(ticker, currentPosition);
    }

    let value = 0;
    let invested = 0;
    for (const [ticker, position] of perTicker) {
      if (position.quantity <= 0) continue;
      value += position.quantity * priceAt(ticker, key, position.average);
      invested += position.invested;
    }
    snapshots.push({ date: key, value, invested });
  }

  const today = end.toISOString().slice(0, 10);
  if (snapshots.at(-1)?.date !== today) {
    const holdings = buildHoldings(transactions, quotes);
    snapshots.push({
      date: today,
      value: holdings.reduce((sum, item) => sum + item.currentValue, 0),
      invested: holdings.reduce((sum, item) => sum + item.costBasis, 0),
    });
  }

  return snapshots;
}

export function summarizePortfolio(holdings: Holding[]) {
  const value = holdings.reduce((sum, item) => sum + item.currentValue, 0);
  const invested = holdings.reduce((sum, item) => sum + item.costBasis, 0);
  const income = holdings.reduce((sum, item) => sum + item.income, 0);
  const profit = value - invested;
  return {
    value,
    invested,
    income,
    profit,
    profitPercent: invested ? (profit / invested) * 100 : 0,
  };
}
