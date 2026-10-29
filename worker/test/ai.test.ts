/**
 * Cổng Leo AI khoá chung (src/ai.ts): thiếu secret → lỗi rõ để giao diện xin khoá riêng; cần mã sửa; danh sách mô hình; trần token;
 * lọc trường / beta; trần lượt / ngày; không lộ khoá (không trả về, không đưa vào URL). Thượng nguồn Anthropic là fetch giả.
 */
import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { chuyenAI, TRAN_TOKEN, type EnvAI } from '../src/ai';

const KHOA = 'sk-ant-thu-KHONG-DUOC-LO-123456';
const goi = (duong: string, init: RequestInit = {}) => SELF.fetch(`https://unitmix.leo-ai.dev${duong}`, init);

async function taoDuAn() {
  const r = await goi('/api/du-an', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ten: 'AI' }) });
  return (await r.json()) as { ma: string; ma_sua: string };
}
const yeuCau = (ma: string, maSua: string, than: Record<string, unknown>, them: Record<string, string> = {}) =>
  new Request('https://unitmix.leo-ai.dev/api/ai/v1/messages?beta=true', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Du-An': ma, 'X-Ma-Sua': maSua, 'x-api-key': 'may-chu', 'anthropic-version': '2023-06-01', 'CF-Connecting-IP': '1.2.3.4', ...them },
    body: JSON.stringify(than),
  });
const THAN = { model: 'claude-sonnet-5-5', max_tokens: 1000, messages: [{ role: 'user', content: 'chào' }], stream: true };

/** fetch giả: ghi lại yêu cầu gửi lên Anthropic, trả luồng SSE ngắn. */
function thuongNguon() {
  const ghi: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  const f = (async (url: RequestInfo | URL, init?: RequestInit) => {
    ghi.push({ url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    return new Response('event: message_stop\ndata: {"type":"message_stop"}\n\n', { status: 200, headers: { 'content-type': 'text/event-stream', 'request-id': 'req_1', 'x-bi-mat': 'khong-tra' } });
  }) as typeof fetch;
  return { f, ghi };
}
const envAI = (them: Partial<EnvAI> = {}): EnvAI => ({ DB: env.DB, ANTHROPIC_API_KEY: KHOA, ...them });

describe('Leo AI — cổng khoá chung', () => {
  it('thiếu secret → 503 chua_cau_hinh, không thử lại, giao diện xin khoá riêng', async () => {
    const r = await goi('/api/ai/v1/messages', { method: 'POST', body: JSON.stringify(THAN) });
    expect(r.status).toBe(503);
    expect(r.headers.get('x-should-retry')).toBe('false');
    const j = (await r.json()) as { error: { type: string; message: string } };
    expect(j.error.type).toBe('chua_cau_hinh');
    expect(j.error.message).toMatch(/khoá API Anthropic riêng/);
    expect(((await (await goi('/api/ai/trang-thai')).json()) as { coKhoaChung: boolean }).coKhoaChung).toBe(false);
  });

  it('cần mã sửa đúng của dự án', async () => {
    const { ma, ma_sua } = await taoDuAn();
    const { f, ghi } = thuongNguon();
    expect((await chuyenAI(yeuCau(ma, 'sai', THAN), envAI(), f)).status).toBe(403);
    expect((await chuyenAI(yeuCau('khongco', ma_sua, THAN), envAI(), f)).status).toBe(403);
    expect(ghi).toHaveLength(0);
  });

  it('chuyển đúng: khoá ở header thượng nguồn, không ở URL, không trả về; lọc trường / beta; trần token', async () => {
    const { ma, ma_sua } = await taoDuAn();
    const { f, ghi } = thuongNguon();
    const r = await chuyenAI(yeuCau(ma, ma_sua, { ...THAN, max_tokens: 999_999, mcp_servers: [{ url: 'x' }], container: 'c' }, { 'anthropic-beta': 'server-side-fallback-2026-07-01, files-api-2025-04-14' }), envAI(), f);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('text/event-stream');
    expect(r.headers.get('x-bi-mat')).toBeNull();
    const chu = await r.text();
    expect(chu).toContain('message_stop');
    expect(chu).not.toContain(KHOA);
    const g = ghi[0];
    expect(g.url).toBe('https://api.anthropic.com/v1/messages?beta=true');
    expect(g.url).not.toContain(KHOA);
    expect(g.headers.get('x-api-key')).toBe(KHOA);
    expect(g.headers.get('anthropic-beta')).toBe('server-side-fallback-2026-07-01');
    expect(g.body.max_tokens).toBe(TRAN_TOKEN);
    expect(g.body.mcp_servers).toBeUndefined();
    expect(g.body.container).toBeUndefined();
    expect(JSON.stringify(g.body)).not.toContain(KHOA);
  });

  it('mô hình ngoài danh sách → 400, không gọi thượng nguồn', async () => {
    const { ma, ma_sua } = await taoDuAn();
    const { f, ghi } = thuongNguon();
    const r = await chuyenAI(yeuCau(ma, ma_sua, { ...THAN, model: 'claude-fable-5-1' }), envAI(), f);
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: { type: string } }).error.type).toBe('mo_hinh_khong_cho_phep');
    expect(ghi).toHaveLength(0);
  });

  it('trần lượt / ngày theo dự án → 429 het_luot', async () => {
    const { ma, ma_sua } = await taoDuAn();
    const { f } = thuongNguon();
    const e = envAI({ AI_GIOI_HAN_DU_AN: '2' });
    expect((await chuyenAI(yeuCau(ma, ma_sua, THAN), e, f)).status).toBe(200);
    expect((await chuyenAI(yeuCau(ma, ma_sua, THAN), e, f)).status).toBe(200);
    const r = await chuyenAI(yeuCau(ma, ma_sua, THAN), e, f);
    expect(r.status).toBe(429);
    expect(r.headers.get('x-should-retry')).toBe('false');
    const hang = await env.DB.prepare('SELECT khoa FROM ai_luot').all<{ khoa: string }>();
    expect(JSON.stringify(hang.results)).not.toContain('1.2.3.4'); // IP chỉ lưu dạng băm
  });
});
