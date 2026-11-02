-- Hồ sơ đăng ký của người dùng (họ tên, phòng / dự án phụ trách, ghi chú cho quản trị) để quản trị biết ai là ai khi duyệt.
ALTER TABLE nguoi_dung ADD COLUMN ho_ten TEXT NOT NULL DEFAULT '';
ALTER TABLE nguoi_dung ADD COLUMN phong TEXT NOT NULL DEFAULT '';
ALTER TABLE nguoi_dung ADD COLUMN ghi_chu TEXT NOT NULL DEFAULT '';
