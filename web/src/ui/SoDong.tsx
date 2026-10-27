import { useEffect, useRef, useState } from 'preact/hooks';
import { useLang, type Lang } from '../i18n/i18n';
import { chayRaf, easeOutCubic, giamChuyenDong, tron } from './chuyenDong';
import { fmtSo, type TuyChonSo } from './so';

const MS_CHAY = 280, MS_GIU = 120;

/** Chữ hiển thị của một số: ô trống / không hữu hạn luôn là "—" (cùng quy ước fmtSo). */
export const chuSo = (v: number | null | undefined, opts: TuyChonSo, lang?: Lang): string => fmtSo(v, opts, lang);

const huuHan = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

type Props = TuyChonSo & { value: number | null | undefined; class?: string };

/** Số chạy từ giá trị cũ sang mới (~280 ms); ô vừa đổi nháy nền (`.vua-doi`, mờ dần ở CSS). Lần hiện đầu không chạy, không nháy. */
export function SoDong({ value, thapPhan, donVi, class: lop }: Props) {
  useLang();
  const [hienTai, setHienTai] = useState<number | null | undefined>(value);
  const [nhay, setNhay] = useState(false);
  const truoc = useRef(value);
  const huy = useRef<() => void>(() => {});
  const hen = useRef(0);

  useEffect(() => {
    const cu = truoc.current;
    truoc.current = value;
    if (cu === value) return;
    huy.current();
    clearTimeout(hen.current);
    if (huuHan(cu) && huuHan(value) && !giamChuyenDong()) {
      huy.current = chayRaf(MS_CHAY, easeOutCubic, (p) => setHienTai(tron(cu, value, p)));
    } else setHienTai(value);
    if (!giamChuyenDong()) {
      setNhay(true);
      hen.current = window.setTimeout(() => setNhay(false), MS_GIU);
    }
  }, [value]);
  useEffect(() => () => { huy.current(); clearTimeout(hen.current); }, []);

  return <span class={`so-dong${nhay ? ' vua-doi' : ''}${lop ? ` ${lop}` : ''}`}>{chuSo(hienTai, { thapPhan, donVi })}</span>;
}
