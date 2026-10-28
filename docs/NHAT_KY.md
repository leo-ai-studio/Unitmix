# Nhật ký làm việc (mới nhất ở trên)

Mỗi đợt một mục: ngày, ai làm, đã làm gì (kèm commit), kiểm thế nào, còn dở gì. Ngắn, đủ để phiên sau làm tiếp không phải dò lại.

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
