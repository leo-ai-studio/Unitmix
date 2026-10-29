import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { BieuTuong } from './NutBieuTuong';
import type { KhoaBieuTuong } from './bieuTuong';

type Props = {
  k: KhoaBieuTuong;
  /** Tên nút (tooltip + aria-label). */
  nhan: string;
  /** Chữ ngắn cạnh biểu tượng (vd. tên kiểu đang chọn); bỏ trống = chỉ biểu tượng. */
  chu?: ComponentChildren;
  /** Nút đang ở trạng thái bật (vd. có lớp phân tích trong menu đang bật). */
  bat?: boolean;
  /** Bấm một mục `[role=menuitem]` / `[role=menuitemradio]` thì đóng menu (mặc định có). Ô tích, thanh trượt giữ menu mở. */
  dongKhiChon?: boolean;
  lop?: string;
  children: ComponentChildren | ((dong: () => void) => ComponentChildren);
};

/**
 * Nút biểu tượng mở bảng nổi (menu / popover) kiểu Forma: bảng `position: fixed` dưới nút — không bị thanh cuộn ngang cắt, không đẩy
 * khung giữa (quy tắc 1 AI_START). Esc / bấm ngoài / đổi bề ngang cửa sổ thì đóng; mở bằng bàn phím thì focus mục đầu.
 */
export function MenuNut({ k, nhan, chu, bat, dongKhiChon = true, lop = '', children }: Props) {
  const [mo, setMo] = useState(false);
  const nut = useRef<HTMLButtonElement>(null);
  const bang = useRef<HTMLDivElement>(null);
  const [vt, setVt] = useState<{ top: number; left: number } | null>(null);
  const dong = () => setMo(false);
  useEffect(() => {
    if (!mo) return;
    const w0 = window.innerWidth;
    const doi = () => { if (window.innerWidth !== w0) setMo(false); };
    const phim = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMo(false); nut.current?.focus(); } };
    const ngoai = (e: Event) => { const x = e.target as Node; if (!bang.current?.contains(x) && !nut.current?.contains(x)) setMo(false); };
    document.addEventListener('keydown', phim);
    document.addEventListener('pointerdown', ngoai);
    window.addEventListener('resize', doi);
    return () => { document.removeEventListener('keydown', phim); document.removeEventListener('pointerdown', ngoai); window.removeEventListener('resize', doi); };
  }, [mo]);
  // đặt bảng dưới nút, không tràn mép phải / trái màn hình
  useLayoutEffect(() => {
    if (!mo) { setVt(null); return; }
    const b = nut.current?.getBoundingClientRect(), el = bang.current;
    if (!b || !el) return;
    setVt({ top: b.bottom + 4, left: Math.max(4, Math.min(b.left, window.innerWidth - el.offsetWidth - 4)) });
  }, [mo]);
  return (
    <>
      <button type="button" ref={nut} class={`nut-bt${chu ? ' co-chu' : ''}`} title={nhan} aria-label={nhan} aria-haspopup="menu" aria-expanded={mo}
        aria-pressed={bat === undefined ? undefined : bat} onClick={() => setMo(!mo)}>
        <BieuTuong k={k} />{chu && <span class="nut-bt-chu">{chu}</span>}<span class="mui-menu" aria-hidden="true">▾</span>
      </button>
      {mo && (
        <div ref={bang} class={`menu-nut-bang ${lop}`} role="menu" aria-label={nhan}
          style={{ top: `${vt?.top ?? -9999}px`, left: `${vt?.left ?? -9999}px`, maxHeight: vt ? `calc(var(--vv-h, 100dvh) - ${Math.round(vt.top) + 8}px)` : undefined }}
          onClick={(e) => { if (dongKhiChon && (e.target as Element).closest?.('[role=menuitem], [role=menuitemradio]')) setMo(false); }}>
          {typeof children === 'function' ? children(dong) : children}
        </div>
      )}
    </>
  );
}
