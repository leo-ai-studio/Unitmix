import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';

/**
 * Đưa hộp thoại ra thẳng `<body>` (portal). Hộp mở từ trong ngăn kéo đáy (panel trái / phải trên màn hẹp) nếu để tại chỗ
 * thì bị kẹt trong lớp xếp chồng của ngăn (z-index 24 < dock 26 → nút Áp / Đồng ý nằm dưới dock), bị khung cuộn của ngăn
 * cắt trên iOS Safari, và lệch theo `transform` khi đang kéo ngăn. Ngữ cảnh Preact (store, i18n) vẫn đi theo cây ảo.
 */
export function LopNoi({ children }: { children: ComponentChildren }) {
  return typeof document === 'undefined' ? <>{children}</> : createPortal(<>{children}</>, document.body);
}
