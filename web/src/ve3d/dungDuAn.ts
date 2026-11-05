/**
 * Dựng 3D toàn dự án (mét, three: X = x, Y = cao, Z = −y): ô đất tô theo loại (cỏ, mặt nước, sân lát), đường theo lộ giới cạnh lô,
 * nét hạ tầng xung quanh, khối đế + thân tháp từng tòa (vạch sàn từng tầng; kiểu Vật liệu thêm dải cửa kính theo tầng) + TẦNG TUM
 * như 3D Công trình, hầm, hộp gió, cây xanh instanced. Mỗi lớp gắn `userData.lop` (lop3d.ts) để menu "Lớp" bật / tắt tức thì.
 * Mesh / nét của tòa và lô gắn `userData.chon` để bấm chọn trong 3D; tô nhấn tòa / lô đang chọn do Khung3D làm (không dựng lại).
 */
import type * as THREE from 'three';
import { khoiDeLo } from '../tinh/deLo';
import { chanToa, trongTam } from '../tinh/hinhHoc';
import type { Diem, ThuVien, TrangThaiPA } from '../tinh/kieu';
import { laCaoTang, loaiDat, MAU_DAT, type LoaiDat } from '../tinh/loaiDat';
import { hinhDaiCua, type KieuVe3D, type T3, type VatLieu3D } from './dungCan';
import { cayDocDuong, daiDuong, dungCay, dungTrucThang, gopHinh, hinhDun, hinhTam } from './lop3d';
import { THONG_SO_CAP, type CapDo3D } from './khungVe';
import { CAO_TUM_MM } from './dungToa';
import type { DoiTuong3D, ToaTrenDe } from './chon3d';
import type { CanhDung, GocDeXuat } from './Khung3D';
import { t } from '../i18n/i18n';
import { mauToa } from '../tinh/canThem';
import { chayHet, type Tung } from './chiaNho';

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

/** Ranh tum / lõi của một tòa (m bản vẽ, đã đặt lên lô) — từ mặt bằng hiệu dụng (MoHinh3D, cần hình lõi đã nạp). */
export type TumToa = (toaId: string) => { pts: Diem[]; thang: boolean }[];
/**
 * `tach`: hầm (`dungHamDuAn`) và tầng tum + trục thang (`dungTumDuAn`) do nơi gọi dựng thành PHẦN riêng của khung (Khung3D `phan`) —
 * kết quả rải hầm (worker, về từng lô) hay hình lõi nạp xong chỉ dựng lại phần đó (vài ms) thay vì cả dự án (60–450 ms).
 */
export type TuyChonDuAn = { capDo?: CapDo3D; tumToa?: TumToa; tach?: boolean };

/** Bộ dựng hình chung (khối đùn + viền, nét) đặt vào `goc`. */
function cuaGoc(T: T3, goc: THREE.Object3D) {
  const shape = (pts: Diem[]) => { const s = new T.Shape(); pts.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]))); return s; };
  const khoi = (pts: Diem[] | Diem[][], cao: number, m: THREE.Material, z0: number, vien?: THREE.LineBasicMaterial) => {
    const ds = (Array.isArray(pts[0]?.[0]) ? pts : [pts]) as Diem[][];
    const g = new T.ExtrudeGeometry(ds.map(shape), { depth: cao, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    const me = new T.Mesh(g, m);
    me.position.y = z0; me.castShadow = true; me.receiveShadow = true;
    goc.add(me);
    if (vien) { const l = new T.LineSegments(new T.EdgesGeometry(g, 30), vien); l.position.y = z0; goc.add(l); me.userData.vien = l; }
    return me;
  };
  const duong = (pts: Diem[], y: number, m: THREE.LineBasicMaterial, kin = false) => {
    const v = pts.map((p) => new T.Vector3(p[0], y, -p[1]));
    if (kin) v.push(v[0]);
    const l = new T.Line(new T.BufferGeometry().setFromPoints(v), m);
    goc.add(l);
    return l;
  };
  return { khoi, duong };
}

/** Dựng 3D toàn dự án một lượt (đồng bộ) — test, nơi không cần chia nhỏ. */
export function dungDuAn(T: T3, goc: THREE.Group, M: VatLieu3D, kieu: KieuVe3D, pa: TrangThaiPA, tv: ThuVien, toaChon: string | null, tc: TuyChonDuAn = {}): CanhDung | null {
  return chayHet(dungDuAnTung(T, goc, M, kieu, pa, tv, toaChon, tc));
}

/**
 * Dựng 3D toàn dự án, CHIA NHỎ: `yield` sau mỗi lô / tòa / lô trồng cây — Khung3D chạy từng mẩu ~8 ms rồi nhường luồng chính
 * (điện thoại CPU 4×: một lượt dựng 48 tòa ~450 ms không còn là một tác vụ liền).
 */
export function* dungDuAnTung(T: T3, goc: THREE.Group, M: VatLieu3D, kieu: KieuVe3D, pa: TrangThaiPA, tv: ThuVien, toaChon: string | null, tc: TuyChonDuAn = {}): Tung<CanhDung | null> {
  if (!pa.lo.length) return null;
  const TS = THONG_SO_CAP[tc.capDo ?? 'cao'];
  const trang = kieu === 'trang', vatLieu = kieu === 'vatlieu';
  const { khoi, duong } = cuaGoc(T, goc);
  /** Gắn đối tượng chọn được vào mesh (và nét viền của nó). */
  const gan = (o: THREE.Object3D | undefined, d: DoiTuong3D) => { if (!o) return; o.userData.chon = d; const v = o.userData.vien as THREE.Object3D | undefined; if (v) v.userData.chon = d; };

  // --- ô đất ---
  const matDat = new Map<LoaiDat, THREE.MeshStandardMaterial>();
  const vlDat = (l: LoaiDat) => {
    let m = matDat.get(l);
    if (!m) {
      // Vật liệu: lô cao tầng sân lát đá be sáng, cây xanh cỏ, mặt nước xanh lam sẫm phản chiếu trời; nền khung ngà (#F1F0EA)
      const VL_DAT: Partial<Record<LoaiDat, string>> = { o_cao_tang: '#ece6d7', cay_xanh: '#93ab74', mat_nuoc: '#4f7d8a', ha_tang: '#b9b8b1' };
      // Mô hình trắng: chỉ KHỐI NHÀ trắng; ô đất, mặt nước, cây giữ màu như kiểu Brand để đọc được quy hoạch (nền không trắng)
      const mau = vatLieu ? VL_DAT[l] ?? MAU_DAT[l][0] : MAU_DAT[l][0];
      m = new T.MeshStandardMaterial({ color: mau, roughness: l === 'mat_nuoc' ? (vatLieu ? 0.05 : 0.15) : 0.95, metalness: l === 'mat_nuoc' ? 0.1 : 0, envMapIntensity: l === 'mat_nuoc' ? (vatLieu ? 1.4 : 1) : 0.5 });
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
  for (const d of pa.lo.flatMap((l) => l.xungQuanh)) if (d.length >= 2) duong(d, 0.02, netXq).userData.lop = 'duong';
  const cay: Diem[] = [], cayDuong: Diem[] = [], hinhDuong: THREE.BufferGeometry[] = [];
  let stt = 0;
  for (const l of pa.lo) {
    if (l.ranh.length < 3) continue;
    const loai = loaiDat(l);
    const meLo = loai === 'mat_nuoc' ? khoi(l.ranh, 0.05, vlDat(loai), -0.35)
      // ô đất không cao tầng: mỗi ô một độ cao hơi khác nhau (0,06 … 0,116 m) để hai ô chồng nhau trong bản vẽ không cùng mặt phẳng → hết nhấp nháy (z-fighting)
      : khoi(l.ranh, loai === 'o_cao_tang' ? 0.2 : 0.06 + (stt++ % 8) * 0.008, vlDat(loai), 0);
    if (loai === 'cay_xanh') cay.push(...diemCay(l.ranh, 9, 600));
    // đường theo lộ giới từng cạnh (LO-01): dải nhựa ngoài lô + cây trên vỉa hè
    const dd = daiDuong(l.ranh, l.canhDuong);
    dd.forEach((d) => hinhDuong.push(hinhTam(T, d.poly, 0.03)));
    cayDuong.push(...cayDocDuong(dd));
    if (laCaoTang(l)) {
      const dLo: DoiTuong3D = { loai: 'lo', id: l.id };
      gan(meLo, dLo);
      // bật lớp Hầm: lô bán trong suốt để nhìn xuyên xuống khối hầm (đổi vật liệu, không dựng lại)
      meLo.userData.vlTheoLop = { lop: 'ham', vl: vlDatTrong(loai), vlThuong: meLo.material };
      const r = duong(l.ranh, 0.25, netLo, true); r.userData.chon = dLo; r.userData.lop = 'ranh';
      if (l.chiGioi) duong(l.chiGioi, 0.24, netCg, true).userData.lop = 'ranh';
    }
    yield;
  }
  const gDuong = gopHinh(T, hinhDuong);
  if (gDuong) {
    const me = new T.Mesh(gDuong, new T.MeshStandardMaterial({ color: vatLieu ? 0x8b8c88 : 0xd9dbd6, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
    me.receiveShadow = true; me.userData.lop = 'duong';
    goc.add(me);
  }


  // --- tòa: khối đế theo lô + thân tháp, vạch sàn (tô nhấn tòa chọn / rê chuột: Khung3D đổi vật liệu theo userData.chon) ---
  let caoMax = 0;
  const chanTat: Diem[][] = [], deTat: Diem[][] = [];
  for (const l of pa.lo) {
    const ts = pa.toa.filter((x) => x.loId === l.id && tv.toa.has(x.mauId));
    if (!ts.length) continue;
    const chans = ts.map((x) => chanToa(mauToa(tv, x)!, x));
    chanTat.push(...chans);
    const hDe = Math.max(0, ...ts.map((x) => x.soTangDe * x.caoDe));
    if (hDe > 0) {
      const de = khoiDeLo(l, chans, ts.map((x) => x.deOffset)).vung.filter((p) => p.length >= 3);
      // khối đế chọn được: bấm phần đế → tòa đứng trên phần đế đó (gần điểm chạm nhất), tô cùng tòa đang chọn / rê
      const dDe: DoiTuong3D = { loai: 'de', id: l.id, toaIds: ts.map((x) => x.id) };
      const deToa: ToaTrenDe[] = ts.map((x, i) => ({ id: x.id, loId: l.id, chan: chans[i] }));
      for (const p of de) { const me = khoi(p, hDe, M.de, 0.2, M.line); gan(me, dDe); me.userData.deToa = deToa; deTat.push(p); }
    }
    for (let i = 0; i < ts.length; i++) {
      const x = ts[i], chan = chans[i], z0 = 0.2 + x.soTangDe * x.caoDe, h = x.soTangDH * x.caoDH, dT: DoiTuong3D = { loai: 'toa', id: x.id, loId: l.id };
      gan(khoi(chan, h, M.tuong, z0, M.line), dT);
      if (vatLieu && x.soTangDH > 0) { // dải cửa kính theo tầng (nhìn xa)
        const g = hinhDaiCua(T, chan as [number, number][], z0, x.caoDH, x.soTangDH, 0.75, Math.min(1.75, x.caoDH - 0.95));
        if (g) { const me = new T.Mesh(g, M.kinhDai); me.receiveShadow = true; goc.add(me); gan(me, dT); }
      }
      const ln: number[] = [];
      for (let k = 1; k < x.soTangDH; k++) {
        const y = z0 + k * x.caoDH;
        chan.forEach((p, j) => { const q = chan[(j + 1) % chan.length]; ln.push(p[0], y, -p[1], q[0], y, -q[1]); });
      }
      if (ln.length) {
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(new Float32Array(ln), 3));
        const vs = new T.LineSegments(g, M.line);
        vs.userData.chon = dT;
        goc.add(vs);
      }
      // tầng tum (dungTumDuAn): tách thành phần riêng thì chưa biết có tum — chừa sẵn chiều cao tum cho cỡ cảnh / mặt cắt
      const coTum = tc.tach ? !!tc.tumToa : !!tc.tumToa?.(x.id)?.length;
      caoMax = Math.max(caoMax, z0 + h + (coTum ? CAO_TUM_MM / 1000 + SAN_TUM : 0));
      yield;
    }
  }
  if (!tc.tach && tc.tumToa) yield* dungTumDuAn(T, goc, M, pa, tv, tc.tumToa);

  // --- cây: cây xanh trên lô CX, cây dọc đường (vỉa hè), cây sân trong lô cao tầng (ngoài chân tòa / đế, cách ≥ 4 m); trần theo bậc thiết bị ---
  const tranh = [...chanTat, ...deTat];
  const caySan: Diem[] = [];
  // Không trồng cây trong lô cao tầng (lọt vào đế / hầm / sân kỹ thuật): cây chỉ ở lô CX và dọc đường.
  // bỏ cây rơi vào chân tòa / đế: thử khung bao trước (cùng kết quả, đỡ thử mọi đa giác cho từng cây)
  const baoTranh = tranh.map((c) => { const xs = c.map((p) => p[0]), ys = c.map((p) => p[1]); return { c, a: Math.min(...xs), b: Math.max(...xs), d: Math.min(...ys), e: Math.max(...ys) }; });
  const cayO = [...cay, ...cayDuong, ...caySan].filter((p) => !baoTranh.some((q) => p[0] >= q.a && p[0] <= q.b && p[1] >= q.d && p[1] <= q.e && trong(p, q.c))).slice(0, TS.cayToiDa);
  dungCay(T, goc, cayO, kieu, TS.cayBong, 0.2);

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
    const c = chanToa(mauToa(tv, chon)!, chon), [tx, ty] = trongTam(c);
    const h = 0.2 + chon.soTangDe * chon.caoDe + chon.soTangDH * chon.caoDH, banKinh = Math.max(...c.map((p) => Math.hypot(p[0] - tx, p[1] - ty))), r = Math.max(60, h * 1.2, banKinh * 2.4);
    ds.push({ ten: t('m3d.g.toaChon'), vt: [tx + r * 0.7, h * 0.65, -ty + r * 0.9], dich: [tx, h * 0.45, -ty], gio: 15 });
  }
  // lô chọn / rê: lớp phủ xanh mỏng trên mặt lô + viền (Khung3D · hinhNhan) — lô bán trong suốt khi bật hầm nên pha màu vật liệu gần như không thấy
  const ranhLo = new Map(pa.lo.filter((l) => laCaoTang(l) && l.ranh.length >= 3).map((l) => [l.id, l.ranh]));
  return {
    tam, coCanh, cao: caoMax + 4, goc: ds, nen: true, nenLop: 'ham',
    hinhNhan: (d) => (d.loai === 'lo' && ranhLo.has(d.id) ? { chan: ranhLo.get(d.id)! as [number, number][], y0: 0.21, y1: 0.36 } : null),
    doiTuongChon: (c) => (!c.toaId && c.loId && ranhLo.has(c.loId) ? { loai: 'lo', id: c.loId } : null),
  };
}


const SAN_TUM = 0.13;
/** Tầng tum mọi tòa (buồng thang / lõi nhô lên mái, cao 3 m + sàn mái tum) như 3D Công trình — gộp cả dự án; trục thang / lõi xuyên tòa. */
export function* dungTumDuAn(T: T3, goc: THREE.Object3D, M: VatLieu3D, pa: TrangThaiPA, tv: ThuVien, tumToa: TumToa): Tung<void> {
  const hinhTum: THREE.BufferGeometry[] = [], hinhSanTum: THREE.BufferGeometry[] = [], trucThang: { pts: Diem[]; thang: boolean; y0: number; y1: number }[] = [];
  const cTum = CAO_TUM_MM / 1000, san = SAN_TUM;
  for (const l of pa.lo) for (const x of pa.toa) {
    if (x.loId !== l.id || !tv.toa.has(x.mauId)) continue;
    const z0 = 0.2 + x.soTangDe * x.caoDe, h = x.soTangDH * x.caoDH;
    for (const r of tumToa(x.id)) {
      if (r.pts.length < 3) continue;
      hinhTum.push(hinhDun(T, r.pts, z0 + h, cTum));
      hinhSanTum.push(hinhDun(T, r.pts, z0 + h + cTum, san));
      trucThang.push({ pts: r.pts, thang: r.thang, y0: 0.2, y1: z0 + h + cTum + san });
    }
    yield;
  }
  // tầng tum gộp (1 mesh tường tum + 1 sàn mái tum + viền), trục thang / lõi (ẩn mặc định)
  const gTum = gopHinh(T, hinhTum), gSanTum = gopHinh(T, hinhSanTum);
  if (gTum) {
    const me = new T.Mesh(gTum, M.tum); me.castShadow = true; me.receiveShadow = true; me.userData.lop = 'tum';
    const l = new T.LineSegments(new T.EdgesGeometry(gTum, 30), M.line); l.userData.lop = 'tum';
    goc.add(me, l);
  }
  if (gSanTum) { const me = new T.Mesh(gSanTum, M.san); me.castShadow = true; me.receiveShadow = true; me.userData.lop = 'tum'; goc.add(me); }
  yield;
  dungTrucThang(T, goc, trucThang);
}
