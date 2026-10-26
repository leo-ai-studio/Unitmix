# Unitmix (app mới) — tài liệu thiết kế

Ngày: 2026-10-27 · Người đặt hàng: chủ nhiệm (NghiaVT) · Trạng thái: chờ duyệt
Mockup đã duyệt: https://claude.ai/artifact/5o2wpZURXYLFLWCgEqcpKi (8 màn)
Nghiên cứu nền: `docs/nghien_cuu/hoc_architechtures_dao_sau_2026-10-26.md`

> Tệp này tạm nằm ở repo cũ. Khi tạo repo mới, chuyển sang `docs/` của repo đó.

## 1. Vì sao làm

Chủ nhiệm lập cơ cấu căn theo trình tự:
1. Nhập chỉ tiêu quy hoạch của lô.
2. Từ chỉ tiêu và thế đất, chọn mẫu tòa phù hợp và số lượng tòa.
3. Sau đó mới đi vào chi tiết từng tòa, từng tầng, từng căn.

App cũ (`MDI_Unitmix_v4`, một tệp HTML ~644 KB) không đi theo trình tự này và khó mở rộng. App mới viết lại từ đầu. Bố cục và cách thao tác học theo Architechtures (đã soi trực tiếp trên bản DEMO), nhưng dùng thư viện mẫu tòa, mẫu căn đã bóc từ CAD của Viện.

Thành công nghĩa là:
- Chủ nhiệm mở một link, nhập chỉ tiêu lô.
- Thử vài cách xếp tòa và thấy ngay chỉ tiêu Đạt / Mục tiêu.
- Lưu thành các phương án (PA), so sánh các PA.
- Gửi link dự án cho người khác xem.

## 2. Mục tiêu

- **8 màn** đúng như mockup:
  - Dự án của tôi
  - Lô + chỉ tiêu QH
  - Xếp tòa
  - Tòa › Tầng
  - Căn
  - Dưới cốt 0 › Hầm
  - Mô hình 3D
  - So sánh PA
- **Bố cục chung** cho các màn soạn thảo:
  - Thanh trên: tab Mặt bằng · Mô hình · Chi phí; breadcrumb Lô › Tòa › Tầng › Căn; chế độ Tự động · Chỉnh tay · Chỉ xem; nút xuất; nút VI|EN.
  - Panel **Nhập** bên trái, panel **Số liệu** bên phải. Cả hai gồm các mục gập/mở được.
  - Bản vẽ ở giữa, có thanh hiển thị phía dưới.
- **Số liệu tự cập nhật** khi sửa, không có nút "Tính".
  - Mọi chỉ tiêu hiện cặp Đạt / Mục tiêu, kèm số chênh tô màu theo ngưỡng.
- **Mỗi dự án một đường link riêng** (`/du-an/<mã>`). Ai có link thì xem được. Muốn sửa phải có **mã sửa** của dự án. Không có tài khoản đăng nhập.
- **Lưu dự án và PA trên mạng** (Cloudflare). Mở trên máy khác vẫn thấy.
- **3D** ngay ở bản đầu: khối tòa, bóng đổ theo ngày giờ, lưu góc camera.
- **Nhận diện LEO AI** (theo LEO UI Kit):
  - Tên app: **Unitmix**. Biểu tượng LEO AI.
  - Song ngữ VI/EN, đổi tức thì và nhớ lựa chọn.
  - Tác giả: NghiaVT.

## 3. Không làm ở bản đầu

- AI tự vẽ mặt bằng căn. App dùng nguyên mẫu căn CAD đã duyệt; cấp căn chỉ để **kiểm tra và đổi mẫu**.
- Mô-đun tài chính (giá bán, chi phí, lợi nhuận). Tab **Chi phí** hiện "Đang làm".
- Nhiều người cùng sửa một PA một lúc. Tài khoản, phân quyền theo người.
- Dùng trên điện thoại. Chỉ cần không vỡ bố cục ở màn hẹp; thao tác chính là trên máy tính.
- Xuất IFC/BIM. Xuất XLS có ngay; DXF làm sau.

## 4. Không được xảy ra

- **Đụng vào app cũ hay repo cũ.** App mới ở repo riêng; dữ liệu được chép sang, không đọc chéo.
- **Số diện tích sai lặng lẽ.** Diện tích căn phải khớp thư viện CAD như app cũ đang kiểm (`kiem_dt_can`). Số nào là ước tính thì phải ghi rõ là ước tính.
- **Mất phương án.** Lưu thất bại phải báo rõ, và bản đang làm vẫn còn ở máy.
- **Người không có mã sửa ghi đè được PA.**
- **Sao y nhận diện của Architechtures** (logo, tên, màu). Chỉ học bố cục và cách thao tác.

## 5. Ràng buộc

- **Hạ tầng miễn phí:**
  - Mã nguồn: repo GitHub riêng tư mới.
  - Web tĩnh: Cloudflare Pages.
  - API: Cloudflare Workers.
  - Cơ sở dữ liệu: Cloudflare D1.
  - Gói miễn phí của Workers giới hạn khoảng 100.000 lượt gọi mỗi ngày, D1 khoảng 5 GB. Thiết kế phải nằm gọn trong các giới hạn này.
- **Thư viện dữ liệu** chép từ `data/master/` của repo cũ, có ghi phiên bản nguồn (commit) để biết lấy từ đâu:
  - `towers.json`, `toa_dwg.json`: 33 mẫu tòa (21 thương mại, 12 nhà ở xã hội).
  - `units.json`: 34 mẫu căn (Studio, 1PN, 2PN, 2PN+, 3PN).
  - `unit_geometry.json` (11 MB): hình học căn. **Phải tách nhỏ theo mẫu căn và tải khi cần**, không tải cả khối lúc mở app.
  - `core_geometry.json` (2,7 MB): lõi thang. Xử lý như trên.
  - `can3d.json`: khối 3D căn.
- **Link công khai**: thư viện mẫu căn xem được bởi bất kỳ ai có link. Chủ nhiệm đã chấp nhận điều này.
- **Thư viện là chỉ đọc** trong app mới. Cập nhật thư viện bằng cách chép lại từ repo cũ (có script).

## 6. Các phần chủ nhiệm đã chốt

| Mục | Quyết định |
|---|---|
| Luồng làm việc | Quy hoạch → chọn mẫu tòa và số tòa → chi tiết tòa, tầng, căn |
| Mã nguồn | Viết mới hoàn toàn, nhưng dùng lại thư viện mẫu tòa và mẫu căn |
| Nơi chạy | Web; repo GitHub; Cloudflare miễn phí |
| Quyền | Ai có link cũng mở được; mỗi dự án một đuôi riêng; ai làm dự án nấy, không đụng của nhau |
| 3D | Làm ngay ở bản đầu |
| Bố cục, tính năng | Như Architechtures; theo 8 màn mockup đã duyệt |
| Nhận diện | Brand LEO AI; tên app "Unitmix" |

## 7. Cách app hoạt động

### 7.1 Dự án, phương án, link
- **Dự án** = một lô. Có tên, địa điểm, mã link 6–8 ký tự khó đoán, và mã sửa.
- **Tạo dự án**:
  - App sinh mã sửa và lưu ở trình duyệt của người tạo.
  - App hiện mã sửa một lần để người tạo cất đi.
  - Link chia sẻ có hai dạng: link xem (`/du-an/<mã>`) và link sửa (thêm mã sửa vào link).
- **Phương án (PA)** thuộc một dự án:
  - Mỗi PA lưu toàn bộ trạng thái: lô, chỉ tiêu, hệ số, các tòa đã đặt, thông số tầng và hầm.
  - Nhân bản PA một nút.
  - Danh sách PA hiện tóm tắt (số căn theo loại, tổng căn, DT sàn, DT hầm).
- **Lưu**:
  - Tự lưu sau mỗi thay đổi, có chờ ngắn để gom nhiều thay đổi.
  - Có bản nháp ở máy (localStorage) phòng mất mạng.
  - Trạng thái lưu hiện ở thanh trên ("Đã lưu" / "Chưa lưu được").
- **Không có mã sửa**: mở ở chế độ **Chỉ xem**; mọi ô nhập bị khoá.

### 7.2 Cấp Lô (màn 1)
- **Nạp ranh lô**:
  - Từ DXF: chọn lớp ranh lô, lớp chỉ giới, lớp ranh hầm, lớp công trình xung quanh.
  - Hoặc vẽ tay.
  - DWG chưa đọc trực tiếp được trên web; người dùng xuất DXF. Đây là lựa chọn của tôi, xem §9.
- **Chỉ tiêu QH**:
  - DT lô (tự nhận từ ranh), mật độ xây dựng tối đa, HSSDĐ tối đa, tầng cao tối đa, dân số tối đa.
  - Người/căn, chỗ đỗ ô tô/căn, chỗ xe máy/căn, đất cây xanh tối thiểu.
- **Cơ cấu căn mục tiêu** của lô (% từng loại).
- **Hệ số tính vào DT sàn**: % tính vào chỉ tiêu cho từng hạng mục (logia, ban công, sảnh – hành lang, kỹ thuật – tum, thương mại đế, hầm). Thêm "Phần trừ khỏi DT sàn" theo căn.
- **Ngưỡng màu**: ngưỡng cho chênh lệch diện tích và chênh lệch kích thước.
- **Panel Số liệu** của cấp Lô:
  - "Sức chứa của lô": DTXD tối đa, DT sàn tối đa, số căn ước tính, chỗ đỗ cần, cây xanh cần.
  - "Gợi ý mẫu tòa hợp lô": mẫu nào vừa chỉ giới và bao nhiêu tòa.

### 7.3 Xếp tòa (màn 2)
- **Thư viện mẫu tòa** lọc theo thương mại / nhà ở xã hội, xếp mẫu hợp lô lên trước. Mỗi thẻ ghi số căn/tầng và cảnh báo (vượt chỉ giới, lệch hướng).
- **Đặt tòa**: kéo từ thư viện vào lô; di chuyển, xoay, nhân bản, khoá, xoá.
- **Thông số mỗi tòa**: số tầng điển hình, số tầng đế, góc xoay.
- **"Gợi ý xếp tòa tự động"** ở bản đầu: thử các mẫu hợp lô trong chỉ giới, mỗi kết quả là một PA nháp. Mức độ thông minh xem §9.
- **Panel Số liệu** của màn Xếp tòa:
  - Chỉ tiêu lô Đạt / Mục tiêu / chênh.
  - Bảng diện tích lô hai cột (Xây dựng / Tính HSSDĐ).
  - Biểu đồ tròn cơ cấu căn, bảng tòa × loại căn có hàng Mục tiêu và hàng Lệch.
- Nút **Cơ cấu** ở thanh dưới bật/tắt tô màu căn theo loại.

### 7.4 Tòa › Tầng (màn 3)
- Mặt bằng tầng ghép từ hình học thật của mẫu tòa và các mẫu căn trong thư viện.
- **Cơ cấu căn tầng điển hình**:
  - Đặt % từng loại. App đổi mẫu căn trong các ô mô-đun cùng bề rộng để bám sát mục tiêu nhất.
  - Mix chỉ là hướng dẫn, vì số căn nguyên không chia đúng tỷ lệ được.
  - Tầng áp mái có mix riêng.
- **"Sửa nhiều tầng"**: sửa một tầng thì áp cho dải tầng đã chọn. Tắt đi thì chỉ sửa tầng đang xem.
- **Hiển thị**: vòng tròn kích thước tối thiểu của căn; chấm màu diện tích (trong ngưỡng / thừa / thiếu ít / thiếu nhiều).
- **Panel Số liệu** của cấp Tầng:
  - Căn trong tòa: tầng này so với mục tiêu.
  - Loại căn trong tầng: thông thủy, tim tường, logia, cộng phần chung phân bổ, tỷ lệ, lệch so với mẫu.

### 7.5 Căn (màn 4)
- Hiện mẫu căn CAD: các phòng, diện tích từng phòng, phần lệch so với diện tích mục tiêu, kích thước tối thiểu.
- **Đổi sang mẫu khác cùng mô-đun.** Mẫu khác mô-đun thì báo chênh lệch kích thước.
- **"Sửa nhiều căn"**: đổi một căn thì áp cho mọi căn cùng mẫu ở các tầng đang sửa.
- **Không vẽ lại căn.**

### 7.6 Dưới cốt 0 › Hầm (màn 5)
- **Thông số**:
  - Số tầng hầm, kiểu chu vi hầm, nhịp kết cấu, rộng làn, kích thước chỗ đỗ.
  - Rộng ram vào và ram trong, lối vào lõi, DT kho, dày tường.
- **Ranh hầm** lấy từ lớp DXF hoặc vẽ tay; có công cụ "Khoét" để bỏ bớt vùng.
- **Rải tự động**: làn xe, chỗ đỗ dọc tường và các dãy giữa, kho.
  - Ram dốc do người dùng vẽ.
  - Lõi thang, thang máy, hộp kỹ thuật và lưới cột kế thừa từ các tòa phía trên, có ô bật/tắt từng thành phần.
- **Panel Số liệu**: chỗ đỗ ô tô và xe máy, kho (Có / Mục tiêu / trên mỗi căn), m² hầm mỗi chỗ, gợi ý khi thiếu.
- **Ghi chú**: chạy lại Tự động ở trên cốt 0 sẽ dựng lại hầm, nên app nhắc dựng hầm sau khi đã chốt số căn.

### 7.7 Mô hình 3D (màn 6)
- **Hiển thị**: khối các tòa (đế, điển hình, áp mái), lô và công trình xung quanh.
- **Nắng**: vĩ độ / kinh độ, ngày giờ, bóng đổ, hướng bắc.
- **Mặt cắt** ngang và đứng.
- **Camera**: lưu và mở lại góc nhìn; chuyển phối cảnh / nhìn từ trên.
- Bản đầu chỉ cần khối tòa có vạch tầng. Căn 3D chi tiết (`can3d.json`) làm khi phóng gần một tòa, nếu kịp.

### 7.8 So sánh PA (màn 7)
- Chọn **tối đa 6 PA** của cùng dự án.
- **Dải thẻ** gồm hình thu nhỏ và các nút Bỏ / Mở / Chọn. Sắp xếp theo một chỉ số.
- **Danh mục chỉ số**: DT sàn và mật độ, cơ cấu đạt được, DT căn trung bình theo loại, chỗ đỗ và kho, vi phạm chỉ tiêu, điểm PA.
- **Thẻ lớn**: "PA chọn so với PA gốc".
- **Biểu đồ**: thanh xếp chồng cơ cấu căn so với mục tiêu.
- **Bảng so sánh**, xuất được XLS.
- **Điểm lệch cơ cấu** = tổng |% đạt − % mục tiêu| qua các loại căn. Thấp là tốt.

### 7.9 Công thức tính (bản đầu)
- **Mật độ xây dựng** = DT hợp các hình chiếu tòa (lấy theo DTXD đo được của mẫu tòa, xoay theo góc đặt) ÷ DT lô.
- **DT sàn tính HSSDĐ** = Σ (DT từng hạng mục × hệ số tính của hạng mục) − phần trừ theo căn.
- **HSSDĐ** = DT sàn tính HSSDĐ ÷ DT lô.
- **Dân số** = số căn × người/căn.
- **Chỗ đỗ cần** = số căn × chỗ/căn. **Cây xanh cần** = DT lô × % tối thiểu.
- **DT căn**: lấy nguyên từ `units.json` (thông thủy, tim tường, logia). Phần chung phân bổ = DT sảnh và hành lang của tầng chia theo tỷ lệ DT căn.
- **Màu chênh**: so phần chênh với ngưỡng đặt ở cấp Lô. Màu luôn đi kèm dấu và chữ, không chỉ dùng màu.

## 8. Giao diện

- Theo mockup 8 màn và LEO UI Kit (`E:\OneDrive\_SETUP\AI_Tool\_assets\leo-ui-kit\`).
- **Màu**: chỉ lấy từ biến `:root` của kit — xanh rêu `#174F52`, be `#B8B0A3`, nền `#F1F0EA`, panel `#FFFEFA`.
- **Chữ**: Segoe UI.
- **Dải màu loại căn**: Studio `#EFE9DA`, 1PN `#C9DCD3`, 2PN `#9CC0B4`, 2PN+ `#6C9C92`, 3PN `#3E6F70`.
- **Logo**: dùng PNG của kit, không vẽ lại. Khi đang xử lý dùng vòng O quay (`img.spin-o`), không dùng spinner tròn mặc định.
- **Chữ giao diện**: tách ra hai tệp `vi.json` và `en.json`, không viết thẳng chữ vào mã.
- Mỗi tiêu đề mục ở panel có **bong bóng giải thích** khi rê chuột.
- Ô trống hiện "0" hoặc "—", **không bao giờ** hiện "undefined" hay "NaN".

## 9. Các lựa chọn của tôi (anh kiểm khi đọc)

| Lựa chọn | Lý do |
|---|---|
| Vite + TypeScript + Preact; bản vẽ 2D bằng SVG; 3D bằng three.js | Nhẹ, chạy tĩnh trên Pages, dễ kiểm thử |
| Worker viết bằng Hono; D1 có 2 bảng: `du_an`, `phuong_an` (trạng thái PA lưu dạng JSON) | Đơn giản, nằm gọn trong gói miễn phí |
| Mã sửa lưu dạng băm (hash) trên máy chủ; mỗi lần ghi phải gửi kèm mã sửa | Không cần tài khoản mà vẫn chặn ghi đè |
| Nạp DXF trên trình duyệt (thư viện đọc DXF bằng JS); DWG phải đổi sang DXF trước | Web không đọc DWG trực tiếp được nếu không có máy chủ chuyển đổi |
| "Gợi ý xếp tòa" bản đầu là vét cạn có giới hạn (mẫu × góc × vị trí trên lưới), xếp hạng theo số căn và độ lệch cơ cấu | Làm nhanh, dễ hiểu; tối ưu thông minh hơn để bản sau |
| Hệ số tính DT sàn, ngưỡng màu, chỗ đỗ/căn: đặt giá trị mặc định tạm, ghi rõ trên giao diện là "chờ chủ nhiệm chốt" | Chưa có quy tắc chính thức |
| Kiểm DT căn: repo mới **không** chạy lại đối chiếu CAD. Script chép dữ liệu ghi commit nguồn + mã băm từng tệp, và test kiểm DT từng mẫu căn bằng đúng số đã qua `kiem_dt_can` ở repo cũ | Bước đối chiếu CAD cần DWG và bảng XREF, vốn nằm ngoài repo mới |
| Phần chung phân bổ: đo từ hình hành lang của mẫu tòa (`toa_dwg.json`) khi có; mẫu nào thiếu hình thì tính bằng chiều dài trục × rộng hành lang và gắn nhãn "ước tính" | Đúng §4: số ước tính phải ghi rõ |
| "Hợp lô" = mẫu tòa nằm trọn trong chỉ giới xây dựng ở ít nhất một góc xoay. Cảnh báo "lệch hướng" bỏ khỏi bản đầu | Tiêu chí hướng chưa có định nghĩa; giữ đơn giản |

### Chốt thêm ngày 27/10 (chủ nhiệm bảo "làm đi"; các mục có ghi "lựa chọn của tôi" là tôi đặt mặc định, anh đổi được)
- **Địa chỉ web: `unitmix.leo-ai.dev`** (tên miền riêng gắn vào Cloudflare Pages). Thư mục máy: `E:\Projects\Unitmix`.
- **Thư viện phải chuẩn hoá tên** khi chép sang: mã tòa và mã căn theo một quy tắc, tên hiển thị tiếng Việt có dấu, không còn tên trống hay tên trùng mã (vd `hn_tm_l3` hiện không có tên đọc được).
- Lựa chọn của tôi cho 4 câu còn mở, giữ bản đầu gọn:
  1. Đổi mẫu căn để bám cơ cấu: **chỉ đổi giữa các mẫu cùng bề ngang** trong ô mô-đun; xếp lại cả dãy căn (kiểu `donKhit`/QT-xx) để bản sau.
  2. Màn Căn bản đầu: **hiện nét vẽ + tổng DT căn và đổi mẫu**; diện tích từng phòng để khi bóc thêm dữ liệu phòng.
  3. Khối đế bản đầu: **đùn đúng chân tòa**, số tầng đế nhập tay, cao tầng mặc định 4,5 m (đế) và 3,3 m (điển hình), chỉnh được.
  4. Một PA **được trộn** tòa thương mại và nhà ở xã hội; chỉ tiêu và cơ cấu mục tiêu dùng chung cho lô.

## 10. Để người làm tự quyết

- Cấu trúc thư mục, cách quản lý trạng thái, thư viện vẽ biểu đồ.
- Cách tách tệp `unit_geometry.json` và `core_geometry.json` (theo mẫu, nén hay không).
- Thuật toán rải chỗ đỗ trong hầm, miễn là đếm đúng và không đè lõi hay cột.
- Kiểm thử: unit test cho mọi công thức ở §7.9, test API cho quyền sửa, test giao diện cho 8 màn ở hai ngôn ngữ.

## 11. Còn chờ chủ nhiệm chốt (không chặn việc bắt đầu)

1. % tính vào DT sàn mặc định cho logia, ban công, sảnh – hành lang, kỹ thuật – tum, hầm.
2. Ngưỡng màu mặc định cho lệch diện tích căn (đề xuất ±2 m²).
3. Chỗ đỗ ô tô / xe máy trên mỗi căn theo quy chuẩn áp dụng.
4. Các chức năng mặc định của khối đế.
