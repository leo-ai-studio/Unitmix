/**
 * Đăng ký service worker (dist/sw.js, sinh từ web/pwa/sw.js lúc build). Chỉ bản build; dev (vite) không đăng ký.
 * Đợi trang tải xong + 1,5 s: lượt cài SW tải trước ~2 MB tệp tĩnh, không được giành mạng / CPU với lần mở đầu.
 * Bản mới: SW tự kích hoạt (skipWaiting); trang đang mở không tự tải lại (đang sửa dở), lần mở sau dùng bản mới.
 */
export function dangKySW(): void {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const chay = () => { navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => { /* không có SW vẫn chạy bình thường */ }); };
  const hoan = () => setTimeout(chay, 1500);
  if (document.readyState === 'complete') hoan();
  else addEventListener('load', hoan, { once: true });
}
