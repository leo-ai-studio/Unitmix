-- Leo AI (khoá chung của máy chủ): đếm lượt gọi mỗi ngày theo dự án và theo IP (đã băm SHA-256, không lưu IP rõ).
CREATE TABLE ai_luot (
  ngay TEXT NOT NULL,
  khoa TEXT NOT NULL,
  so INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ngay, khoa)
);
