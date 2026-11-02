/**
 * Dựng 3D cả tòa từ mẫu tòa + mẫu căn đã chọn: khối đế đặc + N tầng điển hình (từng căn ghép theo đúng vị trí / hướng / lật gương
 * trên mặt tòa) + mái + tum lõi. Tầng điển hình dựng MỘT lần, gộp theo vật liệu rồi nhân bản để tòa 30–40 tầng vẫn quay mượt.
 * `mau` là mặt bằng ĐÃ TỰ CHỈNH (tinh/loiThang.ts · apMatBang): ô thang mới / đã dời, căn đã dồn, nét bao dài ra (QT-69), hành
 * lang kéo dài; `mauTang` cho tầng có mặt bằng riêng. Dải lõi chiếu lên mặt (`bang`, XC-05) chỉ là mốc, không dựng.
 */
import { chayHet, type Tung } from './chiaNho';
import type * as THREE from 'three';
import type { Diem, ThuVien, ToaDat } from '../tinh/kieu';
import { boCucTang, canDangDung, congNangTai, khungTaiO, soCanChuVi, tangCoRieng, veLoiTaiViTri, viTriCan, type BoCuc, type ToaCoMat } from '../tinh/matBang';
import { kheHoNetBao, type DauHanhLang } from './kheHo';
import { nguongLod, type BanDoChonToa, type CanChon } from './chon3d';
import { dungCan, hinhDaiCua, nhomMoi, type Khoi3d, type NhomHien, type T3, type ThamSo3D, type VatLieu3D } from './dungCan';

const K = 0.001;
export const CAO_TANG_DE_MM = 4000;
export const CAO_TUM_MM = 3000;

/**
 * Khối đế (mỗi tầng đế cao `CAO_TANG_DE_MM` = 4.000): sàn dày 150 · dầm biên cao 700 · giữa sàn và dầm là vách kính 3.150 chia đố —
 * đố đứng nhịp 1,2 m, đố ngang một đố ở cao 2,4 m tính từ mặt sàn. Cột (chu vi) và vách lõi cắm thẳng từ khối tháp xuống tới chân đế.
 */
export const SAN_DE_MM = 150;
export const DAM_DE_MM = 700;
export const NHIP_DO_DUNG_MM = 1200;
export const CAO_DO_NGANG_MM = 2400;
const DAM_NHO_MM = 15, DO_RONG_DAM_MM = 300, DO_RONG_DO_MM = 60, DO_SAU_DO_MM = 120, COT_DE_MM = 600, NHIP_COT_TOI_DA_MM = 8400;

/** Dựng khối đế chi tiết vào `ngoai` (vật liệu: sàn `san`, dầm `de`, cột / vách lõi `lov` (xám bê tông), đố `khung`, kính trong `kinhDe`). Trả số mảnh để kiểm thử. */
export function dungKhoiDe(T: T3, ngoai: THREE.Object3D, M: VatLieu3D, foot: Diem[], soDe: number, loi: Diem[][], khoiDac: (pts: Diem[], h: number, m: THREE.Material, z0: number) => THREE.Mesh): number {
  let dem = 0;
  const hop = (m: THREE.Material, mx: number, my: number, yc: number, dai: number, cao: number, sau: number, goc: number) => {
    const me = new T.Mesh(new T.BoxGeometry(dai * K, cao * K, sau * K), m);
    me.position.set(mx * K, yc * K, -my * K); me.rotation.y = goc; ngoai.add(me); dem++;
  };
  // hướng đa giác: vào trong = bên trái cạnh khi ngược chiều kim đồng hồ
  let dt = 0; foot.forEach((p, i) => { const q = foot[(i + 1) % foot.length]; dt += p[0] * q[1] - q[0] * p[1]; });
  const dau = dt >= 0 ? 1 : -1;
  const [cx, cy] = trongTam(foot);
  const tang = CAO_TANG_DE_MM, hKinh = tang - SAN_DE_MM - DAM_DE_MM;
  for (let k = 0; k < soDe; k++) {
    const y0 = k * tang;
    khoiDac(foot, SAN_DE_MM, M.san, y0); dem++;
    foot.forEach((p, i) => {
      const q = foot[(i + 1) % foot.length], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy);
      if (L < 300) return;
      const ux = dx / L, uy = dy / L, nx = -uy * dau, ny = ux * dau, goc = Math.atan2(dy, dx), mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      const vao = (d: number) => [mx + nx * d, my + ny * d] as const;
      // dầm biên cao 700 ở đỉnh tầng, mép ngoài nhô 15 mm khỏi đường bao: sàn tầng điển hình đầu tiên của tháp (nằm sát đỉnh đế) có mép đúng đường bao,
      // nếu dầm cũng đúng đường bao thì hai mặt trùng nhau (z-fighting) — nhô nhẹ thì dầm luôn che mép sàn
      const [bx, by] = vao(DO_RONG_DAM_MM / 2 - DAM_NHO_MM);
      hop(M.de, bx, by, y0 + tang - DAM_DE_MM / 2, L, DAM_DE_MM, DO_RONG_DAM_MM, goc);
      // tấm kính + đố ngang (một đố ở 2,4 m trên mặt sàn)
      const [kx, ky] = vao(DO_SAU_DO_MM / 2);
      const yKinh0 = y0 + SAN_DE_MM;
      hop(M.kinhDe, kx, ky, yKinh0 + hKinh / 2, L, hKinh, 20, goc);
      hop(M.khung, kx, ky, yKinh0 + CAO_DO_NGANG_MM, L, DO_RONG_DO_MM, DO_SAU_DO_MM, goc);
      hop(M.khung, kx, ky, yKinh0 + DO_RONG_DO_MM / 2, L, DO_RONG_DO_MM, DO_SAU_DO_MM, goc);
      // đố đứng: chia đều quanh 1,2 m (không để mẩu lẻ cuối cạnh)
      const n = Math.max(1, Math.round(L / NHIP_DO_DUNG_MM));
      for (let j = 1; j < n; j++) {
        const t = (j / n - 0.5) * L;
        hop(M.khung, kx + ux * t, ky + uy * t, yKinh0 + hKinh / 2, DO_RONG_DO_MM, hKinh, DO_SAU_DO_MM, goc);
      }
    });
  }
  // cột chu vi: ở các góc và chia đều cạnh dài (nhịp ≤ 8,4 m) — cao suốt khối đế, nằm trong đường bao
  const hDe = soDe * tang;
  const cot = (px: number, py: number) => {
    const vx = cx - px, vy = cy - py, l = Math.hypot(vx, vy) || 1, d = COT_DE_MM * 0.75;
    hop(M.lov, px + (vx / l) * d, py + (vy / l) * d, hDe / 2, COT_DE_MM, hDe, COT_DE_MM, 0); // bê tông xám đậm hơn dầm / sàn để cột đọc rõ sau kính
  };
  foot.forEach((p, i) => {
    cot(p[0], p[1]);
    const q = foot[(i + 1) % foot.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.ceil(L / NHIP_COT_TOI_DA_MM);
    for (let j = 1; j < n; j++) cot(p[0] + ((q[0] - p[0]) * j) / n, p[1] + ((q[1] - p[1]) * j) / n);
  });
  // vách lõi: đúng ranh lõi của tầng điển hình, kéo thẳng xuống chân đế
  loi.forEach((r) => { khoiDac(r, hDe, M.lov, 0); dem++; });
  return dem;
}

/** `bao_tm` = đa giác khung tường thật của lõi (chữ V / T / Y không phải hình chữ nhật); `bao_tuong_mm` = hộp bao chữ nhật (dự phòng). */
export type LoiHinh = { bao_tuong_mm?: [number, number, number, number]; bao_tm?: Diem[]; /** vùng tường lõi (nét `wall` đóng kín, toạ độ cục bộ) — dò khe hở nét bao */ tuong?: Diem[][] };
export type DuLieuToa = {
  mau: ToaCoMat & { duong_bao: Diem[] };
  toa: Pick<ToaDat, 'canTheo' | 'canViTri' | 'congNang' | 'tangRieng' | 'soTangDe' | 'soTangDH'>;
  tv: ThuVien;
  khoi3d: Map<string, Khoi3d | null>;
  loi: Map<string, LoiHinh>;
  idLoi: (block: string) => string;
  /** Mặt bằng hiệu dụng của tầng (null = bố cục chung); thiếu = mọi tầng dùng `mau`. */
  mauTang?: (tang: number | null) => DuLieuToa['mau'];
};
type MauToa3D = DuLieuToa['mau'] & { hanhlang_ve?: Diem[][]; hanh_lang_mm?: number };

/** Dải sàn hành lang (mm) quanh tim p→q, rộng w. */
const daiHL = (p: Diem, q: Diem, w: number): Diem[] | null => {
  const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy);
  if (L < 1) return null;
  const nx = (-dy / L) * (w / 2), ny = (dx / L) * (w / 2);
  return [[p[0] + nx, p[1] + ny], [q[0] + nx, q[1] + ny], [q[0] - nx, q[1] - ny], [p[0] - nx, p[1] - ny]];
};
const trongDG = (p: Diem, P: Diem[]) => {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};
/** Sàn hành lang nằm NGOÀI nét bao (trục kéo dài tới cửa xa nhất khi nét bao không nối được — XC-07): dải cần đổ thêm. */
export function sanHanhLangNgoai(mau: MauToa3D): Diem[][] {
  const w = mau.hanh_lang_mm || 1800, kq: Diem[][] = [];
  for (const pl of mau.hanhlang_ve ?? []) for (let k = 1; k < pl.length; k++) {
    const d = daiHL(pl[k - 1], pl[k], w);
    if (d && !trongDG([(pl[k - 1][0] + pl[k][0]) / 2, (pl[k - 1][1] + pl[k][1]) / 2], mau.duong_bao)) kq.push(d);
  }
  return kq;
}

/** Ranh tum lõi / buồng thang của một mặt bằng (bỏ dải lõi `bang` — chỉ là mốc dồn khít, không phải khối thật). */
export function ranhTum(mau: DuLieuToa['mau'], loi: Map<string, LoiHinh>, idLoi: (b: string) => string): Diem[][] {
  return ranhTumCo(mau, loi, idLoi).map((r) => r.pts);
}
/** Như `ranhTum` (mm, toạ độ mặt tòa) kèm cờ thang bộ (khối `loi-tb-*`: N2 / N3) để tô trục thang khác lõi. */
export function ranhTumCo(mau: DuLieuToa['mau'], loi: Map<string, LoiHinh>, idLoi: (b: string) => string): { pts: Diem[]; thang: boolean }[] {
  const kq: { pts: Diem[]; thang: boolean }[] = [];
  for (const m of mau.mat) for (const q of m.phan_tu) {
    if (q.loai === 'can' || q.bang) continue;
    const id = idLoi(q.block), l = loi.get(id);
    const rl = l && (l.bao_tm?.length ? ranhLoiDG(l.bao_tm, q) : l.bao_tuong_mm ? ranhLoi(l.bao_tuong_mm, q) : null);
    if (rl) kq.push({ pts: rl, thang: id.startsWith('loi-tb-') });
  }
  return kq;
}

const rad = (d: number) => (d * Math.PI) / 180;

const noi = (L: Float32Array[]) => { if (L.length === 1) return L[0]; let n = 0; L.forEach((a) => { n += a.length; }); const o = new Float32Array(n); let p = 0; L.forEach((a) => { o.set(a, p); p += a.length; }); return o; };

/** Hình học đã gộp theo khoá vật liệu (mỗi khoá một mảng đỉnh / pháp tuyến; nét = cặp đoạn). */
type GomTheo<K> = { mesh: Map<K, { P: Float32Array[]; N: (Float32Array | null)[] }>; net: Map<K, Float32Array[]> };
const gomMoi = <K>(): GomTheo<K> => ({ mesh: new Map(), net: new Map() });
const lay = <K, V>(m: { get(k: K): V | undefined; set(k: K, v: V): unknown }, k: K, tao: () => V): V => { let v = m.get(k); if (v === undefined) m.set(k, (v = tao())); return v; };

/** Trải mọi mesh / nét (đang hiện) của `src` theo toạ độ thế giới vào `gom`, khoá theo vật liệu qua `khoa`. */
function gomHinh<K>(T: T3, src: THREE.Object3D, gom: GomTheo<K>, khoa: (m: THREE.Material) => K): void {
  src.updateMatrixWorld(true);
  const themMesh = (geo: THREE.BufferGeometry, mt: THREE.Matrix4, mat: THREE.Material) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(mt);
    const r = lay(gom.mesh, khoa(mat), () => ({ P: [], N: [] }));
    r.P.push(g.getAttribute('position').array as Float32Array);
    r.N.push((g.getAttribute('normal')?.array as Float32Array | undefined) ?? null);
    g.dispose();
  };
  const themNet = (mat: THREE.Material, a: Float32Array) => { lay(gom.net, khoa(mat), () => []).push(a); };
  const m4 = new T.Matrix4();
  src.traverse((o) => {
    for (let v: THREE.Object3D | null = o; v && v !== src; v = v.parent) if (!v.visible) return;
    const m = o as THREE.Mesh & { isInstancedMesh?: boolean; isLineSegments?: boolean; isLine?: boolean };
    if (m.isInstancedMesh) {
      const im = o as THREE.InstancedMesh;
      for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, m4); m4.premultiply(im.matrixWorld); themMesh(im.geometry, m4, im.material as THREE.Material); }
    } else if (m.isMesh) {
      themMesh(m.geometry, m.matrixWorld, m.material as THREE.Material);
    } else if (m.isLineSegments) {
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      themNet(m.material as THREE.Material, g.getAttribute('position').array as Float32Array);
      g.dispose();
    } else if (m.isLine) { // dải nét liền → cặp đoạn
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      const a = g.getAttribute('position').array as Float32Array, n = a.length / 3, o2 = new Float32Array(Math.max(0, n - 1) * 6);
      for (let i = 0; i + 1 < n; i++) o2.set(a.subarray(i * 3, i * 3 + 6), i * 6);
      themNet(m.material as THREE.Material, o2);
      g.dispose();
    }
  });
}

/** Hình học đã gộp sẵn để dựng lại: mỗi khoá vật liệu một BufferGeometry (dùng chung giữa các lần dựng, khung 3D không huỷ khi còn dùng). */
export type HinhGop<K = string> = { mesh: { k: K; g: THREE.BufferGeometry }[]; net: { k: K; g: THREE.BufferGeometry }[] };

/** Nối các mảng đã gom thành MỘT BufferGeometry mỗi khoá vật liệu (mesh) + MỘT mỗi khoá nét. */
function chotGom<K>(T: T3, gom: GomTheo<K>): HinhGop<K> {
  const kq: HinhGop<K> = { mesh: [], net: [] };
  gom.mesh.forEach((r, k) => {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(noi(r.P), 3));
    if (r.N.every(Boolean)) g.setAttribute('normal', new T.BufferAttribute(noi(r.N as Float32Array[]), 3)); else g.computeVertexNormals();
    g.computeBoundingSphere();
    kq.mesh.push({ k, g });
  });
  gom.net.forEach((P, k) => {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(noi(P), 3));
    g.computeBoundingSphere();
    kq.net.push({ k, g });
  });
  return kq;
}

/**
 * Gộp mọi mesh / nét (đang hiện) của `src` thành MỘT mesh mỗi vật liệu + MỘT `LineSegments` mỗi vật liệu nét, đưa vào `dich`.
 * `InstancedMesh` (nan lover) được trải từng bản sao vào hình học chung, `Line` (nét mở cửa sổ) đổi thành cặp đoạn — trước đây hai
 * loại này bị `clone` nguyên cái nên một tòa 24 tầng ra 2.655 draw call (docs/de_xuat_hieu_nang.md P8).
 * `khongBong` = vật liệu không đổ bóng (kính, khung, lan can… mảnh, bóng không thấy rõ mà nặng pass bóng).
 */
export function gop(T: T3, src: THREE.Object3D, dich: THREE.Object3D[], khongBong: Set<THREE.Material> = new Set()): void {
  const gom = gomMoi<THREE.Material>();
  gomHinh(T, src, gom, (m) => m);
  dungTuGop(T, chotGom(T, gom), (m) => m, khongBong, dich);
}

/** Mesh / LineSegments từ hình đã gộp; `vl` đổi khoá → vật liệu của lượt dựng này (kiểu vẽ khác vẫn dùng chung hình). */
function dungTuGop<K>(T: T3, h: HinhGop<K>, vl: (k: K) => THREE.Material, khongBong: Set<THREE.Material>, dich: THREE.Object3D[]): void {
  for (const { k, g } of h.mesh) {
    const mat = vl(k), me = new T.Mesh(g, mat);
    me.castShadow = !khongBong.has(mat); me.receiveShadow = true;
    dich.push(me);
  }
  for (const { k, g } of h.net) dich.push(new T.LineSegments(g, vl(k)));
}

// ---------- nhớ hình học giữa các lần dựng (đổi chọn / giờ / kiểu vẽ / bật hầm không dựng lại căn) ----------

type KhoaVL = keyof VatLieu3D;
/** Số hiệu ổn định cho một đối tượng (khối 3D căn, thư viện): cùng id căn nhưng khối khác (căn kéo / không kéo) là hai khoá khác. */
const soHieu = new WeakMap<object, number>();
let soHieuMoi = 0;
const idDoiTuong = (o: object | null | undefined) => { if (!o) return 0; let n = soHieu.get(o); if (!n) soHieu.set(o, (n = ++soHieuMoi)); return n; };
const chuoiMau = new WeakMap<object, string>();
const chuoiCua = (o: object) => { let s = chuoiMau.get(o); if (s === undefined) chuoiMau.set(o, (s = JSON.stringify(o))); return s; };

/** Hình học căn (toạ độ căn, mét) đã gom theo vật liệu: mỗi khối 3D × tham số đứng dựng một lần. */
type HinhCan = { P: Map<KhoaVL, Float32Array>; N: Map<KhoaVL, Float32Array | null>; L: Map<KhoaVL, Float32Array> };
const nhoCan = new WeakMap<object, Map<string, HinhCan>>();
/** Tầng đã gộp (theo mặt bằng tầng + bố cục + khối căn + tham số đứng), khối đế / mái / tum: LRU nhỏ. */
const nhoTang = new Map<string, { hinh: HinhGop<KhoaVL>; nhoNet: Map<string, THREE.BufferGeometry[]> }>();
const nhoNgoai = new Map<string, HinhGop<KhoaVL>>();
const TOI_DA_TANG = 48, TOI_DA_NGOAI = 16;
const layNho = <V>(m: Map<string, V>, k: string, tao: () => V, toiDa: number): { v: V; trung: boolean } => {
  const c = m.get(k);
  if (c !== undefined) { m.delete(k); m.set(k, c); return { v: c, trung: true }; }
  const v = tao();
  m.set(k, v);
  while (m.size > toiDa) m.delete(m.keys().next().value!);
  return { v, trung: false };
};
/** Xoá bộ nhớ hình (để đo lần dựng đầu). */
export function xoaNhoHinh3D(): void { nhoTang.clear(); nhoNgoai.clear(); }
/** Số lần trúng / trượt bộ nhớ hình của lượt dựng gần nhất (để kiểm / đo). */
export const thongKeNho = { tangTrung: 0, tangMoi: 0, ngoaiTrung: 0 };

/** Khoá vật liệu của từng vật liệu trong bảng (tường và dầm là một vật liệu → cùng khoá 'tuong'). */
function bangKhoa(M: VatLieu3D): Map<THREE.Material, KhoaVL> {
  const m = new Map<THREE.Material, KhoaVL>();
  for (const k of Object.keys(M) as KhoaVL[]) if (!m.has(M[k])) m.set(M[k], k);
  return m;
}

/** Hình một mẫu căn đã gom (toạ độ căn): nhớ theo khối 3D (WeakMap) × tham số đứng. */
function hinhCan(T: T3, d: Khoi3d, P: ThamSo3D, kP: string, M: VatLieu3D, khoa: Map<THREE.Material, KhoaVL>): HinhCan {
  const theoKhoi = lay<object, Map<string, HinhCan>>(nhoCan, d, () => new Map());
  const c = theoKhoi.get(kP);
  if (c) return c;
  const g = new T.Group(), gom = gomMoi<KhoaVL>();
  dungCan(T, d, P, M, g, nhomMoi(), true);
  gomHinh(T, g, gom, (m) => khoa.get(m) ?? 'tuong');
  g.traverse((o) => { (o as THREE.Mesh).geometry?.dispose?.(); });
  const kq: HinhCan = { P: new Map(), N: new Map(), L: new Map() };
  gom.mesh.forEach((r, k) => { kq.P.set(k, noi(r.P)); kq.N.set(k, r.N.every(Boolean) ? noi(r.N as Float32Array[]) : null); });
  gom.net.forEach((r, k) => kq.L.set(k, noi(r)));
  theoKhoi.set(kP, kq);
  return kq;
}

/** Đặt hình căn đã gom vào tầng theo ma trận `m` (xoay / lật / dời; trực chuẩn nên pháp tuyến chỉ xoay). */
function datCan(h: HinhCan, m: THREE.Matrix4, gom: GomTheo<KhoaVL>): void {
  const e = m.elements;
  const bd = (a: Float32Array, dich: boolean) => {
    const o = new Float32Array(a.length), tx = dich ? e[12] : 0, ty = dich ? e[13] : 0, tz = dich ? e[14] : 0;
    for (let i = 0; i < a.length; i += 3) {
      const x = a[i], y = a[i + 1], z = a[i + 2];
      o[i] = e[0] * x + e[4] * y + e[8] * z + tx; o[i + 1] = e[1] * x + e[5] * y + e[9] * z + ty; o[i + 2] = e[2] * x + e[6] * y + e[10] * z + tz;
    }
    return o;
  };
  h.P.forEach((a, k) => {
    const r = lay(gom.mesh, k, () => ({ P: [], N: [] })), n = h.N.get(k);
    r.P.push(bd(a, true));
    r.N.push(n ? bd(n, false) : null);
  });
  h.L.forEach((a, k) => lay(gom.net, k, () => []).push(bd(a, true)));
}

/**
 * Nhân một tầng đã gộp lên nhiều cao độ: mesh → `InstancedMesh` (1 draw call cho mọi tầng cùng bố cục, GPU giữ một bản hình học);
 * nét → nối thành một `LineSegments` (nét không instancing được, nhưng nhẹ; nhớ theo dãy cao độ trong `nhoNet`).
 */
function nhanTang(T: T3, h: HinhGop<KhoaVL>, caoDo: number[], M: VatLieu3D, khongBong: Set<THREE.Material>, nhoNet: Map<string, THREE.BufferGeometry[]>): THREE.Object3D[] {
  const kq: THREE.Object3D[] = [], m4 = new T.Matrix4();
  const kc = caoDo.map((y) => y.toFixed(4)).join();
  const nets = lay(nhoNet, kc, () => h.net.map(({ g: g0 }) => {
    const a = g0.getAttribute('position').array as Float32Array, b = new Float32Array(a.length * caoDo.length);
    caoDo.forEach((y, j) => { const o0 = j * a.length; for (let i = 0; i < a.length; i += 3) { b[o0 + i] = a[i]; b[o0 + i + 1] = a[i + 1] + y; b[o0 + i + 2] = a[i + 2]; } });
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(b, 3));
    g.computeBoundingSphere();
    return g;
  }));
  if (nhoNet.size > 4) nhoNet.delete(nhoNet.keys().next().value!);
  h.net.forEach(({ k }, i) => kq.push(new T.LineSegments(nets[i], M[k])));
  for (const { k, g } of h.mesh) {
    const mat = M[k], im = new T.InstancedMesh(g, mat, caoDo.length);
    caoDo.forEach((y, j) => im.setMatrixAt(j, m4.makeTranslation(0, y, 0)));
    im.castShadow = !khongBong.has(mat); im.receiveShadow = true;
    im.computeBoundingSphere();
    kq.push(im);
  }
  return kq;
}

const trongTam = (P: Diem[]): Diem => {
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length], c = p[0] * q[1] - q[0] * p[1]; A += c; cx += (p[0] + q[0]) * c; cy += (p[1] + q[1]) * c; }
  if (Math.abs(A) < 1e-6) return [P.reduce((s, p) => s + p[0], 0) / P.length, P.reduce((s, p) => s + p[1], 0) / P.length];
  return [cx / (3 * A), cy / (3 * A)];
};

/** Khoảng cách từ điểm tới đoạn pq (mm). */
const kcDoan = (x: number, y: number, p: Diem, q: Diem): number => {
  const dx = q[0] - p[0], dy = q[1] - p[1], l2 = dx * dx + dy * dy;
  const t = l2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / l2));
  return Math.hypot(x - (p[0] + t * dx), y - (p[1] + t * dy));
};
/** Cửa sổ mặt ngoài lõi (sảnh thang máy tòa I / V): MỘT cửa sổ giữa cạnh, rộng 1.800 mm như cửa sổ căn hộ; chừa 700 mm hai đầu cạnh. */
export const CUA_SO_LOI = { rong: 1800, chua: 700, saiLech: 450 } as const;
export type CuaSoLoi = { a: Diem; t: Diem; n: Diem; tam: number };
/**
 * Mặt ngoài của lõi = cạnh lõi nằm sát (≤ 450 mm) và song song nét bao DTXD, đủ dài (≥ 1.800 + 2 × 700): sảnh thang máy mở ra mặt
 * tiền (tòa I · V) có đúng MỘT cửa sổ ở giữa cạnh. `a` = điểm đầu cạnh, `t` = hướng dọc cạnh, `n` = hướng ra ngoài (đơn vị), `tam` = vị trí
 * tâm cửa dọc cạnh (mm từ `a`). Toạ độ mm của mặt tòa. Cạnh quay vào trong nhà không có cửa.
 */
export function cuaSoLoi(r: Diem[], foot: Diem[]): CuaSoLoi[] {
  const kq: CuaSoLoi[] = [], c = trongTam(r), C = CUA_SO_LOI;
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < C.rong + 2 * C.chua) continue;
    const t: Diem = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    let n: Diem = [t[1], -t[0]];
    if ((c[0] - a[0]) * n[0] + (c[1] - a[1]) * n[1] > 0) n = [-n[0], -n[1]]; // hướng ra khỏi tâm lõi
    // cạnh phải nằm sát và song song một cạnh nét bao (đầu mút và giữa cạnh đều sát) mới là mặt ngoài
    let sat = false;
    for (let j = 0; j < foot.length && !sat; j++) {
      const p = foot[j], q = foot[(j + 1) % foot.length], lq = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (lq < 1) continue;
      const song = Math.abs(((q[0] - p[0]) * t[1] - (q[1] - p[1]) * t[0]) / lq) < 0.06;
      if (song && [0.1, 0.5, 0.9].every((u) => kcDoan(a[0] + t[0] * L * u, a[1] + t[1] * L * u, p, q) <= C.saiLech)) sat = true;
    }
    if (sat) kq.push({ a, t, n, tam: L / 2 });
  }
  return kq;
}

/** Đa giác khung tường cục bộ của lõi, đưa lên thế giới theo điểm chèn (chữ V: hộp chữ nhật sẽ lòi ra ngoài nét bao DTXD). */
function ranhLoiDG(dg: Diem[], q: { x: number; y: number; rot: number; sx: number; sy: number }): Diem[] {
  const p = veLoiTaiViTri([{ cat: 'bao', pts: dg }], q)[0].pts;
  return p.length > 1 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1] ? p.slice(0, -1) : p;
}

/** Danh sách đỉnh ngoài của hình chữ nhật cục bộ lõi, đưa lên thế giới theo điểm chèn. */
function ranhLoi(bt: [number, number, number, number], q: { x: number; y: number; rot: number; sx: number; sy: number }): Diem[] {
  const [x0, y0, x1, y1] = bt;
  return veLoiTaiViTri([{ cat: 'bao', pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] }], q)[0].pts;
}

/**
 * Một bố cục tầng đã dựng: hình gộp (nhớ được), số căn, căn để chọn trong 3D (tính lười, hình thật), nét bao của tầng (m, để dò tia),
 * nét nhân tầng đã nối.
 */
type TangDung = { hinh: HinhGop<KhoaVL>; so: number; can: () => CanChon[]; chan: Diem[]; nhoNet: Map<string, THREE.BufferGeometry[]> };

/**
 * Dựng 3D cả tòa. Hình học tầng / khối ngoài nhớ giữa các lần dựng (khoá theo mặt bằng tầng, bố cục, khối 3D căn, tham số đứng —
 * không theo vật liệu), nên đổi kiểu vẽ / chọn / giờ / bật hầm dựng lại chỉ mất vài ms; mỗi mẫu căn chỉ dựng một lần dù lặp nhiều chỗ.
 * Trả thêm `chon`: bản đồ chọn tầng / căn (chon3d.ts · chonTiaToa) cho khung 3D Công trình.
 */
export function dungToa(T: T3, goc: THREE.Group, M: VatLieu3D, G: NhomHien, P: ThamSo3D, du: DuLieuToa) {
  return chayHet(dungToaTung(T, goc, M, G, P, du));
}

/**
 * Như `dungToa`, CHIA NHỎ: các bố cục tầng chưa có trong bộ nhớ hình dựng trước, `yield` sau mỗi căn (Khung3D chạy từng mẩu ~8 ms —
 * lần mở đầu 3D Công trình trên điện thoại CPU 4× trước đây là một tác vụ ~300 ms).
 */
export function* dungToaTung(T: T3, goc: THREE.Group, M: VatLieu3D, G: NhomHien, P: ThamSo3D, du: DuLieuToa): Tung<ReturnType<typeof ketQuaToa>> {
  void G; // tòa gộp hình: không bật / tắt từng nhóm chi tiết
  const { mau, toa, tv } = du;
  const Hc = P.tang - P.san;
  const khoaVL = bangKhoa(M), kP = JSON.stringify(P);
  const khoi = (pts: Diem[], h: number, m: THREE.Material, z0: number, vien = false, dich: THREE.Object3D = goc) => {
    const s = new T.Shape();
    pts.forEach((p, i) => (i ? s.lineTo(p[0] * K, p[1] * K) : s.moveTo(p[0] * K, p[1] * K)));
    const g = new T.ExtrudeGeometry(s, { depth: h * K, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    const me = new T.Mesh(g, m);
    me.position.y = z0 * K; me.castShadow = true; me.receiveShadow = true;
    dich.add(me);
    if (vien) { const l = new T.LineSegments(new T.EdgesGeometry(g, 25), M.line); l.position.copy(me.position); dich.add(l); }
    return me;
  };
  const foot = mau.duong_bao;
  const soDe = toa.soTangDe, nDH = Math.max(0, toa.soTangDH);
  const hDe = soDe * CAO_TANG_DE_MM, hThan = nDH * P.tang, H = hDe + hThan;
  const khongBong = new Set<THREE.Material>([M.kinh, M.khung, M.lc, M.lov, M.go, M.top]);
  const gomGroup = (src: THREE.Object3D): HinhGop<KhoaVL> => {
    const gom = gomMoi<KhoaVL>();
    gomHinh(T, src, gom, (m) => khoaVL.get(m) ?? 'tuong');
    src.traverse((o) => { (o as THREE.Mesh).geometry?.dispose?.(); });
    return chotGom(T, gom);
  };
  thongKeNho.tangTrung = 0; thongKeNho.tangMoi = 0; thongKeNho.ngoaiTrung = 0;

  // --- tầng điển hình: mỗi bố cục khác nhau (chung + tầng riêng) dựng một lần (mỗi mẫu căn một lần), gộp theo vật liệu, nhớ lại ---
  const tums = ranhTum(mau, du.loi, du.idLoi);
  function* dungMauTung(bc: BoCuc, mauT: MauToa3D, vts: ReturnType<typeof viTriCan>): Tung<HinhGop<KhoaVL>> {
    const tmp = new T.Group();
    const footT = mauT.duong_bao;
    khoi(footT, P.san, M.san, -P.san, false, tmp); // sàn dưới; tấm "sàn trên" mờ của tầng cũ luôn ẩn khi gộp nên bỏ
    for (const d of sanHanhLangNgoai(mauT)) khoi(d, P.san, M.san, -P.san, false, tmp);
    ranhTum(mauT, du.loi, du.idLoi).forEach((r) => khoi(r, Hc, M.khung2, 0, true, tmp));
    // cửa sổ: (1) sảnh thang máy tòa I / V — một cửa 1.800 ở giữa mặt ngoài lõi; (2) khe hở nét bao (đầu hành lang, app cũ QT-119 · QT-128):
    // tường dày 200 hai bên + cửa sổ rộng = hành lang − 200. Cửa sổ dựng bằng đúng cỡ cửa sổ căn hộ (bệ `bauSo`, cao `caoSo`).
    const fw = 60, sill = P.bauSo, hW = Math.min(P.caoSo, Hc - sill - 150);
    const veCuaSo = (pt: (a: number, m: number) => Diem, a0: number, a1: number, m0: number, m1: number, mk: number) => {
      const rc = (u0: number, u1: number, v0: number, v1: number) => [pt(u0, v0), pt(u1, v0), pt(u1, v1), pt(u0, v1)];
      const bar = (u0: number, u1: number, z0: number, h: number) => khoi(rc(u0, u1, m0, m1), h, M.khung, z0, false, tmp);
      bar(a0, a1, sill, fw); bar(a0, a1, sill + hW - fw, fw); bar(a0, a0 + fw, sill, hW); bar(a1 - fw, a1, sill, hW);
      if (a1 - a0 > 1300) bar((a0 + a1) / 2 - 20, (a0 + a1) / 2 + 20, sill, hW);
      khoi(rc(a0 + fw, a1 - fw, mk - 4, mk + 4), hW - 2 * fw, M.kinh, sill + fw, false, tmp);
    };
    if (hW > 600) {
      for (const r of ranhTumCo(mauT, du.loi, du.idLoi)) {
        if (r.thang) continue;
        for (const c of cuaSoLoi(r.pts, footT)) { // n ra ngoài: m > 0 là ngoài nhà → khung nhô 50 mm khỏi mặt lõi, kính nhô 30 mm
          const pt = (a: number, m: number): Diem => [c.a[0] + c.t[0] * a + c.n[0] * m, c.a[1] + c.t[1] * a + c.n[1] * m];
          veCuaSo(pt, c.tam - CUA_SO_LOI.rong / 2, c.tam + CUA_SO_LOI.rong / 2, 0, 50, 30);
        }
      }
      const polys: Diem[][] = vts.map((vt) => { const cm = tv.can.get(canDangDung(vt, bc)); return khungTaiO(mauT, vt.matIdx, vt.a0, vt.a1, cm?.sau_mm ?? vt.sau, vt.guong, cm?.khung) ?? vt.goc; });
      const tuongLoi: Diem[][] = [];
      for (const m of mauT.mat) for (const q of m.phan_tu) {
        if (q.loai === 'can' || q.bang) continue;
        const l = du.loi.get(du.idLoi(q.block));
        if (!l) continue;
        if (l.tuong?.length) l.tuong.forEach((w) => tuongLoi.push(veLoiTaiViTri([{ cat: 'wall', pts: w }], q)[0].pts));
        else if (l.bao_tm?.length) polys.push(ranhLoiDG(l.bao_tm, q));
        else if (l.bao_tuong_mm) polys.push(ranhLoi(l.bao_tuong_mm, q));
      }
      const wHL = mauT.hanh_lang_mm || 1800;
      const dau: DauHanhLang[] = (mauT.hanhlang_ve ?? []).flatMap((pl) => (pl.length > 1 ? [{ p: pl[0], c: wHL }, { p: pl[pl.length - 1], c: wHL }] : []));
      for (const e of kheHoNetBao(footT, polys, tuongLoi, dau)) {
        const pt = (a: number, m: number): Diem => [e.o[0] + e.d[0] * a + e.n[0] * m, e.o[1] + e.d[1] * a + e.n[1] * m]; // m > 0 là vào trong nhà
        const a0 = (e.w - e.cw) / 2, a1 = a0 + e.cw, TD = 200, rc = (u0: number, u1: number) => [pt(u0, 0), pt(u1, 0), pt(u1, TD), pt(u0, TD)];
        if (a0 > 1) { khoi(rc(0, a0), Hc, M.tuong, 0, false, tmp); khoi(rc(a1, e.w), Hc, M.tuong, 0, false, tmp); }
        khoi(rc(a0, a1), sill, M.tuong, 0, false, tmp); // tường dưới bệ cửa
        khoi(rc(a0, a1), Hc - sill - hW, M.tuong, sill + hW, false, tmp); // tường trên đầu cửa
        veCuaSo(pt, a0, a1, 70, 130, 100);
      }
    }
    const gom = gomMoi<KhoaVL>();
    gomHinh(T, tmp, gom, (m) => khoaVL.get(m) ?? 'tuong');
    tmp.traverse((o) => { (o as THREE.Mesh).geometry?.dispose?.(); });
    const m4 = new T.Matrix4();
    for (const vt of vts) {
      if (congNangTai(vt.khoa, bc) !== 'can') continue; // ô đổi công năng: để trống sàn
      const d = du.khoi3d.get(canDangDung(vt, bc));
      if (!d) continue;
      const m = mauT.mat[vt.matIdx], gr = rad(m.goc_deg), ux = Math.cos(gr), uy = Math.sin(gr), nx = -uy, ny = ux;
      const w = vt.a1 - vt.a0, s = vt.guong ? -1 : 1, off = vt.a0 + (vt.guong ? w : 0);
      const ox = ux * off + nx * m.truc_mm, oy = uy * off + ny * m.truc_mm;
      m4.set(ux * s, 0, -nx, ox * K, 0, 1, 0, 0, -uy * s, 0, ny, -oy * K, 0, 0, 0, 1);
      datCan(hinhCan(T, d, P, kP, M, khoaVL), m4, gom);
      yield;
    }
    return chotGom(T, gom);
  }
  const dungMau = (bc: BoCuc, mauT: MauToa3D, vts: ReturnType<typeof viTriCan>): HinhGop<KhoaVL> => chayHet(dungMauTung(bc, mauT, vts));
  const theoMau = new Map<object, string>();
  const theoKhoa = new Map<string, TangDung>();
  const khoaTv = idDoiTuong(tv), khoaTum = JSON.stringify(tums.length) + kP;
  const khoaTang = (tang: number | null) => {
    const bc = boCucTang(toa, tang), mauT = (du.mauTang?.(tang) ?? mau) as MauToa3D;
    const sm = lay(theoMau, mauT, () => chuoiCua(mauT) + '|' + JSON.stringify(ranhTum(mauT, du.loi, du.idLoi)));
    const vts = viTriCan(mauT, tv, bc); // dồn khít theo bề ngang căn đang dùng (XC-04), trên mặt đã tự chỉnh
    const ck = vts.map((vt) => { const cn = congNangTai(vt.khoa, bc), id = canDangDung(vt, bc); return `${cn}:${id}#${cn === 'can' ? idDoiTuong(du.khoi3d.get(id)) : 0}`; }).join('|');
    return { bc, mauT, vts, k: [khoaTv, khoaTum, sm, ck].join('§') };
  };
  // dựng trước (chia nhỏ) các bố cục tầng chưa có trong bộ nhớ hình; `mauCua` sau đó trúng bộ nhớ (thống kê vẫn tính là dựng mới)
  const dungTruoc = new Set<string>();
  for (const tang of [null, ...tangCoRieng(toa)]) {
    const { bc, mauT, vts, k } = khoaTang(tang);
    if (nhoTang.has(k) || dungTruoc.has(k)) continue;
    const hinh = yield* dungMauTung(bc, mauT, vts);
    layNho(nhoTang, k, () => ({ hinh, nhoNet: new Map<string, THREE.BufferGeometry[]>() }), TOI_DA_TANG);
    dungTruoc.add(k);
  }
  const mauCua = (tang: number | null): TangDung => {
    const { bc, mauT, vts, k } = khoaTang(tang);
    return lay(theoKhoa, k, () => {
      const r = layNho(nhoTang, k, () => ({ hinh: dungMau(bc, mauT, vts), nhoNet: new Map<string, THREE.BufferGeometry[]>() }), TOI_DA_TANG);
      if (r.trung && !dungTruoc.has(k)) thongKeNho.tangTrung++; else thongKeNho.tangMoi++;
      let ds: CanChon[] | null = null;
      const so = vts.filter((vt) => congNangTai(vt.khoa, bc) === 'can' && du.khoi3d.get(canDangDung(vt, bc))).length;
      return {
        hinh: r.v.hinh, nhoNet: r.v.nhoNet, so, chan: mauT.duong_bao.map((p) => [p[0] * K, p[1] * K] as Diem),
        can: () => (ds ??= (() => {
          const no = soCanChuVi(mauT.duong_bao, vts);
          return vts.filter((vt) => congNangTai(vt.khoa, bc) === 'can').map((vt) => {
            // căn góc V / chữ L: hình bao thật đặt vào ô như khối 3D (chiều sâu gốc của mẫu căn), để dò tia / tô nhấn đúng hình
            const canId = canDangDung(vt, bc), cm = tv.can.get(canId);
            const hinh = khungTaiO(mauT, vt.matIdx, vt.a0, vt.a1, cm?.sau_mm ?? vt.sau, vt.guong, cm?.khung) ?? undefined;
            return { khoa: vt.khoa, canId, no: no.get(vt.khoa) ?? 0, goc: vt.goc, hinh };
          });
        })()),
      };
    });
  };
  const chung = mauCua(null), rieng = new Set(tangCoRieng(toa));
  const soCan = chung.so;

  // --- khối đế, thân, mái, tum (gộp theo vật liệu, nhớ theo hình) ---
  const kNgoai = JSON.stringify([foot, soDe, H, tums, P.san]);
  const rN = layNho(nhoNgoai, kNgoai, () => {
    const ngoai = new T.Group();
    if (hDe > 0) dungKhoiDe(T, ngoai, M, foot, soDe, tums, (pts, h, m, z0) => khoi(pts, h, m, z0, false, ngoai));
    khoi(foot, P.san, M.san, H, false, ngoai);
    tums.forEach((r) => { khoi(r, CAO_TUM_MM, M.tum, H + P.san, true, ngoai); khoi(r, P.san, M.san, H + P.san + CAO_TUM_MM, false, ngoai); });
    foot.forEach((p, i) => { // thành chắn mái
      const q = foot[(i + 1) % foot.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (L < 50) return;
      const me = new T.Mesh(new T.BoxGeometry(L * K, 1100 * K, 120 * K), M.tuong);
      me.position.set(((p[0] + q[0]) / 2) * K, (H + P.san + 550) * K, -((p[1] + q[1]) / 2) * K);
      me.rotation.y = Math.atan2(q[1] - p[1], q[0] - p[0]);
      ngoai.add(me);
    });
    return gomGroup(ngoai);
  }, TOI_DA_NGOAI);
  if (rN.trung) thongKeNho.ngoaiTrung++;
  const dsNgoai: THREE.Object3D[] = [];
  dungTuGop(T, rN.v, (k) => M[k], new Set(), dsNgoai);
  dsNgoai.forEach((o) => goc.add(o));

  const [cx, cy] = trongTam(foot);
  const xs = foot.map((p) => p[0]), ys = foot.map((p) => p[1]);
  const bk = 2 * Math.max(cx - Math.min(...xs), Math.max(...xs) - cx, cy - Math.min(...ys), Math.max(...ys) - cy) * K;
  const cao = (H + CAO_TUM_MM + P.san) * K;
  const coCanh = Math.max(bk, cao * 0.8);

  // --- thân tháp: LOD. Gần = từng căn chi tiết, mỗi bố cục tầng một bộ InstancedMesh theo vật liệu; xa = khối + dải cửa theo tầng ---
  const lod = new T.LOD();
  lod.position.set(cx * K, (hDe + hThan / 2) * K, -cy * K); // LOD đo khoảng cách camera tới tâm thân tháp
  const gan = new T.Group(), xa = new T.Group();
  gan.position.copy(lod.position).negate(); xa.position.copy(gan.position);
  const theoBoCuc = new Map<TangDung, number[]>();
  const tangCua = (j: number) => (rieng.has(j) ? mauCua(j) : chung); // j = tầng điển hình 1…n
  for (let j = 0; j < nDH; j++) lay(theoBoCuc, tangCua(j + 1), () => []).push((hDe + j * P.tang) * K);
  theoBoCuc.forEach((caoDo, b) => nhanTang(T, b.hinh, caoDo, M, khongBong, b.nhoNet).forEach((o) => gan.add(o)));
  if (nDH > 0) {
    const chanM = foot.map((p) => [p[0] * K, p[1] * K] as [number, number]);
    const than = khoi(foot, hThan, M.tuong, hDe, false, xa);
    than.castShadow = true;
    const dai = hinhDaiCua(T, chanM, hDe * K, P.tang * K, nDH, P.bauSo * K, P.caoSo * K);
    if (dai) xa.add(new T.Mesh(dai, M.kinhDai));
    const ln: number[] = [];
    for (let k = 0; k <= nDH; k++) foot.forEach((p, i) => { const q = foot[(i + 1) % foot.length], y = (hDe + k * P.tang) * K; ln.push(p[0] * K, y, -p[1] * K, q[0] * K, y, -q[1] * K); });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(ln), 3));
    xa.add(new T.LineSegments(g, M.line));
  }
  lod.addLevel(gan, 0);
  lod.addLevel(xa, nguongLod(coCanh));
  xa.visible = false; // trước lượt vẽ đầu (LOD.update theo camera) hiện mức gần
  goc.add(lod);

  const chanChon = foot.map((p) => [p[0] * K, p[1] * K] as [number, number]);
  const chon: BanDoChonToa = {
    chan: chanChon, chanDe: chanChon, hDe: hDe * K, caoTang: P.tang * K, nDH,
    canTang: (tang) => tangCua(tang).can(), canChung: () => chung.can(), chanTang: (tang) => tangCua(tang).chan,
  };
  yield;
  return ketQuaToa([cx * K, cao * 0.45, -cy * K], coCanh, cao, soCan, chon);
}
const ketQuaToa = (tam: [number, number, number], coCanh: number, cao: number, soCan: number, chon: BanDoChonToa) => ({ canh: { tam, coCanh, cao }, soCan, chon });
