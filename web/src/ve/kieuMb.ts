import type { LoaiCan } from '../tinh/kieu';

/** Kiểu hiển thị mặt bằng tầng. `leo` là bảng màu của app; ba kiểu salekit đo từ PDF tài liệu bán hàng (mã màu lấy từ app cũ). */
export type KieuMb = 'leo' | 'sk_galia' | 'sk_hh1' | 'sk_rivea';
export const DS_KIEU_MB: KieuMb[] = ['leo', 'sk_galia', 'sk_hh1', 'sk_rivea'];

export type BangKieu = {
  u: Record<LoaiCan, string>;
  /** Độ đặc của màu tô căn: salekit tô đặc như tài liệu bán hàng, kiểu LEO tô trong để thấy nét. */
  doDac: number;
  tuong: string;
  thietBi: string;
  duongDan: string;
  /** Lõi, hành lang, thang bộ để trắng như tài liệu bán hàng. */
  sanTrang: boolean;
  sanMau: string;
  loiMau: string;
};

export const KIEU_MB: Record<KieuMb, BangKieu> = {
  leo: {
    u: { stu: 'var(--u-stu)', '1pn': 'var(--u-1pn)', '2pn': 'var(--u-2pn)', '2pnp': 'var(--u-2pnp)', '3pn': 'var(--u-3pn)' },
    doDac: 0.6, tuong: '#292D2D', thietBi: '#8A9494', duongDan: '#174F52', sanTrang: false, sanMau: '#E9EDF2', loiMau: '#F6F8FA',
  },
  sk_galia: {
    u: { stu: '#DEEFEA', '1pn': '#F2E4DE', '2pn': '#DDDDDC', '2pnp': '#CDDEC0', '3pn': '#EBE0C9' },
    doDac: 1, tuong: '#231F20', thietBi: '#8E8F92', duongDan: '#555558', sanTrang: true, sanMau: '#FFFFFF', loiMau: '#FFFFFF',
  },
  sk_hh1: {
    u: { stu: '#CBE9E7', '1pn': '#FDE7D7', '2pn': '#EBE8DE', '2pnp': '#DCD6C6', '3pn': '#E8D9B5' },
    doDac: 1, tuong: '#2B3F3E', thietBi: '#7A8F8E', duongDan: '#2B3F3E', sanTrang: true, sanMau: '#FFFFFF', loiMau: '#FFFFFF',
  },
  sk_rivea: {
    u: { stu: '#F2E3E0', '1pn': '#E2DACE', '2pn': '#C6D1DA', '2pnp': '#FEECD7', '3pn': '#E9C9AC' },
    doDac: 1, tuong: '#635B5A', thietBi: '#9A8F8A', duongDan: '#655954', sanTrang: true, sanMau: '#FFFFFF', loiMau: '#FFFFFF',
  },
};

/** Bảng nét theo nhóm nét CAD (độ dày px cố định khi phóng, độ đục, nét đứt): như bảng PEN của app cũ. */
export const NET: Record<string, { w: number; o: number; d?: string; mau: 'tuong' | 'thietBi' }> = {
  wall: { w: 1.9, o: 1, mau: 'tuong' },
  door: { w: 0.9, o: 0.7, mau: 'tuong' },
  rail: { w: 0.9, o: 0.6, mau: 'tuong' },
  equip: { w: 0.7, o: 0.85, mau: 'thietBi' },
  furn: { w: 0.7, o: 0.85, d: '3 2', mau: 'thietBi' },
  hidd: { w: 0.7, o: 0.85, d: '3 2', mau: 'thietBi' },
  detail: { w: 0.6, o: 0.65, mau: 'thietBi' },
};
/** Nhóm nét thuộc lớp nội thất (tắt được). */
export const NET_NOI_THAT = new Set(['furn', 'equip', 'hidd']);

export const NHAN_LOAI: Record<LoaiCan, string> = { stu: 'STU', '1pn': '1PN', '2pn': '2PN', '2pnp': '2PN+', '3pn': '3PN' };
export const CHU_CO_CHAN = 'SVN-Miller Banner, Cormorant Garamond, Georgia, Times New Roman, serif';
export const CHU_KHONG_CHAN = 'Bahnschrift, Arial Narrow, Segoe UI, sans-serif';
export const CHU_MAY = 'Consolas, IBM Plex Mono, monospace';

const KHOA = 'unitmix.kieuMb';
export function docKieuMb(): KieuMb {
  try {
    const v = localStorage.getItem(KHOA);
    return DS_KIEU_MB.includes(v as KieuMb) ? (v as KieuMb) : 'leo';
  } catch {
    return 'leo';
  }
}
export function ghiKieuMb(k: KieuMb): void {
  try {
    localStorage.setItem(KHOA, k);
  } catch {
    /* trình duyệt chặn lưu: vẫn đổi trong phiên */
  }
}
