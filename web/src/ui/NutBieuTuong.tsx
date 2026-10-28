import type { ComponentChildren } from 'preact';
import { t } from '../i18n/i18n';
import { BIEU_TUONG, type KhoaBieuTuong } from './bieuTuong';

type Props = {
  k: KhoaBieuTuong;
  onClick?: (e: MouseEvent) => void;
  /** Tooltip thêm sau tên (căn cứ QCVN / QT, phím tắt…). */
  ghiChu?: string;
  bat?: boolean; // nút bật / tắt (aria-pressed)
  tat?: boolean; // disabled
  children?: ComponentChildren; // số đếm nhỏ cạnh emoji, nếu cần
};

/** Nút công cụ chỉ hiện emoji: tên lấy từ i18n `bt.<k>`, nằm ở tooltip và aria-label. */
export function NutBieuTuong({ k, onClick, ghiChu, bat, tat, children }: Props) {
  const ten = t(`bt.${k}`);
  return (
    <button type="button" class="nut-bt" title={ghiChu ? `${ten} — ${ghiChu}` : ten} aria-label={ten}
      aria-pressed={bat === undefined ? undefined : bat} disabled={tat} onClick={onClick}>
      <span aria-hidden="true">{BIEU_TUONG[k]}</span>{children}
    </button>
  );
}
