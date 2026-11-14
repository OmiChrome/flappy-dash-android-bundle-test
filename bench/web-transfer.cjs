// Bytes a first-time visitor downloads for each web build (uncompressed static server).
const { chromium } = require('playwright');
const urls = { expo: 'http://localhost:8081/', flutter: 'http://localhost:8091/', rust: 'http://localhost:8090/' };
(async () => {
  const b = await chromium.launch();
  for (const [name, url] of Object.entries(urls)) {
    const p = await b.newPage();
    let bytes = 0; const files = [];
    p.on('response', async (r) => { try { const n = (await r.body()).length; bytes += n; files.push([n, r.url().split('/').pop()]); } catch {} });
    await p.goto(url, { waitUntil: 'networkidle' });
    await p.waitForTimeout(3000);
    files.sort((a, c) => c[0] - a[0]);
    console.log(name, (bytes / 1048576).toFixed(2), 'MB', files.slice(0, 4).map(([n, f]) => `${f}:${(n / 1048576).toFixed(2)}`).join(' '));
    await p.close();
  }
  await b.close();
})();
