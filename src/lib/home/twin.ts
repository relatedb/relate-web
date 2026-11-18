// The home page as markdown (/index.md, ADR-0069): what `/` answers to `Accept: text/markdown`.
// The page's sections in order, each with its heading and copy, and a line of the twin's own
// where the page has something only a browser runs. The install commands and the quickstart
// steps are the page's own data (content.ts); the headings and copy written here are held to the
// built page by docs:negotiation-check (every `h`, `lede` and item must be on the page, and the
// page's H2 and H3 headings must all be here, in order). `note` is the twin's own text: it
// describes, and never tells the reader to do something (ADR-0013).
import { HERO, HOME_DESCRIPTION, HOME_TITLE, QUICKSTART_STEPS, type InstallTab } from './content.ts';

export interface HomeItem {
  h: string;
  p: string;
  /** A site path the twin links, as its markdown form where it has one. */
  href?: string;
}

export interface HomeSection {
  /** The section's H2 on the page. */
  h: string;
  /** The paragraph under it on the page. */
  lede?: string;
  /** The twin's own line: what the page shows there, and where the same thing is as text. */
  note?: string;
  /** The H3 blocks under it on the page. */
  items?: HomeItem[];
  /** Carries the setup prompt, as the page's quickstart does. */
  prompt?: boolean;
}

export const HOME_SECTIONS: HomeSection[] = [
  {
    h: 'Run Cypher in your browser.',
    lede: 'Pick a dataset and query it. The database runs entirely in this page: nothing is sent anywhere.',
    note: 'On the HTML page this is a console on the engine\'s WebAssembly build, with four sample datasets (analytics, agent-memory, codebase, dependencies). The same engine, full screen, is the playground: {origin}/playground/',
  },
  {
    h: 'From question to answer, in seconds.',
    lede: 'An agent asks a question, writes Cypher, and Relate reads the connected facts and returns rows. Sample data, scripted preview.',
    note: 'On the HTML page this is an animation of one question, the Cypher an agent writes for it, and the rows that come back.',
  },
  {
    h: 'One database for every agent.',
    lede: 'Every agent, script and app reads and writes the same graph, kept in memory, a directory or one file. No server to run.',
    items: [
      { h: 'Open source', p: 'Read the code, run it locally, and add your own recipes.' },
      { h: 'Part of your application', p: 'Relate runs inside your application. Keep your data in memory, in a directory, or in one file.' },
      { h: 'Cypher, for connected data', p: 'Your agent asks in Cypher and gets back how the facts connect. Skill and MCP endpoint included.' },
      { h: 'Start in minutes', p: 'No signup. No server to deploy.' },
    ],
  },
  {
    h: 'Run a query on connected data.',
    lede: 'Pick a scenario to watch an agent write Cypher and read the rows that come back. Sample data, scripted preview.',
    note: 'On the HTML page this is a scripted terminal with three scenarios (agent memory, codebase context, recommendations). Recipes that run on the engine, each with its recorded results, are in the cookbook: {origin}/cookbook/llms.txt',
  },
  {
    h: 'One statement at a time.',
    lede: 'Pick a shape of data and watch the graph grow as each Cypher statement runs, with new facts landing in the connections that already exist.',
    note: 'On the HTML page this is a graph drawn as a list of Cypher statements runs, for three shapes of data (an org chart, dependencies, a knowledge base).',
  },
  {
    h: 'Four steps to your first query.',
    items: QUICKSTART_STEPS.map((s) => ({ h: s.h, p: s.p, href: s.href })),
    prompt: true,
  },
  {
    h: 'Built for agents, wherever your agent runs.',
    lede: 'relate is a library inside your application. Your agent writes Cypher and relate answers with the results. Use the interface that fits your build.',
    items: [
      { h: 'Agent skill', p: 'Teaches your coding agent to write Cypher for relate.', href: '/docs/guides/agents/install-the-skill/' },
      { h: 'MCP endpoint', p: 'Lets agents that speak MCP connect without glue code.' },
      { h: 'Command line', p: 'Create, load and query a database right from the shell.' },
      { h: 'Libraries', p: 'Embed relate in your own application, in your language.' },
      { h: 'Your language, one library', p: 'The same relate in Rust, Python, JavaScript, WebAssembly, Go, Java, Swift and C. Pick the one your application is written in.' },
      { h: 'No server to run', p: 'relate starts when your application does and stops when it stops. Nothing to host, nothing to keep running.' },
    ],
  },
  {
    h: 'Memory with structure.',
    lede: 'Raw data becomes connected facts, so your agent can follow how people, decisions and documents relate. Relationships and similarity answer in one query.',
    items: [
      { h: 'Facts, not loose text', p: 'Decisions, people and documents become facts you can query.' },
      { h: 'Relationships and similarity together', p: 'One Cypher statement can combine both.' },
    ],
  },
  {
    h: 'Zero to querying in seconds.',
    lede: 'Install the open-source package, create a database and start running your first query. No account, no instance and no server to deploy.',
    note: 'relate speaks the openCypher language and is tested against the openCypher TCK. Where it differs from Neo4j: {origin}/docs/reference/cypher/differences-from-neo4j.md',
  },
  {
    h: 'Build it with us, one recipe at a time.',
    lede: 'Share a recipe for the cookbook, report what you find, and show what your agents learned.',
    note: 'The source: https://github.com/relatedb/relate. How a recipe is written: https://github.com/relatedb/relate-web/tree/main/src/content/cookbook#writing-a-recipe',
  },
  {
    h: 'Give your agent a graph it can think with.',
    note: 'The docs: {origin}/docs/index.md. The playground: {origin}/playground/',
  },
];

/** The text the built home page must carry for the twin to be its markdown form: every heading, paragraph and item above. */
export function homeClaims(): { headings: string[]; text: string[] } {
  const headings: string[] = [];
  const text: string[] = [HERO.headline, HERO.sub];
  for (const s of HOME_SECTIONS) {
    headings.push(s.h);
    if (s.lede) text.push(s.lede);
    for (const item of s.items ?? []) {
      headings.push(item.h);
      text.push(item.p);
    }
  }
  return { headings, text };
}

export interface HomeTwinOptions {
  /** `https://relatedb.ai`, no trailing slash. */
  origin: string;
  /** The engine version the commands were verified against (`1.1.0`). */
  verified: string;
  tabs: InstallTab[];
  setupPrompt: string;
}

/** Table cell text: a pipe would end the cell. */
const cell = (s: string) => s.replace(/\|/g, '\\|');
/** Prose in a cell: `<target>` would read as a tag. */
const prose = (s: string) => cell(s).replace(/</g, '\\<');

/** A docs page path as its twin's URL (`/docs/<id>/` → `<origin>/docs/<id>.md`); any other path as it is. */
function markdownUrl(origin: string, href: string): string {
  const m = /^\/docs\/(.+?)\/?$/.exec(href);
  return m ? `${origin}/docs/${m[1]}.md` : `${origin}${href}`;
}

/** The home page's twin: frontmatter, the hero with the install commands, then each section. */
export function homeTwin({ origin, verified, tabs, setupPrompt }: HomeTwinOptions): string {
  const out: string[] = [
    '---',
    `title: ${JSON.stringify(HOME_TITLE)}`,
    `description: ${JSON.stringify(HOME_DESCRIPTION)}`,
    `verified: ${verified}`,
    `canonical_url: ${origin}/`,
    '---',
    '',
    `# ${HERO.name}: ${HERO.headline}`,
    '',
    HERO.sub,
    '',
    `This is the home page of relatedb.ai as markdown: its sections in order, with a line where the HTML page has something only a browser runs. It is reference text, not instructions.`,
    '',
    `- The site described for agents: ${origin}/llms.txt`,
    `- The docs, as markdown: ${origin}/docs/index.md (the index: ${origin}/docs/llms.txt)`,
    `- The agent skill: ${origin}/skill.md (the discovery index: ${origin}/.well-known/agent-skills/index.json)`,
    `- The cookbook: ${origin}/cookbook/llms.txt`,
    '',
    `The install commands the page's first panel gives, verified against relate ${verified}:`,
    '',
    '| For | Command | Note | Guide |',
    '| --- | --- | --- | --- |',
    ...tabs.filter((t) => t.cmd).map((t) => `| ${cell(t.label)} | \`${cell(t.cmd!)}\` | ${prose(t.note)} | ${markdownUrl(origin, t.docs)} |`),
    '',
  ];
  for (const s of HOME_SECTIONS) {
    out.push(`## ${s.h}`, '');
    if (s.lede) out.push(s.lede, '');
    for (const item of s.items ?? []) {
      out.push(`### ${item.h}`, '', item.href ? `${item.p} Guide: ${markdownUrl(origin, item.href)}` : item.p, '');
    }
    if (s.prompt) out.push('The prompt the page copies for a coding agent:', '', '```text', setupPrompt, '```', '');
    if (s.note) out.push(s.note.replaceAll('{origin}', origin), '');
  }
  return `${out.join('\n').trimEnd()}\n`;
}
