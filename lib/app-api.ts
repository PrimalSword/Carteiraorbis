import { Capacitor, CapacitorHttp } from "@capacitor/core";
import type { AiProvider, AiSource } from "@/lib/types";

export interface AppApiResult<T> {
  ok: boolean;
  status: number;
  data: T & { error?: string };
}

type JsonObject = Record<string, unknown>;

const systemInstruction = `Você é o motor de inteligência da Carteira Orbis, uma plataforma informativa de acompanhamento de investimentos.
Sua função é pesquisar fontes atuais, organizar dados e explicar fatos, riscos, mudanças e hipóteses. Não emita ordem de compra ou venda, preço-alvo, promessa de retorno ou recomendação individualizada.
Priorize fontes oficiais e primárias: CVM, B3, administrador, gestor, relações com investidores, fatos relevantes, relatórios gerenciais, demonstrações financeiras e comunicados oficiais. Use imprensa confiável somente como complemento.
Separe claramente: FATO OFICIAL, CÁLCULO/COMPARAÇÃO, INTERPRETAÇÃO e PONTO DE ATENÇÃO.
Escreva em português brasileiro, com datas absolutas, linguagem clara e concisa. Sempre informe quando um dado não foi localizado ou não pôde ser confirmado.
Estruture a resposta em Markdown com os títulos: Resumo executivo; O que mudou recentemente; Indicadores e evolução; Comparação histórica; Riscos e pontos de atenção; O que acompanhar; Fontes consultadas.
Não use tabelas excessivamente largas. Cite as fontes próximas às afirmações e jamais invente números.`;

function parseData(value: unknown): JsonObject {
  if (value && typeof value === "object") return value as JsonObject;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as JsonObject;
    } catch {
      return { error: value };
    }
  }
  return {};
}

async function nativeRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    data?: unknown;
    timeout?: number;
  } = {},
): Promise<AppApiResult<JsonObject>> {
  try {
    const response = await CapacitorHttp.request({
      url,
      method: options.method ?? "GET",
      headers: options.headers,
      data: options.data,
      connectTimeout: Math.min(options.timeout ?? 20_000, 60_000),
      readTimeout: options.timeout ?? 60_000,
    });
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      data: parseData(response.data),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: { error: error instanceof Error ? error.message : "Falha na conexão nativa." },
    };
  }
}

function symbolsFrom(body: JsonObject, limit: number): string[] {
  const raw = Array.isArray(body.symbols) ? body.symbols : [];
  return [...new Set(raw.map((value) => String(value).trim().toUpperCase()).filter(Boolean))].slice(
    0,
    limit,
  );
}

async function nativeQuotes(body: JsonObject): Promise<AppApiResult<JsonObject>> {
  const symbols = symbolsFrom(body, 30);
  if (!symbols.length) return { ok: false, status: 400, data: { error: "Informe ao menos um ticker." } };

  const token = String(body.token ?? "").trim();
  const query = new URLSearchParams({ fundamental: "false", dividends: "false" });
  const result = await nativeRequest(
    `https://brapi.dev/api/quote/${encodeURIComponent(symbols.join(","))}?${query}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : undefined, timeout: 20_000 },
  );
  if (!result.ok) {
    return {
      ...result,
      data: {
        ...result.data,
        error: String(result.data.message ?? result.data.error ?? "Não foi possível consultar as cotações."),
      },
    };
  }

  const rows = Array.isArray(result.data.results) ? result.data.results : [];
  const quotes = rows.map((value) => {
    const item = value as JsonObject;
    return {
      ticker: String(item.symbol ?? "").toUpperCase(),
      name: String(item.shortName ?? item.longName ?? ""),
      price: Number(item.regularMarketPrice ?? 0),
      previousClose: Number(item.regularMarketPreviousClose ?? 0) || undefined,
      changePercent: Number(item.regularMarketChangePercent ?? 0) || 0,
      currency: String(item.currency ?? "BRL"),
      updatedAt: String(item.regularMarketTime ?? new Date().toISOString()),
      logoUrl: String(item.logourl ?? "") || undefined,
      source: "brapi.dev",
    };
  });
  return { ok: true, status: 200, data: { quotes, requestedAt: new Date().toISOString() } };
}

function normalizePoint(value: unknown) {
  const point = (value && typeof value === "object" ? value : {}) as JsonObject;
  const rawDate = point.date ?? point.datetime ?? point.timestamp ?? point.regularMarketTime;
  let date = "";
  if (typeof rawDate === "number") {
    date = new Date(rawDate > 10_000_000_000 ? rawDate : rawDate * 1000).toISOString().slice(0, 10);
  } else if (rawDate) {
    date = String(rawDate).slice(0, 10);
  }
  return { date, close: Number(point.close ?? point.adjustedClose ?? point.price ?? 0) };
}

async function nativeHistory(body: JsonObject): Promise<AppApiResult<JsonObject>> {
  const symbols = symbolsFrom(body, 20);
  if (!symbols.length) return { ok: false, status: 400, data: { error: "Informe ao menos um ticker." } };

  const token = String(body.token ?? "").trim();
  const query = new URLSearchParams({
    range: String(body.range ?? "1y"),
    interval: "1d",
    fundamental: "false",
    dividends: "false",
  });
  const result = await nativeRequest(
    `https://brapi.dev/api/quote/${encodeURIComponent(symbols.join(","))}?${query}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : undefined, timeout: 25_000 },
  );
  if (!result.ok) {
    return {
      ...result,
      data: {
        ...result.data,
        error: String(result.data.message ?? result.data.error ?? "Não foi possível consultar o histórico."),
      },
    };
  }

  const history: Record<string, { date: string; close: number }[]> = {};
  const rows = Array.isArray(result.data.results) ? result.data.results : [];
  for (const value of rows) {
    const item = value as JsonObject;
    const ticker = String(item.symbol ?? "").toUpperCase();
    const raw = item.historicalDataPrice ?? item.historical ?? item.prices ?? [];
    history[ticker] = (Array.isArray(raw) ? raw : [])
      .map(normalizePoint)
      .filter((point) => point.date && Number.isFinite(point.close) && point.close > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  return { ok: true, status: 200, data: { history, requestedAt: new Date().toISOString() } };
}

function buildPrompt(body: JsonObject): string {
  const years = Math.min(Math.max(Number(body.compareYears ?? 3), 1), 10);
  if (body.mode === "portfolio") {
    return `Analise a carteira abaixo como diagnóstico educacional de exposição, concentração, correlação aparente, risco e eventos recentes. Não diga o que comprar ou vender.\n\nCARTEIRA:\n${JSON.stringify(body.portfolio, null, 2)}`;
  }
  if (body.mode === "question") {
    return `Responda à pergunta usando a carteira quando relevante e pesquise fatos atuais.\n\nPERGUNTA: ${String(body.question ?? "")}\n\nCARTEIRA:\n${JSON.stringify(body.portfolio, null, 2)}`;
  }
  const ticker = String(body.ticker ?? "").trim().toUpperCase();
  return `Produza um dossiê vivo e atual do ativo brasileiro ${ticker}. Pesquise fatos relevantes, relatórios, novos imóveis ou galpões, aquisições, alienações, emissões, dívida, vacância, locatários, contratos, rendimentos, resultados, mudanças de gestão e eventos regulatórios. Compare o momento atual com os últimos ${years} anos e destaque o que mudou. Não conclua com recomendação de compra ou venda.`;
}

function collectSources(value: unknown, output: AiSource[] = []): AiSource[] {
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value)) {
    value.forEach((item) => collectSources(item, output));
    return output;
  }
  const record = value as JsonObject;
  const url = record.url ?? record.uri;
  if (typeof url === "string" && /^https?:\/\//i.test(url) && !output.some((item) => item.url === url)) {
    let title = String(record.title ?? record.name ?? url);
    try {
      title = String(record.title ?? record.name ?? new URL(url).hostname);
    } catch {
      // Mantém a URL como título.
    }
    output.push({ title, url });
  }
  Object.values(record).forEach((item) => collectSources(item, output));
  return output.slice(0, 20);
}

function openAiText(payload: JsonObject): string {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  const text: string[] = [];
  for (const itemValue of output) {
    const item = itemValue as JsonObject;
    const content = Array.isArray(item.content) ? item.content : [];
    for (const blockValue of content) {
      const block = blockValue as JsonObject;
      if (typeof block.text === "string") text.push(block.text);
    }
  }
  return text.join("\n\n");
}

function geminiText(payload: JsonObject): string {
  if (typeof payload.output_text === "string") return payload.output_text;
  if (typeof payload.text === "string") return payload.text;
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const text: string[] = [];
  for (const candidateValue of candidates) {
    const candidate = candidateValue as JsonObject;
    const content = (candidate.content ?? {}) as JsonObject;
    const parts = Array.isArray(content.parts) ? content.parts : [];
    for (const partValue of parts) {
      const part = partValue as JsonObject;
      if (typeof part.text === "string") text.push(part.text);
    }
  }
  return text.join("\n\n");
}

async function nativeAnalysis(body: JsonObject): Promise<AppApiResult<JsonObject>> {
  const provider: AiProvider = body.provider === "gemini" ? "gemini" : "openai";
  const apiKey = String(body.apiKey ?? "").trim();
  if (apiKey.length < 10) return { ok: false, status: 400, data: { error: "Informe uma chave de API válida na aba Conta." } };
  if (body.mode === "asset" && !String(body.ticker ?? "").trim()) {
    return { ok: false, status: 400, data: { error: "Informe o ticker do ativo." } };
  }
  if (body.mode === "question" && !String(body.question ?? "").trim()) {
    return { ok: false, status: 400, data: { error: "Escreva uma pergunta." } };
  }

  const prompt = buildPrompt(body);
  const model = String(body.model ?? (provider === "openai" ? "gpt-5-mini" : "gemini-3.5-flash"));
  let response: AppApiResult<JsonObject>;
  let text = "";

  if (provider === "openai") {
    response = await nativeRequest("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      data: {
        model,
        instructions: systemInstruction,
        input: prompt,
        tools: [{ type: "web_search" }],
        store: false,
      },
      timeout: 60_000,
    });
    text = openAiText(response.data);
  } else {
    response = await nativeRequest("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      data: { model, input: `${systemInstruction}\n\n${prompt}`, tools: [{ type: "google_search" }] },
      timeout: 60_000,
    });
    if (!response.ok) {
      response = await nativeRequest(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
          data: {
            contents: [{ parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }],
            tools: [{ google_search: {} }],
          },
          timeout: 60_000,
        },
      );
    }
    text = geminiText(response.data);
  }

  if (!response.ok) {
    const error = response.data.error;
    const message = typeof error === "object" && error ? String((error as JsonObject).message ?? "") : String(error ?? "");
    return { ...response, data: { ...response.data, error: message || `Falha na API ${provider}.` } };
  }
  if (!text.trim()) return { ok: false, status: 502, data: { error: "A IA não retornou texto analisável." } };

  return {
    ok: true,
    status: 200,
    data: {
      text,
      sources: collectSources(response.data),
      provider,
      model,
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function postAppApi<T extends JsonObject>(
  path: "/api/market/quote" | "/api/market/history" | "/api/ai/analyze",
  body: JsonObject,
): Promise<AppApiResult<T>> {
  if (!Capacitor.isNativePlatform()) {
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = parseData(await response.text());
      return { ok: response.ok, status: response.status, data: data as T & { error?: string } };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        data: { error: error instanceof Error ? error.message : "Falha na conexão." } as T & { error?: string },
      };
    }
  }

  const result =
    path === "/api/market/quote"
      ? await nativeQuotes(body)
      : path === "/api/market/history"
        ? await nativeHistory(body)
        : await nativeAnalysis(body);
  return result as AppApiResult<T>;
}
