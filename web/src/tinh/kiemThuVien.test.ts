/**
 * Kiểm cả thư viện mẫu (tinh/kiemThuVien.ts): 0 lỗi dữ liệu ở mọi mẫu căn / mẫu tòa; kiểm bắt đúng mẫu căn hỏng cố ý.
 */
import { describe, expect, it } from 'vitest';
import { napThuVien } from '../thu/thuVienThat';
import { kiemMauCan, kiemThuVien } from './kiemThuVien';

const { tv, dl } = napThuVien();
const c = { tv, dl };

describe('kiểm thư viện mẫu', () => {
  const kq = kiemThuVien(c);
  it('đủ mẫu căn gốc và mẫu tòa', () => {
    expect(kq.can.length).toBe(34);
    expect(kq.toa.length).toBe(33);
  });
  it('0 lỗi ở mọi mẫu căn (cảnh báo QCVN 04 / thiếu dữ liệu tuỳ chọn không tính)', () => {
    expect(kq.can.flatMap((x) => x.vi.filter((v) => v.muc === 'loi').map((v) => `${x.id}: ${v.ma} ${JSON.stringify(v.tham)}`))).toEqual([]);
  });
  it('0 lỗi ở mọi mẫu tòa', () => {
    expect(kq.toa.flatMap((x) => x.vi.filter((v) => v.muc === 'loi').map((v) => `${x.id}: ${v.ma} ${JSON.stringify(v.tham)}`))).toEqual([]);
  });
});

describe('kiểm mẫu căn — bắt hỏng cố ý', () => {
  const goc = [...tv.can.values()].find((x) => !x.stretchGoc && x.stretch)!;
  it('kích thước không khớp tên mô-đun', () => {
    expect(kiemMauCan({ ...goc, rong_mm: goc.rong_mm + 500 }, tv).map((v) => v.ma)).toContain('ten_kich_thuoc');
  });
  it('DT thông thủy lớn hơn DT tim tường', () => {
    expect(kiemMauCan({ ...goc, dt_tt_m2: goc.dt_tim_m2 + 5 }, tv).map((v) => v.ma)).toContain('dt_thong_thuy');
  });
  it('thiếu biến thể STRETCH (id lạ)', () => {
    expect(kiemMauCan({ ...goc, id: 'khong-co-bien-the' }, tv).map((v) => v.ma)).toContain('stretch');
  });
  it('loại căn sai', () => {
    expect(kiemMauCan({ ...goc, loai: 'xyz' as never }, tv).map((v) => v.ma)).toContain('khong_hop_le');
  });
  it('căn dưới 25 m² thông thủy → cảnh báo QCVN 04', () => {
    expect(kiemMauCan({ ...goc, dt_tt_m2: 20, dt_tim_m2: 22 }, tv).filter((v) => v.ma === 'qcvn04_dt').map((v) => v.muc)).toEqual(['canh_bao']);
  });
});
