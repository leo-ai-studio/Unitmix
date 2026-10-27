/** Lưới ô của một sheet: hàng × cột, ô trống là null. Ô gộp đã chép giá trị ô đầu sang mọi ô trong vùng gộp. */
export type O = string | number | null;
export type Luoi = O[][];
export type Sheet = { ten: string; luoi: Luoi };

/** Chữ thường, bỏ dấu tiếng Việt, gom khoảng trắng — để so tiêu đề cột không phụ thuộc cách gõ. */
export const boDau = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Số trong ô: nhận số thật và chữ số kiểu "1.234,5" / "1,234.5" / "21,6 %". Không phải số thì null. */
export function soTrongO(o: O): number | null {
  if (typeof o === 'number') return Number.isFinite(o) ? o : null;
  if (typeof o !== 'string') return null;
  let s = o.replace(/[%\s]/g, '').replace(/m2|m²/gi, '');
  if (!/^-?[\d.,]+$/.test(s)) return null;
  const phay = s.lastIndexOf(','), cham = s.lastIndexOf('.');
  if (phay > cham) s = s.replace(/\./g, '').replace(',', '.'); // kiểu Việt: 1.234,5
  else s = s.replace(/,/g, ''); // kiểu Anh: 1,234.5
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

export const chuTrongO = (o: O): string => (o === null ? '' : String(o).trim());
