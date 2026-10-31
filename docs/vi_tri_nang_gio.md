# Vị trí · Ảnh vệ tinh · Nắng · Gió (kiểu Autodesk Forma)

Yêu cầu (2026-10-29): "Có cả đánh giá hướng nắng, hướng gió như Autodesk Forma. Thêm tính năng add vị trí tọa độ đúng Google Map, Google Earth,
hiển thị trên 3D luôn, và 2D có thể bật tắt. Lưu ý cần tối ưu để web chạy mượt, không giật lag."

## 1. Dùng thế nào

- **TMB** › nút Lớp (góc phải dưới) › *Ảnh vệ tinh nền* (bật ảnh 2D, mở hộp) hoặc *Vị trí · Nắng · Gió…*. **3D Toàn dự án** › nút *Ảnh nền* và *☀ Nắng · Gió* trên thanh 3D.
- **Thanh 3D Toàn dự án** (30/10/2026): bốn nút bật / tắt tức thì — *Hầm*, *Phân tích view*, **Vị trí** (ảnh vệ tinh nền), **Hướng nắng** (đường mặt trời), **Hướng gió** (lớp gió + đường dòng; chưa chạy phân tích thì mở hộp tab Gió) — và nút mở hộp thiết lập. Menu *Lớp* chỉ còn các lớp hình học.
- **Đặt vị trí khỏi dán link** (tab Vị trí, 3 cách, theo thứ tự): (1) **Từ bản vẽ quy hoạch** — bản vẽ vẽ theo toạ độ VN-2000 (x = Đông 1,5·10⁵–8,5·10⁵, y = Bắc 0,6·10⁶–2,6·10⁶ m, khung bao ≤ 30 km) thì chọn tỉnh / thành (hoặc nhập kinh tuyến trục) → vị trí + góc Bắc (= hội tụ lưới) đặt thẳng từ tâm các lô (`tinh/nangGio/vn2000.ts`, phép chiếu ngược trụ ngang k0 = 0,9999, ellipsoid WGS84, khớp proj4 < 1 cm; lệch gốc VN-2000 so với WGS84 cỡ vài mét). Nút **Vị trí** trên thanh 3D tự đặt khi tên dự án có tên tỉnh trong bảng. Bảng kinh tuyến trục mới có Hà Nội 105°, Hải Phòng / TP.HCM 105°45', Đà Nẵng / Quảng Ninh 107°45' (đã đối chiếu); tỉnh khác nhập tay — bảng đầy đủ ở Thông tư 973/2001/TT-TCĐC (chưa kiểm được văn bản gốc từ môi trường làm, nên không đoán). (2) **Tìm địa điểm** theo tên — OSM Nominatim (không khoá, ≤ 1 yêu cầu / giây, chỉ tìm khi bấm). (3) Dán link / toạ độ (cách cũ, gập lại).
- Tab **Vị trí**: dán link Google Maps / Google Earth hoặc toạ độ → tâm các lô đặt tại đó. Chỉnh cho khớp ảnh: góc Bắc (±1°, ±0,1°), dời bản vẽ 1 m bốn hướng.
  *Khớp hai điểm*: chọn hai điểm trên bản vẽ (bấm "Chọn trên bản vẽ" rồi bấm vào TMB) + dán toạ độ thật từng điểm → tính vị trí, góc Bắc, tỷ lệ (cảnh báo lệch > 2 %).
  Nguồn ảnh, độ đậm, bật / tắt 2D / 3D. Liên kết "Mở Google Maps tại đây" (chỉ chứa toạ độ).
- Tab **Nắng**: ngày (nút nhanh 21/12, 21/06, 21/03, hôm nay), giờ (thanh mọc → lặn, ▶ chạy giờ 1 h/giây): bóng đổ thật trong 3D + bóng đổ trên TMB,
  đường mặt trời 3D (ngày chọn + hai chí, chấm mỗi giờ, vòng chân trời B/Đ/N/T). *Tính giờ nắng*: lưới mặt đất + mái + mặt đứng, thang màu liên tục,
  biểu đồ cột tỷ lệ diện tích, TB, % ≥ 2 h; rê chuột đọc số (2D và 3D).
- Tab **Gió**: hoa gió 16 hướng × 6 dải tốc độ (Open-Meteo, năm trọn gần nhất, nhớ theo vị trí), *Chạy mô phỏng gió* → lớp tiện nghi Lawson hoặc hệ số tăng tốc K
  theo từng hướng + đường dòng; ghi rõ "ước lượng nhanh, không thay CFD".

## 2. Dữ liệu và một nguồn

- `TrangThaiPA.viTri = { lat, lng, neo, tyLe?, cachDat? }` (`tinh/kieu.ts`): điểm `neo` (m, bản vẽ) nằm ở (lat, lng) WGS84; `tyLe` = mét thật / mét bản vẽ (khớp hai điểm).
- Góc Bắc giữ ở `huongView.gocBac` (đã dùng cho la bàn 2D, mặt trời 3D, điểm view). Đặt vị trí thì ghi luôn `huongView.viDo` = vĩ độ (`ganViTri`) → điểm view
  (`tinh/huongView.ts`, của agent view, KHÔNG sửa) đọc đúng vĩ độ. `chuanHoaPA` gọi `chuanHoaViTri` (bỏ toạ độ hỏng, đồng bộ vĩ độ). PA cũ không có `viTri`:
  vĩ độ = `huongView.viDo` (mặc định 21,03), kinh độ Hà Nội 105,85, `coToaDo = false` (không hiện ảnh nền, hộp báo "tạm dùng Hà Nội").
- **Việc khi gộp** (đề xuất cho agent view): `caiDatView` nhận thêm `viTriPA(pa)` để vĩ độ chỉ có một chỗ; ẩn ô vĩ độ trong Cài đặt view khi PA đã có `viTri`.
- **Sau gộp `nang-cap/architechtures` (6221899)**: 3D đọc vĩ độ / góc Bắc qua `viTriPA(pa)` (`MoHinh3D`: `viDo={vt.lat}`, `gocBac={vt.gocBac}` cả Toàn dự án lẫn Công trình) — PA cũ vẫn ra `huongView.viDo` / `gocBac`. Mặt trời hoạt ảnh của hộp Nắng đi vào ĐÚNG đèn mặt trời của Khung3D (`datNang` → `moRong.nang`), nên bóng / màu nắng theo bộ vật liệu mới.
- **3D sau gộp**: ảnh vệ tinh nằm trong nhóm `phu` của Khung3D (cùng `goc` khi áp Lớp / làm nhạt): mục **Lớp › Ảnh vệ tinh nền** trong menu Lớp 3D, bật / tắt tức thì (đổi `visible`, không tải lại); vật liệu `toneMapped: false` + sRGB (không bị NeutralToneMapping làm bạc), vẫn nhận bóng đổ; bật Phân tích view thì ảnh nền mờ về nền đất (`userData.lamNhat`). Lớp nắng / gió (MeshBasic) `toneMapped: false` để màu thang đúng.
- Không có dữ liệu cá nhân trong URL: chỉ toạ độ; link Google dán vào không lưu.
- **Giờ nắng — một nguồn** (sửa 2026-10-30, thanh giờ 3D giật lùi): kho `nangGio/kho` `luc` (liên tục, chỉ làm tròn khi hiện — `gioPhut` ở `tinh/nangGio/dongHo.ts`). Khung3D đọc qua `moRong.gio()` mỗi lần đặt mặt trời, không chép vào state; chỉ thao tác người dùng ở khung (góc có giờ) ghi qua `moRong.datGio`. ▶ = `buocChay` (1 h/s đều). Thanh giờ: `onInput` + `useNgheChange` (preact/compat nuốt `onChange`). Kiểm: `dongHo.test.ts`, `nangGio/dongBoGio.test.ts`, CDP `node scripts/kiem_gio_nang.mjs`.

## 3. Nguồn ảnh và điều khoản

| Nguồn | Khoá | Điều khoản chính | Trong app |
|---|---|---|---|
| **Esri World Imagery** (mặc định) | không bắt buộc (dịch vụ trả ô không khoá; Esri khuyên dùng khoá ArcGIS Location Platform — bậc miễn phí 2 triệu ô / tháng) | Phải ghi "Powered by Esri" + nguồn ảnh; không xuất ô dùng ngoại tuyến | `VITE_ESRI_KEY` (tuỳ chọn) gắn `?token=`; dòng ghi nguồn góc dưới |
| **OpenStreetMap** (bản đồ) | không | Chính sách OSMF: ghi "© OpenStreetMap contributors", không tải hàng loạt / ngoại tuyến, tôn trọng Cache-Control, dùng nhẹ | Chỉ khi người dùng chọn |
| **Google Map Tiles API** (2D vệ tinh) | Có, bật billing | Cần phiên (`createSession`), logo / chữ "Google" + chuỗi bản quyền từ `viewport`, không tải trước / lưu kho / dùng ngoại tuyến, tôn trọng Cache-Control; cho dùng với renderer bên thứ ba và lớp phủ của mình nếu không che ghi nguồn | Chỉ hiện khi chủ app cấu hình khoá |
| Google Photorealistic 3D Tiles | Có | Cho dùng trong renderer bên thứ ba (vd. 3d-tiles-renderer) với ghi nguồn; không phủ vật thể trích xuất từ tiles | **Chưa làm** (mục 7) |

Nguồn: [Google Map Tiles policies](https://developers.google.com/maps/documentation/tile/policies), [2D tiles](https://developers.google.com/maps/documentation/tile/2d-tiles-overview),
[satellite session](https://developers.google.com/maps/documentation/tile/satellite), [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/),
[Esri basemap attribution](https://developers.arcgis.com/documentation/mapping-apis-and-services/deployment/basemap-attribution/),
[ArcGIS Location Platform pricing](https://location.arcgis.com/pricing/), [3d-tiles-renderer](https://github.com/NASA-AMMOS/3DTilesRendererJS).

### Chủ app bật Google (không có khoá trong mã)
1. Google Cloud Console → tạo project, bật **billing**, bật **Map Tiles API**.
2. Tạo API key → *Application restrictions: HTTP referrers* (tên miền app, vd. `https://unitmix.<miền>/*`, thêm `http://localhost:*/*` nếu cần thử), *API restrictions: Map Tiles API*.
3. Một trong hai: `npx wrangler secret put GOOGLE_MAPS_KEY` (Worker trả qua `GET /api/ban-do/cau-hinh`, `worker/src/banDo.ts`) **hoặc** đặt `VITE_GOOGLE_MAPS_KEY` lúc build web.
4. Mở hộp › Vị trí › Nguồn ảnh: mục "Vệ tinh — Google" hết mờ. Khoá trình duyệt lộ ra theo thiết kế của Map Tiles API — giới hạn referrer là bắt buộc.

## 4. Gió: số liệu và điều khoản

- [Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api) (ERA5), `wind_speed_10m`, `wind_direction_10m` theo giờ cả năm trước,
  làm tròn ô 0,1°; gom ngay thành phân bố 16 hướng × dải 0,5 m/s, nhớ ở localStorage (`unitmix.gio.v1.*`) — mỗi vị trí tải một lần, mất mạng thì báo, không chặn.
- **Điều khoản** ([open-meteo.com/en/terms](https://open-meteo.com/en/terms)): API miễn phí CHỈ cho dùng phi thương mại (< 10 000 lượt/ngày), dữ liệu CC BY 4.0 (ghi "Open-Meteo").
  App nội bộ công ty có thể bị coi là thương mại → **chủ app cân nhắc gói trả phí** (đổi URL sang `customer-archive-api.open-meteo.com` + `apikey`) hoặc proxy + cache D1 qua Worker.

## 5. Phương pháp

- **Mặt trời**: NOAA rút gọn sẵn có (`ba_chieu/nang.ts`), bọc theo vị trí / ngày / giờ địa phương ở `tinh/matTroi.ts` (mọc / lặn, đường đi, bước nắng). Test:
  Hà Nội Hạ chí cực đại 87,6° (90 − (23,44 − 21,03)), Đông chí trưa 45,5°, mọc / lặn khớp timeanddate.com ± 4 phút.
- **Giờ nắng** (`tinh/nangGio/gioNang.ts`, Web Worker `gioNang.worker.ts`): khối = lăng trụ (tháp + đế như 3D). Mặt bằng: mỗi bước (15 phút; máy cảm ứng 30), bóng của
  lăng trụ trên mặt phẳng cao độ h = tổng Minkowski chân khối với đoạn bóng → tô quét dòng (mỗi mức cao độ: đất, mái đế, mái tháp). Mặt đứng: mẫu 3 × 3 m (cảm ứng
  6 × 6), nắng khi pháp tuyến quay về mặt trời và tia không cắt khối (khung bao loại trước). Bỏ mặt trời < 1°. Không tính cây, địa hình, nhà ngoài PA, mây.
  Tham khảo ngưỡng: BRE BR 209 (≥ 50 % sân ≥ 2 h ngày 21/3) — chỉ để so sánh, QCVN không có chỉ tiêu giờ nắng.
- **Gió** (`nangGio/lbm.ts`, `nangGio/chayGio.ts`): D2Q9 BGK + Smagorinsky trên GPU (WebGL2, MRT 3 texture RGBA32F, ping-pong), lát ngang ở cao độ đi bộ (khối có đáy < 1,5 m),
  lưới 256² (cảm ứng 128²), khu đất ~ 50 % miền; 8 hướng (45°) chạy lần lượt, hướng chủ đạo trước; ~7 000 bước / hướng, cộng dồn vận tốc trung bình 45 % cuối;
  đọc kết quả qua PBO + fence (không chặn); hướng lẻ của 16 = trung bình hai hướng kề. Tiện nghi: P(vượt T) = Σ_hướng P(V10 > T / (K·α)), α = (1,5/10)^0,22 (tạm);
  lớp Lawson LDDC 4 / 6 / 8 / 10 m/s ở 5 % ([BRE review](https://images.reading.gov.uk/2022/03/CD7.35-BRE-Review-of-Wind-Assessment-dated-and-rec-31-1-22.pdf),
  [SimScale](https://www.simscale.com/blog/lawson-wind-comfort-criteria/)); an toàn 15 m/s > 0,022 % là giá trị tạm, chưa đối chiếu văn bản gốc.
  **Giới hạn**: 2D (không có dòng vượt mái, xoáy chân tòa 3D), Re lưới thấp, không lớp biên khí quyển, không nhà xung quanh — ước lượng nhanh để so sánh phương án, không thay CFD.
- **Forma** (học UX, không chép tài nguyên / bảng màu): phân tích chạy theo yêu cầu, thang màu + thanh thống kê, đọc số tại điểm, "Rapid wind" (dự đoán nhanh) vs "Detailed wind"
  (mô phỏng) — app này tương ứng mức "nhanh"; tiện nghi theo Lawson ở 1,5 m ([Autodesk Forma — environmental analysis](https://www.autodesk.com/products/forma/environmental-impact-analysis)).

## 6. Hiệu năng (đo `node scripts/do_nang_gio.mjs`, Edge headless + CDP, GPU D3D11, vite dev, dự án thử `2mlg1a2l` pa-1 — 6 lô dải 1,1 km, đặt ở 21,0122, 105,7865)

Tác vụ dài luồng chính (> 50 ms) từng pha — số / dài nhất:

| Pha | Máy bàn 1440×900 (CPU 1×) | Điện thoại 390×844 @3x (CPU 4×) |
|---|---|---|
| Mốc: mở 3D của app (chưa bật gì) | 3 / 337 ms | 13 / 443 ms |
| — sau gộp 6221899 (vật liệu PBR, trời PMREM, cây, tum) | 4 / 755 ms | 10 / 764 ms |
| Bật ảnh vệ tinh 2D (26 / 53 ô) | 0 | 2 / 76 ms |
| Kéo + lăn bản vẽ có ảnh nền | 0 | 0 |
| Chạy giờ, bóng đổ 2D | 0 | 1 / 56 ms |
| Giờ nắng (worker; thời gian chạy) | 0 (≈ 0,44 s) | 1 / 79 ms (≈ 0,4 s, lưới 2 m, 30 phút) |
| Bật ảnh nền 3D (atlas 2048² + 1024² trong worker) | 0–1 / 52 ms | 1 / 71 ms |
| Chạy giờ 3D (bóng thật, mỗi khung) | 0 · 60 fps khi xoay (`_doFps`) | 0 |
| Mô phỏng gió 8 hướng (GPU) | 0 (≈ 5,8 s) | 2 / 99 ms (≈ 4,5 s, lưới 128²) |
| Sau gộp 6221899: ảnh nền 2D · giờ nắng · ảnh nền 3D · gió | 0 · 0 (0,44 s) · 0 · 0 (5,8 s); 60 fps | 1/54 · 1/62 (0,29 s) · 1/58 · 1/61 ms (4,3 s) |

Khung giữa không đổi (2D / 3D: 270,52,870×848 máy bàn; 0,48,390×740 điện thoại). Chunk khởi động chỉ thêm kho trạng thái + nút (~ vài kB); hộp (33 kB), lớp 2D (6 kB),
phần 3D (10 kB), worker nắng (4 kB), worker ảnh nền (0,6 kB) tải lười. Ảnh: `docs/anh/nang-gio/` (`may-*`, `dt-*`), số đo `do-may.json`.

## 7. Chưa làm / đề xuất

- Google Photorealistic 3D Tiles quanh khu đất (3d-tiles-renderer + GoogleCloudAuthPlugin + ReorientationPlugin, lệch cao độ ~ geoid cần raycast đặt mặt đất) — chưa có khoá để thử, chưa thêm thư viện.
- Toạ độ VN-2000 từ DXF (TM-3°, kinh tuyến trục theo tỉnh + 7 tham số) → đặt vị trí tự động khi bản vẽ giữ toạ độ gốc.
- Nhà hiện hữu xung quanh (OSM buildings / Google 3D) làm vật che cho nắng, gió, view.
- Giờ nắng theo căn (mặt căn → % căn ≥ 2 h Đông chí) nối vào điểm view; Leo AI `get_sun_hours`, `get_wind_comfort`.
- Cache số liệu gió trong D1 qua Worker (đỡ gọi Open-Meteo từ từng máy; gói trả phí đặt khoá ở Worker).
