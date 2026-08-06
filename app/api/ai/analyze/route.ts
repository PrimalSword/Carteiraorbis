import { NextResponse } from "next/server";
import type { AiProvider, AiSource } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface AnalyzeRequest {
  provider?: AiProvider;
  apiKey?: string;
  model?: string;
  mode?: "asset" | "portfolio" | "question";
  ticker?: string;
  compareYears?: number;
  question?: string;
  portfolio?: unknown;
  marketContext?: unknown;
  webSearch?: boolean;
}

class ApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

const systemInstruction = `Você é o motor de inteligência da Carteira Orbis, uma plataforma informativa de acompanhamento de investimentos.
Sua função é organizar dados e explicar fatos, riscos, mudanças e hipóteses. Não emita ordem de compra ou venda, preço-alvo, promessa de retorno ou recomendação individualizada.
Quando houver pesquisa web, priorize fontes oficiais e primárias: CVM, B3, administrador, gestor, relações com investidores, fatos relevantes, relatórios gerenciais, demonstrações financeiras e comunicados oficiais. Use imprensa confiável apenas como complemento.
Separe claramente: FATO OFICIAL, CÁLCULO/COMPARAÇÃO, INTERPRETAÇÃO e PONTO DE ATENÇÃO.
Escreva em português brasileiro, com datas absolutas, linguagem clara e concisa. Informe quando um dado não foi localizado ou não pôde ser confirmado.
Estruture a resposta em Markdown com os títulos: Resumo executivo; O que mudou recentemente; Indicadores e evolução; Comparação histórica; Riscos e pontos de atenção; O que acompanhar; Fontes consultadas.
Não use tabelas excessivamente largas e jamais invente números.`;

const geminiQuotaMessage =
  "A chave do Gemini foi aceita, mas o projeto não tem cota disponível para pesquisa com Google Search. No plano gratuito, desative ‘Pesquisar na internet com Google Search’ na aba Conta. Para relatórios com notícias e documentos atuais, ative o faturamento do projeto Gemini ou use GPT com pesquisa web.";

function buildPrompt(body: AnalyzeRequest, webSearch: boolean): string {
  const years = Math.min(Math.max(body.compareYears ?? 3, 1), 10);
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
    return `${sourceRule}\nResponda à pergunta usando a carteira quando relevante.\n\nPERGUNTA: ${body.question ?? ""}\n\nCARTEIRA:\n${JSON.stringify(body.portfolio, null, 2)}${marketContext}`;
  }
  const ticker = String(body.ticker ?? "").trim().toUpperCase();
  return `${sourceRule}\nProduza um dossiê do ativo brasileiro ${ticker}. Analise fatos relevantes, relatórios, imóveis ou galpões, aquisições, alienações, emissões, dívida, vacância, locatários, contratos, rendimentos, resultados, mudanças de gestão e eventos regulatórios quando houver dados confirmados. Compare o momento disponível com os últimos ${years} anos e destaque o que mudou. Não conclua com recomendação de compra ou venda.${marketContext}`;
}

function uniqueSources(sources: AiSource[]): AiSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (!source.url || seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  }).slice(0, 20);
}

function collectSources(value: unknown, sources: AiSource[] = []): AiSource[] {
  if (!value || typeof value !== "object") return sources;
  if (Array.isArray(value)) {
    for (const item of value) collectSources(item, sources);
    return sources;
  }
  const record = value as Record<string, unknown>;
  const url = record.url ?? record.uri;
  if (typeof url === "string" && /^https?:\/\//i.test(url)) {
    let hostname = url;
    try { hostname = new URL(url).hostname; } catch { /* mantém a URL como rótulo */ }
    sources.push({ url, title: String(record.title ?? record.name ?? hostname) });
  }
  for (const child of Object.values(record)) collectSources(child, sources);
  return sources;
}

function payloadMessage(payload: Record<string, unknown>, fallback: string): string {
  const error = payload.error;
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message;
    if (message) return String(message);
  }
  if (typeof error === "string" && error) return error;
  if (payload.message) return String(payload.message);
  return fallback;
}

function isQuotaFailure(status: number, payload: Record<string, unknown>): boolean {
  if (status === 429) return true;
  const message = payloadMessage(payload, "").toLowerCase();
  return message.includes("quota") || message.includes("resource_exhausted");
}

function openAiText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  const parts: string[] = [];
  for (const item of output as Record<string, unknown>[]) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const block of content as Record<string, unknown>[]) {
      if (typeof block.text === "string") parts.push(block.text);
    }
  }
  return parts.join("\n\n");
}

function geminiText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === "string") return payload.output_text;
  if (typeof payload.text === "string") return payload.text;
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const parts: string[] = [];
  for (const candidate of candidates as Record<string, unknown>[]) {
    const content = candidate.content as Record<string, unknown> | undefined;
    const contentParts = Array.isArray(content?.parts) ? content.parts : [];
    for (const part of contentParts as Record<string, unknown>[]) {
      if (typeof part.text === "string") parts.push(part.text);
    }
  }
  return parts.join("\n\n");
}

async function analyzeWithOpenAI(apiKey: string, model: string, prompt: string) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      instructions: systemInstruction,
      input: prompt,
      tools: [{ type: "web_search" }],
      store: false,
    }),
    signal: AbortSignal.timeout(55_000),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new ApiError(payloadMessage(payload, "Falha na API da OpenAI."), response.status);
  }
  return { text: openAiText(payload), sources: uniqueSources(collectSources(payload)) };
}

async function geminiGenerate(
  apiKey: string,
  model: string,
  prompt: string,
  includeSearch: boolean,
) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }],
        ...(includeSearch ? { tools: [{ google_search: {} }] } : {}),
      }),
      signal: AbortSignal.timeout(55_000),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { response, payload };
}

async function analyzeWithGemini(
  apiKey: string,
  model: string,
  prompt: string,
  webSearch: boolean,
) {
  if (!webSearch) {
    const { response, payload } = await geminiGenerate(apiKey, model, prompt, false);
    if (!response.ok) {
      throw new ApiError(payloadMessage(payload, "Falha na API do Gemini."), response.status);
    }
    return { text: geminiText(payload), sources: [] as AiSource[] };
  }

  const interactionResponse = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
    {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: `${systemInstruction}\n\n${prompt}`,
        tools: [{ type: "google_search" }],
      }),
      signal: AbortSignal.timeout(55_000),
    },
  );
  const interactionPayload = (await interactionResponse.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (interactionResponse.ok) {
    return {
      text: geminiText(interactionPayload),
      sources: uniqueSources(collectSources(interactionPayload)),
    };
  }
  if (isQuotaFailure(interactionResponse.status, interactionPayload)) {
    throw new ApiError(geminiQuotaMessage, 429);
  }

  const { response, payload } = await geminiGenerate(apiKey, model, prompt, true);
  if (!response.ok) {
    if (isQuotaFailure(response.status, payload)) throw new ApiError(geminiQuotaMessage, 429);
    throw new ApiError(payloadMessage(payload, "Falha na API do Gemini."), response.status);
  }
  return { text: geminiText(payload), sources: uniqueSources(collectSources(payload)) };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyzeRequest;
    const provider = body.provider === "gemini" ? "gemini" : "openai";
    const apiKey = body.apiKey?.trim() ||
      (provider === "openai" ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY) ||
      "";

    if (apiKey.length < 10) {
      return NextResponse.json({ error: "Informe uma chave de API válida na aba Conta." }, { status: 400 });
    }
    if (body.mode === "asset" && !body.ticker?.trim()) {
      return NextResponse.json({ error: "Informe o ticker do ativo." }, { status: 400 });
    }
    if (body.mode === "question" && !body.question?.trim()) {
      return NextResponse.json({ error: "Escreva uma pergunta." }, { status: 400 });
    }

    const webSearch = provider === "openai" || body.webSearch === true;
    const model = body.model?.trim() ||
      (provider === "openai" ? "gpt-5-mini" : "gemini-3.5-flash");
    const prompt = buildPrompt(body, webSearch);
    const result = provider === "openai"
      ? await analyzeWithOpenAI(apiKey, model, prompt)
      : await analyzeWithGemini(apiKey, model, prompt, webSearch);

    if (!result.text.trim()) throw new ApiError("A IA não retornou texto analisável.", 502);

    return NextResponse.json({
      ...result,
      provider,
      model,
      generatedAt: new Date().toISOString(),
      webSearchUsed: webSearch,
      notice: webSearch
        ? undefined
        : "Relatório gerado sem pesquisa web. Foram usados os dados de mercado fornecidos pelo aplicativo e o conhecimento do modelo.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado na análise.";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
