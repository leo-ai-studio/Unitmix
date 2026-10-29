#!/usr/bin/env node
/**
 * CHỤP LỚP PCCC MÀN TẦNG (Edge / Chrome headless qua CDP, Node ≥ 22; cùng cách khởi chạy với chup_view.mjs) — để so với ảnh app cũ
 * (docs/anh/pccc/cu-*.png, chụp bằng MDI_Unitmix_v4 headless). Mở dự án, chọn tòa, màn Tầng; bật lớp theo `--lop` (mặc định như app
 * cũ: Tủ PCCC + Cửa NC; `--lop tu,cnc,doHL,voi` = bật cả Đo HL + Vòi CC); chụp vừa khung + phóng 1:100 (≈ 0,0378 px/mm) quanh cặp tủ –
 * cửa gần nhau nhất. Đo tác vụ dài (> 50 ms) khi đổi lớp / chờ phân tích nền.
 *   node scripts/chup_pccc.mjs --url http://127.0.0.1:5397 --du-an <mã> --pa pa-2 --ma-sua <mã> --toa Z3 [--lop tu,cnc,doHL,voi] [--ten moi-z3]
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const arg = (k, md) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : md; };
const URL0 = arg('--url', 'http://127.0.0.1:5180'), MA = arg('--du-an'), PA = arg('--pa', 'pa-1'), MA_SUA = arg('--ma-sua'), TOA = arg('--toa', 'Z3');
const LOP = (arg('--lop', 'tu,cnc')).split(',').filter(Boolean), TEN = arg('--ten', `moi-${TOA.toLowerCase()}`), RA = resolve(arg('--ra', 'docs/anh/pccc'));
const TI_LE = +arg('--ti-le', '0.0378'); // px / mm (1:100 ở 96 dpi)
if (!MA) { console.error('Thiếu --du-an'); process.exit(2); }
const cho = (ms) => new Promise((r) => setTimeout(r, ms));
const exe = [process.env.CHROME_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => p && existsSync(p));
const hoSo = resolve('.cache', `chup-pccc-${process.pid}`);
mkdirSync(hoSo, { recursive: true }); mkdirSync(RA, { recursive: true });
const tr = spawn(exe, ['--headless=new', '--inprivate', '--disable-sync', '--disable-extensions', '--no-first-run', '--hide-scrollbars',
  '--remote-debugging-port=0', `--user-data-dir=${hoSo}`, 'about:blank'], { stdio: 'ignore' });
let loi = 0;
try {
  let port;
  for (let i = 0; i < 80 && !port; i++) { try { port = (await import('node:fs')).readFileSync(join(hoSo, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch { await cho(250); } }
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
  const chup = async (ten) => { const a = await gui('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(RA, `${ten}.png`), Buffer.from(a.data, 'base64')); console.log('ảnh', `${ten}.png`); };
  const chuot = (type, x, y, o = {}) => gui('Input.dispatchMouseEvent', { type, x, y, button: o.button ?? 'none', buttons: o.buttons ?? 0, clickCount: o.clickCount ?? 0, deltaX: 0, deltaY: o.deltaY ?? 0 });
  const loiJs = [];
  nghe.add((m) => { if (m.method === 'Runtime.exceptionThrown') loiJs.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text); });
  await gui('Page.enable'); await gui('Runtime.enable');
  await gui('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await moi(URL0 + '/');
  const cai = Object.fromEntries(['thoatNan', 'tu', 'cnc', 'doHL', 'voi'].map((k) => [k, LOP.includes(k)]));
  await js(`localStorage.setItem('unitmix.lopPCCC.v2', ${JSON.stringify(JSON.stringify(cai))}); ${MA_SUA ? `localStorage.setItem('unitmix.maSua.${MA}', '${MA_SUA}');` : ''} true`);
  await moi(`${URL0}/du-an/${MA}?pa=${PA}`);
  if (!(await doiCo(`!!document.querySelector('.panel-giua svg')`))) throw new Error('Không mở được màn soạn');
  await cho(1200);
  // tab Tầng · Căn rồi chọn tòa theo tên
  await js(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /Tầng · Căn/.test(x.textContent)); b?.click(); return !!b; })()`);
  await cho(800);
  const coToa = await js(`(() => { const b = [...document.querySelectorAll('button.muc-lo')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(TOA)})); b?.click(); return !!b; })()`);
  if (!coToa) throw new Error('Không thấy tòa ' + TOA);
  // đo tác vụ dài trong lúc chờ phân tích PCCC nền
  await js(`(() => { window.__dai = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__dai.push(Math.round(e.duration)); }).observe({ type: 'longtask' }); } catch {} return true; })()`);
  if (!(await doiCo(`document.querySelectorAll('.lop-pccc .pc-tcc-than, .lop-pccc .pc-cnc-vung').length > 0`, 30000))) console.log('⚠ lớp PCCC chưa hiện');
  await cho(1500);
  console.log('tác vụ dài (ms) khi mở tầng:', JSON.stringify(await js('window.__dai')));
  console.log('KPI:', JSON.stringify(await js(`[...document.querySelectorAll('.pc-dong')].map((d) => d.textContent.trim())`)));
  await chup(TEN);
  // phóng 1:100 quanh cặp tủ – cửa gần nhất
  const diem = await js(`(() => {
    const tam = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    const tu = [...document.querySelectorAll('.lop-pccc .pc-tcc-than')].map(tam), cua = [...document.querySelectorAll('.lop-pccc .pc-cnc-vung')].map(tam);
    let tot = null; for (const a of tu) for (const b of cua.length ? cua : [a]) { const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (!tot || d < tot.d) tot = { d, p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; }
    const g = document.querySelector('.panel-giua').getBoundingClientRect();
    return { p: tot?.p, c: [g.left + g.width / 2, g.top + g.height / 2] };
  })()`);
  if (diem.p) {
    const kTile = () => js(`document.querySelector('.lop-pccc').getScreenCTM().a`);
    for (let i = 0; i < 60 && (await kTile()) < TI_LE; i++) { await chuot('mouseWheel', diem.p[0], diem.p[1], { deltaY: -120 }); await cho(60); }
    await cho(600);
    // kéo cho điểm về giữa khung (chuột giữa không có → kéo trái trên nền hành lang của bản vẽ)
    const [x0, y0] = diem.p, [x1, y1] = diem.c;
    await chuot('mousePressed', x0, y0 - 1, { button: 'middle', buttons: 4, clickCount: 1 });
    for (let k = 1; k <= 8; k++) await chuot('mouseMoved', x0 + ((x1 - x0) * k) / 8, y0 - 1 + ((y1 - y0) * k) / 8, { button: 'middle', buttons: 4 });
    await chuot('mouseReleased', x1, y1, { button: 'middle', buttons: 0, clickCount: 1 });
    await cho(800);
    console.log('tỉ lệ px/mm sau phóng:', (await kTile()).toFixed(4));
    await chup(`${TEN}-zoom`);
  }
  if (loiJs.length) { console.log('LỖI JS:', loiJs.join('\n')); loi = 1; }
} catch (e) { console.error(e); loi = 2; } finally {
  tr.kill();
  await cho(400);
  try { rmSync(hoSo, { recursive: true, force: true }); } catch { /* Edge còn giữ tệp */ }
}
process.exit(loi);
