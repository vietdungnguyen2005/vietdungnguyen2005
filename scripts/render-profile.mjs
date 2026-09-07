import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_USERNAME = 'vietdungnguyen2005';
const API_ROOT = 'https://api.github.com';
const OUTPUT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'generated');
const FOCUS_REPOSITORIES = new Set(['Project1', 'Project2', 'Project3']);

export function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function headers(token) {
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'vietdungnguyen2005-profile-renderer',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function request(path, token) {
  const response = await fetch(`${API_ROOT}${path}`, { headers: headers(token) });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} for ${path}`);
  }
  return response.json();
}

async function fetchOwnedRepositories(username, token) {
  const repositories = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await request(
      `/users/${encodeURIComponent(username)}/repos?type=owner&sort=updated&per_page=100&page=${page}`,
      token
    );
    repositories.push(...batch);
    if (batch.length < 100) break;
  }

  const owned = repositories.filter((repository) => !repository.fork);
  return Promise.all(
    owned.map(async (repository) => ({
      ...repository,
      languages: await request(`/repos/${repository.full_name}/languages`, token)
    }))
  );
}

export function collectStats(repositories, now = new Date()) {
  const owned = repositories.filter((repository) => !repository.fork);
  const focused = owned.filter((repository) => FOCUS_REPOSITORIES.has(repository.name));
  const languageSources = focused.length > 0 ? focused : owned;
  const languageTotals = new Map();
  const activityThreshold = new Date(now);
  activityThreshold.setUTCDate(activityThreshold.getUTCDate() - 90);

  for (const repository of languageSources) {
    for (const [language, bytes] of Object.entries(repository.languages ?? {})) {
      languageTotals.set(language, (languageTotals.get(language) ?? 0) + bytes);
    }
  }

  return {
    repositories: owned.length,
    focusRepositories: focused.length,
    activeRepositories: owned.filter((repository) => new Date(repository.pushed_at) >= activityThreshold).length,
    latestPush: owned.reduce(
      (latest, repository) => (repository.pushed_at > latest ? repository.pushed_at : latest),
      ''
    ),
    languages: [...languageTotals.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5)
  };
}

function themeStyles() {
  return `
    :root { color-scheme: light dark; }
    .surface { fill: #f6f8fa; stroke: #d0d7de; }
    .panel { fill: #ffffff; stroke: #d0d7de; }
    .grid { stroke: #d8dee4; }
    .text { fill: #1f2328; }
    .muted { fill: #59636e; }
    .accent { fill: #1f883d; }
    .accent-stroke { stroke: #1f883d; }
    .blue { fill: #0969da; }
    .purple { fill: #8250df; }
    .orange { fill: #bc4c00; }
    @media (prefers-color-scheme: dark) {
      .surface { fill: #0d1117; stroke: #30363d; }
      .panel { fill: #161b22; stroke: #30363d; }
      .grid { stroke: #21262d; }
      .text { fill: #e6edf3; }
      .muted { fill: #8b949e; }
      .accent { fill: #3fb950; }
      .accent-stroke { stroke: #3fb950; }
      .blue { fill: #58a6ff; }
      .purple { fill: #bc8cff; }
      .orange { fill: #ffa657; }
    }
    text { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  `;
}

function normalizeSvg(svg) {
  return svg.replace(/[ \t]+$/gm, '').replace(/^\n+|\n+$/g, '');
}

function languageRows(languages) {
  const total = languages.reduce((sum, [, bytes]) => sum + bytes, 0) || 1;
  const colors = ['accent', 'blue', 'purple', 'orange', 'muted'];
  let offset = 0;
  const bars = languages
    .map(([language, bytes], index) => {
      const width = (bytes / total) * 400;
      const segment = `<rect class="${colors[index]}" x="${440 + offset}" y="117" width="${Math.max(width, 2).toFixed(1)}" height="8" rx="4"/>`;
      offset += width;
      return segment;
    })
    .join('');
  const labels = languages
    .slice(0, 4)
    .map(([language, bytes], index) => {
      const percentage = Math.round((bytes / total) * 100);
      const x = 440 + (index % 2) * 205;
      const y = 155 + Math.floor(index / 2) * 28;
      return `<circle class="${colors[index]}" cx="${x + 5}" cy="${y - 4}" r="4"/><text class="muted" x="${x + 16}" y="${y}" font-size="13">${escapeXml(language)} ${percentage}%</text>`;
    })
    .join('');
  return { bars, labels };
}

export function renderMetricsSvg(stats, username, generatedAt = new Date()) {
  const { bars, labels } = languageRows(stats.languages);
  const date = generatedAt.toISOString().slice(0, 10);
  return normalizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="250" viewBox="0 0 900 250" role="img" aria-labelledby="title description">
  <title id="title">Live GitHub signals for ${escapeXml(username)}</title>
  <desc id="description">Owned repositories, recent activity, backend case studies and selected portfolio languages. Refreshed ${date}.</desc>
  <style>${themeStyles()}</style>
  <rect class="surface" x="1" y="1" width="898" height="248" rx="12"/>
  <path class="grid" opacity=".55" d="M20 54H880M420 70V225"/>
  <circle class="accent" cx="25" cy="27" r="5"/><text class="text" x="40" y="33" font-size="17" font-weight="700">github://live-signals</text>
  <text class="muted" x="876" y="32" text-anchor="end" font-size="12">refreshed ${date}</text>

  <text class="muted" x="28" y="91" font-size="12">OWNED REPOSITORIES</text>
  <text class="text" x="28" y="132" font-size="34" font-weight="700">${stats.repositories}</text>
  <text class="muted" x="220" y="91" font-size="12">ACTIVE / 90 DAYS</text>
  <text class="text" x="220" y="132" font-size="34" font-weight="700">${stats.activeRepositories}</text>
  <text class="text" x="28" y="218" font-size="34" font-weight="700">${stats.focusRepositories}</text>
  <text class="muted" x="28" y="180" font-size="12">BACKEND CASE STUDIES</text>
  <text class="muted" x="220" y="180" font-size="12">LATEST PUSH</text>
  <text class="text" x="220" y="216" font-size="18" font-weight="700">${escapeXml(stats.latestPush.slice(0, 10) || 'n/a')}</text>

  <text class="text" x="440" y="91" font-size="15" font-weight="700">portfolio language footprint</text>
  ${bars}
  ${labels}
  <text class="muted" x="440" y="218" font-size="12">selected Project1–3 · generated by repository code</text>
</svg>`);
}

export function renderPulseSvg(username, generatedAt = new Date()) {
  const date = generatedAt.toISOString().slice(0, 10);
  return normalizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="260" viewBox="0 0 1000 260" role="img" aria-labelledby="title description">
  <title id="title">Backend request pulse by ${escapeXml(username)}</title>
  <desc id="description">An animated request travels through validation, transaction, PostgreSQL and evidence.</desc>
  <style>
    ${themeStyles()}
    .route { fill: none; stroke-width: 2; stroke-dasharray: 5 7; opacity: .65; }
    .node { stroke-width: 1; }
    .packet { filter: drop-shadow(0 0 5px rgba(63,185,80,.75)); }
    .cursor { animation: blink 1.1s steps(2, jump-none) infinite; }
    .scan { animation: scan 5s linear infinite; opacity: .11; }
    @keyframes blink { 50% { opacity: 0; } }
    @keyframes scan { from { transform: translateX(-260px); } to { transform: translateX(1100px); } }
    @media (prefers-reduced-motion: reduce) { .cursor, .scan { animation: none; } }
  </style>
  <defs>
    <pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle class="grid" cx="1" cy="1" r="1"/></pattern>
    <linearGradient id="scanGradient" x1="0" x2="1"><stop stop-color="#3fb950" stop-opacity="0"/><stop offset=".5" stop-color="#3fb950"/><stop offset="1" stop-color="#3fb950" stop-opacity="0"/></linearGradient>
    <path id="requestRoute" d="M112 174 C180 174 178 122 248 122 S322 174 392 174 S466 122 536 122 S610 174 680 174 S754 122 824 122 S876 174 920 174"/>
  </defs>
  <rect class="surface" x="1" y="1" width="998" height="258" rx="12"/>
  <rect x="1" y="1" width="998" height="258" rx="12" fill="url(#dots)" opacity=".65"/>
  <rect class="scan" x="0" y="0" width="230" height="260" fill="url(#scanGradient)"/>

  <text class="muted" x="35" y="38" font-size="13">~/backend-lab</text>
  <text class="text" x="35" y="76" font-size="23" font-weight="700">$ protect the invariant, then ship</text><rect class="accent cursor" x="543" y="56" width="10" height="24"/>
  <text class="muted" x="965" y="38" text-anchor="end" font-size="11">build ${date}</text>

  <use href="#requestRoute" class="route accent-stroke"/>
  <circle class="accent packet" r="7"><animateMotion dur="5.6s" repeatCount="indefinite"><mpath href="#requestRoute"/></animateMotion></circle>
  <circle class="blue packet" r="4"><animateMotion dur="5.6s" begin="-2.8s" repeatCount="indefinite"><mpath href="#requestRoute"/></animateMotion></circle>

  <g text-anchor="middle">
    <rect class="panel node" x="55" y="145" width="114" height="58" rx="8"/><text class="text" x="112" y="170" font-size="13" font-weight="700">request</text><text class="muted" x="112" y="188" font-size="10">untrusted input</text>
    <rect class="panel node" x="191" y="93" width="114" height="58" rx="8"/><text class="text" x="248" y="118" font-size="13" font-weight="700">validate</text><text class="muted" x="248" y="136" font-size="10">boundary first</text>
    <rect class="panel node" x="335" y="145" width="114" height="58" rx="8"/><text class="text" x="392" y="170" font-size="13" font-weight="700">service</text><text class="muted" x="392" y="188" font-size="10">business rules</text>
    <rect class="panel node" x="479" y="93" width="114" height="58" rx="8"/><text class="text" x="536" y="118" font-size="13" font-weight="700">transaction</text><text class="muted" x="536" y="136" font-size="10">atomic change</text>
    <rect class="panel node" x="623" y="145" width="114" height="58" rx="8"/><text class="text" x="680" y="170" font-size="13" font-weight="700">postgres</text><text class="muted" x="680" y="188" font-size="10">source of truth</text>
    <rect class="panel node" x="767" y="93" width="114" height="58" rx="8"/><text class="text" x="824" y="118" font-size="13" font-weight="700">assert</text><text class="muted" x="824" y="136" font-size="10">evidence</text>
    <rect class="panel node" x="887" y="145" width="66" height="58" rx="8"/><text class="accent" x="920" y="179" font-size="20" font-weight="700">✓</text>
  </g>
  <text class="muted" x="35" y="235" font-size="11">Java 21 · Spring Boot · PostgreSQL · Redis · tests over claims</text>
</svg>`);
}

async function main() {
  const username = process.env.GITHUB_REPOSITORY_OWNER || DEFAULT_USERNAME;
  const token = process.env.GITHUB_TOKEN;
  const repositories = await fetchOwnedRepositories(username, token);
  const stats = collectStats(repositories);
  const now = new Date();

  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  await Promise.all([
    writeFile(resolve(OUTPUT_DIRECTORY, 'github-metrics.svg'), renderMetricsSvg(stats, username, now)),
    writeFile(resolve(OUTPUT_DIRECTORY, 'backend-pulse.svg'), renderPulseSvg(username, now))
  ]);

  console.log(`Rendered profile assets for ${username}: ${stats.repositories} owned repositories.`);
}

const entryPoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (entryPoint === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
