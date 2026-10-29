/** Lọc / sắp danh sách "Dự án của tôi" (thuần, test được). */
import type { DuAnApi } from '../api';

export type CachSap = 'gan' | 'ten' | 'sua';
export type DongDuAn = { ma: string; da: DuAnApi | null; loi: boolean };

/** Bỏ dấu tiếng Việt + chữ thường để gõ "ho tay" vẫn ra "Hồ Tây". */
export const boDau = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

/** Giữ dự án khớp từ khoá ở tên, địa điểm hoặc mã (chưa tải xong thì chỉ so mã). Từ khoá rỗng → giữ hết. */
export function locDuAn(ds: DongDuAn[], tu: string): DongDuAn[] {
  const q = boDau(tu.trim());
  if (!q) return ds;
  return ds.filter(({ ma, da }) => boDau([ma, da?.ten ?? '', da?.dia_diem ?? ''].join(' ')).includes(q));
}

/** Lần sửa PA mới nhất của dự án (ISO), chưa có thì ''. */
const suaMoiNhat = (da: DuAnApi | null): string => (da?.phuong_an ?? []).reduce((m, p) => (p.sua_luc > m ? p.sua_luc : m), '');

/** 'gan' = thứ tự mở gần đây (danh sách lưu sẵn đã theo thứ tự đó); 'ten' = tên A–Z theo ngôn ngữ; 'sua' = PA sửa mới nhất trước. */
export function sapDuAn(ds: DongDuAn[], cach: CachSap, lang = 'vi'): DongDuAn[] {
  if (cach === 'gan') return ds;
  const kq = [...ds];
  if (cach === 'ten') kq.sort((a, b) => (a.da?.ten ?? a.ma).localeCompare(b.da?.ten ?? b.ma, lang));
  else kq.sort((a, b) => suaMoiNhat(b.da).localeCompare(suaMoiNhat(a.da)));
  return kq;
}
