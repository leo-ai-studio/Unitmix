/**
 * Gợi ý xếp tòa trên một lô (MT-05 · QT-67 / QT-82 "Tối ưu lô" app cũ `toiUuLo`): vét mọi mẫu tòa đúng dòng sản phẩm của lô
 * (MT-01) × cách xếp, chấm bằng chính bộ kiểm tra của app. Hàm thuần, toạ độ mét như lô.
 *
 * Mỗi mẫu: xếp tham lam nhiều tòa nhất (lưới 3 m, góc theo cạnh dài nhất của lô + 90/180/270°, neo "tâm" lô và "góc" đầu cạnh
 * dài, như `tuDatToaG`), mỗi lần đặt kiểm: trong chỉ giới / ranh lô (LO-05), khoảng lùi Bảng 2.7 theo lộ giới TỪNG cạnh lô
 * (LO-01 · `Lo.canhDuong`; cạnh không giáp đường lùi 0; lô chưa khai thì áp mọi cạnh đường 12 m như app cũ khi thiếu `lo.canh`), khoảng cách cạnh dài §2.6.1 với
 * tòa đã đặt và tòa lô bên cạnh trong 60 m (LO-02), dừng khi chạm MĐXD (CT-01). Mỗi số tòa 1..n là một phương án; số tầng điển
 * hình lớn nhất ≤ trần QH mà `tinhChiTieu` không vượt (MĐXD, HSSDĐ gồm hầm, tầng cao, số căn, dân số — CT-01…04), như
 * `tangToiDa` (QT-68). Sau đó trộn mẫu: lấp chỗ trống của phương án tốt nhất bằng mẫu khác.
 * Xếp hạng (`khoaHangPA` app cũ): đạt QH → ít căn vượt thoát nạn (PCCC, pccc.ts) → điểm (sát số căn chỉ tiêu, ít lệch cơ cấu,
 * tận dụng HSSDĐ, % hướng tốt MT-06, điểm VIEW căn hộ — tinh/huongView.ts, trọng số `trongSoView` 0–100 %, mặc định 20 %).
 * View trong lúc xếp: (1) chọn góc đặt — ứng viên cùng khoảng tới neo thì ưu tiên góc xoay có hướng + nắng tốt hơn (cache theo mẫu × góc);
 * (2) điểm phương án — điểm view TB các căn (tòa của phương án + tòa lô bên cạnh làm vật cản), bộ đếm tăng dần theo số tòa, ước ở
 * số tầng trần; phương án trả về tính lại đúng số tầng.
 * Bố cục theo dãy (`KieuBoCuc`, docs/hoc_xep_lo.md — học từ QH Đan Phượng M34 · M7 · Long Biên): tòa cùng mẫu xếp thành dãy bám cạnh lô, xoay
 * theo đúng cạnh đó, dãn đều hết cạnh, chừa sân giữa; danh sách trả về giữ đủ các kiểu bố cục để so sánh.
 */
import { tinhChiTieu } from './chiTieu';
import { coCauRong, diemLechCoCau, phanTram } from './coCau';
import { chanToa, dienTich, trongTam } from './hinhHoc';
import { taoToaTrenLo, vungDat } from './hopLo';
import type { Diem, Lo, LoaiCan, ThuVien, ToaDat, ToaMau, TrangThaiPA } from './kieu';
import { canCaToa, coMat, viTriCan, type ToaCoMat } from './matBang';
import { chieuCaoPCCC, thoatNan, type ToaPCCC } from './pccc';
import { BoDemView, boiCanhView, caiDatView, datMatCan, tongHopView, viewXoayMau, type BoiCanhView, type ToaView } from './huongView';
import type { Luat } from './quyTac';
import { sucChua } from './sucChua';

// ---------- luật LO-01 / LO-02 đọc từ quy_tac.json ----------

/** LO-01 · Bảng 2.7: khoảng lùi (m) theo bề rộng đường × chiều cao công trình, đọc bảng trong luật. */
export function luiBang27(luat: Luat, rongDuong: number, H: number): number {
  const b = luat.bang as { cot_cao_m: string[]; hang_duong_m: Record<string, number[]> } | undefined;
  if (!b) return 0;
  const moc = (nhan: string[]) => nhan.slice(1).map((s) => Number(/[\d.]+/.exec(s)?.[0] ?? Infinity));
  const cot = moc(b.cot_cao_m).filter((m) => H >= m).length;
  const hang = Object.keys(b.hang_duong_m);
  const r = moc(hang).filter((m) => rongDuong >= m).length;
  return b.hang_duong_m[hang[r]]?.[cot] ?? 0;
}

/** Bề rộng đường mặc định khi lô chưa khai lộ giới từng cạnh — app cũ `TMB.rong` = 12 m ("Bề rộng đường tiếp giáp" `tm_rong`). */
export const RONG_DUONG_MAC_DINH = 12;

/** Lô đã khai lộ giới từng cạnh (số phần tử khớp số cạnh ranh). */
export const coCanhDuong = (lo: Lo): boolean => Array.isArray(lo.canhDuong) && lo.canhDuong.length === lo.ranh.length && lo.ranh.length >= 3;

/**
 * Bề rộng lộ giới cạnh i của lô (m); null = cạnh không giáp đường. Lô chưa khai thì mọi cạnh giáp đường `macDinh` m (hành vi cũ).
 */
export function rongCanh(lo: Lo, i: number, macDinh = RONG_DUONG_MAC_DINH): number | null {
  if (!coCanhDuong(lo)) return macDinh;
  const v = lo.canhDuong![i];
  return typeof v === 'number' && v > 0 ? v : null;
}

/**
 * LO-01 · Bảng 2.7 theo TỪNG cạnh lô (`cach_tinh` LO-01, app cũ `luiCanh`): cạnh giáp đường lùi theo lộ giới của chính cạnh đó ×
 * chiều cao H; cạnh không giáp đường lùi 0. Trả mảng theo thứ tự cạnh của `ranh`.
 */
export function luiTungCanh(luat: Luat, lo: Lo, H: number, macDinh = RONG_DUONG_MAC_DINH): number[] {
  return lo.ranh.map((_, i) => { const r = rongCanh(lo, i, macDinh); return r === null ? 0 : luiBang27(luat, r, H); });
}

/** LO-02 · §2.6.1: khoảng cách tối thiểu cạnh dài / đầu hồi (m) theo chiều cao công trình cao hơn, đọc ngưỡng trong luật. */
export function kcToa261(luat: Luat, H: number): { dai: number; hoi: number } {
  const giaTri = (v: number | string): number => {
    if (typeof v === 'number') return v;
    const m = /max\(\s*H\s*\/\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/.exec(v);
    return m ? Math.max(H / Number(m[1]), Number(m[2])) : Number(v);
  };
  const ds = luat.nguong.map((n) => {
    const dk = n.dieu_kien ?? '';
    const moc = Number(/H\s*[<≥>]=?\s*([\d.]+)/.exec(dk)?.[1] ?? NaN);
    const duoi = /H\s*</.test(dk);
    return { hop: Number.isFinite(moc) ? (duoi ? H < moc : H >= moc) : true, dai: /cạnh dài/.test(dk), v: n.gia_tri };
  }).filter((x) => x.hop);
  const dai = ds.find((x) => x.dai), hoi = ds.find((x) => !x.dai);
  return { dai: dai ? giaTri(dai.v) : 0, hoi: hoi ? giaTri(hoi.v) : 0 };
}

// ---------- hình học nhanh (không dùng Clipper trong vòng lặp lưới) ----------
const trong = (p: Diem, P: Diem[]) => {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [x1, y1] = P[i], [x2, y2] = P[j];
    if ((y1 > p[1]) !== (y2 > p[1]) && p[0] < ((x2 - x1) * (p[1] - y1)) / (y2 - y1) + x1) c = !c;
  }
  return c;
};
/** Điểm trong đa giác (nhanh, không qua Clipper). */
export const trongDaGiac = trong;
const kcDoan = (p: Diem, a: Diem, b: Diem) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const cat = (a: Diem, b: Diem, c: Diem, d: Diem) => {
  const o = (p: Diem, q: Diem, r: Diem) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
};
/** Khoảng cách nhỏ nhất giữa hai đa giác (0 khi cắt / chứa nhau) — `tmKC` app cũ. */
export function kcDaGiac(P: Diem[], Q: Diem[]): number {
  for (let i = 0; i < P.length; i++) for (let j = 0; j < Q.length; j++) if (cat(P[i], P[(i + 1) % P.length], Q[j], Q[(j + 1) % Q.length])) return 0;
  if (trong(P[0], Q) || trong(Q[0], P)) return 0;
  let m = Infinity;
  for (const p of P) for (let j = 0; j < Q.length; j++) m = Math.min(m, kcDoan(p, Q[j], Q[(j + 1) % Q.length]));
  for (const q of Q) for (let i = 0; i < P.length; i++) m = Math.min(m, kcDoan(q, P[i], P[(i + 1) % P.length]));
  return m;
}
/**
 * `kcDaGiac(P, Q) >= k` (k > 0) nhưng thoát sớm: đỉnh nào cách cạnh kia < k là trả false ngay (cặp sát nhau — phần lớn ứng viên bị loại khi
 * xếp tham lam), chỉ cặp đủ xa mới phải dò cắt nhau / chứa nhau. Cùng kết quả với `kcDaGiac`.
 */
export function duXaDaGiac(P: Diem[], Q: Diem[], k: number): boolean {
  for (const p of P) for (let j = 0; j < Q.length; j++) if (kcDoan(p, Q[j], Q[(j + 1) % Q.length]) < k) return false;
  for (const q of Q) for (let i = 0; i < P.length; i++) if (kcDoan(q, P[i], P[(i + 1) % P.length]) < k) return false;
  for (let i = 0; i < P.length; i++) for (let j = 0; j < Q.length; j++) if (cat(P[i], P[(i + 1) % P.length], Q[j], Q[(j + 1) % Q.length])) return false;
  return !(trong(P[0], Q) || trong(Q[0], P));
}
export const namTrongNhanh = (F: Diem[], V: Diem[]) =>
  F.every((p) => trong(p, V)) && !F.some((p, i) => V.some((q, j) => cat(p, F[(i + 1) % F.length], q, V[(j + 1) % V.length])));
/** Khoảng cách nhỏ nhất từ đa giác F tới đoạn ab (cạnh lô). */
export const kcToiDoan = (F: Diem[], a: Diem, b: Diem) => {
  let m = Infinity;
  for (const p of F) m = Math.min(m, kcDoan(p, a, b));
  for (const q of [a, b]) for (let k = 0; k < F.length; k++) m = Math.min(m, kcDoan(q, F[k], F[(k + 1) % F.length]));
  return m;
};
/** F đủ khoảng lùi `lui[i]` tới từng cạnh i của ranh R (cạnh lùi 0 bỏ qua). */
export const duLuiTungCanh = (F: Diem[], R: Diem[], lui: number[]) =>
  R.every((a, i) => !(lui[i] > 0) || kcToiDoan(F, a, R[(i + 1) % R.length]) >= lui[i] - 1e-6);

// ---------- kiểu kết quả ----------
export type LuatXep = { lo01: Luat; lo02: Luat };
export type DauVaoXep = {
  pa: TrangThaiPA;
  lo: Lo;
  tv: ThuVien;
  luat: LuatXep;
  /** Bề rộng đường áp mọi cạnh lô (m) khi lô chưa khai lộ giới từng cạnh (`Lo.canhDuong`) — app cũ mặc định 12 m (`TMB.rong`). */
  rongDuong?: number;
  /** Tim cửa căn (ma_goc → 0..1) để đo thoát nạn; thiếu thì 0,5. */
  cuaCan?: Record<string, number>;
  /** Bước lưới (m), mặc định 3 như "Tối ưu lô" app cũ. */
  buoc?: number;
  /** Số phương án trả về. */
  soGoiY?: number;
  /** Trọng số điểm view khi xếp hạng (0–100 %); thiếu = `pa.huongView.trongSoXep` hoặc 20. 0 = không xét view khi xếp (vẫn báo điểm). */
  trongSoView?: number;
  /**
   * Chế độ THEO MỤC TIÊU: tự suy ra tổ hợp mẫu tòa (≤ 3 mẫu, trộn được) × số tòa sao cho DTXD (MĐXD) nằm trong
   * [`matDoMinPct` % × MĐXD tối đa, MĐXD tối đa] và cơ cấu căn sát `coCauMucTieu` của lô, rồi đặt từng tòa. Phương án ra được xếp hạng theo
   * độ lệch cơ cấu + phần thiếu DTXD (xem `GoiYXep.theoMucTieu`).
   */
  theoMucTieu?: boolean;
  /** DTXD tối thiểu (% của MĐXD tối đa) để tổ hợp được coi là đạt; mặc định 85. */
  matDoMinPct?: number;
  /** Chỉ xếp các mẫu tòa này (người dùng chọn); rỗng / thiếu = mọi mẫu đúng dòng sản phẩm của lô. */
  chiMau?: string[];
  /** Chỉ giữ các kiểu bố cục này; rỗng / thiếu = mọi kiểu. */
  kieuBoCuc?: KieuBoCuc[];
  /** Có giá trị thì chạy bộ xếp bố cục (tinh/boCucLo.ts): `sap_lai` giữ các tòa đang có, `to_hop` tự chọn tổ hợp mẫu. */
  cheDoBoCuc?: CheDoBoCuc;
  /** Tiêu chí ưu tiên khi xếp hạng bố cục. */
  uuTien?: UuTienXep;
  /** Hướng gió chủ đạo của dự án (phương vị gió thổi từ, trọng số); thiếu thì dùng Đông Nam quy ước (`PHUONG_VI_GIO_HE`). */
  huongGio?: { pv: number; ts: number }[];
};
export type CheDoBoCuc = 'sap_lai' | 'to_hop';
export type UuTienXep = 'can_bang' | 'nang' | 'gio' | 'view' | 'mat_pho' | 'san';
export const DS_UU_TIEN: UuTienXep[] = ['can_bang', 'nang', 'gio', 'view', 'mat_pho', 'san'];
/** Điểm bố cục 0–100 từng tiêu chí (tinh/boCucLo.ts). */
export type DiemBoCuc = {
  nang: number; gio: number; view: number; mat: number; san: number; tong: number; sanM2: number; banKinhSan: number; gioPct: number;
  /** % điểm mặt ngoài bị tòa khác che nắng ngày Đông chí. */
  cheNangPct: number;
  /** % bề ngang lô mở về phía cây xanh / mặt nước gần lô; null = quanh lô không có. */
  moXanhPct: number | null;
};
/**
 * Kiểu bố cục: `tu_do` tham lam từ neo; `hai_day` hai dãy bám hai cạnh đối diện, sân giữa (M34 vị trí 8, 10); `so_le` như hai dãy, dãy sau lệch
 * nửa bước; `ket_hop` mỗi dãy một mẫu (M34 PA1: T + I); `mot_day` một dãy giữa lô, cho lô dẹt (M34 vị trí 9, lô dài Long Biên);
 * `vien` tòa bám mọi cạnh, mở sân giữa (M7 4 tòa L, MH3 PA3).
 */
export type KieuBoCuc = 'tu_do' | 'hai_day' | 'ba_day' | 'so_le' | 'ket_hop' | 'mot_day' | 'vien' | 'om_goc';
export const DS_KIEU_BO_CUC: KieuBoCuc[] = ['hai_day', 'so_le', 'ket_hop', 'mot_day', 'vien', 'tu_do'];
/** Cạnh chính của vùng đặt: gộp các đoạn gần thẳng hàng (vát góc lô), dài trước; `u` chạy dọc cạnh, `n` hướng vào trong lô. */
export type CanhChinh = { a: Diem; b: Diem; dai: number; goc: number; u: Diem; n: Diem };
export function canhChinh(V: Diem[]): CanhChinh[] {
  let dt2 = 0;
  V.forEach((p, i) => { const q = V[(i + 1) % V.length]; dt2 += p[0] * q[1] - q[0] * p[1]; });
  const huong = (a: Diem, b: Diem) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  const lech = (x: number, y: number) => { const d = Math.abs(x - y) % (2 * Math.PI); return Math.min(d, 2 * Math.PI - d); };
  const doan = V.map((p, i): [Diem, Diem] => [p, V[(i + 1) % V.length]]).filter(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.01);
  const NGUONG = (8 * Math.PI) / 180;
  const gop: [Diem, Diem][] = [];
  for (const d of doan) {
    const c = gop[gop.length - 1];
    if (c && lech(huong(c[0], c[1]), huong(d[0], d[1])) < NGUONG) c[1] = d[1]; else gop.push([d[0], d[1]]);
  }
  if (gop.length > 2 && lech(huong(gop[0][0], gop[0][1]), huong(gop[gop.length - 1][0], gop[gop.length - 1][1])) < NGUONG) gop[0][0] = gop.pop()![0];
  return gop.map(([a, b]) => {
    const dai = Math.hypot(b[0] - a[0], b[1] - a[1]), u: Diem = [(b[0] - a[0]) / dai, (b[1] - a[1]) / dai];
    return { a, b, dai, goc: (huong(a, b) * 180) / Math.PI, u, n: (dt2 >= 0 ? [-u[1], u[0]] : [u[1], -u[0]]) as Diem };
  }).sort((x, y) => y.dai - x.dai);
}

/** Trọng số view mặc định khi xếp hạng gợi ý (%) — nhẹ: chỉ tách các phương án gần bằng nhau. Giá trị tạm, chờ chủ nhiệm chốt. */
export const TRONG_SO_VIEW_XEP = 20;
export type GoiYXep = {
  khoa: string;
  /** Kiểu bố cục tòa trên lô. */
  kieu: KieuBoCuc;
  /** Tòa đặt trên lô (id tạm `goiy-…`; áp dụng thì đổi id mới). */
  toa: ToaDat[];
  /** Mẫu × số tòa, vd [["tm-i1", 3]]. */
  mau: [string, number][];
  soTangDH: number;
  soCan: number;
  soCanMuc: number | null;
  lech: number;
  /** DT sàn tính HSSDĐ / trần (0–1). */
  tyLeSan: number;
  matDo: number;
  danSo: number;
  /** Số chỉ tiêu vượt (MĐXD, HSSDĐ, tầng, số căn, dân số) — phương án gợi ý luôn 0. */
  loiQH: number;
  /** Căn vượt cự ly thoát nạn mỗi tầng (pccc.ts), null = mẫu chưa có đồ thị hành lang. */
  pcccVuot: number | null;
  /** % căn hướng tốt (Đ · ĐN · N, quy ước MDI app cũ `thongKeHuong`). */
  huongTot: number;
  /** Cặp tòa giữa mức đầu hồi và cạnh dài §2.6.1 (cảnh báo). */
  canhBao: string[];
  diem: number;
  /** Điểm view TB các căn (0–100, tinh/huongView.ts); null = mẫu không có mặt bằng căn. */
  view: number | null;
  /** % căn view Tốt. */
  viewTot: number | null;
  /** Phương án sinh ở chế độ THEO MỤC TIÊU: tổ hợp dự kiến, số tòa không đặt được so với dự kiến, DTXD đạt (% MĐXD tối đa). */
  theoMucTieu?: { duKien: [string, number][]; thieuToa: number; dtxdPct: number; thieuDtxd: number };
  /** Có khi chạy bộ xếp bố cục. */
  boCuc?: DiemBoCuc;
  /** Sắp lại tòa đang có: áp dụng giữ id tòa và tòa khoá. */
  sapLai?: boolean;
  /** Điểm các tòa đang đặt trên lô, để so với phương án mới. */
  hienTrang?: DiemBoCuc;
};

// ---------- MT-06: % căn hướng tốt (app cũ `huongThat` + nhóm mặc định TỐT = Đ · ĐN · N) ----------
const HUONG_TOT = [2, 3, 4];
function phanTramHuongTot(mau: ToaCoMat, tv: ThuVien, gocDo: number): number {
  const vts = viTriCan(mau, tv);
  if (!vts.length) return 0;
  let tot = 0;
  for (const vt of vts) {
    const m = mau.mat[vt.matIdx], a = ((m.goc_deg + gocDo) * Math.PI) / 180;
    const n: Diem = [-Math.sin(a), Math.cos(a)]; // pháp tuyến phía căn (b ≥ 0) = hướng ban công
    const b = (((90 - (Math.atan2(n[1], n[0]) * 180) / Math.PI) % 360) + 360) % 360;
    if (HUONG_TOT.includes(((Math.round(b / 45) % 8) + 8) % 8)) tot++;
  }
  return (tot / vts.length) * 100;
}

const CAO_DE = 4.5, CAO_DH = 3.3; // như taoToaTrenLo
const XET_LO_BEN_M = 60; // §2.6.1 với tòa lô bên cạnh: chỉ xét cặp cách < 60 m (cach_tinh LO-02)

type Dat = { mauId: string; x: number; y: number; goc: number; F: Diem[]; r: number; bb?: [number, number, number, number] };
const khungDat = (d: Dat) => {
  if (!d.bb) { const xs = d.F.map((p) => p[0]), ys = d.F.map((p) => p[1]); d.bb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
  return d.bb;
};
/** Khoảng cách hai khung bao (cận dưới của khoảng cách hai đa giác). */
const kcKhung = (a: Dat, b: Dat) => {
  const A = khungDat(a), B = khungDat(b);
  return Math.hypot(Math.max(0, A[0] - B[2], B[0] - A[2]), Math.max(0, A[1] - B[3], B[1] - A[3]));
};

/**
 * Bộ sinh phương án: nhả lượt (yield) sau mỗi mẫu tòa để giao diện không treo; kết quả cuối là danh sách gợi ý đã xếp hạng.
 */
export function* sinhGoiY(v: DauVaoXep): Generator<{ xong: number; tong: number }, GoiYXep[]> {
  const { lo, tv, luat, pa } = v;
  const buoc = v.buoc ?? 3, rongDuong = v.rongDuong ?? 12;
  const R = lo.ranh, V = vungDat(lo);
  if (R.length < 3 || V.length < 3 || lo.temDat.chucNang === 'khac') return [];
  const ct = lo.temDat.chiTieu, dtLo = dienTich(R);
  const nhom = lo.temDat.chucNang === 'xh' ? 'xh' : 'tm';
  const mauDs = [...tv.toa.values()].filter((m): m is ToaCoMat & ToaMau => m.nhom === nhom && coMat(m) && (!v.chiMau?.length || v.chiMau.includes(m.id)));
  const soGoiY = Math.max(1, v.soGoiY ?? 10);
  const soTangDe = ct.tangDe ?? 1;
  const nMax = Math.max(1, ct.tangCanHo ?? Math.round(ct.tangCaoMax) - soTangDe);
  const Hmax = soTangDe * CAO_DE + nMax * CAO_DH;
  const lui = luiTungCanh(luat.lo01, lo, Hmax, rongDuong); // LO-01 theo lộ giới từng cạnh
  const kc = kcToa261(luat.lo02, Hmax);
  // điểm view: cài đặt dự án, bối cảnh (lô cây xanh / mặt nước / đường lớn), trọng số xếp hạng
  const caiV = caiDatView(pa.huongView);
  const wView = Math.max(0, Math.min(100, v.trongSoView ?? pa.huongView?.trongSoXep ?? TRONG_SO_VIEW_XEP));
  const bcView = boiCanhView(pa, caiV);

  // tòa đã đặt ở lô khác (LO-02 · lô bên cạnh)
  const ngoai = pa.toa.filter((t) => t.loId !== lo.id && tv.toa.has(t.mauId)).map((t) => ({ id: t.id, loId: t.loId, F: chanToa(tv.toa.get(t.mauId)!, t), H: t.soTangDe * t.caoDe + t.soTangDH * t.caoDH }));
  // LO-02 chỉ xét trong 60 m: tòa ngoài khung lô + 60 m không bao giờ vi phạm, khỏi dò với mọi ứng viên
  const xV = V.map((p) => p[0]), yV = V.map((p) => p[1]), [x0V, x1V, y0V, y1V] = [Math.min(...xV), Math.max(...xV), Math.min(...yV), Math.max(...yV)];
  const ngoaiGan = ngoai.filter((o) => o.F.some((p) => p[0] > x0V - XET_LO_BEN_M && p[0] < x1V + XET_LO_BEN_M && p[1] > y0V - XET_LO_BEN_M && p[1] < y1V + XET_LO_BEN_M));

  // góc thử: theo cạnh dài nhất của ranh lô (+ 90 / 180 / 270), như app cũ
  let dai = 0, gocL = 0, iL = 0;
  R.forEach((p, i) => { const q = R[(i + 1) % R.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L > dai) { dai = L; iL = i; gocL = (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI; } });
  const gocs = [0, 90, 180, 270].map((k) => Math.round(((((gocL + k) % 360) + 360) % 360) * 10) / 10);
  const xs = V.map((p) => p[0]), ys = V.map((p) => p[1]);
  const diemLuoi: Diem[] = [];
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += buoc) for (let y = Math.min(...ys); y <= Math.max(...ys); y += buoc) if (trong([x, y], V)) diemLuoi.push([x, y]);
  const neo: Record<'tam' | 'goc', Diem> = { tam: trongTam(V), goc: R[iL] };

  // ứng viên tĩnh của một mẫu: điểm lưới × góc mà chân tòa trong vùng đặt + đủ lùi (không phụ thuộc tòa khác) — `ungVienTinh`
  const ungVienTinh = (mau: ToaCoMat & ToaMau) => {
    const kq: Dat[] = [];
    for (const [x, y] of diemLuoi) for (const goc of gocs) {
      const F = chanToa(mau, { x, y, gocDo: goc } as ToaDat);
      if (!namTrongNhanh(F, V)) continue;
      if (!duLuiTungCanh(F, R, lui)) continue;
      if (ngoaiGan.some((o) => { const k = kcDaGiac(F, o.F); return k < XET_LO_BEN_M && k < kcToa261(luat.lo02, Math.max(Hmax, o.H)).dai; })) continue;
      kq.push({ mauId: mau.id, x, y, goc, F, r: Math.max(...F.map((p) => Math.hypot(p[0] - x, p[1] - y))) });
    }
    return kq;
  };
  // điểm hướng + nắng (chưa che) theo mẫu × góc xoay — cache trong huongView
  const nhoXoay = new Map<string, ReturnType<typeof viewXoayMau>>();
  const xoayMau = (d: Pick<Dat, 'mauId' | 'goc'>) => {
    const k = d.mauId + '|' + d.goc;
    let r = nhoXoay.get(k);
    if (!r) { r = viewXoayMau(tv.toa.get(d.mauId) as ToaCoMat, tv, d.goc, caiV); nhoXoay.set(k, r); }
    return r;
  };
  const huongXoay = (d: Dat) => xoayMau(d).huong;
  // §2.6.1 cạnh dài: cận dưới tròn bao → khung bao → đa giác (thoát sớm); cùng kết quả với kcDaGiac ≥ kc.dai
  const xaDu = (u: Dat, d: Dat) => Math.hypot(u.x - d.x, u.y - d.y) - u.r - d.r >= kc.dai || kcKhung(u, d) >= kc.dai || duXaDaGiac(u.F, d.F, kc.dai);
  const LECH_VIEW = 2 * buoc; // m: biến thể "ưu tiên view" — ứng viên xa neo hơn tối đa chừng này vẫn đứng trước nếu góc xoay hướng tốt hơn hẳn
  // xếp tham lam từ neo: mỗi lần lấy ứng viên gần neo nhất còn đủ khoảng cách cạnh dài với các tòa đã có; dừng khi chạm MĐXD.
  // `uuTienView`: cùng khoảng tới neo thì góc xoay có điểm hướng + nắng tốt hơn đứng trước.
  const xepThamLam = (uv: Dat[], nNeo: Diem, daCo: Dat[], dtChan: number, uuTienView = false, toiDa = 40) => {
    const khoaSx = new Map(uv.map((a) => [a, Math.hypot(a.x - nNeo[0], a.y - nNeo[1]) - (uuTienView ? (LECH_VIEW * huongXoay(a)) / 100 : 0)]));
    const ds = uv.slice().sort((a, b) => khoaSx.get(a)! - khoaSx.get(b)!);
    const dat = daCo.slice();
    let foot = daCo.reduce((s, d) => s + dienTich(d.F), 0);
    // ứng viên đã hỏng với các tòa đang có thì còn hỏng khi có thêm tòa → dò tiếp từ sau ứng viên vừa chọn (cùng kết quả với dò lại từ đầu)
    let i = 0;
    while (dat.length < Math.min(40, daCo.length + toiDa)) {
      if (((foot + dtChan) / dtLo) * 100 > ct.matDoMax + 1e-6) break;
      let ch: Dat | null = null;
      for (; i < ds.length && !ch; i++) {
        const u = ds[i];
        if (dat.every((d) => xaDu(u, d))) ch = u;
      }
      if (!ch) break;
      dat.push(ch);
      foot += dtChan;
    }
    return dat;
  };
  /**
   * View · chọn góc: giữ số tòa, xoay từng tòa sang góc (trong 4 góc thử) có điểm hướng + nắng tốt hơn — ứng viên tĩnh hợp lệ ở cùng điểm
   * lưới hoặc lệch tới `BUOC_XOAY` bước lưới — nếu vẫn đủ §2.6.1 với mọi tòa khác; không bao giờ đổi số tòa / số căn lấy view.
   * Cache điểm theo mẫu × góc. Cùng điểm thì ưu tiên ít dời.
   */
  const BUOC_XOAY = 5; // dò ± 5 bước lưới (± 15 m với lưới 3 m)
  const oLuoi = (x: number, y: number) => `${Math.round(x * 1000)}|${Math.round(y * 1000)}`;
  const xoayHuongTot = (dat: Dat[], uvTheoDiem: Map<string, Dat[]>) => {
    const kq = dat.slice();
    for (let i = 0; i < kq.length; i++) {
      const d = kq[i];
      const gan: Dat[] = [];
      for (let ix = -BUOC_XOAY; ix <= BUOC_XOAY; ix++) for (let iy = -BUOC_XOAY; iy <= BUOC_XOAY; iy++) gan.push(...(uvTheoDiem.get(oLuoi(d.x + ix * buoc, d.y + iy * buoc)) ?? []));
      const thay = gan.filter((u) => u !== d && huongXoay(u) > huongXoay(d) + 1e-9)
        .sort((a, b) => huongXoay(b) - huongXoay(a) || Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y));
      const ok = thay.find((u) => kq.every((o, j) => j === i || xaDu(u, o)));
      if (ok) kq[i] = ok;
    }
    return kq;
  };

  // số tầng lớn nhất ≤ nMax mà không vượt chỉ tiêu (đơn điệu theo số tầng → tìm nhị phân)
  const muc = sucChua(lo).soCanUoc;
  const thuPA = (dat: Dat[], n: number) => {
    const toa = dat.map((d, i) => ({ ...taoToaTrenLo(tv.toa.get(d.mauId)!, lo, `goiy-${i}`), x: Math.round(d.x * 100) / 100, y: Math.round(d.y * 100) / 100, gocDo: d.goc, soTangDH: n, soTangDe, caoDe: CAO_DE, caoDH: CAO_DH }));
    const kq = tinhChiTieu({ ...pa, lo: [lo], toa }, tv).theoLo[lo.id];
    return { toa, kq, loi: kq.dong.filter((d) => d.muc === 'vuot' && ['matDo', 'matDoThap', 'dtSan', 'tangCao', 'tangCanHo', 'soCan', 'danSo'].includes(d.khoa)).length };
  };
  const pccc = new Map<string, number | null>();
  const vuotPCCC = (mauId: string, n: number) => {
    const k = `${mauId}|${n}`;
    if (!pccc.has(k)) {
      const m = tv.toa.get(mauId) as unknown as ToaPCCC;
      let r: number | null = null;
      try { if (Array.isArray(m.truc)) r = thoatNan(m, { cuaCan: v.cuaCan, chieuCaoPCCC: chieuCaoPCCC(soTangDe, CAO_DE, n, CAO_DH) }).soVuot; } catch { r = null; }
      pccc.set(k, r);
    }
    return pccc.get(k)!;
  };
  // bộ đếm view: tòa lô bên cạnh là vật cản; tòa của phương án thêm dần (ước ở số tầng trần Hmax)
  const toaView = (d: Dat, i: number, H: number): ToaView => ({
    id: `goiy-${i}`, loId: lo.id, F: d.F, H, eye: Math.max(3, soTangDe * CAO_DE + (H - soTangDe * CAO_DE) / 2), so: 1, kc: kcToa261(luat.lo02, H).dai,
    can: datMatCan(xoayMau(d).cuc, { x: d.x, y: d.y, gocDo: d.goc }),
  });
  const boViewMoi = (bc: BoiCanhView = bcView) => {
    const bo = new BoDemView(caiV, bc);
    for (const o of ngoai) bo.them({ id: o.id, loId: o.loId, F: o.F, H: o.H, can: [], eye: 0, so: 1, kc: 0 });
    return bo;
  };
  const viewDung = (dat: Dat[], n: number) => {
    const bo = boViewMoi(), H = soTangDe * CAO_DE + n * CAO_DH;
    dat.forEach((d, i) => bo.them(toaView(d, i, H)));
    const th = tongHopView(bo.diem());
    return { tb: th.tb, tot: th.soCan ? th.pctTot : null };
  };
  const cham = (dat: Dat[], khoa: string, bo?: BoDemView | null): GoiYXep | null => {
    if (!dat.length) return null;
    let lo_ = 1, hi = nMax, tot: ReturnType<typeof thuPA> | null = null, nTot = 0;
    while (lo_ <= hi) {
      const mid = (lo_ + hi) >> 1, r = thuPA(dat, mid);
      if (r.loi === 0) { tot = r; nTot = mid; lo_ = mid + 1; } else hi = mid - 1;
    }
    if (!tot) return null;
    const kq = tot.kq;
    const dem = new Map<string, number>();
    dat.forEach((d) => dem.set(d.mauId, (dem.get(d.mauId) ?? 0) + 1));
    // §2.6.1: cặp tòa dưới mức cạnh dài theo H thật (≥ đầu hồi vì đã đặt theo H lớn nhất) = cảnh báo
    const H = soTangDe * CAO_DE + nTot * CAO_DH, kcH = kcToa261(luat.lo02, H), canhBao: string[] = [];
    for (let i = 0; i < dat.length; i++) for (let j = i + 1; j < dat.length; j++) {
      const d = kcDaGiac(dat[i].F, dat[j].F);
      if (d < kcH.dai) canhBao.push(`LO-02 ${i + 1}↔${j + 1} ${d.toFixed(1)} m`);
    }
    const pc = [...dem.keys()].map((m) => vuotPCCC(m, nTot));
    const pcccVuot = pc.some((x) => x === null) ? null : pc.reduce<number>((a, b) => a + (b ?? 0), 0);
    const huongTot = dat.reduce((s, d) => s + phanTramHuongTot(tv.toa.get(d.mauId) as ToaCoMat, tv, d.goc), 0) / dat.length;
    const lech = diemLechCoCau(kq.coCauPct, lo.temDat.coCauMucTieu as Record<LoaiCan, number>);
    const tran = ct.hssddMax * dtLo, tyLeSan = tran > 0 ? kq.dtSanTinhHSSDD / tran : 0;
    const tyLeCan = muc ? Math.min(1, kq.soCan / muc) : 0;
    const view = wView > 0 ? (bo ? bo.tb() : viewDung(dat, nMax).tb) : null; // ước ở số tầng trần; phương án trả về tính lại đúng tầng
    return {
      khoa, kieu: 'tu_do', toa: tot.toa, mau: [...dem], soTangDH: nTot, soCan: kq.soCan, soCanMuc: muc, lech, tyLeSan,
      matDo: kq.dong.find((d) => d.khoa === 'matDo')?.dat ?? 0, danSo: kq.soCan * ct.nguoiMoiCan, loiQH: tot.loi,
      pcccVuot, huongTot, canhBao, view, viewTot: null,
      // điểm: sát số căn chỉ tiêu (≤ 100) − ½ lệch cơ cấu (như diemPA "cân bằng") + tận dụng HSSDĐ + % hướng tốt (nhẹ)
      // + điểm view × trọng số (20 % → tối đa ~10 điểm, 100 % → ~50 điểm ≈ nửa thang số căn)
      diem: 100 * tyLeCan - 0.5 * lech + 20 * Math.min(1, tyLeSan) + 0.05 * huongTot - 2 * canhBao.length + (view !== null ? (wView / 100) * 0.5 * view : 0),
    };
  };

  const ketQua: GoiYXep[] = [];
  const tot1: { dat: Dat[]; diem: number }[] = [];
  const uvTheoMau = new Map<string, Dat[]>();
  const chanMau = new Map<string, { dt: number; nMax: number }>(); // DT chân tòa + số tòa nhiều nhất đặt được (chế độ theo mục tiêu)
  for (let k = 0; k < mauDs.length; k++) {
    const mau = mauDs[k];
    const uv = ungVienTinh(mau);
    uvTheoMau.set(mau.id, uv);
    const dtChan = uv[0] ? dienTich(uv[0].F) : 0;
    // hai cách neo, giữ cách đặt được nhiều tòa hơn (bằng nhau: "tâm"). Có xét view: thêm biến thể ưu tiên góc hướng tốt — chỉ thắng khi
    // đặt được BẰNG số tòa mà hướng + nắng TB tốt hơn (không đổi số tòa lấy view); rồi xoay từng tòa sang góc tốt hơn nếu còn chỗ
    const [tam, goc] = (['tam', 'goc'] as const).map((n) => xepThamLam(uv, neo[n], [], dtChan));
    const neoThang = goc.length > tam.length ? 'goc' : 'tam';
    let cach = neoThang === 'goc' ? goc : tam;
    if (wView > 0 && cach.length) {
      // biến thể ưu tiên view chỉ chạy cho cách neo đã thắng (một lượt tham lam thêm)
      const dX = (c: Dat[]) => c.reduce((s, d) => s + huongXoay(d), 0) / c.length;
      const v = xepThamLam(uv, neo[neoThang], [], dtChan, true);
      if (v.length === cach.length && dX(v) > dX(cach) + 1e-9) cach = v;
    }
    if (wView > 0 && cach.length) {
      const theoDiem = new Map<string, Dat[]>();
      for (const u of uv) { const k = oLuoi(u.x, u.y); const a = theoDiem.get(k); if (a) a.push(u); else theoDiem.set(k, [u]); }
      cach = xoayHuongTot(cach, theoDiem);
    }
    chanMau.set(mau.id, { dt: dtChan, nMax: cach.length });
    const bo = wView > 0 && cach.length ? boViewMoi() : null; // tăng dần: n tòa = n − 1 tòa + một tòa
    for (let n = 1; n <= cach.length; n++) {
      bo?.them(toaView(cach[n - 1], n - 1, Hmax));
      const g = cham(cach.slice(0, n), `${mau.id}×${n}`, bo);
      if (g) { ketQua.push(g); tot1.push({ dat: cach.slice(0, n), diem: g.diem }); }
    }
    yield { xong: k + 1, tong: mauDs.length + 1 };
  }
  // trộn mẫu: lấp chỗ trống của phương án tốt nhất bằng mẫu khác (vẫn giữ MĐXD + lùi + §2.6.1)
  tot1.sort((a, b) => b.diem - a.diem);
  if (tot1.length && mauDs.length > 1) {
    let dat = tot1[0].dat;
    for (const mau of mauDs) {
      const uv = uvTheoMau.get(mau.id) ?? [];
      if (!uv.length) continue;
      dat = xepThamLam(uv, neo.tam, dat, dienTich(uv[0].F));
    }
    if (dat.length > tot1[0].dat.length && new Set(dat.map((d) => d.mauId)).size > 1) {
      const g = cham(dat, `tron×${dat.length}`);
      if (g) ketQua.push(g);
    }
  }
  // bố cục theo dãy (docs/hoc_xep_lo.md): mỗi kiểu chấm các ứng viên nhiều căn nhất
  const canhLo = canhChinh(V);
  if (soGoiY >= 3 && canhLo.length >= 3) {
    const datTai = (mau: ToaMau, x0: number, y0: number, gocDo: number): Dat | null => {
      // làm tròn TRƯỚC khi kiểm: toạ độ lưu là toạ độ đã kiểm
      const x = Math.round(x0 * 100) / 100, y = Math.round(y0 * 100) / 100, goc = Math.round(((gocDo % 360) + 360) % 360 * 10) / 10, F = chanToa(mau, { x, y, gocDo: goc } as ToaDat);
      if (!namTrongNhanh(F, V) || !duLuiTungCanh(F, R, lui)) return null;
      if (ngoaiGan.some((o) => { const k = kcDaGiac(F, o.F); return k < XET_LO_BEN_M && k < kcToa261(luat.lo02, Math.max(Hmax, o.H)).dai; })) return null;
      return { mauId: mau.id, x, y, goc, F, r: Math.max(...F.map((p) => Math.hypot(p[0] - x, p[1] - y))) };
    };
    const cham2 = (p: Diem, q: Diem) => p[0] * q[0] + p[1] * q[1];
    type Cach = 'doc' | 'ngang' | 'tot'; // tòa nằm dọc cạnh / vuông góc cạnh / góc nào đặt được nhiều nhất
    /** Một dãy mẫu `mau` bám cạnh `c`, góc xoay `gocDo`: dò dọc cạnh, tòa cách cạnh ít nhất có thể, rồi dãn đều cho hết cạnh. */
    const dayGoc = (mau: ToaMau, c: CanhChinh, gocDo: number, daCo: Dat[], lechDau: number, giua: boolean): Dat[] => {
      const F0 = chanToa(mau, { x: 0, y: 0, gocDo } as ToaDat), us = F0.map((p) => cham2(p, c.u)), ns = F0.map((p) => cham2(p, c.n));
      const u0 = Math.min(...us), rong = Math.max(...us) - u0, n0 = Math.min(...ns), sau = Math.max(...ns) - n0;
      const sauLo = Math.max(...V.map((p) => cham2([p[0] - c.a[0], p[1] - c.a[1]], c.n)));
      if (giua && sau > sauLo) return [];
      const dsD = giua ? [(sauLo - sau) / 2] : [0, 1, 2, 3, 4, 6, 8, 10, 12, 15];
      const tai = (s: number, d: number) => datTai(mau, c.a[0] + c.u[0] * (s - u0) + c.n[0] * (d - n0), c.a[1] + c.u[1] * (s - u0) + c.n[1] * (d - n0), gocDo);
      const dtChan = dienTich(F0), day: { s: number; d: number; o: Dat }[] = [];
      let foot = daCo.reduce((a, x) => a + dienTich(x.F), 0);
      for (let s = lechDau; s + rong <= c.dai + 1e-6 && ((foot + dtChan) / dtLo) * 100 <= ct.matDoMax + 1e-6;) {
        let gap: { s: number; d: number; o: Dat } | null = null;
        for (const d of dsD) {
          const o = tai(s, d);
          if (o && daCo.every((x) => xaDu(o, x)) && day.every((x) => xaDu(o, x.o))) { gap = { s, d, o }; break; }
        }
        if (gap) { day.push(gap); foot += dtChan; s += rong + 1; } else s += 2;
      }
      if (day.length < 2) return day.map((x) => x.o);
      // dãn đều: tòa đầu giữ đầu cạnh, tòa cuối tới cuối cạnh; hỏng thì giữ dãy sít
      const thua = c.dai - (day[day.length - 1].s + rong), deu: Dat[] = [];
      for (let i = 0; i < day.length && deu.length === i; i++) {
        const o = tai(day[i].s + (thua * i) / (day.length - 1), day[i].d);
        if (o && daCo.every((x) => xaDu(o, x)) && deu.every((x) => xaDu(o, x))) deu.push(o);
      }
      return deu.length === day.length ? deu : day.map((x) => x.o);
    };
    const dayCach = (mau: ToaMau, c: CanhChinh, cach: Cach, daCo: Dat[], lechDau = 0, giua = false): Dat[] => {
      let tot: Dat[] = [];
      for (const k of [0, 90, 180, 270]) {
        const F0 = chanToa(mau, { x: 0, y: 0, gocDo: c.goc + k } as ToaDat), us = F0.map((p) => cham2(p, c.u)), ns = F0.map((p) => cham2(p, c.n));
        const doc = Math.max(...us) - Math.min(...us) >= Math.max(...ns) - Math.min(...ns);
        if ((cach === 'doc' && !doc) || (cach === 'ngang' && doc)) continue;
        const d = dayGoc(mau, c, c.goc + k, daCo, lechDau, giua);
        if (d.length > tot.length) tot = d;
      }
      return tot;
    };
    const A = canhLo[0], B = canhLo.slice(1).find((c) => cham2(c.u, A.u) < -0.7) ?? canhLo[1];
    const ung: { kieu: KieuBoCuc; dat: Dat[]; khoa: string }[] = [];
    const them = (kieu: KieuBoCuc, dat: Dat[], khoa: string) => { if (dat.length) ung.push({ kieu, dat, khoa: `${kieu}|${khoa}|${dat.length}` }); };
    const tuTren = [...mauDs].sort((a, b) => (chanMau.get(b.id)?.nMax ?? 0) - (chanMau.get(a.id)?.nMax ?? 0) || b.so_can_tang - a.so_can_tang).slice(0, 8);
    let xong = 0;
    for (const m of tuTren) {
      for (const cach of ['doc', 'ngang'] as const) {
        const a = dayCach(m, A, cach, []);
        them('hai_day', [...a, ...dayCach(m, B, cach, a)], `${m.id}|${cach}`);
        them('so_le', [...a, ...dayCach(m, B, cach, a, 18)], `${m.id}|${cach}`);
        them('mot_day', dayCach(m, A, cach, [], 0, true), `${m.id}|${cach}`);
      }
      let vien: Dat[] = [];
      for (const c of canhLo) if (c.dai >= 30) vien = [...vien, ...dayCach(m, c, 'tot', vien)];
      them('vien', vien, m.id);
      yield { xong: mauDs.length + (++xong / tuTren.length) / 2, tong: mauDs.length + 1 };
    }
    for (const m1 of tuTren.slice(0, 4)) for (const m2 of tuTren.slice(0, 4)) {
      if (m1 === m2) continue;
      const a = dayCach(m1, A, 'tot', []);
      them('ket_hop', [...a, ...dayCach(m2, B, 'tot', a)], `${m1.id}+${m2.id}`);
    }
    const canDat = (d: Dat[]) => d.reduce((s, x) => s + tv.toa.get(x.mauId)!.so_can_tang, 0);
    for (const kieu of DS_KIEU_BO_CUC) {
      const top3 = ung.filter((u) => u.kieu === kieu).sort((a, b) => canDat(b.dat) - canDat(a.dat)).slice(0, 3);
      for (const u of top3) { const g = cham(u.dat, u.khoa); if (g) { g.kieu = kieu; ketQua.push(g); } }
    }
  }
  // THEO MỤC TIÊU: suy tổ hợp mẫu × số tòa đạt DTXD + cơ cấu, rồi đặt từng tòa theo chỉ tiêu từng mẫu
  const minPct = Math.max(0, Math.min(100, v.matDoMinPct ?? 85));
  const dtMax = (dtLo * ct.matDoMax) / 100, dtMin = (dtMax * minPct) / 100;
  const mucTieuCC = lo.temDat.coCauMucTieu as Record<LoaiCan, number>;
  const coMucTieuCC = !!mucTieuCC && Object.values(mucTieuCC).some((x) => x > 0);
  if (v.theoMucTieu) {
    const canMau = new Map<string, Record<LoaiCan, number>>();
    for (const mau of mauDs) {
      const dem = coCauRong();
      for (const [id, n] of canCaToa(mau, taoToaTrenLo(mau, lo, 'dem'), tv)) { const c = tv.can.get(id); if (c) dem[c.loai] += n; }
      canMau.set(mau.id, dem);
    }
    const lechCo = (dem: Record<LoaiCan, number>) => (coMucTieuCC ? diemLechCoCau(phanTram(dem), mucTieuCC) : 0);
    // mẫu đặt được, ưu tiên mẫu cơ cấu sát mục tiêu (cắt còn 12 mẫu để tổ hợp không nổ)
    const ung = mauDs.filter((m) => (chanMau.get(m.id)?.nMax ?? 0) > 0 && (chanMau.get(m.id)?.dt ?? 0) > 0)
      .sort((a, b) => lechCo(canMau.get(a.id)!) - lechCo(canMau.get(b.id)!)).slice(0, 12);
    type ToHop = { ds: [string, number][]; lech: number; dt: number };
    const toHop: ToHop[] = [];
    const duyet = (i: number, chon: [string, number][], dt: number, n: number) => {
      if (chon.length && dt >= dtMin - 1e-6 && dt <= dtMax + 1e-6) {
        const dem = coCauRong();
        for (const [id, c] of chon) for (const l of Object.keys(dem) as LoaiCan[]) dem[l] += c * canMau.get(id)![l];
        toHop.push({ ds: chon.slice(), lech: lechCo(dem), dt });
      }
      if (chon.length >= 3) return;
      for (let k = i; k < ung.length; k++) {
        const { dt: d, nMax: nm } = chanMau.get(ung[k].id)!;
        for (let c = 1; c <= Math.min(nm, 6) && n + c <= 8 && dt + c * d <= dtMax + 1e-6; c++) duyet(k + 1, [...chon, [ung[k].id, c]], dt + c * d, n + c);
      }
    };
    duyet(0, [], 0, 0);
    toHop.sort((a, b) => a.lech - b.lech || b.dt - a.dt);
    // giữ các tổ hợp tốt nhất, khác nhau về tập mẫu hoặc số tòa
    const giu: ToHop[] = [], thay = new Set<string>();
    for (const h of toHop) {
      const k = h.ds.map((m) => m.join('×')).join('+');
      if (thay.has(k)) continue;
      thay.add(k); giu.push(h);
      if (giu.length >= 6) break;
    }
    for (const h of giu) {
      const thu = (nNeo: Diem) => {
        let dat: Dat[] = [];
        for (const [id, c] of h.ds.slice().sort((a, b) => chanMau.get(b[0])!.dt - chanMau.get(a[0])!.dt)) {
          dat = xepThamLam(uvTheoMau.get(id) ?? [], nNeo, dat, chanMau.get(id)!.dt, false, c);
        }
        return dat;
      };
      const [a, b] = [thu(neo.tam), thu(neo.goc)];
      const dat = b.length > a.length ? b : a;
      const g = cham(dat, `mt×${h.ds.map((m) => m.join('×')).join('+')}`);
      if (!g) continue;
      const duKienN = h.ds.reduce((s, [, c]) => s + c, 0);
      g.theoMucTieu = {
        duKien: h.ds, thieuToa: Math.max(0, duKienN - dat.length), dtxdPct: g.matDo,
        thieuDtxd: Math.max(0, (minPct * ct.matDoMax) / 100 - g.matDo),
      };
      ketQua.push(g);
    }
  }
  yield { xong: mauDs.length + 1, tong: mauDs.length + 1 };
  // xếp hạng: đạt QH → ít căn vượt PCCC → điểm; bỏ trùng số liệu. THEO MỤC TIÊU: đạt QH → lệch cơ cấu + phần thiếu DTXD → PCCC → điểm
  const diemMT = (g: GoiYXep) => g.lech + 2 * (g.theoMucTieu ? g.theoMucTieu.thieuDtxd : Math.max(0, (minPct * ct.matDoMax) / 100 - g.matDo));
  if (v.theoMucTieu) ketQua.sort((a, b) => a.loiQH - b.loiQH || diemMT(a) - diemMT(b) || (a.pcccVuot ?? 99) - (b.pcccVuot ?? 99) || b.diem - a.diem);
  else ketQua.sort((a, b) => a.loiQH - b.loiQH || (a.pcccVuot ?? 99) - (b.pcccVuot ?? 99) || b.diem - a.diem);
  // bỏ trùng số liệu trong cùng kiểu; giữ phương án đầu của mỗi kiểu bố cục để danh sách đa dạng, phần còn lại theo hạng
  const daCo = new Set<string>(), khac: GoiYXep[] = [];
  for (const g of ketQua) {
    if (v.kieuBoCuc?.length && !v.kieuBoCuc.includes(g.kieu)) continue;
    const k = `${g.kieu}|${g.mau.map((m) => m.join('×')).join('+')}|${g.soTangDH}|${g.soCan}`;
    if (!daCo.has(k)) { daCo.add(k); khac.push(g); }
  }
  const chon = new Set<GoiYXep>(khac.slice(0, 1));
  if (!v.theoMucTieu) for (const kieu of DS_KIEU_BO_CUC) { const g = khac.find((x) => x.kieu === kieu); if (g && chon.size < soGoiY) chon.add(g); }
  for (const g of khac) { if (chon.size >= soGoiY) break; chon.add(g); }
  const top = khac.filter((g) => chon.has(g));
  // điểm view đúng số tầng của từng phương án trả về (xếp hạng dùng ước ở số tầng trần)
  for (const g of top) {
    const dat = g.toa.map((x) => ({ mauId: x.mauId, x: x.x, y: x.y, goc: x.gocDo, F: chanToa(tv.toa.get(x.mauId)!, x), r: 0 }));
    const vd = viewDung(dat, g.soTangDH);
    g.view = vd.tb; g.viewTot = vd.tot;
  }
  return top;
}

/** Chạy đồng bộ (test, máy chủ). */
export function goiYXepToa(v: DauVaoXep): GoiYXep[] {
  const g = sinhGoiY(v);
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}

/** Thư gửi worker gợi ý (tinh/goiYXep.worker.ts): `tv` chỉ gửi khi worker chưa có đúng thư viện này. */
export type ThuGoiY = { id: number; v: Omit<DauVaoXep, 'tv'>; tv?: ThuVien };
export type ThuGoiYVe = { id: number; xong?: number; tong?: number; ds?: GoiYXep[]; loi?: string };

let workerGoiY: Worker | null = null, tvCuaWorker: ThuVien | null = null, soIdGoiY = 0;
let huyLuotGoiY: (() => void) | null = null;
const taoWorkerGoiY = (): Worker | null => {
  if (typeof Worker === 'undefined') return null;
  try {
    return new Worker(new URL('./goiYXep.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
};

/**
 * Chạy trên trình duyệt. Có Worker: chạy hẳn trong worker (lô lớn như CT-2 36 000 m² mỗi mẫu tốn hàng trăm ms – vài giây,
 * nhả luồng giữa các mẫu vẫn đứng giao diện); `huy()` được hỏi mỗi lần nhận tiến độ và mỗi 100 ms — true thì terminate worker, trả null.
 * Không có Worker (vitest / node): chạy trên luồng chính, nhả luồng sau mỗi mẫu như cũ.
 */
export async function goiYXepToaNen(v: DauVaoXep, tienDo?: (xong: number, tong: number) => void, huy?: () => boolean, sinh: (v: DauVaoXep) => Generator<{ xong: number; tong: number }, GoiYXep[]> = sinhGoiY): Promise<GoiYXep[] | null> {
  huyLuotGoiY?.(); // lượt cũ còn chạy: giết worker, lượt cũ trả null — chỉ giữ lượt mới nhất
  if (!workerGoiY) { workerGoiY = taoWorkerGoiY(); tvCuaWorker = null; }
  const w = workerGoiY;
  if (w) {
    const id = ++soIdGoiY;
    const { tv, ...con } = v;
    const thu: ThuGoiY = { id, v: con };
    if (tvCuaWorker !== tv) { thu.tv = tv; tvCuaWorker = tv; }
    return new Promise((xong, hong) => {
      const ket = (giet: boolean) => {
        clearInterval(hoi);
        w.onmessage = null;
        w.onerror = null;
        huyLuotGoiY = null;
        if (giet) { w.terminate(); if (workerGoiY === w) workerGoiY = null; }
      };
      const huyNgay = () => { ket(true); xong(null); };
      huyLuotGoiY = huyNgay;
      const hoi = setInterval(() => { if (huy?.()) huyNgay(); }, 100);
      w.onmessage = (e: MessageEvent<ThuGoiYVe>) => {
        const m = e.data;
        if (m.id !== id) return;
        if (huy?.()) return huyNgay();
        if (m.loi !== undefined) { ket(true); hong(new Error(m.loi.split('\n')[0])); return; }
        if (m.ds) { ket(false); xong(m.ds); return; }
        if (m.xong !== undefined) tienDo?.(m.xong, m.tong ?? 0);
      };
      w.onerror = () => { ket(true); hong(new Error('goiYXep worker')); };
      w.postMessage(thu);
    });
  }
  const g = sinh(v);
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
    tienDo?.(r.value.xong, r.value.tong);
    await new Promise((ok) => setTimeout(ok, 0));
    if (huy?.()) return null;
  }
}
