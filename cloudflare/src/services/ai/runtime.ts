import type { AiBinding, EnvBindings, VectorizeBinding, VectorizeMatchRecord } from '../../types/env';

const TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

type AiRuntimeProvider = 'cloudflare-workers-ai' | 'deterministic-fallback';

export type AiRuntimeStatus = {
  provider: AiRuntimeProvider;
  textGenerationAvailable: boolean;
  embeddingsAvailable: boolean;
  vectorizeAvailable: boolean;
  vectorCount: number;
  environmentHealthy: boolean;
  notices: string[];
};

type GenerateTextInput = {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
};

type VectorDocument = {
  id: string;
  text: string;
  metadata?: Record<string, string | number | boolean | null>;
};

type VectorMatch = {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
};

function getAiBinding(env: EnvBindings): AiBinding | null {
  return env.AI && typeof env.AI.run === 'function' ? env.AI : null;
}

function getVectorizeBinding(env: EnvBindings): VectorizeBinding | null {
  const index = env.EVIDENCE_VECTOR_INDEX;
  return index && typeof index.query === 'function' && typeof index.upsert === 'function' ? index : null;
}

function extractTextResponse(payload: unknown): string | null {
  if (typeof payload === 'string') {
    return payload.trim();
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.response === 'string') {
    return record.response.trim();
  }

  if (record.result && typeof record.result === 'object') {
    const nested = record.result as Record<string, unknown>;
    if (typeof nested.response === 'string') {
      return nested.response.trim();
    }
  }

  const choices = Array.isArray(record.choices) ? record.choices : [];
  const firstChoice = choices[0];
  if (firstChoice && typeof firstChoice === 'object') {
    const choice = firstChoice as Record<string, unknown>;
    if (typeof choice.text === 'string') {
      return choice.text.trim();
    }
    if (choice.message && typeof choice.message === 'object') {
      const message = choice.message as Record<string, unknown>;
      if (typeof message.content === 'string') {
        return message.content.trim();
      }
      if (Array.isArray(message.content)) {
        return message.content
          .map((part) => {
            if (!part || typeof part !== 'object') {
              return '';
            }
            const value = part as Record<string, unknown>;
            return typeof value.text === 'string' ? value.text : '';
          })
          .join(' ')
          .trim();
      }
    }
  }

  return null;
}

function extractJsonBlock<T>(text: string): T | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

function extractEmbedding(payload: unknown): number[] | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const candidates = [
    record.data,
    record.embedding,
    record.result && typeof record.result === 'object'
      ? (record.result as Record<string, unknown>).data
      : undefined,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      const first = candidate[0];
      if (Array.isArray(first)) {
        const values = first.map((value) => Number(value)).filter((value) => Number.isFinite(value));
        if (values.length > 0) {
          return values;
        }
      }

      const values = candidate.map((value) => Number(value)).filter((value) => Number.isFinite(value));
      if (values.length > 0) {
        return values;
      }
    }
  }

  return null;
}

function normalizeSimilarityScore(score: number) {
  if (!Number.isFinite(score)) {
    return 0;
  }

  if (score <= 1) {
    return Math.round(score * 100);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export async function getAiRuntimeStatus(env: EnvBindings): Promise<AiRuntimeStatus> {
  const ai = getAiBinding(env);
  const vectorIndex = getVectorizeBinding(env);
  const notices: string[] = [];
  let vectorCount = 0;
  let vectorizeAvailable = false;

  if (!ai) {
    notices.push('Workers AI binding is not provisioned.');
  }

  if (!vectorIndex) {
    notices.push('Vectorize binding is not provisioned.');
  } else {
    try {
      const description = await vectorIndex.describe();
      vectorCount = Number(description.vectorCount ?? description.vectorsCount ?? 0);
      vectorizeAvailable = true;
    } catch (error) {
      notices.push(
        `Vectorize describe failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  return {
    provider: ai ? 'cloudflare-workers-ai' : 'deterministic-fallback',
    textGenerationAvailable: !!ai,
    embeddingsAvailable: !!ai,
    vectorizeAvailable,
    vectorCount,
    environmentHealthy: !!ai,
    notices,
  };
}

export async function generateTextWithAi(
  env: EnvBindings,
  input: GenerateTextInput,
): Promise<string | null> {
  const ai = getAiBinding(env);
  if (!ai) {
    return null;
  }

  try {
    const response = await ai.run(TEXT_MODEL, {
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userPrompt },
      ],
      max_tokens: input.maxTokens ?? 420,
      temperature: input.temperature ?? 0.2,
    });

    return extractTextResponse(response);
  } catch (error) {
    console.warn('Workers AI text generation failed', error);
    return null;
  }
}

export async function generateJsonWithAi<T>(
  env: EnvBindings,
  input: GenerateTextInput,
): Promise<T | null> {
  const ai = getAiBinding(env);
  if (!ai) {
    return null;
  }

  try {
    const primaryResponse = await ai.run(TEXT_MODEL, {
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userPrompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: input.maxTokens ?? 420,
      temperature: input.temperature ?? 0.1,
    });

    const primaryText = extractTextResponse(primaryResponse);
    const primaryJson = primaryText ? extractJsonBlock<T>(primaryText) : null;
    if (primaryJson) {
      return primaryJson;
    }
  } catch (error) {
    console.warn('Workers AI JSON generation failed in structured mode', error);
  }

  try {
    const fallbackResponse = await ai.run(TEXT_MODEL, {
      messages: [
        { role: 'system', content: `${input.systemPrompt}\nReturn only a valid JSON object and do not wrap it in markdown.` },
        { role: 'user', content: input.userPrompt },
      ],
      max_tokens: input.maxTokens ?? 420,
      temperature: input.temperature ?? 0.1,
    });

    const fallbackText = extractTextResponse(fallbackResponse);
    return fallbackText ? extractJsonBlock<T>(fallbackText) : null;
  } catch (error) {
    console.warn('Workers AI JSON generation failed in fallback mode', error);
    return null;
  }
}

export async function embedTextWithAi(
  env: EnvBindings,
  text: string,
): Promise<number[] | null> {
  const ai = getAiBinding(env);
  if (!ai || !text.trim()) {
    return null;
  }

  try {
    const response = await ai.run(EMBEDDING_MODEL, {
      text,
      pooling: 'cls',
    });

    return extractEmbedding(response);
  } catch (error) {
    console.warn('Workers AI embedding generation failed', error);
    return null;
  }
}

export async function upsertVectorDocuments(
  env: EnvBindings,
  namespace: string,
  documents: VectorDocument[],
): Promise<boolean> {
  const vectorIndex = getVectorizeBinding(env);
  if (!vectorIndex || documents.length === 0) {
    return false;
  }

  const vectors = [];
  for (const document of documents) {
    const embedding = await embedTextWithAi(env, document.text);
    if (!embedding) {
      continue;
    }

    vectors.push({
      id: document.id,
      values: embedding,
      namespace,
      metadata: document.metadata,
    });
  }

  if (vectors.length === 0) {
    return false;
  }

  try {
    await vectorIndex.upsert(vectors);
    return true;
  } catch (error) {
    console.warn('Vectorize upsert failed', error);
    return false;
  }
}

export async function queryVectorDocuments(
  env: EnvBindings,
  namespace: string,
  query: string,
  topK = 6,
): Promise<VectorMatch[]> {
  const vectorIndex = getVectorizeBinding(env);
  if (!vectorIndex) {
    return [];
  }

  const embedding = await embedTextWithAi(env, query);
  if (!embedding) {
    return [];
  }

  try {
    const response = await vectorIndex.query(embedding, {
      namespace,
      topK,
      returnMetadata: 'all',
    });

    return response.matches.map((match: VectorizeMatchRecord) => ({
      id: match.id,
      score: normalizeSimilarityScore(match.score),
      metadata: match.metadata ?? {},
    }));
  } catch (error) {
    console.warn('Vectorize query failed', error);
    return [];
  }
}
