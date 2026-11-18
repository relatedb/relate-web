import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { absolute, articleGraph, canonicalPath, CONTENT_SIGNALS, contentSignal, homeGraph, indexable, jsonLdText, robotsTxt } from '../seo.ts';

afterEach(() => {
  delete process.env.PUBLIC_INDEXABLE;
});

describe('indexing switch', () => {
  test('is on unless PUBLIC_INDEXABLE is exactly false', () => {
    assert.equal(indexable(), true);
    process.env.PUBLIC_INDEXABLE = 'true';
    assert.equal(indexable(), true);
    process.env.PUBLIC_INDEXABLE = '0';
    assert.equal(indexable(), true);
    process.env.PUBLIC_INDEXABLE = 'false';
    assert.equal(indexable(), false);
  });

  test('robots.txt follows it', () => {
    const lines = robotsTxt().split('\n').filter((l) => !l.startsWith('#'));
    assert.equal(lines.join('\n'), 'User-agent: *\nContent-Signal: search=yes, ai-input=yes, ai-train=yes\nAllow: /\n\nSitemap: https://relatedb.ai/sitemap.xml\n');
    process.env.PUBLIC_INDEXABLE = 'false';
    assert.equal(robotsTxt(), 'User-agent: *\nDisallow: /\n');
  });

  test('robots.txt declares the three content signals, once, in the group for every crawler (ADR-0070)', () => {
    const txt = robotsTxt();
    const lines = txt.split('\n');
    const signal = lines.filter((l) => /^content-signal:/i.test(l));
    assert.equal(signal.length, 1);
    assert.equal(signal[0], `Content-Signal: ${contentSignal()}`);
    assert.deepEqual(CONTENT_SIGNALS.map(([name]) => name).sort(), ['ai-input', 'ai-train', 'search']);
    for (const [, value] of CONTENT_SIGNALS) assert.match(value, /^(yes|no)$/);
    // In the `User-agent: *` group: after its first line, before the blank line that ends it.
    const group = lines.slice(lines.indexOf('User-agent: *'), lines.indexOf(''));
    assert.ok(group.includes(signal[0]));
    // Every line a crawler does not parse is a comment, and the comment names each signal.
    for (const [name] of CONTENT_SIGNALS) assert.ok(lines.some((l) => l.startsWith('#') && l.includes(name)), name);
    assert.ok(lines.every((l) => l === '' || /^(#|User-agent:|Content-Signal:|Allow:|Sitemap:)/.test(l)));
    // A preview build disallows every path and declares no signal.
    process.env.PUBLIC_INDEXABLE = 'false';
    assert.doesNotMatch(robotsTxt(), /content-signal/i);
  });
});

describe('urls', () => {
  test('canonicalPath gives one trailing slash', () => {
    assert.equal(canonicalPath('/docs/get-started'), '/docs/get-started/');
    assert.equal(canonicalPath('/docs/get-started/'), '/docs/get-started/');
    assert.equal(canonicalPath('/docs/get-started/index.html'), '/docs/get-started/');
    assert.equal(canonicalPath('/'), '/');
  });

  test('absolute names the canonical origin, not the preview host', () => {
    assert.equal(absolute('/og/default.png'), 'https://relatedb.ai/og/default.png');
  });
});

describe('structured data', () => {
  test('the home graph names the project, the site and the software at the release', () => {
    const graph = (homeGraph({ version: '0.1.2', date: '2026-11-09' }, 'd') as { '@graph': Record<string, unknown>[] })['@graph'];
    assert.deepEqual(graph.map((n) => n['@type']), ['Organization', 'WebSite', 'SoftwareApplication']);
    assert.equal(graph[2].softwareVersion, '0.1.2');
    assert.deepEqual(graph[2].offers, { '@type': 'Offer', price: '0', priceCurrency: 'USD' });
  });

  test('an article carries its trail ending at the page, skipping crumbs with no link', () => {
    const data = articleGraph({
      title: 'Use relate in CI',
      description: 'd',
      path: '/docs/guides/agents/use-in-ci',
      modified: '2026-11-09',
      published: '2026-09-01',
      crumbs: [
        { label: 'Docs', href: '/docs/' },
        { label: 'Guides', href: null },
      ],
    }) as { '@graph': Record<string, unknown>[] };
    const [article, trail] = data['@graph'];
    assert.equal(article['@type'], 'TechArticle');
    assert.equal(article.url, 'https://relatedb.ai/docs/guides/agents/use-in-ci/');
    assert.equal(article.dateModified, '2026-11-09');
    assert.equal(article.datePublished, '2026-09-01');
    const items = trail.itemListElement as { position: number; name: string; item: string }[];
    assert.deepEqual(items.map((i) => [i.position, i.name]), [[1, 'Docs'], [2, 'Use relate in CI']]);
    assert.equal(items[1].item, 'https://relatedb.ai/docs/guides/agents/use-in-ci/');
  });

  test('a page with no trail has no breadcrumb list', () => {
    const data = articleGraph({ title: 'T', description: 'd', path: '/x/' }) as { '@graph': unknown[] };
    assert.equal(data['@graph'].length, 1);
  });

  test('json text cannot close the script tag', () => {
    assert.ok(!jsonLdText({ a: '</script><b>' }).includes('<'));
  });
});
