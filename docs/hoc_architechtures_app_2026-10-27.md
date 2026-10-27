# Học Architechtures → chọn lọc cho Unitmix (27/10/2026)

Bổ sung cho [doi_chieu_architechtures.md](doi_chieu_architechtures.md). Bản đó soạn từ blog; bản này soạn từ việc đọc hết tài liệu và bấm thử app thật, rồi lọc theo QCVN hiện hành.

## 1. Đã xem những gì

| Nguồn | Phạm vi | Ghi chú |
|---|---|---|
| Sổ tay `UserManual.pdf` (06/2026, 89 trang) | Đọc hết chữ + xem ảnh từng trang | Bản đầy đủ nhất, gộp T1–T9 |
| 8 bài blog "Tutorials" (02/2024) | Đọc hết, dò từng câu so với sổ tay | Là bản cũ của sổ tay; chỉ thêm: chia sẻ 2 kiểu Xem / Sửa |
| 21 video YouTube "ARCHITEChTURES 2025" | Đọc lời thuyết minh cả 21; chụp khung hình 15 video | Thêm so với sổ tay: menu ngữ cảnh đổi công năng ô, preset ở từng mục, % điều chỉnh giá, lớp Vegetation |
| App thật, dự án DEMO (tài khoản gói VIEW) | Bấm thử: các cấp lô → tòa → tầng → căn; các lớp Mix / Minimum Dimensions / Areas; MODEL (Solar path, Solar range, Perspective / Top); COST; Copy Design | Gói VIEW khóa AUTO, MANUAL, COST, Copy / New / Share / Delete. Panel nhập liệu bị ẩn nhưng vẫn có trong trang: đã trích **toàn bộ tham số + giá trị mặc định + khoảng min–max** (mục 3) |

Chưa xem được trong app: chế độ AUTO / MANUAL, màn hầm (chọn Below Grade không đổi được khung vẽ ở chế độ chỉ xem), menu ngữ cảnh, tab Financials. Những phần này đã có trong sổ tay và video.

## 2. Những điều thấy được khi bấm thử

- **Đi sâu bằng hai lần bấm**: rê chuột lên tòa thì tòa được tô sáng kèm nhãn "Building 3"; bấm lần 1 chọn, lần 2 vào cấp dưới. Breadcrumb là các ô chọn: `Above/Below Grade › Building n › Ground / Standard Floor 1…5 / Rooftop › Apartment n`.
- **Mọi nút đều có tooltip giải thích** (cả nút trên thanh trên, nút lớp hiển thị, từng thanh trượt). Đây là điểm đáng học nhất về giao diện.
- **Cấp tầng**: mỗi phòng có một vòng tròn kích thước tối thiểu (xanh đạt · cam gần ngưỡng · đỏ thiếu) và một chấm màu so DT với mục tiêu (xanh dương thừa · xanh lá đạt · đỏ thiếu).
- **Cấp căn**: nhãn phòng `A: 7,32 m² (−4,68) · Ø: 2,55 m (−0,05)`. Panel phải có bảng DT từng phòng kèm số chênh, phần tổng gồm Total Net Interior / Exterior, Built, Building CA Factor (DT phần chung phân bổ về căn) và GEA + BCAF. Kiểu căn đặt tên `1B A`, `2B H`…
- **Bảng chỉ tiêu lô** có hai cột "Gross external area / Zoning floor area", chi tiết theo hạng mục (ở, phần chung, hiên trong, hiên ngoài, hiên không mái, thương mại, SHCĐ, kỹ thuật, sân vườn). Ví dụ: ban công ngoài có mái 15.347 m² chỉ tính 7.673 m² (50%).
- **Chất lượng AI sinh mặt bằng chưa tốt**, ngay trên dự án mẫu: căn 2B H có phòng ngủ master 7,32 m² và phòng ngủ 2 là 7,23 m², đều **dưới 9 m², tức không đạt QCVN 04:2021 điểm 2.2.4.4**. Đây là căn cứ để Unitmix giữ hướng dùng thư viện mẫu căn đã duyệt.
- **Lỗi của họ (Unitmix phải tránh)**: cột Studio ra `undefined`; chú thích biểu đồ tròn ra `NaN%`; "Total area below grade = 0,00 m²" trong khi các dòng con có số; khung 3D trắng trơn ở cấp căn; còn sót nhãn tiếng Tây Ban Nha chưa dịch ("Posición de galería exterior", "Núm. de escalones…"); chế độ chỉ xem chậm, nhiều ô chọn bấm không ăn.
- **3D**: mô hình trắng; đường đi mặt trời vẽ thành các vòng analemma (vị trí mặt trời theo từng giờ trong năm); không thấy bóng đổ. **Add Camera** mở một thanh "Camera Height 1.6 m · Back", rồi bấm vào mô hình để đặt điểm nhìn ngang tầm mắt (sau đó xuất PNG).
- **Thanh công cụ dưới mặt bằng (đã bấm thử từng nút)**:
  - *Reference to object*: công tắc bắt điểm, đậm là bật.
  - *Reference Floor*: chồng một tầng khác lên tầng đang xem; ở chế độ chỉ xem chọn không ăn.
  - *Measure*: bấm hai điểm (có bắt điểm), Enter thì hiện nhãn "53.22 m"; đường đo nằm lại trên bản vẽ.
  - *Dimensions / Mix / Minimum Dimensions / Areas*: các công tắc lớp. Ở cấp tầng, Dimensions không thấy đổi gì; nét kích thước chỉ hiện ở cấp căn.
  - *Zoom + / −*: phóng to, thu nhỏ.
  - *Ô "10.00 m"*: thước tỷ lệ, tự đổi theo mức zoom (1.00 m khi phóng to).
  - *Hoa gió*: chỉ hiển thị, tooltip "North representation".
  - *Nút ">"*: thu gọn panel dữ liệu, bản vẽ dãn ra hết bề ngang.
- **Thanh trên**: XLS / CAD / BIM (tạo file tải về; không bấm vì sẽ tải file); "→≡" về danh sách dự án; "⋮" mở menu tài khoản (email, gói FREE, "0 of 0", Designs, My Account, Upgrade to PRO, Quit). Ở cấp tòa, bảng "Units in building" có cột Current Floor / Target %, phần lệch tô màu (+18% đỏ, −27%…).

## 3. Bộ tham số trích từ app (giá trị mặc định của DEMO)

Trích nguyên từ panel nhập liệu bị ẩn; con số là mặc định (khoảng min–max).

- **Targets (chỉ tham khảo, mặc định trống)**: tổng số căn, % từng loại căn, DT lô (tự lấy từ CAD), tiềm năng sàn ở, tiềm năng sàn thương mại, DT chiếm đất tối đa, DT bể bơi, DT vườn chung, tổng dự toán, số chỗ đỗ, số kho.
- **GFA deduction (%; bước 50%, riêng hộp kỹ thuật bước 10%)**: hiên trong 100 · hiên ngoài có mái 50 · hiên ngoài không mái 0 · vườn có mái 50 · vườn không mái 0 · hiên áp mái 0 · hộp thang / kỹ thuật 0 · phần chung 100 · hiên cột 50 · thương mại 100 · SHCĐ 100 · phòng kỹ thuật 100.
- **Excluded zoning areas**: trừ 0–10 m² mỗi căn, riêng cho tầng áp mái / điển hình / trệt.
- **Advanced controls (ngưỡng màu)**: DT −2 / +2 m²; kích thước −0,20 / +10 m; "hệ số sai số khoảng cách tối thiểu" 0,10.
- **Net areas theo loại căn (studio → 4PN)**: DT thông thủy mục tiêu 42,5 / 50 / 71,5 / 93,5 / 114 m². Số WC; có / không phơi đồ, phòng thay đồ, giặt, kho; cho phép phòng khách ở mặt phụ; cho phép bếp trong. Vị trí phòng khách, bếp, PN master, PN khác, WC ("−" = để AI chọn). DT mục tiêu từng phòng: khách 16–23 m², bếp 7,5–10 m², PN master 12–13,5 m², PN 2–4: 10,5 m² (**thanh trượt cho xuống tới 7,5 m²**), WC 3,5–4,5 m², ban công 4–10 m².
- **Internal minimum dimensions**: bếp 1,80 · PN master 2,60 · PN đôi 2,50 · PN đơn 2,50 · WC 1,50 · sảnh vào 1,20 · hành lang trong căn 1,00 · cửa vào phòng ngủ 0,90 · cửa ra ban công 1,00 m. Thang riêng trong căn: bậc 0,30, vế 0,90, 16 bậc, khoảng trống đầu 2,10 m.
- **Construction**: tường ngoài 0,35 · tường giữa căn 0,25 · tường trong 0,20 · vách 0,08 · lan can 0,10 · sàn ngoài 0,60 · sàn trong 0,45 m. Cột 0,30×0,30; nhịp X 5,3–6,0, nhịp Y 5,0–7,0 m; cột âm trong tường bao / hành lang. Hộp kỹ thuật chung, hộp bếp (chỉ khi bếp trong), hộp WC (chỉ khi WC trong).
- **General floor – Design**: hướng; vị trí trục (trái / giữa / phải); loại hình (lõi đứng / hành lang giữa / hành lang bên); bề rộng 8–16 m; % lùi mặt đứng để khớp DT; dài nhà; vị trí lõi (trước / sau); cho phép lõi ở góc không thông gió; đầu hành lang (mở ra mặt đứng / tường chung giữa); vị trí hành lang theo chiều sâu; cho / không thông gió phòng qua phần chung; số tầng điển hình 1–35; tầng áp mái; số tầng thương mại 0–2; sử dụng mái; **cao tầng = số bậc × chiều cao bậc** (18 × 0,185 = 3,33 m); khoảng vượt thang máy 1,0 m.
- **Housing mix**: % mục tiêu theo loại cho tầng điển hình; "sai số số căn"; "fitting of number of units"; đảo thứ tự xếp căn.
- **Common areas / core**: hành lang chung ≥ 1,20 · sảnh vào ≥ 1,50 m; **"Maximum evacuation route in the plant" 20 m**; 1 thang máy / lõi; thêm lõi ở đầu hồi; thang bộ tầng điển hình có / không bảo vệ; thang tầng trệt lên trên / xuống hầm có bảo vệ; cho phép chiếu nghỉ lệch; vế thang 1,10 · hố thang máy 1,40×1,60 · khoảng trống trước thang máy Ø 1,50 m.
- **Áp mái**: cơ cấu riêng; lùi trước 2,0 / sau 1,0 / trái, phải 0 m; hiên. **Tầng trệt**: vườn sâu 3,0 m theo từng mặt.
- **Exterior enclosure**: khoảng mô-đun lùi mặt đứng 0,80; cửa sổ khách rộng 1,60, bậu 0,30; bếp, phòng ngủ, WC rộng 0,80, bậu 0,30; hành lang rộng 0,40, bậu 1,10 m.
- **Hầm**: tầng cao 3,15 m; 1–6 tầng hầm; 4 kiểu bố trí chu vi (làn / kho / chỗ đỗ / chỗ đỗ + kho); nhịp 5,3 m; cột 0,30; **làn 5,5 m · chỗ đỗ 2,5×5,0 m**; ram vào 5,0 · ram trong 5,0 m; lối vào lõi 1,5 m; kho TB 6 m², rộng ≥ 2,0 m, hành lang kho 1,0 m; tường hầm 0,60 m.
- **Cost**: tiền tệ (có VND); tầng A %SNCC (QA 1 · ATLĐ 2 · rác thải 1 · khác 1); B %ENCC (chi phí chung 13 · lãi 6); C %soft cost (khả thi 0,5 · thiết kế, giám sát 7 · trượt giá, bảo hiểm 0,5 · giấy phép 6 · dự phòng 0). 17 chương dự toán, mỗi chương có thanh "Adjust unit price %" (−75…+200%) và dòng "Other".

## 4. Chọn lọc

Căn cứ trích từ kho `E:\OneDrive\_QCVN-TCVN\`. QCVN 04:2021 ghi tắt là **QC04**, QCVN 01:2021 là **QC01**, QCVN 13:2018 là **QC13**.

### 4.1 Lấy về — hợp app, không vướng quy chuẩn

| # | Tính năng | Lý do / cách làm cho Unitmix | Liên quan việc |
|---|---|---|---|
| L1 | **Tooltip cho mọi nút và mọi ô nhập** | Họ làm đều tay, nhờ vậy người mới tự học được. Unitmix làm thêm một bước: ô nào có căn cứ thì tooltip ghi luôn điều khoản QCVN | A11 |
| L2 | **Preset 2 tầng**: theo cấp (dự án / lô / tòa) và theo từng mục (dòng "Preset Group" + Tạo / Xóa) | Chủ nhiệm lưu bộ "NOTM Hà Nội", "NOXH" rồi nạp lại cho dự án mới | A4 |
| L3 | **Thanh trượt + ô số + đơn vị + min/max/step**, giá trị "−" = để máy tự chọn | Dùng cho thông số hành lang, sảnh, hầm. Chặn min theo QCVN (xem 4.2) | — |
| L4 | **Chỉ tiêu theo loại căn**: DT thông thủy, DT tim tường, DT phần chung phân bổ, DT bán (= thông thủy + phân bổ), hệ số thông thủy / tim tường | Tương ứng Total Net · Built · BCAF · GEA+BCAF · NIA/GEA. Bảng loại căn ở màn Tầng còn thiếu cột tỷ lệ, bổ sung | §2 bảng cũ |
| L5 | **Nhãn phòng `A: … (±) · Ø: … (±)` + bảng DT từng phòng có chênh** | Làm khi mẫu căn CAD có ranh phòng và tên phòng. Ngưỡng màu mặc định −2 / +2 m², −0,20 m, chỉnh được trong PA | A10 |
| L6 | **Các nút lớp hiển thị**: Mix · Kích thước tối thiểu · DT · Tầng tham chiếu (chồng tầng khác lên) · Đo | Unitmix đã có tô theo loại căn; thêm "tầng tham chiếu" và "đo" | — |
| L7 | **Breadcrumb là ô chọn**, rê thì tô sáng kèm nhãn, bấm 2 lần đi sâu, nút ↑ lên một cấp | Đúng hướng thanh trên hiện tại; thêm ô chọn tầng (Trệt / Điển hình 1…n / Mái) | — |
| L8 | **Menu ngữ cảnh của ô căn**: đổi thành phòng kỹ thuật / SHCĐ / ô trống / thương mại; **chọn nhiều ô** để đổi một lần | Cần để đạt SHCĐ ≥ 0,8 m²/căn (QC04 2.2.7) mà không phải sửa mẫu tòa | §4 bảng cũ |
| L9 | **Menu lõi**: cửa vào bên trái / phải; tích riêng thang bộ, thang máy, hộp kỹ thuật **xuống hầm / lên mái** | Nối thẳng vào kiểm tra thang máy chữa cháy (PC-07) và hầm | A6 |
| L10 | **Sửa nhiều tầng có ô chọn tầng áp dụng** (mặc định mọi tầng điển hình) | Mô hình cần lưu bố cục theo tầng | A9 |
| L11 | **Thứ tự Tổng → Chi tiết, có cảnh báo** "quay lại bước trước sẽ mất chỉnh tay ở bước sau" | Áp cho TMB → Tầng → Căn → Hầm. Họ ghi rõ chỉnh tay ở hầm cũng mất khi tầng trên tính lại | — |
| L12 | **Thư mục dự án → nhiều PA**: mỗi PA một dòng tóm tắt số căn theo loại, DT trên / dưới cốt 0; nhân bản PA; chia sẻ kiểu Xem / Sửa qua email | Unitmix đã có danh sách PA; thêm nhân bản và chia sẻ chỉ xem | A5 |
| L13 | **Ô "Mục tiêu (chỉ tham khảo)" mặc định trống**, so màu khi đã nhập | Đã có; giữ nguyên nguyên tắc "không điền sẵn mục tiêu" | — |
| L14 | **Xuất XLS**: báo cáo A4 kèm bản vẽ A3; **DXF mỗi tầng** với lớp tường / cửa / cột / hộp + lớp nhãn (tên phòng, DT) | Đã có DXF; thêm lớp nhãn và báo cáo XLS có dấu tiếng Việt | A5 |
| L15 | **Dự toán theo lớp**: chi phí trực tiếp → % gián tiếp từng lớp; **"% điều chỉnh giá" theo chương** (cập nhật trượt giá); dòng "Khác" | Lấy **cách làm**, không lấy chương mục Tây Ban Nha (xem 4.3) | (chi phí) |
| L16 | **Định giá**: đơn giá theo loại căn; % tăng theo tầng; % riêng tầng trệt / mái; phạt lệch cơ cấu / lệch DT; chỗ đỗ tính giá theo tầng hầm | Làm khi có đơn giá thật. Có thể làm sớm phần **"phạt lệch cơ cấu"** để chấm điểm PA | A5 |
| L17 | **Thanh 3D dưới cùng**: Môi trường · Camera · Tòa · Đường mặt trời · Phạm vi nắng · Phối cảnh / Nhìn đỉnh | Đã có nắng theo giờ, lưu góc, PNG; thêm "nhìn đỉnh" và "phạm vi nắng trong ngày" | A7 |

### 4.2 Lấy nhưng phải sửa theo QCVN

| # | Của Architechtures | Quy định Việt Nam (trích kho) | Làm cho Unitmix |
|---|---|---|---|
| S1 | **GFA deduction**: % cho từng hạng mục, bước 50% (kiểu Tây Ban Nha) | **QC01 1.4.21**: hệ số sử dụng đất = "tổng diện tích sàn của công trình gồm cả tầng hầm (trừ các diện tích sàn phục vụ cho hệ thống kỹ thuật, phòng cháy chữa cháy, gian lánh nạn và đỗ xe của công trình)" / DT lô | Thay 4 hệ số hiện có bằng bảng hạng mục **tính / không tính**, mỗi dòng ghi căn cứ. Phải **cộng phần hầm không phải đỗ xe / kỹ thuật** vào DT sàn tính HSSDĐ (hiện `chiTieu.ts` chưa tính). Cách tính ban công, lô gia vào DT sàn xây dựng: **kho chưa có văn bản hướng dẫn, chủ nhiệm chốt** |
| S2 | DT căn "Net" tính hiên ngoài theo % | **QC04 1.4.13**: DT sử dụng căn = thông thủy, **gồm ban công, lô gia (toàn bộ)**; không gồm cột, vách chịu lực, hộp kỹ thuật trong căn, tường bao, tường chia căn | Dùng định nghĩa này cho mọi số "DT thông thủy". Tủ PCCC âm tường trừ DT (PC-14) là đúng tinh thần |
| S3 | Thanh trượt PN 2–4 cho xuống **7,5 m²** | **QC04 2.2.4.4**: "Diện tích sử dụng của phòng ngủ … không được nhỏ hơn 9 m2"; **2.2.4.1** căn ≥ 25 m²; **2.2.4.2** NOTM: căn < 45 m² ≤ 25% | Thêm luật **phòng ngủ ≥ 9 m²** khi có ranh phòng (DC-01, DC-02 đã có). Đặt min của ô DT phòng ngủ = 9 |
| S4 | Cho phép bếp trong, phòng khách ở mặt phụ | **QC04 2.2.4.3** căn phải có chiếu sáng tự nhiên, căn ≥ 2 phòng ở cho phép 1 phòng ở không có; **2.2.4.4** phòng ngủ phải thông thoáng, chiếu sáng tự nhiên; **2.6.3** bếp phải thông gió thải ra ngoài | Luật mới: phòng ngủ phải giáp mặt ngoài; bếp trong phải có hộp thải (giống "Kitchen shafts – internal kitchens only" của họ) |
| S5 | Cao tầng = số bậc × chiều cao bậc (3,33 m) | **QC04 2.2.10**: thông thủy phòng ở ≥ 2,6 m; bếp, WC ≥ 2,3 m; hầm, kỹ thuật ≥ 2,0 m | Cho nhập cao tầng + chiều dày sàn + trần → kiểm thông thủy. Giữ ý "đếm bậc" để kiểm thang |
| S6 | Cửa sổ: bậu 0,30 m | **QC04 2.2.11**: căn không có ban công / lô gia phải có ≥ 1 cửa sổ ở tường ngoài, lỗ thông thủy ≥ 600×600 mm (cứu nạn); **2.2.12**: chiều cao "tính từ sàn đến mặt dưới lỗ cửa/bậu cửa sổ … không được nhỏ hơn 1,4 m" | Thêm kiểm "căn không ban công phải có cửa cứu nạn". **2.2.12: chủ nhiệm đọc lại cách hiểu** trước khi đặt mặc định bậu |
| S7 | "Maximum evacuation route in the plant" 20 m (một số) | QCVN 06:2022 + SĐ1:2023, Bảng G.1: cụt 25 m · giữa hai thang 40 m; nhà > 75 m: 15 / 20 m (đã có trong `pccc.ts`) | **Giữ của Unitmix**; chỉ học cách họ đưa thành một ô hiển thị |
| S8 | Chỗ đỗ 2,5×5,0 m, làn 5,5 m; chỉ số "chỗ / căn" | **QC13 2.2.1.25**: chỗ đỗ tối thiểu 5 m × 2,3 m (xe lăn 3,5 m); **2.2.1.28** dốc thẳng có mái ≤ 18%, cong ≤ 13%, hở ≤ 10%, dốc ngang ≤ 6%, có người đi bộ thì vỉa hè ≥ 0,8 m. **QC04 2.2.17.1**: ô tô tách xe máy; DT đỗ xe (gồm đường nội bộ) ≥ 25 m²/4 căn và ≥ 20 m²/100 m² DT sử dụng căn, trong đó ≥ 6 m² xe máy, xe đạp mỗi căn; NOXH, tái định cư lấy 60%; gara cơ khí ≥ 12 m²/100 m²; **2.2.17.3** có chỗ đỗ người khuyết tật (QCVN 10) | Màn hầm: min các ô theo QC13; panel hầm báo **DT đỗ xe yêu cầu vs có**, theo QC04 (theo m², không chỉ theo "chỗ / căn") |
| S9 | Không có quy định riêng cho xe điện | **Dự thảo SĐ 01:2026 QCVN 04** (kho đang là bản chưa số, chưa ngày): khu xe điện ưu tiên ngoài trời → bán hầm → hầm 1; ô tô tách xe máy điện; giữa các khu cách ≥ 2 m hoặc tường không cháy cao ≥ 2 m. Phân vùng sạc ở hầm ≤ 25 chỗ ô tô hoặc ≤ 50 chỗ xe máy. Khoang cháy khu sạc ô tô ≤ 1.200 m² (hầm) / 1.500 m² (trên mặt đất); khu sạc xe máy ≤ 300 / 500 m². Trụ sạc trong hầm ≤ 22 kW. Tủ đổi pin chỉ đến hầm 1, cách thang thoát nạn ≥ 6 m | Màn hầm có loại ô "Khu xe điện / sạc / đổi pin" kèm kiểm các ngưỡng trên. **Chờ bản chính thức** (số hiệu, hiệu lực) trước khi bật thành luật cứng |
| S10 | "Communal premises" chỉ là một dòng DT | **QC04 2.2.7**: SHCĐ ≥ 0,8 m²/căn; cụm nhiều tòa được gộp, giảm tối đa 30%, bán kính ≤ 300 m | Luật mới **SHCĐ ≥ 0,8 m²/căn**, kết hợp L8 |
| S11 | 1 thang máy / lõi (một ô) | **QC04 2.4.1**: ≥ 5 tầng có ≥ 1 thang máy, ≥ 10 tầng có ≥ 2; ≥ 1 thang chở được băng ca. **2.4.2**: 1 thang / 200 người hoặc / 70 căn; tải ≥ 450 kg (một thang: ≥ 630 kg). **2.4.3**: chiều cao PCCC > 50 m hoặc hầm sâu > 9 m thì mỗi khoang cháy có thang chữa cháy | Đã có CT-05/06/07, PC-07. Thêm kiểm **"có ≥ 1 thang băng ca"** vào thông số lõi |
| S12 | Cơ cấu % theo tầng điển hình + cơ cấu áp mái riêng | Không có quy định cơ cấu; chỉ có QC04 2.2.4.2 (≤ 25% căn < 45 m²) | Giữ mục tiêu theo lô (đề bài KD); thêm cơ cấu riêng cho tầng đặc biệt (A9) |
| S13 | Phòng nhân viên: không có | **QC04 2.2.18**: không gian cho nhân viên quản lý, trông xe, bảo vệ, kỹ thuật ≥ 5 m²/người | Luật nhẹ ở cấp tòa (cần số nhân viên đầu vào) |

### 4.3 Không lấy

| Tính năng | Lý do |
|---|---|
| AI tự sinh mặt bằng căn từ trục + bề rộng | Đã chốt dùng 33 mẫu tòa và mẫu căn đã duyệt. Chính dự án mẫu của họ sinh ra phòng ngủ 7,2–7,3 m², không đạt QC04 2.2.4.4 |
| Chế độ MANUAL vẽ tường, cửa, cột như CAD | Việc của AutoCAD / Revit; Unitmix xuất CAD là đủ |
| Trừ DT cố định mỗi căn ("Excluded zoning areas") | Không có cơ sở trong QC01 / QC04 |
| 5 loại căn cứng (studio → 4PN) | Thị trường Việt Nam dùng 1PN, 1PN+, 2PN, 2PN+, 3PN, duplex, penthouse; giữ loại căn theo thư viện |
| Vườn riêng tầng trệt, lùi áp mái kiểu "ático" | Tầng 1–2 chung cư Việt Nam thường là thương mại / dịch vụ; để sau, làm tùy chọn nếu có dự án cần |
| 17 chương dự toán + SNCC / ENCC kiểu Tây Ban Nha | Cơ cấu chi phí Việt Nam khác. **Chủ nhiệm / QS chốt khung** (suất vốn, chi phí xây dựng, thiết bị, QLDA, tư vấn, khác, dự phòng) trước khi làm L15 |
| Nhập bối cảnh từ OpenStreetMap, lưới địa hình | Dữ liệu OSM ở Việt Nam thưa; Unitmix đã có DXF hatch + Excel chỉ tiêu. Để sau |
| Hệ đơn vị Anh, 160 loại tiền | Chỉ cần mét và VND |
| Xuất IFC | Ưu tiên thấp; xuất CAD XREF hợp quy trình hiện tại hơn |
| Đường mặt trời dạng analemma | Unitmix đã có mặt trời theo giờ và bóng đổ, là thứ họ không có |

## 5. Việc nên làm tiếp (bổ sung vào bảng "Thứ tự làm theo" của bản cũ)

| # | Việc | Nguồn | Cần chốt |
|---|---|---|---|
| A3′ | Bảng hạng mục DT sàn **tính / không tính** HSSDĐ theo QC01 1.4.21 (thay bảng % ở A3); cộng phần hầm không phải đỗ xe / kỹ thuật | S1, S2 | Cách tính ban công, lô gia vào DT sàn xây dựng |
| A12 | Luật mới: phòng ngủ ≥ 9 m², phòng ngủ giáp mặt ngoài, SHCĐ ≥ 0,8 m²/căn, căn không ban công có cửa cứu nạn 600×600, thông thủy ≥ 2,6 / 2,3 / 2,0 m, ≥ 1 thang băng ca | S3–S6, S10, S11 | Cách hiểu QC04 2.2.12 |
| A6′ | Màn hầm theo QC13 + QC04 2.2.17 (DT đỗ xe theo m²), khu xe điện theo dự thảo SĐ 01:2026 | S8, S9 | Bản chính thức SĐ 01:2026 |
| A4′ | Preset 2 tầng (cấp + từng mục) | L2 | — |
| A11′ | Tooltip mọi ô, kèm căn cứ QCVN | L1 | — |
| A13 | Menu ngữ cảnh ô căn / lõi, chọn nhiều ô | L8, L9 | — |
| A14 | Kiểm tra "không còn `undefined` / `NaN` / tổng = 0 khi dòng con có số / nhãn chưa dịch" thành test chung cho mọi bảng | §2 | — |

**Văn bản cần rà thêm**: kho có QCVN 01:**2021**; nếu QCVN 01:2026 đã ban hành thì phải đối chiếu lại S1. TT 31/2026 trong kho là bản dự thảo.
