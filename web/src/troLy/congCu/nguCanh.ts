/**
 * Ngữ cảnh công cụ Leo AI: mọi công cụ đọc / sửa đi qua ĐÚNG kho PA của giao diện (`kho/khoLoi.ts` — cùng ngăn hoàn tác, cùng
 * tự lưu), đúng state chọn của SoanThao (màn, lô, tòa, tầng, căn) và đúng hàm thuần các màn gọi. Không có mô hình song song.
 * Giao diện dựng ngữ cảnh trong `troLy/useNguCanhLeo.ts`; test dựng bằng thư viện thật (`thu/thuVienThat.ts`).
 */
import type { KhoLoi } from '../../kho/khoLoi';
import type { ThuVien, TrangThaiPA } from '../../tinh/kieu';
import type { DuLieuMB } from '../../tinh/loiThang';
import type { LuatTMB } from '../../tinh/thaoTacToa';

export type ManHinh = 'tmb' | 'tang' | 'ham';
export type XemGiua = 'mat_bang' | 'mo_hinh' | 'chi_phi';

/** State chọn của trình soạn (không nằm trong PA, không vào hoàn tác) — y như các nút / dải cấp đổi. */
export type TrangThaiUi = {
  buoc: ManHinh;
  xem: XemGiua;
  loId: string | null;
  toaId: string | null;
  canKhoa: string | null;
  /** Tầng điển hình đang xem (1..soTangDH); null = mặt bằng điển hình chung. */
  tangs: number[] | null;
  tangHam: number;
};

export type PAtrongDA = { id: string; ten: string };

/** Mục giao diện thấy được (ui_snapshot) — id ổn định theo vai trò + nhãn. */
export type MucUi = { id: string; vai: string; nhan: string; vung: string; giaTri?: string; chon?: boolean; tat?: boolean };

export type NguCanh = {
  kho: KhoLoi;
  /** Chế độ Chỉ xem (không có mã sửa hoặc người dùng chọn Chỉ xem): công cụ sửa trả lỗi. */
  chiXem: () => boolean;
  tv: () => ThuVien | null;
  /** Chờ dữ liệu tự chỉnh mặt bằng tầng (hình lõi, tim cửa) đủ cho PA. */
  dl: (pa: TrangThaiPA) => Promise<DuLieuMB | null>;
  luat: () => Promise<LuatTMB | null>;
  cuaCan: (nhom: 'tm' | 'xh') => Promise<Record<string, number>>;
  duAn: { ma: string; ten: string; paId: string; tenPA: string; dsPA: () => PAtrongDA[]; coMaSua: boolean };
  ui: { lay: () => TrangThaiUi; dat: (p: Partial<TrangThaiUi>) => void };
  /** PA ở máy chủ (cần mã sửa). Thiếu = không hỗ trợ (test). */
  paApi?: {
    nhanBan: (id: string) => Promise<string>;
    doiTen: (id: string, ten: string) => Promise<void>;
    xoa: (id: string) => Promise<void>;
    taoMoi: (ten: string) => Promise<string>;
    doc: (id: string) => Promise<{ ten: string; pa: TrangThaiPA }>;
    mo: (id: string) => void;
  };
  xuat?: { xls: () => Promise<void>; moCad: () => boolean };
  /** Hỏi người dùng (chip xác nhận trong khung chat); trả true khi đồng ý. */
  xacNhan: (cau: string) => Promise<boolean>;
  dom?: { chup: (vung?: string) => MucUi[]; bam: (id: string) => Promise<string>; datGiaTri: (id: string, v: string | boolean) => Promise<string> };
  vuaKhung?: () => boolean;
};

/** Lỗi công cụ: trả về Claude như tool_result is_error (câu tiếng Việt, ngắn). */
export class LoiCongCu extends Error {}

export const tron = (x: number | null | undefined, n = 2): number | null =>
  x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 10 ** n) / 10 ** n;

export const idToaMoi = () => `toa-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function canTV(ng: NguCanh): ThuVien {
  const tv = ng.tv();
  if (!tv) throw new LoiCongCu('Thư viện mẫu tòa / căn chưa tải xong — thử lại sau giây lát.');
  return tv;
}

export function kiemSua(ng: NguCanh): void {
  if (ng.chiXem()) throw new LoiCongCu('Đang ở chế độ Chỉ xem (dự án mở không có mã sửa, hoặc người dùng chọn CHỈ XEM) — không sửa được. Hãy báo người dùng mở bằng link có mã sửa hoặc chuyển sang TỰ ĐỘNG.');
}

/** Sửa PA qua kho thật: một lần gọi = một bước hoàn tác. Không đổi gì thì báo lỗi `khongDoi`. */
export function suaPA(ng: NguCanh, fn: (p: TrangThaiPA) => TrangThaiPA, khongDoi = 'Không có gì thay đổi (giá trị đã như vậy, hoặc phép sửa bị chặn).'): TrangThaiPA {
  kiemSua(ng);
  if (!ng.kho.sua(fn)) throw new LoiCongCu(khongDoi);
  return ng.kho.lay();
}

export const timLo = (pa: TrangThaiPA, id: string | undefined) => {
  const lo = id ? pa.lo.find((l) => l.id === id || l.temDat.kyHieu === id) : undefined;
  if (!lo) throw new LoiCongCu(`Không có lô "${id ?? ''}". Lô hiện có: ${pa.lo.map((l) => `${l.id} (${l.temDat.kyHieu})`).join(', ') || 'chưa có lô'}.`);
  return lo;
};

export const timToa = (pa: TrangThaiPA, id: string | undefined) => {
  const toa = id ? pa.toa.find((x) => x.id === id) : undefined;
  if (!toa) throw new LoiCongCu(`Không có tòa "${id ?? ''}". Tòa hiện có: ${pa.toa.map((x) => x.id).join(', ') || 'chưa có tòa'} (xem get_state).`);
  return toa;
};

/** Các bước hoàn tác hiện có — kèm vào mỗi kết quả sửa để Claude biết có thể undo. */
export const buocHoanTac = (ng: NguCanh) => ng.kho.soBuoc().truoc;
