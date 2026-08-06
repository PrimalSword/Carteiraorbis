import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HistoryRequest {
  symbols?: string[];
  token?: string;
  range?: "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" | "10y" | "max";
}

function normalizePoint(point: Record<string, unknown>) {
  const rawDate = point.date ?? point.datetime ?? point.timestamp ?? point.regularMarketTime;
  let date = "";
  if (typeof rawDate === "number") {
    date = new Date(rawDate > 10_000_000_000 ? rawDate : rawDate * 1000)
      .toISOString()
      .slice(0, 10);
  } else if (rawDate) {
    date = String(rawDate).slice(0, 10);
  }
  return {
    date,
    close: Number(point.close ?? point.adjustedClose ?? point.price ?? 0),
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HistoryRequest;
    const symbols = [...new Set((body.symbols ?? []).map((item) => item.trim().toUpperCase()))]
      .filter(Boolean)
      .slice(0, 20);
    if (!symbols.length) {
      return NextResponse.json({ error: "Informe ao menos um ticker." }, { status: 400 });
    }

    const token = body.token?.trim() || process.env.BRAPI_API_TOKEN?.trim();
    const headers: HeadersInit = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    // O endpoint geral entrega histórico para diferentes classes negociadas na B3.
    const endpoint = new URL(
      `https://brapi.dev/api/quote/${encodeURIComponent(symbols.join(","))}`,
    );
    endpoint.searchParams.set("range", body.range ?? "1y");
    endpoint.searchParams.set("interval", "1d");
    endpoint.searchParams.set("fundamental", "false");
    endpoint.searchParams.set("dividends", "false");

    const response = await fetch(endpoint, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          error: payload?.message || "Não foi possível consultar o histórico.",
          requiresToken: !token && [401, 403, 429].includes(response.status),
        },
        { status: response.status },
      );
    }

    const history: Record<string, { date: string; close: number }[]> = {};
    for (const item of payload.results ?? []) {
      const ticker = String(item.symbol ?? "").toUpperCase();
      const rawPoints = item.historicalDataPrice ?? item.historical ?? item.prices ?? [];
      history[ticker] = (Array.isArray(rawPoints) ? rawPoints : [])
        .map((point) => normalizePoint(point))
        .filter((point) => point.date && Number.isFinite(point.close) && point.close > 0)
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    return NextResponse.json({
      history,
      requestedAt: payload.requestedAt ?? new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado na consulta.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
