/**
 * Loại hình nhà ở của lô (đề bài kinh doanh, lọc lô): thương mại · xã hội · tái định cư. Chức năng lô chỉ có 'tm' | 'xh' | 'khac' vì thư
 * viện mẫu chỉ có hai nhóm; tái định cư dùng nhóm mẫu 'xh' (Long Biên: L-3 TĐC, Z-2 TĐC cùng dải diện tích NOXH) và đánh dấu riêng
 * `TemDat.taiDinhCu`. Thiếu dấu thì nhận theo ký hiệu lô (TDC-7.1, TĐC-8.2…).
 */
import type { ChucNang, Lo } from './kieu';

export type LoaiNhaO = 'tm' | 'xh' | 'tdc';
export const DS_LOAI_NHA: LoaiNhaO[] = ['tm', 'xh', 'tdc'];

const KY_HIEU_TDC = /^\s*T[ĐD]C/i;

/** Loại nhà ở của lô; lô không phải đất ở → null. */
export function loaiNhaCuaLo(lo: Lo): LoaiNhaO | null {
  const { chucNang, taiDinhCu, kyHieu } = lo.temDat;
  if (chucNang === 'khac') return null;
  return taiDinhCu ?? KY_HIEU_TDC.test(kyHieu) ? 'tdc' : chucNang;
}

/** Trường cần ghi vào tem đất khi đổi loại lô (ô chọn ở panel lô). */
export function temTheoLoai(v: LoaiNhaO | 'khac'): { chucNang: ChucNang; taiDinhCu: boolean } {
  return { chucNang: v === 'tdc' ? 'xh' : v, taiDinhCu: v === 'tdc' };
}

const boDau = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

/** Nhận loại nhà ở trong tên sheet / tên tệp; không nhận ra thì null. */
export function loaiTrongTen(s: string): LoaiNhaO | null {
  const c = boDau(s);
  if (/\btdc\b|tai\s*dinh\s*cu/.test(c)) return 'tdc';
  if (/\bnoxh\b|\bxh\b|xa\s*hoi/.test(c)) return 'xh';
  if (/\bnotm\b|\btm\b|thuong\s*mai/.test(c)) return 'tm';
  return null;
}

/** Trong các sheet đọc được loại căn: ưu tiên sheet ghi đúng loại `l`, sau đó sheet không ghi loại nào, cuối cùng sheet đầu. */
export function chonSheetTheoLoai<T extends { ten: string }>(ds: T[], coDong: (s: T) => boolean, l: LoaiNhaO): T | undefined {
  const co = ds.filter(coDong);
  return co.find((s) => loaiTrongTen(s.ten) === l) ?? co.find((s) => loaiTrongTen(s.ten) === null) ?? co[0] ?? ds[0];
}
