/**
 * Thay LÕI thang máy trong cùng mẫu tòa (app cũ QT-71 · QT-72 · QT-74 · QT-74b):
 *  - thay được khi cùng DẠNG (một dải, cùng phía hành lang) và cùng LOẠI HÌNH (sảnh NOTM 3,0 m / NOXH 2,6 m, ngưỡng 2.800 mm);
 *    tòa mẫu L · T · U · V · Y chỉ lõi cùng mẫu (lõi riêng gắn với góc tòa), tòa I · Z không lấy lõi riêng của các mẫu đó;
 *  - lõi mới đặt cùng điểm chèn rồi dời dọc mặt cho dấu chân trùng TÂM lõi cũ, hoặc sát một mép hành lang vuông góc mặt (QT-74b) —
 *    `ungVienLoiThay` trả các độ dời để thử, cái đầu tiên tự chỉnh khít được thì nhận;
 *  - nét hành lang nối qua sảnh dời về tim sảnh lõi mới (QT-72);
 *  - căn dồn khít vào lõi MỚI do chính tự chỉnh XC-05 làm (mẫu tòa hiệu dụng đã mang lõi mới): `mauToa` dựng `thayLoiMau`.
 * Hàm thuần, không phụ thuộc giao diện.
 */
import type { Diem, LoiThay, ThuVien, ToaMau } from './kieu';
import { BAY_MM, catNua, daGiacLoi, daiLoi, doSanh, dsLoi, ghiMauGocLoi, noiNetBao, type DuLieuMB, type HinhLoiMB, type ToaMB } from './loiThang';
import { coMat, veLoiTaiViTri } from './matBang';

/** Ngưỡng bề rộng sảnh phân NOTM / NOXH (QT-72). */
export const SANH_NGUONG_MM = 2800;
const HINH_RIENG = new Set(['l', 't', 'u', 'v', 'y']);

type ChenLoi = { x: number; y: number; rot: number; sx: number; sy: number };
const rad = (d: number) => (d * Math.PI) / 180;
const co = (goc: number, truc: number) => {
  const u: Diem = [Math.cos(rad(goc)), Math.sin(rad(goc))], n: Diem = [-u[1], u[0]];
  return { u, n, ab: (p: Diem): Diem => [p[0] * u[0] + p[1] * u[1], p[0] * n[0] + p[1] * n[1] - truc] };
};

/** Chữ mẫu của khối lõi: `x_tmdv_z1_tm_08` → 'z'; `x_xh_u1_…` → 'u'. */
export const mauCuaLoi = (block: string): string | null => /^x_(?:tmdv|xh)_([a-z])\d/.exec(block)?.[1] ?? null;

/** Khối lõi của MỌI mẫu tòa trong thư viện (tập có thể thay vào). */
export function khoiLoiThuVien(tv: ThuVien): string[] {
  const s = new Set<string>();
  for (const m of tv.toa.values()) if (coMat(m)) for (const f of m.mat) for (const q of f.phan_tu) if (q.loai === 'loi' && !q.bang && q.block) s.add(q.block);
  return [...s].sort();
}

type Dang = { mot: boolean; phia: 1 | -1 | 0 };
/** Dạng lõi đặt tại `q` trên mặt (goc, truc): một dải chữ nhật? nằm phía b ≥ 0 (+1) / b ≤ 0 (−1) / vắt hành lang (0). */
function dangLoi(K: HinhLoiMB, q: ChenLoi, goc: number, truc: number): Dang {
  const P = daGiacLoi(K);
  if (!P) return { mot: false, phia: 0 };
  const B = co(goc, truc), W = veLoiTaiViTri([{ cat: 'b', pts: P }], q)[0].pts.map(B.ab);
  const a0 = Math.min(...W.map((p) => p[0])), a1 = Math.max(...W.map((p) => p[0])), b0 = Math.min(...W.map((p) => p[1])), b1 = Math.max(...W.map((p) => p[1]));
  let dt = 0;
  for (let i = 0; i < W.length; i++) { const A = W[i], C = W[(i + 1) % W.length]; dt += A[0] * C[1] - C[0] * A[1]; }
  const mot = Math.abs(dt) / 2 >= 0.97 * (a1 - a0) * (b1 - b0);
  return { mot, phia: b0 >= -60 ? 1 : b1 <= 60 ? -1 : 0 };
}

/** Loại hình lõi: sảnh đo thẳng ≥ 2.800 mm = NOTM; hub chéo (T · V · Y · L · U) hoặc không đo được thì theo dòng khối (x_xh_… = NOXH). */
export function loaiHinhLoi(block: string, K: HinhLoiMB | undefined): 'tm' | 'xh' {
  const s = K && doSanh(K);
  if (s && !HINH_RIENG.has(mauCuaLoi(block) ?? '')) return s.w >= SANH_NGUONG_MM ? 'tm' : 'xh';
  return /^x_xh_/.test(block) ? 'xh' : 'tm';
}

export type LyDoLoi = 'cung_khoi' | 'khac_loai_hinh' | 'mau_rieng' | 'khac_dang' | 'thieu_hinh';

/** Có thay lõi `cu` (đang đặt ở `q`, mặt (goc, truc)) bằng `moi` được không; null = được, ngược lại là lý do. */
export function lyDoKhongThay(mau: ToaMau, cu: string, moi: string, q: ChenLoi, goc: number, truc: number, dl: DuLieuMB): LyDoLoi | null {
  if (cu === moi) return 'cung_khoi';
  const K0 = dl.loi.get(cu), K1 = dl.loi.get(moi);
  if (!K0 || !K1) return 'thieu_hinh';
  if (loaiHinhLoi(cu, K0) !== loaiHinhLoi(moi, K1)) return 'khac_loai_hinh';
  const mc = mauCuaLoi(cu), mm = mauCuaLoi(moi);
  if (HINH_RIENG.has(mau.hinh)) return mm !== mau.hinh ? 'mau_rieng' : mc !== mau.hinh ? 'khac_dang' : null;
  if (HINH_RIENG.has(mm ?? '')) return 'mau_rieng';
  const d0 = dangLoi(K0, q, goc, truc), d1 = dangLoi(K1, q, goc, truc);
  return d0.mot && d1.mot && d0.phia === d1.phia && d0.phia !== 0 ? null : 'khac_dang';
}

/** Các khối lõi thay được cho lõi `khoa` của mẫu `mau` (thư viện, chưa thay). */
export function loiThayDuoc(tv: ThuVien, mau: ToaMau, khoa: string, dl: DuLieuMB): string[] {
  if (!coMat(mau)) return [];
  const l = dsLoi(mau as unknown as ToaMB).find((x) => x.khoa === khoa);
  if (!l) return [];
  const f = mau.mat[l.matIdx];
  return khoiLoiThuVien(tv).filter((b) => lyDoKhongThay(mau, l.q.block, b, l.q, f.goc_deg, f.truc_mm, dl) === null);
}

const aTheoMat = (K: HinhLoiMB, q: ChenLoi, u: Diem): [number, number] | null => {
  const P = daGiacLoi(K);
  if (!P) return null;
  const W = veLoiTaiViTri([{ cat: 'b', pts: P }], q)[0].pts.map((p) => p[0] * u[0] + p[1] * u[1]);
  return [Math.min(...W), Math.max(...W)];
};
const giuaY = (K: HinhLoiMB) => ((K.bao_tuong_mm?.[1] ?? 0) + (K.bao_tuong_mm?.[3] ?? 0)) / 2;

/**
 * Các độ dời (điểm chèn lõi mới dọc mặt) nên thử, theo thứ tự ưu tiên: lõi cũ sát một mép hành lang vuông góc mặt (QT-74b) thì neo
 * đúng mép đó trước, sau đó TÂM, rồi hai mép. Kèm đoạn hành lang nối qua sảnh dời về tim sảnh lõi mới (QT-72).
 */
export function ungVienLoiThay(mau: ToaMB, khoa: string, moi: string, dl: DuLieuMB): LoiThay[] {
  const l = dsLoi(mau).find((x) => x.khoa === khoa);
  if (!l) return [];
  const K0 = dl.loi.get(l.q.block), K1 = dl.loi.get(moi);
  const P0 = K0 && daGiacLoi(K0);
  if (!K0 || !K1 || !P0) return [];
  const f = mau.mat[l.matIdx], B = co(f.goc_deg, f.truc_mm);
  const f0 = aTheoMat(K0, l.q, B.u), f1 = aTheoMat(K1, l.q, B.u);
  if (!f0 || !f1) return [];
  const tam = (f0[0] + f0[1]) / 2 - (f1[0] + f1[1]) / 2, trai = f0[0] - f1[0], phai = f0[1] - f1[1];
  // mép lõi cũ sát hành lang vuông góc mặt lõi (mép hành lang trùng mép lõi ±400 mm, hành lang chạy qua ≥ ½ chiều sâu lõi)
  const W0 = veLoiTaiViTri([{ cat: 'b', pts: P0 }], l.q)[0].pts.map(B.ab);
  const b0 = Math.min(...W0.map((p) => p[1])), b1 = Math.max(...W0.map((p) => p[1]));
  let s0 = false, s1 = false;
  for (const ax of mau.hanh_lang ?? []) {
    if (ax.noi) continue;
    const dx = ax.p1[0] - ax.p0[0], dy = ax.p1[1] - ax.p0[1], L = Math.hypot(dx, dy) || 1;
    if (Math.abs((dx * B.u[0] + dy * B.u[1]) / L) > 0.2) continue;
    const pa = ((ax.p0[0] + ax.p1[0]) / 2) * B.u[0] + ((ax.p0[1] + ax.p1[1]) / 2) * B.u[1], pb0 = B.ab(ax.p0)[1], pb1 = B.ab(ax.p1)[1];
    if (Math.min(Math.max(pb0, pb1), b1) - Math.max(Math.min(pb0, pb1), b0) < 0.5 * (b1 - b0)) continue;
    const h = (mau.hanh_lang_mm ?? 1800) / 2;
    if (Math.abs(pa + h - f0[0]) <= 400) s0 = true;
    if (Math.abs(pa - h - f0[1]) <= 400) s1 = true;
  }
  const ds = (s0 ? [trai, tam, phai] : s1 ? [phai, tam, trai] : [tam, trai, phai]).filter((v, i, A) => A.findIndex((x) => Math.abs(x - v) < 1) === i);
  const sOld = doSanh(K0), sNew = doSanh(K1), P1 = daGiacLoi(K1);
  const daiCu = daiLoi(mau, dl).filter((d) => d.khoaLoi === khoa);
  return ds.map((dx) => {
    const kq: LoiThay = { block: moi, dx: Math.round(dx * 10) / 10 };
    // dải lõi mới trên từng mặt đang có dải lõi cũ: dãy căn kề dồn theo mép dải
    const q1d = { ...l.q, x: l.q.x + B.u[0] * dx, y: l.q.y + B.u[1] * dx };
    for (const d of daiCu) {
      const n = P1 && daiTheoMat(P1, q1d, mau.mat[d.matIdx]);
      if (n && (Math.abs(n.t0 - d.t0) > 0.5 || Math.abs(n.t1 - d.t1) > 0.5)) (kq.dich ??= []).push({ mat: d.matIdx, t0: d.t0, t1: d.t1, d0: Math.round((n.t0 - d.t0) * 10) / 10, d1: Math.round((n.t1 - d.t1) * 10) / 10 });
    }
    if (sOld && sNew) {
      const q1 = { ...l.q, x: l.q.x + B.u[0] * dx, y: l.q.y + B.u[1] * dx };
      const p0 = veLoiTaiViTri([{ cat: 'b', pts: [[sOld.tim, giuaY(K0)]] }], l.q)[0].pts[0], p1 = veLoiTaiViTri([{ cat: 'b', pts: [[sNew.tim, giuaY(K1)]] }], q1)[0].pts[0];
      const d = (p1[0] - p0[0]) * B.u[0] + (p1[1] - p0[1]) * B.u[1], a0 = p0[0] * B.u[0] + p0[1] * B.u[1];
      const hl = (mau.hanh_lang ?? []).map((ax, i) => ({ ax, i })).filter(({ ax }) => {
        if (!ax.noi) return false;
        const vx = ax.p1[0] - ax.p0[0], vy = ax.p1[1] - ax.p0[1], L = Math.hypot(vx, vy) || 1;
        if (Math.abs((vx * B.u[0] + vy * B.u[1]) / L) > 0.05) return false; // chỉ trục nối vuông góc mặt lõi
        const am = ((ax.p0[0] + ax.p1[0]) / 2) * B.u[0] + ((ax.p0[1] + ax.p1[1]) / 2) * B.u[1];
        return Math.abs(am - a0) <= 1500 && am >= f0[0] - 1 && am <= f0[1] + 1;
      }).map(({ i }) => i);
      if (hl.length && Math.abs(d) > 0.5) { kq.hl = hl; kq.dHl = Math.round(d * 10) / 10; }
    }
    return kq;
  });
}

/** Dải lõi trên mặt `m` (như `daiLoi` của loiThang, không lọc lõi trùm căn): nét bao lõi cắt theo dải bay [0, 8.500], chồng ≥ 2 m. */
function daiTheoMat(P: Diem[], q: ChenLoi, m: { goc_deg: number; truc_mm: number; a_dau: number; a_cuoi: number }): { t0: number; t1: number } | null {
  if (m.a_cuoi - m.a_dau <= 1) return null;
  const B = co(m.goc_deg, m.truc_mm);
  let c = catNua(veLoiTaiViTri([{ cat: 'b', pts: P }], q)[0].pts.map(B.ab), (p) => p[1] - 1);
  c = catNua(c, (p) => BAY_MM - 1 - p[1]);
  if (c.length < 3) return null;
  const b0 = Math.min(...c.map((p) => p[1])), b1 = Math.max(...c.map((p) => p[1]));
  if (b1 - b0 < 2000) return null;
  return { t0: Math.min(...c.map((p) => p[0])), t1: Math.max(...c.map((p) => p[0])) };
}

const KE_LOI_MM = 450, KHE_CHUOI_MM = 600, DAU_MAT_MM = 400;
/**
 * Dồn khít dãy căn kề dải lõi khi lõi đổi (QT-71 bước 2–3): chuỗi căn / thang liền (khe ≤ 600 mm) ở phía đầu / cuối dải dời theo mép
 * dải mới; đầu xa của chuỗi là đầu mặt thì mặt dài ra / ngắn lại đúng phần dời, nét bao nối theo. Chuỗi không có đầu tự do để co /
 * giãn thì để nguyên (tự chỉnh XC-05 khít đoạn kẹp xử lý tiếp).
 */
function dichChuoi(kq: ToaMB, d: NonNullable<LoiThay['dich']>[number]): void {
  const f = kq.mat[d.mat];
  if (!f) return;
  const u: Diem = [Math.cos(rad(f.goc_deg)), Math.sin(rad(f.goc_deg))];
  const vat = f.phan_tu.filter((q) => q.loai !== 'loi' && q.rong_mm > 0);
  for (const ben of ['dau', 'cuoi'] as const) {
    const dd = ben === 'dau' ? d.d0 : d.d1;
    if (Math.abs(dd) < 0.5) continue;
    const dau = ben === 'dau';
    const chuoi: typeof vat = [];
    let moc = vat.filter((q) => (dau ? q.a1 <= d.t0 + KE_LOI_MM && q.a1 >= d.t0 - KE_LOI_MM : q.a0 >= d.t1 - KE_LOI_MM && q.a0 <= d.t1 + KE_LOI_MM)).sort((a, b) => (dau ? b.a1 - a.a1 : a.a0 - b.a0))[0];
    while (moc) {
      chuoi.push(moc);
      const cu = moc;
      moc = vat.filter((q) => !chuoi.includes(q) && (dau ? cu.a0 - q.a1 <= KHE_CHUOI_MM && q.a1 <= cu.a0 + 1 : q.a0 - cu.a1 <= KHE_CHUOI_MM && q.a0 >= cu.a1 - 1)).sort((a, b) => (dau ? b.a1 - a.a1 : a.a0 - b.a0))[0];
    }
    if (!chuoi.length) continue;
    const xa = dau ? Math.min(...chuoi.map((q) => q.a0)) : Math.max(...chuoi.map((q) => q.a1));
    const daMat = dau ? Math.abs(xa - f.a_dau) <= DAU_MAT_MM : Math.abs(xa - f.a_cuoi) <= DAU_MAT_MM;
    if (!daMat) continue;
    const aE = dau ? f.a_dau : f.a_cuoi;
    const P = noiNetBao(kq.duong_bao, f.goc_deg, f.truc_mm, aE, dau ? -1 : 1, dau ? -dd : dd);
    for (const q of chuoi) { q.a0 += dd; q.a1 += dd; q.x += u[0] * dd; q.y += u[1] * dd; }
    if (dau) f.a_dau += dd; else f.a_cuoi += dd;
    if (P) kq.duong_bao = P; // không nối được thì tự chỉnh dựng lại nét bao từ ô (ghiMauGocLoi)
  }
}

const nho = new WeakMap<ToaMau, Map<string, ToaMau>>();
/**
 * Mẫu tòa sau khi thay lõi: khối lõi + điểm chèn của lõi (kể cả các lượt chèn lặp cùng khối, cùng chỗ) và các đoạn hành lang nối theo
 * `ds`. Không có lõi thay thì trả đúng mẫu vào (cùng đối tượng). Nhớ theo mẫu + nội dung.
 */
export function thayLoiMau<T extends ToaMau>(mau: T, ds: Record<string, LoiThay> | undefined): T {
  if (!ds || !Object.keys(ds).length || !coMat(mau)) return mau;
  const k = JSON.stringify(ds);
  let m = nho.get(mau);
  const da = m?.get(k);
  if (da) return da as T;
  const kq = {
    ...mau,
    mat: mau.mat.map((f) => ({ ...f, phan_tu: f.phan_tu.map((q) => ({ ...q })) })),
    hanh_lang: (mau as unknown as ToaMB).hanh_lang?.map((a) => ({ ...a, p0: [...a.p0] as Diem, p1: [...a.p1] as Diem })),
  } as T & ToaMB;
  for (const [khoa, t] of Object.entries(ds)) {
    const [mi, i] = khoa.split(':').map(Number);
    const goc = mau.mat[mi]?.phan_tu[i];
    if (!goc || goc.loai !== 'loi') continue;
    const u: Diem = [Math.cos(rad(kq.mat[mi].goc_deg)), Math.sin(rad(kq.mat[mi].goc_deg))];
    kq.mat.forEach((f, fi) => f.phan_tu.forEach((q, qi) => {
      const g2 = mau.mat[fi].phan_tu[qi];
      if (g2.loai !== 'loi' || g2.block !== goc.block || Math.abs(g2.x - goc.x) >= 50 || Math.abs(g2.y - goc.y) >= 50) return;
      f.phan_tu[qi] = { ...q, block: t.block, ma: t.block, x: g2.x + u[0] * t.dx, y: g2.y + u[1] * t.dx };
    }));
    for (const d of t.dich ?? []) dichChuoi(kq, d);
    if (t.hl && t.dHl && kq.hanh_lang) for (const j of t.hl) {
      const a = kq.hanh_lang[j];
      if (a) { a.p0 = [a.p0[0] + u[0] * t.dHl, a.p0[1] + u[1] * t.dHl]; a.p1 = [a.p1[0] + u[0] * t.dHl, a.p1[1] + u[1] * t.dHl]; }
    }
  }
  ghiMauGocLoi(kq, mau as unknown as ToaMB);
  if (!m) nho.set(mau, (m = new Map()));
  if (m.size > 30) m.clear();
  m.set(k, kq);
  return kq;
}
