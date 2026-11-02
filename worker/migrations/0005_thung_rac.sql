-- Thùng rác dự án: xoá mềm (xoa_luc đặt = đã xoá), giữ NGAY_GIU_XOA ngày rồi tác vụ định kỳ mới xoá hẳn.
ALTER TABLE du_an ADD COLUMN xoa_luc TEXT;
ALTER TABLE du_an ADD COLUMN xoa_boi TEXT NOT NULL DEFAULT '';
