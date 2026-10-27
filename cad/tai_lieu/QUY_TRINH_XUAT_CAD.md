# Quy trình xuất CAD — MDIUnitmix

> Lập 2026-09-03 sau khi lắp ghép thật thành công tòa I TM và chủ nhiệm chốt hai luật:
> **đường dẫn XREF phải tương đối** · **không tắt lớp XREF nào**.
> Cập nhật 2026-09-04: thêm **§12 · XCLIP mô-đun** — bắt buộc, vì tệp thư viện của Viện
> có nội thất lạc ngoài mô-đun làm CAD xuất ra khác mặt bằng trên app.
> Đọc kèm: [AI_START.md](AI_START.md) · [GIAO_VIEC_TIEP.md](GIAO_VIEC_TIEP.md) §A7.

---

## 0. Ba đường ra, chọn đường nào

| Đường | Cho ra | Khi nào dùng | Trạng thái |
|---|---|---|---|
| **A · MCP AutoCAD** | `.dwg` thật, ghép từ XREF | AutoCAD đang mở — **một cú bấm** nút `Đồng bộ CAD` | ✅ **nghiệm thu đầu-cuối** · xem §7 |
| **B · phiếu `.scr`** | `.dwg` thật, ghép từ XREF | Máy không có cầu MCP; chủ nhiệm tự chạy | ✅ **nghiệm thu đầu-cuối** (chạy thật trong AutoCAD, 2 tòa) · xem §12.8 |
| **C · `.dxf`** | `.dxf` nhúng hình học | Cần một tệp đứng một mình, không phụ thuộc thư viện | ✅ đã nghiệm thu |

**Khác biệt then chốt giữa A/B và C:** A và B **trỏ** tới tệp thư viện — sửa mẫu căn là
mọi mặt bằng cập nhật theo. C **nhúng** hình học — bản đã xuất không đổi theo thư viện nữa.

**A và B phải ra CÙNG một bản vẽ.** Cả hai đều cắt XCLIP theo mô-đun (§12), nhưng bằng
hai cơ chế khác nhau — A dùng `SpatialFilter` .NET, B dùng lệnh `_.XCLIP` qua LISP. Thêm
tính năng cho một đường thì **phải soát đường kia**; đã lọt một lần và cùng một phương án
xuất ra hai bản vẽ khác nhau.

---

## 1. BỐN LUẬT CỨNG

> **Cập nhật 2026-09-08 — ĐƠN VỊ NAY LÀ mm.** Chủ nhiệm đã chuẩn hoá **cả hai** thư
> viện về `INSUNITS = 4` (mm): căn hộ `data/dwg/x-canho-bt/*` và lõi/thang
> `data/dwg/x-thang/*` (13 tệp — `scripts` không đụng, chuyển bằng side database qua
> cầu MCP). Bản vẽ chủ nay đặt **mm**: đường A `nd.Insunits = Millimeters`, đường B
> `.scr` `INSUNITS 4`, đường C `.dxf` `$INSUNITS 4`. Hệ số quy đổi = 1, XREF vào 1:1.
> Ghi chú "INSUNITS = 6 (Meters)" ở các mục dưới là **lịch sử** — đúng cho tới khi thư
> viện còn khai Meters; nay KHÔNG còn áp dụng. Nghiệm thu 2026-09-08 (đường A, tòa
> `hn_tm_i1`): `insunits = 4`, khung bao `102.925 mm` (KHÔNG ×1000), mép trái 6.840,7.
>
> **Nhãn diện tích căn nay là block `DT_CH`** (không còn 2 dòng chữ rời). App tự phát
> định nghĩa từ `DT_CH_SPEC` trong `shell.src.html` (6 nét + 5 ATT: `CH` = tên·loại
> PN·Loại, `TIM`/`TT` = nhãn ô, `DT_TIM`/`DT_TT` = số theo mặt bằng). Tham chiếu thiết
> kế: `data/dwg/block_dt_can.dwg`. Cả ba đường còn đặt `XCLIPFRAME 0`, `GRIDMODE 0`,
> bật hết lớp (LAYON). Xem **§13**.

### 1.1 · Hệ số attach = **±1**, không bao giờ là hệ số cỡ

Tệp `.dwg` mẫu căn trong thư viện **đã vẽ đúng cỡ thật bằng milimet**. Attach ở hệ số 1
là đúng cỡ. `sx = -1` để lật gương, `sy` luôn `1`.

⚠ Đừng lẫn với bộ `.dxf`: ở đó hình học chuẩn hoá `0…1000` nên **mới** phải nhân
`rộng/1000` × `sâu/1000`. Lẫn sang là **mọi căn to gấp 8,5–9 lần**. Đã lọt một lần.
Bản vẽ tòa của Viện cũng ghi `sx: ±1` — `toa_dwg.json` → `phan_tu[].sx`.

### 1.2 · Đường dẫn XREF phải **TƯƠNG ĐỐI**

Bắt đầu bằng `../` hoặc `./`. Tuyệt đối thì chuyển thư mục dự án, hay mở trên máy khác,
là mất hết XREF.

⚠ **AutoCAD giải đường dẫn tương đối theo THƯ MỤC CỦA BẢN VẼ CHỦ.** Bản vẽ mới chưa lưu
thì không có thư mục → attach tương đối báo *File not found*. Nên trong `.scr` phải
**`SAVEAS` TRƯỚC khi attach**, cuối script `QSAVE` lại. Đường A cũng vậy: tạo tệp có
đường dẫn ngay từ `autocad_new_document(path=…)`.

### 1.3 · **Không tắt / đóng băng lớp XREF nào**

Chủ nhiệm chốt: hiện hết. Bản vẽ ghép phải có đủ 92 lớp `<tên xref>|<lớp>` ở trạng thái
bật và tan băng.

*Ghi chú:* trước đây tôi đóng băng 21 lớp phụ (`a-lite · a-text · a-dien tich tt ·
dt 1pn` …) để khỏi trùng chữ diện tích của tệp thư viện với nhãn app ghi. **Đã bỏ theo
yêu cầu.** Nếu sau này thấy chữ đè nhau thì xử ở phía nhãn app, không tắt lớp thư viện.

### 1.4 · Chữ tiếng Việt

| Đường | Cách ghi chữ |
|---|---|
| A · MCP | ghi **Unicode trực tiếp**, không cần thoát gì |
| B · `.scr` | tệp giữ **thuần ASCII**; chữ đi bằng chuỗi thoát `\U+XXXX`; kiểu chữ `MDI-VN` khai `arial.ttf` |
| C · `.dxf` | như B |

Với `.scr`, **cả dòng ghi chú `;;` cũng phải ASCII** — một dấu `·` lọt vào là có máy đọc
ra ký tự lạ. Hàm `say()` tự bỏ dấu.

---

## 2. Đường A — lắp ghép trực tiếp qua MCP AutoCAD

### Các bước

```
1. autocad_health                      -> phải "healthy"; AutoCAD phải ĐANG MỞ
2. dựng danh sách lượt chèn            -> xrefList() trong app, hoặc từ toa_dwg.json
3. autocad_new_document(path=…)        -> có đường dẫn NGAY, để giải được XREF tương đối
4. db.AttachXref(<tuyệt đối>, <tên>)   -> một lần cho mỗi MÃ, lấy ObjectId
5. BlockReference(Point3d, oid)        -> Rotation = radian, ScaleFactors = Scale3d(±1,1,1)
6. Polyline nét bao -> lớp MDI-BAO
7. đổi PathName của từng XREF sang "..\data\dwg\<thư mục>\<tệp>.dwg"
8. autocad_save_document(path)
9. autocad_open_document(path)         -> mở lại để XREF giải theo đường dẫn tương đối
10. NGHIỆM THU (mục 4) rồi mới báo
```

⚠ **Bước 7–9 không được bỏ.** Đổi `PathName` xong thì `db.ReloadXrefs` trả `eFileAccessErr`;
phải **lưu rồi mở lại** mới giải đúng. Kiểm bằng `XrefStatus == Resolved` sau khi mở lại.

### Mã mẫu đã chạy được

Xem `GIAO_VIEC_TIEP.md` §A7.3. Điểm cần nhớ: `AttachXref` gọi **ngoài** transaction;
`BlockReference` tạo **trong** transaction cùng `AddNewlyCreatedDBObject`.

---

## 3. Đường B — phiếu lắp ghép `.scr`

`Xuất hồ sơ ▸ CAD · .dwg ghép từ XREF` → tải về tệp `..._LapGhepXREF.scr`.

**Cách chạy:** mở AutoCAD ▸ **bản vẽ mới trống** ▸ gõ `SCRIPT` ↵ ▸ chọn tệp `.scr`.
`.scr` **không mở bằng đúp chuột.**

Thứ tự trong tệp — đúng thứ tự này, không đảo:

```
FILEDIA 0 · EXPERT 5 · CMDDIA 0        <-- EXPERT PHẢI trước _SAVEAS
_SAVEAS <tệp .dwg>                     <-- LƯU TRƯỚC, để giải XREF tương đối
INSUNITS 6 · MEASUREMENT 1 · OSMODE 0 · ATTREQ 0
_-LAYER  tạo MDI-BAO / MDI-HANHLANG / MDI-NHAN / MDI-BANG / MDI-XREF
_-STYLE  MDI-VN  arial.ttf
_-LAYER  _S MDI-XREF
   _-XREF _A <đường dẫn tương đối> <toạ độ> <±1> <1> <góc>   |  mỗi
   (command "_.XCLIP" (entlast) "" "_N" "_R" <góc1> <góc2>)  |  lượt chèn
(entmake …)  nét bao · dải hành lang · nhãn từng căn · bảng thông số
_ZOOM _E
_-LAYER  _T *|*  _ON *|*               <-- HIỆN HẾT lớp XREF
_QSAVE
FILEDIA 1 · EXPERT 0
```

Bốn điều trong khối trên đã từng làm chết script, đừng đảo:

- ⚠ **`OSMODE 0` không được bỏ** — không tắt bắt điểm thì toạ độ bị hút lệch, cả mặt
  bằng xô đi vài chục mm.
- ⚠ **`EXPERT` phải đặt TRƯỚC `_SAVEAS`** — đặt sau thì lần chạy thứ hai (tệp đích đã
  có) gặp câu hỏi "replace?" và nuốt luôn dòng `EXPERT`, cả script lệch nhịp từ dòng đầu.
- ⚠ **`INSUNITS 6`**, không phải 4 — khớp thư viện, xem §1 và bảng công thức trong
  `AI_START.md`. Đặt 4 là AutoCAD nhân mọi XREF ×1000.
- ⚠ **`PLINE`/`TEXT` không có bản gạch ngang** và cần một lần Enter kết thúc — thứ `.scr`
  không diễn đạt được. Dùng `entmake`, xem §12.6.

Nếu script dừng giữa đường: gõ `FILEDIA` ↵ `1` ↵ để trả lại hộp thoại chọn tệp.
Cách biết script có chạy trọn hay chết giữa đường: **§12.7**.

---

## 4. NGHIỆM THU — chạy trước khi báo, không có ngoại lệ

| # | Kiểm | Đạt khi | Tòa I TM |
|---|---|---|---|
| 1 | Số lượt chèn | = số căn + thang + lõi | **31** = 28 + 2 + 1 |
| 2 | Số định nghĩa XREF | = số mã dùng, không thiếu tệp | **7** |
| 3 | `XrefStatus` từng XREF | **Resolved** cả lượt | 7/7 |
| 4 | `PathName` từng XREF | bắt đầu `../` hoặc `./` | 7/7 tương đối |
| 5 | Lớp XREF bị ẩn | **0** | 0 / 92 lớp |
| 6 | Khung bao bản vẽ vs nét bao sàn | dôi ≤ ~1,2 m mỗi phương | **102.925 × 19.947** vs 102.325 × 18.830 |
| 7 | Mép trái | trùng khít `duong_bao` | x = 6.840,7 ✔ |

Phần dôi +600 / +1.116 mm là **tường và logia nhô ra** — bản vẽ tòa gốc cũng dôi +1.118 mm,
nên đây là đạt, không phải lệch.

Trong app, bốn mục tự kiểm chạy cho **cả 7 mẫu tòa**:
`đường dẫn XREF là tương đối` · `hệ số attach XREF = ±1` · `dấu chân lõi = bb thực vẽ` ·
`mã xuất CAD có XCLIP mô-đun căn hộ`.
`selfTest()` hiện **279 mục / 1 fail**.

Kiểm thêm sau khi có XCLIP (§12): bbox **có tính clip** của mọi lượt chèn phải nằm trong
`duong_bao` cộng ~600 mm tường/logia. Đo bằng `GeometricExtents` thẳng thì **vô nghĩa** —
nó bỏ qua clip, xem §12.9.

---

## 5. Gửi bản vẽ ra ngoài

Bản ghép **chỉ trỏ** tới thư viện, không nhúng. Gửi cho người ngoài thì một trong hai:

- **`-XREF` ▸ `B` (Bind)** — nhúng hết vào một tệp, người nhận không cần thư viện. Đổi lại
  mất liên kết: sửa mẫu căn không cập nhật nữa.
- **`ETRANSMIT`** — đóng gói bản vẽ kèm cả thư viện, giữ nguyên liên kết.

---

## 6. Bốn cái bẫy đã cắn thật ở đúng quy trình này

1. **`GeometricExtents` của `BlockReference` VỪA TẠO, CHƯA REGEN cho số rác.** Tôi đo ra
   42.726 × 81.754 mm cho một căn 5.800 × 8.500 rồi kết luận sai rằng tệp thư viện chứa cả
   khung tên. Đo lại **định nghĩa block**: đúng 7.366,6 × 9.618,1 — khớp tuyệt đối con số
   bộ bóc ghi. Muốn biết cỡ thì đo **định nghĩa block**, hoặc `EXTMIN/EXTMAX` sau
   `db.UpdateExt(True)`. Cùng họ với bẫy `getBBox()` trả toạ độ cục bộ.
2. **`db.Filename` có thể trả về tệp MẪU (`acad.dwt`)** với bản vẽ tạo từ template, kể cả
   sau `SaveAs`. Đừng dựa vào nó để suy thư mục giải XREF — mở lại tệp rồi kiểm.
3. **`ed.Command` trả `eInvalidInput`** với chuỗi `-LAYER` có ký tự đại diện. Nên chuỗi
   lệnh lọc lớp trong `.scr` **chưa nghiệm thu được đầu-cuối**; phần logic thì đã chứng
   minh qua API.
4. **Lệnh dò trong AutoCAD phải CẮT OUTPUT** (`print(s[:1400])`). Một lệnh đọc bảng block
   để không giới hạn đã trả về hàng trăm dòng tên block nội bộ, tốn vô ích.

Và một điều đã **loại trừ** để khỏi ai đi tìm lại: bản vẽ tòa của Viện **không dùng XCLIP**
(`co_extdict = false` cả 7 lượt) và **không tắt lớp nào** (17 lớp). Phần "gọn" mà app thấy
là do **bộ bóc lọc theo 14 nhóm layer `a-*`** — xem `scripts/boc_lai_can.py` → `CATEGORY`.


---

## 7. Nút "Đồng bộ CAD" — đường A tự động

### 7.1 · Nút làm gì

Một cú bấm: lấy **mặt bằng đang xếp trên màn hình**, sinh mã IronPython, gửi sang
AutoCAD đang mở, AutoCAD dựng bản vẽ rồi lưu `.dwg`.

Bản vẽ ra gồm: **XREF từng căn/lõi/thang** (hệ số ±1, đường dẫn tương đối) ·
**nét bao sàn** · **nhãn từng căn** (`CH-28 · 2PN · Loại 1` / `DT TT 70.42 · DT Tim 75.06 m²`)
· **bảng thông số** góc dưới trái. Chữ tiếng Việt vào **trực tiếp**, không cần chuỗi thoát.

Khác `.scr`: không phải mở AutoCAD gõ `SCRIPT`, không phải chọn tệp. Và **không chạm vào
bản vẽ đang mở** của chủ nhiệm — dùng **side database**.

### 7.2 · Giao thức, và giới hạn thật

```
POST http://127.0.0.1:3020/execute
Content-Type: text/plain
{"tool":"autocad.execute_python","payload":{"script":"…"}}
```

Cầu MCP **không trả header CORS**, nên trình duyệt chặn mọi request đọc được. Đi lọt bằng
`mode:"no-cors"` + `Content-Type: text/plain` — kiểu request CORS xếp loại "đơn giản",
không cần tiền kiểm nên vẫn được **gửi**.

⚠ **Đổi lại: KHÔNG đọc được phản hồi.** App biết đã gửi hay không, **không biết AutoCAD
làm xong chưa**. Vì thế nút báo *"đã gửi — xem AutoCAD"*, không bao giờ báo *"xong"*.
Muốn đọc được kết quả phải thêm `Access-Control-Allow-Origin` vào add-in AutoCAD.

Script có ghi `_dongbo_ketqua.json` cạnh tệp `.dwg` để soi lại sau, nhưng app không đọc
được tệp đó (trình duyệt không đọc đĩa).

### 7.3 · BỐN cái bẫy đã cắn khi làm nút này

1. **`docs.Add()` + `docs.MdiActiveDocument = nd` KHÔNG chạy được.** Đổi document đang
   hoạt động ngay trong lúc script chạy trên luồng chính AutoCAD thì **im lặng không ra
   gì** — bản vẽ xuất ra rỗng hoàn toàn, không báo lỗi. Phải dùng **side database**
   `Database(True, True)` + `SymbolUtilityServices.GetBlockModelSpaceId(db)`.

2. **Phải đổi `HostApplicationServices.WorkingDatabase` sang side database.** Không đổi
   thì mọi đối tượng tạo ra (`DBText`, `Polyline`) gắn vào cơ sở dữ liệu **đang hoạt
   động**, và `AppendEntity` vào side db ném `eWrongDatabase`. Kèm theo:
   `SetDatabaseDefaults(nd)` phải **truyền nd**, không gọi rỗng.

3. **⚠ NGHIÊM TRỌNG NHẤT — trả `WorkingDatabase` VỀ TRƯỚC, rồi mới `Dispose()`.**
   `Dispose()` một `Database` đang là `WorkingDatabase` làm **AutoCAD SẬP NGAY**, không
   ném exception nào bắt được. Triệu chứng: `.dwg` vẫn ghi ra đúng, nhưng tệp kết quả
   không có và cầu MCP mất kết nối. **Đã cắn một lần, mất cả phiên AutoCAD.**

4. **Đường dẫn tương đối phải tính bằng `os.path.relpath`**, không ghi cứng
   `"..\data\dwg\"`. Ghi cứng thì xuất vào thư mục con là XREF trỏ sai và báo
   *Unresolved* — đã cắn: xuất vào `xuat/thu/` thì `..\data` không tồn tại.

Hai bẫy phụ, cùng họ với nhau:

5. **Backtick trong chú thích Python** nằm trong ``String.raw`…` `` của JS **kết thúc
   template sớm** → vỡ cả tệp app. Thân mã Python **không được có backtick nào**; có
   `assert` kiểm việc này trong script patch.
6. **`open(...).write(...)` để lại tệp 0 byte** — IronPython không tự flush. Phải
   `f = open(...); f.write(...); f.close()`.
7. **⚠ TRÙNG TÊN BIẾN — đây mới là thứ thật sự làm AutoCAD sập.** Biến `cu` giữ
   `WorkingDatabase` cũ, nhưng vòng đổi đường dẫn XREF lại gán `cu = r.PathName` (một
   **chuỗi**). Đến `finally` thì gán chuỗi đó vào `WorkingDatabase` → `expected Database,
   got str`, và ở bản trước là **sập AutoCAD**. Nay tên là `wdb_cu` và `dd_cu`, có `assert`
   chặn. Bài học: trong một khối mã dài, **đừng đặt tên biến hai chữ cho thứ phải sống
   suốt cả khối**.
8. **`SendStringToExecute` không chạy** — xếp lệnh `_SCRIPT` vào dòng lệnh nhưng nó không
   thực thi (đã thử: `.scr` ghi ra mà `.dwg` không sinh). Đừng đi đường đó.

### 7.4 · Trạng thái nghiệm thu

Đã chứng minh được (đo trên bản vẽ do chính nút sinh ra, trước lần sập):

| Mục | Kết quả |
|---|---|
| Trình duyệt gọi tới cầu MCP | ✅ chạy được Python trong AutoCAD |
| Lượt chèn XREF | **31** |
| Định nghĩa XREF | **7** |
| Đường dẫn tương đối | **7/7** |
| Chữ nhãn | **64 dòng**, tiếng Việt đúng dấu, Unicode trực tiếp |
| Nét bao | 1 polyline |
| Lớp XREF bị ẩn | **0 / 92** |
| Mép trái · bề rộng | 6.840,7 · **102.325,0 mm** — khớp `duong_bao` tuyệt đối |

### 7.5 · ĐÃ NGHIỆM THU ĐẦU-CUỐI (bấm nút thật, 2026-09-03)

Bấm `Đồng bộ CAD` trong app, rồi mở bản vẽ ra đo:

| Mục | Kết quả |
|---|---|
| Tệp kết quả `_dongbo_ketqua.json` | ghi ra, **không có khoá `loi`** |
| Lượt chèn · định nghĩa XREF | **31** · **7**, `thieu: []` |
| `XrefStatus` | **7/7 Resolved** |
| `PathName` | **7/7 tương đối** — `..\..\data\dwg\x-canho-bt\…`, đúng cả khi xuất vào thư mục sâu 2 cấp |
| Nhãn | **56 dòng** (28 căn × 2), chữ Việt đúng dấu |
| Lớp XREF bị ẩn | **0 / 92** |
| Mép trái · bề rộng | 6.840,7 · **102.925,0 mm** |
| AutoCAD sau khi chạy | **healthy**, không sập |

### 7.6 · Cách dò lỗi khi script CAD không chạy

Trình duyệt không đọc được phản hồi, nên khi nghi script lỗi thì **đừng đoán**:

1. Dựng đúng tệp script mà app sẽ gửi — trích `PY_THAN` từ `shell.src.html`, ghép
   `D = {…}` từ `toa_dwg.json`, ghi ra `xuat/_dongbo.py`.
2. Chạy qua MCP: `exec(codecs.open(path,"r","utf-8").read(), {})` — **đọc được lỗi thật**.
3. Sửa, chạy lại, rồi mới bấm nút.

Chính cách này tìm ra lỗi trùng tên biến, sau khi tôi đã đoán sai ba lần.


---

## 8. Ba loại PDF — lỗi in ra TRẮNG TRƠN và cách chặn

Cả ba loại PDF (trình phương án · Salekit · Hợp đồng mua bán) in ra **trắng trơn**.

**Nguyên nhân.** Luật in là:

```css
@media print { body > *:not(.report) { display: none !important } }
```

Nó ẩn theo **con trực tiếp của `body`**. Nhưng trong HTML, `#report` nằm bên trong
`div.app`, nên luật ẩn luôn `div.app` — và bản in nằm bên trong nó cũng bị ẩn theo.
`display:none` ở phần tử cha thì con **không cách nào đè lại được**.

**Cách sửa: chuyển NODE, không sửa CSS.** Lúc khởi động, `#report` và
`<style id="printPage">` được `appendChild` sang thẳng `document.body`.

**Hai bất biến mới** — vì đếm phần tử không bắt được lỗi này:

| Mục | Đo cái gì |
|---|---|
| `khung bản in là con trực tiếp của <body>` | `rp.parentElement === document.body` |
| `ba loại PDF dựng ra có nội dung đo được` | bật `.printing`, dựng từng loại, đo `getBoundingClientRect().height` và `scrollWidth` — phải **> 200 px** cả ba |

Đo bằng **kích thước thật**, không đếm `<table>` hay `<div>`: bản in lỗi vẫn có đủ
phần tử trong DOM, chỉ là cao 0 px.

**Nghiệm thu sau khi sửa** (mô phỏng chế độ in bằng cách bê luật `@media print` ra ngoài):

| | Kết quả |
|---|---|
| `div.app` | `display: none` — đúng, bị ẩn khi in |
| `#report` | `display: block`, **1.665 × 2.093 px** |
| Ô chữ thấy được | **166** |
| Mặt bằng SVG | cao **550 px** |
| Ba loại | bc 3 trang · sale 1 trang · hdmb 1 trang, đều có SVG và bảng |

`selfTest()` 244 → **246 mục**, vẫn 1 fail.


---

## 9. Salekit và HĐMB — MỘT TỜ DUY NHẤT, theo mẫu tham khảo

Chủ nhiệm chốt: *"Tờ Salekit và HĐMB chỉ trong 1 tờ duy nhất thôi. Trình bày giống mẫu
tham khảo đi"* — và sau đó: *"nét xuất đang bị dày"*.

### 9.1 · Đọc lại mẫu tham khảo: đây là TỜ MẶT BẰNG

Bản trước tôi làm mặt bằng một nửa, bảng một nửa. **Sai kiểu.** Cả hai mẫu thật của Viện
đều là **tờ mặt bằng**, thông tin từng căn nằm trên **nhãn ngay trên mặt bằng**:

- `251124.DQ_TLBH_MB TẦNG ĐIỂN HÌNH.pdf` (Rivea, A3 ngang) — nhãn: loại · `CH-05` ·
  `Loại 1` · `DT TT` · `DT Tim` · `DT Sân`
- `2-HDMB-Galia-MB Tang.pdf` (Galia, A4) — nhãn: `CH-02 · 2PN+ · Loại 2`

Bảng diện tích từng căn là **tài liệu riêng** (mỗi loại căn một trang), không nhồi vào
tờ mặt bằng. Nay:

| Tờ | Bố cục |
|---|---|
| **Salekit · A3** | đầu tờ (logo · tên DA · số căn/tầng · số tầng · dải DT) → **mặt bằng lấp hết bề rộng** → dải rổ hàng gọn một hàng theo loại căn → ghi chú nguyên văn của Viện |
| **HĐMB · A4** | đầu tờ (tên DA · tầng 1–25 · số căn/tầng · "Bản đính kèm hợp đồng mua bán") → **mặt bằng** → KHUYẾN CÁO 6 gạch đầu dòng **xếp 2 cột** → chỗ ký BÊN BÁN / BÊN MUA |

### 9.2 · Ép vừa một tờ — cách làm

`@page` cho khổ giấy, nhưng **HTML không tự biết tờ cao bao nhiêu**. Nên lúc xuất, app
tính `chiều cao vùng in = khổ giấy − 2 lề` rồi gán vào biến CSS `--pgH`:

```
.report.sale .pg, .report.hdmb .pg{
  height:var(--pgH); display:grid;
  grid-template-rows:auto minmax(0,1fr) auto; overflow:hidden }
```

Mặt bằng đặt `width:100%; height:auto; max-height:100%` — **lấp hết bề rộng**, cao theo
tỉ lệ thật, và bị chặn để không tràn trang. Dùng `height:100%` thì mặt bằng dài
(102 m × 19 m) bị canh giữa hộp, chừa hai dải trắng lớn trên và dưới.

**Nghiệm thu ở đúng kích thước giấy:**

| Tờ | Giấy | Đo được | Vừa một tờ |
|---|---|---|---|
| Salekit | A3 ngang, lề 12 mm → 396 × 273 mm | `.pg` 1.497 × 1.032 px · `scrollHeight` 1.032 | ✅ |
| HĐMB | A4 ngang, lề 10 mm → 277 × 190 mm | `.pg` 1.047 × 718 px · `scrollHeight` 718 | ✅ |

Bất biến: `ba loại PDF dựng ra có nội dung đo được` — đo **kích thước thật**, không đếm
phần tử.

### 9.3 · Nét in dày — nguyên nhân và cách sửa

Bề rộng nét trong `PEN` tính bằng **pixel** và dùng `vector-effect="non-scaling-stroke"`.
Đúng cho màn hình (người dùng zoom, nét luôn sắc), nhưng khi **in** thì mặt bằng bị co
cho vừa tờ giấy mà nét vẫn giữ nguyên số pixel → trông **dày**.

Sửa: thêm hệ số `PEN_K`, bản in dùng **0,45** (tường 1,9 → **0,85 px**), và giảm độ đặc
của vành tường 125 mm xuống 0,20 để nét bản vẽ nổi lên thay vì vành tường.

⚠ **`PEN_K` PHẢI nằm trong khoá cache ký hiệu** (`symId`). Không thì lần in đầu dựng ký
hiệu nét mảnh, rồi màn hình dùng lại luôn ký hiệu đó — cả app thành nét mảnh.

### 9.4 · Bẫy khi nghiệm thu nét: ĐỪNG quét chuỗi HTML

Nét bút nằm trong ký hiệu ở `<defs>`; bản clone chỉ có `<use href="#sym…">` nên **HTML
trả về không chứa bề rộng nét nào**. Hai lần đo đầu của tôi đều ra "màn hình = bản in"
vì thế — lần một vớ phải nét 1.800 px của dải hành lang, lần hai vớ phải nét 2 px của
vòng tròn thang bộ.

Kiểm đúng cách là kiểm **cơ chế**: cache ký hiệu phải có cả biến thể `|0.45` và `|1`, và
`PEN_K` phải trả về `1` sau khi xuất. Cùng họ với bẫy `getBBox()` và bẫy "đếm phần tử DOM
không phải nghiệm thu".

`selfTest()` 246 → **248 mục**, vẫn 1 fail.


---

## 10. SANG MÁY KHÁC — xuất CAD kèm XREF

### 10.1 · Hai thứ khác nhau, đừng lẫn

| | Sang máy khác thì sao |
|---|---|
| **App** `MDIUnitmix.html` | Chạy được ngay, tự chứa. Nhưng **đường dẫn thư viện** nhúng lúc build là **tuyệt đối của máy dựng** (`E:/OneDrive/…`) nên không còn đúng |
| **Bản vẽ `.dwg` đã xuất** | XREF lưu **đường dẫn tương đối** nên chỉ cần giữ đúng **vị trí tương đối** giữa `.dwg` và thư viện. Copy nguyên thư mục dự án thì mở được; copy trơ một tệp `.dwg` thì XREF *Unresolved* |

### 10.2 · App tự suy đường dẫn — không phải khai lại

Mở app **trực tiếp từ trong thư mục dự án** (`file://…/prototype/MDIUnitmix.html`) thì
app suy gốc dự án ra từ chính `location`:

```
file:///D:/OneDrive/AI_Tool/MDI_Unitmix_v4/prototype/MDIUnitmix.html
   -> gốc dự án  D:/OneDrive/AI_Tool/MDI_Unitmix_v4
   -> thư viện   D:/OneDrive/AI_Tool/MDI_Unitmix_v4/data/dwg
   -> xuất ra    D:/OneDrive/AI_Tool/MDI_Unitmix_v4/xuat
```

Đúng trên **mọi máy, mọi ổ đĩa**, không cần khai gì. Mở qua `http://localhost` thì trình
duyệt không biết đường dẫn đĩa nên rơi về đường dẫn nhúng; lúc đó sửa hai ô trong menu
xuất, nhớ theo máy bằng `localStorage`.

Bất biến: `suy được gốc dự án từ đường dẫn tệp` — kiểm bằng chuỗi giả (`/D:/…`, `/C:/…`)
nên chạy được ở mọi máy.

### 10.3 · Ô chọn "Kèm tệp XREF"

`Xuất hồ sơ ▸ ☑ Kèm tệp XREF — mang sang máy khác dùng được`

| Ô chọn | Bản vẽ ra | Đánh đổi |
|---|---|---|
| **tắt** (mặc định) | XREF trỏ tới thư viện `../data/dwg/…` | Sửa mẫu căn trong thư viện là **mọi mặt bằng cập nhật theo**. Nhưng phải giữ nguyên thư mục dự án |
| **bật** | sao 7 tệp thư viện vào `<thư mục ra>/xref/`, XREF trỏ `.\xref\…` | Mang **cả thư mục** sang máy nào cũng mở được, không cần thư viện gốc. Đổi lại bản sao **đứng yên** — sửa mẫu căn không cập nhật vào bản vẽ này nữa |

Sao tệp bằng `shutil.copy2`, có dự phòng đọc/ghi byte nếu `shutil` không dùng được.
7 tệp thư viện khoảng **950 KB** mỗi lần xuất kèm.

### 10.4 · Hai cách khác của chính AutoCAD

- **`ETRANSMIT`** — đóng gói bản vẽ + toàn bộ XREF, **giữ nguyên liên kết**. Tương đương
  ô "Kèm tệp XREF" nhưng làm từ AutoCAD.
- **`-XREF` ▸ `B` (Bind)** — nhúng hết vào một tệp `.dwg`, người nhận không cần gì thêm.
  **Mất liên kết** hẳn.

### 10.5 · Nút Đồng bộ CAD trên máy khác cần gì

1. AutoCAD **đang mở**.
2. Add-in `MDI-autocad-connector` đã cài, đang lắng nghe `127.0.0.1:3020`
   (gõ `MDISTATUS` ở dòng lệnh AutoCAD để kiểm).
3. Thư viện `data/dwg` có mặt tại đường dẫn trong ô "Thư mục thư viện XREF".

Máy không có add-in thì dùng **`.scr`** (§3) hoặc **`.dxf`** (đường C — nhúng hình học,
không phụ thuộc thư viện).

### 10.6 · ĐÃ NGHIỆM THU (bấm nút thật, 2026-09-04)

| Mục | Kết quả |
|---|---|
| Lượt chèn · XREF | **31** · **7**, `thieu: []` |
| Hệ số attach | **chỉ có −1,0 và 1,0** |
| `XrefStatus` | **7/7 Resolved** |
| `PathName` | **7/7 trỏ `.\xref\…`** |
| Thư mục `xref/` | **7 tệp · 980 KB** |
| `INSUNITS` bản vẽ ra | **6** — khớp thư viện |
| Khung bao | **102.925 × 34.476 mm** · mép trái 6.840,7 (bề rộng khớp `duong_bao` tuyệt đối) |
| Nhãn · nét bao | 64 dòng chữ · 1 polyline |

### 10.7 · BỐN lỗi đã sửa trong lượt này

1. **`-PLINE` KHÔNG PHẢI LỆNH.** Chỉ lệnh **có hộp thoại** mới có bản gạch ngang;
   `PLINE` và `TEXT` không có. Viết `-PLINE` thì AutoCAD báo lệnh lạ và script **đứng
   ngay tại đó** — log của chủ nhiệm dừng đúng dòng đó, sau khi attach xong cả 31 lượt.
   Nay mọi lệnh mang tiền tố `_` (chạy được cả trên AutoCAD bản tiếng khác) và chỉ
   `_-LAYER` · `_-XREF` · `_-STYLE` dùng gạch ngang.
2. **Lệnh `TEXT` trong script cần MỘT DÒNG TRỐNG để kết thúc.** Thiếu thì nó ăn luôn
   dòng lệnh sau, cả script lệch nhịp từ đó.
3. **⚠ `INSUNITS` phải KHỚP THƯ VIỆN, không phải "đúng thực tế".** Mọi tệp thư viện của
   Viện khai `INSUNITS = 6` (**mét**) dù hình học vẽ bằng **milimet** — kể cả bản vẽ tòa
   gốc. Đặt bản vẽ chủ là `4` (mm) thì AutoCAD tự quy đổi m→mm và **nhân mọi XREF lên
   1000 lần**: khung bao ra **22 km**, hệ số hiện **−1000**, mặt bằng dồn thành một cục.
   Đặt `6` cho khớp thì hệ số quy đổi = 1.
4. **`JSON.stringify` sinh `true`, Python chỉ hiểu `True`.** Khối `D = {…}` là JSON nhúng
   thẳng vào mã Python, nên ô chọn "kèm XREF" làm **cả script chết ngay dòng đầu** với
   `name 'true' is not defined` — không có bản vẽ nào ra, không có cả tệp kết quả. Nay
   dùng `1/0`. Bất biến mới: `mã gửi AutoCAD không có true/false/null`.
   **Đừng bao giờ đưa boolean hay null vào `D`.**


---

## 11. Test cả 7 mẫu tòa (2026-09-04) — CHƯA XONG

### 11.1 · Kết quả

Bấm xuất lần lượt 7 mẫu tòa vào `xuat/kt/<mã tòa>/`:

| Mẫu tòa | Kết quả |
|---|---|
| `hn_tm_i1` | ✅ ra `.dwg` (lượt **đầu tiên** của phiên AutoCAD) |
| 6 mẫu còn lại | ❌ **không ra gì** — AutoCAD **sập** sau lượt đầu |

### 11.2 · Nguyên nhân: `Dispose()` side database đang giữ XREF

Bằng chứng gộp lại từ ba lần:

- Mọi lượt xuất **thành công** đều là lượt **ĐẦU TIÊN** trong một phiên AutoCAD.
- Lượt **thứ hai** trong cùng phiên làm AutoCAD **sập** — không nem exception nào
  bắt được, `.dwg` của lượt đầu vẫn còn nguyên.
- Side database giữ **7 XREF**. `Dispose()` nó để lại tham chiếu treo cho trình quản lý
  XREF; lượt sau đập vào là chết.

**Đã sửa: KHÔNG `Dispose()` side database.** Đánh đổi rõ ràng — rò rỉ vài MB mỗi lượt
xuất, AutoCAD thu hồi khi đóng phiên. Rẻ hơn nhiều so với làm sập phiên làm việc.

Đồng thời **ghi tệp `_dongbo_ketqua.json` NGAY sau `SaveAs`**, không đợi đến cuối script:
hai lần trước mất sạch chẩn đoán vì script chết trước khi ghi.

### 11.3 · Chữ ký mong đợi của 7 mẫu tòa (lấy từ app)

Dùng để đối chiếu với bản vẽ xuất ra. `n` = số lượt chèn · `lat` = số lượt lật gương ·
`Σx`/`Σy` = tổng toạ độ chèn · `Σgóc` = tổng góc quay · `mã` = số mã XREF khác nhau.

| Mẫu tòa | n | lat | Σx | Σy | Σgóc | mã | nét bao rộng |
|---|---|---|---|---|---|---|---|
| hn_tm_i1 | 31 | 18 | 1.776.422 | −1.742.575 | 2.520 | 7 | 102.325 |
| hn_tm_l2 | 28 | 12 | 1.022.451 | −1.377.831 | 4.140 | 7 | 50.445 |
| hn_tm_u1 | 38 | 18 | 2.398.632 | −2.101.508 | 3.060 | 7 | 110.085 |
| hn_tm_z1 | 27 | 11 | 1.614.739 | −1.455.071 | 2.340 | 7 | 83.783 |
| hn_xh_i1 | 23 | 10 | 1.322.909 | −1.248.670 | 1.800 | 6 | 80.270 |
| hn_xh_u1 | 26 | 13 | 1.556.077 | −1.134.214 | 1.980 | 6 | 90.848 |
| hn_xh_z1 | 23 | 14 | 1.326.780 | −1.195.966 | 2.160 | 6 | 80.388 |

### 11.4 · ĐÃ NGHIỆM THU CẢ 7 MẪU TÒA (2026-09-04)

Chạy **từng lượt qua MCP** (đọc được lỗi), rồi đọc lại từng `.dwg` bằng side database
và đối chiếu chữ ký với app. **Không lượt nào sập AutoCAD.**

| Mẫu tòa | lượt chèn | lật | Σx | Σy | Σgóc | mã XREF | Resolved | tương đối | hệ số |
|---|---|---|---|---|---|---|---|---|---|
| hn_tm_i1 | 31 ✅ | 18 ✅ | 1.776.422 ✅ | −1.742.575 ✅ | 2.520 ✅ | 7 ✅ | 7/7 | 7/7 | ±1 |
| hn_tm_l2 | 28 ✅ | 12 ✅ | 1.022.451 ✅ | −1.377.831 ✅ | 4.140 ✅ | 7 ✅ | 7/7 | 7/7 | ±1 |
| hn_tm_u1 | 38 ✅ | 18 ✅ | 2.398.632 ✅ | −2.101.508 ✅ | 3.060 ✅ | 7 ✅ | 7/7 | 7/7 | ±1 |
| hn_tm_z1 | 27 ✅ | 11 ✅ | 1.614.739 ✅ | −1.455.071 ✅ | 2.340 ✅ | 7 ✅ | 7/7 | 7/7 | ±1 |
| hn_xh_i1 | 23 ✅ | 10 ✅ | 1.322.909 ✅ | −1.248.670 ✅ | 1.800 ✅ | 6 ✅ | 6/6 | 6/6 | ±1 |
| hn_xh_u1 | 26 ✅ | 13 ✅ | 1.556.077 ✅ | −1.134.214 ✅ | 1.980 ✅ | 6 ✅ | 6/6 | 6/6 | ±1 |
| hn_xh_z1 | 23 ✅ | 14 ✅ | 1.326.780 ✅ | −1.195.966 ✅ | 2.160 ✅ | 6 ✅ | 6/6 | 6/6 | ±1 |

**Khớp tuyệt đối từng con số** trên cả 7 mẫu — không phải xấp xỉ. `INSUNITS = 6` cả 7,
`thieu: []` cả 7, nhãn 40–66 dòng/tòa.

Bề rộng khung bao vs nét bao sàn:

| Mẫu tòa | khung bao | nét bao | chênh |
|---|---|---|---|
| hn_tm_i1 | 102.925 | 102.325 | +600 |
| hn_tm_z1 | 83.783 | 83.783 | **0** |
| hn_xh_u1 | 90.848 | 90.848 | **0** |
| hn_xh_z1 | 80.388 | 80.388 | **0** |
| hn_tm_u1 | 110.620 | 110.085 | +535 |
| hn_tm_l2 | 56.262 | 50.445 | +5.817 |
| hn_xh_i1 | 83.008 | 80.270 | +2.738 |

Hai chênh lớn đều **giải thích được, không phải lỗi**:
- **`hn_tm_l2`**: tòa hình L có mặt đứng theo trục dọc, nên **nhãn căn nhô ra theo phương x**
  — nhãn nằm ngoài mặt đứng theo đúng yêu cầu. Chênh này là nhãn, không phải hình học.
- **`hn_xh_i1`**: app đã chừa **sảnh thang 3.000 mm** làm tòa dài thêm 3.130 mm (QT-23),
  nên khung bao 83.008 khớp với **mặt bằng của app (83.400)**, không khớp nét bao bản vẽ
  (80.270). Đây là **bằng chứng bản xuất theo APP, không theo bản vẽ gốc** — đúng ý muốn.

### 11.5 · Bẫy khi nghiệm thu: side database KHÔNG tự giải XREF

Đọc `.dwg` bằng `Database.ReadDwgFile` thì `XrefStatus` trả **`Unresolved` cho tất cả** —
tôi suýt báo "0/7 Resolved" là lỗi. Phải gọi `d.ResolveXrefs(True, False)` trước khi đọc
trạng thái. Sau khi gọi: **7/7 (và 6/6) Resolved** cả 7 mẫu.

### 11.6 · Cách test đúng, dùng lại lần sau

Đừng bấm nút liên tiếp — cầu MCP xử lý tuần tự trên luồng chính AutoCAD nên `fetch` của
lượt sau bị chặn và trang treo (3 lệnh test của tôi bị timeout vì thế). Làm thế này:

1. Dựng **phiếu việc** cho từng mẫu tòa bằng `scripts/kiemtra_xuat_cad.py` — nó trích
   `PY_THAN` từ chính `shell.src.html` (kiểm thứ app gửi đi, không viết lại) và lấy danh
   sách tòa từ `TOWER_FILES`, ra `xuat/kt2/_viec_<mã tòa>.py`.
2. Chạy **từng phiếu** qua MCP — đọc được lỗi thật:
   `exec(compile(open(p,"rb").read().decode("utf-8"), p, "exec"), {})`.
   ⚠ Phải đọc **nhị phân rồi giải mã UTF-8**: `open()` của IronPython dùng bảng mã ANSI,
   gặp tiếng Việt là `charmap codec can't decode byte 0x90`.
   ⚠ Đừng chạy quá ~8 phiếu trong một phiên AutoCAD — xem §12.11.
3. Đọc lại từng `.dwg` bằng side database + `ResolveXrefs`, tính chữ ký
   (n · lật · Σx · Σy · Σgóc · mã · hệ số) rồi so với `xrefList()` của app.
4. Từ 2026-09-04 thêm bước bắt buộc: đo bbox **có tính clip** so với `duong_bao`
   (§12.8). Bước 3 không phát hiện được nội thất lạc — chữ ký khớp tuyệt đối trong khi
   bản vẽ vẫn tràn 5.603 mm.



*(mục này đã hoàn tất — xem 11.4)*

---

## 12. NỘI THẤT LẠC TRONG TỆP THƯ VIỆN — và XCLIP mô-đun (2026-09-04)

### 12.1 · Hiện tượng

CAD xuất ra **không khớp mặt bằng trên app**: ba tòa NOXH tràn **5.603 mm** ra ngoài
đường bao ở cả hai đầu, `hn_xh_i1` tràn 8.733 mm bên trái. Bốn tòa TM chỉ tràn
535–665 mm — đúng phần tường/logia nhô ra, không sao.

### 12.2 · Nguyên nhân: tệp căn hộ của Viện có nội thất lạc ngoài mô-đun

Không phải lỗi mã ghép XREF. Bản xuất chèn **trung thực** tệp thư viện; chính tệp thư
viện chứa **block nội thất lặp nằm ngoài mô-đun** — bản mirror của căn để lại.

| Tệp thư viện | Mô-đun | Rộng thật (x) | Tràn | Thứ lạc |
|---|---|---|---|---|
| `chxh_hn_2pnp_g1_8500x9000` | 9000 × 8500 | `-567 … 14603` | 4.803 mm | 4 × `FURNITURE_…$0$TV P.NGU` |
| `chtm_hn_2pnp_g1_8500x9000` | 9000 × 8500 | `-567 … 14603` | 4.803 mm | 4 × như trên |
| `chtm_hn_2pnp_g2_8500x9000` | 9000 × 8500 | `-567 … 14603` | 4.803 mm | 4 × như trên |
| `chtm_hn_2pn_g1_8500x9000` | 9000 × 8500 | x sạch, **y ra −6508** | — | 2 × như trên |
| `chhn_2pn_y1 8500x6000` | 6000 × 8500 | `-4562 … 6692` | 3.762 mm | cả bộ giường/tủ + hatch |

Tất cả nằm trên layer **`0`**, ở y = −3.406 … −6.947 tức **ngoài căn**. 8/13 tệp sạch.

**App không vẽ chúng** vì trình bóc lọc theo 14 nhóm layer — nên lỗi chỉ hiện ra ở CAD.

### 12.3 · Vì sao KHÔNG được chữa bằng hai cách hiển nhiên

- **Sửa tệp gốc của Viện** — vi phạm nguyên tắc "dùng đúng hình học file CAD của Viện".
- **Tắt layer `0` của XREF** — chủ nhiệm đã chốt *hiện hết layer, không tắt lớp nào*
  (§1.3). Hơn nữa layer `0` bên trong XREF còn chở phần lớn hình học hợp lệ.

Cách còn lại là **cắt không gian**: XCLIP theo mô-đun.

### 12.4 · Lề clip = **1.200 mm**, và vì sao đúng con số đó

Đo trên 8 tệp sạch: tường/logia thật nhô ra tối đa **643 mm** theo x và **735 mm** theo y.
Nội thất lạc cách mô-đun **ít nhất 4.803 mm**. Lề 1.200 mm tách được hai loại: giữ trọn
tường/logia, bỏ trọn thứ lạc. Đã kiểm bằng `ClipVolumeIntersectsExtents`:
**giữ 131/135 đối tượng, bỏ đúng 4 món lạc.**

Chỉ cắt lượt chèn **có mô-đun trong tên** (mẫu `số x số`). Lõi thang (`x_tmkt_*`) không
có nên không bị cắt — đúng ý, dấu chân lõi vốn nằm ngoài mô-đun căn.

### 12.5 · Đường A (Đồng bộ CAD) — `SpatialFilter` trong `PY_THAN`

```python
dd = Point2dCollection()
dd.Add(Point2d(-LE_CLIP, -LE_CLIP))
dd.Add(Point2d(rong + LE_CLIP, sau + LE_CLIP))
fd = SpatialFilterDefinition(dd, Vector3d.ZAxis, 0.0, 1e300, 1e300, True)
sf = SpatialFilter(); sf.Definition = fd
br.CreateExtensionDictionary()
td = t.GetObject(br.ExtensionDictionary, OpenMode.ForWrite)
td2 = DBDictionary(); td.SetAt("ACAD_FILTER", td2)
t.AddNewlyCreatedDBObject(td2, True)
td2.SetAt("SPATIAL", sf); t.AddNewlyCreatedDBObject(sf, True)
```

Hai điều dễ sai:

- Toạ độ biên ở đây là **toạ độ NỘI BỘ block** (`0…rộng`, `0…sâu`), không phải toạ độ
  thế giới. Đã chứng minh bằng tuỳ chọn *generate Polyline* của XCLIP: polyline sinh ra
  nằm đúng quanh insert, tức AutoCAD đã nhân biên với `BlockTransform`.
- `FrontClip`/`BackClip` phải là **1e300** (`ACDB_INFINITE_XCLIP_DEPTH`). Truyền `0.0`
  thì AutoCAD lưu `FrontClip = 0`, tức một mặt cắt Z **đúng tại Z = 0** — nơi toàn bộ
  hình 2D đang nằm.

### 12.6 · Đường B (`.scr`) — phải `_R`, TUYỆT ĐỐI KHÔNG `_P`

Viết bằng LISP một dòng cho mỗi lượt chèn, không viết thành các dòng lệnh rời: lời
"Select objects:" cần một lần Enter, mà **dòng trống trong `.scr` lặp lại lệnh vừa rồi**
chứ không phải Enter. Trong `(command ...)` thì `""` là Enter thật.

```lisp
(command "_.XCLIP" (entlast) "" "_N" "_R" '(x0 y0 0.0) '(x1 y1 0.0))
```

**Đã cắn thật với `_P` (Polygonal):**

```
[Select polyline/Polygonal/Rectangular/Invert clip] <Rectangular>: _P
Specify first point:
Specify next point or [Undo]:
Invalid point, polygon segment is zero length.
; error: Function cancelled
```

`_P` nhập điểm bằng rubber-band (jig) nên **bỏ qua toạ độ do script cấp**. Tệ hơn: lệnh
treo ở câu hỏi điểm, **toàn bộ phần còn lại của phiếu bị ăn vào đó**, `_QSAVE` không
chạy — `.dwg` đứng ở bản chụp lúc `_SAVEAS` (**32 KB** thay vì ~52 KB). Nhìn tên tệp
thì tưởng xong.

`_R` cấp **hai góc theo trục**, nên chỉ khít mô-đun khi cạnh song song trục. Đã kiểm
trên `toa_dwg.json`: cả 7 mẫu tòa app dùng đều có `rot` là bội của 90; chỉ `hn_tm_y1`
có 26 lượt 30° và tòa đó **không** nằm trong 7 mẫu. Bất biến QT-28 sẽ báo nếu về sau
có tòa lệch trục — khung `_R` khi đó rộng hơn mô-đun.

### 12.7 · Dấu hiệu nhận biết phiếu `.scr` chạy trọn

| Dấu hiệu | Chạy trọn | Chết giữa đường |
|---|---|---|
| Tệp `.bak` bên cạnh | **có** | không |
| Cỡ `.dwg` | ~52 KB | **32 KB** (bản chụp `_SAVEAS`) |
| Log, dòng cuối | `EXPERT` về 0 | dừng ở lệnh lỗi |

Bật log để đọc lỗi thật: `LOGFILEMODE = 1`, rồi đọc `(getvar "LOGFILENAME")`.
`LOGFILEPATH` **không** nhận đường dẫn tuỳ ý (báo `eInvalidInput`) — dùng thư mục
mặc định. Tên log **đổi theo tên bản vẽ**, nên sau `_SAVEAS` phần đầu phiên nằm ở log cũ.

### 12.8 · NGHIỆM THU (2026-09-04)

Đường A — xuất lại cả 7 mẫu tòa, đo bbox **có tính clip** so với `duong_bao`:

| Tòa | Tràn trước | Tràn sau | Đối tượng bị cắt |
|---|---|---|---|
| `hn_xh_i1` | 8733 / 5604 / 461 / 442 | **600 / 600 / 567 / 552** | 8 |
| `hn_xh_u1` | 5603 / 5603 / 487 / 458 | **600 / 600 / 567 / 552** | 16 |
| `hn_xh_z1` | 5603 / 5603 / 440 / 458 | **600 / 600 / 567 / 552** | 12 |
| `hn_tm_i1` | 600 / 600 / 560 / 544 | 600 / 600 / 552 / 565 | 6 |
| `hn_tm_l2` | 585 / 600 / 574 / 600 | 585 / 600 / 582 / 600 | 8 |
| `hn_tm_u1` | 535 / 665 / 565 / 560 | 535 / 665 / 567 / 567 | 18 |
| `hn_tm_z1` | 600 / 600 / 550 / 549 | 600 / 600 / 567 / 552 | 12 |

Đường bao 4 tòa TM **không đổi** → không cắt oan tường/logia. Mọi đối tượng bị cắt đều
là block `FURNITURE_…$0$TV P.NGU` lạc.

Đường B — chạy phiếu `.scr` thật trong AutoCAD:

| | `hn_xh_u1` | `hn_tm_z1` |
|---|---|---|
| Chèn / clip | 26 / 24 | 27 / 26 |
| Chữ · polyline | 50 · 4 | 56 · 4 |
| INSUNITS | Meters | Meters |
| `.dwg` + `.bak` | 52 KB, có | 53 KB, có |
| Lỗi trong log | không | không |
| Tràn khỏi đường bao | 600 / 600 / 486 / 457 | 600 / 600 / 549 / 548 |
| Đối tượng bị cắt | 16 | 12 |

Số đối tượng bị cắt **trùng khít** đường A. Hai đường xuất ra cùng một bản vẽ.

### 12.9 · Bẫy ĐO LƯỜNG — năm cái, cắn trong đúng lượt này

1. **`Extmin/Extmax` đọc từ tệp thư viện là giá trị header CŨ.** `chxh_hn_2pnp_g1` khai
   `[-567, 9600]` trong khi nội dung thật là `[-567, 14603]`. `UpdateExt` trên side
   database **không** tính lại. Phải cộng dồn `GeometricExtents` **từng đối tượng**.
2. **`GeometricExtents` của `BlockReference` BỎ QUA XCLIP.** Đo bằng nó thì clip như
   chưa có. Muốn biết thật thì tự cắt: bỏ đối tượng nằm hẳn ngoài biên, kẹp phần còn lại.
3. **Layer TẮT vẫn được tính vào extents.** Chỉ layer **ĐÓNG BĂNG** mới bị loại. Đã báo
   oan "vẫn tràn 21 m" vì tắt thay vì đóng băng.
4. **`UpdateExt` trên tài liệu vừa mở trả ±1e20** (chưa regen) — số vô nghĩa.
5. **Mở side database của bản vẽ ĐANG MỞ trong trình biên tập làm AutoCAD SẬP.** Soi
   tài liệu đang hoạt động thì dùng `doc.Database` + `doc.LockDocument()`.

Phép đo **quyết định** khi cần biết AutoCAD hiểu biên clip ở đâu: chạy XCLIP tuỳ chọn
*generate Polyline* rồi đọc vị trí polyline sinh ra. Nó không phụ thuộc giả định nào.

### 12.10 · Phạm vi test: **đúng 7 mẫu tòa**, lấy từ `TOWER_FILES`

`toa_dwg.json` có **16** mã nhưng app chỉ mời dùng **7** mã có bản vẽ thật, khai ở
`const TOWER_FILES` trong `shell.src.html`:
`hn_tm_i1 · hn_tm_l2 · hn_tm_u1 · hn_tm_z1 · hn_xh_i1 · hn_xh_u1 · hn_xh_z1`.

Đã cắn: vét cả 16 mã thì 8 lượt xuất đổ vào tòa app không dùng, và **AutoCAD sập trước
khi tới 3 tòa NOXH** — đúng 3 tòa cần kiểm. `scripts/kiemtra_xuat_cad.py` giờ đọc
`TOWER_FILES` từ nguồn và dừng ngay nếu không ra đúng 7 mã, nên không lặp lại được.

### 12.11 · CHƯA CHỮA: AutoCAD sập sau khoảng 8–12 lượt xuất trong một phiên

Side database giữ XREF không được giải phóng. Bỏ `Dispose()` (§11.2) chỉ **dịch ngưỡng
lên**, không chữa gốc: lượt thứ hai không còn sập, nhưng quãng 8–12 thì sập. Đã thấy
hai lần trong lượt này. Người dùng bấm Đồng bộ CAD nhiều lần trong một phiên AutoCAD sẽ
gặp. Cách tạm: khởi động lại AutoCAD sau mỗi ~8 lượt xuất.

---

## 13. ĐƠN VỊ mm · BLOCK DT_CH · XCLIPFRAME/GRIDMODE/LAYON (2026-09-08)

Chủ nhiệm yêu cầu 5 điều khi xuất CAD. Áp cho **cả ba đường** (Đồng bộ CAD · `.scr` · `.dxf`).

### 13.1 · Việc 0 — chuyển `data/dwg/x-thang/*.dwg` sang mm

Trước đó chỉ thư viện căn (`x-canho-bt`) được chuyển; 13 tệp lõi/thang còn `INSUNITS =
Meters`. Nếu bản vẽ chủ đặt mm mà lõi/thang còn Meters thì lõi vào **×1000**. Đã mở lần
lượt 13 tệp bằng `Database(False, True)` + `ReadDwgFile` → `db.Insunits =
UnitsValue.Millimeters` → `db.SaveAs(p, db.OriginalFileVersion)` (KHÔNG scale hình học —
hình vốn vẽ đúng mm, chỉ header khai sai, đúng lý do các tệp `x-canho-bt` từng khai
Meters). Nghiệm thu: đọc lại 13 tệp → `Millimeters` cả 13.

### 13.1b · Chọn nơi lưu khi bấm "Đồng bộ CAD" (2026-09-08)

`hoiDuongDanCAD()` hỏi đường dẫn ngay lúc bấm, gợi ý sẵn `<thư mục nhớ>/<tên tệp>`;
sửa được cả thư mục lẫn tên tệp; chỉ nhập thư mục thì tự thêm tên tệp; bấm **Huỷ là
không gửi gì**. Thư mục nhớ theo máy ở `localStorage["mdiux.cadout"]`.

⚠ **KHÔNG dùng `showDirectoryPicker()`** — trình duyệt cố tình chỉ trả một *handle*,
không trả đường dẫn ổ đĩa, mà AutoCAD thì cần đường dẫn **tuyệt đối**. Hộp chọn thư
mục của trình duyệt vô dụng ở đây; `prompt()` là đường duy nhất lấy được đường dẫn thật.

### 13.2 · Hằng số dùng chung — `DT_CH_SPEC` (`shell.src.html`)

Đặt gần khối "XUẤT HỒ SƠ". Số đo trực tiếp từ `data/dwg/block_dt_can.dwg` (block `DT_CH`):
khung 4843,8 × 2976,2 mm, gốc (0,0) = tâm cạnh ngang giữa; 6 nét (khung + ngang giữa +
vách dọc nửa dưới); 5 ATT căn giữa (`CH` h520, `TIM`/`TT`/`DT_TIM`/`DT_TT` h420).

**Toạ độ ATT là TÂM Ô tính lại, KHÔNG lấy toạ độ thô của tệp mẫu** (trong tệp mẫu chữ
lệch khỏi tâm ô vài trăm mm — `CH` ở x −395 thay vì 0, `DT_TIM` ở x −1944 thay vì
−1211). Chủ nhiệm chốt "các ATT đều căn nằm giữa các ô":

| tag | ô | x | y |
|---|---|---|---|
| `CH` | ô trên, cả bề rộng | **0** | **744,05** |
| `TIM` · `TT` | nửa dưới, hàng NHÃN | **∓1210,95** | **−372,0** |
| `DT_TIM` · `DT_TT` | nửa dưới, hàng SỐ | **∓1210,95** | **−1116,1** |

**`wf` = width factor 0,7 trên MỌI ATT** (ghi đè XScale 0,9 của kiểu chữ `MDI-VN`) — bóp
ngang để chuỗi dài như `CH-28 · 2PN · Loại 1` nằm gọn trong ô. Đi vào cả ba đường:
A `ad.WidthFactor` (+ `ar.WidthFactor`), B `(cons 41 0.700)`, C nhóm DXF `41`.

Helper
`dtchVals(c,u)` → `{CH: "<no> · <lbl> · <loaiCan>", TIM:"DT Tim", TT:"DT TT", DT_TIM, DT_TT}`;
`dtchAnchor(c)` = tâm block, đặt ở `c.d + TAG_OFF + 1500` (cao độ dòng tiêu đề nhãn cũ).
App **tự phát định nghĩa block** trong cả 3 đường — KHÔNG attach `block_dt_can.dwg`
(`build_shell.py` chỉ glob `data/dwg/<con>/*.dwg` một cấp nên tệp ở gốc không vào
`CAD.p`). Sửa `block_dt_can.dwg` thì phải đồng bộ tay `DT_CH_SPEC` (ghi chú ngay tại
hằng số).

### 13.3 · Ba đường

| | Đường A · Đồng bộ CAD (`PY_THAN`) | Đường B · `.scr` (`buildSCR`) | Đường C · `.dxf` (`buildDXF`) |
|---|---|---|---|
| Đơn vị | `nd.Insunits = Millimeters` | `INSUNITS 4` | `$INSUNITS 4` (vốn đã 4) |
| XCLIPFRAME | `nd.XclipFrame = 0` | `XCLIPFRAME 0` | `$XCLIPFRAME 70 0` |
| GRIDMODE | `ViewportTableRecord.GridEnabled = False` | `GRIDMODE 0` | `$GRIDMODE 70 0` |
| LAYON | vòng `lr.IsOff=False; lr.IsFrozen=False` (trừ lớp hiện hành) | `_-LAYER _T *\|* _ON *\|*` + `_-LAYER _ON *` | bảng lớp DXF mặc định bật |
| Block DT_CH | `BlockTableRecord` + `Line`×6 + `AttributeDefinition`×5; mỗi căn `BlockReference` + `AttributeReference`×5 (`SetAttributeFromBlock` + `AdjustAlignment`) | `emBlockDef()` phát `(entmake …)` cho BLOCK/LINE/ATTDEF/ENDBLK; `emInsertAtt()` phát INSERT `(66 . 1)` + ATTRIB×5 + SEQEND | `blockHead("DT_CH")` + `dxfLine`×6 + `dxfAttdef`×5; mỗi căn `dxfInsert` + `66 1` + `dxfAttrib`×5 + `SEQEND` |
| Chữ Việt | Unicode trực tiếp | `\U+XXXX` qua `dxfTxt()` → `lispCh()` | `\U+XXXX` qua `dxfTxt()` |

### 13.4 · Bất biến (`selfTest` QT-28) — nay 13 mục

Thêm: `.scr định nghĩa block DT_CH 1 lần`, `mỗi căn 1 INSERT DT_CH + 5 ATTRIB + SEQEND`,
`.scr đặt INSUNITS 4 · XCLIPFRAME 0 · GRIDMODE 0`. Công thức entmake đổi
`nCan*2 + 8 + nTruc + nBao` → `13 + nCan*7 + 8 + nTruc + nBao`.
`selfTest()` 307 → **311 mục / 1 fail** (QT-17). `scripts/chay_selftest.js` cổng: 307 → 311.

### 13.5 · Nghiệm thu 2026-09-08

- **Đường A** (side database qua cầu MCP, tòa `hn_tm_i1`): `insunits = 4`,
  `xclipframe = 0`, `layers_off = 0`, `xref = 7 · thiếu = []`, khung `102.925 × 26.576`
  (KHÔNG ×1000 → x-thang mm OK), mép trái 6.840,7. Mỗi căn 1 `BlockReference "DT_CH"` +
  5 `AttributeReference`; giá trị đúng (`CH-28 · 2PN · Loại 1` / `DT Tim 74.92` /
  `DT TT 70.92`).
- **Đường B** (chạy các `(entmake …)` của block-def + 1 insert thật trong AutoCAD): block
  `DT_CH` = 6 Line + 5 AttributeDefinition; INSERT có đủ 5 ATTRIB, chữ Việt `·`/`ạ` từ
  `\U+` hiện đúng.
- **Đường C**: kiểm cấu trúc chuỗi `.dxf` (`$INSUNITS 4` · `$GRIDMODE 0` · `$XCLIPFRAME
  0`; block `DT_CH` 6 LINE + 5 ATTDEF; 28 INSERT · 140 ATTRIB · 28 SEQEND). Round-trip
  đầy đủ trong AutoCAD **chưa chạy được** (phiên AutoCAD rớt khi đang test — xem §12.11
  về bất ổn khi thao tác nhiều tài liệu). Cần mở `.dxf` thật + `AUDIT` khi có AutoCAD.

---

## 14. NÚT "Dim" — ĐO KHOẢNG CÁCH (2026-09-08)

Chủ nhiệm: *"Đổi tính năng Nút DIM: chuyển thành cơ chế Dim khoảng cách giống CAD để
kiểm tra nhanh kích thước… Chiều Dim luôn song song với Hành lang."*

- Bấm nút → chế độ đo (con trỏ chữ thập). Bấm **điểm 1** → **điểm 2** hiện số; **bấm
  lần nữa là xoá và đo lại** chỗ khác. Bấm nút lần nữa để tắt.
- **Kéo pan vẫn dùng được trong lúc đo**: chỉ coi là "bấm" khi chuột dịch < 5 px giữa
  `pointerdown` và `pointerup`; xa hơn là kéo, không chốt điểm nào.
- **Chiều dim luôn song song hành lang**: `measTruc(p)` chọn **trục gần điểm nhất**
  (tòa L/U/Z nhiều trục khác phương — lấy `axes[0]` là chiếu sai phương ở cánh kia),
  rồi chiếu cả hai điểm lên trục đó. Số đọc ra là khoảng cách **trên trục**, KHÔNG phải
  khoảng cách xiên. Đã đo: hai điểm lệch cả x lẫn y cho **9.025 mm** (chiếu) trong khi
  khoảng cách xiên là 10.837 mm.
- Vẽ: 2 ô vuông đánh dấu điểm, 2 đường gióng, đường kích thước + vạch chéo kiến trúc,
  số ở giữa (viền nền `--plan-bg` để đọc được khi đè lên nhãn căn). Số cũng hiện ở
  thanh trạng thái: `Dim: 11600 mm (11.60 m)`.
- Trạng thái `MEASON`/`MEAS` để **ngoài `S`** (tạm, không lưu vào phương án `.json`), và
  `planSVG()` xoá rồi trả lại — đoạn đang đo dở không lọt vào bản in.
- `S.showDim` **không bị xoá**: bản in "trình phương án" vẫn bật chuỗi kích thước bằng
  `planSVG({dim:true})`. Chỉ có NÚT đổi việc; lớp cũ nay ép tắt trên màn hình (phương án
  lưu từ bản cũ có `showDim:true` sẽ không hiện lớp không tắt được nữa).

Nghiệm thu 2026-09-08 (giả lập chuỗi `pointerdown`/`pointerup` thật qua handler của app):
bật nút → `aria-pressed=true` + con trỏ chữ thập · **kéo pan KHÔNG chốt điểm** · bấm 1
= có điểm A · bấm 2 = ra `6000 mm` · bấm 3 = reset · tắt nút = lớp đo biến mất.
