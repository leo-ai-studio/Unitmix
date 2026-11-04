/**
 * ĐO KHOẢNG CÁCH / KÍCH THƯỚC (DIM) trên mọi bản vẽ (TMB · Tầng · Hầm) — bắt điểm như CAD và kích thước đặt được như Architechtures:
 *  - bắt điểm: ĐỈNH (endpoint) > GIAO điểm hai cạnh > TRUNG điểm > VUÔNG GÓC từ điểm trước xuống cạnh > GẦN nhất trên cạnh > LƯỚI;
 *    giữ Shift (ortho) khóa theo phương ngang / đứng so với điểm trước khi không bắt được gì;
 *  - kích thước: THẲNG (aligned), NGANG, ĐỨNG (hai điểm + điểm thứ ba đặt đường kích thước), GÓC (ba điểm), có chân kích thước,
 *    mũi tên, nhãn quay theo đường (luôn đọc được), liên tục (điểm cuối kích thước trước là điểm đầu kích thước sau).
 * Toạ độ MÉT, y lên (như BanVe). Hàm thuần — mỗi màn tự cấp `NguonBat` từ hình của mình (nguonBatDaGiac, nguonBatTang…).
 */
import type { Diem } from './kieu';

export type LoaiBatDo = 'dinh' | 'giao' | 'trung' | 'vuong' | 'gan' | 'luoi';
export type Canh = [Diem, Diem];
export type NguonBat = { dinh: Diem[]; canh: Canh[] };
export type CauHinhBat = {
  dinh: boolean; giao: boolean; trung: boolean; vuong: boolean; gan: boolean; luoi: boolean;
  /** khoá phương ngang / đứng so với điểm trước (Shift) */
  ortho: boolean;
  /** bước lưới (m) khi bật `luoi` */
  luoiBuoc: number;
};
export const CAU_HINH_BAT: CauHinhBat = { dinh: true, giao: true, trung: true, vuong: true, gan: true, luoi: false, ortho: false, luoiBuoc: 0.5 };
export type KetQuaBatDo = { p: Diem; loai: LoaiBatDo | null };

const HANG: Record<LoaiBatDo, number> = { dinh: 0, giao: 1, trung: 2, vuong: 3, gan: 4, luoi: 5 };
const kc = (a: Diem, b: Diem) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const tru = (a: Diem, b: Diem): Diem => [a[0] - b[0], a[1] - b[1]];
const cham = (a: Diem, b: Diem) => a[0] * b[0] + a[1] * b[1];
const cheo = (a: Diem, b: Diem) => a[0] * b[1] - a[1] * b[0];

/** Chân đường vuông góc từ `p` xuống đoạn `ab` (kẹp trong đoạn) và tham số t ∈ [0, 1]. */
export function chanVuong(p: Diem, [a, b]: Canh): { q: Diem; t: number } {
  const d = tru(b, a), L2 = cham(d, d);
  const t = L2 < 1e-12 ? 0 : Math.max(0, Math.min(1, cham(tru(p, a), d) / L2));
  return { q: [a[0] + d[0] * t, a[1] + d[1] * t], t };
}
/** Chân đường vuông góc xuống ĐƯỜNG THẲNG qua `ab` (không kẹp): dùng cho "vuông góc" với cạnh kéo dài. */
const chanDuong = (p: Diem, [a, b]: Canh): Diem | null => {
  const d = tru(b, a), L2 = cham(d, d);
  if (L2 < 1e-12) return null;
  const t = cham(tru(p, a), d) / L2;
  return [a[0] + d[0] * t, a[1] + d[1] * t];
};
/** Giao hai ĐOẠN (kể cả chạm đầu mút); null nếu song song / không cắt. */
export function giaoDoan([a, b]: Canh, [c, d]: Canh): Diem | null {
  const r = tru(b, a), s = tru(d, c), den = cheo(r, s);
  if (Math.abs(den) < 1e-12) return null;
  const qp = tru(c, a), t = cheo(qp, s) / den, u = cheo(qp, r) / den;
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  return [a[0] + r[0] * t, a[1] + r[1] * t];
}

/** Cạnh của đa giác kín (m). */
export const canhDaGiac = (P: readonly Diem[]): Canh[] => P.map((a, i) => [a, P[(i + 1) % P.length]] as Canh);
/** Nguồn bắt điểm từ nhiều đa giác kín. */
export function nguonBatDaGiac(...ds: (readonly Diem[] | null | undefined)[]): NguonBat {
  const dinh: Diem[] = [], canh: Canh[] = [];
  for (const P of ds) if (P && P.length >= 2) { dinh.push(...P); canh.push(...(P.length > 2 ? canhDaGiac(P) : [[P[0], P[1]] as Canh])); }
  return { dinh, canh };
}
export const gopNguonBat = (...ns: NguonBat[]): NguonBat => ({ dinh: ns.flatMap((n) => n.dinh), canh: ns.flatMap((n) => n.canh) });

/**
 * Bắt điểm quanh `p` trong `nguong` (m). `truoc` = điểm đã chọn ngay trước (cho vuông góc / ortho). Trả điểm sau bắt + loại bắt;
 * không bắt được gì thì: ortho → chiếu lên phương ngang / đứng qua `truoc`, không thì giữ nguyên `p`.
 */
export function batDiemDo(p: Diem, nguon: NguonBat, cfg: CauHinhBat, nguong: number, truoc: Diem | null = null): KetQuaBatDo {
  const ung: { p: Diem; loai: LoaiBatDo; d: number }[] = [];
  const them = (q: Diem, loai: LoaiBatDo) => { const d = kc(p, q); if (d <= nguong) ung.push({ p: q, loai, d }); };
  if (cfg.dinh) for (const q of nguon.dinh) them(q, 'dinh');
  // chỉ xét cạnh gần điểm (loại nhanh): hộp bao mở rộng
  const gan = nguon.canh.filter(([a, b]) => Math.min(a[0], b[0]) - nguong <= p[0] && p[0] <= Math.max(a[0], b[0]) + nguong && Math.min(a[1], b[1]) - nguong <= p[1] && p[1] <= Math.max(a[1], b[1]) + nguong);
  if (cfg.trung) for (const [a, b] of gan) them([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], 'trung');
  if (cfg.giao) for (let i = 0; i < gan.length; i++) for (let j = i + 1; j < gan.length; j++) { const g = giaoDoan(gan[i], gan[j]); if (g) them(g, 'giao'); }
  if (cfg.vuong && truoc) for (const c of gan) { const q = chanDuong(truoc, c); if (q && chanVuong(q, c).t > 0 && chanVuong(q, c).t < 1 && kc(chanVuong(q, c).q, q) < 1e-6) them(q, 'vuong'); }
  if (cfg.gan) for (const c of gan) { const { q } = chanVuong(p, c); them(q, 'gan'); }
  if (cfg.luoi && cfg.luoiBuoc > 0) { const b = cfg.luoiBuoc; them([Math.round(p[0] / b) * b, Math.round(p[1] / b) * b], 'luoi'); }
  if (ung.length) {
    ung.sort((x, y) => HANG[x.loai] - HANG[y.loai] || x.d - y.d);
    return { p: ung[0].p, loai: ung[0].loai };
  }
  if (cfg.ortho && truoc) {
    const dx = Math.abs(p[0] - truoc[0]), dy = Math.abs(p[1] - truoc[1]);
    return { p: dx >= dy ? [p[0], truoc[1]] : [truoc[0], p[1]], loai: null };
  }
  return { p, loai: null };
}

// ---------- kích thước ----------
export type LoaiKichThuoc = 'thang' | 'ngang' | 'dung' | 'goc';
/** `p`: hai điểm (thẳng / ngang / đứng) hoặc ba điểm (góc: đỉnh ở giữa); `lech`: vị trí đường kích thước (m, có dấu — xem hinhKichThuoc). */
export type KichThuoc = { id: string; loai: LoaiKichThuoc; p: Diem[]; lech: number };

export type HinhKichThuoc = {
  /** đường kích thước (hai đầu có mũi tên); góc: cung nối các điểm `cung` */
  duong: Canh | null;
  cung: Diem[];
  /** chân kích thước (extension lines) */
  chan: Canh[];
  /** mũi tên: [đỉnh, hướng đơn vị chỉ vào đỉnh] */
  mui: { dinh: Diem; huong: Diem }[];
  nhan: { p: Diem; goc: number; chu: string };
  /** giá trị: m (thẳng / ngang / đứng) hoặc độ (góc) */
  gia: number;
};

const fmt = (x: number, tp = 2) => x.toFixed(tp).replace('.', ',');
/** Nhãn quay theo đường nhưng luôn đọc được (không lộn ngược): góc trong (−90°, 90°]. */
const gocDoc = (d: Diem): number => { let g = (Math.atan2(d[1], d[0]) * 180) / Math.PI; if (g > 90) g -= 180; if (g <= -90) g += 180; return g; };

/**
 * Hình học một kích thước. `lech` có dấu: THẲNG — khoảng dời đường kích thước theo pháp tuyến trái (−y của hướng a→b) của đoạn;
 * NGANG — dời theo y so với điểm giữa hai điểm; ĐỨNG — dời theo x so với điểm giữa; GÓC — bán kính cung (m; ≤ 0 → tự chọn).
 */
export function hinhKichThuoc(k: KichThuoc, vuot = 0.15): HinhKichThuoc {
  if (k.loai === 'goc' && k.p.length >= 3) {
    const [a, o, b] = k.p, u = tru(a, o), v = tru(b, o), Lu = Math.hypot(...u), Lv = Math.hypot(...v);
    const a0 = Math.atan2(u[1], u[0]), a1 = Math.atan2(v[1], v[0]);
    let d = a1 - a0;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    const R = k.lech > 0 ? k.lech : Math.max(0.3, 0.45 * Math.min(Lu || 1, Lv || 1));
    const cung = Array.from({ length: 25 }, (_, i): Diem => [o[0] + R * Math.cos(a0 + (d * i) / 24), o[1] + R * Math.sin(a0 + (d * i) / 24)]);
    const am = a0 + d / 2, gia = (Math.abs(d) * 180) / Math.PI;
    // mũi tên ở hai đầu cung, chỉ ra ngoài theo tiếp tuyến (đầu: ngược chiều chạy cung; cuối: cùng chiều)
    const sg = Math.sign(d) || 1;
    const dau = (t: number, huong: 1 | -1): { dinh: Diem; huong: Diem } => ({ dinh: [o[0] + R * Math.cos(t), o[1] + R * Math.sin(t)], huong: [-Math.sin(t) * sg * huong, Math.cos(t) * sg * huong] });
    return {
      duong: null, cung, chan: [[o, [o[0] + (R + vuot) * Math.cos(a0), o[1] + (R + vuot) * Math.sin(a0)]], [o, [o[0] + (R + vuot) * Math.cos(a0 + d), o[1] + (R + vuot) * Math.sin(a0 + d)]]],
      mui: [dau(a0, -1), dau(a0 + d, 1)], gia,
      nhan: { p: [o[0] + (R + 0.18) * Math.cos(am), o[1] + (R + 0.18) * Math.sin(am)], goc: 0, chu: `${fmt(gia, 1)}°` },
    };
  }
  const [a, b] = k.p;
  let da: Diem, db: Diem, u: Diem;
  if (k.loai === 'ngang') { const y = (a[1] + b[1]) / 2 + k.lech; da = [a[0], y]; db = [b[0], y]; u = [Math.sign(b[0] - a[0]) || 1, 0]; }
  else if (k.loai === 'dung') { const x = (a[0] + b[0]) / 2 + k.lech; da = [x, a[1]]; db = [x, b[1]]; u = [0, Math.sign(b[1] - a[1]) || 1]; }
  else {
    const d = tru(b, a), L = Math.hypot(...d) || 1;
    u = [d[0] / L, d[1] / L];
    const n: Diem = [u[1], -u[0]];
    da = [a[0] + n[0] * k.lech, a[1] + n[1] * k.lech]; db = [b[0] + n[0] * k.lech, b[1] + n[1] * k.lech];
  }
  const gia = kc(da, db);
  const chanTu = (goc: Diem, dim: Diem): Canh => {
    const v = tru(dim, goc), L = Math.hypot(...v);
    if (L < 1e-9) return [goc, dim];
    const t: Diem = [v[0] / L, v[1] / L];
    return [[goc[0] + t[0] * Math.min(0.05, L), goc[1] + t[1] * Math.min(0.05, L)], [dim[0] + t[0] * vuot, dim[1] + t[1] * vuot]];
  };
  const dir: Diem = gia < 1e-9 ? u : [(db[0] - da[0]) / gia, (db[1] - da[1]) / gia];
  return {
    duong: [da, db], cung: [], chan: [chanTu(a, da), chanTu(b, db)],
    mui: [{ dinh: da, huong: [-dir[0], -dir[1]] }, { dinh: db, huong: dir }],
    nhan: { p: [(da[0] + db[0]) / 2, (da[1] + db[1]) / 2], goc: gocDoc(dir), chu: `${fmt(gia)} m` }, gia,
  };
}

/** `lech` mặc định khi người dùng bấm Enter / nhấp đôi không đặt điểm thứ ba: dời 0,6 m (nhân theo tỉ lệ màn hình do UI chọn). */
export function lechTuDiem(loai: LoaiKichThuoc, p: Diem[], c: Diem): number {
  const [a, b] = p;
  if (loai === 'ngang') return c[1] - (a[1] + b[1]) / 2;
  if (loai === 'dung') return c[0] - (a[0] + b[0]) / 2;
  if (loai === 'goc') return p.length >= 3 ? kc(c, p[1]) : 0;
  const d = tru(b, a), L = Math.hypot(...d) || 1;
  return cham(tru(c, a), [d[1] / L, -d[0] / L]);
}

/** Số đo nhanh giữa hai điểm (hai điểm đo thường): dài, Δx, Δy, góc so với trục x (độ, 0–180). */
export function soDoHaiDiem(a: Diem, b: Diem) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  let g = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (g < 0) g += 180;
  return { dai: Math.hypot(dx, dy), dx: Math.abs(dx), dy: Math.abs(dy), goc: g };
}

/** Làm sạch danh sách kích thước đọc từ PA cũ / tệp: bản ghi hỏng bỏ. */
export function chuanHoaKichThuoc(v: unknown): Record<string, KichThuoc[]> | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const so = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
  const diem = (p: unknown): p is Diem => Array.isArray(p) && p.length === 2 && so(p[0]) && so(p[1]);
  const kq: Record<string, KichThuoc[]> = {};
  for (const [pv, ds] of Object.entries(v as Record<string, unknown>)) {
    if (!Array.isArray(ds)) continue;
    const ok = ds.filter((k): k is KichThuoc => !!k && typeof k === 'object' && typeof (k as KichThuoc).id === 'string' && ['thang', 'ngang', 'dung', 'goc'].includes((k as KichThuoc).loai)
      && Array.isArray((k as KichThuoc).p) && (k as KichThuoc).p.every(diem) && (k as KichThuoc).p.length === ((k as KichThuoc).loai === 'goc' ? 3 : 2) && so((k as KichThuoc).lech));
    if (ok.length) kq[pv] = ok.slice(0, 200);
  }
  return Object.keys(kq).length ? kq : undefined;
}
