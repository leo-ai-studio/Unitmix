#!/usr/bin/env node
/**
 * ĐO MỞ 3D (KHÔNG nằm trong cổng kiem.mjs) — Edge / Chrome headless qua CDP, Node ≥ 22.
 * Người dùng: "web app phải mượt, không giật". Mỗi ca chạy một trình duyệt MỚI (hồ sơ trống, không đệm shader trên đĩa) để đo
 * đúng lần mở đầu tiên của một phiên:
 *   du_an   : mở dự án → TMB → bấm tab 3D (Toàn dự án)
 *   toa     : như trên, chờ yên rồi bấm "Công trình" (tòa đang chọn / tòa đầu)
 * Đo trong cửa sổ từ lúc bấm tới khi yên (--yen ms, mặc định 4 000):
 *   · tác vụ dài luồng chính (PerformanceObserver longtask): số tác vụ > 50 ms, dài nhất, tổng
 *   · frame đầu: lúc khung 3D có ảnh đầu tiên (`.vung-3d.da-dung`), và lúc đủ chất lượng (`data-chat-luong="du"` nếu có)
 *   · quy tác vụ dài về hàm: CPU profile (Profiler, lấy mẫu 200 µs) → các đoạn bận liên tục > 50 ms, mỗi đoạn top hàm (self) và
 *     top hàm của app (tổng, gồm con) — biết tác vụ nào do dịch shader (getProgramParameter / linkProgram…), PMREM, dựng hình, tải ảnh.
 *   node scripts/do_mo_3d.mjs --url http://localhost:5180 --du-an 2mlg1a2l --ma-sua <mã> [--pa pa-1] [--chi may|dt] [--ca du_an,toa]
 *        [--lan 1] [--ra .cache/do_mo_3d] [--nhan truoc] [--chi-tiet]
 * Ngưỡng đạt (người dùng): máy bàn không tác vụ > 100 ms; điện thoại (CPU 4×) không tác vụ > 200 ms. Mã thoát 0 đạt · 1 không đạt · 2 hạ tầng.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const arg = (k, md) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : md; };
const URL0 = arg('--url', 'http://localhost:5180'), MA = arg('--du-an'), PA = arg('--pa', 'pa-1'), MA_SUA = arg('--ma-sua', '');
const RA = resolve(arg('--ra', '.cache/do_mo_3d')), CHI = arg('--chi'), CA = arg('--ca', 'du_an,toa').split(','), LAN = +arg('--lan', '1');
const NHAN = arg('--nhan', 'do'), YEN = +arg('--yen', '4000'), CHI_TIET = process.argv.includes('--chi-tiet');
if (!MA) { console.error('Thiếu --du-an'); process.exit(2); }
const cho = (ms) => new Promise((r) => setTimeout(r, ms));
const exe = [process.env.CHROME_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const KHUNG = [
  { ten: 'may', w: 1440, h: 900, dpr: 1, mobile: false, cpu: 1, nguong: 100 },
  { ten: 'dt', w: 390, h: 844, dpr: 3, mobile: true, cpu: 4, nguong: 200 },
].filter((k) => !CHI || k.ten === CHI);
const CAI = `(() => { const d = window.__do = { lt: [], mk: {} }; window.__ve3d = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) d.lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch {}
  // mốc: khung 3D có ảnh đầu (da-dung) / đủ chất lượng (data-chat-luong="du")
  new MutationObserver(() => { const v = document.querySelector('.vung-3d'); if (!v) return;
    if (v.classList.contains('da-dung') && !d.mk.dau) d.mk.dau = performance.now();
    if (v.dataset.chatLuong === 'du' && !d.mk.du) d.mk.du = performance.now(); })
    .observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'data-chat-luong'] }); })();`;

/** Đoạn bận liên tục trong CPU profile (mẫu không phải "(idle)", hở ≤ 2 ms) dài > 50 ms + hàm tốn nhất. */
function phanTichProfile(p) {
  const nut = new Map(p.nodes.map((n) => [n.id, n])), cha = new Map();
  for (const n of p.nodes) for (const c of n.children ?? []) cha.set(c, n.id);
  const ten = (n) => `${n.callFrame.functionName || '(vô danh)'}${n.callFrame.url ? ' ' + n.callFrame.url.replace(/^.*\/(src|node_modules|deps)\//, '$1/').replace(/\?.*$/, '') + ':' + (n.callFrame.lineNumber + 1) : ''}`;
  let t = p.startTime; const mau = [];
  for (let i = 0; i < p.samples.length; i++) { t += p.timeDeltas[i]; mau.push([t, p.samples[i]]); }
  const doan = []; let dau = -1, cuoi = -1, ds = [];
  const dong = () => { if (dau >= 0 && (cuoi - dau) / 1000 > 50) doan.push({ t0: dau, ms: Math.round((cuoi - dau) / 1000), ds }); dau = -1; ds = []; };
  for (let i = 0; i < mau.length; i++) {
    const [ts, id] = mau[i], n = nut.get(id), ranh = n.callFrame.functionName === '(idle)';
    if (ranh) { if (dau >= 0 && ts - cuoi > 2000) dong(); continue; }
    if (dau < 0) dau = ts;
    cuoi = ts; ds.push([id, i + 1 < mau.length ? mau[i + 1][0] - ts : 0]);
  }
  dong();
  return doan.map((d) => {
    const self = new Map(), tong = new Map();
    for (const [id, dt] of d.ds) {
      const n = nut.get(id), k = ten(n);
      self.set(k, (self.get(k) ?? 0) + dt);
      const da = new Set();
      for (let x = id; x != null; x = cha.get(x)) { const q = nut.get(x), kk = ten(q); if (da.has(kk)) continue; da.add(kk); if (CHI_TIET || /src\//.test(kk) || /three|deps\//.test(kk)) tong.set(kk, (tong.get(kk) ?? 0) + dt); }
    }
    const top = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map(([n, v]) => `${(v / 1000).toFixed(0).padStart(4)} ms  ${n}`);
    return { ms: d.ms, tuMs: Math.round((d.t0 - p.startTime) / 1000), self: top(self, 10), tong: top(tong, CHI_TIET ? 40 : 14) };
  });
}

async function moTrinhDuyet(k) {
  const port = 19500 + ((process.pid + Math.floor(Math.random() * 400)) % 400), hoSo = join(resolve('.cache'), `m3-${process.pid}-${Date.now()}`);
  mkdirSync(hoSo, { recursive: true });
  const tr = spawn(exe, ['--headless=new', '--no-first-run', '--disable-extensions', '--hide-scrollbars', '--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist',
    '--disable-gpu-shader-disk-cache', `--remote-debugging-port=${port}`, `--user-data-dir=${hoSo}`, 'about:blank'], { stdio: 'ignore' });
  let ds;
  for (let i = 0; i < 80 && !ds?.some((x) => x.type === 'page'); i++) { try { ds = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { await cho(250); } }
  const ws = new WebSocket(ds.find((x) => x.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0; const doi = new Map(), nghe = new Set(), loiJs = [];
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && doi.has(m.id)) { const d = doi.get(m.id); doi.delete(m.id); m.error ? d.ko(new Error(JSON.stringify(m.error))) : d.ok(m.result); } else nghe.forEach((f) => f(m)); });
  nghe.add((m) => { if (m.method === 'Runtime.exceptionThrown') loiJs.push(m.params.exceptionDetails?.exception?.description?.slice(0, 200) ?? m.params.exceptionDetails?.text); });
  const gui = (method, params = {}) => new Promise((ok, ko) => { const i = ++id; doi.set(i, { ok, ko }); ws.send(JSON.stringify({ id: i, method, params })); });
  const js = async (bt) => { const r = await gui('Runtime.evaluate', { expression: bt, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + bt.slice(0, 80)); return r.result.value; };
  const doiCo = async (bt, ms = 60000) => { const het = Date.now() + ms; while (Date.now() < het) { if (await js(bt)) return true; await cho(100); } return false; };
  const moi = async (u) => { const x = new Promise((r) => { const f = (m) => { if (m.method === 'Page.loadEventFired') { nghe.delete(f); r(); } }; nghe.add(f); }); await gui('Page.navigate', { url: u }); await x; };
  await gui('Page.enable'); await gui('Runtime.enable');
  await gui('Page.addScriptToEvaluateOnNewDocument', { source: CAI });
  await gui('Emulation.setDeviceMetricsOverride', { width: k.w, height: k.h, deviceScaleFactor: k.dpr, mobile: k.mobile });
  await gui('Emulation.setTouchEmulationEnabled', { enabled: k.mobile, maxTouchPoints: k.mobile ? 5 : 1 });
  const dong = async () => { try { ws.close(); } catch { /* bỏ */ } tr.kill(); await cho(600); try { rmSync(hoSo, { recursive: true, force: true }); } catch { /* bỏ */ } };
  return { gui, js, doiCo, moi, loiJs, dong };
}

async function mot(k, ca) {
  const b = await moTrinhDuyet(k);
  try {
    const { gui, js, doiCo, moi } = b;
    await moi(`${URL0}/`);
    // khoá lớp 3D về mặc định, không bật phân tích view / gói nắng gió (đo mở 3D trần)
    await js(`localStorage.setItem('unitmix.maSua.${MA}', '${MA_SUA}'); localStorage.removeItem('unitmix.lop-3d.v1'); localStorage.removeItem('unitmix.nang-gio.v1'); true`);
    await moi(`${URL0}/du-an/${MA}?pa=${PA}`);
    if (!(await doiCo(`!!document.querySelector('.ban-ve-svg')`))) throw new Error('không mở được TMB');
    await cho(2500);
    await gui('Emulation.setCPUThrottlingRate', { rate: k.cpu });
    const doPha = async (lam, xong) => {
      await gui('Profiler.enable'); await gui('Profiler.setSamplingInterval', { interval: 200 }); await gui('Profiler.start');
      await js(`window.__do.mk = {}; true`);
      const t0 = await js('performance.now()');
      await lam();
      const ok = await doiCo(xong, 90000);
      const tXong = await js('performance.now()');
      await cho(YEN);
      const { profile } = await gui('Profiler.stop');
      const lt = (await js('window.__do.lt')).filter(([s]) => s >= t0 - 5);
      const mk = await js('window.__do.mk');
      const r = {
        ok, so: lt.length, max: Math.round(Math.max(0, ...lt.map((x) => x[1]))), tong: Math.round(lt.reduce((s, x) => s + x[1], 0)),
        ds: lt.map((x) => Math.round(x[1])), frameDau: mk.dau ? Math.round(mk.dau - t0) : null, du: mk.du ? Math.round(mk.du - t0) : null, xong: Math.round(tXong - t0),
        doan: phanTichProfile(profile),
      };
      if (CHI_TIET) writeFileSync(join(RA, `${NHAN}-${k.ten}-${ca}-${Date.now()}.cpuprofile`), JSON.stringify(profile));
      return r;
    };
    const bam3D = () => js(`(() => { const b = document.querySelectorAll('.tab-xem button')[1]; b.click(); return true; })()`);
    let r;
    if (ca === 'du_an') r = await doPha(bam3D, `!!document.querySelector('.vung-3d.da-dung')`);
    else {
      await bam3D();
      await doiCo(`!!document.querySelector('.vung-3d.da-dung')`, 90000);
      await cho(YEN);
      // chọn tòa đầu nếu chưa có tòa đang xem (nút Công trình bị khoá)
      if (await js(`!!document.querySelector('.chon-che button:nth-child(2)')?.disabled`)) {
        const p = await js(`document.querySelector('.vung-3d')._chieuDoiTuong?.().find((d) => d.loai === 'toa') ?? null`);
        if (p) { const r0 = await js(`(() => { const r = document.querySelector('.vung-3d canvas').getBoundingClientRect(); return [r.left, r.top]; })()`);
          for (const type of ['mousePressed', 'mouseReleased']) await gui('Input.dispatchMouseEvent', { type, x: r0[0] + p.x, y: r0[1] + p.y, button: 'left', clickCount: 1 });
          await cho(1500); }
      }
      r = await doPha(() => js(`(() => { const b = document.querySelector('.chon-che button:nth-child(2)'); if (!b || b.disabled) return false; b.click(); return true; })()`),
        `(() => { const v = document.querySelector('.vung-3d.da-dung'); return !!v && document.querySelector('.chon-che button:nth-child(2)')?.getAttribute('aria-pressed') === 'true'; })()`);
    }
    r.ve = await js(`document.querySelector('.vung-3d')?._doVe?.() ?? null`);
    r.loiJs = b.loiJs.splice(0);
    r.ve3d = await js('JSON.stringify(window.__ve3d ?? null)');
    return r;
  } finally { await b.dong(); }
}

async function main() {
  mkdirSync(RA, { recursive: true });
  const kq = {}; let dat = true;
  for (const k of KHUNG) for (const ca of CA) for (let l = 0; l < LAN; l++) {
    const r = await mot(k, ca);
    (kq[`${k.ten}-${ca}`] ??= []).push(r);
    const qua = r.max > k.nguong || !r.ok;
    if (qua) dat = false;
    console.log(`${qua ? 'KHÔNG ĐẠT' : 'ĐẠT     '} ${k.ten.padEnd(3)} ${ca.padEnd(5)} lần ${l + 1}: ${r.so} tác vụ > 50 ms, dài nhất ${r.max} ms, tổng ${r.tong} ms [${r.ds.join(', ')}]` +
      ` · frame đầu ${r.frameDau ?? '—'} ms · đủ chất lượng ${r.du ?? '—'} ms · draw call ${r.ve?.calls ?? "—"} · CT ${r.ve?.chuongTrinh ?? "—"} · song song ${r.ve?.songSong ?? "—"} · pha ${r.ve?.pha ?? "—"} · dựng ${r.ve ? r.ve.dung.toFixed(0) : '—'} ms${r.loiJs.length ? ' · LỖI JS ' + r.loiJs.join(' | ') : ''}`);
    if (CHI_TIET) console.log('    ve3d', r.ve3d);
    for (const d of r.doan) {
      console.log(`    đoạn bận ${d.ms} ms (+${d.tuMs} ms)`);
      console.log('      self:\n        ' + d.self.slice(0, 6).join('\n        '));
      console.log('      app :\n        ' + d.tong.slice(0, CHI_TIET ? 40 : 10).join('\n        '));
    }
  }
  writeFileSync(join(RA, `${NHAN}-${MA}-${PA}.json`), JSON.stringify(kq, null, 2));
  process.exit(dat ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });
