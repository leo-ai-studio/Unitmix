import Anthropic from '@anthropic-ai/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cauDungDuoc, chonNguon, kiemCau } from './cau';
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
    expect(c).toEqual({ ok: true, dangNhap: true, taiKhoan: 'a@b.c · max', phienBan: '2.1' });
    expect(cauDungDuoc(c)).toBe(true);
  });
  it('chưa đăng nhập → không dùng được; chưa rõ → vẫn thử', async () => {
    expect(cauDungDuoc(await kiemCau('http://x', 500, traLoi({ ok: true, dang_nhap: false })))).toBe(false);
    expect(cauDungDuoc(await kiemCau('http://x', 500, traLoi({ ok: true, dang_nhap: null })))).toBe(true);
    expect(cauDungDuoc({ ok: false, dangNhap: null, taiKhoan: '', phienBan: null })).toBe(false);
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
