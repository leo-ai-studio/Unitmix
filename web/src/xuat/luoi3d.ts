/**
 * Thu lưới tam giác từ một cảnh three (đã dựng bởi dungDuAn / dungToa) để xuất ra tệp mô hình (.dae cho SketchUp, .ifc cho Revit).
 * Hàm thuần theo three: gom mọi Mesh đang hiện (kể cả InstancedMesh — trải từng bản sao), áp ma trận thế giới + biến đổi tuỳ chọn,
 * đổi hệ trục sang Z hướng lên (CAD / SketchUp / Revit: x = X, y = −Z, z = Y), nhóm theo vật liệu (màu + độ đục). Nét (Line) bỏ.
 */
import type * as THREE from 'three';
import type { T3, VatLieu3D } from '../ve3d/dungCan';

/** Một nhóm tam giác cùng vật liệu. `P` = đỉnh từng tam giác nối liền (x y z × 3 mỗi tam giác), mét, Z lên. */
export type LuoiVL = { khoa: string; ten: string; mau: number; doDuc: number; P: Float32Array };

/** Tên tiếng Việt không dấu của vật liệu trong bảng `taoVatLieu` (dùng làm tên vật liệu trong tệp xuất). */
const TEN_VL: Record<string, string> = {
  tuong: 'Tuong', san: 'San', top: 'San-mo', khung: 'Khung-nhom', go: 'Go', khung2: 'Loi-tum', de: 'Khoi-de', tum: 'Tum',
  kinh: 'Kinh', kinhDai: 'Kinh-dai', lc: 'Lan-can', lov: 'Lover',
};

/** Biến đổi thêm trên toạ độ Z-lên (m) — dời / xoay / lật tòa về đúng chỗ trên lô. Phép lật (det < 0) đảo chiều mặt tự động. */
export type BienDoi = { f: (x: number, y: number, z: number) => [number, number, number]; lat?: boolean };

export type TuyChonThu = {
  /** Bỏ lớp (userData.lop) — vd 'cay', 'gio'. */
  boLop?: ReadonlySet<string>;
  /** Bỏ vật liệu theo khoá bảng vật liệu (vd 'top': sàn mờ). */
  boVL?: ReadonlySet<string>;
  bienDoi?: BienDoi;
};

const hex2 = (c: number) => c.toString(16).padStart(6, '0');

/** Bản đồ vật liệu three → tên khoá trong bảng `VatLieu3D` (tường và dầm là một vật liệu → 'tuong'). */
export function bangTenVL(M: VatLieu3D): Map<THREE.Material, string> {
  const m = new Map<THREE.Material, string>();
  for (const k of Object.keys(TEN_VL)) { const v = (M as unknown as Record<string, THREE.Material>)[k]; if (v && !m.has(v)) m.set(v, k); }
  return m;
}

/** Thu lưới theo vật liệu từ `goc` (hay `src.visible` cha). Cần `T` để lấy Matrix4. */
export function thuLuoi(T: T3, goc: THREE.Object3D, ten: Map<THREE.Material, string>, tuy: TuyChonThu = {}): LuoiVL[] {
  goc.updateMatrixWorld(true);
  const nhom = new Map<string, { khoa: string; ten: string; mau: number; doDuc: number; ds: Float32Array[] }>();
  const m4 = new T.Matrix4(), me = new T.Matrix4();
  const dao = !!tuy.bienDoi?.lat;
  const bd = tuy.bienDoi?.f;

  const them = (geo: THREE.BufferGeometry, mt: THREE.Matrix4, mat: THREE.Material) => {
    const k = ten.get(mat);
    if (k && tuy.boVL?.has(k)) return;
    const pos = geo.getAttribute('position');
    if (!pos) return;
    const idx = geo.index;
    const n = idx ? idx.count : pos.count;
    if (n < 3) return;
    const std = mat as THREE.MeshStandardMaterial;
    const mau = std.color ? std.color.getHex() : 0xcccccc, duc = std.transparent ? Math.min(1, Math.max(0, std.opacity)) : 1;
    const kn = `${k ?? 'vl'}|${hex2(mau)}|${duc.toFixed(2)}`;
    let g = nhom.get(kn);
    if (!g) nhom.set(kn, (g = { khoa: kn, ten: k ? TEN_VL[k] : `Vat-lieu-${hex2(mau)}`, mau, doDuc: duc, ds: [] }));
    const o = new Float32Array(n * 3), e = mt.elements;
    for (let i = 0; i < n; i++) {
      const v = idx ? idx.getX(i) : i;
      const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
      // thế giới three (Y lên) → Z lên: (X, −Z, Y)
      const X = e[0] * x + e[4] * y + e[8] * z + e[12], Y = e[1] * x + e[5] * y + e[9] * z + e[13], Z = e[2] * x + e[6] * y + e[10] * z + e[14];
      const [a, b, c] = bd ? bd(X, -Z, Y) : [X, -Z, Y];
      o[i * 3] = a; o[i * 3 + 1] = b; o[i * 3 + 2] = c;
    }
    if (dao) for (let i = 0; i + 2 < n; i += 3) { // lật gương: đổi thứ tự đỉnh 2 ↔ 3 để mặt vẫn quay ra ngoài
      for (let j = 0; j < 3; j++) { const t = o[(i + 1) * 3 + j]; o[(i + 1) * 3 + j] = o[(i + 2) * 3 + j]; o[(i + 2) * 3 + j] = t; }
    }
    g.ds.push(o);
  };

  goc.traverse((o) => {
    for (let v: THREE.Object3D | null = o; v; v = v.parent) {
      if (!v.visible) return;
      const lop = v.userData?.lop as string | undefined;
      if (lop && tuy.boLop?.has(lop)) return;
    }
    const m = o as THREE.Mesh & { isInstancedMesh?: boolean };
    if (!m.isMesh) return;
    const mat = m.material as THREE.Material;
    if (!mat || Array.isArray(mat)) return;
    if (m.isInstancedMesh) {
      const im = o as THREE.InstancedMesh;
      for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, me); m4.multiplyMatrices(im.matrixWorld, me); them(im.geometry, m4, mat); }
    } else them(m.geometry, m.matrixWorld, mat);
  });

  return [...nhom.values()].map((g) => {
    let tong = 0;
    g.ds.forEach((a) => { tong += a.length; });
    const P = new Float32Array(tong);
    let p = 0;
    g.ds.forEach((a) => { P.set(a, p); p += a.length; });
    return { khoa: g.khoa, ten: g.ten, mau: g.mau, doDuc: g.doDuc, P };
  }).filter((g) => g.P.length >= 9);
}

/** Tổng số tam giác của các nhóm (để báo kích thước). */
export const demTamGiac = (ds: LuoiVL[]): number => ds.reduce((s, g) => s + g.P.length / 9, 0);

// ---------- tách theo tầng + gộp tầng giống nhau (instancing) ----------

/** Phần hình của một tầng: cùng `id` = cùng hình (toạ độ tính từ mặt tầng) → tệp xuất chỉ ghi một lần, các tầng dùng lại. */
export type PhanTang = { id: string; ten: string; mau: number; doDuc: number; khoa: string; P: Float32Array };
export type TangLuoi = { ten: string; caoDo: number; phan: PhanTang[] };

/** Dịch sàn xuống 0,25 m khi chia tầng: sàn nằm dưới mặt tầng, thuộc tầng nó đỡ. */
const DICH_SAN = 0.25;

/** Hai băm FNV-1a 32 bit trên toạ độ làm tròn 1 mm (chống trùng ngẫu nhiên). */
function bam(P: Float32Array): string {
  let a = 0x811c9dc5, b = 0x9e3779b1;
  for (let i = 0; i < P.length; i++) {
    const v = Math.round(P[i] * 1000) | 0;
    a = Math.imul(a ^ v, 0x01000193); b = Math.imul(b ^ (v + i), 0x85ebca6b); b ^= b >>> 13;
  }
  return `${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}${P.length}`;
}

/**
 * Chia lưới của một tòa (toạ độ tòa, z từ mặt đất) thành các tầng theo cao độ trọng tâm tam giác; tầng i lấy từ `caoDo[i] − 0,25 m`
 * tới tầng trên, tầng đầu lấy từ −∞, tầng cuối tới +∞ (mái, tum). Toạ độ z trong mỗi phần quy về mặt tầng.
 */
export function tachTang(luoi: LuoiVL[], tang: { ten: string; caoDo: number }[]): TangLuoi[] {
  const ra: TangLuoi[] = tang.map((t) => ({ ten: t.ten, caoDo: t.caoDo, phan: [] }));
  const bien = tang.map((t, i) => (i === 0 ? -1e9 : t.caoDo - DICH_SAN));
  for (const l of luoi) {
    const goi: number[][] = tang.map(() => []);
    for (let i = 0; i + 8 < l.P.length; i += 9) {
      const zt = (l.P[i + 2] + l.P[i + 5] + l.P[i + 8]) / 3;
      let k = 0;
      while (k + 1 < tang.length && zt >= bien[k + 1]) k++;
      goi[k].push(i);
    }
    goi.forEach((ds, k) => {
      if (!ds.length) return;
      const P = new Float32Array(ds.length * 9), z0 = tang[k].caoDo;
      ds.forEach((i, j) => { P.set(l.P.subarray(i, i + 9), j * 9); for (let q = 2; q < 9; q += 3) P[j * 9 + q] -= z0; });
      ra[k].phan.push({ id: `${l.khoa}#${bam(P)}`, ten: l.ten, mau: l.mau, doDuc: l.doDuc, khoa: l.khoa, P });
    });
  }
  return ra;
}
