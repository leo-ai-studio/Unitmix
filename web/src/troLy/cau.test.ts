import Anthropic from '@anthropic-ai/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cauDungDuoc, chonNguon, ghiMaGhep, kiemCau, linkGhep, nhanMaGhepTuLink, taoBoCaiBat, taoFetchTram } from './cau';
import { loiTiengViet, taoKhach } from './khachThat';
import { docCaiDat } from './moHinh';

const kho = new Map<string, string>();
beforeEach(() => {
  kho.clear();
  vi.stubGlobal('localStorage', { getItem: (k: string) => kho.get(k) ?? null, setItem: (k: string, v: string) => void kho.set(k, v), removeItem: (k: string) => void kho.delete(k) });
  vi.stubGlobal('location', { origin: 'https://unitmix.example' });
});

const traLoi = (j: unknown, ok = true) => (async () => ({ ok, json: async () => j })) as unknown as typeof fetch;

describe('chonNguon', () => {
  it('tự động: khoá riêng → cầu → khoá chung', () => {
    expect(chonNguon('tu_dong', { khoaRieng: true, cau: true })).toBe('rieng');
    expect(chonNguon('tu_dong', { khoaRieng: false, cau: true })).toBe('cau');
    expect(chonNguon('tu_dong', { khoaRieng: false, cau: false })).toBe('chung');
  });
  it('chọn tay một nguồn thì giữ nguồn đó, không lặng lẽ đổi', () => {
    expect(chonNguon('cau', { khoaRieng: true, cau: false })).toBe('cau');
    expect(chonNguon('chung', { khoaRieng: true, cau: true })).toBe('chung');
  });
});

describe('kiemCau', () => {
  it('đọc /suc-khoe của cầu', async () => {
    const c = await kiemCau('http://x', 500, traLoi({ ok: true, dang_nhap: true, tai_khoan: { email: 'a@b.c', subscriptionType: 'max' }, phien_ban: '2.1' }));
    expect(c).toEqual({ qua: 'may', ok: true, dangNhap: true, taiKhoan: 'a@b.c · max', phienBan: '2.1' });
    expect(cauDungDuoc(c)).toBe(true);
  });
  it('chưa đăng nhập → không dùng được; chưa rõ → vẫn thử', async () => {
    expect(cauDungDuoc(await kiemCau('http://x', 500, traLoi({ ok: true, dang_nhap: false })))).toBe(false);
    expect(cauDungDuoc(await kiemCau('http://x', 500, traLoi({ ok: true, dang_nhap: null })))).toBe(true);
    expect(cauDungDuoc({ qua: 'may', ok: false, dangNhap: null, taiKhoan: '', phienBan: null })).toBe(false);
  });
  it('cầu không trả lời / lỗi HTTP → null', async () => {
    expect(await kiemCau('http://x', 500, (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch)).toBeNull();
    expect(await kiemCau('http://x', 500, traLoi({}, false))).toBeNull();
    expect(cauDungDuoc(null)).toBe(false);
  });
});

describe('khách Claude qua cầu', () => {
  it('nguồn cầu giữ nguồn "cau"; nguồn riêng thiếu khoá rơi về khoá chung', () => {
    expect(taoKhach({ nguon: 'cau', khoaRieng: null, maDuAn: 'd', maSua: null, diaChiCau: 'http://127.0.0.1:3032' }).nguon).toBe('cau');
    expect(taoKhach({ nguon: 'rieng', khoaRieng: null, maDuAn: 'd', maSua: null }).nguon).toBe('chung');
    expect(taoKhach({ khoaRieng: 'sk-ant-x', maDuAn: 'd', maSua: null }).nguon).toBe('rieng');
  });
  it('lỗi của cầu đổi thành câu tiếng Việt chỉ việc người dùng làm được', () => {
    const h = new Headers();
    const dn = Anthropic.AuthenticationError.generate(401, { type: 'error', error: { type: 'authentication_error', message: 'x' } }, 'x', h);
    expect(loiTiengViet(dn, 'cau')).toMatchObject({ can: 'khoa' });
    expect(loiTiengViet(dn, 'cau').chu).toContain('Đăng nhập Claude');
    const gh = Anthropic.RateLimitError.generate(429, { type: 'error', error: { type: 'rate_limit_error', message: 'x' } }, 'x', h);
    expect(loiTiengViet(gh, 'cau').chu).toContain('hạn mức');
    expect(loiTiengViet(new Anthropic.APIConnectionError({}), 'cau')).toMatchObject({ can: 'khoa' });
  });
});

describe('cài đặt nguồn', () => {
  it('mặc định tự động; giá trị lạ trong localStorage về mặc định', () => {
    localStorage.setItem('unitmix.leoAi.caiDat', JSON.stringify({ nguon: 'la' }));
    expect(docCaiDat().nguon).toBe('tu_dong');
    localStorage.setItem('unitmix.leoAi.caiDat', JSON.stringify({ nguon: 'cau' }));
    expect(docCaiDat().nguon).toBe('cau');
  });
});

const KHOA = 'k'.repeat(43);
const jsonRes = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

describe('ghép điện thoại', () => {
  it('link #ghep=… lưu mã một lần rồi xoá khỏi thanh địa chỉ', () => {
    const doi = vi.fn();
    vi.stubGlobal('location', { origin: 'https://u.example', hash: `#ghep=${KHOA}`, pathname: '/du-an', search: '?a=1' });
    vi.stubGlobal('history', { replaceState: doi });
    expect(nhanMaGhepTuLink()).toBe(true);
    expect(kho.get('unitmix.leoAi.ghep')).toBe(KHOA);
    expect(doi).toHaveBeenCalledWith(null, '', '/du-an?a=1');
    vi.stubGlobal('location', { origin: 'https://u.example', hash: '#ghep=ngan', pathname: '/', search: '' });
    expect(nhanMaGhepTuLink()).toBe(false); // mã sai dạng: bỏ qua
  });
  it('link ghép dùng địa chỉ app trên mạng', () => {
    expect(linkGhep(KHOA, 'https://u.example')).toBe(`https://u.example/#ghep=${KHOA}`);
  });
  it('không có cầu ở máy này nhưng đã ghép → dò qua trạm, trạng thái qua = tram', async () => {
    ghiMaGhep(KHOA);
    const goi = (async (u: RequestInfo | URL, init?: RequestInit) => {
      if (String(u).startsWith('http://127.0.0.1')) throw new TypeError('Failed to fetch');
      expect(String(u)).toBe('/api/tram/hoi');
      expect((init!.headers as Record<string, string>)['X-Leo-Khoa']).toBe(KHOA);
      expect(JSON.parse(String(init!.body))).toEqual({ duong: '/suc-khoe', than: null });
      return jsonRes({ ma_http: 200, than: JSON.stringify({ ok: true, dang_nhap: true, tai_khoan: { email: 'a@b.c' } }), loai: 'application/json' });
    }) as typeof fetch;
    expect(await kiemCau('http://127.0.0.1:3032', 300, goi)).toMatchObject({ qua: 'tram', ok: true, dangNhap: true, taiKhoan: 'a@b.c' });
  });
});

describe('taoFetchTram', () => {
  it('trả ngay khi trạm đáp trong một lần; giữ loại nội dung SSE', async () => {
    const goi = (async () => jsonRes({ ma_http: 200, than: 'event: message_stop\ndata: {}\n\n', loai: 'text/event-stream' })) as unknown as typeof fetch;
    const r = await taoFetchTram(KHOA, goi)('/_cau/v1/messages?beta=true', { method: 'POST', body: '{"model":"m"}' });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('text/event-stream');
    expect(await r.text()).toContain('message_stop');
  });
  it('cầu chậm: nhận {ma} rồi hỏi /kq lặp lại qua 204 tới khi có kết quả', async () => {
    const thu: string[] = [];
    let lan = 0;
    const goi = (async (u: RequestInfo | URL, init?: RequestInit) => {
      thu.push(`${init?.method ?? 'GET'} ${u}`);
      if (String(u) === '/api/tram/hoi') return jsonRes({ ma: 'abc' });
      return ++lan < 3 ? new Response(null, { status: 204 }) : jsonRes({ ma_http: 200, than: '{"type":"message"}', loai: 'application/json' });
    }) as unknown as typeof fetch;
    const r = await taoFetchTram(KHOA, goi)('/_cau/v1/messages', { method: 'POST', body: '{}' });
    expect(await r.json()).toEqual({ type: 'message' });
    expect(thu).toEqual(['POST /api/tram/hoi', 'GET /api/tram/kq?ma=abc', 'GET /api/tram/kq?ma=abc', 'GET /api/tram/kq?ma=abc']);
  });
  it('lỗi của trạm → lỗi dạng Anthropic (may_tat, ma_ghep_sai, quá câu/phút)', async () => {
    const loi = (ma: string, status: number) => taoFetchTram(KHOA, (async () => jsonRes({ loi: 'x', ma }, status)) as unknown as typeof fetch)('/_cau/v1/messages', { method: 'POST', body: '{}' }).then((r) => r.json());
    expect(await loi('may_tat', 503)).toMatchObject({ error: { type: 'may_tat' } });
    expect(await loi('sai_khoa', 401)).toMatchObject({ error: { type: 'ma_ghep_sai' } });
    expect(await loi('rate_limited', 429)).toMatchObject({ error: { type: 'rate_limit_error' } });
  });
  it('SDK Anthropic đọc được luồng qua trạm (cùng giao thức như cầu)', async () => {
    const sse = ['message_start', 'content_block_start', 'content_block_delta', 'content_block_stop', 'message_delta', 'message_stop'].map((t) => {
      const du: Record<string, unknown> = {
        message_start: { type: t, message: { id: 'm', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
        content_block_start: { type: t, index: 0, content_block: { type: 'text', text: '' } },
        content_block_delta: { type: t, index: 0, delta: { type: 'text_delta', text: 'Chào' } },
        content_block_stop: { type: t, index: 0 },
        message_delta: { type: t, delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 2 } },
        message_stop: { type: t },
      };
      return `event: ${t}\ndata: ${JSON.stringify(du[t])}\n\n`;
    }).join('');
    const goi = (async () => jsonRes({ ma_http: 200, than: sse, loai: 'text/event-stream' })) as unknown as typeof fetch;
    const khach = taoKhach({ nguon: 'cau', khoaRieng: null, maDuAn: 'd', maSua: null, qua: 'tram', maGhep: KHOA });
    expect(khach.nguon).toBe('cau');
    const c = new Anthropic({ apiKey: 'x', baseURL: 'https://u.example/_cau', fetch: taoFetchTram(KHOA, goi), maxRetries: 0, dangerouslyAllowBrowser: true });
    const m = await c.beta.messages.stream({ model: 'claude-sonnet-5-5', max_tokens: 10, messages: [{ role: 'user', content: 'chào' }] }).finalMessage();
    expect(m.content[0]).toMatchObject({ type: 'text', text: 'Chào' });
    expect(m.stop_reason).toBe('end_turn');
  });
});

describe('bộ cài .bat', () => {
  it('nhúng địa chỉ app https, CRLF, chỉ chữ không dấu, tải cả cầu và bộ cài', () => {
    const b = taoBoCaiBat('https://unitmix.leo.workers.dev/');
    expect(b).toContain('set "GOC=https://unitmix.leo.workers.dev"');
    expect(b).toContain('-Goc "%GOC%"');
    expect(b).toContain("'cau_claude.py','cai_cau_ai.ps1'");
    expect(b.split('\r\n').length).toBeGreaterThan(5);
    expect(/^[\x00-\x7F]*$/.test(b)).toBe(true);
  });
  it('địa chỉ không phải https (chạy thử trên máy) không được nhúng; ký tự lạ bị lọc', () => {
    expect(taoBoCaiBat('http://localhost:5180')).toContain('set "GOC="');
    expect(taoBoCaiBat('https://a.b/"&calc&"')).not.toMatch(/calc&/);
  });
});

describe('dán mã ghép (điện thoại)', () => {
  it('nhận cả link #ghep=… lẫn mã trần, có khoảng trắng thừa', async () => {
    const { docMaGhepTuChuoi } = await import('./cau');
    expect(docMaGhepTuChuoi(`https://u.example/#ghep=${KHOA}`)).toBe(KHOA);
    expect(docMaGhepTuChuoi(`  ${KHOA}\n`)).toBe(KHOA);
    expect(docMaGhepTuChuoi('ghep=' + KHOA)).toBe(KHOA);
    expect(docMaGhepTuChuoi('abc')).toBeNull();
    expect(docMaGhepTuChuoi('')).toBeNull();
  });
});
