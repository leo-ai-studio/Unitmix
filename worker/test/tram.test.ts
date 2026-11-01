/**
 * Trạm chuyển Leo AI cho điện thoại (src/tram.ts): mã ghép, cầu nối WebSocket, vòng hỏi → cầu → đáp, chờ tiếp khi chậm, trần câu / phút,
 * kết quả chỉ lấy được một lần. Cầu là WebSocket giả chạy trong test. TRAM_CHO_MS = 300 ms (vitest.config.ts).
 */
import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const goc = 'https://unitmix.leo-ai.dev';
const khoaMoi = () => (crypto.randomUUID() + crypto.randomUUID()).replaceAll('-', '').slice(0, 48);
const H = (khoa: string) => ({ 'X-Leo-Khoa': khoa, 'content-type': 'application/json' });
const hoi = (khoa: string, duong: string, than: unknown = null) => SELF.fetch(`${goc}/api/tram/hoi`, { method: 'POST', headers: H(khoa), body: JSON.stringify({ duong, than }) });
const kq = (khoa: string, ma: string) => SELF.fetch(`${goc}/api/tram/kq?ma=${ma}`, { headers: H(khoa) });

/** Cầu giả: nối vào phòng, gom các yêu cầu trạm chuyển xuống. */
async function noiCau(khoa: string) {
  const r = await SELF.fetch(`${goc}/api/tram/cau`, { headers: { ...H(khoa), Upgrade: 'websocket' } });
  expect(r.status).toBe(101);
  const ws = r.webSocket!;
  ws.accept();
  const nhan: { ma: string; duong: string; than: string | null }[] = [];
  const cho: ((v: (typeof nhan)[number]) => void)[] = [];
  ws.addEventListener('message', (e) => { const v = JSON.parse(String(e.data)); const c = cho.shift(); if (c) c(v); else nhan.push(v); });
  return {
    ws,
    tiep: () => new Promise<(typeof nhan)[number]>((xong) => { const v = nhan.shift(); if (v) xong(v); else cho.push(xong); }),
    dap: (ma: string, ma_http: number, than: string, loai = 'application/json') => ws.send(JSON.stringify({ ma, ma_http, than, loai })),
  };
}

describe('Trạm chuyển Leo AI', () => {
  it('mã ghép sai dạng → 401', async () => {
    expect((await hoi('ngan', '/suc-khoe')).status).toBe(401);
    expect((await SELF.fetch(`${goc}/api/tram/hoi`, { method: 'POST', body: '{}' })).status).toBe(401);
  });

  it('máy tính chưa nối → 503 may_tat; đường lạ → 404', async () => {
    const k = khoaMoi();
    const r = await hoi(k, '/suc-khoe');
    expect(r.status).toBe(503);
    expect(((await r.json()) as { ma: string }).ma).toBe('may_tat');
    expect((await hoi(k, '/dang-nhap')).status).toBe(404);
  });

  it('điện thoại hỏi → cầu nhận → cầu đáp → điện thoại nhận, kèm loại nội dung (SSE)', async () => {
    const k = khoaMoi();
    const cau = await noiCau(k);
    const than = JSON.stringify({ model: 'claude-sonnet-5-5', messages: [] });
    const p = hoi(k, '/v1/messages', than);
    const v = await cau.tiep();
    expect(v.duong).toBe('/v1/messages');
    expect(v.than).toBe(than);
    cau.dap(v.ma, 200, 'event: message_stop\ndata: {}\n\n', 'text/event-stream');
    const j = (await (await p).json()) as { ma_http: number; than: string; loai: string };
    expect(j).toEqual({ ma_http: 200, than: 'event: message_stop\ndata: {}\n\n', loai: 'text/event-stream' });
  });

  it('mã khác nhau là phòng khác nhau (không đọc chéo)', async () => {
    const [a, b] = [khoaMoi(), khoaMoi()];
    await noiCau(a);
    expect((await hoi(b, '/suc-khoe')).status).toBe(503);
  });

  it('cầu chậm: lần đầu trả {ma}, đáp xong lấy bằng /kq đúng một lần', async () => {
    const k = khoaMoi();
    const cau = await noiCau(k);
    const p = await hoi(k, '/v1/messages', '{}');
    const { ma } = (await p.json()) as { ma: string };
    expect(ma).toMatch(/^[0-9a-f-]{36}$/);
    expect((await kq(k, ma)).status).toBe(204); // vẫn đang chạy
    const v = await cau.tiep();
    cau.dap(v.ma, 200, '{"type":"message"}');
    const r = await kq(k, ma);
    expect(await r.json()).toEqual({ ma_http: 200, than: '{"type":"message"}', loai: 'application/json' });
    expect((await kq(k, ma)).status).toBe(404); // lấy rồi thì hết
    expect((await kq(k, crypto.randomUUID())).status).toBe(404);
  });

  it('tin lạ từ cầu (mã không có) bị bỏ qua, không làm hỏng phòng', async () => {
    const k = khoaMoi();
    const cau = await noiCau(k);
    cau.dap('ma-la', 200, 'x');
    cau.ws.send('khong phai json');
    const p = hoi(k, '/suc-khoe');
    const v = await cau.tiep();
    cau.dap(v.ma, 200, '{"ok":true}');
    expect(((await (await p).json()) as { ma_http: number }).ma_http).toBe(200);
  });

  it('trần 30 câu / phút / phòng; /suc-khoe không tính', async () => {
    const k = khoaMoi();
    await noiCau(k);
    const ds = await Promise.all(Array.from({ length: 31 }, () => hoi(k, '/v1/messages', '{}')));
    expect(ds.filter((r) => r.status === 429)).toHaveLength(1);
    expect((await hoi(k, '/suc-khoe')).status).toBe(200);
  });

  it('cầu mới đá cầu cũ', async () => {
    const k = khoaMoi();
    const cu = await noiCau(k);
    const dong = new Promise<number>((xong) => cu.ws.addEventListener('close', (e) => xong(e.code)));
    const moi = await noiCau(k);
    expect(await dong).toBe(4000);
    const p = hoi(k, '/suc-khoe');
    const v = await moi.tiep();
    moi.dap(v.ma, 200, '{}');
    expect((await p).status).toBe(200);
  });

  it('Dừng: điện thoại tự sinh mã, huỷ → cầu nhận {huy}, người chờ nhận 499, kết quả đến sau bị bỏ', async () => {
    const k = khoaMoi();
    const cau = await noiCau(k);
    const ma = crypto.randomUUID();
    const p = SELF.fetch(`${goc}/api/tram/hoi`, { method: 'POST', headers: H(k), body: JSON.stringify({ ma, duong: '/v1/messages', than: '{}' }) });
    const v = await cau.tiep();
    expect(v.ma).toBe(ma); // trạm dùng mã của điện thoại
    const huy = await SELF.fetch(`${goc}/api/tram/huy?ma=${ma}`, { method: 'POST', headers: H(k) });
    expect(huy.status).toBe(204);
    const nhan = await cau.tiep() as unknown as { huy: string };
    expect(nhan.huy).toBe(ma);
    const j = (await (await p).json()) as { ma_http: number; than: string };
    expect(j.ma_http).toBe(499);
    cau.dap(ma, 200, '{"type":"message"}'); // cầu trả muộn: bỏ qua
    expect((await kq(k, ma)).status).toBe(404);
    expect((await SELF.fetch(`${goc}/api/tram/huy?ma=khong-phai-ma`, { method: 'POST', headers: H(k) })).status).toBe(404);
  });
});

