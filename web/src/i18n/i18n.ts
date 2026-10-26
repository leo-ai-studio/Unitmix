import { useEffect, useState } from 'preact/hooks';
import vi from './vi.json';
import en from './en.json';

export type Lang = 'vi' | 'en';
const BANG: Record<Lang, Record<string, string>> = { vi, en };
const KHOA = 'unitmix.lang';

function docLang(): Lang {
  try {
    return localStorage.getItem(KHOA) === 'en' ? 'en' : 'vi';
  } catch {
    return 'vi';
  }
}

let hienTai: Lang = typeof localStorage === 'undefined' ? 'vi' : docLang();
const nghe = new Set<(l: Lang) => void>();

export const langHienTai = (): Lang => hienTai;

export function datLang(l: Lang): void {
  hienTai = l;
  try {
    localStorage.setItem(KHOA, l);
  } catch {
    /* trình duyệt chặn lưu: vẫn đổi trong phiên */
  }
  document.documentElement.lang = l;
  nghe.forEach((f) => f(l));
}

/** Chuỗi giao diện; thiếu khoá thì trả chính khoá để dễ thấy khi kiểm. */
export const t = (khoa: string): string => BANG[hienTai][khoa] ?? khoa;

export function useLang(): [Lang, (l: Lang) => void] {
  const [l, setL] = useState(hienTai);
  useEffect(() => {
    nghe.add(setL);
    return () => void nghe.delete(setL);
  }, []);
  return [l, datLang];
}
