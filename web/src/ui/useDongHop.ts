import { useEffect, useRef, useState } from 'preact/hooks';
import { giamChuyenDong } from './chuyenDong';

const MS_DONG = 160;

/** Hộp thoại: Esc để đóng; đóng thì chạy hiệu ứng ngược (class `dang-dong`) rồi mới gọi `dong` để gỡ khỏi DOM. */
export function useDongHop(dong: () => void) {
  const [dangDong, setDangDong] = useState(false);
  const goi = useRef(dong);
  goi.current = dong;
  const hen = useRef(0);
  const dongMem = () => {
    if (hen.current) return;
    if (giamChuyenDong()) return goi.current();
    setDangDong(true);
    hen.current = window.setTimeout(() => goi.current(), MS_DONG);
  };
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') dongMem(); };
    window.addEventListener('keydown', f);
    return () => { window.removeEventListener('keydown', f); clearTimeout(hen.current); };
  }, []);
  return { lop: dangDong ? ' dang-dong' : '', dongMem };
}
