import type { EnvBindings } from '../../types/env';

export type AiBackendProvider = 'cloudflare-workers-ai' | 'openai-responses' | 'deterministic-fallback';

export type AiBackendSettings = {
  defaultProvider: AiBackendProvider extends infer _T ? 'cloudflare-workers-ai' | 'openai-responses' : never;
  openaiEnabled: boolean;
  openaiModel: string | null;
};

export type GenerateTextInput = {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
};

type AiBackendPrimitives = {
  provider: AiBackendProvider;
  generateText(input: GenerateTextInput): Promise<string | null>;
  generateJson<T>(input: GenerateTextInput): Promise<T | null>;
  embed(input: string): Promise<number[] | null>;
};

export type AiBackend = AiBackendPrimitives & {
  summarizeFindings(input: Record<string, unknown>): Promise<{ markdown: string; highlights: string[] } | null>;
  mapControls(input: Record<string, unknown>): Promise<{
    explanation: string;
    priorities: string[];
    clusters: Array<Record<string, unknown>>;
  } | null>;
  proposeRemediation(input: Record<string, unknown>): Promise<{
    summary: string;
    actions: string[];
    themes: string[];
    quickWins: string[];
  } | null>;
  generatePolicy(input: {
    framework: string;
    controlId: string;
    targetAudience: string;
    requirements: string[];
  }): Promise<{ title: string; policyMarkdown: string } | null>;
  reviewChange(input: {
    title: string;
    before: string;
    after: string;
    frameworkContexts: string[];
  }): Promise<{ summary: string; risks: string[]; recommendations: string[] } | null>;
};

type ProviderSettingsRow = {
  default_provider: string;
  openai_enabled: number;
  openai_model: string | null;
};

const CLOUDFLARE_TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const CLOUDFLARE_EMBED_MODEL = '@cf/baai/bge-base-en-v1.5';
const OPENAI_TEXT_MODEL = 'gpt-5.5';
const OPENAI_EMBED_MODEL = 'text-embedding-3-small';

function extractTextResponse(payload: unknown): string | null {
  if (typeof payload === 'string') {
    return payload.trim();
  }
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === 'string' && record.output_text.trim()) {
    return record.output_text.trim();
  }
  if (typeof record.response === 'string' && record.response.trim()) {
    return record.response.trim();
  }

  const choices = Array.isArray(record.choices) ? record.choices : [];
  const firstChoice = choices[0];
  if (firstChoice && typeof firstChoice === 'object') {
    const choice = firstChoice as Record<string, unknown>;
    if (typeof choice.text === 'string' && choice.text.trim()) {
      return choice.text.trim();
    }
    if (choice.message && typeof choice.message === 'object') {
      const message = choice.message as Record<string, unknown>;
      if (typeof message.content === 'string' && message.content.trim()) {
        return message.content.trim();
      }
    }
  }

  const output = Array.isArray(record.output) ? record.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const entry = item as Record<string, unknown>;
    const content = Array.isArray(entry.content) ? entry.content : [];
    for (const part of content) {
      if (!part || typeof part !== 'object') {
        continue;
      }
      const partRecord = part as Record<string, unknown>;
      if (typeof partRecord.text === 'string' && partRecord.text.trim()) {
        return partRecord.text.trim();
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
  const data = Array.isArray(record.data) ? record.data : [];
  const first = data[0];
  if (first && typeof first === 'object') {
    const embedding = (first as Record<string, unknown>).embedding;
    if (Array.isArray(embedding)) {
      const values = embedding.map((value) => Number(value)).filter((value) => Number.isFinite(value));
      if (values.length > 0) {
        return values;
      }
    }
  }

  if (Array.isArray(record.embedding)) {
    const values = record.embedding.map((value) => Number(value)).filter((value) => Number.isFinite(value));
    return values.length > 0 ? values : null;
  }

  return null;
}

export async function loadAiBackendSettings(
  env: EnvBindings,
  tenantId: string,
): Promise<AiBackendSettings> {
  const row = await env.D1_MAIN.prepare(
    `
    SELECT default_provider, openai_enabled, openai_model
    FROM grc_ai_provider_settings
    WHERE tenant_id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<ProviderSettingsRow>();

  return {
    defaultProvider: row?.default_provider === 'openai-responses' ? 'openai-responses' : 'cloudflare-workers-ai',
    openaiEnabled: Boolean(row?.openai_enabled),
    openaiModel: row?.openai_model ?? null,
  };
}

export async function saveAiBackendSettings(
  env: EnvBindings,
  tenantId: string,
  userId: string,
  settings: AiBackendSettings,
): Promise<AiBackendSettings> {
  const now = new Date().toISOString();
  await env.D1_MAIN.prepare(
    `
    INSERT INTO grc_ai_provider_settings (
      tenant_id,
      default_provider,
      openai_enabled,
      openai_model,
      updated_by_user_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id) DO UPDATE SET
      default_provider = excluded.default_provider,
      openai_enabled = excluded.openai_enabled,
      openai_model = excluded.openai_model,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = excluded.updated_at
    `,
  )
    .bind(
      tenantId,
      settings.defaultProvider,
      settings.openaiEnabled ? 1 : 0,
      settings.openaiModel,
      userId,
      now,
      now,
    )
    .run();

  return settings;
}

async function generateTextWithCloudflare(
  env: EnvBindings,
  input: GenerateTextInput,
): Promise<string | null> {
  if (!env.AI) {
    return null;
  }
  try {
    const payload = await env.AI.run(CLOUDFLARE_TEXT_MODEL, {
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userPrompt },
      ],
      max_tokens: input.maxTokens ?? 700,
      temperature: input.temperature ?? 0.2,
    });
    return extractTextResponse(payload);
  } catch (error) {
    console.warn('Cloudflare AI text generation failed', error);
    return null;
  }
}

async function embedWithCloudflare(
  env: EnvBindings,
  input: string,
): Promise<number[] | null> {
  if (!env.AI || !input.trim()) {
    return null;
  }

  try {
    const payload = await env.AI.run(CLOUDFLARE_EMBED_MODEL, {
      text: input,
      pooling: 'cls',
    });
    return extractEmbedding(payload);
  } catch (error) {
    console.warn('Cloudflare AI embedding failed', error);
    return null;
  }
}

async function generateTextWithOpenAi(
  env: EnvBindings,
  input: GenerateTextInput,
  model: string,
): Promise<string | null> {
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  const baseUrl = (env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  try {
    const response = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'system',
            content: input.systemPrompt,
          },
          {
            role: 'user',
            content: input.userPrompt,
          },
        ],
        max_output_tokens: input.maxTokens ?? 700,
      }),
    });

    if (!response.ok) {
      console.warn('OpenAI Responses request failed', response.status, await response.text());
      return null;
    }

    return extractTextResponse(await response.json());
  } catch (error) {
    console.warn('OpenAI Responses request failed', error);
    return null;
  }
}

async function embedWithOpenAi(
  env: EnvBindings,
  input: string,
): Promise<number[] | null> {
  if (!env.OPENAI_API_KEY || !input.trim()) {
    return null;
  }

  const baseUrl = (env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  try {
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_EMBED_MODEL,
        input,
        encoding_format: 'float',
      }),
    });

    if (!response.ok) {
      console.warn('OpenAI embeddings request failed', response.status, await response.text());
      return null;
    }

    return extractEmbedding(await response.json());
  } catch (error) {
    console.warn('OpenAI embeddings request failed', error);
    return null;
  }
}

function buildFallbackBackend(): AiBackend {
  return {
    provider: 'deterministic-fallback',
    async generateText() {
      return null;
    },
    async generateJson() {
      return null;
    },
    async embed() {
      return null;
    },
    async summarizeFindings() {
      return null;
    },
    async mapControls() {
      return null;
    },
    async proposeRemediation() {
      return null;
    },
    async generatePolicy() {
      return null;
    },
    async reviewChange() {
      return null;
    },
  };
}

function attachHigherOrderMethods(backend: AiBackendPrimitives): AiBackend {
  return {
    ...backend,
    async summarizeFindings(input) {
      return backend.generateJson<{
        markdown: string;
        highlights: string[];
      }>({
        systemPrompt:
          'You summarize normalized GRC findings for leadership. Return concise JSON with markdown and highlights.',
        userPrompt: JSON.stringify(input),
        maxTokens: 900,
      });
    },
    async mapControls(input) {
      return backend.generateJson<{
        explanation: string;
        priorities: string[];
        clusters: Array<Record<string, unknown>>;
      }>({
        systemPrompt:
          'You explain how controls map across frameworks. Return concise JSON with explanation, priorities, and clusters.',
        userPrompt: JSON.stringify(input),
        maxTokens: 700,
      });
    },
    async proposeRemediation(input) {
      return backend.generateJson<{
        summary: string;
        actions: string[];
        themes: string[];
        quickWins: string[];
      }>({
        systemPrompt:
          'You propose remediation steps for GRC findings. Return concise JSON with summary, actions, themes, and quickWins.',
        userPrompt: JSON.stringify(input),
        maxTokens: 700,
      });
    },
    async generatePolicy(input) {
      return backend.generateJson<{
        title: string;
        policyMarkdown: string;
      }>({
        systemPrompt:
          'You draft policy-ready markdown from framework requirements. Return JSON with title and policyMarkdown.',
        userPrompt: JSON.stringify(input),
        maxTokens: 1200,
      });
    },
    async reviewChange(input) {
      return backend.generateJson<{
        summary: string;
        risks: string[];
        recommendations: string[];
      }>({
        systemPrompt:
          'You review changes for GRC impact. Return JSON with summary, risks, and recommendations.',
        userPrompt: JSON.stringify(input),
        maxTokens: 900,
      });
    },
  };
}

export async function resolveAiBackend(env: EnvBindings, tenantId: string): Promise<AiBackend> {
  const settings = await loadAiBackendSettings(env, tenantId);
  const wantsOpenAi =
    settings.defaultProvider === 'openai-responses' && settings.openaiEnabled && Boolean(env.OPENAI_API_KEY);

  if (wantsOpenAi) {
    const model = settings.openaiModel?.trim() || OPENAI_TEXT_MODEL;
    return attachHigherOrderMethods({
      provider: 'openai-responses',
      async generateText(input) {
        return generateTextWithOpenAi(env, input, model);
      },
      async generateJson(input) {
        const text = await generateTextWithOpenAi(env, {
          ...input,
          systemPrompt: `${input.systemPrompt}\nReturn only a valid JSON object and do not wrap it in markdown.`,
        }, model);
        return text ? extractJsonBlock(text) : null;
      },
      async embed(input) {
        return embedWithOpenAi(env, input);
      },
    });
  }

  if (env.AI) {
    return attachHigherOrderMethods({
      provider: 'cloudflare-workers-ai',
      async generateText(input) {
        return generateTextWithCloudflare(env, input);
      },
      async generateJson(input) {
        const text = await generateTextWithCloudflare(env, {
          ...input,
          systemPrompt: `${input.systemPrompt}\nReturn only a valid JSON object and do not wrap it in markdown.`,
        });
        return text ? extractJsonBlock(text) : null;
      },
      async embed(input) {
        return embedWithCloudflare(env, input);
      },
    });
  }

  return attachHigherOrderMethods(buildFallbackBackend());
}
