# QUY TẶC ĐẶT TÊN FILE CĂN HỘ — BẢN PHẲNG CHO AI

Nguồn chân lý: `XREF_CanHo_ChuanHoa.xlsx` (sheet `CH THƯƠNG MẠI`, `CH NOXH-TDC`, `QUY_TAC`).
Thư mục này là thư viện XREF căn hộ. Mọi thao tác đặt tên phải theo đúng quy tắc dưới đây.

## 1. CẤU TRÚC TÊN FILE

```
[loai_hinh]_[khu_vuc]_[loai_can]_[vi_tri]_[rong_x_dai].dwg
```

Regex kiểm tra:

```
^(chtm|chxh)_(hn|mn|pq)_(stu|1pn|1pnp|2pn|2pnp|3pn|3pnp|pen)_(m\d|g\d)_(\d{4})x(\d{4})\.dwg$
```

## 2. TỪ VỰNG CHUẨN (CHỈ DÙNG NHỮNG GIÁ TRỊ NÀY)

- `loai_hinh`: `chtm` = căn hộ thương mại | `chxh` = căn hộ xã hội / tái định cư
- `khu_vuc`: `hn` = Hà Nội | `mn` = Miền Nam | `pq` = Phú Quốc
- `loai_can`: `stu` `1pn` `1pnp` `2pn` `2pnp` `3pn` `3pnp` `pen`
- `vi_tri`: `m1` `m2` `m3`… = căn GIỮA | `g1` `g2` `g3`… = căn GÓC
- `kich_thuoc`: số nguyên mm, thứ tự `RỘNG x DÀI` (giống cột RỘNG, DÀI trong Excel), viết thường, không dấu cách
- Đuôi file: `.dwg`, kèm cặp `.dxe` cùng tên (KHÔNG bao giờ xóa `.dxe`)

Quy tắc chung: toàn bộ chữ thường, phân tách bằng `_`, KHÔNG khoảng trắng, KHÔNG dấu tiếng Việt, không ký tự đặc biệt ngoài `_` và `x`.

## 3. DANH MỤC TÊN CHUẨN HIỆN CÓ (registry)

```json
{
  "chtm": [
    "chtm_hn_1pn_m1_8500x6000.dwg",
    "chtm_hn_1pn_m2_8500x5800.dwg",
    "chtm_hn_1pn_m3_6600x6200.dwg",
    "chtm_hn_2pn_g1_8500x9000.dwg",
    "chtm_hn_2pn_m1_8500x7500.dwg",
    "chtm_hn_2pn_m2_8500x6000.dwg",
    "chtm_hn_2pnp_g1_8500x9000.dwg",
    "chtm_hn_2pnp_m1_8500x8800.dwg",
    "chtm_hn_3pn_g1_8500x13500.dwg",
    "chtm_hn_stu_m1_8500x4000.dwg"
  ],
  "chxh": [
    "chxh_hn_1pn_m1_6600x9000.dwg",
    "chxh_hn_1pn_m1_6600x6200.dwg",
    "chxh_hn_2pn_m1_7550x9330.dwg",
    "chxh_hn_2pn_m1_6600x9000.dwg",
    "chxh_hn_2pn_m2_7550x9725.dwg",
    "chxh_hn_2pnp_g1_7550x9725.dwg",
    "chxh_hn_2pnp_g2_7550x9725.dwg",
    "chxh_hn_3pn_m1_7550x9725.dwg",
    "chxh_hn_3pn_m2_7550x9725.dwg"
  ]
}
```

Tên mới PHẢI có trong registry trên. Nếu chưa có mà bản vẽ là thật thì: (1) bổ sung dòng mới vào
Excel trước, (2) mới đặt tên theo cấu trúc chuẩn.

## 4. BẢN ĐỒ TÊN CŨ → TÊN MỚI (legacy alias)

Khi gặp file cũ, suy ra tên mới theo bảng này rồi đối chiếu registry:

| Dấu hiệu tên cũ | Chuyển thành |
|---|---|
| tiền tố `chhn` | `chtm_hn` |
| tiền tố `xhhn` | `chxh_hn` |
| `2pn+` | `2pnp` |
| `t1` / `n1` | `m1` |
| `t2` / `y1` | `m2` |
| `t3` | `m3` |
| `g1` `g2` `g3` | giữ nguyên, nhưng đánh số lại theo registry nếu trùng kích thước |
| khoảng trắng trong tên | thay bằng `_` |

Ví dụ: `chhn_2pn+_n1_8500x8800.dwg` → `chtm_hn_2pnp_m1_8500x8800.dwg`.

Lịch sử đổi tên đợt 24/08/2026 đã áp dụng bảng trên cho toàn bộ 14 file trong thư mục này.

## 5. BLOCK THUỘC TÍNH TRONG TỪNG FILE

- Mỗi `.dwg` chứa block thuộc tính `DT-CAN` (1 insert ở ModelSpace).
- Tag `LOAICAN` = tên căn = tên file bỏ đuôi, viết HOA (vd file `chtm_hn_stu_m1_8500x4000.dwg` → `LOAICAN = CHTM_HN_STU_M1_8500X4000`). Khi đổi tên file phải cập nhật lại tag này cho khớp.
- Tag `DT-TIM`, `DT-TT` là diện tích tim / thông thủy — không thuộc phạm vi đặt tên, không tự ý sửa.
- Đợt 24/08/2026 đã đồng bộ `LOAICAN` theo tên mới cho cả 14 file.

## 6. LƯU Ý KHI LÀM VIỆC

1. File `.dxe` là cặp bắt buộc của `.dwg` cùng tên — đổi tên/copy phải làm cả hai, tuyệt đối không xóa (xem `!!File .dxe Không Xóa.txt`).
2. Đây là thư viện XREF: đổi tên file sẽ đứt tham chiếu ở các bản vẽ mẹ đang gọi nó — sau khi đổi tên phải repath XREF trong bản vẽ mẹ.
3. File đang mở trong AutoCAD (có `.dwl`) vẫn đổi được tên nhưng AutoCAD sẽ còn giữ tên cũ trong phiên — đóng bản vẽ KHÔNG lưu rồi mở lại bằng tên mới.
4. Kích thước ghi trong tên là dữ liệu bất biến của căn; không tự ý sửa số để "cho khớp" — nếu lệch với Excel thì bổ sung Excel.

## 7. TỆP CĂN ĐÃ STRETCH (QT-81 · 16/10/2026) — KHÔNG thuộc thư viện này

- Nằm ở thư mục **anh em** `data/dwg/x-canho-stretch/`, KHÔNG ở đây, không vào registry, không vào Git (`.gitignore`).
- Tên: `<tên tệp gốc bỏ đuôi>__s+300.dwg` / `__s-200.dwg` (hai gạch dưới, dấu, mức kéo mm — bước 100, tối đa ±500).
- Do AutoCAD sinh khi bấm **Đồng bộ CAD** (lệnh STRETCH trên bản sao, cửa sổ cắt = mọi thứ bên phải đường cắt phòng khách);
  tệp gốc trong thư mục này KHÔNG bị mở để sửa. Tag `LOAICAN` = tên tệp biến thể viết HOA; `DT-TIM` / `DT-TT` = diện tích đã kéo.
- Xoá thư mục `x-canho-stretch/` lúc nào cũng được — lần Đồng bộ CAD sau sinh lại. Tệp gốc mới hơn tệp biến thể thì sinh lại.
