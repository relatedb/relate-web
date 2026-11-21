// Question to Cypher for the home console (src/scripts/home/ask.ts): the prompt a small on-device
// model gets, built from the dataset's schema, a short account of relate's Cypher, and a few worked
// questions of the same dataset (the `ask` field of each packaged query, console-scenarios.ts).
// Browser-safe (no Node imports): the page and the scoring script (scripts/text2cypher-score.ts) share it.

import { SCENARIOS } from './console-scenarios.ts';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** What the model is told about the language: the part of the relate skill's Cypher section that decides whether a query runs. */
export const RULES = [
  'You write one read-only openCypher query for relate, an embedded graph database, from the user\'s question.',
  'Reply with the query only: no explanation, no comments, no markdown.',
  'Use only the labels, relationship types and properties in the schema, spelled exactly as given.',
  'Patterns: (a:Label {prop: value})-[:TYPE]->(b); variable length -[:TYPE*1..5]->; a named path p = (...) and RETURN p when asked to show how things connect.',
  'Existence: EXISTS { (a)-[:TYPE]->(b) } and NOT EXISTS { ... }. Counting a pattern: count { (a)-[:TYPE]->(:Label) }.',
  'Shortest path: MATCH p = SHORTEST 1 (a)-[:TYPE*1..5]->(b) RETURN p.',
  'Aggregation is implicit: count(), sum(), avg(), max(), collect() group by the other returned values. Pipe with WITH; filter after it with WITH x WHERE ...; sort with ORDER BY and cap with LIMIT.',
  'Functions: coalesce, toString, toLower, round, labels(x)[0], datetime. No APOC and no GDS procedures.',
].join('\n');

interface Row {
  nodeLabels?: string[];
  propertyName?: string | null;
  propertyTypes?: string[];
}
interface VizNode {
  id: number;
  labels?: string[];
}
interface VizRel {
  type: string;
  start_node: number;
  end_node: number;
}

const rows = (envelope: string): Row[] => {
  const env = JSON.parse(envelope) as { rows?: Row[] };
  return env.rows ?? [];
};

/**
 * The schema as the model reads it, from the engine's two answers: `CALL db.schema.nodeTypeProperties()`
 * (each label set with its properties and types) and `CALL db.schema.visualization()` (which labels each
 * relationship type joins). Both are the engine's wire JSON text.
 */
export function schemaText(nodeTypeProperties: string, visualization: string): string {
  const byLabels = new Map<string, string[]>();
  for (const r of rows(nodeTypeProperties)) {
    const key = (r.nodeLabels ?? []).map((l) => `:${l}`).join('');
    const props = byLabels.get(key) ?? [];
    if (r.propertyName) props.push(`${r.propertyName}: ${(r.propertyTypes ?? []).join('|').replace(/ NOT NULL/g, '') || 'ANY'}`);
    byLabels.set(key, props);
  }
  const lines = ['Nodes:', ...[...byLabels].map(([labels, props]) => `(${labels} {${props.join(', ')}})`)];
  const viz = (JSON.parse(visualization) as { rows?: { nodes?: VizNode[]; relationships?: VizRel[] }[] }).rows?.[0];
  const label = new Map((viz?.nodes ?? []).map((n) => [n.id, (n.labels ?? []).map((l) => `:${l}`).join('')]));
  const rels = new Set((viz?.relationships ?? []).map((r) => `(${label.get(r.start_node) ?? ''})-[:${r.type}]->(${label.get(r.end_node) ?? ''})`));
  lines.push('Relationships:', ...rels);
  return lines.join('\n');
}

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]+/g) ?? []);

export interface Shot {
  ask: string;
  query: string;
}

/** The dataset's worked questions, the ones sharing most words with `question` first, `skip` (a question under test) left out. */
export function shotsFor(scenarioId: string, question: string, count = 3, skip?: string): Shot[] {
  const q = words(question);
  const overlap = (s: string) => [...words(s)].filter((w) => q.has(w)).length;
  return SCENARIOS[scenarioId].demos
    .filter((d): d is typeof d & { ask: string } => !!d.ask && d.ask !== skip)
    .map((d) => ({ ask: d.ask, query: d.query.replace(/\s*\n\s*/g, ' ').trim() }))
    .sort((a, b) => overlap(b.ask) - overlap(a.ask))
    .slice(0, count)
    .reverse(); // the closest example last, next to the question
}

/** The conversation for one question: the rules and schema, the worked examples as earlier turns, then the question. */
export function messagesFor(scenarioId: string, schema: string, question: string, opts: { shots?: number; skip?: string } = {}): Message[] {
  const out: Message[] = [{ role: 'system', content: `${RULES}\n\nSchema:\n${schema}` }];
  for (const s of shotsFor(scenarioId, question, opts.shots ?? 3, opts.skip)) {
    out.push({ role: 'user', content: s.ask }, { role: 'assistant', content: s.query });
  }
  out.push({ role: 'user', content: question });
  return out;
}

/** The turn that gives a failed query's error back to the model once. */
export function retryMessages(messages: Message[], cypher: string, error: string): Message[] {
  return [
    ...messages,
    { role: 'assistant', content: cypher },
    { role: 'user', content: `That query failed: ${error.split('\n')[0]}\nReply with the corrected query only.` },
  ];
}

/** The query in a model's reply: the first code fence's body if it used one, else the text, without a trailing semicolon. */
export function extractCypher(reply: string): string {
  const fenced = reply.match(/```(?:cypher|cql)?\s*\n([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : reply).trim();
  return body.replace(/^cypher>\s*/i, '').replace(/;\s*$/, '').trim();
}
