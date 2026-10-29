/**
 * Các lớp phụ của 3D (bật / tắt ở menu "Lớp" như bản vẽ 2D, không dựng lại): tầng tum gộp, trục thang bộ / lõi xuyên tòa, đường giao
 * thông theo lộ giới cạnh lô, cây xanh instanced (vài dạng tán, đặt tất định). Mỗi lớp gộp hình → 1–3 draw call cho cả dự án.
 * Toạ độ vào là mét bản vẽ (x, y; y lên) — three: X = x, Y = cao, Z = −y.
 */
import type * as THREE from 'three';
import type { Diem } from '../tinh/kieu';
import type { KieuVe3D, T3 } from './dungCan';

/** Khoá lớp 3D (userData.lop). */
export type Lop3D = 'ham' | 'thang' | 'gio' | 'cay' | 'duong' | 'ranh' | 'tum';
export const DS_LOP_3D: Lop3D[] = ['tum', 'ham', 'thang', 'gio', 'cay', 'duong', 'ranh'];
/** Mặc định ẩn: trục thang / lõi (lớp phân tích, vẽ xuyên tòa). */
export const LOP_AN_MAC_DINH: Lop3D[] = ['thang'];
export const LUU_LOP_3D = 'unitmix.lop-3d.v1';

export function docLopAn(): Lop3D[] {
  try {
    const a = JSON.parse(localStorage.getItem(LUU_LOP_3D) ?? 'null') as unknown;
    if (Array.isArray(a)) return a.filter((x): x is Lop3D => DS_LOP_3D.includes(x as Lop3D));
  } catch { /* trình duyệt chặn lưu */ }
  return [...LOP_AN_MAC_DINH];
}
export function luuLopAn(an: Lop3D[]): void {
  try { localStorage.setItem(LUU_LOP_3D, JSON.stringify(an)); } catch { /* không lưu được */ }
}

/** Diện tích có dấu (> 0: ngược chiều kim đồng hồ). */
export const dtCoDau = (P: Diem[]): number => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };

export const trongDG = (p: Diem, P: Diem[]): boolean => {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};
/** Khoảng cách điểm → biên đa giác (m). */
export function kcBien(p: Diem, P: Diem[]): number {
  let d = Infinity;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
    d = Math.min(d, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy));
  }
  return d;
}
/** Nhiễu giả ngẫu nhiên ổn định theo toạ độ. */
export const nhieu = (x: number, y: number): number => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };

/**
 * Dải đường theo lộ giới từng cạnh lô (`Lo.canhDuong[i]` m, cạnh i = ranh[i] → ranh[i+1]): hình chữ nhật nằm NGOÀI lô, rộng bằng
 * lộ giới. Trả đa giác (m bản vẽ). Hai lô chung một đường thì hai dải chồng nhau cùng màu, cùng cao — không thấy nhấp nháy.
 */
export function daiDuong(ranh: Diem[], canhDuong: (number | null)[] | undefined): { poly: Diem[]; a: Diem; b: Diem; ra: Diem }[] {
  if (!canhDuong?.length || ranh.length < 3) return [];
  const s = dtCoDau(ranh) >= 0 ? 1 : -1, kq: { poly: Diem[]; a: Diem; b: Diem; ra: Diem }[] = [];
  for (let i = 0; i < ranh.length; i++) {
    const w = canhDuong[i];
    if (!w || w <= 0) continue;
    const a = ranh[i], b = ranh[(i + 1) % ranh.length], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    if (L < 1) continue;
    const ra: Diem = [(s * dy) / L, (-s * dx) / L]; // pháp tuyến ra ngoài lô
    kq.push({ poly: [a, b, [b[0] + ra[0] * w, b[1] + ra[1] * w], [a[0] + ra[0] * w, a[1] + ra[1] * w]], a, b, ra });
  }
  return kq;
}

/** Cây dọc đường: trên vỉa hè cách mép lô 1,8 m, mỗi `buoc` m, chừa 6 m hai đầu cạnh. */
export function cayDocDuong(d: { a: Diem; b: Diem; ra: Diem }[], buoc = 9): Diem[] {
  const kq: Diem[] = [];
  for (const { a, b, ra } of d) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let t = 6; t <= L - 6; t += buoc) {
      const k = t / L;
      kq.push([a[0] + (b[0] - a[0]) * k + ra[0] * 1.8, a[1] + (b[1] - a[1]) * k + ra[1] * 1.8]);
    }
  }
  return kq;
}

/** Điểm trồng cây trong đa giác: lưới `buoc` m có xô lệch, cách biên ≥ `le` m, bỏ điểm trong / sát (`cach` m) vật cản; tối đa `toiDa`. */
export function diemCayTrong(poly: Diem[], buoc: number, toiDa: number, le = 2, can: Diem[][] = [], cach = 3): Diem[] {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]), kq: Diem[] = [];
  for (let x = Math.min(...xs) + buoc / 2; x < Math.max(...xs); x += buoc) {
    for (let y = Math.min(...ys) + buoc / 2; y < Math.max(...ys); y += buoc) {
      const p: Diem = [x + (nhieu(x, y) - 0.5) * buoc * 0.6, y + (nhieu(y, x) - 0.5) * buoc * 0.6];
      if (!trongDG(p, poly) || kcBien(p, poly) < le) continue;
      if (can.some((c) => trongDG(p, c) || kcBien(p, c) < cach)) continue;
      kq.push(p);
      if (kq.length >= toiDa) return kq;
    }
  }
  return kq;
}

/** Nối nhiều hình (không chỉ mục) thành MỘT BufferGeometry (vị trí + pháp tuyến). */
export function gopHinh(T: T3, ds: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  const P: Float32Array[] = [], N: Float32Array[] = [];
  for (const g0 of ds) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    P.push(g.getAttribute('position').array as Float32Array); N.push(g.getAttribute('normal').array as Float32Array);
    if (g !== g0) g.dispose();
    g0.dispose();
  }
  if (!P.length) return null;
  const noi = (L: Float32Array[]) => { let n = 0; L.forEach((a) => { n += a.length; }); const o = new Float32Array(n); let k = 0; L.forEach((a) => { o.set(a, k); k += a.length; }); return o; };
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(noi(P), 3));
  g.setAttribute('normal', new T.BufferAttribute(noi(N), 3));
  g.computeBoundingSphere();
  return g;
}

/** Khối đùn từ đa giác (m bản vẽ) cao `cao` từ cao độ `y0` (m) — toạ độ three. */
export function hinhDun(T: T3, pts: Diem[], y0: number, cao: number): THREE.BufferGeometry {
  const s = new T.Shape();
  pts.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])));
  const g = new T.ExtrudeGeometry(s, { depth: cao, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
  return g;
}
/** Tấm phẳng (đường, sân) từ đa giác ở cao độ y. */
export function hinhTam(T: T3, pts: Diem[], y: number): THREE.BufferGeometry {
  const s = new T.Shape();
  pts.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])));
  const g = new T.ShapeGeometry(s);
  g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
  return g;
}

/**
 * Trục thang bộ / lõi xuyên tòa (lớp phân tích): khối bán trong suốt vẽ xuyên mặt che (depthTest tắt) + viền; thang bộ màu đỏ gạch,
 * lõi thang máy / kỹ thuật màu xanh `--green`. `ds` = đa giác (m bản vẽ) + y0 / y1 (m). 2 mesh + 1 nét cho mọi tòa.
 */
export function dungTrucThang(T: T3, goc: THREE.Object3D, ds: { pts: Diem[]; thang: boolean; y0: number; y1: number }[]): void {
  const theo = (thang: boolean) => ds.filter((d) => d.thang === thang && d.pts.length >= 3 && d.y1 > d.y0);
  const net: THREE.BufferGeometry[] = [];
  for (const [thang, mau] of [[true, 0xc8553d], [false, 0x174f52]] as const) {
    const hs = theo(thang).map((d) => hinhDun(T, d.pts, d.y0, d.y1 - d.y0));
    hs.forEach((h) => net.push(new T.EdgesGeometry(h, 30)));
    const g = gopHinh(T, hs);
    if (!g) continue;
    const me = new T.Mesh(g, new T.MeshBasicMaterial({ color: mau, transparent: true, opacity: thang ? 0.5 : 0.32, depthTest: false, depthWrite: false }));
    me.renderOrder = 6; me.userData.lop = 'thang';
    goc.add(me);
  }
  if (net.length) {
    const P: number[] = [];
    net.forEach((g) => { P.push(...(g.getAttribute('position').array as Float32Array)); g.dispose(); });
    const gl = new T.BufferGeometry(); gl.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3));
    const l = new T.LineSegments(gl, new T.LineBasicMaterial({ color: 0x022b1e, transparent: true, opacity: 0.55, depthTest: false }));
    l.renderOrder = 7; l.userData.lop = 'thang';
    goc.add(l);
  }
}

/**
 * Cây xanh instanced: 3 dạng tán (tròn, nón, thấp) + một thân chung, màu từng cây lệch nhẹ (instanceColor); đặt tất định theo toạ độ.
 * 4 draw call cho cả dự án. `bong` = cây đổ bóng (tắt ở bậc thấp).
 */
export function dungCay(T: T3, goc: THREE.Object3D, diem: Diem[], kieu: KieuVe3D, bong: boolean, y0 = 0): void {
  if (!diem.length) return;
  const trang = kieu === 'trang';
  const dang = [
    { g: new T.IcosahedronGeometry(2.4, 1), cao: 3.7, sy: 1.05 },
    { g: new T.ConeGeometry(1.9, 5.2, 7), cao: 4.6, sy: 1 },
    { g: new T.DodecahedronGeometry(1.8, 0), cao: 2.9, sy: 0.85 },
  ];
  const theo: Diem[][] = [[], [], []];
  diem.forEach((p) => { const r = nhieu(p[0] * 0.37, p[1] * 0.41); theo[r < 0.55 ? 0 : r < 0.8 ? 1 : 2].push(p); });
  const xanh = [0x6f8f5a, 0x7e9c63, 0x5f7f52, 0x8aa46c], c = new T.Color(), O = new T.Object3D();
  const vlTan = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });
  const than = new T.InstancedMesh(new T.CylinderGeometry(0.16, 0.24, 3, 6), new T.MeshStandardMaterial({ color: trang ? 0xdcdcd8 : 0x7a6a55, roughness: 1 }), diem.length);
  let k = 0;
  theo.forEach((ds, i) => {
    if (!ds.length) return;
    const d = dang[i], tan = new T.InstancedMesh(d.g, vlTan, ds.length);
    ds.forEach((p, j) => {
      const s = 0.8 + nhieu(p[0], p[1]) * 0.6;
      O.position.set(p[0], y0 + d.cao * s, -p[1]); O.scale.set(s, s * d.sy, s); O.rotation.set(0, nhieu(p[1], p[0]) * 6.28, 0); O.updateMatrix();
      tan.setMatrixAt(j, O.matrix);
      c.setHex(trang ? 0xf0f2ef : xanh[Math.floor(nhieu(p[0] * 1.7, p[1] * 2.3) * xanh.length) % xanh.length]);
      tan.setColorAt(j, c);
      O.position.set(p[0], y0 + 1.5 * s, -p[1]); O.scale.set(s, s, s); O.updateMatrix();
      than.setMatrixAt(k++, O.matrix);
    });
    tan.castShadow = bong; tan.receiveShadow = true; tan.userData.lop = 'cay';
    tan.computeBoundingSphere();
    goc.add(tan);
  });
  than.castShadow = bong; than.userData.lop = 'cay'; than.computeBoundingSphere();
  goc.add(than);
}
