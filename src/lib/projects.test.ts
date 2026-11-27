import test from 'node:test';
import assert from 'node:assert/strict';
import { DESCRIPTION_MAX, select, type RawRepo } from './projects.ts';
import { applyVerdicts, fetchedAt, openStore, ranked, toReview, upsert } from './projects-store.ts';
import { parseVerdicts, review, type Call } from './projects-review.ts';

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
  applyVerdicts(store, fixtures().map((p) => ok(p.fullName)), '2026-11-27');
  assert.deepEqual(ranked(store, 'activity').map((p) => p.fullName), ['b/new-mid', 'a/new-small', 'a/old-big']);
  assert.deepEqual(ranked(store, 'stars').map((p) => p.fullName), ['a/old-big', 'b/new-mid', 'a/new-small']);
  assert.equal(ranked(store, 'stars')[0].language, 'Rust');
  assert.equal(ranked(store, 'stars')[1].language, null);
  assert.equal(fetchedAt(store), '2026-11-27');
});

test('a refresh updates in place, unlists what left, keeps hidden and replaces changed relationships', () => {
  const store = openStore(':memory:');
  upsert(store, fixtures(), '2026-11-27');
  applyVerdicts(store, fixtures().map((p) => ok(p.fullName)), '2026-11-27');
  store.conn.query("MATCH (p:Project {fullName: 'a/new-small'}) SET p.hidden = true");

  const next = fixtures().filter((p) => p.fullName !== 'a/old-big').map((p) => (p.fullName === 'b/new-mid' ? { ...p, stars: 40, language: 'Go' } : p));
  upsert(store, next, '2026-12-04');
  applyVerdicts(store, next.map((p) => ok(p.fullName)), '2026-12-04');

  assert.deepEqual(ranked(store, 'stars').map((p) => [p.fullName, p.stars, p.language]), [['b/new-mid', 40, 'Go']]);
  const count = (q: string) => Number(store.conn.query(q).rows[0].n);
  assert.equal(count("MATCH (p:Project {fullName: 'a/old-big'}) RETURN count(p) AS n"), 1); // unlisted, not deleted
  assert.equal(count("MATCH (:Project {fullName: 'b/new-mid'})-[r:WRITTEN_IN]->() RETURN count(r) AS n"), 1); // the old language edge is gone
  assert.equal(fetchedAt(store), '2026-12-04');
});

const names = (store: ReturnType<typeof openStore>) => ranked(store, 'stars').map((p) => p.fullName).sort();
const ok = (fullName: string) => ({ fullName, verdict: 'ok' as const, category: null, reason: null });
const hide = (fullName: string) => ({ fullName, verdict: 'hide' as const, category: 'scam' as const, reason: 'crypto spam' });

test('parseVerdicts keeps well-formed answers for the batch and drops the rest', () => {
  const batch = [{ fullName: 'a/x', description: 'd', topics: [] }, { fullName: 'a/y', description: 'd', topics: [] }];
  const reply = 'Here you go:\n[{"fullName":"a/x","verdict":"hide","category":"scam","reason":"  crypto\\n spam "},{"fullName":"a/y","verdict":"maybe"},{"fullName":"z/other","verdict":"ok"},{"fullName":"a/x","verdict":"ok"}]';
  assert.deepEqual(parseVerdicts(reply, batch), [{ fullName: 'a/x', verdict: 'hide', category: 'scam', reason: 'crypto spam' }]);
  assert.deepEqual(parseVerdicts('no json', batch), []);
  assert.deepEqual(parseVerdicts('[{"fullName":"a/y","verdict":"hide","category":"nonsense"}]', batch)[0].category, 'other');
});

test('review batches, reports failures and leaves unanswered projects unreviewed', async () => {
  const items = Array.from({ length: 45 }, (_, i) => ({ fullName: `a/p${i}`, description: 'd', topics: [] }));
  let calls = 0;
  const call: Call = async (_system, user) => {
    calls++;
    if (calls === 2) throw new Error('boom');
    const batch = JSON.parse(user) as { fullName: string }[];
    return JSON.stringify(batch.slice(0, -1).map((b) => ({ fullName: b.fullName, verdict: 'ok' })));
  };
  const r = await review(items, call);
  assert.equal(calls, 3);
  assert.equal(r.errors.length, 1);
  assert.equal(r.verdicts.length, 19 + 4);
  assert.equal(r.unreviewed.length, 45 - 23);
});

test('a new project is pending until reviewed; a backfilled one stays visible; changed text goes pending again', () => {
  const store = openStore(':memory:');
  upsert(store, fixtures(), '2026-11-27');
  assert.deepEqual(names(store), []); // all new: pending
  assert.equal(toReview(store).length, 3);

  applyVerdicts(store, [ok('a/old-big'), ok('a/new-small'), hide('b/new-mid')], '2026-11-27');
  assert.deepEqual(names(store), ['a/new-small', 'a/old-big']); // the hidden one is out
  assert.equal(toReview(store).length, 0);

  const changed = fixtures().map((p) => (p.fullName === 'a/old-big' ? { ...p, description: 'now something else' } : p));
  upsert(store, changed, '2026-11-28');
  assert.deepEqual(names(store), ['a/new-small']); // changed text: pending
  assert.deepEqual(toReview(store).map((i) => i.fullName), ['a/old-big']);

  // a store from before the review existed: listed, unreviewed, not pending
  const legacy = openStore(':memory:');
  upsert(legacy, fixtures(), '2026-11-27');
  legacy.conn.query('MATCH (p:Project) SET p.pending = false REMOVE p.reviewedKey');
  upsert(legacy, fixtures(), '2026-11-28');
  assert.equal(names(legacy).length, 3);
  assert.equal(toReview(legacy).length, 3);
});

test('the model hides and re-shows only what it hid; a person’s hide and override win', () => {
  const store = openStore(':memory:');
  upsert(store, fixtures(), '2026-11-27');
  applyVerdicts(store, [hide('a/old-big'), ok('a/new-small'), ok('b/new-mid')], '2026-11-27');
  assert.ok(!names(store).includes('a/old-big'));

  // an edit gets it re-reviewed; this time it is fine, and the model un-hides what it hid
  upsert(store, fixtures().map((p) => (p.fullName === 'a/old-big' ? { ...p, description: 'edited' } : p)), '2026-11-28');
  applyVerdicts(store, [ok('a/old-big')], '2026-11-28');
  assert.ok(names(store).includes('a/old-big'));

  // a person hides one: a later ok from the model does not show it
  store.conn.query("MATCH (p:Project {fullName: 'a/new-small'}) SET p.hidden = true");
  upsert(store, fixtures().map((p) => (p.fullName === 'a/new-small' ? { ...p, description: 'edited' } : p)), '2026-11-29');
  applyVerdicts(store, [ok('a/new-small')], '2026-11-29');
  assert.ok(!names(store).includes('a/new-small'));

  // a person shows one with override: a later hide from the model does not hide it
  store.conn.query("MATCH (p:Project {fullName: 'b/new-mid'}) SET p.hidden = false, p.override = true");
  upsert(store, fixtures().map((p) => (p.fullName === 'b/new-mid' ? { ...p, description: 'edited' } : p)), '2026-11-30');
  applyVerdicts(store, [hide('b/new-mid')], '2026-11-30');
  assert.ok(names(store).includes('b/new-mid'));
});
