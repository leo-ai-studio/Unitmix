/**
 * So sánh mẫu tòa (tinh/soSanhMau.ts) trên thư viện thật + xếp hạng / bộ đọc yêu cầu (tinh/goiYHinhToa.ts). Kỳ vọng số đo tính tay
 * từ toa.json / can.json (co_cau × DT thông thủy, nét bao), điểm tính tay theo thang `THANG`.
 */
import { describe, expect, it } from 'vitest';
import { napThuVien } from '../thu/thuVienThat';
import { dienTich } from './hinhHoc';
import { boDau, chamDiem, docSo, hopCoCau, phanTichYeuCau, TRONG_SO_MAC_DINH, uuNhuoc, xepHang, yeuCauMacDinh } from './goiYHinhToa';
import type { LoaiCan, ToaMau } from './kieu';
import { doMotMau, dsHinh, hoMau, soSanhMau, type KetQuaMau } from './soSanhMau';

const { tv, dl } = napThuVien();
const MUC: Record<LoaiCan, number> = { stu: 10, '1pn': 20, '2pn': 45, '2pnp': 10, '3pn': 15 };

describe('đo một mẫu không đặt lên TMB', () => {
  it('tm-l1 gốc: số căn, cơ cấu, DTSD, lệch, dân / tầng đúng tính tay từ thư viện', () => {
    const m = tv.toa.get('tm-l1') as ToaMau;
    const r = doMotMau('tm-l1', 'goc', { mauIds: ['tm-l1'], mucTieu: MUC, nguoiMoiCan: 3.5 }, tv, dl)!;
    // co_cau tm-l1: 1PN 14 · 2PN 5 · 3PN 1 · Studio 5 = 25 căn; tự chỉnh không gỡ căn nào
    expect(r.canGo).toBe(0);
    expect(r.soCan).toBe(25);
    expect(r.coCau).toEqual({ stu: 5, '1pn': 14, '2pn': 5, '2pnp': 0, '3pn': 1 });
    const dtsd = Object.entries(m.co_cau).reduce((a, [id, n]) => a + n * tv.can.get(id)!.dt_tt_m2, 0);
    expect(r.dtsd).toBeCloseTo(dtsd, 6);
    // % 20 / 56 / 20 / 0 / 4 so với 10 / 20 / 45 / 10 / 15 → 10 + 36 + 25 + 10 + 11 = 92
    expect(r.lech).toBeCloseTo(92, 6);
    expect(r.danTang).toBeCloseTo(25 * 3.5, 9);
    expect(r.hieuSuat).toBeCloseTo(r.dtsd / r.dtxd, 9);
    // DTXD = nét bao sau tự chỉnh (khác nét mẫu khi PC-11 / QT-69 đổi), sát DTXD mẫu
    expect(Math.abs(r.dtxd - m.dtxd_m2) / m.dtxd_m2).toBeLessThan(0.05);
    expect(r.soThangBo).toBeGreaterThanOrEqual(2);
    expect(r.soThangBo).toBeLessThanOrEqual(3);
    expect(r.soThangMay).toBe(7); // khối lõi x_tmdv_l1_tm_07: so_gieng 7
    expect(r.vuot).toBe(0);
    expect(r.dai).toBeGreaterThanOrEqual(r.rong);
    expect(r.hinhThu.can).toHaveLength(25);
    expect(r.hinhThu.thang).toHaveLength(r.soThangBo);
    expect(dienTich(r.hinhThu.bao)).toBeCloseTo(r.dtxd, 0);
  });
  it('biến thể tối ưu + STRETCH giảm lệch cơ cấu, mang đổi căn theo vị trí để đặt lên lô; mẫu không đổi được thì không có biến thể', () => {
    const v = { mauIds: ['tm-l2'], mucTieu: MUC, bienThe: ['goc', 'toiUu'] as const };
    const [g, o] = soSanhMau({ ...v, bienThe: [...v.bienThe] }, tv, dl);
    expect(g.bienThe).toBe('goc');
    expect(o.bienThe).toBe('toiUu');
    expect(o.lech).toBeLessThan(g.lech);
    expect(o.soDoi).toBeGreaterThan(0);
    expect(Object.keys(o.canViTri ?? {}).length).toBeGreaterThan(0);
    expect(o.soCan).toBe(g.soCan);
  });
  it('họ L thương mại = tm-l1 · tm-l2 · tm-l3; nhóm XH có dạng l', () => {
    expect(hoMau(tv, 'tm', 'l')).toEqual(['tm-l1', 'tm-l2', 'tm-l3']);
    expect(hoMau(tv, 'xh', 'l')).toEqual(['xh-l1', 'xh-l2']);
    expect(dsHinh(tv, 'tm')).toEqual(['i', 'l', 't', 'u', 'v', 'y', 'z']);
  });
  it('dân / tầng theo QĐ tỉnh của lô (Hà Nội): 1PN 14 căn × người theo DT …', () => {
    const lo = { id: 'A', ranh: [], chiGioi: null, xungQuanh: [], temDat: { kyHieu: 'A', chucNang: 'tm' as const, chiTieu: { matDoMax: 40, matDoThapMax: null, hssddMax: 8, tangCaoMax: 25, tangDe: 1, tangCanHo: null, tangHam: null, danSoMax: 0, soCanMax: null, nguoiMoiCan: 3.5, choDoOtoMoiCan: 1, choXeMayMoiCan: 2, cayXanhMin: 20 }, coCauMucTieu: MUC, danSo: { tinh: 'hn', giaiDoan: 'cp' as const } } };
    const r = doMotMau('tm-l1', 'goc', { mauIds: [], mucTieu: MUC, lo }, tv, dl)!;
    const ky = Object.entries((tv.toa.get('tm-l1') as ToaMau).co_cau).reduce((a, [id, n]) => {
      const dt = tv.can.get(id)!.dt_tt_m2;
      const nguoi = dt <= 45 ? 1 : dt <= 70 ? 2 : dt <= 100 ? 3 : dt <= 125 ? 4 : 5; // QĐ 34/2024 Điều 4 khoản 1
      return a + n * nguoi;
    }, 0);
    expect(r.danTang).toBe(ky);
    expect(r.soTangDH).toBe(24); // 25 tầng cao − 1 tầng đế
  });
});

// ---------- xếp hạng: hai mẫu giả, điểm tính tay ----------
const gia = (khoa: string, o: Partial<KetQuaMau>): KetQuaMau => ({
  khoa, mauId: khoa, bienThe: 'goc', nhom: 'tm', hinh: 'l', soTangDH: 20, soCan: 20, coCau: { stu: 0, '1pn': 0, '2pn': 0, '2pnp': 0, '3pn': 0 },
  coCauPct: { stu: 0, '1pn': 0, '2pn': 0, '2pnp': 0, '3pn': 0 }, lech: 0, dtsd: 0, dtxd: 1600, hieuSuat: 0.75, soThangBo: 2, soThangMay: 6,
  vuot: 0, canGo: 0, danTang: 0, soCanGoc: 0, dai: 60, rong: 40, dtLoi: 160, tyLeLoi: 0.1, soDoi: 0, diemView: null,
  hinhThu: { bao: [], can: [], loi: [], thang: [] }, ...o,
});
const A = gia('A', { hieuSuat: 0.78, lech: 30, vuot: 0, tyLeLoi: 0.1, soCanGoc: 6, soCan: 20 });
const B = gia('B', { hieuSuat: 0.72, lech: 10, vuot: 1, tyLeLoi: 0.14, soCanGoc: 4, soCan: 24 });

describe('chấm điểm minh bạch', () => {
  it('trọng số mặc định 3·3·2·1·1·1: A = 897,80 / 11 = 81,62 · B = 629,62 / 11 = 57,24', () => {
    const [a, b] = chamDiem([A, B], yeuCauMacDinh());
    // A: hs 70 + 30·0,03/0,08 = 81,25 · cơ cấu 70 · thoát nạn 100 · lõi 100·(0,16−0,10)/0,08 = 75 · góc 0,30/0,35 = 85,71 · căn 20/24 = 83,33
    expect(a.theoTC).toMatchObject({ hieuSuat: expect.closeTo(81.25, 9), coCau: expect.closeTo(70, 9), thoatNan: 100, loiGon: expect.closeTo(75, 9) });
    expect(a.theoTC.canGoc).toBeCloseTo(85.714, 3);
    expect(a.theoTC.soCan).toBeCloseTo(83.333, 3);
    expect(a.tong).toBeCloseTo(897.797 / 11, 2);
    // B: hs 70·(0,72−0,65)/0,10 = 49 · cơ cấu 90 · thoát nạn 40 − 20 = 20 · lõi 25 · góc (4/24)/0,35 = 47,62 · căn 100
    expect(b.theoTC).toMatchObject({ hieuSuat: expect.closeTo(49, 9), coCau: expect.closeTo(90, 9), thoatNan: 20, loiGon: expect.closeTo(25, 9), soCan: 100 });
    expect(b.tong).toBeCloseTo(629.619 / 11, 2);
    expect(a.theoTC.dtSan).toBeUndefined();
    expect(a.theoTC.view).toBeUndefined();
  });
  it('xếp hạng A trước B; chỉ cơ cấu (các trọng số khác 0) thì B trước', () => {
    expect(xepHang([B, A], yeuCauMacDinh()).map((r) => [r.khoa, r.hang])).toEqual([['A', 1], ['B', 2]]);
    const yc = yeuCauMacDinh();
    for (const k of Object.keys(yc.trongSo) as (keyof typeof yc.trongSo)[]) yc.trongSo[k] = 0;
    yc.trongSo.coCau = 1;
    expect(xepHang([A, B], yc)[0].khoa).toBe('B');
  });
  it('mục tiêu số căn / DT sàn: lệch ±50 % → 0 điểm; điểm view (móc) vào khi có số', () => {
    const yc = { ...yeuCauMacDinh(), soCanTang: 20, dtSan: 2000 };
    const [a, b] = chamDiem([A, { ...B, diemView: 80 }], { ...yc, trongSo: { ...yc.trongSo, dtSan: 2, view: 2 } });
    expect(a.theoTC.soCan).toBe(100);
    expect(b.theoTC.soCan).toBeCloseTo(60, 9); // |24 − 20| / 10 = 0,4
    expect(a.theoTC.dtSan).toBeCloseTo(60, 9); // |1600 − 2000| / 1000 = 0,4
    expect(a.theoTC.view).toBeUndefined();
    expect(b.theoTC.view).toBe(80);
  });
  it('lọc theo dạng / nhóm của yêu cầu', () => {
    const C = gia('C', { hinh: 'u' }), D = gia('D', { nhom: 'xh' });
    expect(xepHang([A, C, D], { ...yeuCauMacDinh(), hinh: ['l'], nhom: 'tm' }).map((r) => r.khoa)).toEqual(['A']);
  });
  it('ưu / nhược: A ưu thoát nạn, hiệu suất; B nhược hiệu suất dưới 75 %, còn 1 căn vượt cự ly', () => {
    const ds = xepHang([A, B], yeuCauMacDinh());
    const a = uuNhuoc(ds[0], ds, yeuCauMacDinh()), b = uuNhuoc(ds[1], ds, yeuCauMacDinh());
    expect(a.uu.map((x) => x.k)).toEqual(expect.arrayContaining(['gh.uu.hieuSuat', 'gh.uu.thoatNan']));
    expect(b.nhuoc.map((x) => x.k)).toEqual(expect.arrayContaining(['gh.nhuoc.hsDuoi', 'gh.nhuoc.thoatNan']));
    expect(b.uu.map((x) => x.k)).toContain('gh.uu.coCau');
  });
});

describe('bộ đọc yêu cầu bằng lời (0 token)', () => {
  it('câu mẫu của lãnh đạo: "ưu tiên hiệu suất > 75%, 2PN 55%, nhiều căn góc, lõi gọn"', () => {
    const yc = phanTichYeuCau('ưu tiên hiệu suất > 75%, 2PN 55%, nhiều căn góc, lõi gọn');
    expect(yc.hsMin).toBeCloseTo(0.75, 9);
    expect(yc.trongSo.hieuSuat).toBe(5); // có "ưu tiên"
    expect(yc.coCau).toEqual({ '2pn': 55 });
    expect(yc.trongSo.coCau).toBe(4);
    expect(yc.trongSo.canGoc).toBe(4);
    expect(yc.trongSo.loiGon).toBe(4);
    expect(yc.trongSo.soCan).toBe(TRONG_SO_MAC_DINH.soCan); // "nhiều căn góc" không phải "nhiều căn"
  });
  it('không dấu / tiếng Anh, số kiểu VN và EN', () => {
    expect(phanTichYeuCau('hieu suat toi thieu 0,78; 20 can/tang; DT san 1.600 m2').hsMin).toBeCloseTo(0.78, 9);
    const yc = phanTichYeuCau('hieu suat toi thieu 0,78; 20 can/tang; DT san 1.600 m2');
    expect(yc.soCanTang).toBe(20);
    expect(yc.dtSan).toBe(1600);
    expect(yc.trongSo.dtSan).toBe(4);
    const en = phanTichYeuCau('Efficiency at least 76%, 1BR 30%, 3BR 15%, 24 units per floor, floor plate about 1,800 m2, compact core');
    expect(en.hsMin).toBeCloseTo(0.76, 9);
    expect(en.coCau).toEqual({ '1pn': 30, '3pn': 15 });
    expect(en.soCanTang).toBe(24);
    expect(en.dtSan).toBe(1800);
    expect(en.trongSo.loiGon).toBe(4);
  });
  it('dạng hình, nhóm, "55% 2PN+", "bỏ qua thoát nạn", "chú ý" không thành dạng Y', () => {
    const yc = phanTichYeuCau('So sánh L1 L2 L3 nhà ở xã hội, 55% 2PN+, studio 10%, bỏ qua thoát nạn, chú ý view');
    expect(yc.hinh).toEqual(['l']);
    expect(yc.nhom).toBe('xh');
    expect(yc.coCau).toEqual({ '2pnp': 55, stu: 10 });
    expect(yc.trongSo.thoatNan).toBe(0);
    expect(yc.trongSo.view).toBe(4);
    expect(phanTichYeuCau('dạng U hoặc chữ T').hinh).toEqual(['t', 'u']);
    expect(phanTichYeuCau('chú ý thoát nạn').hinh).toEqual([]);
  });
  it('câu rỗng / không hiểu → mặc định', () => {
    expect(phanTichYeuCau('')).toEqual(yeuCauMacDinh());
    expect(phanTichYeuCau('xin chào').trongSo).toEqual(TRONG_SO_MAC_DINH);
  });
  it('docSo, boDau, ghép cơ cấu với mục tiêu lô', () => {
    expect([docSo('1.600'), docSo('1,600'), docSo('0,75'), docSo('72.5'), docSo('75')]).toEqual([1600, 1600, 0.75, 72.5, 75]);
    expect(boDau('Hiệu Suất  ĐẠT')).toBe('hieu suat dat');
    // 2PN 55 → còn 45 chia theo gốc stu 10 · 1pn 20 · 2pnp 10 · 3pn 15 (tổng 55)
    const c = hopCoCau(MUC, { '2pn': 55 });
    expect(c['2pn']).toBe(55);
    expect(c['1pn']).toBeCloseTo((45 * 20) / 55, 9);
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 9);
    expect(hopCoCau(MUC, {})).toEqual(MUC);
  });
});

describe('xếp hạng họ L thật (tm-l1 · tm-l2 · tm-l3)', () => {
  it('điểm 0–100, hạng liên tục, mẫu nào cũng có ưu hoặc nhược để giải thích', () => {
    const ds = soSanhMau({ mauIds: hoMau(tv, 'tm', 'l'), mucTieu: MUC, bienThe: ['goc', 'toiUu'] }, tv, dl);
    const yc = phanTichYeuCau('ưu tiên hiệu suất > 73%, 2PN 45%');
    const h = xepHang(ds, yc);
    expect(h.length).toBe(ds.length);
    expect(h.map((r) => r.hang)).toEqual(h.map((_, i) => i + 1));
    for (const r of h) {
      expect(r.diem.tong).toBeGreaterThanOrEqual(0);
      expect(r.diem.tong).toBeLessThanOrEqual(100);
      const g = uuNhuoc(r, h, yc);
      expect(g.uu.length + g.nhuoc.length).toBeGreaterThan(0);
    }
    for (let i = 1; i < h.length; i++) expect(h[i - 1].diem.tong).toBeGreaterThanOrEqual(h[i].diem.tong - 1e-9);
  });
});
