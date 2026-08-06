import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface QuoteRequest {
  symbols?: string[];
  token?: string;
}

function normalizeSymbols(symbols: string[] = []): string[] {
  return [...new Set(symbols.map((value) => value.trim().toUpperCase()).filter(Boolean))].slice(
    0,
    30,
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as QuoteRequest;
    const symbols = normalizeSymbols(body.symbols);
    if (!symbols.length) {
      return NextResponse.json({ error: "Informe ao menos um ticker." }, { status: 400 });
    }

    const token = body.token?.trim() || process.env.BRAPI_API_TOKEN?.trim();
    const headers: HeadersInit = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    // O endpoint geral cobre ações, FIIs, ETFs, BDRs, units e índices.
    const endpoint = new URL(
      `https://brapi.dev/api/quote/${encodeURIComponent(symbols.join(","))}`,
    );
    endpoint.searchParams.set("fundamental", "false");
    endpoint.searchParams.set("dividends", "false");

    const response = await fetch(endpoint, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        payload?.message ||
        payload?.error?.message ||
        "Não foi possível consultar as cotações.";
      return NextResponse.json(
        {
          error: message,
          requiresToken: !token && [401, 403, 429].includes(response.status),
        },
        { status: response.status },
      );
    }

    const quotes = (payload.results ?? []).map((item: Record<string, unknown>) => ({
      ticker: String(item.symbol ?? "").toUpperCase(),
      name: String(item.shortName ?? item.longName ?? ""),
      price: Number(item.regularMarketPrice ?? 0),
      previousClose: Number(item.regularMarketPreviousClose ?? 0) || undefined,
      changePercent: Number(item.regularMarketChangePercent ?? 0) || 0,
      currency: String(item.currency ?? "BRL"),
      updatedAt: String(item.regularMarketTime ?? new Date().toISOString()),
      logoUrl: String(item.logourl ?? "") || undefined,
      source: "brapi.dev",
    }));

    return NextResponse.json({
      quotes,
      requestedAt: payload.requestedAt ?? new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado na consulta.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
