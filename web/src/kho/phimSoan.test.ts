import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { taoBoLuu, type KhoLuuTru } from './luu';
import { dangGo, lenhTuPhim } from './phimSoan';

const phim = (key: string, o: { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean; target?: unknown } = {}) =>
  lenhTuPhim({ key, ctrlKey: !!o.ctrl, metaKey: !!o.meta, shiftKey: !!o.shift, altKey: !!o.alt, target: (o.target ?? null) as EventTarget | null });
const the = (tagName: string, isContentEditable = false) => ({ tagName, isContentEditable }) as unknown as EventTarget;

describe('phím tắt trình soạn', () => {
  it('Ctrl+Z hoàn tác, Ctrl+Y / Ctrl+Shift+Z làm lại, Ctrl+S lưu (Cmd trên Mac)', () => {
    expect(phim('z', { ctrl: true })).toBe('hoanTac');
    expect(phim('Z', { ctrl: true, shift: true })).toBe('lamLai');
    expect(phim('y', { ctrl: true })).toBe('lamLai');
    expect(phim('s', { ctrl: true })).toBe('luu');
    expect(phim('z', { meta: true })).toBe('hoanTac');
  });

  it('không có Ctrl, có Alt, hoặc phím khác: bỏ qua', () => {
    expect(phim('z')).toBeNull();
    expect(phim('z', { ctrl: true, alt: true })).toBeNull();
    expect(phim('d', { ctrl: true })).toBeNull();
    expect(phim('y', { ctrl: true, shift: true })).toBeNull();
  });

  it('đang gõ trong ô nhập: để trình duyệt tự hoàn tác chữ, riêng Ctrl+S vẫn lưu', () => {
    for (const t of [the('INPUT'), the('TEXTAREA'), the('SELECT'), the('DIV', true)]) {
      expect(dangGo(t)).toBe(true);
      expect(phim('z', { ctrl: true, target: t })).toBeNull();
      expect(phim('y', { ctrl: true, target: t })).toBeNull();
      expect(phim('s', { ctrl: true, target: t })).toBe('luu');
    }
    expect(dangGo(the('BUTTON'))).toBe(false);
    expect(dangGo(null)).toBe(false);
  });
});

function khoGia(): KhoLuuTru {
  const du = new Map<string, string>();
  return { getItem: (k) => du.get(k) ?? null, setItem: (k, v) => void du.set(k, v), removeItem: (k) => void du.delete(k) };
}

describe('lưu ngay (Ctrl+S) và cảnh báo đóng tab', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('luuNgay ghi ngay, không chờ 800 ms; xong thì hết "chưa lưu"', async () => {
    const ghi = vi.fn().mockResolvedValue(undefined);
    const bo = taoBoLuu({ ghi, kho: khoGia(), khoaNhap: 'n', duocGhi: true, khiDoi: () => {} });
    expect(bo.conChuaLuu()).toBe(false);
    bo.thayDoi({ a: 1 }, {});
    expect(bo.conChuaLuu()).toBe(true);
    await bo.luuNgay();
    expect(ghi).toHaveBeenCalledTimes(1);
    expect(bo.conChuaLuu()).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(ghi).toHaveBeenCalledTimes(1); // hẹn debounce đã huỷ
  });

  it('ghi lỗi: vẫn "chưa lưu"; Ctrl+S gửi lại bản lỗi', async () => {
    const ghi = vi.fn().mockRejectedValueOnce(new Error('500')).mockResolvedValue(undefined);
    const bo = taoBoLuu({ ghi, kho: khoGia(), khoaNhap: 'n', duocGhi: true, khiDoi: () => {} });
    bo.thayDoi({ a: 1 }, {});
    await vi.advanceTimersByTimeAsync(900);
    expect(bo.conChuaLuu()).toBe(true);
    await bo.luuNgay();
    expect(ghi).toHaveBeenLastCalledWith({ a: 1 }, {});
    expect(bo.conChuaLuu()).toBe(false);
  });

  it('không có quyền sửa: không ghi, không cảnh báo', async () => {
    const ghi = vi.fn();
    const bo = taoBoLuu({ ghi, kho: khoGia(), khoaNhap: 'n', duocGhi: false, khiDoi: () => {} });
    bo.thayDoi({ a: 1 }, {});
    await bo.luuNgay();
    expect(ghi).not.toHaveBeenCalled();
    expect(bo.conChuaLuu()).toBe(false);
  });
});
