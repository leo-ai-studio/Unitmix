/**
 * Kiểm tra MỘT tòa (mẫu thư viện, mẫu đã lưu hoặc tòa đang sửa) theo bộ bất biến bài phá hoại (tinh/phaHoaiChay.ts) + quy tắc vị trí
 * căn + QCVN 04 — dùng cho màn Thư viện mẫu: sửa xong (thêm / bớt, đảo, STRETCH, kéo hành lang, thay lõi) bấm Kiểm để xem lỗi.
 * Hàm thuần, chạy được trong trình duyệt. "Nền" = chính mẫu thư viện chưa sửa: lệch sẵn có của bản vẽ gốc không tính là lỗi mới.
 */
import { mauToa } from './canThem';
import { demCan } from './coCau';
import { CAU_TAO_MAC_DINH, type Diem, type ThuVien, type ToaDat, type TrangThaiPA } from './kieu';
import {
  apMatBang, daGiacCacLoi, daiLoi, deKhung, demLoaiThang, doDeKhe, doKhitLoi, matBangTang, THANG_MAX, THANG_MIN, thangDungLuat, tuChinhToa, type DuLieuMB, type ToaMB,
} from './loiThang';
import { taoPAMoi } from './macDinh';
import { boCucTang, canDangDung, congNangTai, hinhLogia, khungTaiO, matDaDon, tangCoRieng, viTriCan } from './matBang';
import { kiemQCVN04 } from './qcvn04';
import { duocDatVaoO } from './quyTacViTriCan';

export type Ctx = { tv: ThuVien; dl: DuLieuMB | null | undefined };
export type MaKiemMau =
  | 'de' | 'khe' | 'san' | 'khung_de' | 'lech_loi' | 'goc_ngoai' | 'dinh_xa' | 'dtxd' | 'thang_so' | 'thang_n2n3' | 'so_can' | 'co_cau'
  | 'vi_tri_can' | 'thoat_nan' | 'qcvn04' | 'thieu_du_lieu' | 'khong_dung_mau';
export type ViPhamMau = {
  ma: MaKiemMau;
  muc: 'loi' | 'canh_bao';
  /** tham số thế vào câu giải thích i18n `kmt.<ma>`; số hoặc chuỗi */
  tham: Record<string, number | string>;
  /** tầng điển hình riêng bị lỗi; null = bố cục chung */
  tang: number | null;
  khoa?: string;
};
export type KetQuaKiemMau = { vi: ViPhamMau[]; soLoi: number; soCanhBao: number; soCan: number; dtxdM2: number; soThang: number; soTangDaKiem: number };

const dtDG = (P: Diem[]) => Math.abs(P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const trongDG = (p: Diem, P: Diem[]) => {
  let r = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) r = !r;
  }
  return r;
};
const kcDoan = (p: Diem, a: Diem, b: Diem) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const kcBien = (p: Diem, P: Diem[]) => P.reduce((m, a, i) => Math.min(m, kcDoan(p, a, P[(i + 1) % P.length])), Infinity);
const kcO = (p: Diem, R: Diem[]) => (trongDG(p, R) ? 0 : kcBien(p, R));
const khoaO = (R: Diem[]) => R.map((q) => `${Math.round(q[0])},${Math.round(q[1])}`).join(';');
const nhoKhoaO = new WeakMap<ToaMB, Set<string>>();

/** Trạng thái đo được của MỘT bố cục tầng (`k` null = chung): dùng cho kiểm và cho bài thử ngẫu nhiên. */
export function trangThaiMau(toa: ToaDat, c: Ctx, k: number | null = null) {
  const mau = mauToa(c.tv, toa) as ToaMB, mb = matBangTang(toa, mau, c.dl, k), bc = boCucTang(toa, k);
  const hd = apMatBang(mau, mb, c.dl), dk = doDeKhe(mau, mb, c.dl, c.tv, bc), khung = deKhung(mau, mb, c.dl, c.tv, bc);
  const o: Diem[][] = [], oThat: Diem[][] = [];
  const hcn = (mi: number, a0: number, a1: number, sau: number): Diem[] => {
    const m = hd.mat[mi], r = (m.goc_deg * Math.PI) / 180, u: Diem = [Math.cos(r), Math.sin(r)], n: Diem = [-u[1], u[0]];
    const pt = (a: number, b: number): Diem => [u[0] * a + n[0] * (m.truc_mm + b), u[1] * a + n[1] * (m.truc_mm + b)];
    return [pt(a0, 0), pt(a1, 0), pt(a1, sau), pt(a0, sau)];
  };
  const vts = viTriCan(hd, c.tv, bc);
  let soCan = 0;
  for (const v of vts) {
    const id = canDangDung(v, bc), cm = c.tv.can.get(id), sau = cm?.sau_mm ?? v.sau ?? 8500;
    const R = khungTaiO(hd, v.matIdx, v.a0, v.a1, sau, v.guong, cm?.khung) ?? hcn(v.matIdx, v.a0, v.a1, sau);
    o.push(R);
    oThat.push(cm?.khung ? R : hinhLogia({ ...v, sau }, hd, cm?.logia_lui) ?? R);
    if (congNangTai(v.khoa, bc) === 'can') soCan++;
  }
  hd.mat.forEach((m, mi) => m.phan_tu.forEach((q) => { if (q.loai === 'thang_bo') { const R = hcn(mi, q.a0, q.a1, q.sau_mm ?? 8500); o.push(R); oThat.push(R); } }));
  const bao = hd.duong_bao;
  // ô y nguyên như mẫu (cùng chỗ, cùng bề ngang) không xét góc ra ngoài nét bao: nét bao CAD ôm căn thật (hốc giếng trời…)
  let gocMau = nhoKhoaO.get(mau);
  if (!gocMau) {
    const hdG = apMatBang(mau, matBangTang({}, mau, c.dl, null), c.dl), ds: Diem[][] = [];
    for (const v of viTriCan(hdG, c.tv)) {
      const cm = c.tv.can.get(v.canGocId), sau = cm?.sau_mm ?? v.sau ?? 8500;
      const m = hdG.mat[v.matIdx], r = (m.goc_deg * Math.PI) / 180, u: Diem = [Math.cos(r), Math.sin(r)], n: Diem = [-u[1], u[0]];
      const pt = (a: number, b: number): Diem => [u[0] * a + n[0] * (m.truc_mm + b), u[1] * a + n[1] * (m.truc_mm + b)];
      ds.push(khungTaiO(hdG, v.matIdx, v.a0, v.a1, sau, v.guong, cm?.khung) ?? [pt(v.a0, 0), pt(v.a1, 0), pt(v.a1, sau), pt(v.a0, sau)]);
    }
    gocMau = new Set(ds.map(khoaO));
    nhoKhoaO.set(mau, gocMau);
  }
  const gocDs = oThat.filter((_, i) => !gocMau!.has(khoaO(o[i]))).flatMap((R) => R.map((p) => ({ p, d: trongDG(p, bao) ? 0 : kcBien(p, bao) }))).sort((a, b) => b.d - a.d);
  const hl = (hd.hanh_lang_mm || 1800) / 2;
  const dai = (hd.hanh_lang ?? []).map((s) => {
    const dx = s.p1[0] - s.p0[0], dy = s.p1[1] - s.p0[1], L = Math.hypot(dx, dy) || 1, nx = (-dy / L) * hl, ny = (dx / L) * hl;
    return [[s.p0[0] + nx, s.p0[1] + ny], [s.p1[0] + nx, s.p1[1] + ny], [s.p1[0] - nx, s.p1[1] - ny], [s.p0[0] - nx, s.p0[1] - ny]] as Diem[];
  });
  dai.push(...daGiacCacLoi(mau, c.dl));
  for (const s of hd.hanh_lang ?? []) for (const q of [s.p0, s.p1]) dai.push(Array.from({ length: 8 }, (_, i): Diem => [q[0] + hl * 1.1 * Math.cos((i * Math.PI) / 4), q[1] + hl * 1.1 * Math.sin((i * Math.PI) / 4)]));
  const P0 = mau.duong_bao, trenP0 = (p: Diem) => P0.some((a, i) => kcDoan(p, a, P0[(i + 1) % P0.length]) <= 2);
  const dinhDs = bao.filter((p) => !trenP0(p)).map((p) => ({ p, d: Math.min(...[...o, ...dai].map((R) => (R.length === 4 ? kcO(p, R) : trongDG(p, R) ? 0 : kcBien(p, R)))) })).sort((a, b) => b.d - a.d);
  const lech = doKhitLoi({ ...hd, mat: matDaDon(hd, bc, c.tv) }, daiLoi(mau, c.dl));
  return {
    mau, mb, hd, bc, vts, soCan, thang: mb.thangBo, de: dk.de, kheMm: dk.mm, san: dk.san, khung,
    gocNgoai: gocDs[0]?.d ?? 0, dinhXa: dinhDs[0]?.d ?? 0, dtBao: dtDG(bao) / 1e6, dtxd: hd.dtxd_m2,
    lechLoi: Math.max(0, ...lech.map((x) => Math.abs(x.chong))),
  };
}
export type TrangThaiMau = ReturnType<typeof trangThaiMau>;

/** Tòa nền: đúng mẫu thư viện chưa sửa, tự chỉnh mặc định — mốc để phân biệt lệch sẵn có của bản vẽ với lỗi do sửa. */
export function toaNen(toa: ToaDat, c: Ctx): ToaDat {
  const mau = c.tv.toa.get(toa.mauId) as ToaMB | undefined;
  const t: ToaDat = { ...toa, canTheo: {}, canViTri: undefined, congNang: undefined, tangRieng: undefined, canThem: undefined, loiThay: undefined, lat: false, latO: undefined,
    thangTay: undefined, hanhLangTay: undefined, matBang: undefined, duongBao: undefined, dtxdM2: undefined, tuDong: undefined };
  return mau && Array.isArray(mau.mat) ? tuChinhToa(t, mau, c.tv, c.dl) : t;
}

/**
 * Kiểm bố cục chung + từng tầng riêng của `toa`. Lỗi = vi phạm bất biến người dùng thấy (đè, khe, nét bao, thang, vị trí căn…) so với
 * nền; cảnh báo = lệch sẵn có / chỉ cảnh báo theo quy định (cự ly thoát nạn, QCVN 04).
 */
export function kiemMauToa(toa: ToaDat, c: Ctx, nenToa?: ToaDat): KetQuaKiemMau {
  const vi: ViPhamMau[] = [];
  const mau = mauToa(c.tv, toa) as ToaMB | undefined;
  if (!mau || !Array.isArray(mau.mat)) {
    vi.push({ ma: 'khong_dung_mau', muc: 'loi', tham: { mau: toa.mauId }, tang: null });
    return { vi, soLoi: 1, soCanhBao: 0, soCan: 0, dtxdM2: 0, soThang: 0, soTangDaKiem: 0 };
  }
  if (!c.dl) {
    vi.push({ ma: 'thieu_du_lieu', muc: 'canh_bao', tham: {}, tang: null });
    return { vi, soLoi: 0, soCanhBao: 1, soCan: 0, dtxdM2: 0, soThang: 0, soTangDaKiem: 0 };
  }
  const nen = trangThaiMau(nenToa ?? toaNen(toa, c), c);
  const ks: (number | null)[] = [null, ...tangCoRieng(toa)];
  let chung: TrangThaiMau | null = null;
  const hub = 'ltvy'.includes(mau.hinh);
  for (const k of ks) {
    const s = trangThaiMau(toa, c, k);
    if (k === null) chung = s;
    const them = (ma: MaKiemMau, muc: ViPhamMau['muc'], tham: ViPhamMau['tham'], khoa?: string) => vi.push({ ma, muc, tham, tang: k, ...(khoa ? { khoa } : {}) });
    if (s.de > nen.de) them('de', 'loi', { n: s.de, nen: nen.de });
    else if (s.de > 0) them('de', 'canh_bao', { n: s.de, nen: nen.de });
    if (s.kheMm > nen.kheMm + 200) them('khe', 'loi', { mm: Math.round(s.kheMm), nen: Math.round(nen.kheMm) });
    else if (s.kheMm > 200) them('khe', 'canh_bao', { mm: Math.round(s.kheMm), nen: Math.round(nen.kheMm) });
    if (s.san > nen.san) them('san', 'loi', { n: s.san, nen: nen.san });
    if (s.khung > nen.khung) them('khung_de', 'loi', { n: s.khung, nen: nen.khung });
    // căn hở / đè nét bao lõi: quá 400 mm là lỗi; 200–400 mm (hub chéo 300–400) khít đoạn kẹp không gỡ hết được → cảnh báo
    if (s.lechLoi > 400 && s.lechLoi > nen.lechLoi + 100) them('lech_loi', 'loi', { mm: Math.round(s.lechLoi), nen: Math.round(nen.lechLoi) });
    else if (s.lechLoi > (hub ? 300 : 200) && s.lechLoi > nen.lechLoi + 50) them('lech_loi', 'canh_bao', { mm: Math.round(s.lechLoi), nen: Math.round(nen.lechLoi) });
    if (s.gocNgoai > Math.max(700, nen.gocNgoai + 60)) them('goc_ngoai', 'loi', { mm: Math.round(s.gocNgoai), nen: Math.round(nen.gocNgoai) });
    if (s.dinhXa > nen.dinhXa + 60) them('dinh_xa', 'loi', { mm: Math.round(s.dinhXa), nen: Math.round(nen.dinhXa) });
    if (Math.abs(s.dtBao - s.dtxd) > 0.6) them('dtxd', 'loi', { dtxd: s.dtxd, bao: Math.round(s.dtBao * 10) / 10 });
    const d = demLoaiThang(s.thang);
    if (d.so < THANG_MIN || d.so > THANG_MAX) them('thang_so', 'loi', { n: d.so, min: THANG_MIN, max: THANG_MAX });
    else if (!thangDungLuat(s.thang)) them('thang_n2n3', 'loi', { n2: d.n2, n3: d.n3 });
    const bc = s.mb.baoCao;
    if (bc && bc.soCan !== s.soCan) them('so_can', 'loi', { baoCao: bc.soCan, matBang: s.soCan });
    for (const v of s.vts) {
      if (congNangTai(v.khoa, s.bc) !== 'can') continue;
      const id = canDangDung(v, s.bc);
      if (!duocDatVaoO(v.canGocId, id)) them('vi_tri_can', 'loi', { khoa: v.khoa, goc: v.canGocId, moi: id }, v.khoa);
    }
    if ((bc?.vuotSau ?? 0) > 0) them('thoat_nan', 'canh_bao', { n: bc!.vuotSau ?? 0 });
  }
  const pa: TrangThaiPA = { ...taoPAMoi(), toa: [toa] };
  const dem = Object.values(demCan(pa, c.tv)[toa.id] ?? {}).reduce((a, b) => a + b, 0);
  const soCanChung = chung?.soCan ?? 0;
  if (soCanChung && toa.soTangDH && !ks.length) void dem;
  if (chung && !tangCoRieng(toa).length && dem !== chung.soCan * toa.soTangDH) vi.push({ ma: 'co_cau', muc: 'loi', tham: { dem, soCan: chung.soCan, tang: toa.soTangDH }, tang: null });
  for (const r of kiemQCVN04({ cauTao: CAU_TAO_MAC_DINH }, toa, mau, c.tv)) {
    if (r.trangThai === 'canh_bao' || r.trangThai === 'vuot') vi.push({ ma: 'qcvn04', muc: 'canh_bao', tham: { id: r.id, canCu: r.canCu, ...r.tham }, tang: null });
  }
  return {
    vi, soLoi: vi.filter((x) => x.muc === 'loi').length, soCanhBao: vi.filter((x) => x.muc === 'canh_bao').length,
    soCan: chung?.soCan ?? 0, dtxdM2: chung?.dtxd ?? 0, soThang: chung?.thang.length ?? 0, soTangDaKiem: ks.length,
  };
}
