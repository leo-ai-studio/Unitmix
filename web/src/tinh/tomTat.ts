import { tinhChiTieu } from './chiTieu';
import type { LoaiCan, ThuVien, TrangThaiPA } from './kieu';

export type TomTat = { soCan: number; coCau: Record<LoaiCan, number>; dtSan: number; danSo: number };

/** Tóm tắt PA cho danh sách phương án: tổng căn, số căn theo loại, DT sàn tính HSSDĐ (làm tròn m²). */
export function tomTatPA(pa: TrangThaiPA, tv: ThuVien): TomTat {
  const { tong } = tinhChiTieu(pa, tv);
  return { soCan: tong.soCan, coCau: tong.coCau, dtSan: Math.round(tong.dtSanTinhHSSDD), danSo: Math.round(tong.danSo) };
}
