/**
 * Kiểm tra PCCC / thoát nạn trên MỘT mẫu tòa (tầng điển hình), hàm thuần.
 *
 * Chép cách tính của app cũ MDI_Unitmix_v4 (prototype/shell.src.html: buildGeom · dtHanhLang · gioiHanThoatNan · tuCC0):
 *  - Cự ly thoát nạn (QT-45): từ TIM CỬA CĂN tới TIM CỬA BUỒNG ĐỆM thang bộ, đo DỌC TIM HÀNH LANG trên đồ thị
 *    (đi qua góc, QT-25), không cộng bề rộng hành lang. Căn chỉ thoát được về MỘT hướng = hành lang cụt.
 *  - Ngưỡng đổi theo chiều cao PCCC (QT-24): H ≤ 75 m → Bảng G.1 (cụt 25 · đôi 40 m); H > 75 m → A.3.1.7 dẫn A.2.19 (15 · 20 m).
 *  - Số thang bộ: 2 đạt, 3 cảnh báo, khác là vượt (MDI, qcvn06_escape_stairs).
 *  - Tủ họng nước (QT-77): bán kính phục vụ 18 m ĐO THẲNG từ vị trí tủ tới cửa căn + góc trong căn + điểm hành lang mỗi 3 m.
 *
 * Toạ độ mm như toa.json. Không sửa dữ liệu đầu vào.
 */
import type { Diem, ToaMau } from './kieu';

// ---------- kiểu cục bộ cho các trường toa.json mà kieu.ts chưa khai ----------
export type PhanTuMat = {
  loai: 'can' | 'thang_bo' | 'loi' | string;
  ma: string;
  block: string;
  ma_thu_vien: string | null;
  a0: number;
  a1: number;
  rong_mm: number;
  sau_mm: number | null;
  x: number;
  y: number;
  rot: number;
  sx: number;
  sy: number;
};
export type MatToa = { goc_deg: number; truc_mm: number; a_dau: number; a_cuoi: number; ten?: string; phan_tu: PhanTuMat[] };
export type TrucToa = { ten: string; goc_deg: number; hanh_lang_mm: number; a_dau: number; a_cuoi: number; dai_mm: number; b_mm: number };
export type ToaPCCC = Pick<ToaMau, 'id' | 'nhom' | 'hanh_lang_mm'> & { mat: MatToa[]; truc: TrucToa[]; hanhlang_ve: Diem[][] };

export type MucKiem = 'ok' | 'canh_bao' | 'vuot';
export type KetQuaLuat = { id: string; muc: MucKiem; giaTri: number; nguong: number; donVi: string; ghiChu: string };

/** Khối tủ trong pccc.json (chỉ cần bề rộng dọc tường). */
export type ThuVienTuPCCC = { khoi: Record<string, { rong: number; sau: number }> };

export type TuyChonPCCC = {
  /** tim cửa chính của căn, chuẩn hoá 0..1 theo mặt tiền (khoá = mã thư viện cũ `ma_thu_vien`, vd chtm_hn_2pn_g1_8500x9000). Thiếu → 0,5. */
  cuaCan?: Record<string, number>;
  /** chiều cao PCCC (m) — xem chieuCaoPCCC() */
  chieuCaoPCCC: number;
  /** số tầng căn hộ (Bảng 11: số tia) — mặc định 26 như app cũ */
  soTang?: number;
  /** tủ PCCC trong pccc.json; có thì lấy bề rộng tủ đơn / cụm từ đó */
  tuPCCC?: ThuVienTuPCCC;
  /** vị trí tủ đã đặt tay (mm). Không có → tự đặt (phủ tham lam). */
  viTriTu?: Diem[];
};

// ---------- hằng số (giữ nguyên app cũ) ----------
/** tim cửa từ hành lang vào buồng đệm của khối x_tb_n3 / x_tb_n2, mm cục bộ (ô cửa x = 265…1465) */
export const TIM_CUA_THANG_MM = 865;
export const BAN_KINH_TU_MM = 18000; // QT-77 · chủ nhiệm chốt 20/10/2026 (thẩm duyệt PC07 Đồng Quan)
const TOL = 400; // dtHanhLang: gộp nút
const TCC_CUA = 450; // tủ cách tim cửa ≥ ½ tủ + 450 + 150
const BUOC_HL = 3000; // điểm hành lang mỗi 3 m

/** Ngưỡng thoát nạn theo chiều cao PCCC (gioiHanThoatNan, QT-24). */
export function gioiHanThoatNan(hp: number) {
  return hp > 75
    ? { cut: 15, doi: 20, canCu: 'QCVN 06:2022 A.3.1.7 → A.2.19', che: '75–150 m' }
    : { cut: 25, doi: 40, canCu: 'QCVN 06:2022 Bảng G.1', che: '≤ 75 m' };
}

/** Chiều cao PCCC = H tầng đế × số tầng đế + H tầng căn hộ × (số tầng căn hộ − 1) + 1,4 m bậu cửa (app cũ chieuCaoPCCC). */
export const chieuCaoPCCC = (soTangDe: number, caoDe: number, soTangDH: number, caoDH: number) =>
  caoDe * soTangDe + caoDH * (soTangDH - 1) + 1.4;

/** Bảng 11 QCVN 06 (nhà ở): số tia + số tia mỗi điểm phải được phủ (tccSoTia). */
export function soTiaBang11(soTang: number, daiHanhLangMm: number) {
  const dai = daiHanhLangMm > 10000;
  const tia = soTang <= 16 ? (dai ? 2 : 1) : soTang <= 25 ? (dai ? 3 : 2) : 2;
  return { tia, can: tia >= 2 ? 2 : 1 };
}

// ---------- vector ----------
const cong = (a: Diem, b: Diem): Diem => [a[0] + b[0], a[1] + b[1]];
const tru = (a: Diem, b: Diem): Diem => [a[0] - b[0], a[1] - b[1]];
const nhan = (a: Diem, s: number): Diem => [a[0] * s, a[1] * s];
const cham = (a: Diem, b: Diem) => a[0] * b[0] + a[1] * b[1];
const dai = (a: Diem) => Math.hypot(a[0], a[1]);
const kc = (a: Diem, b: Diem) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** hệ toạ độ của một mặt: thế giới = a·u + (truc + b)·n (app cũ faceBasis) */
function coSo(gocDeg: number, truc: number) {
  const r = (gocDeg * Math.PI) / 180;
  const u: Diem = [Math.cos(r), Math.sin(r)];
  const n: Diem = [-Math.sin(r), Math.cos(r)];
  return { u, n, pt: (a: number, b: number): Diem => cong(nhan(u, a), nhan(n, truc + b)) };
}

/**
 * Tim cửa chính của một mẫu căn, chuẩn hoá 0..1 theo mặt tiền (doorGroup/doorX của app cũ): nét lớp `door` có y·8500 < 350
 * (chạm tường hành lang), gom theo khe > 1.500 mm, lấy nhóm nhiều nét nhất, tim = giữa hai mép.
 */
export function tinhCuaCan(ve: { cat: string; pts: Diem[] }[], rongMm: number): number {
  const gan: { x0: number; x1: number }[] = [];
  for (const p of ve) {
    if (p.cat !== 'door' || !p.pts.length) continue;
    let y0 = Infinity, x0 = Infinity, x1 = -Infinity;
    for (const q of p.pts) { y0 = Math.min(y0, q[1]); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]) }
    if (y0 * 8500 < 350) gan.push({ x0, x1 });
  }
  if (!gan.length) return 0.5;
  gan.sort((a, b) => a.x0 - b.x0);
  const nhom = [[gan[0]]];
  for (let i = 1; i < gan.length; i++) {
    const cuoi = nhom[nhom.length - 1], hi = Math.max(...cuoi.map((z) => z.x1));
    if ((gan[i].x0 - hi) * rongMm > 1500) nhom.push([gan[i]]); else cuoi.push(gan[i]);
  }
  nhom.sort((a, b) => b.length - a.length);
  const g = nhom[0];
  return (Math.min(...g.map((z) => z.x0)) + Math.max(...g.map((z) => z.x1))) / 2;
}

// ---------- đồ thị hành lang ----------
type Doan = { p0: Diem; p1: Diem };
type Canh = { i: number; j: number; L: number; p0: Diem; p1: Diem; huong: Diem };
type ViTri = { e: number; i: number; j: number; di: number; dj: number; q: Diem; d: number };

/** Gộp các đoạn thẳng hàng chồng nhau (trục `truc` và nét vẽ tay `hanhlang_ve` thường trùng nhau). */
function gopThangHang(ds: Doan[]): Doan[] {
  type Nhom = { u: Diem; n: Diem; o: number; kh: [number, number][] };
  const nhoms: Nhom[] = [];
  for (const s of ds) {
    const v = tru(s.p1, s.p0), L = dai(v);
    if (L < 1) continue;
    let u = nhan(v, 1 / L);
    if (u[0] < -1e-9 || (Math.abs(u[0]) < 1e-9 && u[1] < 0)) u = nhan(u, -1);
    const n: Diem = [-u[1], u[0]];
    let g = nhoms.find((z) => Math.abs(z.u[0] * u[1] - z.u[1] * u[0]) < 0.005 && Math.abs(cham(s.p0, z.n) - z.o) < 100);
    if (!g) { g = { u, n, o: cham(s.p0, n), kh: [] }; nhoms.push(g) }
    const a = cham(s.p0, g.u), b = cham(s.p1, g.u);
    g.kh.push([Math.min(a, b), Math.max(a, b)]);
  }
  const ra: Doan[] = [];
  for (const g of nhoms) {
    g.kh.sort((x, y) => x[0] - y[0]);
    const gop: [number, number][] = [];
    for (const k of g.kh) {
      const c = gop[gop.length - 1];
      if (c && k[0] <= c[1] + TOL) c[1] = Math.max(c[1], k[1]); else gop.push([k[0], k[1]]);
    }
    for (const [a, b] of gop) ra.push({ p0: cong(nhan(g.u, a), nhan(g.n, g.o)), p1: cong(nhan(g.u, b), nhan(g.n, g.o)) });
  }
  return ra;
}

export function dungDoThi(toa: ToaPCCC) {
  const ds: Doan[] = [];
  for (const t of toa.truc) {
    const B = coSo(t.goc_deg, 0);
    ds.push({ p0: B.pt(t.a_dau, t.b_mm), p1: B.pt(t.a_cuoi, t.b_mm) });
  }
  for (const pl of toa.hanhlang_ve || []) for (let k = 1; k < pl.length; k++) ds.push({ p0: pl[k - 1], p1: pl[k] });
  const doan = gopThangHang(ds);

  // điểm chẻ: đầu mút đoạn khác nằm trên đoạn này (≤ TOL) + giao điểm thật
  const moc: Diem[] = doan.flatMap((s) => [s.p0, s.p1]);
  for (let a = 0; a < doan.length; a++) for (let b = a + 1; b < doan.length; b++) {
    const A = doan[a], Bd = doan[b], r = tru(A.p1, A.p0), s = tru(Bd.p1, Bd.p0), den = r[0] * s[1] - r[1] * s[0];
    if (Math.abs(den) < 1e-9) continue;
    const w = tru(Bd.p0, A.p0), t = (w[0] * s[1] - w[1] * s[0]) / den, u = (w[0] * r[1] - w[1] * r[0]) / den;
    if (t > 0 && t < 1 && u > 0 && u < 1) moc.push(cong(A.p0, nhan(r, t)));
  }
  const nut: Diem[] = [];
  const themNut = (p: Diem) => {
    for (let i = 0; i < nut.length; i++) if (kc(nut[i], p) < TOL) return i;
    nut.push([p[0], p[1]]);
    return nut.length - 1;
  };
  const canh: Canh[] = [];
  for (const s of doan) {
    const v = tru(s.p1, s.p0), L = dai(v), ts = [0, 1];
    for (const q of moc) {
      const t = cham(tru(q, s.p0), v) / (L * L);
      if (t <= 0.001 || t >= 0.999) continue;
      if (kc(q, cong(s.p0, nhan(v, t))) > TOL) continue;
      if (!ts.some((x) => Math.abs(x - t) * L < TOL)) ts.push(t);
    }
    ts.sort((x, y) => x - y);
    for (let k = 0; k + 1 < ts.length; k++) {
      const p0 = cong(s.p0, nhan(v, ts[k])), p1 = cong(s.p0, nhan(v, ts[k + 1]));
      const i = themNut(p0), j = themNut(p1);
      if (i !== j) canh.push({ i, j, L: (ts[k + 1] - ts[k]) * L, p0, p1, huong: nhan(v, 1 / L) });
    }
  }
  const ke: [number, number, number][][] = nut.map(() => []);
  canh.forEach((e, k) => { ke[e.i].push([e.j, e.L, k]); ke[e.j].push([e.i, e.L, k]) });

  const nho = new Map<string, number[]>();
  /** Dijkstra BỎ MỘT CẠNH: rời cửa về một phía thì không được quay lại xuyên qua đoạn của chính cửa đó. */
  const dijkstra = (nguon: number, bo: number) => {
    const khoa = nguon + '|' + bo, co = nho.get(khoa);
    if (co) return co;
    const d = nut.map(() => Infinity);
    d[nguon] = 0;
    const q: [number, number][] = [[0, nguon]];
    while (q.length) {
      q.sort((a, b) => a[0] - b[0]);
      const [dd, u] = q.shift()!;
      if (dd > d[u] + 1e-6) continue;
      for (const [v, w, k] of ke[u]) {
        if (k === bo) continue;
        if (dd + w < d[v] - 1e-6) { d[v] = dd + w; q.push([d[v], v]) }
      }
    }
    nho.set(khoa, d);
    return d;
  };

  /** chiếu điểm lên cạnh gần nhất; `huong` cho trước thì chỉ xét cạnh song song (cửa căn / thang gán vào hành lang chạy dọc mặt) */
  const chieu = (p: Diem, huong?: Diem): ViTri | null => {
    let tot: ViTri | null = null;
    canh.forEach((e, k) => {
      if (huong && Math.abs(e.huong[0] * huong[1] - e.huong[1] * huong[0]) > 0.02) return;
      const v = tru(e.p1, e.p0), L2 = cham(v, v) || 1;
      const t = Math.max(0, Math.min(1, cham(tru(p, e.p0), v) / L2));
      const q = cong(e.p0, nhan(v, t)), d = kc(p, q);
      if (!tot || d < tot.d) tot = { e: k, i: e.i, j: e.j, di: t * e.L, dj: (1 - t) * e.L, q, d };
    });
    return tot ?? (huong ? chieu(p) : null);
  };

  /** quãng dọc hành lang A → B, tách theo hướng rời A (về đầu i / đầu j) — doKC của app cũ */
  const doKC = (A: ViTri, B: ViTri) => {
    let ri = Infinity, rj = Infinity;
    if (A.e === B.e) {
      const dd = Math.abs(A.di - B.di);
      if (B.di <= A.di) ri = dd; else rj = dd;
      const dI = dijkstra(A.i, A.e), dJ = dijkstra(A.j, A.e);
      ri = Math.min(ri, A.di + dI[A.j] + B.dj);
      rj = Math.min(rj, A.dj + dJ[A.i] + B.di);
    } else {
      const dA = dijkstra(A.i, A.e), dB = dijkstra(A.j, A.e);
      ri = A.di + Math.min(dA[B.i] + B.di, dA[B.j] + B.dj);
      rj = A.dj + Math.min(dB[B.i] + B.di, dB[B.j] + B.dj);
    }
    return { i: ri, j: rj };
  };

  // các mảng liền nhau: tổng chiều dài (mạng hành lang chưa chia, QT-98)
  const goc = nut.map((_, i) => i);
  const tim = (x: number): number => (goc[x] === x ? x : (goc[x] = tim(goc[x])));
  canh.forEach((e) => { goc[tim(e.i)] = tim(e.j) });
  const tong = new Map<number, number>();
  canh.forEach((e) => tong.set(tim(e.i), (tong.get(tim(e.i)) || 0) + e.L));

  return { nut, canh, chieu, doKC, daiMangMax: Math.max(0, ...tong.values()), daiTong: canh.reduce((s, e) => s + e.L, 0) };
}

// ---------- cửa căn, cửa thang ----------
export type CuaCan = { so: number; ma: string; p: Diem; huong: Diem; goc: Diem[] };

/** Cửa căn + 4 góc trong căn (lùi 150 mép bên / 150 tường HL / 300 tường ngoài — tccDiemCan) và cửa buồng đệm thang bộ. */
export function cuaTrenMat(toa: ToaPCCC, cuaCan: Record<string, number> = {}) {
  const can: CuaCan[] = [];
  const thang: { p: Diem; huong: Diem }[] = [];
  for (const m of toa.mat) {
    const B = coSo(m.goc_deg, m.truc_mm);
    for (const q of m.phan_tu) {
      if (q.loai === 'can') {
        const w = q.a1 - q.a0, sau = q.sau_mm || 8500;
        const dx = cuaCan[q.ma_thu_vien || q.block] ?? 0.5;
        const a = q.a0 + (q.sx < 0 ? 1 - dx : dx) * w;
        const goc = ([[150, 150], [w - 150, 150], [w - 150, sau - 300], [150, sau - 300]] as Diem[]).map(([x, y]) => B.pt(q.a0 + x, y));
        can.push({ so: can.length + 1, ma: q.ma_thu_vien || q.block, p: B.pt(a, 0), huong: B.u, goc });
      } else if (q.loai === 'thang_bo') {
        const aIns = q.x * B.u[0] + q.y * B.u[1];
        const a = aIns + (q.sx < 0 ? -1 : 1) * TIM_CUA_THANG_MM;
        const p = B.pt(a, 0);
        if (!thang.some((t) => kc(t.p, p) < 1000)) thang.push({ p, huong: B.u }); // lặp lượt chèn
      }
    }
  }
  return { can, thang };
}

// ---------- thoát nạn ----------
export type ThoatNanCan = { so: number; ma: string; cuLy: number | null; cut: boolean; nguong: number; vuot: boolean };

export function thoatNan(toa: ToaPCCC, opt: Pick<TuyChonPCCC, 'cuaCan' | 'chieuCaoPCCC'>) {
  const G = dungDoThi(toa);
  const { can, thang } = cuaTrenMat(toa, opt.cuaCan);
  const GH = gioiHanThoatNan(opt.chieuCaoPCCC);
  const vt = thang.map((t) => G.chieu(t.p, t.huong)).filter((x): x is ViTri => !!x);
  const ds: ThoatNanCan[] = can.map((c) => {
    const A = G.chieu(c.p, c.huong);
    let dI = Infinity, dJ = Infinity;
    if (A) for (const B of vt) { const r = G.doKC(A, B); dI = Math.min(dI, r.i); dJ = Math.min(dJ, r.j) }
    const d = Math.min(dI, dJ);
    if (!isFinite(d)) return { so: c.so, ma: c.ma, cuLy: null, cut: true, nguong: GH.cut, vuot: true };
    const cut = !(isFinite(dI) && isFinite(dJ));
    const nguong = cut ? GH.cut : GH.doi;
    return { so: c.so, ma: c.ma, cuLy: d / 1000, cut, nguong, vuot: d / 1000 > nguong };
  });
  const lon = (xs: ThoatNanCan[]) => Math.max(0, ...xs.map((x) => x.cuLy ?? 0));
  const canCut = ds.filter((x) => x.cut && x.cuLy != null), canDoi = ds.filter((x) => !x.cut && x.cuLy != null);
  return {
    GH, can: ds, soThang: thang.length, deadEnd: lon(canCut), doiMax: lon(canDoi), maxTravel: lon(ds),
    soCanCut: canCut.length, soCanDoi: canDoi.length, soVuot: ds.filter((x) => x.vuot).length,
    daiMangHanhLang: G.daiMangMax / 1000, daiHanhLang: G.daiTong / 1000,
  };
}

// ---------- tủ họng nước ----------
export type KetQuaTu = { viTri: Diem[]; loai: 'don' | 'cum'; rongTu: number; soTia: number; tiaMoiDiem: number; thieu: number[]; tuDat: boolean };

export function tuPCCC(toa: ToaPCCC, opt: TuyChonPCCC): KetQuaTu {
  const G = dungDoThi(toa);
  const { can, thang } = cuaTrenMat(toa, opt.cuaCan);
  const { tia, can: tiaMoiDiem } = soTiaBang11(opt.soTang ?? 26, G.daiTong);
  const loai = tiaMoiDiem >= 2 ? 'cum' : 'don';
  // QT-77f: cụm 2 hộp 800 × 200, tủ đơn 500 × 200 (khối pccc-800x200 / pccc-500x200)
  const rongTu = opt.tuPCCC?.khoi[loai === 'cum' ? 'pccc-800x200' : 'pccc-500x200']?.rong ?? (loai === 'cum' ? 800 : 500);
  const R = BAN_KINH_TU_MM;

  // điểm phải phủ: cửa căn + góc trong căn + hành lang mỗi 3 m
  const diem: { p: Diem; can: number | null }[] = [];
  for (const c of can) { diem.push({ p: c.p, can: c.so }); c.goc.forEach((g) => diem.push({ p: g, can: c.so })) }
  for (const e of G.canh) for (let s = 0; s <= e.L; s += BUOC_HL) diem.push({ p: cong(e.p0, nhan(e.huong, s)), can: null });

  let viTri = opt.viTriTu ?? null;
  const tuDat = !viTri;
  if (!viTri) {
    // ứng viên: tường hai bên hành lang (lệch ½ bề rộng HL khỏi tim), bước 600 mm, cách mọi cửa ≥ ½ tủ + 450 + 150
    const cua = [...can.map((c) => c.p), ...thang.map((t) => t.p)];
    const nua = (toa.hanh_lang_mm || 1800) / 2, ung: Diem[] = [];
    for (const e of G.canh) {
      const n: Diem = [-e.huong[1], e.huong[0]];
      for (let s = 0; s <= e.L; s += 600) for (const sg of [-1, 1]) {
        const W = cong(cong(e.p0, nhan(e.huong, s)), nhan(n, sg * nua));
        if (cua.some((q) => kc(q, W) < rongTu / 2 + TCC_CUA + 150)) continue;
        ung.push(W);
      }
    }
    // phủ tham lam: mỗi lượt chọn ứng viên phủ nhiều điểm chưa phủ nhất (cùng số thì ứng viên đứng trước)
    const conLai = new Set(diem.map((_, k) => k));
    const phu = ung.map((W) => diem.map((d, k) => (kc(W, d.p) <= R ? k : -1)).filter((k) => k >= 0));
    viTri = [];
    while (conLai.size) {
      let tot = -1, so = 0;
      phu.forEach((ds, i) => { const n = ds.filter((k) => conLai.has(k)).length; if (n > so) { so = n; tot = i } });
      if (tot < 0) break;
      viTri.push(ung[tot]);
      phu[tot].forEach((k) => conLai.delete(k));
    }
  }
  const thieu = new Set<number>();
  for (const d of diem) if (d.can != null && !viTri.some((W) => kc(W, d.p) <= R)) thieu.add(d.can);
  return { viTri, loai, rongTu, soTia: tia, tiaMoiDiem, thieu: [...thieu].sort((a, b) => a - b), tuDat };
}

// ---------- tổng hợp ----------
const r2 = (x: number) => Math.round(x * 100) / 100;

/** Chạy các luật PCCC trên một mẫu tòa. Mã luật = id trong quy_tac.json. */
export function kiemTraPCCC(toa: ToaPCCC, opt: TuyChonPCCC): KetQuaLuat[] {
  const tn = thoatNan(toa, opt);
  const { GH } = tn;
  const H = `${GH.canCu} · H ${opt.chieuCaoPCCC.toFixed(1)} m`;
  const ra: KetQuaLuat[] = [];
  ra.push({
    id: 'qcvn06_two_stairs_travel', muc: tn.doiMax <= GH.doi ? 'ok' : 'vuot', giaTri: r2(tn.doiMax), nguong: GH.doi, donVi: 'm',
    ghiChu: `căn giữa hai buồng thang xa nhất · ${tn.soCanDoi} căn · ${H}`,
  });
  ra.push({
    id: 'qcvn06_deadend', muc: tn.deadEnd <= GH.cut ? 'ok' : 'vuot', giaTri: r2(tn.deadEnd), nguong: GH.cut, donVi: 'm',
    ghiChu: `căn ở hành lang cụt xa nhất · ${tn.soCanCut} căn · ${H}`,
  });
  const vuot = tn.can.filter((c) => c.vuot);
  ra.push({
    id: 'qcvn06_travel_max', muc: vuot.length ? 'vuot' : 'ok', giaTri: r2(tn.maxTravel), nguong: GH.doi, donVi: 'm',
    ghiChu: vuot.length ? `${vuot.length} căn vượt ngưỡng riêng (cụt ${GH.cut} / đôi ${GH.doi} m): số ${vuot.map((c) => c.so).join(', ')}` : `mọi căn trong ngưỡng (cụt ${GH.cut} / đôi ${GH.doi} m)`,
  });
  ra.push({
    id: 'qcvn06_escape_stairs', muc: tn.soThang === 2 ? 'ok' : tn.soThang === 3 ? 'canh_bao' : 'vuot', giaTri: tn.soThang, nguong: 2, donVi: 'thang',
    ghiChu: 'MDI: ưu tiên 2 thang, tối đa 3; đạt số lượng không thay kiểm tra cự ly',
  });
  ra.push({
    id: 'qcvn06_335_corridor', muc: tn.daiMangHanhLang <= 60 ? 'ok' : 'canh_bao', giaTri: r2(tn.daiMangHanhLang), nguong: 60, donVi: 'm',
    ghiChu: tn.daiMangHanhLang <= 60 ? 'mạng hành lang liền ≤ 60 m' : 'mạng hành lang liền > 60 m — phải chia bằng vách / cửa ngăn cháy (3.3.5; H > 75 m mỗi khoang ≤ 30 m theo A.2.14)',
  });
  const tu = tuPCCC(toa, opt);
  ra.push({
    id: 'qcvn06_52_hong_nuoc', muc: !tu.viTri.length || tu.thieu.length ? 'vuot' : 'ok', giaTri: tu.viTri.length, nguong: BAN_KINH_TU_MM / 1000, donVi: 'vị trí',
    ghiChu: `${tu.tuDat ? 'tự đặt' : 'đặt tay'} ${tu.viTri.length} vị trí ${tu.loai === 'cum' ? 'cụm 2 hộp' : 'tủ đơn'} ${tu.rongTu}×200 · R 18 m đo thẳng · ${tu.tiaMoiDiem} tia/điểm (Bảng 11: ${tu.soTia} tia)` +
      (tu.thieu.length ? ` · căn chưa phủ: ${tu.thieu.join(', ')}` : ''),
  });
  return ra;
}
