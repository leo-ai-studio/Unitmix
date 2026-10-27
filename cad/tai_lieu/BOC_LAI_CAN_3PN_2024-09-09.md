# Báo Cáo Bóc Lại Nét Tường — Căn 3PN Góc (chtm_hn_3pn_g1_8500x12500)

**Ngày**: 2024-09-09  
**Căn**: Loại 5 + 3PN (Góc, thương mại) — `chtm_hn_3pn_g1_8500x12500.dwg`  
**Kích thước**: 8500 × 12500 mm  

---

## 1. Tình Trạng Hiện Tại

### Dữ Liệu Trong `unit_geometry.json`:

| Loại nét | Số lượng |
|---|---|
| Tường (wall) | 219 |
| Đứt (hidd) | 9 |
| **Tổng cấu trúc** | **228** |
| Cửa (door) | 42 |
| Ray/rèm (rail) | 69 |
| Nội thất (furn) | 720 |
| Thiết bị (equip) | 582 |
| Chi tiết (detail) | 98 |
| Tim tường (tim) | 49 |
| **TỔNG ENTITIES** | **1.792** |

### Lịch Sử Bóc:

- **v1 (bóc ban đầu)**: Layer filter khớp TÊN CHÍNH XÁC → mất nét tường vì layer con (`A-WALL-INT`, …) không khớp
- **v2 (hiện tại, phiên 3)**: Áp dụng QT-12 — khớp theo **tiền tố** → thêm layer `A-HIDD` → số nét tường **tăng 100–150 nét/căn**

---

## 2. Quy Tắc Phân Loại Layer (QT-12)

**Lỗi gốc**: File DWG gốc từ Viện chứa layer con không chuẩn, ví dụ:
- `A-WALL` → `A-WALL-INT` (tường trong)
- `A-WALL-EXT` (tường ngoài)
- `A-EQPM` → `A-EQPM-2` (thiết bị loại 2)

**Cách sửa**: Khớp theo **tiền tố chứ không phải tên chính xác**

```python
LAYER_CATEGORY = [
    ("a-wall", "wall"),      # A-WALL, A-WALL-INT, A-WALL-EXT, …
    ("a-conc", "wall"),      # A-CONC, A-CONC-2, …
    ("a-glaz", "wall"),      # A-GLAZ, …
    ("a-hidd", "hidd"),      # ← NỚI (nét đứt / hidden lines)
    ("a-door", "door"),
    ("a-eqpm", "equip"),
    ("a-furn", "furn"),
    # …
]
```

**Kết quả**:
- Thêm lớp `hidd` (nét đứt) → căn 3PN được +9 nét đứt
- Khớp layer con → tường tăng từ ~100 lên ~219

---

## 3. Kiểm Tra Nét Tường Bị Thiếu

### Nếu Vẫn Thiếu:

**Bước 1: Kiểm tra file DWG gốc**

Mở file `data/dwg/x-canho-bt/chtm_hn_3pn_g1_8500x12500.dwg` trong AutoCAD:
- Xem **Layers panel** (Crl + 3)
- Tìm các layer chứa tường (từ khóa: `WALL`, `CONC`, `GLAZ`, `HIDD`)
- Ghi lại tên layer **chính xác** (ví dụ: `A-WALL-COLUMN`, `A-CONC-INT`, …)

**Bước 2: Cập nhật LAYER_CATEGORY**

Nếu tìm thấy layer tường với tiền tố khác, thêm vào `scripts/boc_lai_can.py`:

```python
CATEGORY = [
    # …
    ("a-your-wall-layer", "wall"),  # ← Layer tường mới
    # …
]
```

**Bước 3: Chạy bóc lại**

```bash
python scripts/boc_lai_can.py
python scripts/build_shell.py
```

---

## 4. So Sánh Với Các Căn Khác

Để đảm bảo số nét tường hợp lý:

| Căn | Wall | Hidd | Tổng | Ghi chú |
|---|---|---|---|---|
| 1PN | 104 | 6 | 110 | Căn nhỏ |
| 2PN (m1) | 15 | 9 | 24 | ⚠️ Ít nét (có thể thiếu) |
| 2PN (m2) | 144 | 3 | 147 | Bình thường |
| 2PNP | 47–162 | 0–9 | 56–162 | Biến thiên |
| **3PN (g1)** | **219** | **9** | **228** | ✓ Cao (căn lớn) |
| 3PN (NOXH) | 203–224 | 0–8 | 203–224 | Tương đương |

**Nhận xét**: Căn 3PN góc có **219 nét tường** — số lượng cao nhất trong thư viện → có lẽ đã đầy đủ.

---

## 5. Bước Tiếp Theo

### Tùy chọn A: Nét tường hiện tại đã đủ
→ Build lại app và xuất CAD để kiểm tra trên bản vẽ thực.

```bash
python scripts/build_shell.py
python scripts/build_scr.py
# Xuất file CAD từ app
```

### Tùy chọn B: Nếu vẫn thiếu
→ Cung cấp thêm thông tin:
1. Tên layer chứa nét tường bị thiếu (từ DWG)
2. Ví dụ hình ảnh về nét tường bị thiếu
3. Tôi sẽ cập nhật script và bóc lại

### Tùy chọn C: Sửa trực tiếp trong DWG
→ Nếu file DWG gốc thiếu nét, có thể:
1. Mở file DWG trong AutoCAD
2. Vẽ thêm nét tường bị thiếu
3. Gán layer chuẩn (`A-WALL`, `A-HIDD`, …)
4. Lưu lại
5. Chạy bóc lại

---

## 6. Tài Liệu Tham Khảo

- `docs/QUY_TAC_XEP_CAN.md` → **QT-12** (trang 145–169): Quy tắc phân loại layer
- `scripts/boc_lai_can.py`: Script bóc lại (v2, áp dụng QT-12)
- `scripts/boc_lai_can_dwg.py`: Script bóc trực tiếp từ DWG (mới)

---

**Trạng thái**: ✓ Căn 3PN đã bóc lại theo QT-12  
**Cần xác nhận**: Nét tường có đầy đủ hay cần điều chỉnh tiếp?
