import { langHienTai, type Lang } from '../i18n/i18n';

export type TuyChonSo = { thapPhan?: number; donVi?: string };

/** Bộ định dạng dùng lại theo (ngôn ngữ, số lẻ): tạo Intl.NumberFormat đắt (nhất là Safari iOS), bảng / KPI gọi hàng nghìn lần. */
const boDinhDang = new Map<string, Intl.NumberFormat>();

/** Định dạng số theo ngôn ngữ. Giá trị trống hoặc không hữu hạn luôn hiện "—". */
export function fmtSo(v: number | null | undefined, opts: TuyChonSo = {}, lang: Lang = langHienTai()): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const d = opts.thapPhan ?? 0, k = lang + d;
  let f = boDinhDang.get(k);
  if (!f) {
    f = new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    boDinhDang.set(k, f);
  }
  const s = f.format(v);
  return opts.donVi ? `${s} ${opts.donVi}` : s;
}
