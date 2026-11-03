# Ghi chú: sửa PA hàng loạt qua cổng `window.unitmixTools`

Rút ra từ đợt dựng lại 79 tòa Long Biên theo sheet `VTK_Tháp (17)` (2026-11-02). Dùng khi phải sửa nhiều tòa / nhiều lô cùng lúc.

## Cách nối
- **Cầu MCP (nên dùng)**: đăng ký một lần `claude mcp add MDI-unitmix-connector -s user -- python E:/Unitmix/scripts/mcp_unitmix/mdi_unitmix_mcp.py`, mở app với `…&congCu=1&mcp=3043` (cho phép truy cập mạng cục bộ khi Chrome hỏi), rồi dùng `unitmix_status` → `unitmix_call` / `unitmix_call_many` / `unitmix_run_js`. Việc lặp nhiều tòa: viết hàm trong `unitmix_run_js`, chỉ trả số tổng hợp.
- Mở `/du-an/<mã>?pa=<id>&congCu=1` (thêm `&sua=<mã sửa>` để sửa được; link chỉ đọc thì mọi công cụ sửa bị chặn). `window.unitmixTools.danhSach()` liệt kê 47 công cụ, `chay(ten, args)` gọi.
- Luôn **nhân bản PA** (`manage_pa duplicate`) rồi sửa trên bản sao.
- Đọc dữ liệu thật của PA: `GET /api/du-an/<mã>/pa/<id>` từ **trong trình duyệt** (Python bị 403). `trang_thai.toa[]` có `x, y, gocDo, soTangDH, duongBao, canTheo…`, `trang_thai.lo[]` có `ranh` (m). `get_state` bị cắt ở 12.000 ký tự nên không đọc được hết 79 tòa.

## Bẫy đã gặp
- Máy chủ chỉ cập nhật sau vài chục giây; đọc lại ngay sẽ thấy dữ liệu cũ. Chờ rồi mới kiểm.
- App **treo** (kể cả JS đồng bộ) ở vài vị trí tòa sát nhau khi dò từng bước bằng `update_tower` / `add_tower`. Chạy việc dài trong nền, ghi tiến độ vào `localStorage`, thăm dò từ tab khác; treo thì tải lại trang và chạy tiếp (tòa gây treo ghi vào danh sách bỏ qua).
- `delete_units` xóa ô **vĩnh viễn**: ô không còn địa chỉ, `reset_floor_units` và `add_unit` không lấy lại được căn góc G. Muốn lấy lại phải xóa tòa rồi `add_tower` mới (giữ x, y, `angle`).
- `change_units` (đổi mẫu căn) luôn khiến app tự thêm thang `tb…` (PC-11). `delete_units` thì không. Xóa thang thừa bằng `stairs delete` và đặt lại loại N2 / N3 như mẫu gốc (`set_type`); đừng gọi `reset_auto` (nó thêm lại thang `tbr0`).
- Căn góc V / Y cạnh lõi không đổi được (`Mẫu … không đổi được ở ô đang dùng`). Căn G chỉ ở ô góc; thêm / đổi căn G vào ô giữa bị chặn.
- DTXD 1 sàn = DTXD mẫu gốc + 0,0085 m² × (tổng đổi bề ngang mm). Stretch căn chỉ chia lại bề ngang trong dãy nên **không** đổi DTXD.
- Xóa một căn làm dãy đó ngắn lại ở đầu tự do. Hai dãy đối diện phải đổi bề ngang bằng nhau (± ~1 m) mới không lệch. Cách đo: nhãn `CH-xx` trong DOM (`text` SVG) cho tọa độ từng căn; đầu dãy đang thẳng hàng ở mẫu gốc là đầu cần giữ thẳng.
- Nút của app: màn Tầng › "Áp dụng sửa cho › Cả dự án · mọi tòa cùng mẫu" — sửa một tòa rồi áp cho cả mẫu, nhanh hơn chạy từng tòa.

## Quy tắc xếp tòa vào lô (mô hình ngoài app, khớp bộ kiểm của app)
- LO-05: tòa trong ranh lô (không có chỉ giới thì ranh). LO-01: H ≥ 28 m lùi 6 m mọi cạnh (lô chưa khai lộ giới = đường 12 m). LO-02 (§2.6.1): H ≥ 46 m thì ≥ 15 m (đầu hồi, lỗi) và nên ≥ 25 m (cạnh dài); H < 46 m thì max(H/3, 4) / max(H/2, 7).
- Chân tòa = đường bao `duongBao` của tòa, trừ tâm khung bao đường bao MẪU (`web/public/lib/toa.json`), chia 1000, xoay `gocDo`, dời (x, y).
- Tìm vị trí / góc từng lô bằng mô phỏng luyện kim (SA) trên mô hình trên; áp bằng `update_tower`; đối chiếu `canh_bao` của chính app.
