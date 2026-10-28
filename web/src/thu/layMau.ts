/**
 * Chế độ kiểm nhanh cho test (như `--nhanh` của app cũ `chay_pha_hoai.js`): `KIEM_NHANH=1` thì bài quét nặng lấy mẫu 1/k ca,
 * lệch theo ngày để qua nhiều lần kiểm mọi ca đều được chạm. Bản đủ ca (không cờ) chạy trước khi gộp main.
 */
export const NHANH = typeof process !== 'undefined' && process.env.KIEM_NHANH === '1';

/** Đủ ca thì trả nguyên danh sách; kiểm nhanh thì lấy 1/k phần tử (ít nhất 1). */
export function layMau<T>(ds: readonly T[], k = 4): T[] {
  if (!NHANH || ds.length <= 1) return [...ds];
  const lech = new Date().getDate() % k;
  const ra = ds.filter((_, i) => i % k === lech);
  return ra.length ? ra : [ds[0]];
}
