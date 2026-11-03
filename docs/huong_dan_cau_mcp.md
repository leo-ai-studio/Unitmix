# Hướng dẫn: nối Claude (Claude Code / Claude Desktop) với app Unitmix qua cầu MCP

Cầu MCP cho Claude gọi thẳng bộ công cụ của app (như Leo AI) trên PA đang mở trong trình duyệt: đọc trạng thái, KPI, sửa tòa,
đổi căn, kiểm quy tắc… Hợp với việc lớn: nhập số liệu từ Excel / CAD rồi sửa hàng loạt, kiểm cả dự án.

```
Claude ──MCP──► cầu (scripts/mcp_unitmix/mdi_unitmix_mcp.py) ──127.0.0.1:3043──► trang app mở với ?congCu=1&mcp=3043
```

## 1. Cài một lần

Cần Python 3.9 trở lên (máy đã có `C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe`).

**Claude Code** — chạy trong terminal:

```
claude mcp add MDI-unitmix-connector -s user -- python E:/Unitmix/scripts/mcp_unitmix/mdi_unitmix_mcp.py
```

**Claude Desktop** — Settings › Developer › Edit Config, thêm vào `mcpServers` rồi khởi động lại Claude Desktop:

```json
"MDI-unitmix-connector": {
  "command": "C:\\Users\\Administrator\\AppData\\Local\\Programs\\Python\\Python312\\python.exe",
  "args": ["E:\\Unitmix\\scripts\\mcp_unitmix\\mdi_unitmix_mcp.py"]
}
```

Mở phiên Claude mới để nạp công cụ. Cầu tự chạy khi Claude cần, không phải bật tay.

## 2. Mỗi lần làm việc

1. Mở app trong **Chrome / Edge** (không dùng khung trình duyệt trong app Claude — khung đó chặn 127.0.0.1) với đuôi `&congCu=1&mcp=3043`:
   `https://unitmix.nghiavt-ai1.workers.dev/du-an/<mã dự án>?pa=<mã PA>&sua=<mã sửa>&congCu=1&mcp=3043`
   - Không có `sua=…` thì chỉ đọc được.
   - Chrome hỏi **"truy cập thiết bị trong mạng cục bộ"** → bấm **Cho phép** (một lần cho trang).
2. Giữ tab đó mở (có thể thu nhỏ). Đóng tab = ngắt cầu.
3. Nói với Claude việc cần làm. Claude bắt đầu bằng `unitmix_status` để biết đang nối dự án / PA nào.

Nên **nhân bản PA** trước khi cho Claude sửa hàng loạt (Claude làm được: `unitmix_call` `manage_pa` `duplicate`).

## 3. Công cụ Claude dùng

| Công cụ | Làm gì |
|---|---|
| `unitmix_status` | Có trang nào nối chưa, dự án / PA / chế độ sửa |
| `unitmix_list_tools` | Danh sách 47 công cụ app; `ten` = xem schema một công cụ |
| `unitmix_call` | Gọi một công cụ app; kết quả cắt theo `max_chars` (mặc định 6000) |
| `unitmix_call_many` | Nhiều lệnh một lượt, dừng ở lệnh lỗi |
| `unitmix_run_js` | Chạy hàm `async (T) => …` trong trang (T.chay(ten, dau_vao, {toiDa:0})) — lặp / lọc / tổng hợp trong trang, chỉ trả số cần → đỡ token nhất |

Ví dụ câu giao cho Claude: *"Nối Unitmix, cho tôi số căn, dân số, MĐXD từng lô cao tầng so ngưỡng QH, lô nào vượt."*

Cổng 3033 là của cầu AI Leo AI (`cau_claude.py`), nên cầu MCP dùng **3043**.

## 4. Gặp lỗi

| Thấy | Làm |
|---|---|
| "Chưa có trang Unitmix nào nối cầu" | Mở / tải lại tab app có `&congCu=1&mcp=3043`; kiểm đã bấm Cho phép mạng cục bộ (biểu tượng ổ khoá cạnh địa chỉ › Quyền) |
| "Trang không trả lời sau …s — có thể app đang treo" | Tải lại tab app rồi bảo Claude làm tiếp; việc vừa gửi có thể đã chạy một phần — kiểm lại |
| Sửa không được, báo chỉ xem | Link thiếu `sua=<mã sửa>` |
| Hai phiên Claude cùng mở | Bình thường: phiên sau gửi việc qua phiên đầu (cùng cổng 3043) |
| Muốn đổi cổng | Đặt biến `MDI_UNITMIX_PORT` cho cầu và dùng `&mcp=<cổng>` trên link |

Chi tiết kỹ thuật và các bẫy khi sửa PA hàng loạt: `docs/ghi_chu_sua_pa_hang_loat.md`.
