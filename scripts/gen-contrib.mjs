// Generates assets/contrib.svg: an isometric voxel contribution calendar plus a
// language bar chart. Data comes from the GitHub GraphQL API through the `gh`
// CLI, so it reflects the logged-in user's own view (private contributions
// included). Only aggregate numbers are written out: per-day counts and commit
// totals per language. Private repositories contribute to the Go total only;
// every other language is counted from public repositories. No repository
// names are read or stored.
// Usage: node scripts/gen-contrib.mjs
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Canvas, F3, makeRand, makeVoxels, renderIso } from './voxel.mjs';

const GW = 400, GH = 160, S = 3;
const OX = 62, OY = 32;
const { ri, pick } = makeRand(5);

const query = `{viewer{contributionsCollection{
  contributionCalendar{totalContributions weeks{contributionDays{contributionCount weekday}}}
  commitContributionsByRepository(maxRepositories:100){repository{isPrivate primaryLanguage{name}} contributions{totalCount}}
}}}`;
const cc = JSON.parse(execFileSync('gh', ['api', 'graphql', '-f', `query=${query}`], { encoding: 'utf8' }))
  .data.viewer.contributionsCollection;

const langTotals = new Map();
for (const r of cc.commitContributionsByRepository) {
  const name = r.repository.primaryLanguage?.name;
  if (!name || (r.repository.isPrivate && name !== 'Go')) continue;
  langTotals.set(name, (langTotals.get(name) || 0) + r.contributions.totalCount);
}
const langs = [...langTotals].sort((a, b) => b[1] - a[1]).slice(0, 5);
const LANG_COLORS = { Go: '#00add8', TypeScript: '#4c8fe0', Python: '#ffd866', JavaScript: '#f1e05a', HTML: '#f0683e', CSS: '#a371f7', Java: '#c98a3a', Shell: '#89e051' };

// ---------- calendar as voxel towers ----------
const weeks = cc.contributionCalendar.weeks;
const max = Math.max(...weeks.flatMap((w) => w.contributionDays.map((d) => d.contributionCount)));
const RAMP = ['#1c6b5a', '#22906d', '#2fbf8a', '#4fe3b0', '#8ff5e0'];
const { vox, set, box } = makeVoxels();
box(-1, -1, 0, weeks.length * 2, 14, 0, '#1a1c40');
weeks.forEach((w, wi) => w.contributionDays.forEach((d) => {
  const x = wi * 2, y = d.weekday * 2, n = d.contributionCount;
  if (!n) { box(x, y, 1, x + 1, y + 1, 1, '#24275a'); return; }
  const t = Math.log1p(n) / Math.log1p(max);
  const h = 2 + Math.round(t * 10);
  const c = RAMP[Math.min(RAMP.length - 1, Math.floor(t * RAMP.length))];
  box(x, y, 1, x + 1, y + 1, h, c);
  if (t > 0.8) box(x, y, h, x + 1, y + 1, h, '#d9fff6', { e: true });
}));
const fb = renderIso(vox, OX, OY);

// ---------- text ----------
const text = new Canvas()
  .glyphs(F3, 3, 14, 112, String(cc.contributionCalendar.totalContributions), '#aefcff', 4)
  .glyphs(F3, 3, 14, 137, 'CONTRIBUTIONS', '#c9d2ff', 2)
  .glyphs(F3, 3, 14, 150, 'LAST 12 MONTHS', '#6f78b3', 1)
  .glyphs(F3, 3, 284, 12, 'COMMITS BY', '#6f78b3', 1)
  .glyphs(F3, 3, 284, 20, 'LANGUAGE', '#c9d2ff', 2);
const BAR_W = 102;
langs.forEach(([name, n], i) => {
  const y = 38 + i * 19, c = LANG_COLORS[name] || '#8b93c9';
  const count = String(n);
  text.glyphs(F3, 3, 284, y, name.toUpperCase(), i === 0 ? '#ffffff' : '#c9d2ff', i === 0 ? 2 : 1)
    .glyphs(F3, 3, 284 + BAR_W - count.length * 4 + 1, y + (i === 0 ? 5 : 0), count, '#8b93c9', 1)
    .rect(284, y + (i === 0 ? 12 : 7), BAR_W, 4, '#1a1c40')
    .rect(284, y + (i === 0 ? 12 : 7), Math.max(2, Math.round(BAR_W * n / langs[0][1])), 4, c);
});

const starBuckets = Array.from({ length: 4 }, () => new Canvas());
for (let i = 0; i < 80; i++) pick(starBuckets).set(ri(0, GW - 1), ri(0, GH - 1), pick(['#3b4380', '#5b64a8', '#8b93c9']));

const svg = `<svg width="${GW * S}" height="${GH * S}" viewBox="0 0 ${GW * S} ${GH * S}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
<title id="title">Contributions</title>
<desc id="desc">Isometric pixel-art contribution calendar with ${cc.contributionCalendar.totalContributions} contributions in the last 12 months, and commits by language led by ${langs[0][0]}.</desc>
<style>
.st{animation:st 3s steps(1) infinite}.st1{animation-duration:4.3s;animation-delay:-1s}.st2{animation-duration:2.1s;animation-delay:-.5s}.st3{animation-duration:5.9s;animation-delay:-2s}
@keyframes st{0%,100%{opacity:1}50%{opacity:.3}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
<defs>
<clipPath id="frame"><rect width="${GW * S}" height="${GH * S}" rx="20"/></clipPath>
<linearGradient id="bg" x1="0" y1="0" x2="${GW * S}" y2="${GH * S}" gradientUnits="userSpaceOnUse"><stop stop-color="#070818"/><stop offset="0.6" stop-color="#0c0e2a"/><stop offset="1" stop-color="#150f33"/></linearGradient>
<radialGradient id="g" cx="480" cy="250" r="420" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 150) scale(1 0.4)"><stop stop-color="#34d399" stop-opacity="0.22"/><stop offset="1" stop-color="#34d399" stop-opacity="0"/></radialGradient>
</defs>
<g clip-path="url(#frame)">
<rect width="${GW * S}" height="${GH * S}" fill="url(#bg)"/>
<rect width="${GW * S}" height="${GH * S}" fill="url(#g)"/>
<g transform="scale(${S})" shape-rendering="crispEdges">
${starBuckets.map((c, i) => `<g class="st st${i}">${c.svg()}</g>`).join('\n')}
${fb.svg()}
${text.svg()}
</g>
</g>
</svg>
`;
const out = fileURLToPath(new URL('../assets/contrib.svg', import.meta.url));
writeFileSync(out, svg);
console.log(`${out}: ${(svg.length / 1024).toFixed(1)} KB; ${cc.contributionCalendar.totalContributions} contributions; ${langs.map(([l, n]) => `${l} ${n}`).join(', ')}`);
