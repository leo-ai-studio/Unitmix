import { taoThuVien, type CanMau, type ThuVien, type ToaMau } from './kieu';
import { themBienThe } from './stretch';

let dangTai: Promise<ThuVien> | null = null;

/** Tải thư viện mẫu tòa + mẫu căn (một lần cho cả phiên). */
export function taiThuVien(): Promise<ThuVien> {
  dangTai ??= Promise.all([
    fetch('/lib/toa.json').then((r) => r.json() as Promise<ToaMau[]>),
    fetch('/lib/can.json').then((r) => r.json() as Promise<CanMau[]>),
  ]).then(([toa, can]) => themBienThe(taoThuVien(toa, can)));
  dangTai.catch(() => (dangTai = null));
  return dangTai;
}
