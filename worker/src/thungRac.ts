/** Thùng rác dự án: xoá mềm, khôi phục, dọn hẳn sau `ngayGiu` ngày. Mọi đọc dự án bình thường đều lọc `xoa_luc IS NULL`. */
export const NGAY_GIU_MAC_DINH = 30;
const NGAY_MS = 86_400_000;

export const ngayGiu = (v?: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : NGAY_GIU_MAC_DINH;
};

/** Chuyển dự án vào thùng rác; false nếu không có dự án (hoặc đã nằm trong thùng rác). */
export async function xoaMem(db: D1Database, ma: string, boi: string, bay: string): Promise<boolean> {
  const r = await db.prepare('UPDATE du_an SET xoa_luc = ?, xoa_boi = ? WHERE ma = ? AND xoa_luc IS NULL').bind(bay, boi, ma).run();
  return r.meta.changes > 0;
}

/** Khôi phục từ thùng rác; false nếu dự án không nằm trong thùng rác. */
export async function khoiPhuc(db: D1Database, ma: string): Promise<boolean> {
  const r = await db.prepare('UPDATE du_an SET xoa_luc = NULL, xoa_boi = \'\' WHERE ma = ? AND xoa_luc IS NOT NULL').bind(ma).run();
  return r.meta.changes > 0;
}

export type DuAnTrongRac = { ma: string; ten: string; tao_boi: string; xoa_luc: string; xoa_boi: string; so_pa: number; con_lai_ngay: number };

export async function dsThungRac(db: D1Database, ngay: number, bay = Date.now()): Promise<DuAnTrongRac[]> {
  const { results } = await db.prepare(
    `SELECT d.ma, d.ten, d.tao_boi, d.xoa_luc, d.xoa_boi, (SELECT COUNT(*) FROM phuong_an p WHERE p.du_an_ma = d.ma) AS so_pa
     FROM du_an d WHERE d.xoa_luc IS NOT NULL ORDER BY d.xoa_luc DESC`,
  ).all<Omit<DuAnTrongRac, 'con_lai_ngay'>>();
  return results.map((r) => ({ ...r, con_lai_ngay: Math.max(0, Math.ceil((Date.parse(r.xoa_luc) + ngay * NGAY_MS - bay) / NGAY_MS)) }));
}

/** Xoá hẳn các dự án nằm trong thùng rác quá `ngay` ngày (phương án đi theo qua ON DELETE CASCADE). Trả số dự án đã dọn. */
export async function donThungRac(db: D1Database, ngay: number, bay = Date.now()): Promise<number> {
  const han = new Date(bay - ngay * NGAY_MS).toISOString();
  // đếm trước: meta.changes của D1 tính cả hàng phương án bị xoá theo
  const n = (await db.prepare('SELECT COUNT(*) AS n FROM du_an WHERE xoa_luc IS NOT NULL AND xoa_luc < ?').bind(han).first<{ n: number }>())?.n ?? 0;
  if (n) await db.prepare('DELETE FROM du_an WHERE xoa_luc IS NOT NULL AND xoa_luc < ?').bind(han).run();
  return n;
}
