#!/usr/bin/env node
/**
 * CHỤP + ĐO PHÂN TÍCH VIEW (Edge / Chrome headless qua CDP, Node ≥ 22; cùng cách khởi chạy với kiem_man_hep.mjs).
 * Mở màn soạn một dự án, bật lớp view ở TMB, mở 3D Toàn dự án / Công trình bật "Phân tích view", màn Tầng; chụp máy bàn 1440×900
 * và điện thoại 390×844; đo khung giữa trước / sau khi bật (không được đổi) và tác vụ dài (> 50 ms, PerformanceObserver longtask)
 * khi bật phân tích view 3D.
 *   node scripts/chup_view.mjs --url http://127.0.0.1:5733 --du-an <mã> [--pa pa-1] [--ma-sua <mã>] [--tien-to v2-] [--ra docs/anh/huong-view]
 *        [--chi may-ban|dien-thoai] [--truoc]   (--truoc: bản cũ chưa có nút Phân tích view 3D — chỉ chụp TMB / 3D / Tầng)
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const arg = (k, md) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : md; };
const URL0 = arg('--url', 'http://127.0.0.1:5180'), MA = arg('--du-an'), PA = arg('--pa', 'pa-1'), MA_SUA = arg('--ma-sua');
const RA = resolve(arg('--ra', 'docs/anh/huong-view')), TIEN_TO = arg('--tien-to', 'v2-'), CHI = arg('--chi'), TRUOC = process.argv.includes('--truoc');
if (!MA) { console.error('Thiếu --du-an'); process.exit(2); }
const cho = (ms) => new Promise((r) => setTimeout(r, ms));
/** Trong trang: bấm "Phân tích view" (đang tắt), đo tới khi lớp đã dựng (data-view = xong) + tác vụ dài > 50 ms tới 1,2 s sau đó. */
const DO_BAT = `(() => new Promise((res) => {
  const dai = []; let ob2; try { ob2 = new PerformanceObserver((l) => { for (const e of l.getEntries()) dai.push(Math.round(e.duration)); }); ob2.observe({ type: 'longtask', buffered: false }); } catch {}
  const k = document.querySelector('.khung-3d'), t0 = performance.now();
  const xong = (ms) => setTimeout(() => { ob2?.disconnect(); res({ ms: Math.round(ms), dai }); }, 1200);
  const ob = new MutationObserver(() => { if (k.dataset.view === 'xong') { ob.disconnect(); xong(performance.now() - t0); } });
  ob.observe(k, { attributes: true });
  document.querySelector('.nut-phan-tich-view').click();
  setTimeout(() => { ob.disconnect(); xong(-1); }, 30000);
}))`;
const exe = [process.env.CHROME_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => p && existsSync(p));

const KHUNG = [{ ten: 'may-ban', w: 1440, h: 900, mobile: false }, { ten: 'dien-thoai', w: 390, h: 844, mobile: true }].filter((k) => !CHI || k.ten === CHI);

const port = 19500 + (process.pid % 200), hoSo = resolve('.cache', `chup-view-${process.pid}`);
mkdirSync(hoSo, { recursive: true }); mkdirSync(RA, { recursive: true });
const tr = spawn(exe, ['--headless=new', '--inprivate', '--disable-sync', '--disable-extensions', '--no-first-run', '--hide-scrollbars',
  `--remote-debugging-port=${port}`, `--user-data-dir=${hoSo}`, 'about:blank'], { stdio: 'ignore' });
let loi = 0;
try {
  let ds;
  for (let i = 0; i < 80 && !ds?.some((x) => x.type === 'page'); i++) { try { ds = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { await cho(250); } }
  const ws = new WebSocket(ds.find((x) => x.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0; const doi = new Map(), nghe = new Set();
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && doi.has(m.id)) { const d = doi.get(m.id); doi.delete(m.id); m.error ? d.ko(new Error(JSON.stringify(m.error))) : d.ok(m.result); } else nghe.forEach((f) => f(m)); });
  const gui = (method, params = {}) => new Promise((ok, ko) => { const i = ++id; doi.set(i, { ok, ko }); ws.send(JSON.stringify({ id: i, method, params })); });
  const js = async (bt) => { const r = await gui('Runtime.evaluate', { expression: bt, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description ?? '')); return r.result.value; };
  const moi = async (u) => { const x = new Promise((r) => { const f = (m) => { if (m.method === 'Page.loadEventFired') { nghe.delete(f); r(); } }; nghe.add(f); }); await gui('Page.navigate', { url: u }); await x; };
  const doiCo = async (bt, ms = 30000) => { const het = Date.now() + ms; while (Date.now() < het) { if (await js(bt)) return true; await cho(200); } return false; };
  const bam = (sel, i = 0) => js(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${i}]; if (!e) return false; e.click(); return true; })()`);
  const bamChu = (re, pham = 'body') => js(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(pham + ' button, ' + pham + ' label')})]
      .find((x) => ${re}.test((x.getAttribute('aria-label') || '') + ' ' + (x.getAttribute('title') || '') + ' ' + x.textContent.trim()) && x.getBoundingClientRect().width > 0); if (!e || e.disabled) return false; e.click(); return true; })()`);
  const chup = async (ten) => { const a = await gui('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(RA, `${TIEN_TO}${ten}.png`), Buffer.from(a.data, 'base64')); console.log('ảnh', `${TIEN_TO}${ten}.png`); };
  const giua = () => js(`(() => { const g = document.querySelector('.panel-giua')?.getBoundingClientRect(); return g ? [g.left, g.top, g.width, g.height].map(Math.round).join(',') : null; })()`);
  const loiJs = [];
  nghe.add((m) => { if (m.method === 'Runtime.exceptionThrown') loiJs.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text); });
  await gui('Page.enable'); await gui('Runtime.enable');
  for (const k of KHUNG) {
    await gui('Emulation.setDeviceMetricsOverride', { width: k.w, height: k.h, deviceScaleFactor: k.mobile ? 2 : 1, mobile: k.mobile });
    await gui('Emulation.setTouchEmulationEnabled', { enabled: k.mobile, maxTouchPoints: 5 });
    await moi(URL0 + '/');
    if (MA_SUA) await js(`localStorage.setItem('unitmix.maSua.${MA}', '${MA_SUA}'); true`);
    await moi(`${URL0}/du-an/${MA}?pa=${PA}`);
    if (!(await doiCo(`!!document.querySelector('.panel-giua .ban-ve-svg, .panel-giua .giua-man')`))) throw new Error('Không mở được màn soạn');
    await cho(1500);
    const hep = await js(`!!document.querySelector('.khung-soan.hep')`);
    const g0 = await giua();
    if (!TRUOC) {
      // --- ĐO: 3D Toàn dự án, bật Phân tích view lần đầu (lạnh: tính nền trong worker + dựng lớp) rồi tắt / bật lại (ấm) ---
      await bam('.tab-xem button', 1);
      await doiCo(`!!document.querySelector('.vung-3d.da-dung')`, 60000); await cho(2500);
      const nen = await js(`new Promise((res) => { const dai = []; let o; try { o = new PerformanceObserver((l) => { for (const e of l.getEntries()) dai.push(Math.round(e.duration)); }); o.observe({ type: 'longtask' }); } catch {} setTimeout(() => { o?.disconnect(); res(dai); }, 2000); })`);
      const lanh = await js(`${DO_BAT}()`);
      await cho(800);
      await bam('.nut-phan-tich-view'); await cho(1200); // tắt
      const am = await js(`${DO_BAT}()`);
      console.log(`đo ${k.ten} (${await js('(() => { const c = document.createElement("canvas").getContext("webgl2"); const e = c?.getExtension("WEBGL_debug_renderer_info"); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : "?"; })()')})`);
      console.log(`  nền 2 s không thao tác: tác vụ dài ${JSON.stringify(nen)}`);
      console.log(`  bật lần đầu (lạnh): lớp dựng xong sau ${lanh.ms} ms, tác vụ dài ${JSON.stringify(lanh.dai)} (gồm 1,2 s sau khi xong: hiện dần 0,42 s)`);
      console.log(`  bật lại (ấm):      lớp dựng xong sau ${am.ms} ms, tác vụ dài ${JSON.stringify(am.dai)}`);
      await bam('.nut-phan-tich-view'); await cho(800); // tắt lại, về TMB
      await bam('.tab-xem button', 0); await cho(800);
    }
    // --- TMB: bật lớp view, chọn tòa đầu tiên ---
    await bam('.tab-buoc button', 0); await bam('.tab-xem button', 0); await cho(400);
    const daBat = await js(`!!document.querySelector('.lop-view')`);
    if (!daBat) {
      // nút Lớp ở góc bản vẽ → Điểm view căn
      if (!(await bamChu('/Điểm view căn|Phân tích view/', '.panel-giua'))) { await bamChu('/Lớp|Layers/', '.panel-giua'); await cho(300); await bamChu('/Điểm view căn|Phân tích view/'); }
      await cho(300);
      await bam('.goc-ban-ve .menu-lop-dong, .hop-noi .dong'); // đóng menu nếu còn
    }
    await doiCo(`!!document.querySelector('.lop-view')`, 8000);
    // chọn tòa: tòa đầu tiên trong danh sách tòa của panel trái (hoặc qua móc thử)
    await bam(".dong-toa-view", 1);
    await cho(1200);
    const g1 = await giua();
    if (g0 !== g1) { console.log(`LỖI  ${k.ten}: khung giữa đổi khi bật lớp view ${g0} → ${g1}`); loi++; }
    await chup(`${k.ten}-tmb`);
    if (hep) {
      await bam('.dock-duoi > .nut-bt', 1); await cho(700);
      await js(`(() => { const e = document.querySelector('.panel-view'); e?.scrollIntoView({ block: 'start' }); return true; })()`); await cho(300);
      await chup(`${k.ten}-panel`);
      await bam('.dock-duoi > .nut-bt', 1); await cho(500);
    }
    // --- 3D toàn dự án (tắt lớp trước để đo lượt bật trong 3D) ---
    if (!TRUOC) await bam('.chu-giai-view .nut-dong-view');
    await bam('.tab-xem button', 1);
    await doiCo(`!!document.querySelector('.vung-3d.da-dung')`, 60000); await cho(2500);
    if (!TRUOC) {
      if ((await js(`document.querySelector('.nut-phan-tich-view')?.getAttribute('aria-pressed')`)) !== 'true') await js(`${DO_BAT}()`);
      await cho(800);
      const g2 = await giua();
      if (g0 !== g2) { console.log(`LỖI  ${k.ten}: khung giữa đổi ở 3D ${g0} → ${g2}`); loi++; }
      // rê / chạm một ô
      await js(`(() => { const h = document.querySelector('.vung-3d'); const o = h._oViewThu?.(); if (!o) return false; const r = h.getBoundingClientRect();
        h.querySelector('canvas').dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + o.x, clientY: r.top + o.y, pointerType: 'mouse', bubbles: true, isPrimary: true })); return true; })()`);
      await cho(800);
    }
    await chup(`${k.ten}-3d-du-an`);
    if (!TRUOC && !k.mobile) {
      // góc chim bay Tây Bắc: thấy mặt Bắc / Tây (điểm thấp hơn) + lọc "Kém"
      await bamChu('/Chim bay Tây Bắc|NW/', '.khung-3d'); await cho(1500);
      await bam('.chu-giai-3d-view .thang-view-doan button', 0); await cho(600);
      await js(`(() => { const h = document.querySelector('.vung-3d'); const o = h._oViewThu?.(); if (!o) return false; const r = h.getBoundingClientRect();
        h.querySelector('canvas').dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + o.x, clientY: r.top + o.y, pointerType: 'mouse', bubbles: true, isPrimary: true })); return true; })()`);
      await cho(800);
      await chup(`${k.ten}-3d-tay-bac-loc-kem`);
      await bam('.chu-giai-3d-view .thang-view-doan button', 0); await cho(400);
    }
    if (!TRUOC) {
      // --- 3D công trình ---
      if (await bamChu('/Công trình|Building/', '.khung-3d')) {
        await cho(600); await doiCo(`!!document.querySelector('.vung-3d.da-dung')`, 60000); await cho(2500);
        await doiCo(`document.querySelector('.khung-3d')?.dataset.view === 'xong'`, 20000); await cho(800);
        await js(`(() => { const h = document.querySelector('.vung-3d'); const o = h._oViewThu?.(); if (!o) return false; const r = h.getBoundingClientRect();
          h.querySelector('canvas').dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + o.x, clientY: r.top + o.y, pointerType: 'mouse', bubbles: true, isPrimary: true })); return true; })()`);
        await cho(800);
        await chup(`${k.ten}-3d-cong-trinh`);
        await bamChu('/Toàn dự án|Whole project/', '.khung-3d'); await cho(500);
      }
    }
    // --- màn Tầng ---
    await bam('.tab-xem button', 0); await cho(300);
    await bam('.tab-buoc button', 1);
    await doiCo(`!!document.querySelector('.lop-view-tang')`, 20000); await cho(1200);
    await js(`(() => { const c = document.querySelector('.chip-view'); if (!c) return false; c.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; })()`);
    await cho(500);
    await chup(`${k.ten}-tang`);
    await bam('.tab-buoc button', 0); await cho(500);
  }
  if (loiJs.length) { console.log('LỖI JS:\n' + loiJs.slice(0, 5).join('\n')); loi++; }
  ws.close();
} finally { tr.kill(); await cho(300); try { rmSync(hoSo, { recursive: true, force: true }); } catch { /* */ } }
console.log(loi ? `CHỤP VIEW: CÓ LỖI (${loi})` : 'CHỤP VIEW: XONG');
process.exit(loi ? 1 : 0);
