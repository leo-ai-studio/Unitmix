/**
 * Tự chỉnh mặt bằng tầng — đợt 3: gỡ căn vượt cự ly thoát nạn sau PC-11 như app cũ (tự sinh rút gọn + giamCanThoatNan) và thang
 * bộ liền suốt chiều cao khi tòa có tầng riêng (hợp thang mọi tầng / ép theo tầng chung). Chạy trên mẫu thật của thư viện.
 */
import { describe, expect, it } from 'vitest';
import { layMau } from '../thu/layMau';
import { existsSync, readFileSync } from 'node:fs';
import { tongKhe } from './khe';
import { taoThuVien, type CanMau, type ToaDat, type ToaMau, type TrangThaiPA } from './kieu';
import { apMatBang, cungThang, matBangMacDinh, matBangRiengTang, thangLechChung, tuChinhGiam, tuChinhMatBang, tuChinhToa, type DuLieuMB, type HinhLoiMB, type ToaMB } from './loiThang';
import { taoLo, taoPAMoi } from './macDinh';
import { boCucTang, matDaDon, viTriCan, type BoCuc, type NetVe } from './matBang';
import { chieuCaoPCCC, thoatNan, tinhCuaCan, type ToaPCCC } from './pccc';
import { themBienThe } from './stretch';
import { doiCanTheoTang, doiCongNang } from './doiCan';
import { demCan } from './coCau';
import { tinhChiTieu } from './chiTieu';
import { danhSachChen } from '../xuat/xuatCad';

const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const toaDs = doc<ToaMau[]>('toa.json'), canDs = doc<CanMau[]>('can.json');
const tv = themBienThe(taoThuVien(toaDs, canDs));
const idLoi = (b: string) => 'loi-' + b.replace(/^x_/, '').replace(/_/g, '-');
const dl: DuLieuMB = { loi: new Map(), cuaCan: {} };
for (const t of toaDs) for (const m of (t as unknown as ToaMB).mat) for (const q of m.phan_tu)
  if (q.loai !== 'can' && !dl.loi.has(q.block) && existsSync(new URL(`loi/${idLoi(q.block)}.json`, lib))) dl.loi.set(q.block, doc<HinhLoiMB>(`loi/${idLoi(q.block)}.json`));
dl.loi.set('x_tb_n2', doc<HinhLoiMB>('loi/loi-tb-n2.json')); // thang N2 (QT-63) — mẫu chỉ chèn N3
for (const c of canDs) dl.cuaCan[c.ma_goc] = tinhCuaCan(doc<{ ve: { cat: string; pts: [number, number][] }[] }>(`can/${c.id}.json`).ve, c.rong_mm);

const mau = (id: string) => tv.toa.get(id) as unknown as ToaMB;
const trong: BoCuc = { canTheo: {} };
const H24 = chieuCaoPCCC(1, 4.5, 24, 3.3); // 81,8 m: ngưỡng cụt 15 / đôi 20 m
const toaThu = (m: ToaMB, them: Partial<ToaDat> = {}): ToaDat =>
  ({ id: 't', loId: 'l', mauId: m.id, x: 0, y: 0, gocDo: 0, soTangDH: 24, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {}, ...them });
/** Đo lại độc lập số căn vượt (bỏ ô phòng kỹ thuật / trống / căn bỏ — không phải cửa căn hộ). */
const vuotDoc = (m: ToaMB, mb: NonNullable<ToaDat['matBang']>, bc: BoCuc) => {
  const hd = apMatBang(m, mb, dl);
  const mat = matDaDon(hd, bc, tv).map((f) => ({ ...f, phan_tu: f.phan_tu.filter((q) => q.loai !== 'can' || !['ky_thuat', 'trong', 'bo'].includes(bc.congNang?.[q.khoa ?? ''] ?? 'can')) }));
  return thoatNan({ ...(hd as unknown as ToaPCCC), mat }, { cuaCan: dl.cuaCan, chieuCaoPCCC: H24 }).soVuot;
};
const khe = (m: ToaMB, mb: NonNullable<ToaDat['matBang']>, bc: BoCuc) => tongKhe(apMatBang(m, mb, dl), tv, bc);

describe('Việc 1 · gỡ căn vượt cự ly sau PC-11 (app cũ: tự sinh + giamCanThoatNan), bật mặc định', () => {
  it.each([
    ['tm-t2', 2, 2, 42, 40],
    ['tm-u1', 1, 1, 33, 32],
  ] as const)('%s 24 tầng: còn %i căn vượt sau đủ 3 thang → 0; bỏ %i căn giữa gần đầu tự do, căn / tầng %i → %i', (id, vuot, bo, c0, c1) => {
    const m = mau(id), toa = tuChinhToa(toaThu(m), m, tv, dl);
    const b = toa.matBang!.baoCao!, g = b.giamCan!;
    expect(g).toMatchObject({ bat: true, vuotTruoc: vuot, vuotSau: 0, bo, doi: 0, soCanTruoc: c0, soCanSau: c1 });
    expect(b.vuotSau).toBe(0);
    expect(toa.matBang!.thangBo.length).toBe(3);
    // bố cục ghi đúng các ô bỏ, đánh dấu để gỡ lại; đo lại độc lập không còn căn vượt
    const bc = boCucTang(toa, null);
    expect(Object.values(bc.congNang ?? {}).filter((x) => x === 'bo').length).toBe(bo);
    expect(toa.tuDong?.length).toBe(bo);
    expect(vuotDoc(m, toa.matBang!, bc)).toBe(0);
    // cơ cấu trước → sau: chỉ căn studio giữa bị bỏ (DT mất ít nhất), các loại khác giữ
    expect(Object.values(g.coCauSau).reduce((a, x) => a + x, 0)).toBe(c1);
    expect(g.coCauTruoc.stu - g.coCauSau.stu).toBe(bo);
    expect(g.coCauSau['1pn']).toBe(g.coCauTruoc['1pn']);
    // DT / số căn / DTXD tính lại: tòa 24 tầng đếm c1 × 24 căn; dãy co lại → DTXD nhỏ hơn mẫu; không khe / đè mới
    const pa: TrangThaiPA = { ...taoPAMoi(), lo: [taoLo('l', 'A', 'tm', [[0, 0], [300, 0], [300, 300], [0, 300]])], toa: [toa] };
    expect(Object.values(demCan(pa, tv).t).reduce((a, x) => a + x, 0)).toBe(c1 * 24);
    expect(toa.dtxdM2!).toBeLessThan(m.dtxd_m2);
    const goc = khe(m, matBangMacDinh(m, dl), trong), moi = khe(m, toa.matBang!, bc);
    expect(moi.de).toBeLessThanOrEqual(goc.de);
    expect(moi.mm).toBeLessThanOrEqual(goc.mm + 200);
    const ct = tinhChiTieu(pa, tv).theoLo.l;
    const paGoc: TrangThaiPA = { ...pa, toa: [toaThu(m)] };
    expect(ct.dtSanChiTiet.thap).toBeLessThan(tinhChiTieu(paGoc, tv).theoLo.l.dtSanChiTiet.thap);
    // xuất CAD không chèn căn bỏ
    const hd = apMatBang(m, toa.matBang!, dl);
    const hinh = new Map<string, NetVe[]>();
    const ds = danhSachChen({ mau: hd as never, toa: bc, tv, ten: 'thu', goc: './xref', hinh, loi: new Map() });
    expect(ds.filter((x) => x.loai === 'can').length).toBe(c1);
    // PC-11 báo kết quả gỡ, không còn "cần chủ nhiệm quyết"
    const q = b.quyTac.find((x) => x.ma === 'PC-11')!;
    expect(q.muc).toBe('da_sua');
    expect(q.ghiChu).toMatch(new RegExp(`bỏ ${bo} → còn 0 căn vượt`));
  });

  it('mọi mẫu 24 tầng: sau gỡ căn không mẫu nào còn căn vượt; mẫu không vượt sau PC-11 thì không đổi căn nào', () => {
    for (const t of layMau(toaDs, 3)) {
      const m = mau(t.id);
      if (!Array.isArray(m.mat)) continue;
      const a = tuChinhMatBang(m, tv, dl, { bc: trong, chieuCaoPCCC: H24 });
      const g = tuChinhGiam(m, tv, dl, { bc: trong, chieuCaoPCCC: H24 });
      expect(g.baoCao.vuotSau, t.id).toBe(0);
      if (!a.baoCao.vuotSau) expect(g.thayDoi, t.id).toEqual([]);
    }
  });

  it('tắt tự gỡ: giữ nguyên căn, chỉ báo "vượt"; bật lại thì gỡ lại như cũ', () => {
    const m = mau('tm-t2'), bat = tuChinhToa(toaThu(m), m, tv, dl);
    const tat = tuChinhToa({ ...bat, giamCanTN: false }, m, tv, dl);
    expect(tat.congNang).toBeUndefined();
    expect(tat.tuDong).toBeUndefined();
    expect(tat.matBang!.baoCao!.vuotSau).toBe(2);
    expect(tat.matBang!.baoCao!.giamCan).toMatchObject({ bat: false, vuotSau: 2, bo: 0, doi: 0, soCanSau: 42 });
    expect(tat.matBang!.baoCao!.quyTac.find((x) => x.ma === 'PC-11')!.muc).toBe('vuot');
    const lai = tuChinhToa({ ...tat, giamCanTN: undefined }, m, tv, dl);
    expect(lai.congNang).toEqual(bat.congNang);
    expect(lai.matBang!.baoCao!.vuotSau).toBe(0);
  });

  it('thuần và ổn định: tòa vào không đổi (hoàn tác qua kho.sua trả đúng tòa cũ); tự chỉnh lại cho cùng kết quả', () => {
    const m = mau('tm-u1'), x = toaThu(m), truoc = JSON.stringify(x);
    const t1 = tuChinhToa(x, m, tv, dl);
    expect(JSON.stringify(x)).toBe(truoc);
    const t2 = tuChinhToa(t1, m, tv, dl);
    expect(t2.congNang).toEqual(t1.congNang);
    expect(t2.tuDong).toEqual(t1.tuDong);
    expect(JSON.stringify(t2.matBang)).toBe(JSON.stringify(t1.matBang));
  });

  it('người dùng đổi ô căn vượt thành phòng kỹ thuật: ô đó không đo cự ly (QCVN 06 đo từ cửa căn hộ — giá trị tạm)', () => {
    const m = mau('tm-t2'), t0 = tuChinhToa(toaThu(m, { giamCanTN: false }), m, tv, dl);
    const vts = viTriCan(m, tv);
    const r = tuChinhMatBang(m, tv, dl, { bc: trong, chieuCaoPCCC: H24 });
    expect(r.khoaVuot.length).toBe(2);
    const t1 = tuChinhToa(doiCongNang(t0, null, [r.khoaVuot[0]], 'ky_thuat'), m, tv, dl);
    expect(t1.matBang!.baoCao!.vuotSau).toBe(1);
    expect(vts.some((v) => v.khoa === r.khoaVuot[0])).toBe(true);
  });
});

/** Tòa có tầng 5 riêng: đổi một căn ở tầng 5 (căn khác bề ngang) → tự chỉnh tầng 5 dời / thêm thang khác tầng chung. */
const tangRieng = (id: string, tu: string, den: string, khoa: string, them: Partial<ToaDat> = {}) => {
  const m = mau(id), vts = viTriCan(m, tv), vt = vts.find((v) => v.khoa === khoa && v.canGocId === tu)!;
  return { m, toa: tuChinhToa(doiCanTheoTang(toaThu(m, them), [5], vt, den, vts, false), m, tv, dl) };
};
const kyThang = (mb: NonNullable<ToaDat['matBang']>) => mb.thangBo.map((t) => `${t.matIdx}:${Math.round(t.a0 + t.dIns)}:${t.sx}`).sort().join('|');

describe('Việc 2 · thang bộ liền suốt chiều cao (tòa có tầng riêng)', () => {
  it('tm-i1 tầng 5 đổi 1PN 5.800 → 6.000: hợp thang (mặc định) → mọi tầng cùng tập thang; căn nhường chỗ khít, không khe / đè', () => {
    const { m, toa } = tangRieng('tm-i1', 'tm-1pn-m1', 'tm-1pn-m2', '0:1');
    const mb5 = matBangRiengTang(toa, 5)!, chung = toa.matBang!;
    // tầng riêng tự chỉnh riêng có thang khác tầng chung → hợp → cùng điểm chèn, cùng chiều cửa ở mọi tầng
    expect(thangLechChung(mb5, chung)).toBe(false);
    expect(kyThang(mb5)).toBe(kyThang(chung));
    // quy tắc thang bộ: hợp thang các tầng không vượt 3 thang
    expect(mb5.baoCao!.thangLien).toMatchObject({ cheDo: 'hop', soThang: 3, soTang: 1, khongDat: 0, conLech: 0 });
    expect(mb5.baoCao!.thangLien!.nhuong).toBeGreaterThan(0);
    // dồn khít bằng tinh/khe.ts: không khe, không đè ở cả hai bố cục; kiểm lại thoát nạn từng tầng
    expect(khe(m, mb5, boCucTang(toa, 5))).toEqual({ mm: 0, de: 0 });
    expect(khe(m, chung, boCucTang(toa, null))).toEqual({ mm: 0, de: 0 });
    expect(vuotDoc(m, mb5, boCucTang(toa, 5))).toBe(0);
    expect(vuotDoc(m, chung, boCucTang(toa, null))).toBe(0);
    // dòng báo kết quả thay cảnh báo "thang khác tầng chung"
    const q = mb5.baoCao!.quyTac.find((x) => x.ma === 'PC-11')!;
    expect(q.ghiChu).toMatch(/3 thang liền suốt chiều cao/);
    expect(q.ghiChu).not.toMatch(/thang khác bố cục chung/);
    // căn nhường chỗ giữ cơ cấu: chỉ đổi biến thể STRETCH cùng loại, ghi ở tuDong của tầng 5
    expect(toa.tuDong!.every((d) => d.tang === 5 && d.truong === 'canViTri')).toBe(true);
    for (const d of toa.tuDong!) expect(tv.can.get(d.moi)!.loai).toBe(tv.can.get(d.cu ?? viTriCan(m, tv).find((v) => v.khoa === d.khoa)!.canGocId)!.loai);
  });

  it('hợp thang ≤ 3 (quy tắc thang bộ): thang riêng của tầng vào tập chung tới đủ 3; tm-l1 1PN → 2PN, không khe', () => {
    const { m, toa } = tangRieng('tm-l1', 'tm-1pn-m1', 'tm-2pn-m2', '0:1');
    const mb5 = matBangRiengTang(toa, 5)!, chung = toa.matBang!;
    expect(kyThang(mb5)).toBe(kyThang(chung));
    const rieng = tuChinhMatBang(m, tv, dl, { bc: boCucTang(toa, 5), chieuCaoPCCC: H24 }).matBang.thangBo;
    expect(chung.thangBo.length).toBeLessThanOrEqual(3);
    expect(chung.thangBo.length).toBe(mb5.baoCao!.thangLien!.soThang);
    void rieng;
    for (const [mb, k] of [[mb5, 5], [chung, null]] as const) {
      expect(khe(m, mb, boCucTang(toa, k))).toEqual({ mm: 0, de: 0 });
      expect(vuotDoc(m, mb, boCucTang(toa, k))).toBe(0);
    }
    // số căn: tầng chung × 23 + tầng 5 × 1 (căn không bị bỏ vì thang)
    const pa: TrangThaiPA = { ...taoPAMoi(), toa: [toa] };
    expect(Object.values(demCan(pa, tv).t).reduce((a, x) => a + x, 0)).toBe(viTriCan(m, tv).length * 24);
  });

  it('chế độ "ép theo tầng chung": tập thang = thang tầng chung, tầng riêng theo đúng chỗ đó và kiểm lại thoát nạn', () => {
    const { m, toa } = tangRieng('tm-l1', 'tm-1pn-m1', 'tm-2pn-m2', '0:1', { thangLien: 'chung' });
    const mb5 = matBangRiengTang(toa, 5)!, chung = toa.matBang!;
    const goc = tuChinhMatBang(m, tv, dl, { bc: trong, chieuCaoPCCC: H24 }).matBang;
    expect(chung.thangBo.length).toBe(goc.thangBo.length);
    expect(chung.thangBo.every((t) => goc.thangBo.some((u) => cungThang(t, u)))).toBe(true);
    expect(kyThang(mb5)).toBe(kyThang(chung));
    expect(mb5.baoCao!.thangLien).toMatchObject({ cheDo: 'chung', soThang: goc.thangBo.length });
    expect(mb5.baoCao!.vuotSau).toBe(vuotDoc(m, mb5, boCucTang(toa, 5)));
  });

  it('tòa không có tầng riêng / tầng riêng cùng thang: không báo thang liền', () => {
    const m = mau('tm-i1'), toa = tuChinhToa(toaThu(m), m, tv, dl);
    expect(toa.matBang!.baoCao!.thangLien).toBeUndefined();
  });
});
