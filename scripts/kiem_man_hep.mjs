#!/usr/bin/env node
/**
 * KIỂM MÀN HẸP (học app cũ MDI_Unitmix_v4 `scripts/kiem_man_hep.js`, QT-141) — Edge / Chrome headless qua CDP, Node ≥ 22.
 * Mở màn soạn một dự án ở nhiều khung (điện thoại dọc / ngang, máy tính bảng, máy bàn), lần lượt: TMB, Tầng, Hầm, 3D, Chi phí,
 * ngăn Nhập / Số liệu, menu ⋯, rồi đo:
 *   · TRÀN NGANG: scrollWidth > bề rộng khung                            → LỖI (mã 1)
 *   · NÚT BỊ CHE: tâm nút đang hiện bị phần tử khác đè (elementFromPoint) → LỖI (mã 1)
 *   · nút < 40 px (khung điện thoại / máy tính bảng)                       → cảnh báo
 * Rồi mở lần lượt mọi HỘP THOẠI / LỚP NỔI mở được (bảng QH Excel — nạp tệp mẫu scripts/mau_kiem/chi_tieu_man_hep.xlsx,
 * đề bài KD, xuất CAD — chỉ mở hộp, KHÔNG bấm tải, xếp hàng loạt, chú giải / hướng dẫn / lớp góc bản vẽ, menu ⋯, menu cấp;
 * ở trang Dự án: tạo dự án — không bấm Tạo, so sánh PA) và đo:
 *   · NÚT CHÍNH (hàng nút chân hộp .chan-hop, .nut-chinh, ✕ đóng) nằm trong khung nhìn và elementFromPoint ở tâm trả về
 *     chính nút (không bị dock / ngăn / thanh khác che); chân hộp phải thấy NGAY không cần cuộn   → LỖI
 *   · giả bàn phím ảo (--vv-h = 55 % cao, html.ban-phim): nút chân hộp vẫn trong phần nhìn thấy  → LỖI
 *   · hộp tràn ngang khỏi màn, ô nhập < 16 px (iOS tự phóng), nút chính < 40 px                 → LỖI (khung điện thoại)
 *   · bấm Huỷ / Đóng / ✕ thì hộp đóng                                                             → LỖI nếu không
 * Hộp sửa (bảng QH, đề bài) cần --ma-sua. Thiếu điều kiện mở (dự án không có lô, chưa chọn tòa…) thì "bỏ", không tính lỗi.
 * Cần vite + API đang chạy. Dự án phải mở được (chỉ xem cũng được).
 *   node scripts/kiem_man_hep.mjs --url http://127.0.0.1:5426 --du-an <mã> [--pa pa-1] [--ma-sua <mã sửa>] [--chi 390] [--ra .cache/man_hep] [--khong-hop]
 * Mã thoát: 0 đạt · 1 có lỗi · 2 lỗi hạ tầng.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (k, md) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : md; };
const URL0 = arg('--url', 'http://127.0.0.1:5180'), MA = arg('--du-an'), PA = arg('--pa', 'pa-1'), MA_SUA = arg('--ma-sua');
const RA = resolve(arg('--ra', '.cache/man_hep')), CHI = arg('--chi'), KHONG_HOP = process.argv.includes('--khong-hop');
const MAU_XLSX = resolve(dirname(fileURLToPath(import.meta.url)), 'mau_kiem/chi_tieu_man_hep.xlsx');
if (!MA) { console.error('Thiếu --du-an <mã>'); process.exit(2); }
const KHUNG = [
  { w: 375, h: 812, mobile: true }, { w: 390, h: 844, mobile: true }, { w: 430, h: 932, mobile: true }, { w: 844, h: 390, mobile: true },
  { w: 768, h: 1024, mobile: true }, { w: 1024, h: 768, mobile: true }, { w: 1440, h: 900, mobile: false },
].filter((k) => !CHI || String(k.w) === CHI);
const cho = (ms) => new Promise((r) => setTimeout(r, ms));
const timTrinhDuyet = () => [process.env.CHROME_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));

/** Đo trong trang: tràn ngang, nút bị che, nút nhỏ. */
const DO = `((MOBILE) => {
  const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && !e.closest('[inert],[aria-hidden="true"]'); };
  const ten = (e) => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : '')
    + ' "' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 18) + '"';
  // phần nhìn thấy của phần tử sau khi cắt theo các khung cuộn / overflow cha
  const thay = (e) => { let r = e.getBoundingClientRect(), L = r.left, T = r.top, R = r.right, B = r.bottom;
    for (let p = e.parentElement; p; p = p.parentElement) { const cs = getComputedStyle(p);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { const q = p.getBoundingClientRect(); L = Math.max(L, q.left); T = Math.max(T, q.top); R = Math.min(R, q.right); B = Math.min(B, q.bottom); } }
    L = Math.max(L, 0); T = Math.max(T, 0); R = Math.min(R, innerWidth); B = Math.min(B, innerHeight);
    return R - L > 2 && B - T > 2 ? [L, T, R, B] : null; };
  const nut = [...document.querySelectorAll('button, [role=button], a[href], select, input:not([type=hidden])')].filter(vis);
  const che = [], nho = [];
  for (const e of nut) {
    const k = thay(e); if (!k) continue; // đã cuộn khỏi khung thanh công cụ / ngăn: không tính
    const x = (k[0] + k[2]) / 2, y = (k[1] + k[3]) / 2, o = document.elementFromPoint(x, y);
    if (o && o !== e && !e.contains(o) && !o.contains(e) && !(e.tagName === 'INPUT' && e.closest('label')?.contains(o))) che.push(ten(e) + ' ← ' + ten(o));
    const r = e.getBoundingClientRect();
    if (MOBILE && e.tagName === 'BUTTON' && (r.width < 40 || r.height < 40) && !e.closest('.bang-ct, .kpi-pham-vi, .chip-goc')) nho.push(ten(e) + ' ' + Math.round(r.width) + '×' + Math.round(r.height));
  }
  const g = document.querySelector('.panel-giua')?.getBoundingClientRect();
  // thanh trên tự cuộn ngang (ẩn thanh cuộn) nên không làm trang tràn — nút cuối bị đẩy ra ngoài mép cũng là lỗi
  const ngoaiThanh = [...(document.querySelector('.thanh-tren')?.children ?? [])].filter(vis).filter((e) => e.getBoundingClientRect().right > innerWidth + 0.5).map(ten);
  return { sw: document.documentElement.scrollWidth, iw: innerWidth, che, nho, ngoaiThanh, giua: g ? [g.left, g.top, g.width, g.height].map(Math.round) : null };
})`;

/**
 * Đo một hộp thoại / lớp nổi đang mở (phần tử cuối khớp SEL). Nút chân hộp (.chan-hop) phải thấy ngay; nút chính khác
 * (.nut-chinh, ✕, đầu hộp so sánh) được cuộn tới (scrollIntoView, như ngón tay vuốt) rồi mới đo. BAN_PHIM: chỉ đo chân hộp
 * với phần nhìn thấy = --vv-h (bàn phím giả).
 */
const DO_HOP = `((SEL, NUT, MOBILE, BAN_PHIM) => {
  const hop = [...document.querySelectorAll(SEL)].pop();
  if (!hop) return { co: false, loi: [] };
  const loi = [];
  const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
  const ten = (e) => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : '')
    + ' "' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 22) + '"';
  const H = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--vv-h')) || innerHeight;
  const kiem = (e, cuon, nhan) => {
    if (cuon) e.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = e.getBoundingClientRect();
    if (r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > Math.min(H, innerHeight) + 0.5) {
      loi.push(nhan + ' ngoài khung nhìn: ' + ten(e) + ' [' + [r.left, r.top, r.right, r.bottom].map(Math.round) + '] khung ' + innerWidth + '×' + Math.round(H)); return; }
    const o = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!o || (o !== e && !e.contains(o) && !(e.tagName === 'INPUT' && e.closest('label')?.contains(o)))) loi.push(nhan + ' bị che: ' + ten(e) + ' ← ' + (o ? ten(o) : 'không có'));
    if (MOBILE && (r.width < 40 || r.height < 40)) loi.push(nhan + ' < 40 px: ' + ten(e) + ' ' + Math.round(r.width) + '×' + Math.round(r.height));
  };
  const chan = [...hop.querySelectorAll('.chan-hop button, .chan-hop a')].filter(vis);
  chan.forEach((e) => kiem(e, false, 'chân hộp'));
  if (!BAN_PHIM) {
    [...hop.querySelectorAll(NUT)].filter(vis).filter((e) => !chan.includes(e)).forEach((e) => kiem(e, true, 'nút'));
    const r = (hop.matches('.hop-thoai, .hop-3d') ? hop.firstElementChild : hop).getBoundingClientRect();
    if (r.left < -0.5 || r.right > innerWidth + 0.5) loi.push('hộp tràn ngang [' + Math.round(r.left) + ', ' + Math.round(r.right) + '] > ' + innerWidth);
    if (document.documentElement.scrollWidth > innerWidth) loi.push('trang tràn ngang ' + document.documentElement.scrollWidth + ' > ' + innerWidth);
    if (MOBILE) for (const e of [...hop.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]), select, textarea')].filter(vis))
      if (parseFloat(getComputedStyle(e).fontSize) < 16) loi.push('ô nhập < 16 px (iOS tự phóng): ' + ten(e) + ' ' + getComputedStyle(e).fontSize);
  }
  return { co: true, loi, soNut: chan.length };
})`;

async function main() {
  const exe = timTrinhDuyet();
  if (!exe) throw new Error('Không thấy Edge / Chrome — đặt CHROME_PATH');
  const port = 19700 + (process.pid % 200), hoSo = join(RA, `ho-so-${process.pid}`);
  mkdirSync(hoSo, { recursive: true });
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
    const js = async (bt) => { const r = await gui('Runtime.evaluate', { expression: bt, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
    const moi = async (u) => { const x = new Promise((r) => { const f = (m) => { if (m.method === 'Page.loadEventFired') { nghe.delete(f); r(); } }; nghe.add(f); }); await gui('Page.navigate', { url: u }); await x; };
    const doiCo = async (bt, ms = 30000) => { const het = Date.now() + ms; while (Date.now() < het) { if (await js(bt)) return true; await cho(200); } return false; };
    const bam = (sel, i = 0) => js(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${i}]; if (!e) return false; e.click(); return true; })()`);
    await gui('Page.enable'); await gui('Runtime.enable'); await gui('DOM.enable');
    const kq = [];
    /** Bấm nút / liên kết (trong PHAM) có chữ hoặc aria-label khớp RE; trả false nếu không có hoặc đang tắt. */
    const bamChu = (re, pham = 'body') => js(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(pham + ' button, ' + pham + ' a')})]
      .find((x) => ${re}.test((x.getAttribute('aria-label') || '') + ' ' + x.textContent.trim())); if (!e || e.disabled) return false; e.click(); return true; })()`);
    const tepVao = async (sel, duong) => { const { root } = await gui('DOM.getDocument', { depth: -1, pierce: true }); const { nodeId } = await gui('DOM.querySelector', { nodeId: root.nodeId, selector: sel }); if (!nodeId) return false; await gui('DOM.setFileInputFiles', { nodeId, files: [duong] }); return true; };
    const NUT_CHINH = '.nut-chinh, .dong-hop, .hl-dong, .ss-dau button';
    /** Đo một hộp đã mở + bàn phím giả + đóng; in kết quả, trả số lỗi (0 / 1). */
    const doHop = async (k, ten, sel, { nut = NUT_CHINH, dong = null, banPhim = true } = {}) => {
      const d = await js(`${DO_HOP}(${JSON.stringify(sel)}, ${JSON.stringify(nut)}, ${k.mobile}, false)`);
      if (!d.co) { console.log(`LỖI  ${k.w}×${k.h} hộp ${ten.padEnd(13)} không thấy ${sel} sau khi mở`); return 1; }
      const ds = [...d.loi];
      mkdirSync(RA, { recursive: true });
      const anh = await gui('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(RA, `${k.w}x${k.h}-hop-${ten}.png`), Buffer.from(anh.data, 'base64'));
      if (banPhim && k.mobile && d.soNut) {
        const h = Math.round(k.h * 0.55);
        await js(`(() => { const s = document.documentElement.style; window.__vv = [s.getPropertyValue('--vv-h'), s.getPropertyValue('--vv-duoi')];
          s.setProperty('--vv-h', '${h}px'); s.setProperty('--vv-duoi', '${k.h - h}px'); document.documentElement.classList.add('ban-phim'); return true; })()`);
        await cho(250);
        for (const x of (await js(`${DO_HOP}(${JSON.stringify(sel)}, '', ${k.mobile}, true)`)).loi) ds.push('bàn phím giả: ' + x);
        await js(`(() => { const s = document.documentElement.style; s.setProperty('--vv-h', window.__vv[0]); s.setProperty('--vv-duoi', window.__vv[1]); document.documentElement.classList.remove('ban-phim'); return true; })()`);
      }
      if (dong) {
        await dong(); await cho(500);
        if (await js(`[...document.querySelectorAll(${JSON.stringify(sel)})].some((e) => e.getBoundingClientRect().height > 0)`)) ds.push('bấm đóng mà hộp vẫn mở');
      }
      console.log(`${ds.length ? 'LỖI' : 'đạt'}  ${k.w}×${k.h} hộp ${ten.padEnd(13)} nút chân hộp ${d.soNut} · lỗi ${ds.length}`);
      for (const x of ds.slice(0, 8)) console.log('      ' + x);
      kq.push({ khung: `${k.w}×${k.h}`, hop: ten, loi: ds });
      return ds.length ? 1 : 0;
    };
    const boQua = (k, ten, vi) => console.log(`bỏ   ${k.w}×${k.h} hộp ${ten.padEnd(13)} ${vi}`);
    const veTmb = async (hep) => {
      await bam('.tab-buoc button', 0); await bam('.tab-xem button', 0); await cho(500);
      if (hep) await js(`(() => { document.querySelectorAll('.ngan-keo.mo .dau-ngan .nut-bt').forEach((e) => e.click()); return true; })()`);
      await js(`(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true; })()`);
      await cho(300);
    };
    const moNhap = async (hep) => { if (hep) { await bam('.dock-duoi > .nut-bt', 0); await cho(450); } };
    /** Các hộp / lớp nổi trong màn soạn. */
    const kiemHop = async (k, hep) => {
      let n = 0;
      // 1. Bảng chỉ tiêu QH (Excel) — lỗi người dùng báo trên iPhone: nút Áp nằm dưới dock
      await veTmb(hep); await moNhap(hep);
      if (!MA_SUA) boQua(k, 'chi-tieu', '(cần --ma-sua)');
      else if (!(await bamChu('/Bảng QH|QH table/'))) boQua(k, 'chi-tieu', '(nút Bảng QH tắt — dự án chưa có lô?)');
      else {
        await cho(500);
        if (await tepVao('.hop-thoai input[type=file]', MAU_XLSX)) await doiCo(`!!document.querySelector('.hop-thoai .bang-nhap')`, 10000);
        await cho(400);
        n += await doHop(k, 'chi-tieu', '.hop-thoai', { dong: () => bam('.hop-thoai .chan-hop .nut-phu') });
      }
      // 2. Đề bài KD
      await veTmb(hep); await moNhap(hep);
      if (!MA_SUA) boQua(k, 'de-bai', '(cần --ma-sua)');
      else if (!(await bamChu('/Đề bài KD|Sales brief/'))) boQua(k, 'de-bai', '(nút tắt — chưa chọn lô?)');
      else { await cho(500); n += await doHop(k, 'de-bai', '.hop-thoai', { dong: () => bam('.hop-thoai .chan-hop .nut-phu') }); }
      // 3. Xếp hàng loạt (lớp nổi trên TMB)
      await veTmb(hep);
      if (!(await bamChu('/Xếp hàng loạt|Batch/', '.panel-giua'))) boQua(k, 'hang-loat', '(nút tắt)');
      else { await cho(600); n += await doHop(k, 'hang-loat', '.tmb-hang-loat', { nut: '.hl-dong, .nut-chinh', dong: () => bam('.tmb-hang-loat .hl-dong'), banPhim: false }); }
      // 4. Góc bản vẽ: chú giải / hướng dẫn / lớp (lớp có ở màn Tầng)
      for (const [ten, re] of [['chu-giai', '/^Chú giải|^Legend/'], ['huong-dan', '/^Hướng dẫn|^How to|^Help/'], ['lop', '/^Lớp hiển thị|^Layers/']]) {
        await veTmb(hep);
        if (ten === 'lop') { await bam('.tab-buoc button', 1); await cho(900); }
        if (!(await bamChu(re, '.goc-bv'))) { boQua(k, ten, '(không có nút ở màn này)'); continue; }
        await cho(300);
        n += await doHop(k, ten, '.goc-bv-hop', { nut: 'button, label', banPhim: false, dong: () => bamChu(re, '.goc-bv') });
      }
      // 5. Menu ⋯ + menu cấp (màn hẹp: trong ⋯; máy bàn: trên thanh trên)
      await veTmb(hep);
      if (hep && await bam('.thanh-tren .nut-them')) {
        await cho(400);
        n += await doHop(k, 'menu-them', '.menu-them-bang', { nut: ':scope > button, .menu-them-lang button', banPhim: false });
        if (await bam('.menu-them-hep .nut-cap')) { await cho(400); n += await doHop(k, 'menu-cap', '.bang-cap', { nut: ':scope > button', banPhim: false }); }
      } else if (!hep && await bam('.thanh-tren .nut-cap')) {
        await cho(400); n += await doHop(k, 'menu-cap', '.bang-cap', { nut: ':scope > button', banPhim: false });
      }
      // 6. Xuất CAD (màn Tầng có tòa đang xem) — chỉ mở hộp, KHÔNG bấm tải .scr / .dxf
      await veTmb(hep);
      // chọn tòa đầu tiên qua menu cấp "Chọn tòa" (xuất CAD cần một tòa đang xem)
      if (hep) { await bam('.thanh-tren .nut-them'); await cho(400); }
      if (await bam(hep ? '.menu-them-hep .nut-cap.cap-toa' : '.thanh-tren .nut-cap.cap-toa')) {
        await cho(400); await bam('.bang-cap button[role=menuitemradio]:not([disabled])'); await cho(800);
      }
      await js(`(() => { document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return true; })()`); await cho(300);
      await bam('.tab-buoc button', 1); await cho(1200);
      if (hep && !(await js(`!!document.querySelector('.menu-them-bang')`))) { await bam('.thanh-tren .nut-them'); await cho(400); }
      if (!(await bamChu('/(^|\\s)CAD\\b/', hep ? '.menu-them-bang' : '.thanh-tren'))) boQua(k, 'xuat-cad', '(chưa chọn tòa)');
      else { await cho(700); n += await doHop(k, 'xuat-cad', '.hop-3d', { nut: '.dong-hop, .nut-chinh', dong: () => bam('.hop-3d .dong-hop') }); }
      await bam('.tab-buoc button', 0); await cho(300);
      return n;
    };
    /** Trang Dự án của tôi: tràn / che, tạo dự án (không bấm Tạo), so sánh PA. */
    const kiemTrangDuAn = async () => {
      let n = 0;
      for (const k of KHUNG) {
        await gui('Emulation.setDeviceMetricsOverride', { width: k.w, height: k.h, deviceScaleFactor: k.mobile ? 2 : 1, mobile: k.mobile });
        await gui('Emulation.setTouchEmulationEnabled', { enabled: k.mobile, maxTouchPoints: 5 });
        await moi(URL0 + '/'); await doiCo(`!!document.querySelector('main .nut-chinh')`); await cho(1200);
        const d = await js(`${DO}(${k.mobile})`);
        const hong = d.sw > d.iw || d.che.length > 0;
        if (hong) n++;
        console.log(`${hong ? 'LỖI' : 'đạt'}  ${k.w}×${k.h} trang-du-an   tràn ${d.sw > d.iw ? d.sw + '>' + d.iw : 'không'} · che ${d.che.length} · nút < 40 px ${d.nho.length}`);
        for (const x of [...d.che.slice(0, 4), ...d.nho.slice(0, 4)]) console.log('      ' + x);
        await bam('main > div > .nut-chinh'); await cho(500);
        n += await doHop(k, 'tao-du-an', '.hop-thoai', { dong: () => bam('.hop-thoai .chan-hop .nut-phu') });
        if (!(await bamChu('/So sánh PA|Compare/', 'main'))) { boQua(k, 'so-sanh', '(chưa có dự án ≥ 2 PA trong danh sách)'); continue; }
        await cho(1200);
        await js(`(() => { [...document.querySelectorAll('.hop-thoai input[type=checkbox]')].slice(0, 2).forEach((x) => x.checked || x.click()); return true; })()`);
        await bam('.hop-thoai .nut-chinh'); await doiCo(`!!document.querySelector('.hop-thoai .ss-the')`, 15000); await cho(400);
        n += await doHop(k, 'so-sanh', '.hop-thoai', { dong: () => bam('.hop-thoai .ss-dau .nut-phu') });
      }
      return n;
    };
    for (const k of KHUNG) {
      await gui('Emulation.setDeviceMetricsOverride', { width: k.w, height: k.h, deviceScaleFactor: k.mobile ? 2 : 1, mobile: k.mobile });
      await gui('Emulation.setTouchEmulationEnabled', { enabled: k.mobile, maxTouchPoints: 5 });
      await moi(URL0 + '/');
      if (MA_SUA) await js(`localStorage.setItem('unitmix.maSua.${MA}', '${MA_SUA}'); true`);
      await moi(`${URL0}/du-an/${MA}?pa=${PA}`);
      if (!(await doiCo(`!!document.querySelector('.panel-giua .ban-ve-svg, .panel-giua .giua-man')`))) throw new Error('Không mở được màn soạn');
      await cho(800);
      const hep = await js(`!!document.querySelector('.khung-soan.hep')`);
      const man = [
        ['tmb', async () => { await bam('.tab-buoc button', 0); await bam('.tab-xem button', 0); }],
        ['tang', async () => { await bam('.tab-buoc button', 1); await doiCo(`!!document.querySelector('.the-tang, .giua-man')`); }],
        ['ham', async () => { await bam('.tab-buoc button', 2); }],
        ['3d', async () => { await bam('.tab-buoc button', 0); await bam('.tab-xem button', 1); await doiCo(`!!document.querySelector('.vung-3d.da-dung')`, 60000); }],
        ['chi-phi', async () => { await bam('.tab-xem button', 2); }],
        ...(hep ? [
          ['ngan-nhap', async () => { await bam('.tab-xem button', 0); await bam('.dock-duoi > .nut-bt', 0); await cho(400); }],
          ['ngan-so-lieu', async () => { await bam('.dock-duoi > .nut-bt', 1); await cho(400); }],
          ['menu-them', async () => { await bam('.dock-duoi > .nut-bt', 1); await cho(400); await bam('.nut-them'); }],
        ] : []),
      ];
      for (const [ten, lam] of man) {
        await lam(); await cho(900);
        const d = await js(`${DO}(${k.mobile})`);
        const tran = d.sw > d.iw || (k.mobile && d.ngoaiThanh.length > 0);
        for (const x of d.ngoaiThanh) console.log('      ra ngoài thanh trên: ' + x);
        const che = ten === 'menu-them' ? d.che.filter((x) => !x.includes('menu-them')) : d.che; // menu nổi đè bản vẽ là đúng ý
        const hong = tran || (che.length > 0 && !/^ngan-|^menu-/.test(ten));
        if (hong) loi++;
        mkdirSync(RA, { recursive: true });
        const anh = await gui('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(RA, `${k.w}x${k.h}-${ten}.png`), Buffer.from(anh.data, 'base64'));
        kq.push({ khung: `${k.w}×${k.h}`, man: ten, tran: tran ? `${d.sw} > ${d.iw}` : '', che: che.length, nho: d.nho.length });
        console.log(`${hong ? 'LỖI' : 'đạt'}  ${k.w}×${k.h} ${ten.padEnd(13)} tràn ${tran ? d.sw + '>' + d.iw : 'không'} · che ${che.length} · nút < 40 px ${d.nho.length} · giữa ${d.giua}`);
        for (const x of che.slice(0, 6)) console.log('      che: ' + x);
        for (const x of d.nho.slice(0, 4)) console.log('      nhỏ: ' + x);
      }
      if (!KHONG_HOP) loi += await kiemHop(k, hep);
    }
    if (!KHONG_HOP) loi += await kiemTrangDuAn();
    writeFileSync(join(RA, 'ket_qua.json'), JSON.stringify(kq, null, 1));
    ws.close();
  } finally { tr.kill(); await cho(300); try { rmSync(hoSo, { recursive: true, force: true }); } catch { /* */ } }
  console.log(loi ? `MÀN HẸP: HỎNG (${loi} màn)` : 'MÀN HẸP: ĐẠT');
  process.exit(loi ? 1 : 0);
}
main().catch((e) => { console.error('Lỗi hạ tầng:', e.message); process.exit(2); });
