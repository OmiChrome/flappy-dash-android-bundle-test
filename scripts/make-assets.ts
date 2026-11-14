// Renders the app icon, Android adaptive icon layers, splash and favicon from SVG
// using Playwright's Chromium. Art matches the in-game Skia drawing (src/game/render.ts).
// Run: bun run assets
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const SKIN = { body: '#FFE27A', shade: '#FFC94A', belly: '#FFF6CF', wing: '#FFD25E', line: '#6B4A2B', beak: '#FF9A55' };

function fluffCircles(): string {
  const parts = ['<circle r="14"/>'];
  const n = 13;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    parts.push(`<circle cx="${(Math.cos(a) * 12).toFixed(2)}" cy="${(Math.sin(a) * 11.5).toFixed(2)}" r="6.2"/>`);
  }
  parts.push('<circle cx="-3" cy="-18" r="4.2"/><circle cx="2.5" cy="-19.5" r="3.4"/>');
  return parts.join('');
}

const wingShape = '<ellipse cx="-2" cy="0" rx="9" ry="6"/><circle cx="-9" cy="3" r="4.5"/><circle cx="-4" cy="5" r="4.5"/>';
const beak = 'M12.5 -3.5 Q24 -1 23 2 Q22 5 12.5 6 Z';

function bird(cx: number, cy: number, s: number, rot = -10, mono = false): string {
  const f = fluffCircles();
  if (mono) {
    return `<g transform="translate(${cx} ${cy}) scale(${s}) rotate(${rot})" fill="#000">${f}<path d="${beak}"/></g>`;
  }
  return `
<g transform="translate(${cx} ${cy}) scale(${s}) rotate(${rot})">
  <defs><radialGradient id="body" cx="-5" cy="-7" r="26" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${SKIN.body}"/><stop offset=".45" stop-color="${SKIN.body}"/><stop offset="1" stop-color="${SKIN.shade}"/>
  </radialGradient></defs>
  <g fill="${SKIN.line}" stroke="${SKIN.line}" stroke-width="4.4" stroke-linejoin="round">${f}</g>
  <g fill="url(#body)">${f}</g>
  <ellipse cx="0.5" cy="6.5" rx="9.5" ry="6.5" fill="${SKIN.belly}"/>
  <circle cx="5" cy="5.5" r="3.6" fill="#FF8FB1" opacity=".6"/>
  <g transform="translate(7 -5)">
    <circle r="5.8" fill="#fff" stroke="${SKIN.line}" stroke-width="1.8"/>
    <circle cx="1.6" cy="0.4" r="3.3" fill="#3D2C4E"/><circle cx="2.6" cy="-1.1" r="1.25" fill="#fff"/>
  </g>
  <path d="${beak}" fill="${SKIN.line}" stroke="${SKIN.line}" stroke-width="3.2" stroke-linejoin="round"/>
  <path d="${beak}" fill="${SKIN.beak}"/>
  <g transform="translate(-5 3) rotate(-14 2 -1)">
    <g fill="${SKIN.line}" stroke="${SKIN.line}" stroke-width="3.8" stroke-linejoin="round">${wingShape}</g>
    <g fill="${SKIN.wing}">${wingShape}</g>
  </g>
</g>`;
}

const sky = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#8FD3FF"/><stop offset=".6" stop-color="#C9ECFF"/><stop offset="1" stop-color="#FFF1F7"/></linearGradient></defs>
  <rect width="1024" height="1024" fill="url(#sky)"/>`;
const cloud = (x: number, y: number, s: number, o = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})" fill="#fff" opacity="${o}"><circle r="20"/><circle cx="24" cy="-12" r="25"/><circle cx="52" cy="-4" r="21"/><circle cx="74" cy="6" r="15"/><rect x="-12" y="0" width="98" height="22" rx="11"/></g>`;
const floor = `<g fill="#EADCF5">${Array.from({ length: 22 }, (_, i) => `<circle cx="${i * 52 - 10}" cy="905" r="40"/>`).join('')}<rect y="905" width="1024" height="140"/></g>
  <g fill="#fff">${Array.from({ length: 22 }, (_, i) => `<circle cx="${i * 52 + 16}" cy="935" r="40"/>`).join('')}<rect y="935" width="1024" height="120"/></g>`;
const pillar = (x: number, top: boolean, end: number) => {
  const w = 150;
  const body = top ? `<rect x="${x - w / 2}" y="-40" width="${w}" height="${end + 40}" rx="26"/>` : `<rect x="${x - w / 2}" y="${end}" width="${w}" height="1100" rx="26"/>`;
  const capY = top ? end - 30 : end - 10;
  const puffs = Array.from({ length: 4 }, (_, i) => `<circle cx="${x - 68 + 26 + i * 30}" cy="${top ? capY + 52 : capY + 6}" r="25"/>`).join('');
  return `<g><g fill="#FFC7DE" stroke="#C76E98" stroke-width="10">${body}</g>
    <g fill="#C76E98" stroke="#C76E98" stroke-width="14" stroke-linejoin="round"><rect x="${x - 90}" y="${capY}" width="180" height="58" rx="28"/>${puffs}</g>
    <g fill="#fff"><rect x="${x - 90}" y="${capY}" width="180" height="58" rx="28"/>${puffs}</g></g>`;
};

const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${sky}
  <circle cx="790" cy="210" r="120" fill="#FFF8D6" opacity=".8"/><circle cx="790" cy="210" r="80" fill="#FFF2A8"/>
  ${cloud(90, 230, 2.4, 0.95)}
  ${pillar(150, false, 700)}${pillar(890, true, 300)}
  ${floor}
  ${bird(512, 500, 13)}</svg>`;
const fg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${bird(512, 530, 11)}</svg>`;
const bg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${sky}
  <circle cx="770" cy="260" r="110" fill="#FFF8D6" opacity=".8"/><circle cx="770" cy="260" r="72" fill="#FFF2A8"/>${cloud(120, 300, 2.2, 0.9)}${floor}</svg>`;
const mono = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${bird(512, 530, 11, -10, true)}</svg>`;
const splash = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${bird(512, 530, 14)}</svg>`;

mkdirSync('assets', { recursive: true });
const browser = await chromium.launch();
async function out(svg: string, file: string, size: number, transparent = false) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div></body>`);
  await page.screenshot({ path: `assets/${file}`, omitBackground: transparent });
  await page.close();
}
await out(full, 'icon.png', 1024);
await out(fg, 'android-icon-foreground.png', 1024, true);
await out(bg, 'android-icon-background.png', 1024);
await out(mono, 'android-icon-monochrome.png', 1024, true);
await out(splash, 'splash-icon.png', 1024, true);
await out(full, 'favicon.png', 96);
await browser.close();
console.log('assets generated');
