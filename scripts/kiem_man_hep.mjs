#!/usr/bin/env node
/**
 * KIỂM MÀN HẸP (học app cũ MDI_Unitmix_v4 `scripts/kiem_man_hep.js`, QT-141) — Edge / Chrome headless qua CDP, Node ≥ 22.
 * Mở màn soạn một dự án ở nhiều khung (điện thoại dọc / ngang, máy tính bảng, máy bàn), lần lượt: TMB, Tầng, Hầm, 3D, Chi phí,
 * ngăn Nhập / Số liệu, menu ⋯, rồi đo:
 *   · TRÀN NGANG: scrollWidth > bề rộng khung                            → LỖI (mã 1)
 *   · NÚT BỊ CHE: tâm nút đang hiện bị phần tử khác đè (elementFromPoint) → LỖI (mã 1)
 *   · nút < 40 px (khung điện thoại / máy tính bảng)                       → cảnh báo
 * Cần vite + API đang chạy. Dự án phải mở được (chỉ xem cũng được).
 *   node scripts/kiem_man_hep.mjs --url http://127.0.0.1:5426 --du-an <mã> [--pa pa-1] [--ma-sua <mã sửa>] [--chi 390] [--ra .cache/man_hep]
 * Mã thoát: 0 đạt · 1 có lỗi · 2 lỗi hạ tầng.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const arg = (k, md) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : md; };
const URL0 = arg('--url', 'http://127.0.0.1:5180'), MA = arg('--du-an'), PA = arg('--pa', 'pa-1'), MA_SUA = arg('--ma-sua');
const RA = resolve(arg('--ra', '.cache/man_hep')), CHI = arg('--chi');
if (!MA) { console.error('Thiếu --du-an <mã>'); process.exit(2); }
const KHUNG = [
  { w: 390, h: 844, mobile: true }, { w: 430, h: 932, mobile: true }, { w: 844, h: 390, mobile: true },
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
    await gui('Page.enable'); await gui('Runtime.enable');
    const kq = [];
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
    }
    writeFileSync(join(RA, 'ket_qua.json'), JSON.stringify(kq, null, 1));
    ws.close();
  } finally { tr.kill(); await cho(300); try { rmSync(hoSo, { recursive: true, force: true }); } catch { /* */ } }
  console.log(loi ? `MÀN HẸP: HỎNG (${loi} màn)` : 'MÀN HẸP: ĐẠT');
  process.exit(loi ? 1 : 0);
}
main().catch((e) => { console.error('Lỗi hạ tầng:', e.message); process.exit(2); });
