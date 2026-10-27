import { useEffect, useState } from 'preact/hooks';

/** Thông báo nổi của STRETCH tay (lớp phủ trên bản vẽ tầng, không chiếm chỗ khung giữa): store cấp module, tự tắt. */
export type BaoStretch = { loai: 'ok' | 'loi'; chu: string; id: number } | null;

let hienTai: BaoStretch = null;
let dem = 0;
let hen: ReturnType<typeof setTimeout> | undefined;
const nghe = new Set<() => void>();

export function datBaoStretch(b: { loai: 'ok' | 'loi'; chu: string } | null): void {
  clearTimeout(hen);
  hienTai = b ? { ...b, id: ++dem } : null;
  nghe.forEach((f) => f());
  if (b) hen = setTimeout(() => datBaoStretch(null), b.loai === 'loi' ? 9000 : 4500);
}

export function useBaoStretch(): BaoStretch {
  const [, ve] = useState(0);
  useEffect(() => {
    const f = () => ve((n) => n + 1);
    nghe.add(f);
    return () => void nghe.delete(f);
  }, []);
  return hienTai;
}
