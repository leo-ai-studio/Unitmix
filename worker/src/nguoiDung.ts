/**
 * Duyệt người được tạo dự án. Mail công ty đăng nhập lần đầu vào trạng thái "chờ"; quản trị (MAIL_QUAN_TRI) duyệt / từ chối / thu hồi.
 * Quản trị luôn được tạo. Chưa đặt `MIEN_TAO_DA` thì tắt cả cơ chế (ai cũng tạo được).
 */
import { thuocMien } from './danhTinh';

export type TrangThai = 'cho' | 'duyet' | 'tu_choi';
export type NguoiDung = { email: string; trang_thai: TrangThai; yeu_cau_luc: string; duyet_luc: string | null; duyet_boi: string | null };
export type LyDo = 'chua_dang_nhap' | 'sai_mien' | 'cho_duyet' | 'tu_choi';
export type QuyetDinh = { duocTao: boolean; laQuanTri: boolean; trangThai: TrangThai | null; lyDo: LyDo | null };

const chuanMail = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();
export const laQuanTri = (email: string | null, mailQT?: string): boolean => !!email && !!mailQT && chuanMail(email) === chuanMail(mailQT);

/** Quyết định thuần: có được tạo dự án không, và vì sao không. `trangThai` = trạng thái đã lưu của mail (null nếu chưa có). */
export function quyetDinhTao(i: { email: string | null; mien?: string; mailQuanTri?: string; trangThai: TrangThai | null }): QuyetDinh {
  const qt = laQuanTri(i.email, i.mailQuanTri);
  if (!i.mien) return { duocTao: true, laQuanTri: qt, trangThai: i.trangThai, lyDo: null };
  if (qt) return { duocTao: true, laQuanTri: true, trangThai: 'duyet', lyDo: null };
  if (!i.email) return { duocTao: false, laQuanTri: false, trangThai: null, lyDo: 'chua_dang_nhap' };
  // mail ngoài miền chỉ vào được khi quản trị đã duyệt riêng (thêm tay)
  if (!thuocMien(i.email, i.mien) && i.trangThai !== 'duyet') return { duocTao: false, laQuanTri: false, trangThai: i.trangThai, lyDo: 'sai_mien' };
  const tt = i.trangThai ?? 'cho';
  return { duocTao: tt === 'duyet', laQuanTri: false, trangThai: tt, lyDo: tt === 'duyet' ? null : tt === 'tu_choi' ? 'tu_choi' : 'cho_duyet' };
}

export const docTrangThai = async (db: D1Database, email: string): Promise<TrangThai | null> =>
  (await db.prepare('SELECT trang_thai FROM nguoi_dung WHERE email = ?').bind(chuanMail(email)).first<{ trang_thai: TrangThai }>())?.trang_thai ?? null;

/** Ghi nhận mail mới đăng nhập (chờ duyệt); đã có thì giữ nguyên. */
export const ghiNhanYeuCau = (db: D1Database, email: string, bay: string) =>
  db.prepare("INSERT OR IGNORE INTO nguoi_dung (email, trang_thai, yeu_cau_luc) VALUES (?, 'cho', ?)").bind(chuanMail(email), bay).run();

/** Quản trị đặt trạng thái (thêm mới nếu mail chưa có — duyệt trước cả mail chưa đăng nhập lần nào). */
export const datTrangThai = (db: D1Database, email: string, tt: TrangThai, boi: string, bay: string) =>
  db.prepare(
    `INSERT INTO nguoi_dung (email, trang_thai, yeu_cau_luc, duyet_luc, duyet_boi) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (email) DO UPDATE SET trang_thai = excluded.trang_thai, duyet_luc = excluded.duyet_luc, duyet_boi = excluded.duyet_boi`,
  ).bind(chuanMail(email), tt, bay, bay, chuanMail(boi)).run();

/** Dữ liệu trang quản trị: người dùng (chờ duyệt lên đầu) kèm số dự án đã tạo, và các dự án kèm người tạo. */
export async function lietKeQuanTri(db: D1Database) {
  const nguoi = await db.prepare(
    `SELECT n.email, n.trang_thai, n.yeu_cau_luc, n.duyet_luc, n.duyet_boi,
            (SELECT COUNT(*) FROM du_an d WHERE d.tao_boi = n.email AND d.xoa_luc IS NULL) AS so_du_an
     FROM nguoi_dung n
     ORDER BY CASE n.trang_thai WHEN 'cho' THEN 0 WHEN 'duyet' THEN 1 ELSE 2 END, n.yeu_cau_luc DESC`,
  ).all<NguoiDung & { so_du_an: number }>();
  const du_an = await db.prepare(
    `SELECT d.ma, d.ten, d.tao_boi, d.tao_luc, (SELECT COUNT(*) FROM phuong_an p WHERE p.du_an_ma = d.ma) AS so_pa
     FROM du_an d WHERE d.xoa_luc IS NULL ORDER BY d.tao_luc DESC LIMIT 500`,
  ).all<{ ma: string; ten: string; tao_boi: string; tao_luc: string; so_pa: number }>();
  return { nguoi: nguoi.results, du_an: du_an.results };
}
