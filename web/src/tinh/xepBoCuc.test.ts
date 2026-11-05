import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { napThuVien } from '../thu/thuVienThat';
import { chanToa } from './hinhHoc';
import { HE_SO_MAC_DINH, NGUONG_MAC_DINH, type ChiTieuQH, type Diem, type Lo, type TrangThaiPA } from './kieu';
import { chonSheetTheoLoai, loaiNhaCuaLo, loaiTrongTen, temTheoLoai } from './loaiNha';
import { traLuat, type BoQuyTac } from './quyTac';
import { canhChinh, goiYXepToa, kcDaGiac, type LuatXep } from './xepToa';

const { tv } = napThuVien();
const bo = JSON.parse(readFileSync(new URL('../../public/lib/quy_tac.json', import.meta.url), 'utf8')) as BoQuyTac;
const luat: LuatXep = { lo01: traLuat(bo, 'LO-01')!, lo02: traLuat(bo, 'LO-02')! };
const chiTieu: ChiTieuQH = { matDoMax: 40, matDoThapMax: null, hssddMax: 8, tangCaoMax: 25, tangDe: 1, tangCanHo: null, soCanMax: null, danSoMax: null, nguoiMoiCan: 3 } as unknown as ChiTieuQH;
const taoLo = (ranh: Diem[], chucNang: 'tm' | 'xh' = 'tm'): Lo => ({
  id: 'A', ranh, chiGioi: null, xungQuanh: [], canhDuong: ranh.map(() => 12),
  temDat: { kyHieu: 'A', chucNang, chiTieu, coCauMucTieu: { stu: 5, '1pn': 20, '2pn': 45, '2pnp': 15, '3pn': 15 } },
} as Lo);
const taoPA = (lo: Lo) => ({ phienBan: 1, lo: [lo], heSo: HE_SO_MAC_DINH, nguong: NGUONG_MAC_DINH, toa: [], ham: { soTang: 0 } } as unknown as TrangThaiPA);

/** Lô hình thang như M34 vị trí 10: hai cạnh dài lệch nhau vài độ. */
const THANG: Diem[] = [[0, 0], [150, -14], [156, 200], [8, 200]];

describe('xếp tòa theo dãy (QH M34 · M7 · Long Biên)', () => {
  const lo = taoLo(THANG), pa = taoPA(lo), ds = goiYXepToa({ pa, lo, tv, luat });

  it('trả 5–10 phương án, đủ nhiều kiểu bố cục, mặc định 10 ở lô rộng', () => {
    expect(ds.length).toBeGreaterThanOrEqual(5);
    expect(ds.length).toBeLessThanOrEqual(10);
    expect(new Set(ds.map((g) => g.kieu)).size).toBeGreaterThanOrEqual(3);
    expect(ds.every((g) => g.loiQH === 0)).toBe(true);
  });

  it('dãy tòa không phạm khoảng cách đầu hồi, không đè nhau', () => {
    for (const g of ds) {
      const F = g.toa.map((x) => chanToa(tv.toa.get(x.mauId)!, x));
      for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) expect(kcDaGiac(F[i], F[j])).toBeGreaterThan(5);
    }
  });

  it('hai dãy: tòa xoay theo cạnh lô và phương án có ít nhất 3 tòa', () => {
    const g = ds.find((x) => x.kieu === 'hai_day');
    expect(g).toBeTruthy();
    expect(g!.toa.length).toBeGreaterThanOrEqual(3);
    const canh = canhChinh(THANG).map((c) => ((c.goc % 90) + 90) % 90);
    for (const x of g!.toa) expect(canh.some((c) => Math.min(Math.abs(c - x.gocDo % 90), 90 - Math.abs(c - x.gocDo % 90)) < 0.2)).toBe(true);
  });

  it('chọn mẫu và kiểu: chỉ xếp mẫu đã chọn, chỉ giữ kiểu đã chọn', () => {
    const mau = ds[0].mau[0][0];
    const r = goiYXepToa({ pa, lo, tv, luat, chiMau: [mau], kieuBoCuc: ['hai_day'] });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((g) => g.kieu === 'hai_day' && g.mau.every(([m]) => m === mau))).toBe(true);
  });
});

describe('canhChinh', () => {
  it('gộp cạnh vát gần thẳng hàng, pháp tuyến hướng vào trong', () => {
    const c = canhChinh([[0, 0], [50, 0], [100, 2], [100, 60], [0, 60]]);
    expect(c.length).toBe(4);
    expect(c[0].dai).toBeGreaterThan(99);
    expect(c.find((x) => Math.abs(x.u[1]) < 0.1 && x.a[1] < 1)!.n[1]).toBeGreaterThan(0);
  });
});

describe('loại nhà ở', () => {
  const lo = taoLo(THANG);
  const dat = (kyHieu: string, chucNang: 'tm' | 'xh' | 'khac', taiDinhCu?: boolean) => ({ ...lo, temDat: { ...lo.temDat, kyHieu, chucNang, taiDinhCu } });
  it('nhận TĐC theo ký hiệu hoặc dấu, dấu thắng ký hiệu', () => {
    expect(loaiNhaCuaLo(dat('TDC-7.1', 'xh'))).toBe('tdc');
    expect(loaiNhaCuaLo(dat('TĐC-8.2', 'xh'))).toBe('tdc');
    expect(loaiNhaCuaLo(dat('NOXH-9.2', 'xh'))).toBe('xh');
    expect(loaiNhaCuaLo(dat('TDC-7.1', 'xh', false))).toBe('xh');
    expect(loaiNhaCuaLo(dat('A', 'khac'))).toBe(null);
    expect(temTheoLoai('tdc')).toEqual({ chucNang: 'xh', taiDinhCu: true });
  });
  it('chọn sheet Excel đúng loại', () => {
    expect(loaiTrongTen('Unitmix NOXH')).toBe('xh');
    expect(loaiTrongTen('Tái định cư')).toBe('tdc');
    const s = [{ ten: 'Tong' }, { ten: 'NOTM' }, { ten: 'TDC' }, { ten: 'Rong' }];
    expect(chonSheetTheoLoai(s, (x) => x.ten !== 'Rong', 'tdc')!.ten).toBe('TDC');
    expect(chonSheetTheoLoai(s, (x) => x.ten !== 'Rong', 'xh')!.ten).toBe('Tong');
  });
});
