// The home page's live console (src/components/Console.astro): the engine runs in this page, on the
// cookbook's engine worker (src/scripts/cookbook/worker.ts, which loads /wasm/ at runtime), and
// results are laid out by the cookbook's own code: tableHtml for rows, the NVL graph view for graphs.
// Nothing loads until the console nears the viewport (or is used); NVL loads when a result first
// draws a graph.

import { failed } from '../../lib/cookbook/cells.ts';
import { expandNode, type Graph, type StatementRun } from '../../lib/cookbook/graph-model.ts';
import { canDraw, esc, lastEnvelope, tableHtml, type TableCells } from '../../lib/cookbook/result-view.ts';
import { planText, splitStatement, type PlanDoc, type PlanNote } from '../../lib/docs/elements/_plan-model.ts';
import { SCENARIOS, type Scenario } from '../../lib/home/console-scenarios.ts';
import { extractCypher, messagesFor, retryMessages, schemaText } from '../../lib/home/text2cypher.ts';
import type { GraphView } from '../cookbook/graph.ts';
import { askSupport, generate } from './ask.ts';

interface Recording {
  kind: 'table' | 'gram';
  text: string;
  table: TableCells | null;
  graph: Graph | null;
}
interface RunReply {
  envelopes: string[];
  recording: Recording | null;
  ms: number;
}
interface Pending {
  resolve: (reply: Record<string, unknown>) => void;
  reject: (err: Error) => void;
}

/** The engine worker: created on first use, discarded after a trap so the next use starts a clean one. */
class Engine {
  worker: Worker | null = null;
  ready: Promise<{ version: string | null }> | null = null;
  pending = new Map<number, Pending>();
  seq = 0;

  start(): Promise<{ version: string | null }> {
    if (this.ready) return this.ready;
    const worker = new Worker(new URL('../cookbook/worker.ts', import.meta.url), { type: 'module', name: 'relate-home' });
    this.worker = worker;
    worker.onmessage = (e: MessageEvent) => {
      const { id, ...rest } = e.data;
      const p = this.pending.get(id);
      if (!p) return;
      this.pending.delete(id);
      if (rest.ok) {
        p.resolve(rest);
      } else {
        if (rest.trap) this.discard();
        p.reject(new Error(rest.message));
      }
    };
    worker.onerror = (e) => {
      e.preventDefault();
      this.discard(new Error(`The engine failed to load: ${e.message || 'network or module error'}`));
    };
    this.ready = this.call({ type: 'init' }).then((r) => ({ version: (r.version as string | null) ?? null }));
    this.ready.catch(() => {});
    return this.ready;
  }

  call(msg: Record<string, unknown>): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const id = ++this.seq;
      this.pending.set(id, { resolve, reject });
      this.worker!.postMessage({ id, ...msg });
    });
  }

  async run(code: string, bare = false): Promise<RunReply> {
    await this.start();
    return (await this.call({ type: 'run', code, params: null, bare })) as unknown as RunReply;
  }

  /** Like run with parameters (JSON text): what the graph view's expansion asks for. */
  async runParams(code: string, params: string): Promise<RunReply> {
    await this.start();
    return (await this.call({ type: 'run', code, params })) as unknown as RunReply;
  }

  async reset() {
    await this.start();
    await this.call({ type: 'reset' });
  }

  discard(err = new Error('The engine stopped.')) {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
  }
}

const root = document.querySelector<HTMLElement>('[data-console]');
if (root && typeof Worker !== 'undefined') {
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const out = $('#tc-out');
  const chips = $('#tc-chips');
  const form = $<HTMLFormElement>('#tc-form');
  const input = $<HTMLInputElement>('#tc-input');
  const runBtn = $<HTMLButtonElement>('#tc-run');
  const askBtn = $<HTMLButtonElement>('#tc-ask');
  const explainBtn = $<HTMLButtonElement>('#tc-explain');
  const profileBtn = $<HTMLButtonElement>('#tc-profile');
  const resetBtn = $<HTMLButtonElement>('#tc-reset');
  const picker = $<HTMLSelectElement>('#tc-scenario');
  const status = $('#tc-status');

  /** The first command of every dataset: its shape, drawn. */
  const SCHEMA = 'CALL db.schema.visualization()';

  const engine = new Engine();
  let current = picker.value || Object.keys(SCENARIOS)[0];
  let generation = 0; // a load that finds a newer one gave up its place
  let loaded = ''; // the dataset the engine holds
  let busy = false;
  let version: string | null = null;
  let schema = ''; // the loaded dataset's schema, as the model reads it
  const views = new Map<HTMLElement, GraphView[]>();
  const history: string[] = [];
  let at = -1;
  /** The last statement's frame: running the same read again replaces it (with a count) instead of adding another. */
  let lastRun: { key: string; frame: HTMLElement; runs: number } | null = null;

  const scenario = (): Scenario => SCENARIOS[current];
  const flat = (q: string) => q.replace(/\s+/g, ' ').trim();
  const isRead = (q: string) => !/\b(create|merge|set|delete|remove|drop|load|foreach)\b/i.test(q);

  const setStatus = (text: string, state: 'idle' | 'busy' | 'ready' | 'error') => {
    status.textContent = text;
    status.dataset.state = state;
  };
  const readyText = () => (version ? `ready · relate ${version}` : 'ready');
  const setBusy = (on: boolean) => {
    busy = on;
    for (const b of [runBtn, askBtn, explainBtn, profileBtn, resetBtn]) b.disabled = on;
    root.toggleAttribute('data-busy', on);
  };
  const scroll = () => {
    out.scrollTop = out.scrollHeight;
  };
  const addFrame = () => {
    const frame = document.createElement('div');
    frame.className = 'tc-frame';
    out.append(frame);
    return frame;
  };
  const put = (frame: HTMLElement, html: string) => {
    frame.insertAdjacentHTML('beforeend', html);
    scroll();
  };
  const dropViews = (frame: HTMLElement) => {
    for (const v of views.get(frame) ?? []) v.destroy();
    views.delete(frame);
  };
  const clearOutput = () => {
    for (const frame of [...views.keys()]) dropViews(frame);
    out.replaceChildren();
    lastRun = null;
  };

  const renderChips = () => {
    chips.replaceChildren();
    const lead = document.createElement('span');
    lead.className = 'tc-try';
    lead.textContent = 'try:';
    chips.append(lead);
    for (const d of scenario().demos) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tc-chip';
      b.textContent = d.name;
      b.title = `${d.query}\n\nClick to run.`;
      b.addEventListener('click', () => {
        input.value = flat(d.query);
        input.focus();
        void submit();
      });
      chips.append(b);
    }
  };

  /** Load the current dataset into an empty database, then run its schema as the first command. */
  async function load() {
    const mine = ++generation;
    setBusy(true);
    setStatus('loading the engine…', 'busy');
    clearOutput();
    picker.value = current;
    renderChips();
    try {
      const info = await engine.start();
      if (mine !== generation) return;
      version = info.version ? `v${info.version}` : null;
      await engine.reset();
      for (const stmt of scenario().seed) {
        const reply = await engine.run(stmt, true);
        if (mine !== generation) return;
        const last = lastEnvelope(reply.envelopes);
        if (failed(last)) throw new Error(`${last!.error}\nin: ${stmt.slice(0, 80)}`);
      }
      loaded = current;
      const answer = async (q: string) => (await engine.run(q, true)).envelopes.at(-1) ?? '{}';
      schema = schemaText(await answer('CALL db.schema.nodeTypeProperties()'), await answer('CALL db.schema.visualization()'));
      const lines = scenario().banner;
      if (lines?.length) put(addFrame(), `<p class="tc-banner">${lines.map(esc).join('<br>')}</p>`);
      setStatus(readyText(), 'ready');
      await execute(SCHEMA);
    } catch (err) {
      if (mine !== generation) return;
      loaded = '';
      put(addFrame(), `<p class="tc-err">error: ${esc((err as Error).message)}</p>`);
      setStatus('engine unavailable', 'error');
    } finally {
      if (mine === generation) setBusy(false);
    }
  }

  async function drawGraph(frame: HTMLElement, graph: Graph, reply: RunReply) {
    const host = document.createElement('div');
    host.className = 'tc-graph';
    frame.append(host);
    scroll();
    try {
      const { renderGraph } = await import('../cookbook/graph.ts');
      let view: GraphView | null = null;
      view = renderGraph(host, graph, {
        compact: true,
        envelope: lastEnvelope(reply.envelopes),
        onExpand: async (id, drawn) => {
          try {
            const expansion = await expandNode((code, params) => engine.runParams(code, params) as Promise<StatementRun>, id, drawn);
            view?.grow(id, { graph: expansion });
          } catch (err) {
            view?.grow(id, { problem: (err as Error).message });
          }
        },
      });
      views.set(frame, [...(views.get(frame) ?? []), view]);
    } catch (err) {
      host.remove();
      put(frame, `<p class="tc-err">The graph view could not load: ${esc((err as Error).message)}</p>`);
    }
  }

  /**
   * Run one statement and show it in a frame at the end of the stream, or, when it is the same read as the
   * last statement, in that statement's place with a count: the time shown is the latest end to end.
   */
  async function execute(query: string) {
    const compact = flat(query);
    const key = compact.replace(/;$/, '');
    const frame = document.createElement('div');
    frame.className = 'tc-frame';
    let runs = 1;
    if (lastRun && lastRun.key === key && isRead(key) && lastRun.frame.isConnected) {
      runs = lastRun.runs + 1;
      dropViews(lastRun.frame);
      lastRun.frame.replaceWith(frame);
    } else {
      out.append(frame);
    }
    lastRun = { key, frame, runs };
    // The typed text goes in as text, never as markup.
    const echo = document.createElement('p');
    echo.className = 'tc-echo';
    const ps = document.createElement('span');
    ps.className = 'tc-ps';
    ps.textContent = 'cypher>';
    echo.append(ps, ` ${compact.endsWith(';') ? compact : `${compact};`}`);
    frame.append(echo);
    scroll();
    const count = runs > 1 ? `<span class="tc-count" title="Run ${runs} times in a row; only the latest result is kept">×${runs}</span>` : '';
    try {
      const reply = await engine.run(query);
      const last = lastEnvelope(reply.envelopes);
      if (failed(last)) {
        put(frame, `<p class="tc-err">error: ${esc(last!.error)}</p>`);
        return;
      }
      const rec = reply.recording;
      const ms = `${reply.ms.toFixed(1)} ms`;
      const env = last as { plan?: PlanDoc | null; notifications?: PlanNote[] } | null;
      if (env?.plan) {
        // EXPLAIN and PROFILE: the plan as the CLI's table (the docs' plan model), notifications below it.
        put(frame, `<pre class="tc-text tc-plan">${esc(planText(env.plan, env.notifications ?? []))}</pre><p class="out-summary">${env.plan.profiled ? 'profile' : 'explain'} · ${ms}${count}</p>`);
      } else if (rec?.graph && canDraw(rec.graph)) {
        // A graph result is shown as the picture: the table of raw values adds nothing to it.
        await drawGraph(frame, rec.graph, reply);
        put(frame, `<p class="out-summary">${esc(rec.table?.summary ?? 'graph')} · ${ms}${count}</p>`);
      } else if (rec?.table) {
        put(frame, tableHtml({ ...rec.table, summary: `${rec.table.summary} · ${ms}` }).replace(/<\/p>$/, `${count}</p>`));
      } else {
        put(frame, `<pre class="tc-text">${esc(rec?.text ?? '')}</pre><p class="out-summary">${ms}${count}</p>`);
      }
    } catch (err) {
      // A trap discards the engine: the database is gone, so the dataset loads again on the next run.
      put(frame, `<p class="tc-err">error: ${esc((err as Error).message)}</p>`);
      loaded = '';
    } finally {
      scroll();
    }
  }

  /** Why a query would not run (its EXPLAIN fails), or null; nothing executes. */
  async function problemWith(query: string): Promise<string | null> {
    if (!query) return 'the reply held no query';
    try {
      const last = lastEnvelope((await engine.run(`EXPLAIN ${query}`, true)).envelopes);
      return failed(last) ? String(last!.error) : null;
    } catch (err) {
      return (err as Error).message;
    }
  }

  /** Turn the question in the box into a query with the on-device model; the reader checks it and runs it. */
  async function ask() {
    const question = input.value.trim();
    if (!question || busy) return;
    if (loaded !== current) await load();
    if (loaded !== current) return;
    setBusy(true);
    lastRun = null;
    const frame = addFrame();
    const echo = document.createElement('p');
    echo.className = 'tc-echo';
    const ps = document.createElement('span');
    ps.className = 'tc-ps';
    ps.textContent = 'ask>';
    echo.append(ps, ` ${question}`);
    frame.append(echo);
    scroll();
    try {
      setStatus('asking the model…', 'busy');
      // ?holdout=1 leaves the typed question out of the worked examples, for scoring (scripts/text2cypher-browser.ts).
      const skip = new URLSearchParams(location.search).get('holdout') ? question : undefined;
      let messages = messagesFor(current, schema, question, { skip });
      let cypher = extractCypher(await generate(messages, (t) => setStatus(t, 'busy')));
      let problem = await problemWith(cypher);
      let tries = 1;
      if (problem) {
        // One retry, with the error given back.
        setStatus('checking the query…', 'busy');
        messages = retryMessages(messages, cypher, problem);
        cypher = extractCypher(await generate(messages));
        problem = await problemWith(cypher);
        tries = 2;
      }
      input.value = flat(cypher); // the box is one line: a reply's line breaks become spaces
      input.focus();
      const how = tries > 1 ? 'after a retry' : 'first try';
      put(frame, problem
        ? `<p class="tc-err">The model's query did not pass a check (${esc(problem.split('\n')[0])}). It is in the box to edit.</p>`
        : `<p class="out-summary">query written on this device (${how}) · check it, then Run</p>`);
    } catch (err) {
      put(frame, `<p class="tc-err">Ask failed: ${esc((err as Error).message)}</p>`);
    } finally {
      setStatus(loaded === current ? readyText() : 'engine unavailable', loaded === current ? 'ready' : 'error');
      setBusy(false);
    }
  }

  async function runQuery(query: string) {
    setBusy(true);
    try {
      await execute(query);
    } finally {
      setBusy(false);
    }
  }

  /** Run what is typed, or with `mode` its EXPLAIN or PROFILE; an empty prompt takes the last statement. */
  async function submit(mode?: 'EXPLAIN' | 'PROFILE') {
    const typed = input.value.trim() || (mode ? (history[0] ?? '') : '');
    if (!typed || busy) return;
    if (loaded !== current) await load();
    if (loaded !== current) return;
    const body = splitStatement(typed)?.body ?? typed.replace(/;\s*$/, '');
    const q = mode ? `${mode} ${body}` : typed;
    input.value = '';
    at = -1;
    const seen = history.indexOf(typed);
    if (seen >= 0) history.splice(seen, 1);
    history.unshift(mode ? body : typed);
    await runQuery(q);
  }

  // The first look at the console starts the engine, so the first query is quick.
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    void load();
  };
  new IntersectionObserver(
    (entries, obs) => {
      if (entries.some((e) => e.isIntersecting)) {
        obs.disconnect();
        start();
      }
    },
    { rootMargin: '300px 0px' },
  ).observe(root);

  picker.addEventListener('change', () => {
    if (!SCENARIOS[picker.value]) return;
    current = picker.value;
    input.value = '';
    at = -1;
    started = true;
    void load();
  });
  resetBtn.addEventListener('click', () => {
    input.value = '';
    at = -1;
    void load();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void submit();
  });
  askBtn.addEventListener('click', () => void ask());
  explainBtn.addEventListener('click', () => void submit('EXPLAIN'));
  profileBtn.addEventListener('click', () => void submit('PROFILE'));
  input.addEventListener('focus', start);
  // Arrow keys walk the queries run so far, then the dataset's suggestions.
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const list = [...history, ...scenario().demos.map((d) => flat(d.query))];
    if (!list.length) return;
    e.preventDefault();
    at = e.key === 'ArrowUp' ? Math.min(at + 1, list.length - 1) : Math.max(at - 1, -1);
    input.value = at < 0 ? '' : list[at];
  });

  renderChips();
  // Ask appears only where the browser has an on-device model (Chrome's Prompt API).
  void askSupport().then((s) => {
    if (s === 'none') return;
    askBtn.hidden = false;
    if (s === 'download') askBtn.title += '. The first question downloads the model.';
  });
}
