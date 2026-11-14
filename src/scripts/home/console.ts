// The home page's live console (src/components/Console.astro): the engine runs in this page, on the
// cookbook's engine worker (src/scripts/cookbook/worker.ts, which loads /wasm/ at runtime), and
// results are laid out by the cookbook's own code: tableHtml for rows, the NVL graph view for graphs.
// Nothing loads until the console nears the viewport (or is used); NVL loads when a result first
// draws a graph.

import { failed } from '../../lib/cookbook/cells.ts';
import { expandNode, type Graph, type StatementRun } from '../../lib/cookbook/graph-model.ts';
import { canDraw, esc, lastEnvelope, tableHtml, type TableCells } from '../../lib/cookbook/result-view.ts';
import { SCENARIOS, type Scenario } from '../../lib/home/console-scenarios.ts';
import type { GraphView } from '../cookbook/graph.ts';

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
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role=tab]')];
  const out = $('#tc-out');
  const chips = $('#tc-chips');
  const form = $<HTMLFormElement>('#tc-form');
  const input = $<HTMLInputElement>('#tc-input');
  const runBtn = $<HTMLButtonElement>('#tc-run');
  const resetBtn = $<HTMLButtonElement>('#tc-reset');
  const label = $('#tc-label');
  const status = $('#tc-status');
  const panel = $('#tc-panel');

  const engine = new Engine();
  let current = tabs[0]?.dataset.id ?? '';
  let generation = 0; // a load that finds a newer one gave up its place
  let loaded = ''; // the scenario the engine holds
  let busy = false;
  let version: string | null = null;
  const views: GraphView[] = [];
  const history: string[] = [];
  let at = -1;

  const scenario = (): Scenario => SCENARIOS[current];
  const flat = (q: string) => q.replace(/\s+/g, ' ').trim();

  const setStatus = (text: string, state: 'idle' | 'busy' | 'ready' | 'error') => {
    status.textContent = text;
    status.dataset.state = state;
  };
  const setBusy = (on: boolean) => {
    busy = on;
    runBtn.disabled = on;
    resetBtn.disabled = on;
    root.toggleAttribute('data-busy', on);
  };
  const scroll = () => {
    out.scrollTop = out.scrollHeight;
  };
  const append = (html: string) => {
    out.insertAdjacentHTML('beforeend', html);
    scroll();
  };
  const clearOutput = () => {
    for (const v of views.splice(0)) v.destroy();
    out.replaceChildren();
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

  const banner = () => {
    const s = scenario();
    const head = `relate${version ? ` ${version}` : ''} · in your browser · ${s.label}`;
    const lines = [head, ...(s.banner ?? [])];
    append(`<p class="tc-banner">${lines.map(esc).join('<br>')}</p>`);
  };

  /** Load the current scenario into an empty database and print its banner. */
  async function load() {
    const mine = ++generation;
    setBusy(true);
    setStatus('loading the engine…', 'busy');
    clearOutput();
    label.textContent = scenario().label;
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
      banner();
      setStatus(version ? `ready · relate ${version}` : 'ready', 'ready');
    } catch (err) {
      if (mine !== generation) return;
      loaded = '';
      append(`<p class="tc-err">error: ${esc((err as Error).message)}</p>`);
      setStatus('engine unavailable', 'error');
    } finally {
      if (mine === generation) setBusy(false);
    }
  }

  async function drawGraph(graph: Graph, reply: RunReply) {
    const host = document.createElement('div');
    host.className = 'tc-graph';
    out.append(host);
    scroll();
    try {
      const { renderGraph } = await import('../cookbook/graph.ts');
      let view: GraphView | null = null;
      view = renderGraph(host, graph, {
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
      views.push(view);
    } catch (err) {
      host.remove();
      append(`<p class="tc-err">The graph view could not load: ${esc((err as Error).message)}</p>`);
    }
  }

  async function runQuery(query: string) {
    const compact = flat(query);
    append(`<p class="tc-echo"><span class="tc-ps">cypher&gt;</span> ${esc(compact.endsWith(';') ? compact : `${compact};`)}</p>`);
    setBusy(true);
    try {
      const reply = await engine.run(query);
      const last = lastEnvelope(reply.envelopes);
      if (failed(last)) {
        append(`<p class="tc-err">error: ${esc(last!.error)}</p>`);
        return;
      }
      const rec = reply.recording;
      const ms = `${reply.ms.toFixed(1)} ms`;
      if (rec?.graph && canDraw(rec.graph)) {
        // A graph result is shown as the picture: the table of raw values adds nothing to it.
        await drawGraph(rec.graph, reply);
        append(`<p class="out-summary">${esc(rec.table?.summary ?? 'graph')} · ${ms}</p>`);
      } else if (rec?.table) {
        append(tableHtml({ ...rec.table, summary: `${rec.table.summary} · ${ms}` }));
      } else {
        append(`<pre class="tc-text">${esc(rec?.text ?? '')}</pre><p class="out-summary">${ms}</p>`);
      }
    } catch (err) {
      // A trap discards the engine: the database is gone, so the scenario loads again on the next run.
      append(`<p class="tc-err">error: ${esc((err as Error).message)}</p>`);
      loaded = '';
    } finally {
      setBusy(false);
      scroll();
    }
  }

  async function submit() {
    const q = input.value.trim();
    if (!q || busy) return;
    if (loaded !== current) await load();
    if (loaded !== current) return;
    input.value = '';
    at = -1;
    const seen = history.indexOf(q);
    if (seen >= 0) history.splice(seen, 1);
    history.unshift(q);
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

  const select = (id: string, focus = false) => {
    if (!SCENARIOS[id]) return;
    current = id;
    for (const t of tabs) {
      const on = t.dataset.id === id;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    }
    panel.setAttribute('aria-labelledby', `tc-tab-${id}`);
    input.value = '';
    at = -1;
    started = true;
    void load();
  };

  const tablist = $('#tc-tabs');
  tablist.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[role=tab]');
    if (b?.dataset.id && b.dataset.id !== current) select(b.dataset.id);
  });
  tablist.addEventListener('keydown', (e) => {
    const i = tabs.findIndex((t) => t === document.activeElement);
    if (i < 0) return;
    const step: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in step) && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + step[e.key] + tabs.length) % tabs.length;
    select(tabs[n].dataset.id!, true);
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
  input.addEventListener('focus', start);
  // Arrow keys walk the queries run so far, then the scenario's suggestions.
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const list = [...history, ...scenario().demos.map((d) => flat(d.query))];
    if (!list.length) return;
    e.preventDefault();
    at = e.key === 'ArrowUp' ? Math.min(at + 1, list.length - 1) : Math.max(at - 1, -1);
    input.value = at < 0 ? '' : list[at];
  });

  renderChips();
  label.textContent = scenario().label;
}
