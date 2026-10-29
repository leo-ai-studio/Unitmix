#!/usr/bin/env node
/**
 * ĐO + CHỤP gói Vị trí · Nắng · Gió (KHÔNG nằm trong cổng kiem.mjs) — Edge / Chrome headless qua CDP, Node ≥ 22.
 * Mỗi khung (máy bàn 1440×900 CPU 1× · điện thoại 390×844 @3x cảm ứng CPU 4×): mở dự án → TMB bật ảnh vệ tinh 2D → kéo / lăn bản vẽ →
 * hộp Nắng: bóng đổ 2D + tính giờ nắng → 3D: ảnh nền + đường mặt trời + chạy giờ (FPS) + giờ nắng 3D → Gió: hoa gió + mô phỏng → ảnh.
 * Đo tác vụ dài luồng chính (PerformanceObserver longtask) từng pha: số tác vụ > 50 ms và tác vụ dài nhất.
 *   node scripts/do_nang_gio.mjs --url http://127.0.0.1:5631 --du-an 2mlg1a2l --ma-sua <mã> [--pa pa-1] [--ra docs/anh/nang-gio] [--chi may|dt]
 * Tải ô ảnh vệ tinh thật (Esri) + Open-Meteo một lần — lưu lượng nhỏ.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const arg = (k, md) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : md; };
const URL0 = arg('--url', 'http://127.0.0.1:5631'), MA = arg('--du-an'), PA = arg('--pa', 'pa-1'), MA_SUA = arg('--ma-sua');
const RA = resolve(arg('--ra', 'docs/anh/nang-gio')), CHI = arg('--chi');
if (!MA) { console.error('Thiếu --du-an'); process.exit(2); }
const cho = (ms) => new Promise((r) => setTimeout(r, ms));
const exe = [process.env.CHROME_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => p && existsSync(p));
const KHUNG = [
  { ten: 'may', w: 1440, h: 900, dpr: 1, mobile: false, cpu: 1 },
  { ten: 'dt', w: 390, h: 844, dpr: 3, mobile: true, cpu: 4 },
].filter((k) => !CHI || k.ten === CHI);
const CAI = `(() => { const d = window.__do = { lt: [] };
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) d.lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch {} })();`;

async function main() {
  mkdirSync(RA, { recursive: true });
  const port = 19700 + (process.pid % 200), hoSo = join(resolve('.cache'), `ng-${process.pid}`);
  mkdirSync(hoSo, { recursive: true });
  const tr = spawn(exe, ['--headless=new', '--no-first-run', '--disable-extensions', '--hide-scrollbars', '--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist',
    `--remote-debugging-port=${port}`, `--user-data-dir=${hoSo}`, 'about:blank'], { stdio: 'ignore' });
  const kq = {};
  try {
    let ds;
    for (let i = 0; i < 80 && !ds?.some((x) => x.type === 'page'); i++) { try { ds = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { await cho(250); } }
    const ws = new WebSocket(ds.find((x) => x.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    let id = 0; const doi = new Map(), nghe = new Set(), loiJs = [];
    ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && doi.has(m.id)) { const d = doi.get(m.id); doi.delete(m.id); m.error ? d.ko(new Error(JSON.stringify(m.error))) : d.ok(m.result); } else nghe.forEach((f) => f(m)); });
    nghe.add((m) => { if (m.method === 'Runtime.exceptionThrown') loiJs.push(m.params.exceptionDetails?.exception?.description?.slice(0, 200) ?? m.params.exceptionDetails?.text); });
    const gui = (method, params = {}) => new Promise((ok, ko) => { const i = ++id; doi.set(i, { ok, ko }); ws.send(JSON.stringify({ id: i, method, params })); });
    const js = async (bt) => { const r = await gui('Runtime.evaluate', { expression: bt, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + bt.slice(0, 80)); return r.result.value; };
    const doiCo = async (bt, ms = 60000) => { const het = Date.now() + ms; while (Date.now() < het) { if (await js(bt)) return true; await cho(200); } return false; };
    const bam = (sel, i = 0) => js(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${i}]; if (!e) return false; e.click(); return true; })()`);
    const bamChu = (re, pham = 'body') => js(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(pham + ' button, ' + pham + ' label')})]
      .find((x) => ${re}.test((x.getAttribute('aria-label') || '') + ' ' + x.textContent.trim())); if (!e || e.disabled) return false; e.click(); return true; })()`);
    const chup = async (ten) => { const r = await gui('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(RA, ten + '.png'), Buffer.from(r.data, 'base64')); };
    const moc = () => js('performance.now()');
    const dai = async (tu) => { const lt = (await js('window.__do.lt')).filter(([s]) => s >= tu); return { so: lt.length, max: Math.round(Math.max(0, ...lt.map((x) => x[1]))) }; };
    const khungGiua = () => js(`(() => { const e = document.querySelector('.panel-giua'); if (!e) return null; const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round).join(','); })()`);
    await gui('Page.enable'); await gui('Runtime.enable');
    await gui('Page.addScriptToEvaluateOnNewDocument', { source: CAI });
    const moi = async (u) => { const x = new Promise((r) => { const f = (m) => { if (m.method === 'Page.loadEventFired') { nghe.delete(f); r(); } }; nghe.add(f); }); await gui('Page.navigate', { url: u }); await x; };
    for (const k of KHUNG) {
      const r = (kq[k.ten] = { pha: {} });
      await gui('Emulation.setDeviceMetricsOverride', { width: k.w, height: k.h, deviceScaleFactor: k.dpr, mobile: k.mobile });
      await gui('Emulation.setTouchEmulationEnabled', { enabled: k.mobile, maxTouchPoints: k.mobile ? 5 : 1 });
      await gui('Emulation.setCPUThrottlingRate', { rate: 1 });
      await moi(`${URL0}/`);
      await js(`localStorage.setItem('unitmix.maSua.${MA}', '${MA_SUA}'); localStorage.removeItem('unitmix.nang-gio.v1'); true`);
      await moi(`${URL0}/du-an/${MA}?pa=${PA}`);
      await doiCo(`!!document.querySelector('.ban-ve-svg')`);
      await cho(1500);
      await gui('Emulation.setCPUThrottlingRate', { rate: k.cpu });
      const g0 = await khungGiua();
      // mốc so sánh: mở 3D khi chưa bật gì của gói này (tác vụ dài sẵn có của app)
      let t0 = await moc();
      await bam('.tab-xem button', 1);
      await doiCo(`!!document.querySelector('.vung-3d.da-dung')`, 60000);
      await cho(2500);
      r.pha.mo3DGoc = await dai(t0);
      await bam('.tab-xem button', 0);
      await doiCo(`!!document.querySelector('.ban-ve-svg')`); await cho(1000);
      // --- 2D: bật ảnh vệ tinh ---
      t0 = await moc();
      await bam('.goc-bv.phai .nhom-bt button', 0); await cho(300);
      await bamChu('/Ảnh vệ tinh nền|Satellite basemap/', '.goc-bv-hop');
      await doiCo(`document.querySelectorAll('.ng-ban-do image').length > 0`, 15000);
      await cho(4000);
      r.pha.banDo2D = { ...(await dai(t0)), anh: await js(`document.querySelectorAll('.ng-ban-do image').length`) };
      await bam('.goc-bv.phai .nhom-bt button', 0); // đóng danh sách Lớp
      await chup(`${k.ten}-1-tmb-anh-ve-tinh`);
      // --- kéo + lăn bản vẽ ---
      const [cx, cy] = [k.w / 2, k.h / 2];
      t0 = await moc();
      if (!k.mobile) {
        for (let i = 0; i < 8; i++) { await gui('Input.dispatchMouseEvent', { type: 'mouseWheel', x: cx, y: cy, deltaX: 0, deltaY: i < 4 ? -240 : 240 }); await cho(120); }
        await gui('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy + 150, button: 'left', clickCount: 1 });
        for (let i = 1; i <= 20; i++) { await gui('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx + i * 8, y: cy + 150, button: 'left', buttons: 1 }); await cho(16); }
        await gui('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx + 160, y: cy + 150, button: 'left' });
      } else {
        await gui('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy + 100 }] });
        for (let i = 1; i <= 20; i++) { await gui('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + i * 5, y: cy + 100 }] }); await cho(16); }
        await gui('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
      await cho(2500);
      r.pha.keoLan2D = await dai(t0);
      // --- hộp Nắng: bóng 2D + giờ nắng ---
      if (!(await js(`!!document.querySelector('.hop-nang-gio')`))) {
        await bam('.goc-bv.phai .nhom-bt button', 0); await cho(200);
        await bamChu('/Vị trí · Nắng · Gió|Location · Sun · Wind/', '.goc-bv-hop'); await cho(300);
        await bam('.goc-bv.phai .nhom-bt button', 0);
      }
      await doiCo(`!!document.querySelector('.hop-nang-gio')`, 15000);
      await chup(`${k.ten}-2-hop-vi-tri`);
      await bamChu('/^ ?Nắng$|^ ?Sun$/', '.hng-tab');
      await cho(400);
      t0 = await moc();
      await bamChu('/Chạy giờ|Play time/', '.hop-nang-gio'); await cho(2500); await bamChu('/^Dừng|^Pause/', '.hop-nang-gio');
      r.pha.bong2DChay = await dai(t0);
      await chup(`${k.ten}-3-tmb-bong-do`);
      t0 = await moc();
      await bamChu('/Tính giờ nắng|Compute sun hours/', '.hop-nang-gio');
      const xongN = await doiCo(`!!document.querySelector('.hop-nang-gio .thang-mau') && ![...document.querySelectorAll('.hop-nang-gio button')].some(b => /Huỷ|Cancel/.test(b.textContent))`, 120000);
      r.pha.gioNang = { ...(await dai(t0)), ms: Math.round((await moc()) - t0), xong: xongN };
      await cho(800);
      await chup(`${k.ten}-4-tmb-gio-nang`);
      r.giua2D = [g0, await khungGiua()];
      // --- 3D ---
      t0 = await moc();
      await bam('.tab-xem button', 1);
      await doiCo(`!!document.querySelector('.vung-3d.da-dung')`, 60000);
      await cho(2500);
      r.pha.mo3D = await dai(t0);
      t0 = await moc();
      // ảnh nền 3D: menu Lớp của khung 3D (góc phải dưới) › Ảnh vệ tinh nền
      await bam('.khung-3d .goc-bv.phai .nhom-bt button', 0); await cho(300);
      await bamChu('/Ảnh vệ tinh nền|Satellite basemap/', '.khung-3d .goc-bv-hop');
      await cho(300); await chup(`${k.ten}-5a-3d-menu-lop`);
      await bam('.khung-3d .goc-bv.phai .nhom-bt button', 0);
      await cho(6000);
      r.pha.anhNen3D = await dai(t0);
      await chup(`${k.ten}-5-3d-anh-nen-gio-nang`);
      if (!k.mobile) r.fps3D = await js(`document.querySelector('.vung-3d')._doFps?.(3)`);
      t0 = await moc();
      await bamChu('/Chạy giờ|Play time/', '.hop-nang-gio'); await cho(3000); await bamChu('/^Dừng|^Pause/', '.hop-nang-gio');
      r.pha.chayGio3D = await dai(t0);
      await chup(`${k.ten}-6-3d-bong-do-duong-mat-troi`);
      // phân tích view (lớp của gói khác) bật: cảnh + ảnh nền cùng nhạt đi
      if (await bamChu('/Phân tích view|View analysis/', '.thanh-3d')) { await cho(4000); await chup(`${k.ten}-6b-3d-phan-tich-view-anh-nen-nhat`); await bamChu('/Phân tích view|View analysis/', '.thanh-3d'); await cho(800); }
      r.giua3D = await khungGiua();
      // --- Gió ---
      await bamChu('/^ ?Gió$|^ ?Wind$/', '.hng-tab');
      await doiCo(`!!document.querySelector('.hoa-gio-ng')`, 30000);
      t0 = await moc();
      await bamChu('/Chạy mô phỏng gió|Run wind simulation/', '.hop-nang-gio');
      const xongG = await doiCo(`!!document.querySelector('.hop-nang-gio .thang-mau-lop')`, 240000);
      r.pha.gio = { ...(await dai(t0)), ms: Math.round((await moc()) - t0), xong: xongG };
      await cho(800);
      await chup(`${k.ten}-7-3d-tien-nghi-gio`);
      await bam('.tab-xem button', 0);
      await doiCo(`!!document.querySelector('.ban-ve-svg')`);
      await cho(1500);
      await chup(`${k.ten}-8-tmb-tien-nghi-gio`);
      r.loiJs = loiJs.splice(0);
      await gui('Emulation.setCPUThrottlingRate', { rate: 1 });
      console.log(k.ten, JSON.stringify(r));
    }
    writeFileSync(join(RA, `do-${CHI ?? 'tat-ca'}.json`), JSON.stringify(kq, null, 2));
  } finally {
    tr.kill();
    await cho(500);
    try { rmSync(hoSo, { recursive: true, force: true }); } catch { /* bỏ */ }
  }
}
main().catch((e) => { console.error(e); process.exit(2); });
