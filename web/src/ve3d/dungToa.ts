/**
 * Dựng 3D cả tòa từ mẫu tòa + mẫu căn đã chọn: khối đế đặc + N tầng điển hình (từng căn ghép theo đúng vị trí / hướng / lật gương
 * trên mặt tòa) + mái + tum lõi. Tầng điển hình dựng MỘT lần, gộp theo vật liệu rồi nhân bản để tòa 30–40 tầng vẫn quay mượt.
 * `mau` là mặt bằng ĐÃ TỰ CHỈNH (tinh/loiThang.ts · apMatBang): ô thang mới / đã dời, căn đã dồn, nét bao dài ra (QT-69), hành
 * lang kéo dài; `mauTang` cho tầng có mặt bằng riêng. Dải lõi chiếu lên mặt (`bang`, XC-05) chỉ là mốc, không dựng.
 */
import type * as THREE from 'three';
import type { Diem, ThuVien, ToaDat } from '../tinh/kieu';
import { boCucTang, canDangDung, congNangTai, tangCoRieng, veLoiTaiViTri, viTriCan, type BoCuc, type ToaCoMat } from '../tinh/matBang';
import { nguongLod } from './chon3d';
import { dungCan, hinhDaiCua, nhomMoi, type Khoi3d, type NhomHien, type T3, type ThamSo3D, type VatLieu3D } from './dungCan';

const K = 0.001;
export const CAO_TANG_DE_MM = 4000;
export const CAO_TUM_MM = 3000;

export type LoiHinh = { bao_tuong_mm?: [number, number, number, number] };
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
  const kq: Diem[][] = [];
  for (const m of mau.mat) for (const q of m.phan_tu) {
    if (q.loai === 'can' || q.bang) continue;
    const l = loi.get(idLoi(q.block));
    if (l?.bao_tuong_mm) kq.push(ranhLoi(l.bao_tuong_mm, q));
  }
  return kq;
}

const rad = (d: number) => (d * Math.PI) / 180;

const noi = (L: Float32Array[]) => { let n = 0; L.forEach((a) => { n += a.length; }); const o = new Float32Array(n); let p = 0; L.forEach((a) => { o.set(a, p); p += a.length; }); return o; };

/**
 * Gộp mọi mesh / nét (đang hiện) của `src` thành MỘT mesh mỗi vật liệu + MỘT `LineSegments` mỗi vật liệu nét, đưa vào `dich`.
 * `InstancedMesh` (nan lover) được trải từng bản sao vào hình học chung, `Line` (nét mở cửa sổ) đổi thành cặp đoạn — trước đây hai
 * loại này bị `clone` nguyên cái nên một tòa 24 tầng ra 2.655 draw call (docs/de_xuat_hieu_nang.md P8).
 * `khongBong` = vật liệu không đổ bóng (kính, khung, lan can… mảnh, bóng không thấy rõ mà nặng pass bóng).
 */
export function gop(T: T3, src: THREE.Object3D, dich: THREE.Object3D[], khongBong: Set<THREE.Material> = new Set()): void {
  src.updateMatrixWorld(true);
  const tm = new Map<THREE.Material, { P: Float32Array[]; N: (Float32Array | null)[] }>();
  const tl = new Map<THREE.Material, Float32Array[]>();
  const themMesh = (geo: THREE.BufferGeometry, mt: THREE.Matrix4, mat: THREE.Material) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(mt);
    const r = tm.get(mat) ?? tm.set(mat, { P: [], N: [] }).get(mat)!;
    r.P.push(g.getAttribute('position').array as Float32Array);
    r.N.push((g.getAttribute('normal')?.array as Float32Array | undefined) ?? null);
    g.dispose();
  };
  const themNet = (mat: THREE.Material, a: Float32Array) => { (tl.get(mat) ?? tl.set(mat, []).get(mat)!).push(a); };
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
  tm.forEach((r, mat) => {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(noi(r.P), 3));
    if (r.N.every(Boolean)) g.setAttribute('normal', new T.BufferAttribute(noi(r.N as Float32Array[]), 3)); else g.computeVertexNormals();
    const me = new T.Mesh(g, mat);
    me.castShadow = !khongBong.has(mat); me.receiveShadow = true;
    dich.push(me);
  });
  tl.forEach((P, mat) => {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(noi(P), 3));
    dich.push(new T.LineSegments(g, mat));
  });
}

/**
 * Nhân một tầng đã gộp lên nhiều cao độ: mesh → `InstancedMesh` (1 draw call cho mọi tầng cùng bố cục, GPU giữ một bản hình học);
 * nét → nối thành một `LineSegments` (nét không instancing được, nhưng nhẹ).
 */
function nhanTang(T: T3, ds: THREE.Object3D[], caoDo: number[]): THREE.Object3D[] {
  const kq: THREE.Object3D[] = [], m4 = new T.Matrix4();
  for (const o of ds) {
    const me = o as THREE.Mesh & { isLineSegments?: boolean };
    if (me.isLineSegments) {
      const a = me.geometry.getAttribute('position').array as Float32Array, b = new Float32Array(a.length * caoDo.length);
      caoDo.forEach((y, j) => { const o0 = j * a.length; for (let i = 0; i < a.length; i += 3) { b[o0 + i] = a[i]; b[o0 + i + 1] = a[i + 1] + y; b[o0 + i + 2] = a[i + 2]; } });
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(b, 3));
      kq.push(new T.LineSegments(g, me.material));
    } else if (me.isMesh) {
      const im = new T.InstancedMesh(me.geometry, me.material, caoDo.length);
      caoDo.forEach((y, j) => im.setMatrixAt(j, m4.makeTranslation(0, y, 0)));
      im.castShadow = me.castShadow; im.receiveShadow = true;
      im.computeBoundingSphere();
      kq.push(im);
    }
  }
  return kq;
}

const trongTam = (P: Diem[]): Diem => {
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length], c = p[0] * q[1] - q[0] * p[1]; A += c; cx += (p[0] + q[0]) * c; cy += (p[1] + q[1]) * c; }
  if (Math.abs(A) < 1e-6) return [P.reduce((s, p) => s + p[0], 0) / P.length, P.reduce((s, p) => s + p[1], 0) / P.length];
  return [cx / (3 * A), cy / (3 * A)];
};

/** Danh sách đỉnh ngoài của hình chữ nhật cục bộ lõi, đưa lên thế giới theo điểm chèn. */
function ranhLoi(bt: [number, number, number, number], q: { x: number; y: number; rot: number; sx: number; sy: number }): Diem[] {
  const [x0, y0, x1, y1] = bt;
  return veLoiTaiViTri([{ cat: 'bao', pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] }], q)[0].pts;
}

export function dungToa(T: T3, goc: THREE.Group, M: VatLieu3D, G: NhomHien, P: ThamSo3D, du: DuLieuToa) {
  const { mau, toa, tv } = du;
  const Hc = P.tang - P.san;
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

  // --- tầng điển hình: mỗi bố cục khác nhau (chung + tầng riêng) dựng một lần trong nhóm tạm, gộp theo vật liệu ---
  const tums = ranhTum(mau, du.loi, du.idLoi);
  const khongBong = new Set<THREE.Material>([M.kinh, M.khung, M.lc, M.lov, M.go, M.top]);
  // khối đế, mái, tum, thành chắn mái dựng vào nhóm tạm rồi gộp theo vật liệu (trước: mỗi đoạn thành chắn là một mesh)
  const ngoai = new T.Group();
  const dungMau = (bc: BoCuc, mauT: MauToa3D) => {
    const vts = viTriCan(mauT, tv, bc); // dồn khít theo bề ngang căn đang dùng (XC-04), trên mặt đã tự chỉnh
    const tmp = new T.Group(), Gt = nhomMoi();
    goc.add(tmp);
    const footT = mauT.duong_bao;
    khoi(footT, P.san, M.san, -P.san, false, tmp);
    Gt.top.push(khoi(footT, P.san, M.top, Hc, false, tmp));
    for (const d of sanHanhLangNgoai(mauT)) { khoi(d, P.san, M.san, -P.san, false, tmp); Gt.top.push(khoi(d, P.san, M.top, Hc, false, tmp)); }
    ranhTum(mauT, du.loi, du.idLoi).forEach((r) => khoi(r, Hc, M.khung2, 0, true, tmp));
    let so = 0;
    for (const vt of vts) {
      if (congNangTai(vt.khoa, bc) !== 'can') continue; // ô đổi công năng: để trống sàn
      const d = du.khoi3d.get(canDangDung(vt, bc));
      if (!d) continue;
      const m = mauT.mat[vt.matIdx], gr = rad(m.goc_deg), ux = Math.cos(gr), uy = Math.sin(gr), nx = -uy, ny = ux;
      const w = vt.a1 - vt.a0, s = vt.guong ? -1 : 1, off = vt.a0 + (vt.guong ? w : 0);
      const ox = ux * off + nx * m.truc_mm, oy = uy * off + ny * m.truc_mm;
      const sub = new T.Group();
      sub.matrixAutoUpdate = false;
      sub.matrix.set(ux * s, 0, -nx, ox * K, 0, 1, 0, 0, -uy * s, 0, ny, -oy * K, 0, 0, 0, 1);
      tmp.add(sub);
      dungCan(T, d, P, M, sub, Gt, true);
      so++;
    }
    Gt.top.forEach((o) => { o.visible = false; });
    const ds: THREE.Object3D[] = [];
    gop(T, tmp, ds, khongBong);
    goc.remove(tmp);
    tmp.traverse((o) => { (o as THREE.Mesh).geometry?.dispose?.(); });
    return { ds, so };
  };
  const vts0 = viTriCan(mau, tv);
  const chuKy = (bc: BoCuc) => vts0.map((vt) => `${congNangTai(vt.khoa, bc)}:${canDangDung(vt, bc)}`).join('|');
  const theoChuKy = new Map<string, ReturnType<typeof dungMau>>();
  const soMau = new Map<object, number>();
  const mauCua = (tang: number | null) => {
    const bc = boCucTang(toa, tang), mauT = (du.mauTang?.(tang) ?? mau) as MauToa3D;
    if (!soMau.has(mauT)) soMau.set(mauT, soMau.size);
    const k = soMau.get(mauT) + '#' + chuKy(bc);
    if (!theoChuKy.has(k)) theoChuKy.set(k, dungMau(bc, mauT));
    return theoChuKy.get(k)!;
  };
  const chung = mauCua(null), rieng = new Set(tangCoRieng(toa));
  const soCan = chung.so;

  // --- khối đế, thân, mái, tum ---
  if (hDe > 0) {
    khoi(foot, hDe, M.de, 0, true, ngoai);
    const ln: number[] = [];
    for (let k = 1; k < soDe; k++) foot.forEach((p, i) => { const q = foot[(i + 1) % foot.length]; ln.push(p[0] * K, k * CAO_TANG_DE_MM * K, -p[1] * K, q[0] * K, k * CAO_TANG_DE_MM * K, -q[1] * K); });
    if (ln.length) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(ln), 3)); ngoai.add(new T.LineSegments(g, M.line)); }
  }
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
  goc.add(ngoai);
  const dsNgoai: THREE.Object3D[] = [];
  gop(T, ngoai, dsNgoai);
  goc.remove(ngoai);
  ngoai.traverse((o) => { (o as THREE.Mesh).geometry?.dispose?.(); });
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
  const theoBoCuc = new Map<ReturnType<typeof dungMau>, number[]>();
  for (let j = 0; j < nDH; j++) {
    const b = rieng.has(j + 1) ? mauCua(j + 1) : chung;
    (theoBoCuc.get(b) ?? theoBoCuc.set(b, []).get(b)!).push((hDe + j * P.tang) * K);
  }
  theoBoCuc.forEach((caoDo, b) => nhanTang(T, b.ds, caoDo).forEach((o) => gan.add(o)));
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
  return { canh: { tam: [cx * K, cao * 0.45, -cy * K] as [number, number, number], coCanh, cao }, soCan };
}
