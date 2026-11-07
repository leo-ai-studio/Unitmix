/**
 * Lịch sử phiên bản — mỗi bản vài dòng thật ngắn (người dùng yêu cầu). Mới nhất ở trên. Nâng phiên bản thì thêm một mục ở đầu
 * và sửa số trong package.json, web/package.json, package-lock.json (3 chỗ).
 */
export type MucPhienBan = { v: string; ngay: string; vi: string[]; en: string[] };

export const LICH_SU_PHIEN_BAN: MucPhienBan[] = [
  {
    v: '0.8.5', ngay: '2026-11-07',
    vi: [
      'Xuất 3D: tổng thể SketchUp bản nhẹ, toạ độ dời về gần gốc, sửa sai số 6–25 cm ở toạ độ VN2000',
      'Chi tiết mỗi mẫu tòa một tệp (.dae cho SketchUp, .ifc cho Revit), gói .zip; tầng giống nhau là component dùng chung nên mở nhanh',
      'Xuất BIM gốc cho Revit: tường, sàn, cửa, phòng, thang bộ, lỗ thông tầng, lưới trục theo cánh tòa, 12 tờ hồ sơ mỗi bố cục; mặt bằng điển hình đúng bản xuất CAD',
    ],
    en: [
      '3D export: light whole-project SketchUp file, moved near the origin, fixes a 6–25 cm error at VN2000 coordinates',
      'Detail per tower type, one file each (.dae for SketchUp, .ifc for Revit) in a .zip; identical floors share components so files open fast',
      'Native BIM export for Revit: walls, floors, doors, rooms, stairs, shaft openings, grids along tower wings, 12 sheets per layout; the typical plan is exactly the CAD export',
    ],
  },
  {
    v: '0.8.4', ngay: '2026-11-07',
    vi: [
      'Nút mũi tên ở mép khung giữa thu gọn panel trái, phải; bản vẽ giữ nguyên tỉ lệ, app nhớ trạng thái',
      'Màn Chi phí có panel trái riêng: đi nhanh tới Dự toán, Tài chính, Khối lượng và phạm vi lô, tòa được tính',
      'Trang Dự án gọn hơn: Mở, So sánh, Chép link ở ngoài, việc khác vào menu, Xoá nằm cuối',
    ],
    en: [
      'Arrow tabs at the center view edges collapse the left and right panels; the drawing keeps its scale and the app remembers',
      'The Cost screen has its own left panel: jump to Estimate, Finance, Quantities and see which lots and towers are counted',
      'Tidier Projects page: Open, Compare and Copy link stay visible, the rest moves to a menu with Delete last',
    ],
  },
  {
    v: '0.8.3', ngay: '2026-11-06',
    vi: [
      'Ô số: chỉ tính lại khi rời ô, Enter hoặc Ctrl+S, Esc huỷ; gõ một số là một bước hoàn tác',
      'Số tầng: tầng điển hình tối đa 80, tầng đế tối đa 20; xoá trống ô không còn thành 0',
    ],
    en: [
      'Number fields apply on leaving the field, Enter or Ctrl+S, Esc cancels; one typed number is one undo step',
      'Floors: up to 80 typical and 20 podium floors; clearing a field no longer sets it to 0',
    ],
  },
  {
    v: '0.8.2', ngay: '2026-11-06',
    vi: ['Bản vẽ: bấm chuột trái chọn được căn và tòa trở lại; kéo dời bản vẽ giữ nguyên, kéo ra ngoài khung rồi thả không bị kẹt'],
    en: ['Drawing: left-click selects units and towers again; panning is unchanged, and dragging outside the frame no longer sticks'],
  },
  {
    v: '0.8.1', ngay: '2026-11-06',
    vi: [
      'Xếp tòa: Bảng so sánh phương án cả màn; Xếp hàng loạt chạy cùng bộ xếp với từng lô (22 lô trong khoảng 25 giây), chọn nhanh Tất cả hoặc theo loại nhà ở',
      'So sánh mẫu: thêm cột Số tòa / lô và Căn / lô theo chỉ tiêu; hoa gió thật của dự án, bóng đổ giữa các tòa, tòa chữ L ôm góc, nút vừa lô',
      'Xuất PDF: hộp tuỳ chọn kiểu trình bày, lớp, màu và độ dày nét; TMB lớn, keyplan và hoa gió ở góc trang',
    ],
    en: [
      'Tower layout: full-screen option board; batch layout uses the same engine per lot (22 lots in about 25 s), quick select All or by housing type',
      'Template comparison: towers / lot and units / lot columns from the limits; real project wind rose, shading between towers, corner L towers, fit-lot button',
      'PDF export: options for style, layers, line colour and weight; large site plan, key plan and wind rose in the page corner',
    ],
  },
  {
    v: '0.8.0', ngay: '2026-11-06',
    vi: [
      'Xếp tòa trong lô: Xếp tòa đang có (giữ nguyên tòa) hoặc Tự tổ hợp (sát DTXD, cơ cấu), mỗi chế độ 10 phương án trong vài giây',
      'Chấm mỗi phương án theo nắng, gió, view, mặt phố, sân; chọn tiêu chí ưu tiên',
      'Thư viện mẫu tòa thành mục riêng, mỗi mẫu một dòng; chữ trên bản vẽ đúng cỡ khi zoom',
    ],
    en: [
      'Tower layout: Rearrange existing towers or Auto mix (near max footprint, unit mix), 10 options each in seconds',
      'Each option scored on sun, wind, view, street frontage and courtyard; choose a priority',
      'Tower library moved to its own compact section; drawing labels now scale with zoom',
    ],
  },
  {
    v: '0.7.9', ngay: '2026-11-05',
    vi: [
      'Gợi ý xếp tòa: 5–10 phương án theo kiểu Hai dãy, So le, Dãy kết hợp, Một dãy, Quanh sân, Tự do (học từ M34, M7, Long Biên); chọn mẫu tòa để xếp, xem hình nhỏ từng phương án',
      'Đề bài kinh doanh: chọn nhà ở thương mại, xã hội, tái định cư; đọc được Excel theo loại, ảnh và PDF (qua Leo AI)',
      'Gộp Tự động và Chỉnh tay thành Chỉnh sửa; panel trái, phải gọn lại, bớt mục trùng',
      'Báo cáo PDF: bảng tổng hợp so sánh với quy hoạch, trang tầng có màu loại căn, kích thước, bảng unit mix, thang máy, keyplan',
      'Đã gộp vào bản chính: Thư viện mẫu, thay lõi, đo và kích thước, chọn tỉnh khi tạo dự án',
    ],
    en: [
      'Tower suggestions: 5–10 options by layout type (two rows, staggered, mixed rows, single row, around a court, free), learned from M34, M7, Long Bien; pick templates, thumbnail per option.',
      'Business brief: choose commercial, social or resettlement housing; reads Excel by type, plus images and PDF through Leo AI.',
      'Auto and Manual merged into Edit; left and right panels tidied, duplicates removed.',
      'PDF report: summary against planning, floor pages with unit colours, dimensions, unit-mix table, elevators, key plan.',
      'Now in the main build: template library, core swap, measuring and dimensions, province on project creation.',
    ],
  },
  {
    v: '0.7.8', ngay: '2026-11-05',
    vi: [
      'Màn Hầm chỉ tính số: DTXD hầm, số chỗ ô tô / xe máy theo hệ số và theo QCVN 04 — mặt bằng hầm (ô đỗ, ram, khoang cháy) chưa hoàn thiện nên tạm gỡ; 3D bỏ hầm',
    ],
    en: [
      'Basement screen now only computes numbers: built area and car / motorbike spaces by coefficient and by QCVN 04 — the basement layout (stalls, ramp, fire compartments) is unfinished and removed for now; 3D drops the basement.',
    ],
  },
  {
    v: '0.7.7', ngay: '2026-11-04',
    vi: [
      'Màn Tầng: xoá căn thì dãy dồn khít về mốc chặn (sát lõi / góc cánh), đầu tự do co lại — không còn chừa chỗ hở cạnh lõi',
    ],
    en: [
      'Floor screen: deleting a unit packs the row toward the stop mark (next to the core / wing corner) and shrinks the free end — no more gap beside the core.',
    ],
  },
  {
    v: '0.7.6', ngay: '2026-11-04',
    vi: [
      'Màn Tầng: mốc chặn theo app cũ (QT-49) — tòa Z / U / L bỏ hoặc thêm thang thì dãy co giãn ở đầu tự do, đầu sát lõi / góc cánh giữ nguyên',
      'Leo AI: dùng được nhà cung cấp khác Claude (Ollama, LM Studio, Gemini, OpenAI, OpenRouter) trong Cài đặt',
    ],
    en: [
      'Floor screen: stop marks as in the old app (QT-49) — on Z / U / L towers, removing or adding a stair stretches the free end; the end next to the core / wing corner stays put.',
      'Leo AI: can use providers other than Claude (Ollama, LM Studio, Gemini, OpenAI, OpenRouter) from Settings.',
    ],
  },
  {
    v: '0.7.5', ngay: '2026-11-03',
    vi: [
      'Màn Tầng: tay nắm kéo đầu hành lang không còn nhảy về chỗ cũ sau khi thả hay biến mất khi có phép tay khác chạy nền; lần kéo đầu tiên nhanh hơn (worker dựng sẵn).',
    ],
    en: [
      'Floor screen: corridor-end handles no longer jump back after release or vanish while another background edit runs; the first drag is faster (worker pre-started).',
    ],
  },
  {
    v: '0.7.4', ngay: '2026-11-03',
    vi: [
      'Màn Tầng: dời / bỏ thang bộ thì dồn khít về mốc chặn — dãy không có lõi thang máy giữ đầu khít mép cánh kia (tòa L), đầu còn lại mới co lại',
    ],
    en: [
      'Floor screen: moving / removing a stair now packs units toward the stop mark — a row without a lift core keeps its end flush with the other wing (L towers), the other end shrinks',
    ],
  },
  {
    v: '0.7.3', ngay: '2026-11-03',
    vi: [
      'Màn Tầng: bỏ chặn đầu hành lang theo cửa căn — kéo đầu hành lang tự do, chỉ còn đoạn ngắn nhất 3 m và dài thêm tối đa 20 m',
    ],
    en: [
      'Floor screen: corridor ends are no longer blocked by unit doors — drag freely; only a 3 m minimum segment and +20 m maximum remain',
    ],
  },
  {
    v: '0.7.2', ngay: '2026-11-03',
    vi: [
      'Màn Xếp tòa: bỏ phím Backspace xoá tòa — gõ "ee" bằng Telex / Unikey bắn một Backspace giả làm xoá nhầm tòa; xoá tòa chỉ bằng phím Delete',
    ],
    en: [
      'Tower layout: Backspace no longer deletes towers — typing "ee" with a Telex / Unikey IME fires a synthetic Backspace that removed towers by mistake; only the Delete key deletes',
    ],
  },
  {
    v: '0.7.1', ngay: '2026-11-03',
    vi: [
      'Màn Tầng: căn có tủ PCCC đặt sát tường (tường xây sau lưng tủ) được trừ DT thông thủy như app cũ — tem căn, "Căn đang chọn" và DT sử dụng 1 sàn đều ghi số sau trừ',
    ],
    en: [
      'Floor screen: units with a fire cabinet against the wall (masonry behind it) now have that area deducted from net area as in the old app — unit label, selected unit and floor usable area show the deducted figure',
    ],
  },
  {
    v: '0.7.0', ngay: '2026-11-03',
    vi: [
      'Màn Tầng: mục mới "Chép bố cục sang tòa khác" — chép TOÀN BỘ bố cục tầng của tòa đang xem sang các tòa cùng mẫu: tick từng tòa, cả lô hoặc cả dự án (mẫu nào cũng dùng được, một lần hoàn tác trả lại tất cả)',
    ],
    en: [
      'Floor screen: new "Copy layout to other towers" — copies the WHOLE floor layout of the tower in view to same-type towers: tick towers, whole plot or whole project (works for any type, one undo reverts all)',
    ],
  },
  {
    v: '0.6.5', ngay: '2026-11-03',
    vi: [
      'Màn Tầng: kéo căn đổi chỗ với căn khác bề ngang (1PN ↔ STU) chỉ đổi đúng hai căn đó; nếu tự chỉnh khít buộc đổi thêm căn thứ ba thì từ chối và giữ nguyên, không tự biến căn bên cạnh',
    ],
    en: [
      'Floor screen: dragging a unit to swap with a different-width unit (1BR ↔ studio) now changes exactly those two units; if the auto-fit would have to re-type a third unit the swap is refused and nothing changes',
    ],
  },
  {
    v: '0.6.4', ngay: '2026-11-03',
    vi: [
      'Màn Tầng: đầu hành lang kéo quá giới hạn (−20 m) không còn "kẹt" — số lưu được cắt về độ dời thật, tay nắm nằm đúng chỗ và kéo ra ngoài có tác dụng ngay',
    ],
    en: [
      'Floor screen: a corridor end dragged past its limit (−20 m) no longer gets "stuck" — the stored value is trimmed to the real offset, the handle sits in the right place and dragging outward works at once',
    ],
  },
  {
    v: '0.6.3', ngay: '2026-11-03',
    vi: [
      'Màn Tầng: căn kẹp giữa lõi và thang bộ (lõi | căn | thang) xóa / đổi sang mẫu khác bề ngang / thêm căn được — thang và các căn phía đầu tự do trượt theo; trước đây báo "để lại khe 6000 mm" hoặc không đổi được',
    ],
    en: [
      'Floor screen: a unit sandwiched between the core and a stair (core | unit | stair) can now be deleted, swapped to a different-width template or have a unit added — the stair and the units towards the free end slide along; before it reported a 6000 mm gap or refused the change',
    ],
  },
  {
    v: '0.6.2', ngay: '2026-11-03',
    vi: [
      'Màn Tầng · kéo căn sang dãy khác: thả vào GIỮA căn đích thì ĐỔI CHỖ hai căn; thả ở MÉP căn đích (một phần tư hai đầu) thì CHUYỂN căn sang, chèn vào khe giữa căn đích và căn kề — trước đây thả đâu cũng chuyển nên không đổi chỗ được',
    ],
    en: [
      'Floor screen · drag a unit to another row: dropping on the MIDDLE of the target swaps the two units; dropping on its EDGE (outer quarters) moves the unit and inserts it in the gap next to the target — before, any drop moved it, so swapping was impossible',
    ],
  },
  {
    v: '0.6.1', ngay: '2026-11-03',
    vi: [
      'Cầu MCP đổi cổng mặc định sang 3043 (3033 trùng cầu AI của Leo AI): mở app với ?congCu=1&mcp=3043; đã thử trọn vòng Claude ↔ Chrome ↔ app',
    ],
    en: [
      'MCP bridge default port is now 3043 (3033 clashed with the Leo AI bridge): open the app with ?congCu=1&mcp=3043; verified end to end Claude ↔ Chrome ↔ app',
    ],
  },
  {
    v: '0.6.0', ngay: '2026-11-03',
    vi: [
      'Leo AI đỡ tốn token: mỗi câu hỏi chỉ gửi kèm ngữ cảnh gọn (PA, màn hình, lô cao tầng + số tòa theo mẫu) thay vì mọi lô + mọi tòa; get_state mặc định ẩn lô nền, đọc riêng vài lô bằng lot_ids; lịch sử dài bỏ ngữ cảnh của câu cũ',
      'Cầu MCP cho Claude Code (scripts/mcp_unitmix): mở app với ?congCu=1&mcp=3043 là Claude Code gọi thẳng công cụ app như công cụ gốc — gọi nhiều lệnh một lượt, chạy hàm tính trong trang, kết quả cắt gọn theo yêu cầu',
    ],
    en: [
      'Leo AI uses fewer tokens: each question carries a compact context (plan, screen, high-rise lots + tower counts per template) instead of every lot and tower; get_state hides background lots by default, read a few lots with lot_ids; long histories drop the context of older questions',
      'MCP bridge for Claude Code (scripts/mcp_unitmix): open the app with ?congCu=1&mcp=3043 and Claude Code calls the app tools as native tools — batch calls, in-page scripts, results trimmed on request',
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
