// Generates assets/banner.svg: a 3D scene baked into SMIL keyframes.
// GitHub strips scripts from READMEs, so the 3D math runs here, at build time.
// Usage: node scripts/gen-banner.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const W = 1200, H = 400;
const K = 30;            // keyframes per revolution
const DUR = 30;          // seconds per revolution
const CX = 955, CY = 176, R = 122, D = 3.4; // sphere centre, radius, camera distance
const TILT_X = 0.42, TILT_Z = 0.22;
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";

const f1 = (n) => (Math.round(n * 10) / 10).toString();
const f2 = (n) => (Math.round(n * 100) / 100).toString();

// deterministic PRNG so the output is stable between runs
let seed = 20261116;
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---------- geometry: icosphere (icosahedron subdivided once) ----------
const PHI = (1 + Math.sqrt(5)) / 2;
const norm = ([x, y, z]) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
let verts = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
].map(norm);
const faces = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];
const midCache = new Map();
const midpoint = (a, b) => {
  const key = a < b ? `${a}_${b}` : `${b}_${a}`;
  if (!midCache.has(key)) {
    verts.push(norm([0, 1, 2].map((i) => (verts[a][i] + verts[b][i]) / 2)));
    midCache.set(key, verts.length - 1);
  }
  return midCache.get(key);
};
const edgeSet = new Set();
const addEdge = (a, b) => edgeSet.add(a < b ? `${a}_${b}` : `${b}_${a}`);
for (const [a, b, c] of faces) {
  const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
  for (const [p, q, r] of [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]) {
    addEdge(p, q); addEdge(q, r); addEdge(r, p);
  }
}
const edges = [...edgeSet].map((k) => k.split('_').map(Number));

// ---------- projection ----------
const project = ([x, y, z], theta) => {
  // spin around Y
  let x1 = x * Math.cos(theta) + z * Math.sin(theta);
  let z1 = -x * Math.sin(theta) + z * Math.cos(theta);
  // tilt around X
  let y2 = y * Math.cos(TILT_X) - z1 * Math.sin(TILT_X);
  let z2 = y * Math.sin(TILT_X) + z1 * Math.cos(TILT_X);
  // roll around Z
  const x3 = x1 * Math.cos(TILT_Z) - y2 * Math.sin(TILT_Z);
  const y3 = x1 * Math.sin(TILT_Z) + y2 * Math.cos(TILT_Z);
  const s = D / (D - z2);
  return { x: CX + R * s * x3, y: CY - R * s * y3, z: z2 };
};
// frames[k][v] = projected vertex; K+1 frames so the loop closes exactly
const frames = Array.from({ length: K + 1 }, (_, k) =>
  verts.map((v) => project(v, (2 * Math.PI * (k % K)) / K)));
const depth = (z) => (z + 1) / 2; // 0 = far, 1 = near
const anim = (attr, values, extra = '') =>
  `<animate attributeName="${attr}" dur="${DUR}s" repeatCount="indefinite" values="${values.join(';')}"${extra}/>`;

// ---------- sphere ----------
const edgeSvg = edges.map(([a, b]) => {
  const d = frames.map((f) => `M${f1(f[a].x)} ${f1(f[a].y)}L${f1(f[b].x)} ${f1(f[b].y)}`);
  const o = frames.map((f) => f2(0.07 + 0.6 * depth((f[a].z + f[b].z) / 2) ** 1.6));
  return `<path d="${d[0]}" opacity="${o[0]}">${anim('d', d)}${anim('opacity', o)}</path>`;
}).join('\n');

const ACCENTS = { 0: '#FBBF24', 9: '#60A5FA', 6: '#F8FAFC', 14: '#FBBF24', 27: '#60A5FA' };
const nodeSvg = verts.map((_, i) => {
  const t = frames.map((f) => `${f1(f[i].x)} ${f1(f[i].y)}`);
  const o = frames.map((f) => f2(0.2 + 0.8 * depth(f[i].z) ** 1.3));
  const accent = ACCENTS[i];
  const base = accent ? 2.2 : 1.3;
  const r = frames.map((f) => f2(base + (accent ? 3 : 2) * depth(f[i].z)));
  const halo = accent
    ? `<circle r="4" fill="none" stroke="${accent}" stroke-width="1.2"><animate attributeName="r" dur="2.6s" begin="${f2(rand() * 2.6)}s" repeatCount="indefinite" values="4;16"/><animate attributeName="opacity" dur="2.6s" begin="${f2(rand() * 2.6)}s" repeatCount="indefinite" values="0.9;0"/></circle>`
    : '';
  return `<g transform="translate(${t[0]})" opacity="${o[0]}">` +
    `<animateTransform attributeName="transform" type="translate" dur="${DUR}s" repeatCount="indefinite" values="${t.join(';')}"/>` +
    anim('opacity', o) + halo +
    `<circle r="${r[0]}" fill="${accent || '#A7F3D0'}">${anim('r', r)}</circle></g>`;
}).join('\n');

// ---------- orbit rings ----------
const ring = (rx, ry, rot, color, dur, reverse) => {
  const path = reverse
    ? `M${rx},0A${rx},${ry} 0 1,0 ${-rx},0A${rx},${ry} 0 1,0 ${rx},0`
    : `M${rx},0A${rx},${ry} 0 1,1 ${-rx},0A${rx},${ry} 0 1,1 ${rx},0`;
  return `<g transform="translate(${CX} ${CY}) rotate(${rot})">
  <ellipse rx="${rx}" ry="${ry}" stroke="${color}" stroke-opacity="0.28" stroke-width="1" stroke-dasharray="2 7"/>
  <circle r="9" fill="${color}" opacity="0.18"><animateMotion dur="${dur}s" repeatCount="indefinite" path="${path}"/></circle>
  <circle r="3.4" fill="${color}"><animateMotion dur="${dur}s" repeatCount="indefinite" path="${path}"/></circle>
</g>`;
};

// ---------- perspective floor ----------
const HY = 268, VX = CX, NEAR = 1, FAR = 9, ROWS = 8;
const floorY = (z) => HY + (H - HY + 6) / z; // z = NEAR lands just below the bottom edge
let floor = '';
for (let k = -22; k <= 22; k++) {
  const x = k * 78;
  floor += `<path d="M${f1(VX + x / FAR)} ${f1(floorY(FAR))}L${f1(VX + x / NEAR)} ${f1(floorY(NEAR))}"/>`;
}
const STEP = (FAR - NEAR) / ROWS;
for (let j = 0; j < ROWS; j++) {
  // each row slides one step toward the camera, then the next row takes over: seamless loop
  const ys = Array.from({ length: 9 }, (_, s) => f1(floorY(NEAR + STEP * (j + 1 - s / 8))));
  floor += `<path d="M0 0H${W}" transform="translate(0 ${ys[0]})"><animateTransform attributeName="transform" type="translate" dur="2.4s" repeatCount="indefinite" values="${ys.map((y) => `0 ${y}`).join(';')}"/></path>`;
}

// ---------- stars ----------
let stars = '';
for (let i = 0; i < 46; i++) {
  const x = rand() * W, y = rand() * (HY - 16), r = 0.5 + rand() * 1.1;
  stars += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f2(r)}" fill="#E2E8F0" opacity="${f2(0.15 + rand() * 0.35)}"><animate attributeName="opacity" dur="${f1(2.5 + rand() * 4)}s" begin="${f1(rand() * 5)}s" repeatCount="indefinite" values="0.1;0.75;0.1"/></circle>`;
}

// ---------- text ----------
const chip = (x, w, label, color, text) =>
  `<g transform="translate(${x} 292)"><rect width="${w}" height="40" rx="20" fill="#0B1220" fill-opacity="0.72" stroke="${color}" stroke-opacity="0.55"/>` +
  `<text x="${w / 2}" y="25.5" text-anchor="middle" fill="${text}" font-family="${FONT}" font-size="15" font-weight="700">${label}</text></g>`;

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
<title id="title">Zhuolun Li / Franklin</title>
<desc id="desc">AI coding agents, eval systems, and developer automation. A rotating 3D wireframe sphere of connected agent nodes.</desc>
<defs>
  <clipPath id="frame"><rect width="${W}" height="${H}" rx="28"/></clipPath>
  <linearGradient id="bg" x1="0" y1="0" x2="${W}" y2="${H}" gradientUnits="userSpaceOnUse">
    <stop stop-color="#060B18"/><stop offset="0.55" stop-color="#0B1426"/><stop offset="1" stop-color="#062421"/>
  </linearGradient>
  <radialGradient id="glow" cx="${CX}" cy="${CY}" r="330" gradientUnits="userSpaceOnUse">
    <stop stop-color="#34D399" stop-opacity="0.30"/><stop offset="0.45" stop-color="#0EA5E9" stop-opacity="0.10"/><stop offset="1" stop-color="#0EA5E9" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="core" cx="${CX}" cy="${CY}" r="${R}" gradientUnits="userSpaceOnUse">
    <stop stop-color="#A7F3D0" stop-opacity="0.16"/><stop offset="1" stop-color="#34D399" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="floorFade" x1="0" y1="${HY}" x2="0" y2="${H}" gradientUnits="userSpaceOnUse">
    <stop stop-color="#fff" stop-opacity="0"/><stop offset="0.4" stop-color="#fff" stop-opacity="0.28"/><stop offset="1" stop-color="#fff"/>
  </linearGradient>
  <linearGradient id="floorSide" x1="0" y1="0" x2="${W}" y2="0" gradientUnits="userSpaceOnUse">
    <stop stop-color="#000"/><stop offset="0.42" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.8" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0.7"/>
  </linearGradient>
  <mask id="floorMask" maskUnits="userSpaceOnUse" x="0" y="${HY}" width="${W}" height="${H - HY}">
    <rect y="${HY}" width="${W}" height="${H - HY}" fill="url(#floorFade)"/>
    <rect y="${HY}" width="${W}" height="${H - HY}" fill="url(#floorSide)" style="mix-blend-mode:multiply"/>
  </mask>
  <linearGradient id="name" x1="72" y1="0" x2="700" y2="0" gradientUnits="userSpaceOnUse">
    <stop stop-color="#FFFFFF"/><stop offset="1" stop-color="#A7F3D0"/>
  </linearGradient>
</defs>
<g clip-path="url(#frame)">
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${stars}
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <g mask="url(#floorMask)" stroke="#34D399" stroke-opacity="0.55" stroke-width="1">${floor}</g>
  <ellipse cx="${CX}" cy="372" rx="120" ry="8" fill="#34D399" opacity="0.1"><animate attributeName="opacity" dur="5s" repeatCount="indefinite" values="0.06;0.14;0.06"/></ellipse>
  <g><animateTransform attributeName="transform" type="translate" dur="7s" repeatCount="indefinite" values="0 0;0 -7;0 0" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#core)"/>
    ${ring(196, 46, -16, '#60A5FA', 11, false)}
    <g stroke="#34D399" stroke-width="1.1" stroke-linecap="round">
${edgeSvg}
    </g>
${nodeSvg}
    ${ring(226, 64, 24, '#FBBF24', 17, true)}
  </g>
  <g transform="translate(72 70)">
    <rect width="216" height="32" rx="16" fill="#34D399" fill-opacity="0.1" stroke="#34D399" stroke-opacity="0.45"/>
    <circle cx="20" cy="16" r="4" fill="#34D399"><animate attributeName="opacity" dur="1.8s" repeatCount="indefinite" values="1;0.25;1"/></circle>
    <text x="118" y="21" text-anchor="middle" fill="#A7F3D0" font-family="${MONO}" font-size="13" font-weight="700" letter-spacing="2.5">AI AGENT EVALS</text>
  </g>
  <text x="70" y="178" fill="url(#name)" font-family="${FONT}" font-size="58" font-weight="800" letter-spacing="-1.2">Zhuolun Li / Franklin</text>
  <text x="73" y="224" fill="#CBD5E1" font-family="${FONT}" font-size="22" font-weight="500">AI coding agents · eval systems · developer automation</text>
  <rect x="73" y="246" width="64" height="3" rx="1.5" fill="#34D399"><animate attributeName="width" dur="6s" repeatCount="indefinite" values="64;190;64" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/></rect>
  ${chip(72, 152, 'Code Review QA', '#34D399', '#D1FAE5')}
  ${chip(236, 128, 'Benchmarks', '#F59E0B', '#FEF3C7')}
  ${chip(376, 148, 'Agent Memory', '#60A5FA', '#DBEAFE')}
</g>
</svg>
`;

const out = fileURLToPath(new URL('../assets/banner.svg', import.meta.url));
writeFileSync(out, svg);
console.log(`${out}: ${(svg.length / 1024).toFixed(1)} KB, ${verts.length} nodes, ${edges.length} edges`);
