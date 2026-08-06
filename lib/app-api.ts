import { Capacitor, CapacitorHttp } from "@capacitor/core";
import type { AiProvider, AiSource } from "@/lib/types";

export interface AppApiResult<T> {
  ok: boolean;
  status: number;
  data: T & { error?: string };
}

type JsonObject = Record<string, unknown>;

const systemInstruction = `Você é o motor de inteligência da Carteira Orbis, uma plataforma informativa de acompanhamento de investimentos.
Sua função é organizar dados e explicar fatos, riscos, mudanças e hipóteses. Não emita ordem de compra ou venda, preço-alvo, promessa de retorno ou recomendação individualizada.
Quando houver pesquisa web, priorize fontes oficiais e primárias: CVM, B3, administrador, gestor, relações com investidores, fatos relevantes, relatórios gerenciais, demonstrações financeiras e comunicados oficiais. Use imprensa confiável apenas como complemento.
Separe claramente: FATO OFICIAL, CÁLCULO/COMPARAÇÃO, INTERPRETAÇÃO e PONTO DE ATENÇÃO.
Escreva em português brasileiro, com datas absolutas, linguagem clara e concisa. Informe quando um dado não foi localizado ou não pôde ser confirmado.
Estruture a resposta em Markdown com os títulos: Resumo executivo; O que mudou recentemente; Indicadores e evolução; Comparação histórica; Riscos e pontos de atenção; O que acompanhar; Fontes consultadas.
Não use tabelas excessivamente largas e jamais invente números.`;

const geminiQuotaMessage =
  "A chave do Gemini foi aceita, mas a cota gratuita de pesquisa do projeto foi atingida ou não está disponível. O Gemini 2.5 Flash e o Flash-Lite compartilham o limite gratuito de até 500 pesquisas fundamentadas por dia. Aguarde a renovação da cota, confira o projeto vinculado à chave ou desative temporariamente a pesquisa web na aba Conta.";

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

function payloadMessage(payload: JsonObject, fallback: string): string {
  const error = payload.error;
  if (error && typeof error === "object") {
    const message = (error as JsonObject).message;
    if (message) return String(message);
  }
  if (typeof error === "string" && error) return error;
  if (payload.message) return String(payload.message);
  return fallback;
}

function isQuotaFailure(result: AppApiResult<JsonObject>): boolean {
  if (result.status === 429) return true;
  const message = payloadMessage(result.data, "").toLowerCase();
  return message.includes("quota") || message.includes("resource_exhausted");
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
  if (!symbols.length) {
    return { ok: false, status: 400, data: { error: "Informe ao menos um ticker." } };
  }

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
        error: payloadMessage(result.data, "Não foi possível consultar as cotações."),
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
  if (!symbols.length) {
    return { ok: false, status: 400, data: { error: "Informe ao menos um ticker." } };
  }

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
        error: payloadMessage(result.data, "Não foi possível consultar o histórico."),
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
  const webSearch = body.webSearch !== false;
  const marketContext = body.marketContext
    ? `\n\nDADOS DE MERCADO FORNECIDOS PELO APLICATIVO:\n${JSON.stringify(body.marketContext, null, 2)}`
    : "";
  const sourceRule = webSearch
    ? "Pesquise fontes atuais e cite as fontes consultadas próximas às afirmações."
    : "Não há pesquisa web nesta solicitação. Use somente os dados fornecidos e o conhecimento do modelo. Não apresente notícias, fatos relevantes ou acontecimentos recentes como confirmados sem fonte; declare claramente essa limitação.";

  if (body.mode === "portfolio") {
    return `${sourceRule}\nAnalise a carteira abaixo como diagnóstico educacional de exposição, concentração, correlação aparente, risco e eventos relevantes. Não diga o que comprar ou vender.\n\nCARTEIRA:\n${JSON.stringify(body.portfolio, null, 2)}${marketContext}`;
  }
  if (body.mode === "question") {
    return `${sourceRule}\nResponda à pergunta usando a carteira quando relevante.\n\nPERGUNTA: ${String(body.question ?? "")}\n\nCARTEIRA:\n${JSON.stringify(body.portfolio, null, 2)}${marketContext}`;
  }
  const ticker = String(body.ticker ?? "").trim().toUpperCase();
  return `${sourceRule}\nProduza um dossiê do ativo brasileiro ${ticker}. Analise fatos relevantes, relatórios, imóveis ou galpões, aquisições, alienações, emissões, dívida, vacância, locatários, contratos, rendimentos, resultados, mudanças de gestão e eventos regulatórios quando houver dados confirmados. Compare o momento disponível com os últimos ${years} anos e destaque o que mudou. Não conclua com recomendação de compra ou venda.${marketContext}`;
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

async function nativeGeminiGenerate(
  apiKey: string,
  model: string,
  prompt: string,
  includeSearch: boolean,
): Promise<AppApiResult<JsonObject>> {
  return nativeRequest(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      data: {
        contents: [{ parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }],
        ...(includeSearch ? { tools: [{ google_search: {} }] } : {}),
      },
      timeout: 60_000,
    },
  );
}

function synthesisPrompt(researchText: string, sources: AiSource[]): string {
  const sourceList = sources.length
    ? sources.map((source, index) => `${index + 1}. ${source.title}: ${source.url}`).join("\n")
    : "Nenhuma URL estruturada foi recuperada; preserve apenas afirmações presentes na pesquisa.";
  return `Redija o relatório final usando exclusivamente a pesquisa fundamentada abaixo e os dados de mercado nela incluídos. Preserve datas, números, ressalvas e URLs. Não acrescente acontecimentos que não estejam na pesquisa. Diferencie fatos, cálculos, interpretações e pontos de atenção.\n\nPESQUISA FUNDAMENTADA:\n${researchText}\n\nFONTES RECUPERADAS:\n${sourceList}`;
}

async function nativeAnalysis(body: JsonObject): Promise<AppApiResult<JsonObject>> {
  const provider: AiProvider = body.provider === "gemini" ? "gemini" : "openai";
  const apiKey = String(body.apiKey ?? "").trim();
  if (apiKey.length < 10) {
    return { ok: false, status: 400, data: { error: "Informe uma chave de API válida na aba Conta." } };
  }
  if (body.mode === "asset" && !String(body.ticker ?? "").trim()) {
    return { ok: false, status: 400, data: { error: "Informe o ticker do ativo." } };
  }
  if (body.mode === "question" && !String(body.question ?? "").trim()) {
    return { ok: false, status: 400, data: { error: "Escreva uma pergunta." } };
  }

  const webSearch = provider === "openai" || body.webSearch === true;
  const prompt = buildPrompt({ ...body, webSearch });
  const model = String(body.model ?? (provider === "openai" ? "gpt-5-mini" : "gemini-2.5-flash"));
  let response: AppApiResult<JsonObject>;
  let text = "";
  let sources: AiSource[] = [];
  let notice: string | undefined;

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
    sources = collectSources(response.data);
  } else if (webSearch) {
    const researchModel = model.startsWith("gemini-2.5") ? model : "gemini-2.5-flash";
    const researchResponse = await nativeGeminiGenerate(apiKey, researchModel, prompt, true);

    if (!researchResponse.ok && isQuotaFailure(researchResponse)) {
      return { ok: false, status: 429, data: { error: geminiQuotaMessage } };
    }
    if (!researchResponse.ok) {
      return {
        ...researchResponse,
        data: {
          ...researchResponse.data,
          error: payloadMessage(researchResponse.data, "Falha na pesquisa do Gemini."),
        },
      };
    }

    const researchText = geminiText(researchResponse.data);
    sources = collectSources(researchResponse.data);
    if (!researchText.trim()) {
      return { ok: false, status: 502, data: { error: "O Gemini não retornou conteúdo de pesquisa." } };
    }

    if (researchModel === model) {
      response = researchResponse;
      text = researchText;
      notice = `Pesquisa e relatório gerados pelo ${researchModel} com Google Search.`;
    } else {
      response = await nativeGeminiGenerate(
        apiKey,
        model,
        synthesisPrompt(researchText, sources),
        false,
      );
      text = geminiText(response.data);
      notice = `Pesquisa realizada pelo ${researchModel}; relatório final organizado pelo ${model}.`;
    }
  } else {
    response = await nativeGeminiGenerate(apiKey, model, prompt, false);
    text = geminiText(response.data);
    notice = "Relatório gerado sem pesquisa web. Foram usados os dados de mercado fornecidos pelo aplicativo e o conhecimento do modelo.";
  }

  if (!response.ok) {
    return {
      ...response,
      data: {
        ...response.data,
        error: payloadMessage(response.data, `Falha na API ${provider === "openai" ? "da OpenAI" : "do Gemini"}.`),
      },
    };
  }
  if (!text.trim()) {
    return { ok: false, status: 502, data: { error: "A IA não retornou texto analisável." } };
  }

  return {
    ok: true,
    status: 200,
    data: {
      text,
      sources: webSearch ? sources : [],
      provider,
      model,
      generatedAt: new Date().toISOString(),
      webSearchUsed: webSearch,
      notice,
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
