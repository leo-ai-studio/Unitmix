/**
 * Bộ biểu tượng nút công cụ theo brand LEO: ký hiệu nét MỘT MÀU (kiểu ◈ của kit), tô bằng màu brand qua CSS (`.nut-bt`, `color: var(--green)`)
 * — không dùng emoji nhiều màu. Nút chỉ hiện biểu tượng cho gọn; tên + căn cứ ở tooltip / aria-label (i18n `bt.<khoá>`).
 * Mỗi việc một ký hiệu, dùng chung mọi màn (Tầng, Tổng mặt bằng, Hầm…): cùng việc thì cùng biểu tượng.
 * Ký hiệu có dạng emoji (⚠ …) kèm U+FE0E để trình duyệt vẽ dạng chữ một màu.
 */
export const BIEU_TUONG = {
  // chung
  chon: '⬉', // chọn
  chonNhieu: '⬚', // khung chọn / chọn nhiều
  hoanTac: '↶',
  lamLai: '↷',
  xoa: '✕', // xoá căn / thang / tòa
  lat: '⇋', // lật gương
  khoa: '⚿', // khoá
  moKhoa: '⚷', // mở khoá
  nhanBan: '⧉',
  do: '⟷', // đo khoảng cách
  batDinh: '⌖', // bắt dính
  toaDo: '⌗', // nhập toạ độ / góc chính xác
  xoay: '⟳',
  vuaKhung: '⛶', // vừa khung
  xem3d: '⬡',
  phong: '⊕', // phóng to
  thu: '⊖', // thu nhỏ
  lop: '☰', // lớp hiển thị (bật / tắt)
  chuGiai: '▤', // chú giải
  troGiup: '?', // hướng dẫn thao tác
  // màn Tầng
  sapXep: '✥', // kéo đổi chỗ căn (QT-8 · QT-30)
  them: '＋', // menu gộp Thêm căn / Thêm thang bộ (app cũ tAddMenu)
  themCan: '⊞',
  themTruoc: '⇤', // thêm căn TRƯỚC ô chọn (đầu dãy)
  themCho: '⊡', // thêm căn vào khe / ô trống
  thangTuDong: '⟲', // bỏ thang đặt tay, PC-11 tự đặt lại
  themThang: '≣', // thêm thang bộ — ô 3.000 mm (QT-10)
  hanhLang: '⇉', // hành lang tự động
  toiUu: '✦', // tối ưu theo cơ cấu / tự chỉnh
  keoDan: '⇔', // STRETCH (QT-81)
  // Tổng mặt bằng
  tuDat: '◎', // tự đặt / gợi ý xếp tòa (MT-05)
  datToa: '▣', // đặt tòa đang chọn
  moTang: '⧈', // mở mặt bằng tầng của tòa
  hangLoat: '▦', // xếp hàng loạt
  canhBao: '⚠︎', // vi phạm khoảng lùi / khoảng cách
  bongDo: '☼',
  nenBanDo: '▧',
  khoaCG: '⊟', // giữ tòa trong chỉ giới khi kéo / xoay (LO-05)
  // màn hẹp (điện thoại / máy tính bảng)
  nganTrai: '◧', // mở ngăn Nhập liệu (panel trái)
  nganPhai: '◨', // mở ngăn Số liệu (panel phải)
  dongNgan: '⌄', // đóng ngăn kéo
  menuToa: '⋯', // menu tòa (nhấn giữ)
  // Leo AI (troLy/LeoAI.tsx)
  leoGui: '➤',
  leoDung: '◼',
  leoMic: '◖',
  leoKem: '⌇',
  leoLoa: '♫',
  leoMoi: '✚',
  leoCaiDat: '⚙',
  leoSaoChep: '⎗',
  leoThuLai: '↻',
  leoSua: '✐',
  leoXuong: '⤓',
  leoDong: '×',
  leoLichSu: '≔',
  leoGiong: '◉',
  // xuất
  xuatCad: '◫',
  xuatXls: '▥',
} as const;

export type KhoaBieuTuong = keyof typeof BIEU_TUONG;
