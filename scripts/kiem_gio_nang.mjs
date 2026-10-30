#!/usr/bin/env node
/**
 * KIỂM THANH GIỜ NẮNG (hồi quy "thanh giờ 3D giật lùi", 2026-10-30) — Edge / Chrome headless qua CDP, Node ≥ 22. Không nằm trong cổng kiem.mjs
 * (cần vite dev + API). Mỗi khung (máy bàn 1440×900 chuột · điện thoại 390×844 cảm ứng, CPU 4×):
 *   3D Toàn dự án › hộp Vị trí · Nắng · Gió › tab Nắng, rồi TMB (bóng 2D):
 *   · phím →  từng bước 0,05 h: giờ kho tăng đúng 0,05 mỗi bước, KHÔNG có lượt ghi lùi; 3D: mặt trời đặt theo đúng giờ kho và đổi hướng MỖI
 *     bước (`.vung-3d._nang()`); 2D: đa giác bóng đổi mỗi bước                                                                   → LỖI
 *   · kéo chuột / chạm kéo từng 1–2 px: chuỗi giờ kho đơn điệu (không lùi), 3D theo kịp giờ cuối                                → LỖI
 *   · đặt giá trị bằng mã + phát `input` / chỉ `change`: tới kho                                                               → LỖI
 *   · ▶ chạy 2 s: giờ mỗi khung tăng đều (không lùi, bước ≤ 0,1 h, trừ một lần vòng lặn → mọc), 3D đặt mặt trời theo        → LỖI
 *   · tác vụ dài > 50 ms trong lúc kéo / chạy: máy bàn → LỖI, điện thoại (CPU 4×) → cảnh báo
 * Giờ kho đọc thẳng từ module `/src/nangGio/kho.ts` của vite dev (cùng phiên bản module với app) — nghe MỌI lượt ghi `luc`.
 *   node scripts/kiem_gio_nang.mjs --url http://127.0.0.1:5643 --du-an 2mlg1a2l --ma-sua <mã> [--pa pa-1] [--chi may|dt] [--ra .cache/kiem_gio_nang]
 * Mã thoát: 0 đạt · 1 có lỗi · 2 lỗi hạ tầng.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const arg = (k, md) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : md; };
const URL0 = arg('--url', 'http://127.0.0.1:5643'), MA = arg('--du-an'), PA = arg('--pa', 'pa-1'), MA_SUA = arg('--ma-sua'), CHI = arg('--chi');
const RA = resolve(arg('--ra', '.cache/kiem_gio_nang'));
if (!MA) { console.error('Thiếu --du-an <mã>'); process.exit(2); }
const NG_DAI = 50, EPS = 1e-6;
const KHUNG = [
  { ten: 'may', w: 1440, h: 900, dpr: 1, mobile: false, cpu: 1 },
  { ten: 'dt', w: 390, h: 844, dpr: 3, mobile: true, cpu: 4 },
].filter((k) => !CHI || k.ten === CHI);
const cho = (ms) => new Promise((r) => setTimeout(r, ms));
const exe = [process.env.CHROME_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));

/** Cài trong trang (mỗi lần tải): bộ nghe tác vụ dài + nhật ký mọi lượt ghi giờ kho. */
const CAI = `(() => { const d = window.__kg = { dai: [], log: [] };
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) d.dai.push([e.startTime, Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch {} })();`;
// đúng URL module app đã nạp (sau khi sửa tệp, vite gắn ?t=… — import URL khác là một bản module KHÁC, đọc nhầm kho)
const NOI_KHO = `(async () => { const d = window.__kg; if (d.kho) return true;
  const u = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.split('?')[0].endsWith('/src/nangGio/kho.ts')).pop() ?? '/src/nangGio/kho.ts';
  d.kho = await import(u); d.khoUrl = u;
  let cu = d.kho.layNG().luc; d.kho.ngheNG(() => { const l = d.kho.layNG().luc; if (l !== cu) { d.log.push(l); cu = l; } }); return true; })()`;
/** Trạng thái sau khi trang đã tô khung hiện tại (2 rAF + setTimeout 0). */
const DOC = `new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => {
  const d = window.__kg, el = document.querySelector('.hop-nang-gio .hng-chay + input[type=range]'), v = document.querySelector('.vung-3d');
  const bong = [...document.querySelectorAll('.ng-bong polygon')].map((p) => p.getAttribute('points')).join('|');
  ok({ luc: d.kho.layNG().luc, v: el ? +el.value : null, log: d.log.length, nang: v && v._nang ? v._nang() : null, bong: bong.length ? bong : null });
}, 0))))`;

let loi = 0, canh = 0;
const bao = (k, ok, chu) => { if (!ok) { loi++; console.log(`  LỖI  [${k}] ${chu}`); } };
const baoCanh = (k, chu) => { canh++; console.log(`  cảnh báo [${k}] ${chu}`); };

async function main() {
  if (!exe) throw new Error('Không thấy Edge / Chrome — đặt CHROME_PATH');
  mkdirSync(RA, { recursive: true });
  const hoSo = join(RA, `ho-so-${process.pid}`);
  mkdirSync(hoSo, { recursive: true });
  // cổng 0 + DevToolsActivePort: không nối nhầm trình duyệt headless của tiến trình khác
  const tr = spawn(exe, ['--headless=new', '--inprivate', '--disable-sync', '--disable-extensions', '--no-first-run', '--hide-scrollbars', '--ignore-gpu-blocklist',
    '--enable-gpu', '--use-angle=d3d11', '--remote-debugging-port=0', `--user-data-dir=${hoSo}`, 'about:blank'], { stdio: 'ignore' });
  const tong = {};
  try {
    let port = 0, ds;
    for (let i = 0; i < 80 && !port; i++) { const f = join(hoSo, 'DevToolsActivePort'); if (existsSync(f)) port = +readFileSync(f, 'utf8').split(/\r?\n/)[0]; else await cho(150); }
    if (!port) throw new Error('Trình duyệt không mở cổng gỡ lỗi');
    for (let i = 0; i < 80 && !ds?.some((x) => x.type === 'page'); i++) { try { ds = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { await cho(250); } }
    const ws = new WebSocket(ds.find((x) => x.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    let id = 0; const doi = new Map(), nghe = new Set(), loiJs = [];
    ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && doi.has(m.id)) { const d = doi.get(m.id); doi.delete(m.id); m.error ? d.ko(new Error(JSON.stringify(m.error))) : d.ok(m.result); } else nghe.forEach((f) => f(m)); });
    nghe.add((m) => { if (m.method === 'Runtime.exceptionThrown') loiJs.push(m.params.exceptionDetails?.exception?.description?.slice(0, 200) ?? m.params.exceptionDetails?.text); });
    const gui = (method, params = {}) => new Promise((ok, ko) => { const i = ++id; doi.set(i, { ok, ko }); ws.send(JSON.stringify({ id: i, method, params })); });
    const js = async (bt) => { const r = await gui('Runtime.evaluate', { expression: bt, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception?.description ?? r.exceptionDetails.text) + ' ← ' + bt.slice(0, 80)); return r.result.value; };
    const doiCo = async (bt, ms = 60000) => { const het = Date.now() + ms; while (Date.now() < het) { if (await js(bt)) return true; await cho(200); } return false; };
    const bam = (sel, i = 0) => js(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${i}]; if (!e) return false; e.click(); return true; })()`);
    const bamChu = (re, pham = 'body') => js(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(pham + ' button, ' + pham + ' label, ' + pham + ' [role=tab]')})]
      .find((x) => ${re}.test((x.getAttribute('aria-label') || '') + ' ' + x.textContent.trim())); if (!e || e.disabled) return false; e.click(); return true; })()`);
    const moc = () => js('performance.now()');
    const dai = async (tu) => (await js('window.__kg.dai')).filter(([s]) => s >= tu).map((x) => x[1]);
    const doc = () => js(DOC);
    const chup = async (ten) => { const r = await gui('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(RA, ten + '.png'), Buffer.from(r.data, 'base64')); };
    const tron = (x) => Math.round(x * 1000) / 1000;
    await gui('Page.enable'); await gui('Runtime.enable');
    await gui('Page.addScriptToEvaluateOnNewDocument', { source: CAI });
    const moi = async (u) => { const x = new Promise((r) => { const f = (m) => { if (m.method === 'Page.loadEventFired') { nghe.delete(f); r(); } }; nghe.add(f); }); await gui('Page.navigate', { url: u }); await x; };
    /** Lượt ghi lùi trong nhật ký kho từ vị trí `tu` (bỏ qua một lần vòng lặn → mọc nếu `vong`). */
    const luiTrongLog = async (tu, vong = false) => {
      const log = (await js('window.__kg.log')).slice(Math.max(0, tu - 1));
      const lui = [];
      for (let i = 1; i < log.length; i++) if (log[i] < log[i - 1] - EPS && !(vong && log[i - 1] - log[i] > 1)) lui.push([tron(log[i - 1]), tron(log[i])]);
      return { lui, n: log.length };
    };

    /** Bộ bài trên thanh giờ đang mở (ten: 3d | 2d). */
    const baiThanh = async (k, ten, la3D) => {
      const r = {}, nhan = `${k.ten}·${ten}`;
      const thanh = `document.querySelector('.hop-nang-gio .hng-chay + input[type=range]')`;
      if (!(await js(`!!${thanh}`))) { bao(nhan, false, 'không thấy thanh giờ trong tab Nắng'); return r; }
      // về đầu khoảng (mọc + 1 h) để còn chỗ tăng
      await js(`(() => { const e = ${thanh}; const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(e, String(+e.min + 1)); e.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
      await cho(300);
      // --- 1) phím → từng 0,05 h ---
      await js(`${thanh}.focus()`);
      let t0 = await moc(), dau = await doc(), truoc = dau, n0 = dau.log;
      const buocLoi = [];
      let nangDoi = 0, bongDoi = 0, soBuoc = 0;
      for (let i = 0; i < 40; i++) {
        await gui('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
        await gui('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
        const s = await doc();
        soBuoc++;
        if (Math.abs(s.luc - truoc.luc - 0.05) > 1e-3) buocLoi.push(`${tron(truoc.luc)}→${tron(s.luc)}`);
        if (s.v !== null && Math.abs(s.v - s.luc) > 1e-3) buocLoi.push(`thanh ${s.v} ≠ kho ${tron(s.luc)}`);
        if (la3D && s.nang) {
          if (Math.abs(s.nang.gio - s.luc) > EPS) buocLoi.push(`3D đặt mặt trời theo ${tron(s.nang.gio)} ≠ kho ${tron(s.luc)}`);
          if (truoc.nang && s.nang.huong.some((x, j) => Math.abs(x - truoc.nang.huong[j]) > 1e-7)) nangDoi++;
        }
        if (!la3D && s.bong && s.bong !== truoc.bong) bongDoi++;
        truoc = s;
      }
      const lg = await luiTrongLog(n0);
      r.phim = { tu: tron(dau.luc), toi: tron(truoc.luc), buoc: soBuoc, buocLoi: buocLoi.length, lui: lg.lui.length, nangDoi, bongDoi, dai: await dai(t0) };
      bao(nhan + '·phím', !buocLoi.length, `bước sai (${buocLoi.length}): ${buocLoi.slice(0, 6).join(' · ')}`);
      bao(nhan + '·phím', !lg.lui.length, `kho bị ghi lùi ${lg.lui.length} lần: ${lg.lui.slice(0, 6).map((x) => x.join('→')).join(' · ')}`);
      if (la3D && truoc.nang) bao(nhan + '·phím', nangDoi === soBuoc, `mặt trời 3D chỉ đổi ${nangDoi}/${soBuoc} bước`);
      if (la3D && !truoc.nang) baoCanh(nhan, 'khung 3D không có móc _nang (bản cũ?) — không kiểm được mặt trời');
      if (!la3D) bao(nhan + '·phím', bongDoi === soBuoc, `bóng 2D chỉ đổi ${bongDoi}/${soBuoc} bước`);
      // --- 2) kéo chuột / chạm kéo từng bước nhỏ ---
      const hcn = await js(`(() => { const e = ${thanh}; e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, min: +e.min, max: +e.max, v: +e.value }; })()`);
      const tx = hcn.x + 8 + ((hcn.v - hcn.min) / (hcn.max - hcn.min)) * (hcn.w - 16), ty = hcn.y + hcn.h / 2;
      t0 = await moc(); dau = await doc(); n0 = dau.log;
      const SO = 60, BUOC = k.mobile ? 1 : 2;
      if (!k.mobile) {
        await gui('Input.dispatchMouseEvent', { type: 'mousePressed', x: tx, y: ty, button: 'left', buttons: 1, clickCount: 1 });
        dau = await doc(); n0 = dau.log + 1; // bấm xuống có thể nhảy tới chỗ bấm (ước vị trí núm): kiểm đơn điệu từ sau lượt bấm
        for (let i = 1; i <= SO; i++) { await gui('Input.dispatchMouseEvent', { type: 'mouseMoved', x: tx + i * BUOC, y: ty, button: 'left', buttons: 1 }); await js('new Promise((r) => requestAnimationFrame(() => r(1)))'); }
        await gui('Input.dispatchMouseEvent', { type: 'mouseReleased', x: tx + SO * BUOC, y: ty, button: 'left', buttons: 0, clickCount: 1 });
      } else {
        await gui('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tx, y: ty }] });
        dau = await doc(); n0 = dau.log + 1;
        for (let i = 1; i <= SO; i++) { await gui('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tx + i * BUOC, y: ty }] }); await js('new Promise((r) => requestAnimationFrame(() => r(1)))'); }
        await gui('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
      let cuoi = await doc();
      const lgK = await luiTrongLog(n0);
      r.keo = { tu: tron(dau.luc), toi: tron(cuoi.luc), ghi: lgK.n, lui: lgK.lui.length, dai: await dai(t0) };
      bao(nhan + '·kéo', cuoi.luc > dau.luc + 0.05, `kéo ${SO * BUOC} px mà giờ không tăng (${tron(dau.luc)} → ${tron(cuoi.luc)})`);
      bao(nhan + '·kéo', !lgK.lui.length, `kho bị ghi lùi ${lgK.lui.length} lần khi kéo: ${lgK.lui.slice(0, 6).map((x) => x.join('→')).join(' · ')}`);
      if (la3D && cuoi.nang) bao(nhan + '·kéo', Math.abs(cuoi.nang.gio - cuoi.luc) < EPS, `3D cuối kéo ${tron(cuoi.nang.gio)} ≠ kho ${tron(cuoi.luc)}`);
      // --- 3) đặt bằng mã: input, rồi chỉ change ---
      const datMa = (v, loai) => js(`(() => { const e = ${thanh}; const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(e, '${v}');
        e.dispatchEvent(new Event('${loai}', { bubbles: true })); return true; })()`);
      const gm = +(hcn.min + 2.35).toFixed(2), gc = +(hcn.min + 3.6).toFixed(2);
      await datMa(gm, 'input'); const a = await doc();
      await datMa(gc, 'change'); const b = await doc();
      r.ma = { input: [gm, tron(a.luc)], change: [gc, tron(b.luc)] };
      bao(nhan + '·mã', Math.abs(a.luc - gm) < 1e-3, `đặt value=${gm} + input → kho ${tron(a.luc)}`);
      bao(nhan + '·mã', Math.abs(b.luc - gc) < 1e-3, `đặt value=${gc} + change → kho ${tron(b.luc)}`);
      if (la3D && b.nang) bao(nhan + '·mã', Math.abs(b.nang.gio - b.luc) < EPS, `3D sau change ${tron(b.nang.gio)} ≠ kho ${tron(b.luc)}`);
      // --- 4) ▶ chạy 2 s: lấy mẫu mỗi khung trong trang ---
      t0 = await moc(); n0 = (await doc()).log;
      await bam('.hop-nang-gio .hng-chay');
      const mau = await js(`new Promise((ok) => { const v = document.querySelector('.vung-3d'), d = window.__kg, m = []; const het = performance.now() + 2000;
        const b = (t) => { m.push([t, d.kho.layNG().luc, v && v._nang ? v._nang().gio : null]); if (t < het) requestAnimationFrame(b); else ok(m); }; requestAnimationFrame(b); })`);
      await bam('.hop-nang-gio .hng-chay');
      const lgC = await luiTrongLog(n0, true);
      let lui = 0, nhay = 0, vong = 0, dung = 0, theo = 0, coNang = 0;
      const dg = [];
      for (let i = 1; i < mau.length; i++) {
        const d = mau[i][1] - mau[i - 1][1];
        if (d < -1) vong++; else if (d < -EPS) lui++; else if (d > 0.1 + 1e-6) nhay++; else if (d < EPS) dung++; else dg.push(d / ((mau[i][0] - mau[i - 1][0]) / 1000));
        // 3D: giờ đặt mặt trời ở khung i (khung trước đã ghi) = giờ kho của khung i−1 hoặc i (trễ ≤ 1 khung)
        if (mau[i][2] !== null) { coNang++; if (Math.abs(mau[i][2] - mau[i][1]) < EPS || Math.abs(mau[i][2] - mau[i - 1][1]) < EPS) theo++; }
      }
      const tb = dg.reduce((s, x) => s + x, 0) / Math.max(1, dg.length);
      r.chay = { khung: mau.length, tu: tron(mau[0][1]), toi: tron(mau.at(-1)[1]), lui, nhay, vong, dung, tocDoTB: tron(tb), lui3: lgC.lui.length, theo3D: coNang ? `${theo}/${coNang}` : '—', dai: await dai(t0) };
      bao(nhan + '·▶', !lui && !lgC.lui.length, `▶ chạy: giờ lùi ${lui} khung, kho ghi lùi ${lgC.lui.length} lần`);
      bao(nhan + '·▶', !nhay, `▶ chạy: ${nhay} khung nhảy > 0,1 h`);
      bao(nhan + '·▶', vong <= 1 && mau.length > 30, `▶ chạy: ${mau.length} khung, ${vong} lần vòng`);
      bao(nhan + '·▶', dung <= Math.max(2, mau.length * 0.05), `▶ chạy: ${dung} khung giờ đứng yên`);
      bao(nhan + '·▶', dg.length > 10 && Math.abs(tb - 1) < 0.15, `▶ chạy: tốc độ TB ${tron(tb)} h/s (phải ≈ 1)`);
      if (la3D && coNang) bao(nhan + '·▶', theo >= coNang - 1, `▶ chạy: 3D chỉ theo kịp ${theo}/${coNang} khung`);
      // --- tác vụ dài ---
      const tatCa = [...(r.phim?.dai ?? []), ...(r.keo?.dai ?? []), ...(r.chay?.dai ?? [])].filter((x) => x > NG_DAI);
      if (tatCa.length) (k.mobile ? (c) => baoCanh(nhan, c) : (c) => bao(nhan, false, c))(`${tatCa.length} tác vụ dài > ${NG_DAI} ms khi kéo / chạy (dài nhất ${Math.max(...tatCa)} ms)`);
      return r;
    };

    for (const k of KHUNG) {
      console.log(`\n== ${k.ten} ${k.w}×${k.h}${k.mobile ? ' cảm ứng' : ''} · CPU ${k.cpu}×`);
      const r = (tong[k.ten] = {});
      await gui('Emulation.setDeviceMetricsOverride', { width: k.w, height: k.h, deviceScaleFactor: k.dpr, mobile: k.mobile });
      await gui('Emulation.setTouchEmulationEnabled', { enabled: k.mobile, maxTouchPoints: k.mobile ? 5 : 1 });
      await gui('Emulation.setCPUThrottlingRate', { rate: 1 });
      await moi(`${URL0}/`);
      await js(`${MA_SUA ? `localStorage.setItem('unitmix.maSua.${MA}', '${MA_SUA}');` : ''} localStorage.removeItem('unitmix.nang-gio.v1'); true`);
      await moi(`${URL0}/du-an/${MA}?pa=${PA}`);
      if (!(await doiCo(`!!document.querySelector('.ban-ve-svg')`))) throw new Error('Không mở được dự án');
      await js(NOI_KHO);
      await cho(1200);
      // --- 3D Toàn dự án ---
      await bam('.tab-xem button', 1);
      if (!(await doiCo(`!!document.querySelector('.vung-3d.da-dung')`, 90000))) throw new Error('3D không dựng xong');
      await cho(1500);
      await gui('Emulation.setCPUThrottlingRate', { rate: k.cpu });
      if (!(await js(`!!document.querySelector('.hop-nang-gio')`))) await bamChu('/Vị trí · Nắng · Gió|Location · Sun · Wind/', '.thanh-3d');
      await doiCo(`!!document.querySelector('.hop-nang-gio')`, 15000);
      await bamChu('/^ ?Nắng$|^ ?Sun$/', '.hng-tab');
      await doiCo(`!!document.querySelector('.hop-nang-gio .hng-chay')`, 5000);
      await cho(400);
      r['3d'] = await baiThanh(k, '3d', true);
      await chup(`${k.ten}-3d`);
      // --- TMB: bóng 2D (hộp vẫn mở — kho chung) ---
      await gui('Emulation.setCPUThrottlingRate', { rate: 1 });
      await bam('.tab-xem button', 0);
      await doiCo(`!!document.querySelector('.ban-ve-svg')`); await cho(800);
      if (!(await js(`!!document.querySelector('.hop-nang-gio')`))) {
        await bam('.goc-bv.phai .nhom-bt button', 0); await cho(200);
        await bamChu('/Vị trí · Nắng · Gió|Location · Sun · Wind/', '.goc-bv-hop'); await cho(300);
        await bam('.goc-bv.phai .nhom-bt button', 0);
      }
      await doiCo(`!!document.querySelector('.hop-nang-gio')`, 15000);
      await bamChu('/^ ?Nắng$|^ ?Sun$/', '.hng-tab');
      await doiCo(`!!document.querySelector('.ng-bong polygon')`, 8000);
      await gui('Emulation.setCPUThrottlingRate', { rate: k.cpu });
      r['2d'] = await baiThanh(k, '2d', false);
      await chup(`${k.ten}-2d`);
      for (const [ten, x] of Object.entries(r)) console.log(`  ${ten}:`, JSON.stringify({ ...x, phim: x.phim && { ...x.phim, dai: x.phim.dai.length }, keo: x.keo && { ...x.keo, dai: x.keo.dai.length }, chay: x.chay && { ...x.chay, dai: x.chay.dai.length } }));
    }
    if (loiJs.length) { loi++; console.log('  LỖI  JS:', loiJs.slice(0, 5).join(' | ')); }
    writeFileSync(join(RA, 'ket_qua.json'), JSON.stringify(tong, null, 1));
    ws.close();
  } finally {
    tr.kill();
    await cho(500);
    try { rmSync(hoSo, { recursive: true, force: true }); } catch { /* trình duyệt còn giữ tệp */ }
  }
  console.log(`\n${loi ? `THANH GIỜ NẮNG: ${loi} LỖI` : 'THANH GIỜ NẮNG ĐẠT'}${canh ? ` · ${canh} cảnh báo` : ''} — chi tiết ${join(RA, 'ket_qua.json')}`);
  process.exit(loi ? 1 : 0);
}
main().catch((e) => { console.error('Lỗi hạ tầng:', e.message); process.exit(2); });
