/**
 * Lớp PHÂN TÍCH VIEW trên 3D: lưới ô mặt ngoài (dải tầng × mặt căn) tô theo điểm view liên tục (tinh/mauView.ts). Hình gộp MỖI TÒA
 * MỘT BufferGeometry có màu đỉnh (không mỗi ô một mesh) — ~1 draw call / tòa; ô lùi khỏi mép 0,2 m nên khe giữa các ô thành lưới mảnh
 * bằng màu tường (đã làm nhạt). Toạ độ: mặt bằng (x, y) mét → three (x, cao, −y), như dungDuAn / dungToa.
 */
import type * as THREE from 'three';
import type { DiemViewCan } from '../tinh/huongView';
import type { Diem } from '../tinh/kieu';
import { mauView } from '../tinh/mauView';
import type { T3 } from './dungCan';

/** Một ô: mặt ngoài A→B (m), pháp tuyến n (đơn vị, mặt bằng), cao độ đáy / đỉnh (m), điểm, căn + dải tầng. */
export type OView = { toaId: string; A: Diem; B: Diem; n: Diem; y0: number; y1: number; v: number; d: DiemViewCan; bang: number; tu: number; den: number };
export type HinhView3D = {
  /** Mỗi tòa một hình: ô thứ k của hình = ô `dau + k` của `o`. */
  hinh: { toaId: string; g: THREE.BufferGeometry; dau: number }[];
  o: OView[];
  /** Tô lại theo bộ lọc khoảng điểm (null = mọi ô). Ô ngoài khoảng: xám nhạt. */
  loc: (k: [number, number] | null) => void;
  /** 4 góc ô i (three) — viền ô đang rê. */
  goc: (i: number) => [number, number, number][];
  /** Tâm ô i (three). */
  tam: (i: number) => [number, number, number];
};

const LIN = new Float32Array(256).map((_, i) => { const s = i / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
/** Hướng sáng nền (mặt bằng) để mặt tòa có chút khối: mặt quay về hướng này sáng hơn tới 7 %. */
const SANG: Diem = [0.45, 0.89];
const XAM: [number, number, number] = [216, 215, 208];
const KHE = 0.14, NHO = 0.3;

export function dungHinhView(T: T3, ds: OView[]): HinhView3D {
  const theoToa = new Map<string, OView[]>();
  for (const o of ds) { const a = theoToa.get(o.toaId); if (a) a.push(o); else theoToa.set(o.toaId, [o]); }
  const o: OView[] = [];
  const hinh: HinhView3D['hinh'] = [];
  const goc = new Float32Array(ds.length * 12);
  for (const [toaId, os] of theoToa) {
    const dau = o.length, n = os.length;
    const P = new Float32Array(n * 12), C = new Float32Array(n * 12), I = new Uint32Array(n * 6);
    os.forEach((c, k) => {
      const dx = c.B[0] - c.A[0], dy = c.B[1] - c.A[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      const kh = Math.min(KHE, L * 0.05), kv = Math.min(0.08, (c.y1 - c.y0) * 0.04);
      const ax = c.A[0] + ux * kh + c.n[0] * NHO, ay = c.A[1] + uy * kh + c.n[1] * NHO;
      const bx = c.B[0] - ux * kh + c.n[0] * NHO, by = c.B[1] - uy * kh + c.n[1] * NHO;
      const y0 = c.y0 + kv, y1 = c.y1 - kv;
      const v = [ax, y0, -ay, bx, y0, -by, bx, y1, -by, ax, y1, -ay];
      P.set(v, k * 12); goc.set(v, (dau + k) * 12);
      const b = k * 4;
      I.set([b, b + 1, b + 2, b, b + 2, b + 3], k * 6);
      o.push(c);
    });
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(P, 3));
    g.setAttribute('color', new T.BufferAttribute(C, 3));
    g.setIndex(new T.BufferAttribute(I, 1));
    g.computeBoundingSphere();
    hinh.push({ toaId, g, dau });
  }
  const loc = (khoang: [number, number] | null) => {
    for (const h of hinh) {
      const a = h.g.getAttribute('color') as THREE.BufferAttribute, C = a.array as Float32Array, n = C.length / 12;
      for (let k = 0; k < n; k++) {
        const c = o[h.dau + k];
        const ngoai = khoang && (c.v < khoang[0] - 1e-9 || c.v > khoang[1] + 1e-9);
        const rgb = ngoai ? XAM : mauView(c.v);
        const s = ngoai ? 1 : 0.93 + 0.07 * Math.max(0, c.n[0] * SANG[0] + c.n[1] * SANG[1]);
        const r = LIN[rgb[0]] * s, gg = LIN[rgb[1]] * s, bb = LIN[rgb[2]] * s;
        for (let j = 0; j < 4; j++) { C[k * 12 + j * 3] = r; C[k * 12 + j * 3 + 1] = gg; C[k * 12 + j * 3 + 2] = bb; }
      }
      a.needsUpdate = true;
    }
  };
  loc(null);
  const g4 = (i: number): [number, number, number][] => [0, 1, 2, 3].map((j) => [goc[i * 12 + j * 3], goc[i * 12 + j * 3 + 1], goc[i * 12 + j * 3 + 2]]);
  return {
    hinh, o, loc, goc: g4,
    tam: (i) => { const q = g4(i); return [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2, (q[0][2] + q[2][2]) / 2]; },
  };
}

/**
 * Ô của cả dự án (3D Toàn dự án) từ kết quả view theo dải tầng: mặt căn A–B ở hệ lô; tầng điển hình bắt đầu ở cốt
 * `z0(toa)` (m) và cao `caoDH` mỗi tầng. Căn thiếu dải (tòa không chấm) thì bỏ.
 */
export function oDuAn(can: DiemViewCan[], daiTang: Map<string, { tu: number[]; den: number[] }>, toa: Map<string, { z0: number; caoDH: number }>): OView[] {
  const kq: OView[] = [];
  for (const d of can) {
    const dt = daiTang.get(d.toaId), x = toa.get(d.toaId);
    if (!dt || !x || !d.bang) continue;
    for (let i = 0; i < dt.tu.length; i++) {
      kq.push({ toaId: d.toaId, A: d.A, B: d.B, n: d.n, y0: x.z0 + (dt.tu[i] - 1) * x.caoDH, y1: x.z0 + dt.den[i] * x.caoDH, v: d.bang.tong[i], d, bang: i, tu: dt.tu[i], den: dt.den[i] });
    }
  }
  return kq;
}
