/**
 * Gói BIM một tòa (.json) để dựng model gốc trong Revit: level, tường, cửa, phòng, căn của từng bố cục tầng (mm, tính từ tâm tòa, chưa xoay).
 * `web/public/lib/revit/unitmix_dung_bim.py` đọc gói này, dựng cấu kiện Revit thật rồi sinh bản vẽ.
 * Tường trong thư viện là đa giác (đã cắt tại cửa): `trucVong` tìm cặp cạnh song song để ra tim + bề dày, `gopTuong` nối lại qua ô cửa
 * để cửa có tường chủ.
 */
import type { Diem, ThuVien } from '../tinh/kieu';
import { boCucTang, canDangDung, congNangTai, nhomTang, veLoiTaiViTri, viTriCan } from '../tinh/matBang';
import type { Khoi3d, ThamSo3D } from '../ve3d/dungCan';

export type LoaiTuong = 'ngoai' | 'trong' | 'loi' | 'kinh' | 'lan_can';
export type TuongBim = { a: Diem; b: Diem; day: number; loai: LoaiTuong };
export type CuaBim = { x: number; y: number; rong: number; cao: number; bau: number; loai: 'di' | 'so' | 'truot' };
export type PhongBim = { ten: string; loai: string; x: number; y: number; dt: number; can: string };
export type CanBim = { so: string; ma: string; ten: string; dt_tt: number; dt_tim: number; x: number; y: number };
/** Lỗ thông tầng: giếng thang máy hoặc buồng thang bộ, khoét sàn suốt chiều cao. */
export type LoBim = { loai: 'thang_may' | 'thang_bo'; vong: Diem[] };
/** Thang bộ hai vế: vế lên a→b, vế xuống c→d (tim vế), giữa là chiếu nghỉ. */
export type ThangBim = { a: Diem; b: Diem; c: Diem; d: Diem; rong: number; sauBac: number };
/** Dầm biên: tim dầm, bề rộng, cao (mm), đỉnh dầm sát sàn trên. */
export type DamBim = { a: Diem; b: Diem; rong: number; cao: number };
/** Louver che điều hoà: tim dải, cao độ đáy so với sàn, chiều cao (mm). */
export type LouverBim = { a: Diem; b: Diem; bau: number; cao: number };
export type BoCucBim = { id: string; ten: string; chan: Diem[]; tuong: TuongBim[]; cua: CuaBim[]; phong: PhongBim[]; can: CanBim[]; kyHieu: Diem[][]; lo: LoBim[]; thang: ThangBim[]; dam: DamBim[]; louver: LouverBim[] };
export type TangBim = { ten: string; cao: number; loai: 'de' | 'dien_hinh' | 'mai' | 'tum'; boCuc: string };
export type GoiBim = {
  phienBan: 1; duAn: string; mau: string; soToaCung: number; caoTang: number; daySan: number;
  tang: TangBim[]; boCuc: BoCucBim[]; cot: Diem[]; canhCot: number;
};

const NGUONG_NGOAI = 450; // mm, tường cách nét bao trong ngưỡng này là tường ngoài
const DAY_TOI_DA = 450; // mm, quá dày thì không coi là tường (khối đặc)
type Doan = { a: Diem; b: Diem; day: number };

const tru = (p: Diem, q: Diem): Diem => [p[0] - q[0], p[1] - q[1]];
const cham = (p: Diem, q: Diem) => p[0] * q[0] + p[1] * q[1];
const dai = (p: Diem) => Math.hypot(p[0], p[1]);

/** Đoạn tim + bề dày của một đa giác tường: ghép cặp cạnh ngược chiều, gần nhau, chồng lấn nhiều nhất trước. */
export function trucVong(vong: Diem[]): Doan[] {
  const r = vong.filter((p, i) => dai(tru(p, vong[(i + 1) % vong.length])) > 2);
  const n = r.length;
  if (n < 3) return [];
  const canh = r.map((p, i) => {
    const q = r[(i + 1) % n], L = dai(tru(q, p));
    return { p, q, L, u: [(q[0] - p[0]) / L, (q[1] - p[1]) / L] as Diem };
  });
  type Cap = { i: number; j: number; t0: number; t1: number; day: number; len: number };
  const dsCap: Cap[] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const A = canh[i], B = canh[j];
    if (cham(A.u, B.u) > -0.995) continue;
    const pv: Diem = [-A.u[1], A.u[0]], day = Math.abs(cham(tru(B.p, A.p), pv));
    if (day < 20 || day > DAY_TOI_DA) continue;
    const s0 = cham(tru(B.p, A.p), A.u), s1 = cham(tru(B.q, A.p), A.u);
    const t0 = Math.max(0, Math.min(s0, s1)), t1 = Math.min(A.L, Math.max(s0, s1)), len = t1 - t0;
    if (len >= Math.max(50, day * 0.5)) dsCap.push({ i, j, t0, t1, day, len });
  }
  dsCap.sort((a, b) => b.len - a.len);
  const daDung = canh.map(() => [] as [number, number][]);
  const daChiem = (k: number, a: number, b: number) => daDung[k].reduce((s, [x, y]) => s + Math.max(0, Math.min(b, y) - Math.max(a, x)), 0);
  const ra: Doan[] = [];
  for (const c of dsCap) {
    const A = canh[c.i], B = canh[c.j];
    const m0 = cham(tru([A.p[0] + A.u[0] * c.t0, A.p[1] + A.u[1] * c.t0], B.p), B.u), m1 = cham(tru([A.p[0] + A.u[0] * c.t1, A.p[1] + A.u[1] * c.t1], B.p), B.u);
    const bj0 = Math.min(m0, m1), bj1 = Math.max(m0, m1);
    if (daChiem(c.i, c.t0, c.t1) > c.len * 0.3 || daChiem(c.j, bj0, bj1) > c.len * 0.3) continue;
    daDung[c.i].push([c.t0, c.t1]); daDung[c.j].push([bj0, bj1]);
    const pv: Diem = [-A.u[1], A.u[0]], lech = cham(tru(B.p, A.p), pv) / 2;
    const dat = (t: number): Diem => [A.p[0] + A.u[0] * t + pv[0] * lech, A.p[1] + A.u[1] * t + pv[1] * lech];
    ra.push({ a: dat(c.t0), b: dat(c.t1), day: c.day });
  }
  if (!ra.length && n <= 5) { // khối đặc ngắn (trụ, tường dày): lấy cạnh dài làm trục
    const dx = canh.map((c) => c.L).sort((a, b) => b - a), lon = dx[0], be = dx[dx.length - 1];
    const c = canh.find((k) => k.L === lon)!, pv: Diem = [-c.u[1], c.u[0]];
    const dau = r.some((p) => cham(tru(p, c.p), pv) > 0) ? 1 : -1;
    ra.push({ a: [c.p[0] + pv[0] * dau * be / 2, c.p[1] + pv[1] * dau * be / 2], b: [c.q[0] + pv[0] * dau * be / 2, c.q[1] + pv[1] * dau * be / 2], day: be });
  }
  return ra;
}

/** Nối các đoạn thẳng hàng cùng bề dày (chạm hoặc chồng nhau), bỏ đoạn trùng. */
export function gopTuong(ds: Doan[]): Doan[] {
  type Nhom = { u: Diem; pv: Diem; c: number; day: number; khoang: [number, number][] };
  const nhom: Nhom[] = [];
  for (const d of ds) {
    const L = dai(tru(d.b, d.a));
    if (L < 1) continue;
    let u: Diem = [(d.b[0] - d.a[0]) / L, (d.b[1] - d.a[1]) / L];
    if (u[0] < -1e-6 || (Math.abs(u[0]) <= 1e-6 && u[1] < 0)) u = [-u[0], -u[1]];
    const pv: Diem = [-u[1], u[0]], c = cham(d.a, pv);
    const n = nhom.find((q) => Math.abs(cham(q.u, u)) > 0.9995 && Math.abs(q.c - c) <= 30 && Math.abs(q.day - d.day) <= 50);
    const t0 = Math.min(cham(d.a, u), cham(d.b, u)), t1 = Math.max(cham(d.a, u), cham(d.b, u));
    if (n) { n.khoang.push([t0, t1]); n.day = Math.max(n.day, d.day); } else nhom.push({ u, pv, c, day: d.day, khoang: [[t0, t1]] });
  }
  const ra: Doan[] = [];
  for (const q of nhom) {
    q.khoang.sort((a, b) => a[0] - b[0]);
    let cur: [number, number] | null = null;
    const xong = () => { if (cur && cur[1] - cur[0] >= 60) ra.push({ a: [q.u[0] * cur[0] + q.pv[0] * q.c, q.u[1] * cur[0] + q.pv[1] * q.c], b: [q.u[0] * cur[1] + q.pv[0] * q.c, q.u[1] * cur[1] + q.pv[1] * q.c], day: q.day }); };
    for (const k of q.khoang) {
      if (cur && k[0] <= cur[1] + 15) cur[1] = Math.max(cur[1], k[1]);
      else { xong(); cur = [k[0], k[1]]; }
    }
    xong();
  }
  return ra;
}

const kcDoan = (p: Diem, a: Diem, b: Diem) => {
  const d = tru(b, a), l = cham(d, d), t = l ? Math.max(0, Math.min(1, cham(tru(p, a), d) / l)) : 0;
  return dai([p[0] - a[0] - t * d[0], p[1] - a[1] - t * d[1]]);
};
const kcNet = (p: Diem, net: Diem[]) => Math.min(...net.map((a, i) => kcDoan(p, a, net[(i + 1) % net.length])));

/** Vòng lặp lấy hình: mẫu tòa của một tầng. */
export type MauTangBim = { mat: { goc_deg: number; truc_mm: number; phan_tu: { loai: string; block: string; bang?: boolean; x: number; y: number; rot: number; sx: number; sy: number }[] }[]; duong_bao: Diem[] };
export type LoiDayDu = { paths?: { cat: string; pts: Diem[] }[]; tuong?: Diem[][]; bao_tm?: Diem[]; vi_tri_gieng?: Diem[] };

const NUA_GIENG_MAX = 1700; // mm, tia đi xa hơn là đã lọt qua cửa giếng
const NUA_GIENG_MD = 1200; // mm, giếng không dò được tường
const GIENG_NHO = 1800; // mm, cạnh giếng nhỏ hơn là dò nhầm gờ tường
type Canh = [Diem, Diem];
/** Khoảng từ p theo hướng u tới cạnh tường gần nhất. */
function tiaTuong(p: Diem, u: Diem, canh: Canh[]) {
  let t = Infinity;
  for (const [a, b] of canh) {
    const e = tru(b, a), d = u[0] * e[1] - u[1] * e[0];
    if (Math.abs(d) < 1e-9) continue;
    const w = tru(a, p), k = (w[0] * e[1] - w[1] * e[0]) / d, m = (w[0] * u[1] - w[1] * u[0]) / d;
    if (k > 5 && m >= -1e-6 && m <= 1 + 1e-6 && k < t) t = k;
  }
  return t;
}
/** Một cặp nửa bề rộng hai phía; phía lọt qua cửa lấy đối xứng theo phía còn lại. */
function haiPhia(a: number, b: number): [number, number] {
  if (a > NUA_GIENG_MAX && b > NUA_GIENG_MAX) return [NUA_GIENG_MD, NUA_GIENG_MD];
  return [a > NUA_GIENG_MAX ? b : a, b > NUA_GIENG_MAX ? a : b];
}
/** Khung giếng thang máy quanh tâm p: theo hướng cạnh tường gần nhất, dò tường bốn phía. */
export function khungGieng(p: Diem, canh: Canh[]): Diem[] {
  let u: Diem = [1, 0], gan = Infinity;
  for (const [a, b] of canh) {
    const e = tru(b, a), L = dai(e);
    if (L < 500) continue;
    const d = kcDoan(p, a, b);
    if (d < gan) { gan = d; u = [e[0] / L, e[1] / L]; }
  }
  const v: Diem = [-u[1], u[0]];
  const [a0, a1] = haiPhia(tiaTuong(p, [-u[0], -u[1]], canh), tiaTuong(p, u, canh));
  const [b0, b1] = haiPhia(tiaTuong(p, [-v[0], -v[1]], canh), tiaTuong(p, v, canh));
  if (a0 + a1 < GIENG_NHO || b0 + b1 < GIENG_NHO) { // gờ tường trong lõi xiên: không tin được, lấy giếng chuẩn
    return ([[-1150, -1200], [1150, -1200], [1150, 1200], [-1150, 1200]] as Diem[]).map(([x, y]) => [p[0] + u[0] * x + v[0] * y, p[1] + u[1] * x + v[1] * y]);
  }
  return ([[-a0, -b0], [a1, -b0], [a1, b1], [-a0, b1]] as Diem[]).map(([x, y]) => [p[0] + u[0] * x + v[0] * y, p[1] + u[1] * x + v[1] * y]);
}
/** Hai vế thang từ nét bậc của khối thang bộ: nhóm đoạn song song cách đều 200-340 mm, cùng vị trí ngang. */
export function veThang(paths: { cat: string; pts: Diem[] }[]): { a: Diem; b: Diem; rong: number; sauBac: number }[] {
  const bac: { p: Diem; L: number; u: Diem }[] = [];
  for (const n of paths) {
    if (n.cat === 'wall') continue;
    for (let i = 0; i + 1 < n.pts.length; i++) {
      const a = n.pts[i], b = n.pts[i + 1], L = dai(tru(b, a));
      if (L > 700 && L < 1900) {
        const u: Diem = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
        bac.push({ p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], L, u: u[0] < -1e-6 || (Math.abs(u[0]) < 1e-6 && u[1] < 0) ? [-u[0], -u[1]] : u });
      }
    }
  }
  const nhom = new Map<string, typeof bac>();
  for (const b of bac) {
    const k = `${Math.round(Math.atan2(b.u[1], b.u[0]) * 50)}:${Math.round(cham(b.p, b.u) / 150)}`;
    nhom.set(k, [...(nhom.get(k) ?? []), b]);
  }
  const ra: { a: Diem; b: Diem; rong: number; sauBac: number }[] = [];
  for (const ds of nhom.values()) {
    const v: Diem = [-ds[0].u[1], ds[0].u[0]];
    const s = [...new Set(ds.map((b) => Math.round(cham(b.p, v))))].sort((x, y) => x - y);
    if (s.length < 6) continue;
    const sau = (s[s.length - 1] - s[0]) / (s.length - 1);
    if (sau < 200 || sau > 340) continue;
    const m = cham(ds[0].p, ds[0].u), P = (t: number): Diem => [ds[0].u[0] * m + v[0] * t, ds[0].u[1] * m + v[1] * t];
    ra.push({ a: P(s[0] - sau / 2), b: P(s[s.length - 1] + sau / 2), rong: ds[0].L, sauBac: sau });
  }
  return ra.sort((p, q) => cham(p.a, [1, 1]) - cham(q.a, [1, 1]));
}
export type NguonBim = {
  tv: ThuVien; toa: Parameters<typeof nhomTang>[0] & Parameters<typeof boCucTang>[0];
  mauTang: (t: number | null) => MauTangBim; khoi3d: Map<string, Khoi3d | null>; loi: Map<string, LoiDayDu>; idLoi: (b: string) => string; P: ThamSo3D;
};

const RONG_DAM = 220; // mm, như dầm biên 3D (dungCan.ts)
/** Tim dầm biên của một căn: theo `damS` nếu có, không thì dọc các cạnh mặt tiền `sides`. */
export function damBien(d: Pick<Khoi3d, 'damS' | 'sides' | 'bb'>): Doan[] {
  if (d.damS) return d.damS.flatMap((r) => trucVong(r as Diem[]));
  const [x0, y0, x1, y1] = d.bb, n = RONG_DAM / 2;
  const canh: Record<string, Doan> = {
    T: { a: [x0, y1 - n], b: [x1, y1 - n], day: RONG_DAM }, B: { a: [x0, y0 + n], b: [x1, y0 + n], day: RONG_DAM },
    L: { a: [x0 + n, y0], b: [x0 + n, y1], day: RONG_DAM }, R: { a: [x1 - n, y0], b: [x1 - n, y1], day: RONG_DAM },
  };
  return [...d.sides].filter((s) => canh[s]).map((s) => canh[s]);
}

/** Một bố cục tầng: căn hộ đặt vào ô, tường lõi, nét ký hiệu lõi (thang, trục). Dời tâm (cx, cy). */
function boCucBim(ng: NguonBim, tang: number | null, id: string, ten: string, cx: number, cy: number): BoCucBim {
  const { tv, toa, P } = ng, mauT = ng.mauTang(tang), bc = boCucTang(toa, tang);
  const dg = (p: Diem): Diem => [p[0] - cx, p[1] - cy];
  const chan = mauT.duong_bao.map(dg);
  const lanCan: TuongBim[] = [];
  const doan: (Doan & { loi?: boolean })[] = [], cua: CuaBim[] = [], phong: PhongBim[] = [], can: CanBim[] = [], kyHieu: Diem[][] = [], lo: LoBim[] = [], thang: ThangBim[] = [], dam: DamBim[] = [], louver: LouverBim[] = [];
  let so = 0;
  for (const vt of viTriCan(mauT as never, tv, bc)) {
    if (congNangTai(vt.khoa, bc) !== 'can') continue;
    const canId = canDangDung(vt, bc), d = ng.khoi3d.get(canId), cm = tv.can.get(canId);
    if (!d) continue;
    const m = mauT.mat[vt.matIdx], gr = (m.goc_deg * Math.PI) / 180, u: Diem = [Math.cos(gr), Math.sin(gr)], pn: Diem = [-u[1], u[0]];
    const w = vt.a1 - vt.a0, s = vt.guong ? -1 : 1, off = vt.a0 + (vt.guong ? w : 0);
    const o: Diem = [u[0] * off + pn[0] * m.truc_mm, u[1] * off + pn[1] * m.truc_mm];
    const f = (p: Diem): Diem => dg([o[0] + u[0] * s * p[0] + pn[0] * p[1], o[1] + u[1] * s * p[0] + pn[1] * p[1]]);
    so++;
    const maCan = `CH-${String(so).padStart(2, '0')}`;
    for (const r of d.walls) for (const q of trucVong(r as Diem[])) doan.push({ a: f(q.a), b: f(q.b), day: q.day });
    for (const c of d.openings) {
      const nm = (c.n[0] + c.n[1]) / 2, tw = Math.max(c.n[1] - c.n[0], 60);
      const dat = (t: number): Diem => {
        if (c.ax === 'x') return f([t, nm]);
        if (c.ax === 'y') return f([nm, t]);
        const [ox, oy, rot] = c.o!, co = Math.cos(rot), si = Math.sin(rot);
        return f([ox + t * co - nm * si, oy + t * si + nm * co]);
      };
      doan.push({ a: dat(c.a[0]), b: dat(c.a[1]), day: tw });
      const loai = c.t === 'window' ? 'so' : c.t === 'slide' ? 'truot' : 'di';
      const tam = dat((c.c[0] + c.c[1]) / 2);
      cua.push({ x: tam[0], y: tam[1], rong: c.c[1] - c.c[0], cao: loai === 'so' ? P.caoSo : loai === 'truot' ? P.cuaTruot : P.cuaDi, bau: loai === 'so' ? P.bauSo : 0, loai });
    }
    for (const r of d.rails) { // lan can: tường thấp theo tim dải lan can
      const b = r.b, x = r.ax === 'x', nm = x ? (b[1] + b[3]) / 2 : (b[0] + b[2]) / 2, a0 = x ? b[0] : b[1], a1 = x ? b[2] : b[3];
      lanCan.push({ a: f(x ? [a0, nm] : [nm, a0]), b: f(x ? [a1, nm] : [nm, a1]), day: 100, loai: 'lan_can' });
    }
    for (const q of damBien(d)) dam.push({ a: f(q.a), b: f(q.b), rong: q.day, cao: P.dam });
    for (const l of d.lovers) {
      const nm = (l.n[0] + l.n[1]) / 2, x = l.ax === 'x';
      louver.push({ a: f(x ? [l.a[0], nm] : [nm, l.a[0]]), b: f(x ? [l.a[1], nm] : [nm, l.a[1]]), bau: P.bauLC, cao: P.tang - P.dam - P.bauLC });
    }
    for (const p of cm?.phong ?? []) {
      const xs = p.ranh.map((q) => q[0]), ys = p.ranh.map((q) => q[1]);
      const t = f([(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]);
      phong.push({ ten: p.ten, loai: p.loai, x: t[0], y: t[1], dt: p.dt_m2, can: maCan });
    }
    const t = f([(d.bb[0] + d.bb[2]) / 2, (d.bb[1] + d.bb[3]) / 2]);
    can.push({ so: maCan, ma: canId, ten: cm?.ten_vi ?? canId, dt_tt: cm?.dt_tt_m2 ?? 0, dt_tim: cm?.dt_tim_m2 ?? 0, x: t[0], y: t[1] });
  }
  for (const m of mauT.mat) for (const q of m.phan_tu) {
    if (q.loai === 'can' || q.bang) continue;
    const l = ng.loi.get(ng.idLoi(q.block));
    if (!l) continue;
    const dat = (pts: Diem[]): Diem[] => (veLoiTaiViTri([{ cat: 'wall', pts }], q)[0].pts as Diem[]).map(dg);
    const rings = l.tuong?.length ? l.tuong : (l.paths ?? []).filter((n) => n.cat === 'wall').map((n) => n.pts);
    for (const r of rings) for (const k of trucVong(r)) { const [a, b] = dat([k.a, k.b]); doan.push({ a, b, day: k.day, loi: true }); }
    for (const n of l.paths ?? []) if (n.cat !== 'wall') kyHieu.push(dat(n.pts));
    const canh: Canh[] = rings.flatMap((r) => r.map((p, i): Canh => [p, r[(i + 1) % r.length]]));
    for (const g of l.vi_tri_gieng ?? []) lo.push({ loai: 'thang_may', vong: dat(khungGieng(g, canh)) });
    const ve = q.loai === 'thang_bo' ? veThang(l.paths ?? []) : [];
    if (ve.length === 2) {
      const [m, n] = ve, u: Diem = [(m.b[0] - m.a[0]) / dai(tru(m.b, m.a)), (m.b[1] - m.a[1]) / dai(tru(m.b, m.a))], v: Diem = [-u[1], u[0]];
      const [p0, p1] = dat([m.a, m.b]), [p2, p3] = dat([n.a, n.b]);
      thang.push({ a: p0, b: p1, c: p3, d: p2, rong: m.rong, sauBac: m.sauBac });
      // buồng thang: hai vế + chiếu nghỉ hai đầu, chặn lại ở tường nếu gần hơn
      const tam: Diem = [(m.a[0] + n.b[0]) / 2, (m.a[1] + n.b[1]) / 2];
      const c0 = cham(m.a, u), c1 = cham(m.b, u), w0 = Math.min(cham(m.a, v), cham(n.a, v)) - m.rong / 2, w1 = Math.max(cham(m.a, v), cham(n.a, v)) + m.rong / 2;
      const d0 = Math.min(cham(tam, u) - c0 + m.rong, tiaTuong(tam, [-u[0], -u[1]], canh)), d1 = Math.min(c1 - cham(tam, u) + m.rong, tiaTuong(tam, u, canh));
      const X0 = cham(tam, u) - d0, X1 = cham(tam, u) + d1;
      lo.push({ loai: 'thang_bo', vong: dat(([[X0, w0], [X1, w0], [X1, w1], [X0, w1]] as Diem[]).map(([x, y]) => [u[0] * x + v[0] * y, u[1] * x + v[1] * y])) });
    }
  }
  const loiCan = doan.filter((d) => d.loi), thuong = doan.filter((d) => !d.loi);
  const ngoai = (d: Doan) => kcNet([(d.a[0] + d.b[0]) / 2, (d.a[1] + d.b[1]) / 2], chan) <= NGUONG_NGOAI;
  const tuong: TuongBim[] = [
    ...gopTuong(thuong).map((d): TuongBim => ({ ...d, loai: ngoai(d) ? 'ngoai' : 'trong' })),
    ...gopTuong(loiCan).map((d): TuongBim => ({ ...d, loai: 'loi' })),
    ...lanCan,
  ];
  return { id, ten, chan, tuong, cua, phong, can, kyHieu, lo, thang, dam, louver };
}

/** Lập gói BIM một tòa đại diện của mẫu. */
export function taoGoiBim(ng: NguonBim, o: {
  duAn: string; mau: string; soToaCung: number; soTangDe: number; soTangDH: number; caoDeMm: number; caoTumMm: number;
  rieng: number[]; cot: Diem[]; canhCot: number; tum: Diem[][]; cx: number; cy: number;
}): GoiBim {
  const { P } = ng, dg = (p: Diem): Diem => [p[0] - o.cx, p[1] - o.cy];
  const dh = boCucBim(ng, null, 'dh', 'Tang dien hinh', o.cx, o.cy);
  const dsRieng = o.rieng.map((t) => boCucBim(ng, t, `r${t}`, `Tang ${t} rieng`, o.cx, o.cy));
  const net = (pts: Diem[], day: number, loai: LoaiTuong): TuongBim[] => pts.map((p, i) => ({ a: p, b: pts[(i + 1) % pts.length], day, loai })).filter((t) => dai(tru(t.a, t.b)) >= 100);
  const loiDH = dh.tuong.filter((t) => t.loai === 'loi');
  const de: BoCucBim = { id: 'de', ten: 'Tang de', chan: dh.chan, tuong: [...net(dh.chan, 150, 'kinh'), ...loiDH], cua: [], phong: [], can: [], kyHieu: dh.kyHieu, lo: [], thang: [], dam: [], louver: [] };
  const mai: BoCucBim = { id: 'mai', ten: 'Mai', chan: dh.chan, tuong: [...net(dh.chan, 120, 'lan_can'), ...o.tum.flatMap((r) => net(r.map(dg), 200, 'loi'))], cua: [], phong: [], can: [], kyHieu: [], lo: [], thang: [], dam: [], louver: [] };
  const tum: BoCucBim = { id: 'tum', ten: 'Mai tum', chan: dh.chan, tuong: [], cua: [], phong: [], can: [], kyHieu: [], lo: [], thang: [], dam: [], louver: [] };
  const tang: TangBim[] = [];
  let z = 0;
  for (let i = 0; i < o.soTangDe; i++) { tang.push({ ten: `Tang ${i + 1}`, cao: z, loai: 'de', boCuc: 'de' }); z += o.caoDeMm; }
  const r = new Set(o.rieng);
  for (let j = 1; j <= o.soTangDH; j++) { tang.push({ ten: `Tang ${o.soTangDe + j}`, cao: z, loai: 'dien_hinh', boCuc: r.has(j) ? `r${j}` : 'dh' }); z += P.tang; }
  tang.push({ ten: 'Mai', cao: z, loai: 'mai', boCuc: 'mai' });
  if (o.tum.length) tang.push({ ten: 'Mai tum', cao: z + o.caoTumMm, loai: 'tum', boCuc: 'tum' });
  return {
    phienBan: 1, duAn: o.duAn, mau: o.mau, soToaCung: o.soToaCung, caoTang: P.tang, daySan: P.san, tang,
    boCuc: [de, dh, ...dsRieng, mai, tum], cot: o.cot.map(dg), canhCot: o.canhCot,
  };
}
