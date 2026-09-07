import assert from 'node:assert/strict';
import test from 'node:test';

import { collectStats, escapeXml, renderMetricsSvg, renderPulseSvg } from './render-profile.mjs';

const repos = [
  {
    name: 'Project1',
    fork: false,
    stargazers_count: 3,
    forks_count: 1,
    pushed_at: '2026-09-01T00:00:00Z',
    languages: { Java: 800, TypeScript: 200 }
  },
  {
    name: 'notes',
    fork: false,
    stargazers_count: 2,
    forks_count: 0,
    pushed_at: '2025-01-01T00:00:00Z',
    languages: { Java: 200, SQL: 100 }
  },
  {
    name: 'forked-repository',
    fork: true,
    stargazers_count: 99,
    forks_count: 99,
    pushed_at: '2026-09-01T00:00:00Z',
    languages: { Python: 9999 }
  }
];

test('collectStats excludes forks and aggregates owned repository signals', () => {
  const stats = collectStats(repos, new Date('2026-09-07T00:00:00Z'));

  assert.equal(stats.repositories, 2);
  assert.equal(stats.focusRepositories, 1);
  assert.equal(stats.activeRepositories, 1);
  assert.equal(stats.latestPush, '2026-09-01T00:00:00Z');
  assert.deepEqual(stats.languages.slice(0, 2), [
    ['Java', 800],
    ['TypeScript', 200]
  ]);
});

test('SVG renderers escape dynamic values and include accessible metadata', () => {
  const stats = collectStats(repos, new Date('2026-09-07T00:00:00Z'));
  const metrics = renderMetricsSvg(stats, 'Dung & Co', new Date('2026-09-07T00:00:00Z'));
  const pulse = renderPulseSvg('Dung & Co', new Date('2026-09-07T00:00:00Z'));

  assert.match(metrics, /Dung &amp; Co/);
  assert.match(metrics, /role="img"/);
  assert.match(metrics, /Java/);
  assert.match(pulse, /animateMotion/);
  assert.match(pulse, /prefers-reduced-motion/);
});

test('escapeXml handles all XML-sensitive characters', () => {
  assert.equal(escapeXml(`<tag a="x">Tom & Jerry's</tag>`), '&lt;tag a=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/tag&gt;');
});
