/**
 * Bộ biểu tượng emoji cho nút công cụ — nút chỉ hiện emoji cho gọn, tên + căn cứ nằm ở tooltip / aria-label (qua i18n `bt.<khoá>`).
 * Mỗi việc một emoji, dùng chung mọi màn (Tầng, Tổng mặt bằng, Hầm…): cùng việc thì cùng biểu tượng.
 */
export const BIEU_TUONG = {
  // chung
  chon: '👆', // chọn
  chonNhieu: '🔲', // khung chọn / chọn nhiều
  hoanTac: '↩️',
  lamLai: '↪️',
  xoa: '🗑️', // xoá căn / thang / tòa
  lat: '🪞', // lật gương
  khoa: '🔒',
  moKhoa: '🔓',
  nhanBan: '📑',
  do: '📏', // đo khoảng cách
  batDinh: '🧲', // bắt dính
  toaDo: '📍', // nhập toạ độ / góc chính xác
  xoay: '🔄',
  vuaKhung: '🔍', // vừa khung
  xem3d: '🧊',
  // màn Tầng
  sapXep: '✋', // kéo đổi chỗ căn (QT-8 · QT-30)
  themCan: '➕',
  themThang: '🪜', // thêm thang bộ — ô 3.000 mm (QT-10)
  hanhLang: '🛤️', // hành lang tự động
  toiUu: '✨', // tối ưu theo cơ cấu / tự chỉnh
  keoDan: '↔️', // STRETCH (QT-81)
  // Tổng mặt bằng
  tuDat: '🎯', // tự đặt / gợi ý xếp tòa (MT-05)
  datToa: '🏢', // đặt tòa đang chọn
  hangLoat: '🧩', // xếp hàng loạt
  canhBao: '⚠️', // vi phạm khoảng lùi / khoảng cách
  bongDo: '☀️',
  nenBanDo: '🗺️',
  // xuất
  xuatCad: '📐',
  xuatXls: '📊',
} as const;

export type KhoaBieuTuong = keyof typeof BIEU_TUONG;
