/** Câu tiếng Việt / Anh cho kết quả kiểm mẫu (tinh/kiemMauToa.ts · kiemThuVien.ts): khoá i18n `kmt.<mã>` / `kmc.<mã>`, tham số thế vào {tên}. */
import { t } from '../i18n/i18n';
import type { ViPhamMau } from '../tinh/kiemMauToa';
import type { ViPhamCan } from '../tinh/kiemThuVien';

const the = (chu: string, tham: Record<string, number | string>) => chu.replace(/\{(\w+)\}/g, (_, k: string) => String(tham[k] ?? ''));

export function chuViPham(v: ViPhamMau): string {
  const tham = { ...v.tham, thieu: v.tham.thieu ? `; ${v.tham.thieu}` : '' };
  return the(t(`kmt.${v.ma}`), tham) + (v.tang !== null ? ` (${t('mt.tang').replace('{k}', String(v.tang))})` : '');
}
export const chuViPhamCan = (v: ViPhamCan): string => the(t(`kmc.${v.ma}`), { min: 25, ...v.tham });
