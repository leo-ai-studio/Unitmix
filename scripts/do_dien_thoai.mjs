#!/usr/bin/env node
/**
 * ĐO ĐIỆN THOẠI (iPhone giả lập) — Edge / Chrome headless qua CDP, Node ≥ 22. KHÔNG nằm trong cổng `kiem.mjs`.
 * Mỗi chế độ (trình duyệt Safari / màn hình chính "standalone") đo:
 *   · tải lần đầu (bộ nhớ đệm trống) và mở lại (như bấm biểu tượng màn hình chính lần sau): LCP, TBT, JS tải qua mạng, số request
 *   · 5 s ngồi yên sau khi mở: số lần rAF, ResizeObserver, sự kiện resize, layout / style, thời gian task — phát hiện vòng lặp chạy nền
 *   · thao tác: kéo + chụm TMB, mở Tầng, mở 3D — tác vụ dài (> 50 ms) và tổng thời gian task
 * Giả lập: 390×844 @3x, UA iPhone, chạm 5 điểm, CPU chậm 4×, mạng "4G chậm" (150 ms RTT, 1,6 Mb/s xuống, 750 kb/s lên).
 * Standalone: Emulation.setEmulatedMedia display-mode: standalone + khung cao hết màn (không thanh Safari).
 *   node scripts/do_dien_thoai.mjs --url http://127.0.0.1:8811 --du-an <mã> [--ma-sua <mã>] [--che-do safari,standalone] [--ra .cache/do_dt]
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const arg = (k, md) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : md; };
const URL0 = arg('--url', 'http://127.0.0.1:8811'), MA = arg('--du-an'), PA = arg('--pa', 'pa-1'), MA_SUA = arg('--ma-sua');
const CHE_DO = arg('--che-do', 'safari,standalone').split(','), RA = resolve(arg('--ra', '.cache/do_dt'));
const CPU = +arg('--cpu', '4');
if (!MA) { console.error('Thiếu --du-an <mã>'); process.exit(2); }
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const KHUNG = { safari: { w: 390, h: 664 }, standalone: { w: 390, h: 844 } }; // Safari: trừ thanh địa chỉ + thanh dưới
const MANG = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };
const cho = (ms) => new Promise((r) => setTimeout(r, ms));
const timTrinhDuyet = () => [process.env.CHROME_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));

/** Cài trước mọi script của trang: đếm rAF / ResizeObserver / resize, ghi LCP + tác vụ dài. */
const CAI = `(() => {
  const d = window.__do = { raf: 0, ro: 0, rs: 0, vv: 0, lt: [], lcp: 0, fcp: 0 };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (f) => raf((t) => { d.raf++; f(t); });
  const RO = window.ResizeObserver;
  if (RO) window.ResizeObserver = class extends RO { constructor(f) { super((a, b) => { d.ro++; f(a, b); }); } };
  addEventListener('resize', () => d.rs++, true);
  try { window.visualViewport?.addEventListener('resize', () => d.vv++); } catch {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) d.lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) d.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') d.fcp = e.startTime; }).observe({ type: 'paint', buffered: true }); } catch {}
})();`;

async function main() {
  const exe = timTrinhDuyet();
  if (!exe) throw new Error('Không thấy Edge / Chrome — đặt CHROME_PATH');
  const port = 19500 + (process.pid % 200), hoSo = join(RA, `ho-so-${process.pid}`);
  mkdirSync(hoSo, { recursive: true });
  const tr = spawn(exe, ['--headless=new', '--disable-sync', '--disable-extensions', '--no-first-run', '--hide-scrollbars', '--enable-gpu-rasterization',
    `--remote-debugging-port=${port}`, `--user-data-dir=${hoSo}`, 'about:blank'], { stdio: 'ignore' });
  const bang = [];
  try {
    let ds;
    for (let i = 0; i < 80 && !ds?.some((x) => x.type === 'page'); i++) { try { ds = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { await cho(250); } }
    const ws = new WebSocket(ds.find((x) => x.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    let id = 0; const doi = new Map(), nghe = new Set();
    ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && doi.has(m.id)) { const d = doi.get(m.id); doi.delete(m.id); m.error ? d.ko(new Error(JSON.stringify(m.error))) : d.ok(m.result); } else nghe.forEach((f) => f(m)); });
    const gui = (method, params = {}) => new Promise((ok, ko) => { const i = ++id; doi.set(i, { ok, ko }); ws.send(JSON.stringify({ id: i, method, params })); });
    const js = async (bt) => { const r = await gui('Runtime.evaluate', { expression: bt, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + bt.slice(0, 80)); return r.result.value; };
    const doiCo = async (bt, ms = 60000) => { const het = Date.now() + ms; while (Date.now() < het) { if (await js(bt)) return true; await cho(150); } return false; };
    const bam = (sel, i = 0) => js(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${i}]; if (!e) return false; e.click(); return true; })()`);
    const chiSo = async () => Object.fromEntries((await gui('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
    // byte JS / tổng qua mạng theo sự kiện Network (encodedDataLength = byte thật trên dây, 0 nếu lấy từ SW / cache)
    let mang = { js: 0, tong: 0, req: 0, tuSW: 0, tuCache: 0 }; const loai = new Map();
    nghe.add((m) => {
      if (m.method === 'Network.responseReceived') { loai.set(m.params.requestId, m.params.type); if (m.params.response.fromServiceWorker) mang.tuSW++; if (m.params.response.fromDiskCache) mang.tuCache++; }
      if (m.method === 'Network.requestWillBeSent') mang.req++;
      if (m.method === 'Network.loadingFinished') { const b = m.params.encodedDataLength; mang.tong += b; if (loai.get(m.params.requestId) === 'Script') mang.js += b; }
    });
    await gui('Page.enable'); await gui('Runtime.enable'); await gui('Network.enable'); await gui('Performance.enable');
    await gui('Page.addScriptToEvaluateOnNewDocument', { source: CAI });
    await gui('Network.setUserAgentOverride', { userAgent: UA, platform: 'iPhone' });
    await gui('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    const moi = async (u) => { const x = new Promise((r) => { const f = (m) => { if (m.method === 'Page.loadEventFired') { nghe.delete(f); r(); } }; nghe.add(f); }); await gui('Page.navigate', { url: u }); await x; };
    const tbt = (lt, tu) => lt.filter(([s]) => s >= tu).reduce((a, [, d]) => a + Math.max(0, d - 50), 0);

    for (const cd of CHE_DO) {
      const k = KHUNG[cd];
      await gui('Emulation.setCPUThrottlingRate', { rate: 1 });
      await gui('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      await gui('Emulation.setDeviceMetricsOverride', { width: k.w, height: k.h, deviceScaleFactor: 3, mobile: true });
      await gui('Emulation.setEmulatedMedia', { features: [{ name: 'display-mode', value: cd === 'standalone' ? 'standalone' : 'browser' }] });
      // hồ sơ sạch cho mỗi chế độ: xoá cache HTTP, SW, kho (standalone trên iOS có kho riêng, không chung Safari)
      await moi(URL0 + '/');
      await js(`(async () => { for (const r of await navigator.serviceWorker?.getRegistrations?.() ?? []) await r.unregister(); for (const k of await caches?.keys?.() ?? []) await caches.delete(k); localStorage.clear(); return true; })()`);
      await gui('Network.clearBrowserCache');
      if (MA_SUA) await js(`localStorage.setItem('unitmix.maSua.${MA}', '${MA_SUA}'); true`);
      await moi('about:blank');
      await gui('Emulation.setCPUThrottlingRate', { rate: CPU });
      await gui('Network.emulateNetworkConditions', MANG);
      const urlDA = `${URL0}/du-an/${MA}?pa=${PA}`;
      for (const lan of ['lan-dau', 'mo-lai']) {
        mang = { js: 0, tong: 0, req: 0, tuSW: 0, tuCache: 0 };
        const t0 = Date.now();
        await moi(urlDA);
        const ok = await doiCo(`!!document.querySelector('.panel-giua .ban-ve-svg')`, 90000);
        const tVe = Date.now() - t0;
        const mangVe = { ...mang }; // byte tới lúc vẽ xong TMB (không tính lượt SW tải trước sau đó)
        await cho(3000); // tác vụ sau tải
        // có SW: chờ cài + tải trước xong (≤ 90 s) để lần "mở lại" đo đúng như bấm biểu tượng lần sau
        const swSan = await js(`(async () => { const r = await navigator.serviceWorker?.getRegistration(); if (!r) return false; await Promise.race([navigator.serviceWorker.ready, new Promise((x) => setTimeout(x, 90000))]); return !!r.active; })()`);
        mang = mangVe;
        const d = await js(`({ lcp: __do.lcp, fcp: __do.fcp, lt: __do.lt, sw: !!navigator.serviceWorker?.controller, sa: matchMedia('(display-mode: standalone)').matches })`);
        bang.push({ cheDo: cd, buoc: lan, veTMB_ms: ok ? tVe : -1, lcp: Math.round(d.lcp), fcp: Math.round(d.fcp), tbt: Math.round(tbt(d.lt, d.fcp)), dai: d.lt.length,
          jsKB: Math.round(mang.js / 1024), tongKB: Math.round(mang.tong / 1024), req: mang.req, tuSW: mang.tuSW, tuCache: mang.tuCache, swDieuKhien: d.sw, swSan, standalone: d.sa });
        console.log(JSON.stringify(bang.at(-1)));
        if (lan === 'mo-lai') {
          // NGỒI YÊN 5 s: mọi bộ đếm phải gần 0 (rAF / ResizeObserver / layout chạy liên tục = hao pin + giật)
          await gui('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
          const a = await chiSo(); const c0 = await js(`({ ...__do, lt: __do.lt.length })`);
          await cho(5000);
          const b = await chiSo(); const c1 = await js(`({ ...__do, lt: __do.lt.length })`);
          bang.push({ cheDo: cd, buoc: 'ngoi-yen-5s', raf: c1.raf - c0.raf, ro: c1.ro - c0.ro, resize: c1.rs - c0.rs, vv: c1.vv - c0.vv, layout: b.LayoutCount - a.LayoutCount,
            style: b.RecalcStyleCount - a.RecalcStyleCount, task_ms: Math.round((b.TaskDuration - a.TaskDuration) * 1000), dai: c1.lt - c0.lt });
          console.log(JSON.stringify(bang.at(-1)));
          // THAO TÁC
          const tac = async (ten, lam) => {
            const a = await chiSo(); const n0 = await js(`__do.lt.length`); const t = Date.now(); mang = { js: 0, tong: 0, req: 0, tuSW: 0, tuCache: 0 };
            await lam();
            const b = await chiSo(); const lt = (await js(`__do.lt`)).slice(n0);
            bang.push({ cheDo: cd, buoc: ten, ms: Date.now() - t, task_ms: Math.round((b.TaskDuration - a.TaskDuration) * 1000), script_ms: Math.round((b.ScriptDuration - a.ScriptDuration) * 1000),
              layout: b.LayoutCount - a.LayoutCount, dai: lt.length, daiNhat: Math.round(Math.max(0, ...lt.map((x) => x[1]))), tbt: Math.round(lt.reduce((s, [, x]) => s + Math.max(0, x - 50), 0)), req: mang.req, mangKB: Math.round(mang.tong / 1024) });
            console.log(JSON.stringify(bang.at(-1)));
          };
          const tam = await js(`(() => { const r = document.querySelector('.panel-giua .ban-ve-svg').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
          const cham = (type, pts) => gui('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i, radiusX: 4, radiusY: 4, force: 1 })) });
          await tac('keo-TMB', async () => {
            const [x, y] = tam; await cham('touchStart', [[x, y]]);
            for (let i = 1; i <= 30; i++) { await cham('touchMove', [[x - i * 4, y + i * 2]]); await cho(16); }
            await cham('touchEnd', []); await cho(600);
          });
          await tac('chum-TMB', async () => {
            const [x, y] = tam; await cham('touchStart', [[x - 30, y], [x + 30, y]]);
            for (let i = 1; i <= 30; i++) { await cham('touchMove', [[x - 30 - i * 3, y], [x + 30 + i * 3, y]]); await cho(16); }
            await cham('touchEnd', []); await cho(600);
          });
          await tac('mo-Tang', async () => { await bam('.tab-buoc button', 1); await doiCo(`!!document.querySelector('.panel-giua svg')`); await cho(2500); });
          await tac('mo-3D', async () => { await bam('.tab-buoc button', 0); await cho(300); await bam('.tab-xem button', 1); await doiCo(`!!document.querySelector('.vung-3d.da-dung')`, 90000); await cho(1500); });
          // 3D ngồi yên: vòng vẽ phải dừng
          const a3 = await chiSo(); const r0 = await js(`__do.raf`); await cho(3000); const b3 = await chiSo(); const r1 = await js(`__do.raf`);
          bang.push({ cheDo: cd, buoc: '3D-ngoi-yen-3s', raf: r1 - r0, task_ms: Math.round((b3.TaskDuration - a3.TaskDuration) * 1000), gpu: await js(`(() => { const c = document.querySelector('.vung-3d canvas'); return c ? c.width + '×' + c.height : '' })()`) });
          console.log(JSON.stringify(bang.at(-1)));
          await bam('.tab-xem button', 0);
          await gui('Network.emulateNetworkConditions', MANG);
        }
      }
    }
    mkdirSync(RA, { recursive: true });
    writeFileSync(join(RA, 'ket_qua.json'), JSON.stringify(bang, null, 1));
    ws.close();
  } finally { tr.kill(); await cho(500); try { rmSync(hoSo, { recursive: true, force: true }); } catch { /* */ } }
}
main().then(() => process.exit(0), (e) => { console.error('Lỗi hạ tầng:', e.message); process.exit(2); });
