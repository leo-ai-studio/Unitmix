/**
 * Biểu tượng nét SVG tự vẽ cho nút công cụ — phong cách công cụ thiết kế kiểu Forma (nét mảnh 1,5 trên khung 24, đầu nét tròn, một màu
 * `currentColor` = màu brand), KHÔNG chép biểu tượng của Autodesk. Mỗi giá trị là phần thân SVG (path / rect / circle…).
 * Khoá trùng `BIEU_TUONG` (bieuTuong.ts); khoá nào chưa có hình ở đây thì nút dùng ký hiệu chữ ở `BIEU_TUONG`.
 */
export const SVG_BT: Record<string, string> = {
  // chung
  chon: '<path d="M6 4l12 7-5.5 1.5L10 18z"/>',
  chonNhieu: '<rect x="4" y="4" width="16" height="16" rx="1.5" stroke-dasharray="3 2.5"/><path d="M10 10l7 4-3 .8-1.3 3z"/>',
  hoanTac: '<path d="M9 7L5 11l4 4"/><path d="M5 11h9a5 5 0 010 10h-3"/>',
  lamLai: '<path d="M15 7l4 4-4 4"/><path d="M19 11h-9a5 5 0 000 10h3"/>',
  xoa: '<path d="M5 7h14M10 4h4M7 7l1 13h8l1-13M10 11v6M14 11v6"/>',
  lat: '<path d="M12 3v18" stroke-dasharray="2 2"/><path d="M9 6L4 18h5zM15 6l5 12h-5z"/>',
  khoa: '<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  moKhoa: '<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 017.5-2"/>',
  nhanBan: '<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 8V5.5A1.5 1.5 0 0014.5 4h-9A1.5 1.5 0 004 5.5v9A1.5 1.5 0 005.5 16H8"/>',
  do: '<path d="M3 15l12-12 6 6L9 21z"/><path d="M7 11l2 2M10 8l1.5 1.5M13 5l2 2"/>',
  batDinh: '<path d="M7 4v7a5 5 0 0010 0V4"/><path d="M7 4h3v7M17 4h-3v7"/>',
  toaDo: '<circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="1.2"/>',
  xoay: '<path d="M20 12a8 8 0 11-2.3-5.7"/><path d="M20 4v5h-5"/>',
  vuaKhung: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  xem3d: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  // màn Tầng
  sapXep: '<path d="M12 3v18M3 12h18"/><path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  themCan: '<rect x="3" y="6" width="12" height="12" rx="1.5"/><path d="M19 9v6M16 12h6"/>',
  themTruoc: '<rect x="9" y="6" width="12" height="12" rx="1.5"/><path d="M5 9v6M2 12h6"/>',
  themCho: '<rect x="3" y="6" width="18" height="12" rx="1.5" stroke-dasharray="3 2.5"/><path d="M12 9v6M9 12h6"/>',
  themThang:'<path d="M4 20h4v-4h4v-4h4V8h4"/><path d="M18 2v4M16 4h4"/>',
  hanhLang: '<path d="M3 9h18M3 15h18"/><path d="M7 12h2M11 12h2M15 12h2"/>',
  toiUu: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z"/>',
  keoDan: '<rect x="7" y="6" width="10" height="12" rx="1"/><path d="M3 12h4M17 12h4M5 10l-2 2 2 2M19 10l2 2-2 2"/>',
  // Tổng mặt bằng
  tuDat: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
  datToa: '<rect x="6" y="3" width="12" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
  hangLoat: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>',
  canhBao: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17v.5"/>',
  bongDo: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  nenBanDo: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  khoaCG: '<rect x="3" y="3" width="18" height="18" rx="1.5" stroke-dasharray="3 2.5"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  // xuất
  xuatCad: '<path d="M4 20L20 4M4 20h6M4 20v-6"/><path d="M14 4h6v6"/>',
  xuatXls: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M4 9h16M4 15h16M10 3v18"/>',
};
