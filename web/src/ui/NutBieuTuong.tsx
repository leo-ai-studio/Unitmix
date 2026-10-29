import type { ComponentChildren } from 'preact';
import { t } from '../i18n/i18n';
import { BIEU_TUONG, type KhoaBieuTuong } from './bieuTuong';
import { SVG_BT } from './bieuTuongSvg';

type Props = {
  k: KhoaBieuTuong;
  onClick?: (e: MouseEvent) => void;
  /** Tooltip thêm sau tên (căn cứ QCVN / QT, phím tắt…). */
  ghiChu?: string;
  bat?: boolean; // nút bật / tắt (aria-pressed)
  tat?: boolean; // disabled
  children?: ComponentChildren; // số đếm nhỏ cạnh biểu tượng, nếu cần
  /** Tên riêng thay `bt.<k>` khi cùng biểu tượng mà việc cụ thể khác (vd. "Chép link xem" khi máy không có mã sửa). */
  nhan?: string;
  /** Nút mở menu: aria-haspopup + aria-expanded. */
  moRong?: boolean;
  /** Lớp CSS thêm (vd. `an-dt`: ẩn trên điện thoại khi việc đó đã có chỗ khác). */
  lop?: string;
};

/** Biểu tượng nét SVG (bieuTuongSvg.ts) — chưa có hình thì dùng ký hiệu chữ ở BIEU_TUONG. */
export function BieuTuong({ k }: { k: KhoaBieuTuong }) {
  const svg = SVG_BT[k];
  if (!svg) return <span aria-hidden="true">{BIEU_TUONG[k]}</span>;
  return (
    <svg class="bt-svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor"
      stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" dangerouslySetInnerHTML={{ __html: svg }} />
  );
}

/** Nút công cụ chỉ hiện biểu tượng nét theo brand: tên lấy từ i18n `bt.<k>`, nằm ở tooltip và aria-label. */
export function NutBieuTuong({ k, onClick, ghiChu, bat, tat, children, nhan, moRong, lop }: Props) {
  const ten = nhan ?? t(`bt.${k}`);
  return (
    <button type="button" class={lop ? `nut-bt ${lop}` : 'nut-bt'} title={ghiChu ? `${ten} — ${ghiChu}` : ten} aria-label={ten}
      aria-pressed={bat === undefined ? undefined : bat} disabled={tat} onClick={onClick}
      aria-haspopup={moRong === undefined ? undefined : 'menu'} aria-expanded={moRong}>
      <BieuTuong k={k} />{children}
    </button>
  );
}
