/**
 * TỦ HỌNG NƯỚC CHỮA CHÁY (tủ PCCC) — chép bộ đặt tủ app cũ MDI_Unitmix_v4 (prototype/shell.src.html `tuCC0` · `tccToiUu` ·
 * `tccKhoi` · `tccBam` · `tccTachGop` · `tccTruM2` · `tccChanCua`, QT-77 / 77e / 77f / 77g). Hàm thuần, cùng thứ tự / ưu tiên:
 *
 *  - Điểm phải phủ: cửa căn + góc trong căn (lùi 150 mép bên / 150 tường HL / 300 tường ngoài; căn góc V = đỉnh khung) + tim
 *    hành lang mỗi 3 m. BÁN KÍNH 18 m ĐO THẲNG (chủ nhiệm chốt 20/10/2026 theo thẩm duyệt PC07 Đồng Quan), không cộng tầm tia.
 *  - Số tia (QCVN 06:2022 Bảng 11, 5.2.4, 5.2.11): ≤ 16 tầng HL > 10 m 2 tia; 17–25 tầng 2 / 3; > 25 tầng 2 (chủ nhiệm) → mỗi
 *    điểm cần `can` = 1 hoặc 2 tia. Tủ đơn 500 × 200 cấp 1 tia; tủ đôi (lõi) / cụm 2 hộp 800 × 200 cấp đủ `can`.
 *  - Ứng viên theo ưu tiên: (1) tường lõi quay ra HL trước phòng KT / KTĐ / KTN (tủ đôi) · (2) hộp kỹ thuật căn giáp HL (TH1, không
 *    trừ DT) · (3) sát tường ngăn hai căn (TH3 chữ L, trừ DT) · (4) giữa tường căn cách ranh ≥ 350 (TH2 chữ U, trừ DT). Không đặt
 *    trước cửa căn / cửa thang (≥ ½ tủ + 450 + 150), cạnh nét cửa CAD (≥ ½ tủ + 500), vách BT thang máy (≥ 1,6 m), đầu cột ranh căn.
 *  - Chọn ÍT HỘP NHẤT phủ đủ tia: tham lam (lợi / ưu tiên, dàn tủ ≥ 3 m) làm cận trên, rồi nhánh–cận chính xác: chi phí = 100.000 ×
 *    số hộp + 10.000 × cửa ngăn cháy lý tưởng bị chắn (QT-77f "tủ né chỗ cửa") + 5.000 × m² DT thông thủy phải trừ + 10 × ưu tiên.
 *  - Đánh số TCC-01… theo đường hành lang (đoạn trục → vị trí dọc đoạn).
 *  - Tủ kéo tay (QT-77e): danh sách [x, y, nhãn?] — bám lại tường HL (`bamTuongTu`), chỉ tính phủ; nhãn "don" = đã tách, "gop" = đã gộp.
 *
 * Toạ độ mm thế giới như toa.json. Dữ liệu mẫu căn: `can.json` trường `tcc` (scripts/sinh_phai_sinh_can.py).
 */
import type { CanMau, Diem, ThuVien } from './kieu';
import KHOI_TU from '../../public/lib/pccc.json';

// ---------- hằng số app cũ ----------
export const TCC_BAN = 18000;
const TCC_CUA = 450, TCC_LE = 430, TCC_MEP = 100, TCC_GIAN = 3000, TCC_NUT = 500000, COT = 350, CNC_HO = 100;
export type LoaiTu = 'doi' | 'don' | 'cum';
export const TCC_LOAI: Record<LoaiTu, { rong: number; sau: number; ten: string }> = {
  doi: { rong: 800, sau: 200, ten: 'tủ đôi' }, don: { rong: 500, sau: 200, ten: 'tủ đơn' }, cum: { rong: 800, sau: 200, ten: 'cụm 2 hộp đơn' },
};
const tccTuong = (l: LoaiTu) => TCC_LOAI[l].rong + TCC_LE;
/** Block CAD tủ (data/dwg/tu-pccc.dwg → pccc.json): y = 0 mặt tường HL, y < 0 vào trong tường. */
export type KhoiTuCAD = { rong: number; sau: number; than: Diem[][]; net: Diem[][]; tuong_day: number; ht_day: number; dt_sau: number };
export const KHOI_TCC = (KHOI_TU as unknown as { khoi: Record<string, KhoiTuCAD> }).khoi;
export const tenKhoiTu = (l: LoaiTu) => (l === 'don' ? 'pccc-500x200' : 'pccc-800x200');

// ---------- vector ----------
const cong = (a: Diem, b: Diem): Diem => [a[0] + b[0], a[1] + b[1]];
const tru = (a: Diem, b: Diem): Diem => [a[0] - b[0], a[1] - b[1]];
const nhan = (a: Diem, s: number): Diem => [a[0] * s, a[1] * s];
const kc = (a: Diem, b: Diem) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const trongDa = (p: Diem, P: Diem[]) => {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};

// ---------- đầu vào ----------
/** Nét mẫu căn cho bộ đặt tủ (can.json `tcc`, x chuẩn hoá chưa lật, y chuẩn hoá theo chiều sâu). */
export type VeTCC = { tuong: [number, number, number, number][]; hkt: { o: [number, number, number, number]; cheo: [number, number][] }[]; cua: [number, number][] };
/** Một căn dọc hành lang: gốc `o` trên mặt tường HL, `u` dọc mặt, `n` vào trong căn; `w` rộng, `d` sâu (mm). */
export type CanTCC = { so: number; o: Diem; u: Diem; n: Diem; w: number; d: number; lat: boolean; cua: Diem; khung?: Diem[]; ve?: VeTCC | null };
/** Lõi: đường bao (BAO-TM), nét cửa, tâm giếng thang máy, phòng KT (tên + tâm) — toạ độ thế giới. */
export type LoiTCC = { bien: Diem[]; cua: Diem[]; gieng: Diem[]; phong: { ten: string; P: Diem }[] };
/** Cửa ngăn cháy lý tưởng (chưa có tủ) — để tủ né chỗ cửa (QT-77f). */
export type CuaLT = { p: Diem; u: Diem; w: number; bu: number[] | null };
/** Tủ đặt tay: [x, y] hoặc [x, y, "don" | "gop"]. */
export type TuTay = [number, number] | [number, number, 'don' | 'gop'];
export type DauVaoTCC = {
  /** cạnh đồ thị hành lang (tim, mm) — cùng thứ tự app cũ dtHanhLang (trục → chẻ tại mốc) */
  canh: { p0: Diem; p1: Diem; L: number }[];
  /** trục hành lang nguyên (g.axes) — điểm hành lang phải phủ lấy mỗi 3 m dọc từng trục */
  truc: { p0: Diem; p1: Diem }[];
  /** bề rộng hành lang mặc định loại hình (S.corr: TM 1800 · NOXH 1600) */
  corr: number;
  can: CanTCC[];
  /** thang bộ: ô (vật cản đoạn tủ → tim HL) + tim cửa buồng đệm */
  thang: { vien: Diem[]; cua: Diem | null }[];
  loi: LoiTCC[];
  /** số tầng căn hộ (Bảng 11) */
  soTang: number;
  cuaLT?: CuaLT[];
  tay?: TuTay[] | null;
};

// ---------- đồ thị: chiếu điểm lên cạnh gần nhất (dtHanhLang.chieu — mọi cạnh, kể cả đoạn nối) ----------
export type ChieuTCC = { e: number; di: number; q: Diem; d: number; huong: Diem };
export function chieuCanh(canh: DauVaoTCC['canh'], p: Diem): ChieuTCC | null {
  let best: ChieuTCC | null = null;
  canh.forEach((e, k) => {
    const sx = e.p1[0] - e.p0[0], sy = e.p1[1] - e.p0[1], L2 = sx * sx + sy * sy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - e.p0[0]) * sx + (p[1] - e.p0[1]) * sy) / L2));
    const q: Diem = [e.p0[0] + sx * t, e.p0[1] + sy * t], d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (!best || d < best.d) best = { e: k, di: t * e.L, d, q, huong: [sx / Math.sqrt(L2), sy / Math.sqrt(L2)] };
  });
  return best;
}

/** Bảng 11 + 5.2.4 (tccSoTia): số tia tính toán và số tia phủ mỗi điểm. */
export function soTiaTCC(soTang: number, LhlMm: number) {
  const n = soTang || 1, dai = LhlMm > 10000;
  const tia = n <= 16 ? (dai ? 2 : 1) : n <= 25 ? (dai ? 3 : 2) : 2;
  return { soTia: tia, can: tia >= 2 ? 2 : 1, dong: n <= 16 ? '≤ 16 tầng' : n <= 25 ? '17–25 tầng' : '> 25 tầng (chủ nhiệm chốt 2 tia)' };
}

/** DT thông thủy căn phải trừ (m²) vì tường xây sau lưng tủ: TH2 chữ U / TH3 chữ L (tccTruM2). */
export function truM2(loai: LoaiTu, kieu: KieuTu, tHL: number | null) {
  if (kieu !== 'U' && kieu !== 'L') return 0;
  const K = TCC_LOAI[loai], b = KHOI_TCC[tenKhoiTu(loai)] ?? { tuong_day: 80, ht_day: 15, dt_sau: 295 }, td = b.tuong_day + b.ht_day;
  const sau = b.dt_sau - ((tHL != null ? tHL : 140) + b.ht_day), rong = K.rong + (kieu === 'U' ? 2 : 1) * td;
  return Math.max(0, rong * sau) / 1e6;
}
const loaiUu = (uu: number, can: number): LoaiTu => (uu === 1 ? 'doi' : can >= 2 ? 'cum' : 'don');
const loaiTay = (uu: number, can: number, nhan?: string): LoaiTu => (nhan === 'don' ? 'don' : nhan === 'gop' ? (uu === 1 ? 'doi' : 'cum') : loaiUu(uu, can));

export type KieuTu = 'loi' | 'hkt' | 'L' | 'U';
export type TruDT = { so: number; m2: number; kieu: KieuTu; tHL?: number };
type UngVien = {
  W: Diem; pr: ChieuTCC; uu: number; ten: string; loai: LoaiTu; kieu: KieuTu; tru: TruDT | null; nganW: Diem | null;
  xc?: number; tay?: boolean; vuong?: boolean; iTay?: number;
};
export type TuPCCC = {
  so: string; W: Diem; huong: Diem; vao: Diem; uu: number; ten: string; loai: LoaiTu; kieu: KieuTu; tru: TruDT | null; nganW: Diem | null;
  nPhu: number; xa: { so: number | null; p: Diem; tong: number } | null; tay: boolean; vuong: boolean; iTay?: number;
};
export type KetQuaTCC = {
  tu: TuPCCC[]; can: number; soTia: number; dong: string; Lhl: number; ban: number; tay: boolean;
  /** số căn chưa đủ tia (cửa / góc ngoài bán kính); `thieuHL` = điểm hành lang thiếu */
  thieu: number[]; thieuHL: boolean; thieuDiem: { p: Diem; so: number | null }[];
  hop: number; soTham: number; nut: number; soUng: number; soDiem: number;
  truDT: { so: string; can: number; kieu: KieuTu; m2: number }[];
  /** bài phủ (ứng viên + ma trận) — test kiểm tối ưu */
  bai?: { ung: UngVien[]; phu: boolean[][] };
};

/** tccChanCua: số cửa lý tưởng mà tủ tại W (loại `loai`) chắn vùng quét. */
const chanCua = (W: Diem, loai: LoaiTu, ds: CuaLT[]) => ds.filter((x) => {
  const d = tru(W, x.p), doc = Math.abs(d[0] * x.u[0] + d[1] * x.u[1]), ngang = Math.abs(-d[0] * x.u[1] + d[1] * x.u[0]);
  return ngang <= Math.max(x.w / 2, ...(x.bu ?? [0])) + 1600 && doc < x.w / 2 + TCC_LOAI[loai].rong / 2 + CNC_HO;
}).length;

/** tccBam: bám điểm p lên tường hành lang gần nhất; sát đường bao lõi (≤ 300 mm) là tủ lõi. Xa tim quá ½ HL + 3 m → null. */
export function bamTuongTu(v: Pick<DauVaoTCC, 'canh' | 'corr' | 'loi'>, p: Diem): { W: Diem; pr: ChieuTCC; uu: number } | null {
  const corr = v.corr || 1800, pr = chieuCanh(v.canh, p);
  if (!pr || pr.d > corr / 2 + 3000) return null;
  const n: Diem = [-pr.huong[1], pr.huong[0]], s = (p[0] - pr.q[0]) * n[0] + (p[1] - pr.q[1]) * n[1] < 0 ? -1 : 1;
  const W0 = cong(pr.q, nhan(n, (s * corr) / 2)), W: Diem = [Math.round(W0[0]), Math.round(W0[1])], prW = chieuCanh(v.canh, W) ?? pr;
  let kb = Infinity;
  for (const L of v.loi) {
    const P = L.bien;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], c = P[(i + 1) % P.length], dx = c[0] - a[0], dy = c[1] - a[1], L2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((W[0] - a[0]) * dx + (W[1] - a[1]) * dy) / L2));
      kb = Math.min(kb, Math.hypot(W[0] - a[0] - t * dx, W[1] - a[1] - t * dy));
    }
  }
  return { W, pr: prW, uu: kb <= 300 ? 1 : 3 };
}

/** Điểm phải bảo vệ của một căn: [cửa, …góc trong căn] (tccDiemCan). */
export function diemCanTCC(c: CanTCC): Diem[] {
  const goc = c.khung && c.khung.length > 2 ? c.khung
    : ([[150, 150], [c.w - 150, 150], [c.w - 150, c.d - 300], [150, c.d - 300]] as Diem[]).map(([x, y]) => cong(cong(c.o, nhan(c.u, x)), nhan(c.n, y)));
  return [c.cua, ...goc];
}
const bienCan = (c: CanTCC): Diem[] => c.khung && c.khung.length > 2 ? c.khung
  : [c.o, cong(c.o, nhan(c.u, c.w)), cong(cong(c.o, nhan(c.u, c.w)), nhan(c.n, c.d)), cong(c.o, nhan(c.n, c.d))];

// ---------- phủ nhiều tia chính xác (tccToiUu) ----------
export function toiUuPhu(ung: UngVien[], phu: boolean[][], tham: number[], can: number): { chon: number[] | null; nut: number } {
  const nU = ung.length, nM = (phu[0] || []).length;
  if (!nU || !nM) return { chon: null, nut: 0 };
  can = can || 2;
  const hop = (i: number) => (ung[i].loai === 'don' ? 1 : 2);
  const wt = (o: UngVien) => (o.uu === 1 ? 1 : o.uu === 1.15 ? 1.15 : 2.2);
  const tiaA = ung.map((o) => (o.loai === 'don' ? 1 : can)), giaA = ung.map((o, i) => 100000 * hop(i) + 10000 * (o.xc || 0) + 5000 * (o.tru?.m2 || 0) + 10 * wt(o));
  const tia = (i: number) => tiaA[i], gia = (i: number) => giaA[i];
  const diem: { c: number[]; d: number }[] = [];
  for (let j = 0; j < nM; j++) {
    const c: number[] = [];
    let cap = 0;
    for (let i = 0; i < nU; i++) if (phu[i][j]) { c.push(i); cap += tia(i); }
    if (c.length) diem.push({ c, d: Math.min(can, cap) });
  }
  diem.sort((a, b) => a.c.length - b.c.length || a.c.join().localeCompare(b.c.join()));
  const giu: { c: number[]; d: number }[] = [];
  diem.forEach((p) => { const S1 = new Set(p.c); if (!giu.some((q) => q.d === p.d && q.c.every((i) => S1.has(i)))) giu.push(p); });
  const R = giu.length, cv: number[][] = ung.map(() => []);
  giu.forEach((p, k) => p.c.forEach((i) => cv[i].push(k)));
  const xung = ung.map((o, i) => ung.map((q, k) => (k !== i && !(o.loai === 'don' && q.loai === 'don') && Math.hypot(o.W[0] - q.W[0], o.W[1] - q.W[1]) < TCC_GIAN ? k : -1)).filter((k) => k >= 0));
  const giaLoi = (ds: number[]) => ds.reduce((a, i) => a + gia(i), 0);
  let tot: number[] | null = null, totGia = Infinity;
  const thamOk = giu.every((p) => p.c.reduce((s2, i) => s2 + (tham.includes(i) ? tia(i) : 0), 0) >= p.d) && !tham.some((i) => xung[i].some((k) => tham.includes(k)));
  if (thamOk) totGia = giaLoi(tham);
  const rem = Int8Array.from(giu.map((p) => p.d)), cam = new Uint16Array(nU), da: number[] = [];
  let nut = 0, Dsum = giu.reduce((a, p) => a + p.d, 0);
  const giam = (i: number) => { let r = 0; const t = tia(i); for (const k of cv[i]) r += Math.min(rem[k], t); return r; };
  const dfs = (gia0: number): void => {
    if (++nut > TCC_NUT) return;
    if (Dsum <= 0) { if (gia0 < totGia - 1e-9) { totGia = gia0; tot = da.slice(); } return; }
    let bp = -1, bn = Infinity;
    for (let k = 0; k < R; k++) {
      if (rem[k] <= 0) continue;
      let n = 0, cap = 0;
      for (const i of giu[k].c) if (!cam[i]) { n++; cap += tia(i); }
      if (cap < rem[k]) return;
      if (n < bn) { bn = n; bp = k; }
    }
    let br = 0;
    for (let i = 0; i < nU; i++) if (!cam[i]) { const r = giam(i); if (r > 0) { const q = r / gia(i); if (q > br) br = q; } }
    if (!br || gia0 + Dsum / br >= totGia - 1e-9) return;
    const nh = giu[bp].c.filter((i) => !cam[i]).map((i) => ({ i, q: giam(i) / gia(i) })).sort((a, b) => b.q - a.q || a.i - b.i);
    const boQua: number[] = [];
    for (const { i } of nh) {
      const t = tia(i), luu = cv[i].map((k) => { const d = Math.min(rem[k], t); rem[k] -= d; Dsum -= d; return d; });
      cam[i]++; xung[i].forEach((k) => cam[k]++); da.push(i);
      dfs(gia0 + gia(i));
      da.pop(); xung[i].forEach((k) => cam[k]--);
      cv[i].forEach((k, z) => { rem[k] += luu[z]; Dsum += luu[z]; });
      boQua.push(i);
      if (nut > TCC_NUT) break;
    }
    boQua.forEach((i) => cam[i]--);
  };
  dfs(0);
  const kq = tot as number[] | null;
  return { chon: kq && (!thamOk || totGia < giaLoi(tham) - 1e-9) ? kq : null, nut };
}

// ---------- tuCC0 ----------
export function datTuPCCC(v: DauVaoTCC, chiTietBai = false): KetQuaTCC {
  const corr = v.corr || 1800, canh = v.canh;
  const Lhl = canh.reduce((t, e) => t + e.L, 0);
  const st = soTiaTCC(v.soTang, Lhl), can = st.can;
  const kq: KetQuaTCC = {
    tu: [], can, soTia: st.soTia, dong: st.dong, Lhl, ban: TCC_BAN, tay: false, thieu: [], thieuHL: false, thieuDiem: [],
    hop: 0, soTham: 0, nut: 0, soUng: 0, soDiem: 0, truDT: [],
  };
  if (!canh.length) return kq;
  const G = (p: Diem) => chieuCanh(canh, p);
  // --- điểm phải phủ ---
  const muc: { loai: 'can' | 'hl'; so: number | null; p: Diem; cua?: boolean }[] = [];
  for (const c of v.can) {
    if (!G(c.cua)) continue;
    diemCanTCC(c).forEach((q, k) => muc.push({ loai: 'can', so: c.so, p: q, cua: k === 0 }));
  }
  // điểm hành lang mỗi 3 m trên từng trục nguyên (app cũ: g.axes)
  for (const e of v.truc) {
    const L = Math.hypot(e.p1[0] - e.p0[0], e.p1[1] - e.p0[1]);
    for (let s = 0; s <= L; s += 3000) { const p = cong(e.p0, nhan(tru(e.p1, e.p0), s / (L || 1))); if (G(p)) muc.push({ loai: 'hl', so: null, p }); }
  }
  // --- ứng viên ---
  const ung: UngVien[] = [];
  const gocCan = v.can.flatMap((c) => [c.o, cong(c.o, nhan(c.u, c.w))]);
  const hang = (q: UngVien) => (q.tru?.m2 || 0) * 10 + q.uu;
  const them = (W: Diem, pr: ChieuTCC | null, uu: number, ten: string, o: { loai?: LoaiTu; kieu?: KieuTu; tru?: TruDT | null; nganW?: Diem | null; boGoc?: boolean } = {}) => {
    if (!pr) return;
    const loai = o.loai || loaiUu(uu, can);
    if (uu !== 1 && !o.boGoc && gocCan.some((q) => Math.hypot(q[0] - W[0], q[1] - W[1]) < TCC_LOAI[loai].rong / 2 + 350 - 1)) return;
    const moi: UngVien = { W, pr, uu, ten, loai, kieu: o.kieu || (uu === 1 ? 'loi' : 'U'), tru: o.tru || null, nganW: o.nganW || null };
    const k = ung.findIndex((q) => q.loai === loai && Math.hypot(q.W[0] - W[0], q.W[1] - W[1]) < Math.max(tccTuong(loai), tccTuong(q.loai)));
    if (k >= 0) { if (hang(ung[k]) <= hang(moi)) return; ung.splice(k, 1); }
    ung.push(moi);
  };
  const cuaMoi: Diem[] = [...v.can.map((c) => c.cua), ...v.thang.map((t) => t.cua).filter((p): p is Diem => !!p)];
  const khoi: Diem[][] = [...v.can.map(bienCan), ...v.thang.map((t) => t.vien), ...v.loi.map((k) => k.bien)];
  const doanTrong = (W: Diem, q: Diem) => [0.25, 0.5, 0.75].every((t) => { const m = cong(W, nhan(tru(q, W), t)); return !khoi.some((P) => trongDa(m, P)); });
  // nét cửa thật của căn phía hành lang (sâu ≤ 1,5 m)
  const netCua: Diem[] = [];
  for (const c of v.can) for (const [x0, y0] of c.ve?.cua ?? []) {
    if (y0 * c.d > 1500) continue;
    const x = c.lat ? c.w - x0 * c.w : x0 * c.w;
    netCua.push(cong(cong(c.o, nhan(c.u, x)), nhan(c.n, y0 * c.d)));
  }
  const xaCua = (W: Diem, loai: LoaiTu) => !cuaMoi.some((q) => kc(q, W) < TCC_LOAI[loai].rong / 2 + TCC_CUA + 150)
    && !netCua.some((q) => kc(q, W) < TCC_LOAI[loai].rong / 2 + 500);
  // (1) trục kỹ thuật trong LÕI
  for (const k of v.loi) {
    const ktP = k.phong.filter((ph) => /^KT/i.test(ph.ten || ''));
    for (const o of ktP) {
      let best: { W: Diem; pr: ChieuTCC; d: number } | null = null;
      const P2 = k.bien;
      for (let e = 0; e < P2.length; e++) {
        const A = P2[e], B = P2[(e + 1) % P2.length], L = Math.hypot(B[0] - A[0], B[1] - A[1]);
        const bien1 = TCC_LOAI.doi.rong / 2 + 300;
        if (L < 2 * bien1) continue;
        let t = ((o.P[0] - A[0]) * (B[0] - A[0]) + (o.P[1] - A[1]) * (B[1] - A[1])) / (L * L);
        t = Math.max(bien1 / L, Math.min(1 - bien1 / L, t));
        const W = cong(A, nhan(tru(B, A), t)), d = kc(W, o.P);
        if (d > 3000) continue;
        const pr = G(W);
        if (!pr || Math.abs(pr.d - corr / 2) > 150) continue;
        if (!doanTrong(W, pr.q)) continue;
        if (k.cua.some((q) => kc(q, W) < TCC_LOAI.doi.rong / 2 + 300)) continue;
        if (k.gieng.some((q) => kc(q, W) < 1600)) continue;
        if (!xaCua(W, 'doi')) continue;
        if (!best || d < best.d) best = { W, pr, d };
      }
      if (best) them(best.W, best.pr, 1, o.ten);
    }
  }
  // (2)–(4) tường hành lang của CĂN
  for (const c of v.can) {
    const ve = c.ve;
    if (!ve) continue;
    const xLoc = (x: number) => (c.lat ? c.w - x * c.w : x * c.w);
    const doc: [number, number, number][] = [], ngang: [number, number, number][] = [];
    for (const [x1, y1, x2, y2] of ve.tuong) {
      const xa = xLoc(x1), xb = xLoc(x2), ya = y1 * c.d, yb = y2 * c.d;
      if (Math.abs(xa - xb) < 2) doc.push([xa, Math.min(ya, yb), Math.max(ya, yb)]);
      else if (Math.abs(ya - yb) < 2) ngang.push([Math.min(xa, xb), Math.max(xa, xb), ya]);
    }
    const dau = doc.filter((z) => z[1] <= 5 && z[2] >= 100), d0 = dau.filter((z) => z[0] <= 600).map((z) => z[0]), d1 = dau.filter((z) => z[0] >= c.w - 600).map((z) => z[0]);
    const mt0 = d0.length ? Math.max(...d0) : 150, mt1 = d1.length ? Math.min(...d1) : c.w - 150;
    const tHL = (a: number) => { const ys = ngang.filter((z) => z[2] >= 60 && z[2] <= 400 && z[0] <= a + 1 && z[1] >= a - 1).map((z) => z[2]); return ys.length ? Math.min(...ys) : 140; };
    const vachBT = (a: number, r: number) => ngang.some((z) => z[2] > 200 && z[2] <= 400 && z[0] < a + r - 1 && z[1] > a - r + 1);
    const tren = (a: number, uu: number, ten: string, o: { loai: LoaiTu; kieu: KieuTu; ben?: number }) => {
      const loai = o.loai, r = TCC_LOAI[loai].rong / 2;
      if (o.kieu === 'U' && (a < r + COT || a > c.w - r - COT)) return;
      if (vachBT(a, r)) return;
      if (a - r < mt0 - 1 || a + r > mt1 + 1) return;
      const W = cong(c.o, nhan(c.u, a)), pr = G(W);
      if (!pr || Math.abs(pr.d - corr / 2) > TCC_MEP) return;
      if (!xaCua(W, loai) || !doanTrong(W, pr.q)) return;
      const th = tHL(a);
      them(W, pr, uu, ten, { loai, kieu: o.kieu, boGoc: o.kieu !== 'U', tru: { so: c.so, m2: truM2(loai, o.kieu, th), kieu: o.kieu, tHL: th },
        nganW: o.ben ? cong(c.o, nhan(c.u, o.ben < 0 ? mt0 : mt1)) : null });
    };
    const loaiT: LoaiTu = can >= 2 ? 'cum' : 'don';
    for (const h of ve.hkt) {
      const [nx0, nx1, ny0, ny1] = h.o;
      const xs = [xLoc(nx0), xLoc(nx1)], x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = ny0 * c.d, y1 = ny1 * c.d;
      const cheo = h.cheo.some(([a, b]) => Math.abs(Math.min(xLoc(a), xLoc(b)) - x0) < 5 && Math.abs(Math.max(xLoc(a), xLoc(b)) - x1) < 5);
      if (!cheo || y0 > 600) continue;
      const sp = (z: [number, number, number]) => z[1] <= y1 + 5 && z[2] >= y0 - 5;
      const tr = doc.filter((z) => sp(z) && z[0] >= x0 - 260 && z[0] <= x0 + 1).map((z) => z[0]), ph = doc.filter((z) => sp(z) && z[0] >= x1 - 1 && z[0] <= x1 + 260).map((z) => z[0]);
      const ox0 = Math.max(mt0, tr.some((x) => Math.abs(x - x0) < 2) ? x0 : tr.length ? Math.min(...tr) : x0);
      const ox1 = Math.min(mt1, ph.some((x) => Math.abs(x - x1) < 2) ? x1 : ph.length ? Math.max(...ph) : x1);
      const rong = ox1 - ox0, loai: LoaiTu | null = rong >= TCC_LOAI[loaiT].rong - 1 ? loaiT : rong >= TCC_LOAI.don.rong - 1 ? 'don' : null;
      if (!loai) continue;
      const r = TCC_LOAI[loai].rong / 2, a = ox0 <= mt0 + 5 ? ox0 + r : ox1 >= mt1 - 5 ? ox1 - r : (ox0 + ox1) / 2;
      tren(a, 1.15, `HKT ${c.so}`, { loai, kieu: 'hkt' });
    }
    tren(mt0 + TCC_LOAI[loaiT].rong / 2, 2, `tường ngăn ${c.so}`, { loai: loaiT, kieu: 'L', ben: -1 });
    tren(mt1 - TCC_LOAI[loaiT].rong / 2, 2, `tường ngăn ${c.so}`, { loai: loaiT, kieu: 'L', ben: 1 });
    for (let a = 0; a <= c.w; a += 250) tren(a, 3, `tường ${c.so}`, { loai: loaiT, kieu: 'U' });
  }
  // --- tủ kéo tay ---
  const tay = !!v.tay?.length;
  if (tay) {
    const ung0 = ung.slice();
    ung.length = 0;
    v.tay!.forEach((p, iTay) => {
      const b = bamTuongTu(v, [p[0], p[1]]);
      if (!b) return;
      const loai = loaiTay(b.uu, can, p[2]);
      let gan: UngVien | null = null, kcG = 401;
      ung0.forEach((q) => { const d = kc(q.W, b.W); if (q.loai === loai && d < kcG) { kcG = d; gan = q; } });
      let kieu: KieuTu = b.uu === 1 ? 'loi' : 'U', truD: TruDT | null = null;
      const g = gan as UngVien | null;
      if (g) { kieu = g.kieu; truD = g.tru; }
      else if (b.uu !== 1) {
        const vao = tru(b.W, b.pr.q), Lv = Math.hypot(vao[0], vao[1]) || 1, q = cong(b.W, nhan(vao, 400 / Lv));
        const cc = v.can.find((c) => trongDa(q, bienCan(c)));
        if (cc) truD = { so: cc.so, m2: truM2(loai, 'U', 140), kieu: 'U' };
      }
      ung.push({ W: b.W, pr: b.pr, uu: b.uu, ten: 'kéo tay', iTay, loai, kieu, tru: truD, nganW: g?.nganW ?? null, tay: true, vuong: !xaCua(b.W, loai) });
    });
  }
  // --- ma trận phủ: đường thẳng ≤ 18 m ---
  const phu = ung.map((o) => muc.map((t) => Math.hypot(t.p[0] - o.W[0], t.p[1] - o.W[1]) <= TCC_BAN));
  const moiTu = (o: UngVien) => (o.loai === 'don' ? 1 : can);
  const con = muc.map(() => can);
  let chon: number[] = [];
  const sat = (i: number) => chon.some((c) => kc(ung[c].W, ung[i].W) < TCC_GIAN);
  const tru1 = (i: number) => { const m = moiTu(ung[i]); phu[i].forEach((ok, j) => { if (ok) con[j] = Math.max(0, con[j] - m); }); };
  if (tay) { chon = ung.map((_, i) => i); chon.forEach(tru1); }
  else for (;;) {
    let bi = -1, bv = 0;
    for (const choSat of [false, true]) {
      ung.forEach((o, i) => {
        if (chon.includes(i) || (!choSat && sat(i))) return;
        const m = moiTu(o);
        let loi = 0;
        phu[i].forEach((ok, j) => { if (ok && con[j] > 0) loi += Math.min(con[j], m); });
        const val = loi / (o.uu === 1 ? 1 : o.uu === 1.15 ? 1.15 : 2.2);
        if (val > bv + 1e-9) { bv = val; bi = i; }
      });
      if (bi >= 0) break;
    }
    if (bi < 0) break;
    chon.push(bi); tru1(bi);
    if (con.every((x) => x <= 0)) break;
  }
  kq.soTham = chon.length;
  if (!tay) {
    const d0 = v.cuaLT ?? [];
    ung.forEach((o) => (o.xc = chanCua(o.W, o.loai, d0)));
    const tot = toiUuPhu(ung, phu, chon, can);
    kq.nut = tot.nut;
    if (tot.chon) { chon = tot.chon; con.fill(can); chon.forEach(tru1); }
    chon.sort((a, b) => ung[a].pr.e - ung[b].pr.e || ung[a].pr.di - ung[b].pr.di);
  }
  kq.tu = chon.map((i, k) => {
    const o = ung[i], vv = tru(o.W, o.pr.q), Lv = Math.hypot(vv[0], vv[1]) || 1;
    const nPhu = muc.filter((t, j) => phu[i][j] && t.loai === 'can').length;
    let xa: TuPCCC['xa'] = null;
    muc.forEach((t, j) => { if (!phu[i][j] || t.loai !== 'can') return; const tong = kc(t.p, o.W); if (!xa || tong > xa.tong) xa = { so: t.so, p: t.p, tong }; });
    return { so: `TCC-${String(k + 1).padStart(2, '0')}`, W: o.W, huong: o.pr.huong, vao: [vv[0] / Lv, vv[1] / Lv] as Diem, uu: o.uu, ten: o.ten, loai: o.loai,
      kieu: o.kieu, tru: o.tru, nganW: o.nganW, nPhu, xa, tay: !!o.tay, vuong: !!o.vuong, iTay: o.iTay };
  });
  kq.tay = tay;
  kq.thieu = [...new Set(muc.filter((t, j) => con[j] > 0 && t.loai === 'can').map((t) => t.so as number))].sort((a, b) => a - b);
  kq.thieuHL = muc.some((t, j) => con[j] > 0 && t.loai === 'hl');
  kq.thieuDiem = muc.filter((_, j) => con[j] > 0).map((t) => ({ p: t.p, so: t.so }));
  kq.soDiem = muc.length; kq.soUng = ung.length;
  kq.hop = kq.tu.reduce((a, t) => a + (t.loai === 'don' ? 1 : 2), 0);
  kq.truDT = kq.tu.filter((t) => t.tru && t.tru.m2 > 0).map((t) => ({ so: t.so, can: t.tru!.so, kieu: t.tru!.kieu, m2: t.tru!.m2 }));
  if (chiTietBai) kq.bai = { ung, phu };
  return kq;
}

// ---------- hình vẽ ----------
/** Khung tủ (tccHinh): rộng dọc tường × sâu âm vào tường; nhãn trong hành lang cách mặt tường 520 mm. */
export function hinhTu(t: Pick<TuPCCC, 'W' | 'huong' | 'vao' | 'loai'>) {
  const K = TCC_LOAI[t.loai] || TCC_LOAI.don, h = t.huong, v = t.vao, W = t.W, r = K.rong / 2;
  return {
    q: [cong(W, nhan(h, -r)), cong(W, nhan(h, r)), cong(cong(W, nhan(h, r)), nhan(v, K.sau)), cong(cong(W, nhan(h, -r)), nhan(v, K.sau))] as Diem[],
    nhan: cong(W, nhan(v, -520)),
  };
}
/** Block CAD tủ trong toạ độ thế giới (tccKhoi): thân từng hộp, nét chéo + cánh, tường xây sau lưng (chữ U / L). */
export function khoiTu(t: Pick<TuPCCC, 'W' | 'huong' | 'vao' | 'loai' | 'kieu' | 'nganW'>) {
  const b = KHOI_TCC[tenKhoiTu(t.loai)], h = t.huong, v = t.vao, W = t.W;
  const P = ([x, y]: Diem): Diem => cong(cong(W, nhan(h, x)), nhan(v, -y));
  if (!b) return { than: [hinhTu(t).q], net: [] as Diem[][], tuong: null as Diem[] | null };
  let tuong: Diem[] | null = null;
  if (t.kieu === 'U' || t.kieu === 'L') {
    const r = b.rong / 2, td = b.tuong_day, sau = b.sau, d = -sau - td;
    const ben = t.kieu === 'L' ? (t.nganW ? Math.sign((t.nganW[0] - W[0]) * h[0] + (t.nganW[1] - W[1]) * h[1]) || -1 : -1) : 0;
    const ds: Diem[] = ben < 0 ? [[-r, -sau], [-r, d], [r + td, d], [r + td, 0], [r, 0], [r, -sau]]
      : ben > 0 ? [[-r, 0], [-r - td, 0], [-r - td, d], [r, d], [r, -sau], [-r, -sau]]
        : [[-r, 0], [-r - td, 0], [-r - td, d], [r + td, d], [r + td, 0], [r, 0], [r, -sau], [-r, -sau]];
    tuong = ds.map(P);
  }
  return { than: b.than.map((Q) => Q.map(P)), net: b.net.map((L) => L.map(P)), tuong };
}
export const nhanTu = (t: Pick<TuPCCC, 'so' | 'loai'>) => t.so + (t.loai === 'doi' ? ' ĐÔI' : t.loai === 'cum' ? ' CỤM 2' : ' ĐƠN');

// ---------- thao tác tay (QT-77e / 77f) ----------
/** Bộ tủ tay từ kết quả hiện có (lần sửa đầu chép bộ tự đặt). */
export const tuTayTuKq = (kq: KetQuaTCC, tay: TuTay[] | null | undefined): TuTay[] =>
  tay?.length ? tay.map((x) => [...x] as TuTay) : kq.tu.map((x) => [Math.round(x.W[0]), Math.round(x.W[1])] as TuTay);
const chiSoTay = (kq: KetQuaTCC, ci: number) => (kq.tay ? kq.tu[ci]?.iTay ?? ci : ci);

/** Dời tủ thứ ci tới gần p (bám tường HL). null = p xa hành lang. */
export function doiTuTay(v: Pick<DauVaoTCC, 'canh' | 'corr' | 'loi'>, kq: KetQuaTCC, tay: TuTay[] | null | undefined, ci: number, p: Diem): TuTay[] | null {
  const b = bamTuongTu(v, p);
  if (!b) return null;
  const ds = tuTayTuKq(kq, tay), i = chiSoTay(kq, ci);
  if (i < 0 || i >= ds.length) return null;
  ds[i] = ds[i][2] ? [b.W[0], b.W[1], ds[i][2]!] : [b.W[0], b.W[1]];
  return ds;
}
/** Kích đúp tủ: cụm / tủ đôi → tách 2 tủ đơn cách 3 m; tủ đơn → gộp với tủ đơn gần nhất (tccTachGop). */
export function tachGopTu(v: Pick<DauVaoTCC, 'canh' | 'corr' | 'loi'>, kq: KetQuaTCC, tay: TuTay[] | null | undefined, ci: number):
  { ds: TuTay[]; kieu: 'tach' | 'gop' } | { loi: 'khongTach' | 'khongGop' | 'giuaXa' } {
  const x = kq.tu[ci];
  if (!x) return { loi: 'khongGop' };
  const ds = tuTayTuKq(kq, tay), iTay = chiSoTay(kq, ci);
  if (x.loai !== 'don') {
    const a = bamTuongTu(v, cong(x.W, nhan(x.huong, -TCC_GIAN / 2))), b = bamTuongTu(v, cong(x.W, nhan(x.huong, TCC_GIAN / 2)));
    if (!a || !b) return { loi: 'khongTach' };
    ds.splice(iTay, 1, [a.W[0], a.W[1], 'don'], [b.W[0], b.W[1], 'don']);
    return { ds, kieu: 'tach' };
  }
  let j = -1, kcj = Infinity;
  kq.tu.forEach((y, k) => { if (k === ci || y.loai !== 'don') return; const d = kc(y.W, x.W); if (d < kcj) { kcj = d; j = k; } });
  if (j < 0) return { loi: 'khongGop' };
  const y = kq.tu[j], m = bamTuongTu(v, nhan(cong(x.W, y.W), 0.5));
  if (!m) return { loi: 'giuaXa' };
  const jTay = chiSoTay(kq, j);
  ds[Math.min(iTay, jTay)] = [m.W[0], m.W[1], 'gop'];
  ds.splice(Math.max(iTay, jTay), 1);
  return { ds, kieu: 'gop' };
}

// ---------- dựng đầu vào từ mặt bằng app mới ----------
type PhanTu = { loai: string; block: string; ma_thu_vien: string | null; a0: number; a1: number; sau_mm: number | null; x: number; y: number; rot: number; sx: number; sy: number; bang?: boolean };
type MatTCC = { goc_deg: number; truc_mm: number; phan_tu: PhanTu[] };
export type HinhLoiTCC = { bao_tm?: Diem[]; paths?: { cat: string; pts: Diem[] }[]; vi_tri_gieng?: Diem[]; phong?: { ten: string; x: number; y: number }[] };
const rad = (d: number) => (d * Math.PI) / 180;
const veLoi = (q: { x: number; y: number; rot: number; sx: number; sy: number }, [x, y]: Diem): Diem => {
  const c = Math.cos(rad(q.rot)), s = Math.sin(rad(q.rot)), X = x * q.sx, Y = y * q.sy;
  return [q.x + X * c - Y * s, q.y + X * s + Y * c];
};
/**
 * Đầu vào bộ đặt tủ từ mặt bằng tầng: `mat` (đã dồn khít), cạnh / trục hành lang, tim cửa căn theo thứ tự căn (cuaTrenMat), tim cửa
 * thang, hình lõi, mẫu căn theo mã thư viện cũ.
 */
export function dauVaoTCC(p: {
  mat: MatTCC[]; canh: DauVaoTCC['canh']; truc: DauVaoTCC['truc']; corr: number; cuaCan: Diem[]; cuaThang: Diem[];
  loi: (block: string) => HinhLoiTCC | undefined; canMau: (ma: string) => CanMau | undefined; tv: ThuVien; soTang: number;
  cuaLT?: CuaLT[]; tay?: TuTay[] | null;
}): DauVaoTCC {
  const can: CanTCC[] = [], thang: DauVaoTCC['thang'] = [], loi: LoiTCC[] = [], da = new Set<string>();
  let iCan = 0;
  const dsThang: Diem[][] = [];
  for (const m of p.mat) {
    const r = rad(m.goc_deg), u: Diem = [Math.cos(r), Math.sin(r)], n: Diem = [-u[1], u[0]];
    const pt = (a: number, b: number): Diem => [u[0] * a + n[0] * (m.truc_mm + b), u[1] * a + n[1] * (m.truc_mm + b)];
    for (const q of m.phan_tu) {
      if (q.loai === 'can') {
        const w = q.a1 - q.a0, d = q.sau_mm || 8500, cm = p.canMau(q.ma_thu_vien || q.block), lat = q.sx < 0;
        const khung = cm?.khung?.length ? cm.khung.map(([x, y]): Diem => pt(q.a0 + (lat ? 1 - x : x) * w, y * d)) : undefined;
        can.push({ so: iCan + 1, o: pt(q.a0, 0), u, n, w, d, lat, cua: p.cuaCan[iCan] ?? pt((q.a0 + q.a1) / 2, 0), khung, ve: cm ? veTccCan(cm, p.tv) : null });
        iCan++;
        continue;
      }
      if (q.loai === 'thang_bo') { dsThang.push([pt(q.a0, 0), pt(q.a1, 0), pt(q.a1, q.sau_mm || 8500), pt(q.a0, q.sau_mm || 8500)]); continue; }
      if (q.bang || !q.block) continue;
      const k = `${q.block}@${Math.round(q.x / 50)},${Math.round(q.y / 50)}`;
      if (da.has(k)) continue;
      da.add(k);
      const h = p.loi(q.block);
      if (!h?.bao_tm?.length) continue;
      loi.push({
        bien: h.bao_tm.map((z) => veLoi(q, z)),
        cua: (h.paths ?? []).filter((pa) => pa.cat === 'door').flatMap((pa) => pa.pts.map((z) => veLoi(q, z))),
        gieng: (h.vi_tri_gieng ?? []).map((z) => veLoi(q, z)),
        phong: (h.phong ?? []).filter((ph) => ph.x != null && ph.y != null).map((ph) => ({ ten: ph.ten, P: veLoi(q, [ph.x, ph.y]) })),
      });
    }
  }
  // cửa thang gán vào ô thang gần nhất (lặp lượt chèn bỏ)
  for (const v of dsThang) thang.push({ vien: v, cua: null });
  for (const c of p.cuaThang) {
    let tot = -1, dt = Infinity;
    thang.forEach((t, i) => { const m = nhan(t.vien.reduce((s, z) => cong(s, z), [0, 0] as Diem), 1 / 4), d = kc(m, c); if (d < dt) { dt = d; tot = i; } });
    if (tot >= 0 && !thang[tot].cua) thang[tot].cua = c; else thang.push({ vien: [], cua: c });
  }
  return { canh: p.canh, truc: p.truc, corr: p.corr, can, thang: thang.filter((t) => t.vien.length || t.cua), loi, soTang: p.soTang, cuaLT: p.cuaLT, tay: p.tay };
}

/** Nét `tcc` của mẫu căn (biến thể STRETCH: điểm bên phải đường cắt dời theo mức kéo, như cuaHlCan). */
export function veTccCan(c: CanMau, tv: ThuVien): VeTCC | null {
  const raw = (c as CanMau & { tcc?: VeTCC }).tcc;
  if (!c.stretchGoc) return raw ?? null;
  const g = tv.can.get(c.stretchGoc.id) as (CanMau & { tcc?: VeTCC }) | undefined;
  if (!g?.tcc || !g.stretch) return null;
  const st = c.stretchGoc.st, cut = g.stretch.x_mm, X = (x: number) => { const m = x * g.rong_mm; return (m > cut ? m + st : m) / c.rong_mm; };
  return {
    tuong: g.tcc.tuong.map(([a, b, cc, d]) => [X(a), b, X(cc), d]),
    hkt: g.tcc.hkt.map((h) => ({ o: [X(h.o[0]), X(h.o[1]), h.o[2], h.o[3]], cheo: h.cheo.map(([a, b]) => [X(a), X(b)] as [number, number]) })),
    cua: g.tcc.cua.map(([a, b]) => [X(a), b]),
  };
}
