# Nhật ký làm việc (mới nhất ở trên)

Mỗi đợt một mục: ngày, ai làm, đã làm gì (kèm commit), kiểm thế nào, còn dở gì. Ngắn, đủ để phiên sau làm tiếp không phải dò lại.

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
