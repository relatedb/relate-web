// The console's "Ask": a question in words becomes a Cypher query, written by the browser's own
// on-device model (Chrome's Prompt API, `LanguageModel`). Nothing is sent anywhere: the model runs in
// the browser, and a browser without one shows no Ask button. The prompt is built by
// src/lib/home/text2cypher.ts; the page puts the query in the prompt box for the reader to check and run.

import type { Message } from '../../lib/home/text2cypher.ts';

interface Session {
  prompt(text: string, options?: { signal?: AbortSignal }): Promise<string>;
  clone(): Promise<Session>;
  destroy(): void;
}
interface LanguageModelApi {
  availability(options?: Record<string, unknown>): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>;
  create(options?: Record<string, unknown>): Promise<Session>;
}

const api = (): LanguageModelApi | null => (globalThis as unknown as { LanguageModel?: LanguageModelApi }).LanguageModel ?? null;

/** Whether this browser can run a model for Ask, and whether the first use downloads it. */
export async function askSupport(): Promise<'none' | 'download' | 'ready'> {
  const lm = api();
  if (!lm) return 'none';
  try {
    const a = await lm.availability({ expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] });
    return a === 'available' ? 'ready' : a === 'unavailable' ? 'none' : 'download';
  } catch {
    return 'none';
  }
}

/** One model session per prompt prefix (the rules, schema and examples), cloned for each question. */
const bases = new Map<string, Promise<Session>>();

/** Run a conversation: its last message is the question; the earlier ones are the model's starting context. */
export async function generate(messages: Message[], onProgress?: (text: string) => void): Promise<string> {
  const lm = api();
  if (!lm) throw new Error('This browser has no on-device model.');
  const question = messages[messages.length - 1];
  const prefix = messages.slice(0, -1);
  const key = JSON.stringify(prefix);
  let base = bases.get(key);
  if (!base) {
    base = lm.create({
      initialPrompts: prefix,
      temperature: 0.1,
      topK: 3,
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
      monitor: (m: EventTarget) =>
        m.addEventListener('downloadprogress', (e) => onProgress?.(`downloading the model… ${Math.round(((e as unknown as { loaded: number }).loaded ?? 0) * 100)}%`)),
    });
    bases.set(key, base);
    base.catch(() => bases.delete(key));
  }
  const session = await (await base).clone();
  try {
    return await session.prompt(question.content);
  } finally {
    session.destroy();
  }
}
