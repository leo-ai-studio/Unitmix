import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { taoBoLuu, type KhoLuuTru } from './luu';
import type { TrangThaiLuu } from '../ui/ThanhTren';

function khoGia(): KhoLuuTru & { du: Map<string, string> } {
  const du = new Map<string, string>();
  return { du, getItem: (k) => du.get(k) ?? null, setItem: (k, v) => void du.set(k, v), removeItem: (k) => void du.delete(k) };
}

describe('bộ tự lưu', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sửa 5 lần trong 1 giây -> chỉ 1 lần ghi, với trạng thái mới nhất', async () => {
    const ghi = vi.fn().mockResolvedValue(undefined);
    const bo = taoBoLuu({ ghi, kho: khoGia(), khoaNhap: 'n', duocGhi: true, khiDoi: () => {} });
    for (let i = 1; i <= 5; i++) {
      bo.thayDoi({ i }, { soCan: i });
      await vi.advanceTimersByTimeAsync(200);
    }
    await vi.advanceTimersByTimeAsync(800);
    expect(ghi).toHaveBeenCalledTimes(1);
    expect(ghi).toHaveBeenCalledWith({ i: 5 }, { soCan: 5 });
  });

  it('máy chủ lỗi -> "chua_luu_duoc", bản nháp còn; lần sau lưu được thì xoá nháp', async () => {
    const kho = khoGia();
    const trangThai: TrangThaiLuu[] = [];
    const ghi = vi.fn().mockRejectedValueOnce(new Error('500')).mockResolvedValue(undefined);
    const bo = taoBoLuu({ ghi, kho, khoaNhap: 'unitmix.nhap.x.p1', duocGhi: true, khiDoi: (t) => trangThai.push(t) });
    bo.thayDoi({ a: 1 }, {});
    await vi.advanceTimersByTimeAsync(900);
    expect(trangThai.at(-1)).toBe('chua_luu_duoc');
    expect(JSON.parse(kho.du.get('unitmix.nhap.x.p1')!)).toEqual({ trangThai: { a: 1 }, tomTat: {} });
    expect(bo.layNhap()).toEqual({ trangThai: { a: 1 }, tomTat: {} });

    bo.thayDoi({ a: 2 }, {});
    await vi.advanceTimersByTimeAsync(900);
    expect(trangThai.at(-1)).toBe('da_luu');
    expect(kho.du.has('unitmix.nhap.x.p1')).toBe(false);
  });

  it('không có mã sửa -> không bao giờ gọi ghi, không tạo nháp', async () => {
    const kho = khoGia();
    const ghi = vi.fn();
    const bo = taoBoLuu({ ghi, kho, khoaNhap: 'n', duocGhi: false, khiDoi: () => {} });
    bo.thayDoi({ a: 1 }, {});
    await vi.advanceTimersByTimeAsync(2000);
    expect(ghi).not.toHaveBeenCalled();
    expect(kho.du.size).toBe(0);
  });

  it('sửa trong lúc đang ghi -> ghi tiếp bản mới sau khi bản cũ xong', async () => {
    let xong!: () => void;
    const ghi = vi.fn().mockImplementationOnce(() => new Promise<void>((r) => (xong = r))).mockResolvedValue(undefined);
    const bo = taoBoLuu({ ghi, kho: khoGia(), khoaNhap: 'n', duocGhi: true, khiDoi: () => {} });
    bo.thayDoi({ v: 1 }, {});
    await vi.advanceTimersByTimeAsync(900);
    bo.thayDoi({ v: 2 }, {});
    xong();
    await vi.advanceTimersByTimeAsync(900);
    expect(ghi).toHaveBeenCalledTimes(2);
    expect(ghi.mock.calls[1][0]).toEqual({ v: 2 });
  });
});
