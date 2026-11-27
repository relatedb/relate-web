import test from 'node:test';
import assert from 'node:assert/strict';
import { DESCRIPTION_MAX, select, type RawRepo } from './projects.ts';
import { fetchedAt, openStore, ranked, upsert } from './projects-store.ts';

const repo = (over: Partial<RawRepo> & { full_name: string }): RawRepo => ({
  html_url: `https://github.com/${over.full_name}`,
  description: 'A graph thing',
  stargazers_count: 0,
  language: null,
  pushed_at: '2026-11-01T00:00:00Z',
  fork: false,
  archived: false,
  owner: { login: over.full_name.split('/')[0] },
  ...over,
});

test('select drops forks, archived, private, undescribed and the project’s own repos', () => {
  const kept = select([
    repo({ full_name: 'a/keep' }),
    repo({ full_name: 'a/fork', fork: true }),
    repo({ full_name: 'a/old', archived: true }),
    repo({ full_name: 'a/secret', private: true }),
    repo({ full_name: 'a/blank', description: '  ' }),
    repo({ full_name: 'a/none', description: null }),
    repo({ full_name: 'RelateDB/site' }),
  ]);
  assert.deepEqual(kept.map((p) => p.fullName), ['a/keep']);
});

test('select tidies and clips descriptions, lowercases topics and drops duplicates', () => {
  const long = 'x'.repeat(DESCRIPTION_MAX + 50);
  const kept = select([repo({ full_name: 'a/b', description: ' two\n words ', topics: ['Relate', 'graph', 'graph'] }), repo({ full_name: 'A/B' }), repo({ full_name: 'a/long', description: long })]);
  assert.equal(kept.length, 2);
  assert.equal(kept[0].description, 'two words');
  assert.deepEqual(kept[0].topics, ['graph', 'relate']);
  assert.equal(kept[1].description.length, DESCRIPTION_MAX);
  assert.ok(kept[1].description.endsWith('…'));
});

const fixtures = () =>
  select([
    repo({ full_name: 'a/old-big', stargazers_count: 9, pushed_at: '2026-01-01T00:00:00Z', language: 'Rust', topics: ['relate', 'rag'] }),
    repo({ full_name: 'a/new-small', stargazers_count: 1, pushed_at: '2026-11-20T00:00:00Z', language: 'Python' }),
    repo({ full_name: 'b/new-mid', stargazers_count: 4, pushed_at: '2026-11-20T00:00:00Z' }),
  ]);

test('the store ranks by activity and by stars, with stable tie-breaks', () => {
  const store = openStore(':memory:');
  upsert(store, fixtures(), '2026-11-27');
  assert.deepEqual(ranked(store, 'activity').map((p) => p.fullName), ['b/new-mid', 'a/new-small', 'a/old-big']);
  assert.deepEqual(ranked(store, 'stars').map((p) => p.fullName), ['a/old-big', 'b/new-mid', 'a/new-small']);
  assert.equal(ranked(store, 'stars')[0].language, 'Rust');
  assert.equal(ranked(store, 'stars')[1].language, null);
  assert.equal(fetchedAt(store), '2026-11-27');
});

test('a refresh updates in place, unlists what left, keeps hidden and replaces changed relationships', () => {
  const store = openStore(':memory:');
  upsert(store, fixtures(), '2026-11-27');
  store.conn.query("MATCH (p:Project {fullName: 'a/new-small'}) SET p.hidden = true");

  const next = fixtures().filter((p) => p.fullName !== 'a/old-big').map((p) => (p.fullName === 'b/new-mid' ? { ...p, stars: 40, language: 'Go' } : p));
  upsert(store, next, '2026-12-04');

  assert.deepEqual(ranked(store, 'stars').map((p) => [p.fullName, p.stars, p.language]), [['b/new-mid', 40, 'Go']]);
  const count = (q: string) => Number(store.conn.query(q).rows[0].n);
  assert.equal(count("MATCH (p:Project {fullName: 'a/old-big'}) RETURN count(p) AS n"), 1); // unlisted, not deleted
  assert.equal(count("MATCH (:Project {fullName: 'b/new-mid'})-[r:WRITTEN_IN]->() RETURN count(r) AS n"), 1); // the old language edge is gone
  assert.equal(fetchedAt(store), '2026-12-04');
});
