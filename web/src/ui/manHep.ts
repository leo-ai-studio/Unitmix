import { useEffect, useState } from 'preact/hooks';

/**
 * Màn hẹp (điện thoại, máy tính bảng dọc / ngang): panel trái / phải thành ngăn kéo đáy, thanh trên gọn, dock nút dưới.
 * Cùng mốc với `styles/dien-thoai.css` — đổi một chỗ thì đổi cả hai.
 */
export const MAN_HEP = '(max-width: 1024px)';
/** Điện thoại nằm ngang: thấp, dock chuyển thành cột bên phải. */
export const MAN_THAP = '(max-width: 1024px) and (max-height: 520px)';

const khop = (q: string) => typeof matchMedia === 'function' && matchMedia(q).matches;

export function useManHep(q = MAN_HEP): boolean {
  const [co, setCo] = useState(() => khop(q));
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const m = matchMedia(q);
    const f = () => setCo(m.matches);
    f();
    m.addEventListener?.('change', f);
    return () => m.removeEventListener?.('change', f);
  }, [q]);
  return co;
}
