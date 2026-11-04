/** Lớp hiển thị bản vẽ hầm (nhớ ở trình duyệt): mặc định GỌN — bỏ nhãn chữ và điểm lán cụt, giữ khoang cháy dạng nét mảnh + lưới cột. */
import { useEffect, useState } from 'preact/hooks';

export type LopHam = { khoang: boolean; nhan: boolean; thoat: boolean; luoi: boolean };
const KHOA = 'unitmix.lopHam.v1';
const MAC_DINH: LopHam = { khoang: true, nhan: false, thoat: false, luoi: true };
const doc = (): LopHam => {
  try { const v = JSON.parse(localStorage.getItem(KHOA) ?? '{}') as Partial<LopHam>; return { ...MAC_DINH, ...Object.fromEntries(Object.entries(v).filter(([k, x]) => k in MAC_DINH && typeof x === 'boolean')) }; } catch { return { ...MAC_DINH }; }
};
let lop: LopHam = typeof localStorage === 'undefined' ? { ...MAC_DINH } : doc();
const nghe = new Set<() => void>();
export const datLopHam = (p: Partial<LopHam>) => {
  lop = { ...lop, ...p };
  try { localStorage.setItem(KHOA, JSON.stringify(lop)); } catch { /* chặn lưu */ }
  nghe.forEach((f) => f());
};
export function useLopHam(): LopHam {
  const [, ve] = useState(0);
  useEffect(() => { const f = () => ve((n) => n + 1); nghe.add(f); return () => void nghe.delete(f); }, []);
  return lop;
}
