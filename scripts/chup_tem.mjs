#!/usr/bin/env node
/**
 * CHỤP + KIỂM TEM CĂN MÀN TẦNG (Edge / Chrome headless qua CDP, Node ≥ 22; cùng cách khởi chạy với chup_pccc.mjs) — để so với ảnh app
 * cũ (docs/anh/tem-can/cu-*.png, chụp MDI_Unitmix_v4 headless) và kiểm luật QT-34 trên màn thật:
 *   - mỗi tòa: vừa khung, đếm cặp tem chồng nhau (hộp màn hình) và tem nằm dưới lớp phủ (la bàn, thước, thanh công cụ, góc bản vẽ…);
 *   - đo tác vụ dài (> 50 ms) khi chuyển tòa.
 * Tạo một dự án thử tạm (mỗi mẫu một tòa, chép lô / hệ số từ dự án nguồn), xong xoá phương án của nó.
 *   node scripts/chup_tem.mjs --url http://127.0.0.1:5419 --du-an <mã nguồn> [--pa pa-2] [--mau tm-z3,tm-v1,tm-v4,tm-l1,tm-t1,tm-y1,tm-y2]
 *     [--api http://127.0.0.1:8787] [--ra docs/anh/tem-can] [--khong-chup]
 * Mã thoát 1 khi có tem chồng / tem dưới lớp phủ.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const arg = (k, md) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : md; };
const URL0 = arg('--url', 'http://127.0.0.1:5180'), NGUON = arg('--du-an'), PA = arg('--pa', 'pa-2'), API = arg('--api', 'http://127.0.0.1:8787');
const MAU = arg('--mau', 'tm-z3,tm-v1,tm-v4,tm-l1,tm-t1,tm-y1,tm-y2').split(',').filter(Boolean), RA = resolve(arg('--ra', 'docs/anh/tem-can'));
const CHUP = !process.argv.includes('--khong-chup');
if (!NGUON) { console.error('Thiếu --du-an'); process.exit(2); }
const cho = (ms) => new Promise((r) => setTimeout(r, ms));

// dự án thử: mỗi mẫu một tòa (lô nguồn lần lượt, thừa thì dồn lô đầu), giữ hệ số / ngưỡng của PA nguồn
const goc = await (await fetch(`${API}/api/du-an/${NGUON}/pa/${PA}`)).json();
const st = goc.trang_thai, lo = st.lo;
const tam = (l) => { const xs = l.ranh.map((p) => p[0]), ys = l.ranh.map((p) => p[1]); return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]; };
const mau0 = st.toa[0];
st.toa = MAU.map((m, i) => { const l = lo[i % lo.length], [x, y] = tam(l); return { ...mau0, id: `toa-tem-${m}`, loId: l.id, mauId: m, x, y, gocDo: 0, canTheo: {}, matBang: undefined, tangRieng: undefined, canViTri: undefined }; });
const da = await (await fetch(`${API}/api/du-an`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ten: 'Tem căn thử (chup_tem)', dia_diem: '' }) })).json();
await fetch(`${API}/api/du-an/${da.ma}/pa/pa-1`, { method: 'PUT', headers: { 'content-type': 'application/json', 'X-Ma-Sua': da.ma_sua }, body: JSON.stringify({ ten: 'Tem căn', trang_thai: st, tom_tat: {} }) });
console.log('dự án thử', da.ma);

const exe = [process.env.CHROME_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => p && existsSync(p));
const hoSo = resolve('.cache', `chup-tem-${process.pid}`);
mkdirSync(hoSo, { recursive: true }); mkdirSync(RA, { recursive: true });
const tr = spawn(exe, ['--headless=new', '--inprivate', '--disable-sync', '--disable-extensions', '--no-first-run', '--hide-scrollbars',
  '--remote-debugging-port=0', `--user-data-dir=${hoSo}`, 'about:blank'], { stdio: 'ignore' });
let loi = 0;
const bang = [];
try {
  let port;
  for (let i = 0; i < 80 && !port; i++) { try { port = readFileSync(join(hoSo, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch { await cho(250); } }
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
  const loiJs = [];
  nghe.add((m) => { if (m.method === 'Runtime.exceptionThrown') loiJs.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text); });
  await gui('Page.enable'); await gui('Runtime.enable');
  await gui('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await moi(URL0 + '/');
  await js(`localStorage.setItem('unitmix.maSua.${da.ma}', '${da.ma_sua}'); true`);
  await moi(`${URL0}/du-an/${da.ma}?pa=pa-1`);
  if (!(await doiCo(`!!document.querySelector('.panel-giua svg')`))) throw new Error('Không mở được màn soạn');
  await cho(1200);
  await js(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /Tầng · Căn/.test(x.textContent)); b?.click(); return !!b; })()`);
  await cho(800);
  await js(`(() => { window.__dai = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__dai.push(Math.round(e.duration)); }).observe({ type: 'longtask' }); } catch {} return true; })()`);
  for (const m of MAU) {
    const ten = m.replace(/^tm-/, '').replace(/^xh-/, 'xh-').toUpperCase();
    await js('window.__dai = []; true');
    const co = await js(`(() => { const b = [...document.querySelectorAll('button.muc-lo')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(ten)})); b?.click(); return !!b; })()`);
    if (!co) { console.log('⚠ không thấy tòa', ten); loi++; continue; }
    if (!(await doiCo(`document.querySelectorAll('.panel-giua [data-tem]').length > 0`, 20000))) { console.log('⚠ tem chưa hiện', ten); loi++; continue; }
    await cho(1800); // bay vừa khung + nạp hình
    const kq = await js(`(() => {
      const hop = (el) => el.getBoundingClientRect();
      const tem = [...document.querySelectorAll('.panel-giua [data-tem]')].map((el) => ({ k: el.getAttribute('data-tem'), r: hop(el) }));
      const phu = [...document.querySelectorAll('.hoa-gio, .thuoc-ty-le, .goc-bv .nhom-bt, .thanh-cc-tang, .the-tang, .noi-tren, .noi-duoi, .chu-giai-view, .thanh-o-chon')]
        .filter((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed').map((el) => ({ c: el.className.baseVal ?? el.className, r: hop(el) })).filter((x) => x.r.width > 0 && x.r.height > 0);
      const cat = (a, b, m = 1) => a.left + m < b.right && b.left + m < a.right && a.top + m < b.bottom && b.top + m < a.bottom;
      const chong = [], duoi = [];
      tem.forEach((a, i) => { tem.forEach((b, j) => { if (j > i && cat(a.r, b.r)) chong.push(a.k + '×' + b.k); }); phu.forEach((p) => { if (cat(a.r, p.r)) duoi.push(a.k + '↔' + String(p.c).split(' ')[0]); }); });
      const g = document.querySelector('.panel-giua').getBoundingClientRect(), ngoai = tem.filter((a) => a.r.left < g.left || a.r.right > g.right || a.r.top < g.top || a.r.bottom > g.bottom).map((a) => a.k);
      return { tem: tem.length, dan: document.querySelectorAll('.panel-giua .tem-dan').length, chong, duoi, ngoai };
    })()`);
    const dai = await js('window.__dai');
    bang.push({ toa: ten, ...kq, dai: Math.max(0, ...dai) });
    console.log(`${ten}: ${kq.tem} tem · ${kq.dan} đường dẫn · chồng ${kq.chong.length} · dưới lớp phủ ${kq.duoi.length} · ngoài khung ${kq.ngoai.length} · tác vụ dài nhất ${Math.max(0, ...dai)} ms`,
      kq.chong.length || kq.duoi.length ? JSON.stringify({ chong: kq.chong, duoi: kq.duoi }) : '');
    if (kq.chong.length || kq.duoi.length) loi++;
    if (CHUP) await chup(`moi-${m.replace(/^tm-/, '')}`);
  }
  if (loiJs.length) { console.log('LỖI JS:', loiJs.slice(0, 5)); loi++; }
} catch (e) {
  console.error('LỖI', e.message); loi++;
} finally {
  try { await fetch(`${API}/api/du-an/${da.ma}/pa/pa-1`, { method: 'DELETE', headers: { 'X-Ma-Sua': da.ma_sua } }); } catch { /* bỏ qua */ }
  tr.kill();
  await cho(600);
  try { rmSync(hoSo, { recursive: true, force: true }); } catch { /* Edge còn giữ tệp */ }
}
console.log(loi ? `TEM: CHƯA ĐẠT (${loi})` : 'TEM: ĐẠT — 0 tem chồng, 0 tem dưới lớp phủ');
process.exit(loi ? 1 : 0);
