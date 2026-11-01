/**
 * Thẻ thông số lô đang chọn trên bản vẽ TMB: bấm vào lô → thấy ngay ký hiệu, chức năng, diện tích và chỉ tiêu quy hoạch tối đa
 * (MĐXD · HSSDĐ · tầng cao · dân số). Hàm thuần — giao diện (ManXepToa) chỉ định dạng chữ.
 */
import { dienTich } from '../tinh/hinhHoc';
import type { Lo } from '../tinh/kieu';

export type MoTaLo = { kyHieu: string; chucNang: Lo['temDat']['chucNang']; dtM2: number; mdxdMax: number; hssddMax: number; tangCaoMax: number; danSoMax: number };

export function moTaLo(lo: Lo): MoTaLo {
  const c = lo.temDat.chiTieu;
  return {
    kyHieu: lo.temDat.kyHieu,
    chucNang: lo.temDat.chucNang,
    dtM2: lo.ranh.length >= 3 ? dienTich(lo.ranh) : 0,
    mdxdMax: c.matDoMax,
    hssddMax: c.hssddMax,
    tangCaoMax: c.tangCaoMax,
    danSoMax: c.danSoMax,
  };
}
