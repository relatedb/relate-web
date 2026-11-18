// Cloudflare Pages Function: content negotiation on the home page
// (ADR-0069). Mounted on `/` alone by its name. GET or HEAD whose Accept
// prefers text/markdown answers with the bytes of /index.md, the page's
// markdown twin; a browser gets the HTML, unchanged but for `Vary: Accept`.
// The rules and the fallbacks are in src/lib/docs/page-negotiation.ts.

import { negotiatePage, type PageContext } from '../src/lib/docs/page-negotiation.ts';

export const onRequest = (context: PageContext): Promise<Response> => negotiatePage(context);
