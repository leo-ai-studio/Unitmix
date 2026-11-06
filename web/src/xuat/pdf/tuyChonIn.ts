/**
 * Tuỳ chọn báo cáo PDF: kiểu trình bày, bảng màu căn, trang nào in, lớp bật / tắt, màu và độ dày nét. Nhớ theo máy (localStorage), không
 * lưu vào phương án vì đây là cách trình bày, không phải số liệu. Tệp nhẹ: hộp xuất dùng ngay, còn bộ dựng trang vẫn tải lười.
 */
import type { KieuMb } from '../../ve/kieuMb';

export type TrinhBay = 'brand' | 'xanh' | 'den_trang';
export const DS_TRINH_BAY: TrinhBay[] = ['brand', 'xanh', 'den_trang'];
export const BANG_MAU_IN: KieuMb[] = ['sk_rivea', 'sk_galia', 'sk_hh1', 'leo'];

export type TuyChonBC = {
  trinhBay: TrinhBay;
  bangMau: KieuMb;
  trang: { tmb: boolean; chiTieu: boolean; matBang: boolean };
  lop: { temCan: boolean; kichThuoc: boolean; noiThat: boolean; keyplan: boolean; hoaGio: boolean; toLo: boolean; ranhLo: boolean; chiGioi: boolean; duongQH: boolean; nhanLo: boolean; nhanToa: boolean; thuocTyLe: boolean };
  net: {
    /** Hệ số độ dày nét mặt bằng và TMB, 1 = chuẩn. */
    day: number;
    /** Màu nét tường, chân tòa TMB; null = theo bảng màu. */
    mauTuong: string | null;
    mauToa: string | null;
    mauRanh: string | null;
    mauChiGioi: string | null;
  };
  /** `lo_co_toa`: TMB phóng tới các lô có tòa cho hình lớn; `du_an`: cả ranh dự án. */
  khungTmb: 'lo_co_toa' | 'du_an';
  /** Hệ số cỡ chữ bảng, 1 = chuẩn. */
  coChu: number;
};

export const TC_MAC_DINH: TuyChonBC = {
  trinhBay: 'brand',
  bangMau: 'sk_rivea',
  trang: { tmb: true, chiTieu: true, matBang: true },
  lop: { temCan: true, kichThuoc: true, noiThat: false, keyplan: true, hoaGio: true, toLo: true, ranhLo: true, chiGioi: true, duongQH: true, nhanLo: true, nhanToa: true, thuocTyLe: true },
  net: { day: 1, mauTuong: null, mauToa: null, mauRanh: null, mauChiGioi: null },
  khungTmb: 'lo_co_toa',
  coChu: 1,
};

const KHOA = 'unitmix.tuyChonBC.v1';

/** Gộp với mặc định: bản lưu cũ thiếu khoá mới vẫn đọc được, giá trị hỏng về mặc định. */
export function chuanTuyChon(x: unknown): TuyChonBC {
  const v = (x && typeof x === 'object' ? x : {}) as Partial<TuyChonBC>;
  const m = TC_MAC_DINH, so = (n: unknown, a: number, b: number, d: number) => (typeof n === 'number' && n >= a && n <= b ? n : d);
  const mau = (c: unknown) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : null);
  return {
    trinhBay: DS_TRINH_BAY.includes(v.trinhBay as TrinhBay) ? (v.trinhBay as TrinhBay) : m.trinhBay,
    bangMau: BANG_MAU_IN.includes(v.bangMau as KieuMb) ? (v.bangMau as KieuMb) : m.bangMau,
    trang: { ...m.trang, ...v.trang },
    lop: { ...m.lop, ...v.lop },
    net: { day: so(v.net?.day, 0.4, 2.5, 1), mauTuong: mau(v.net?.mauTuong), mauToa: mau(v.net?.mauToa), mauRanh: mau(v.net?.mauRanh), mauChiGioi: mau(v.net?.mauChiGioi) },
    khungTmb: v.khungTmb === 'du_an' ? 'du_an' : 'lo_co_toa',
    coChu: so(v.coChu, 0.8, 1.4, 1),
  };
}

export function docTuyChon(): TuyChonBC {
  try { return chuanTuyChon(JSON.parse(localStorage.getItem(KHOA) ?? 'null')); } catch { return chuanTuyChon(null); }
}
export function luuTuyChon(v: TuyChonBC) {
  try { localStorage.setItem(KHOA, JSON.stringify(v)); } catch { /* trình duyệt chặn lưu */ }
}
