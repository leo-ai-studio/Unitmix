/**
 * Lịch sử phiên bản — mỗi bản vài dòng thật ngắn (người dùng yêu cầu). Mới nhất ở trên. Nâng phiên bản thì thêm một mục ở đầu
 * và sửa số trong package.json, web/package.json, package-lock.json (3 chỗ).
 */
export type MucPhienBan = { v: string; ngay: string; vi: string[]; en: string[] };

export const LICH_SU_PHIEN_BAN: MucPhienBan[] = [
  {
    v: '0.5.20', ngay: '2026-11-03',
    vi: [
      'Excel: thêm sheet Đơn giá (ô nhập nền vàng, Dự toán tham chiếu sang đây) và sheet Theo tòa (từng tòa gộp theo lô)',
      'Sửa rải hầm: dự án nhiều hơn 12 lô có tòa không còn bị rải đi rải lại không dứt (cache đẩy kết quả nhau); sức chứa cache 64 lô',
    ],
    en: [
      'Excel: new Unit prices sheet (yellow input cells, the Cost estimate reads from it) and By building sheet (buildings grouped by plot)',
      'Basement layout fix: projects with more than 12 built plots no longer re-run the layout forever (cached results evicted each other); cache now holds 64 plots',
    ],
  },
  {
    v: '0.5.19', ngay: '2026-11-03',
    vi: [
      'Xuất Excel theo brand LEO: có bìa, biểu diện tích (sàn theo khối, theo lô, cơ cấu căn, hầm và chỗ đỗ), dự toán bằng công thức Excel',
      'Sửa nút XLS xoay mãi: xuất không chờ rải hầm nữa (số chỗ đỗ ước theo diện tích hầm)',
    ],
    en: [
      'Excel export in LEO brand: cover, area schedule (floor area by volume and plot, unit mix, basement and parking), cost estimate with live Excel formulas',
      'Fixed the XLS button spinning forever: the export no longer waits for the basement layout (parking counts are estimated from basement area)',
    ],
  },
  {
    v: '0.5.18', ngay: '2026-11-03',
    vi: [
      '3D: kính cửa sổ khối tháp trong hơn (xanh nhạt, nhìn xuyên thấy nội thất)',
      '3D khối đế: cột / vách đặt theo mặt bằng căn hộ của tầng điển hình — mỗi góc căn một cột, góc chung của hai căn kề gộp một; góc sát đường bao lùi vào sau vách kính',
    ],
    en: [
      '3D: tower window glass is clearer (light blue, interiors show through)',
      '3D podium: columns / walls follow the typical-floor apartment plan — one column per unit corner, shared corners of neighbouring units merged; corners on the outer edge sit behind the curtain wall',
    ],
  },
  {
    v: '0.5.17', ngay: '2026-11-03',
    vi: [
      '3D khối đế: kính vách trong suốt (nhìn xuyên thấy cột, vách lõi, mép sàn), cột chu vi 600 và vách lõi xám bê tông đậm hơn dầm / sàn nên đọc rõ sau kính',
    ],
    en: [
      '3D podium: transparent curtain-wall glass (columns, core walls and slab edges show through); 600 mm perimeter columns and core walls in a darker concrete grey so they read clearly behind the glass',
    ],
  },
  {
    v: '0.5.16', ngay: '2026-11-03',
    vi: [
      '3D khối đế dựng chi tiết: sàn dày 150, dầm biên cao 700, giữa là vách kính 3.150 chia đố (đố đứng nhịp 1,2 m, một đố ngang ở cao 2,4 m); cột chu vi và vách lõi cắm thẳng từ khối tháp xuống chân đế; áp cho mọi tầng đế (4 m mỗi tầng); dầm nhô 15 mm để không trùng mặt với sàn tháp',
    ],
    en: [
      '3D podium modelled in detail: 150 mm slab, 700 mm edge beam, 3,150 mm curtain wall between (vertical mullions every 1.2 m, one transom at 2.4 m); perimeter columns and core walls run straight down from the tower to the podium base; applied to every podium storey (4 m each); beams project 15 mm to avoid coplanar faces with the tower slab',
    ],
  },
  {
    v: '0.5.15', ngay: '2026-11-03',
    vi: [
      '3D kiểu Vật liệu như app cũ: tường ghi sáng, dải mép sàn trắng ngà, kính xanh lam, khung / lan can xám than; nét viền mảnh và nhạt hơn',
      'Xoay / zoom 3D không còn giật, nháy: mặt cắt gần của camera tối thiểu 0,5 m và tăng theo khoảng cách (như app cũ)',
    ],
    en: [
      '3D Material style like the old app: light-grey walls, ivory slab bands, blue glass, charcoal frames / railings; thinner, lighter edge lines',
      'No more stutter or flicker when rotating / zooming 3D: camera near plane is at least 0.5 m and grows with distance (as in the old app)',
    ],
  },
  {
    v: '0.5.14', ngay: '2026-11-03',
    vi: [
      'Mô hình trắng 3D: chỉ khối nhà màu trắng; ô đất, mặt nước, đường, cây giữ màu (cây xanh), nền và trời không còn trắng',
    ],
    en: [
      '3D white model: only the building masses are white; plots, water, roads and trees keep their colours (green trees), and the ground and sky are no longer white',
    ],
  },
  {
    v: '0.5.13', ngay: '2026-11-03',
    vi: [
      '3D hết nhấp nháy: nền luôn thấp hơn mọi ô đất và đường, các ô đất chồng nhau không còn cùng mặt phẳng, mặt cắt gần của camera tăng theo khoảng cách; nét viền khối (tầng, góc) không còn đứt đoạn khi xoay / zoom',
    ],
    en: [
      '3D no longer flickers: the ground sits below every plot and road, overlapping plots no longer share a plane, the camera near plane grows with distance; building edge lines (floors, corners) no longer break up while rotating / zooming',
    ],
  },
  {
    v: '0.5.12', ngay: '2026-11-03',
    vi: [
      'Hộp hỏi riêng của app thay hộp xác nhận / nhập tên của trình duyệt (xoá, nhân bản dự án, thu hồi quyền, thay lô, lưu mẫu cài sẵn, lưu góc nhìn 3D…): cùng kiểu chữ và nút với app, nút nguy hiểm màu đỏ, Enter đồng ý, Esc huỷ',
    ],
    en: [
      'In-app dialogs replace the browser confirm / prompt boxes (delete, duplicate project, revoke rights, replace plots, save presets, save 3D views…): same type and buttons as the app, red for destructive actions, Enter confirms, Esc cancels',
    ],
  },
  {
    v: '0.5.11', ngay: '2026-11-02',
    vi: [
      'Màn chờ đăng nhập / đăng ký phủ lên trang chủ: Đăng nhập · Đăng ký tài khoản mới (họ tên, mail công ty, phòng, ghi chú) · Đã gửi yêu cầu · Chờ duyệt; trang Quản trị hiện hồ sơ từng người',
    ],
    en: [
      'Sign-in / registration screen over the home page: Sign in · Register a new account (name, company email, team, note) · Request sent · Pending approval; the Admin page shows each person\'s profile',
    ],
  },
  {
    v: '0.5.10', ngay: '2026-11-02',
    vi: [
      'Xoá dự án có hộp xác nhận; dự án bị xoá vào thùng rác 30 ngày, quản trị khôi phục được rồi mới xoá hẳn (dọn tự động mỗi ngày)',
      'Trang Quản trị gọn hơn: mỗi người / dự án một dòng, danh sách dự án thu gọn, có thùng rác và nút xoá / khôi phục',
    ],
    en: [
      'Deleting a project asks for confirmation; deleted projects stay in the trash for 30 days so the admin can restore them before they are removed for good (daily automatic cleanup)',
      'Tidier Admin page: one line per person / project, collapsible project list, trash with delete / restore buttons',
    ],
  },
  {
    v: '0.5.9', ngay: '2026-11-02',
    vi: [
      'Đăng nhập mail công ty (Cloudflare Access): mail công ty đăng nhập lần đầu ở trạng thái chờ duyệt; quản trị duyệt / từ chối / thu hồi ở trang Quản trị, duyệt trước được cả mail chưa đăng nhập; mỗi dự án ghi người tạo',
    ],
    en: [
      'Company-email sign-in (Cloudflare Access): a company email signing in for the first time is pending; the admin approves / rejects / revokes on the Admin page and can pre-approve any email; every project records its creator',
    ],
  },
  {
    v: '0.5.8', ngay: '2026-11-02',
    vi: ['Hộp Vị trí: thêm nút "Mở Google Earth 3D" (bay tới đúng toạ độ, hướng theo góc Bắc) và "Xuất KML" (ranh lô, chỉ giới, khối tòa đùn theo chiều cao) để kéo vào Google Earth'],
    en: ['Location box: new "Open in Google Earth 3D" (flies to the set coordinates, heading from the north angle) and "Export KML" (lot boundaries, setback lines, tower volumes extruded to height) to drop into Google Earth'],
  },
  {
    v: '0.5.7', ngay: '2026-11-02',
    vi: [
      'Danh sách dự án: nhân bản cả dự án (mã + mã sửa mới); thêm cột Dân số; số căn mỗi loại kèm tỉ lệ % (vd 814 (10%)); cột Sửa lúc có cả giờ và tên người sửa gần nhất (tự khai, hỏi một lần khi sửa, đổi ở ô "Tên bạn")',
      'Kéo tòa mượt hơn nhiều (dời gốc toạ độ cho Clipper, nhớ khối đế, đo khoảng cách có lọc hộp bao)',
      'Rà soát nút và panel: thanh trên gọn, thanh công cụ TMB gộp Ràng buộc / Công cụ, "?" một nút, Nhập liệu gộp; panel Tầng bỏ trùng, Hầm có lọc "chỉ hiện mục chưa đạt", TMB trái gộp Thiết lập dự án',
    ],
    en: [
      'Project list: duplicate a whole project (new code + edit code); new Population column; unit counts show their % share (e.g. 814 (10%)); the Edited column shows time and the last editor (self-declared, asked once when editing, change it in "Your name")',
      'Much smoother tower dragging (Clipper origin shift, memoised base footprints, bbox-pruned distance checks)',
      'Buttons and panels audit: slimmer top bar, TMB toolbar menus, single "?" button, merged Import menu; Floor panel de-duplicated, Basement "failing items only" filter, TMB left merged into Project settings',
    ],
  },
  {
    v: '0.5.6', ngay: '2026-11-02',
    vi: [
      'Màn Tầng · kéo căn: thả căn lên căn ở DÃY KHÁC thì chuyển căn sang dãy đó (chèn trước / sau theo phía con trỏ, dãy gốc co lại, dãy đích dài ra); thả cùng dãy hoặc giữ Alt vẫn đổi chỗ (XC-15)',
    ],
    en: [
      'Floor screen · drag units: dropping a unit on a unit of ANOTHER row now moves it there (inserted before / after by the pointer side, the source row shrinks, the target row grows); dropping on the same row, or holding Alt, still swaps (XC-15)',
    ],
  },
  {
    v: '0.5.5', ngay: '2026-11-02',
    vi: [
      'Công cụ: cập nhật chỉ tiêu Long Biên theo sheet VTK_Tháp (17) và ghi chú sửa PA hàng loạt qua cổng công cụ (không đổi giao diện).',
    ],
    en: [
      'Tooling: Long Bien targets updated from the VTK_Tháp (17) sheet and notes on bulk PA edits via the tool gateway (no UI change).',
    ],
  },
  {
    v: '0.5.4', ngay: '2026-11-02',
    vi: [
      'Màn Tầng: nút "Reset mặt bằng về mẫu gốc" — bỏ mọi sửa tay của tòa (đổi căn, công năng ô, lật ô, tầng riêng, thang / căn / hành lang đặt tay, STRETCH, tủ PCCC) rồi tự chỉnh lại từ mẫu gốc của app; hoàn tác được',
    ],
    en: [
      'Floor screen: "Reset floor plan to original template" button — drops every manual edit of the tower (unit swaps, cell functions, flipped cells, per-floor layouts, hand-placed stairs / units / corridor ends, STRETCH, hose cabinets) and re-runs auto-adjust from the original app template; undo available',
    ],
  },
  {
    v: '0.5.3', ngay: '2026-11-02',
    vi: [
      'Menu chuột phải ô › Đổi căn: chỉ đổi đúng những ô đang chọn (trước đây đổi luôn mọi căn cùng mẫu); chọn nhiều căn cùng mẫu thì đổi cả nhóm; "Sửa nhiều căn" mặc định tắt',
    ],
    en: [
      'Cell right-click › Change unit: only the selected cells change (it used to change every unit of the same type); several selected same-type units change together; "Edit many units" is now off by default',
    ],
  },
  {
    v: '0.5.2', ngay: '2026-11-02',
    vi: [
      'Màn Tầng: "Căn đang chọn" gọn hơn và đặt ngay sau bảng chỉ tiêu tầng — tên mẫu, 3 ô số liệu, STRETCH một hàng; bỏ nhóm Công năng ô và danh sách đổi mẫu (đổi công năng vẫn ở menu chuột phải ô)',
      'Tổng mặt bằng: tên tòa co theo cỡ từng tòa (dự án dài không còn chữ to chồng chéo); dòng "22T · 399 căn" chỉ hiện ở tòa đang chọn hoặc khi phóng to; tắt tên tòa ở Lớp › Tên tòa',
    ],
    en: [
      'Floor screen: "Selected unit" is more compact and now sits right after the floor targets table — name, 3 figures, one-row STRETCH; the cell-function group and the template swap lists are removed (cell function is still in the cell right-click menu)',
      'Site plan: building names scale with each building (no more huge overlapping text on long sites); the "22T · 399 units" line shows only for the selected building or when zoomed in; Layers › Building names turns them off',
    ],
  },
  {
    v: '0.5.1', ngay: '2026-11-02',
    vi: [
      'Mẫu chữ L / chữ T: đầu hành lang ở cánh dài có tay nắm co kéo và tự kéo dài tới cửa căn xa nhất (trước đây đoạn nối chồng lên trục chặn mất)',
      'Tổng mặt bằng: nhãn khoảng cách vi phạm (LO-01, §2.6.1) nhỏ hơn, chỉ hiện ở tòa đang chọn, tắt được ở Lớp; kiểm vi phạm bỏ qua cặp tòa ở xa và dùng lại khi chỉ phóng / dời khung nên bớt lag',
    ],
    en: [
      'L / T templates: the free corridor end on the long arm now has its pull handle and auto-extends to the farthest unit door (an overlapping link segment used to block it)',
      'Site plan: distance violation labels (LO-01, §2.6.1) are smaller, shown only on selected buildings and can be switched off in Layers; the violation check skips far-apart pairs and is reused while only panning / zooming, so it lags less',
    ],
  },
  {
    v: '0.5.0', ngay: '2026-11-02',
    vi: [
      'STRETCH căn: bỏ bù ngược sang căn kề — chỉ căn đã chọn đổi, dãy tự dồn khít theo quy tắc (không khít thì báo, giữ nguyên)',
      'Chuột phải ô căn: "Chọn mọi căn cùng mẫu"; STRETCH áp cho mọi căn đang chọn; "Áp dụng sửa cho" chép sang các tòa cùng mẫu',
    ],
    en: [
      'Unit STRETCH: no more compensation on the neighbouring unit — only the selected units change and the run re-fits by rule (if it cannot, it says so and keeps the layout)',
      'Right-click a unit: "Select all units of this type"; STRETCH applies to every selected unit; "Apply edits to" copies to same-type towers',
    ],
  },
  {
    v: '0.4.11', ngay: '2026-11-02',
    vi: [
      'Cổng window.unitmixTools (mở trang với ?congCu=1): Claude Code / trình duyệt nhúng gọi thẳng bộ công cụ Leo AI trên kho thật, không qua vòng AI — ít token, vẫn một bước hoàn tác',
      'Màn Tầng, 3D: hết nháy sọc khi bật ảnh vệ tinh (tắt mặt đất nền); không còn cây trong lô cao tầng',
    ],
    en: [
      'window.unitmixTools gate (open with ?congCu=1): Claude Code / embedded browser call the Leo AI tools directly on the real store — no AI loop, fewer tokens, still one undo step',
      '3D: no more flicker with satellite imagery (base ground hidden); no trees inside high-rise lots',
    ],
  },
  {
    v: '0.4.10', ngay: '2026-11-02',
    vi: [
      'Đề bài KD: đọc được bảng ma trận kiểu VTK (dòng = mẫu tháp, cột = loại căn STU / 1PN+ / 2PN-N / 2PN+…): gộp số căn các mẫu, tính tỷ lệ cơ cấu và DT căn trung bình',
    ],
    en: [
      'Sales brief: reads VTK-style matrix tables (rows = tower templates, columns = unit types): sums unit counts, derives the mix and the weighted average unit area',
    ],
  },
  {
    v: '0.4.9', ngay: '2026-11-02',
    vi: [
      'Tổng mặt bằng: tên lô co theo bề rộng lô, nhỏ hơn trước — không còn che khối tháp đã xếp',
      'Nạp DXF: ký hiệu có hậu tố "(TT)" (nhà ở thấp tầng) thành ô nền, không chọn được',
    ],
    en: [
      'Site plan: plot names scale with plot width and are smaller — no longer cover placed towers',
      'DXF import: labels ending "(TT)" (low-rise housing) become background plots, not selectable',
    ],
  },
  {
    v: '0.4.8', ngay: '2026-11-02',
    vi: [
      'Nạp DXF theo lớp ranh: lô mang ký hiệu CX / GD / CC / TMDV / HTKT / DT / QP / CN thành ô nền (tô màu theo loại đất, chìm xuống, không chọn được); chỉ NOTM / NOXH / TĐC… là ô đất ở làm việc',
    ],
    en: [
      'DXF import by boundary layer: plots labelled CX / GD / CC / TMDV / HTKT / DT / QP / CN become background plots (tinted by land type, muted, not selectable); only NOTM / NOXH / TĐC… stay as working residential plots',
    ],
  },
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
