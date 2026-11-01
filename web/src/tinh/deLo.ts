/**
 * KHỐI ĐẾ CỦA LÔ — một nguồn cho mọi nơi cần hình đế (chỉ tiêu, dự toán, hầm, 3D, nắng, TMB).
 * Chế độ (Lo.de.che): 'tuDong' (hợp chân tháp nở deOffset — như trước đây) · 'theoDT' (nở đều tới DTXD đế nhập tay) ·
 * 'maxQH' (nở tới MĐXD đế tối đa của QH × DT lô) · 'tay' (đế tự do, kéo / đẩy từng mặt — tinh/keoMatDe.ts).
 * Chỉ giữ phần trong chỉ giới xây dựng (trừ 'tuDong' để không đổi kết quả cũ) và luôn chứa chân tháp. Hàm thuần.
 */
import { dienTich, dtVung, giaoVung, hopVung, khoiDe } from './hinhHoc';
import { vungDat } from './hopLo';
import type { CheDoDe, Diem, Lo } from './kieu';

export const CHE_DO_DE: CheDoDe[] = ['tuDong', 'theoDT', 'maxQH', 'tay'];
/** Nở tối đa khi dò DT đế (m) — vượt chỉ giới thì bị cắt nên giá trị này chỉ cần đủ lớn cho lô thực. */
const NO_TOI_DA = 120;
const SAI_SO_M2 = 0.2;   // Clipper làm tròn mm: 1 mm nở = ~0,14 m² trên đế 140 m chu vi, mịn hơn không có nghĩa

export type KetQuaDe = {
  vung: Diem[][];
  dt: number;
  /** DT mục tiêu (m²) của chế độ theoDT / maxQH; null ở chế độ khác. */
  dtMucTieu: number | null;
  /** Nở đều đã dùng (m) — chỉ theoDT / maxQH. */
  no: number | null;
  /** nhoHonChanThap: mục tiêu nhỏ hơn DT chân tháp (đế không thể nhỏ hơn) · vuotChiGioi: mục tiêu lớn hơn phần chỉ giới chứa được · trong: chế độ tay chưa có hình. */
  ghiChu: null | 'nhoHonChanThap' | 'vuotChiGioi' | 'trong';
};

const dtLo = (lo: Lo): number => (lo.ranh.length >= 3 ? dienTich(lo.ranh) : 0);

/** MĐXD đế tối đa theo QH (m²) = % × DT lô. */
export const dtDeToiDaQH = (lo: Lo): number => (lo.temDat.chiTieu.matDoMax / 100) * dtLo(lo);

export function khoiDeLo(lo: Lo, chan: Diem[][], deOffset: number[]): KetQuaDe {
  const che = lo.de?.che ?? 'tuDong';
  const cg = [vungDat(lo)];
  const co = chan.filter((p) => p.length >= 3);
  if (che === 'tuDong' || !co.length) {
    const vung = khoiDe(chan, deOffset);
    return { vung, dt: dtVung(vung), dtMucTieu: null, no: null, ghiChu: null };
  }
  if (che === 'tay') {
    const rings = lo.de?.ranh ?? [];
    if (!rings.length) {
      const vung = giaoVung(khoiDe(chan, deOffset), cg);
      return { vung, dt: dtVung(vung), dtMucTieu: null, no: null, ghiChu: 'trong' };
    }
    const vung = giaoVung(hopVung([...rings, ...co]), cg);
    return { vung, dt: dtVung(vung), dtMucTieu: null, no: null, ghiChu: null };
  }
  // theoDT / maxQH: nở đều d, bị cắt theo chỉ giới; DT đơn điệu theo d nên chia đôi
  const mucTieu = che === 'maxQH' ? dtDeToiDaQH(lo) : Math.max(0, lo.de?.dtM2 ?? 0);
  const vungD = (d: number) => giaoVung(khoiDe(chan, chan.map(() => d)), cg);
  const f = (v: Diem[][]) => dtVung(v);
  let v0 = vungD(0), a0 = f(v0);
  if (mucTieu <= a0 + SAI_SO_M2) return { vung: v0, dt: a0, dtMucTieu: mucTieu, no: 0, ghiChu: mucTieu < a0 - 0.5 ? 'nhoHonChanThap' : null };
  const vMax = vungD(NO_TOI_DA), aMax = f(vMax);
  if (mucTieu >= aMax - SAI_SO_M2) return { vung: vMax, dt: aMax, dtMucTieu: mucTieu, no: NO_TOI_DA, ghiChu: mucTieu > aMax + 0.5 ? 'vuotChiGioi' : null };
  let lo_ = 0, hi = NO_TOI_DA, v = v0, a = a0, d = 0;
  for (let k = 0; k < 28 && Math.abs(a - mucTieu) > SAI_SO_M2; k++) {
    d = (lo_ + hi) / 2;
    v = vungD(d); a = f(v);
    if (a < mucTieu) lo_ = d; else hi = d;
  }
  return { vung: v, dt: a, dtMucTieu: mucTieu, no: d, ghiChu: null };
}

/** Chuyển đế hiện có sang chế độ 'tay' (giữ nguyên hình) để bắt đầu kéo mặt. */
export const deTuHienCo = (vung: Diem[][]): { che: 'tay'; ranh: Diem[][] } => ({ che: 'tay', ranh: vung.map((r) => r.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)] as Diem)) });
