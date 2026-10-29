/**
 * Lịch sử phiên bản — mỗi bản vài dòng thật ngắn (người dùng yêu cầu). Mới nhất ở trên. Nâng phiên bản thì thêm một mục ở đầu
 * và sửa số trong package.json, web/package.json, package-lock.json (3 chỗ).
 */
export type MucPhienBan = { v: string; ngay: string; vi: string[]; en: string[] };

export const LICH_SU_PHIEN_BAN: MucPhienBan[] = [
  {
    v: '0.3.0', ngay: '2026-10-29',
    vi: [
      'Chi phí: đơn giá theo app cũ, QLDA theo TT 38/2026',
      'Tự xếp tòa, xếp hàng loạt nhiều lô, lộ giới từng cạnh lô',
      'Tự chỉnh lõi / thang / sảnh / hành lang, hết căn vượt cự ly thoát nạn',
      'Công cụ tay: sắp xếp căn, thêm căn / thang, STRETCH, xoay / lật / nhân bản tòa',
      'Giao diện gọn, biểu tượng nét theo brand; bảng chỉ tiêu cho lãnh đạo; dân số theo QĐ tỉnh',
      '3D vật liệu (tường be, kính, nền ngà), chọn tòa / lô / căn trong 3D; dùng được trên điện thoại',
      'Thang bộ 2–3 (luôn N2 + N3), xếp căn theo quy tắc app cũ; app nhanh hơn (hầm, tải trang)',
    ],
    en: [
      'Costs: old-app unit rates, PM fee per Circular 38/2026',
      'Auto tower layout, batch placement, per-edge road widths',
      'Auto core / stair / lobby / corridor fixes; no units beyond escape distance',
      'Manual tools: arrange units, add unit / stair, STRETCH, rotate / mirror / copy towers',
      'Compact UI, brand line icons; leadership KPI panels; population by provincial decision',
      'Material 3D (beige walls, glass, ivory ground), pick tower / plot / unit in 3D; works on phones',
      'Stairs 2–3 (always N2 + N3), unit layout per old-app rules; faster app (basement, loading)',
    ],
  },
  {
    v: '0.2.0', ngay: '2026-10-28',
    vi: ['DT sàn QCVN 01, luật QCVN 04, màn Hầm', 'So sánh PA, xuất Excel / CAD theo tầng, 3D hầm', 'Khung giữa cố định, hiệu ứng mượt'],
    en: ['Floor area per QCVN 01, QCVN 04 rules, Basement screen', 'Scheme comparison, Excel / per-floor CAD export, basement 3D', 'Fixed centre view, smooth motion'],
  },
  {
    v: '0.1.0', ngay: '2026-10-27',
    vi: ['Bản đầu: lô đất, xếp tòa, tầng · căn, 3D, song ngữ VI / EN'],
    en: ['First release: plots, towers, floors · units, 3D, VI / EN'],
  },
];
