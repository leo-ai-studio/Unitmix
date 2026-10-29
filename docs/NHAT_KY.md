# Nhật ký làm việc (mới nhất ở trên)

Mỗi đợt một mục: ngày, ai làm, đã làm gì (kèm commit), kiểm thế nào, còn dở gì. Ngắn, đủ để phiên sau làm tiếp không phải dò lại.

## 2026-10-29 · Dân số: ô Khu vực đô thị / nông thôn · Đồng Nai phòng ở + mốc biên · tỉnh trọng điểm sau sáp nhập · agent Opus

**Chủ nhiệm đã chốt:** Hà Nội TĐC = mặc định quốc gia 32 m²/người; Đồng Nai thêm ô "Khu vực"; phòng ở theo QĐ địa phương, không có thì QCVN; Phú Yên bỏ qua; tỉnh trọng điểm HN, TP.HCM, An Giang (Kiên Giang, Phú Quốc), Hưng Yên.

**Nguồn đã đọc (29/10/2026):** vbpl.vn trang mới (`/van-ban/chi-tiet/a--<ItemID>`; curl bị chặn, đọc qua Browser pane), danh sách gợi ý tìm kiếm "phương pháp xác định dân số" = toàn bộ QĐ địa phương trong CSDL: HN 34/2024 + 39/2026, TP.HCM 32/2025 + 83/2026, BR-VT 43/2023, Hải Dương 11/2024, Tiền Giang 80/2024, Quảng Ninh 31/2022, Đà Nẵng 19/2026, Đồng Nai 09/2025, Phú Yên 05/2025, Bình Thuận 31/2023, Huế 24/2025. Không có An Giang, Kiên Giang, Phú Quốc, Hưng Yên, Thái Bình. Công báo Hưng Yên mới / Hưng Yên cũ / Thái Bình cũ (tìm trích yếu "dân số", "chung cư"): không có. Lược đồ vbpl: QĐ 34/2024 HN chỉ bị QĐ 39/2026 tác động; QĐ 32/2025 TP.HCM chỉ bị QĐ 83/2026 sửa. QCVN 04:2021/BXD (kho local) 1.4.21 định nghĩa phòng ở, mục 4.2 giao UBND tỉnh; TT 31/2026 sửa QCVN 04 chỉ về xe điện. QCVN 01:2026/BXD (TT 46/2026, hiệu lực 01/01/2027) — chỉ lấy được trang Thông tư, chưa có thân quy chuẩn.

**Mã:**
- `KhaiDanSo.khuVuc?: 'doThi' | 'nongThon'` (`kieu.ts`, thiếu = đô thị, PA cũ không cần chuyển đổi); `PhuongPhap` `sTb.nongThon` (trị số nông thôn); `theoKhuVuc`, `coPhanBietKhuVuc` (`quyTacDanSo.ts`); `quyTacApDung().khuVuc { ap, phanBiet, sTb }`, `khuVucKhai(lo)` (`danSo.ts`). Ô "Khu vực" ở `KhaiDanSo.tsx` chỉ hiện khi phương pháp giai đoạn đang khai có hai trị số (hiện chỉ Đồng Nai giai đoạn quy hoạch: 31,0 / 28,5); Dashboard ghi "Nông thôn: 28,5 m² sàn/người".
- Đồng Nai: `SO_PHONG_O['2pnp']` 2 → 3 theo QCVN 04:2021 1.4.21 ("phòng ở là phòng ngủ và phòng sinh hoạt khác"; phòng đa năng = phòng sinh hoạt khác; khách – bếp chung không đếm vì dải DT của khoản 3 chỉ khớp cách đếm này). `BangDanSo.tuTren` (mốc dưới "từ trên" không lấy). Khoản 4 cài đúng: DT ngoài dải cột số phòng → cột số phòng gần nhất có dải chứa DT (trước: dòng gần nhất + cờ). Mốc 125 theo lời văn điểm a–d (bảng tóm tắt bỏ trống đúng 125).
- Tỉnh mới `ag` "An Giang (gồm Kiên Giang cũ, Phú Quốc)", `hy` "Hưng Yên (mới, gồm Thái Bình cũ)": `qd: null` → mặc định quốc gia mọi loại hình, ghi chú nơi đã rà. `QuyTacTinh.trongDiem` + `dsTinhChon()`: danh sách chọn tỉnh có nhóm "Tỉnh trọng điểm" (HN, TP.HCM ×2, An Giang, Hưng Yên) đứng đầu.
- Test `danSo.test.ts` +18 ca (tính tay: 2.820 m² / 31 = 90,97; / 28,5 = 98,95; / 32 = 88,125; Đồng Nai 2PN+ 85 → 3,5, 68 → 2,5 khoản 4, 2PN 45 → 1,5, 125 → 3,5, 3PN 70 → 2,5). Đổi kỳ vọng cũ: 2PN+ 130 m² 4,5 → 5; 1PN 80 m² 2 (cờ trên) → 3 (khoản 4).

**Kiểm:** `node scripts/kiem.mjs` ĐẠT (tsc, web 727, worker 9, pytest 15, build). Trên app (vite worktree 5391 + wrangler 8787, dự án thử `78tmpsaf`): danh sách tỉnh có hai nhóm; Đồng Nai giai đoạn cấp phép không có ô Khu vực, giai đoạn quy hoạch có; chọn Nông thôn → dashboard "Nông thôn: 28,5 m² sàn/người", tải lại trang vẫn giữ.

**Chờ chủ nhiệm:** cách đếm phòng ở (2PN+ = 3, khách – bếp không đếm) là diễn giải QCVN 04 1.4.21; khoản 4 Đồng Nai chọn "cột số phòng gần nhất" khi một dòng DT có nhiều cột; S ÷ 32 không làm tròn. Khi An Giang / Hưng Yên ban hành QĐ dân số chung cư thì thay mục `ag` / `hy`. Đọc thân QCVN 01:2026 khi có bản trong kho.

## 2026-10-29 · Điện thoại: hộp nhập bảng QH không bấm được Áp · rà mọi hộp / lớp nổi · agent Opus

**Lỗi người dùng báo** (iPhone thật, iOS Safari ~390×844): màn TMB, hộp "Nhập bảng chỉ tiêu quy hoạch" sau khi nạp Excel thì thân hộp cuộn xuống dưới dock (Nhập / ↶ ↷ / Số liệu), không bấm được Áp; tiêu đề bảng xem trước đè dòng, bảng bị cắt ngang.

**Nguyên nhân:** hộp render TRONG ngăn kéo đáy (`.ngan-keo`, `position: fixed; z-index: 24`) → kẹt trong lớp xếp chồng của ngăn, dưới dock (z 26) dù hộp z-index bao nhiêu; iOS còn cắt phần tử fixed trong khung cuộn `-webkit-overflow-scrolling`. Thân hộp flex cột có `max-height` + `overflow` nên bảng xem trước bị bóp còn 2 dòng (flex-shrink), tiêu đề dính đè dòng. Dòng bảng `min-width: 1060px` < tổng cột + khe (1106) nên nền tiêu đề cụt trước cột cuối. Hộp cao `100dvh` không co khi bàn phím iOS mở.

**Đã làm** (`1261adf`, `39cb719`):
- `ui/LopNoi.tsx` (portal ra `<body>`) cho hộp bảng QH, đề bài KD, xuất CAD, xem căn 3D (`man/NhapChiTieu.tsx`, `NhapDeBai.tsx`, `HopXuatCad.tsx`, `ManTang.tsx`).
- `ui/manHep.ts` `theoDoiKhungNhin()` (gọi ở `main.tsx`): visualViewport → `--vv-h` / `--vv-y` / `--vv-duoi` + `html.ban-phim` khi đáy bị che ≥ 120 px (bỏ qua khi đang chụm phóng).
- `styles/dien-thoai.css`: hộp z 40 trên dock, cao `--vv-h`, thân cuộn trong hộp, hàng nút chân hộp `.chan-hop` dính đáy (Huỷ · Áp chia đều, né `safe-area-inset-bottom`), điện thoại dọc ≤ 600 px thành tấm trượt từ đáy; bảng xem trước cuộn ngang / dọc trong khung riêng (cao ≤ 50 % phần nhìn thấy), tiêu đề dính nền đặc, cột ký hiệu lô dính trái (`unitmix.css`); bàn phím mở thì ngăn kéo bám mép bàn phím, dock ẩn. Đầu hộp So sánh PA dính trên.
- Rà thêm: trang Dự án (hàng PA rộng 980 px phải vuốt ngang mới thấy Mở PA → xuống dòng, nút 44 px, ô nhập 16 px); 375 px nút ⋯ bị đẩy ra ngoài thanh trên → thanh khít hơn; xuất CAD ô nhập 12 px → 16 px, nút Tải 44 px; đề bài KD ô dán 12 px → 16 px; menu cấp `maxHeight` 100vh → `--vv-h`; nhóm nút / dòng bảng cơ cấu trong ngăn, lớp hiển thị góc bản vẽ, VI / EN trang Dự án ≥ 40 px. Desktop: hộp tạo dự án (`<form>`) nay có nền thẻ như các hộp khác.
- `scripts/kiem_man_hep.mjs`: thêm khung 375×812; mỗi khung mở từng hộp / lớp nổi (bảng QH nạp `scripts/mau_kiem/chi_tieu_man_hep.xlsx` — số giả, đề bài KD, xếp hàng loạt, chú giải / hướng dẫn / lớp, menu ⋯ / cấp, xuất CAD chỉ mở hộp không tải, trang Dự án: tạo dự án không bấm Tạo, so sánh PA) và đo: nút chân hộp thấy ngay + `elementFromPoint` ra chính nút, nút chính khác cuộn tới được, giả bàn phím `--vv-h` 55 %, ô nhập ≥ 16 px, nút ≥ 40 px, hộp không tràn ngang, bấm đóng thì đóng. `--khong-hop` để bỏ phần hộp.

**Kiểm:** `node scripts/kiem.mjs` ĐẠT (tsc, web 701, worker 9, pytest 15, build). `node scripts/kiem_man_hep.mjs --url http://127.0.0.1:5432 --du-an 2mlg1a2l --ma-sua …` (dự án thử 6 lô, 2 PA, tạo qua API ở wrangler 8787 có sẵn) ĐẠT mọi khung 375×812 / 390×844 / 430×932 / 844×390 / 768×1024 / 1024×768 / 1440×900; khung giữa không đổi (390: 0,48,390,740; 1440: 270,52,870,848). Ảnh `docs/anh/mobile/01-nhap-chi-tieu-{truoc,sau}-390.png`, `02-…-cuon-ngang`, `03-…-ban-phim-gia`, `04-danh-sach-du-an-{truoc,sau}`, `05-so-sanh-pa`, `06-tao-du-an`.

**Còn dở:** chưa thử trên iPhone thật (bàn phím thật, thanh địa chỉ co giãn) — chỉ giả bằng `--vv-h`; hộp xem căn 3D (màn Tầng → chọn căn) chưa có trong kiem_man_hep; lịch sử phiên bản trong màn soạn ẩn ở màn hẹp (vẫn mở được ở trang Dự án); máy bàn chế độ chỉ xem: thông báo "Đang xem chỉ đọc" đè nhóm nút TMB (nút đã tắt, có từ trước).

## 2026-10-29 · 3D: chọn căn góc V theo hình thật · khối đế chọn được · tô nhấn theo chiều sâu · agent Opus

- Ba ghi chú còn dở của đợt "3D: chọn lô… FPS" (commit 77455c6 + sau đó chỉnh độ đậm):
  - **Căn góc V / chữ L**: `CanChon.hinh` = `khungTaiO` (khung thật của mẫu căn, chiều sâu `sau_mm` như khối 3D), `canTaiDiem` / `hinhNhanToa` dùng `hinhCan` (hình thật, căn chữ nhật vẫn ô `goc`). Mỗi tầng dò theo nét bao của chính nó (`BanDoChonToa.chanTang` ← `mauTang(t).duong_bao`, tầng tự chỉnh / tầng riêng bớt căn thì tia đi qua chỗ trống). Test 5 tòa V (tm-v1…v4, xh-v1, 10 căn V): bắn tia vào giữa 137 cạnh ngoài → đúng 137 (dò ô chữ nhật cũ: 121). tm-t2 nay đúng mọi căn (trước chịu sai 2). Trên app tm-v4, quét lưới 12 px khung Công trình: điểm ra căn V 18 → 531, ra "tầng" (trượt khỏi căn) 525 → 30.
  - **Khối đế**: `DoiTuong3D` thêm `de`. Công trình: `chonTiaToa` trả `DE_TOA` khi đế che trước; bấm → chọn tòa + lô, panel sang Thông số tòa (đang ở màn Tầng thì chuyển TMB, bấm lại căn / tầng thì về Tầng), chip "Khối đế · n tầng · DT một sàn đế" (`m3d.chonDe`, `khoiDe` + `dtVung` như chỉ tiêu lô); bấm đúp → TMB 2D. Toàn dự án: mesh khối đế gắn `userData.chon = de` + `deToa`; bấm → tòa gần điểm chạm (`toaGanDiem`, đế chung nhiều tòa), tô đế theo tòa chọn / rê (`trungRo`). Trước đây tia xuyên đế chọn tòa / lô phía sau.
  - **Tô nhấn không xuyên vật che**: bỏ `depthTest: false` (`xuyen`); khối `theTich` vẽ kiểu shadow volume bằng stencil (mặt sau sau mặt cảnh +1, mặt trước −1, tô chỗ ≠ 0 rồi xoá) — chỉ tô mặt nhìn thấy trong khối, khối lõm vẫn đúng, mặt cắt ngang vẫn lộ sàn trong căn. Khối nở 0,25 m, hạ 3 cm. `WebGLRenderer({ stencil: true })` (three r170 mặc định tắt). Thêm 2 lượt vẽ khi có chọn / rê; cảnh gộp hình không đổi (Công trình tm-v4: 20 → 21 draw call khi đang chọn căn, dựng lại vẫn nhớ hình).
- Kiểm trên app (vite 5430, API 8787 có sẵn, Edge headless + CDP, dự án `zutlg8xr` pa-1 tm-v4, chỉ xem): ảnh `docs/anh/3d/10-cong-trinh-chon-khoi-de.png`, `11-chon-can-{truoc,sau}.png`, `12-can-bi-che-{truoc,sau}.png` (góc Tây Bắc, căn chọn ở mặt sau: trước hiện xuyên tòa, sau không thấy). Test `ve3d/chonToa3d.test.ts` +5 ca.
- Còn dở: tô nhấn khi camera nằm trong khối (rất gần) tô cả phần phía sau; khối đế Công trình vẽ theo chân tháp (chưa nới `deOffset` như Toàn dự án); chưa thử stencil trên máy thật iOS / Android.

## 2026-10-29 · câu báo "0 → N" ở thao tác đầu tiên · mọi phép tay màn Tầng chạy nền · agent Opus

- **Câu báo "Căn / tầng: 0 → N"** (commit d761166): `baoThaoTac.soCanTang` lấy `baoCao.soCan` của mặt bằng lưu. PA chưa có `ToaDat.matBang` thì mặt bằng mặc định không có báo cáo, nên ra 0. Giờ khi thiếu báo cáo thì đếm căn trên mặt bằng hiệu dụng đang vẽ (`mauHieuDung` + `boCucTang`), giống số trên nhãn màn Tầng. Test `tinh/baoThaoTac.test.ts`: tm-u1 / xh-z4 / tm-t2 trên PA mới, xoá một căn ra N → N-1. Trên app xh-z4 PA mới xoá căn báo 23 → 22 (trước 0 → 22).
- **Phép tay chạy nền** (commit sau d761166, xem `docs/de_xuat_hieu_nang.md` mục 13):
  - `useChay` gửi `PhepTay` (tên + đối số chép được) qua `dieuPhoiTay` (`tinh/tayNen.ts`, `BANG_TAY` có đủ mọi phép tay + `goiYGiuCan`).
  - Trong lúc chờ, bản vẽ hiện mặt bằng tạm (`hinhNhanh`: đổi ô, chưa tự chỉnh; `datTam` / `goTam` có mã lượt; `useToaTam` trong `TangVe`) và vòng `spin-o` ở thanh công cụ.
  - Có kết quả cuối mới ghi, một bước hoàn tác. Lượt mới huỷ lượt cũ.
  - Kéo thả dò ô đích trên worker riêng `dieuPhoiDo`; thả lúc đang dò thì chờ đúng lượt đó.
  - `LopPhong` nhớ tâm vòng nội tiếp theo hình phòng. Đây là phần còn chặn 50–90 ms sau khi chuyển tự chỉnh sang nền.
- Kết quả: luồng chính bị chặn khi xoá căn trên PA mới giảm từ 272–419 ms xuống 0 ms ở xh-z4 và 68–74 ms ở tm-t2 (phần này là lượt vẽ lại Preact dev, không phải tự chỉnh). Xoá thang giảm từ 158–185 ms xuống 0. Dò khi rê giảm từ 224–531 ms xuống 0. Đứng lớn nhất còn 18–79 ms. Câu báo và số căn trùng bản cũ ở mọi ca.
- Chuẩn kết quả: `phaHoaiChay.ts` tách `phepNgauNhien` (giữ đúng thứ tự rút số ngẫu nhiên) và chạy phép qua `chayPhep`. Phá hoại hạt 0 / 101 / 202 / 303 vẫn 0 vi phạm. `tinh/tayNen.test.ts` thêm 5 ca: chuỗi phép ngẫu nhiên qua worker giả y hệt đồng bộ (xh-z4, tm-t2, tm-v4), PA mới, lượt mới huỷ lượt cũ, hình học nhanh, mặt bằng tạm.
- Đo: vite 5428, API 8787, Edge headless + CDP, dự án thử `dfux96ui` (pa-1 xh-z4, pa-2 tm-t2). Kịch bản `do.mjs` trong scratchpad đặt lại PA trước mỗi ca, tự nhận hộp thoại rời trang.
- `npm run kiem` ĐẠT (web 696 · worker 9 · pytest 15 · build).
- Bẫy:
  - Worktree agent không có `node_modules`: tạo junction `web/node_modules` và `worker/node_modules` trỏ về repo chính (đã gitignore). Thiếu `worker/node_modules` thì `vitest worker` HỎNG.
  - Kịch bản CDP mở lại trang mà không bật `Page.enable` sẽ treo ở hộp thoại "rời trang" (cảnh báo đóng tab của trình soạn).
  - `(node … &)` trong Bash của agent bị giết khi lệnh trả về: dùng chạy nền của công cụ.
- Còn dở:
  - Lượt vẽ lại SVG mặt bằng lớn (tm-t2 42 căn) ~70–80 ms ở chế độ dev; chưa đo bản build.
  - Kết quả tới chậm hơn 0–150 ms do dựng / gửi worker.
  - Bấm phép mới trong lúc chờ sẽ huỷ phép trước, không xếp hàng. Phép trước mất, đúng theo yêu cầu "lượt mới huỷ lượt cũ".

## 2026-10-29 · nét bao mẫu V theo hình bao thật · PC-11 dò lại nhanh + ⟲ chạy nền · chụm hai ngón khi bật ✥ · agent Opus

- **Nét bao mẫu V** (commit 6ac4e7d): căn góc V không phải chữ nhật — `can.json` thêm `khung` (nét `khung` DefPoints chuẩn hoá, 4 căn tm-2pn-v1/v2, tm-3pn-v1, xh-2pn-v1) qua `scripts/sinh_phai_sinh_can.py`; `matBang.khungTaiO` đặt khung vào ô như `veCanTaiViTri` (app cũ `bienCan = c.khung || c.pts`). `tinh/netBao.ts`: ô đặc căn V theo khung; hành lang co / giãn cũng tính là sàn (như `sanPrims` app cũ); bỏ dải mảnh do làm tròn mm trước khi nới 700 mm (hai mép thẳng hàng lệch 1–3 mm cho dải dài cả mặt, nới ra cắt đôi nét bao); lấp hốc ≤ 1 m mà phần nới khoét vào sàn chung trong tòa. `thaoTacTay.chotSua`: căn V đè ô / lõi theo hình bao thật (`deKhung`) = đè → từ chối, như p20b `vaCham` app cũ (trước: đổi chỗ căn V vào giữa dãy được nhận vì kiểm theo ô chữ nhật).
  - Phá hoại 24 bước (vi phạm trước → sau): hạt 101: 0 → 0 · hạt 202: 4 (tm-v2 1, tm-v4 3) → 0 · hạt 303: 3 (tm-v1, tm-v3, xh-v1) → 0 · hạt 0 × 24: 0 → 0. Bài thử kiểm ô theo khung (đỉnh nét bao mẫu V cách ô: nền 1.793–2.031 mm theo ô chữ nhật → 6–150 mm theo khung, chặt hơn).
  - Thân bài sang `tinh/phaHoaiChay.ts`; `phaHoaiHat101/202/303.test.ts` × 24 bước chạy song song ở `npm run kiem` (đủ 33 mẫu), `kiem:nhanh` lấy mẫu 1/4. `PHA_HOAI_GHI` / `PHA_HOAI_DUMP` với hạt thêm ghi `<tệp>.<hạt>.json`.
  - Trên app (1440×900, tm-v4, xoá CH ô 3:0): trước nét bao còn nguyên cái nêm của căn V đã xoá (tam giác thừa, DTXD 1.449,5 m²) → sau bo theo căn còn lại (1.436,0 m²). Ảnh `docs/anh/xep-can/{truoc,sau}-11-v4-xoa-can-goc-v.png`, `sau-11-v4-mat-bang.png`.
- **PC-11 dò lại từ đầu** (commit 8939f95, fb1ddc3):
  - Thuật toán (kết quả y hệt — khoá thang / nét bao / số căn / DTXD / công năng 0 lệch trên 33 mẫu × 4 phép): `pccc.dungDoThi` nhớ đồ thị hành lang theo đúng toạ độ (LRU 256, kèm bảng Dijkstra), `chieu` nhớ theo toạ độ cửa; `hanhLangToiCua` nhớ cửa của mặt bằng mặc định, dò cửa trùng bằng lưới 1 mm. Đo `tuChinhToa` dò lại từ đầu (33 mẫu × 24 tầng, trung vị 3 lần, máy đang tải): tổng 3.273 → 2.528 ms; xh-z4 395 → 309, xh-z2 289 → 213, tm-t2 272 → 217, tm-u1 267 → 165, tm-z3 233 → 151 ms; còn 6 mẫu > 150 ms (trước 9) — chưa đạt đích < 150 ms bằng thuật toán (PC-11 ~85 % thời gian, ~600–1.200 phương án mỗi lần dò, mỗi phương án 0,2–0,3 ms: kéo hành lang + thoát nạn).
  - Nên ⟲ "thang về tự động" chạy nền: `tinh/tayNen.ts` (`DieuPhoiTay` như hamNen) + `tinh/thaoTay.worker.ts`; thư viện / dữ liệu lõi gửi một lần; lượt mới / thao tác tay khác huỷ lượt cũ (terminate); chỉ ghi khi tòa chưa đổi trong lúc chờ; nút hiện `spin-o`. Trên app xh-z4 (thêm thang thứ 3 rồi ⟲): trước bấm chặn luồng chính 272 ms (task dài 321 ms, khung hình hở 273 ms) → sau 7 ms, khung dài nhất 17 ms, kết quả tới sau 398 ms, cùng kết quả (23 căn, DTXD 1.768,7 m²). Test `tinh/tayNen.test.ts`.
- **Chụm hai ngón khi bật ✥** (commit dc17f55): `CongCuTang.batDau` với ngón / bút không chặn `pointerdown` mà đánh dấu `camUng.khongDiBanVe` — BanVe ghi nhận ngón nhưng không dời bản vẽ, không hẹn nhấn giữ; ngón thứ hai (`ngonKhiKeoO` = 'chum') huỷ kéo căn và để BanVe chụm. Chuột chặn như cũ. Edge headless + CDP 390×844 (`Input.dispatchTouchEvent`, vite 5427, API 8787, dự án thử `zutlg8xr` pa-1 tm-v4 / pa-2 xh-z4): trước bản vẽ trôi, không phóng (×1,00) + báo "Thả ra ngoài ô" → sau phóng ×5,00, không bóng kéo, không báo; kéo một ngón CH-02 ↔ CH-03 vẫn đổi chỗ, bản vẽ đứng yên. Ảnh `docs/anh/mobile/{truoc,sau}-chum-khi-bat-keo*.png`, `sau-keo-mot-ngon-doi-cho-390x844.png`. Test `ve/camUng.test.ts` (+4).
- `npm run kiem` ĐẠT (web 685 · worker 9 · pytest 15 · build), khung giữa 1440×900 vẫn 270,52,870×848; 390×844 0,48,390×740.
- Bẫy: config vite đặt ngoài `web/` thì `@preact/preset-vite` nạp sai (default không phải hàm) — để tệp config tạm trong `web/` (`cacheDir` riêng), xoá khi xong; con node của vite sống sót khi dừng tác vụ nền → dừng theo PID. PA thử tự lưu sau mỗi thao tác — chạy lại kịch bản phải đặt lại PA (PUT `/api/du-an/<mã>/pa/<id>`). Ô góc V: tâm khung bao có thể rơi ra ngoài ô, bấm bằng `dispatchEvent('click')` lên `path[data-o]`.
- Còn dở: PC-11 dò lại từ đầu vẫn 150–310 ms ở 6 mẫu lớn trên luồng chính khi phép khác (xoá / đổi chỗ…) không giữ được tập thang cũ — mới chạy nền cho ⟲; muốn hết thì đưa cả `useChay` vào worker (đối số các phép phải chép được) hoặc dò thoát nạn tăng dần. Câu báo "Căn / tầng: 0 → N" ở thao tác đầu tiên trên PA chưa có mặt bằng lưu (có sẵn từ trước, chưa sửa). Chưa thử chụm trên máy thật iOS / Android.

## 2026-10-29 · Giao diện điện thoại / máy tính bảng + cảm ứng 2D / 3D · agent Opus

- Yêu cầu: tối ưu cho điện thoại; thao tác mượt, không che công cụ; zoom hai ngón; chạm chọn tòa, lô; tương tác được.
- Đã làm:
  - Bố cục ≤ 1024 px (`ui/manHep.ts`, `styles/dien-thoai.css`, `ui/KhungSoan.tsx`, `ui/ThanhTren.tsx`). Bản vẽ / 3D chiếm gần trọn màn: 390×844 có khung giữa 390×740, 768×1024 có 768×920.
  - Panel trái / phải thành ngăn kéo trượt từ đáy. Dock dưới có Nhập · ↶ ↷ · Số liệu. Kéo tay cầm xuống để đóng (`ui/nganKeo.ts`), Esc cũng đóng. Ngăn đang đóng có `inert`.
  - Thanh trên một hàng 48 px: logo · TMB / Tầng / Hầm (nhãn ngắn `buoc.ngan.*`) · 2D / 3D / Chi phí · ⋯. Dải cấp, chế độ sửa, trạng thái lưu, XLS / CAD, VI / EN gom vào menu ⋯.
  - Điện thoại nằm ngang (cao ≤ 520): dock thành cột phải. Máy tính bảng: ngăn rộng 440 px, Nhập bám trái, Số liệu bám phải.
  - Né tai thỏ bằng `viewport-fit=cover` + `env(safe-area-inset-*)`. Nút ≥ 40–44 px, ô nhập 16 px. Thanh TMB và thanh 3D một hàng, vuốt ngang trong thanh. Màn Tầng: nhãn tầng một dòng, thanh công cụ tay xuống hàng dưới, không đè hoa gió. Thông báo, thanh ô chọn, chip 3D xuống đáy khung giữa.
  - Cảm ứng 2D (`ve/camUng.ts` thuần + `ve/BanVe.tsx`):
    - Đang kéo / chụm chỉ đổi CSS `transform` của SVG trong rAF. Nhấc tay mới đặt viewBox, vẽ lại một lần. Quán tính cũng chạy bằng transform.
    - Chạm hai lần = phát `dblclick`, nhấn giữ 520 ms = phát `contextmenu` lên phần tử dưới ngón, nên tòa / ô căn / lõi dùng lại handler chuột. Bản gốc trình duyệt tự phát bị chặn để menu không mở hai lần. Click khi nhấc tay sau nhấn giữ bị nuốt, vì nó trúng mục menu vừa mở.
    - Ngưỡng run tay khi chạm là 10 px (chuột 4 px).
  - TMB (`man/ManXepToa.tsx`):
    - Ngón đặt lên tòa CHƯA chọn thì kéo là dời bản vẽ; chỉ tòa đã chọn mới kéo bằng một ngón.
    - Chạm tòa / lô chọn bằng hit-test trong `bamNen` (`data-toa`, `data-lo`). Chạm nền bỏ chọn.
    - Menu ngữ cảnh tòa (chuột phải / nhấn giữ): mở mặt bằng tầng, xoay 90°, lật, nhân bản, khoá, xoá (`HopNoi` export từ `ve/MenuO.tsx`).
  - 3D (`ve3d/Khung3D.tsx`, chỉ phần điều khiển): `touches` ONE = xoay, TWO = chụm phóng + dời, `screenSpacePanning`. Đặt ngón thứ hai thì cả lượt không còn là chạm, nên ngón đầu đứng yên khi chụm không chọn nhầm.
- Kiểm:
  - `npm run kiem` ĐẠT (web 505/505; mới `ve/camUng.test.ts` 11 ca: chạm / kéo / chụm / giữ, chạm hai lần, phóng quanh tâm, chụm + dời, transform khớp vẽ lại).
  - `scripts/kiem_man_hep.mjs` (mới, cần vite + API): đo tràn ngang, nút bị che, nút < 40 px, thanh trên ra ngoài mép. Chạy ở 390×844, 430×932, 844×390, 768×1024, 1024×768, 1440×900 qua TMB, Tầng, Hầm, 3D, Chi phí, hai ngăn, menu ⋯: ĐẠT. Cỡ 1440×900 khung giữa vẫn 270,52,870×848 như trước.
  - Edge headless + CDP (`mobile: true`, dpr 3; máy tính bảng 768×1024), chạm qua `Input.dispatchTouchEvent`, vite 5426, API 8787, dự án thử `12alnif0` (chép PA 16 lô / 3 tòa của `xhwv7fzo`):
    - TMB 12/12: chụm 80 → 280 px phóng đúng ×3,5, tâm lệch 0 px; đang chụm viewBox đứng yên; chạm chọn tòa / lô / bỏ chọn; kéo tòa đã chọn; kéo từ tòa chưa chọn thì dời bản vẽ; nhấn giữ mở menu; chạm hai lần mở Tầng.
    - 3D 8/8. Ngăn / Tầng 6/6: kéo tay cầm đóng ngăn, chụm MB tầng, nhấn giữ ô căn mở menu công năng.
    - Ảnh ở `docs/anh/mobile/` (đã giảm còn 256 màu cho nhẹ).
- Bẫy:
  - Sau kéo nhanh, quán tính còn chạy khoảng 1 s. Đo toạ độ phần tử ngay lúc đó sẽ lệch (chạm đầu tiên dừng trôi).
  - Menu mở tại điểm nhấn giữ nên click khi nhấc tay trúng mục đầu → phải nuốt ở `window`, không chỉ trong `.ban-ve`.
  - `Set-Content -Encoding utf8` của PowerShell 5 thêm BOM.
- Còn dở:
  - Chưa thử trên máy thật iOS / Android. iOS chặn phóng trang bằng `gesturestart` + `touch-action`, chưa kiểm.
  - Màn Tầng: chế độ ✥ kéo đổi chỗ (`man/CongCuTang.tsx`, không thuộc phạm vi) chặn lan truyền `pointerdown` trên ô, nên khi bật ✥ thì chụm bắt đầu trên ô không phóng được.
  - Màn Hầm vẽ ranh bằng chạm chưa thử.
  - Ngăn kéo chưa có nấc nửa / đầy.
  - Hộp thoại lớn (Nhập bảng QH) trên điện thoại mới chỉ cuộn được, chưa tối ưu.
## 2026-10-29 · xếp căn: quy tắc thang bộ (2–3, luôn N2 + N3) · nét bao bo theo ô · phá hoại 126 → 0 · thao tác tay nhanh · agent Opus

Người dùng: "đường bao bo lại, đảo / xoá / di chuyển căn, xoá / thêm thang, dồn khít không mượt như app cũ … có khe hở, thang không đúng quy chuẩn, không tối ưu thang, chỉ được mắc 3 thang, mặc định 2, luôn một N2 và một N3 — cho mọi tòa, mọi phương án".
- **Quy tắc thang bộ** (quy tắc 7 trong AI_START): `ganLoaiThang` (tinh/loiThang.ts) gán N2 / N3 ở mặt bằng mẫu, sau mọi tự chỉnh, tầng riêng theo tầng chung (`loaiTheoChung`); `ToaDat.loaiThang` lưu loại chọn tay. PC-11 như `datThangBo` app cũ: tối ưu với 2 thang (cặp thang của bản vẽ) trước, thang thứ 3 chỉ khi 2 thang còn căn vượt. Thêm tay quá 3 → chặn `nhieu_thang`; hợp thang liền không vượt 3; thang tay > 3 (PA cũ) cắt về 3 (`catThangThua`). Đổi loại `doiLoaiThangTay` + nút N3 | N2 ở thanh công cụ màn Tầng (đổi N2 duy nhất → thang gần nhất thành N2), nhãn N2 / N3 trên bản vẽ. Mở PA cũ: `chuanHoaThang` (tinh/macDinh.ts) gán lại loại; số thang ngoài 2…3 thì bỏ mặt bằng lưu. Test `tinh/thangBo.test.ts`.
- Số thang sau PC-11 (33 mẫu, 24 tầng): trước 4 mẫu 2 thang / 29 mẫu 3 thang, toàn N3 → sau 5 mẫu 2 thang (tm-i2, tm-i3, tm-l1, tm-v4, xh-i1) / 28 mẫu 3 thang, mẫu nào cũng ≥ 1 N2 + ≥ 1 N3; số căn / tầng không mẫu nào giảm, căn vượt 0.
- **Thử phá hoại** `tinh/phaHoai.test.ts` (như `thu_pha_hoai.js` app cũ): mọi mẫu (kiểm nhanh 1/4), hạt cố định, 14 bước (nhanh 8): xoá / thêm / đổi chỗ / lật căn, thêm / xoá / dời thang, đổi N2/N3, dồn khít, thang về tự động, hoàn tác. Bất biến: 0 đè / khe mới (khe ≤ nền + 200 mm, không cộng dồn), nét bao khớp ô đặc (góc ô đã đổi trong nét bao ±700 mm, đỉnh nét bao cách ô / hành lang / lõi ≤ nền + 60 mm), DTXD = DT nét bao, 2–3 thang có N2 + N3, số căn báo cáo = mặt bằng = cơ cấu, tự chỉnh lại bất động. Env: `PHA_HOAI_GHI` (tổng kết), `PHA_HOAI_DUMP` (trạng thái phép vi phạm đầu), `PHA_HOAI_HAT`, `PHA_HOAI_BUOC`. **Mốc 126 phép vi phạm / 33 mẫu → 0** (hạt 101 × 24 bước cũng 0; hạt 202 × 24 bước còn 4 ở tm-v2 / tm-v4 — xem còn dở).
- Sửa theo phá hoại: nét bao co ở đầu dãy để lại gai / viền thừa (noiNetBao chỉ thay cạnh đầu mặt) → `gonDaGiac` + `gotDauThua` (đầu tự do thừa / thiếu so với ô thì gọt / nới) + `tinh/netBao.ts` dựng lại bằng boolean như `duongBao0` app cũ khi nét nối dần hỏng (sàn mất nở 700 mm trừ ô còn + hành lang + lõi; cộng sàn mọc thêm; đóng khe ≤ 500 mm); thang tay neo vào căn đã bị gỡ thì neo theo vật thể còn lại (trước: thang mất → ép lại làm dãy trôi 15–30 m); đổi chỗ một bên không vừa → từ chối cả phép `khong_vua` (trước thành đổi mẫu một bên).
- **Nhanh**: PC-11 giữ tập thang lần trước khi vẫn đạt (`datLaiThang`, không tệ hơn số căn vượt lần trước; lệch chỗ thì dò lại) — thang không nhảy chỗ khi sửa căn, giữ khoá → giữ loại N2/N3. Đo trong phá hoại (462 phép): trung vị 9–15 ms, p90 ~100 ms, mẫu lớn p90 125–140 ms (trước: lật / xoá tm-t2, tm-u1 ~200–300 ms mỗi phép); phép cần dò lại từ đầu (⟲, thêm thang) còn 300–600 ms. Dò hợp lệ khi kéo dùng cùng phép nên cũng nhanh theo.
- Trên app (vite 5425 bản mới / 5426 bản 3927f37 dựng tạm để chụp "trước", API 8787, dự án thử sao `gwym3l6i` tm-u1: `b4scfd69`, `sngazpo4` sau; `fiaoa9kq`, `c2cwbziz` trước; 1440×900, Edge headless + CDP): `.panel-giua` 270,52,870×848 mọi bước. PA cũ toàn N3 mở ra hiện N3 · N2 · N3. Thêm thang khi đủ 3: cũ "Thao tác để lại khe 0 mm. Đã trả về" → mới "Tòa đã đủ 3 thang bộ … Không thêm". Xoá căn đầu dãy 2:8: cũ nét bao đỏ còn gai thò ra ngoài hai cánh → mới bo theo ô. Xoá thang N2: còn N3 + N2; xoá tiếp → "phải giữ ít nhất 2 thang (một N2 + một N3)"; ⟲ về 3 thang, 32 căn. Đổi loại: "Đã đổi Thang bộ mặt 1 sang N2. Tòa: 2 N2 · 1 N3". Ảnh `docs/anh/xep-can/{truoc,sau}-{1-mat-bang,2-them-thang,3-xoa-can,8-xoa-thang-n2,9-xoa-thang-chan,10-thang-tu-dong,6-doi-loai,7-lat}.png`.
- `npm run kiem` ĐẠT (tsc · web 566 · worker 9 · pytest 15 · build).
- Còn dở: mẫu V (tm-v2, tm-v4) căn góc V không phải chữ nhật — nét bao boolean dựng theo ô chữ nhật nên vài phép (hạt khác) để đỉnh nét bao xa ô 2–4 m (cần hình bao thật của căn từ `can/<id>.json`); phép phải dò PC-11 lại từ đầu vẫn 300–600 ms (chưa chạy Web Worker); ghi chú QT-69 "dài ra 1700 mm" tính trước khít đoạn kẹp nên có thể lệch nét bao cuối; đổi loại thang chưa ghi vào quy_tac.json (mới ở AI_START + tooltip); xoá thang có thể gỡ nhiều căn vì thoát nạn (đúng luật, có gợi ý ⟲).

## 2026-10-29 · 3D: chọn lô kiểm trên app, chọn căn / tầng ở Công trình, nhớ hình tầng, FPS · agent Opus

- Yêu cầu: (1) kiểm bấm chọn lô trên app thật (phần lô trống ngoài chân tòa); (2) chế độ Công trình bấm chọn căn / tầng, rê thì tô nhấn, bấm đúp căn mở màn Tầng đúng tầng + căn; (3) dựng lại tòa không đổi hình < 20 ms, giảm lần đầu; (4) đo FPS khi xoay camera.
- Đã làm:
  - Chọn lô: raycast đúng (chỉ dò mesh có `userData.chon`, không trúng đất / hầm). Lỗi thật: khi bật Hầm lô bán trong suốt nên pha màu chọn gần như không thấy → lớp phủ xanh mỏng + viền trên mặt lô (`CanhDung.hinhNhan` / `doiTuongChon` trong `ve3d/dungDuAn.ts`, vẽ ở `Khung3D`).
  - Công trình: `ve3d/chon3d.ts` thêm đối tượng `tang` / `can` + dò tia thuần `chonTiaToa` (lăng trụ thân tháp, khối đế che, bỏ phần trên mặt cắt ngang, căn chứa điểm chạm theo mặt bằng / bố cục của chính tầng đó), `hinhNhanToa`, `doiTuongDangChonToa`, `chonSauBamToa`. `dungToa` trả `chon` (bản đồ chọn). `Khung3D`: `CanhDung.chonTia` (dò tia thay raycast lưới 1,8 triệu tam giác), lớp phủ tô nhấn bán trong suốt + viền (chọn đậm, rê nhạt, kiểu tia X xuyên mặt che), `chuThich` (chip thông tin căn trong khung, không chiếm chỗ — `styles/chon-3d.css`). `MoHinh3D`: `thongTinChonToa` (Tầng · CH-xx · loại · DT thông thủy). `SoanThao`: `onChonToa` → `canKhoa` + tầng (`chonTangToa` mới ở `man/ManTang.tsx`, đặt thẳng store chọn tầng, chạy cả khi ô ChonTang chưa gắn), `onMoToa` → màn Tầng 2D đúng tầng + căn. Bấm nền → về bố cục chung, bỏ căn.
  - Dựng nhanh: `dungToa` dựng mỗi mẫu căn một lần rồi biến đổi mảng đỉnh vào từng ô; nhớ tầng đã gộp (LRU 48), khối đế / mái (LRU 16), nét nhân tầng; khoá theo tên vật liệu nên đổi kiểu vẽ dùng lại hình. `stretch3d.khoi3dTheoId` nhớ khối căn kéo. `Khung3D` dựng cảnh mới trước rồi gỡ cảnh cũ, không huỷ hình còn dùng.
  - Móc kiểm mới trên `.vung-3d`: `_chamThu(x, y)` (đối tượng trúng khi bấm ở x, y px trong khung), `_doFps(giay)` (xoay camera bằng rAF, trả FPS / ms khung).
- Số đo (chi tiết `de_xuat_hieu_nang.md` mục 12): dựng `tm-t2` 24 tầng (vitest) 120–132 → 39–56 ms lần đầu, dựng lại 0,6–0,7 ms; `tm-i1` 78–87 → 30–32 ms, dựng lại < 1 ms. Trên app (GPU RTX 3060): vào Công trình lần đầu 74–93 ms, đổi kiểu vẽ 0,8–6,9 ms, quay lại Công trình 4–5 ms. FPS xoay camera: GPU có vsync 60 / 60 (Toàn dự án / tòa 1,87 triệu tam giác), tắt vsync 2.711 / 437; swiftshader (CPU) 9,5 / 0,6 FPS TB.
- Kiểm trên app (Edge headless GPU + CDP, vite 5424, API 8787, PA `tztd1udv/pa-1`, chỉ xem): bấm phần lô trống → bỏ chọn tòa, lô tô xanh + viền; Công trình: bấm căn → dải cấp "Tầng 19 · CH-12", ô tầng 19 sáng ở panel trái, panel phải "Chỉ tiêu tầng · Tầng 19", chip "Tầng 19 · CH-12 · 2PN · DT thông thủy 56,7 m²"; rê căn khác → tô nhạt; bấm mái / lõi → chọn tầng (tô cả tầng); bấm đúp căn → màn Tầng 2D, tầng 19, CH-12 đã chọn. Ảnh: `docs/anh/3d/6-chon-lo.png`, `7-cong-trinh-chon-can.png`, `8-cong-trinh-chon-tang.png`, `9-cong-trinh-bam-dup-mo-tang.png`.
- Bẫy: headless Edge khung tự nhiên 1416×808, `Emulation.setDeviceMetricsOverride` mất khi đóng kết nối CDP → toạ độ bấm / rê lệch với ảnh chụp 1440×900; đặt override ở đầu MỖI lệnh. `Input.dispatchMouseEvent` loại `mouseMoved` phải `button: 'none'`, không thì trang thấy `buttons = 1` (đang kéo) và không rê. Edge headless với profile trống tự đăng nhập / đồng bộ tài khoản máy → chạy `--inprivate --disable-sync --disable-extensions`.
- Kiểm: `npm run kiem` ĐẠT. Test mới `ve3d/chonToa3d.test.ts` (5 ca, có tòa thật), `hieuNang3d.test.ts` thêm chặn dựng lại < 20 ms.
- Còn dở: chạm hai lần trên điện thoại ở Công trình chưa thử trên máy thật; căn ở góc lõm có thể bị căn bên cạnh che khi dò tia (theo chân tháp, không theo hình thật); chưa hạ bóng đổ cho máy không có GPU rời; tầng đế không chọn được.

## 2026-10-29 · Hầm: rải nhanh, xuất XLS không đứng, bản vẽ nhẹ · agent Opus

- Yêu cầu: (1) xuất XLS khi cache hầm trống không làm đứng giao diện; (2) phép rải hầm lô 400×400 m từ 6–16 s xuống < 2 s, KHÔNG đổi kết quả; (3) bản vẽ hầm sau khi rải < 50 ms, đếm nút SVG.
- Đã làm:
  - `tinh/raiCho.ts`: lưới chỉ mục khung bao cho vật cản + cạnh ranh, cắt sớm ngoài khung bao ranh, điểm-trong-ranh theo hàng (tìm nhị phân). Phép thử từng ô vẫn là hàm cũ nên kết quả khớp từng bit.
  - Test đối chiếu `tinh/raiHamDoiChieu.test.ts` + mẫu `tinh/__mau__/hamDoiChieu.json` (6 PA thật từ DB local, chữ ký sinh bằng mã `808abb3`); chữ ký ở `tinh/chuKyHam.ts`.
  - `tinh/hamNen.ts`: `DieuPhoiHam.cho` + `choRaiHamPA`; `xuat/xuatXls.ts`: `xuatBaoCaoPA` chờ worker rồi mới dựng báo cáo; `ui/ThanhTren.tsx`: nút XLS có vòng O `spin-o`, khoá khi chờ; `man/SoanThao.tsx`, `ui/KhungSoan.tsx` một dòng. Test mới trong `tinh/hamNen.test.ts`.
  - `ve/MatBangHam.tsx`: mỗi loại ô một `path`, lớp tĩnh nhớ vnode.
- Số đo (chi tiết `de_xuat_hieu_nang.md` mục 10): rải 400×400 2 tầng 4,4 s → 0,11 s, 5 tầng 12,3 s → 0,14 s; mở tab Hầm tới khi có bản vẽ 8,1 s → 0,53 s; xuất XLS cache trống đứng 8,0 s → ≤ 64 ms (ra tệp sau 0,32 s); nút SVG 6.471 → 20; đổi B1 ↔ B2 91–156 → 22–31 ms.
- Kiểm: `npm run kiem` ĐẠT (web 480/480). Trên app không lỗi console.
- Còn dở: chưa gộp tầng giống nhau trong `raiHamTinh`, chưa chia nhiều worker (không cần ở cỡ hiện tại); chưa đo bằng `vite preview`. Đo hai vite song song phải đặt `cacheDir` riêng (junction `node_modules` dùng chung `.vite` → nạp hai bản preact, trang trắng).
## 2026-10-29 · 3D: kiểu Vật liệu, chọn tòa / lô trong 3D, gộp draw call (P8) · agent Opus

- Yêu cầu: (1) 3D dễ nhìn — tường be ấm theo brand, viền rõ, kính / cửa / khung nhôm / lan can, nhìn xa vẽ dải cửa theo tầng, đất / lô tách khỏi nền ngà; (2) bấm tòa / lô trong 3D toàn dự án ra thông số bên cạnh như 2D, bấm đúp mở mặt bằng tầng; (3) một tòa 24 tầng 2.655 draw call → dưới 100.
- Đã làm:
  - Kiểu `vatlieu` (mặc định, khoá lưu mới `unitmix.kieu-3d.v2`; Brand / Mô hình trắng giữ nguyên): `BANG_MAU` + `taoVatLieu` trong `ve3d/dungCan.ts`. Tường #DDD0B9, đế #CBBFA6, tum #D6CCB9, sàn #C9BFAC, kính #5F7F88 trong 62 % metalness 0,55 có phản chiếu (`RoomEnvironment`, `environmentIntensity` 0,35), dải kính nhìn xa #4E6C76 (polygonOffset), khung nhôm / lan can #3A3F42 kim loại, lover #5B6266, gỗ #8E6F4E, viền / vạch sàn `--logo-ink` #022B1E 62 %, nét mở cửa `--gold`. Nền khung #F1F0EA, mặt đất #C9C3B2, lô cao tầng #E9E4D6; bóng đổ `shadow.intensity` 0,55. Cửa sổ / cửa đi vẫn lấy từ `openings` của mẫu căn như cũ.
  - Chọn trong 3D: `ve3d/chon3d.ts` (thuần: `doiTuongCua`, `doiTuongTrung`, `laBam` ngưỡng chuột 5 px / chạm 12 px / giữ ≤ 700 ms, `laBamDup`, `chonSauBam`, `dangChon`, `nguongLod`). `dungDuAn` gắn `userData.chon` cho mesh / nét tòa và lô; `Khung3D` raycast khi nhả chuột / nhấc ngón (chỉ thêm listener pointer, không đổi OrbitControls), rê chuột tô nhẹ, đang chọn pha màu `--green` + viền xanh, đổi vật liệu chứ không dựng lại. `SoanThao` nối `chon3d` vào `setToaId` / `setLoId`; bấm đúp tòa → `moTang` + về 2D (`KhungSoan` nhận `xem` / `onXem` từ ngoài). Tòa đang xem rời khỏi `khoa` sang `khoaNhe` nên chọn tòa không reset góc nhìn.
  - Hiệu năng (chi tiết `de_xuat_hieu_nang.md` mục 10): `gop` trải InstancedMesh + Line; mỗi bố cục tầng một bộ InstancedMesh theo vật liệu; LOD dải cửa. `tm-t2` 24 tầng: 2.752 → 15 draw call, tam giác đổ bóng 1,81 triệu → 0,52 triệu, nhìn xa 1.812 tam giác; dựng không đổi (~130 ms).
  - Móc kiểm trên phần tử `.vung-3d`: `_chieuDoiTuong()` (toạ độ màn hình tòa / lô), `_doVe()` (draw call / tam giác / ms dựng), `_phong(k)`.
- Ảnh 1440×900 trước / sau (Edge headless + CDP, `--use-angle=swiftshader`): `docs/anh/3d/{1-toan-du-an,2-mot-toa,3-can-toa,4-chon-toa}-{truoc,sau}.png`, thêm `5-toa-xa-sau.png` (LOD dải cửa). Cận tòa: bản trước phóng bằng 5 nấc lăn chuột, bản sau bằng `_phong(0.38)` (lăn chuột qua CDP bị treo ở headless), khung hình xấp xỉ.
- Kiểm: `npm run kiem` ĐẠT. Test mới `ve3d/chon3d.test.ts` (7 ca, có raycast thật), `ve3d/hieuNang3d.test.ts` (2 ca, chặn > 100 draw call). Trên app (CDP, sự kiện con trỏ lên canvas): bấm T2 → thanh trên "T2 · Chữ T", panel trái Thông số tòa T2, bảng phải tô dòng T2, tòa pha xanh; bấm nền → bỏ chọn; kéo 20 px → không đổi chọn; chạm (`pointerType: 'touch'`) i1 → chọn i1; 2D → 3D giữ i1; bấm đúp T2 → màn Tầng · Căn, khung 2D, tòa T2. Bấm lô chỉ kiểm bằng test (tâm lô trên app trùng khối tòa i1).
- Còn dở: chạm hai ngón / điều khiển camera trên điện thoại do agent giao diện điện thoại làm; chưa chọn được trong 3D chế độ Công trình (một tòa); chưa nhớ hình tầng giữa các lần dựng lại; FPS GPU thật chưa đo.

## 2026-10-29 · rải hầm trong Web Worker · agent Opus

- Yêu cầu: lần rải hầm đầu tiên, hoặc khi đổi thông số hầm, giao diện đứng 4,5–14 s. Chuyển `raiHam` sang Web Worker. Ba chỗ gọi (màn Hầm, Chi phí, 3D bật Hầm) chuyển sang bất đồng bộ. Trong lúc chờ phải giữ kết quả cũ, có vòng O "Đang rải hầm…", khung giữa không đổi; đổi đầu vào thì chỉ giữ lượt mới nhất.
- Đã làm:
  - Thêm `tinh/hamNen.ts`: lớp `DieuPhoiHam` theo kênh, có huỷ bằng `terminate`; hook `useRaiHam` / `useNgheHam`.
  - Thêm `tinh/raiHam.worker.ts`.
  - `tinh/ham.ts`: thêm `layNhoHam`, `datNhoHam`, `paGonChoHam`; cache dùng chung giữa worker và bản đồng bộ.
  - Chỗ gọi: `man/ManHam.tsx`, `man/ManChiPhi.tsx` (tham số mới `layHam` của `tinhKhoiLuong`), `ve3d/dungDuAn.ts` + `ve3d/MoHinh3D.tsx` (chỉ phần gọi `raiHam` và `khoaNhe`).
  - Thêm i18n `ham.dangRai` và CSS `.ham-dang-rai` trong `styles/ham.css`.
- Số đo, chi tiết ở `de_xuat_hieu_nang.md` mục 9. Giao diện đứng:
  - mở Hầm lần đầu: 7,9 s → 0;
  - đổi số tầng 2 → 3: 11,7 s → 0,19 s;
  - đổi 3 → 4: 15,7 s → 0,15 s.
  Thời gian tới khi có kết quả vẫn như cũ. `.panel-giua` 1348×854 trước, trong và sau lúc rải.
- Kiểm: `npm run kiem` ĐẠT. Test mới `tinh/hamNen.test.ts` (7 ca, worker giả). Đã thử trên app: Hầm, đổi liền 5 → 6 (lượt 5 bị huỷ), Chi phí, 3D bật Hầm; không lỗi console.
- Còn dở:
  - Xuất XLS vẫn gọi `tinhKhoiLuong` đồng bộ.
  - Lượt vẽ SVG mặt bằng hầm 150–185 ms chưa tối ưu.
  - Trong Browser pane, observer `longtask` báo không đều, nên số chính lấy theo nhịp `setInterval`.
  - Worktree agent thiếu `worker/node_modules`; đã nối junction tới bản ở repo chính để chạy `kiem`.

## 2026-10-29 · bảng KPI cho lãnh đạo ở Tổng mặt bằng và màn Tầng · agent Opus

- Yêu cầu: ở TMB cần nhìn dân số, số căn, tổng DT sàn XD, tổng DT sàn sử dụng, DTXD một sàn, hiệu suất. Ở màn Tầng, với từng mẫu tòa, cần unit mix, số căn theo loại, DT thông thủy, dân số, tổng căn, hiệu suất, DTXD và DTSD một sàn. Phải dễ nhìn, số nổi bật đặt trên cùng.
- Định nghĩa, theo app cũ `metrics()` (`MDI_Unitmix_v4/prototype/shell.src.html` ~5804–5940):
  - DTSD = Σ DT thông thủy căn (`dt_tt_m2`); không cộng phần chung, không phải NSA.
  - DTXD một sàn = DT nét bao sàn (chân tháp). Tầng / tòa tự chỉnh thì đo nét bao mới, giống `tinhChiTieu`.
  - Hiệu suất = DTSD / DTXD (`eff: tt/foot`; app cũ đã bỏ `effTim` = tim tường / DTXD). Mục tiêu ≥ 75 % theo luật MT-03 `mdi_eff`, đọc từ quy_tac.json.
  - Tổng DT sàn XD = DT sàn tính HSSDĐ (`dtSanTinhHSSDD`, QCVN 01:2021 1.4.21), so với HSSDĐ × DT lô.
  - Tổng DT sàn sử dụng = Σ thông thủy × số tầng.
  - Dân số = dòng chỉ tiêu `danSo` (QĐ tỉnh từng căn, hoặc hệ số chung).
- Hàm thuần `tinh/kpi.ts`: `soVoi` (đạt / sát 3 % / vượt / chưa đạt), `dtxdTang`, `sanToa`, `kpiTmb(pa, tv, kq, loIds)`, `loDuAn`, `kpiTang(...)`. Dân theo loại lấy người / căn của `danSoLo`, nên tổng các loại bằng dân tòa ở TMB.
- Giao diện:
  - `ui/TheSo.tsx`: ô số lớn với chip trạng thái, thanh tỉ lệ, tooltip công thức + căn cứ; `VongKpi`; `useHieuSuatMin`.
  - `ui/KpiTmb.tsx`: công tắc Lô / Cả dự án; mục gập "Chi tiết theo tòa".
  - `ui/KpiTang.tsx`: 6 ô (căn / tầng, tổng căn tòa, dân tòa, hiệu suất tầng + cả tòa, DTXD, DTSD 1 sàn); donut + bảng theo loại (căn tầng / tòa, lệch % tô `--warn` khi quá `nguong.coCauDiem`, DT TT min–max + bq, dân); mục gập "Chi tiết từng mẫu căn".
  - CSS `ui/kpi.css` (biến LEO, `--u-*`, `--warn`).
  - Gắn một dòng ở `TmbPhai` (`ManXepToa.tsx`) và một dòng ở `TangPhai` (`ManTang.tsx`).
  - Bỏ trùng bằng cách gập mặc định: Chỉ tiêu lô, Dân số theo căn, DT trên lô (TMB); Căn trong tòa, Loại căn trong tầng (Tầng). i18n `kpi.*` có ở vi + en.
- Test `tinh/kpi.test.ts`, 8 ca trên mẫu thật tm-i1 / tm-t2 / tm-l1:
  - DTXD khớp `dtxd_m2` CAD trong 3 %; hiệu suất nằm trong 60–90 %.
  - Dân các loại cộng lại = `danSoLo`; % cộng 100.
  - Ô SHCĐ không tính căn và DTSD.
  - TMB 2 lô 3 tòa: khớp dòng chỉ tiêu; cả dự án = tổng các lô; lô ngưỡng nhỏ báo vượt; lô chưa có tòa ra "—".
- Kiểm trên app: vite 5417, API 8787, dự án thử `u9z54gw7` sao từ `k05gkt6j` (3 lô, 7 tòa), lô CT-02 hạ ngưỡng (dân 2.000, HSSDĐ 3,5, 600 căn) để có ô vượt. Chụp bằng Edge headless + CDP ở 1440×900. Ảnh ở `docs/anh/kpi/`:
  - 01 lô CT-01; 02 cả dự án (dân 8.075 / 8.000 vượt, hiệu suất 74,0 % chưa đạt).
  - 03 chi tiết theo tòa; 04 CT-02 có 3 ô vượt.
  - 05 + 06 Tầng mẫu i3 (19 căn / tầng, 74,3 %, chi tiết mẫu); 07 Tầng mẫu Y2 (26 căn / tầng, 74,6 %).
  - `.panel-giua` giữ 270,52,870×848 qua mọi bước ở 1440 và 270,52,630×848 ở 1200; `.panel-phai` scrollWidth − clientWidth = 0 ở cả hai cỡ. Bản EN không lộ khoá `kpi.`.
- `npm run kiem`: ĐẠT (tsc · web 454 · worker 9 · pytest 12 · build). `worker/node_modules` là junction (không commit).
- Còn dở / chờ chủ nhiệm chốt:
  - Ngưỡng hiệu suất 75 % là mục tiêu nội bộ MDI (MT-03), không phải QCVN.
  - "DTXD một sàn" ở TMB = Σ chân tháp tầng điển hình; MĐXD bên dưới tính theo khối đế.
  - Hiệu suất cả tòa / lô là bình quân có trọng số theo DT sàn mọi tầng.
  - Căn đã STRETCH lấy `dt_tt_m2` của biến thể trong thư viện.
  - Chưa có ô NSA (khả bán) riêng.

## 2026-10-29 · hiệu năng: cache raiHam · Ctrl+Z/Y/S · tim cửa tiền tính + nội thất tải lười · tách chunk · agent Opus

- Làm 4 việc "nên làm ngay" 1–4 của `docs/de_xuat_hieu_nang.md`; bảng số đo trước / sau ở mục 8 của tài liệu đó.
- P1: `raiHam` (`tinh/ham.ts`) tự nhớ theo đầu vào thật (`pa.ham`, lô, tòa thuộc lô, `tv`), dùng chung cho Hầm / Chi phí / 3D Hầm. Sửa đơn giá Chi phí 7,8–8,3 s → 15–26 ms. Lần rải đầu vẫn chạy trên luồng chính (chưa Worker).
- B1: `kho/phimSoan.ts` + `usePhimSoan` ở `TrinhSoan`: Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z, Ctrl+S lưu ngay (`BoLuu.luuNgay`), `beforeunload` khi `conChuaLuu`. Bỏ qua khi đang gõ ô nhập (trừ Ctrl+S), khoá ở chế độ chỉ xem.
- P3 (+P7): `scripts/sinh_phai_sinh_can.py` — chạy lại sau MỖI lần chép / bóc lại căn (`chep_thu_vien.py`, `boc_cad/boc_lai_can*.py`): ghi `cua_x` vào `can.json`, tách nội thất sang `can/<id>.noithat.json`, đánh số lại `stretch.cung`; `--kiem` để soát (pytest gọi). Màn Tầng chỉ tải lõi của tòa trong PA (`man/tuChinhTang.ts` `khoiCuaPA`) và nội thất khi lớp Nội thất bật: 57 req / 5,16 MB → 15 req / 0,94 MB.
- P2 + P5: thư viện + PA `?pa=` tải song song với dự án; `ui/Luoi.tsx` tách chunk ManHam, ManChiPhi, HopXuatCad, SoSanhPA; `napDxf` (dxf-parser) `import()` khi chọn tệp. Chunk khởi động 737 → 661 KB (250 → 227 KB gz).
- Tệp vùng agent khác: `man/ManTang.tsx` sửa đúng 1 dòng (`useDuLieuMB(tv, pa)` ở `TangTrai`); không đụng `loiThang` / `thaoTacTay` / `matBang` / `CongCuTang` / `MatBangTang` / `ve3d` / `unitmix.css` / `KhungSoan`. Test CAD (`xuatCad*.test.ts`) chỉ đổi hàm đọc nét để ghép tệp nội thất — chưa chạy (`kiem:cad`).
- Kiểm trên app: vite preview 5418 (nhánh) và 5419 (`b808b73`), API 8787, tab riêng, dự án thử `4sybq7h3` (sao PA `tztd1udv/pa-1` qua API). Ctrl+Z bằng phím thật, Ctrl+Y, Ctrl+Shift+Z, Ctrl+S → PUT sau 4 ms; khung giữa 1348×854 không đổi khi chunk Chi phí / Hầm đang tải (vòng O). Console sạch. Worktree thiếu `worker/node_modules` → junction (không commit).
- Còn dở: Worker cho `raiHam`; tách `ve3d/dung*` + `manualChunks`; endpoint gộp mở dự án; lớp Nội thất vẫn bật mặc định.
## 2026-10-29 · dân số theo từng căn theo QĐ tỉnh + dashboard vòng tròn · agent Opus

- Yêu cầu: "bảng chỉ tiêu không có cách tính dân theo từng khu vực… tính dân theo từng căn… có cái bảng tròn tròn như TMB". Trước đây `chiTieu.ts` = số căn × `nguoiMoiCan` (một hệ số).
- Dữ liệu `tinh/quyTacDanSo.ts` (nguồn: `MDI_Unitmix_v4/docs/quy-tac-tinh-dan-so-chung-cu.md` + khối `TINH` / `occPhongO` / `occQD83` trong `shell.src.html`): mỗi tỉnh có `kieu` A–E, số hiệu QĐ, `daDoiChieu`, phương pháp theo giai đoạn `qh` / `cp` (bảng theo loại hình NOTM / NOXH / TĐC · `sTb` P = S / S_tb · `qd83`), `bqCan` (cách "hoặc bình quân"), `theo` (tỉnh cũ đã sáp nhập). Đã cài: Hà Nội QĐ 34/2024 (sửa QĐ 39/2026, kiểu C) · TP.HCM QĐ 32/2025 (kiểu B; đã trích PDF trong kho `32_2025_QĐ-UBND.pdf`, khớp từng mốc Điều 4 khoản 1, 2a, 2b; khoản 1 = giai đoạn quy hoạch 32 m²/người) · TP.HCM QĐ 83/2026 · BR-VT cũ → theo TP.HCM (QĐ 32/2025 Điều 2 khoản 2: QĐ 43/2023 BR-VT hết hiệu lực) · Hải Dương QĐ 11/2024, Đồng Nai QĐ 09/2025 (chưa có trị số → fallback, cờ tạm) · Phú Yên QĐ 05/2025 (kiểu E, S_tb tạm 32) · tỉnh khác → P = S / 32 (QĐ 2161/QĐ-TTg). Kiểu A chưa có tỉnh nào — chỉ cài máy tính, test bằng bảng giả.
- Khác app cũ: bảng NOXH / TĐC TP.HCM "đến dưới" giữ đúng chữ văn bản (45 m² → 2 người; app cũ cho 1,5).
- Khai `TemDat.danSo?: KhaiDanSo` (`kieu.ts`): `tinh`, `giaiDoan`, `loaiHinh?` (thiếu = lô XH hoặc mẫu căn nhóm XH → NOXH), `cach?` 'bq'. Không khai = PA cũ, giữ số căn × `nguoiMoiCan`, dashboard báo "Đang dùng hệ số chung". Giao diện `ui/KhaiDanSo.tsx` trong mục Chỉ tiêu QH (`ManLo.tsx` một dòng): tỉnh, loại hình, giai đoạn, cách tính, dòng căn cứ + cờ "chưa đối chiếu" / "giá trị tạm", nút áp cho mọi lô cao tầng.
- Tính `tinh/danSo.ts` (thuần): `nguoiMotCan` / `traBang` (DT = `dt_tt_m2` = DT sử dụng, QCVN 04:2021 1.4.13; dưới 25 m² / trên mốc cuối lấy dòng gần nhất + cờ `ngoaiBang`), `danSoLo` (từng mẫu căn → loại căn → tòa → lô, số thực không làm tròn từng căn), `danSoDuAn`. `chiTieu.ts` dòng `danSo` + `tong.danSo` dùng kết quả này khi lô đã khai.
- Dashboard `ui/DashDanSo.tsx` + `ui/dan-so.css` (gắn một dòng sau `BangChiTieuLo` trong `XepPhai`, `ManXepToa.tsx`): mục gập "Dân số theo căn", vòng donut tỉ lệ dân theo loại căn (màu `--u-*`, cùng kiểu `VongCoCau`, tổng ở giữa), số lớn tổng dân · dân / ngưỡng QH (thanh, vượt tô `--warn`) · người / căn bình quân; bảng theo loại (căn, DT min–max, dân, %); `details` bảng chi tiết từng mẫu căn (căn × DT × người/căn → dân, loại hình, tooltip điều khoản), theo tòa, căn cứ; dòng toàn dự án khi > 1 lô có căn.
- Test `tinh/danSo.test.ts` 21 ca: mốc biên HN / HCM (≤ và "đến dưới"), dưới 25 m², kiểu A–E, QĐ 83, giai đoạn quy hoạch HCM, fallback không tạm / Hải Dương tạm / BR-VT theo HCM, mỗi tỉnh có số hiệu, PA cũ chưa khai giữ hệ số chung (chiTieu 140 người), HN 90 người, cộng theo tòa / dự án, NOXH tự theo lô, TĐC ghi đè, bình quân 3,6. Không test cũ nào phải đổi kỳ vọng.
- Kiểm trên app (vite 5415, API 8787, tab riêng, dự án thử `r58gziom`: lô 80×60 + gợi ý xếp i2 15T 140 căn, 1440×900): chưa khai → 490 người (3,5/căn) + câu "hệ số chung"; Hà Nội → 364 người (1PN 45,1 m² → 2 vì > 45), dòng chỉ tiêu lô cùng 364; TP.HCM QĐ 32 + NOXH → 378 người, 3PN 94,5 m² "3 *" ngoài bảng; ngưỡng 300 → 126 % thanh `vuot`. EN không lộ khoá. Khung giữa `.panel-giua` 270,52,870×848 trước / sau mở dashboard + bảng chi tiết; `.panel-phai` không tràn ngang. Ảnh `docs/anh/dan-so/01…03`.
- `npm run kiem`: ĐẠT (tsc · web 446 · worker 9 · pytest 12 · build). Worktree thiếu `worker/node_modules` → junction (không commit).
- Còn dở / chờ chủ nhiệm chốt: bảng Hải Dương, Đồng Nai, S_tb Phú Yên chưa có trị số (đang 32 m²/người, giá trị tạm); bản gốc QĐ 34/2024 + 39/2026 Hà Nội và QĐ 83/2026 TP.HCM chưa có trong kho (chép từ tài liệu app cũ); cách hiểu "bảng = thang DT sử dụng, không theo số phòng" (app cũ §A13); căn ngoài bảng lấy dòng gần nhất; S ÷ 32 không làm tròn từng căn; căn đã STRETCH vẫn tra DT mẫu gốc; tên mẫu căn trong bảng chi tiết dùng `ten_vi` cả khi EN (như các chỗ khác của app).
## 2026-10-29 · TMB: xếp hàng loạt nhiều lô + lộ giới từng cạnh lô · agent Opus

- Gộp `nang-cap/architechtures` (biểu tượng SVG `ui/bieuTuongSvg.ts`); không thêm khoá biểu tượng mới (`hangLoat` đã có hình).
- Xếp hàng loạt (app cũ `tm_hl` / `xepHangLoat`, QT-86 / QT-92): `tinh/xepHangLoat.ts` thuần — `thuTuLo` (lô xếp được, lớn trước), `sinhHangLoat` chạy `sinhGoiY` MT-05 lần lượt, mỗi lô thấy tòa phương án đang chọn của các lô trước (§2.6.1 LO-02 qua `ngoai` của xepToa), `xepHangLoatNen` nhả luồng + dừng giữ lô đã xong, `paVoiChon` / `apHangLoat` (một `sua`), `xungDotCheo` (cặp tòa khác lô dưới §2.6.1 khi đổi phương án). Giao diện `man/xepHangLoat.tsx` + `styles/xep-hang-loat.css`: nút ▦ trong thanh TMB, hộp lớp phủ `.noi-tren` — tick lô, Chạy xếp / Dừng, thanh tiến độ (cả lượt), bảng từng lô (chọn phương án / giữ nguyên, căn, MĐXD, số cặp §2.6.1 + ↻ chạy lại từ lô đó), Áp dụng cả lượt, xem trước nét đứt trên bản vẽ; kết quả cũ báo "đã đổi — chạy lại" khi lô / tòa ngoài lượt đổi.
- Lộ giới từng cạnh (app cũ `tm_rong` + `lo.canh` / `luiCanh`, QT-122): `Lo.canhDuong?: (number | null)[]` theo thứ tự cạnh `ranh`; `chuanHoaCanhDuong` (macDinh.ts) bỏ mảng lệch số cạnh. `xepToa.ts`: `RONG_DUONG_MAC_DINH` 12, `rongCanh`, `luiTungCanh` (Bảng 2.7 từ quy_tac.json qua `luiBang27`), `duLuiTungCanh`. Dùng ở: gợi ý xếp tòa (ứng viên tĩnh), `dichBatDinh` (đường lùi chỉ ở cạnh giáp đường, đúng khoảng từng cạnh), `kiemViPham` (cạnh thiếu lùi nhất, `ViPhamLui.canh` / `rong`; nhãn bản vẽ "LO-01 c2 …", danh sách cảnh báo ghi cạnh + lộ giới), `kichThuocToa`, `viTriNhanBan`; khoá gợi ý `GoiYXepToa` gồm `canhDuong`. Giao diện `man/loGioiCanh.tsx`: bấm cạnh lô đang chọn (`canhGan` trong `bamNen`) → hộp lớp phủ: giáp đường ☑, bề rộng lộ giới, khoảng lùi Bảng 2.7 theo tòa cao nhất lô, bỏ khai cả lô; nhãn "đường 30 m" ngoài cạnh (lô chưa khai: "đường 12 m?"), cạnh đang khai tô đậm. Mọi thay đổi qua `sua`.
- Test: `tinh/loGioiCanh.test.ts` (8 ca: tra từng cạnh, chuẩn hoá, kiểm vi phạm theo cạnh, bắt dính, kích thước, nhân bản, bấm cạnh / khai / bỏ khai, gợi ý xếp tòa đủ lùi từng cạnh), `tinh/xepHangLoat.test.ts` (5 ca: thứ tự, §2.6.1 giữa lô, áp cả lượt, đổi phương án + xung đột, dừng giữa chừng / chạy tiếp, tiến độ tăng dần).
- Kiểm trên app (vite 5409, API 8787, dự án thử `k05gkt6j` 3 lô liền nhau tạo qua API, 1440×900): khung giữa `.panel-giua` 270,52,870×848 không đổi qua mọi bước. Bấm cạnh phải CT-01 → hộp "Cạnh c2 · lô CT-01 · dài 90,0 m", bỏ giáp đường → nhãn "không giáp đường"; cạnh đáy nhập 30 → "đường 30 m"; Hoàn tác về 12 m, Làm lại về 30 m; tải lại trang vẫn giữ. Lô CT-02 cạnh chung bỏ giáp đường. ▦ Xếp hàng loạt 3 lô: tiến độ "Lô CT-01 (1/3) · 55 %" → bảng 3 lô · 2,7 s, 7 tòa · 2.307 căn, §2.6.1 ✓ cả 3, 7 nét đứt xem trước. Đổi CT-01 sang phương án 3 + CT-03 giữ nguyên → CT-01 / CT-03 báo 1 cặp §2.6.1 + nút ↻. Áp cả lượt (7 tòa) rồi Hoàn tác một lần về đúng 7 tòa cũ. Console sạch. Bẫy: sửa tệp lúc đang thử làm HMR nhân đôi trạng thái cấp module (hộp không mở / lượt chạy mất) → tải lại trang; người dùng cũng bấm vào tab trong lúc thử (mở 3D, đóng hộp) nên phần Dừng kiểm bằng vitest.
- `npm run kiem`: ĐẠT (tsc · web 406 · worker 9 · pytest 12 · build). Worktree thiếu `worker/node_modules` → junction tới bản chính (không commit).
- Còn dở: chưa đọc cạnh giáp đường từ CAD (lớp tim đường); chưa có `lui_qh` / `lui_ben`; xếp hàng loạt chưa có 3 option A/B/C và nguồn mẫu kho dự án / PA .json như app cũ; hộp khai cạnh đặt ở góc trên (không nổi tại cạnh như app cũ).
## 2026-10-29 · công cụ tay màn Tầng đợt 2: thêm căn mọi chỗ · câu báo số căn · dò hợp lệ khi kéo · agent Opus

- **Thêm căn mọi chỗ** (app cũ tAdd · QT-30 · QT-32 · QT-69). `CanThem` có thêm `truoc` (chèn ngay TRƯỚC ô — chọn căn đầu dãy là chèn đầu dãy); `themMot` (canThem.ts) dùng chung một điểm chèn `p` cho sau / trước. Menu Thêm ▾: ⊞ sau ô · ⇤ trước ô · ⊡ vào chỗ trống (số đếm) · ≣ thang; ô **Mẫu** chọn mẫu căn giữa cùng nhóm / chiều sâu (`dsMauThem`, mặc định `mauThem`). Chỗ trống `tinh/choTrong.ts`: khe XC-02 loại 'trong' ≥ 3 m, đầu dãy hở (mép mặt còn sàn trong nét bao, không phải chỗ căn mặt khác), ô "Ô trống", ô căn người dùng đã xoá (không tính ô tự chỉnh gỡ). Mỗi chỗ gợi ý ≤ 4 mẫu vừa nhất (rộng ≤ chỗ + 500 mm STRETCH co QT-81); rê chuột lên dòng thì bản vẽ tô chỗ đó nét đứt. Ô trống / ô đã xoá đặt lại bằng `themVaoO` (công năng về căn + mẫu chọn).
- **Xoá căn thêm tay rút khỏi `canThem`** (`rutCanThem`): căn thêm không còn là căn ở tầng nào thì bỏ hẳn; căn thêm sau nó cùng mặt lùi khoá → đổi khoá trong bố cục chung / tầng riêng (mẫu, công năng, lật), `tuDong`, neo của căn thêm / thang tay; vật neo vào căn bị rút chuyển sang neo của căn đó.
- **Câu báo số căn** (`tinh/baoThaoTac.ts`, mọi thao tác ở `CongCuTang` qua `useChay`): "Căn / tầng: a → b." + căn tự chỉnh vừa gỡ vì vượt cự ly thoát nạn (đọc `tuDong` mới, trừ căn khít đoạn kẹp XC-05 báo riêng) kèm ngưỡng + căn cứ `gioiHanThoatNan` (H > 75 m: cụt 15 / hai hướng 20 m · QCVN 06:2022 A.3.1.7 → A.2.19) + căn tự chỉnh trả lại (số CH theo mặt bằng sau). Số căn giảm do gỡ thoát nạn thì sau khi câu báo hiện chạy `goiYGiuCan` (hạn 1,5 s): thử dời thang tới cạnh căn bị gỡ (như PC-11), rồi ⟲ thang về tự động — tìm được thì nối "Gợi ý giữ N căn / tầng: …— chưa áp", không thì "Chưa tìm được…". Không tự áp. `datBaoStretch` có `giuMs`, `baoConHien`.
- **Kéo thả dò hợp lệ khi rê** (`useKeoTay`): chuột dừng 120 ms trên ô đích (`DO_DUNG_MS`) mới chạy thử phép (tự chỉnh thật), cache theo ô đích trong lượt kéo; lần dò > 900 ms (`DO_HAN_MS`) thì thôi dò lúc rê ("kiểm khi thả"). Bóng ghi "đang dò…" → "✓ Thả: CH-xx · căn / tầng a → b" hoặc "✕ lý do ngắn" (`cc.ngan.*`); ô đích / ô thang đích tô `var(--warn)` (`MatBangTang` prop `dichLoi`). Thả dùng lại kết quả đã dò (thả 7 ms).
- Sửa kèm: menu Thêm bị `.nhom-bt { overflow: hidden }` (bieu-tuong.css) cắt mất — không thấy trên màn hình; nay `.thanh-cc-tang > .nhom-bt` overflow visible (bo góc nút đầu / cuối), menu mở sang trái để không tràn mép phải `.panel-giua`. Thêm 2 biểu tượng `themTruoc`, `themCho` (BIEU_TUONG + SVG_BT nét 1,5). Gộp `nang-cap/architechtures` (bộ biểu tượng SVG).
- Test `tinh/themCho.test.ts` 11 ca mẫu thật: chèn trước đầu dãy tm-i1 (+1 căn, đứng trước, DTXD tăng); trước ô giữa = sau ô đứng trước (tm-l1); xoá căn thêm rút + đổi khoá + về số căn gốc; `rutCanThem` đổi khoá tầng riêng / lật; chỗ trống ô đã xoá + ô trống → đặt lại đúng số căn; `dsMauThem`; tm-u1 lật 1:6 → 32 → 31, gỡ 1:6, căn cứ A.3.1.7; lật 1:7 → gợi ý dời thang giữ 32 (không sửa tòa); tm-t2 xoá thang 40 → 39 + gợi ý giữ 40; đổi chỗ không đổi số căn; dò thử tất định (cache dùng được khi thả).
- `npm run kiem`: ĐẠT (tsc · web 404 · worker 9 · pytest 12 · build).
- Kiểm trên app (vite 5410, API 8787, tab riêng, dự án thử `7jln0j5y` = bản sao `gwym3l6i` tm-u1, 1440×900): khung giữa `.panel-giua` 270,52,870×848 trước / sau mọi bước. Lật CH-18: "32 → 31. Tự chỉnh gỡ CH-18 vì vượt cự ly thoát nạn (cụt ≤ 15 m, hai hướng ≤ 20 m · QCVN 06:2022 A.3.1.7 → A.2.19). Chưa tìm được chỗ dời thang…"; hoàn tác về 32. Xoá thang 1:10: "32 → 30 … gỡ CH-15, CH-11, CH-09 … trả lại … Gợi ý giữ 32 căn / tầng: ⟲ Thang bộ về tự động (PC-11, 3 thang) — chưa áp". Mẫu 1PN M2 + ⇤ trước CH-09: 32 → 33; xoá chính căn đó: 33 → 32, PA lưu `canThem` = null. Xoá 1:1 → ⊡ liệt kê "Ô căn đã xoá · mặt 2 · 5,8 m" (1PN M1 5,8 đầu danh sách) → đặt lại 31 → 32. Ô trống 1:12 → danh sách "Ô trống · mặt 2 · 5,8 m", rê chuột tô chỗ trên bản vẽ, đặt lại 31 → 32. Kéo (✥): bóng "Thả: CH-19 · đang dò…" → "✓ Thả: CH-19 · căn / tầng 32 → 33", khoảng cách giữa hai lần pointermove ≤ 22 ms khi rê; kéo thang 1:3 lên 0:4: "✕ không đặt được thang ở đây", ô đích `.o-dich.loi`, bóng `.bong-keo.loi`, thả → báo + trả về. Console không lỗi mới.
- Còn dở: gợi ý giữ số căn chỉ thử dời thang tới hai ô kề căn bị gỡ + thang về tự động (không quét mọi chỗ như PC-11 đầy đủ); ở dự án thử, lật 1:7 không tìm ra gợi ý trong 1,5 s (mẫu sạch tìm ra); dò hợp lệ chạy trên luồng chính (chuột đứng yên ~0,3–1 s mới chạy, không Web Worker); chỗ "khe" và "đầu dãy hở" hiếm gặp trên 33 mẫu sạch (dãy kẹp xoá căn bị chặn "khe") — đã có mã, test chủ yếu qua ô đã xoá / ô trống; thêm căn vào khe chèn bằng cách dời dãy (không lấp khe tại chỗ).
## 2026-10-29 · thanh trên: dải cấp bấm được (menu lô / PA · cốt · tòa · tầng · căn) · agent Opus

- Dải giữa `nav.cap-do` (`ui/ThanhTren.tsx` `DaiCap` / `NutCap` / `BangCap`) thành nhóm liền khung viền `--line` như `.nhom-nut`, chữ 12 px, cấp đang đứng tô `--selected`. Mỗi ô là menu thả xuống thật (`position: fixed`, `role="menu"` + `menuitemradio`): ↑ / ↓ / Home / End chuyển mục, Enter chọn, Esc / Tab / bấm ngoài đóng, đóng bằng phím thì trả focus về ô; hiệu ứng mở / đóng `menu-cap-vao` / `menu-cap-ra` qua `useDongHop`. Esc trong menu không lọt xuống phím tắt bản vẽ.
  - lô / PA: nhóm Phương án (chọn PA khác → mở `?pa=`) + nhóm Lô đất (lô cao tầng, kèm số tòa); cốt: Trên cốt 0 (Tầng) / Dưới cốt 0 (Hầm), từ Hầm về lại màn trên cốt 0 vừa làm; tòa: tòa của lô (trùng mẫu thì đánh số 1 · 2 · 3); tầng: tầng điển hình, từng tầng (chấm + "bố cục riêng"), tầng hầm B1…; căn: CH-xx theo đánh số chu vi. Nút ↑ lên một cấp: căn → tầng → tòa (về TMB, giữ tòa) → lô; Hầm → lô.
- Phần thuần `ui/capDo.ts` (+ `capDo.test.ts`, 8 ca): `capHienTai`, `lenMotCap`, `dsMucTang`, `khoaTangDangXem`, `giaiKhoaTang`, `buocPhim`. Dựng menu trong `man/SoanThao.tsx` `dungCapDo` (chỉ đổi state chọn của SoanThao). Chọn tầng từ ngoài màn Tầng qua kênh `chonTangNgoai` trong `ui/ChonTang.tsx` (ô ChonTang đang gắn nhận lệnh, chưa gắn thì giữ lệnh chờ) — không sửa `ManTang.tsx`.
- Nhóm chế độ Tự động / Chỉnh tay / Chỉ xem dời sang trái, ngay sau 2D / 3D / Chi phí; bỏ nhãn "Chế độ:". CSS riêng `styles/cap-do.css`; bỏ luật `.cap-do` cũ trong `unitmix.css`. Màn ≤ 1480 px: khoảng cách 8 px, ẩn chữ UNITMIX cạnh logo, đệm tab hẹp; dải cấp co theo thứ tự lô → tòa (cốt / tầng / căn giữ nguyên), chữ cắt "…", tooltip đủ tên.
- Kiểm trên app (vite 5411, API 8787, dự án thử `g4by0d6l` 2 PA × 3 lô × 7 tòa sao từ `k05gkt6j`; `plevadne` cho tầng riêng): bấm từng menu (chuột + phím), đổi lô, tòa, tầng (từ TMB nhảy sang Tầng đúng tầng), căn, cốt, tầng hầm, PA, ↑ ba lần tới lô (nút tắt). `.panel-giua` trước / khi mở menu / sau chọn: 1440×900 `270,52,870,848`, 1200×800 `270,52,630,748` — không đổi; thanh cao 52 px, `scrollWidth − clientWidth = 0` ở cả hai cỡ. `npm run kiem` ĐẠT (tsc, web 401, worker 9, pytest 12, build).
- Còn dở: danh sách PA lấy lúc mở dự án (PA tạo sau chưa hiện tới khi tải lại); ở 1200 px tên lô gần như chỉ còn "T…" (tooltip đủ).

## 2026-10-29 · thao tác tay trên Tổng mặt bằng (học màn ③ app cũ) · agent Opus

- Đối chiếu màn ③ `MDI_Unitmix_v4` (`phimTMB`, `doiCoKhoa`, `nhanBanToa`, `latToa`, kéo / Ctrl+kéo trong `veTMB`): app cũ có chọn một tòa, kéo + khoá CGXD (QT-118), Ctrl+kéo / Ctrl+C·V nhân bản, Q/E ±5°, R 90°, F lật, mũi tên 1 m (Shift 5 m), Delete, ô X / Y / góc; KHÔNG có chọn nhiều tòa, khung chọn, bắt dính, tay nắm xoay, đo, hiện kích thước khi kéo (chỉ tô đỏ khi chạm CGXD).
- Phần tính thuần `tinh/thaoTacToa.ts`: bắt dính (cạnh lô, chỉ giới, đường lùi LO-01 Bảng 2.7, mép / trục tòa khác, đúng mức đầu hồi / cạnh dài §2.6.1 LO-02 — giải hệ 2 pháp tuyến), bắt góc (cạnh lô / hướng chính < 3°, Shift 15°), xoay / dời / lật nhóm, kiểm vi phạm trực tiếp (LO-05 trong chỉ giới, LO-01, LO-02 lỗi < đầu hồi, cảnh báo < cạnh dài, theo tòa cao hơn), kích thước tới ranh / chỉ giới / tòa gần nhất, nhân bản vào chỗ trống, chọn khung, bắt điểm đo. Ngưỡng đọc quy_tac.json qua `luiBang27` / `kcToa261`. `ToaDat.lat` (lật chân tòa, áp trong `chanToa` + cột hầm `ham.ts`; mặt bằng căn của mẫu không đổi như app cũ).
- Giao diện (`man/ManXepToa.tsx` `XepGiua`, `man/tmbThaoTac.tsx`, `styles/tmb-thao-tac.css`): thanh biểu tượng `NutBieuTuong` trong `.noi-tren` (chọn khung · bắt dính · giữ trong chỉ giới · đo | xoay 90 · lật · nhân bản · khoá · xoá | toạ độ · cảnh báo có số đếm); kéo / xoay rAF bám tay, Alt tắt bắt dính; tay nắm xoay; Ctrl+kéo nhân bản (bóng nét đứt); Shift+kéo nền chọn khung; Shift / Ctrl+bấm thêm / bỏ; bấm nền bỏ chọn; phím Delete, Ctrl+D, Ctrl+A, R (Shift −90°), Q/E ±5° (Shift 1°), F, mũi tên 0,1 m (Shift 1 m), Esc. Hộp toạ độ X / Y / góc + Δx / Δy / Δ°. Vi phạm tô `--warn` kèm nhãn "§2.6.1 14,7 m < 15,0 m"; bắt dính / kích thước `--green`. Chỉ xem: chọn + đo được, mọi nút sửa / kéo / phím khoá. Mọi thay đổi qua `sua` (xoay nhóm = 1 bước hoàn tác).
- `ve/BanVe.tsx` chỉ thêm prop tuỳ chọn `onBamNen`, `chonKhung` (API cũ giữ nguyên).
- Sửa kèm: ô `sr-only` (absolute) trong panel trái tràn ra ngoài khi mở "Thông số tòa" → cả trang có thanh cuộn, khung giữa hẹp 870 → 855 px; thêm `.panel-trai, .panel-phai { position: relative; }`.
- Kiểm trên app (vite 5408, API 8787, dự án thử `qrx3397m` sao từ `gwym3l6i`, tm-i1): bấm chọn, Ctrl+D, kéo bắt đúng 25,0 m §2.6.1 (lúc kéo hiện "§2.6.1 14,7 m < 15,0 m", tô `--warn`), mũi tên Shift ×13 + 1 lần = 13,1 m, tay nắm xoay (bắt 0° ∥, Shift 15° / 30°, giữ chỉ giới chặn ở 355°), R / Q / Shift+E / F, khoá chặn Delete, chọn khung 2 tòa + R nhóm + hoàn tác một bước, đo góc lô 160,0 m, Ctrl+kéo nhân bản, Δx 5 m, góc 45°, danh sách cảnh báo, chỉ xem. Khung giữa 270,52,870×848 không đổi qua mọi bước; console sạch.
- Test `tinh/thaoTacToa.test.ts` 17 ca.
- Chưa làm: bóng đổ, nền bản đồ, nhà hiện hữu OSM, điểm view (lô chưa có toạ độ địa lý VN2000 / kinh tuyến trục, cần mạng — làm sau khi nạp lô có hệ toạ độ); xếp hàng loạt nhiều lô (gợi ý MT-05 đang chạy từng lô); cạnh lô giáp đường / lộ giới từng cạnh (LO-01 đang áp mọi cạnh với đường 12 m như gợi ý xếp tòa); Ctrl+C / Ctrl+V qua bộ nhớ tạm (đã có Ctrl+D, Ctrl+kéo).
## 2026-10-29 · công cụ tay màn Tầng: sắp xếp / thêm / xoá căn, thang · lật · hàng loạt · agent Opus

Người dùng hỏi "công cụ sắp xếp căn hộ, thang tòa sao vẫn chưa có?" — làm lại thanh công cụ màn mặt bằng tầng của app cũ (`prototype/shell.src.html` ~1250, tMove · tAdd · tAddStair · tDel · mirrorSel · nhXoa).
- Thanh công cụ (`man/CongCuTang.tsx`, CSS `styles/cong-cu-tang.css`): lớp phủ góc trên phải bản vẽ, nút `NutBieuTuong` (ký hiệu nét một màu `--green`): ✥ Sắp xếp (kéo đổi chỗ) · ＋ Thêm ▾ (⊞ căn / ≣ thang bộ) · ✕ Xoá (phím Delete) · ⇋ Lật (chọn nhiều = hàng loạt, nút ghi số ô) · ⇉ Hành lang (XC-07 tự động — bật / tắt nét tim) · ⟲ Thang bộ về tự động. Tooltip ghi mã QT; chữ ở `vi.json` + `en.json` (`cc.*`, `bt.them`, `bt.thangTuDong`; thêm 2 ký hiệu vào `BIEU_TUONG`). Chế độ chỉ xem: khoá hết (trừ bật / tắt nét hành lang).
- Thao tác thuần `tinh/thaoTacTay.ts`: mỗi thao tác sửa bố cục → `tuChinhSauSua` (XC-03/05/06/07 · PC-11 · QT-69 trong CÙNG một `kho.sua`, hàng loạt cũng một bước hoàn tác) → kiểm `doDeKhe` (không đè mới, khe không tăng > 200 mm) và thao tác thật sự áp được; không thì trả lý do, KHÔNG sửa, báo lớp phủ (`datBaoStretch`).
  - Đổi chỗ (`doiChoO`, doiCan.ts): mẫu căn + công năng + lật đổi cho nhau, căn giữ hướng thật; dãy dồn khít XC-04.
  - Lật (`ToaDat.lat` / `BoCucTang.lat`, `latO`): `viTriCan(…, bc)` đảo `guong`; `matDaDon` đảo `sx` nên cửa căn (pccc) đổi phía → thoát nạn tính lại; 3D / CAD đọc `guong` theo bố cục.
  - Xoá căn: công năng `bo` theo phạm vi tầng (dãy co ở đầu tự do / dãy kẹp `boCanKep`, nét bao co theo); ô không bỏ được → `khong_bo`.
  - Thêm căn (`ToaDat.canThem`, `tinh/canThem.ts`): "mẫu tòa mở rộng" `mauToa(tv, toa)` — phần tử căn nối cuối danh sách của mặt (khoá ổn định), chỉ DÃY LIỀN chứa ô chọn dời về đầu tự do (cánh bên kia sân trong chữ U đứng yên), nét bao nối ở cạnh đầu dãy, DTXD / `co_cau` theo. Mọi chỗ cần mẫu của một tòa (`chiTieu`, `coCau`, `congNang`, `duToan`, `ham`, `taiChinh`, 3D, xls, màn Tầng / Hầm / Xếp tòa, tự chỉnh) đổi `tv.toa.get(x.mauId)` → `mauToa(tv, x)` (tòa không thêm căn: đúng mẫu thư viện). Căn góc thì chèn căn giữa cùng loại (`mauThem`). Tầng riêng: ô mới là `bo` ở bố cục chung, căn ở các tầng chọn. Số căn không tăng (tự chỉnh phải bỏ căn vì thoát nạn) → `thoat_nan`.
  - Thang bộ (`ToaDat.thangTay` {them, bo}, mọi tầng): thêm ô 3.000 mm sau ô chọn, xoá (giữ ≥ 2 thang — còn 2 thì chặn `it_thang`; > 3 thang cảnh báo như app cũ), kéo dời. Lần sửa thang đầu CHỤP tập thang PC-11 đang có (`chupThangTay`: mỗi thang "sau vật thể đứng trước", thang mẫu mang `tu`) để không mất thang tự đặt. `tuChinhMatBang` áp `apThangTay` lên mặt bằng xuất phát (dời trong đoạn = `doiThang`, khác đoạn = bỏ + `themThang`), PC-11 chạy với `coDinh` (không dời / thêm / bớt — lựa chọn tay), XC-05 vẫn được dời cả đoạn ≤ tường chung; ghi chú PC-11 "thang đặt tay". ⟲ bỏ `thangTay` cho PC-11 tự đặt lại.
- Kéo thả (`useKeoTay`): bật ✥, nhấn ô căn / ô thang (vùng bấm thang mới `data-thang` trong `MatBangTang`) — bóng `.bong-keo` bám tay 1:1 qua rAF, ô đích tô xanh nét đứt (bóng xem trước) + chữ "Thả: CH-xx"; thả ra ngoài / không hợp lệ thì báo và bóng trượt về (180 ms; `prefers-reduced-motion` về ngay). Căn → căn: đổi chỗ; thang → căn: dời thang sau căn đó; căn → thang: dời thang sau căn kéo. Tắt ✥ thì kéo di bản vẽ như cũ.
- Test `tinh/thaoTacTay.test.ts` (11 ca, mẫu thật tm-t2 / tm-i1 / tm-l1 / tm-u1): chụp thang tái lập đúng PC-11; thêm thang (+1, PC-11 giữ, chạy lại tự chỉnh vẫn giữ); xoá thang 3 → 2 rồi chặn; dời thang; xoá căn chung (−24 căn) / tầng 5 riêng (−1); kéo đổi chỗ hai căn khác mẫu; lật + cửa đổi phía + lật lại về undefined; hàng loạt lật 3 / xoá 2; thêm căn chung (+24, DTXD tăng) / tầng riêng (+1); thêm căn cánh chữ U không xô cánh kia; quét mẫu (bọc `layMau`) — nhận thì không đè mới, không nhận thì có lý do.
- `npm run kiem`: ĐẠT (tsc · web 375 · worker 9 · pytest 12 · build). Worktree agent thiếu `worker/node_modules` → tạo junction tới bản chính (không commit).
- Kiểm trên app (vite 5407, API 8787, dự án thử `lthysclj` = bản sao `gwym3l6i` tm-u1, 1440×900): khung giữa `.panel-giua` 870×848 tại (270, 52) trước / sau MỌI thao tác dưới đây. ⇋ lật CH-01: "Đã lật gương 1 căn" (cửa đổi phía → gỡ căn vượt khác đi: 32 → 33 căn, lật lại về 32). ✕ xoá 2:4, 1:13: 32 → 31 → 30 căn, DTXD 2.185,7 → 2.044,6 m². ⊞ thêm căn sau 2:3: lần đầu báo "khe 11.995 mm" → sửa `canThem` chỉ dời dãy liền (trước đó dời cả cánh bên kia sân), sau đó "Đã thêm căn Studio M1 … 31 căn"; sau ô kẹp 0:5 báo "không có đầu tự do". ≣ thêm thang sau CH-12: "Tòa có 4 thang. Cảnh báo: quy định 2–3 thang bộ". Delete thang tay1 → 3 thang; xoá 0:3 → "dãy kẹp… Đã trả về"; xoá 1:10 → 2 thang; xoá tiếp → "phải giữ ít nhất 2 thang". Hoàn tác: 2 → 3 thang, 29 → 30 căn. Kéo CH-02 → CH-04: bóng "CH-02 · Studio M1 / Thả: CH-04", ô đích nét đứt, "Đã đổi chỗ CH-02 ↔ CH-04". Kéo thang 1:10 lên 1:8: "Đã dời thang bộ tới sau CH-16". Thả ra ngoài: "Thả ra ngoài ô — trả về chỗ cũ", bóng tắt. Shift chọn 3 ô → nút ⇋ ghi "3" → "Đã lật gương 3 căn", hoàn tác. ⇉: 5 → 0 → 5 nét tim. ⟲: "Thang bộ về tự động (PC-11)". Tầng 25 riêng: xoá 2:0 → tầng 25 còn 33, chung giữ 34; 3:0 / 0:0 ở tầng 25 bị chặn "đè nhau". Chế độ chỉ xem: 5 / 6 nút khoá, tooltip "Chế độ chỉ xem — công cụ bị khoá", Delete không làm gì.
- Còn dở: xoá căn thêm tay chỉ đặt `bo` (không rút khỏi `canThem`); thêm căn chỉ "sau ô chọn" (chưa có chèn đầu dãy / vào ô trống); lật / thêm / xoá thang có thể đổi kết quả gỡ căn vượt (đúng theo thoát nạn nhưng số căn / tầng nhảy — báo ở panel phải, chưa ghi vào câu báo); kéo thả chưa dò trước hợp lệ khi rê (chỉ kiểm lúc thả — tự chỉnh ~0,3–1 s); thang tay áp cho mọi tầng (không có thang riêng tầng); tầng riêng có thang liền nên xoá căn một tầng có thể bị chặn "đè" do ép thang.

## 2026-10-29 · XC-05 đoạn kẹp: dời trong đoạn / STRETCH thay vì chỉ cảnh báo · agent Opus

- `tinh/loiThang.ts` `suaKhitLoi` → trả `{ sua, bc, stretch, lyDo }`; đoạn không có đầu tự do (hoặc thang liền không được dời) gọi `khitKepLoi` mới: mốc xa = ô thang / dải lõi khác / dãy khác (kể cả mốc đang chồng lên đầu đoạn) / đầu mặt không tự do; thử Δ bề ngang 0, ±100… (STRETCH QT-81, bước 100, ±500 mỗi căn, căn kề lõi trước, căn người dùng đã chọn sau cùng, căn vừa chọn tay `chan` không kéo) và dời đoạn (`mb.dich`) cho chồng / hở lõi ≤ 200 mm, hở xa ≤ 400 mm (lượt 2: không rộng hơn trước). Dồn khít có thể neo đoạn ở đầu xa → đo lại rồi dời bù (≤ 2 lần). Nhận phương án đầu tiên mà `tinh/khe.ts` không thêm đè (số chỗ / mm, trừ chính chỗ chồng lõi đang sửa — tránh đổi chồng lõi thành chồng ô thang) và không thêm khe trên mặt. Thang không dời. Biến thể STRETCH đi qua bố cục trả về → `khacBoCuc` → `ToaDat.tuDong` như các bước tự chỉnh khác. Không sửa được: ghi chú XC-05 kèm "không sửa được: mặt N (… mm): lý do".
- tm-t2 24 tầng: đoạn 2PN+ + 3 studio kẹp giữa lõi và ô thang, đè lõi 215 mm / hở ô thang 215 mm → dời 215 mm, XC-05 `canh_bao` → `da_sua`, đè 1 → 0, căn vượt 0, 40 căn/tầng giữ nguyên.
- Quét 33 mẫu tòa 24 tầng (trước → sau, chỗ XC-05 > 200 mm): tm-t2 1 → 0; 32 mẫu còn lại 0 → 0. Đè / khe / sân / căn vượt / số căn không mẫu nào tệ hơn (tm-t1 đè 1 → 1 có sẵn của mẫu, không phải lõi).
- Ca STRETCH thật (ép thang đứng yên, căn kề lõi tm-t2 1:0 đang +500 đè lõi 715 mm): kéo lại +200 (STRETCH 300 mm), chồng ≤ 198 mm, 0 đè; với 1:0 là căn vừa chọn tay → giữ, cảnh báo kèm lý do.
- Test mới `tinh/khitLoiKep.test.ts` (tm-t2, ca STRETCH + tuDong + gỡ, ca chặn, quét mọi mẫu bọc `layMau`).
- Còn dở: chưa kiểm trên app (5180); đoạn kẹp chỉ có căn không STRETCH được (studio tm-stu-m1…) và Δ > 200 + 400 mm vẫn để cảnh báo (khít đoạn kẹp `khitDoanKep` đổi mẫu lo sau); chưa quét tầng riêng đổi căn cho riêng XC-05.
## 2026-10-29 · kiểm trên app 5 tòa (tự chỉnh + 3D + .dxf) · Claude Code

Script trong trang (bắt blob `URL.createObjectURL`, bắt lỗi `error` / `unhandledrejection` sau tải lại sạch), cổng 5180:
- 4wcy55hp (chỉ xem): tm-l1 .dxf 25/25 căn, tm-z3 24/24; 3D dựng được; có lớp MDI-LOI / MDI-HANHLANG.
- plevadne: tm-t2 "căn vượt 3→0 · bỏ căn 2 · 42→40", .dxf 40/40 (theo mặt bằng đã gỡ căn); tm-i1 "thang 2→4 · vượt 2→0", .dxf 28/28.
- gwym3l6i: tm-u1 "thang 3→3 · vượt 3→0", thang liền "3 thang chung cả tòa · 2 tầng riêng đặt lại thang"; xuất "Tất cả" ra 3 tệp × 32 căn.
- Khung giữa giữ nguyên mọi bước; 0 lỗi runtime. Lỗi `tenTepAn` còn trong log console là bản ghi cũ từ lúc HMR giữa hai lần sửa.
- tm-t2 "cần xem 1" = XC-05: đoạn kẹp giữa hai lõi chồng nét bao 215 mm (> 200) — không có đầu tự do nên chưa dời; đang giao agent sửa bằng STRETCH.

## 2026-10-29 · chốt luật khít + tải tệp CAD kiểm · Claude Code

- Người dùng chốt: khít đoạn kẹp đổi loại căn trước, bỏ căn sau; 13 ca phần dư không lấp được giữ chặn + gợi ý mẫu vừa ô (`tinh/goiYVuaO.ts`, có test). Đã bỏ chữ "chờ chốt" ở `loiThang.ts` / AI_START.
- Tải .dxf (2,9 MB) + .scr từ hộp CAD trên 5180 (bắt blob qua `URL.createObjectURL`): .dxf hợp lệ, 32 INSERT = 32 căn, lớp MDI-HANHLANG / MDI-BAO / MDI-LOI, block căn kéo `CAN_TM_2PN_M1_SP100`; .scr 37 lượt. Phát hiện tên bản vẽ lấy tên dự án có "/" → thành thư mục con; sửa `tenTepAn` (xuatCad.ts) dùng cho tên .dwg / tệp tải + test.
- Push `main` (người dùng cho phép).
- So .dxf tải trên app (dự án `gwym3l6i`, tm-u1, tầng 5 riêng): tầng chung và tầng 5 cùng 32 căn; 5.716 nét lõi / thang (MDI-LOI) và 30 nét hành lang (MDI-HANHLANG) trùng khớp hoàn toàn giữa hai tệp, phần căn khác nhau → thang liền suốt chiều cao đúng cả trong CAD. 3D cùng dự án dựng được, khung giữa giữ nguyên. Lần kiểm cuối trước push là bản đủ ca (`node scripts/kiem.mjs`, 341 test).

## 2026-10-29 · cổng kiểm nhanh + kiểm nốt trên app · Claude Code

- Cổng kiểm `npm run kiem` / `kiem:nhanh` (`scripts/kiem.mjs`, học app cũ `--nho` + `--nhanh`): tsc · vitest web · vitest worker · pytest · build chạy song song; lần ĐẠT ghi sha256 mã nguồn vào `.cache/kiem_da_dat.json`, trùng thì 0 s; `--nhanh` đặt `KIEM_NHANH=1` → 4 bài quét nặng lấy mẫu qua `web/src/thu/layMau.ts`, bỏ build. Đo: vitest đủ 41 s → nhanh 20 s; cổng đủ ~50 s, nhanh ~22 s, nhớ 0 s.
- Thông báo chặn đổi căn kèm gợi ý mẫu khác loại vừa ô (chỉ gợi ý, không tự đổi): "Mẫu khác vừa ô này: Studio M1 (4,0 m), 1PN M2 (6,0 m)".
- Kiểm trên 5180 (dự án thử `gwym3l6i`, bản sao tm-u1): tầng 5 riêng đổi CH-25 → 2PN: "Thang bộ liền suốt chiều cao: 3 thang chung cả tòa · 2 tầng riêng đặt lại thang", gỡ căn vượt 1 → 0 (xếp lại 1, không bỏ căn); 3D dựng được; hộp CAD có phạm vi theo tầng (chung / tầng 5 / tầng 25 / tất cả) + dòng tự chỉnh + ghi chú STRETCH; khung giữa giữ nguyên, console sạch.
- `.claude/launch.json` thêm cấu hình `api` (wrangler dev 8787).

## 2026-10-28 · kiểm QT-69 sân trong + chặn căn không vừa trên app · Claude Code

- `kho.ts` `sua`: phép sửa không đổi PA (vd đổi căn bị chặn) không ghi bước hoàn tác rỗng.
- Kiểm trên 5180, dự án thử `6evyxom9` (bản sao tm-u1 của `qlzn28zt`, tạo qua API dev để có mã sửa): CH-25 → 2PN M1 ở đầu sân: DTXD 2.185,7 → 2.211,2 m², căn vượt 4→0, khung giữa giữ nguyên, hoàn tác về 2.185,7. Quét đổi từng căn giữa sang 2PN M1: 12 lần đổi được (dãy dài / khít), CH-22 bị chặn "ô rộng 5,8 m, mẫu hẹp nhất cần 7,0 m", giữ căn cũ.
- Bẫy: lớp phủ báo chặn tự tắt sau vài giây — bắt bằng MutationObserver khi kiểm tự động.
- Chờ chủ nhiệm: thứ tự ưu tiên khít đoạn kẹp; 13 ca phần dư không lấp được (đang chặn — cho khe kỹ thuật hay gợi ý loại khác?). Chưa push `main`.

## 2026-10-28 · QT-69 đầu dãy hở ra sân trong · chặn đổi loại căn vừa chọn tay · agent Opus

**Đã làm** (nhánh agent, từ `main` @ `675ac94`):
- Việc 1 · QT-69 ở đầu dãy hở ra sân trong (`tinh/loiThang.ts`): `sanHo` tìm sân hở của mẫu = khe cỡ hành lang trên một mặt mà dải giữa bay nằm trọn ngoài nét bao mẫu (chỉ chữ U: tm-u1..u4, mặt B — hai cánh nhìn nhau qua sân 17–29 m). Đầu dãy ở mép sân (không chạm lõi / thang / cánh khác, như `dauKet` app cũ) được dài ra / ngắn lại như đầu cánh tự do: `noiDaiRa` nối nét bao bằng `noiDauSan` (lấy cạnh nét bao gần nhất ≤ 400 mm — tm-u1 cánh phải lệch 65 mm so với khung căn), `epThang` (thang liền) coi đầu sân là đầu mở (`'san'`), không ép STRETCH nhường; DTXD, DT sàn, thoát nạn tính lại theo nét bao mới. Giới hạn: sân còn lại phải vẫn là khoảng trống cỡ hành lang (XC-02: > căn rộng nhất + 500 mm) — vượt thì khít đoạn kẹp lo (nhánh mới trong `khitDoanKep`). App cũ KHÔNG kiểm khoảng cách mặt nhà QCVN 01 §2.6.1 / LO-02 giữa hai cánh trong một tòa (chỉ giữa các tòa, `prototype/shell.src.html` ~9524) nên không thêm. Đo lỗi khít (`loiTheoMat`): khe sân hở không tính vào `hlMm`; thêm `sanMm` = sân bị lấp / hẹp dưới cỡ hành lang hoặc nét bao không theo đầu dãy. Báo `BaoCaoTuChinh.daiSan`, dòng QT-69 ở panel phải (`#dai-san`).
- Việc 2 · không tự đổi loại căn người dùng vừa chọn: `tuChinhSauSua(truoc, sau)` (dùng trong `suaTuChinh` cho đổi căn tay + STRETCH tay) tìm ô vừa đổi tay (`oVuaChon`, mọi tầng chung / riêng), khít đoạn kẹp không được đổi các ô đó sang loại khác (`TuyChonTuChinh.chan`). Sau mọi bước (STRETCH, đổi căn khác, dãy dài ra) mà mặt chứa ô đó vẫn đè / khe → chặn: trả ô về căn cũ (mọi tầng vừa đổi), chạy lại tự chỉnh, báo lớp phủ `.lop-st-bao` "Không đặt được 2PN ở ô này: ô rộng 5,8 m, mẫu hẹp nhất cần 7,0 m. Đã chặn phép đổi, giữ căn cũ…" (`kieu: 'hep'`), hoặc "… phần dư không xếp vừa căn nào (thành khe)" (`'du'`: căn vừa bề rộng nhưng phần dư không lấp được). Căn khác vẫn đổi / bỏ như trước. Bộ tối ưu, về mẫu gốc, đổi công năng, nút panel phải gọi `suaTuChinh(..., { tay: false })` → `tuChinhToa`, vẫn được đổi loại.
- Màn Tầng: thêm danh sách "Đổi mẫu khác bề ngang — chỉ căn này (dãy tự khít)" (`ungVienKhacRong`, `.doi-khac-rong`) — trước đây đổi tay chỉ có mẫu cùng bề ngang nên không thử được hai việc trên app. i18n vi + en `tang.doiKhacRong*`, `tc.chan.*`, `tc.san.*`.

**Số ca** (quét `tinh/quetThangLien.test.ts`, 386 ca, giờ qua `tuChinhSauSua` như màn Tầng): đè / khe 0 → 0, thang liền mọi tầng; đổi loại căn vừa chọn 25 lần (đếm theo báo cáo khít) → 0; chặn 20 ca (ô hẹp 7, phần dư không lấp được 13: tm-i1 5, tm-l1 3, tm-u1 4, tm-z1 5, xh-z2 3); dãy dài ra / ngắn lại ở đầu sân 14 ca (đều tm-u1; trước đây tm-u1 có 12 lần đổi loại căn vừa chọn, giờ 0, còn 4 ca chặn ở mặt A kẹp giữa hai lõi).

**Kiểm:** tsc 0, web 337/337 (mới: tm-u1 1:5 1PN → 2PN chung / tầng 5 riêng dài ra 1.700 mm ở đầu sân, DTXD +14,45 m², không khít; bốn căn hai cánh → 2PN+ sân còn ≥ cỡ hành lang; tm-i1 0:8 → 2PN chặn, giữ căn cũ; tối ưu tự động vẫn đổi loại), build qua. Trên app (vite 5406, API 8787, dự án thử `qlzn28zt`, lô 160 × 90 m, tm-u1, 1440×900): CH-25 (1:5) → 2PN M1: "QT-69 · 1 dãy dài ra 1.700 mm ở đầu hở ra sân trong", căn cuối cánh dời 10,5 px (= 1.700 mm), đầu kia đứng yên, hoàn tác về đúng chỗ; 0:0 → 2PN: lớp phủ "Không đặt được 2PN ở ô này: ô rộng 5,8 m, mẫu hẹp nhất cần 7,0 m…", ô vẫn 1PN; tầng 5 riêng 1:8 → 2PN+: cánh phải dài ra 3.200 mm ở đầu sân, thang liền; Tối ưu theo cơ cấu chạy bình thường. Khung giữa 870×848 tại (270, 52) trước / sau mọi bước.

**Còn dở / chờ chủ nhiệm:** ca "phần dư không lấp được" (13/20) giờ bị chặn thay vì tự đổi loại — có thể chủ nhiệm muốn cho khe kỹ thuật hoặc gợi ý loại khác; ngưỡng sân còn lại dùng XC-02 (căn rộng nhất + 500), chưa có ngưỡng khoảng cách mặt nhà trong tòa (app cũ không có); đầu sân chỉ có ở tòa chữ U trong thư viện; PC-11 chưa coi đầu sân là chỗ thêm thang; chặn hoàn toàn vẫn đẩy một bước hoàn tác không đổi gì.

## 2026-10-28 · khít đoạn kẹp: hết đè / khe khi tầng riêng đổi căn khác bề ngang · agent Opus

**Đã làm** (nhánh agent, từ `main` @ `acd129e`):
- `tinh/loiThang.ts` `khitDoanKep` (chạy trong `tinhGiam`, sau PC-11 / `epThang`, trước gỡ căn vượt): đo đè / khe từng mặt bằng `tinh/khe.ts` (so mốc = cùng mặt bằng với bề ngang bản vẽ, nên sân trong chữ U không tính); dãy căn nào trả về bề ngang bản vẽ thì bớt lỗi là dãy gây lỗi → chọn lại mẫu cho cả dãy bằng quy hoạch động theo tổng bề ngang. Thứ tự (như app cũ tự sinh dãy / dồn khít, chi phí cộng dồn `GIA_KHIT`, so với căn của bố cục vào): (1) căn khác → mẫu cùng loại / biến thể STRETCH (giữ cơ cấu); (2) chính căn người dùng chọn → mẫu cùng loại rộng nhất còn vừa; (3) căn khác → loại khác; (4) bỏ căn DT nhỏ nhất, không bỏ căn người dùng chọn (`boCanKep`: dãy kẹp không có đầu tự do, căn còn lại xích về mốc giữ chỗ; `apBoCan` dùng khi `boCanTren` không được); (5) đường cùng — dãy chỉ có căn người dùng chọn mà không mẫu cùng loại nào vừa — đổi căn đó sang loại khác vừa đoạn, báo rõ. Dãy kẹp hai mốc sát (≤ 400 mm): khít khi neo đầu nào cũng được, hở ≤ 400 mm là tường; dãy có một đầu hở ra khoảng trống: giữ đúng chiều dài bản vẽ. Chạy lại đủ bước tự chỉnh với bố cục mới (DT, số căn, thoát nạn, DTXD tính lại), chỉ nhận khi đo lại thật sự bớt đè / khe; thay đổi ghi `tuDong` (gỡ được, hoàn tác qua `kho.sua`). `TuyChonTuChinh.giu` = ô người dùng tự chọn (tuChinhToa lấy từ bố cục trước tự chỉnh).
- Gỡ căn vượt (xếp lại / bỏ căn) không được nhận nếu để lại đè / khe mới (trước đây xh-z2 có ca bỏ căn kẹp giữa thang và căn góc → khe 7.500 ở tầng chung).
- `thangLien.conLech` giờ đo lại bằng khe.ts (trước lấy ước lượng của epThang). Báo cáo mới `BaoCaoTuChinh.khitKep` (căn đổi từ → đến, căn bỏ, mm còn lại); panel phải màn Tầng liệt kê từng căn "CH-22: 2PN tm-2pn-m2 → 1PN tm-1pn-m1". i18n vi + en `tc.khit.*`.

**Số ca đè / khe** (quét tm-i1, tm-l1, tm-u1, tm-z1, xh-z2 · 24 tầng · tầng 5 riêng · mỗi căn giữa đổi sang mẫu rộng nhất cùng loại và mỗi loại khác = 386 ca): trước 72 ca đè + 33 ca khe (105 dòng lỗi) → sau 0 đè, 0 khe, thang liền mọi tầng, không ca nào báo còn lệch. Cách khít đã dùng: đổi căn khác cùng loại 14, khác loại 70, đổi chính căn vừa chọn cùng loại 8 / khác loại 25 (đường cùng), bỏ căn 9 (đếm trên tầng 5 + tầng chung).

**Kiểm:** tsc 0, web 332/332 (mới `tinh/quetThangLien.test.ts` quét 386 ca; sửa kỳ vọng `tuChinhMoRong.test.ts` từ "còn lệch 200 mm" sang khít: tm-i1 tầng 5 1PN → 2PN, đổi 2PN 0:7 sang 1PN, 0 đè), build qua. Trên app (vite 5405, API 8787, dự án `dsf1rxc3`, 1440×900): tm-i1 tầng 6 riêng (0:1 → 2PN M2) → "Khít đoạn kẹp … đổi 1 căn · bỏ 0 căn · CH-22: 2PN tm-2pn-m2 → 1PN tm-1pn-m1", thang liền 4 thang, hoàn tác bằng nút ↶ đúng. Khung giữa 870×848 tại (270, 52) trước / sau.

**Còn dở / chờ chủ nhiệm:** thứ tự ưu tiên GIA_KHIT là luật nội bộ (đổi căn khác sang loại khác đứng trước bỏ căn); 25/386 ca phải đổi chính căn người dùng chọn sang loại khác vì đoạn kẹp chỉ có một ô (vd tm-i1 0:8 giữa thang và lõi chỉ vừa 5,9 m) — người dùng thấy căn mình chọn bị đổi, có báo; dãy hở ra sân trong (tm-u1) bị giữ đúng chiều dài bản vẽ, chưa cho nét bao theo như QT-69 ở đầu cánh; chỉ quét tầng riêng đổi một căn, chưa quét tối ưu cơ cấu nhiều căn.

## 2026-10-28 · gộp đợt 3 + kiểm trên app · Claude Code

- `6e6ddd0` gộp nhánh gỡ căn / thang liền; sửa danh sách tòa ở panel trái màn Tầng: số căn/tầng theo mặt bằng đã tự chỉnh (tm-t2 42 → 40), không theo mẫu thư viện.
- Kiểm: tsc 0, web 327/327, worker 9/9, pytest 12/12, build qua; trên 5180 dự án `plevadne`: tm-t2 "vượt 2 → 0 · bỏ căn 2 · 42 → 40", không NaN. Dự án `4wcy55hp`: tự chỉnh thang 2→3, căn vượt 2→0, 3D dựng được, hoàn tác về như cũ, khung giữa giữ nguyên. Hộp xuất CAD mở được (.scr / .dxf, ghi chú STRETCH).
- Chờ chủ nhiệm: đoạn kẹp giữa hai thang ở tầng riêng đổi căn rộng hơn có thể còn lệch 200–1.200 mm (báo cảnh báo); số tạm 8 lượt gỡ / 6 lượt xếp lại; phòng KT không đo cự ly.

## 2026-10-28 · tự chỉnh MB đợt 3: gỡ căn vượt cự ly (giamCanThoatNan) · thang liền suốt chiều cao · agent Opus

**Đã làm** (nhánh agent, từ `main` @ `c6a86f1`):
- Việc 1 · `tinh/loiThang.ts` `tuChinhGiam` (bật mặc định, như app cũ `datThangBo` → `giamCanThoatNan`): sau PC-11 còn căn vượt thì (1) tự sinh rút gọn giữ cơ cấu `xepLaiGiuCoCau` — co căn giữa bằng mẫu cùng loại hẹp hơn / STRETCH −500, đổi chỗ hai căn giữa trong đoạn có đầu tự do, nhận nếu chạy lại đủ bước thật sự bớt vượt; (2) mỗi lượt một căn: BỎ căn giữa gần đầu tự do (căn góc trượt vào, mặt co lại, nét bao + DTXD theo — `boCanTren`, công năng ô mới `'bo'`, `MatBangSua.boCan`) hoặc ĐỔI ô căn vượt thành phòng kỹ thuật; chọn phép bớt nhiều căn vượt nhất, bằng nhau thì ưu tiên bỏ (app cũ), rồi DT mất ít hơn. Thang giữ đúng chỗ khi chạy lại (`thangEp` + `thangMau`). Ô phòng KT / trống / bỏ không đo cự ly (`KHONG_KIEM_TN`, QCVN 06 đo từ cửa căn hộ — giá trị tạm, chờ chủ nhiệm chốt). Thay đổi tự ghi vào bố cục và `ToaDat.tuDong`; `goTuDong` gỡ ra trước mỗi lần tự chỉnh (giá trị người dùng sửa khác thì giữ). Tắt: `ToaDat.giamCanTN = false` (giữ nguyên căn, chỉ báo "vượt"). Báo cáo `BaoCaoTuChinh.giamCan` (vượt, xếp lại / đổi / bỏ, căn và cơ cấu trước → sau). Đổi công năng ô ở màn Tầng giờ cũng chạy tự chỉnh.
- Việc 2 · thang liền: tầng riêng có thang khác tầng chung → `hopThang` chèn thang riêng của các tầng vào MẶT BẰNG CHUNG như PC-11 thêm thang (một mặt bằng nhất quán, không bỏ thang nào), rồi `epThang` ép tập đó lên mọi tầng: căn chia vào khe giữa mốc theo mặt bằng chung, dồn khít về lõi / thang, đầu tự do dài ra / ngắn lại, đoạn kẹp lệch bề ngang thì căn giữa co / giãn STRETCH (≤ ±500) hoặc đổi mẫu cùng loại để khít; hở ≤ 400 mm coi là tường (khe.ts). Thang mẫu kẹp không bỏ được → thêm vào tập chung, ép lại. Kiểm lại thoát nạn + gỡ căn từng tầng. Chế độ `ToaDat.thangLien` 'hop' (mặc định) | 'chung'. Cảnh báo "thang khác tầng chung" thay bằng dòng báo `BaoCaoTuChinh.thangLien`.
- Panel phải màn Tầng (`KhoiGiamCan`): dòng gỡ căn (vượt a → b, xếp lại / đổi KT / bỏ, căn / tầng, cơ cấu trước → sau), ô tích "Tự gỡ căn vượt cự ly", dòng thang liền + chọn chế độ (khi có tầng riêng). i18n vi + en.

**Số căn vượt cự ly 24 tầng (H 81,8 m) trước → sau PC-11 → sau gỡ căn:** tm-t2 3 → 2 → 0 (bỏ 2 studio, 42 → 40 căn/tầng, STU 10 → 8); tm-u1 3 → 1 → 0 (bỏ 1 studio, 33 → 32). Mọi mẫu khác về 0 ở PC-11, không đổi căn nào. Lâu nhất ~0,6 s / mẫu (tm-t2).

**Kiểm:** tsc 0, web 330/330 (mới `tinh/giamCanThangLien.test.ts` 10 test: tm-t2, tm-u1 24 tầng, mọi mẫu, tắt / bật, thuần + ổn định, phòng KT; tm-i1 / tm-l1 có tầng riêng: hợp / ép theo tầng chung, cùng điểm chèn thang mọi tầng, không khe / đè, số căn), build qua. Trên app (vite 5404, API 8787, dự án `plevadne`): tm-t2 tắt → "còn 2 căn vượt", bật → "vượt 2 → 0 · bỏ căn 2 · căn/tầng 42 → 40", hoàn tác / làm lại đúng; tm-i1 tầng 6 (bố cục riêng, đổi 1PN 5.800 → 6.000) → "4 thang chung cả tòa · 1 tầng riêng · 2 căn nhường chỗ", chế độ ép theo tầng chung → 3 thang; 3D dựng, không lỗi console. Khung giữa 910×652 tại (0, 52) trước / sau mọi bước (cửa sổ 925 px).

**Còn dở:** tầng riêng đổi sang căn rộng hơn nằm trong đoạn kẹp hai thang có khi co không đủ (vd tm-i1 1PN → 2PN: co 1.500 / 1.700 mm) → còn đè, báo "còn lệch 200 mm — cần chủ nhiệm xem"; tự sinh rút gọn chưa phải DP cả dãy như app cũ (trên mẫu thật chưa gỡ được căn nào, đều phải bỏ căn); ô tòa ở panel trái vẫn ghi số căn/tầng của mẫu.

## 2026-10-28 · tự chỉnh MB đợt 2: PC-11 chuyển mặt · thang theo tầng · 3D / CAD theo mặt bằng tự chỉnh · agent Opus

**Đã làm** (nhánh agent, từ `main` @ `f37645c`):
- PC-11 (`tinh/loiThang.ts` `thangTuDong`): còn căn vượt sau leo dốc cũ thì dò rộng như `datThangBo` app cũ (`doRong`): dời trong đoạn, thêm thang ở MỌI đoạn có đầu tự do (mọi mặt), CHUYỂN một thang sang mặt / đoạn khác (bỏ ở đoạn cũ → dãy co, đặt chỗ cắt mới → dãy dài), kẹt thì dời HAI thang cùng lúc; chạy từ hai điểm xuất phát (kết quả leo dốc + thang bản vẽ), lấy cái tốt hơn. Luật app cũ `legal`: hai thang chiếu lên cùng trục hành lang cách nhau ≥ ngưỡng cụt (`tramThang`). Đo mỗi phương án trên mặt bằng đã kéo trục hành lang (XC-07) và loại ngay phương án tạo khe / đè (`tongKhe`) thay vì để gác cuối bỏ cả PC-11. Còn vượt thì báo mức `vuot` + lý do (`lyDoVuot`: đủ 3 thang, thang kẹp giữa lõi / góc, căn đầu cụt, cần chủ nhiệm quyết như app cũ tự sinh / `giamCanThoatNan`).
- Thang / tự chỉnh theo tầng: `BoCucTang.matBang`; `tuChinhToa` tự chỉnh từng tầng có bố cục riêng với căn của tầng đó, chỉ lưu khi khác mặt bằng chung; thang tầng riêng khác tầng chung → PC-11 `canh_bao` "thang bộ phải liền suốt chiều cao … giá trị tạm, chờ chủ nhiệm chốt". `matBangTang` / `matBangRiengTang` / `mauHieuDung(toa, mau, dl, tang)`; màn Tầng xem tầng nào thì vẽ / đếm / báo cáo theo mặt bằng tầng đó (`toaDangXem` có `mauTang`). DT sàn tháp cộng nét bao riêng từng nhóm tầng (`tinhChiTieu`). `gonTang` giữ `matBang`; `chuanHoaToa` chuẩn hoá `matBang` của tầng.
- 3D (`ve3d/dungToa.ts`, `MoHinh3D.tsx`): dựng từng tầng theo mặt bằng tự chỉnh của tầng (`mauTang`), bỏ dải lõi `bang` (trước đây dựng thành tum sai chỗ), sàn hành lang ngoài nét bao (`sanHanhLangNgoai`), khoá dựng lại theo `chuKyMatBang`.
- CAD (`xuat/xuatCad.ts`, `man/HopXuatCad.tsx`): điểm chèn căn theo vị trí đã dồn (giữ lệch điểm chèn CAD so với mép mô-đun), khoá vị trí đọc `q.khoa` (trước đây lệch chỉ số sau ô thang → căn sai / thiếu), bỏ dải lõi, dải sàn hành lang kéo dài trên lớp MDI-HANHLANG (.dxf + .scr), từng tầng theo mặt bằng của tầng; hộp xuất ghi "Xuất theo mặt bằng đã tự chỉnh". Cách xuất STRETCH (nhúng nét đã kéo) giữ nguyên.

**Số căn vượt cự ly (24 tầng, H 81,8 m) trước → sau tự chỉnh** (trước đợt này → đợt này): tm-i1 2→2 ⇒ 2→0; xh-z4 6→1 ⇒ 6→0; tm-z3 5→0 ⇒ 5→0 (giữ); tm-l3 1→1 ⇒ 1→0; xh-z6 2→1 ⇒ 2→0; tm-t2 3→2 ⇒ 3→2 (vượt, chữ T 3 cánh, đủ 3 thang); tm-u1 3→1 ⇒ 3→1 (vượt, 1/3 thang kẹp giữa lõi / góc). Mọi mẫu khác 0. 12 tầng: mọi mẫu 0. Lâu nhất ~200 ms / mẫu.

**Kiểm:** tsc 0, web 317/317 (mới `tinh/tuChinhMoRong.test.ts` 19 test trên mẫu thật), build qua. Trên app (vite 5403, API 8787, tòa tm-i1 24 tầng): Tối ưu → tự chỉnh "thang 2→3 · căn vượt 2→0 · chuyển mặt 1"; tầng 12, 25 cơ cấu riêng → tầng riêng có mặt bằng riêng (dài 1.900 mm, cảnh báo thang khác tầng chung); 3D công trình dựng, không lỗi console; hộp xuất CAD hiện phạm vi theo tầng + dòng "Xuất theo mặt bằng đã tự chỉnh"; hoàn tác một bước về mặt bằng chung. Khung giữa 270,52 · 870×848 trước / sau mọi bước.

**Còn dở:** tm-t2, tm-u1 ở 24 tầng còn căn vượt — app cũ cũng chỉ gỡ được bằng tự sinh (xếp lại cả dãy căn bằng DP) hoặc `giamCanThoatNan` (cắt căn), cần chủ nhiệm cho phép; chưa làm. Thang tầng riêng khác tầng chung chỉ cảnh báo, chưa gộp thành thang liền suốt chiều cao. Hộp thoại (mở bằng rAF) không chụp được khi khung trình duyệt ẩn — kiểm bằng DOM.

## 2026-10-28 · tự chỉnh mặt bằng tầng XC-03/05/06/07 · PC-11 · QT-69 · agent Opus

**Đã làm** (nhánh agent, đã gộp `nang-cap/architechtures` @ `6215025` trước khi làm QT-69):
- Mô hình tầng sửa được: `ToaDat.matBang` (`MatBangSua`: ô thang bộ, độ dời căn `dich`, mép mặt `mep`, nét bao, hành lang, sảnh, báo cáo) + `ToaDat.duongBao` / `dtxdM2` (nét bao + DTXD riêng của tòa). Mẫu thư viện không đổi; `apMatBang` dựng "mẫu tòa hiệu dụng" (khoá căn giữ "mặt:chỉ số" qua `PhanTuMat.khoa`, dải lõi `bang: true`). PA cũ: `chuanHoaToa` gọi `chuanHoaMatBang`, sai cấu trúc thì bỏ.
- `tinh/loiThang.ts`: XC-03 ô thang 3.000 (hút khe ≤ 600, QT-60 nới ô thiếu — xh-z5 +450 mm); XC-05 dải nét bao MDI-BAO-TM chiếu lên mặt làm mốc, `donKhit` neo về lõi (QT-56b), `khe.ts` coi chồng ≤ 200 mm với lõi là tường chung; XC-06 đo sảnh trên nét tường (`sanhLoi`), phân loại 2.800, nét HL nối qua tim sảnh; XC-07 đồ thị liền / không chéo, kéo trục tới cửa ĐÃ DỜI xa nhất; PC-11 dời / thêm thang cạnh căn tệ nhất (đo bằng `thoatNan`), cắt bớt giữ ≥ 2; QT-69 dãy dài ra / ngắn lại ở đầu cánh tự do theo `lech` của dồn khít, nét bao nối theo.
- `stretchTay` (QT-69): không có căn bù mà đầu dãy là đầu cánh tự do thì nhận (`daiRa`), chặn khi chạm lõi / thang / cánh khác hoặc đang sửa tầng riêng. `chanToa` đọc `toa.duongBao` (tâm vẫn theo nét bao mẫu) → chỉ tiêu, dự toán, 3D dự án, hầm theo.
- Màn Tầng: `man/tuChinhTang.ts` bọc `sua` (đổi căn, STRETCH tay, tối ưu, về mẫu gốc) — tự chỉnh chạy trong CÙNG bước sửa, hoàn tác một lần; một dòng tóm tắt ở panel phải (chi tiết ở tooltip); bản vẽ thêm nét tim hành lang mảnh.

**Kiểm:** tsc 0, web 298/298 (mới `tinh/loiThang.test.ts` 25 test trên tm-i1, tm-u2, xh-i1, tm-z1, tm-l1, xh-z2, xh-z5, xh-v1, tm-u4), build qua. Trên app (vite 5401, API 8787), tòa tm-l1 24 tầng: tối ưu → thang 2→3, căn vượt cự ly 2→1, DTXD 1.710,2 m²; hoàn tác về mẫu; STRETCH +100 căn đầu cánh (căn kề là phòng KT) → QT-69 dài 100 mm, DTXD +0,85 m², −100 về lại. Khung giữa 270,52 · 870×848 trước / sau mọi bước.

**Còn dở:** PC-11 chỉ dời thang trong cùng đoạn / thêm ở đoạn có đầu tự do (không chuyển thang sang mặt khác như `datThangBo`); xét trên bố cục chung, tầng riêng không có thang riêng. 3D (`ve3d/*`) và xuất CAD vẫn vẽ theo mẫu thư viện (không thuộc phạm vi đợt này). Sàn hành lang kéo dài chỉ nối nét bao khi có cạnh biên phủ dải. Số tạm chờ chủ nhiệm chốt: hở ≤ 200 mm giữa căn và nét bao lõi vẫn coi là khít; lệch dải lõi > 1 m = lõi hub không đo theo mặt.

## 2026-10-28 · QLDA TT 38 + gộp STRETCH tay · Claude Code

- `0eaba60`: QLDA tự tra Bảng 1.1 TT 38/2026 (`tinh/duToan.ts` `tyLeQldaTT38`, nội suy, ×0,8 khi TB ≥ 50 %), ô tích trên tab Chi phí, `ChiPhiPA.qldaTT38` mặc định true. Dự án thử 789 tỷ → 1,355 %.
- `fb35e7c`: ghi chú tối ưu tầng khớp chế độ đổi khác bề ngang + STRETCH. Chạy lại tối ưu trên app: 8 căn đổi, lệch 102 → 70, khung giữa giữ nguyên.
- `01a4cf5`: gộp STRETCH tay (mục dưới). Trên app 5180: CH-02 +100 → CH-03 bù −100, hoàn tác về 0, khung giữa giữ nguyên. Kiểm: tsc 0, web 273/273, worker 9/9, pytest 12/12, build qua.
- Bẫy: bấm chuột thật lên bản vẽ qua công cụ trình duyệt dễ lệch toạ độ; chọn căn bằng phát `pointerdown/up/click` lên `path` có `cursor: pointer`. Hoàn tác mất khi tải lại trang.

## 2026-10-28 · STRETCH tay + 3D + xuất CAD căn kéo · agent Sonnet

**Đã làm:**
- `tinh/stretch.ts` `stretchTay(mau, bc, tv, khoa, d)`: kéo căn ±100 (tổng ≤ ±500) bằng cách đổi sang biến thể `id~s+300`; căn kề cùng đoạn dồn khít (`doanCan`, gần nhất trước) kéo ngược `-d` để tổng bề ngang đoạn không đổi; kiểm lại bằng `donKhit` (không `lech`, không `de`). Trả cặp [khoá, id mới]; UI (`man/ManTang.tsx`, panel phải "Căn đang chọn", nút −100 / +100 / 0) áp qua `sua` → `doiCanTaiViTri` / `doiCanTheoTang` nên hoàn tác một bước, DT / số căn / thoát nạn tính lại từ bố cục như mọi đổi căn. Chọn nhiều tầng: kiểm từng tầng, tầng nào chặn thì chặn cả lượt.
- **Chặn (không làm):** căn không có căn kề STRETCH được để bù (đoạn chỉ một căn, kề không có đường cắt / đã ±500 / là ô công năng khác) = trường hợp dãy dài ra / ngắn lại ở đầu tự do của QT-69 app cũ. App cũ dời nét bao + DTXD theo; ở đây nét bao nằm trong mẫu tòa (`duong_bao`, `dtxd_m2`) và `MatBangTang` / `matBang` / `chiTieu` không thuộc phạm vi đợt này nên chặn và báo lý do bằng lớp phủ (`man/baoStretch.ts`, `.lop-st-bao`, `styles/stretch.css`; `position: absolute` trong panel giữa, đo khung giữa không đổi 270,52,870×848). Làm tiếp: cho `ToaDat` nét bao / DTXD riêng.
- 3D: `ve3d/stretch3d.ts` kéo `khoi3d` theo cùng luật 2D (đỉnh x > x_cắt dời st; cửa đi / lan can / lover dời nguyên khối theo tâm; cửa sổ, cửa trượt vắt đường cắt giãn theo hai đầu). `useNap3d(…, tv)` dùng cho 3D tòa và 3D căn (`MoHinhCan tv`). Hạn chế: khối 3D không có `cung` (nét thuộc block) như nét 2D nên cửa vắt đường cắt có thể lệch vài chục mm.
- CAD: cách đã chọn là NHÚNG nét đã kéo, không XREF (thư viện CAD chỉ có `.dwg` mẫu gốc, app này không có AutoCAD sinh `x-canho-stretch/<id>.dwg` như app cũ). `.dxf`: mỗi mức kéo một BLOCK riêng, tên `CAN_<ID>_SP300` / `_SM300` (sửa `khoiTen`: trước đây `+` và `-` cùng ra `_`, trùng tên); `.scr`: không attach XREF cho căn kéo mà vẽ `_.PLINE` nét đã kéo lên lớp A-WALL…; `HopXuatCad` nạp nét qua `idTepCan` + `veTheoId` (trước: gọi tệp `can/<id~s+300>.json` không tồn tại → khối rỗng) và ghi chú trong hộp xuất. Chưa làm: sinh tệp tham chiếu `x-canho-stretch/*.dxf` (không cần khi đã nhúng).

**Kiểm:** tsc 0; web 272/272 (mới: `tinh/stretchTay.test.ts` 8 ca — bù căn kề, DT / số căn, chặn ±500, hoàn tác, chặn khi không bù được, quét 33 tòa: 1298 lượt ±100 kéo được đều không khe / không đè, 246 lượt bị chặn; `ve3d/stretch3d.test.ts` 4 ca; `xuat/xuatCadStretch.test.ts` 4 ca); trên app (vite 5402): tòa i1 chọn CH-06 bấm +100 ×5 → CH-07 bù, lần 6 báo vượt ±500, hoàn tác 5 lần về 0; 3D căn +300 và 3D tòa dựng được; hộp xuất CAD hiện ghi chú "2 mẫu căn STRETCH"; khung giữa 270,52,870×848 không đổi qua mọi bước.

**Còn dở:** dãy dài ra / ngắn lại (QT-69) với nét bao + DTXD; STRETCH hàng loạt (QT-97) / "Sửa nhiều căn" chưa áp cho nút STRETCH; kiểm thoát nạn chỉ tính lại trong tối ưu / panel Tuân thủ, chưa đo riêng sau mỗi lần kéo tay.

## 2026-10-28 · đơn giá app cũ + tự xếp / STRETCH / dồn khít · Claude Code + agent Opus

**Đã làm** (`nang-cap/architechtures`: `03a9fef` đơn giá, `e0bb3be` gộp tự xếp):
- Đơn giá dự toán lấy từ định mức app cũ `MDI_Unitmix_v4/data/master/dinh_muc_du_toan.json` (hồ sơ SĐT NOXH cao tầng Q2/2024 HN, quy 2026 theo trượt giá nhóm A–E, bình quân I15/Z15): dòng dự toán đổi sang nhóm gói thầu (cọc, kết cấu, hoàn thiện, cửa, thang máy, PCCC, M&E) tính trên m² sàn nổi = 9,12 tr/m²; hầm 6,31 tr/m² (đối chứng Saphire); dự phòng KL mặc định 0 (SĐT đã gồm 10 %). PA lưu đơn giá kiểu cũ → tự về mặc định mới. Dự án thử: 740 tr/căn (hồ sơ 736–758).
- Gợi ý xếp tòa MT-05 (`tinh/xepToa.ts`, `ui/GoiYXepToa.tsx`): tham lam trên lưới 3 m, kiểm LO-01/02/05, CT-01..04, thoát nạn; top 5; tự chạy khi lô có chỉ tiêu mà chưa có tòa.
- Tối ưu MB tầng đổi khác bề ngang + STRETCH QT-81 (`tinh/stretch.ts`, `tinh/toiUu.ts`), bật mặc định; dồn khít XC-04 (`viTriCan`); khe XC-02/10 chỉ kiểm (`tinh/khe.ts`); số CH liên tục XC-08. Đường cắt STRETCH 27/34 mẫu trong `can.json`.

**Kiểm:** tsc 0, web 256/256, worker 9/9, pytest 12/12, build qua; trên app: gợi ý ra 3 PA trong 0,4 s, khung giữa không đổi; tab Chi phí không NaN.

**Còn dở:** XC-03 ô thang 3.000, XC-05 khít nét bao lõi, XC-06 sảnh 3,0/2,6 m, XC-07 nối hành lang, PC-11 thang bộ tự động — cần đổi mô hình dữ liệu tầng (lõi / hành lang đang cố định theo mẫu tòa). Nút STRETCH tay từng căn; CAD / 3D căn kéo; Bảng 2.9 / 2.12 QCVN 01 khi gợi ý; bề rộng đường từng cạnh lô; QLDA lũy thoái TT 38/2026 (app cũ có bảng).

## 2026-10-28 · tab Chi phí · agent Opus + Claude Code gộp

**Đã làm** (`885b125` trên `nang-cap/architechtures`, chưa vào `main`):
- `tinh/duToan.ts`: khối lượng theo lô / tòa (DT sàn tháp / đế / áp mái / hầm, DT thông thủy, mặt ngoài, chỗ đỗ từ `raiHam`, thang 1/70 căn) → dự toán nhóm xây dựng + thiết bị, QLDA, tư vấn, khác, dự phòng → tổng mức, suất đ/m², đ/căn.
- `tinh/taiChinh.ts`: doanh thu căn theo tầng (hệ số tầng), chỗ đỗ, thương mại đế, trừ lệch cơ cấu → lợi nhuận, biên, giá hoà vốn.
- `TrangThaiPA.chiPhi`, `CHI_PHI_MAC_DINH` (mọi số là số tạm), preset nhóm `chiPhi`, XLS sheet Dự toán + Tài chính.
- `man/ManChiPhi.tsx` (giữa + phải; nhớ kết quả bằng WeakMap theo PA, hàm `ketQua` đã export). So sánh PA: thêm hàng tổng mức / lợi nhuận (màn hình + XLS).

**Kiểm:** tsc 0, web 235/235, worker 9/9, pytest 12/12, build qua; trên app: khung giữa không đổi kích thước khi sang Chi phí, không NaN.

**Còn dở:** số thang chưa đếm từ lõi; toàn bộ đơn giá / giá bán / tỷ lệ chờ QS chốt; mức trừ lệch cơ cấu (0,1%/điểm) cần chốt.

## 2026-10-28 · v0.2.0 · Claude Code (Opus 5.5) + 9 agent

**Yêu cầu:** học Architechtures (sổ tay, blog, 21 video, bấm thử app thật) → chọn lọc cái hợp app + QCVN → làm hết, chia nhánh / agent, chọn model tối ưu.

**Đã làm** (nhánh `nang-cap/architechtures`, gộp `main` ở `6b9436c`, đã push; sau đó `562b0fb` phiên bản):
- DT sàn HSSDĐ theo QCVN 01:2021 1.4.21: cộng hầm (trừ đỗ xe / kỹ thuật theo `pa.phanHam`), áp mái, căn theo từng tầng, trừ ô đổi sang phòng kỹ thuật. Dự án thử: chỉ tiêu trước đây tính thiếu (bỏ hẳn hầm).
- Luật QCVN 04 DC-06…DC-11 + panel Tuân thủ; SHCĐ ≥ 0,8 m²/căn.
- Ô căn: đổi công năng, chọn nhiều, menu lõi; bố cục riêng từng tầng (`ToaDat.tangRieng`).
- Màn Hầm: QCVN 13 + QCVN 04 2.2.17, xe điện theo dự thảo SĐ 01:2026 (chỉ cảnh báo), vẽ tay ranh, 3D khối hầm.
- Dữ liệu phòng 34/34 mẫu căn bóc từ DWG (loại phòng đoán theo thiết bị), nhãn A / Ø.
- So sánh PA ≤ 6, nhân bản PA, xuất XLS, xuất CAD theo tầng + công năng ô.
- Tooltip kèm căn cứ QCVN, preset hai tầng, hiệu ứng H1–H19, khung giữa cố định (0 lần lệch).
- Phiên bản app hiện trên giao diện.

**Cách làm:** 7 agent đợt 1 (Opus: ô căn + nhiều tầng, hầm, bóc phòng; Sonnet: hiệu ứng, tooltip + preset, so sánh + XLS, luật QCVN 04), 2 agent đợt 2 (Sonnet: xuất CAD theo tầng, 3D hầm + vẽ ranh). Mỗi agent một worktree, gộp từng nhánh vào nhánh tích hợp, chạy lại test sau mỗi lần gộp.

**Kiểm:** web vitest 219/219, worker 9/9, pytest 12/12, `tsc` 0, `vite build` qua; xem trên app 1440×900 và 1200×800.

**Còn dở:** tab Chi phí (dự toán + tài chính, agent Opus); tự xếp tòa TMB + STRETCH MB tầng như app cũ (agent Opus); các điểm chờ chủ nhiệm chốt (mục 6 tài liệu học Architechtures).

## 2026-10-29 · Dân số theo QĐ tỉnh — đối chiếu toàn văn + NOXH / TĐC theo loại hình · Claude Code (Opus 5.5, agent)

**Yêu cầu:** thay quy tắc "tạm" Hải Dương / Phú Yên / Đồng Nai bằng trị số trong văn bản gốc; NOXH, TĐC tính theo quy định riêng của từng địa phương, chỗ chưa có thì mặc định quốc gia.

**Nguồn:** toàn văn trên vbpl.vn (CSDL quốc gia về pháp luật) — thuvienphapluat chặn bằng captcha, không dùng. Kho "QCVN TCVN" (_DANH-MUC.md) không có trên máy; chỉ có `E:\OneDrive\_QCVN-TCVN`.
- Hải Dương QĐ 11/2024 (hiệu lực 26/4/2024): Điều 3 khoản 1 (3,0 người/hộ; 35,5 m² sàn/người), khoản 2 bảng chung 45 / 80 / 120 / 150 / 180 → 1…6 người.
- Đồng Nai QĐ 09/2025 (hiệu lực 01/3/2025): Điều 4 khoản 1 (3,53 người/căn; 31,0 m²/người đô thị, 28,5 nông thôn), khoản 3 bảng theo SỐ PHÒNG Ở + DT → kiểu phương pháp mới `bangPhong` (Studio/1PN → 1 phòng, 2PN/2PN+ → 2, 3PN → 3).
- Phú Yên QĐ 05/2025: Điều 4 chỉ có P = S / Stb, Stb theo Chương trình phát triển nhà ở tỉnh — QĐ không ghi trị số → giữ tạm 32, cờ tạm.
- Hà Nội QĐ 34/2024 Điều 4 khoản 1 (TM), khoản 2 (NOXH) khớp bảng cũ; QĐ 39/2026 không sửa Điều 4. QĐ không quy định TĐC → TĐC nay theo mặc định quốc gia S / 32 (trước: bảng TM).
- TP.HCM QĐ 83/2026 khớp mã cũ (TĐC gộp điểm a cùng TM).
- QCVN 01:2021, 04:2021 (kho local) không có người/căn riêng cho NOXH / TĐC → mặc định quốc gia `FALLBACK_QG_LH` = 32 m²/người (QĐ 2161).

**Mã:** `QuyTacTinh.loaiHinh` (loại hình QĐ có quy định), `bqCan.giaiDoan / loaiHinh`; `quyTacApDung().theoLoaiHinh` chọn phương pháp từng loại hình; `KetQuaDanSo.theoLoaiHinh`; Dashboard dân số thêm dòng cách tính + căn cứ theo từng loại hình (ghi "mặc định quốc gia" khi QĐ không quy định).

**Kiểm:** `node scripts/kiem.mjs` ĐẠT (web 709, worker 9, pytest 15, tsc, build). Chưa xem trực tiếp trên app (server preview đang chạy là của bản checkout chính).

**Chờ chủ nhiệm chốt:** Stb Phú Yên; 2PN+ = 2 phòng ở (Đồng Nai); mốc 125 m² Đồng Nai (lời văn trùng mốc); dùng mốc đô thị 31,0 cho Đồng Nai.

## 2026-10-29 · iPhone: app mở từ màn hình chính (PWA) + khởi động nhẹ · Claude Code (Opus 5.5, agent)

**Yêu cầu:** trên iPhone (Safari, 5G) mở trong Safari thì mượt, mở từ biểu tượng "LEO-Unitmix" ở màn hình chính thì giật, chậm. Làm PWA đúng chuẩn, service worker, giảm việc lúc mở / thao tác trên máy cỡ iPhone.

**Mã:**
- `web/public/manifest.webmanifest`, `web/public/_headers` (`/assets/*` immutable 1 năm, `sw.js` no-cache, kiểu manifest), icon `web/public/brand/pwa_*.png` sinh từ `leo_ai_app_icon.png` bằng `scripts/sinh_icon_pwa.py` (chỉ đổ nền + thu nhỏ, không vẽ lại), meta iOS web app trong `web/index.html`.
- Service worker: khuôn `web/pwa/sw.js` + plugin `web/pwa/plugin.ts` (trong `vite.config.ts`) → `dist/sw.js`, phiên bản = băm cả `dist`. Đăng ký `web/src/pwa/dangKySW.ts` (chỉ bản build, sau load + 1,5 s).
- `ui/ThanhTren.tsx` `TabTruot`: hết ép tính bố cục sau mỗi lần vẽ lại thanh trên. `ui/so.ts` `fmtSo` + `man/CongCuTang.tsx`: dùng lại `Intl.NumberFormat`.
- `ve3d/Khung3D.tsx`: máy cảm ứng pixelRatio ≤ 1,5, bóng 2048; bỏ `preserveDrawingBuffer`.
- `styles/man-hinh-chinh.css` (mới, không đụng `dien-thoai.css`): standalone chặn kéo dãn trang, tắt menu giữ-lâu trên bản vẽ; `(hover: none)` bỏ filter hover dính.
- `scripts/do_dien_thoai.mjs` (không trong cổng): đo iPhone giả lập, Safari vs standalone, lần đầu / mở lại / ngồi yên / kéo-chụm TMB / mở Tầng / mở 3D.

**Kiểm:** `node scripts/kiem.mjs` ĐẠT (tsc, web 709, worker 9, pytest 15, build); `kiem_man_hep.mjs --chi 390` ĐẠT; `node --check dist/sw.js`; header kiểm qua `wrangler dev` cổng 8811. Số trước / sau: `docs/de_xuat_hieu_nang.md` mục 14 (mở lại từ biểu tượng 1.116 → 558 ms, TBT mở lại 134 → 28 ms, mở 3D TBT 402 → 264 ms, canvas 3D −44 % điểm ảnh).

**Chưa làm / chưa chắc:** không có iPhone / WebKit để đo thật; Chromium không giả lập được `display-mode: standalone`, không thấy vòng resize / rAF chạy nền. Người dùng phải XOÁ biểu tượng cũ trên màn hình chính rồi thêm lại (iOS chỉ đọc manifest / icon lúc thêm). Chưa tách chunk chính 747 KB.

## 2026-10-29 · Trang "Dự án của tôi" gọn kiểu Architechtures · Claude Code (Opus 5.5, agent)

**Yêu cầu:** đầu trang Dự án rườm, chữ mảnh và thưa; sắp lại gọn như bảng dự án Architechtures; nút thành biểu tượng; chép đường dẫn chọn link xem / link sửa; bỏ được dự án người khác chia sẻ khỏi danh sách; logo to hơn; người tạo + phiên bản + ngày một chỗ cạnh VI / EN.

**Quyền sửa (đã có, không đổi):** server chỉ lưu bản băm mã sửa (`du_an.bam_ma_sua`), lệnh ghi gửi header `X-Ma-Sua`. Máy có quyền sửa khi `localStorage['unitmix.maSua.<mã>']` có mã — cất lúc tạo dự án, mở link `?sua=` (`nhanMaTuLink` cất rồi gỡ khỏi thanh địa chỉ) hoặc dán link sửa ở ô "Dán link". Danh sách trang = `unitmix.duAnDaMo` (ghi khi mở dự án).

**Mã:**
- `kho/maSua.ts`: `taoLinkXem` / `taoLinkSua` thuần, `linkChiaSe(goc, ma, 'xem' | 'sua', maSua)` (link sửa = `null` khi máy không có mã), `quyenDuAn`, `boMa` / `chenLai` thuần + `boKhoiDanhSach` / `hoanTacBo` (chỉ sửa danh sách trên máy, KHÔNG gọi server, giữ mã sửa).
- `man/DuAn.tsx` viết lại: đầu trang (tiêu đề trái + số dự án, nút "+ Tạo dự án" phải), thanh lọc (tìm không dấu, sắp xếp mở gần đây / PA sửa gần đây / tên, dán link + Mở), thẻ dự án (tên, nhãn "Sửa được" / "Được chia sẻ · chỉ xem", địa điểm · số PA · mã), nút biểu tượng So sánh PA · Đổi tên · Chép đường dẫn · Bỏ khỏi danh sách · Mở; bảng PA một lưới (tiêu đề cột một lần, số canh phải tabular), nút Đổi tên · Nhân bản · Xoá · Mở. Chép đường dẫn: máy có mã sửa → menu "Link chỉ xem" / "Link có thể sửa" (kèm mã sửa); không có → chép link xem luôn. Báo nhỏ `.bao-nho` (đã chép / đã bỏ + Hoàn tác). Bỏ dự án sửa được thì hỏi lại trước.
- `man/locDuAn.ts` (lọc / sắp thuần). `ui/ThanhTren.tsx`: tách `useLichSu` / `BangLichSu`, `ThuongHieu anBan`, `TacGiaBan` (NghiaVT · vX · ngày từ `LICH_SU_PHIEN_BAN`, cả khối là nút mở lịch sử). Bỏ chân trang "Người tạo · phiên bản" ở trang này.
- Biểu tượng nét mới (tự vẽ): `moDuAn`, `soSanh`, `doiTen`, `chepLink`, `boDs`, `tim`; `NutBieuTuong` thêm `nhan`, `moRong`.
- `styles/du-an.css` (mới, import sau `man-hinh-chinh.css`): logo 40 px (điện thoại 34 / 30), tiêu đề 22 px 600, chữ khít; bỏ luật `.bang-du-an` / `.hang` cũ ở `unitmix.css`, `dien-thoai.css`.

**Kiểm:** `node scripts/kiem.mjs` ĐẠT (tsc, web 737, worker 9, pytest 15, build); test mới `kho/chiaSe.test.ts`, `man/locDuAn.test.ts`; `kiem_man_hep.mjs` 390 ĐẠT (trang-du-an, tao-du-an, so-sanh). Trên app (Edge headless): link sửa chép ra `…/du-an/2mlg1a2l?sua=…`, dự án chia sẻ chỉ có "Chép link xem", bỏ khỏi danh sách + Hoàn tác trả đúng chỗ. Ảnh trước / sau: `docs/anh/du-an/`.

**Chưa làm:** không có API xoá cả dự án trên server (chỉ xoá PA) — dự án của mình cũng chỉ "bỏ khỏi danh sách"; chưa có ảnh thu nhỏ mặt bằng trên thẻ (Architechtures có).
## 2026-10-29 · Leo AI — trợ lý Claude điều khiển app · Claude Code (Opus 5.5, agent)

**Yêu cầu:** thêm trợ lý AI ("Leo AI", thương hiệu LEO) trong app, dùng Claude, thao tác THẬT mọi tính năng như người dùng (xếp tòa, sửa tầng, hầm, chi phí, PA…); khoá riêng hoặc khoá chung máy chủ; giao diện như Claude (chảy chữ, Markdown, bước công cụ, dừng, lịch sử, sửa / thử lại, đính kèm), giọng nói, chọn mô hình (mặc định Sonnet 5.5 · Cân bằng) + gợi ý mô hình 0 token khi gõ, chạy tốt trên điện thoại.

**Mã:** chi tiết ở `docs/tro_ly_ai.md`.
- `kho/khoLoi.ts` — lõi thuần của `useKho` (sửa luôn trên bản mới nhất, trả có / không đổi); `useKho` dùng lõi này, trả thêm `loi`, `layCheDo`.
- `troLy/congCu/*` — 45 công cụ (đọc, điều hướng, TMB, tầng, hầm, chi phí, PA, xuất, hoàn tác, UI dự phòng) gọi đúng hàm các màn; `troLy/vongLap.ts` vòng tác tử (stop_reason, gom tool_result, Dừng, gọn lịch sử); `troLy/khachThat.ts` SDK `@anthropic-ai/sdk` 1.3 (khoá riêng thẳng Anthropic / khoá chung qua Worker); `troLy/LeoAI.tsx` + `styles/leo-ai.css`; `troLy/giongNoi.ts`, `uiDom.ts`, `markdown.ts`, `hoiThoai.ts`, `goiYMoHinh.ts`, `moHinh.ts`, `heThong.ts`, `nguCanhSoan.ts`.
- Nối vào trình soạn: nút Leo AI trên `ThanhTren` (máy tính) / dock dưới `KhungSoan` (màn hẹp), khung là `lopPhu` cố định — không đụng `DuAn.tsx`, phần `ThuongHieu`. `man/ManTang.tsx` thêm `tangDangXem`; `man/tuChinhTang.ts` thêm `choDuLieuMB`.
- Worker: `worker/src/ai.ts` (`GET /api/ai/trang-thai`, `POST /api/ai/v1/messages`), migration `0002_ai_luot.sql`.
- `scripts/leo_ai_e2e.mjs` (E2E mô hình giả, ảnh `docs/anh/tro-ly/`), `scripts/kiem_man_hep.mjs` thêm hộp `leo-ai`.

**Kiểm:** web vitest (công cụ 50 ca + vòng 11 + gợi ý 6 + markdown 3 + kho 2), worker 14/14 (5 mới), `tsc` 0; E2E Leo AI ĐẠT (1440×900 + 390×844); `kiem_man_hep.mjs` 390 / 768 / 844 / 1440 ĐẠT; `node scripts/kiem.mjs` ĐẠT (tsc, web 799, worker 14, pytest 15, build); `kiem_man_hep.mjs` đủ 7 khung ĐẠT (hộp leo-ai đạt mọi khung).

**Chủ app phải làm:** `npx wrangler secret put ANTHROPIC_API_KEY` và `npx wrangler d1 migrations apply unitmix --remote` (bảng `ai_luot`). Không đặt thì người dùng dán khoá riêng.

**Còn dở / chưa chắc:** chưa chạy với Claude thật; vài thao tác chỉ có trên bản vẽ (vẽ ranh hầm, kéo tự do) đi qua `ui_*`; giá Haiku 5.5 theo bảng chủ nhiệm đưa, cần đối chiếu trang giá Anthropic.

**Đề xuất:** (1) nút "Leo AI giải thích" ở các cảnh báo LO-01/02/05 và chỉ tiêu vượt — mở khung với câu hỏi sẵn; (2) công cụ vẽ / sửa ranh hầm và nhập chỉ tiêu từ ảnh chụp bảng QH (Claude đọc ảnh → `update_lot`); (3) đo `usage.cache_read_input_tokens` hiện ở Cài đặt (chi phí thật mỗi cuộc); (4) học Forma: "Leo AI so sánh 3 phương án xếp tòa" chạy `suggest_arrangements` rồi `compare_pas` trên PA nhân bản; (5) nhật ký thao tác Leo AI theo PA (ai sửa gì) để chủ nhiệm duyệt.

## 2026-10-29 · PCCC + thang máy trên mặt bằng tầng · Claude Code (Opus 5.5, agent)

**Yêu cầu:** hiện số thang máy (70 căn / 200 người mỗi thang, tra đúng điều), xác định cửa ngăn cháy và thang máy chữa cháy, kiểm bán kính 60 m, cách đặt tủ PCCC, cửa chia khoang hành lang (ngăn khói) theo chiều cao PCCC; học app cũ trước, thiếu thì lấy quy chuẩn.

**Căn cứ (kho `E:\OneDrive\_QCVN-TCVN`, PyMuPDF):** QCVN 04:2021 2.4.1 (≥ 5 tầng 1 thang, ≥ 10 tầng 2), 2.4.2 (1 thang / 200 người hoặc / 70 căn — app cũ ghi nhầm là "bảng chuẩn Viện"), 2.4.3 + QCVN 06 6.13 (TMCC khi H > 50 m với F1.3; bán kính ≤ 60 m; A.2.12 nhà > 75 m ≤ 45 m), QCVN 04 2.5.3 (họng chờ → cửa căn xa nhất ≤ 45 m theo đường đi), QCVN 06 3.3.5 (hành lang > 60 m phải chia) / A.3.1.7 → A.2.14 (khối căn hộ ≤ 30 m, nhà > 75 m), 3.2.11 (cửa buồng thang loại 1), 3.3.5 (cửa mở ra hành lang EI ≥ vách), Bảng 2 / Bảng 3, 4.24, A.3.1.12, A.2.30.2, D.2 a (hút khói hành lang > 28 m). TT 31/2026 không sửa 2.4 / 2.5.3. Không có TCVN 4451 / 7628 / 6396-72/73 trong kho.

**App cũ:** QT-94 min(căn/70, dân/200), QT-76 tính cả TMCC + thang hàng, QT-64 đếm giếng theo hình; TMCC chỉ là ô số (không chỉ định giếng, không kiểm bán kính); không đánh dấu cửa ngăn cháy; tủ QT-77 (R 18 m chủ nhiệm chốt); cửa hành lang QT-95/98/100–105 (30 / 60 m, DP chính xác). Không có kiểm 60 m nào ngoài chiều dài hành lang.

**Mã:** `tinh/thangMay.ts` (giếng từ `loi/*.json` `vi_tri_gieng`, số cần, chọn TMCC phủ tham lam, hoà → gần N3), `tinh/chiaHanhLang.ts` (đặt cửa từ lá về gốc, `doKhoang`), `tinh/pcccTang.ts` (`phanTichPCCCTang` gom mọi lớp, nhớ theo mặt bằng hiệu dụng; `soLieuToaPCCC`, `thangMayToa`), `ve/LopPCCC.tsx` (5 lớp trong nút Lớp, chú giải, chữ giữ cỡ tối thiểu theo px/mm, tủ kéo bám tường → `ToaDat.tuPCCCTay`), `ui/KpiPCCC.tsx` (khối panel phải + cảnh báo), `ui/ThangMayLo.tsx` (TMB), Leo AI `check_rules` thêm `pccc` từng tòa. `ManTang.tsx` chỉ thêm vài dòng gắn lớp / khối. Luật: `chep_quy_tac.py` sửa nguồn CT-05/06/07, PC-07, hàm PC-05/06/08 + 5 luật bổ sung (`qcvn04_241_thang_toi_thieu`, `qcvn06_613_ban_kinh_tmcc`, `qcvn04_253_hong_cho_45`, `qcvn06_cua_ngan_chay`, `qcvn06_D2_hut_khoi_hl`).

**Kiểm:** `tinh/pcccTang.test.ts` 17 ca (2.4.1 / 2.4.2 tay, ngưỡng 50 m, R 60/45, chọn giếng, giếng xoay / lật, chia 50 / 130 m / chữ T, dời cửa, tòa thật tm-z3 24 và 12 tầng, tủ đặt tay). Ảnh Z3 24 tầng (H 81,8 m) `docs/anh/pccc/` (Edge headless, vite 5393 + API 8787, dự án 2mlg1a2l — đã đặt thêm một tòa Z3 vào lô NO-01 của PA thử). Z3: thang máy 5 / 9 (thiếu), TMCC 1 giếng 42,6 / 45 m, họng chờ 32,1 / 45 m, 5 tủ, 2 cửa CNC khoang 28,5 / 30 m, 5 căn vượt thoát nạn.

**Chờ chủ nhiệm chốt:** `docs/pccc_tang.md` mục 8 (đo bán kính TMCC thẳng hay theo đường đi; giữ min hay max hai cách tính thang máy; giếng thứ 5 lõi z3_tm_06; cửa phòng KT nhà ≤ 75 m; N2 có làm nguồn họng chờ; cửa hành lang theo đủ R1–R7 app cũ; bổ sung TCVN 4451 / 7628 / 6396).

**Đề xuất:** (1) chép DP cửa hành lang của app cũ (cộng sảnh thang máy, R4 không quét cửa) thay bản tham lam; (2) giếng thang tách loại (khách / chữa cháy / hàng / băng ca) bằng dữ liệu lõi để đếm và gán TMCC chắc hơn — học Forma "core schedule"; (3) gợi ý đổi lõi khác cùng hình khi thiếu thang máy (lõi tm_09, tm_13); (4) lớp PCCC trên 3D (khoang hành lang tô màu) và xuất CAD layer `MDI-PCCC-*` như app cũ; (5) nút "Leo AI giải thích" cho từng cảnh báo PCCC.

## 2026-10-29 · Cửa ngăn cháy hành lang: chép đủ bộ giải app cũ (QT-95 / 98 / 100–105) · Claude Code (Opus 5.5, agent)

**Chủ nhiệm chốt (29/10/2026):** số thang máy giữ min(căn / 70, người / 200) + tối thiểu 2.4.1; bán kính thang máy chữa cháy đo THẲNG; cửa chia khoang hành lang làm đúng bộ giải app cũ (sảnh thang máy chung khoang, cửa ≥ 6 m, cánh không quét cửa căn…), giữ 60 m (≤ 75 m) / 30 m (> 75 m). Còn mở: giếng lõi z3, cửa phòng KT, N2 làm nguồn họng chờ, TCVN 4451 / 7628 / 6396.

**Mã:** `tinh/cuaNganChay.ts` chép `hlDoThi` · `cncDem` · `cuaNganChay0` của `prototype/shell.src.html` (gộp tuyến, nút giao, cầu + cây khung, tường chung, luật cứng R2–R6 `cam`, R4b `sachQuet`, tham lam + tinh chỉnh + thêm / bớt cửa + quy hoạch động Pareto + chế độ nới) — thay bản tham lam `chiaHanhLang.ts` (đã xoá). Đoạn sảnh thang máy (`hlSanhTruc`) lấy từ app cũ chạy headless rồi đổi sang toạ độ khối lõi: `scripts/cnc_cu.js` (chạy bằng `node scripts/chay_selftest.js --jsfile` trong repo cũ) + `scripts/chep_sanh_hl.py` → `web/src/tinh/sanhHL.json` và số đối chiếu `web/src/thu/cnc_cu.json`. Vật cản cửa căn = nét cửa trên tường hành lang: trường mới `cua_hl` trong `can.json` (`scripts/sinh_phai_sinh_can.py`; dùng tim ± 450 thì chỉ khớp 109 / 110 cửa và ~70 % vị trí). Lớp vẽ: block cửa hai cánh như `cncKhoi` + bù tường 150, cam = cánh chồng cửa; cảnh báo `pc.cb.cncQuet` / `pc.cb.khoangVuot`. Luật quy_tac: PC-05/06 hàm mới, `mdi_cnc_quet`, ghi "đã chốt" ở thang máy / bán kính TMCC.

**Kiểm:** `tinh/cuaNganChay.test.ts` — 33 mẫu tòa bố cục gốc: số cửa 110 / 110 (30 m) và 49 / 49 (60 m) bằng app cũ, ≥ 90 % cửa app cũ có cửa mới cách ≤ 0,3 m, mọi khoang ≤ giới hạn, không khoang < 5 m, Z3 3 cửa khoang 28,5 · 24,9 · 18,3 · 13,6 m (cũ 28,5 · 25,0 · 18,2 · 13,6); ca dựng tay: tường chung, ≥ 6 m, R4a không chặn cửa căn, R2 không đặt chỗ hở tường, sảnh TM cộng vào khoang + R3. Ảnh trước / sau `docs/anh/pccc/z3-cnc-truoc.png` · `z3-cnc-sau.png` · `z3-cnc-sau-phong-to.png` (PA thử pa-2, Z3 24 tầng: 2 → 3 cửa, 2 cửa cánh chồng cửa). Một lần giải ~70 ms (nhớ theo mặt bằng).

**Đề xuất:** (1) kéo / thêm / xoá cửa hành lang tay như QT-101 (`ToaDat.cncTay`); (2) dựng đoạn sảnh từ hình lõi (`sanhLoi` / `sanhThang`) thay dữ liệu chép để lõi mới cũng có; (3) chạy bộ giải trong Web Worker như `tayNen` khi tòa lớn (T2 ~ 150 m hành lang); (4) xuất CAD lớp `MDI-PCCC-CNC` như app cũ.
