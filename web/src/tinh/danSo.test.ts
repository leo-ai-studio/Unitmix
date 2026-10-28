import { describe, expect, it } from 'vitest';
import { tinhChiTieu } from './chiTieu';
import { danSoDuAn, danSoLo, nguoiMotCan, quyTacApDung, traBang } from './danSo';
import {
  HE_SO_MAC_DINH, NGUONG_MAC_DINH, taoThuVien,
  type CanMau, type ChiTieuQH, type KhaiDanSo, type Lo, type ToaDat, type ToaMau, type TrangThaiPA,
} from './kieu';
import { chuanHoaPA } from './macDinh';
import { QUY_TAC_DAN_SO, timQuyTac, type BangDanSo, type PhuongPhap } from './quyTacDanSo';

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
  it('C — Hà Nội: TĐC áp bảng NOTM', () => {
    const pp = timQuyTac('hn')!.phuongPhap!.cp;
    expect(timQuyTac('hn')!.kieu).toBe('C');
    expect(nguoiMotCan(76, 'tdc', pp).nguoi).toBe(nguoiMotCan(76, 'notm', pp).nguoi);
    expect(nguoiMotCan(76, 'noxh', pp).nguoi).toBe(4);
    expect(nguoiMotCan(76, 'notm', pp).nguoi).toBe(3);
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

describe('fallback và tỉnh chưa có trị số', () => {
  it('tỉnh chưa có QĐ → P = S / 32, không gắn cờ tạm', () => {
    const q = quyTacApDung(lo({ tinh: 'khac', giaiDoan: 'cp' }))!;
    expect(q).toMatchObject({ fallback: true, tam: false });
    expect(nguoiMotCan(96, 'notm', q.pp).nguoi).toBeCloseTo(3);
  });
  it('tỉnh có số hiệu QĐ nhưng chưa có bảng (Hải Dương) → fallback + cờ tạm', () => {
    expect(quyTacApDung(lo({ tinh: 'hd', giaiDoan: 'cp' }))).toMatchObject({ fallback: true, tam: true });
  });
  it('Bà Rịa – Vũng Tàu cũ → quy tắc TP.HCM (QĐ 43/2023 hết hiệu lực theo QĐ 32/2025 Điều 2)', () => {
    const q = quyTacApDung(lo({ tinh: 'brvt', giaiDoan: 'cp' }))!;
    expect(q.ap?.id).toBe('hcm');
    expect(q.fallback).toBe(false);
  });
  it('mỗi tỉnh có QĐ đều ghi số hiệu; tỉnh có bảng ghi điều khoản từng bảng', () => {
    for (const q of QUY_TAC_DAN_SO) {
      if (q.id !== 'khac') expect(q.qd).toBeTruthy();
      for (const pp of Object.values(q.phuongPhap ?? {})) {
        if (pp.kieu === 'bang') for (const b of Object.values(pp.bang)) expect(b!.dieu).toMatch(/QĐ/);
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
  it('lô NOXH tự lấy bảng NOXH; khai loại hình TĐC ghi đè', () => {
    const p = pa(lo({ tinh: 'hn', giaiDoan: 'cp' }, 'xh'));
    expect(danSoLo(p, p.lo[0], tv).dong.every((d) => d.loaiHinh === 'noxh')).toBe(true);
    const p2 = pa(lo({ tinh: 'hn', giaiDoan: 'cp', loaiHinh: 'tdc' }, 'xh'));
    expect(danSoLo(p2, p2.lo[0], tv).tong).toBe(90);
  });
  it('cách bình quân người / căn của QĐ (Hà Nội 3,6)', () => {
    const p = pa(lo({ tinh: 'hn', giaiDoan: 'cp', cach: 'bq' }));
    const k = danSoLo(p, p.lo[0], tv);
    expect(k.phuongPhap).toBe('bq');
    expect(k.tong).toBeCloseTo(144);
  });
});
