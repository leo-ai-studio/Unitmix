# Thư viện CAD gốc (kéo từ MDI_Unitmix_v4, 27/10/2026)

Nguồn của mọi dữ liệu trong `web/public/lib`. Dùng để **bóc lại** hình học và **xuất ra XREF DWG / DXF**.
Không triển khai lên web (nằm ngoài `web/`).

| Thư mục | Nội dung | Tệp |
|---|---|---|
| `xref/x-canho-bt/` | Mẫu căn hộ `.dwg` (tên chuẩn `chtm_hn_2pn_m1_8500x7500.dwg`) + bảng `XREF_CanHo_BT_ChuanHoa.xlsx` + `_QUY_TAC_TEN_FILE.md` | 37 |
| `xref/x-mautoa-bt/` | Mẫu tòa `.dwg` (`mttm_hn_i1_2000_25t_bt.dwg`…) + bảng XREF tòa | 44 |
| `xref/x-thang/` | Lõi / thang `.dwg` + `XREF_Thang_ChuanHoa.xlsx` | 28 |
| `xref/block_dt_can.dwg`, `keo-hanh-lang.dwg` | Block nhãn DT căn; kéo hành lang | 2 |
| `dxf/` | Bản `.dxf` và `.dxf.dwg` của từng mẫu căn (đường C: nhúng hình học) | 37 |
| `tai_lieu/` | `QUY_TRINH_XUAT_CAD.md` (3 đường A/B/C, XCLIP mô-đun, 4 luật cứng), `HUONG-DAN_boc-CAD-sang-web.md`, … | 4 |

Luật cứng khi xuất (chi tiết trong `tai_lieu/QUY_TRINH_XUAT_CAD.md`): đường dẫn XREF **tương đối**, **không tắt lớp XREF**,
đơn vị bản vẽ **mm** (`INSUNITS 4`), cắt **XCLIP theo mô-đun**.
Không xoá cặp `.dxe` đi kèm `.dwg`. Tên tệp theo `_QUY_TAC_TEN_FILE.md`.

## Script bóc CAD: `scripts/boc_cad/`

Bản chép nguyên từ app cũ, đã đổi gốc đường dẫn về gốc repo này (`data/master/…` là nơi ghi đầu ra, không commit).
Chạy bằng Python 3 + `ezdxf`, `shapely`, `openpyxl`; bản `*_autocad.py` chạy trong AutoCAD (pyautocad / .NET). Bóc xong thì chạy
`python scripts/chep_thu_vien.py --nguon <thư mục chứa data/master>` để cập nhật `web/public/lib`.
Các bẫy đã gặp: mở bản vẽ tòa bằng Document thật (không `ResolveXrefs`); chạy `patch_qt22_bao_tm.py` sau bước bóc tòa.
