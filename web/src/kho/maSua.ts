/** Mã sửa và danh sách dự án đã mở, lưu ở trình duyệt. Mọi truy cập localStorage đều bọc try/catch. */
const KHOA_MA = (ma: string) => `unitmix.maSua.${ma}`;
const KHOA_DS = 'unitmix.duAnDaMo';

export type DuAnDaMo = { ma: string; ten: string; moLuc: string; coMaSua: boolean };

const doc = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const ghi = (k: string, v: string): void => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* trình duyệt chặn lưu */
  }
};

export const layMaSua = (ma: string): string | null => doc(KHOA_MA(ma));
export const luuMaSua = (ma: string, maSua: string): void => ghi(KHOA_MA(ma), maSua);

/** Link có `?sua=<mã>` thì cất mã vào máy rồi bỏ khỏi thanh địa chỉ (để không lộ khi chụp màn hình). */
export function nhanMaTuLink(ma: string): void {
  const u = new URL(location.href);
  const m = u.searchParams.get('sua');
  if (!m) return;
  luuMaSua(ma, m);
  u.searchParams.delete('sua');
  history.replaceState(null, '', u.pathname + u.search + u.hash);
}

export const linkXem = (ma: string): string => `${location.origin}/du-an/${ma}`;
export const linkSua = (ma: string, maSua: string): string => `${linkXem(ma)}?sua=${encodeURIComponent(maSua)}`;

export function dsDuAnDaMo(): DuAnDaMo[] {
  try {
    return JSON.parse(doc(KHOA_DS) ?? '[]') as DuAnDaMo[];
  } catch {
    return [];
  }
}

export function ghiNhoDuAn(ma: string, ten: string): void {
  const ds = dsDuAnDaMo().filter((d) => d.ma !== ma);
  ds.unshift({ ma, ten, moLuc: new Date().toISOString(), coMaSua: !!layMaSua(ma) });
  ghi(KHOA_DS, JSON.stringify(ds.slice(0, 50)));
}

/** Rút mã dự án từ link hoặc mã gõ tay: ".../du-an/x7k2p9ab" hoặc "x7k2p9ab". Kèm mã sửa nếu link có. */
export function phanTichLink(s: string): { ma: string; maSua: string | null } | null {
  const t = s.trim();
  const m = t.match(/du-an\/([a-z0-9]{8})(?:\?[^#]*?\bsua=([A-Za-z0-9]+))?/) ?? t.match(/^([a-z0-9]{8})$/);
  return m ? { ma: m[1], maSua: m[2] ?? null } : null;
}
