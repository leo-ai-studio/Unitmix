import { describe, expect, it } from 'vitest';
import { tinhChiTieu } from './chiTieu';
import { danSoDuAn, danSoLo, khuVucKhai, nguoiMotCan, quyTacApDung, traBang } from './danSo';
import {
  HE_SO_MAC_DINH, NGUONG_MAC_DINH, taoThuVien,
  type CanMau, type ChiTieuQH, type KhaiDanSo, type Lo, type ToaDat, type ToaMau, type TrangThaiPA,
} from './kieu';
import { chuanHoaPA } from './macDinh';
import {
  coPhanBietKhuVuc, dsTinhChon, FALLBACK_QG, FALLBACK_QG_LH, QUY_TAC_DAN_SO, SO_PHONG_O, theoKhuVuc, timQuyTac,
  type BangDanSo, type PhuongPhap,
} from './quyTacDanSo';

const can = (id: string, loai: CanMau['loai'], dt: number, nhom: 'tm' | 'xh' = 'tm'): CanMau =>
  ({ id, ma_goc: id, nhom, loai, vi_tri: 'giua', vi_tri_ma: 'm1', sau_mm: 8500, rong_mm: 7000, ten_vi: id, ten_en: id, dt_tt_m2: dt, dt_tim_m2: dt + 4 });
// 1 tầng: 2 căn 2PN 68 m² + 1 căn 1PN 45 m² + 1 căn 3PN 101 m²
const canGia = [can('c2', '2pn', 68), can('c1', '1pn', 45), can('c3', '3pn', 101)];
const toaGia: ToaMau = {
  id: 'm', ma_goc: 'm', nhom: 'tm', hinh: 'i', so: 9, ten_vi: '', ten_en: '', so_can_tang: 4, dtxd_m2: 400,
  hanh_lang_mm: 1800, sau_can_mm: 8500, duong_bao: [[0, 0], [20000, 0], [20000, 20000], [0, 20000]],
  co_cau: { c2: 2, c1: 1, c3: 1 }, loi: [],
};
const tv = taoThuVien([toaGia], canGia);
const chiTieu: ChiTieuQH = { matDoMax: 40, matDoThapMax: null, hssddMax: 5, tangCaoMax: 40, tangDe: null, tangCanHo: null, tangHam: null, danSoMax: 100, soCanMax: null, nguoiMoiCan: 3.5, choDoOtoMoiCan: 1, choXeMayMoiCan: 2, cayXanhMin: 20 };
const lo = (danSo?: KhaiDanSo, chucNang: 'tm' | 'xh' = 'tm'): Lo => ({
  id: 'A', ranh: [[0, 0], [100, 0], [100, 100], [0, 100]], chiGioi: null, xungQuanh: [],
  temDat: { kyHieu: 'CC', chucNang, chiTieu, coCauMucTieu: { stu: 0, '1pn': 25, '2pn': 50, '2pnp': 0, '3pn': 25 }, ...(danSo ? { danSo } : {}) },
});
const toa = (id: string, soTangDH: number): ToaDat => ({ id, loId: 'A', mauId: 'm', x: 50, y: 50, gocDo: 0, soTangDH, soTangDe: 0, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {} });
const pa = (l: Lo, ts: ToaDat[] = [toa('T1', 10)]): TrangThaiPA => ({
  phienBan: 1, lo: [l], heSo: HE_SO_MAC_DINH, nguong: NGUONG_MAC_DINH, toa: ts,
  ham: { soTang: 0, ranh: null, nhip: 8.4, rongLan: 6, choDai: 5, choRong: 2.5, dtKho: 6 },
});

const bang = (moc: BangDanSo['moc'], dieu = 'x'): BangDanSo => ({ moc, dtMin: 25, dieu });
const BANG_A: PhuongPhap = {
  kieu: 'bang',
  bang: { notm: bang([{ den: 50, nguoi: 1 }, { den: Infinity, nguoi: 3 }]), noxh: bang([{ den: Infinity, nguoi: 2 }]), tdc: bang([{ den: Infinity, nguoi: 4 }]) },
};

describe('bảng thang diện tích — mốc biên', () => {
  const hn = timQuyTac('hn')!.phuongPhap!.cp;
  const hcm = timQuyTac('hcm')!.phuongPhap!.cp;
  it('Hà Nội NOTM: 45 → 1, 45,01 → 2, 70 → 2, 100 → 3, 125 → 4, 125,5 → 5', () => {
    expect([45, 45.01, 70, 100, 125, 125.5].map((dt) => nguoiMotCan(dt, 'notm', hn).nguoi)).toEqual([1, 2, 2, 3, 4, 5]);
  });
  it('Hà Nội NOXH: 40 → 1, 55 → 2, 77 → 4; 80 ngoài bảng → 4 + cờ trên', () => {
    expect([40, 40.5, 55, 77].map((dt) => nguoiMotCan(dt, 'noxh', hn).nguoi)).toEqual([1, 2, 2, 4]);
    expect(nguoiMotCan(80, 'noxh', hn)).toMatchObject({ nguoi: 4, ngoaiBang: 'tren' });
  });
  it('TP.HCM QĐ 32 NOTM (≤): 32 → 1, 56 → 2, 64 → 2, 96 → 3, 160 → 5, 161 → 6', () => {
    expect([32, 32.1, 56, 64, 96, 128, 160, 161].map((dt) => nguoiMotCan(dt, 'notm', hcm).nguoi)).toEqual([1, 2, 2, 2, 3, 4, 5, 6]);
  });
  it('TP.HCM QĐ 32 NOXH / TĐC ("đến dưới"): 32 → 1, 44,9 → 1,5, 45 → 2, 55 → 2,5, 70 → 3', () => {
    expect([32, 44.9, 45, 54.99, 55, 70, 74.9].map((dt) => nguoiMotCan(dt, 'noxh', hcm).nguoi)).toEqual([1, 1.5, 2, 2, 2.5, 3, 3]);
    expect(nguoiMotCan(45, 'tdc', hcm).nguoi).toBe(2);
  });
  it('dưới 25 m² → dòng đầu + cờ dưới (QCVN 04:2021 2.2.4.1)', () => {
    expect(traBang(bang([{ den: 50, nguoi: 1 }]), 20)).toMatchObject({ nguoi: 1, ngoaiBang: 'duoi' });
  });
});

describe('5 kiểu quyết định A–E', () => {
  it('A — tách đủ 3 bảng: NOTM / NOXH / TĐC khác nhau', () => {
    expect(['notm', 'noxh', 'tdc'].map((lh) => nguoiMotCan(80, lh as 'notm', BANG_A).nguoi)).toEqual([3, 2, 4]);
  });
  it('B — TP.HCM: TĐC dùng chung bảng NOXH, NOTM riêng', () => {
    const pp = timQuyTac('hcm')!.phuongPhap!.cp;
    expect(timQuyTac('hcm')!.kieu).toBe('B');
    expect(nguoiMotCan(60, 'tdc', pp).nguoi).toBe(nguoiMotCan(60, 'noxh', pp).nguoi);
    expect(nguoiMotCan(60, 'notm', pp).nguoi).toBe(2);
    expect(nguoiMotCan(60, 'noxh', pp).nguoi).toBe(2.5);
  });
  it('C — Hà Nội: NOTM, NOXH theo QĐ 34/2024 Điều 4 khoản 1, 2; TĐC QĐ không quy định → mặc định quốc gia S / 32', () => {
    const q = quyTacApDung(lo({ tinh: 'hn', giaiDoan: 'cp' }))!;
    expect(timQuyTac('hn')!.kieu).toBe('C');
    expect(q.theoLoaiHinh.notm.rieng && q.theoLoaiHinh.noxh.rieng).toBe(true);
    expect(q.theoLoaiHinh.tdc).toMatchObject({ rieng: false, pp: FALLBACK_QG_LH });
    expect(nguoiMotCan(76, 'notm', q.theoLoaiHinh.notm.pp).nguoi).toBe(3);
    expect(nguoiMotCan(76, 'noxh', q.theoLoaiHinh.noxh.pp).nguoi).toBe(4);
    expect(nguoiMotCan(76, 'tdc', q.theoLoaiHinh.tdc.pp).nguoi).toBeCloseTo(76 / 32); // 2,375
  });
  it('D — một bảng chung cho mọi loại hình', () => {
    const pp: PhuongPhap = { kieu: 'bang', bang: { chung: bang([{ den: 60, nguoi: 2 }, { den: Infinity, nguoi: 3 }]) } };
    expect(['notm', 'noxh', 'tdc'].map((lh) => nguoiMotCan(70, lh as 'notm', pp).nguoi)).toEqual([3, 3, 3]);
  });
  it('E — công thức P = S / S_tb, số thực không làm tròn', () => {
    const pp = timQuyTac('py')!.phuongPhap!.cp;
    expect(timQuyTac('py')!.kieu).toBe('E');
    expect(nguoiMotCan(80, 'notm', pp).nguoi).toBeCloseTo(2.5);
    expect(nguoiMotCan(70, 'noxh', pp).nguoi).toBeCloseTo(70 / 32);
  });
  it('TP.HCM QĐ 83/2026: ≤ 45 → 1; 64 → 2; NOTM > 160 → 5; NOXH 200 → 6,25', () => {
    const pp = timQuyTac('hcm83')!.phuongPhap!.cp;
    expect(nguoiMotCan(45, 'notm', pp).nguoi).toBe(1);
    expect(nguoiMotCan(64, 'notm', pp).nguoi).toBeCloseTo(2);
    expect(nguoiMotCan(170, 'notm', pp).nguoi).toBe(5);
    expect(nguoiMotCan(200, 'noxh', pp).nguoi).toBeCloseTo(6.25);
  });
  it('TP.HCM giai đoạn quy hoạch: P = S / 32 (QĐ 32/2025 Điều 4 khoản 1)', () => {
    expect(nguoiMotCan(64, 'notm', timQuyTac('hcm')!.phuongPhap!.qh).nguoi).toBeCloseTo(2);
  });
});

describe('Hải Dương QĐ 11/2024 · Đồng Nai QĐ 09/2025 (đối chiếu toàn văn vbpl.vn)', () => {
  it('Hải Dương Điều 3 khoản 2: 45 → 1, 45,01 → 2, 80 → 2, 100 → 3, 120 → 3, 150 → 4, 180 → 5, 181 → 6; NOXH, TĐC cùng bảng', () => {
    const pp = timQuyTac('hd')!.phuongPhap!.cp;
    expect([45, 45.01, 80, 100, 120, 150, 180, 181].map((dt) => nguoiMotCan(dt, 'notm', pp).nguoi)).toEqual([1, 2, 2, 3, 3, 4, 5, 6]);
    expect(nguoiMotCan(100, 'noxh', pp).nguoi).toBe(3);
    const q = quyTacApDung(lo({ tinh: 'hd', giaiDoan: 'cp' }))!;
    expect(q).toMatchObject({ fallback: false, tam: false, bq: null }); // 3,0 người/hộ chỉ ở giai đoạn lập quy hoạch
    expect(q.theoLoaiHinh.tdc.rieng).toBe(true);
  });
  it('Hải Dương lập quy hoạch (khoản 1): 71 m² / 35,5 = 2 người; bình quân 3,0 người/hộ', () => {
    const q = quyTacApDung(lo({ tinh: 'hd', giaiDoan: 'qh' }))!;
    expect(nguoiMotCan(71, 'notm', q.pp).nguoi).toBeCloseTo(2);
    expect(q.bq?.so).toBe(3);
  });
  it('Hải Dương lô cấp phép: 10 × (2×68→2 + 45→1 + 101→3) = 80', () => {
    const p = pa(lo({ tinh: 'hd', giaiDoan: 'cp' }));
    expect(danSoLo(p, p.lo[0], tv).tong).toBe(80);
  });
  it('Đồng Nai Điều 4 khoản 3: cùng DT, khác số phòng ở → khác số người', () => {
    const pp = timQuyTac('dnai')!.phuongPhap!.cp;
    const n = (dt: number, l: CanMau['loai']) => nguoiMotCan(dt, 'notm', pp, l).nguoi;
    // 2PN+ = 3 phòng ở (QCVN 04:2021 1.4.21) → 130 m² cột 03 phòng ở = 5
    expect([n(40, '1pn'), n(60, '1pn'), n(60, '2pn'), n(85, '2pn'), n(85, '3pn'), n(110, '3pn'), n(130, '3pn'), n(125, '2pn'), n(130, '2pnp')])
      .toEqual([1.5, 2, 2.5, 3, 3.5, 4, 5, 3.5, 5]);
    // 1 phòng ở chỉ tới 70 m² → khoản 4 theo DT: cột gần nhất chứa 80 m² là 02 phòng ở (trên 70–100 → 3,0)
    expect(nguoiMotCan(80, 'noxh', pp, '1pn')).toMatchObject({ nguoi: 3, ngoaiBang: null, dieu: expect.stringMatching(/khoản 4/) });
  });
  it('Đồng Nai lô cấp phép: 10 × (2×68→2,5 + 45 1PN→1,5 + 101 3PN→4) = 105; lập quy hoạch 62 / 31 = 2', () => {
    const p = pa(lo({ tinh: 'dnai', giaiDoan: 'cp' }));
    const k = danSoLo(p, p.lo[0], tv);
    expect(k.tong).toBeCloseTo(105);
    expect(k.phuongPhap).toBe('bangPhong');
    expect(nguoiMotCan(62, 'notm', timQuyTac('dnai')!.phuongPhap!.qh).nguoi).toBeCloseTo(2);
    expect(quyTacApDung(lo({ tinh: 'dnai', giaiDoan: 'qh' }))!.bq?.so).toBe(3.53);
  });
});

describe('fallback và tỉnh chưa có trị số', () => {
  it('tỉnh chưa có QĐ → P = S / 32, không gắn cờ tạm', () => {
    const q = quyTacApDung(lo({ tinh: 'khac', giaiDoan: 'cp' }))!;
    expect(q).toMatchObject({ fallback: true, tam: false });
    expect(nguoiMotCan(96, 'notm', q.pp).nguoi).toBeCloseTo(3);
  });
  it('tỉnh chưa có QĐ → mọi loại hình theo mặc định quốc gia, không "theo QĐ tỉnh"', () => {
    const q = quyTacApDung(lo({ tinh: 'khac', giaiDoan: 'cp' }))!;
    for (const lh of ['notm', 'noxh', 'tdc'] as const) expect(q.theoLoaiHinh[lh]).toMatchObject({ rieng: false, pp: FALLBACK_QG });
  });
  it('Phú Yên: QĐ 05/2025 có công thức nhưng không ghi S_tb → không fallback, vẫn cờ tạm', () => {
    expect(quyTacApDung(lo({ tinh: 'py', giaiDoan: 'cp' }))).toMatchObject({ fallback: false, tam: true });
    expect(timQuyTac('py')!.phuongPhap!.cp).toMatchObject({ kieu: 'sTb', tam: true, dieu: expect.stringMatching(/Điều 4/) });
  });
  it('Bà Rịa – Vũng Tàu cũ → quy tắc TP.HCM (QĐ 43/2023 hết hiệu lực theo QĐ 32/2025 Điều 2)', () => {
    const q = quyTacApDung(lo({ tinh: 'brvt', giaiDoan: 'cp' }))!;
    expect(q.ap?.id).toBe('hcm');
    expect(q.fallback).toBe(false);
  });
  it('mỗi tỉnh có QĐ đều ghi số hiệu; tỉnh có bảng ghi điều khoản từng bảng', () => {
    for (const q of QUY_TAC_DAN_SO) {
      if (q.phuongPhap || q.theo) expect(q.qd).toBeTruthy();
      for (const pp of Object.values(q.phuongPhap ?? {})) {
        if (pp.kieu === 'bang') for (const b of Object.values(pp.bang)) expect(b!.dieu).toMatch(/QĐ/);
        else if (pp.kieu === 'bangPhong') for (const b of Object.values(pp.phong)) expect(b.dieu).toMatch(/QĐ.*Điều/);
        else expect(pp.dieu).toMatch(/QĐ/);
      }
    }
  });
});

describe('dân số từng căn → loại, tòa, lô, dự án', () => {
  it('PA cũ chưa khai: giữ số căn × người/căn, chiTieu không đổi', () => {
    const p = pa(lo());
    const k = danSoLo(p, p.lo[0], tv);
    expect(k.coKhai).toBe(false);
    expect(k.phuongPhap).toBe('heSoChung');
    expect(k.tong).toBeCloseTo(40 * 3.5);
    expect(tinhChiTieu(p, tv).theoLo.A.dong.find((d) => d.khoa === 'danSo')!.dat).toBeCloseTo(140);
    // chuẩn hoá PA cũ không tự thêm khai báo
    expect(chuanHoaPA(p).lo[0].temDat.danSo).toBeUndefined();
  });
  it('Hà Nội NOTM cấp phép: 10 tầng × (2×68→2 + 45→1 + 101→4) = 90 người', () => {
    const p = pa(lo({ tinh: 'hn', giaiDoan: 'cp' }));
    const k = danSoLo(p, p.lo[0], tv);
    expect(k.soCan).toBe(40);
    expect(k.tong).toBe(90);
    expect(k.theoLoai['2pn']).toMatchObject({ so: 20, nguoi: 40, dtMin: 68, dtMax: 68 });
    expect(k.theoLoai['3pn'].nguoi).toBe(40);
    expect(k.dong.map((d) => d.canId)).toEqual(['c1', 'c2', 'c3']);
    expect(k.canCu[0]).toMatch(/QĐ 34\/2024/);
    const ct = tinhChiTieu(p, tv);
    expect(ct.theoLo.A.dong.find((d) => d.khoa === 'danSo')!.dat).toBe(90);
    expect(ct.tong.danSo).toBe(90);
  });
  it('cộng theo tòa và toàn dự án', () => {
    const p = pa(lo({ tinh: 'hn', giaiDoan: 'cp' }), [toa('T1', 10), toa('T2', 5)]);
    const k = danSoLo(p, p.lo[0], tv);
    expect(k.theoToa.T1.nguoi).toBe(90);
    expect(k.theoToa.T2.nguoi).toBe(45);
    expect(danSoDuAn(p, tv).tong).toBe(135);
  });
  it('Hà Nội lô NOXH tự lấy bảng NOXH (Điều 4 khoản 2): 10 × (2×68→3 + 45→2 + 101→4 ngoài bảng) = 120', () => {
    const p = pa(lo({ tinh: 'hn', giaiDoan: 'cp' }, 'xh'));
    const k = danSoLo(p, p.lo[0], tv);
    expect(k.dong.every((d) => d.loaiHinh === 'noxh')).toBe(true);
    expect(k.tong).toBe(120);
    expect(k.soNgoaiBang).toBe(10);
    expect(k.theoLoaiHinh.noxh).toMatchObject({ so: 40, nguoi: 120, phuongPhap: 'bang', rieng: true });
    expect(k.theoLoaiHinh.noxh!.dieu[0]).toMatch(/Điều 4 khoản 2/);
  });
  it('Hà Nội khai TĐC → mặc định quốc gia: 10 × (2×68 + 45 + 101) / 32 = 88,125', () => {
    const p = pa(lo({ tinh: 'hn', giaiDoan: 'cp', loaiHinh: 'tdc' }, 'xh'));
    const k = danSoLo(p, p.lo[0], tv);
    expect(k.tong).toBeCloseTo(88.125);
    expect(k.theoLoaiHinh.tdc).toMatchObject({ so: 40, phuongPhap: 'sTb', rieng: false });
    expect(k.theoLoaiHinh.tdc!.dieu[0]).toMatch(/2161.*mặc định quốc gia/);
  });
  it('Hà Nội bình quân 3,6 chỉ cho nhà ở thương mại: khai NOXH + cách bq vẫn tra bảng NOXH', () => {
    const p = pa(lo({ tinh: 'hn', giaiDoan: 'cp', cach: 'bq', loaiHinh: 'noxh' }));
    const k = danSoLo(p, p.lo[0], tv);
    expect(k.tong).toBe(120);
    expect(k.dong.every((d) => d.phuongPhap === 'bang')).toBe(true);
  });
  it('cách bình quân người / căn của QĐ (Hà Nội 3,6)', () => {
    const p = pa(lo({ tinh: 'hn', giaiDoan: 'cp', cach: 'bq' }));
    const k = danSoLo(p, p.lo[0], tv);
    expect(k.phuongPhap).toBe('bq');
    expect(k.tong).toBeCloseTo(144);
  });
});

// Lô giả: 10 tầng × (2 × 68 + 45 + 101) = 2.820 m² DT sử dụng, 40 căn (2PN 68 ×20, 1PN 45 ×10, 3PN 101 ×10)
describe('Đồng Nai QĐ 09/2025 — phòng ở (QCVN 04:2021 1.4.21) và mốc biên theo lời văn điểm a–d', () => {
  const pp = timQuyTac('dnai')!.phuongPhap!.cp;
  const n = (dt: number, l: CanMau['loai']) => nguoiMotCan(dt, 'notm', pp, l).nguoi;
  it('số phòng ở: Studio, 1PN → 1 · 2PN → 2 · 2PN+ → 3 · 3PN → 3', () => {
    expect(SO_PHONG_O).toEqual({ stu: 1, '1pn': 1, '2pn': 2, '2pnp': 3, '3pn': 3 });
  });
  it('2PN+ khác 2PN cùng DT: 85 m² → 3,5 (03 phòng ở, điểm c) vs 3,0 (02 phòng ở, điểm b); căn cứ ghi QCVN 04 1.4.21', () => {
    expect(n(85, '2pnp')).toBe(3.5);
    expect(n(85, '2pn')).toBe(3);
    expect(nguoiMotCan(85, 'notm', pp, '2pnp').dieu).toMatch(/điểm c.*QCVN 04:2021\/BXD 1\.4\.21/);
  });
  it('2PN+ nhỏ 68 m² không có trong cột 03 phòng ở (từ trên 70) → khoản 4 theo DT: cột 02 phòng ở = 2,5', () => {
    expect(nguoiMotCan(68, 'notm', pp, '2pnp')).toMatchObject({ nguoi: 2.5, ngoaiBang: null, dieu: expect.stringMatching(/điểm b.*khoản 4/) });
  });
  it('mốc trên lấy, mốc "từ trên" không lấy: 2PN 125 → 3,5 · 125,01 → 4,5 · 3PN 125 → 4 · 3PN 100 → 3,5', () => {
    expect([n(125, '2pn'), n(125.01, '2pn'), n(125, '3pn'), n(100, '3pn')]).toEqual([3.5, 4.5, 4, 3.5]);
  });
  it('đúng mốc dưới "từ trên": 2PN 45 m² → ngoài điểm b → khoản 4: cột 01 phòng ở (25–45) = 1,5; 45,01 → 2,5', () => {
    expect([n(45, '2pn'), n(45.01, '2pn')]).toEqual([1.5, 2.5]);
  });
  it('3PN 70 m² → ngoài điểm c (từ trên 70) → khoản 4: cột gần nhất chứa 70 là 02 phòng ở = 2,5', () => {
    expect(n(70, '3pn')).toBe(2.5);
  });
  it('NOXH / TĐC cùng bảng (QĐ không phân biệt loại hình): 2PN+ 85 m² → 3,5 cho cả ba loại hình', () => {
    expect((['notm', 'noxh', 'tdc'] as const).map((lh) => nguoiMotCan(85, lh, pp, '2pnp').nguoi)).toEqual([3.5, 3.5, 3.5]);
  });
});

describe('khu vực đô thị / nông thôn (Đồng Nai QĐ 09/2025 Điều 4 khoản 1: 31,0 / 28,5 m² sàn/người)', () => {
  it('PA cũ không có khuVuc → đô thị; giai đoạn quy hoạch có phân biệt → S_tb 31', () => {
    const l = lo({ tinh: 'dnai', giaiDoan: 'qh' });
    expect(khuVucKhai(l)).toBe('doThi');
    expect(quyTacApDung(l)!.khuVuc).toEqual({ ap: 'doThi', phanBiet: true, sTb: 31 });
    // chuẩn hoá PA cũ không tự thêm trường
    expect(chuanHoaPA(pa(l)).lo[0].temDat.danSo!.khuVuc).toBeUndefined();
  });
  it('đô thị: 2.820 / 31 = 90,97 người · nông thôn: 2.820 / 28,5 = 98,95 người', () => {
    const pDo = pa(lo({ tinh: 'dnai', giaiDoan: 'qh', khuVuc: 'doThi' }));
    const pNong = pa(lo({ tinh: 'dnai', giaiDoan: 'qh', khuVuc: 'nongThon' }));
    expect(danSoLo(pDo, pDo.lo[0], tv).tong).toBeCloseTo(2820 / 31, 6);
    const k = danSoLo(pNong, pNong.lo[0], tv);
    expect(k.tong).toBeCloseTo(2820 / 28.5, 6);
    expect(k.quyTac!.khuVuc).toEqual({ ap: 'nongThon', phanBiet: true, sTb: 28.5 });
    expect(k.canCu[0]).toMatch(/28,5.*nông thôn/);
  });
  it('NOXH, TĐC cũng theo khu vực (QĐ không phân biệt loại hình): căn 57 m² nông thôn → 2 người', () => {
    const q = quyTacApDung(lo({ tinh: 'dnai', giaiDoan: 'qh', khuVuc: 'nongThon' }))!;
    for (const lh of ['notm', 'noxh', 'tdc'] as const) expect(nguoiMotCan(57, lh, q.theoLoaiHinh[lh].pp).nguoi).toBeCloseTo(2);
  });
  it('giai đoạn cấp phép (bảng số phòng) và tỉnh không phân biệt → không hiện ô, khai nông thôn không đổi kết quả', () => {
    expect(quyTacApDung(lo({ tinh: 'dnai', giaiDoan: 'cp', khuVuc: 'nongThon' }))!.khuVuc.phanBiet).toBe(false);
    const p = pa(lo({ tinh: 'hn', giaiDoan: 'cp', khuVuc: 'nongThon' }));
    expect(danSoLo(p, p.lo[0], tv).tong).toBe(90);
    expect(QUY_TAC_DAN_SO.filter((q) => Object.values(q.phuongPhap ?? {}).some(coPhanBietKhuVuc)).map((q) => q.id)).toEqual(['dnai']);
  });
  it('theoKhuVuc giữ cờ tạm; S_tb không có trị số nông thôn thì giữ nguyên', () => {
    const tam: PhuongPhap = { kieu: 'sTb', sTb: 30, dieu: 'QĐ x', tam: true, nongThon: { sTb: 25, dieu: 'QĐ x nt' } };
    expect(theoKhuVuc(tam, 'nongThon')).toEqual({ kieu: 'sTb', sTb: 25, dieu: 'QĐ x nt', tam: true });
    expect(theoKhuVuc(FALLBACK_QG, 'nongThon')).toBe(FALLBACK_QG);
  });
});

describe('tỉnh trọng điểm sau sáp nhập: An Giang (gồm Kiên Giang, Phú Quốc), Hưng Yên (gồm Thái Bình) — chưa có QĐ', () => {
  for (const id of ['ag', 'hy']) {
    it(`${id}: mọi loại hình theo mặc định quốc gia S / 32, không cờ tạm, đã rà (daDoiChieu)`, () => {
      const qt = timQuyTac(id)!;
      expect(qt).toMatchObject({ qd: null, phuongPhap: null, daDoiChieu: true, trongDiem: true });
      expect(qt.ghiChu).toMatch(/29\/10\/2026/);
      const q = quyTacApDung(lo({ tinh: id, giaiDoan: 'cp' }))!;
      expect(q).toMatchObject({ fallback: true, tam: false, bq: null });
      for (const lh of ['notm', 'noxh', 'tdc'] as const) {
        expect(q.theoLoaiHinh[lh]).toMatchObject({ rieng: false, pp: FALLBACK_QG });
        expect(nguoiMotCan(96, lh, q.theoLoaiHinh[lh].pp).nguoi).toBeCloseTo(3); // 96 / 32
      }
    });
    it(`${id}: lô NOTM / NOXH / TĐC = 2.820 / 32 = 88,125 người, căn cứ QĐ 2161`, () => {
      for (const loaiHinh of ['notm', 'noxh', 'tdc'] as const) {
        const p = pa(lo({ tinh: id, giaiDoan: 'cp', loaiHinh }));
        const k = danSoLo(p, p.lo[0], tv);
        expect(k.tong).toBeCloseTo(88.125);
        expect(k.theoLoaiHinh[loaiHinh]).toMatchObject({ so: 40, phuongPhap: 'sTb', rieng: false });
        expect(k.canCu[0]).toMatch(/2161/);
      }
    });
  }
  it('danh sách chọn tỉnh: trọng điểm trước (HN, TP.HCM ×2, An Giang, Hưng Yên), "Tỉnh / thành khác" cuối', () => {
    const ds = dsTinhChon();
    expect(ds.trongDiem.map((q) => q.id)).toEqual(['hn', 'hcm', 'hcm83', 'ag', 'hy']);
    expect(ds.khac.at(-1)!.id).toBe('khac');
    expect(ds.trongDiem.length + ds.khac.length).toBe(QUY_TAC_DAN_SO.length);
  });
  it('Hà Nội TĐC: mặc định quốc gia 32 m²/người — ghi chú "đã chốt"', () => {
    expect(timQuyTac('hn')!.ghiChu).toMatch(/TĐC.*32 m²\/người.*đã chốt/);
  });
});
