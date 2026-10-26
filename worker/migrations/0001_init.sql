-- Dự án (mỗi dự án một mã link) và phương án (trạng thái lưu dạng JSON).
CREATE TABLE du_an (
  ma TEXT PRIMARY KEY,
  ten TEXT NOT NULL,
  dia_diem TEXT NOT NULL DEFAULT '',
  bam_ma_sua TEXT NOT NULL,
  tao_luc TEXT NOT NULL
);

CREATE TABLE phuong_an (
  id TEXT NOT NULL,
  du_an_ma TEXT NOT NULL REFERENCES du_an(ma) ON DELETE CASCADE,
  ten TEXT NOT NULL,
  trang_thai TEXT NOT NULL,
  tom_tat TEXT NOT NULL DEFAULT '{}',
  sua_luc TEXT NOT NULL,
  PRIMARY KEY (du_an_ma, id)
);
