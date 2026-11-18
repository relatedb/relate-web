// Cloudflare Pages Function: content negotiation on the cookbook
// (ADR-0069). Mounted on /cookbook and /cookbook/* by its place in
// functions/, after functions/_middleware.ts (the agent-path log). GET or
// HEAD whose Accept prefers text/markdown answers /cookbook/ with the bytes
// of /cookbook/llms.txt (the recipe index) and /cookbook/<slug>/ with the
// bytes of /cookbook/<slug>/index.md (the recipe file). Every other path
// under /cookbook (the .md and .json files, the pictures) and every HTML
// request passes through to the static file. The rules and the fallbacks
// are in src/lib/docs/page-negotiation.ts.

import { negotiatePage, type PageContext } from '../../src/lib/docs/page-negotiation.ts';

export const onRequest = (context: PageContext): Promise<Response> => negotiatePage(context);
