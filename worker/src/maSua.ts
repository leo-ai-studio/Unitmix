const CHU_THUONG = 'abcdefghijklmnopqrstuvwxyz0123456789';
const CHU_DU = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Chuỗi ngẫu nhiên an toàn (crypto) từ bảng chữ cho trước. */
export function chuoiNgauNhien(dai: number, bang = CHU_THUONG): string {
  const b = crypto.getRandomValues(new Uint8Array(dai));
  return Array.from(b, (x) => bang[x % bang.length]).join('');
}

export const taoMaDuAn = () => chuoiNgauNhien(8);
export const taoMaSua = () => chuoiNgauNhien(20, CHU_DU);

/** SHA-256 dạng hex; máy chủ chỉ lưu giá trị băm của mã sửa. */
export async function bam(s: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(h), (x) => x.toString(16).padStart(2, '0')).join('');
}

/** So hai chuỗi băm cùng độ dài mà không dừng sớm. */
export function bangNhau(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
