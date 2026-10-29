/**
 * Bố trí hầm đợt 2 — ca tính tay: chương trình phòng (QCVN 01 / 06), xe lăn (QCVN 10:2024 Bảng 1), chỗ đỗ có làn, không cụt đường,
 * ram có đoạn thẳng, khoang cháy ≤ DT tối đa (QCVN 13 Bảng 4), lối ra / cự ly (QCVN 13 2.2.1.14, Bảng 3), DT hộp gió (QCVN 04 2.6.5).
 */
import { describe, expect, it } from 'vitest';
import { GIO_TAM, raiHamTinh } from './ham';
import { chiaKhoang, chonSac, chonXeLan, demCutDuong, dtTrongHcn, hcnTrong, soXeLanQCVN10 } from './hamBoTri';
import { dtHop, heTruc, hcnUv, namTrongRanh } from './hamHinh';
import { chuongTrinhPhong, luuLuongBang8, luuLuongBang9C } from './hamPhong';
import { trongTam } from './hinhHoc';
import { HE_SO_MAC_DINH, NGUONG_MAC_DINH, taoThuVien, type CanMau, type ChiTieuQH, type Diem, type Lo, type ThongSoHam, type ToaDat, type ToaMau, type TrangThaiPA } from './kieu';
import { HAM_MAC_DINH } from './macDinh';
import { raiChoDo } from './raiCho';

const hcn = (x0: number, y0: number, x1: number, y1: number): Diem[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const chiTieu: ChiTieuQH = { matDoMax: 40, matDoThapMax: null, hssddMax: 3.5, tangCaoMax: 25, tangDe: null, tangCanHo: null, tangHam: null, danSoMax: 1600, soCanMax: null, nguoiMoiCan: 3.5, choDoOtoMoiCan: 1, choXeMayMoiCan: 2, cayXanhMin: 20 };
const lo = (ranh: Diem[]): Lo => ({ id: 'A', ranh, chiGioi: null, xungQuanh: [], temDat: { kyHieu: 'CC-01', chucNang: 'tm', chiTieu, coCauMucTieu: { stu: 5, '1pn': 20, '2pn': 45, '2pnp': 15, '3pn': 15 } } });
const canGia: CanMau[] = [{ id: 'c2', ma_goc: 'a', nhom: 'tm', loai: '2pn', vi_tri: 'giua', vi_tri_ma: 'm1', sau_mm: 8500, rong_mm: 7500, ten_vi: '', ten_en: '', dt_tt_m2: 70, dt_tim_m2: 75 }];
const toaGia: ToaMau = { id: 'T', ma_goc: 'x', nhom: 'tm', hinh: 'i', so: 1, ten_vi: '', ten_en: '', so_can_tang: 10, dtxd_m2: 400, hanh_lang_mm: 1800, sau_can_mm: 8500, duong_bao: [[0, 0], [40000, 0], [40000, 20000], [0, 20000]], co_cau: { c2: 10 }, loi: [] };
const tv = taoThuVien([toaGia], canGia);
const toa: ToaDat = { id: 't1', loId: 'A', mauId: 'T', x: 70, y: 50, gocDo: 0, soTangDH: 20, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {} };
const ham: ThongSoHam = { soTang: 2, ranh: null, nhip: 8.4, rongLan: 6, choDai: 5, choRong: 2.5, dtKho: 6, lui: 0 };
const pa = (h: Partial<ThongSoHam> = {}, toaDs: ToaDat[] = [toa]): TrangThaiPA => ({ phienBan: 1, lo: [lo(hcn(0, 0, 140, 100))], heSo: HE_SO_MAC_DINH, nguong: NGUONG_MAC_DINH, toa: toaDs, ham: { ...ham, ...h } });

describe('chương trình phòng kỹ thuật (tinh/hamPhong.ts)', () => {
  it('QCVN 06:2022 Bảng 8 (F1.3) và Bảng 9 (F5, hạng C): tra đúng ô', () => {
    expect(luuLuongBang8(20, 28)).toBe(25); // > 16 tầng, 25–50 nghìn m³
    expect(luuLuongBang8(20, 60)).toBe(30);
    expect(luuLuongBang8(10, 3)).toBe(15);
    expect(luuLuongBang9C(40)).toBe(20);
    expect(luuLuongBang9C(52.8)).toBe(30);
    expect(luuLuongBang9C(800)).toBe(100);
  });
  it('bể SH = dân số × q × ngày ÷ 2,7 m × 1,1; bể PCCC = ngoài nhà 3 h + họng trong nhà 3 h + sprinkler 1 h (tạm)', () => {
    const { ds, soLieu } = chuongTrinhPhong({
      soCan: 100, danSo: 350, soTangHam: 2, dtSanHam: 8000, caoTang: 3.3, soKhoang: 3,
      toa: [{ id: 't1', dtxd: 400, soTang: 21, khoiTich: 400 * (20 * 3.3 + 4.5), daiHanhLangMm: 40000 }],
      ts: { qSinhHoat: 150, ngayDuTru: 1.5, kvaMoiCan: 3, phong: {} },
    });
    expect(soLieu.vBeSH).toBeCloseTo(78.75); // 350 × 150 L × 1,5
    expect(ds.find((p) => p.loai === 'beSH')!.dt).toBeCloseTo(32.1, 1);
    // ngoài nhà: Bảng 8 (21 tầng, 28,2 nghìn m³) 25 L/s; Bảng 9 hầm 52,8 nghìn m³ 30 L/s → 30; trong nhà 3 tia × 2,5 (Bảng 11)
    expect(soLieu.qNgoai).toBe(30);
    expect(soLieu.qTrong).toBe(7.5);
    expect(soLieu.vBePCCC).toBeCloseTo(30 * 10.8 + 7.5 * 10.8 + 30 * 3.6);
    // TBA, máy phát chỉ ở hầm 1 (QCVN 13 2.2.2 b; QCVN 06 A.2.10); bể ở tầng sâu nhất; quạt mỗi khoang mỗi tầng
    expect(ds.filter((p) => p.loai === 'tba' || p.loai === 'mayPhat').every((p) => p.tang === 1)).toBe(true);
    expect(ds.find((p) => p.loai === 'bePCCC')!.tang).toBe(2);
    expect(ds.filter((p) => p.loai === 'quatHut').length).toBe(2 * 3);
    expect(ds.filter((p) => p.loai === 'rac').length).toBe(1);
    expect(ds.every((p) => p.canCu.length > 0)).toBe(true);
  });
  it('ghi đè DT và bỏ phòng', () => {
    const dv = { soCan: 100, danSo: 350, soTangHam: 1, dtSanHam: 5000, caoTang: 3.3, soKhoang: 2, toa: [], ts: { qSinhHoat: 150, ngayDuTru: 1.5, kvaMoiCan: 3, phong: { bomSH: { dt: 60 }, xlnt: { bo: true } } } };
    const { ds } = chuongTrinhPhong(dv);
    expect(ds.find((p) => p.loai === 'bomSH')!.dt).toBe(60);
    expect(ds.some((p) => p.loai === 'xlnt')).toBe(false);
  });
});

describe('xe lăn, sạc (QCVN 10:2024 Bảng 1; dự thảo QCVN 07-11 2.3.5)', () => {
  it('số chỗ xe lăn theo tổng chỗ', () => {
    expect([5, 6, 50, 51, 100, 101, 150, 151, 200, 201, 300, 301, 713].map(soXeLanQCVN10)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 6, 6, 7, 11]);
  });
  it('gộp hai chỗ liền nhau ≥ 3,5 m gần điểm lõi; sạc gần trạm', () => {
    const ht = heTruc(0);
    const cho = Array.from({ length: 10 }, (_, i) => hcnUv(ht, i * 2.5, 0, (i + 1) * 2.5, 5));
    const { thuong, xeLan } = chonXeLan(cho, ht, 1, 3.5, [[24, 2]]);
    expect(xeLan.length).toBe(1);
    expect(thuong.length).toBe(8);
    expect(trongTam(xeLan[0])[0]).toBeCloseTo(22.5); // hai ô cuối, gần lõi ở x = 24
    const vung = chonSac(cho, 3, [0, 0], 2);
    expect(vung.map((v) => v.length)).toEqual([2, 1]);
    expect(trongTam(vung[0][0])[0]).toBeCloseTo(1.25);
  });
});

describe('chỗ đỗ có làn, không cụt đường', () => {
  it('yeuCauLan: mọi chỗ có ô làn ngay trước mặt', () => {
    const r = raiChoDo(hcn(0, 0, 60, 40), [hcn(20, 14, 30, 24)], HAM_MAC_DINH, { goc: 0, yeuCauLan: true });
    expect(r.soCho).toBeGreaterThan(80);
    const lan = r.lanUv!;
    for (const p of r.cho) {
      const [x, y] = trongTam(p);
      const coLan = lan.some((l) => x > l[0] && x < l[2] && (Math.abs(y + 5 - (l[1] + l[3]) / 2) < 3.1 || Math.abs(y - 5 - (l[1] + l[3]) / 2) < 3.1));
      expect(coLan).toBe(true);
    }
  });
  it('demCutDuong: làn chạm đường ngang hai đầu = thông; thiếu một đầu = 1 cụt', () => {
    const lanDs: [number, number, number, number][] = [[6, 0, 50, 6]];
    const ngang = (u0: number, u1: number) => ({ r: [u0, -50, u1, 50] as [number, number, number, number] });
    expect(demCutDuong(lanDs, [ngang(0, 6), ngang(51, 57)], 2.6).so).toBe(0);
    expect(demCutDuong(lanDs, [ngang(0, 6)], 2.6).so).toBe(1);
    expect(demCutDuong(lanDs, [ngang(0, 6), ngang(54, 60)], 2.6).so).toBe(1); // khe 4 m > một ô
  });
  it('lô chữ nhật 140 × 100 có một tòa: 0 đầu cụt, đỉnh ram nối làn, ram + đoạn thẳng trong ranh', () => {
    const kq = raiHamTinh(pa(), tv, lo(hcn(0, 0, 140, 100)))!;
    expect(kq.tong.soCutDuong).toBe(0);
    expect(kq.tang[0].ramNoi).toBe(true);
    const ram = kq.ram!;
    expect(namTrongRanh(ram.poly, kq.ranh)).toBe(true);
    expect(ram.thangTren && namTrongRanh(ram.thangTren, kq.ranh)).toBe(true);
    // đoạn thẳng dưới / trên đúng chiều dài mặc định 6 m, dốc thẳng 24 m
    expect(dtHop([ram.thangDuoi!])).toBeCloseTo(6 * 6.5, 0);
    expect(dtHop([ram.thangTren!])).toBeCloseTo(6 * 6.5, 0);
    expect(dtHop([ram.doc!])).toBeCloseTo(24 * 6.5, 0);
    // chân ram chạm đường ngang (không có chỗ đỗ trong đoạn thẳng)
    expect(kq.tang[0].cho.every((p) => dtHop([p]) > 0 && !namTrongRanh(p, ram.poly))).toBe(true);
  });
});

describe('khoang cháy, thoát nạn, thông gió', () => {
  it('chia khoang ≤ 3 000 m² (QCVN 13:2018 Bảng 4), cộng đủ DT, đường cắt v theo lưng dãy', () => {
    const ranh = hcn(0, 0, 150, 100);
    const ht = heTruc(0);
    const { khoang, tuong } = chiaKhoang(ranh, ht, [0, 0, 150, 100], 3000, { v0: -16, mod: 16 });
    expect(khoang.length).toBeGreaterThanOrEqual(5);
    expect(khoang.every((k) => k.dt <= 3000 + 1e-6)).toBe(true);
    expect(khoang.reduce((a, k) => a + k.dt, 0)).toBeCloseTo(15000, 0);
    for (const w of tuong.filter((x) => x.huong === 'v')) expect(((w.c + 16) % 16 + 16) % 16).toBeCloseTo(0, 6);
  });
  it('mỗi khoang ≥ 2 lối ra, cự ly ≤ 40 m; hộp gió = 9 lần/h × thể tích (QCVN 04 2.6.5) / vận tốc tạm', () => {
    const kq = raiHamTinh(pa(), tv, lo(hcn(0, 0, 140, 100)))!;
    expect(kq.khoang.length).toBeGreaterThanOrEqual(5);
    for (const k of kq.khoang) {
      expect(k.thang.length).toBeGreaterThanOrEqual(2);
      expect(k.cuLyMax).toBeLessThanOrEqual(40);
      expect(k.dt).toBeLessThanOrEqual(3000);
    }
    expect(kq.kiem.find((x) => x.khoa === 'khoangLoiRa')!.muc).not.toBe('vuot');
    for (const g of kq.thongGio) {
      const k = kq.khoang[g.khoang];
      expect(g.qHut).toBeCloseTo(9 * k.dt * 3.3);
      expect(g.dtOngThai).toBeCloseTo((2 * g.qHut) / 3600 / GIO_TAM.vOng);
      expect(g.dtMoTuNhien).toBeCloseTo(0.002 * k.dt); // QCVN 13:2018 2.3.3.5 (tham chiếu)
      expect(g.daDat).toBe(true);
    }
    // hộp gió không nằm dưới chân tháp (miệng gió lên tầng 1)
    expect(kq.t1.gioDuoiToa).toBe(0);
    // phòng kỹ thuật đặt đủ (DT đặt ≥ 95% yêu cầu)
    const dat = kq.tang.flatMap((x) => x.phong).filter((p) => p.loai === 'beSH' || p.loai === 'bePCCC' || p.loai === 'tba');
    for (const p of dat) expect(p.dt).toBeGreaterThan(p.dtYeuCau * 0.95);
  });
  it('hình học nhanh: DT trong hình chữ nhật và hình chữ nhật trong đa giác chữ L', () => {
    const L: Diem[] = [[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]];
    expect(dtTrongHcn(L, -Infinity, Infinity, -Infinity, Infinity)).toBeCloseTo(300);
    expect(dtTrongHcn(L, 5, 15, 5, 15)).toBeCloseTo(75);
    expect(hcnTrong([1, 1, 9, 19], L)).toBe(true);
    expect(hcnTrong([5, 5, 15, 15], L)).toBe(false);
  });
});
