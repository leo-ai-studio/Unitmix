# QUY TẮC ĐẶT TÊN FILE MẪU TOÀ — BẢN PHẲNG CHO AI

Phạm vi: `Cao tang/Ha Noi/x-mautoa-bt` và `Cao tang/Ha Noi/x-mautoa-tx`.
Nguồn chân lý: `XREF_MauToa_ChuanHoa.xlsx` (sheet `QUY_TAC`, `DOI_TEN_BT`, `DOI_TEN_TX`, `TON_DONG`).
Đối chiếu số liệu: `luu-tru/Bang tinh hieu suat.xlsx`.
Tài liệu chị em: `x-canho*/_QUY_TAC_TEN_FILE.md` (thư viện XREF căn hộ) — hai bộ dùng chung từ vựng `khu_vuc`.

Đây là thư viện XREF mẫu toà. Mọi thao tác đặt tên phải theo đúng quy tắc dưới đây.

## 1. CẤU TRÚC TÊN FILE

```
[loai_hinh]_[khu_vuc]_[hinh_khoi]_[dt_san]_[so_tang]t_[he_tuong].dwg
```

Regex kiểm tra:

```
^(mttm|mtxh)_(hn|mn|pq)_([iltuxyz]\d)_(\d{4})_(\d{2})t_(bt|tx)\.dwg$
```

Ví dụ: `mttm_hn_z1_2200_25t_bt.dwg`

## 2. TỪ VỰNG CHUẨN (CHỈ DÙNG NHỮNG GIÁ TRỊ NÀY)

- `loai_hinh`: `mttm` = mẫu toà thương mại | `mtxh` = mẫu toà nhà ở xã hội / tái định cư
- `khu_vuc`: `hn` = Hà Nội | `mn` = Miền Nam | `pq` = Phú Quốc (giống thư viện căn hộ)
- `hinh_khoi`: một chữ cái chỉ hình khối mặt bằng + một chữ số thứ tự phương án
  - `i` = khối chữ I (thanh đơn) | `l` = chữ L | `t` = chữ T | `u` = chữ U
  - `x` = chữ X (chữ thập) | `y` = chữ Y | `z` = chữ Z
  - Số: `1`, `2`, `3`… đánh tăng dần theo thứ tự phương án được duyệt
- `dt_san`: 4 chữ số, diện tích sàn tầng điển hình (m²), làm tròn 100 — PHẢI khớp `Bang tinh hieu suat.xlsx`
- `so_tang`: 2 chữ số + chữ `t` → `25t`. Chữ `t` là bắt buộc, để không nhập nhằng với `dt_san`
- `he_tuong`: `bt` = hệ vách/tường bê tông | `tx` = hệ tường xây
- Đuôi file: `.dwg`

Quy tắc chung: toàn bộ chữ thường, phân tách bằng `_`, KHÔNG khoảng trắng, KHÔNG dấu tiếng Việt,
KHÔNG ký tự `-`, không ký tự đặc biệt nào ngoài `_`.

## 3. KHÔNG CÓ HẬU TỐ TỰ DO

Đây là điểm siết chặt so với cách đặt tên cũ.

- CẤM tên người trong tên file (`-chiLinh`, `-anhNam`…). Bản làm riêng của cá nhân không thuộc
  thư viện XREF — chuyển sang `luu-tru`.
- CẤM mã dự án / mã khối trong tên file (`_GL-KD`…). Thư viện này chỉ chứa mẫu điển hình;
  biến thể riêng của một dự án nằm trong thư mục dự án đó.
- Một phương án thiết kế thật = MỘT SỐ MỚI trong `hinh_khoi` (`z2` → `z3`), không phải một cái đuôi mới.
- CẤM đuôi `_rev`, `_final`, `_moi`, `_ok`, `_sua`. Lịch sử phiên bản do `luu-tru` giữ.

## 4. `he_tuong` BẮT BUỘC NẰM TRONG TÊN FILE

Trước đây `bt` / `tx` chỉ nằm ở tên thư mục, nên 19 file trong `x-mautoa-bt` trùng tên y hệt 19 file
trong `x-mautoa-tx`. Hậu quả: XREF cả hai vào một bản vẽ mẹ là đụng tên, và mở song song trong
cùng một phiên AutoCAD sẽ nhầm file. Từ nay `_bt` / `_tx` là thành phần bắt buộc của tên file.

## 5. DANH MỤC TÊN CHUẨN (registry)

Bộ `mttm` — mẫu toà thương mại, Hà Nội, 25 tầng:

```
mttm_hn_i1_2000_25t_{bt|tx}.dwg
mttm_hn_l1_2000_25t_{bt|tx}.dwg
mttm_hn_l2_2000_25t_{bt|tx}.dwg
mttm_hn_t1_2000_25t_{bt|tx}.dwg
mttm_hn_t2_2000_25t_{bt|tx}.dwg
mttm_hn_u1_2200_25t_{bt|tx}.dwg
mttm_hn_u2_2000_25t_{bt|tx}.dwg
mttm_hn_u3_2000_25t_{bt|tx}.dwg
mttm_hn_u4_2000_25t_{bt|tx}.dwg
mttm_hn_x1_2000_25t_{bt|tx}.dwg
mttm_hn_y1_2200_25t_{bt|tx}.dwg
mttm_hn_z1_2200_25t_{bt|tx}.dwg
mttm_hn_z2_2000_25t_{bt|tx}.dwg
mttm_hn_z3_2000_25t_{bt|tx}.dwg
```

Bộ `mtxh` — mẫu toà NOXH / tái định cư, Hà Nội, 25 tầng:

```
mtxh_hn_i1_2000_25t_{bt|tx}.dwg
mtxh_hn_u1_2000_25t_{bt|tx}.dwg
mtxh_hn_z1_2000_25t_{bt|tx}.dwg
mtxh_hn_z2_2000_25t_{bt|tx}.dwg
mtxh_hn_z3_2000_25t_{bt|tx}.dwg
```

Tên mới PHẢI có trong registry trên. Nếu chưa có mà bản vẽ là thật thì: (1) bổ sung dòng mới vào
`XREF_MauToa_ChuanHoa.xlsx` và `Bang tinh hieu suat.xlsx` trước, (2) mới đặt tên theo cấu trúc chuẩn.

## 6. BẢN ĐỒ TÊN CŨ → TÊN MỚI (legacy alias)

Khi gặp file cũ, suy ra tên mới theo bảng này rồi đối chiếu registry:

| Dấu hiệu tên cũ | Chuyển thành |
|---|---|
| tiền tố `hn_tm_` | `mttm_hn_` |
| tiền tố `hn_xh_` | `mtxh_hn_` |
| số tầng trần `_25` | `_25t` |
| thiếu hệ tường | thêm `_bt` hoặc `_tx` theo thư mục đang chứa file |
| hậu tố tên người `-chiLinh` | bỏ hẳn; nếu là bản phương án thật thì cấp số mới trong `hinh_khoi` |
| hậu tố mã dự án `_GL-KD` | bỏ hẳn; nếu là phương án thật thì cấp số mới trong `hinh_khoi` |
| `dt_san` ghi `2000` nhưng Excel hiệu suất ghi khác | lấy theo Excel hiệu suất |
| ký tự `-` bất kỳ | thay bằng `_` hoặc bỏ |
| chữ hoa | chuyển hết về chữ thường |

Ví dụ: `hn_tm_z2_2000_25_GL-KD.dwg` → `mttm_hn_z3_2000_25t_bt.dwg`
Ví dụ: `hn_xh_i1_2000_25.dwg` → `mtxh_hn_i1_2000_25t_bt.dwg`

Bảng đổi tên đầy đủ cho từng file: xem sheet `DOI_TEN_BT` / `DOI_TEN_TX` trong
`XREF_MauToa_ChuanHoa.xlsx`.

## 7. BỐN ĐIỂM CÒN CHỜ XÁC NHẬN (chưa được tự ý đổi tên)

Xem sheet `TON_DONG`. Tóm tắt:

1. `dt_san` của `u1`, `y1`, `z1`: tên file ghi `2000`, Excel hiệu suất ghi `2200`, GFA thực đo được
   lần lượt là 2261 / 2324 / 1678 m². Phải chốt `dt_san` nghĩa là gì (GFA thực làm tròn, hay
   nhóm quy mô danh nghĩa) rồi mới rà lại cả bộ.
2. `hn_tm_u3_2000_25-chiLinh.dwg`: là bản `u3` chính thức hay bản làm riêng của cá nhân?
   Nếu là bản riêng thì chuyển sang `luu-tru`, không giữ trong thư viện XREF.
3. `_GL-KD` trong `hn_tm_u4_...` và `hn_tm_z2_...`: viết tắt của gì? Nếu là biến thể theo một
   dự án cụ thể thì không thuộc thư viện điển hình.
4. `bt` = bê tông, `tx` = tường xây: suy ra từ thư mục `Chuan hoa/Chuan hoa tuong xay`,
   chưa xác nhận được từ nội dung bản vẽ.

## 8. LƯU Ý KHI LÀM VIỆC

1. Đây là thư viện XREF: đổi tên file sẽ đứt tham chiếu ở các bản vẽ mẹ đang gọi nó — sau khi
   đổi tên PHẢI repath XREF trong bản vẽ mẹ.
2. Nếu trong `.dwg` có block thuộc tính ghi tên mẫu toà (tương tự tag `LOAICAN` bên thư viện
   căn hộ) thì đổi tên file phải cập nhật lại tag cho khớp.
3. File đang mở trong AutoCAD (có `.dwl`) vẫn đổi được tên nhưng AutoCAD còn giữ tên cũ trong
   phiên — đóng bản vẽ KHÔNG lưu rồi mở lại bằng tên mới.
4. Không để `.bak` trong thư mục thư viện XREF — xoá hoặc dồn vào `luu-tru`.
5. Số tầng và diện tích sàn ghi trong tên là dữ liệu của mẫu toà; không tự ý sửa số để "cho khớp"
   — nếu lệch với Excel thì sửa Excel trước.
6. Thư viện căn hộ bắt buộc mỗi `.dwg` có cặp `.dxe` cùng tên. Thư mục mẫu toà hiện KHÔNG có
   file `.dxe` nào — cần xác nhận mẫu toà có yêu cầu này không.
