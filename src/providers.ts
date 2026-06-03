import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export type ProviderType = 'claude' | 'openai' | 'ollama' | 'custom';

export interface ProviderConfig {
  type: ProviderType;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export interface AIProvider {
  generate(prompt: string, system?: string): Promise<string>;
  stream(prompt: string, system: string, onChunk: (text: string) => void): Promise<void>;
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 3, baseDelayMs = 1500, timeoutMs = 120_000 }: { retries?: number; baseDelayMs?: number; timeoutMs?: number } = {}
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${timeoutMs / 1000}s`)), timeoutMs)
        ),
      ]);
      return result;
    } catch (err: unknown) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      const isRetryable = !status || RETRYABLE_STATUS.has(status);
      const isTimeout = err instanceof Error && err.message.startsWith('Timeout');

      if (attempt < retries && (isRetryable || isTimeout)) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
        process.stderr.write(`\n  ⟳ Tentative ${attempt + 2}/${retries + 1} dans ${Math.round(delay / 1000)}s...\n`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// ─── Claude ───────────────────────────────────────────────────────────────────

class ClaudeProvider implements AIProvider {
  private client: Anthropic;
  private model: string;

  constructor(cfg: ProviderConfig) {
    this.client = new Anthropic({ apiKey: cfg.apiKey });
    this.model = cfg.model ?? 'claude-sonnet-4-6';
  }

  async generate(prompt: string, system = ''): Promise<string> {
    const msg = await withRetry(() =>
      this.client.messages.create({
        model: this.model,
        max_tokens: 8192,
        ...(system ? { system } : {}),
        messages: [{ role: 'user', content: prompt }],
      })
    );
    return (msg.content[0] as { text: string }).text;
  }

  async stream(prompt: string, system: string, onChunk: (text: string) => void): Promise<void> {
    await withRetry(async () => {
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: 8192,
        ...(system ? { system } : {}),
        messages: [{ role: 'user', content: prompt }],
      });
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          onChunk(event.delta.text);
        }
      }
    }, { timeoutMs: 180_000 });
  }
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(cfg: ProviderConfig) {
    this.client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseUrl });
    this.model = cfg.model ?? 'gpt-4o';
  }

  async generate(prompt: string, system = ''): Promise<string> {
    const messages: OpenAI.ChatCompletionMessageParam[] = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const res = await withRetry(() =>
      this.client.chat.completions.create({ model: this.model, messages })
    );
    return res.choices[0]?.message?.content ?? '';
  }

  async stream(prompt: string, system: string, onChunk: (text: string) => void): Promise<void> {
    const messages: OpenAI.ChatCompletionMessageParam[] = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    await withRetry(async () => {
      const stream = await this.client.chat.completions.create({ model: this.model, messages, stream: true });
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? '';
        if (text) onChunk(text);
      }
    }, { timeoutMs: 180_000 });
  }
}

// ─── Ollama ───────────────────────────────────────────────────────────────────

class OllamaProvider implements AIProvider {
  private baseUrl: string;
  private model: string;

  constructor(cfg: ProviderConfig) {
    this.baseUrl = (cfg.baseUrl ?? 'http://localhost:11434').replace(/\/$/, '');
    this.model = cfg.model ?? 'llama3';
  }

  async generate(prompt: string, system = ''): Promise<string> {
    const res = await withRetry(() =>
      fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            { role: 'user', content: prompt },
          ],
        }),
      }).then(r => r.json())
    );
    return (res as { message?: { content?: string } }).message?.content ?? '';
  }

  async stream(prompt: string, system: string, onChunk: (text: string) => void): Promise<void> {
    await withRetry(async () => {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          stream: true,
          messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            { role: 'user', content: prompt },
          ],
        }),
      });
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split('\n').filter(Boolean)) {
          try {
            const json = JSON.parse(line) as { message?: { content?: string } };
            if (json.message?.content) onChunk(json.message.content);
          } catch { /* ignore */ }
        }
      }
    }, { timeoutMs: 180_000 });
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createProvider(cfg: ProviderConfig): AIProvider {
  switch (cfg.type) {
    case 'claude':  return new ClaudeProvider(cfg);
    case 'openai':  return new OpenAIProvider(cfg);
    case 'ollama':  return new OllamaProvider(cfg);
    case 'custom':  return new OpenAIProvider(cfg);
  }
}

export const PROVIDER_MODELS: Record<ProviderType, string[]> = {
  claude:  ['claude-sonnet-4-6', 'claude-opus-4-7', 'claude-haiku-4-5-20251001'],
  openai:  ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  ollama:  ['llama3', 'mistral', 'codellama', 'phi3', 'gemma2'],
  custom:  [],
};
