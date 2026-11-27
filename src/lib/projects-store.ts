// The projects store (ADR-0076): the listed repositories as a relate graph, a directory store
// with the `json` codec so a refresh shows up as a diff in `git diff`. Node only: the refresh
// script, the /projects/ page at build and the tests share it.
//
//   (:Project {fullName, url, description, stars, pushedAt, listed, contentKey, reviewedKey?,
//              pending?, hidden?, hiddenBy?, hiddenReason?, override?})
//     -[:OWNED_BY]->(:Owner {login})
//     -[:WRITTEN_IN]->(:Language {name})
//     -[:TAGGED]->(:Topic {name})
//   (:Refresh {id: 'latest', at})
//
// Review (projects-review.ts): `contentKey` hashes the text the model reads; `reviewedKey` is the key
// at the last review. A new project, or a reviewed one whose text changed, is `pending` (not shown)
// until its next review. `hidden` is set by the model (`hiddenBy: 'model'`) or by hand (a
// `relate query` statement); a person who shows a project again sets `override`, and the model
// never hides it after that.
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { Project } from './projects.ts';
import type { ReviewItem, Verdict } from './projects-review.ts';

type Value = string | number | boolean | null;
interface Connection { query(cypher: string, params?: Record<string, unknown>): { rows: Record<string, Value>[] }; begin(): void; commit(): unknown; rollback(): void }
interface Db { connect(): Connection; checkpoint(): void }
type Open = (uri: string, options?: { readOnly?: boolean }) => Db;

// @relate/relate is CommonJS and loads a native library: load it with require, once.
const { Database } = createRequire(import.meta.url)('@relate/relate') as { Database: { open: Open } };

/** The committed store. */
export const STORE_DIR = join(process.cwd(), 'src', 'data', 'projects.relate');

export interface Store { db: Db; conn: Connection }

/** Opens the store (a new directory store is created with the json codec). `:memory:` for tests. */
export function openStore(uri: string = STORE_DIR, options: { readOnly?: boolean } = {}): Store {
  process.env.RELATE_SNAPSHOT_FORMAT ??= 'json';
  const db = Database.open(uri, options);
  return { db, conn: db.connect() };
}

const SCHEMA = [
  'CREATE CONSTRAINT project_full_name IF NOT EXISTS FOR (p:Project) REQUIRE p.fullName IS UNIQUE',
  'CREATE CONSTRAINT owner_login IF NOT EXISTS FOR (o:Owner) REQUIRE o.login IS UNIQUE',
  'CREATE CONSTRAINT language_name IF NOT EXISTS FOR (l:Language) REQUIRE l.name IS UNIQUE',
  'CREATE CONSTRAINT topic_name IF NOT EXISTS FOR (t:Topic) REQUIRE t.name IS UNIQUE',
];

/**
 * Brings the store in line with a refresh, in one transaction: every project in `listings` is
 * created or updated and marked listed; a project that is no longer there is marked unlisted, not
 * deleted, so its history stays. `hidden` is left alone.
 */
export const contentKey = (p: Pick<Project, 'fullName' | 'description' | 'topics'>): string =>
  createHash('sha256').update(JSON.stringify([p.fullName, p.description, p.topics ?? []])).digest('hex').slice(0, 16);

/**
 * Brings the store in line with a refresh, in one transaction: every project in `listings` is
 * created or updated and marked listed; a project that is no longer there is marked unlisted, not
 * deleted, so its history stays. A new project, and a reviewed one whose text changed, is marked
 * pending. `hidden` and `override` are left alone.
 */
export function upsert({ db, conn }: Store, listings: Project[], fetchedAt: string): void {
  for (const s of SCHEMA) conn.query(s);
  const known = new Map<string, { reviewedKey: string | null; pending: boolean }>();
  for (const r of conn.query('MATCH (p:Project) RETURN p.fullName AS n, p.reviewedKey AS rk, p.pending AS pending').rows) {
    known.set(r.n as string, { reviewedKey: (r.rk as string | null) ?? null, pending: r.pending === true });
  }
  conn.begin();
  try {
    for (const p of listings) {
      const owner = p.fullName.split('/')[0];
      const key = contentKey(p);
      const was = known.get(p.fullName);
      const pending = !was || was.pending || (was.reviewedKey !== null && was.reviewedKey !== key);
      const args = { fullName: p.fullName, url: p.url, description: p.description, stars: p.stars, pushedAt: p.pushedAt, owner, language: p.language, topics: p.topics ?? [], key, pending };
      conn.query(
        `MERGE (p:Project {fullName: $fullName})
         SET p.url = $url, p.description = $description, p.stars = $stars, p.pushedAt = $pushedAt, p.listed = true, p.contentKey = $key, p.pending = $pending
         WITH p
         OPTIONAL MATCH (p)-[old:OWNED_BY|WRITTEN_IN|TAGGED]->() DELETE old`,
        args,
      );
      conn.query('MATCH (p:Project {fullName: $fullName}) MERGE (o:Owner {login: $owner}) MERGE (p)-[:OWNED_BY]->(o)', args);
      if (p.language) conn.query('MATCH (p:Project {fullName: $fullName}) MERGE (l:Language {name: $language}) MERGE (p)-[:WRITTEN_IN]->(l)', args);
      if (args.topics.length) conn.query('MATCH (p:Project {fullName: $fullName}) UNWIND $topics AS t MERGE (n:Topic {name: t}) MERGE (p)-[:TAGGED]->(n)', args);
    }
    conn.query('MATCH (p:Project) WHERE NOT p.fullName IN $names SET p.listed = false', { names: listings.map((p) => p.fullName) });
    conn.query("MERGE (r:Refresh {id: 'latest'}) SET r.at = $at", { at: fetchedAt });
    conn.commit();
  } catch (e) {
    conn.rollback();
    throw e;
  }
  db.checkpoint();
}

/** What the review step must look at: listed projects never reviewed, or changed since their review. */
export function toReview({ conn }: Store): ReviewItem[] {
  const { rows } = conn.query(
    `MATCH (p:Project) WHERE p.listed AND (p.reviewedKey IS NULL OR p.reviewedKey <> p.contentKey)
     OPTIONAL MATCH (p)-[:TAGGED]->(t:Topic)
     WITH p, collect(t.name) AS topics
     RETURN p.fullName AS fullName, p.description AS description, topics ORDER BY fullName`,
  );
  return rows.map((r) => ({ fullName: r.fullName as string, description: r.description as string, topics: ((r.topics as unknown as string[] | null) ?? []).slice().sort() }));
}

/**
 * Records verdicts, in one transaction. A project reviewed is no longer pending. `hide` hides it
 * (as the model) unless a person has set `override`; `ok` shows it again only if the model was
 * what hid it, never when a person did.
 */
export function applyVerdicts({ db, conn }: Store, verdicts: Verdict[], at: string): void {
  conn.begin();
  try {
    for (const v of verdicts) {
      const cur = conn.query('MATCH (p:Project {fullName: $f}) RETURN p.hidden AS hidden, p.hiddenBy AS by, p.override AS override', { f: v.fullName }).rows[0];
      if (!cur) continue;
      let hidden = cur.hidden === true;
      let by = (cur.by as string | null) ?? null;
      if (v.verdict === 'hide' && cur.override !== true && !hidden) {
        hidden = true;
        by = 'model';
      } else if (v.verdict === 'ok' && hidden && by === 'model') {
        hidden = false;
        by = null;
      }
      conn.query(
        `MATCH (p:Project {fullName: $f})
         SET p.reviewedKey = p.contentKey, p.reviewedAt = $at, p.pending = false, p.hidden = $hidden, p.hiddenBy = $by,
             p.hiddenReason = $reason, p.reviewCategory = $category`,
        { f: v.fullName, at, hidden, by, reason: v.verdict === 'hide' ? v.reason : null, category: v.verdict === 'hide' ? v.category : null },
      );
    }
    conn.commit();
  } catch (e) {
    conn.rollback();
    throw e;
  }
  db.checkpoint();
}

/** The projects the model has hidden, for the refresh log. */
export function hiddenByModel({ conn }: Store): { fullName: string; category: string | null; reason: string | null }[] {
  return conn.query("MATCH (p:Project) WHERE p.hidden AND p.hiddenBy = 'model' RETURN p.fullName AS fullName, p.reviewCategory AS category, p.hiddenReason AS reason ORDER BY fullName").rows as never;
}

export type Ranking = 'activity' | 'stars';

const ORDER: Record<Ranking, string> = {
  activity: 'pushedAt DESC, stars DESC, fullName',
  stars: 'stars DESC, pushedAt DESC, fullName',
};

/** The listed, not hidden projects in the order of a ranking. */
export function ranked({ conn }: Store, by: Ranking): Project[] {
  const { rows } = conn.query(
    `MATCH (p:Project) WHERE p.listed AND coalesce(p.hidden, false) = false AND coalesce(p.pending, false) = false
     OPTIONAL MATCH (p)-[:WRITTEN_IN]->(l:Language)
     RETURN p.fullName AS fullName, p.url AS url, p.description AS description, p.stars AS stars, l.name AS language, p.pushedAt AS pushedAt
     ORDER BY ${ORDER[by]}`,
  );
  return rows as unknown as Project[];
}

/** The day of the last refresh, or null for a store that has never been refreshed. */
export function fetchedAt({ conn }: Store): string | null {
  const { rows } = conn.query("MATCH (r:Refresh {id: 'latest'}) RETURN r.at AS at");
  return (rows[0]?.at as string | undefined) ?? null;
}
