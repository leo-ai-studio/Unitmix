/** Phân loại ô đất quy hoạch để tô màu TMB / 3D: nhà ở cao tầng là đối tượng làm việc, các loại khác chỉ làm nền. */
import type { Lo } from './kieu';

export type LoaiDat = 'o_cao_tang' | 'cay_xanh' | 'mat_nuoc' | 'giao_duc' | 'cong_cong' | 'hon_hop' | 'ha_tang' | 'khac';

/** Tiền tố ký hiệu lô thường gặp trong bảng QH Việt Nam. "MN" hiểu là mặt nước (mầm non thường ghi NT). */
const THEO_TIEN_TO: [RegExp, LoaiDat][] = [
  [/^(CX|CV|CXDT|CXĐT|CXDV|CXCC|CXN|VCX)/, 'cay_xanh'],
  [/^(MN|MAT\s*NUOC|HO|SONG|KENH|NUOC)/, 'mat_nuoc'],
  [/^(GD|NT|TH|THCS|THPT|TR|MG)/, 'giao_duc'],
  [/^(HH|TMDV|TM-?DV)/, 'hon_hop'],
  [/^(HT|HTKT|BX|P\d|DX|GT|TBA|XL|KT)/, 'ha_tang'],
  [/^(TT|DV|VH|YT|CC|CQ|TDTT|TD|TG|DVCC|CCDT|CCĐT)/, 'cong_cong'],
];

export function loaiDat(lo: Pick<Lo, 'temDat'>): LoaiDat {
  if (lo.temDat.chucNang === 'tm' || lo.temDat.chucNang === 'xh') return 'o_cao_tang';
  const k = lo.temDat.kyHieu.trim().toUpperCase().normalize('NFC');
  return THEO_TIEN_TO.find(([re]) => re.test(k))?.[1] ?? 'khac';
}

/** Lô làm việc được trên TMB (đặt tòa, xếp căn). */
export const laCaoTang = (lo: Pick<Lo, 'temDat'>): boolean => loaiDat(lo) === 'o_cao_tang';

/** Màu nền theo loại đất, hài hoà bảng màu LEO (xanh rêu / kem). [nền, viền] */
export const MAU_DAT: Record<LoaiDat, [string, string]> = {
  o_cao_tang: ['#e5eeea', '#174f52'],
  cay_xanh: ['#cfe3c2', '#7fa36b'],
  mat_nuoc: ['#bfdbe6', '#6e9fb3'],
  giao_duc: ['#f1e3c8', '#c7aa76'],
  cong_cong: ['#ece4d8', '#b8b0a3'],
  hon_hop: ['#e8dfe6', '#a89aa6'],
  ha_tang: ['#e3e4e0', '#a3a9a4'],
  khac: ['#f3f2ec', '#c9ccc4'],
};
