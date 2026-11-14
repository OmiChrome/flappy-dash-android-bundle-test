// Renders app icon / splash / favicon PNGs from SVG using Playwright's Chromium.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const bird = (cx: number, cy: number, s: number) => `
<g transform="translate(${cx} ${cy}) scale(${s})">
  <path d="M-14 -2 L-26 -8 L-24 0 L-27 6 L-14 4 Z" fill="#F29E1B" stroke="#3B2A1A" stroke-width="2" stroke-linejoin="round"/>
  <ellipse rx="19" ry="15" fill="#FFD93B" stroke="#3B2A1A" stroke-width="2.5"/>
  <ellipse cx="1" cy="7" rx="12" ry="6.5" fill="#FFF3B0"/>
  <ellipse cx="-3" cy="-8" rx="9" ry="3" fill="#fff" opacity=".45"/>
  <g transform="translate(-6 3) rotate(-12)"><ellipse cx="-3" cy="2" rx="10" ry="6.5" fill="#FFB52E" stroke="#3B2A1A" stroke-width="2"/></g>
  <circle cx="9" cy="-5" r="6.5" fill="#fff" stroke="#3B2A1A" stroke-width="2"/><circle cx="11" cy="-5" r="3" fill="#3B2A1A"/>
  <path d="M14 0 Q26 -1 27 3 Q25 5 14 5 Z" fill="#FF6B3D" stroke="#3B2A1A" stroke-width="2" stroke-linejoin="round"/>
  <path d="M15 4 Q22 7 26 5 Q24 9 15 8 Z" fill="#E0482A" stroke="#3B2A1A" stroke-width="1.5" stroke-linejoin="round"/>
  <circle cx="4" cy="3" r="3" fill="#FF8F8F" opacity=".55"/>
</g>`;
const pipe = (x: number, y: number, w: number, h: number) => `
<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#6CC22E" stroke="#2D5A14" stroke-width="10"/>
<rect x="${x + w * 0.12}" y="${y}" width="${w * 0.1}" height="${h}" fill="#fff" opacity=".22"/>`;

const sky = `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4EC0F0"/><stop offset="1" stop-color="#BDEBFF"/></linearGradient></defs>`;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${sky}<rect width="1024" height="1024" fill="url(#s)"/>
  <circle cx="800" cy="220" r="90" fill="#FFE066"/>
  ${pipe(70, 700, 180, 400)}${pipe(40, 660, 240, 60)}${pipe(780, -60, 180, 330)}${pipe(750, 220, 240, 60)}
  ${bird(500, 500, 15)}</svg>`;
const fg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${bird(512, 520, 12.5)}</svg>`;
const bg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${sky}<rect width="1024" height="1024" fill="url(#s)"/><circle cx="780" cy="250" r="80" fill="#FFE066"/></svg>`;
const mono = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><g fill="#000" transform="translate(512 520) scale(12.5)"><ellipse rx="19" ry="15"/><path d="M14 0 Q26 -1 27 3 Q25 5 14 5 Z"/><path d="M-14 -2 L-26 -8 L-24 0 L-27 6 L-14 4 Z"/></g></svg>`;
const splash = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${bird(512, 512, 14)}</svg>`;

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
