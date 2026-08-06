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
}

const systemInstruction = `Você é o motor de inteligência da Carteira Orbis, uma plataforma informativa de acompanhamento de investimentos.
Sua função é pesquisar fontes atuais, organizar dados e explicar fatos, riscos, mudanças e hipóteses. Não emita ordem de compra ou venda, preço-alvo, promessa de retorno ou recomendação individualizada.
Priorize fontes oficiais e primárias: CVM, B3, administrador, gestor, relações com investidores, fatos relevantes, relatórios gerenciais, demonstrações financeiras e comunicados oficiais. Use imprensa confiável somente como complemento.
Separe claramente: FATO OFICIAL, CÁLCULO/COMPARAÇÃO, INTERPRETAÇÃO e PONTO DE ATENÇÃO.
Escreva em português brasileiro, com datas absolutas, linguagem clara e concisa. Sempre informe quando um dado não foi localizado ou não pôde ser confirmado.
Estruture a resposta em Markdown com os títulos: Resumo executivo; O que mudou recentemente; Indicadores e evolução; Comparação histórica; Riscos e pontos de atenção; O que acompanhar; Fontes consultadas.
Não use tabelas excessivamente largas. Cite as fontes próximas às afirmações e jamais invente números.`;

function buildPrompt(body: AnalyzeRequest): string {
  const years = Math.min(Math.max(body.compareYears ?? 3, 1), 10);
  if (body.mode === "portfolio") {
    return `Analise a carteira abaixo como um diagnóstico educacional de exposição, concentração, correlação aparente, risco, eventos recentes dos ativos e perguntas que o investidor deveria investigar. Não diga o que comprar ou vender.\n\nCARTEIRA:\n${JSON.stringify(body.portfolio, null, 2)}`;
  }
  if (body.mode === "question") {
    return `Responda à pergunta abaixo usando a carteira fornecida quando relevante. Faça pesquisa na web quando a resposta depender de fatos atuais.\n\nPERGUNTA: ${body.question ?? ""}\n\nCARTEIRA:\n${JSON.stringify(body.portfolio, null, 2)}`;
  }
  const ticker = String(body.ticker ?? "").trim().toUpperCase();
  return `Produza um dossiê vivo e atual do ativo brasileiro ${ticker}. Pesquise tudo que foi oficialmente divulgado e o que é material para acompanhamento: fatos relevantes, relatórios, novos imóveis ou galpões, aquisições, alienações, emissões, dívida, vacância, locatários, contratos, rendimentos, resultados, mudanças de gestão e eventos regulatórios. Compare o momento atual com os últimos ${years} anos e destaque o que mudou. Não conclua com recomendação de compra ou venda.`;
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
    sources.push({
      url,
      title: String(record.title ?? record.name ?? hostname),
    });
  }
  for (const child of Object.values(record)) collectSources(child, sources);
  return sources;
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

async function analyzeWithOpenAI(apiKey: string, model: string, prompt: string) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
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
    const error = payload.error as Record<string, unknown> | undefined;
    throw new Error(String(error?.message ?? "Falha na API da OpenAI."));
  }
  return {
    text: openAiText(payload),
    sources: uniqueSources(collectSources(payload)),
  };
}

function geminiText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === "string") return payload.output_text;
  if (typeof payload.text === "string") return payload.text;
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const parts: string[] = [];
  for (const candidate of candidates as Record<string, unknown>[]) {
    const content = candidate.content as Record<string, unknown> | undefined;
    const contentParts = Array.isArray(content?.parts) ? content?.parts : [];
    for (const part of contentParts as Record<string, unknown>[]) {
      if (typeof part.text === "string") parts.push(part.text);
    }
  }
  return parts.join("\n\n");
}

async function analyzeWithGemini(apiKey: string, model: string, prompt: string) {
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

  const fallbackResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }],
        tools: [{ google_search: {} }],
      }),
      signal: AbortSignal.timeout(55_000),
    },
  );
  const fallbackPayload = (await fallbackResponse.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!fallbackResponse.ok) {
    const error = fallbackPayload.error as Record<string, unknown> | undefined;
    throw new Error(String(error?.message ?? "Falha na API do Gemini."));
  }
  return {
    text: geminiText(fallbackPayload),
    sources: uniqueSources(collectSources(fallbackPayload)),
  };
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

    const model =
      body.model?.trim() || (provider === "openai" ? "gpt-5-mini" : "gemini-3.5-flash");
    const prompt = buildPrompt(body);
    const result =
      provider === "openai"
        ? await analyzeWithOpenAI(apiKey, model, prompt)
        : await analyzeWithGemini(apiKey, model, prompt);

    if (!result.text.trim()) throw new Error("A IA não retornou texto analisável.");

    return NextResponse.json({
      ...result,
      provider,
      model,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado na análise.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
