import { describe, expect, it } from 'vitest';
import type { Diem } from '../tinh/kieu';
import { taoLo } from '../tinh/macDinh';
import { apChiTieu, chiaTheoTyLe, chonSheet, docBangChiTieu, ghepLo, ghepTay } from './bangChiTieu';
import type { Luoi } from './luoi';

// Dựng theo dạng bảng QH M7: tiêu đề hai hàng (ô gộp đã chép), nhóm đất có STT, dòng "Công trình…" ghi tầng.
const N = null;
const LUOI: Luoi = [
  ['Bảng thống kê chỉ tiêu', 'Bảng thống kê chỉ tiêu', 'Bảng thống kê chỉ tiêu', N, N, N, N, N, N, N, N, N, N],
  ['STT', 'Chức năng', 'Diện tích đất', 'Tỷ lệ', 'MĐXD', 'MĐXD', 'Tầng cao ', 'Tầng cao ', 'Tầng cao ', 'Tầng cao ', 'Số căn-lô', 'Dân số', 'Hệ số SDĐ'],
  ['STT', 'Chức năng', 'Diện tích đất', 'Tỷ lệ', 'Đế', 'Tháp', 'Hầm', 'Đế', 'Tháp', 'Tổng', 'Căn/lô', 'Người', 'Lần'],
  [1.1, 'Đất nhà ở xã hội cao tầng', 20000, 80, 21.6, 19.9, N, N, N, N, 600, 1200, N],
  [N, 'Công trình Nhà ở xã hội', 4000, N, N, N, 1, 1, 11, 12, N, N, 2.4],
  [N, 'Cây xanh nội khu', 1000, N, 5, N, N, 1, N, N, N, N, N],
  [1.2, 'Đất nhà ở cao tầng thương mại', 8000, 20, 47.5, 30.9, N, N, N, N, 500, 900, 8.5],
  [N, 'Công trình Nhà ở thương mại', 3000, N, N, N, 2, 2, 26, 28, N, N, N],
  [2.1, 'Đất giáo dục', 5000, N, 40, N, N, N, N, 5, N, N, 2],
];
const vuong = (x: number, a: number, b: number): Diem[] => [[x, 0], [x + a, 0], [x + a, b], [x, b]];

describe('đọc bảng chỉ tiêu QH', () => {
  const b = docBangChiTieu({ ten: '@ 261019-Chỉ tiêu', luoi: LUOI })!;
  it('nhận cột theo tiêu đề hai hàng', () => {
    expect(b.cot).toMatchObject({ stt: 0, ten: 1, dtDat: 2, matDoDe: 4, matDoThap: 5, tangHam: 6, tangDe: 7, tangThap: 8, tangCao: 9, soCan: 10, danSo: 11, hssdd: 12 });
  });
  it('dòng "Công trình…" góp tầng và HSSDĐ cho nhóm đất, không đè DT đất', () => {
    const xh = b.dong.find((d) => d.stt === '1.1')!;
    expect(xh.gt).toEqual({ dtDat: 20000, matDoDe: 21.6, matDoThap: 19.9, tangHam: 1, tangDe: 1, tangThap: 11, tangCao: 12, soCan: 600, danSo: 1200, hssdd: 2.4, cayXanh: 5 });
    expect(xh.gopTu).toEqual([5]);
    expect(b.dong.filter((d) => d.tongHop)).toEqual([]);
    const l: Luoi = [['STT', 'Chức năng', 'Diện tích đất'], ['', 'Tổng diện tích', 300], ['I', 'Đất đơn vị ở', 300], [1, 'Đất ở', 200], [1.1, 'Đất NOXH', 200], [2, 'Đất công cộng', 100], ['', 'Văn hóa', 60], ['', 'Chợ', 40]];
    expect(docBangChiTieu({ ten: 's', luoi: l })!.dong.map((d) => d.tongHop)).toEqual([true, true, true, false, true, false, false]);
    expect(xh.chucNangDoan).toBe('xh');
    expect(b.dong.filter((d) => d.noiBo).map((d) => d.ten)).toEqual(['Công trình Nhà ở xã hội', 'Cây xanh nội khu', 'Công trình Nhà ở thương mại']);
    expect(b.dong.find((d) => d.stt === '1.2')!.gt.hssdd).toBe(8.5); // nhóm đã có thì giữ
  });
  it('chọn sheet nhận nhiều cột nhất, hòa thì sheet ngày mới hơn', () => {
    const cu = { ten: '260810 - Chỉ tiêu', luoi: LUOI };
    expect(chonSheet([cu, { ten: '@ 261019-Chỉ tiêu', luoi: LUOI }, { ten: 'ghi chú', luoi: [['a']] }])!.sheet).toBe('@ 261019-Chỉ tiêu');
  });
  it('số kiểu Việt "1.234,5" và cột (ha)', () => {
    const l: Luoi = [['Ký hiệu', 'Diện tích (ha)', 'MĐXD (%)', 'Tầng cao'], ['CT-1', '1,2345', '40', 25]];
    expect(docBangChiTieu({ ten: 's', luoi: l })!.dong[0].gt).toEqual({ dtDat: 12345, matDoDe: 40, tangCao: 25 });
  });
});

describe('ghép dòng bảng với lô DXF', () => {
  const b = docBangChiTieu({ ten: 's', luoi: LUOI })!;
  // Hai lô NOXH (12.000 + 7.990 = 19.990, lệch 0,05 %), một lô TM 8.010, một lô giáo dục 5.000.
  const ds = [
    taoLo('a', 'CT-1', 'tm', vuong(0, 120, 100)),
    taoLo('b', 'CT-2', 'tm', vuong(200, 79.9, 100)),
    taoLo('c', 'HH-1', 'tm', vuong(400, 80.1, 100)),
    taoLo('d', 'GD-1', 'khac', vuong(600, 50, 100)),
    taoLo('e', 'CX-9', 'khac', vuong(800, 10, 10)),
  ];
  const kq = ghepLo(b, ds);
  const theo = (stt: string) => kq.ghep.find((g) => g.dong === b.dong.find((d) => d.stt === stt)!.dong)!;
  it('nhóm NOXH = hai lô CT, TM = một lô theo DT, giáo dục theo DT', () => {
    expect(theo('1.1')).toMatchObject({ loIds: ['a', 'b'], cach: 'nhom' });
    expect(theo('1.1').lechPct).toBeCloseTo(-0.05, 2);
    expect(theo('1.2')).toMatchObject({ loIds: ['c'], cach: 'dien_tich' });
    expect(theo('2.1')).toMatchObject({ loIds: ['d'], cach: 'dien_tich' });
    expect(kq.loChuaGhep).toEqual(['e']);
  });
  it('ký hiệu trùng thì ghép theo ký hiệu dù DT lệch', () => {
    const l: Luoi = [['Ký hiệu', 'Diện tích', 'Tầng cao'], ['CT-01', 999, 9]];
    const bb = docBangChiTieu({ ten: 's', luoi: l })!;
    expect(ghepLo(bb, ds).ghep[0]).toMatchObject({ loIds: ['a'], cach: 'ky_hieu' });
  });
  it('áp chỉ tiêu: chia dân số, số căn theo DT; đổi chức năng; giữ MĐXD, tầng', () => {
    const moi = apChiTieu(ds, b, kq, 'm7.xlsx');
    const [a, bb, c] = moi;
    expect(a.temDat.chucNang).toBe('xh');
    expect(a.temDat.chiTieu).toMatchObject({ matDoMax: 21.6, matDoThapMax: 19.9, hssddMax: 2.4, cayXanhMin: 5, tangHam: 1, tangDe: 1, tangCanHo: 11, tangCaoMax: 12, nguoiMoiCan: 2 });
    expect(a.temDat.chiTieu.danSoMax + bb.temDat.chiTieu.danSoMax).toBe(1200);
    expect(a.temDat.chiTieu.soCanMax! + bb.temDat.chiTieu.soCanMax!).toBe(600);
    expect(a.temDat.chiTieu.soCanMax).toBe(360); // 600 × 12.000 / 19.990
    expect(c.temDat).toMatchObject({ chucNang: 'tm', chiTieu: { tangDe: 2, tangCanHo: 26, tangCaoMax: 28, soCanMax: 500 } });
    expect(a.temDat.nguonChiTieu).toEqual({ tep: 'm7.xlsx', sheet: 's', dong: 4, ten: 'Đất nhà ở xã hội cao tầng', dtBang: 20000, soLo: 2 });
    expect(moi[4]).toBe(ds[4]);
  });
  it('ghép tay chuyển lô sang dòng khác và tính lại lệch', () => {
    const k2 = ghepTay(kq, b, ds, 'b', b.dong.find((d) => d.stt === '1.2')!.dong);
    expect(k2.ghep.find((g) => g.loIds.includes('b'))!.loIds).toEqual(['c', 'b']);
    expect(k2.ghep.find((g) => g.loIds.includes('a'))!).toMatchObject({ loIds: ['a'], cach: 'tay' });
    expect(ghepTay(k2, b, ds, 'e', null).loChuaGhep).toEqual(['e']);
  });
});

it('chia theo tỷ lệ giữ đúng tổng', () => {
  expect(chiaTheoTyLe(10, [1, 1, 1])).toEqual([4, 3, 3]);
  expect(chiaTheoTyLe(5396, [49152, 36978])).toEqual([3079, 2317]);
});
