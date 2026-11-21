// Collects question-to-Cypher answers from the home console's own Ask button, in a real Chrome, for
// scripts/text2cypher-score.ts to score. Serves dist/ (run `npm run build` first).
//
//   npm i --no-save playwright            (a development tool, not a dependency of the site)
//   node scripts/text2cypher-browser.ts [--out answers.json] [--profile DIR] [--mock]
//   node scripts/text2cypher-score.ts --answers answers.json
//
// The browser needs its on-device model: Chrome with the Prompt API (`LanguageModel`) and Gemini Nano
// downloaded. `--profile` keeps that profile between runs (the model downloads once); chrome://on-device-internals
// shows its state. `--mock` replaces the model with one that answers with the packaged query, which checks
// this script and the console's wiring, not a model. The page runs with ?holdout=1, so the question
// under test is never one of its own worked examples.

import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { parseArgs } from 'node:util';

import { SCENARIOS } from '../src/lib/home/console-scenarios.ts';

const { values } = parseArgs({ options: { out: { type: 'string', default: 'text2cypher-answers.json' }, profile: { type: 'string' }, mock: { type: 'boolean' } } });
const pw = await import('playwright').catch(() => {
  console.error('This needs Playwright: npm i --no-save playwright');
  process.exit(2);
});

const DIST = join(import.meta.dirname, '..', 'dist');
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
  if (path.endsWith('/')) path += 'index.html';
  try {
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(readFileSync(join(DIST, path)));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/?holdout=1`;

const launch = { channel: 'chrome', headless: false, args: ['--enable-features=PromptAPIForGeminiNano,OptimizationGuideOnDeviceModel:compatible_on_device_perf_class_threshold/Low'] };
const ctx = await pw.chromium.launchPersistentContext(values.profile ?? join(import.meta.dirname, '..', '.text2cypher-profile'), launch);
const page = ctx.pages()[0] ?? (await ctx.newPage());

if (values.mock) {
  // Answers with the packaged query of the question it is asked.
  const byAsk = Object.fromEntries(Object.values(SCENARIOS).flatMap((s) => s.demos.filter((d) => d.ask).map((d) => [d.ask!, d.query])));
  await page.addInitScript((answers) => {
    (window as unknown as { LanguageModel: unknown }).LanguageModel = {
      availability: async () => 'available',
      create: async () => {
        const session = { prompt: async (q: string) => answers[q] ?? '', clone: async () => session, destroy() {} };
        return session;
      },
    };
  }, byAsk);
}

await page.goto(url);
const answers: Record<string, string> = {};
const ready = () => page.waitForFunction(() => document.querySelector('#tc-status')?.getAttribute('data-state') === 'ready', undefined, { timeout: 120_000 });
await ready();
if (await page.locator('#tc-ask').isHidden()) {
  console.error('The Ask button is hidden: this Chrome has no usable on-device model (see chrome://on-device-internals).');
  await ctx.close();
  server.close();
  process.exit(3);
}

for (const [id, sc] of Object.entries(SCENARIOS)) {
  await page.selectOption('#tc-scenario', id);
  await ready();
  for (const d of sc.demos) {
    if (!d.ask) continue;
    await page.fill('#tc-input', d.ask);
    await page.click('#tc-ask');
    // The first question asks before the model downloads: agree.
    await page.locator('#tc-out button', { hasText: 'Download' }).click({ timeout: 1500 }).catch(() => {});
    // Done when the box holds a query and Ask is enabled again (the model may first download).
    await page.waitForFunction((q) => (document.querySelector('#tc-input') as HTMLInputElement).value !== q && !(document.querySelector('#tc-ask') as HTMLButtonElement).disabled, d.ask, { timeout: 300_000 });
    answers[`${id}/${d.ask}`] = await page.inputValue('#tc-input');
    console.log(`${id}: ${d.ask}\n  ${answers[`${id}/${d.ask}`].replace(/\s+/g, ' ').slice(0, 160)}`);
  }
}
writeFileSync(values.out!, `${JSON.stringify(answers, null, 2)}\n`);
console.log(`\nwrote ${values.out}`);
await ctx.close();
server.close();
