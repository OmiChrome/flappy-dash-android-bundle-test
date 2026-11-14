// Usage: node bench/web-bench.cjs <screenshot-dir>  (serve the three web builds on 8081/8091/8090 first)
// Same headless Chromium, same 30 s autopilot benchmark, three web builds.
const { chromium } = require('playwright');
const fs = require('fs');
const targets = [
  { name: 'Expo (React Native Web + Skia/CanvasKit)', url: 'http://localhost:8081/bench', click: null },
  { name: 'Flutter web (CanvasKit)', url: 'http://localhost:8091/', click: [200, 760] },
  { name: 'Rust macroquad (wasm + WebGL)', url: 'http://localhost:8090/', click: [200, 680] },
];
const rss = (pid) => { try { const m = fs.readFileSync(`/proc/${pid}/status`, 'utf8').match(/VmRSS:\s+(\d+)/); return m ? +m[1] / 1024 : 0; } catch { return 0; } };
(async () => {
  const out = [];
  for (const t of targets) {
    const b = await chromium.launch();
    const ctx = await b.newContext({ viewport: { width: 400, height: 820 } });
    const p = await ctx.newPage();
    await p.addInitScript(() => { window.__frames = 0; const f = () => { window.__frames++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
    const t0 = Date.now();
    await p.goto(t.url, { waitUntil: 'networkidle' });
    await p.waitForTimeout(3000);
    const loadMs = Date.now() - t0;
    if (t.click) await p.mouse.click(...t.click);
    await p.waitForTimeout(1500);
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Performance.enable');
    const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
    const f0 = await p.evaluate(() => window.__frames);
    const s0 = Date.now();
    await p.waitForTimeout(30000);
    const secs = (Date.now() - s0) / 1000;
    const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
    const f1 = await p.evaluate(() => window.__frames);
    const bcdp = await b.newBrowserCDPSession();
    const info = await bcdp.send('SystemInfo.getProcessInfo');
    const renderers = info.processInfo.filter((x) => x.type === 'renderer');
    const gpu = info.processInfo.filter((x) => x.type === 'GPU');
    out.push({
      name: t.name,
      loadMs,
      fps: +((f1 - f0) / secs).toFixed(1),
      mainThreadBusyPct: +(((m1.TaskDuration - m0.TaskDuration) / secs) * 100).toFixed(1),
      scriptPct: +(((m1.ScriptDuration - m0.ScriptDuration) / secs) * 100).toFixed(1),
      jsHeapMB: +(m1.JSHeapUsedSize / 1048576).toFixed(1),
      rendererRssMB: +renderers.reduce((a, r) => a + rss(r.id), 0).toFixed(0),
      gpuRssMB: +gpu.reduce((a, r) => a + rss(r.id), 0).toFixed(0),
    });
    await p.screenshot({ path: process.argv[2] + '/wb-' + out.length + '.png' });
    await b.close();
  }
  console.log(JSON.stringify(out, null, 1));
})();
