/**
 * Ô nhập chỉ áp dụng khi chốt: rời ô, Enter, mũi tên tăng giảm hoặc Ctrl+S. Esc huỷ phần đang gõ.
 * preact/compat đổi `onChange` của `<input>` thành `oninput`, nên ô thường tính lại và thêm một bước hoàn tác cho từng chữ số.
 * Ở đây `onChange` nhận sự kiện `change` thuần; lúc gõ, chữ nằm trong `nhap` để lần vẽ lại của cha không đè lên.
 * Giá trị bị từ chối thì ô tự về số đang lưu.
 */
import type { ComponentProps } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { useNgheChange } from './ngheChange';

type Props = Omit<ComponentProps<'input'>, 'ref'>;

export function NhapChot({ value, onChange, onInput, onKeyDown, ...khac }: Props) {
  const [nhap, setNhap] = useState<string | null>(null);
  const daChot = useRef<string | null>(null); // đã chốt tay bằng Ctrl+S: bỏ qua `change` của trình duyệt cùng giá trị khi rời ô
  const ref = useNgheChange<HTMLInputElement>((e) => {
    const el = e.currentTarget as HTMLInputElement, trung = daChot.current === el.value;
    daChot.current = null;
    if (!trung) onChange?.call(el, e as never);
    setNhap(null);
  });
  return (
    <input {...khac} ref={ref} value={nhap ?? value}
      onInput={(e) => { setNhap(e.currentTarget.value); onInput?.call(e.currentTarget, e); }}
      onKeyDown={(e) => {
        const el = e.currentTarget;
        if (nhap !== null && e.key === 'Escape') {
          e.stopPropagation();
          setNhap(null);
        } else if (nhap !== null && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          el.dispatchEvent(new Event('change'));
          daChot.current = el.value;
        }
        onKeyDown?.call(el, e);
      }} />
  );
}
