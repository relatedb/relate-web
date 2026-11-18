// /index.md: the home page as markdown (ADR-0069). `/` answers `Accept: text/markdown` with these
// bytes (functions/index.ts), and the page's head names the file as its markdown alternate.
import type { APIRoute } from 'astro';

import engine from '../content/docs/_data/engine.json';
import { CANONICAL_ORIGIN } from '../lib/cookbook/links.ts';
import { installTabs, setupPrompt } from '../lib/home/content.ts';
import { homeTwin } from '../lib/home/twin.ts';

export const GET: APIRoute = () =>
  new Response(homeTwin({ origin: CANONICAL_ORIGIN, verified: engine.version, tabs: installTabs(engine.version), setupPrompt: setupPrompt() }), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
