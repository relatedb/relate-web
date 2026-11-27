import test from 'node:test';
import assert from 'node:assert/strict';
import { byActivity, byStars, DESCRIPTION_MAX, select, type RawRepo } from './projects.ts';

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
const curation = { excludeOwners: ['relatedb'], exclude: ['someone/off-topic'] };

test('select drops forks, archived, private, undescribed, the project’s own and excluded repos', () => {
  const kept = select(
    [
      repo({ full_name: 'a/keep' }),
      repo({ full_name: 'a/fork', fork: true }),
      repo({ full_name: 'a/old', archived: true }),
      repo({ full_name: 'a/secret', private: true }),
      repo({ full_name: 'a/blank', description: '  ' }),
      repo({ full_name: 'a/none', description: null }),
      repo({ full_name: 'RelateDB/site' }),
      repo({ full_name: 'Someone/Off-Topic' }),
    ],
    curation,
  );
  assert.deepEqual(kept.map((p) => p.fullName), ['a/keep']);
});

test('select tidies and clips descriptions and drops duplicates', () => {
  const long = 'x'.repeat(DESCRIPTION_MAX + 50);
  const kept = select([repo({ full_name: 'a/b', description: ' two\n words ' }), repo({ full_name: 'A/B' }), repo({ full_name: 'a/long', description: long })], curation);
  assert.equal(kept.length, 2);
  assert.equal(kept[0].description, 'two words');
  assert.equal(kept[1].description.length, DESCRIPTION_MAX);
  assert.ok(kept[1].description.endsWith('…'));
});

test('byActivity and byStars rank with stable tie-breaks and do not mutate', () => {
  const list = select(
    [
      repo({ full_name: 'a/old-big', stargazers_count: 9, pushed_at: '2026-01-01T00:00:00Z' }),
      repo({ full_name: 'a/new-small', stargazers_count: 1, pushed_at: '2026-11-20T00:00:00Z' }),
      repo({ full_name: 'a/new-mid', stargazers_count: 4, pushed_at: '2026-11-20T00:00:00Z' }),
    ],
    curation,
  );
  const before = list.map((p) => p.fullName);
  assert.deepEqual(byActivity(list).map((p) => p.fullName), ['a/new-mid', 'a/new-small', 'a/old-big']);
  assert.deepEqual(byStars(list).map((p) => p.fullName), ['a/old-big', 'a/new-mid', 'a/new-small']);
  assert.deepEqual(list.map((p) => p.fullName), before);
});
