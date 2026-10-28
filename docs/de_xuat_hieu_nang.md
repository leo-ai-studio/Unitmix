# Đề xuất: hiệu năng, tính năng, công cụ (khảo sát 2026-10-29)

Khảo sát chỉ đọc, không sửa mã nguồn. Nhánh gốc `nang-cap/architechtures` (eaa0de0). Máy đo: Windows 11, 12 luồng, Node 24, Vite 6.4, Vitest 4.1. Mẫu PA: dự án `tztd1udv` / `pa-1` lấy từ API cục bộ (1 lô 400×400 m, 2 tòa `tm-t2` + `tm-i1` 24 tầng, 1.584 căn, JSON 9,6 KB).

Quy ước: **gz** = gzip. **S/M/L** = công sức (S < nửa ngày, M 1–3 ngày, L > 3 ngày). Số đo ghi lệnh/cách đo; chỗ không đo được ghi "chưa đo" ở mục 6. Mọi "ước lượng" là tính từ số đo, chưa làm thử.

## 1. Bảng số đo hiện trạng

### 1.1 Bundle (`cd web && npx vite build`, 163 module, 2,8 s)

| Chunk | Kích thước | gz | Tải khi nào |
|---|---|---|---|
| `index-*.js` (toàn bộ mã app + preact + clipper-lib + dxf-parser) | 712,1 KB | 242,1 KB | lúc khởi động |
| `index-*.css` | 59,1 KB | 12,2 KB | lúc khởi động |
| `three.module-*.js` | 688,4 KB | 177,0 KB | lười, `import('three')` khi mở 3D (`ve3d/Khung3D.tsx:89`) |
| `OrbitControls-*.js` | 19,0 KB | 4,3 KB | lười, cùng lúc với 3D |
| `xlsx-*.js` | 500,1 KB | 163,1 KB | lười, `import('xlsx')` khi xuất / nhập XLS (`xuat/xuatXls.ts:209`, `nhap/docExcel.ts:23`) |

Khởi động tải JS+CSS: **254 KB gz** (đo thực tế trong trình duyệt: 10 request, 6 KB header). Chỉ có 3 điểm tách chunk động (three, OrbitControls, xlsx); mọi màn (`ManHam`, `ManChiPhi`, `SoSanhPA`, `HopXuatCad`/`xuatCad`, `ManLo`+`dxf-parser`, `ve3d/dung*`) nằm trong chunk chính. Phân rã chunk chính theo sourcemap (`vite build --sourcemap`, cộng độ dài mã đã minify theo mapping; số xấp xỉ): `man/` 146 KB, `tinh/` 145 KB, `clipper-lib` 100 KB, `ve3d/` 32 KB, `ve/` 30 KB, `ui/` 30 KB, `dxf-parser` 22 KB, `xuat/` 16 KB, `nhap/` 11 KB. (Dòng `preact-iso` 131 KB trong phân rã là sai số của cách quy gán mapping, router thật chỉ vài KB; bỏ qua.)

### 1.2 Dữ liệu `web/public/lib` (đo bằng Node: `fs` + `zlib.gzipSync`)

| Tệp | Thô | gz | Ghi chú |
|---|---|---|---|
| `toa.json` (33 mẫu tòa) | 284,8 KB | 33,5 KB | `mat` (mặt bằng) chiếm 209,9 KB = 76%. Tải lúc khởi động |
| `can.json` (34 mẫu căn) | 90,5 KB | 18,3 KB | `phong` chiếm 70,3 KB = 78%. Tải lúc khởi động |
| `quy_tac.json` | 73,2 KB | 15,3 KB | đang in đẹp; thu gọn còn 52,5 KB. Tải lúc khởi động |
| `pccc.json`, `nguon.json` | 2,9 KB, 1,3 KB | | |
| `can/*.json` (34 tệp) | 4.289 KB | 688 KB | trung bình 126 KB/tệp. Lười |
| `loi/*.json` (25 tệp) | 1.029 KB | 191 KB | lười |

Trong `can/*.json`: nét `equip` (thiết bị) 2.271 KB (54%) + `furn` (nội thất) 1.148 KB (27%) = **81%** là nội thất / thiết bị; `door` 313 KB; `wall`+`detail`+`space`+`rail`+`tim` ≈ 420 KB; `khoi3d` chỉ 96 KB (2%). 28.280 nét, trong đó 17.084 nét chỉ 2 điểm.

Khởi động tải 448 KB thô / ~67 KB gz dữ liệu (3 tệp). Nén ở Cloudflare Assets: chưa đo trên bản deploy (vite preview không nén, `transferSize` = kích thước thô).

### 1.3 Tải trang (`http://localhost:5416/du-an/tztd1udv?pa=pa-1`, trình duyệt trong app, iframe ẩn đo `performance.now()` đến khi `svg *` > 60 node)

| Chế độ | Request | Tới khi vẽ xong mặt bằng | Ghi chú |
|---|---|---|---|
| Dev (5416, module rời, đã ấm) | 154 (125 module .ts/.tsx) | 427–477 ms | tAny (DOM > 100 phần tử) 362–386 ms |
| Bản build (`vite preview` 5417, localhost, cache ấm) | 10 | 359 ms | JS 712 KB, không nén |

Thứ tự request (build, ms từ lúc bắt đầu điều hướng): `index.js` 19 → `/api/du-an/{ma}` 105 (xong 139) ∥ `/kiem-ma` 105 (xong 153) → `/api/…/pa/pa-1` 154 (xong 174) → `quy_tac.json`/`toa.json`/`can.json` **243** (xong 250). **Ba bậc nối đuôi**: danh sách → PA → thư viện; thư viện không phụ thuộc PA nhưng chỉ bắt đầu sau khi PA về. Không có tệp nào tải trùng (đã kiểm `Map` theo URL). Trên mạng thật mỗi bậc là một RTT.

Vào màn **Tầng · Căn** (đo bằng click nút trong trang, bản build): **57 request, 5.156 KB (giải nén), 390 ms trên localhost** — 23 tệp `loi/*` + 34 tệp `can/*`, tải hết thư viện chứ không chỉ tòa trong PA (PA chỉ dùng 2 mẫu tòa). Nguyên nhân `man/tuChinhTang.ts:taiDuLieuMB` (lấy mọi khối lõi của mọi mẫu tòa) và `ve/hinhHocThuVien.ts:taiCuaCan` (tải cả 34 tệp căn chỉ để tính một số "tim cửa" mỗi căn). Mặt bằng tầng một tòa: **857 nút SVG** (420 `path`, 196 `text`, 76 `rect`, 121 `g`, 40 `clipPath`); tổng chiều dài thuộc tính `d` của các `path` = **2,9 triệu ký tự**. Đổi `viewBox` + `getBoundingClientRect()` 3,0 ms/lần (chỉ tính bố cục, chưa gồm raster).

### 1.4 Tính toán nặng (vitest tạm đo trên PA mẫu, tệp tạm đã xoá, không commit)

| Hàm | Mẫu | Thời gian (trung vị) |
|---|---|---|
| `raiHam` (`tinh/ham.ts`) 1 lô | 400×400 m, 2 tầng hầm, 2 tòa | **5.868 ms** (min 5.752, max 6.568) |
| `tinhKhoiLuong(pa, tv, true)` (gọi `raiHam` bên trong) | cùng PA | **6.026 ms** |
| `tinhKhoiLuong(pa, tv, false)` | cùng PA | 0,66 ms |
| `tinhDuToan(kl)` | | < 0,01 ms |
| `dungDuAn(...hienHam=true)` (3D toàn dự án có hầm) | cùng PA | **4.580 ms** (không hầm: 10 ms) |
| `goiYXepToa` (5 gợi ý) | lô 100×80 m | 295 ms |
| `goiYXepToa` (5 gợi ý) | lô 160×110 m | **2.308 ms** |
| `toiUuCoCau` | `tm-t2` 24 tầng / `tm-i1` | 36 ms / 53 ms |
| `tuChinhToa`, `tuChinhSauSua` | cả hai tòa (đã ổn định) | 0,04–0,14 ms |
| `tinhChiTieu(pa, tv)` | 1.584 căn | 1,08 ms (min 0,44) |
| `tomTatPA` | | 0,57 ms |
| `JSON.stringify(pa)` (so sánh trong `kho.sua`, gọi 2 lần/lần sửa) | 9,3 KB | 0,04 ms |
| nạp + parse `toa.json` + `can.json` | | 4,2 ms |
| `taoThuVien` + `themBienThe` | 304 căn, 33 tòa | 6,4 ms |

"Tính lặp trong render" đã kiểm: `TrinhSoan` (`man/SoanThao.tsx:94`) gọi `tinhChiTieu` mỗi lần render không `useMemo` (1 ms/lần ở mẫu này, nhỏ); `useKho.sua` so sánh bằng `JSON.stringify` hai lần (0,04 ms, không phải điểm nghẽn ở cỡ 9 KB). **Điểm nghẽn thật là `raiHam`**: có ba chỗ gọi độc lập, mỗi chỗ cache riêng hoặc không cache.

| Chỗ gọi | Cache |
|---|---|
| `man/ManHam.tsx:ketQuaHam` | 1 ô nhớ theo đối tượng `pa` |
| `tinh/duToan.ts:126` qua `man/ManChiPhi.tsx:ketQua` | `WeakMap` theo đối tượng `pa` |
| `ve3d/dungDuAn.ts:108` (bật "Hầm" ở 3D) | không cache |

Cache theo đối tượng `pa` mất hiệu lực sau mọi phép sửa (kể cả sửa một ô đơn giá ở tab Chi phí, vốn chỉ đổi `pa.chiPhi`). Lưu ý: lô mẫu 400×400 m (16 ha) là lớn; lô nhỏ sẽ ít hơn, chưa đo lô nhỏ.

### 1.5 Vẽ 3D (vitest tạm gọi `dungToa` / `dungDuAn` với three thật, đếm đối tượng)

| Cảnh | Dựng | Mesh | Line/LineSegments | InstancedMesh | Draw call (chưa tính pass bóng) | Tam giác |
|---|---|---|---|---|---|---|
| Tòa `tm-t2` 24 tầng | 140–205 ms | 202 | 1.061 | **1.392** | **2.655** | **1,82 triệu** |
| Tòa `tm-i1` 24 tầng | 82–92 ms | 188 | 748 | 840 | 1.776 | 1,17 triệu |
| Toàn dự án (không / có hầm) | 10 ms / 4.580 ms | 5 / 14 | 7 / 9 | 0 | 12 / 23 | 344 / 452 |

`dungToa` đã gộp mesh thường theo vật liệu (`gop`) nhưng `InstancedMesh` được `clone` nguyên cái (không gộp), nên ra hàng nghìn draw call. Khung 3D vẽ theo yêu cầu (không vòng `requestAnimationFrame` liên tục), `shadowMap` 4096² PCFSoft, pixelRatio ≤ 2. FPS thật: chưa đo (xem mục 6).

### 1.6 Lưu

Debounce 800 ms (`kho/luu.ts`), một `PUT /api/du-an/{ma}/pa/{id}` gửi cả PA (9,6 KB ở mẫu này) + `tom_tat`; ghi nháp `localStorage` đồng bộ mỗi thay đổi; worker `PUT` đọc dự án + kiểm mã sửa + ghi (`worker/src/index.ts:74`). Tần suất PUT thực tế khi sửa: chưa đo (bản cục bộ ở chế độ chỉ xem, không có mã sửa hợp lệ để chạy phép sửa trong trình duyệt). Không phải điểm nghẽn ở cỡ payload này.

### 1.7 Cổng kiểm (máy này; chạy từ worktree)

| Lệnh | Bước | Thời gian |
|---|---|---|
| `node scripts/kiem.mjs --nhanh` | tsc 16,8 s ∥ vitest web **21,4 s** (400 ca) ∥ pytest 1,1 s | **21,4 s** |
| `node scripts/kiem.mjs` | tsc 19,6 s ∥ vitest web **45,1 s** (425 ca) ∥ vite build 16,3 s ∥ pytest 1,1 s | **45,1 s** |
| `tsc --noEmit` chạy riêng | | 5,3 s |
| `tsc --noEmit --incremental`, lần 2 | | 2,5 s |

(`vitest worker` báo lỗi `@cloudflare/vitest-plugin` không tìm thấy vì worktree dùng junction `node_modules`; lỗi môi trường đo, bỏ qua, không tính.)

Vitest web 48 tệp, tổng thời gian tệp 127 s CPU / 12 luồng. Quyết định thời gian tường là tệp dài nhất: `tinh/quetThangLien.test.ts` **40,6 s** (một ca 22,2 s; 10 ca), tiếp theo `giamCanThangLien` 13,2 s, `xepToa` 11,1 s, `tuChinhMoRong` 10,2 s, `themCho` 10,0 s, `thaoTacTay` 9,8 s, `loGioiCanh` 7,9 s, `khitLoiKep` 7,2 s. `tsc` chạy cùng lúc với vitest nên chậm gấp ~3 lần (16,8 s so với 5,3 s riêng) do tranh CPU.

## 2. Đề xuất hiệu năng (xếp theo lợi ích / công sức, cao → thấp)

**P1. Cache `raiHam` theo đầu vào, dùng chung cho ManHam / ManChiPhi / 3D** (công sức S)
- Vấn đề: `raiHam` 5,9 s (lô 400×400 m, mục 1.4); gọi ở 3 nơi; cache theo đối tượng `pa` nên sửa `pa.chiPhi`, đổi tên, đổi mục tiêu cơ cấu đều giải lại; 3D bật "Hầm" không cache (4,6 s). Đây là khựng lớn nhất app: màn hình đứng vài giây sau mỗi phép sửa ở tab Hầm, Chi phí, 3D-Hầm.
- Giải pháp: một `Map` module trong `tinh/ham.ts` khoá theo (`tv`, `lo`, `pa.ham`, `pa.phanHam` nếu dùng, danh sách `{mauId,x,y,gocDo,canTheo,canViTri,matBang}` của tòa thuộc lô); `raiHam` tự tra cache, bỏ 2 cache riêng. Kiểm bằng test: đổi `pa.chiPhi` → cache trúng, đổi `ham.soTang` → trượt.
- Tệp: `tinh/ham.ts`, `man/ManHam.tsx:30`, `tinh/duToan.ts:126`, `ve3d/dungDuAn.ts:108`, `man/ManChiPhi.tsx:17`.
- Lợi ích: sửa chi phí / mở 3D sau khi đã vào Hầm 5,9 s → ~0 ms (ước lượng, trúng cache); từ 3 lần giải xuống 1 lần cho cùng PA. Rủi ro: thiếu một trường trong khoá thì dùng kết quả cũ (sai số liệu hầm); cần liệt kê trường mà `loiCotTuToa`/`canTrenLo` đọc.
- Sau đó (L): đưa `raiHam` vào Web Worker và/hoặc tối ưu thuật toán rải (`raiChoDo` + `clipper` `giao`), để lần giải đầu không đứng giao diện.

**P2. Khởi động song song, bỏ 3 bậc nối đuôi** (S)
- Vấn đề: danh sách → PA → thư viện nối đuôi (mục 1.3). Thư viện (`taiThuVien()`) chỉ chạy sau khi `TrinhSoan` mount (`SoanThao.tsx:84`).
- Giải pháp: gọi `taiThuVien()` ngay ở `main.tsx` (hoặc `<link rel="preload" as="fetch">` trong `index.html` cho 3 tệp `/lib`); gộp `GET du-an` + `kiem-ma` + `pa` thành một endpoint (`GET /api/du-an/{ma}/mo?pa=…`) hoặc `Promise.all`.
- Lợi ích: 3 RTT → 1 RTT; khoảng trống giữa PA về (174 ms) và thư viện bắt đầu (243 ms) là ~70 ms trên localhost có thể bỏ (từ 359 ms), mạng thật mỗi RTT 50–150 ms (ước lượng). Rủi ro: thấp; tải thư viện khi vào trang chủ danh sách dự án (không cần) → chỉ preload ở route `/du-an/:ma`.
- Tệp: `web/src/main.tsx`, `man/SoanThao.tsx`, `tinh/thuVien.ts`, `worker/src/index.ts`, `web/index.html`.

**P3. Tiền tính "tim cửa" vào `can.json`, bỏ 34 request khi vào màn Tầng** (S)
- Vấn đề: vào Tầng tải 57 tệp, 5,16 MB (mục 1.3); 34 tệp `can/*` (4,19 MB) chỉ để tính một số `cuaCan[ma_goc]` bằng `tinhCuaCan` (`ve/hinhHocThuVien.ts:50`).
- Giải pháp: `scripts/chep_*.py` (bước sinh thư viện) tính `cua_x` bằng đúng `tinhCuaCan` và ghi vào `can.json`; `taiCuaCan` đọc từ `tv.can`. Kèm: `taiDuLieuMB` chỉ tải khối lõi của các tòa có trong PA (không phải 25 tệp mọi mẫu).
- Tệp: `ve/hinhHocThuVien.ts`, `man/tuChinhTang.ts`, `tinh/kieu.ts` (`CanMau`), script sinh thư viện, `tinh/pccc.ts:tinhCuaCan`.
- Lợi ích: 57 → ≤ ~10 request, 5,16 MB → ~1 MB (ước lượng: mỗi tòa dùng 5–6 mẫu căn × 126 KB + vài lõi). Rủi ro: dữ liệu phái sinh phải sinh lại mỗi lần bóc lại CAD; thêm test so sánh số tiền tính với `tinhCuaCan`.

**P4. Header cache + tên tệp băm cho `/lib/*.json`** (S)
- Vấn đề: tệp `/lib/*.json` không có băm trong tên; Cloudflare Assets mặc định cho phép kiểm lại mỗi lần (chưa kiểm trên bản deploy, mục 6). 448 KB thô / 67 KB gz tải lại mỗi lần mở.
- Giải pháp: thêm `web/public/_headers` (`/lib/*  Cache-Control: public, max-age=3600, stale-while-revalidate=86400`) hoặc nhúng băm nội dung vào URL (`toa.<hash>.json` qua bước build); `quy_tac.json` thu gọn (68 KB → 52 KB).
- Lợi ích: lần mở thứ 2 trở đi bớt tải thư viện; bản thu gọn bớt 16 KB thô. Rủi ro: dữ liệu đổi mà trình duyệt giữ bản cũ → cần băm tên.

**P5. Tách chunk: `import()` cho màn nặng ít dùng** (S–M)
- Vấn đề: chunk chính 712 KB / 242 KB gz chứa cả Hầm, Chi phí, So sánh, Xuất CAD, Nạp DXF (`dxf-parser`), 3D dựng hình (mục 1.1).
- Giải pháp: `lazy()`/`import()` cho `ManHam`, `ManChiPhi`, `SoSanhPA`, `HopXuatCad` + `xuat/xuatCad`, `ManLo` + `dxf/napDxf`, `ve3d/dung*`; thêm `build.rollupOptions.output.manualChunks` tách `clipper-lib` và `preact`. Thêm `<link rel="prefetch">` khi rảnh.
- Lợi ích (ước lượng từ phân rã sourcemap): bớt ~110–130 KB minified (~40–45 KB gz) khỏi chunk khởi động, ~17%. Rủi ro: màn lười có độ trễ lần đầu → hiện vòng O; test import tĩnh.
- Tệp: `web/src/man/SoanThao.tsx`, `man/DuAn.tsx`, `ve3d/MoHinh3D.tsx`, `web/vite.config.ts`.

**P6. Cổng kiểm: chẻ tệp test dài nhất** (S)
- Vấn đề: thời gian tường cổng đủ = tệp dài nhất `quetThangLien.test.ts` 40,6 s (chiếm 90% của 45,1 s); cổng nhanh 21,4 s. Tổng CPU chỉ 127 s / 12 luồng ≥ ~11 s nếu cân bằng.
- Giải pháp: tách `quetThangLien.test.ts` (10 ca, có ca 22 s) thành 3 tệp theo mẫu tòa; tương tự `giamCanThangLien`, `xepToa`. Chạy `tsc --noEmit --incremental --tsBuildInfoFile .cache/tsc.info` (2,5 s lần ấm so với 5,3 s) hoặc cho `tsc` chạy trước vitest để không tranh CPU (tsc bị chậm 3 lần khi chạy song song). Không bỏ vite build khỏi cổng đủ (nó chạy ngầm 16 s, không nằm trên đường găng).
- Lợi ích (ước lượng): cổng đủ 45 → ~25 s; cổng nhanh 21 → ~13 s. Rủi ro: thấp.
- Tệp: `web/src/tinh/quetThangLien.test.ts` v.v., `scripts/kiem.mjs`, `web/tsconfig.json`.

**P7. Tách ngôi `ve` nội thất khỏi mẫu căn (tải theo lớp)** (M)
- Vấn đề: 81% bytes trong `can/*.json` là `furn`+`equip` (mục 1.2); màn Tầng tải đủ dù lớp nội thất thường tắt, rồi dựng vào DOM (857 nút, 2,9 triệu ký tự `d`).
- Giải pháp: sinh `can/<id>.json` (tường, cửa, vách, ~0,12 của kích thước) và `can/<id>.noithat.json` (furn + equip); tải thứ hai khi người dùng bật lớp "Nội thất". Làm tròn toạ độ 3 chữ số (`ve` mẫu `tm-2pn-m1` 133,8 → 120,2 KB, −10%).
- Lợi ích: mỗi tòa tải ~0,1–0,2 MB thay vì ~0,7; DOM tầng nhẹ hơn khi tắt nội thất (chưa kiểm xem lớp nội thất hiện mặc định hay không). Rủi ro: `LopPhong`/tem căn/xuất CAD còn dùng `ve`; phải rà mọi chỗ đọc `ve`.
- Tệp: script bóc `scripts/boc_cad/*`, `ve/hinhHocThuVien.ts`, `ve/MatBangTang.tsx`, `xuat/xuatCad.ts`.

**P8. 3D tòa: gộp `InstancedMesh`, giảm bóng** (M)
- Vấn đề: tòa 24 tầng = 2.655 draw call, 1,82 triệu tam giác (mục 1.5); bóng đổ vẽ lại toàn cảnh một lần nữa (`shadowMap` 4096²).
- Giải pháp: trong `dungToa.ts:gop` gộp các `InstancedMesh` cùng (geometry, vật liệu) thành một `InstancedMesh` (nối ma trận), hoặc hợp thành `BufferGeometry` chung; hạ `sun.shadow.mapSize` xuống 2048 khi tòa > 10 tầng; tầng điển hình lặp: dựng một lần + `InstancedMesh` theo chiều cao; `LineSegments` (1.061) gộp theo vật liệu như mesh.
- Lợi ích (ước lượng): draw call 2.655 → vài chục–vài trăm; FPS xoay tòa tăng (số FPS thật chưa đo). Rủi ro: chọn / ẩn từng nhóm (`G.dam`, `G.lov`, `G.top`, cắt `clippingPlanes`) dựa vào danh sách đối tượng; phải giữ tham chiếu nhóm.
- Tệp: `ve3d/dungToa.ts`, `ve3d/dungCan.ts`, `ve3d/Khung3D.tsx:101`.

**P9. Gợi ý xếp tòa chạy trong Web Worker** (M)
- Vấn đề: `goiYXepToa` 295 ms (lô 100×80) – 2,3 s (lô 160×110). Hiện `goiYXepToaNen` chia lát bằng `setTimeout 0` (giao diện không treo hẳn nhưng tổng thời gian dài và giật). Tương tự `xepHangLoat` (nhiều lô) và dò kéo thả hợp lệ ở màn Tầng (AI_START ghi "chạy trên luồng chính").
- Giải pháp: Web Worker (`new Worker(new URL(...), {type:'module'})`) nhận `{pa, lo, tv rút gọn, luat, cuaCan}` (cấu trúc sao chép được), trả `GoiYXep[]`, hủy được; dùng chung cho `xepHangLoat` và `raiHam`.
- Lợi ích: giao diện không giật khi xếp; có thể chạy song song 2–4 mẫu. Rủi ro: `tv` là `Map`, cần tuần tự hoá; kiểm bản đồ module dev/build.
- Tệp: `tinh/xepToa.ts`, `tinh/xepHangLoat.ts`, `ui/GoiYXepToa.tsx`, `man/xepHangLoat.tsx`.

**P10. Memo `tinhChiTieu` theo (pa, tv); dùng chung với `tomTatPA`** (S, lợi nhỏ)
- Vấn đề: `tinhChiTieu` chạy mỗi render `TrinhSoan` và lần nữa trong `tomTatPA` mỗi lần sửa (~1 ms mỗi lần ở 2 tòa; tăng theo số tòa / lô).
- Giải pháp: `WeakMap<TrangThaiPA, {tv, kq}>` trong `tinh/chiTieu.ts`.
- Lợi ích: ~1 ms × số render (nhỏ ở PA này; chưa đo PA 10+ tòa). Rủi ro: không.

**P11. Thu gọn `toa.json` / `can.json` ở khởi động** (M)
- Vấn đề: `toa.mat` 210 KB (76%) và `can.phong` 70 KB (78%) tải lúc khởi động dù tab TMB không cần.
- Giải pháp: tách `toa.json` (tóm tắt) + `toa-mat/<id>.json`, `can.json` + `can-phong/<id>.json` tải lười khi vào Tầng / dùng phòng. Giảm ~280 KB thô (~40 KB gz).
- Rủi ro: `coMat()` và `taoThuVien` giả định mặt bằng có sẵn; test nhiều.

**P12. SVG mặt bằng tầng: LOD theo zoom, canvas cho lớp nội thất** (L, chưa đo FPS)
- Vấn đề: 857 nút, 2,9 triệu ký tự `d` (mục 1.3). Preact không dựng lại cây khi kéo / phóng (chỉ đổi `viewBox`, đã gom bằng rAF ở `ve/BanVe.tsx:112`), nên chi phí nằm ở raster của trình duyệt, không đo được trong pane ẩn.
- Giải pháp: `content-visibility`/ẩn nội thất khi `v.w` lớn (giống LOD của app cũ QT-108), gộp `path` cùng kiểu nét thành một `d`, `<use>` cho căn lặp, hoặc vẽ `furn/equip` bằng một `<canvas>` lớp tĩnh. Làm sau P7.

**P13. `tsc` incremental trong cổng** — gộp vào P6.

## 3. (A) Tính năng app cũ có, app mới còn thiếu / yếu

Đối chiếu: `E:\Projects\MDI_Unitmix_v4\prototype\shell.src.html` (bảng phiên bản 4.0.0 → 4.51.0, 80 dòng `v:"4.x"`), `docs/HUONG-DAN_tmb-qh.md`, `docs/hoc_architechtures_app_2026-10-27.md` mục 6, "Đang dở" trong `docs/AI_START.md`. Trạng thái app mới kiểm bằng `grep` trên `web/src` (không chạy từng tính năng); dòng "yếu" ghi rõ dựa vào đâu.

Xếp theo giá trị với kiến trúc sư làm unit mix chung cư, cao → thấp:

| # | Tính năng app cũ | App mới | Lợi ích | Công sức | Tệp liên quan |
|---|---|---|---|---|---|
| A1 | Xuất hồ sơ PDF trình Ban lãnh đạo: Salekit / HĐMB / trình PA, trang riêng từng loại căn; 3 style tô màu mặt bằng Galia · HH1 · Rivea (4.15.0, 4.3.0) | **Thiếu PDF.** Chỉ có XLS (4 sheet) và CAD/DXF. `ve/kieuMb.ts` có kiểu tô màu nhưng không có đường ra giấy | Cao: sản phẩm giao cuối cùng | L | `xuat/*`, `ve/kieuMb.ts`, `ve/MatBangTang.tsx` |
| A2 | Tủ họng nước PCCC tự đặt tối ưu (QT-77, bán kính 18 m), cửa ngăn cháy hành lang, khoang cháy ≤ 30 m, kéo tay (QT-100…105) | **Có hàm, chưa lên giao diện.** `tinh/pccc.ts` có `tuPCCC`, `kiemTraPCCC`, `dungDoThi`; `grep` ra `man/ ve/ ui/` không gọi. Mới có cự ly thoát nạn (gỡ căn vượt) | Cao: bắt buộc cho hồ sơ thẩm duyệt PC07 | M | `tinh/pccc.ts`, `ve/MatBangTang.tsx`, `xuat/xuatCad.ts`, `i18n` |
| A3 | Số thang máy theo căn / dân số (QT-94: 70 căn · 200 người mỗi thang), ô KPI thang máy theo bảng Viện (4.11.0, 4.14.0) | **Yếu.** AI_START ghi "thang máy chưa đếm từ lõi"; `duToan.ts:200` lấy theo DT | Cao: KPI mà lãnh đạo hỏi | S–M | `tinh/duToan.ts`, `tinh/chiTieu.ts`, `tinh/matBang.ts` |
| A4 | Quy tắc dân số theo tỉnh: Hà Nội / Hải Phòng / TP.HCM (QĐ 83/2026), dự phòng P = S ÷ 32 m²/người (4.6.0, 4.44.0) | **Yếu.** Một ô `nguoiMoiCan` = 3,5 mỗi lô (`macDinh.ts:15`), không có gói luật theo tỉnh theo DTSD/loại căn | Cao: sai số dân số ảnh hưởng chỉ tiêu | M | `tinh/chiTieu.ts`, `tinh/macDinh.ts`, `quy_tac.json` |
| A5 | Xếp hàng loạt 3 option A/B/C (nhiều căn · hướng Nam · thoáng) và nguồn mẫu: mẫu đang mở / thư viện / PA `.json` | **Yếu.** Có xếp hàng loạt một nguyên tắc MT-05 (AI_START "Còn dở") | Trung bình–cao | M | `tinh/xepHangLoat.ts`, `man/xepHangLoat.tsx` |
| A6 | Chỉ giới xây dựng: lùi QH riêng lô (`lui_qh`), lùi giáp lô bên (`lui_ben`), cạnh giáp đường đọc từ CAD (QT-118, QT-120, QT-126 thẻ chỉ tiêu lô đạt/trượt) | **Yếu.** `canhDuong` khai tay; `lui_qh` / `lui_ben` chưa có (AI_START) | Trung bình–cao | M | `tinh/xepToa.ts`, `man/loGioiCanh.tsx`, `man/ManLo.tsx`, `dxf/napDxf.ts` |
| A7 | Bóng đổ theo giờ / ngày, điểm view 0–100 (hướng 40 · thoáng 30 · cảnh quan 20 · nắng 10), nền bản đồ vệ tinh / OSM (QT-111, `HUONG-DAN_tmb-qh` mục 9) | **Thiếu.** `grep` bóng đổ / điểm view / nền bản đồ ra không có tính năng tương ứng | Trung bình | L | `ve/`, `ve3d/`, `tinh/` mới |
| A8 | Xuất KMZ (khối 3D cho Google Earth), DXF tổng mặt bằng theo VN2000, nạp `.kmz` / `.kml` | **Thiếu KMZ/KML** (`grep` 0). Có nạp DXF (`dxf/napDxf.ts`) và xuất CAD tòa | Trung bình | M | `dxf/`, `xuat/` |
| A9 | Tự lưu nháp bền (IndexedDB + cảnh báo đóng tab + nhắc "chưa lưu") (4.45.0) | **Yếu.** Nháp ở `localStorage` đồng bộ mỗi thay đổi, lưu máy chủ sau 800 ms; không có `beforeunload`, `grep indexedDB` ra 0 | Trung bình | S | `kho/luu.ts`, `kho/kho.ts` |
| A10 | Xuất BIM: IFC4 LOD100–200, phiếu Revit `.json` LOD300 (4.36.0, 4.37.0) | **Thiếu** (`grep ifc` 0) | Trung bình–thấp (cho nhóm BIM) | L | `xuat/` mới |
| A11 | Xem nhanh các mẫu tòa đã đặt (hàng chờ, "Xem các mẫu tòa", QT-144); Ctrl+C / Ctrl+V dán tòa (QT-142) | **Một phần.** Có nhân bản Ctrl+D / Ctrl+kéo; không có Ctrl+C/V, không có hộp "Xem các mẫu tòa đã đặt" | Trung bình–thấp | S–M | `man/ManXepToa.tsx`, `man/tmbThaoTac.tsx` |
| A12 | Trợ lý AI trong app (chat nổi, ghi được vào app, giọng nói QT-148), AI soát số thuyết minh (QT-80) | **Thiếu** (`grep trợ lý` 0). Có nút "Chép prompt AI" ở 3D | Trung bình–thấp | L | mới |
| A13 | Thẻ DỰ TOÁN từ khối lượng tòa (QT-121) | **Có** (`tinh/duToan.ts`, `ManChiPhi.tsx`), đơn giá là số tạm chờ QS | — | — | — |
| A14 | Tối ưu PA "top 3 đa dạng" (QT-79) và STRETCH QT-81, chọn nhiều / thay hàng loạt (QT-97), lật / xoá hàng loạt (QT-102), Dim đo, kéo thả đổi chỗ | **Có phần lớn** (`tinh/toiUu.ts`, `stretch.ts`, `CongCuTang.tsx`, đo ở `ManXepToa.tsx`); "top 3 đa dạng": chưa kiểm | — | — | — |

Ghi chú phụ cho A2: dữ liệu `pccc.json` và nhãn lớp (`MDI-PCCC-TCC`) của app cũ đã có hàm tương ứng ở `tinh/pccc.ts`, nên phần tính gần như xong; việc còn lại là vẽ lớp, bật/tắt, kéo tay và xuất CAD.

## 4. (B) Công cụ / thao tác

Rà trực tiếp mã: `man/CongCuTang.tsx` (màn Tầng), `man/tmbThaoTac.tsx` + `man/ManXepToa.tsx` (Tổng mặt bằng), `man/ManHam.tsx`, `ve3d/Khung3D.tsx`, `ui/ThanhTren.tsx`. Chưa chạy từng thao tác bằng chuột (mục 6).

**B1. Phím Ctrl+Z / Ctrl+Y không hoạt động dù giao diện hứa** (S, lợi ích cao, ưu tiên 1 phần công cụ)
- `grep` toàn `web/src` không có bộ xử lý phím cho Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y; chỉ có hai nút ↶ ↷ ở `ui/ThanhTren.tsx:247`. Trong khi các tooltip ghi sẵn: `tc.khit.gt` ("Hoàn tác được (Ctrl+Z)"), `gt.hl.apDung`, `hl.daAp` ("Ctrl+Z để hoàn tác"). App cũ có Ctrl+Z (`undo()`), Ctrl+S, Esc, Alt+←/→, V/M.
- Giải pháp: một `useEffect` cấp `TrinhSoan` bắt `keydown`, bỏ qua khi đang gõ vào `input/textarea/select/contentEditable`, gọi `kho.hoanTac/lamLai`; thêm Ctrl+S (lưu ngay, bỏ chờ debounce) và hiện cảnh báo khi đóng tab nếu `trangThaiLuu !== 'da_luu'`.
- Tệp: `man/SoanThao.tsx`, `kho/kho.ts`, `kho/luu.ts`.

**B2. Màn Tầng: chọn nhiều ô và phím tắt** (S–M)
- Có: Delete xoá ô / thang (`CongCuTang.tsx:182`), Shift/Ctrl+bấm chọn thêm, kéo đổi chỗ, ＋ Thêm, ⇋ Lật, nét hành lang. Thiếu: kéo khung chọn (`BanVe` đã có tham số `chonKhung`, nhưng chỉ `ManXepToa.tsx:451` dùng); chọn mọi căn cùng mẫu (app cũ QT-97); phím F lật (TMB có `F`, Tầng chưa); mũi tên / Tab chuyển ô kế; Alt+←/→ đổi tầng; Esc bỏ chọn ô. Mỗi lần chọn nhiều ô phải bấm từng ô.
- Tệp: `man/ManTang.tsx:240`, `man/CongCuTang.tsx`, `ve/BanVe.tsx` (`chonKhung`).

**B3. Tổng mặt bằng (TMB): thao tác nhóm và bàn phím** (S–M)
- Có: R/Q/E xoay, F lật, mũi tên dời 0,1 m (Shift 1 m), Ctrl+A, Ctrl+D, Delete, Esc, bắt dính (Alt tắt), kéo khung chọn, đo khoảng cách (`diemDo`), nhập số vào ô (Enter). Thiếu: Ctrl+C / Ctrl+V; căn thẳng hàng / chia đều nhiều tòa (align, distribute); Tab chọn tòa kế; hiển thị phím tắt dạng bảng (hiện chỉ ở `tmb.phim` một dòng dài).
- Tệp: `man/ManXepToa.tsx:243`, `man/tmbThaoTac.tsx`, `tinh/thaoTacToa.ts`.

**B4. Hầm** (S)
- Có: Esc huỷ / Enter chốt / Backspace lùi đỉnh khi vẽ ranh, bắt điểm, nhập độ dài cạnh. Thiếu: mọi phím khác (xoá ram, Ctrl+Z vẫn lệ thuộc B1). Điểm chưa mượt chính là `raiHam` 5,9 s (P1): sửa bất kỳ ô số nào ở panel Hầm khiến cả bản vẽ chờ giải lại.
- Tệp: `man/ManHam.tsx`, `tinh/ham.ts`.

**B5. 3D** (S–M)
- Có: góc nhìn đề xuất + lưu / xoá góc, hai kiểu (brand / trắng), cắt tầng (`chon-che`), bật Hầm, tham số, xuất PNG, chép prompt AI. Thiếu: phím (F vừa khung, số 1–4 góc nhìn, Esc), đo khoảng cách trong 3D, ẩn / hiện từng tầng, bóng theo giờ nắng bấm được ở chế độ tòa (có biến `gio` trong `Khung3D` nhưng chưa kiểm giao diện). Chưa mượt: mỗi lần PA đổi và `khoa` đổi (kể cả đổi `ham`) dựng lại cả cảnh: 140–205 ms/tòa (+ 4,6 s nếu bật Hầm, P1); 2.655 draw call (P8).
- Tệp: `ve3d/Khung3D.tsx`, `ve3d/MoHinh3D.tsx`.

**B6. Thao tác thừa bấm / chưa mượt đã thấy trong mã**
- Tối ưu tầng bấm xong `await taiCuaCan(...)` mới chạy (`ManTang.tsx:164`): lần đầu tải 34 tệp căn (P3) rồi mới tối ưu; đổi thành dữ liệu có sẵn thì bấm là chạy ngay (36–53 ms).
- Ô số có `onChange` chỉ khi rời ô / Enter (hợp lý), nhưng mỗi lần rời ô ở tab Hầm / Chi phí gây giải lại hầm (P1).
- Dò kéo thả hợp lệ chạy trên luồng chính, đợi chuột dừng 120 ms (AI_START "Còn dở"); cần Worker (P9).
- Gợi ý xếp tòa 0,3–2,3 s (P9); chưa có nút "Hủy" xuyên suốt ở mọi nơi (đã có `huy()` trong `goiYXepToaNen`).
- Menu chuột phải ô căn có đủ công năng; thao tác "áp cơ cấu mục tiêu cho tất cả tầng" cần mở ô "Tầng áp dụng" rồi mới bấm Tối ưu: có thể thêm nút "Tối ưu mọi tầng" (S).

## 5. Năm việc nên làm ngay (chung hiệu năng / tính năng / công cụ)

1. **P1 · Cache `raiHam` theo đầu vào** (S). Hết khựng 5,9 s (6,0 s ở Chi phí, 4,6 s ở 3D-Hầm) mỗi lần sửa PA; từ 3 lần giải xuống 1.
2. **B1 · Ctrl+Z / Ctrl+Y / Ctrl+S + cảnh báo đóng tab** (S). Giao diện đã hứa Ctrl+Z ở 3 tooltip nhưng không có phím; dùng hằng ngày, rủi ro mất việc.
3. **P3 · Tiền tính tim cửa vào `can.json` + chỉ tải lõi của tòa trong PA** (S). Màn Tầng 57 request / 5,16 MB → ≤ ~10 request / ~1 MB (ước lượng); thao tác Tối ưu tầng bấm là chạy.
4. **P2 + P5 · Khởi động song song + tách chunk màn nặng** (S–M). Ba RTT nối đuôi → một; chunk khởi động 242 KB gz bớt khoảng 40–45 KB gz (ước lượng).
5. **P8 · Gộp `InstancedMesh` trong 3D tòa** (M) — 2.655 draw call / 1,82 triệu tam giác mỗi tòa 24 tầng. Kèm làm sớm (S, nếu còn sức): **P6** chẻ `quetThangLien.test.ts` để cổng đủ 45 s → ~25 s.

Việc tính năng sau đó (theo A): **A2** đưa tủ họng nước / cửa ngăn cháy lên giao diện (hàm đã có), **A3** đếm thang máy, **A4** gói dân số theo tỉnh, **A1** xuất PDF.

## 6. Không đo được / chưa đo (nói rõ để khỏi hiểu sai)

- **FPS khi kéo / phóng / xoay 3D, thời gian raster SVG**: pane trình duyệt trong app bị ẩn, `requestAnimationFrame` không chạy (lệnh đo bị treo 45 s). Chỉ đo được cấu trúc (số nút, số draw call, chi phí layout 3 ms).
- **Tần suất `PUT` khi sửa thật**: bản cục bộ mở ở chế độ chỉ xem; số 800 ms và 9,6 KB lấy từ mã và từ `GET`, không từ log mạng.
- **Nén / cache header trên Cloudflare**: chưa đo trên bản deploy; `vite preview` không nén.
- **Lô nhỏ cho `raiHam`**; **PA có 10+ tòa** cho `tinhChiTieu`: chưa có mẫu.
- **Thời gian khởi động trên mạng thật**: số 359 ms / 427–477 ms là localhost, cache ấm.
- **Đối chiếu tính năng (mục 3)** dựa vào `grep` mã nguồn và tài liệu, chưa chạy từng chức năng của hai app. Mục "yếu" dựa vào AI_START ("Còn dở") và mã.
- Số "ước lượng" ở lợi ích đều tính từ số đo ở mục 1, chưa làm thử.

## 7. Lệnh đã chạy (để lặp lại)

```bash
git reset --hard nang-cap/architechtures
cd web && npx vite build                                  # bundle (thêm --sourcemap --outDir <tạm> để phân rã)
cd web && npx vite --port 5416 --strictPort               # dev; npx vite preview --port 5417 cho bản build
# trình duyệt trong app: preview_start http://localhost:5416/du-an/tztd1udv?pa=pa-1
#   iframe ẩn + performance.getEntriesByType('resource'), đếm svg * ; click "Tầng · Căn" đếm request
node <tệp tạm>.cjs                                        # kích thước/gz của public/lib (fs + zlib)
cd web && npx vitest run src/zzbench*.test.ts             # tệp đo tạm (đã xoá): raiHam, tinhKhoiLuong, goiYXepToa, toiUuCoCau,
                                                          #   tuChinhToa, tuChinhSauSua, tinhChiTieu, dungToa/dungDuAn (đếm Object3D)
node scripts/kiem.mjs --nhanh ; node scripts/kiem.mjs     # cổng kiểm
cd web && npx vitest run --reporter=json --outputFile=<tạm>.json --exclude "src/xuat/xuatCad*.test.ts"   # thời gian từng tệp test
cd web && npx tsc --noEmit ; npx tsc --noEmit --incremental --tsBuildInfoFile <tạm>
```
