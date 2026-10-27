/**
 * Tự chỉnh mặt bằng tầng như app cũ MDI_Unitmix_v4 (prototype/shell.src.html: regenerate · datThangBo · sanhLoi ·
 * ganTrucSanh / capNhatTrucSanh · donHubLoi), bật mặc định, chạy lại sau mỗi lần đổi căn / STRETCH / tối ưu:
 *  - XC-03 (QT-10 · QT-60) ô thang bộ rộng 3.000 mm: hút khe ≤ 600 mm hai bên vào ô; ô thiếu thì nới, căn phía sau dồn theo.
 *  - XC-05 (QT-22b · QT-56) căn quanh lõi khít nét bao lõi MDI-BAO-TM: dải lõi chiếu lên từng mặt làm MỐC dồn khít,
 *    đo chồng / hở giữa khung mô-đun căn và nét bao; hở / đè quá tường chung thì dời đoạn căn về khít (nếu đoạn có đầu tự do).
 *  - XC-06 (QT-72) sảnh thang máy NOTM 3,0 m · NOXH 2,6 m (phân loại ở 2.800 mm): đo sảnh trên nét tường lõi, nét hành lang
 *    nối xuyên lõi dời về tim sảnh.
 *  - XC-07 (QT-19 · QT-25 · QT-51 · QT-54) hành lang liền qua góc, vuông góc: kiểm đồ thị liền, kéo trục tới cửa xa nhất.
 *  - PC-11 (QT-44 · QT-63) thang bộ tự động: dời / thêm thang cạnh căn xa lối thoát nhất (đo thật bằng tinh/pccc.ts),
 *    còn căn vượt thì dò rộng như datThangBo app cũ: thêm ở mọi đoạn, CHUYỂN thang sang mặt / đoạn khác, dời đôi khi kẹt;
 *    rồi cắt bớt thang thừa theo thứ tự cố định, giữ ≥ 2 thang. Tầng có bố cục riêng tự chỉnh riêng (tuChinhToa).
 *
 * Mẫu tòa trong thư viện không đổi. Kết quả là `MatBangSua` lưu trong `ToaDat.matBang` (hoàn tác qua kho.sua);
 * `apMatBang` dựng "mẫu tòa hiệu dụng" (mặt đã dời căn / thang, dải lõi, nét bao, hành lang) cho mọi chỗ vẽ, đếm, kiểm.
 * Hàm thuần, toạ độ mm như toa.json.
 */
import type { BaoCaoTuChinh, Diem, DoanHanhLangMB, KetQuaTuChinh, MatBangSua, SanhMB, ThangBoMB, ThuVien, ToaDat } from './kieu';
import { tongKhe } from './khe';
import { boCucTang, canDangDung, chenhRong, donKhit, ghiDeTang, matDaDon, tangCoRieng, veLoiTaiViTri, viTriCan, type BoCuc, type ToaCoMat } from './matBang';
import { dtHanhLangTang } from './phanChung';
import { chieuCaoPCCC, cuaTrenMat, dungDoThi, gioiHanThoatNan, thoatNan, TIM_CUA_THANG_MM, type MatToa, type PhanTuMat, type ToaPCCC } from './pccc';
import { cuaBienThe } from './toiUu';

// ---------- hằng số (app cũ) ----------
/** XC-03 · QT-10: ô thang bộ luôn rộng 3.000 mm (STAIR_W). */
export const O_THANG_MM = 3000;
/** XC-03 · QT-10: khe ≤ 600 mm hai bên được hút vào ô thang. */
export const KHE_HUT_MM = 600;
/** Chiều sâu bay chuẩn của thư viện căn (BAY). */
export const BAY_MM = 8500;
/** XC-05 · QT-22b: chồng ≤ 200 mm giữa khung căn và nét bao lõi = tường chung (TUONG_CHUNG_MM). Hở ≤ 200 mm cũng coi là khít:
 * CAD gốc có căn hở 150–165 mm (tường căn dày 150 chạm nét bao) — phía hở là giá trị tạm, chờ chủ nhiệm chốt. */
export const TUONG_CHUNG_MM = 200;
/** Dải lõi chiếu lên mặt lệch quá 1 m so với căn kề = lõi hub chéo (T · V · Y), không đo theo mặt — giá trị tạm, chờ chủ nhiệm chốt. */
export const LECH_DAI_LOI_MM = 1000;
/** XC-06 · QT-72: sảnh thang máy NOTM 3,0 m, NOXH / tái định cư 2,6 m; phân loại lõi theo bề rộng sảnh ở 2.800 mm. */
export const SANH_MM = { tm: 3000, xh: 2600 } as const;
export const SANH_PHAN_LOAI_MM = 2800;
/** QT-72: nét hành lang qua sảnh cách tim sảnh ≤ 100 mm là đúng nét CAD; lệch hơn thì dời về tim. */
export const TRUC_SANH_SAI_MM = 100;
/** PC-11 · QT-44: 2–3 thang (GEN_THANG app cũ), tối đa 8 lượt dò. */
export const THANG_MIN = 2;
export const THANG_MAX = 3;
export const LUOT_MAX = 8;
/** PC-11: số lượt dò rộng (thêm / chuyển thang sang mặt khác, như datThangBo app cũ: GEN_THANG.LAP = 3). */
export const LUOT_RONG = 4;
/** Khối thang bộ mặc định và nửa bề ngang khung tường của nó (x_tb_n3: bao −100…3.030 → giữa 1.465; app cũ chenThang). */
export const THANG_KHOI = 'x_tb_n3';
const THANG_GIUA_MM = 1465;
/** Hình lõi không có hướng sảnh thẳng xuyên lõi (hub chéo, chữ T) — app cũ QT-72 không đo, phân loại theo dòng khối. */
const HINH_HUB = new Set(['t', 'v', 'y']);

// ---------- kiểu ----------
export type HinhLoiMB = { bao_tm?: Diem[]; bao_tuong_mm?: number[]; paths?: { cat: string; pts: Diem[] }[] };
/** Dữ liệu tải trước cho tự chỉnh: hình lõi theo tên khối (x_…), tim cửa căn theo ma_goc (tinhCuaCan). */
export type DuLieuMB = { loi: Map<string, HinhLoiMB>; cuaCan: Record<string, number> };
/** Mẫu tòa có mặt + các trường đồ thị hành lang của toa.json. */
export type ToaMB = ToaCoMat & Partial<Pick<ToaPCCC, 'truc' | 'hanhlang_ve' | 'hanh_lang' | 'cua_thang'>>;
export type DaiLoi = { khoaLoi: string; block: string; matIdx: number; t0: number; t1: number };

// ---------- hình học ----------
const rad = (d: number) => (d * Math.PI) / 180;
function coSo(gocDeg: number, truc: number) {
  const u: Diem = [Math.cos(rad(gocDeg)), Math.sin(rad(gocDeg))];
  const n: Diem = [-u[1], u[0]];
  return {
    u, n,
    pt: (a: number, b: number): Diem => [u[0] * a + n[0] * (truc + b), u[1] * a + n[1] * (truc + b)],
    ab: (p: Diem): Diem => [p[0] * u[0] + p[1] * u[1], p[0] * n[0] + p[1] * n[1] - truc],
  };
}
const kc = (a: Diem, b: Diem) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const dtDG = (P: Diem[]) => Math.abs(P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const trongDG = (p: Diem, P: Diem[]) => {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};
/** Cắt đa giác theo nửa mặt phẳng f(p) ≥ 0 (Sutherland–Hodgman). */
function catNua(P: Diem[], f: (p: Diem) => number): Diem[] {
  const R: Diem[] = [];
  for (let i = 0; i < P.length; i++) {
    const A = P[i], B = P[(i + 1) % P.length], fa = f(A), fb = f(B);
    if (fa >= 0) R.push(A);
    if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); R.push([A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1])]); }
  }
  return R;
}
const laMatThat = (m: MatToa) => m.a_cuoi - m.a_dau > 1;

// ---------- lõi: dải trên mặt (XC-05), sảnh (XC-06) ----------
const daGiacLoi = (K: HinhLoiMB): Diem[] | null => {
  if (K.bao_tm?.length) return K.bao_tm;
  const b = K.bao_tuong_mm;
  return b && b.length === 4 ? [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]] : null;
};

/** Các lõi của mẫu (bỏ lượt chèn lặp như app cũ: cùng khối, lệch < 50 mm). */
export function dsLoi(mau: ToaMB): { khoa: string; matIdx: number; q: PhanTuMat }[] {
  const kq: { khoa: string; matIdx: number; q: PhanTuMat }[] = [];
  mau.mat.forEach((m, mi) => m.phan_tu.forEach((q, i) => {
    if (q.loai !== 'loi' || q.bang) return;
    if (kq.some((o) => o.q.block === q.block && Math.abs(o.q.x - q.x) < 50 && Math.abs(o.q.y - q.y) < 50)) return;
    kq.push({ khoa: q.khoa ?? `${mi}:${i}`, matIdx: mi, q });
  }));
  return kq;
}

/** Dải lõi trên từng mặt: nét bao MDI-BAO-TM (thiếu thì khung tường) cắt theo dải bay [0, 8.500] của mặt; chồng ≥ 2 m mới tính. */
export function daiLoi(mau: ToaMB, dl: DuLieuMB | null | undefined): DaiLoi[] {
  if (!dl) return [];
  const kq: DaiLoi[] = [];
  for (const { khoa, q } of dsLoi(mau)) {
    const K = dl.loi.get(q.block), P = K && daGiacLoi(K);
    if (!P) continue;
    const W = veLoiTaiViTri([{ cat: 'b', pts: P }], q)[0].pts;
    mau.mat.forEach((m, mi) => {
      if (!laMatThat(m)) return;
      const B = coSo(m.goc_deg, m.truc_mm);
      let c = catNua(W.map(B.ab), (p) => p[1] - 1);
      c = catNua(c, (p) => BAY_MM - 1 - p[1]);
      if (c.length < 3) return;
      const b0 = Math.min(...c.map((p) => p[1])), b1 = Math.max(...c.map((p) => p[1]));
      if (b1 - b0 < 2000) return;
      const t0 = Math.min(...c.map((p) => p[0])), t1 = Math.max(...c.map((p) => p[0]));
      // lõi hub chéo (T · V · Y) chiếu lên mặt có thể trùm căn vẽ đúng CAD hàng mét: không coi là dải của mặt này
      const trum = Math.max(0, ...m.phan_tu.filter((x) => x.rong_mm > 0 && !x.bang).map((x) => Math.min(x.a1, t1) - Math.max(x.a0, t0)));
      if (trum > LECH_DAI_LOI_MM) return;
      kq.push({ khoaLoi: khoa, block: q.block, matIdx: mi, t0, t1 });
    });
  }
  return kq;
}

/**
 * Sảnh = dải trống xuyên hết chiều sâu khối lõi (app cũ `sanhLoi`): quét x = const bước 25 mm trong khung tường, bỏ 200 mm
 * hai mép; dải liền ≥ 1.000 mm rộng nhất. Trả toạ độ khối (x0, x1, bề rộng, tim) hoặc null.
 */
export function doSanh(K: HinhLoiMB): { x0: number; x1: number; w: number; tim: number } | null {
  const b = K.bao_tuong_mm;
  if (!b || b.length !== 4 || !K.paths) return null;
  const W = K.paths.filter((p) => p.cat === 'wall').map((p) => p.pts);
  const [x0, y0, x1, y1] = b, yA = y0 + 200, yB = y1 - 200, BUOC = 25;
  const cat = (x: number) => W.some((pts) => {
    for (let k = 0; k + 1 < pts.length; k++) {
      const p = pts[k], q = pts[k + 1];
      if ((p[0] - x) * (q[0] - x) < 0) { const y = p[1] + ((q[1] - p[1]) * (x - p[0])) / (q[0] - p[0]); if (y > yA && y < yB) return true; }
    }
    return false;
  });
  let tot: { x0: number; x1: number; w: number; tim: number } | null = null, st: number | null = null;
  for (let x = x0 + 50; x <= x1 - 50 + 1e-6; x += BUOC) {
    const trong = !cat(x), cuoi = x + BUOC > x1 - 50 + 1e-6;
    if (trong && st == null) st = x;
    if (st != null && (!trong || cuoi)) {
      const e = trong ? x : x - BUOC;
      if (e - st >= 1000 && (!tot || e - st > tot.w)) tot = { x0: st, x1: e, w: e - st, tim: (st + e) / 2 };
      st = null;
    }
  }
  return tot;
}

/** Sảnh của từng lõi: đo thẳng (tòa I · L · U · Z), lõi hub T · V · Y thì phân loại theo dòng khối (x_xh_… = NOXH). */
export function sanhCuaToa(mau: ToaMB, dl: DuLieuMB | null | undefined): SanhMB[] {
  if (!dl) return [];
  return dsLoi(mau).map(({ khoa, q }) => {
    const K = dl.loi.get(q.block), s = K && !HINH_HUB.has(mau.hinh) ? doSanh(K) : null;
    return { khoaLoi: khoa, block: q.block, rong: s ? Math.round(s.w) : null, loai: s ? (s.w >= SANH_PHAN_LOAI_MM ? 'tm' : 'xh') : /^x_xh_/.test(q.block) ? 'xh' : 'tm' };
  });
}

// ---------- mặt bằng hiệu dụng ----------
export const banSaoMatBang = (mb: MatBangSua): MatBangSua => ({
  ...mb,
  thangBo: mb.thangBo.map((t) => ({ ...t })),
  dich: { ...(mb.dich ?? {}) },
  mep: Object.fromEntries(Object.entries(mb.mep ?? {}).map(([k, v]) => [k, [v[0], v[1]] as [number, number]])),
  duongBao: mb.duongBao?.map((p): Diem => [p[0], p[1]]),
  hanhLang: mb.hanhLang.map((s) => ({ ...s, p0: [s.p0[0], s.p0[1]], p1: [s.p1[0], s.p1[1]] })),
  hanhLangThem: mb.hanhLangThem?.map((pl) => pl.map((p): Diem => [p[0], p[1]])),
});

const mepMat = (mau: ToaMB, mb: MatBangSua, mi: number): [number, number] => mb.mep?.[mi] ?? [mau.mat[mi].a_dau, mau.mat[mi].a_cuoi];

const nhoApDung = new WeakMap<MatBangSua, { mau: ToaMB; dl: DuLieuMB | null | undefined; kq: ToaMB }>();

/**
 * Mẫu tòa hiệu dụng: căn dời theo `dich`, thang bộ theo `thangBo` (thay thang của mẫu), dải lõi (XC-05) thêm làm mốc,
 * mép mặt, nét bao, hành lang theo `mb`. Khoá vị trí căn / lõi giữ nguyên ("mặt:chỉ số" của mẫu) qua trường `khoa`.
 */
export function apMatBang<T extends ToaMB>(mau: T, mb: MatBangSua, dl?: DuLieuMB | null): T {
  const nho = nhoApDung.get(mb);
  if (nho && nho.mau === mau && nho.dl === dl) return nho.kq as T;
  const kq = dung(mau, mb, dl);
  nhoApDung.set(mb, { mau, dl, kq });
  return kq;
}

/** Như apMatBang nhưng không nhớ (dùng trong lúc dò, `mb` còn bị sửa tại chỗ). */
function dung<T extends ToaMB>(mau: T, mb: MatBangSua, dl?: DuLieuMB | null): T {
  const dai = daiLoi(mau, dl);
  const mat: MatToa[] = mau.mat.map((m, mi) => {
    const [aDau, aCuoi] = mepMat(mau, mb, mi);
    const B = coSo(m.goc_deg, m.truc_mm);
    const pt: PhanTuMat[] = [];
    m.phan_tu.forEach((q, i) => {
      const khoa = `${mi}:${i}`;
      if (q.loai === 'thang_bo') return;
      if (q.loai === 'can') {
        const d = mb.dich?.[khoa] ?? 0;
        pt.push({ ...q, khoa, a0: q.a0 + d, a1: q.a1 + d, x: q.x + B.u[0] * d, y: q.y + B.u[1] * d });
      } else pt.push({ ...q, khoa });
    });
    for (const t of mb.thangBo) {
      if (t.matIdx !== mi) continue;
      const p = B.pt(t.a0 + t.dIns, t.bIns);
      pt.push({ loai: 'thang_bo', ma: t.block, block: t.block, ma_thu_vien: null, a0: t.a0, a1: t.a0 + t.rong, rong_mm: t.rong, sau_mm: BAY_MM, x: p[0], y: p[1], rot: m.goc_deg, sx: t.sx, sy: 1, khoa: t.khoa });
    }
    for (const d of dai) {
      if (d.matIdx !== mi) continue;
      const p = B.pt((d.t0 + d.t1) / 2, 0);
      pt.push({ loai: 'loi', bang: true, ma: d.block, block: d.block, ma_thu_vien: null, a0: d.t0, a1: d.t1, rong_mm: d.t1 - d.t0, sau_mm: null, x: p[0], y: p[1], rot: m.goc_deg, sx: 1, sy: 1, khoa: `${d.khoaLoi}@${mi}` });
    }
    return { ...m, a_dau: aDau, a_cuoi: aCuoi, phan_tu: pt };
  });
  const duong_bao = mb.duongBao ?? mau.duong_bao;
  const kq: T = {
    ...mau,
    mat,
    duong_bao,
    dtxd_m2: mb.duongBao ? Math.round(dtDG(duong_bao) / 1e4) / 100 : mau.dtxd_m2,
    hanh_lang: mb.hanhLang.length ? mb.hanhLang : mau.hanh_lang,
    hanhlang_ve: [...(mau.hanhlang_ve ?? []), ...(mb.hanhLangThem ?? [])],
    cua_thang: undefined,
  };
  return kq;
}

// ---------- mặt bằng mặc định: mẫu tòa + XC-03 (ô thang 3.000) ----------

/** Điểm chèn khối thang canh giữa ô (app cũ chenThang): lệch so với mép đầu ô. */
export const dInsThang = (sx: 1 | -1) => O_THANG_MM / 2 - sx * THANG_GIUA_MM;

type VatThe = { k: string; loai: 'can' | 'thang'; a0: number; w: number };
/** Căn + thang bộ trên một mặt theo `mb` (vị trí trước dồn khít), sắp theo a0. */
function vatThe(mau: ToaMB, mb: MatBangSua, mi: number): VatThe[] {
  const ds: VatThe[] = [];
  mau.mat[mi].phan_tu.forEach((q, i) => {
    if (q.loai !== 'can') return;
    const k = `${mi}:${i}`;
    ds.push({ k, loai: 'can', a0: q.a0 + (mb.dich?.[k] ?? 0), w: q.a1 - q.a0 });
  });
  for (const t of mb.thangBo) if (t.matIdx === mi) ds.push({ k: t.khoa, loai: 'thang', a0: t.a0, w: t.rong });
  return ds.sort((a, b) => a.a0 - b.a0);
}
function dich(mb: MatBangSua, v: VatThe, d: number) {
  if (v.loai === 'can') { mb.dich ??= {}; mb.dich[v.k] = (mb.dich[v.k] ?? 0) + d; } else { const t = mb.thangBo.find((x) => x.khoa === v.k); if (t) t.a0 += d; }
}

/** Đầu mặt tự do = điểm cách mép 1 m ra ngoài, giữa bay, nằm ngoài nét bao (đầu cánh, không phải góc nối cánh khác). */
function dauTuDo(mau: ToaMB, mb: MatBangSua, mi: number, cuoi: boolean): boolean {
  const m = mau.mat[mi], B = coSo(m.goc_deg, m.truc_mm), [aDau, aCuoi] = mepMat(mau, mb, mi);
  return !trongDG(B.pt(cuoi ? aCuoi + 1000 : aDau - 1000, BAY_MM / 2), mb.duongBao ?? mau.duong_bao);
}

type Doan = { lo: number; hi: number; tuDau: boolean; tuCuoi: boolean };
/** Đoạn giữa hai mốc (dải lõi / đầu mặt) chứa vị trí a trên mặt mi. */
function doanTai(mau: ToaMB, mb: MatBangSua, dai: DaiLoi[], mi: number, a: number): Doan {
  const [aDau, aCuoi] = mepMat(mau, mb, mi);
  let lo = aDau, hi = aCuoi, coLo = false, coHi = false;
  for (const d of dai) {
    if (d.matIdx !== mi) continue;
    if (d.t1 <= a + 1 && d.t1 > lo) { lo = d.t1; coLo = true; }
    if (d.t0 >= a - 1 && d.t0 < hi) { hi = d.t0; coHi = true; }
  }
  return { lo, hi, tuDau: !coLo && dauTuDo(mau, mb, mi, false), tuCuoi: !coHi && dauTuDo(mau, mb, mi, true) };
}

/**
 * Nối nét bao: đổi đoạn biên a = aE (hệ mặt) phủ dải b ∈ [b0, b1] thành đường vòng lồi ra (d > 0) hoặc lõm vào (d < 0)
 * theo hướng `huong` (+1 = về phía a tăng). Không tìm được cạnh biên phủ dải thì trả null (không đoán).
 */
export function noiNetBao(P: Diem[], gocDeg: number, truc: number, aE: number, huong: 1 | -1, d: number, b0 = 0, b1 = BAY_MM): Diem[] | null {
  const B = coSo(gocDeg, truc), Q = P.map(B.ab);
  for (let i = 0; i < Q.length; i++) {
    const A = Q[i], C = Q[(i + 1) % Q.length];
    if (Math.abs(A[0] - aE) > 5 || Math.abs(C[0] - aE) > 5) continue;
    const lo = Math.min(A[1], C[1]), hi = Math.max(A[1], C[1]);
    if (lo > b0 + 60 || hi < b1 - 60) continue;
    const c0 = Math.abs(lo - b0) <= 60 ? lo : b0, c1 = Math.abs(hi - b1) <= 60 ? hi : b1, a2 = aE + huong * d;
    const chen: Diem[] = A[1] > C[1] ? [[aE, c1], [a2, c1], [a2, c0], [aE, c0]] : [[aE, c0], [a2, c0], [a2, c1], [aE, c1]];
    const R = [...Q.slice(0, i + 1), ...chen, ...Q.slice(i + 1)];
    const gon = R.filter((p, k) => kc(p, R[(k + R.length - 1) % R.length]) > 1);
    return gon.map(([a, b]) => B.pt(a, b));
  }
  return null;
}

/** Mặt mi dài thêm d (âm = ngắn lại) ở đầu tự do; nối nét bao. Sai thì false (không đổi gì). */
function gianMat(mau: ToaMB, mb: MatBangSua, mi: number, cuoi: boolean, d: number): boolean {
  const m = mau.mat[mi], [aDau, aCuoi] = mepMat(mau, mb, mi);
  const P = noiNetBao(mb.duongBao ?? mau.duong_bao, m.goc_deg, m.truc_mm, cuoi ? aCuoi : aDau, cuoi ? 1 : -1, d);
  if (!P) return false;
  mb.duongBao = P;
  mb.mep = { ...(mb.mep ?? {}), [mi]: cuoi ? [aDau, aCuoi + d] : [aDau - d, aCuoi] };
  return true;
}

const nhoMacDinh = new WeakMap<ToaMB, Map<DuLieuMB | null, MatBangSua>>();

/**
 * Mặt bằng mặc định của mẫu: thang của bản vẽ thành ô 3.000 mm (XC-03 · QT-10: hút khe ≤ 600 mm hai bên, điểm chèn giữ nguyên
 * nên không căn nào xê dịch; QT-60: ô còn thiếu thì nới, thang canh giữa ô, căn phía đầu tự do dồn theo, mặt dài ra).
 */
export function matBangMacDinh(mau: ToaMB, dl?: DuLieuMB | null): MatBangSua {
  let theoDl = nhoMacDinh.get(mau);
  const co = theoDl?.get(dl ?? null);
  if (co) return co;
  const mb: MatBangSua = { phienBan: 1, thangBo: [], dich: {}, hanhLang: (mau.hanh_lang ?? []).map((s) => ({ ...s })) };
  const dai = daiLoi(mau, dl);
  mau.mat.forEach((m, mi) => {
    if (!laMatThat(m)) return;
    const B = coSo(m.goc_deg, m.truc_mm);
    const ps = m.phan_tu.map((q, i) => ({ q, i })).filter((o) => o.q.rong_mm > 0).sort((a, b) => a.q.a0 - b.q.a0);
    ps.forEach(({ q, i }, k) => {
      if (q.loai !== 'thang_bo') return;
      const eL = k > 0 ? ps[k - 1].q.a1 : m.a_dau, eR = k < ps.length - 1 ? ps[k + 1].q.a0 : m.a_cuoi;
      const a0 = q.a0 - eL <= KHE_HUT_MM ? eL : q.a0, a1 = eR - q.a1 <= KHE_HUT_MM ? eR : q.a1;
      const [aIns, bIns] = B.ab([q.x, q.y]);
      mb.thangBo.push({ khoa: `${mi}:${i}`, matIdx: mi, a0, rong: a1 - a0, sx: q.sx < 0 ? -1 : 1, dIns: aIns - a0, bIns, block: q.block || THANG_KHOI, nguon: 'mau' });
    });
  });
  // QT-60: ô thang thiếu so với 3.000 mm → nới, dồn phần phía đầu tự do
  for (const t of mb.thangBo) {
    const thieu = O_THANG_MM - t.rong;
    if (thieu <= 20) continue;
    const dn = doanTai(mau, mb, dai, t.matIdx, t.a0 + t.rong / 2);
    const vt = vatThe(mau, mb, t.matIdx).filter((v) => v.a0 >= dn.lo - 1 && v.a0 + v.w <= dn.hi + 1 && v.k !== t.khoa);
    if (dn.tuCuoi && gianMat(mau, mb, t.matIdx, true, thieu)) {
      vt.filter((v) => v.a0 >= t.a0 + t.rong - 1).forEach((v) => dich(mb, v, thieu));
    } else if (dn.tuDau && gianMat(mau, mb, t.matIdx, false, thieu)) {
      vt.filter((v) => v.a0 + v.w <= t.a0 + 1).forEach((v) => dich(mb, v, -thieu));
      t.a0 -= thieu;
    } else continue;
    t.rong = O_THANG_MM;
    t.dIns = dInsThang(t.sx);
  }
  if (!theoDl) nhoMacDinh.set(mau, (theoDl = new Map()));
  theoDl.set(dl ?? null, mb);
  return mb;
}

/** Mặt bằng đang dùng của tòa: đã tự chỉnh (lưu trong PA) hoặc mặc định của mẫu. */
export const matBangCua = (toa: Pick<ToaDat, 'matBang'>, mau: ToaMB, dl?: DuLieuMB | null): MatBangSua => toa.matBang ?? matBangMacDinh(mau, dl);

type ToaCoTang = Pick<ToaDat, 'matBang' | 'tangRieng' | 'soTangDH'>;
/** Mặt bằng đã tự chỉnh RIÊNG của tầng `tang` (bố cục riêng khác bố cục chung), không có thì null. */
export const matBangRiengTang = (toa: Partial<ToaCoTang>, tang: number | null | undefined): MatBangSua | null =>
  (tang != null && toa.tangRieng && toa.soTangDH != null ? ghiDeTang(toa as ToaCoTang, tang)?.matBang : null) ?? null;
/** Mặt bằng đang dùng ở tầng `tang` (null = bố cục chung): riêng của tầng, không thì chung / mặc định của mẫu. */
export const matBangTang = (toa: Partial<ToaCoTang>, mau: ToaMB, dl: DuLieuMB | null | undefined, tang: number | null | undefined): MatBangSua =>
  matBangRiengTang(toa, tang) ?? toa.matBang ?? matBangMacDinh(mau, dl);

/** Mẫu tòa hiệu dụng của một tòa (dùng thay mẫu thư viện ở màn Tầng). */
export const mauHieuDung = <T extends ToaMB>(toa: Partial<ToaCoTang>, mau: T, dl?: DuLieuMB | null, tang?: number | null): T => apMatBang(mau, matBangTang(toa, mau, dl, tang), dl);

// ---------- đo ----------
type DanhGia = { vuot: number; vuotMax: number; xaNhat: number; khongToi: number; ok: boolean };
const tot = (a: DanhGia, b: DanhGia | null) => !b || a.vuot < b.vuot || (a.vuot === b.vuot && (a.vuotMax < b.vuotMax - 1e-6 || (Math.abs(a.vuotMax - b.vuotMax) <= 1e-6 && a.xaNhat < b.xaNhat - 1e-6)));

/** Tim cửa căn (khoá ma_goc) cho các căn đang dùng, gồm biến thể STRETCH. */
function cuaCanDung(ids: Iterable<string>, tv: ThuVien, cuaCan: Record<string, number>): Record<string, number> {
  const kq: Record<string, number> = {};
  for (const id of new Set(ids)) { const c = tv.can.get(id), x = c && cuaBienThe(c, cuaCan, tv); if (c && x !== undefined) kq[c.ma_goc] = x; }
  return kq;
}

function danhGia(mauHD: ToaMB, bc: BoCuc, tv: ThuVien, cuaCan: Record<string, number>, H: number) {
  const mat = matDaDon(mauHD, bc, tv);
  const tn = thoatNan({ ...(mauHD as unknown as ToaPCCC), mat, truc: mauHD.truc ?? [], hanhlang_ve: mauHD.hanhlang_ve ?? [] }, { cuaCan, chieuCaoPCCC: H });
  const xau = tn.can.filter((c) => c.vuot);
  const dg: DanhGia = {
    vuot: tn.soVuot,
    vuotMax: Math.max(0, ...xau.map((c) => (c.cuLy === null ? 1e3 : c.cuLy - c.nguong))),
    xaNhat: tn.maxTravel,
    khongToi: tn.can.filter((c) => c.cuLy === null).length,
    ok: true,
  };
  return { dg, tn, mat };
}

// ---------- PC-11: thang bộ tự động ----------

/** Các chỗ cắt hợp lệ trong đoạn: giữa hai vật thể liền nhau, nơi tổng chênh bề ngang căn tính từ đầu dãy căn = 0 (vị trí trước và sau dồn khít trùng nhau). */
function choCat(vt: VatThe[], dn: Doan, chenh: Map<string, number>): number[] {
  const trong = vt.filter((v) => v.a0 >= dn.lo - 1 && v.a0 + v.w <= dn.hi + 1);
  const kq = new Set<number>();
  if (trong.length) { kq.add(Math.round(trong[0].a0 * 10) / 10); }
  let tong = 0;
  trong.forEach((v, i) => {
    tong = v.loai === 'can' ? tong + (chenh.get(v.k) ?? 0) : 0;
    const hetDay = i === trong.length - 1 || Math.abs(trong[i + 1].a0 - (v.a0 + v.w)) > 2 || trong[i + 1].loai !== 'can';
    if (Math.abs(tong) <= 1 || v.loai !== 'can') kq.add(Math.round((v.a0 + v.w) * 10) / 10);
    if (hetDay) tong = 0;
  });
  return [...kq];
}

function themThang(mau: ToaMB, mb: MatBangSua, dai: DaiLoi[], mi: number, p: number, sx: 1 | -1, khoa: string): boolean {
  const dn = doanTai(mau, mb, dai, mi, p);
  const vt = vatThe(mau, mb, mi).filter((v) => v.a0 >= dn.lo - 1 && v.a0 + v.w <= dn.hi + 1);
  if (dn.tuCuoi && gianMat(mau, mb, mi, true, O_THANG_MM)) {
    vt.filter((v) => v.a0 >= p - 1).forEach((v) => dich(mb, v, O_THANG_MM));
    mb.thangBo.push({ khoa, matIdx: mi, a0: p, rong: O_THANG_MM, sx, dIns: dInsThang(sx), bIns: 0, block: THANG_KHOI, nguon: 'them' });
    return true;
  }
  if (dn.tuDau && gianMat(mau, mb, mi, false, O_THANG_MM)) {
    vt.filter((v) => v.a0 + v.w <= p + 1).forEach((v) => dich(mb, v, -O_THANG_MM));
    mb.thangBo.push({ khoa, matIdx: mi, a0: p - O_THANG_MM, rong: O_THANG_MM, sx, dIns: dInsThang(sx), bIns: 0, block: THANG_KHOI, nguon: 'them' });
    return true;
  }
  return false;
}

function boThang(mau: ToaMB, mb: MatBangSua, dai: DaiLoi[], khoa: string): boolean {
  const t = mb.thangBo.find((x) => x.khoa === khoa);
  if (!t) return false;
  const dn = doanTai(mau, mb, dai, t.matIdx, t.a0 + t.rong / 2);
  const vt = vatThe(mau, mb, t.matIdx).filter((v) => v.a0 >= dn.lo - 1 && v.a0 + v.w <= dn.hi + 1 && v.k !== khoa);
  if (dn.tuCuoi && gianMat(mau, mb, t.matIdx, true, -t.rong)) vt.filter((v) => v.a0 >= t.a0 + t.rong - 1).forEach((v) => dich(mb, v, -t.rong));
  else if (dn.tuDau && gianMat(mau, mb, t.matIdx, false, -t.rong)) vt.filter((v) => v.a0 + v.w <= t.a0 + 1).forEach((v) => dich(mb, v, t.rong));
  else return false;
  mb.thangBo = mb.thangBo.filter((x) => x !== t);
  return true;
}

/** Dời thang trong cùng đoạn tới chỗ cắt p (đổi chỗ với các vật thể ở giữa, mặt không dài ra), lật cửa theo sx. */
function doiThang(mau: ToaMB, mb: MatBangSua, khoa: string, p: number, sx: 1 | -1): boolean {
  const t = mb.thangBo.find((x) => x.khoa === khoa);
  if (!t) return false;
  const vt = vatThe(mau, mb, t.matIdx).filter((v) => v.k !== khoa);
  if (p > t.a0 + t.rong - 1) {
    vt.filter((v) => v.a0 >= t.a0 + t.rong - 1 && v.a0 + v.w <= p + 1).forEach((v) => dich(mb, v, -t.rong));
    t.a0 = p - t.rong;
  } else if (p < t.a0 + 1) {
    vt.filter((v) => v.a0 >= p - 1 && v.a0 + v.w <= t.a0 + 1).forEach((v) => dich(mb, v, t.rong));
    t.a0 = p;
  }
  if (t.sx !== sx || t.nguon === 'them' || Math.abs(t.rong - O_THANG_MM) > 20) { t.sx = sx; t.dIns = dInsThang(sx); }
  return true;
}

/** Các đoạn (giữa hai mốc dải lõi / đầu mặt) trên mặt mi. */
function dsDoan(mau: ToaMB, mb: MatBangSua, dai: DaiLoi[], mi: number): Doan[] {
  const [aDau] = mepMat(mau, mb, mi);
  const kq: Doan[] = [];
  for (const a of [aDau + 1, ...dai.filter((d) => d.matIdx === mi).map((d) => d.t1 + 1)]) {
    const dn = doanTai(mau, mb, dai, mi, a);
    if (dn.hi - dn.lo > 1 && !kq.some((o) => Math.abs(o.lo - dn.lo) < 1 && Math.abs(o.hi - dn.hi) < 1)) kq.push(dn);
  }
  return kq;
}

/**
 * Trạm của thang trên trục hành lang (app cũ `station`): chiếu cửa buồng thang lên đoạn trục (không phải đoạn nối) song song
 * mặt gần nhất; trả chỉ số đoạn + toạ độ dọc trục (không kẹp, để hai thang ngoài đầu trục vẫn đo đúng).
 */
function tramThang(mau: ToaMB, mb: MatBangSua, t: ThangBoMB): { truc: number; s: number } | null {
  const p = cuaThang(mau, t), u = coSo(mau.mat[t.matIdx].goc_deg, 0).u;
  let tot3: { truc: number; s: number; d: number } | null = null;
  mb.hanhLang.forEach((ax, i) => {
    if (ax.noi) return;
    const v: Diem = [ax.p1[0] - ax.p0[0], ax.p1[1] - ax.p0[1]], L = Math.hypot(v[0], v[1]);
    if (L < 1) return;
    const w: Diem = [v[0] / L, v[1] / L];
    if (Math.abs(u[0] * w[0] + u[1] * w[1]) < 0.999) return;
    const q: Diem = [p[0] - ax.p0[0], p[1] - ax.p0[1]], s = q[0] * w[0] + q[1] * w[1], a = Math.max(0, Math.min(L, s));
    const d = Math.hypot(q[0] - a * w[0], q[1] - a * w[1]);
    if (!tot3 || d < tot3.d) tot3 = { truc: i, s, d };
  });
  return tot3;
}

/** Cửa buồng thang (mm, thế giới) theo ô thang. */
function cuaThang(mau: ToaMB, t: ThangBoMB): Diem {
  const m = mau.mat[t.matIdx], B = coSo(m.goc_deg, m.truc_mm);
  return B.pt(t.a0 + t.dIns + t.sx * TIM_CUA_THANG_MM, 0);
}

export type TuyChonTuChinh = { chieuCaoPCCC: number; bc: BoCuc };

/**
 * PC-11 (QT-44): xuất phát từ thang của bản vẽ; mỗi lượt đo thật (thoatNan) rồi chọn MỘT phép tốt nhất: dời một thang tới chỗ
 * cắt khác trong đoạn của nó (lật cửa hai chiều), hoặc thêm một thang (≤ 3) cạnh căn tệ nhất. Hết căn vượt / hết phép tốt hơn /
 * 8 lượt thì dừng; còn căn vượt thì dò rộng (doRong: thêm mọi đoạn / chuyển mặt / dời đôi, hai điểm xuất phát). Sau đó cắt bớt
 * thang theo thứ tự cố định (mặt rồi vị trí) chừng nào vẫn không thêm căn vượt và còn ≥ 2 thang.
 * Hai thang trên cùng một mặt phải cách nhau ≥ ngưỡng hành lang cụt (luật nội bộ MDI do chủ nhiệm chốt, QT-44).
 */
function thangTuDong(mau: ToaMB, mb0: MatBangSua, dl: DuLieuMB | null | undefined, tv: ThuVien, cuaCan: Record<string, number>, H: number, bc: BoCuc) {
  const dai = daiLoi(mau, dl);
  const kcMin = gioiHanThoatNan(H).cut * 1000;
  const vtsGoc = viTriCan(mau, tv);
  const chenh = new Map(vtsGoc.map((v) => [v.khoa, chenhRong(v, canDangDung(v, bc), tv)]));
  const hopLe = (mb: MatBangSua, moi: string) => {
    const t = mb.thangBo.find((x) => x.khoa === moi);
    if (!t) return true;
    const p = cuaThang(mau, t);
    if (!mb.thangBo.every((o) => o === t || o.matIdx !== t.matIdx || kc(cuaThang(mau, o), p) >= kcMin)) return false;
    // app cũ (datThangBo · legal): hai thang chiếu lên CÙNG trục hành lang phải cách nhau ≥ ngưỡng cụt (kể cả khác mặt)
    const a = tramThang(mau, mb, t);
    return !a || mb.thangBo.every((o) => { if (o === t) return true; const b = tramThang(mau, mb, o); return !b || b.truc !== a.truc || Math.abs(b.s - a.s) >= kcMin; });
  };
  // đo trên mặt bằng đã kéo trục hành lang tới cửa thang / căn đã dời (XC-07 chạy sau PC-11): thang ở đầu dãy mới tính đúng
  // phép tạo khe / đè (tinh/khe.ts) nhiều hơn mặt bằng xuất phát thì loại ngay trong lúc dò (không đợi gác cuối bỏ cả PC-11)
  const kheGoc = tongKhe(dung(mau, mb0, dl), tv, bc);
  const xet = (mb: MatBangSua) => {
    const c = banSaoMatBang(mb);
    hanhLangToiCua(mau, c, dl, cuaCan);
    const hd = dung(mau, c, dl), r = danhGia(hd, bc, tv, cuaCan, H);
    if (mb !== mb0) { const k = tongKhe(hd, tv, bc); if (k.de > kheGoc.de || k.mm > kheGoc.mm + 200) r.dg = { ...r.dg, vuot: 1e6 }; }
    return r;
  };
  let cur = mb0, dgCur = xet(cur);
  const truoc = dgCur.dg;
  let soThem = 0, soDoi = 0, soBo = 0;
  for (let luot = 0; luot < LUOT_MAX && dgCur.dg.vuot > 0; luot++) {
    let tot1: { mb: MatBangSua; r: ReturnType<typeof xet>; loai: 'doi' | 'them' } | null = null;
    const thu = (mb: MatBangSua, loai: 'doi' | 'them') => {
      const r = xet(mb);
      if (tot(r.dg, dgCur.dg) && (!tot1 || tot(r.dg, tot1.r.dg))) tot1 = { mb, r, loai };
    };
    // (1) dời từng thang trong đoạn của nó
    for (const t of cur.thangBo) {
      const dn = doanTai(mau, cur, dai, t.matIdx, t.a0 + t.rong / 2);
      for (const p of choCat(vatThe(mau, cur, t.matIdx), dn, chenh)) {
        for (const sx of [1, -1] as const) {
          if ((Math.abs(p - t.a0) < 1 || Math.abs(p - t.a0 - t.rong) < 1) && sx === t.sx) continue;
          const mb = banSaoMatBang(cur);
          if (doiThang(mau, mb, t.khoa, p, sx) && hopLe(mb, t.khoa)) thu(mb, 'doi');
        }
      }
    }
    // (2) thêm một thang cạnh căn tệ nhất (mặt của căn đó), nếu còn chỗ trong số thang cho phép
    if (cur.thangBo.length < THANG_MAX) {
      const xau = dgCur.tn.can.filter((c) => c.vuot).sort((a, b) => (b.cuLy ?? 1e9) - b.nguong - ((a.cuLy ?? 1e9) - a.nguong))[0];
      const vts = viTriCan(dung(mau, cur, dl), tv);
      const vtXau = xau && vts[xau.so - 1];
      if (vtXau) {
        const mi = vtXau.matIdx, khoa = `tb${luot}:${mi}:${Math.round(vtXau.a0)}`;
        const dn = doanTai(mau, cur, dai, mi, (vtXau.a0 + vtXau.a1) / 2);
        for (const p of choCat(vatThe(mau, cur, mi), dn, chenh)) {
          if (Math.abs(p - (vtXau.a0 + vtXau.a1) / 2) > kcMin) continue;
          for (const sx of [1, -1] as const) {
            const mb = banSaoMatBang(cur);
            if (themThang(mau, mb, dai, mi, p, sx, khoa) && hopLe(mb, khoa)) thu(mb, 'them');
          }
        }
      }
    }
    if (!tot1) break;
    const t1 = tot1 as { mb: MatBangSua; r: ReturnType<typeof xet>; loai: 'doi' | 'them' };
    cur = t1.mb; dgCur = t1.r;
    if (t1.loai === 'them') soThem++; else soDoi++;
  }
  // Còn căn vượt: dò rộng như datThangBo app cũ — thêm thang ở BẤT KỲ đoạn nào (mọi mặt), hoặc CHUYỂN một thang sang mặt /
  // đoạn khác (bỏ ở đoạn cũ: dãy co lại ở đầu tự do; đặt ở chỗ cắt mới: dãy dài ra ở đầu tự do). Chỉ nhận phép làm tốt hơn.
  const daXet = new Map<string, ReturnType<typeof xet>>();
  const xetNho = (mb: MatBangSua) => {
    const k = JSON.stringify([mb.thangBo.map((t) => [t.matIdx, Math.round(t.a0), t.sx]).sort(), mb.dich, mb.mep]);
    let r = daXet.get(k);
    if (!r) { r = xet(mb); daXet.set(k, r); }
    return r;
  };
  type Loai = 'doi' | 'them' | 'chuyen';
  /** Leo dốc từ `goc`: mỗi lượt lấy phép tốt nhất trong dời / thêm (mọi đoạn) / chuyển thang sang đoạn / mặt khác. */
  const doRong = (goc: MatBangSua, dgGoc: ReturnType<typeof xet>) => {
    let c = goc, dg = dgGoc;
    const dem = { doi: 0, them: 0, chuyen: 0 };
    for (let luot = 0; luot < LUOT_RONG && dg.dg.vuot > 0; luot++) {
      let tot2: { mb: MatBangSua; r: ReturnType<typeof xet>; loai: Loai } | null = null;
      const thu = (mb: MatBangSua, loai: Loai) => {
        const r = xetNho(mb);
        if (tot(r.dg, dg.dg) && (!tot2 || tot(r.dg, tot2.r.dg))) tot2 = { mb, r, loai };
      };
      /** Đặt một thang `khoa` vào mọi chỗ cắt của mọi đoạn có đầu tự do trên mọi mặt của `nen`. */
      const datMoiCho = (nen: MatBangSua, khoa: string, loai: Loai) => {
        mau.mat.forEach((m, mi) => {
          if (!laMatThat(m)) return;
          for (const dn of dsDoan(mau, nen, dai, mi)) {
            if (!dn.tuDau && !dn.tuCuoi) continue;
            for (const p of choCat(vatThe(mau, nen, mi), dn, chenh)) for (const sx of [1, -1] as const) {
              const mb = banSaoMatBang(nen);
              if (themThang(mau, mb, dai, mi, p, sx, khoa) && hopLe(mb, khoa)) thu(mb, loai);
            }
          }
        });
      };
      // dời trong đoạn (tinh chỉnh sau khi thêm / chuyển, như bước dò ±1.500 mm của app cũ)
      for (const t of c.thangBo) {
        const dn = doanTai(mau, c, dai, t.matIdx, t.a0 + t.rong / 2);
        for (const p of choCat(vatThe(mau, c, t.matIdx), dn, chenh)) for (const sx of [1, -1] as const) {
          if ((Math.abs(p - t.a0) < 1 || Math.abs(p - t.a0 - t.rong) < 1) && sx === t.sx) continue;
          const mb = banSaoMatBang(c);
          if (doiThang(mau, mb, t.khoa, p, sx) && hopLe(mb, t.khoa)) thu(mb, 'doi');
        }
      }
      if (c.thangBo.length < THANG_MAX) datMoiCho(c, `tbr${luot}`, 'them');
      for (const t of c.thangBo) {
        const bo = banSaoMatBang(c);
        if (boThang(mau, bo, dai, t.khoa)) datMoiCho(bo, t.khoa, 'chuyen');
      }
      // kẹt (không phép đơn nào tốt hơn): dời HAI thang cùng lúc trong đoạn của chúng (giữ chiều cửa) — app cũ thoát kẹt bằng
      // cách thử lại từng thang trên cả tập vị trí sau mỗi lượt; ở đây dãy co giãn theo thang nên cần phép đôi
      if (!tot2) {
        const cats = c.thangBo.map((t) => choCat(vatThe(mau, c, t.matIdx), doanTai(mau, c, dai, t.matIdx, t.a0 + t.rong / 2), chenh));
        for (let i = 0; i < c.thangBo.length; i++) for (let j = i + 1; j < c.thangBo.length; j++) {
          const ti = c.thangBo[i], tj = c.thangBo[j];
          for (const p of cats[i]) {
            if (Math.abs(p - ti.a0) < 1 || Math.abs(p - ti.a0 - ti.rong) < 1) continue;
            const mi = banSaoMatBang(c);
            if (!doiThang(mau, mi, ti.khoa, p, ti.sx)) continue;
            // chỗ cắt của thang j đọc lại sau khi thang i dời (cùng mặt thì các vật thể giữa đã xê dịch)
            for (const q of choCat(vatThe(mau, mi, tj.matIdx), doanTai(mau, mi, dai, tj.matIdx, mi.thangBo[j].a0 + tj.rong / 2), chenh)) {
              const tj1 = mi.thangBo[j];
              if (Math.abs(q - tj1.a0) < 1 || Math.abs(q - tj1.a0 - tj1.rong) < 1) continue;
              const mb = banSaoMatBang(mi);
              if (doiThang(mau, mb, tj.khoa, q, tj.sx) && hopLe(mb, ti.khoa) && hopLe(mb, tj.khoa)) thu(mb, 'doi');
            }
          }
        }
      }
      if (!tot2) break;
      const t2 = tot2 as { mb: MatBangSua; r: ReturnType<typeof xet>; loai: Loai };
      c = t2.mb; dg = t2.r; dem[t2.loai]++;
    }
    return { c, dg, dem };
  };
  let soChuyen = 0;
  if (dgCur.dg.vuot > 0) {
    // hai điểm xuất phát (app cũ cũng thử nhiều hạt giống): kết quả leo dốc gần căn tệ ở trên, và thang của bản vẽ
    const a = doRong(cur, dgCur), b = doRong(mb0, xet(mb0));
    const kq = tot(b.dg.dg, a.dg.dg) ? { ...b, goc: true } : { ...a, goc: false };
    if (kq.goc) { soThem = 0; soDoi = 0; }
    cur = kq.c; dgCur = kq.dg;
    soThem += kq.dem.them; soDoi += kq.dem.doi; soChuyen = kq.dem.chuyen;
  }
  // cắt bớt: thứ tự cố định (mặt rồi vị trí), giữ ≥ 2 thang, không thêm căn vượt
  if (cur.thangBo.length > THANG_MIN && dgCur.dg.vuot === 0) {
    for (const t of [...cur.thangBo].sort((a, b) => a.matIdx - b.matIdx || a.a0 - b.a0)) {
      if (cur.thangBo.length <= THANG_MIN) break;
      const mb = banSaoMatBang(cur);
      if (!boThang(mau, mb, dai, t.khoa)) continue;
      const r = xet(mb);
      if (r.dg.vuot === 0 && r.dg.khongToi <= dgCur.dg.khongToi) { cur = mb; dgCur = r; soBo++; }
    }
  }
  return { mb: cur, truoc, sau: dgCur.dg, tn: dgCur.tn, soThem, soDoi, soBo, soChuyen };
}

// ---------- XC-05: căn khít nét bao lõi ----------
type DoKhit = { khoaLoi: string; matIdx: number; ben: 'dau' | 'cuoi'; chong: number };
/** Độ chồng (+) / hở (−) giữa khung căn / ô thang kề và nét bao lõi, trên các mặt có dải lõi (sau dồn khít). */
export function doKhitLoi(mauHD: ToaMB, dai: DaiLoi[]): DoKhit[] {
  const kq: DoKhit[] = [];
  for (const d of dai) {
    const el = mauHD.mat[d.matIdx].phan_tu.filter((q) => !q.bang && q.rong_mm > 0);
    const L = el.filter((q) => q.a0 < d.t0 && q.a1 > d.t0 - 3000).sort((a, b) => b.a1 - a.a1)[0];
    const R = el.filter((q) => q.a1 > d.t1 && q.a0 < d.t1 + 3000).sort((a, b) => a.a0 - b.a0)[0];
    if (L && L.a1 - d.t0 <= LECH_DAI_LOI_MM) kq.push({ khoaLoi: d.khoaLoi, matIdx: d.matIdx, ben: 'dau', chong: L.a1 - d.t0 });
    if (R && d.t1 - R.a0 <= LECH_DAI_LOI_MM) kq.push({ khoaLoi: d.khoaLoi, matIdx: d.matIdx, ben: 'cuoi', chong: d.t1 - R.a0 });
  }
  return kq;
}

/** Sửa XC-05: hở / đè quá tường chung thì dời cả đoạn căn kề lõi về khít (chồng 0, QT-56), nếu đoạn có đầu tự do. */
function suaKhitLoi(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined, tv: ThuVien, bc: BoCuc): number {
  const dai = daiLoi(mau, dl);
  let sua = 0;
  for (const k of doKhitLoi(capNhatDonKhit(mau, mb, dl, tv, bc), dai)) {
    if (Math.abs(k.chong) <= TUONG_CHUNG_MM) continue;
    const d = dai.find((x) => x.khoaLoi === k.khoaLoi && x.matIdx === k.matIdx)!;
    const a = k.ben === 'dau' ? d.t0 - 1 : d.t1 + 1, dn = doanTai(mau, mb, dai, k.matIdx, a);
    const vt = vatThe(mau, mb, k.matIdx).filter((v) => v.a0 >= dn.lo - 1 && v.a0 + v.w <= dn.hi + 1);
    // đoạn phía đầu: dời +(-chong) về lõi, đầu tự do co / giãn theo; đoạn phía cuối: dời +chong
    const dd = k.ben === 'dau' ? -k.chong : k.chong;
    if (k.ben === 'dau' ? dn.tuDau && gianMat(mau, mb, k.matIdx, false, -dd) : dn.tuCuoi && gianMat(mau, mb, k.matIdx, true, dd)) {
      vt.forEach((v) => dich(mb, v, dd));
      sua++;
    }
  }
  return sua;
}

/** Mặt sau dồn khít (căn đang dùng) đặt vào mẫu hiệu dụng — để đo khít lõi theo vị trí thật. */
function capNhatDonKhit(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined, tv: ThuVien, bc: BoCuc): ToaMB {
  const hd = dung(mau, mb, dl);
  return { ...hd, mat: matDaDon(hd, bc, tv) };
}

// ---------- XC-06: nét hành lang qua tim sảnh ----------
export function trucQuaSanh(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined): { sua: number; lechMax: number } {
  let sua = 0, lechMax = 0;
  if (!dl) return { sua, lechMax };
  for (const { matIdx, q } of dsLoi(mau)) {
    const K = dl.loi.get(q.block);
    if (!K || HINH_HUB.has(mau.hinh)) continue;
    const s = doSanh(K), b = K.bao_tuong_mm;
    if (!s || !b) continue;
    const u = coSo(mau.mat[matIdx].goc_deg, 0).u;
    const [tim] = veLoiTaiViTri([{ cat: 'b', pts: [[s.tim, (b[1] + b[3]) / 2]] }], q)[0].pts;
    const aTim = tim[0] * u[0] + tim[1] * u[1];
    const khung = veLoiTaiViTri([{ cat: 'b', pts: [[b[0], b[1] - 3000], [b[2], b[1] - 3000], [b[2], b[3] + 3000], [b[0], b[3] + 3000]] }], q)[0].pts;
    for (const sg of mb.hanhLang) {
      if (!sg.noi) continue;
      const dx = sg.p1[0] - sg.p0[0], dy = sg.p1[1] - sg.p0[1], L = Math.hypot(dx, dy) || 1;
      if (Math.abs((dx * u[0] + dy * u[1]) / L) > 0.05) continue; // phải vuông góc mặt lõi
      const g: Diem = [(sg.p0[0] + sg.p1[0]) / 2, (sg.p0[1] + sg.p1[1]) / 2];
      if (!trongDG(g, khung)) continue;
      const lech = aTim - (g[0] * u[0] + g[1] * u[1]);
      lechMax = Math.max(lechMax, Math.abs(lech));
      if (Math.abs(lech) <= TRUC_SANH_SAI_MM) continue;
      // dời đoạn nối và các đầu mút trùng nó (nằm trên trục dọc mặt nên dời dọc u vẫn trên trục)
      const cu = [sg.p0, sg.p1].map((p): Diem => [p[0], p[1]]);
      for (const o of mb.hanhLang) for (const key of ['p0', 'p1'] as const) {
        if (o !== sg && !cu.some((c) => kc(c, o[key]) < 400)) continue;
        o[key] = [o[key][0] + u[0] * lech, o[key][1] + u[1] * lech];
      }
      sua++;
    }
  }
  return { sua, lechMax };
}

// ---------- XC-07: hành lang liền, vuông góc, tới cửa xa nhất ----------
function hanhLangToiCua(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined, cuaCan: Record<string, number>): number {
  const hd = dung(mau, mb, dl);
  if (!mb.hanhLang.length) return 0;
  const dsCua = (x: ToaMB) => { const { can, thang } = cuaTrenMat(x as unknown as ToaPCCC, cuaCan); return [...can.map((c) => ({ p: c.p, h: c.huong })), ...thang.map((t) => ({ p: t.p, h: t.huong }))]; };
  // chỉ cửa ĐÃ DỜI so với mẫu (thêm / dời thang, dãy dài ra): đồ thị app cũ của bản vẽ gốc giữ nguyên như CAD (QT-54)
  const goc = dsCua(dung(mau, matBangMacDinh(mau, dl), dl));
  const cua = dsCua(hd).filter((c) => !goc.some((g) => kc(g.p, c.p) < 1));
  const nuaHL = (mau.hanh_lang_mm || 1800) / 2;
  let sua = 0;
  for (const c of cua) {
    // trục song song gần nhất (không phải đoạn nối)
    let tot2: { s: DoanHanhLangMB; t: number; L: number; d: number } | null = null;
    for (const s of mb.hanhLang) {
      if (s.noi) continue;
      const v: Diem = [s.p1[0] - s.p0[0], s.p1[1] - s.p0[1]], L = Math.hypot(v[0], v[1]);
      if (L < 1 || Math.abs((v[0] * c.h[1] - v[1] * c.h[0]) / L) > 0.02) continue;
      const t = ((c.p[0] - s.p0[0]) * v[0] + (c.p[1] - s.p0[1]) * v[1]) / L;
      const d = Math.abs(((c.p[0] - s.p0[0]) * v[1] - (c.p[1] - s.p0[1]) * v[0]) / L);
      if (d > nuaHL + 600) continue;
      const ngoai = t < 0 ? -t : t > L ? t - L : 0;
      if (!tot2 || ngoai + d < tot2.t + tot2.d) tot2 = { s, t, L, d };
    }
    if (!tot2 || (tot2.t >= -1 && tot2.t <= tot2.L + 1)) continue;
    const { s, t, L } = tot2;
    const dau = t < 0 ? 'p0' : 'p1', dauMut = s[dau];
    // chỉ kéo đầu cụt (không có đoạn khác chạm đầu đó)
    if (mb.hanhLang.some((o) => o !== s && (kc(o.p0, dauMut) < 400 || kc(o.p1, dauMut) < 400))) continue;
    const v: Diem = [(s.p1[0] - s.p0[0]) / L, (s.p1[1] - s.p0[1]) / L];
    const moi: Diem = t < 0 ? [s.p0[0] + v[0] * t, s.p0[1] + v[1] * t] : [s.p0[0] + v[0] * t, s.p0[1] + v[1] * t];
    mb.hanhLangThem = [...(mb.hanhLangThem ?? []), [[dauMut[0], dauMut[1]], moi]];
    // sàn hành lang mọc thêm: nối nét bao ở đầu hành lang cũ (hệ mặt của cửa, dải b ∈ [−HL, 0]) nếu có cạnh biên phủ
    const m = mau.mat.find((f) => { const B = coSo(f.goc_deg, f.truc_mm); return Math.abs(B.u[0] * c.h[0] + B.u[1] * c.h[1]) > 0.999 && Math.abs(B.ab(c.p)[1]) < 50; });
    if (m) {
      const B = coSo(m.goc_deg, m.truc_mm), a0 = B.ab(dauMut)[0], a1 = B.ab(moi)[0];
      const P = noiNetBao(mb.duongBao ?? mau.duong_bao, m.goc_deg, m.truc_mm, a0, a1 > a0 ? 1 : -1, Math.abs(a1 - a0), -(mau.hanh_lang_mm || 1800), 0);
      if (P) mb.duongBao = P;
    }
    s[dau] = moi;
    sua++;
  }
  return sua;
}

/** Đoạn hành lang không vuông góc / song song với phương mặt nào (QT-19: hành lang không chạy chéo). */
function doanXien(mau: ToaMB, hl: DoanHanhLangMB[]): number {
  const huong = mau.mat.map((m) => coSo(m.goc_deg, 0).u);
  return hl.filter((s) => {
    const dx = s.p1[0] - s.p0[0], dy = s.p1[1] - s.p0[1], L = Math.hypot(dx, dy);
    if (L < 1) return false;
    return !huong.some((u) => Math.abs(dx * u[0] + dy * u[1]) > L - 2 || Math.abs(dx * u[1] - dy * u[0]) > L - 2);
  }).length;
}

/** Số mảng rời của đồ thị hành lang (dungDoThi, gộp nút 400 mm). */
export function soMangHL(hd: ToaMB): number {
  const G = dungDoThi({ ...(hd as unknown as ToaPCCC), truc: hd.truc ?? [], hanhlang_ve: hd.hanhlang_ve ?? [] });
  const goc = G.nut.map((_, i) => i);
  const tim = (x: number): number => (goc[x] === x ? x : (goc[x] = tim(goc[x])));
  G.canh.forEach((e) => { goc[tim(e.i)] = tim(e.j); });
  return new Set(G.canh.map((e) => tim(e.i))).size;
}

// ---------- QT-69: dãy dài ra / ngắn lại ở đầu tự do khi STRETCH không có căn bù ----------
/**
 * Dồn khít (XC-04) báo đoạn có tổng bề ngang đổi (`lech`): đầu chạy là đầu MẶT tự do thì mặt dài ra / ngắn lại đúng phần
 * chênh, nét bao nối theo (DTXD nhảy theo — QT-69 / QT-57c app cũ). Trả số đoạn đã nối.
 */
function noiDaiRa(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined, tv: ThuVien, bc: BoCuc): { so: number; mm: number } {
  const hd = dung(mau, mb, dl);
  let so = 0, mm = 0;
  for (const l of donKhit(hd, viTriCan(hd, tv), bc, tv).lech) {
    const [aD, aC] = mepMat(mau, mb, l.matIdx);
    if (Math.abs(l.a - (l.cuoi ? aC : aD)) > 50 || !dauTuDo(mau, mb, l.matIdx, l.cuoi)) continue;
    if (gianMat(mau, mb, l.matIdx, l.cuoi, l.mm)) { so++; mm += l.mm; }
  }
  return { so, mm };
}

// ---------- tổng hợp ----------
/**
 * Lý do còn căn vượt sau PC-11 (app cũ cũng dừng ở đây: GEN_THANG.MAX = 3 thang, không cắt căn khi chưa được chủ nhiệm cho):
 * đã đủ 3 thang / không còn đoạn có đầu tự do để thêm thang / căn vượt nằm ở đầu cụt.
 */
function lyDoVuot(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined, cuoi: { tn: ReturnType<typeof thoatNan> }, nT: number): string {
  const dai = daiLoi(mau, dl);
  const coCho = mau.mat.some((m, mi) => laMatThat(m) && dsDoan(mau, mb, dai, mi).some((d) => d.tuDau || d.tuCuoi));
  const xau = cuoi.tn.can.filter((c) => c.vuot);
  const cut = xau.filter((c) => c.cut).length;
  // thang chuyển được = thang ở đoạn có đầu tự do (bỏ đi thì dãy co lại, không để khe)
  const kep = mb.thangBo.filter((t) => { const d = doanTai(mau, mb, dai, t.matIdx, t.a0 + t.rong / 2); return !d.tuDau && !d.tuCuoi; }).length;
  const ly = [
    nT >= THANG_MAX ? `đã đủ ${THANG_MAX} thang (app cũ GEN_THANG.MAX)` : !coCho ? 'không còn đoạn có đầu tự do để thêm thang' : 'không chỗ đặt thang nào làm bớt căn vượt',
    kep ? `${kep}/${nT} thang kẹp giữa lõi / góc, không chuyển mặt được nếu không xếp lại căn` : '',
  ].filter(Boolean).join(' · ');
  return `còn vượt: ${ly}` + (cut ? ` · ${cut} căn ở đầu cụt` : '')
    + ' · app cũ chỉ gỡ được bằng tự sinh (xếp lại cả dãy căn) hoặc giảm căn (giamCanThoatNan) — cần chủ nhiệm quyết';
}

const r1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Chạy năm quy tắc trên bố cục chung của tòa, trả mặt bằng mới (lưu vào ToaDat.matBang) + báo cáo. Gác cuối: khe / đè
 * (tinh/khe.ts) không được nhiều hơn mặt bằng mặc định, nếu không thì bỏ phần thang tự động (PC-11) và báo.
 */
export function tuChinhMatBang(mau: ToaMB, tv: ThuVien, dl: DuLieuMB | null | undefined, opt: TuyChonTuChinh): { matBang: MatBangSua; baoCao: BaoCaoTuChinh } {
  const { bc } = opt, H = opt.chieuCaoPCCC;
  // QT-69 trước: mặt bằng xuất phát đã theo dãy dài ra / ngắn lại (mặc định của mẫu không bị sửa — nhớ dùng chung)
  const mb0 = banSaoMatBang(matBangMacDinh(mau, dl));
  const d69 = noiDaiRa(mau, mb0, dl, tv, bc);
  const vtsGoc = viTriCan(mau, tv);
  const cuaCan = cuaCanDung(vtsGoc.map((v) => canDangDung(v, bc)), tv, dl?.cuaCan ?? {});
  const qt: KetQuaTuChinh[] = [];

  // PC-11
  const pc = thangTuDong(mau, mb0, dl, tv, cuaCan, H, bc);
  let mb = banSaoMatBang(pc.mb);
  // XC-05
  const sua05 = suaKhitLoi(mau, mb, dl, tv, bc);
  // XC-06
  const s06 = trucQuaSanh(mau, mb, dl);
  // XC-07
  const sua07 = hanhLangToiCua(mau, mb, dl, cuaCan);

  // gác khe / đè: không được tệ hơn mặt bằng mặc định
  const kheGoc = tongKhe(dung(mau, mb0, dl), tv, bc), kheMoi = tongKhe(dung(mau, mb, dl), tv, bc);
  let boPC11 = false;
  if (kheMoi.de > kheGoc.de || kheMoi.mm > kheGoc.mm + 200) {
    boPC11 = true;
    mb = banSaoMatBang(mb0);
    suaKhitLoi(mau, mb, dl, tv, bc);
    trucQuaSanh(mau, mb, dl);
    hanhLangToiCua(mau, mb, dl, cuaCan);
  }
  const hd = dung(mau, mb, dl);
  const cuoi = danhGia(hd, bc, tv, cuaCan, H);
  const dai = daiLoi(mau, dl);

  // QT-69
  qt.push({ ma: 'QT-69', muc: d69.so ? 'da_sua' : 'ok', sua: d69.so,
    ghiChu: d69.so ? `${d69.so} dãy ${d69.mm > 0 ? 'dài ra' : 'ngắn lại'} ${Math.abs(Math.round(d69.mm))} mm ở đầu tự do · nét bao + DTXD theo` : 'không có dãy đổi chiều dài' });
  // XC-03
  const thieu = mb.thangBo.filter((t) => t.rong < O_THANG_MM - 20).length;
  const noi = mb0.thangBo.filter((t) => Math.abs(t.rong - (mau.mat[t.matIdx].phan_tu[Number(t.khoa.split(':')[1])]?.rong_mm ?? t.rong)) > 1).length;
  qt.push({ ma: 'XC-03', muc: thieu ? 'canh_bao' : noi ? 'da_sua' : 'ok', sua: noi,
    ghiChu: thieu ? `${thieu} ô thang chưa đủ 3.000 mm (không có đầu tự do để nới)` : `${mb.thangBo.length} ô thang · 3.000 mm · hút khe ≤ 600 mm` });
  // XC-05
  const khit = doKhitLoi({ ...hd, mat: cuoi.mat }, dai);
  const lech05 = khit.filter((k) => Math.abs(k.chong) > TUONG_CHUNG_MM);
  qt.push({ ma: 'XC-05', muc: lech05.length ? 'canh_bao' : sua05 ? 'da_sua' : 'ok', sua: sua05,
    ghiChu: !dai.length ? 'chưa có hình lõi' : lech05.length ? `${lech05.length} chỗ căn hở / đè nét bao lõi > ${TUONG_CHUNG_MM} mm (lớn nhất ${Math.round(Math.max(...lech05.map((k) => Math.abs(k.chong))))} mm)`
      : `${khit.length} mép căn kề lõi khít nét bao (chồng ${Math.round(Math.min(0, ...khit.map((k) => k.chong)))}…${Math.round(Math.max(0, ...khit.map((k) => k.chong)))} mm)` });
  // XC-06
  const sanh = sanhCuaToa(mau, dl);
  const sai06 = sanh.filter((s) => s.loai !== mau.nhom);
  const can06 = SANH_MM[mau.nhom];
  qt.push({ ma: 'XC-06', muc: sai06.length ? 'canh_bao' : s06.sua ? 'da_sua' : 'ok', sua: s06.sua,
    ghiChu: !sanh.length ? 'chưa có hình lõi'
      : `${sanh.map((s) => (s.rong ? `sảnh ${r1(s.rong / 1000)} m` : 'sảnh hub (theo dòng khối)') + ` · lõi ${s.loai === 'tm' ? 'NOTM' : 'NOXH'}`).join('; ')} · cần ${r1(can06 / 1000)} m`
        + (sai06.length ? ' · lõi khác loại hình tòa' : '') + (s06.lechMax ? ` · nét HL lệch tim sảnh ${Math.round(s06.lechMax)} mm` : '') });
  // XC-07
  const xien = doanXien(mau, mb.hanhLang), mang = soMangHL(hd);
  qt.push({ ma: 'XC-07', muc: mang > 1 || cuoi.dg.khongToi || xien ? 'canh_bao' : sua07 ? 'da_sua' : 'ok', sua: sua07,
    ghiChu: `${mang} mạng hành lang · ${cuoi.dg.khongToi} căn không tới thang` + (xien ? ` · ${xien} đoạn chéo` : '') + (sua07 ? ` · kéo ${sua07} đầu trục tới cửa xa nhất` : '') });
  // PC-11
  const nT = mb.thangBo.length;
  const soPC = pc.soThem + pc.soDoi + pc.soBo + pc.soChuyen;
  qt.push({ ma: 'PC-11', muc: boPC11 ? 'canh_bao' : cuoi.dg.vuot ? 'vuot' : soPC ? 'da_sua' : 'ok', sua: boPC11 ? 0 : soPC,
    ghiChu: (boPC11 ? 'bỏ thang tự động vì tạo khe / đè · ' : '') + `${nT} thang (thêm ${boPC11 ? 0 : pc.soThem}, dời ${boPC11 ? 0 : pc.soDoi}, chuyển mặt ${boPC11 ? 0 : pc.soChuyen}, bớt ${boPC11 ? 0 : pc.soBo}) · căn vượt cự ly ${pc.truoc.vuot} → ${cuoi.dg.vuot}`
      + ` · xa nhất ${r1(cuoi.dg.xaNhat)} m · ${gioiHanThoatNan(H).canCu}` + (cuoi.dg.vuot ? ` · ${lyDoVuot(mau, mb, dl, cuoi, nT)}` : '') });

  const baoCao: BaoCaoTuChinh = {
    quyTac: qt,
    soThangTruoc: mb0.thangBo.length,
    soThangSau: nT,
    vuotTruoc: pc.truoc.vuot,
    vuotSau: cuoi.dg.vuot,
    soCan: viTriCan(hd, tv).length,
    dtxdM2: hd.dtxd_m2,
    dtHanhLangM2: Math.round(dtHanhLangTang(hd).m2 * 10) / 10,
  };
  return { matBang: { ...mb, phienBan: 1, sanh, baoCao }, baoCao };
}

/** Hai mặt bằng cùng hình học (thang, độ dời căn, mép mặt, nét bao, hành lang) — báo cáo không tính. */
const cungHinh = (a: MatBangSua, b: MatBangSua) => {
  const k = (m: MatBangSua) => JSON.stringify([m.thangBo, m.dich ?? {}, m.mep ?? {}, m.duongBao ?? null, m.hanhLang, m.hanhLangThem ?? []]);
  return k(a) === k(b);
};
/** Thang bộ của tầng riêng khác bố cục chung (vị trí ô / chiều cửa) — thang phải liền suốt chiều cao nên chỉ cảnh báo. */
export const thangLechChung = (a: MatBangSua, chung: MatBangSua): boolean => {
  const k = (m: MatBangSua) => m.thangBo.map((t) => `${t.matIdx}:${Math.round(t.a0 + t.dIns)}:${t.sx}`).sort().join('|');
  return k(a) !== k(chung);
};

/**
 * Tự chỉnh MỘT tòa trong PA: bố cục chung (ToaDat.matBang, nét bao + DTXD của tòa) rồi TỪNG tầng có bố cục riêng
 * (ToaDat.tangRieng[k].matBang, chỉ lưu khi khác mặt bằng chung) — thoát nạn kiểm theo đúng căn của tầng đó.
 * Tòa tắt tự chỉnh / mẫu không có mặt thì giữ nguyên.
 */
export function tuChinhToa<T extends ToaDat>(toa: T, mau: ToaMB | undefined, tv: ThuVien, dl: DuLieuMB | null | undefined): T {
  if (!mau || !Array.isArray(mau.mat) || toa.tuChinhMB === false) return toa;
  const H = chieuCaoPCCC(toa.soTangDe, toa.caoDe, toa.soTangDH, toa.caoDH);
  const bc: BoCuc = { canTheo: toa.canTheo, canViTri: toa.canViTri, congNang: toa.congNang };
  const { matBang } = tuChinhMatBang(mau, tv, dl, { bc, chieuCaoPCCC: H });
  // nét bao + DTXD riêng của tòa (chanToa / chỉ tiêu đọc): chỉ ghi khi khác nét bao mẫu
  const bao = matBang.duongBao;
  let tangRieng = toa.tangRieng;
  if (tangRieng) {
    const moi: NonNullable<ToaDat['tangRieng']> = { ...tangRieng };
    const coRieng = new Set(tangCoRieng(toa));
    for (const [k, g] of Object.entries(tangRieng)) {
      const tang = Number(k);
      const { matBang: _bo, ...conLai } = g;
      void _bo;
      if (!coRieng.has(tang)) { moi[tang] = conLai; continue; }
      const r = tuChinhMatBang(mau, tv, dl, { bc: boCucTang(toa, tang), chieuCaoPCCC: H }).matBang;
      if (cungHinh(r, matBang)) { moi[tang] = conLai; continue; }
      if (thangLechChung(r, matBang) && r.baoCao) {
        // thang bộ phải liền các tầng: tầng riêng dời / thêm thang khác tầng chung thì báo (không tự gộp)
        const q = r.baoCao.quyTac.find((x) => x.ma === 'PC-11');
        if (q) { q.ghiChu += ' · thang khác bố cục chung — thang bộ phải liền suốt chiều cao, cần chủ nhiệm xem (giá trị tạm, chờ chủ nhiệm chốt)'; if (q.muc !== 'vuot') q.muc = 'canh_bao'; }
      }
      moi[tang] = { ...conLai, matBang: r };
    }
    tangRieng = moi;
  }
  return { ...toa, matBang, duongBao: bao, dtxdM2: bao ? Math.round(dtDG(bao) / 1e4) / 100 : undefined, ...(tangRieng ? { tangRieng } : {}) };
}

/** Chuẩn hoá `matBang` đọc từ PA cũ / tệp: sai cấu trúc thì bỏ (về mặc định của mẫu). */
export function chuanHoaMatBang(v: unknown): MatBangSua | undefined {
  const o = v as Partial<MatBangSua> | null | undefined;
  if (!o || typeof o !== 'object' || o.phienBan !== 1 || !Array.isArray(o.thangBo) || !Array.isArray(o.hanhLang)) return undefined;
  const so = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
  const diem = (p: unknown) => Array.isArray(p) && p.length === 2 && so(p[0]) && so(p[1]);
  if (!o.thangBo.every((t) => t && so(t.matIdx) && so(t.a0) && so(t.rong) && (t.sx === 1 || t.sx === -1) && so(t.dIns) && so(t.bIns) && typeof t.khoa === 'string')) return undefined;
  if (!o.hanhLang.every((s) => s && diem(s.p0) && diem(s.p1))) return undefined;
  if (o.duongBao && !(Array.isArray(o.duongBao) && o.duongBao.length >= 3 && o.duongBao.every(diem))) return undefined;
  return o as MatBangSua;
}

/** Chữ ký mặt bằng đã tự chỉnh (chung + từng tầng riêng) để 3D / hộp xuất CAD dựng lại sau mỗi lần tự chỉnh. */
export const chuKyMatBang = (toa: ToaDat): string => {
  const k = (m: ToaDat['matBang']) => (m ? [m.thangBo, m.dich, m.mep, m.duongBao, m.hanhLang, m.hanhLangThem] : null);
  return JSON.stringify([k(toa.matBang), Object.entries(toa.tangRieng ?? {}).map(([t, g]) => [t, k(g.matBang)])]);
};
