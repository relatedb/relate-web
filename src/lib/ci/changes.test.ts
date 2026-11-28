import test from 'node:test';
import assert from 'node:assert/strict';
import { kindOf, plan } from './changes.ts';

test('kindOf sorts paths into the lighter kinds, and everything else is other', () => {
  assert.equal(kindOf('src/data/projects.relate/graph.json'), 'projects-data');
  assert.equal(kindOf('src/data/projects.relate/wal/00000009.log'), 'projects-data');
  assert.equal(kindOf('src/content/blog/relate-1-4-0.md'), 'blog');
  assert.equal(kindOf('public/blog/web-integrations.jpg'), 'blog');
  assert.equal(kindOf('docs/adr/0075-x.md'), 'meta');
  assert.equal(kindOf('runbooks/release-discovery.md'), 'meta');
  assert.equal(kindOf('AGENTS.md'), 'meta');
  assert.equal(kindOf('.github/workflows/release-post.yml'), 'meta');
  assert.equal(kindOf('.github/dependabot.yml'), 'meta');
  assert.equal(kindOf('scripts/release-post/prompt.md'), 'meta');
  // the Cookbook workflow is the plan's own: a change to it runs everything
  assert.equal(kindOf('.github/workflows/cookbook.yml'), 'other');
  for (const p of ['src/pages/projects/index.astro', 'src/lib/projects.ts', 'src/content/docs/_data/cli.json', 'src/styles/base.css', 'package.json', 'scripts/docs.ts', 'public/wasm/relate.js', 'src/data/other.json', 'public/skills/relate/SKILL.md', 'src/content/blog-extra/x.md', 'docs/other.md']) {
    assert.equal(kindOf(p), 'other', p);
  }
  assert.equal(kindOf('./AGENTS.md'), 'meta');
});

test('plan: the projects store alone needs no build and no browser', () => {
  const p = plan(['src/data/projects.relate/graph.json', 'src/data/projects.relate/manifest.json']);
  assert.deepEqual([p.profile, p.docs, p.build, p.browser], ['projects-data', false, false, false]);
});

test('plan: a blog post builds the site but skips the docs checks and the browser', () => {
  const p = plan(['src/content/blog/relate-1-4-0.md', 'public/blog/x.jpg']);
  assert.deepEqual([p.profile, p.docs, p.build, p.browser], ['blog', false, true, false]);
  // with notes and the store beside it, still the blog profile
  assert.equal(plan(['src/content/blog/a.md', 'AGENTS.md', 'src/data/projects.relate/graph.json']).profile, 'blog');
});

test('plan: notes, records and other workflows run only the always-on checks', () => {
  const p = plan(['docs/adr/0075-x.md', 'runbooks/a.md', '.github/workflows/release-post.yml']);
  assert.deepEqual([p.profile, p.docs, p.build, p.browser], ['meta', false, false, false]);
});

test('plan: any other path, or no paths, runs everything', () => {
  for (const files of [[], ['src/styles/base.css'], ['AGENTS.md', 'src/lib/projects.ts'], ['src/content/blog/a.md', 'package.json'], ['.github/workflows/cookbook.yml']]) {
    const p = plan(files);
    assert.deepEqual([p.profile, p.docs, p.build, p.browser], ['full', true, true, true], files.join(','));
  }
  assert.match(plan(['AGENTS.md', 'src/lib/projects.ts']).reason, /src\/lib\/projects\.ts/);
});
