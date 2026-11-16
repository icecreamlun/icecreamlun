// Generates assets/contrib-dark.svg and assets/contrib-light.svg: an isometric
// voxel contribution calendar plus commits by language.
// Data comes from the GitHub GraphQL API through the `gh` CLI, so it reflects
// the logged-in user's own view (private contributions included). Only
// aggregate numbers are written out: per-day counts and commit totals per
// language. Private repositories contribute to the Go total only; every other
// language is counted from public repositories. No repository names are read
// or stored.
// Usage: node scripts/gen-contrib.mjs
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FONT, Scene, renderLit } from './voxel.mjs';

const GW = 600, GH = 236, S = 2;
const OX = 62, OY = 42;

const query = `{viewer{contributionsCollection{
  contributionCalendar{totalContributions weeks{contributionDays{contributionCount weekday}}}
  commitContributionsByRepository(maxRepositories:100){repository{isPrivate primaryLanguage{name}} contributions{totalCount}}
}}}`;
const cc = JSON.parse(execFileSync('gh', ['api', 'graphql', '-f', `query=${query}`], { encoding: 'utf8' }))
  .data.viewer.contributionsCollection;
const total = cc.contributionCalendar.totalContributions;

const langTotals = new Map();
for (const r of cc.commitContributionsByRepository) {
  const name = r.repository.primaryLanguage?.name;
  if (!name || (r.repository.isPrivate && name !== 'Go')) continue;
  langTotals.set(name, (langTotals.get(name) || 0) + r.contributions.totalCount);
}
const langs = [...langTotals].sort((a, b) => b[1] - a[1]).slice(0, 5);

const THEME = {
  dark: {
    ink: '#f0ede6', mute: '#a09c93', faint: '#2a2d36', accent: '#e0a458', go: '#4cc3e6', bar: '#6b7280', shadow: 0.4,
    plate: '#3a3e4a', empty: '#4a4f5c', ramp: ['#3f7a5c', '#4c9a6c', '#62b87f', '#86d49a', '#b5ecbd'],
    ambient: [0.5, 0.53, 0.62], key: [0.85, 0.8, 0.7],
  },
  light: {
    ink: '#1f1d1a', mute: '#6b675f', faint: '#e9e5dc', accent: '#b8763a', go: '#0099c4', bar: '#a8a39a', shadow: 0.12,
    plate: '#e6e1d7', empty: '#d8d2c6', ramp: ['#b7d8ae', '#8fc487', '#66ab66', '#458f4f', '#2f7340'],
    ambient: [0.7, 0.71, 0.74], key: [0.5, 0.46, 0.38],
  },
};

function build(theme) {
  const t = THEME[theme];
  const weeks = cc.contributionCalendar.weeks;
  const max = Math.max(...weeks.flatMap((w) => w.contributionDays.map((d) => d.contributionCount)));
  const s = new Scene();
  s.box(-1, -1, 0, weeks.length * 3 - 1, 21, 0, t.plate);
  weeks.forEach((w, wi) => w.contributionDays.forEach((d) => {
    const x = wi * 3, y = d.weekday * 3, n = d.contributionCount;
    if (!n) { s.box(x, y, 1, x + 1, y + 1, 1, t.empty); return; }
    const k = Math.log1p(n) / Math.log1p(max);
    s.box(x, y, 1, x + 1, y + 1, 2 + Math.round(k * 14), t.ramp[Math.min(4, Math.floor(k * 5))]);
  }));
  const fb = renderLit(s, {
    ox: OX, oy: OY, ambient: t.ambient,
    lights: [{ dir: [-0.7, 0.35, 0.9], color: t.key, soft: 0.06 }],
  });

  const lx = 836, lw = 304;
  const rows = langs.map(([name, n], i) => {
    const y = 132 + i * 46, first = i === 0;
    return `<text x="${lx}" y="${y}" fill="${first ? t.ink : t.mute}" font-size="${first ? 17 : 15}" font-weight="${first ? 700 : 500}">${name}</text>
<text x="${lx + lw}" y="${y}" text-anchor="end" fill="${t.mute}" font-size="14" font-weight="500">${n}</text>
<rect x="${lx}" y="${y + 10}" width="${lw}" height="6" rx="3" fill="${t.faint}"/>
<rect x="${lx}" y="${y + 10}" width="${Math.max(6, Math.round(lw * n / langs[0][1]))}" height="6" rx="3" fill="${first ? t.go : t.bar}"/>`;
  }).join('\n');

  return `<svg width="${GW * S}" height="${GH * S}" viewBox="0 0 ${GW * S} ${GH * S}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
<title id="title">Contributions</title>
<desc id="desc">Isometric contribution calendar: ${total} contributions in the last 12 months. Commits by language, led by ${langs[0][0]}.</desc>
<defs>
<radialGradient id="under" cx="430" cy="400" r="420" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 340) scale(1 0.15)"><stop stop-color="#000" stop-opacity="${t.shadow}"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
</defs>
<g transform="scale(${S})" shape-rendering="crispEdges">
${fb.svg()}
</g>
<g font-family="${FONT}">
<rect x="60" y="356" width="36" height="3" rx="1.5" fill="${t.accent}"/>
<text x="60" y="414" fill="${t.ink}" font-size="52" font-weight="700" letter-spacing="-1.2">${total.toLocaleString('en-US')}</text>
<text x="62" y="442" fill="${t.mute}" font-size="14" font-weight="600" letter-spacing="2.4">CONTRIBUTIONS  ·  LAST 12 MONTHS</text>
<rect x="${lx}" y="62" width="36" height="3" rx="1.5" fill="${t.accent}"/>
<text x="${lx + 2}" y="94" fill="${t.mute}" font-size="14" font-weight="600" letter-spacing="2.4">COMMITS BY LANGUAGE</text>
${rows}
</g>
</svg>
`;
}

for (const theme of ['dark', 'light']) {
  const svg = build(theme);
  const out = fileURLToPath(new URL(`../assets/contrib-${theme}.svg`, import.meta.url));
  writeFileSync(out, svg);
  console.log(`${out}: ${(svg.length / 1024).toFixed(1)} KB`);
}
console.log(`${total} contributions; ${langs.map(([l, n]) => `${l} ${n}`).join(', ')}`);
