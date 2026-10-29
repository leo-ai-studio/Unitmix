import { useEffect, useState } from 'preact/hooks';

/** Thông báo nổi của STRETCH tay (lớp phủ trên bản vẽ tầng, không chiếm chỗ khung giữa): store cấp module, tự tắt. */
export type BaoStretch = { loai: 'ok' | 'loi'; chu: string; id: number } | null;

let hienTai: BaoStretch = null;
let dem = 0;
let hen: ReturnType<typeof setTimeout> | undefined;
const nghe = new Set<() => void>();

/** `giuMs`: thời gian hiện (câu báo dài — vd. số căn đổi, căn bị gỡ — cần lâu hơn mặc định). Trả mã câu báo (để cập nhật sau). */
export function datBaoStretch(b: { loai: 'ok' | 'loi'; chu: string; giuMs?: number } | null): number {
  clearTimeout(hen);
  hienTai = b ? { loai: b.loai, chu: b.chu, id: ++dem } : null;
  nghe.forEach((f) => f());
  if (b) hen = setTimeout(() => datBaoStretch(null), b.giuMs ?? (b.loai === 'loi' ? 9000 : 4500));
  return dem;
}

/** Câu báo `id` còn đang hiện (chưa bị câu khác thay / chưa tắt). */
export const baoConHien = (id: number) => hienTai?.id === id;

export function useBaoStretch(): BaoStretch {
  const [, ve] = useState(0);
  useEffect(() => {
    const f = () => ve((n) => n + 1);
    nghe.add(f);
    return () => void nghe.delete(f);
  }, []);
  return hienTai;
}
