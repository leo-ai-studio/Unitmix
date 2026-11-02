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

const KHOA_TEN = 'unitmix.tenNguoiSua';
/** Tên người sửa tự khai (lưu trên máy này, gửi kèm mỗi lần lưu PA để danh sách biết ai sửa). */
export const layTenNguoi = (): string => (doc(KHOA_TEN) ?? '').trim().slice(0, 60);
export const luuTenNguoi = (ten: string): void => ghi(KHOA_TEN, ten.trim().slice(0, 60));
/** Đã hỏi tên một lần (không hỏi lại mỗi lần mở PA). */
export const daHoiTen = (): boolean => doc('unitmix.daHoiTen') === '1';
export const ghiDaHoiTen = (): void => ghi('unitmix.daHoiTen', '1');

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

/** Dựng link thuần (không đọc `location`) để test được: `goc` = origin, vd. "https://unitmix.leo-ai.dev". */
export const taoLinkXem = (goc: string, ma: string): string => `${goc.replace(/\/+$/, '')}/du-an/${ma}`;
export const taoLinkSua = (goc: string, ma: string, maSua: string): string => `${taoLinkXem(goc, ma)}?sua=${encodeURIComponent(maSua)}`;
export const linkXem = (ma: string): string => taoLinkXem(location.origin, ma);
export const linkSua = (ma: string, maSua: string): string => taoLinkSua(location.origin, ma, maSua);

/** Hai loại link chia sẻ: chỉ xem (ai có link đều xem) · có thể sửa (kèm mã sửa — chỉ gửi người được sửa). */
export type LoaiLink = 'xem' | 'sua';
/**
 * Link chia sẻ theo loại. Link sửa chỉ dựng được khi máy này giữ mã sửa (`maSua` khác rỗng) → không có thì `null`,
 * giao diện không được đưa ra lựa chọn đó. Mã sửa không bao giờ lấy từ server (server chỉ lưu bản băm).
 */
export function linkChiaSe(goc: string, ma: string, loai: LoaiLink, maSua: string | null): string | null {
  if (loai === 'xem') return taoLinkXem(goc, ma);
  return maSua ? taoLinkSua(goc, ma, maSua) : null;
}

/** Quyền của máy này với dự án: 'sua' khi có mã sửa cất ở localStorage, còn lại 'xem' (dự án được chia sẻ bằng link xem). */
export const quyenDuAn = (ma: string): LoaiLink => (layMaSua(ma) ? 'sua' : 'xem');

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

/** Bỏ một dự án khỏi danh sách (thuần): trả danh sách mới + mục đã bỏ và vị trí cũ để hoàn tác. */
export function boMa(ds: DuAnDaMo[], ma: string): { ds: DuAnDaMo[]; bo: DuAnDaMo | null; viTri: number } {
  const viTri = ds.findIndex((d) => d.ma === ma);
  if (viTri < 0) return { ds, bo: null, viTri: -1 };
  return { ds: ds.filter((_, i) => i !== viTri), bo: ds[viTri], viTri };
}
/** Chèn lại mục đã bỏ đúng chỗ cũ (thuần); đã có lại trong danh sách (mở lại bằng link) thì giữ nguyên. */
export function chenLai(ds: DuAnDaMo[], muc: DuAnDaMo, viTri: number): DuAnDaMo[] {
  if (ds.some((d) => d.ma === muc.ma)) return ds;
  const i = Math.max(0, Math.min(viTri, ds.length));
  return [...ds.slice(0, i), muc, ...ds.slice(i)];
}

/**
 * Bỏ dự án khỏi "Dự án của tôi" CHỈ trên máy này — không gọi server, không xoá dự án. Mã sửa (nếu có) giữ lại: mở lại
 * bằng link thì vẫn sửa được; xoá mã sửa là mất quyền sửa vĩnh viễn (server chỉ có bản băm). Trả mục đã bỏ để hoàn tác.
 */
export function boKhoiDanhSach(ma: string): { bo: DuAnDaMo | null; viTri: number } {
  const r = boMa(dsDuAnDaMo(), ma);
  if (r.bo) ghi(KHOA_DS, JSON.stringify(r.ds));
  return { bo: r.bo, viTri: r.viTri };
}
export function hoanTacBo(muc: DuAnDaMo, viTri: number): void {
  ghi(KHOA_DS, JSON.stringify(chenLai(dsDuAnDaMo(), muc, viTri)));
}

/** Rút mã dự án từ link hoặc mã gõ tay: ".../du-an/x7k2p9ab" hoặc "x7k2p9ab". Kèm mã sửa nếu link có. */
export function phanTichLink(s: string): { ma: string; maSua: string | null } | null {
  const t = s.trim();
  const m = t.match(/du-an\/([a-z0-9]{8})(?:\?[^#]*?\bsua=([A-Za-z0-9]+))?/) ?? t.match(/^([a-z0-9]{8})$/);
  return m ? { ma: m[1], maSua: m[2] ?? null } : null;
}
