#!/usr/bin/env node
/**
 * KỊCH BẢN E2E LEO AI — Edge / Chrome headless qua CDP (Node ≥ 22), KHÔNG gọi Claude thật: một "mô hình giả" chạy trong trang
 * (window.__leoKhachGia, chỉ nhận ở bản dev) phát lại chuỗi tool_use như Claude cho câu
 *   "Xếp tòa tự động cho lô NO-02, đổi 2 căn 3PN thành 2PN ở tầng điển hình, rồi cho tôi xem KPI dự án"
 * — công cụ chạy THẬT trên giao diện thật (kho, hoàn tác, tự chỉnh), đọc kết quả công cụ để chọn bước sau (id lô / tòa / ô thật).
 * Chụp ảnh máy tính 1440×900 và điện thoại 390×844 vào docs/anh/tro-ly/.
 *   node scripts/leo_ai_e2e.mjs --url http://127.0.0.1:5436 [--api http://127.0.0.1:8787] [--du-an-mau 2mlg1a2l]
 * Mỗi lần chạy sao một dự án mới "Leo AI E2E" từ PA pa-1 của dự án mẫu (DB local) để không đụng dữ liệu thử khác.
 * Mã thoát: 0 đạt · 1 hỏng · 2 lỗi hạ tầng.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (k, md) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : md; };
const URL0 = arg('--url', 'http://127.0.0.1:5436'), API = arg('--api', 'http://127.0.0.1:8787'), MAU = arg('--du-an-mau', '2mlg1a2l');
const GOC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RA = join(GOC, 'docs/anh/tro-ly');
const cho = (ms) => new Promise((r) => setTimeout(r, ms));
const timTrinhDuyet = () => [process.env.CHROME_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const CAU = 'Xếp tòa tự động cho lô NO-02, đổi 2 căn 3PN thành 2PN ở tầng điển hình, rồi cho tôi xem KPI dự án';

/** Mô hình giả (chạy trong trang): mỗi lượt quyết định theo số lượt đã qua + kết quả công cụ thật trước đó. */
const KHACH_GIA = `(() => {
  const cho = (ms) => new Promise((r) => setTimeout(r, ms));
  const manh = (s, n) => s.match(new RegExp('[\\\\s\\\\S]{1,' + n + '}', 'g')) ?? [];
  const luot = (khoi, stop) => ({
    async *[Symbol.asyncIterator]() {
      for (let i = 0; i < khoi.length; i++) {
        const k = khoi[i];
        if (k.type === 'tool_use') { yield { type: 'content_block_start', index: i, content_block: { ...k, input: {} } }; await cho(220); continue; }
        if (k.type === 'thinking') {
          yield { type: 'content_block_start', index: i, content_block: { type: 'thinking', thinking: '', signature: '' } };
          for (const p of manh(k.thinking, 14)) { yield { type: 'content_block_delta', index: i, delta: { type: 'thinking_delta', thinking: p } }; await cho(15); }
          continue;
        }
        yield { type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } };
        for (const p of manh(k.text, 9)) { yield { type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: p } }; await cho(14); }
      }
    },
    finalMessage: async () => ({ id: 'msg_gia', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content: khoi, stop_reason: stop, stop_sequence: null,
      usage: { input_tokens: 1400, output_tokens: 220, cache_read_input_tokens: 11800, cache_creation_input_tokens: 0 } }),
  });
  const kq = (than, ten) => {
    const ms = than.messages;
    for (let i = ms.length - 1; i >= 0; i--) {
      const m = ms[i];
      if (m.role !== 'assistant' || typeof m.content === 'string') continue;
      const tu = [...m.content].reverse().find((b) => b.type === 'tool_use' && b.name === ten);
      if (!tu) continue;
      const r = ms[i + 1] && Array.isArray(ms[i + 1].content) ? ms[i + 1].content.find((b) => b.tool_use_id === tu.id) : null;
      if (!r) return null;
      try { return JSON.parse(r.content); } catch { return { loi: r.content }; }
    }
    return null;
  };
  const soLuot = (than) => { let n = 0; for (let i = than.messages.length - 1; i >= 0; i--) { const m = than.messages[i];
    if (m.role === 'user' && Array.isArray(m.content) && !m.content.some((b) => b.type === 'tool_result')) break; if (m.role === 'assistant') n++; } return n; };
  let dem = 0;
  const id = () => 'toolu_gia_' + (++dem);
  const nghi = (t) => ({ type: 'thinking', thinking: t, signature: 'chu-ky-gia' });
  const chu = (t) => ({ type: 'text', text: t });
  const cc = (name, input) => ({ type: 'tool_use', id: id(), name, input });
  return {
    luong(than) {
      const n = soLuot(than);
      const cauCuoi = (() => { for (let i = than.messages.length - 1; i >= 0; i--) { const m = than.messages[i];
        if (m.role === 'user' && Array.isArray(m.content) && !m.content.some((b) => b.type === 'tool_result')) return m.content.filter((b) => b.type === 'text').map((b) => b.text).join(' '); } return ''; })();
      if (/tầng 5/.test(cauCuoi)) {
        if (n === 0) return luot([chu('Mở tầng điển hình 5 của tòa vừa xếp.'), cc('navigate', { screen: 'tang', tower_id: window.__leoE2E.toa, floor: 5 })], 'tool_use');
        return luot([chu('Đã mở tầng 5 của tòa ' + window.__leoE2E.toa + '.')], 'end_turn');
      }
      if (n === 0) return luot([nghi('Người dùng muốn ba việc: xếp tòa lô NO-02, đổi 2 căn 3PN → 2PN ở tầng điển hình, xem KPI. Trước hết đọc trạng thái để lấy id thật.'),
        chu('Tôi xem trạng thái dự án trước.'), cc('get_state', { gon: true })], 'tool_use');
      if (n === 1) {
        const st = kq(than, 'get_state');
        const lo = st.lo.find((l) => l.ky_hieu === 'NO-02') ?? st.lo.find((l) => l.cao_tang && !l.toa.length);
        window.__leoE2E = { lo: lo.id };
        return luot([chu('Lô NO-02 (' + lo.id + ') chưa có tòa. Tôi chạy gợi ý xếp tòa MT-05 và áp phương án tốt nhất.'), cc('apply_arrangement', { lot_id: lo.id, option: 0 })], 'tool_use');
      }
      if (n === 2) {
        const ap = kq(than, 'apply_arrangement');
        if (!ap || ap.loi) return luot([chu('Không xếp được tòa: ' + (ap && ap.loi))], 'end_turn');
        window.__leoE2E.toa = ap.toa_moi[0];
        window.__leoE2E.ap = ap;
        return luot([chu('Đã đặt ' + ap.da_ap.so_toa + ' tòa (' + ap.da_ap.mau.map((m) => m[0] + ' × ' + m[1]).join(', ') + '). Giờ xem mặt bằng tầng điển hình của tòa đầu.'),
          cc('get_floor_plan', { tower_id: ap.toa_moi[0] })], 'tool_use');
      }
      if (n === 3) {
        const mb = kq(than, 'get_floor_plan');
        window.__leoE2E.truoc = mb.theo_loai;
        const can = mb.o.filter((o) => o.cong_nang === 'can');
        let chon = can.filter((o) => o.loai === '3pn').slice(0, 2), loai = '2pn';
        if (chon.length < 2) { chon = can.filter((o) => o.loai === '2pn').slice(0, 2); loai = '3pn'; }
        window.__leoE2E.o = chon.map((o) => o.ch);
        return luot([nghi('Tầng điển hình có ' + mb.so_can + ' căn. Chọn ' + chon.map((o) => o.ch).join(', ') + ' để đổi; mở màn Tầng cho người dùng thấy.'),
          chu('Đổi ' + chon.map((o) => o.ch).join(' và ') + ' sang ' + loai.toUpperCase() + ' trên mặt bằng điển hình (chỉ hai ô này), rồi mở màn Tầng.'),
          cc('change_units', { tower_id: window.__leoE2E.toa, changes: chon.map((o) => ({ cell: o.key, unit_type: loai })), same_template_all: false }),
          cc('navigate', { screen: 'tang', tower_id: window.__leoE2E.toa, view: '2d' })], 'tool_use');
      }
      if (n === 4) return luot([chu('Kiểm KPI cả dự án sau khi sửa.'), cc('get_kpi', { scope: 'project' })], 'tool_use');
      const k = kq(than, 'get_kpi'), d = kq(than, 'change_units'), e = window.__leoE2E;
      const pct = (o) => Object.entries(o).map(([l, v]) => l.toUpperCase() + ' ' + String(v).replace('.', ',') + ' %').join(' · ');
      return luot([chu([
        '## Đã xong',
        '- **Xếp tòa lô NO-02**: ' + e.ap.da_ap.so_toa + ' tòa, ' + e.ap.da_ap.so_can + ' căn, MĐXD ' + String(e.ap.da_ap.mat_do).replace('.', ',') + ' %.',
        '- **Đổi căn** ở tầng điển hình tòa ' + e.toa + ': ' + (d.da_doi || []).join('; ') + (d.chan && d.chan.length ? ' (bị chặn: ' + d.chan.join(', ') + ')' : '') + '.',
        '',
        '| KPI dự án | Giá trị | Ngưỡng |',
        '|---|---:|---:|',
        '| Số căn | ' + k.so_can.gt + ' | ' + (k.so_can.nguong ?? '—') + ' |',
        '| Dân số | ' + k.dan_so.gt + ' | ' + (k.dan_so.nguong ?? '—') + ' |',
        '| DT sàn tính HSSDĐ (m²) | ' + k.dt_san_hssdd_m2.gt + ' | ' + (k.dt_san_hssdd_m2.nguong ?? '—') + ' |',
        '| Hiệu suất | ' + String(k.hieu_suat.gt).replace('.', ',') + ' | ≥ 0,75 |',
        '',
        'Cơ cấu cả dự án: ' + pct(k.co_cau_pct) + '. Mọi bước hoàn tác được bằng Ctrl+Z.',
      ].join('\\n'))], 'end_turn');
    },
  };
})()`;

async function main() {
  const exe = timTrinhDuyet();
  if (!exe) throw new Error('Không thấy Edge / Chrome — đặt CHROME_PATH');
  // dự án thử mới, sao PA pa-1 của dự án mẫu
  const pa = await (await fetch(`${API}/api/du-an/${MAU}/pa/pa-1`)).json();
  const da = await (await fetch(`${API}/api/du-an`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ten: 'Leo AI E2E', dia_diem: '' }) })).json();
  await fetch(`${API}/api/du-an/${da.ma}/pa/pa-1`, { method: 'PUT', headers: { 'content-type': 'application/json', 'X-Ma-Sua': da.ma_sua }, body: JSON.stringify({ ten: 'PA thử', trang_thai: pa.trang_thai, tom_tat: {} }) });
  console.log('dự án thử', da.ma);

  const port = 19500 + (process.pid % 200), hoSo = join(GOC, '.cache', `leo-e2e-${process.pid}`);
  mkdirSync(hoSo, { recursive: true }); mkdirSync(RA, { recursive: true });
  const tr = spawn(exe, ['--headless=new', '--inprivate', '--disable-sync', '--disable-extensions', '--no-first-run', '--hide-scrollbars',
    `--remote-debugging-port=${port}`, `--user-data-dir=${hoSo}`, 'about:blank'], { stdio: 'ignore' });
  const loi = [];
  try {
    let ds;
    for (let i = 0; i < 80 && !ds?.some((x) => x.type === 'page'); i++) { try { ds = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { await cho(250); } }
    const ws = new WebSocket(ds.find((x) => x.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    let id = 0; const doi = new Map(), nghe = new Set();
    ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && doi.has(m.id)) { const d = doi.get(m.id); doi.delete(m.id); m.error ? d.ko(new Error(JSON.stringify(m.error))) : d.ok(m.result); } else nghe.forEach((f) => f(m)); });
    const gui = (method, params = {}) => new Promise((ok, ko) => { const i = ++id; doi.set(i, { ok, ko }); ws.send(JSON.stringify({ id: i, method, params })); });
    const js = async (bt) => { const r = await gui('Runtime.evaluate', { expression: bt, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
    const moi = async (u) => { const x = new Promise((r) => { const f = (m) => { if (m.method === 'Page.loadEventFired') { nghe.delete(f); r(); } }; nghe.add(f); }); await gui('Page.navigate', { url: u }); await x; };
    const doiCo = async (bt, ms = 30000) => { const het = Date.now() + ms; while (Date.now() < het) { if (await js(bt)) return true; await cho(200); } return false; };
    const bam = (sel) => js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.click(); return true; })()`);
    const chup = async (ten) => { const a = await gui('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(RA, ten), Buffer.from(a.data, 'base64')); console.log('  ảnh', ten); };
    const go = (chu) => js(`(() => { const o = document.querySelector('.leo-ai textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(o, ${JSON.stringify(chu)}); o.dispatchEvent(new Event('input', { bubbles: true })); o.focus(); return true; })()`);
    const khung = async (w, h, mobile) => { await gui('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile }); await gui('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: 5 }); };
    const kiem = (dk, cau) => { if (!dk) { loi.push(cau); console.log('LỖI ', cau); } else console.log('đạt ', cau); };
    await gui('Page.enable'); await gui('Runtime.enable');

    // ---------- máy tính 1440×900 ----------
    await khung(1440, 900, false);
    await moi(URL0 + '/');
    await js(`localStorage.setItem('unitmix.maSua.${da.ma}', '${da.ma_sua}'); localStorage.setItem('unitmix.lang', 'vi'); true`);
    await moi(`${URL0}/du-an/${da.ma}?pa=pa-1`);
    kiem(await doiCo(`!!document.querySelector('.panel-giua .ban-ve-svg, .panel-giua svg')`, 40000), 'mở màn soạn');
    await cho(1200);
    const giuaTruoc = await js(`JSON.stringify(document.querySelector('.panel-giua').getBoundingClientRect())`);
    kiem(await bam('.thanh-tren .nut-leo-ai'), 'có nút Leo AI trên thanh trên');
    kiem(await doiCo(`!!document.querySelector('.leo-ai .leo-soan textarea')`, 15000), 'mở khung Leo AI');
    await cho(500);
    kiem(giuaTruoc === await js(`JSON.stringify(document.querySelector('.panel-giua').getBoundingClientRect())`), 'khung giữa không đổi kích thước khi mở Leo AI (lớp phủ)');
    await chup('may-tinh-1-chao.png');
    await js(`window.__leoKhachGia = ${KHACH_GIA}; true`);
    await go(CAU); await cho(700);
    kiem(await js(`!!document.querySelector('.leo-goi-y-mh')`), 'chip gợi ý mô hình hiện khi gõ (0 token)');
    await chup('may-tinh-2-goi-y-mo-hinh.png');
    await bam('.leo-ai .leo-gui');
    kiem(await doiCo(`document.querySelectorAll('.leo-ai .leo-buoc').length >= 3`, 30000), 'các bước công cụ hiện trong khung chat');
    await chup('may-tinh-3-dang-chay.png');
    kiem(await doiCo(`!document.querySelector('.leo-ai .leo-gui.dung') && /Đã xong/.test(document.querySelector('.leo-ai .leo-than').textContent)`, 90000), 'Leo AI chạy xong, trả lời có tóm tắt');
    await cho(800);
    const loiBuoc = await js(`[...document.querySelectorAll('.leo-ai .leo-buoc.loi')].map((e) => e.textContent.trim().slice(0, 160))`);
    kiem(loiBuoc.length === 0, 'không bước công cụ nào lỗi' + (loiBuoc.length ? ': ' + loiBuoc.join(' | ') : ''));
    const e2e = await js(`window.__leoE2E`);
    console.log('  kịch bản:', JSON.stringify({ lo: e2e?.lo, toa: e2e?.toa, o: e2e?.o }));
    kiem(await js(`!!document.querySelector('.tab-buoc button[aria-pressed="true"]') && document.querySelectorAll('.tab-buoc button')[1].getAttribute('aria-pressed') === 'true'`), 'đã chuyển sang màn Tầng (navigate)');
    await js(`document.querySelector('.leo-ai .leo-than').scrollTop = 0; true`); await cho(300);
    await chup('may-tinh-4-buoc-cong-cu.png');
    await js(`(() => { const t = document.querySelector('.leo-ai .leo-than'); t.scrollTop = t.scrollHeight; return true; })()`); await cho(400);
    await chup('may-tinh-5-xong-kpi.png');
    // mở một bước công cụ để xem đầu vào / kết quả
    await js(`(() => { const d = [...document.querySelectorAll('.leo-ai .leo-buoc')].find((x) => /Đổi căn/.test(x.textContent)); if (d) { d.open = true; d.scrollIntoView({ block: 'center' }); } return !!d; })()`); await cho(400);
    await chup('may-tinh-6-mo-buoc.png');
    // tự lưu: chờ chữ "Đã lưu"
    kiem(await doiCo(`/Đã lưu|Saved/.test(document.querySelector('.thanh-tren').textContent)`, 15000), 'PA tự lưu sau khi Leo AI sửa');
    await cho(1500);
    // PA đã lưu ở máy chủ: lô NO-02 có tòa, tòa đó có ô đổi căn (canViTri) — sửa đi qua đúng kho + tự lưu của giao diện
    const luu = (await (await fetch(`${API}/api/du-an/${da.ma}/pa/pa-1`)).json()).trang_thai;
    const toaLuu = luu.toa.filter((x) => x.loId === e2e?.lo);
    kiem(toaLuu.length > 0, `PA lưu: lô NO-02 có ${toaLuu.length} tòa`);
    kiem(!!toaLuu.find((x) => x.id === e2e?.toa && Object.keys(x.canViTri ?? {}).length >= 1), 'PA lưu: tòa vừa xếp có căn đổi ở tầng điển hình');
    // Hoàn tác (Ctrl+Z của giao diện) gỡ đúng bước Leo AI vừa làm (cùng ngăn hoàn tác)
    await bam('.thanh-tren .nut-hoan'); await cho(400);
    kiem(await js(`document.querySelectorAll('.tab-buoc button')[1].getAttribute('aria-pressed') === 'true'`), 'bấm Hoàn tác trên thanh trên chạy được sau bước Leo AI');
    await bam('.thanh-tren .nut-hoan + .nut-hoan'); await cho(400);
    await bam('.leo-ai .leo-dau button[aria-label="Cài đặt Leo AI"]'); await cho(600);
    await chup('may-tinh-7-cai-dat.png');
    await bam('.leo-ai .leo-dau button[aria-label="Lịch sử trò chuyện"]'); await cho(400);
    await chup('may-tinh-8-lich-su.png');
    await bam('.leo-ai .leo-dau button[aria-label="Lịch sử trò chuyện"]'); await cho(300);
    // đổi tòa + chọn tầng cùng một lượt (navigate floor) → dải cấp thanh trên không còn "Tầng điển hình"
    await go('Mở tầng 5 của tòa vừa xếp'); await cho(200); await bam('.leo-ai .leo-gui');
    await doiCo(`!document.querySelector('.leo-ai .leo-gui.dung') && /Đã mở tầng 5/.test(document.querySelector('.leo-ai .leo-than').textContent)`, 30000); await cho(600);
    kiem(await js(`!/Tầng điển hình/.test([...document.querySelectorAll('.thanh-tren .cap-do button')].map((b) => b.textContent).join(' '))`), 'navigate floor: đã chọn tầng 5 (dải cấp)');

    // ---------- điện thoại 390×844 ----------
    await khung(390, 844, true);
    await moi(`${URL0}/du-an/${da.ma}?pa=pa-1`);
    kiem(await doiCo(`!!document.querySelector('.panel-giua svg')`, 40000), 'điện thoại: mở màn soạn');
    await cho(1200);
    await chup('dien-thoai-0-thanh-tren.png');
    kiem(await js(`(() => { const e = document.querySelector('.dock-duoi .nut-leo-dock'); if (!e) return false; const r = e.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.bottom <= innerHeight; })()`), 'điện thoại: nút Leo AI ở dock dưới (≥ 44 px, tầm ngón cái)');
    await bam('.dock-duoi .nut-leo-dock');
    kiem(await doiCo(`!!document.querySelector('.leo-ai .leo-soan textarea')`, 15000), 'điện thoại: mở tấm Leo AI');
    await cho(700);
    kiem(await js(`(() => { const r = document.querySelector('.leo-ai').getBoundingClientRect(); return r.left === 0 && Math.round(r.width) === innerWidth && r.top <= 1; })()`), 'điện thoại: Leo AI toàn màn');
    kiem(await js(`/Đã xong/.test(document.querySelector('.leo-ai .leo-than').textContent)`), 'điện thoại: cuộc trò chuyện vẫn còn (lưu theo dự án)');
    await chup('dien-thoai-1-tro-chuyen.png');
    await bam('.leo-ai .leo-dau button[aria-label="Cuộc trò chuyện mới"]'); await cho(500);
    await chup('dien-thoai-2-chao.png');
    // bàn phím ảo giả: ô nhập + mic + gửi ngay trên bàn phím
    await js(`(() => { const s = document.documentElement.style; s.setProperty('--vv-h', '470px'); s.setProperty('--vv-y', '0px'); s.setProperty('--vv-duoi', '374px'); document.documentElement.classList.add('ban-phim'); return true; })()`);
    await go('Mở tầng 5 của tòa vừa xếp'); await cho(700);
    kiem(await js(`['.leo-ai .leo-gui', '.leo-ai .leo-mic', '.leo-ai textarea'].every((s) => { const e = document.querySelector(s); if (!e) return s === '.leo-ai .leo-mic'; const r = e.getBoundingClientRect(); return r.bottom <= 470.5 && r.top >= 0; })`), 'điện thoại: bàn phím mở — ô nhập, mic, gửi vẫn trong phần nhìn thấy');
    await chup('dien-thoai-3-ban-phim.png');
    ws.close();
  } finally { tr.kill(); await cho(400); try { rmSync(hoSo, { recursive: true, force: true }); } catch { /* */ } }
  console.log(loi.length ? `LEO AI E2E: HỎNG (${loi.length})` : 'LEO AI E2E: ĐẠT');
  process.exit(loi.length ? 1 : 0);
}
main().catch((e) => { console.error('Lỗi hạ tầng:', e.message); process.exit(2); });
