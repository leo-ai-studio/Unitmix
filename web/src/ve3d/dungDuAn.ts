/**
 * Dựng 3D toàn dự án (mét, three: X = x, Y = cao, Z = −y): ô đất tô theo loại (cây xanh có cây, mặt nước hạ thấp),
 * nét hạ tầng xung quanh, khối đế + thân tháp từng tòa (vạch sàn từng tầng). Tòa đang chọn tô nhấn.
 */
import type * as THREE from 'three';
import { khoiHam, raiHam, ranhHam } from '../tinh/ham';
import { chanToa, khoiDe, trongTam } from '../tinh/hinhHoc';
import type { Diem, ThuVien, TrangThaiPA } from '../tinh/kieu';
import { laCaoTang, loaiDat, MAU_DAT, type LoaiDat } from '../tinh/loaiDat';
import { chuanHoaHam } from '../tinh/macDinh';
import type { KieuVe3D, T3, VatLieu3D } from './dungCan';
import type { CanhDung, GocDeXuat } from './Khung3D';
import { t } from '../i18n/i18n';

const trong = (p: Diem, poly: Diem[]): boolean => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};
/** Nhiễu giả ngẫu nhiên ổn định theo toạ độ (cây không nhảy chỗ mỗi lần dựng). */
const nhieu = (x: number, y: number) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };

/** Điểm trồng cây trong đa giác: lưới `buoc` m có xô lệch, lùi khỏi mép ~2 m, tối đa `toiDa` điểm. */
export function diemCay(poly: Diem[], buoc: number, toiDa: number): Diem[] {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const kq: Diem[] = [];
  for (let x = Math.min(...xs) + buoc / 2; x < Math.max(...xs); x += buoc) {
    for (let y = Math.min(...ys) + buoc / 2; y < Math.max(...ys); y += buoc) {
      const p: Diem = [x + (nhieu(x, y) - 0.5) * buoc * 0.6, y + (nhieu(y, x) - 0.5) * buoc * 0.6];
      if (!trong(p, poly)) continue;
      if (![[2, 0], [-2, 0], [0, 2], [0, -2]].every(([dx, dy]) => trong([p[0] + dx, p[1] + dy], poly))) continue;
      kq.push(p);
      if (kq.length >= toiDa) return kq;
    }
  }
  return kq;
}

export function dungDuAn(T: T3, goc: THREE.Group, M: VatLieu3D, kieu: KieuVe3D, pa: TrangThaiPA, tv: ThuVien, toaChon: string | null, hienHam = false): CanhDung | null {
  if (!pa.lo.length) return null;
  const trang = kieu === 'trang';
  const shape = (pts: Diem[]) => { const s = new T.Shape(); pts.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]))); return s; };
  const khoi = (pts: Diem[] | Diem[][], cao: number, m: THREE.Material, z0: number, vien?: THREE.LineBasicMaterial) => {
    const ds = (Array.isArray(pts[0]?.[0]) ? pts : [pts]) as Diem[][];
    const g = new T.ExtrudeGeometry(ds.map(shape), { depth: cao, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    const me = new T.Mesh(g, m);
    me.position.y = z0; me.castShadow = true; me.receiveShadow = true;
    goc.add(me);
    if (vien) { const l = new T.LineSegments(new T.EdgesGeometry(g, 30), vien); l.position.y = z0; goc.add(l); }
    return me;
  };
  const duong = (pts: Diem[], y: number, m: THREE.LineBasicMaterial, kin = false) => {
    const v = pts.map((p) => new T.Vector3(p[0], y, -p[1]));
    if (kin) v.push(v[0]);
    goc.add(new T.Line(new T.BufferGeometry().setFromPoints(v), m));
  };

  // --- ô đất ---
  const matDat = new Map<LoaiDat, THREE.MeshStandardMaterial>();
  const vlDat = (l: LoaiDat) => {
    let m = matDat.get(l);
    if (!m) {
      const mau = trang ? (l === 'mat_nuoc' ? '#e6eef0' : l === 'cay_xanh' ? '#eef1ec' : '#f7f7f5') : MAU_DAT[l][0];
      m = new T.MeshStandardMaterial({ color: mau, roughness: l === 'mat_nuoc' ? 0.15 : 0.95, metalness: l === 'mat_nuoc' ? 0.1 : 0 });
      matDat.set(l, m);
    }
    return m;
  };
  /** Ô đất cao tầng khi bật hầm: bán trong suốt để nhìn xuyên xuống khối hầm. */
  const vlDatTrong = (l: LoaiDat) => {
    const m = vlDat(l).clone();
    m.transparent = true; m.opacity = 0.22; m.depthWrite = false;
    return m;
  };
  const netXq = new T.LineBasicMaterial({ color: trang ? 0xc9ccc8 : 0xb8b0a3 });
  const netLo = new T.LineBasicMaterial({ color: trang ? 0x9aa29e : 0x174f52 });
  const netCg = new T.LineBasicMaterial({ color: 0xb42318, transparent: true, opacity: 0.7 });
  for (const d of pa.lo.flatMap((l) => l.xungQuanh)) if (d.length >= 2) duong(d, 0.02, netXq);
  const cay: Diem[] = [];
  for (const l of pa.lo) {
    if (l.ranh.length < 3) continue;
    const loai = loaiDat(l);
    if (loai === 'mat_nuoc') khoi(l.ranh, 0.05, vlDat(loai), -0.35);
    else khoi(l.ranh, loai === 'o_cao_tang' ? 0.2 : 0.12, hienHam && laCaoTang(l) ? vlDatTrong(loai) : vlDat(loai), 0);
    if (loai === 'cay_xanh') cay.push(...diemCay(l.ranh, 9, 600));
    if (laCaoTang(l)) {
      duong(l.ranh, 0.25, netLo, true);
      if (l.chiGioi) duong(l.chiGioi, 0.24, netCg, true);
    }
  }

  // --- hầm: khối bán trong suốt dưới cốt 0 (ranh hầm × số tầng × cao tầng), ram và lõi ---
  if (hienHam) {
    const h = chuanHoaHam(pa.ham);
    const vlHam = new T.MeshStandardMaterial({ color: trang ? 0xdfe6e3 : 0x2f7d79, roughness: 0.9, transparent: true, opacity: 0.3, depthWrite: false });
    const vlRam = new T.MeshStandardMaterial({ color: 0xe0933a, roughness: 0.9, transparent: true, opacity: 0.6, depthWrite: false });
    const vlLoi = new T.MeshStandardMaterial({ color: trang ? 0xb9bdba : 0x5c6662, roughness: 0.9 });
    const vienHam = new T.LineBasicMaterial({ color: 0x174f52 }), sanHam = new T.LineBasicMaterial({ color: 0x174f52, transparent: true, opacity: 0.45 });
    for (const l of pa.lo) {
      if (!laCaoTang(l) || !pa.toa.some((x) => x.loId === l.id)) continue;
      // ranh cố định trong PA chỉ áp cho lô chứa nó; các lô còn lại lấy ranh mặc định
      const dung = !h.ranh || trong(trongTam(h.ranh), l.ranh);
      const kq = dung ? raiHam(pa, tv, l) : null;
      const kh = khoiHam(kq?.ranh ?? ranhHam(l, { ranh: null, lui: h.lui }), h.soTang, h.caoTang);
      if (!kh) continue;
      const me = khoi(kh.ranh, -kh.yDuoi, vlHam, kh.yDuoi, vienHam);
      me.castShadow = false; me.receiveShadow = false;
      for (const y of kh.yTang.slice(1, -1)) duong(kh.ranh, y, sanHam, true);
      for (const p of kq?.loi ?? []) if (p.length >= 3) khoi(p, -kh.yDuoi, vlLoi, kh.yDuoi);
      if (kq?.ram && kq.ram.poly.length >= 3) { const r = khoi(kq.ram.poly, h.caoTang, vlRam, -h.caoTang); r.castShadow = false; }
    }
  }

  // --- tòa: khối đế theo lô + thân tháp, vạch sàn ---
  const vlChon = new T.MeshStandardMaterial({ color: trang ? 0xe5eeea : 0xcfe0d8, roughness: 0.8 });
  const vienChon = new T.LineBasicMaterial({ color: 0x174f52 });
  let caoMax = 0;
  const chanTat: Diem[][] = [];
  for (const l of pa.lo) {
    const ts = pa.toa.filter((x) => x.loId === l.id && tv.toa.has(x.mauId));
    if (!ts.length) continue;
    const chans = ts.map((x) => chanToa(tv.toa.get(x.mauId)!, x));
    chanTat.push(...chans);
    const hDe = Math.max(0, ...ts.map((x) => x.soTangDe * x.caoDe));
    if (hDe > 0) {
      const de = khoiDe(chans, ts.map((x) => x.deOffset)).filter((p) => p.length >= 3);
      for (const p of de) khoi(p, hDe, M.de, 0.2, M.line);
    }
    ts.forEach((x, i) => {
      const chan = chans[i], z0 = 0.2 + x.soTangDe * x.caoDe, h = x.soTangDH * x.caoDH, chon = x.id === toaChon;
      khoi(chan, h, chon ? vlChon : M.tuong, z0, chon ? vienChon : M.line);
      const ln: number[] = [];
      for (let k = 1; k < x.soTangDH; k++) {
        const y = z0 + k * x.caoDH;
        chan.forEach((p, j) => { const q = chan[(j + 1) % chan.length]; ln.push(p[0], y, -p[1], q[0], y, -q[1]); });
      }
      if (ln.length) {
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(new Float32Array(ln), 3));
        goc.add(new T.LineSegments(g, chon ? vienChon : M.line));
      }
      caoMax = Math.max(caoMax, z0 + h);
    });
  }

  // --- cây: tán cầu + thân, bỏ chỗ trùng chân tòa ---
  const cayO = cay.filter((p) => !chanTat.some((c) => trong(p, c)));
  if (cayO.length) {
    const tan = new T.InstancedMesh(new T.IcosahedronGeometry(2.4, 1), new T.MeshStandardMaterial({ color: trang ? 0xf0f2ef : 0x7fa36b, roughness: 0.9, flatShading: true }), cayO.length);
    const than = new T.InstancedMesh(new T.CylinderGeometry(0.18, 0.25, 3, 6), new T.MeshStandardMaterial({ color: trang ? 0xdcdcd8 : 0x8a7a63 }), cayO.length);
    const O = new T.Object3D();
    cayO.forEach((p, i) => {
      const s = 0.8 + nhieu(p[0], p[1]) * 0.6;
      O.position.set(p[0], 1.5 * s, -p[1]); O.scale.set(s, s, s); O.rotation.set(0, 0, 0); O.updateMatrix(); than.setMatrixAt(i, O.matrix);
      O.position.set(p[0], 3.6 * s, -p[1]); O.scale.set(s, s * 1.1, s); O.updateMatrix(); tan.setMatrixAt(i, O.matrix);
    });
    tan.castShadow = true; than.castShadow = true;
    goc.add(tan, than);
  }

  // --- tâm, cỡ cảnh, góc đề xuất ---
  const loCT = pa.lo.filter(laCaoTang);
  const vung = (loCT.length ? loCT : pa.lo).flatMap((l) => l.ranh);
  const xs = vung.map((p) => p[0]), ys = vung.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const coCanh = Math.max(80, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), caoMax * 1.4);
  const tam: [number, number, number] = [cx, Math.min(caoMax * 0.3, 30), -cy];
  const ds: GocDeXuat[] = [
    { ten: t('m3d.g.chimBayDN'), vt: [cx + coCanh * 0.75, coCanh * 0.75, -cy + coCanh * 1.0], dich: tam },
    { ten: t('m3d.g.chimBayTB'), vt: [cx - coCanh * 0.95, coCanh * 0.6, -cy - coCanh * 0.8], dich: tam },
    { ten: t('m3d.g.matNguoi'), vt: [cx + coCanh * 0.55, 1.7, -cy + coCanh * 0.65], dich: [cx, Math.min(caoMax * 0.55, 45), -cy], gio: 16.5 },
    { ten: t('m3d.g.tuTren'), vt: [cx, coCanh * 1.6, -cy + 0.01], dich: [cx, 0, -cy] },
  ];
  const chon = pa.toa.find((x) => x.id === toaChon && tv.toa.has(x.mauId));
  if (chon) {
    const c = chanToa(tv.toa.get(chon.mauId)!, chon), [tx, ty] = trongTam(c);
    const h = 0.2 + chon.soTangDe * chon.caoDe + chon.soTangDH * chon.caoDH, banKinh = Math.max(...c.map((p) => Math.hypot(p[0] - tx, p[1] - ty))), r = Math.max(60, h * 1.2, banKinh * 2.4);
    ds.push({ ten: t('m3d.g.toaChon'), vt: [tx + r * 0.7, h * 0.65, -ty + r * 0.9], dich: [tx, h * 0.45, -ty], gio: 15 });
  }
  return { tam, coCanh, cao: caoMax + 4, goc: ds, nen: true, nenTrongSuot: hienHam };
}
