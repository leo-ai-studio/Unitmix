/**
 * Dựng 3D một căn hộ từ khối `khoi3d` (tường · cửa · lan can · lover · dầm biên · sàn) do scripts/boc_cad/can3d_data.py bóc.
 * Port từ app cũ (QT-114): mm, x = mặt tiền, y = chiều sâu (y = 0 ở hành lang); three: X = x, Z = −y, Y = cao.
 * Các kích thước đứng là tham số chung chỉnh được (ThamSo3D).
 */
import type * as THREE from 'three';

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

export type VatLieu3D = Record<'tuong' | 'san' | 'dam' | 'top' | 'khung' | 'go' | 'khung2' | 'de' | 'tum' | 'kinh' | 'lc' | 'lov', THREE.Material> & {
  line: THREE.LineBasicMaterial;
  mol: THREE.LineBasicMaterial;
};

/** Bảng vật liệu như app cũ; `mat` gắn mặt phẳng cắt ngang chung. */
export function taoVatLieu(T: T3, cat: THREE.Plane[]): VatLieu3D {
  const mt = (c: number, o: THREE.MeshStandardMaterialParameters = {}) => new T.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, clippingPlanes: cat, ...o });
  const tuong = mt(0xe6e2da, { side: T.DoubleSide });
  return {
    tuong, dam: tuong,
    san: mt(0xb9bcc1, { side: T.DoubleSide }),
    top: mt(0xb9bcc1, { transparent: true, opacity: 0.28, depthWrite: false }),
    khung: mt(0x2d2f33, { roughness: 0.5, metalness: 0.3 }),
    go: mt(0x9b6b3c, { roughness: 0.7 }),
    khung2: mt(0xcfc9bd, { side: T.DoubleSide }),
    de: mt(0xc9b99a, { roughness: 0.8, side: T.DoubleSide }),
    tum: mt(0xd9d4c8, { roughness: 0.8, side: T.DoubleSide }),
    kinh: mt(0x7fb4d4, { transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.1, depthWrite: false, side: T.DoubleSide }),
    lc: mt(0x333639, { roughness: 0.5, metalness: 0.4 }),
    lov: mt(0x4a4d52, { roughness: 0.6, metalness: 0.3 }),
    line: new T.LineBasicMaterial({ color: 0x3a3f46, clippingPlanes: cat }),
    mol: new T.LineBasicMaterial({ color: 0x2fb6e8, clippingPlanes: cat }),
  };
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
    im.castShadow = true;
    sg.add(im);
  });
}
