# QUY TẮC ĐẶT TÊN FILE XREF LÕI THANG / THANG BỘ — BẢN PHẲNG CHO AI

Nguồn chân lý: `XREF_Thang_ChuanHoa.xlsx` (sheet `LOI_THANG`, `THANG_BO`, `MAP_TEN`, `QUY_TAC`, `TAC_DONG`).
Thư mục này là thư viện XREF lõi thang máy + hộp kỹ thuật và thang bộ thoát nạn cho các tòa mẫu
trong `data/dwg/x-mautoa-bt/`. Mọi thao tác đặt tên phải theo đúng quy tắc dưới đây.

> Trạng thái: **ĐÃ ÁP DỤNG ngày 2026-10-01** trên `M:\...\Cao tang\Ha Noi\x-thang\` — đã đổi tên
> 22 file lõi + 2 file thang bộ, xoá `x_tmkt_xh_i1.dwg`, repath XREF 60 file tòa mẹ trong
> `x-mautoa-bt\` và `x-mautoa-tx\` (kiểm lại: 561 xref, 0 đứt).
> Tên **xref** (Reference Name) trong 60 file tòa mẹ cũng đã đổi khớp tên file (vd `x_tmkt_i1` →
> `x_tmdv_i1_tm_09`, `x_tb_n3_8500x2610` → `x_tb_n3`), kèm layer phụ thuộc `<xref>|<layer>`.
> Chưa làm (thuộc repo app): sửa `core_geometry.json` / `toa_dwg.json` + build lại.

## 1. CẤU TRÚC TÊN FILE (QUY TẮC MỚI — 2026-09-08)

**Lõi thang máy:**

```
x_<loại hình>_<mẫu tòa>_tm_<số thang máy>
```

Ví dụ: `x_tmdv_z1_tm_08`

**Lõi thang bộ:**

```
x_tb_<loại thang>
```

Ví dụ: `x_tb_n3`

## 2. TỪ VỰNG CHUẨN (CHỈ DÙNG NHỮNG GIÁ TRỊ NÀY)

- `loại hình`:
  - `tmdv` = thương mại dịch vụ (bản thương mại)
  - `xh`   = nhà ở xã hội / tái định cư
- `mẫu tòa`: mã tòa gốc, chữ thường — `i1` `l1` `l2` `t1` `t2` `u1` `y1` `z1` …
- `tm`: ký hiệu cố định đánh dấu khối lõi thang máy (giữ nguyên trong mọi tên).
- `số thang máy`: **tổng số thang máy khách + thang máy PCCC** trong lõi, định dạng 2 chữ số
  (`01`, `02` … `08` …).
  - **Cách đếm (bắt buộc dùng CAD, không đếm bằng mắt qua ảnh)**: mở file `.dwg` bằng AutoCAD,
    đếm số block tham chiếu `x_loithangmay` (thang khách) cộng với số block
    `THANG TẦNG DH..._tm1400x2100...` có kích thước thực tế **~2400×2400 mm** (thang PCCC).
  - Bỏ qua block cùng tên nhưng kích thước bất thường nhỏ (< 1200 mm mỗi chiều) — đó là ký hiệu
    chú thích/nhãn, không phải lõi thang thật.
  - File vẽ kiểu mới (v1, v2, y2, y1 XH, z2…, không có `x_loithangmay`): mỗi block
    `THANG TẦNG DH..._tm1700x1700...` = 1 thang khách, mỗi block `..._tm1400x2100...` = 1 thang PCCC,
    không xét kích thước bao (2160×2300, 2682×2781, 2952×2876… đều tính).
- `loại thang` (thang bộ): mã loại thang theo QCVN 06 — hiện chỉ có `n3` (thang N3 điều áp).

Quy tắc chung: toàn bộ chữ thường, phân tách bằng `_`, KHÔNG khoảng trắng, KHÔNG dấu tiếng Việt,
KHÔNG chữ hoa, không ký tự đặc biệt ngoài `_`. Không dùng `-` (gạch ngang) trong tên.
Tên KHÔNG còn chứa kích thước `RONGxSAU` (khác quy tắc cũ) — kích thước tra ở cột riêng trong Excel.

## 3. DANH MỤC TÊN CHUẨN (registry — đếm lại qua AutoCAD ngày 2026-10-01, đã đổi tên thật)

### Lõi thang máy

| Tên cũ | Mẫu tòa | Thang khách | PCCC | Tổng TM | TÊN HIỆN TẠI |
|---|---|---|---|---|---|
| `x_tmkt_i1.dwg` | i1 | 8 | 1 | 9 | `x_tmdv_i1_tm_09` |
| `x_tmkt_i2.dwg` | i2 | 3 | 1 | 4 | `x_tmdv_i2_tm_04` |
| `x_tmkt_l1.dwg` | l1 | 6 | 1 | 7 | `x_tmdv_l1_tm_07` |
| `x_tmkt_l2.dwg` | l2 | 6 | 1 | 7 | `x_tmdv_l2_tm_07` |
| `x_tmkt_l3.dwg` | l3 | 6 | 1 | 7 | `x_tmdv_l3_tm_07` |
| `x_tmkt_t1.dwg` | t1 | 9 | 1 | 10 | `x_tmdv_t1_tm_10` |
| `x_tmkt_t2.dwg` | t2 | 11 | 2 | 13 | `x_tmdv_t2_tm_13` |
| `x_tmkt_u1.dwg` | u1 | 4 | 1 | 5 | `x_tmdv_u1_tm_05` |
| `x_tmkt_v1.dwg` | v1 | 5 | 1 | 6 | `x_tmdv_v1_tm_06` |
| `x_tmkt_v2.dwg` | v2 | 5 | 1 | 6 | `x_tmdv_v2_tm_06` |
| `x_tmkt_y1.dwg` | y1 | 9 | 2 | 11 | `x_tmdv_y1_tm_11` |
| `x_tmkt_y2.dwg` | y2 | 6 | 1 | 7 | `x_tmdv_y2_tm_07` |
| `x_tmkt_z1.dwg` | z1 | 7 | 1 | 8 | `x_tmdv_z1_tm_08` |
| (đã đúng tên) | z2 | 3 | 1 | 4 | `x_tmdv_z2_tm_04` |
| `x_tmkt_i1_noxh.dwg` | i1 (bản XH) | 3 | 0 | 3 | `x_xh_i1_tm_03` |
| `x_tmkt_l1.noxh.dwg` | l1 (bản XH) | 7 | 1 | 8 | `x_xh_l1_tm_08` |
| `x_tmkt_y1_noxh.dwg` | y1 (bản XH) | 6 | 1 | 7 | `x_xh_y1_tm_07` |
| `x_tmkt_Z1_noxh.dwg` | z1 (bản XH) | 3 | 0 | 3 | `x_xh_z1_tm_03` |
| `x_tmkt_z2_noxh.dwg` | z2 (bản XH) | 3 | 1 | 4 | `x_xh_z2_tm_04` |
| `x_tmkt_z3_noxh.dwg` | z3 (bản XH) | 3 | 1 | 4 | `x_xh_z3_tm_04` |
| `x_tmkt_z4_noxh.dwg` | z4 (bản XH) | 3 | 0 | 3 | `x_xh_z4_tm_03` |
| `x_tmkt_z5_noxh.dwg` | z5 (bản XH) | 7 | 0 | 7 | `x_xh_z5_tm_07` |

### Lõi thang bộ

```
x_tb_n3.dwg     ← mọi tòa mẹ   (cũ: x_tb_n3_8500x2610.dwg)
x_tb_n1.dwg     ← chưa tòa nào xref   (cũ: x_tb_n1_.dwg)
```

## 4. FILE TRÙNG NỘI DUNG — ĐÃ XỬ LÝ 2026-10-01

| File | Xử lý |
|---|---|
| `x_tmkt_xh_i1.dwg` | **ĐÃ XOÁ** — trùng `x_tmdv_i1_tm_09`, không tòa nào tham chiếu. |
| `x_tmkt_i1_noxh.dwg` | **KHÔNG GỘP** — chủ nhiệm chốt giữ là lõi riêng → `x_xh_i1_tm_03` (dùng cho `mtxh_hn_i1`). |

## 5. FILE NGOÀI PHẠM VI

| File | Thực chất | Xử lý |
|---|---|---|
| `x-kt-vtk-a1.dwg` | Khung tên khổ A1 (840×594), khối tên "TKĐH CAO TẦNG - MIỀN BẮC", có 1 đối tượng OLE nhúng. Không phải mặt bằng lõi. | Đổi tên `x_khungten_vtk_a1.dwg`, chuyển sang `data/dwg/_khung-ten/`. **Đang được xref vào 5 file tòa** (hn_tm_u1, hn_tm_z1, hn_xh_u1, hn_xh_i1, hn_xh_z1) → phải repath 5 file đó, hoặc chấp nhận đứt xref (app không cần khối này). |

## 6. LƯU Ý KHI ĐỔI TÊN (đợt 2026-10-01 đã làm mục 1; mục 2 còn chờ)

1. **Đây là thư viện XREF.** Đổi tên file ⇒ đứt tham chiếu trong các `..\x-mautoa-bt\*.dwg` /
   `..\x-mautoa-tx\*.dwg` gọi nó. ✅ Đã repath 60 file ngày 2026-10-01, đường dẫn chuẩn hoá về
   dạng tương đối `..\x-thang\<tên mới>.dwg`. Một số file tòa mẹ (vd `mttm_hn_l1/l2_tx`,
   `mttm_hn_u1_bt`, `mtxh_hn_i1/z2_tx`) trỏ sang thư mục khác `Cao tang\block\` — chưa động tới.
   File mới thêm vào thư viện phải theo tên chuẩn ngay từ đầu.
2. **(Repo app — CHƯA LÀM) Khoá 3 nơi cùng lúc, nếu không selfTest sẽ đỏ:**
   - `data/master/core_geometry.json` — đổi KEY khối (vd `"x_tmkt_i1"` → `"x_tmdv_i1_tm_09"`).
   - `data/master/toa_dwg.json` — đổi `ten_block_loi[]`, và mọi `mat[].phan_tu[].block` + `ma_thu_vien` của phần tử `loai:"loi"`.
   - `python scripts/build_shell.py` build lại, rồi `selfTest()` phải về **311 mục / 1 fail** (chỉ QT-17).
3. **Tên block bên trong từng file .dwg** hiện cũng lộn xộn (`s1_thangmay_l2`, `x_tm1_kt_i1`,
   `s1_kt_z1`…) — KHÔNG bắt buộc sửa đợt này, ghi nhận để làm sau.
4. Số thang máy trong tên là dữ liệu đếm trực tiếp từ CAD; nếu lệch với thực tế thi công thì đếm
   lại theo mục 2 phía trên, không tự ý sửa số cho "tròn".
5. Đổi tên khi file đang mở trong AutoCAD (có `.dwl`): đóng KHÔNG lưu rồi mở lại bằng tên mới.

## 7. BẢN ĐỒ TÊN CŨ → MỚI (legacy alias)

| Dấu hiệu tên cũ | Chuyển thành |
|---|---|
| tiền tố `x_tmkt_` | `x_tmdv_` hoặc `x_xh_` (tuỳ loại hình thực tế) |
| chữ hoa trong tên (`Z1`) | chữ thường (`z1`) |
| hậu tố `_noxh` | tiền tố loại hình `xh_` |
| hậu tố `.noxh` (dấu chấm, `x_tmkt_l1.noxh`) | như `_noxh` → `x_xh_` |
| infix `xh_` (`x_tmkt_xh_i1`) | GỘP về bản `tmdv` tương ứng nếu trùng khối |
| `_` thừa cuối tên (`x_tb_n1_`) | bỏ (`x_tb_n1`) |
| hậu tố kích thước `_RONGxSAU` | **bỏ hẳn** — không còn kích thước trong tên, thay bằng `_tm_<số thang máy>` |
| tiền tố `x-` + gạch ngang (`x-kt-vtk-a1`) | không thuộc thư viện thang — chuyển ra `data/dwg/_khung-ten/` |
| `x_tb_n3_8500x2610.dwg` | `x_tb_n3.dwg` |

Ví dụ: `x_tmkt_Z1_noxh.dwg` → `x_xh_z1_tm_03.dwg`.
Ví dụ: `x_tmkt_z1.dwg` → `x_tmdv_z1_tm_08.dwg`.
