// Live Cypher highlighting for a step's editor (session.ts): the same Shiki
// grammar and themes the build uses (src/lib/docs/highlight.ts), on Shiki's
// JavaScript regex engine instead of the Oniguruma WASM, so an edited query
// keeps the colours of the static block it replaced. Loaded by a dynamic
// import on the first Edit, so it is a lazy chunk outside the page's script
// budget. The two engines render every Cypher block on the site identically.

import { createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import cypher from 'shiki/langs/cypher.mjs';
import githubDark from 'shiki/themes/github-dark-default.mjs';
import githubLight from 'shiki/themes/github-light-default.mjs';

/** A highlighter: `(code) => <pre class="shiki">…</pre>`, as the build renders a cypher fence. */
export async function cypherHighlighter(): Promise<(code: string) => string> {
  const highlighter = await createHighlighterCore({
    themes: [githubLight, githubDark],
    langs: [cypher],
    engine: createJavaScriptRegexEngine(),
  });
  return (code) =>
    highlighter.codeToHtml(code, {
      lang: 'cypher',
      themes: { light: 'github-light-default', dark: 'github-dark-default' },
      defaultColor: false,
    });
}
