/**
 * Lịch sử phiên bản — mỗi bản vài dòng thật ngắn (người dùng yêu cầu). Mới nhất ở trên. Nâng phiên bản thì thêm một mục ở đầu
 * và sửa số trong package.json, web/package.json, package-lock.json (3 chỗ).
 */
export type MucPhienBan = { v: string; ngay: string; vi: string[]; en: string[] };

export const LICH_SU_PHIEN_BAN: MucPhienBan[] = [
  {
    v: '0.4.7', ngay: '2026-11-01',
    vi: [
      'Màn Tầng: mục Áp dụng sửa cho — chép phép sửa cơ cấu căn sang mọi tòa cùng mẫu trong lô hoặc cả dự án (một bước hoàn tác)',
      'Màn Tầng: phần Căn đang chọn + STRETCH trình bày lại gọn, dễ nhìn (ô số liệu, nút −100 / +100 lớn, nhóm đổi mẫu)',
      'Điện thoại: chặn zoom trang bằng chạm hai lần / khi chọn ô nhập; khoá cuộn trang khi bàn phím mở để khung Leo AI không nhảy lên',
    ],
    en: [
      'Floor view: Apply edits to — copy unit-mix edits to all same-type towers in the plot or whole project (one undo)',
      'Floor view: selected-unit + STRETCH panel redesigned (stat tiles, large −100 / +100, grouped swap lists)',
      'Phones: no page zoom on double-tap / input focus; page scroll locked while the keyboard is open so the Leo AI box stays put',
    ],
  },
  {
    v: '0.4.6', ngay: '2026-11-01',
    vi: [
      'Màn Tầng: menu ô căn có thêm tab Đổi căn — danh sách mẫu cùng nhóm / vị trí, bấm xem mặt bằng nhỏ (kéo dời được) rồi chọn',
      'Màn Tầng: sắp xếp / đổi căn không còn tự thu ra xa; lật gương được thang bộ; nội thất hiện mặc định',
      'Nhãn gọn: thang bộ ghi N2 / N3, lõi ghi số thang máy (3TM); bật ảnh vệ tinh tự đặt vị trí, khỏi nhập toạ độ',
      'Leo AI trên điện thoại: khung chat không còn bị đẩy lên khi mở bàn phím',
    ],
    en: [
      'Floor view: unit menu gets a Change unit tab — same-group types, tap for a small draggable plan preview, then choose',
      'Floor view: rearranging / swapping units no longer zooms out; stairs can be mirrored; furniture shown by default',
      'Cleaner labels: stairs show N2 / N3, cores show elevator count (3TM); satellite layer places itself, no coordinates needed',
      'Leo AI on phones: the chat box no longer jumps up when the keyboard opens',
    ],
  },
  {
    v: '0.4.5', ngay: '2026-11-01',
    vi: [
      'Leo AI: đính kèm thêm tệp Word (.docx) và văn bản (.txt, .md, .json, .dxf…), tối đa 6 tệp, PDF tới 8 MB',
      'Leo AI: dòng theo dõi luôn hiện khi đang chạy (bước đang làm, số bước đã xong); chỉ còn vòng tròn trong khung chat quay khi suy nghĩ',
    ],
    en: [
      'Leo AI: attach Word (.docx) and text files (.txt, .md, .json, .dxf…), up to 6 files, PDF up to 8 MB',
      'Leo AI: a live progress line is always visible while running (current step, steps done); only the spinner in the chat rotates while thinking',
    ],
  },
  {
    v: '0.4.4', ngay: '2026-11-01',
    vi: [
      'Mặt bằng Tầng: nét nội thất (giường, bàn, bếp) đậm và rõ hơn, dễ thấy trong các căn 1PN, 2PN, 3PN',
    ],
    en: [
      'Floor plan: furniture lines (beds, tables, kitchens) are darker and clearer in 1PN, 2PN and 3PN units',
    ],
  },
  {
    v: '0.4.3', ngay: '2026-11-01',
    vi: [
      'Leo AI trên điện thoại: dán link / mã ghép ngay trong Cài đặt; báo đúng khi máy tính chưa nối',
      'Ô căn đang chọn trên mặt bằng Tầng nhạt hơn, thấy rõ nội thất',
    ],
    en: [
      'Leo AI on phones: paste the pairing link / code right in Settings; clear message when the computer is not connected',
      'Selected unit on the floor plan is lighter so the furniture stays visible',
    ],
  },
  {
    v: '0.4.2', ngay: '2026-10-31',
    vi: [
      'Quy tắc vị trí căn: căn góc chỉ ở góc, căn giữa chỉ ở giữa, căn V / Y khoá đúng chỗ cạnh lõi thang máy',
      'Thanh 3D: nút Vị trí · Hướng nắng · Hướng gió; đặt vị trí từ toạ độ VN-2000 của bản vẽ hoặc tìm địa điểm, khỏi dán link',
    ],
    en: [
      'Unit placement rule: corner units only at corners, middle units only in the middle, V / Y units locked beside the lift core',
      '3D bar: Location · Sun direction · Wind direction buttons; set location from VN-2000 coordinates in the drawing or place search, no link pasting',
    ],
  },
  {
    v: '0.4.1', ngay: '2026-10-31',
    vi: [
      'Danh sách dự án: mỗi dự án mặc định thu gọn, bấm mũi tên để xổ bảng phương án',
      'Lịch sử phiên bản: mỗi bản mặc định thu gọn, bấm để xổ',
    ],
    en: [
      'Project list: each project is collapsed by default; click the arrow to expand its variants',
      'Version history: each version is collapsed by default; click to expand',
    ],
  },
  {
    v: '0.4.0', ngay: '2026-10-31',
    vi: [
      'Leo AI dùng tài khoản Claude đã đăng nhập (cầu trên máy, cả điện thoại), không cần khoá API',
      'Xếp tòa THEO MỤC TIÊU: tự chọn / trộn mẫu tòa đạt DTXD + cơ cấu căn rồi đặt; Leo AI điều khiển được',
      'Xuất PDF (báo cáo, Salekit, HĐMB) và 3D / BIM (.dae SketchUp, .ifc Revit)',
      'Điểm view căn hộ, ảnh vệ tinh + nắng · gió theo toạ độ dự án, 3D vật liệu thực hơn, zoom / pan hết méo',
      'PCCC theo app cũ: tủ họng nước, cửa ngăn cháy hành lang, xuất DXF lớp PCCC; tem căn không đè',
      'Sửa: Leo AI báo đúng lô đang chọn, hết bật cửa sổ terminal khi gọi cầu, thanh giờ nắng không giật',
    ],
    en: [
      'Leo AI uses your signed-in Claude account (local bridge, phones too) — no API key needed',
      'Tower layout BY TARGET: auto-pick / mix templates to hit site coverage + unit mix, then place; Leo AI can drive it',
      'PDF export (report, Salekit, sale agreement) and 3D / BIM (.dae SketchUp, .ifc Revit)',
      'Unit view score, satellite + sun / wind by project location, more realistic 3D, distortion-free zoom / pan',
      'Fire safety per old app: hydrant cabinets, corridor fire doors, PCCC DXF layers; non-overlapping unit labels',
      'Fixes: Leo AI sees the selected lot, no terminal window popping up, sun-hour bar no longer jumps',
    ],
  },
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
