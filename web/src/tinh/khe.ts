/**
 * Khe trên dãy căn (XC-02 · QT-2/9/21/32 và XC-10 · mdi_leftover app cũ). Đo dọc từng mặt tòa giữa các phần tử có bề ngang
 * (căn đã dồn khít theo bố cục, ô thang bộ); lõi trong toa.json không có bề ngang nên không làm mốc đo.
 */
import type { ThuVien, ToaDat } from './kieu';
import { KHIT_MM, viTriCan, type ToaCoMat } from './matBang';

/** Ngưỡng XC-02 / XC-10 (quy_tac.json): khe ≤ 20 mm bỏ; ≤ 400 = tường; 400–600 = khe kỹ thuật; > căn rộng nhất + 500 = hành lang. */
export const KHE_BO_MM = 20;
export const KHE_TUONG_MM = 400;
export const KHE_KY_THUAT_MM = 600;
export const KHE_HL_THEM_MM = 500;
/** XC-10: tổng ô còn trống ≤ 200 mm coi là khít. */
export const CON_TRONG_MM = 200;

export type LoaiKhe = 'tuong' | 'ky_thuat' | 'trong' | 'hanh_lang';
export type Khe = { matIdx: number; a0: number; a1: number; rong: number; loai: LoaiKhe };

/** Phân loại một khe theo XC-02. `rongMax` = bề ngang căn rộng nhất trên mặt. */
export function loaiKhe(rong: number, rongMax: number): LoaiKhe {
  if (rong <= KHE_TUONG_MM) return 'tuong';
  if (rong <= KHE_KY_THUAT_MM) return 'ky_thuat';
  if (rong > rongMax + KHE_HL_THEM_MM) return 'hanh_lang';
  return 'trong';
}

/** Khe giữa các phần tử liền kề trên từng mặt (khe ≤ 20 mm bỏ; khe trùng chỗ lõi không tính). Phần tử chồng nhau trả `de`. */
export function kheTrenMat(mau: ToaCoMat, tv: ThuVien, bc?: Pick<ToaDat, 'canTheo' | 'canViTri'>): { khe: Khe[]; de: { matIdx: number; mm: number }[] } {
  const vts = viTriCan(mau, tv, bc);
  const khe: Khe[] = [], de: { matIdx: number; mm: number }[] = [];
  mau.mat.forEach((m, mi) => {
    const doan: [number, number][] = [
      ...vts.filter((v) => v.matIdx === mi).map((v) => [v.a0, v.a1] as [number, number]),
      ...m.phan_tu.filter((q) => q.loai !== 'can' && q.a1 - q.a0 > 1).map((q) => [q.a0, q.a1] as [number, number]),
    ].sort((a, b) => a[0] - b[0]);
    const loi = m.phan_tu.filter((q) => q.loai !== 'can' && q.a1 - q.a0 <= 1).map((q) => q.a0);
    const rongMax = Math.max(0, ...vts.filter((v) => v.matIdx === mi).map((v) => v.a1 - v.a0));
    for (let k = 1; k < doan.length; k++) {
      const a0 = doan[k - 1][1], a1 = doan[k][0], rong = a1 - a0;
      if (rong < -KHIT_MM) { de.push({ matIdx: mi, mm: -rong }); continue; }
      if (rong <= KHE_BO_MM) continue;
      if (loi.some((x) => x > a0 && x < a1)) continue; // ô chừa lõi thang máy
      khe.push({ matIdx: mi, a0, a1, rong, loai: loaiKhe(rong, rongMax) });
    }
  });
  return { khe, de };
}

/** Tổng bề rộng khe (trừ khe tường ≤ 400 mm) và số chỗ đè trên mọi mặt — để so hai mặt bằng khác vị trí (tinh/loiThang.ts). */
export function tongKhe(mau: ToaCoMat, tv: ThuVien, bc?: Pick<ToaDat, 'canTheo' | 'canViTri'>): { mm: number; de: number } {
  const k = kheTrenMat(mau, tv, bc);
  return { mm: k.khe.filter((x) => x.loai !== 'tuong').reduce((a, x) => a + x.rong, 0), de: k.de.length };
}

/** Khe mới / đè mới của bố cục so với mặt bằng gốc của mẫu tòa (bất biến "không khe, không đè" sau khi dồn khít). */
export function kiemKhit(mau: ToaCoMat, tv: ThuVien, bc: Pick<ToaDat, 'canTheo' | 'canViTri'>): { kheMoi: Khe[]; de: number } {
  const goc = kheTrenMat(mau, tv), moi = kheTrenMat(mau, tv, bc);
  const trung = (k: Khe) => goc.khe.some((g) => g.matIdx === k.matIdx && Math.abs(g.a0 - k.a0) <= KHIT_MM && Math.abs(g.a1 - k.a1) <= KHIT_MM);
  const kheMoi = moi.khe.filter((k) => !trung(k));
  return { kheMoi: kheMoi.reduce((a, k) => a + k.rong, 0) <= CON_TRONG_MM ? [] : kheMoi, de: moi.de.length - goc.de.length };
}
