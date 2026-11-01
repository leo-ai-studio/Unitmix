import { useEffect, useState } from 'preact/hooks';

/**
 * Màn hẹp (điện thoại, máy tính bảng dọc / ngang): panel trái / phải thành ngăn kéo đáy, thanh trên gọn, dock nút dưới.
 * Cùng mốc với `styles/dien-thoai.css` — đổi một chỗ thì đổi cả hai.
 */
export const MAN_HEP = '(max-width: 1024px)';
/** Điện thoại nằm ngang: thấp, dock chuyển thành cột bên phải. */
export const MAN_THAP = '(max-width: 1024px) and (max-height: 520px)';

/**
 * Phần màn hình nhìn thấy thật (visualViewport) → biến CSS trên <html>: `--vv-h` cao, `--vv-y` lệch trên, `--vv-duoi` phần bị
 * che ở đáy (bàn phím ảo). iOS Safari mở bàn phím không co `100dvh` / `innerHeight`, nên hộp thoại cao 100dvh có nút chân hộp
 * nằm dưới bàn phím; hộp theo `--vv-h` thì nút luôn ở mép trên bàn phím. Che ≥ 120 px coi là bàn phím → `html.ban-phim`.
 */
export function theoDoiKhungNhin(): void {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  if (!vv) return;
  const goc = document.documentElement;
  let hen = 0;
  const cap = () => {
    hen = 0;
    if (vv.scale > 1.05) { // đang phóng bằng chụm: trả về 100dvh (hộp cố định theo khung bố cục, không theo vùng phóng)
      for (const k of ['--vv-h', '--vv-y', '--vv-duoi']) goc.style.removeProperty(k);
      goc.classList.remove('ban-phim');
      return;
    }
    const duoi = Math.max(0, Math.round(window.innerHeight - vv.offsetTop - vv.height));
    goc.style.setProperty('--vv-h', `${Math.round(vv.height)}px`);
    goc.style.setProperty('--vv-y', `${Math.round(vv.offsetTop)}px`);
    goc.style.setProperty('--vv-duoi', `${duoi}px`);
    goc.classList.toggle('ban-phim', duoi >= 120);
    if (duoi >= 120 && (window.scrollY || window.scrollX)) window.scrollTo(0, 0); // iOS cuộn trang khi focus ô nhập: kéo về 0 (hộp cố định bám theo)
  };
  const doi = () => { if (!hen) hen = requestAnimationFrame(cap); };
  cap();
  vv.addEventListener('resize', doi);
  vv.addEventListener('scroll', doi);
  // iOS: khi bàn phím mở, Safari cuộn khung nhìn SAU sự kiện resize và đôi khi không bắn `scroll` của visualViewport →
  // --vv-y cũ, hộp cố định bị đẩy lên trên. Đo lại khi cuộn cửa sổ / focus, và cứ 120 ms một lần trong lúc đang gõ.
  window.addEventListener('scroll', doi, { passive: true });
  let nhip = 0;
  const dungNhip = () => { if (nhip) { clearInterval(nhip); nhip = 0; } };
  const batNhip = () => {
    doi();
    dungNhip();
    let con = 0;
    nhip = window.setInterval(() => {
      cap();
      const dangGo = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '');
      if (!dangGo && ++con > 12) dungNhip(); // bỏ focus: đo thêm ~1,5 s cho bàn phím thu xuống rồi dừng
    }, 120);
  };
  document.addEventListener('focusin', batNhip);
  document.addEventListener('focusout', batNhip);
}

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
