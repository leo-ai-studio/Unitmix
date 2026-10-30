/**
 * Nghe sự kiện `change` THUẦN của một ô (ref callback ổn định). preact/compat (có trong gói) đổi `onChange` của `<input>` (trừ checkbox / radio /
 * file) thành `oninput` — nên `change` phát riêng (đặt giá trị bằng mã, công cụ hỗ trợ, kiểm tự động) không tới app. Dùng kèm `onInput`.
 */
import { useMemo, useRef } from 'preact/hooks';

export function useNgheChange<T extends HTMLElement = HTMLInputElement>(fn: (e: Event) => void): (el: T | null) => void {
  const f = useRef(fn);
  f.current = fn;
  return useMemo(() => {
    let el: T | null = null;
    const h = (e: Event) => f.current(e);
    return (n: T | null) => {
      if (n === el) return;
      el?.removeEventListener('change', h);
      el = n;
      el?.addEventListener('change', h);
    };
  }, []);
}
