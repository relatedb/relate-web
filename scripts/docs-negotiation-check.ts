#!/usr/bin/env node
// Checks the content negotiation (the Cloudflare Pages Functions in
// functions/: docs/_middleware.ts for the docs, ADR-0005, ADR-0012; index.ts
// and cookbook/_middleware.ts for the home page and the cookbook, ADR-0069)
// against a built site. Runs on Node directly, like scripts/docs.ts.
//
//   node scripts/docs-negotiation-check.ts [--dist <dir>]   (npm run docs:negotiation-check)
//
// Starts `wrangler pages dev <dist>` (workerd, local only, no login) on a
// free port, from a scratch directory that links back to functions/, so
// wrangler's state never lands in the repo; then, for the landing page,
// get-started/install and reference/errors:
//   - Accept: text/markdown (and markdown ranked above HTML by q) returns the
//     twin byte for byte, with Content-Type text/markdown; charset=utf-8,
//     Vary: Accept, Cache-Control: private and x-markdown-tokens;
//   - HEAD returns the same headers and no body;
//   - ?section=<anchor> returns that section, byte for byte what
//     src/lib/docs/negotiation.ts slices from the twin, with the frontmatter,
//     at most five terms and the full-page trailer; other query parameters
//     change nothing;
//   - a browser's Accept, with or without ?section=, gets the HTML file byte
//     for byte, and the .md twin URL is served untouched;
// plus an unknown anchor (404, text/plain, the anchors listed), URLs that
// are not pages (a missing page, files at a twin's path that are not that
// page's twin, percent-encoded traversal) never answered with markdown, the
// skill and llms.txt files and the largest data block a twin links
// (/docs/<page>/data/<name>.json, application/json) served untouched through the agent-path log
// (functions/_middleware.ts), and a page with no markdown form (/blog/). The
// home page, the cookbook index and the first recipe get the same cases as a
// docs page, less ?section=: markdown to a markdown Accept (the bytes of
// /index.md, /cookbook/llms.txt and /cookbook/<slug>/index.md, with the
// canonical Link), the HTML to a browser, the file URLs untouched, and no
// markdown on a cookbook path that is not a page. The home page's Link
// headers (public/_headers, ADR-0068) are checked too: GET and HEAD on /
// carry exactly the values the built _headers file gives it, on the HTML
// file byte for byte, and a page beside it carries none. Without the server
// it also checks that every heading and glossary entry id on every built
// docs page resolves as a ?section= anchor (the layout's "Related" list and
// the landing page, whose twin is a different document, are reported, not
// failed), that every Link target is a file the build serves, one of
// them the file the home page's own <link rel="describedby"> names, and that
// the home page's twin is the page's markdown form: the page's H2 and H3
// headings in order, every paragraph the twin takes from the page on the
// page, every site URL it gives a built file (src/lib/home/twin.ts).
//
// wrangler is fetched by npx at the pinned WRANGLER version (override with
// WRANGLER_VERSION), the version deploy-cf.yml deploys with, so the function
// deployed is compiled by the wrangler that checked it; nothing is installed
// in the repo. Prints "skipped" and exits 0 when <dist>/docs is missing. Exits 1 on any mismatch.

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';

import { estimateTokens, sectionAnchors, SITE_ORIGIN, sliceSection, TERMS_HEADING } from '../src/lib/docs/negotiation.ts';
import { homeClaims } from '../src/lib/home/twin.ts';

const ROOT = resolve(import.meta.dirname, '..');
const WRANGLER = `wrangler@${process.env.WRANGLER_VERSION ?? '4.158.0'}`;
const COMPATIBILITY_DATE = '2026-10-01';
const READY_TIMEOUT_MS = 180_000;

const { values: args } = parseArgs({ options: { dist: { type: 'string', default: join(ROOT, 'dist') } } });
const DIST = resolve(args.dist!);

const MARKDOWN = 'text/markdown';
const RANKED = 'text/html;q=0.9, text/markdown';
const BROWSER = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
const MD_TYPE = 'text/markdown; charset=utf-8';

/** The pages the server cases run on, and the section each one is cut to. */
const PAGES: { id: string; section: string | null }[] = [
  { id: '', section: null }, // the landing: its first anchor
  { id: 'get-started/install', section: 'verify' },
  { id: 'reference/errors', section: 'cli-errors' },
];
/**
 * Heading ids the layout adds that the twin has no section for: `related` (frontmatter in the twin)
 * and `fb-title` (the Got feedback? dialog's heading, src/components/Feedback.astro).
 */
const LAYOUT_IDS = new Set(['related', 'fb-title']);
/** Pages whose twin is a different document from the HTML (src/lib/docs/landing.ts). */
const OWN_TWIN = new Set(['']);

let failures = 0;
function ok(name: string): void {
  console.log(`  ok    ${name}`);
}
function bad(name: string, why: string): void {
  failures++;
  console.log(`  FAIL  ${name}: ${why}`);
}
function expect(name: string, problems: string[]): void {
  if (problems.length) bad(name, problems.join('; '));
  else ok(name);
}

const twinFile = (id: string) => join(DIST, 'docs', id ? `${id}.md` : 'index.md');
const htmlFile = (id: string) => join(DIST, 'docs', id, 'index.html');
const pageUrl = (id: string) => (id ? `/docs/${id}/` : '/docs/');

function sameBytes(a: Uint8Array, b: Uint8Array): string | null {
  if (a.byteLength !== b.byteLength) return `${a.byteLength} bytes, expected ${b.byteLength}`;
  for (let i = 0; i < a.byteLength; i++) if (a[i] !== b[i]) return `bytes differ at offset ${i}`;
  return null;
}

function headerProblems(res: Response, body: string, status = 200): string[] {
  const p: string[] = [];
  if (res.status !== status) p.push(`status ${res.status}`);
  const want: Record<string, string> = { 'content-type': MD_TYPE, vary: 'Accept', 'cache-control': 'private', 'x-markdown-tokens': String(estimateTokens(body)) };
  for (const [k, v] of Object.entries(want)) if (res.headers.get(k) !== v) p.push(`${k}: ${JSON.stringify(res.headers.get(k))}, expected ${JSON.stringify(v)}`);
  return p;
}

function freePort(): Promise<number> {
  return new Promise((done, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => done(port));
    });
  });
}

function stop(child: ChildProcess | null): void {
  if (!child || child.exitCode !== null || child.pid === undefined) return;
  try {
    process.kill(-child.pid, 'SIGTERM'); // npx, wrangler and workerd share the group
  } catch {
    child.kill('SIGTERM');
  }
}

async function startServer(port: number, scratch: string): Promise<{ child: ChildProcess; base: string; log: () => string }> {
  const cwd = join(scratch, 'cwd');
  // wrangler compiles <cwd>/functions and writes .wrangler/ in <cwd>: link functions/ into a scratch cwd.
  mkdirSync(cwd);
  symlinkSync(join(ROOT, 'functions'), join(cwd, 'functions'), 'dir');
  const argv = ['--yes', WRANGLER, 'pages', 'dev', DIST, '--ip', '127.0.0.1', '--port', String(port), '--compatibility-date', COMPATIBILITY_DATE, '--persist-to', join(scratch, 'state'), '--show-interactive-dev-session=false', '--log-level', 'warn'];
  let out = '';
  const child = spawn('npx', argv, {
    cwd,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, DO_NOT_TRACK: '1', WRANGLER_SEND_METRICS: 'false', CI: process.env.CI ?? '1' },
  });
  child.stdout!.on('data', (d) => (out += d));
  child.stderr!.on('data', (d) => (out += d));
  const base = `http://127.0.0.1:${port}`;
  const started = Date.now();
  while (Date.now() - started < READY_TIMEOUT_MS) {
    if (child.exitCode !== null) throw new Error(`wrangler exited with ${child.exitCode}:\n${out}`);
    try {
      const res = await fetch(`${base}/robots.txt`);
      await res.arrayBuffer();
      return { child, base, log: () => out };
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  stop(child);
  throw new Error(`wrangler did not answer within ${READY_TIMEOUT_MS / 1000}s:\n${out}`);
}

async function get(base: string, path: string, accept: string, method = 'GET'): Promise<{ res: Response; bytes: Uint8Array }> {
  const res = await fetch(`${base}${path}`, { method, headers: { accept }, redirect: 'manual' });
  return { res, bytes: new Uint8Array(await res.arrayBuffer()) };
}

async function serverCases(base: string): Promise<void> {
  const dec = new TextDecoder();
  for (const { id, section } of PAGES) {
    const label = id || '(landing)';
    console.log(`${label}`);
    const twinBytes = new Uint8Array(readFileSync(twinFile(id)));
    const twin = dec.decode(twinBytes);
    const html = readFileSync(htmlFile(id), 'utf8');
    const htmlBytes = new Uint8Array(readFileSync(htmlFile(id)));
    const url = pageUrl(id);

    for (const [name, accept] of [['Accept: text/markdown', MARKDOWN], [`Accept: ${RANKED}`, RANKED]] as const) {
      const { res, bytes } = await get(base, url, accept);
      const p = headerProblems(res, twin);
      const diff = sameBytes(bytes, twinBytes);
      if (diff) p.push(`body ${diff}`);
      expect(`GET ${url} with ${name} is the twin`, p);
    }

    {
      const { res, bytes } = await get(base, url, MARKDOWN, 'HEAD');
      const p = headerProblems(res, twin);
      if (bytes.byteLength) p.push(`HEAD returned ${bytes.byteLength} body bytes`);
      if (res.headers.get('content-length') !== String(twinBytes.byteLength)) p.push(`content-length ${res.headers.get('content-length')}, expected ${twinBytes.byteLength}`);
      expect(`HEAD ${url} with Accept: text/markdown`, p);
    }

    const anchor = section ?? sectionAnchors(twin, html)[0];
    const canonical = /^canonical_url:\s*(\S+)$/m.exec(twin)?.[1] ?? '';
    const twinUrl = `${new URL(canonical).origin}/docs/${id ? `${id}.md` : 'index.md'}`;
    const want = sliceSection(twin, anchor, { html, twinUrl });
    if (!want.ok) {
      bad(`?section=${anchor} on ${url}`, `the twin has no such anchor (${want.anchors.join(', ')})`);
    } else {
      for (const path of [`${url}?section=${encodeURIComponent(anchor)}`, `${url}?utm_source=x&section=${encodeURIComponent(anchor)}&expand=1`]) {
        const { res, bytes } = await get(base, path, MARKDOWN);
        const body = dec.decode(bytes);
        const p = headerProblems(res, body);
        const diff = sameBytes(bytes, new TextEncoder().encode(want.markdown));
        if (diff) p.push(`body ${diff} (against sliceSection)`);
        const front = /^---\n[\s\S]*?\n---\n/.exec(twin)?.[0] ?? '';
        if (!body.startsWith(front)) p.push('frontmatter not kept');
        if (!body.endsWith(`Full page: ${canonical} (markdown: ${twinUrl})\n`)) p.push('no full-page trailer');
        const terms = body.split(`\n## ${TERMS_HEADING}\n`)[1];
        if (terms && terms.split('\n').filter((l) => l.startsWith('- **')).length > 5) p.push('more than five terms');
        if (body.length >= twin.length) p.push('the section is not shorter than the page');
        expect(`GET ${path} with Accept: text/markdown is one section`, p);
      }
    }

    {
      const { res, bytes } = await get(base, url, BROWSER);
      const p: string[] = [];
      if (res.status !== 200) p.push(`status ${res.status}`);
      if (!res.headers.get('content-type')?.startsWith('text/html')) p.push(`content-type ${res.headers.get('content-type')}`);
      if (res.headers.has('x-markdown-tokens')) p.push('x-markdown-tokens on the HTML');
      if (!/(^|,)\s*accept\s*(,|$)/i.test(res.headers.get('vary') ?? '')) p.push(`vary ${JSON.stringify(res.headers.get('vary'))}, expected Accept`);
      const diff = sameBytes(bytes, htmlBytes);
      if (diff) p.push(`body ${diff}`);
      expect(`GET ${url} with a browser's Accept passes through to the HTML, with Vary: Accept`, p);
    }

    {
      const mdPath = id ? `/docs/${id}.md` : '/docs/index.md';
      const { res, bytes } = await get(base, mdPath, MARKDOWN);
      const p: string[] = [];
      if (res.status !== 200) p.push(`status ${res.status}`);
      if (res.headers.has('x-markdown-tokens')) p.push('the Function answered the .md URL');
      const diff = sameBytes(bytes, twinBytes);
      if (diff) p.push(`body ${diff}`);
      expect(`GET ${mdPath} is the static twin, untouched`, p);
    }
  }

  console.log('other cases');
  {
    const path = '/docs/reference/errors/?section=no-such-anchor';
    const { res, bytes } = await get(base, path, MARKDOWN);
    const body = dec.decode(bytes);
    const p: string[] = [];
    if (res.status !== 404) p.push(`status ${res.status}`);
    if (res.headers.get('content-type') !== 'text/plain; charset=utf-8') p.push(`content-type ${res.headers.get('content-type')}`);
    const anchors = sectionAnchors(readFileSync(twinFile('reference/errors'), 'utf8'), readFileSync(htmlFile('reference/errors'), 'utf8'));
    if (!body.includes(`Sections: ${anchors.join(', ')}\n`)) p.push(`body does not list the anchors: ${JSON.stringify(body)}`);
    expect(`GET ${path} with Accept: text/markdown is 404 listing the anchors`, p);
  }
  {
    const path = '/docs/reference/errors/?section=no-such-anchor';
    const { res, bytes } = await get(base, path, BROWSER);
    const p: string[] = [];
    if (res.status !== 200) p.push(`status ${res.status}`);
    const diff = sameBytes(bytes, new Uint8Array(readFileSync(htmlFile('reference/errors'))));
    if (diff) p.push(`body ${diff}`);
    expect(`GET ${path} with a browser's Accept passes through to the HTML`, p);
  }
  // Not pages: a missing page; files at a twin's path that are not that page's
  // twin (feedback.md, the changelog copy, the /index.md copy); and percent-encoded
  // traversal, which the asset server would decode into a path outside /docs.
  for (const path of ['/docs/no-such-page/', '/docs/feedback/', '/docs/changelog/', '/docs/get-started/install/index/', '/docs/%2E%2E%2Fskill/', '/docs/%2E%2E%2Fskills%2Frelate%2FSKILL/', '/docs/reference%2Ferrors/', '/docs/..%2Fx/']) {
    const { res } = await get(base, path, MARKDOWN);
    const p: string[] = [];
    if (res.status === 200 && !res.headers.get('content-type')?.startsWith('text/html')) p.push(`status 200, content-type ${res.headers.get('content-type')}`);
    if (res.headers.get('content-type')?.startsWith(MARKDOWN)) p.push('answered with markdown');
    if (res.headers.has('x-markdown-tokens')) p.push('the Function answered it');
    expect(`GET ${path} with Accept: text/markdown is not a markdown answer`, p);
  }
  {
    // The agent-path log (functions/_middleware.ts) leaves the static files untouched.
    for (const [path, file] of [['/skill.md', 'skill.md'], ['/skills/relate/SKILL.md', 'skills/relate/SKILL.md'], ['/llms.txt', 'llms.txt'], ['/docs/llms.txt', 'docs/llms.txt']] as const) {
      const { res, bytes } = await get(base, path, '*/*');
      const p: string[] = [];
      if (res.status !== 200) p.push(`status ${res.status}`);
      const diff = sameBytes(bytes, new Uint8Array(readFileSync(join(DIST, file))));
      if (diff) p.push(`body ${diff}`);
      expect(`GET ${path} is the static file, untouched`, p);
    }
  }
  {
    // A data block a twin links (ADR-0049): the static JSON file, byte for byte, whatever the Accept.
    const blocks = walkFiles(join(DIST, 'docs')).filter((f) => /\/data\/[A-Za-z0-9_-]+\.json$/.test(f));
    const file = blocks.sort((a, b) => statSync(b).size - statSync(a).size)[0];
    if (!file) expect('a docs data block is built', ['no file at /docs/<page>/data/<name>.json in dist/']);
    else {
      const path = `/${relative(DIST, file).split(sep).join('/')}`;
      for (const accept of [MARKDOWN, '*/*']) {
        const { res, bytes } = await get(base, path, accept);
        const p: string[] = [];
        if (res.status !== 200) p.push(`status ${res.status}`);
        if (!res.headers.get('content-type')?.startsWith('application/json')) p.push(`content-type ${res.headers.get('content-type')}`);
        if (res.headers.has('x-markdown-tokens')) p.push('the Function answered it');
        const diff = sameBytes(bytes, new Uint8Array(readFileSync(file)));
        if (diff) p.push(`body ${diff}`);
        expect(`GET ${path} with Accept: ${accept} is the static JSON file, untouched`, p);
      }
    }
  }
  {
    // A page with no markdown form: no function runs on it.
    const { res, bytes } = await get(base, '/blog/', MARKDOWN);
    const p: string[] = [];
    if (res.status !== 200) p.push(`status ${res.status}`);
    if (res.headers.has('x-markdown-tokens')) p.push('a Function answered a page with no markdown form');
    const diff = sameBytes(bytes, new Uint8Array(readFileSync(join(DIST, 'blog/index.html'))));
    if (diff) p.push(`body ${diff}`);
    if (res.headers.has('link')) p.push(`a Link header outside the home page: ${res.headers.get('link')}`);
    expect('GET /blog/ with Accept: text/markdown is untouched', p);
  }

  // The home page and the cookbook (ADR-0069): the page's markdown file to a markdown Accept, the HTML to a browser.
  const slug = recipeSlugs()[0];
  const sitePages: { url: string; twin: string; html: string }[] = [
    { url: '/', twin: 'index.md', html: 'index.html' },
    { url: '/cookbook/', twin: 'cookbook/llms.txt', html: 'cookbook/index.html' },
  ];
  if (slug) sitePages.push({ url: `/cookbook/${slug}/`, twin: `cookbook/${slug}/index.md`, html: `cookbook/${slug}/index.html` });
  else bad('a recipe is built', 'no /cookbook/<slug>/index.md in dist/');
  for (const { url, twin, html } of sitePages) {
    console.log(url);
    if (!existsSync(join(DIST, twin))) {
      bad(`${url} has a markdown file`, `no ${twin} in ${DIST}`);
      continue;
    }
    const twinBytes = new Uint8Array(readFileSync(join(DIST, twin)));
    const twinText = dec.decode(twinBytes);
    const htmlBytes = new Uint8Array(readFileSync(join(DIST, html)));
    const canonical = `<${SITE_ORIGIN}${url}>; rel="canonical"`;
    for (const [name, accept] of [['Accept: text/markdown', MARKDOWN], [`Accept: ${RANKED}`, RANKED]] as const) {
      const { res, bytes } = await get(base, url, accept);
      const p = headerProblems(res, twinText);
      if (res.headers.get('link') !== canonical) p.push(`link ${JSON.stringify(res.headers.get('link'))}, expected ${JSON.stringify(canonical)}`);
      const diff = sameBytes(bytes, twinBytes);
      if (diff) p.push(`body ${diff}`);
      expect(`GET ${url} with ${name} is /${twin}`, p);
    }
    {
      const { res, bytes } = await get(base, url, MARKDOWN, 'HEAD');
      const p = headerProblems(res, twinText);
      if (bytes.byteLength) p.push(`HEAD returned ${bytes.byteLength} body bytes`);
      if (res.headers.get('content-length') !== String(twinBytes.byteLength)) p.push(`content-length ${res.headers.get('content-length')}, expected ${twinBytes.byteLength}`);
      expect(`HEAD ${url} with Accept: text/markdown`, p);
    }
    for (const [name, accept] of [["a browser's Accept", BROWSER], ['Accept: */*', '*/*'], ['no Accept', '']] as const) {
      const { res, bytes } = await get(base, url, accept);
      const p: string[] = [];
      if (res.status !== 200) p.push(`status ${res.status}`);
      if (!res.headers.get('content-type')?.startsWith('text/html')) p.push(`content-type ${res.headers.get('content-type')}`);
      if (res.headers.has('x-markdown-tokens')) p.push('x-markdown-tokens on the HTML');
      if (!/(^|,)\s*accept\s*(,|$)/i.test(res.headers.get('vary') ?? '')) p.push(`vary ${JSON.stringify(res.headers.get('vary'))}, expected Accept`);
      const diff = sameBytes(bytes, htmlBytes);
      if (diff) p.push(`body ${diff}`);
      expect(`GET ${url} with ${name} is the HTML, with Vary: Accept`, p);
    }
    {
      const { res, bytes } = await get(base, `/${twin}`, MARKDOWN);
      const p: string[] = [];
      if (res.status !== 200) p.push(`status ${res.status}`);
      if (res.headers.has('x-markdown-tokens')) p.push('the Function answered the file URL');
      const diff = sameBytes(bytes, twinBytes);
      if (diff) p.push(`body ${diff}`);
      expect(`GET /${twin} is the static file, untouched`, p);
    }
  }
  // Not pages: a recipe that does not exist, percent-encoded traversal, and the files beside a recipe.
  for (const path of ['/cookbook/no-such-recipe/', '/cookbook/%2E%2E%2Fskill/', '/cookbook/..%2Fdocs/', ...(slug ? [`/cookbook/${slug}/results.json`, `/cookbook/${slug}/recipe.json`] : [])]) {
    const { res } = await get(base, path, MARKDOWN);
    const p: string[] = [];
    if (res.headers.get('content-type')?.startsWith(MARKDOWN)) p.push('answered with markdown');
    if (res.headers.has('x-markdown-tokens')) p.push('the Function answered it');
    expect(`GET ${path} with Accept: text/markdown is not a markdown answer`, p);
  }
  {
    const { res } = await get(base, '/', MARKDOWN, 'POST');
    expect('POST / with Accept: text/markdown is not a markdown answer', res.headers.has('x-markdown-tokens') ? ['the Function answered a POST with markdown'] : []);
  }
  {
    // The home page's Link headers (ADR-0068): what _headers gives `/`, on the static HTML.
    const want = homeLinkValues();
    const htmlBytes = new Uint8Array(readFileSync(join(DIST, 'index.html')));
    for (const method of ['GET', 'HEAD']) {
      const { res, bytes } = await get(base, '/', BROWSER, method);
      const p: string[] = [];
      if (res.status !== 200) p.push(`status ${res.status}`);
      const got = (res.headers.get('link') ?? '').split(/,\s*(?=<)/).filter(Boolean);
      if (got.join('\n') !== want.join('\n')) p.push(`Link ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
      const diff = method === 'GET' ? sameBytes(bytes, htmlBytes) : bytes.byteLength ? `HEAD returned ${bytes.byteLength} body bytes` : null;
      if (diff) p.push(`body ${diff}`);
      expect(`${method} / carries the Link headers of _headers, on the HTML`, p);
    }
  }
}

/** The recipes the build serves: every /cookbook/<slug>/ with a markdown file, in name order. */
function recipeSlugs(): string[] {
  const dir = join(DIST, 'cookbook');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((e) => existsSync(join(dir, e, 'index.md'))).sort();
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
/**
 * The text of an HTML fragment: tags dropped, entities decoded, whitespace
 * collapsed. The tags are dropped until none is left, so text that only
 * becomes a tag once another is removed (`<scr<b>ipt>`) is not read as text.
 */
function htmlText(html: string): string {
  let text = html;
  for (let last = ''; last !== text; ) {
    last = text;
    text = text.replace(/<(script|style|svg|template)\b[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, '');
  }
  return text
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => (e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e] ?? m)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The home page's twin (/index.md, ADR-0069) is the page's markdown form:
 * the page's H2 and H3 headings are the twin's `##` and `###` headings, in
 * order; every heading and paragraph the twin takes from the page
 * (homeClaims) is on the page; every site URL the twin gives is a file the
 * build serves; and the page's head names the twin as its markdown alternate.
 */
function homeTwinMatchesPage(): void {
  console.log('home page twin (the built /index.md against the built page, without the server)');
  const twinFile = join(DIST, 'index.md');
  if (!existsSync(twinFile)) return bad('/index.md', `not built (src/pages/index.md.ts, ADR-0069)`);
  const twin = readFileSync(twinFile, 'utf8');
  const page = readFileSync(join(DIST, 'index.html'), 'utf8');
  const main = /<main\b[^>]*>([\s\S]*)<\/main>/.exec(page)?.[1] ?? '';

  const pageHeadings = [...main.matchAll(/<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => `${'#'.repeat(Number(m[1]))} ${htmlText(m[2])}`);
  const twinHeadings = twin.replace(/^```[\s\S]*?^```$/gm, '').split('\n').filter((l) => /^#{2,3} /.test(l));
  const firstDiff = pageHeadings.findIndex((h, i) => h !== twinHeadings[i]);
  expect(
    `the twin's headings are the page's ${pageHeadings.length} H2 and H3 headings, in order`,
    pageHeadings.length && firstDiff < 0 && twinHeadings.length === pageHeadings.length
      ? []
      : [firstDiff >= 0 ? `heading ${firstDiff + 1}: the page has ${JSON.stringify(pageHeadings[firstDiff])}, the twin ${JSON.stringify(twinHeadings[firstDiff] ?? null)}` : `the page has ${pageHeadings.length}, the twin ${twinHeadings.length}`],
  );

  const text = htmlText(main);
  const claims = homeClaims();
  const missing = [...claims.headings, ...claims.text].filter((c) => !text.includes(c.replace(/\s+/g, ' ')));
  expect(`the ${claims.headings.length + claims.text.length} headings and paragraphs the twin takes from the page are on the page`, missing.map((c) => `not on the page: ${JSON.stringify(c)}`));

  const dead: string[] = [];
  for (const [url] of twin.matchAll(/https:\/\/relatedb\.ai\/[^\s)`"|]*/g)) {
    const path = new URL(url.replace(/[.,;:]+$/, '')).pathname;
    if (path.startsWith('/playground/')) continue; // its own package, built into dist/ after the site
    const file = join(DIST, path.endsWith('/') ? `${path}index.html` : path);
    if (!(existsSync(file) && statSync(file).isFile()) && !dead.includes(path)) dead.push(path);
  }
  expect('every site URL in the twin is a built file', dead.map((d) => `no ${d} in ${DIST}`));

  expect(
    'the home page\'s head names /index.md as its markdown alternate',
    /<link rel="alternate" type="text\/markdown" href="\/index\.md"/.test(page) ? [] : ['no <link rel="alternate" type="text/markdown" href="/index.md">'],
  );
}

/** The Link values the built _headers file sets on `/` (public/_headers, ADR-0068), in file order. */
function homeLinkValues(): string[] {
  const file = join(DIST, '_headers');
  if (!existsSync(file)) return [];
  const out: string[] = [];
  let path = '';
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) path = line.trim();
    else if (path === '/') {
      const value = /^\s+Link:\s*(.+?)\s*$/i.exec(line)?.[1];
      if (value) out.push(value);
    }
  }
  return out;
}

/**
 * The home page's Link headers name files the build serves, with a relation
 * type each, and the file the page's own `<link rel="describedby">` names is
 * one of them, under the same relation.
 */
function homeLinkTargets(): void {
  console.log('home page Link headers (the built _headers file, without the server)');
  const values = homeLinkValues();
  if (!values.length) return bad('/_headers', 'no Link header for / (public/_headers, ADR-0068)');
  const links: { target: string; rel: string }[] = [];
  for (const value of values) {
    const m = /^<(\/[^>]*)>((?:\s*;\s*[a-z]+="[^"]*")+)$/.exec(value);
    const rel = m && /;\s*rel="([^"]+)"/.exec(m[2])?.[1];
    if (!m || !rel) {
      bad(value, 'not <a site path>; rel="…" with quoted parameters');
      continue;
    }
    links.push({ target: m[1], rel });
    const file = join(DIST, m[1].endsWith('/') ? `${m[1]}index.html` : m[1]);
    expect(`${m[1]} (rel="${rel}") is a built file`, existsSync(file) && statSync(file).isFile() ? [] : [`no ${relative(DIST, file)} in ${DIST}`]);
  }
  const head = /<link rel="describedby" href="([^"]+)"/.exec(readFileSync(join(DIST, 'index.html'), 'utf8'))?.[1];
  expect(
    'the home page\'s <link rel="describedby"> is one of them',
    head && links.some((l) => l.rel === 'describedby' && l.target === head) ? [] : [`the head names ${JSON.stringify(head ?? null)}; the headers name ${links.filter((l) => l.rel === 'describedby').map((l) => l.target).join(', ') || 'none'}`],
  );
}

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walkFiles(p, out);
    else out.push(p);
  }
  return out;
}

const walkPages = (dir: string): string[] => walkFiles(dir).filter((p) => p.endsWith(`${sep}index.html`));

/**
 * Every heading id on every built docs page resolves as a ?section= anchor:
 * each H2 to H6 id, and each glossary entry's id (`<div class="glossary-entry"
 * id="…">`, an H3 in the twin). A table row's id (a CLI flag, an exit code)
 * is a fragment of its section, not a section, and is not checked.
 */
function anchorCoverage(): void {
  console.log('anchors (every built docs page, without the server)');
  const docs = join(DIST, 'docs');
  let pages = 0;
  let failed = 0;
  for (const file of walkPages(docs)) {
    const id = file.slice(docs.length + 1, -'index.html'.length).replace(/\/$/, '');
    if (!existsSync(twinFile(id))) continue; // not a docs page (no twin)
    pages++;
    const html = readFileSync(file, 'utf8');
    const twin = readFileSync(twinFile(id), 'utf8');
    const ids = [
      ...[...html.matchAll(/<h[2-6]\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]),
      ...[...html.matchAll(/<div\b[^>]*\bclass="[^"]*\bglossary-entry\b[^"]*"[^>]*\bid="([^"]+)"/g)].map((m) => m[1]),
    ];
    const missing = ids.filter((a) => !LAYOUT_IDS.has(a) && !sliceSection(twin, a, { html }).ok);
    if (!missing.length) continue;
    if (OWN_TWIN.has(id)) console.log(`  note  ${pageUrl(id)}: its twin is its own document; HTML ids with no section: ${missing.join(', ')}`);
    else {
      failed++;
      bad(`${pageUrl(id)}`, `heading ids with no section in the twin: ${missing.join(', ')}`);
    }
  }
  if (!failed) ok(`${pages} pages: every heading and glossary entry id resolves (the layout's ${[...LAYOUT_IDS].join(', ')} aside)`);
}

async function main(): Promise<number> {
  if (!existsSync(join(DIST, 'docs'))) {
    console.log(`docs:negotiation-check: skipped (no ${join(DIST, 'docs')}; run npm run build first)`);
    return 0;
  }
  anchorCoverage();
  homeLinkTargets();
  homeTwinMatchesPage();

  const scratch = mkdtempSync(join(tmpdir(), 'relate-negotiation-'));
  let child: ChildProcess | null = null;
  const cleanup = () => {
    stop(child);
    rmSync(scratch, { recursive: true, force: true });
  };
  process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
  });
  try {
    const port = await freePort();
    console.log(`starting npx ${WRANGLER} pages dev on port ${port}`);
    const server = await startServer(port, scratch);
    child = server.child;
    try {
      await serverCases(server.base);
    } catch (e) {
      bad('server cases', `${(e as Error).message}\n${server.log()}`);
    }
  } catch (e) {
    bad('wrangler pages dev', (e as Error).message);
  } finally {
    cleanup();
  }
  console.log(failures ? `docs:negotiation-check: ${failures} failure(s)` : 'docs:negotiation-check: all cases pass');
  return failures ? 1 : 0;
}

process.exit(await main());
