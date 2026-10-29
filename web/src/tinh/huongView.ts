/**
 * ĐIỂM VIEW CĂN HỘ — hướng, khoảng thoáng, cảnh quan, nắng (học QT-111 `diemView` của app cũ MDI_Unitmix_v4, prototype/MDIUnitmix.html).
 * Hàm thuần, toạ độ mét như lô (trục +Y bản vẽ = Bắc khi `gocBac` = 0).
 *
 * ĐÂY LÀ HEURISTIC THIẾT KẾ (quy ước nội bộ MDI), KHÔNG PHẢI QUY CHUẨN. QCVN 04:2021/BXD chỉ yêu cầu căn hộ / phòng ngủ được chiếu sáng,
 * thông thoáng tự nhiên (2.2.4.3, 2.2.4.4) — không quy định hướng nhà hay điểm view. Mọi trọng số / ngưỡng dưới đây sửa được
 * (`CaiDatView`, lưu ở `TrangThaiPA.huongView`); số nào app cũ chưa có là GIÁ TRỊ TẠM, chờ chủ nhiệm chốt.
 *
 * Mỗi căn (ô căn hộ của bố cục tầng): mặt ngoài = cạnh b = sâu của ô trên mặt tòa (`matBang.viTriCan`), pháp tuyến = phía căn của mặt
 * (hướng ban công / phòng khách như app cũ `q.n`). Mắt đặt ở tầng xét (TMB: tầng điển hình giữa = H tòa / 2 như app cũ).
 * 1 · Hướng (0–100): hướng thật 8 phương của pháp tuyến (cộng góc Bắc dự án) → nhóm tốt / trung bình / kém = 100 / 60 / 20; căn góc +10.
 *     Nhóm mặc định như app cũ `HUONG_TOT` / `HUONG_KEM`: tốt = Đông · Đông Nam · Nam, kém = Tây Nam · Tây · Tây Bắc (nắng chiều gắt).
 * 2 · Thoáng (0–100): 5 tia −30°…+30° (trọng số 1·2·3·2·1) từ tâm mặt ngoài, dài 150 m, tới chân tòa gần nhất CAO HƠN mắt (mọi tòa của PA,
 *     mọi lô; chính tòa đó chỉ tính chỗ cắt cách mặt ≥ 4 m — bỏ ban công / hốc). ≥ 100 m = 100 · bằng khoảng §2.6.1 cạnh dài = 40 ·
 *     ngắn hơn giảm theo luỹ thừa 1,5 (app cũ `tmvQuyDoiThoang`).
 * 3 · Cảnh quan (0–100): dọc mỗi tia ≤ 120 m: gặp lô cây xanh / mặt nước = 100 − 0,3·s, quảng trường = 85 − 0,3·s, cắt cạnh lô giáp đường
 *     lộ giới ≥ 20 m = 62; tòa đối diện ≤ 120 m = 15, ≤ `nguongGan` (riêng tư, mặt đối mặt) = 0; không gặp gì = 45 (lấy giá trị lớn hơn
 *     giữa cảnh tốt nằm TRƯỚC vật cản và mức nền) — như app cũ, thêm quảng trường + mức riêng tư (giá trị tạm).
 * 4 · Nắng (0–100): số giờ 8 → 16 h (giờ mặt trời) ngày Đông chí mặt căn nhận nắng trực tiếp (pháp tuyến hướng về mặt trời, không bị
 *     tòa khác che) ÷ 6 h; trừ 15 hướng Tây, 8 Tây Nam / Tây Bắc (nắng chiều hạ chí) — app cũ. Vĩ độ mặc định 21,03° (Hà Nội), sửa được.
 * Tổng = Σ wᵢ·thành phầnᵢ / Σ wᵢ, w mặc định 40 · 30 · 20 · 10 (app cũ: "chủ nhiệm chốt 23/10"). Xếp loại Tốt ≥ 80 · Khá 60–80 · Kém < 60.
 *
 * Bộ đếm `BoDemView` tăng dần (thêm từng tòa: căn cũ chỉ phải dò thêm tòa mới) — gợi ý xếp tòa thử n = 1, 2, … tòa không phải tính lại từ đầu.
 */
import { mauToa } from './canThem';
import { chanToa } from './hinhHoc';
import type { CaiDatViewLuu, Diem, LoaiCan, ThuVien, ToaDat, TrangThaiPA } from './kieu';
import { loaiDat } from './loaiDat';
import { boCucTang, canDangDung, coMat, congNangTai, viTriCan, type BoCuc, type ToaCoMat } from './matBang';

// ---------- cài đặt ----------
export type TrongSoView = { huong: number; thoang: number; canh: number; nang: number };
export type CaiDatView = {
  /** Hướng Bắc thật: góc (°) theo chiều kim đồng hồ từ Bắc thật tới trục +Y bản vẽ (app cũ `S.bac`); 0 = +Y là Bắc. */
  gocBac: number;
  /** Vĩ độ khu đất (°) để tính đường đi mặt trời ngày Đông chí. Mặc định Hà Nội 21,03. */
  viDo: number;
  trongSo: TrongSoView;
  /** Nhóm 8 hướng B · ĐB · Đ · ĐN · N · TN · T · TB: 1 tốt, 0 trung bình, −1 kém (app cũ `S.huongNhom`). */
  nhomHuong: number[];
  /** Khoảng (m): tia giữa chạm tòa gần hơn = "bị che gần" + mặt đối mặt (riêng tư). Giá trị tạm 25 m. */
  nguongGan: number;
  /** Xếp loại: Tốt ≥ nguongTot, Khá ≥ nguongKha, còn lại Kém. */
  nguongTot: number;
  nguongKha: number;
  /** Đường lớn (cảnh quan): lộ giới cạnh lô ≥ m. */
  rongDuongLon: number;
};
export const TRONG_SO_VIEW_MAC_DINH: TrongSoView = { huong: 40, thoang: 30, canh: 20, nang: 10 };
export const NHOM_HUONG_MAC_DINH = [0, 0, 1, 1, 1, -1, -1, -1];
export const VIEW_MAC_DINH: CaiDatView = {
  gocBac: 0, viDo: 21.03, trongSo: TRONG_SO_VIEW_MAC_DINH, nhomHuong: NHOM_HUONG_MAC_DINH,
  nguongGan: 25, nguongTot: 80, nguongKha: 60, rongDuongLon: 20,
};
export type { CaiDatViewLuu };

const so = (v: unknown, md: number, min = -Infinity, max = Infinity) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : md);
/** Cài đặt đủ trường từ phần lưu (bỏ số hỏng, trọng số âm). */
export function caiDatView(luu?: CaiDatViewLuu | null): CaiDatView {
  const l = luu ?? {}, md = VIEW_MAC_DINH, w = l.trongSo ?? {};
  const trongSo = {
    huong: so(w.huong, md.trongSo.huong, 0), thoang: so(w.thoang, md.trongSo.thoang, 0),
    canh: so(w.canh, md.trongSo.canh, 0), nang: so(w.nang, md.trongSo.nang, 0),
  };
  const tong = trongSo.huong + trongSo.thoang + trongSo.canh + trongSo.nang;
  return {
    gocBac: ((so(l.gocBac, 0) % 360) + 360) % 360,
    viDo: so(l.viDo, md.viDo, -66, 66),
    trongSo: tong > 0 ? trongSo : { ...md.trongSo },
    nhomHuong: Array.isArray(l.nhomHuong) && l.nhomHuong.length === 8 && l.nhomHuong.every((x) => x === 1 || x === 0 || x === -1) ? l.nhomHuong.slice() : md.nhomHuong.slice(),
    nguongGan: so(l.nguongGan, md.nguongGan, 1, 200),
    nguongTot: so(l.nguongTot, md.nguongTot, 0, 100),
    nguongKha: Math.min(so(l.nguongKha, md.nguongKha, 0, 100), so(l.nguongTot, md.nguongTot, 0, 100)),
    rongDuongLon: so(l.rongDuongLon, md.rongDuongLon, 0),
  };
}

// ---------- hướng ----------
/** Phương vị thật (°, 0 = Bắc, theo chiều kim đồng hồ) của véc-tơ (x, y) bản vẽ — app cũ `huongThat`. */
export const phuongVi = (n: Diem, gocBac = 0): number => (((90 - (Math.atan2(n[1], n[0]) * 180) / Math.PI + gocBac) % 360) + 360) % 360;
/** Chỉ số 8 hướng 0..7 = B · ĐB · Đ · ĐN · N · TN · T · TB. */
export const huong8 = (n: Diem, gocBac = 0): number => ((Math.round(phuongVi(n, gocBac) / 45) % 8) + 8) % 8;
export const HUONG_TAY = 6;

/** Điểm thành phần hướng (0–100): tốt 100 · trung bình 60 · kém 20, căn góc +10 (tối đa 100). */
export function diemHuong(h8: number, nhom: number[], goc = false): number {
  const g = nhom[h8] ?? 0;
  return Math.min(100, (g > 0 ? 100 : g < 0 ? 20 : 60) + (goc ? 10 : 0));
}

// ---------- thoáng ----------
/** Đổi khoảng thoáng L (m) ra điểm 0–100 với `kc` = khoảng cách cạnh dài §2.6.1 của tòa (app cũ `tmvQuyDoiThoang`). */
export function quyDoiThoang(L: number, kc: number): number {
  const k = Math.max(1, Math.min(kc, 99));
  if (L >= 100) return 100;
  if (L >= k) return 40 + (60 * (L - k)) / Math.max(100 - k, 1);
  return 40 * Math.pow(Math.max(L, 0) / k, 1.5);
}

// ---------- mặt trời ngày Đông chí ----------
const RAD = Math.PI / 180;
const XICH_VI_DONG_CHI = -23.44;
/** Độ cao và phương vị (° từ Bắc, chiều kim đồng hồ) của mặt trời lúc `gio` (giờ mặt trời) ngày Đông chí ở vĩ độ `viDo`. */
export function viTriMatTroi(viDo: number, gio: number, xichVi = XICH_VI_DONG_CHI): { cao: number; phuongVi: number } {
  const p = viDo * RAD, d = xichVi * RAD, h = 15 * (gio - 12) * RAD;
  const sinCao = Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(h);
  const cao = Math.asin(Math.max(-1, Math.min(1, sinCao))) / RAD;
  const az = Math.atan2(-Math.cos(d) * Math.sin(h), Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.sin(p) * Math.cos(h)) / RAD;
  return { cao, phuongVi: ((az % 360) + 360) % 360 };
}
const GIO_NANG = [8, 9, 10, 11, 12, 13, 14, 15, 16];
type Nang = { dv: Diem; tan: number }[];
const nhoNang = new Map<string, Nang>();
/** Hướng (bản vẽ) và tan độ cao mặt trời các giờ có nắng (cao > 2°), theo vĩ độ + góc Bắc. */
function duongNang(viDo: number, gocBac: number): Nang {
  const k = `${viDo}|${gocBac}`;
  let r = nhoNang.get(k);
  if (!r) {
    r = [];
    for (const g of GIO_NANG) {
      const mt = viTriMatTroi(viDo, g);
      if (!(mt.cao > 2)) continue;
      const a = (mt.phuongVi - gocBac) * RAD; // phương vị trên bản vẽ
      r.push({ dv: [Math.sin(a), Math.cos(a)], tan: Math.tan(mt.cao * RAD) });
    }
    nhoNang.set(k, r);
  }
  return r;
}

// ---------- hình học tia ----------
type Hop = [number, number, number, number];
const khungBao = (P: Diem[]): Hop => {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of P) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
  return [a, b, c, d];
};
/** Tia (gốc O, hướng đơn vị dv) cắt đoạn ab ở t > 0, không thì null (app cũ `tmvDoan`). */
function tiaDoan(O: Diem, dv: Diem, a: Diem, b: Diem): number | null {
  const ex = b[0] - a[0], ey = b[1] - a[1], den = dv[0] * ey - dv[1] * ex;
  if (Math.abs(den) < 1e-12) return null;
  const ax = a[0] - O[0], ay = a[1] - O[1], t = (ax * ey - ay * ex) / den, u = (ax * dv[1] - ay * dv[0]) / den;
  return t > 1e-6 && u >= 0 && u <= 1 ? t : null;
}
/** Chỗ cắt gần nhất (≥ tMin) của tia với đa giác P, không cắt thì null. */
function tiaDaGiac(O: Diem, dv: Diem, P: Diem[], tMin = 0): number | null {
  let m: number | null = null;
  for (let i = 0; i < P.length; i++) {
    const t = tiaDoan(O, dv, P[i], P[(i + 1) % P.length]);
    if (t !== null && t >= tMin && (m === null || t < m)) m = t;
  }
  return m;
}
/** Đoạn tia [O, O + dv·L] nằm hẳn ngoài khung bao → bỏ qua. */
const ngoaiKhung = (O: Diem, dv: Diem, L: number, bb: Hop) => {
  const ex = O[0] + dv[0] * L, ey = O[1] + dv[1] * L;
  return Math.max(O[0], ex) < bb[0] || Math.min(O[0], ex) > bb[2] || Math.max(O[1], ey) < bb[1] || Math.min(O[1], ey) > bb[3];
};
const trongDaGiac = (p: Diem, P: Diem[]) => {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [x1, y1] = P[i], [x2, y2] = P[j];
    if ((y1 > p[1]) !== (y2 > p[1]) && p[0] < ((x2 - x1) * (p[1] - y1)) / (y2 - y1) + x1) c = !c;
  }
  return c;
};

// ---------- bối cảnh (lô bên cạnh, đường) ----------
export type LoaiCanhQuan = 'cay_xanh' | 'mat_nuoc' | 'quang_truong';
export type BoiCanhView = {
  xanh: { P: Diem[]; bb: Hop; loai: LoaiCanhQuan }[];
  duong: { a: Diem; b: Diem; rong: number }[];
};
/** Ký hiệu quảng trường (bảng QH hay ghi QT, QTr). Chỉ dùng cho view — `loaiDat` không có nhóm này. */
const LA_QUANG_TRUONG = /^(QT|QTR|QUANG\s*TRUONG|QUẢNG\s*TRƯỜNG)/i;
/** Lô cây xanh / mặt nước / quảng trường + cạnh lô giáp đường lộ giới ≥ `rongDuongLon` (Lo.canhDuong) của mọi lô trong PA. */
export function boiCanhView(pa: Pick<TrangThaiPA, 'lo'>, cai: Pick<CaiDatView, 'rongDuongLon'> = VIEW_MAC_DINH): BoiCanhView {
  const xanh: BoiCanhView['xanh'] = [], duong: BoiCanhView['duong'] = [];
  for (const l of pa.lo) {
    if (l.ranh.length < 3) continue;
    const ld = loaiDat(l);
    const loai: LoaiCanhQuan | null = ld === 'cay_xanh' || ld === 'mat_nuoc' ? ld : LA_QUANG_TRUONG.test(l.temDat.kyHieu.trim().normalize('NFC')) ? 'quang_truong' : null;
    if (loai) xanh.push({ P: l.ranh, bb: khungBao(l.ranh), loai });
    if (Array.isArray(l.canhDuong) && l.canhDuong.length === l.ranh.length) {
      l.canhDuong.forEach((r, i) => {
        if (typeof r === 'number' && r >= cai.rongDuongLon) duong.push({ a: l.ranh[i], b: l.ranh[(i + 1) % l.ranh.length], rong: r });
      });
    }
  }
  return { xanh, duong };
}

// ---------- mặt ngoài căn ----------
/** Mặt ngoài một căn (m, hệ lô): `O` gốc tia (tâm mặt ngoài lùi ra 0,3 m), `n` pháp tuyến đơn vị, `A`–`B` hai đầu cạnh ngoài. */
export type MatCan = { khoa: string; canId: string; loai: LoaiCan | null; goc: boolean; O: Diem; n: Diem; A: Diem; B: Diem };
type MatCuc = MatCan;

/**
 * Mặt ngoài các căn hộ của một tầng (bố cục `bc`; ô đổi công năng không tính) trong hệ CỤC BỘ của tòa (m, gốc = tâm khung bao nét bao
 * mẫu như `chanToa`, chưa lật / xoay). Ô thiếu mẫu căn thì bỏ.
 */
export function matCanCucBo(mau: ToaCoMat, tv: ThuVien, bc?: BoCuc): MatCuc[] {
  const xs = mau.duong_bao.map((p) => p[0]), ys = mau.duong_bao.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const kq: MatCuc[] = [];
  for (const vt of viTriCan(mau, tv, bc)) {
    if (bc && congNangTai(vt.khoa, bc) !== 'can') continue;
    const canId = bc ? canDangDung(vt, bc) : vt.canGocId;
    const c = tv.can.get(canId);
    const m = mau.mat[vt.matIdx];
    if (!m) continue;
    const r = m.goc_deg * RAD, n: Diem = [-Math.sin(r), Math.cos(r)];
    // goc[2], goc[1] = hai đầu cạnh ngoài (b = sâu); mm → m quanh tâm nét bao
    const A: Diem = [(vt.goc[3][0] - cx) / 1000, (vt.goc[3][1] - cy) / 1000], B: Diem = [(vt.goc[2][0] - cx) / 1000, (vt.goc[2][1] - cy) / 1000];
    const M: Diem = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    kq.push({ khoa: vt.khoa, canId, loai: c?.loai ?? null, goc: c?.vi_tri === 'goc', O: [M[0] + n[0] * 0.3, M[1] + n[1] * 0.3], n, A, B });
  }
  return kq;
}
/** Đặt mặt căn cục bộ lên lô theo tòa (lật, xoay `gocDo`, dời tới x, y) — cùng phép đặt với `chanToa`. */
export function datMatCan(ds: MatCuc[], toa: Pick<ToaDat, 'x' | 'y' | 'gocDo' | 'lat'>): MatCan[] {
  const a = toa.gocDo * RAD, c = Math.cos(a), s = Math.sin(a), sx = toa.lat ? -1 : 1;
  const P = (p: Diem): Diem => [toa.x + sx * p[0] * c - p[1] * s, toa.y + sx * p[0] * s + p[1] * c];
  const V = (p: Diem): Diem => [sx * p[0] * c - p[1] * s, sx * p[0] * s + p[1] * c];
  return ds.map((m) => ({ ...m, O: P(m.O), n: V(m.n), A: P(m.A), B: P(m.B) }));
}

// ---------- kết quả ----------
export type XepLoaiView = 'tot' | 'kha' | 'kem';
export type DiemViewCan = {
  toaId: string;
  loId: string;
  khoa: string;
  canId: string;
  loai: LoaiCan | null;
  /** Số tầng mang căn này (đếm tổng hợp theo căn thật). */
  so: number;
  tong: number;
  huong: number;
  thoang: number;
  canh: number;
  nang: number;
  /** Hướng 8 phương 0..7 (B · ĐB · Đ · ĐN · N · TN · T · TB). */
  h8: number;
  /** Khoảng tới vật cản trên tia giữa (m); không có trong 150 m thì null. */
  kcCan: number | null;
  /** Tia giữa chạm tòa trong `nguongGan` (mặt đối mặt / riêng tư). */
  doiDien: boolean;
  /** Số giờ nắng trực tiếp ngày Đông chí (8 → 16 h). */
  gioNang: number;
  /** Cảnh quan chính nhìn thấy trên tia giữa (nếu có). */
  nhin: LoaiCanhQuan | 'duong' | 'toa' | null;
  xep: XepLoaiView;
  /** Mặt ngoài (m, hệ lô) — để tô trên TMB. */
  A: Diem;
  B: Diem;
};
export type TongHopView = {
  /** Số căn (đã nhân số tầng). */
  soCan: number;
  tb: number | null;
  pctTot: number;
  pctKha: number;
  pctKem: number;
  soTot: number;
  soKha: number;
  soKem: number;
  /** Căn nhìn hướng Tây (± 22,5°). */
  soTay: number;
  /** Căn có vật cản trên tia giữa gần hơn `nguongGan`. */
  soGan: number;
  /** TB từng thành phần. */
  thanhPhan: TrongSoView | null;
};

export const xepLoai = (v: number, cai: Pick<CaiDatView, 'nguongTot' | 'nguongKha'>): XepLoaiView => (v >= cai.nguongTot - 1e-9 ? 'tot' : v >= cai.nguongKha - 1e-9 ? 'kha' : 'kem');

/** Gộp điểm các căn (mỗi căn đếm `so` lần = số tầng). */
export function tongHopView(ds: DiemViewCan[]): TongHopView {
  let n = 0, s = 0, tot = 0, kha = 0, kem = 0, tay = 0, gan = 0;
  const tp = { huong: 0, thoang: 0, canh: 0, nang: 0 };
  for (const d of ds) {
    const w = d.so;
    n += w; s += w * d.tong;
    if (d.xep === 'tot') tot += w; else if (d.xep === 'kha') kha += w; else kem += w;
    if (d.h8 === HUONG_TAY) tay += w;
    if (d.kcCan !== null && d.doiDien) gan += w;
    tp.huong += w * d.huong; tp.thoang += w * d.thoang; tp.canh += w * d.canh; tp.nang += w * d.nang;
  }
  const pt = (x: number) => (n ? (x / n) * 100 : 0);
  return {
    soCan: n, tb: n ? s / n : null, pctTot: pt(tot), pctKha: pt(kha), pctKem: pt(kem), soTot: tot, soKha: kha, soKem: kem, soTay: tay, soGan: gan,
    thanhPhan: n ? { huong: tp.huong / n, thoang: tp.thoang / n, canh: tp.canh / n, nang: tp.nang / n } : null,
  };
}

// ---------- bộ đếm tăng dần ----------
const TIA = [-30, -15, 0, 15, 30];
const TW = [1, 2, 3, 2, 1];
const DAI_TIA = 150, XA_CANH = 120, BUOC_CANH = 5, TU_CHE_M = 4, DAI_TIA_NANG = 300;

type Tia = { dv: Diem; L: number; toa: boolean; sX: number | null; loaiX: LoaiCanhQuan | null; tD: number | null };
type CanDem = {
  toaId: string; loId: string; m: MatCan; so: number; eye: number; kc: number; h8: number;
  tia: Tia[]; nang: { dv: Diem; tan: number; che: boolean }[];
};
type VatCan = { id: string; P: Diem[]; H: number; bb: Hop };
export type ToaView = {
  id: string;
  loId: string;
  /** Chân tháp (m, hệ lô). */
  F: Diem[];
  /** Chiều cao tòa (m). */
  H: number;
  /** Mặt căn (m, hệ lô); rỗng = chỉ là vật cản (tòa lô bên cạnh). */
  can: MatCan[];
  /** Cao độ mắt (m) cho các căn của tòa. */
  eye: number;
  /** Số tầng mang mỗi căn (tổng hợp). */
  so: number;
  /** Khoảng cách cạnh dài §2.6.1 (m) để quy đổi thoáng. */
  kc: number;
};

/**
 * Bộ đếm view tăng dần: `them(toa)` thêm một tòa (vật cản + các căn của nó); căn đã có chỉ dò thêm tòa mới. `diem()` trả điểm mọi căn.
 */
export class BoDemView {
  private vc: VatCan[] = [];
  private can: CanDem[] = [];
  private nangGoc: Nang;
  constructor(private cai: CaiDatView, private bc: BoiCanhView) {
    this.nangGoc = duongNang(cai.viDo, cai.gocBac);
  }

  /** Số căn (ô, chưa nhân tầng) đang theo dõi. */
  get soO() { return this.can.length; }

  them(t: ToaView) {
    const o: VatCan = { id: t.id, P: t.F, H: t.H, bb: khungBao(t.F) };
    // căn đã có: dò tòa mới
    for (const c of this.can) this.doVatCan(c, o);
    this.vc.push(o);
    // căn của tòa mới: bối cảnh tĩnh + mọi vật cản (kể cả chính nó)
    for (const m of t.can) {
      const c = this.taoCan(t, m);
      for (const v of this.vc) this.doVatCan(c, v);
      this.can.push(c);
    }
  }

  private taoCan(t: ToaView, m: MatCan): CanDem {
    const tia: Tia[] = TIA.map((g) => {
      const r = g * RAD, dv: Diem = [m.n[0] * Math.cos(r) - m.n[1] * Math.sin(r), m.n[0] * Math.sin(r) + m.n[1] * Math.cos(r)];
      // cảnh quan tĩnh dọc tia: lô xanh gần nhất (lấy mẫu 5 m), cạnh đường lớn gần nhất
      let sX: number | null = null, loaiX: LoaiCanhQuan | null = null;
      for (let s = BUOC_CANH; s <= XA_CANH && sX === null; s += BUOC_CANH) {
        const p: Diem = [m.O[0] + dv[0] * s, m.O[1] + dv[1] * s];
        for (const x of this.bc.xanh) {
          if (p[0] < x.bb[0] || p[0] > x.bb[2] || p[1] < x.bb[1] || p[1] > x.bb[3]) continue;
          if (trongDaGiac(p, x.P)) { sX = s; loaiX = x.loai; break; }
        }
      }
      let tD: number | null = null;
      for (const e of this.bc.duong) { const tt = tiaDoan(m.O, dv, e.a, e.b); if (tt !== null && tt <= XA_CANH && (tD === null || tt < tD)) tD = tt; }
      return { dv, L: DAI_TIA, toa: false, sX, loaiX, tD };
    });
    const ra = [m.n[0], m.n[1]];
    const nang = this.nangGoc.filter((x) => ra[0] * x.dv[0] + ra[1] * x.dv[1] > 0.17).map((x) => ({ dv: x.dv, tan: x.tan, che: false }));
    return { toaId: t.id, loId: t.loId, m, so: t.so, eye: t.eye, kc: t.kc, h8: huong8(m.n, this.cai.gocBac), tia, nang };
  }

  /** Dò một vật cản cho một căn: rút ngắn tia thoáng, đánh dấu giờ nắng bị che. */
  private doVatCan(c: CanDem, o: VatCan) {
    if (o.H <= c.eye) return; // vật cản thấp hơn mắt: nhìn vượt qua
    const tMin = o.id === c.toaId ? TU_CHE_M : 0;
    for (const r of c.tia) {
      if (ngoaiKhung(c.m.O, r.dv, r.L, o.bb)) continue;
      const t = tiaDaGiac(c.m.O, r.dv, o.P, tMin);
      if (t !== null && t < r.L) { r.L = t; r.toa = true; }
    }
    const cao = o.H - c.eye;
    for (const s of c.nang) {
      if (s.che) continue;
      const tMax = Math.min(DAI_TIA_NANG, cao / Math.max(s.tan, 1e-6));
      if (ngoaiKhung(c.m.O, s.dv, tMax, o.bb)) continue;
      const t = tiaDaGiac(c.m.O, s.dv, o.P, tMin);
      if (t !== null && t < tMax) s.che = true;
    }
  }

  /** Điểm mọi căn đã thêm. */
  diem(): DiemViewCan[] {
    const w = this.cai.trongSo, tw = w.huong + w.thoang + w.canh + w.nang || 1, gan = this.cai.nguongGan;
    return this.can.map((c) => {
      let sT = 0, sC = 0, sw = 0;
      c.tia.forEach((r, j) => {
        sT += TW[j] * quyDoiThoang(r.L, c.kc);
        let cq = 45;
        if (r.toa && r.L <= gan) cq = 0; else if (r.toa && r.L <= XA_CANH) cq = 15;
        const lim = Math.min(r.L, XA_CANH);
        let tot: number | null = null;
        if (r.sX !== null && r.sX <= lim) tot = (r.loaiX === 'quang_truong' ? 85 : 100) - 0.3 * r.sX;
        else if (r.tD !== null && r.tD <= lim) tot = 62;
        if (tot !== null) cq = Math.max(cq, tot);
        sC += TW[j] * cq; sw += TW[j];
      });
      const thoang = sT / sw, canh = sC / sw;
      const huong = diemHuong(c.h8, this.cai.nhomHuong, c.m.goc);
      const gio = c.nang.filter((s) => !s.che).length;
      const tay = c.h8 === 6 ? 15 : c.h8 === 5 || c.h8 === 7 ? 8 : 0;
      const nang = Math.max(0, Math.min(100, (gio / 6) * 100) - tay);
      const tong = Math.max(0, Math.min(100, (w.huong * huong + w.thoang * thoang + w.canh * canh + w.nang * nang) / tw));
      const giua = c.tia[2];
      const kcCan = giua.toa ? giua.L : null;
      const nhin: DiemViewCan['nhin'] = giua.sX !== null && giua.sX <= Math.min(giua.L, XA_CANH) ? giua.loaiX
        : giua.tD !== null && giua.tD <= Math.min(giua.L, XA_CANH) ? 'duong' : giua.toa && giua.L <= XA_CANH ? 'toa' : null;
      return {
        toaId: c.toaId, loId: c.loId, khoa: c.m.khoa, canId: c.m.canId, loai: c.m.loai, so: c.so,
        tong, huong, thoang, canh, nang, h8: c.h8, kcCan, doiDien: kcCan !== null && kcCan < gan, gioNang: gio, nhin,
        xep: xepLoai(tong, this.cai), A: c.m.A, B: c.m.B,
      };
    });
  }

  /** Điểm TB (theo số tầng) của mọi căn — nhanh, cho xếp hạng gợi ý. */
  tb(): number | null {
    return tongHopView(this.diem()).tb;
  }
}

// ---------- đánh giá cả PA (TMB) ----------
/** Chiều cao tòa (m) như kiểm §2.6.1 (`caoToa`): đế + tầng điển hình. */
export const caoToaView = (x: Pick<ToaDat, 'soTangDe' | 'caoDe' | 'soTangDH' | 'caoDH'>) => x.soTangDe * x.caoDe + x.soTangDH * x.caoDH;
/** Mắt ở tầng điển hình giữa (app cũ: H / 2, tối thiểu 3 m). */
export const matGiua = (x: Pick<ToaDat, 'soTangDe' | 'caoDe' | 'soTangDH' | 'caoDH'>) => Math.max(3, x.soTangDe * x.caoDe + (x.soTangDH * x.caoDH) / 2);
/** Mắt ở tầng điển hình thứ `k` (1..soTangDH): sàn tầng + 1,5 m. */
export const matTang = (x: Pick<ToaDat, 'soTangDe' | 'caoDe' | 'caoDH'>, k: number) => x.soTangDe * x.caoDe + (k - 1) * x.caoDH + 1.5;

export type KetQuaViewPA = { can: DiemViewCan[]; theoToa: Map<string, TongHopView>; theoLo: Map<string, TongHopView>; tong: TongHopView; cai: CaiDatView };

/** Khoảng cách cạnh dài §2.6.1 theo chiều cao (từ luật LO-02); thiếu luật thì dùng `nguongGan`. */
export type KcTheoH = (H: number) => number;

/**
 * Đánh giá view mọi căn của PA: mọi tòa có mẫu là vật cản; căn của tòa ở bố cục chung (tầng điển hình giữa). `chiToa` = chỉ chấm căn
 * của các tòa này (tòa khác vẫn là vật cản).
 */
export function danhGiaViewPA(pa: TrangThaiPA, tv: ThuVien, opt: { cai?: CaiDatView; kc?: KcTheoH; chiToa?: Set<string> } = {}): KetQuaViewPA {
  const cai = opt.cai ?? caiDatView(pa.huongView);
  const kc = opt.kc ?? (() => cai.nguongGan);
  const bo = new BoDemView(cai, boiCanhView(pa, cai));
  for (const x of pa.toa) {
    const m = mauToa(tv, x);
    if (!m) continue;
    const H = caoToaView(x);
    const cham = coMat(m) && (!opt.chiToa || opt.chiToa.has(x.id));
    const can = cham ? datMatCan(matCanCucBo(m, tv, boCucTang(x, null)), x) : [];
    bo.them({ id: x.id, loId: x.loId, F: chanToa(m, x), H, can, eye: matGiua(x), so: Math.max(1, x.soTangDH), kc: kc(H) });
  }
  return gom(bo.diem(), cai);
}

function gom(ds: DiemViewCan[], cai: CaiDatView): KetQuaViewPA {
  const nhom = (f: (d: DiemViewCan) => string) => {
    const m = new Map<string, DiemViewCan[]>();
    for (const d of ds) { const k = f(d); const a = m.get(k); if (a) a.push(d); else m.set(k, [d]); }
    return new Map([...m].map(([k, v]) => [k, tongHopView(v)]));
  };
  return { can: ds, theoToa: nhom((d) => d.toaId), theoLo: nhom((d) => d.loId), tong: tongHopView(ds), cai };
}

/**
 * View các căn của MỘT tầng của một tòa (màn Tầng): mẫu / bố cục đang vẽ (`mau`, `bc`, đã tự chỉnh), mắt ở tầng `tang` (null = tầng
 * điển hình giữa); mọi tòa khác của PA là vật cản.
 */
export function danhGiaViewTang(pa: TrangThaiPA, tv: ThuVien, toa: ToaDat, mau: ToaCoMat, bc: BoCuc, tang: number | null, opt: { cai?: CaiDatView; kc?: KcTheoH } = {}): DiemViewCan[] {
  const cai = opt.cai ?? caiDatView(pa.huongView);
  const kc = opt.kc ?? (() => cai.nguongGan);
  const bo = new BoDemView(cai, boiCanhView(pa, cai));
  for (const x of pa.toa) {
    if (x.id === toa.id) continue;
    const m = mauToa(tv, x);
    if (m) bo.them({ id: x.id, loId: x.loId, F: chanToa(m, x), H: caoToaView(x), can: [], eye: 0, so: 1, kc: 0 });
  }
  const H = caoToaView(toa);
  const eye = tang === null ? matGiua(toa) : matTang(toa, tang);
  const mChan = mauToa(tv, toa) ?? mau;
  bo.them({ id: toa.id, loId: toa.loId, F: chanToa(mChan, toa), H, can: datMatCan(matCanCucBo(mau, tv, bc), toa), eye, so: 1, kc: kc(H) });
  return bo.diem();
}

// ---------- phần thuần theo xoay mẫu (gợi ý xếp tòa) ----------
const nhoXoay = new Map<string, { cuc: MatCuc[]; huong: number }>();
/**
 * Mặt căn cục bộ của mẫu (bố cục gốc) + điểm "hướng + nắng không che" TB theo góc xoay — cache theo (mẫu, góc, góc Bắc, vĩ độ, nhóm hướng).
 * Dùng làm tiêu chí phụ khi chọn góc đặt tòa trong gợi ý (chưa biết tòa khác).
 */
export function viewXoayMau(mau: ToaCoMat, tv: ThuVien, goc: number, cai: CaiDatView): { cuc: MatCuc[]; huong: number } {
  const k = `${mau.id}|${goc}|${cai.gocBac}|${cai.viDo}|${cai.nhomHuong.join('')}`;
  let r = nhoXoay.get(k);
  if (!r) {
    const cuc = nhoCuc(mau, tv);
    const a = goc * RAD, c = Math.cos(a), s = Math.sin(a);
    const nang = duongNang(cai.viDo, cai.gocBac);
    let tong = 0;
    for (const m of cuc) {
      const n: Diem = [m.n[0] * c - m.n[1] * s, m.n[0] * s + m.n[1] * c];
      const h8 = huong8(n, cai.gocBac);
      const gio = nang.filter((x) => n[0] * x.dv[0] + n[1] * x.dv[1] > 0.17).length;
      const tay = h8 === 6 ? 15 : h8 === 5 || h8 === 7 ? 8 : 0;
      tong += 0.7 * diemHuong(h8, cai.nhomHuong, m.goc) + 0.3 * Math.max(0, Math.min(100, (gio / 6) * 100) - tay);
    }
    r = { cuc, huong: cuc.length ? tong / cuc.length : 0 };
    nhoXoay.set(k, r);
  }
  return r;
}
const nhoCucMau = new WeakMap<ThuVien, Map<string, MatCuc[]>>();
function nhoCuc(mau: ToaCoMat, tv: ThuVien): MatCuc[] {
  let m = nhoCucMau.get(tv);
  if (!m) { m = new Map(); nhoCucMau.set(tv, m); }
  let r = m.get(mau.id);
  if (!r) { r = matCanCucBo(mau, tv); m.set(mau.id, r); }
  return r;
}
