# AI_START — đọc trước khi làm (Unitmix)

Tệp này để AI (Claude Code, C2, agent) bắt đầu nhanh. Đọc xong tệp này và mục mới nhất của [NHAT_KY.md](NHAT_KY.md) là đủ để làm tiếp. Cuối mỗi đợt làm việc: thêm một mục vào `NHAT_KY.md`, sửa mục "Đang dở" bên dưới nếu đổi.

## Dự án

- App lập cơ cấu căn hộ: lô đất → xếp mẫu tòa (TMB) → tầng, căn → hầm → 3D → chi phí → so sánh PA. Web Preact + TypeScript + Vite (`web/`), API Cloudflare Worker + D1 (`worker/`), thư viện mẫu tòa / căn chép từ app cũ `E:\Projects\MDI_Unitmix_v4` (chỉ đọc).
- Phiên bản hiện ở chân trang Dự án và khi rê logo (`web/src/phienBan.ts`, `define` trong `web/vite.config.ts`): `vX.Y.Z · mã commit(+ nếu có sửa chưa commit) · ngày build`. Đợt lớn thì nâng số trong `package.json`, `web/package.json`, `package-lock.json` (3 chỗ).
- Remote: `https://github.com/leo-ai-studio/Unitmix.git`, nhánh `main`. Chỉ push khi người dùng bảo.

## Chạy và kiểm

```bash
cd web && npx tsc --noEmit; echo $?     # phải ra 0 — đừng nối "| tail" sau tsc, sẽ nuốt mã lỗi
cd web && npx vitest run                # testTimeout 30 s vì vài test quét tệp XREF trên đĩa
cd worker && npx vitest run
python -m pytest tests -q               # kiểm quy_tac.json, thư viện
cd web && npx vite build
```

Chạy thử: dev server cổng 5180 (`.claude/launch.json` tên `web`), API `wrangler dev` cổng 8787 (DB local, tạo dự án thử thoải mái). Agent chạy vite riêng ở cổng khác (5191, 5291, 5377…) — tab trình duyệt dùng chung có thể bị agent đổi sang cổng của nó; kiểm `location.port` trước khi kết luận.

## Quy tắc bất di bất dịch

1. **Khung làm việc giữa (TMB, MB tầng, 3D) không bị bóp, không xô lệch.** Bản vẽ / 3D phủ kín `.panel-giua`; thanh nút, chú giải, thông báo, menu là lớp phủ (`.noi-tren`, `.noi-duoi`, `.lop-thong-bao`, `position: fixed`). Đo lại sau mọi thay đổi giao diện (xem `docs/hieu_ung_ui.md`).
2. **QCVN tra từ kho** `E:\OneDrive\_QCVN-TCVN\` (chỉ có PDF; trích chữ bằng PyMuPDF rồi grep). Không bịa số hiệu / điều khoản / trị số. Ghi điều khoản kèm mỗi luật / tooltip.
3. **Số chưa có căn cứ là "giá trị tạm, chờ chủ nhiệm chốt"** — ghi rõ trên giao diện và trong mã.
4. **Hiệu ứng**: không thư viện; CSS + `requestAnimationFrame`; đang kéo / chụm bám tay 1:1; tôn trọng `prefers-reduced-motion`; tải dùng vòng O `img.spin-o` (kit LEO), không spinner tròn.
5. Mã: tên tiếng Việt không dấu (`vuaKhung`, `dtSanChiTiet`), chú thích ngắn tiếng Việt; chữ hiển thị qua i18n ở CẢ `vi.json` và `en.json`; ô trống ra "—" (`fmtSo`), không `undefined` / `NaN`.
6. Tự chỉnh như app cũ: tối ưu / sắp xếp tự động bật mặc định, theo logic `MDI_Unitmix_v4` (QT-81 STRETCH, MT-05 lập PA) — người dùng đã yêu cầu rõ.

## Bẫy đã gặp (đừng lặp lại)

- **Xuống dòng**: repo trộn LF và CRLF; `web/src/i18n/*.json`, `package.json`, `package-lock.json`, nhiều tệp `.tsx` là CRLF trong cây làm việc. `sed -i` / `json.dump` / ghi lại cả tệp sẽ đổi hết dòng → diff phình, gộp nhánh xung đột cả tệp. Sửa bằng Edit hoặc Python đọc/ghi `newline=''` và giữ kiểu dòng gốc. Kiểm bằng `git diff --stat`.
- **Gộp nhánh agent bị xung đột cả tệp**: do khác kiểu dòng giữa hai bên. Cách gộp: lấy 3 bản (`git show HEAD:f`, merge-base, nhánh) → bỏ `\r` → `git merge-file` → giải khối thật → ghi lại theo kiểu dòng của HEAD.
- **Worktree của agent** (`isolation: worktree`) tách từ `main`, không từ nhánh đang làm → trong lời giao việc luôn bắt agent `git reset --hard <nhánh tích hợp>` (hoặc `merge --ff-only`) trước.
- `quy_tac.json` có kiểm pytest: mỗi luật phải có `ma_cu` (luật mới thì `bo_sung: true` + `nguon`), trong mỗi bước luật bắt buộc đứng trước luật nội bộ.
- Hai agent cùng sửa một tệp lớn (`ManTang.tsx`, `SoanThao.tsx`, `ThanhTren.tsx`, `main.tsx`, i18n) → chia quyền sở hữu tệp trong lời giao việc; CSS mỗi gói một tệp riêng import ở `main.tsx`.

## Bản đồ mã (chỗ hay sửa)

| Việc | Tệp |
|---|---|
| Kiểu PA, thư viện | `web/src/tinh/kieu.ts`, mặc định + chuẩn hoá PA cũ `tinh/macDinh.ts` (`chuanHoaPA`) |
| Chỉ tiêu, DT sàn HSSDĐ (QCVN 01 1.4.21) | `tinh/chiTieu.ts` (`dtSanChiTiet`) |
| Bố cục tầng, công năng ô, nhiều tầng | `tinh/matBang.ts`, `tinh/congNang.ts`, `tinh/doiCan.ts`, `man/ManTang.tsx`, `ve/MatBangTang.tsx` |
| Luật | `web/public/lib/quy_tac.json` (sinh bởi `scripts/chep_quy_tac.py`), `tinh/quyTac.ts`, `tinh/qcvn04.ts`, `tinh/pccc.ts` |
| Phòng (bóc CAD) | `scripts/boc_cad/boc_phong.py` → `web/public/lib/can.json` (`phong`), `tinh/phong.ts`, `ve/LopPhong.tsx` |
| Hầm | `tinh/ham.ts`, `tinh/raiCho.ts`, `man/ManHam.tsx`, `ve/MatBangHam.tsx`, `ve/VeRanh.tsx` |
| Bản vẽ 2D, zoom / pan | `ve/BanVe.tsx`; 3D `ve3d/*` |
| Khung soạn, thanh trên | `ui/KhungSoan.tsx`, `ui/ThanhTren.tsx`, `man/SoanThao.tsx` |
| Preset, lưu | `kho/preset.ts`, `kho/kho.ts`, `kho/luu.ts` |
| Xuất | `xuat/xuatCad.ts`, `xuat/xuatXls.ts`, `man/HopXuatCad.tsx` |
| So sánh PA | `man/SoSanhPA.tsx`, `tinh/diemPA.ts` |
| Tự xếp tòa, tối ưu tầng | `tinh/xepToa.ts`, `ui/GoiYXepToa.tsx`, `tinh/toiUu.ts`, `tinh/stretch.ts`, `tinh/khe.ts` |
| Chi phí, tài chính | `tinh/duToan.ts`, `tinh/taiChinh.ts`, `man/ManChiPhi.tsx`, số tạm `CHI_PHI_MAC_DINH` trong `tinh/macDinh.ts` |

## Tài liệu khác

- `docs/hoc_architechtures_app_2026-10-27.md` — học Architechtures, chọn lọc theo QCVN, mục 6 = đã làm / chờ chốt.
- `docs/doi_chieu_architechtures.md` — bảng đối chiếu tính năng (bản đầu).
- `docs/hieu_ung_ui.md` — hiệu ứng H1–H19 + quy tắc khung giữa cố định.
- `docs/quy_tac_xep_can.md` — quy tắc xếp căn.

## Đang dở (cập nhật mỗi đợt)

- Tab Chi phí đã gộp (`tinh/duToan.ts`, `tinh/taiChinh.ts`, `man/ManChiPhi.tsx`) — mọi đơn giá / giá bán là số tạm trong `CHI_PHI_MAC_DINH`, chờ QS chốt; thang máy chưa đếm từ lõi.
- Đơn giá dự toán = định mức app cũ (`dinh_muc_du_toan.json`), xem chú thích `CHI_PHI_MAC_DINH`. Chưa có: QLDA lũy thoái TT 38/2026, chọn nhóm 8 / 15 tầng theo tòa.
- Đã có: gợi ý xếp tòa MT-05 (`tinh/xepToa.ts`), tối ưu tầng + STRETCH (`tinh/stretch.ts`, `tinh/toiUu.ts`), dồn khít XC-04. Chưa có: XC-03, XC-05, XC-06, XC-07, PC-11 (lõi / sảnh / hành lang cố định theo mẫu tòa — cần mô hình tầng mới), STRETCH tay, CAD / 3D căn kéo.
- Chờ chủ nhiệm chốt: xem `hoc_architechtures_app_2026-10-27.md` mục 6.
