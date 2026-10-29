#!/usr/bin/env node
/**
 * KIỂM MÉO KHI ZOOM / PAN (2D + 3D) — Edge / Chrome headless qua CDP, Node ≥ 22. Không nằm trong cổng `kiem.mjs` (cần vite + API).
 * Người dùng báo: "Khi zoom / pan, giao diện 2D và 3D hình bị méo vỡ. Một lúc ổn định nó mới thẳng lại được."
 *
 * Mở màn soạn một dự án ở máy bàn 1440×900 (chuột: lăn, kéo + quán tính) và điện thoại 390×844 (cảm ứng: chụm, kéo), lần lượt
 * TMB · Tầng · Hầm (2D) và 3D Toàn dự án · Công trình, rồi lấy mẫu MỖI FRAME (rAF → setTimeout 0 = trạng thái đã tô của frame):
 *   2D · lệch tỷ lệ = |CTM.a / (bề rộng CSS / bề rộng viewBox) − 1| (CSS transform phóng ảnh SVG → nét / chữ phình, mờ)   > 0,5 % → LỖI
 *      · không đều  = |CTM.a − CTM.d| / CTM.a (kéo giãn một chiều)                                                         > 0,5 % → LỖI
 *      · hở         = SVG không phủ kín ô bản vẽ (kéo bằng transform để lộ vùng trống / cắt hình)                       > 1 px  → LỖI
 *   3D · lệch tỷ lệ bộ đệm vẽ ↔ cỡ CSS, và tỷ lệ camera ↔ cỡ CSS (khung kéo giãn khi đổi cỡ: xoay máy, kéo cửa sổ)       > 1 %   → LỖI
 *   · tác vụ dài (PerformanceObserver longtask) trong lúc thao tác > 50 ms → cảnh báo; khoảng frame p95 in ra để theo dõi.
 *   node scripts/kiem_zoom.mjs --url http://127.0.0.1:5591 --du-an 2mlg1a2l [--pa pa-1] [--chi may|dt] [--cham 4] [--ra .cache/kiem_zoom] [--anh]
 * Mã thoát: 0 đạt · 1 có lỗi · 2 lỗi hạ tầng.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const arg = (k, md) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : md; };
const URL0 = arg('--url', 'http://127.0.0.1:5180'), MA = arg('--du-an'), PA = arg('--pa', 'pa-1'), CHI = arg('--chi');
const RA = resolve(arg('--ra', '.cache/kiem_zoom')), ANH = process.argv.includes('--anh');
const NG_2D = 0.005, NG_HO = 1, NG_3D = 0.01, NG_DAI = 50;
if (!MA) { console.error('Thiếu --du-an <mã>'); process.exit(2); }
const KHUNG = [{ ten: 'may', w: 1440, h: 900, mobile: false }, { ten: 'dt', w: 390, h: 844, mobile: true }].filter((k) => !CHI || k.ten === CHI);
const cho = (ms) => new Promise((r) => setTimeout(r, ms));
const timTrinhDuyet = () => [process.env.CHROME_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));

/** Bộ lấy mẫu trong trang: mỗi frame đọc trạng thái ĐÃ TÔ (sau rAF, ResizeObserver, tô màu → setTimeout 0). */
const LAY_MAU = `(() => {
  window.__mau = []; window.__dai = []; window.__chay = true;
  // một bộ nghe cho cả trang (mỗi màn gọi lại LAY_MAU: không thêm bộ nghe trùng → tác vụ dài không bị đếm lặp)
  if (!window.__ngheDai) try { window.__ngheDai = true; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__chay && window.__dai.push(Math.round(e.duration)))).observe({ type: 'longtask' }); } catch {}
  const doc2d = () => {
    const s = document.querySelector('.panel-giua .ban-ve-svg'); if (!s) return null;
    const hop = s.parentElement.getBoundingClientRect(), r = s.getBoundingClientRect(), vb = s.viewBox.baseVal, m = s.getScreenCTM();
    if (!m || !vb || !vb.width || !s.clientWidth) return null;
    const k = Math.min(s.clientWidth / vb.width, s.clientHeight / vb.height); // preserveAspectRatio meet
    return { tl: Math.abs(m.a / k - 1), deu: Math.abs(m.a - m.d) / Math.abs(m.a), ho: Math.max(r.left - hop.left, r.top - hop.top, hop.right - r.right, hop.bottom - r.bottom, 0) };
  };
  const doc3d = () => {
    const v = document.querySelector('.vung-3d'), c = v && v.querySelector('canvas');
    // bản cũ chưa có móc _doKhung: đo bộ đệm ↔ CSS từ canvas, tỷ lệ camera coi như khớp CSS
    const d = v && v._doKhung ? v._doKhung() : c ? { bufW: c.width, bufH: c.height, cssW: c.clientWidth, cssH: c.clientHeight, aspect: c.clientWidth / c.clientHeight } : null;
    if (!d || !d.cssW || !d.cssH) return null;
    const css = d.cssW / d.cssH;
    // chuaVe: bộ đệm đã đổi cỡ nhưng chưa vẽ lại trong frame này → trình duyệt hiện ảnh cũ kéo giãn theo cỡ mới (tính như lệch 100 %)
    return { buf: d.chuaVe ? 1 : Math.abs((d.bufW / d.bufH) / css - 1), cam: Math.abs(d.aspect / css - 1), kt: [d.bufW, d.bufH, d.cssW, d.cssH] };
  };
  let truoc = performance.now();
  const buoc = (t) => {
    setTimeout(() => { if (!window.__chay) return; window.__mau.push({ dt: t - truoc, d2: doc2d(), d3: doc3d() }); truoc = t; }, 0);
    if (window.__chay) requestAnimationFrame(buoc);
  };
  requestAnimationFrame(buoc);
  return true;
})()`;

async function main() {
  const exe = timTrinhDuyet();
  if (!exe) throw new Error('Không thấy Edge / Chrome — đặt CHROME_PATH');
  // cổng 0: trình duyệt tự chọn cổng trống, ghi vào DevToolsActivePort — cổng cố định theo pid từng nối nhầm trình duyệt headless
  // của tiến trình khác (agent khác) đang giữ cổng đó → đo nhầm khung 768 khi tưởng 1440.
  let port = 0; const hoSo = join(RA, `ho-so-${process.pid}`);
  mkdirSync(hoSo, { recursive: true });
  const tr = spawn(exe, ['--headless=new', '--inprivate', '--disable-sync', '--disable-extensions', '--no-first-run', '--hide-scrollbars', '--ignore-gpu-blocklist',
    '--remote-debugging-port=0', `--user-data-dir=${hoSo}`, 'about:blank'], { stdio: 'ignore' });
  let loi = 0;
  const bang = [];
  try {
    let ds;
    for (let i = 0; i < 80 && !port; i++) { const f = join(hoSo, 'DevToolsActivePort'); if (existsSync(f)) port = +readFileSync(f, 'utf8').split(/\r?\n/)[0]; else await cho(150); }
    if (!port) throw new Error('Trình duyệt không mở cổng gỡ lỗi');
    for (let i = 0; i < 80 && !ds?.some((x) => x.type === 'page'); i++) { try { ds = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { await cho(250); } }
    const ws = new WebSocket(ds.find((x) => x.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    let id = 0; const doi = new Map(), nghe = new Set();
    ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && doi.has(m.id)) { const d = doi.get(m.id); doi.delete(m.id); m.error ? d.ko(new Error(JSON.stringify(m.error))) : d.ok(m.result); } else nghe.forEach((f) => f(m)); });
    const gui = (method, params = {}) => new Promise((ok, ko) => { const i = ++id; doi.set(i, { ok, ko }); ws.send(JSON.stringify({ id: i, method, params })); });
    const js = async (bt) => { const r = await gui('Runtime.evaluate', { expression: bt, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
    const moi = async (u) => { const x = new Promise((r) => { const f = (m) => { if (m.method === 'Page.loadEventFired') { nghe.delete(f); r(); } }; nghe.add(f); }); await gui('Page.navigate', { url: u }); await x; };
    const doiCo = async (bt, ms = 30000) => { const het = Date.now() + ms; while (Date.now() < het) { if (await js(bt)) return true; await cho(200); } return false; };
    const bam = (sel, i = 0) => js(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${i}]; if (!e || e.disabled) return false; e.click(); return true; })()`);
    const bamChu = (re) => js(`(() => { const e = [...document.querySelectorAll('button')].find((x) => ${re}.test(x.textContent.trim())); if (!e || e.disabled) return false; e.click(); return true; })()`);
    await gui('Page.enable'); await gui('Runtime.enable');

    for (const k of KHUNG) {
      const datKhung = (w, h) => gui('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: k.mobile ? 3 : 1, mobile: k.mobile });
      await datKhung(k.w, k.h);
      await gui('Emulation.setTouchEmulationEnabled', { enabled: k.mobile, maxTouchPoints: k.mobile ? 5 : 1 });
      // --cham N: CPU chậm N lần (giả máy yếu) để xem frame / tác vụ dài
      await gui('Emulation.setCPUThrottlingRate', { rate: +(arg('--cham', '1')) || 1 });
      await moi(`${URL0}/du-an/${MA}?pa=${PA}`);
      if (!(await doiCo(`!!document.querySelector('.ban-ve-svg')`, 45000))) throw new Error('Không mở được màn soạn');
      await cho(1500);
      const tam = async (sel) => js(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height * 0.45)]; })()`);
      const tp = (x, y, i) => ({ x, y, id: i, radiusX: 4, radiusY: 4, force: 1 });
      const lan = async (x, y, n, huong) => { for (let i = 0; i < n; i++) { await gui('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: huong * 100 }); await cho(16); } };
      const keoChuot = async (x, y, dx, dy, nut = 'left') => {
        const b = nut === 'left' ? 1 : 2;
        await gui('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: nut, buttons: b, clickCount: 1 });
        for (let i = 1; i <= 16; i++) { await gui('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + (dx * i) / 16, y: y + (dy * i) / 16, button: nut, buttons: b }); await cho(12); }
        await gui('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x + dx, y: y + dy, button: nut, buttons: 0, clickCount: 1 });
      };
      const chum = async (x, y, d0, d1) => {
        await gui('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tp(x - d0, y, 1), tp(x + d0, y, 2)] });
        for (let i = 1; i <= 16; i++) { const d = d0 + ((d1 - d0) * i) / 16; await gui('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [tp(x - d, y + i, 1), tp(x + d, y + i, 2)] }); await cho(16); }
        await gui('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      };
      const keoNgon = async (x, y, dx, dy) => {
        await gui('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tp(x, y, 1)] });
        for (let i = 1; i <= 16; i++) { await gui('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [tp(x + (dx * i) / 16, y + (dy * i) / 16, 1)] }); await cho(10); }
        await gui('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      };
      /** Chạy một màn: lấy mẫu trong lúc làm `thaoTac`, rồi chấm. */
      const chay = async (man, thaoTac, la3d) => {
        await js(LAY_MAU);
        await thaoTac();
        await cho(1200); // hết quán tính / đà camera
        const m = await js(`(() => { window.__chay = false; return { mau: window.__mau, dai: window.__dai }; })()`);
        const d2 = m.mau.map((x) => x.d2).filter(Boolean), d3 = m.mau.map((x) => x.d3).filter(Boolean);
        const max = (a, f) => a.reduce((s, x) => Math.max(s, f(x)), 0);
        const kq = la3d
          ? { buf: max(d3, (x) => x.buf), cam: max(d3, (x) => x.cam) }
          : { tl: max(d2, (x) => x.tl), deu: max(d2, (x) => x.deu), ho: max(d2, (x) => x.ho) };
        const dts = m.mau.map((x) => x.dt).filter((x) => x > 0).sort((a, b) => a - b), p95 = dts[Math.floor(dts.length * 0.95)] ?? 0;
        const sai = la3d ? (kq.buf > NG_3D || kq.cam > NG_3D) : (kq.tl > NG_2D || kq.deu > NG_2D || kq.ho > NG_HO);
        const xauKhung = la3d ? d3.filter((x) => x.buf > NG_3D || x.cam > NG_3D).length : d2.filter((x) => x.tl > NG_2D || x.deu > NG_2D || x.ho > NG_HO).length;
        const dai = m.dai.filter((x) => x > NG_DAI);
        if (sai) loi++;
        const so = la3d ? `bộ đệm ${(kq.buf * 100).toFixed(2)} % · camera ${(kq.cam * 100).toFixed(2)} %` : `tỷ lệ ${(kq.tl * 100).toFixed(2)} % · không đều ${(kq.deu * 100).toFixed(2)} % · hở ${kq.ho.toFixed(0)} px`;
        console.log(`${sai ? 'LỖI' : 'đạt'}  ${k.ten.padEnd(3)} ${man.padEnd(16)} ${String(m.mau.length).padStart(4)} frame · frame méo ${xauKhung} · ${so} · p95 ${p95.toFixed(1)} ms · tác vụ > 50 ms: ${dai.length ? dai.join(', ') : 'không'}`);
        bang.push({ khung: k.ten, man, frame: m.mau.length, frameMeo: xauKhung, ...kq, p95: +p95.toFixed(1), tacVuDai: m.dai });
        if (ANH) { mkdirSync(RA, { recursive: true }); const a = await gui('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(RA, `${k.ten}-${man}.png`), Buffer.from(a.data, 'base64')); }
      };
      const thao2d = async () => {
        const [x, y] = await tam('.panel-giua .ban-ve');
        if (k.mobile) { await chum(x, y, 40, 140); await cho(150); await keoNgon(x, y, -120, -60); await cho(100); await chum(x, y, 140, 50); }
        else { await lan(x, y, 8, -1); await keoChuot(x, y, 220, 90); await cho(80); await lan(x + 100, y, 8, 1); await keoChuot(x, y, -260, -40); }
      };
      const tab = async (i) => { await bam('.tab-buoc button', i); await cho(1200); };
      // --- 2D ---
      await bam('.tab-xem button', 0); await tab(0);
      await chay('TMB', thao2d, false);
      await tab(1); await doiCo(`!!document.querySelector('.panel-giua .ban-ve-svg')`, 20000); await cho(800);
      await chay('Tầng', thao2d, false);
      await tab(2); await doiCo(`!!document.querySelector('.panel-giua .ban-ve-svg')`, 30000); await cho(1500);
      await chay('Hầm', thao2d, false);
      // --- 3D ---
      await tab(0);
      await bamChu('/^3D$/');
      if (!(await doiCo(`!!document.querySelector('.vung-3d.da-dung')`, 60000))) { console.log(`bỏ   ${k.ten} 3D (không dựng được)`); continue; }
      await cho(1500);
      const thao3d = async () => {
        const [x, y] = await tam('.vung-3d');
        if (k.mobile) { await chum(x, y, 40, 130); await keoNgon(x, y, 80, 30); await datKhung(k.h, k.w); await cho(300); await datKhung(k.w, k.h); }
        else { await lan(x, y, 6, -1); await keoChuot(x, y, 160, 40, 'right'); await keoChuot(x, y, 120, -30); await datKhung(1100, 800); await cho(300); await datKhung(k.w, k.h); }
      };
      await chay('3D Toàn dự án', thao3d, true);
      if (await bamChu('/^(Công trình|Building)$/')) {
        await doiCo(`!!document.querySelector('.vung-3d.da-dung')`, 60000); await cho(1500);
        await chay('3D Công trình', thao3d, true);
      }
    }
    mkdirSync(RA, { recursive: true });
    writeFileSync(join(RA, 'ket_qua.json'), JSON.stringify(bang, null, 1));
    console.log(loi ? `\nCÓ ${loi} màn méo khi zoom / pan.` : '\nĐẠT: mọi frame giữa cử chỉ đúng hình.');
  } finally {
    tr.kill();
  }
  process.exit(loi ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
