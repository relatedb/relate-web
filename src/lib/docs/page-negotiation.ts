// Content negotiation for the pages outside the docs that have a markdown
// form: the home page and the cookbook (ADR-0069). The Cloudflare Pages
// Functions functions/index.ts and functions/cookbook/_middleware.ts both
// answer with `negotiatePage`; the docs keep their own function
// (functions/docs/_middleware.ts), which also cuts a page to one section.
//
// The rules are the docs' (ADR-0025): markdown only when the Accept header
// prefers it to HTML, only on GET and HEAD, only on a path that names a page
// and only when that page's markdown file is built. Everything else is the
// static file, with `Vary: Accept` added on a page that negotiates. The
// markdown answer is the file's bytes, `Cache-Control: private` (Cloudflare's
// cache ignores Vary), any origin, no cookie (ADR-0013).
//
// A failure here must not take the page down: any error on the markdown
// branch falls back to the static file.
//
// Worker runtime: no Node imports, erasable TypeScript only.

import { agentPathLine, estimateTokens, pageTwinFor, prefersMarkdown, SITE_ORIGIN } from './negotiation.ts';

interface Assets {
  fetch(input: Request | string | URL, init?: RequestInit): Promise<Response>;
}

export interface PageContext {
  request: Request;
  env: { ASSETS: Assets };
  next(input?: Request | string, init?: RequestInit): Promise<Response>;
}

/** The static answer on a URL that negotiates, with `Vary: Accept` added. */
async function passThrough(context: PageContext): Promise<Response> {
  const res = await context.next();
  const out = new Response(res.body, res);
  const vary = out.headers.get('vary');
  if (!vary || !/(^|,)\s*accept\s*(,|$)/i.test(vary)) out.headers.append('Vary', 'Accept');
  return out;
}

/** The page's markdown file, or null when it is not built or is not text (the 404 page, a redirect). */
async function markdownFile(env: PageContext['env'], request: Request, path: string): Promise<string | null> {
  const res = await env.ASSETS.fetch(new Request(new URL(path, request.url), { method: 'GET' }));
  if (res.status !== 200) return null;
  if (!/^text\/(markdown|plain)\b/i.test(res.headers.get('content-type') ?? '')) return null;
  return res.text();
}

export async function negotiatePage(context: PageContext): Promise<Response> {
  const { request, env } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') return context.next();

  const url = new URL(request.url);
  const page = pageTwinFor(url.pathname);
  if (!page) return context.next(); // a file (index.md, results.json, …) or not a page
  if (!prefersMarkdown(request.headers.get('accept'))) return passThrough(context);

  let markdown: string | null;
  try {
    markdown = await markdownFile(env, request, page.twin);
  } catch {
    markdown = null;
  }
  if (markdown === null) return passThrough(context); // no such page: the asset (or the 404 page) answers

  console.log(JSON.stringify(agentPathLine('negotiated', url.pathname, 200, request.headers.get('user-agent'))));
  const headers = new Headers({
    'Content-Type': 'text/markdown; charset=utf-8',
    'Content-Length': String(new TextEncoder().encode(markdown).byteLength),
    Vary: 'Accept',
    'Cache-Control': 'private',
    'Access-Control-Allow-Origin': '*',
    'X-Content-Type-Options': 'nosniff',
    'x-markdown-tokens': String(estimateTokens(markdown)),
    Link: `<${SITE_ORIGIN}${page.canonical}>; rel="canonical"`,
  });
  return new Response(request.method === 'HEAD' ? null : markdown, { status: 200, headers });
}
