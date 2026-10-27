# Bóc bản vẽ CAD sang app web — cách làm và 12 cái bẫy đã cắn thật

Tài liệu này rút từ **MDI_Unitmix**: app đọc bản vẽ mặt bằng của Viện Thiết kế
MEYGROUP rồi vẽ lại trên web, cho kéo thả và kiểm QCVN. Mọi con số dưới đây là
**số đo thật trên dự án đó**, không phải ví dụ bịa.

Dùng khi bạn cần: lấy hình học từ `.dwg` → hiển thị trên trình duyệt → cho người
dùng thao tác → xuất ngược ra DXF/Excel.

---

## 1. Chuỗi 5 chặng

```
DWG  ──①──►  DXF  ──②──►  JSON  ──③──►  HTTP  ──④──►  SVG trong trình duyệt
     IronPython      Python          FastAPI        JavaScript thuần
     + AutoCAD .NET  + ezdxf
```

| Chặng | Công cụ | Lý do chọn |
|---|---|---|
| ① Trích | **IronPython** chạy *trong* AutoCAD, gọi `Autodesk.AutoCAD.DatabaseServices` | **ezdxf không đọc được `.dwg`.** Không có đường vòng nào rẻ hơn. Dùng *side database* (`Database.ReadDwgFile`) để không đụng phiên làm việc của người dùng |
| ② Bóc | **Python + ezdxf** | Làm phẳng cung/spline, duyệt block đệ quy, lọc layer — thư viện thuần Python, chạy được trong CI |
| ③ Phục vụ | **FastAPI + Pydantic** | Model dữ liệu có kiểu, tự sinh OpenAPI |
| ④ Vẽ | **JavaScript thuần + SVG inline** | Không framework, không bundler. SVG vector nên zoom sâu không vỡ nét và click chọn được từng đối tượng |

**Đừng dùng** three.js/WebGL nếu bài toán là mặt bằng 2D — nó bắt bạn dựng lại
hình, trong khi thứ bạn có sẵn là nét vẽ đã đúng. Cũng đừng dùng canvas bitmap:
mất khả năng chọn đối tượng và mất độ nét khi zoom.

---

## 2. Mười hai cái bẫy

Mỗi cái dưới đây đều đã làm hỏng sản phẩm ít nhất một lần, và mỗi cái đều mất
thời gian mới tìm ra. Đọc trước sẽ tiết kiệm được nhiều giờ.

### 2.1 · XREF chưa giải thì KHÔNG có hình học

Bản vẽ tổ hợp thường lắp bằng XREF. Đọc bằng side database mà không giải thì
**mọi `BlockReference` đều ném exception ở `GeometricExtents`**, định nghĩa block
chỉ còn một dòng text `"Xref ..\block\x.dwg"`.

```python
d = Database(False, True)
d.ReadDwgFile(path, FileShare.Read, True, "")
d.ResolveXrefs(True, False)      # ← thiếu dòng này là mất sạch hình học
```

Đo trên dự án: **trước 0 %, sau 100 %** (43/43 insert của một mặt bằng).

Nếu file XREF không có trên máy (ổ mạng chưa mount) thì vẫn dựng lại được từ
**tên block + điểm chèn + góc quay + dấu hệ số tỷ lệ** — xem mục 4.

### 2.2 · Block động: entity mang cờ `invisible`

Cửa thường là **dynamic block**. Một block cửa có 36 entity thì **30 mang cờ
`invisible=1`** — đó là các trạng thái hiển thị không được chọn (mở trái, mở
phải, trượt, góc mở khác). AutoCAD chỉ vẽ 6 cái còn lại.

`virtual_entities()` trả về **cả 36**. Không lọc thì một ô cửa vẽ ra 5–6 cánh
chồng lên nhau.

```python
if getattr(e.dxf, "invisible", 0):
    return          # INSERT bị ẩn thì cả cây con cũng không được vẽ
```

Kết quả: nét cửa một căn 1PN từ **128 → 37**.

### 2.3 · MLINE không có đường dẫn hình học

`ezdxf.path.make_path()` không xử lý được **MLINE** (multiline — cách vẽ tường
phổ biến). Phải nổ ra LINE:

```python
NO_RA = {"MLINE"}
if t == "INSERT" or t in NO_RA:
    for c in e.virtual_entities():
        yield from duyet(c, ...)
```

Bỏ sót: **9/12 căn mất sạch nét tường**, kéo theo mất luôn mốc chuẩn hoá.

### 2.4 · Tên layer bị XREF bind làm méo

AutoCAD bind XREF thì đổi tên layer thành `<tên xref>$0$<layer gốc>`, **lồng
nhiều lớp**:

```
250602-MB CO CAU CĂN HO X1-3A-1$0$B5-CT02_L31$0$CDC-KT-ki hieu 2
```

Tra bảng phân loại bằng tên đầy đủ là trượt hết. Cắt phần sau dấu `$0$` cuối:

```python
def ten_layer(l): return l.rsplit("$0$", 1)[-1].strip() if "$0$" in l else l
```

### 2.5 · Bộ lọc theo TỶ LỆ điểm giết chết đoạn thẳng 2 điểm

Để loại nét của đối tượng bên cạnh, ta hay lọc "≥65 % số điểm nằm trong khung".
Nhưng MLINE nổ ra thành **LINE 2 điểm**, mà tường biên là tường *chung* nên một
đầu luôn nằm ngoài khung → tỷ lệ chỉ 50 % → **bị loại sạch**.

```python
if len(raw) <= 4:
    return trong(diem_giua(raw))        # đường ngắn: xét ĐIỂM GIỮA
return so_diem_trong(raw) >= len(raw) * 0.65
```

### 2.6 · Kẹp toạ độ về [0,1] làm mất tường

Module ghi trong tên file thường là kích thước **tim tường**; tường nằm *vượt ra
ngoài* module (tường hành lang ở `y = −169…−19 mm`). Kẹp `max(0, min(1, …))` ép
cả bảng tường về một đường `y = 0` rồi bị loại vì suy biến → **mất nét thấy
tường**.

Giữ giá trị âm, chỉ lọc theo lề (±400 mm).

### 2.7 · Bản vẽ có thể LỆCH so với module

Đây là cái tinh vi nhất. Cả bản vẽ căn hộ lệch **−169 mm** về phía hành lang:
tường hành lang ở `−169…−19`, tường mặt ngoài kết thúc ở `sâu − 169`. Bề sâu
chiếm chỗ thì đúng bằng module.

Chuẩn hoá theo module → trên mặt bằng **thừa một dải 169 mm ở mặt ngoài** và
**thiếu nét tường hành lang**.

**Cách đúng: chuẩn hoá theo chính MÉP TƯỜNG** — `[y_min_tường, y_max_tường] →
[0, 1]`. Sau khi sửa, cả 14 mẫu đều cho `y_tường = 0,0000 … 1,0000`.

Chỉ làm với **một trục**. Trục còn lại tường biên là tường *chung* với đối tượng
kề bên, bản vẽ nào cũng vẽ trọn 250 mm nên chuẩn hoá theo nó sẽ **bóp cả mặt
bằng lại 4 %**.

### 2.8 · Gốc toạ độ block ≠ góc ô chứa

Đừng giả định điểm chèn nằm ở góc trên-trái của đối tượng. Đo thật:

| block | bbox so với điểm chèn |
|---|---|
| lõi thang i1 | x từ **−8.915** đến 3.000 mm — chèn ở đầu **phải** |
| lõi thang y1 | x từ −9.790 đến 9.790 mm — chèn ở **giữa** |
| thang bộ | có bản đặt **mirror `sx = −1`** |

Neo theo mép ô và bỏ qua `sx` → nét lệch 8,9 m, rơi đè lên đối tượng khác. Phải
lưu riêng `chen_lech_mm`, `chen_sx/sy`, `chen_rot`.

### 2.9 · Chuẩn hoá [0,1] hay giữ milimet?

Quy tắc quyết định:

- **Chuẩn hoá `[0,1]`** khi đối tượng được *đặt lại kích thước* theo ô chứa
  (căn hộ đặt vào nhiều vị trí khác nhau). Dữ liệu gọn, đặt đâu cũng vừa.
- **Giữ milimet cục bộ** khi đối tượng *kéo di chuyển được*. Kéo chỉ là phép
  tịnh tiến — nét không bị kéo giãn, không phải tính lại tỷ lệ.

### 2.10 · IronPython: ba lỗi vặt tốn thời gian

```python
File.WriteAllText(OUT, json.dumps(d, ensure_ascii=False), Encoding.UTF8)
```

- **Phải ghi bằng `Encoding.UTF8`.** `open()` của IronPython encode theo codepage
  hệ thống, **vỡ ngay khi gặp tiếng Việt** (`Unable to translate Unicode
  character`).
- Exception giữa chừng làm **rò file handle** → lần sau báo *"file is being used
  by another process"* **kể cả khi file rỗng**. Ghi ra thư mục tạm rồi copy vào
  repo, đừng ghi thẳng vào thư mục OneDrive.
- API không thống nhất: `MText` dùng `.Location`, `DBText` dùng `.Position`;
  `Table` dùng `e.Rows.Count` chứ không phải `e.Rows`.

### 2.11 · Server cũ giữ cổng và trả dữ liệu cache

Dừng background task chạy `uvicorn` thì **tiến trình con vẫn sống và giữ cổng**.
Lần khởi động lại báo `[Errno 10048] bind` rồi thoát, còn `curl /api/health`
**vẫn trả 200** — từ server CŨ, với dữ liệu đã `lru_cache` từ trước.

Đã hai lần suýt nghiệm thu nhầm. Trước khi khởi động lại:

```powershell
Get-NetTCPConnection -LocalPort 8765 -State Listen |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

Và **kiểm bằng một con số biết trước** (`/api/health` trả `units`/`towers`), đừng
tin mã 200.

### 2.12 · Đếm phần tử trong DOM KHÔNG phải là nghiệm thu

Tôi từng báo "đã vẽ được" vì đếm thấy 9 `<path>` trong DOM — nhưng chúng bị vẽ
**lệch 8,9 m**, rơi đè lên chỗ khác nên người dùng không thấy gì.

Nghiệm thu hình học phải so **khung bao**:

```js
const a = netCAD.getBBox(), b = oChua.getBBox();
// hai khung phải chồng nhau
```

hoặc dựng một trang ảnh riêng và **nhìn bằng mắt**.

---

## 3. Nghiệm thu: neo vào một phép đo ĐỘC LẬP

Đây là điều quan trọng nhất của cả tài liệu.

Bản vẽ kỹ thuật hầu như luôn có sẵn **một con số do người vẽ ghi tay** — diện
tích, số lượng, kích thước. Đó là đường đo **độc lập** với phép tính của bạn.

Trên dự án này: tính diện tích đa giác đường bao rồi so với chữ `"DIỆN TÍCH:"`
ghi trên chính bản vẽ đó — **lệch 0,0 % trên cả 14 tòa**. Hai đường đo (một bên
là polyline, một bên là chữ) khớp nhau nghĩa là **cả quy ước đặt block lẫn phép
tính diện tích đều đúng**.

Không có neo độc lập thì bạn chỉ đang kiểm code của mình bằng chính giả định của
mình.

Hệ quả cho test: **đừng ghi cứng con số vào test.** Bản vẽ được sửa theo từng đợt
(một tòa đi từ 2.324,5 xuống 2.299,4 m²). Hãy so *giá trị bóc được* với *chữ ghi
trên bản vẽ*, cả hai đều đọc từ file.

---

## 4. Khi không có file XREF

Vẫn dựng lại được, từ ba nguồn đều đo được:

1. **Tên block mã hoá kích thước** — `chtm_hn_1pn_m1_8500x6000` → sâu 8.500 ×
   rộng 6.000.
2. **Điểm chèn + góc quay + dấu hệ số tỷ lệ** (mirror).
3. **Polyline đường bao** trên layer riêng.

Quy ước cần đo ngược rồi kiểm lại trên các bản vẽ còn lại:

```
hướng trải  u = quay(+X, rot) × dấu(sx)
hướng sâu   v = quay(+Y, rot) × dấu(sy)
```

Mẹo: các đối tượng nằm kín nhau, **khe hở chỉ xuất hiện đúng chỗ đặt lõi/thang**
→ dùng chính khe hở đó để đo bề rộng thứ mình không đọc được.

---

## 5. Vài quyết định thiết kế nên bắt chước

**Phân loại độ tin cậy từng con số.** Trong file quy tắc, gắn nhãn cho mỗi kích
thước: `hieu_chuan` (số đo thật trên bản vẽ), `mac_dinh` (giá trị thiết kế, phải
đối chiếu trước khi trình duyệt), `chua_doi_chieu`. App hiển thị lại nhãn này cho
người dùng. Không ai bị lừa bởi một con số trông có vẻ chắc chắn.

**Đánh dấu dữ liệu thiếu thay vì im lặng.** Một bản vẽ đã *nổ khối* thì không còn
block để nhận dạng — ghi cờ `canh_bao_boc` ngay trong dữ liệu, và các phép kiểm
bỏ qua nó *một cách có tuyên bố*, chứ không coi như "tòa này không có lõi".

**Không tự ý nới hình học để thoả quy chuẩn.** Khi tính ra cần 13 thang máy mà
bản vẽ chỉ chứa 5 giếng, app **báo thiếu** chứ không tự nới lõi lên 26 m — vì nới
sẽ ăn mất 5 căn/tầng và không phải cách người ta xây. Để người thiết kế quyết.

**Dữ liệu cũ phải tự phục hồi.** Thư viện đối tượng được thay cả bộ theo từng đợt
chuẩn hoá. Bản nháp lưu trên máy người dùng sẽ còn mã cũ. Đừng ném lỗi và từ chối
tính — **bỏ mã chết, chạy tiếp, và nói rõ đã bỏ cái gì**.

---

## 5b. CẬP NHẬT khi sửa file CAD mẫu căn hộ / lõi thang

**Một mẫu căn tồn tại ở HAI nơi, và chúng KHÔNG tự đồng bộ:**

| | Ai dùng | Cập nhật thế nào |
|---|---|---|
| `data/dwg/x-canho-bt/*.dwg`<br>`data/dwg/x-thang/*.dwg` | Phiếu lắp ghép `.scr` — AutoCAD **attach XREF** thẳng tệp này | **Tự động.** Sửa `.dwg` là bản CAD xuất ra đổi theo ngay, không cần build lại. Đúng bản chất XREF. |
| `data/master/unit_geometry.json`<br>`data/master/core_geometry.json` | App vẽ **trên màn hình** và mọi con số | **Phải bóc lại bằng tay.** Không bóc lại thì màn hình vẫn là bản cũ. |

Sửa `.dwg` mà quên bóc lại là **hai đằng nói khác nhau**: bản CAD xuất ra đã đổi,
màn hình và bảng số liệu vẫn bản cũ, và không có gì báo. Nay `build_shell.py` **so
ngày sửa** và in cảnh báo `!! .dwg căn hộ MỚI HƠN unit_geometry.json`.

### Quy trình đầy đủ

1. **Sửa `.dwg`** trong `data/dwg/x-canho-bt/` (hoặc `x-thang/`).
2. **Xuất `.dxf`** cùng tên vào thư mục DXF nguồn. `ezdxf` **không đọc được `.dwg`**
   và lõi thang còn phải `ResolveXrefs`, nên bước này cần AutoCAD
   (`DXFOUT`, hoặc IronPython qua MCP — xem đầu `boc_lai_loi.py`).
3. **Bóc lại**
   ```bash
   python scripts/boc_lai_can.py            # chỉ SO SÁNH, chưa ghi
   python scripts/boc_lai_can.py --ghi      # ghi đè unit_geometry.json
   python scripts/boc_lai_loi.py            # lõi thang — GHI NGAY, không có --ghi
   ```
   Hai script tự tìm thư mục DXF: tham số dòng lệnh → `data/master/<unit_dxf|loi_dxf>`
   trong chính v4 → dự án v1 trên mọi ổ. (Trước đây trỏ cứng `E:/` và chết ngay dòng
   đầu sau khi dự án chuyển sang `D:` — không được ghi cứng tên ổ.)
4. **`python scripts/build_shell.py`** rồi mở lại app, chạy `selfTest()`.

### Bốn chỗ phải để mắt

1. **`units.json` không tự đổi theo hình vẽ.** Diện tích tim tường / thông thuỷ, số
   phòng ngủ, số WC, mã căn đều nằm ở đây và **nhập tay theo registry**. Đổi hình mà
   quên đổi số là app tính bằng số cũ. Bất biến **QT-17** đối chiếu diện tích bao tim
   tường đo từ nét vẽ với `dt_tim_m2` (±0,6 m²) — đây chính là mục đang FAIL cho
   `chtm_hn_2pn_m1_8500x7500` (62,87 đo được / 59,51 ghi).
2. **Đổi kích thước là đổi cả bảng lắp ghép.** Tên tệp `..._8500x5800` mã hoá
   **sâu × rộng**, và `towers.json` / `toa_dwg.json` xếp căn theo đúng bề rộng đó. Đổi
   bề rộng mà không cập nhật bảng lắp ghép thì căn chồng nhau hoặc hở khe.
3. **Thêm mẫu căn mới**: phải thêm bản ghi vào `units.json` **và** đặt `.dwg` vào
   `data/dwg/x-canho-bt/`. `build_shell.py` dò thư viện XREF bằng `glob`, thiếu `.dwg`
   thì phiếu `.scr` ghi `!! THIEU DUONG DAN`.
4. **Chuẩn hoá layer.** `boc_lai_can.py` phân loại nét theo **tiền tố layer**
   (`A-WALL*`, `A-DOOR*`, `A-AREA-WALL-CENTER` = ranh tim tường…). Vẽ trên layer lạ
   thì nét đó **rơi mất im lặng**. Bảng so "cũ / mới theo lớp" mà script in ra chính
   là để bắt chuyện đó — số nét tụt mạnh ở một lớp là dấu hiệu sai layer.

## 6. Danh sách kiểm trước khi tin kết quả

- [ ] `ResolveXrefs()` đã gọi, và đã đếm số insert *không* có hình học (phải bằng 0)
- [ ] Đã bỏ entity cờ `invisible` (đếm thử: một ô cửa ra mấy nét?)
- [ ] MLINE đã nổ ra LINE
- [ ] Tên layer đã cắt tiền tố `$0$`
- [ ] Đường 2 điểm không bị bộ lọc tỷ lệ giết
- [ ] Không kẹp toạ độ làm mất nét ngoài module
- [ ] Đã đo xem bản vẽ có LỆCH so với module không
- [ ] Điểm chèn của block đã được lưu riêng (kèm mirror/rot)
- [ ] Có **một phép đo độc lập** để đối chiếu (chữ ghi trên bản vẽ)
- [ ] Test **không ghi cứng** con số từ bản vẽ
- [ ] Nghiệm thu bằng **khung bao hoặc mắt**, không bằng số phần tử DOM
- [ ] Cổng server đã dọn sạch trước khi kiểm lại

---

*Rút từ MDI_Unitmix (`E:\OneDrive\_SETUP\AI_Tool\MDI_Unitmix`). Xem chi tiết
từng bước trong `scripts/boc_toa_dwg.py`, `scripts/boc_loi_dwg.py`,
`scripts/extract_unit_geometry.py` — docstring của mỗi file ghi rõ lý do từng
quyết định.*
