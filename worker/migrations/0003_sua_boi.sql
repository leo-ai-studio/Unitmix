-- Người sửa phương án gần nhất (tên tự khai trên máy người sửa; để trống nếu chưa khai).
ALTER TABLE phuong_an ADD COLUMN sua_boi TEXT NOT NULL DEFAULT '';
