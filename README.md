# Unitmix

Lập cơ cấu căn hộ từ chỉ tiêu quy hoạch: lô đất → xếp mẫu tòa → tầng, căn → hầm → 3D → so sánh phương án.
Web: https://unitmix.leo-ai.dev · Người tạo: NghiaVT · Nhận diện: LEO AI

- Thiết kế: `docs/superpowers/specs/2026-10-27-unitmix-moi-design.md`
- Kế hoạch: `docs/superpowers/plans/2026-10-27-unitmix.md`
- Thư viện mẫu tòa, mẫu căn: `web/public/lib/` (chép từ MDI_Unitmix_v4, chỉ đọc). Chép lại:
  `python scripts/chep_thu_vien.py --nguon E:\Projects\MDI_Unitmix_v4 --bang-ten`, rồi `python -m pytest tests -q`.
  Bảng tên cũ → mới: `docs/thu_vien_ten.md`.
