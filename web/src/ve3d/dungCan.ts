/**
 * Dựng 3D một căn hộ từ khối `khoi3d` (tường · cửa · lan can · lover · dầm biên · sàn) do scripts/boc_cad/can3d_data.py bóc.
 * Port từ app cũ (QT-114): mm, x = mặt tiền, y = chiều sâu (y = 0 ở hành lang); three: X = x, Z = −y, Y = cao.
 * Các kích thước đứng là tham số chung chỉnh được (ThamSo3D).
 */
import type * as THREE from 'three';
import { tuongSon } from './moiTruong';
import { catY, type CatY } from './dichShader';

export type T3 = typeof THREE;

export type Khoi3d = {
  walls: number[][][];
  openings: Cua3d[];
  rails: { b: number[]; ax: 'x' | 'y' }[];
  lovers: { ax: 'x' | 'y'; a: number[]; n: number[] }[];
  slab: number[][][];
  sides: string;
  damS?: number[][][];
  bb: number[];
};
export type Cua3d = {
  t: 'swing' | 'window' | 'slide';
  ax: 'x' | 'y' | 's';
  a: number[];
  c: number[];
  n: number[];
  hinge?: number;
  side?: number;
  lg?: number;
  o?: number[];
};

export type ThamSo3D = {
  cuaDi: number; cuaTruot: number; bauSo: number; caoSo: number; doNgang: number; lat: number;
  lanCan: number; bauLC: number; dam: number; san: number; tang: number; kieuLC: 'thep' | 'kinh';
};
export const THAM_SO_MAC: ThamSo3D = {
  cuaDi: 2200, cuaTruot: 2400, bauSo: 600, caoSo: 1800, doNgang: 1400, lat: 800, lanCan: 1400, bauLC: 150, dam: 600, san: 130, tang: 3300, kieuLC: 'thep',
};

export type VatLieu3D = Record<'tuong' | 'san' | 'dam' | 'top' | 'khung' | 'go' | 'khung2' | 'de' | 'tum' | 'kinh' | 'lc' | 'lov' | 'kinhDai' | 'kinhDe', THREE.Material> & {
  line: THREE.LineBasicMaterial;
  mol: THREE.LineBasicMaterial;
};

/**
 * Kiểu vẽ 3D: 'vatlieu' (mặc định — tường be ấm, kính xanh xám phản chiếu nhẹ, khung nhôm xám đậm, viền mực brand),
 * 'brand' (kem, xanh rêu, kiểu cũ) hoặc 'trang' (mô hình trắng, nền cho render AI).
 */
export type KieuVe3D = 'vatlieu' | 'brand' | 'trang';
export const DS_KIEU_3D: KieuVe3D[] = ['vatlieu', 'brand', 'trang'];

type KhoaMau = 'tuong' | 'san' | 'khung' | 'go' | 'khung2' | 'de' | 'tum' | 'kinh' | 'lc' | 'lov' | 'line' | 'mol' | 'kinhDai';
/**
 * Bảng màu. 'vatlieu' lấy từ brand (styles): giấy #FFFEFA / #F1F0EA, `--secondary` #B8B0A3, `--gold` #C7AA76, `--logo-ink` #022B1E,
 * `--green` #174F52; tường be = giấy pha vàng gold (không trắng tinh), đế đậm hơn thân một bậc để tách khối.
 */
export const BANG_MAU: Record<KieuVe3D, Record<KhoaMau, number>> = {
  // v3 (thực tế hơn): sơn be kem, mép sàn / ban công xám be đậm hơn, nhôm anode xám bạc, kính xanh xám sẫm (phản chiếu trời), đế đá ốp
  // v5 (như app cũ, rõ ràng): tường ghi sáng · dải mép sàn trắng ngà để tầng đọc rõ · kính xanh lam · khung nhôm / lan can / lam xám than nổi trên tường sáng · đế ghi đậm hơn thân
  vatlieu: { tuong: 0xd6d7d4, san: 0xf0f0ee, khung: 0x3d4448, go: 0x8a6a49, khung2: 0xe8e8e6, de: 0xb4b5b2, tum: 0xe0e1de, kinh: 0x4f8ac2, lc: 0x2d3338, lov: 0x70767a, line: 0x4a5560, mol: 0xc7aa76, kinhDai: 0x6ba3d2 },
  brand: { tuong: 0xfbfaf4, san: 0xdfe3dc, khung: 0x174f52, go: 0xa7835a, khung2: 0xe9ece5, de: 0xd5e2da, tum: 0xe5eeea, kinh: 0x7fa9a3, lc: 0x174f52, lov: 0x3e6f70, line: 0x174f52, mol: 0xc7aa76, kinhDai: 0x7fa9a3 },
  trang: { tuong: 0xffffff, san: 0xf2f2f0, khung: 0xd9dcda, go: 0xe8e6e1, khung2: 0xf7f7f5, de: 0xf4f4f2, tum: 0xf7f7f5, kinh: 0xcfd8d6, lc: 0xc5cac7, lov: 0xd0d4d2, line: 0x8f9894, mol: 0xb8b0a3, kinhDai: 0xdfe5e3 },
};

/** Bảng vật liệu (dùng chung căn / tầng / tòa / dự án); `cat` gắn mặt phẳng cắt ngang chung. */
export function taoVatLieu(T: T3, cat: THREE.Plane[] | CatY, kieu: KieuVe3D = 'brand'): VatLieu3D {
  const B = BANG_MAU[kieu], vl = kieu === 'vatlieu';
  // mặt cắt ngang: đồng phục `CatY` (bản vá shader, dịch trước được — Khung3D) hoặc mảng clippingPlanes (test, nơi khác)
  const mp = Array.isArray(cat) ? cat : [];
  const cY = <M extends THREE.Material>(m: M): M => (Array.isArray(cat) ? m : catY(m, cat));
  // polygonOffset dương: mặt khối lùi ra sau một chút → nét viền (LineSegments nằm đúng trên cạnh mặt) luôn vẽ đè lên, không bị mặt kề che từng đoạn
  // (nét gãy / nhấp nháy khi xoay, zoom — z-fighting giữa đường và mặt). Vật liệu muốn nằm trước (kinhDai) tự ghi đè bằng offset âm.
  const mt = (c: number, o: THREE.MeshStandardMaterialParameters = {}) => cY(new T.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, clippingPlanes: mp, polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 1.5, ...o }));
  // Vật liệu: tường / đế / tum sơn có biến thiên nhẹ + tối chân công trình (moiTruong.tuongSon); kiểu khác giữ nguyên
  const son = (m: THREE.MeshStandardMaterial, k: string) => (vl ? tuongSon(m, k) : m);
  const tuong = son(mt(B.tuong, { side: T.DoubleSide, roughness: vl ? 0.92 : 0.85 }), 'tuong');
  /** Kính thật: điện môi (metalness 0) có Fresnel — nhìn thẳng sẫm, nhìn xiên phản chiếu trời; PBR vật lý chỉ cho kiểu Vật liệu. */
  const kinhVL = (c: number, o: THREE.MeshPhysicalMaterialParameters) => cY(new T.MeshPhysicalMaterial({ color: c, roughness: 0.04, metalness: 0, ior: 1.52, specularIntensity: 1, envMapIntensity: 1.6, clippingPlanes: mp, side: T.DoubleSide, ...o }));
  return {
    tuong, dam: tuong,
    san: mt(B.san, { side: T.DoubleSide, roughness: vl ? 0.8 : 0.85 }),
    top: mt(B.san, { transparent: true, opacity: 0.28, depthWrite: false }),
    // nhôm xám đậm: hơi kim loại để bắt sáng môi trường
    khung: vl ? mt(B.khung, { roughness: 0.32, metalness: 0.85 }) : mt(B.khung, { roughness: 0.5, metalness: 0.2 }),
    go: mt(B.go, { roughness: 0.7 }),
    khung2: mt(B.khung2, { side: T.DoubleSide }),
    de: son(mt(B.de, { roughness: vl ? 0.7 : 0.8, side: T.DoubleSide }), 'de'),
    tum: son(mt(B.tum, { roughness: vl ? 0.9 : 0.8, side: T.DoubleSide }), 'tum'),
    // kính xanh xám hơi trong, phản chiếu nhẹ (môi trường RoomEnvironment ở khung 3D, chỉ kiểu Vật liệu)
    kinh: vl
      ? kinhVL(B.kinh, { transparent: true, opacity: 0.86, depthWrite: false })
      : mt(B.kinh, { transparent: true, opacity: kieu === 'trang' ? 0.5 : 0.42, roughness: 0.1, metalness: 0.1, depthWrite: false, side: T.DoubleSide }),
    // dải cửa khi nhìn xa: kính đặc (không trong suốt) để không lộ tường sau, vẫn phản chiếu
    // polygonOffset: dải nằm sát mặt tường, nhìn xa không nhấp nháy (z-fighting)
    kinhDai: vl
      ? kinhVL(B.kinhDai, { roughness: 0.08, envMapIntensity: 1.3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
      : mt(B.kinhDai, { roughness: 0.3, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    // kính vách khối đế: trong (độ đục ~0,3) để nhìn xuyên thấy cột, vách lõi, mép sàn phía sau; vẫn phản chiếu nhẹ
    kinhDe: vl
      ? kinhVL(0x9cc7ea, { transparent: true, opacity: 0.3, roughness: 0.05, envMapIntensity: 1.2, depthWrite: false })
      : mt(B.kinh, { transparent: true, opacity: 0.3, roughness: 0.1, metalness: 0.1, depthWrite: false, side: T.DoubleSide }),
    lc: vl ? mt(B.lc, { roughness: 0.35, metalness: 0.8 }) : mt(B.lc, { roughness: 0.5, metalness: 0.3 }),
    lov: mt(B.lov, vl ? { roughness: 0.45, metalness: 0.6 } : { roughness: 0.6, metalness: 0.2 }),
    // viền: Vật liệu nhạt hơn (đỡ "nét CAD", khối đọc bằng ánh sáng + bóng); vẫn đủ để đọc tầng / góc
    line: cY(new T.LineBasicMaterial({ color: B.line, clippingPlanes: mp, transparent: true, opacity: kieu === 'trang' ? 0.55 : vl ? 0.17 : 0.4 })),
    mol: cY(new T.LineBasicMaterial({ color: B.mol, clippingPlanes: mp })),
  };
}

/**
 * Thân tháp nhìn xa (LOD xa trong 3D tòa, mọi tòa ở 3D toàn dự án kiểu Vật liệu): một dải kính theo từng tầng chạy quanh nét chân
 * tháp, lùi khỏi góc, đặt nhô ra 6 cm khỏi mặt tường. Toạ độ mét (x, y bản vẽ; cao = Y three). Trả hình học đã gộp (1 draw call).
 */
export function hinhDaiCua(T: T3, chan: [number, number][], z0: number, caoTang: number, soTang: number, bau = 0.75, cao = 1.75): THREE.BufferGeometry | null {
  let A = 0;
  for (let i = 0; i < chan.length; i++) { const p = chan[i], q = chan[(i + 1) % chan.length]; A += p[0] * q[1] - q[0] * p[1]; }
  const s = A >= 0 ? 1 : -1, nho = 0.06, lui = 0.35; // CCW: pháp tuyến ra ngoài của cạnh (dx, dy) là (dy, −dx)
  const P: number[] = [], N: number[] = [];
  for (let i = 0; i < chan.length; i++) {
    const p = chan[i], q = chan[(i + 1) % chan.length], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy);
    if (L < 2 * lui + 0.8) continue;
    const ux = dx / L, uy = dy / L, nx = s * uy, ny = -s * ux;
    const ax = p[0] + ux * lui + nx * nho, ay = p[1] + uy * lui + ny * nho, bx = q[0] - ux * lui + nx * nho, by = q[1] - uy * lui + ny * nho;
    for (let j = 0; j < soTang; j++) {
      const y0 = z0 + j * caoTang + bau, y1 = y0 + Math.min(cao, caoTang - bau - 0.1);
      // hai tam giác; toạ độ three: (x, cao, −y)
      P.push(ax, y0, -ay, bx, y0, -by, bx, y1, -by, ax, y0, -ay, bx, y1, -by, ax, y1, -ay);
      for (let k = 0; k < 6; k++) N.push(nx, 0, -ny);
    }
  }
  if (!P.length) return null;
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3));
  g.setAttribute('normal', new T.BufferAttribute(new Float32Array(N), 3));
  return g;
}

/** Các nhóm đối tượng để bật / tắt hiển thị. */
export type NhomHien = { dam: THREE.Object3D[]; lov: THREE.Object3D[]; top: THREE.Object3D[]; vien: THREE.Object3D[]; mo: { pg: THREE.Object3D; ang: number }[] };
export const nhomMoi = (): NhomHien => ({ dam: [], lov: [], top: [], vien: [], mo: [] });

const K = 0.001;

/**
 * Dựng một căn vào `goc`. `ghep` = đang ghép tầng: sàn do nơi gọi dựng theo nét bao nên bỏ sàn từng căn.
 */
export function dungCan(T: T3, d: Khoi3d, P: ThamSo3D, M: VatLieu3D, goc: THREE.Object3D, G: NhomHien, ghep = false): void {
  const Hc = P.tang - P.san, bb = d.bb;
  const noi = (ax: 'x' | 'y') => {
    const g = new T.Group();
    if (ax === 'y') g.rotation.y = Math.PI / 2;
    goc.add(g);
    return { g: g as THREE.Object3D, ns: ax === 'x' ? -1 : 1 };
  };
  const F = { x: noi('x'), y: noi('y') };
  const hop = (g: THREE.Object3D, a0: number, a1: number, n0: number, n1: number, z0: number, z1: number, m: THREE.Material, ns: number, tag?: keyof Pick<NhomHien, 'dam' | 'lov' | 'top' | 'vien'>) => {
    if (a1 <= a0 || z1 <= z0) return null;
    const me = new T.Mesh(new T.BoxGeometry((a1 - a0) * K, (z1 - z0) * K, Math.max(n1 - n0, 1) * K), m);
    me.position.set(((a0 + a1) / 2) * K, ((z0 + z1) / 2) * K, (ns * (n0 + n1)) / 2 * K);
    me.castShadow = true; me.receiveShadow = true;
    g.add(me);
    if (tag) G[tag].push(me);
    return me;
  };
  const daGiac = (ring: number[][], h: number, m: THREE.Material, z0: number) => {
    const s = new T.Shape();
    ring.forEach((p, i) => (i ? s.lineTo(p[0] * K, p[1] * K) : s.moveTo(p[0] * K, p[1] * K)));
    const geo = new T.ExtrudeGeometry(s, { depth: h * K, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const me = new T.Mesh(geo, m);
    me.position.y = z0 * K; me.castShadow = true; me.receiveShadow = true;
    goc.add(me);
    return me;
  };
  const vien = (me: THREE.Mesh, tag?: 'dam') => {
    const l = new T.LineSegments(new T.EdgesGeometry(me.geometry, 25), M.line);
    l.position.copy(me.position);
    goc.add(l);
    G.vien.push(l);
    if (tag) G[tag].push(l);
  };

  if (!ghep) d.slab.forEach((r) => { daGiac(r, P.san, M.san, -P.san); G.top.push(daGiac(r, P.san, M.top, Hc)); });
  d.walls.forEach((r) => vien(daGiac(r, Hc, M.tuong, 0)));

  d.openings.forEach((o) => {
    let GN = F[o.ax as 'x' | 'y'];
    if (o.ax === 's') { // cửa sổ trên mặt tiền xiên (căn V / Y)
      const g = new T.Group();
      g.position.set(o.o![0] * K, 0, -o.o![1] * K); g.rotation.y = o.o![2];
      goc.add(g);
      GN = { g, ns: -1 };
    }
    const { g, ns } = GN;
    const a0 = o.a[0], a1 = o.a[1], c0 = o.c[0], c1 = o.c[1], n0 = o.n[0], n1 = o.n[1], nm = (n0 + n1) / 2, tw = n1 - n0;
    let day = 0, dau = P.cuaDi;
    if (o.t === 'window') { day = P.bauSo; dau = P.bauSo + P.caoSo; } else if (o.t === 'slide') dau = P.cuaTruot;
    const ov = 4;
    hop(g, a0 - ov, a1 + ov, n0, n1, dau, Hc, M.tuong, ns);
    if (day > 0) hop(g, a0 - ov, a1 + ov, n0, n1, 0, day, M.tuong, ns);
    if (o.t === 'swing') {
      hop(g, a0, c0, n0, n1, 0, dau, M.khung2, ns); hop(g, c1, a1, n0, n1, 0, dau, M.khung2, ns);
      const len = c1 - c0, th = 40, pa = o.hinge === 0 ? c0 : c1, da = o.hinge === 0 ? 1 : -1;
      const pg = new T.Group();
      pg.position.set(pa * K, 0, ns * nm * K);
      g.add(pg);
      const bx = (x0: number, x1: number, z0: number, z1: number, t: number, m: THREE.Material) => {
        const me = new T.Mesh(new T.BoxGeometry((x1 - x0) * K, (z1 - z0) * K, t * K), m);
        me.position.set((da * (x0 + x1)) / 2 * K, ((z0 + z1) / 2) * K, 0);
        me.castShadow = true; me.receiveShadow = true;
        pg.add(me);
      };
      const hl = dau - 30;
      if (o.lg) { // cửa đi ra lô gia phụ: nhôm kính
        const f = 55;
        bx(0, len, 0, f + 25, th + 10, M.khung); bx(0, len, hl - f, hl, th + 10, M.khung); bx(0, f, 0, hl, th + 10, M.khung); bx(len - f, len, 0, hl, th + 10, M.khung);
        bx(f, len - f, f + 25, hl - f, 6, M.kinh); bx(len - f - 20, len - f + 10, 900, 1100, th + 50, M.khung);
      } else {
        bx(0, len, 0, hl, th, M.go); bx(len - 170, len - 90, 990, 1014, th + 60, M.khung);
      }
      G.mo.push({ pg, ang: ((-ns * (o.side ?? 1)) / da) * (Math.PI / 2) });
    } else {
      const fw = 55, fd = Math.min(tw, 100) * 0.7;
      if (o.t === 'window') {
        const z0 = day, z1 = dau, zn = Math.max(z0 + 120, Math.min(z1 - 120, P.doNgang)), nw = Math.min(P.lat, c1 - c0 - 2 * fw - 200);
        hop(g, c0, c1, nm - fd / 2, nm + fd / 2, z0, z0 + fw, M.khung, ns); hop(g, c0, c1, nm - fd / 2, nm + fd / 2, z1 - fw, z1, M.khung, ns);
        hop(g, c0, c0 + fw, nm - fd / 2, nm + fd / 2, z0, z1, M.khung, ns); hop(g, c1 - fw, c1, nm - fd / 2, nm + fd / 2, z0, z1, M.khung, ns);
        hop(g, c0, c1, nm - fd / 2, nm + fd / 2, zn - 20, zn + 20, M.khung, ns);
        const xs = [c0];
        if (nw > 0) xs.push(c0 + nw);
        const rest = c1 - xs[xs.length - 1], cnt = Math.max(1, Math.round(rest / 1000)), base = xs[xs.length - 1];
        for (let i = 1; i <= cnt; i++) xs.push(base + (rest * i) / cnt);
        xs.forEach((am, i) => { if (i > 0 && i < xs.length - 1) hop(g, am - 25, am + 25, nm - fd / 2, nm + fd / 2, z0, z1, M.khung, ns); });
        hop(g, c0 + fw, c1 - fw, nm - 3, nm + 3, z0 + fw, z1 - fw, M.kinh, ns);
        if (nw > 0) { // ô mở lật
          hop(g, c0 + fw, c0 + nw + 25, nm - fd / 2 - 4, nm + fd / 2 + 4, zn + 20, zn + 20 + fw * 0.6, M.khung, ns);
          const ap = [(c0 + nw / 2) * K, (z1 - fw) * K], b1 = [(c0 + fw + 10) * K, (zn + 20 + fw) * K], b2 = [(c0 + nw - 10) * K, (zn + 20 + fw) * K], zc = ns * nm * K;
          const ln = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(b1[0], b1[1], zc), new T.Vector3(ap[0], ap[1], zc), new T.Vector3(b2[0], b2[1], zc)]), M.mol);
          g.add(ln); G.vien.push(ln);
        }
      } else {
        const z1 = dau, cnt = Math.max(2, Math.round((c1 - c0) / 1100)), st = (c1 - c0) / cnt;
        hop(g, c0, c1, nm - fd / 2, nm + fd / 2, 0, 70, M.khung, ns); hop(g, c0, c1, nm - fd / 2, nm + fd / 2, z1 - 60, z1, M.khung, ns);
        hop(g, c0, c0 + fw, nm - fd / 2, nm + fd / 2, 0, z1, M.khung, ns); hop(g, c1 - fw, c1, nm - fd / 2, nm + fd / 2, 0, z1, M.khung, ns);
        for (let i = 0; i < cnt; i++) {
          const s0 = c0 + st * i, s1 = c0 + st * (i + 1), off = (i % 2 ? 1 : -1) * (fd / 4);
          hop(g, s0, s0 + 30, nm + off - 12, nm + off + 12, 70, z1 - 60, M.khung, ns); hop(g, s1 - 30, s1, nm + off - 12, nm + off + 12, 70, z1 - 60, M.khung, ns);
          hop(g, s0 + 30, s1 - 30, nm + off - 3, nm + off + 3, 70, z1 - 60, M.kinh, ns);
        }
      }
    }
  });

  // dầm biên dọc các cạnh mặt tiền
  const BW = 220;
  if (!d.damS) {
    for (const s of d.sides) {
      const r = s === 'T' ? [bb[0], bb[3] - BW, bb[2], bb[3]] : s === 'B' ? [bb[0], bb[1], bb[2], bb[1] + BW] : s === 'L' ? [bb[0], bb[1], bb[0] + BW, bb[3]] : [bb[2] - BW, bb[1], bb[2], bb[3]];
      const me = new T.Mesh(new T.BoxGeometry((r[2] - r[0]) * K, P.dam * K, (r[3] - r[1]) * K), M.dam);
      me.position.set(((r[0] + r[2]) / 2) * K, (Hc - P.dam / 2) * K, -((r[1] + r[3]) / 2) * K);
      me.castShadow = true; me.receiveShadow = true;
      goc.add(me); G.dam.push(me);
      vien(me, 'dam');
    }
  }
  (d.damS ?? []).forEach((r) => { const me = daGiac(r, P.dam, M.dam, Hc - P.dam); G.dam.push(me); vien(me, 'dam'); });

  // lan can: bậu + thanh đứng + tay vịn; chừa chỗ lover
  d.rails.forEach((r) => {
    const { g, ns } = F[r.ax], b = r.b, x = r.ax === 'x';
    const a0 = x ? b[0] : b[1], a1 = x ? b[2] : b[3], n0 = x ? b[1] : b[0], n1 = x ? b[3] : b[2], nm = (n0 + n1) / 2, kt = Math.max(n1 - n0, 100);
    const cat = d.lovers.filter((l) => l.ax === r.ax && l.a[1] > a0 && l.a[0] < a1).map((l) => l.a), H = P.lanCan, KB = P.bauLC;
    hop(g, a0, a1, nm - kt / 2, nm + kt / 2, 0, KB, M.tuong, ns);
    hop(g, a0, a1, nm - 20, nm + 20, H - 25, H + 25, M.lc, ns);
    if (P.kieuLC === 'kinh') {
      hop(g, a0, a1, nm - 15, nm + 15, KB, KB + 40, M.lc, ns);
      let seg: number[][] = [[a0, a1]];
      cat.forEach((c) => {
        seg = seg.flatMap((q) => {
          const o: number[][] = [];
          if (c[0] > q[0]) o.push([q[0], Math.min(q[1], c[0])]);
          if (c[1] < q[1]) o.push([Math.max(q[0], c[1]), q[1]]);
          return o.filter((w) => w[1] - w[0] > 20);
        });
      });
      seg.forEach((q) => hop(g, q[0] + 25, q[1] - 25, nm - 6, nm + 6, KB + 40, H - 25, M.kinh, ns));
    } else {
      hop(g, a0, a1, nm - 15, nm + 15, KB, KB + 25, M.lc, ns);
      for (let a = a0 + 30; a <= a1 - 30; a += 110) {
        if (cat.some((c) => a >= c[0] - 5 && a <= c[1] + 5)) continue;
        hop(g, a - 9, a + 9, nm - 9, nm + 9, KB + 25, H - 25, M.lc, ns);
      }
    }
    hop(g, a0, a0 + 50, nm - 25, nm + 25, KB, H, M.lc, ns); hop(g, a1 - 50, a1, nm - 25, nm + 25, KB, H, M.lc, ns);
  });

  // lover che điều hoà: từ bậu lan can lên sát đáy dầm
  d.lovers.forEach((l) => {
    const { g, ns } = F[l.ax], a0 = l.a[0], a1 = l.a[1], nm = (l.n[0] + l.n[1]) / 2, zt = Hc - P.dam, KB = P.bauLC, pitch = 65, n = Math.max(1, Math.floor((zt - KB) / pitch));
    const sg = new T.Group();
    g.add(sg); G.lov.push(sg);
    hop(sg, a0, a0 + 40, nm - 45, nm + 45, KB, zt, M.khung, ns); hop(sg, a1 - 40, a1, nm - 45, nm + 45, KB, zt, M.khung, ns); hop(sg, a0, a1, nm - 45, nm + 45, zt - 40, zt, M.khung, ns);
    const im = new T.InstancedMesh(new T.BoxGeometry((a1 - a0 - 80) * K, 6 * K, 90 * K), M.lov, n), O = new T.Object3D();
    for (let i = 0; i < n; i++) {
      O.position.set(((a0 + a1) / 2) * K, (KB + 30 + i * pitch) * K, ns * nm * K);
      O.rotation.set(0.5 * ns, 0, 0);
      O.updateMatrix();
      im.setMatrixAt(i, O.matrix);
    }
    im.castShadow = false; // nan mảnh: bóng không thấy rõ, bỏ để nhẹ pass bóng
    sg.add(im);
  });
}
