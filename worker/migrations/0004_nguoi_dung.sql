-- Duyệt người dùng được tạo dự án (đăng nhập qua Cloudflare Access) và ghi người tạo từng dự án.
CREATE TABLE nguoi_dung (
  email TEXT PRIMARY KEY,
  trang_thai TEXT NOT NULL DEFAULT 'cho' CHECK (trang_thai IN ('cho', 'duyet', 'tu_choi')),
  yeu_cau_luc TEXT NOT NULL,
  duyet_luc TEXT,
  duyet_boi TEXT
);
ALTER TABLE du_an ADD COLUMN tao_boi TEXT NOT NULL DEFAULT '';
