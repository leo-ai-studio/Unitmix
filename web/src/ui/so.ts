import { langHienTai, type Lang } from '../i18n/i18n';

export type TuyChonSo = { thapPhan?: number; donVi?: string };

/** Định dạng số theo ngôn ngữ. Giá trị trống hoặc không hữu hạn luôn hiện "—". */
export function fmtSo(v: number | null | undefined, opts: TuyChonSo = {}, lang: Lang = langHienTai()): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const d = opts.thapPhan ?? 0;
  const s = new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(v);
  return opts.donVi ? `${s} ${opts.donVi}` : s;
}
