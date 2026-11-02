import { Hono, type Context } from 'hono';
import { bam, bangNhau, chuoiNgauNhien, taoMaDuAn, taoMaSua } from './maSua';
import { tuyenAI, type EnvAI } from './ai';
import { cauHinhBanDo, type EnvBanDo } from './banDo';
import { xuLyTram, type EnvTram } from './tram';
import { docDanhTinh, type EnvDanhTinh } from './danhTinh';
import { dsThungRac, donThungRac, khoiPhuc, ngayGiu, xoaMem } from './thungRac';
import { datTrangThai, docTrangThai, ghiNhanYeuCau, laQuanTri, lietKeQuanTri, quyetDinhTao, type TrangThai } from './nguoiDung';

export { Tram } from './tram';

type Env = { Bindings: EnvAI & EnvBanDo & EnvTram & EnvDanhTinh & { MAIL_QUAN_TRI?: string; NGAY_GIU_XOA?: string } };
const app = new Hono<Env>();
const GIOI_HAN_BODY = 2_000_000; // byte

type DuAnHang = { ma: string; ten: string; dia_diem: string; bam_ma_sua: string };

const docDuAn = (c: Context<Env>, ma: string) =>
  c.env.DB.prepare('SELECT ma, ten, dia_diem, bam_ma_sua FROM du_an WHERE ma = ? AND xoa_luc IS NULL').bind(ma).first<DuAnHang>();

async function duocSua(c: Context<Env>, da: DuAnHang): Promise<boolean> {
  const ma = c.req.header('X-Ma-Sua');
  return !!ma && bangNhau(await bam(ma), da.bam_ma_sua);
}

/** Đọc body JSON, chặn quá giới hạn; trả null nếu quá lớn. */
async function docBody<T>(c: Context<Env>): Promise<T | null> {
  const text = await c.req.text();
  if (new TextEncoder().encode(text).length > GIOI_HAN_BODY) return null;
  return JSON.parse(text || '{}') as T;
}

const bayGio = () => new Date().toISOString();
/** Tên người sửa tự khai: cắt khoảng trắng, tối đa 60 ký tự. */
const tenNguoi = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 60) : '');

/** Mail đã đăng nhập (qua Cloudflare Access) — null nếu chưa đăng nhập hoặc chưa bật Access. */
const emailDangNhap = (c: Context<Env>) => docDanhTinh(c.req.raw, c.env);

/**
 * Quyền tạo dự án của người đang gọi. Khi đặt `MIEN_TAO_DA`: mail công ty đăng nhập lần đầu được ghi "chờ duyệt", quản trị duyệt mới tạo được
 * (quản trị = `MAIL_QUAN_TRI`, luôn được tạo).
 */
async function quyenTao(c: Context<Env>) {
  const email = await emailDangNhap(c);
  let tt = email && c.env.MIEN_TAO_DA ? await docTrangThai(c.env.DB, email) : null;
  const q = quyetDinhTao({ email, mien: c.env.MIEN_TAO_DA, mailQuanTri: c.env.MAIL_QUAN_TRI, trangThai: tt });
  if (email && c.env.MIEN_TAO_DA && !q.laQuanTri && tt === null && q.lyDo !== 'sai_mien') { await ghiNhanYeuCau(c.env.DB, email, bayGio()); tt = 'cho'; }
  return { email, ...q, trangThai: q.trangThai ?? tt };
}

/** Tạo / nhân bản dự án: chưa đăng nhập 401; sai miền / chờ duyệt / bị từ chối 403 (mã lỗi nêu lý do). */
async function choPhepTao(c: Context<Env>): Promise<{ email: string | null } | Response> {
  const q = await quyenTao(c);
  if (q.duocTao) return { email: q.email };
  return c.json({ loi: q.lyDo }, q.lyDo === 'chua_dang_nhap' ? 401 : 403);
}

/** Chỉ quản trị (mail `MAIL_QUAN_TRI` đã đăng nhập Access) — 401 chưa đăng nhập, 403 không phải quản trị. */
async function choPhepQuanTri(c: Context<Env>): Promise<{ email: string } | Response> {
  const email = await emailDangNhap(c);
  if (!email) return c.json({ loi: 'chua_dang_nhap' }, 401);
  if (!laQuanTri(email, c.env.MAIL_QUAN_TRI)) return c.json({ loi: 'khong_phai_quan_tri' }, 403);
  return { email };
}

/** Người sửa ghi vào PA: đã đăng nhập thì lấy mail thật (không giả được), chưa thì tên tự khai. */
const nguoiSua = (email: string | null, khai: unknown) => email ?? tenNguoi(khai);

/** Cho giao diện biết: có yêu cầu đăng nhập không, đã đăng nhập chưa, được tạo chưa (hoặc đang chờ duyệt), có phải quản trị không. */
app.get('/api/toi', async (c) => {
  const q = await quyenTao(c);
  const soCho = q.laQuanTri ? (await lietKeQuanTri(c.env.DB)).nguoi.filter((n) => n.trang_thai === 'cho').length : 0;
  return c.json({ yeuCau: !!c.env.MIEN_TAO_DA, email: q.email, duocTao: q.duocTao, trangThai: q.trangThai, lyDo: q.lyDo, laQuanTri: q.laQuanTri, soCho, dangNhap: '/api/dang-nhap' });
});

/** Trang quản trị: danh sách người dùng + dự án kèm người tạo. */
app.get('/api/quan-tri', async (c) => {
  const q = await choPhepQuanTri(c);
  if (q instanceof Response) return q;
  const ngay = ngayGiu(c.env.NGAY_GIU_XOA);
  return c.json({ ...(await lietKeQuanTri(c.env.DB)), thung_rac: await dsThungRac(c.env.DB, ngay), ngay_giu: ngay });
});

/** Quản trị chuyển một dự án (bất kỳ) vào thùng rác. */
app.post('/api/quan-tri/xoa', async (c) => {
  const q = await choPhepQuanTri(c);
  if (q instanceof Response) return q;
  const b = await docBody<{ ma?: string }>(c);
  if (!b?.ma) return c.json({ loi: 'thieu_ma' }, 400);
  return (await xoaMem(c.env.DB, b.ma, q.email, bayGio())) ? c.json({ ok: true }) : c.json({ loi: 'khong_co' }, 404);
});

/** Khôi phục dự án từ thùng rác (còn trong thời hạn giữ). */
app.post('/api/quan-tri/khoi-phuc', async (c) => {
  const q = await choPhepQuanTri(c);
  if (q instanceof Response) return q;
  const b = await docBody<{ ma?: string }>(c);
  if (!b?.ma) return c.json({ loi: 'thieu_ma' }, 400);
  return (await khoiPhuc(c.env.DB, b.ma)) ? c.json({ ok: true }) : c.json({ loi: 'khong_co' }, 404);
});

/** Duyệt / từ chối / thu hồi (đặt về chờ) một mail; mail chưa có thì thêm mới (duyệt trước). */
app.post('/api/quan-tri/duyet', async (c) => {
  const q = await choPhepQuanTri(c);
  if (q instanceof Response) return q;
  const b = await docBody<{ email?: string; trang_thai?: string }>(c);
  if (!b) return c.json({ loi: 'qua_lon' }, 413);
  const email = (b.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ loi: 'mail_sai' }, 400);
  if (b.trang_thai !== 'duyet' && b.trang_thai !== 'tu_choi' && b.trang_thai !== 'cho') return c.json({ loi: 'trang_thai_sai' }, 400);
  await datTrangThai(c.env.DB, email, b.trang_thai as TrangThai, q.email, bayGio());
  return c.json({ ok: true });
});

/** Đích đăng nhập: Cloudflare Access chặn đường này; qua được là đã có cookie → quay về trang cũ (chỉ đường nội bộ). */
app.get('/api/dang-nhap', (c) => {
  const quay = c.req.query('quay') ?? '/';
  return c.redirect(quay.startsWith('/') && !quay.startsWith('//') ? quay : '/', 302);
});

app.post('/api/du-an', async (c) => {
  const quyen = await choPhepTao(c);
  if (quyen instanceof Response) return quyen;
  const b = await docBody<{ ten?: string; dia_diem?: string }>(c);
  if (!b) return c.json({ loi: 'qua_lon' }, 413);
  const ma = taoMaDuAn();
  const maSua = taoMaSua();
  await c.env.DB.prepare('INSERT INTO du_an (ma, ten, dia_diem, bam_ma_sua, tao_luc, tao_boi) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(ma, (b.ten ?? '').trim() || 'Dự án mới', (b.dia_diem ?? '').trim(), await bam(maSua), bayGio(), quyen.email ?? '')
    .run();
  return c.json({ ma, ma_sua: maSua }, 201);
});

app.get('/api/du-an/:ma', async (c) => {
  const da = await docDuAn(c, c.req.param('ma'));
  if (!da) return c.json({ loi: 'khong_co' }, 404);
  const { results } = await c.env.DB.prepare('SELECT id, ten, tom_tat, sua_luc, sua_boi FROM phuong_an WHERE du_an_ma = ? ORDER BY sua_luc DESC')
    .bind(da.ma)
    .all<{ id: string; ten: string; tom_tat: string; sua_luc: string; sua_boi: string }>();
  return c.json({
    ma: da.ma,
    ten: da.ten,
    dia_diem: da.dia_diem,
    phuong_an: results.map((r) => ({ ...r, tom_tat: JSON.parse(r.tom_tat) })),
  });
});

app.get('/api/du-an/:ma/kiem-ma', async (c) => {
  const da = await docDuAn(c, c.req.param('ma'));
  if (!da) return c.json({ loi: 'khong_co' }, 404);
  return c.json({ duocSua: await duocSua(c, da) });
});

app.get('/api/du-an/:ma/pa/:id', async (c) => {
  const r = await c.env.DB.prepare('SELECT id, ten, trang_thai, sua_luc, sua_boi FROM phuong_an WHERE du_an_ma = ? AND id = ?')
    .bind(c.req.param('ma'), c.req.param('id'))
    .first<{ id: string; ten: string; trang_thai: string; sua_luc: string; sua_boi: string }>();
  if (!r) return c.json({ loi: 'khong_co' }, 404);
  return c.json({ ...r, trang_thai: JSON.parse(r.trang_thai) });
});

/** Các lệnh ghi: phải có dự án và đúng mã sửa. */
async function choPhepGhi(c: Context<Env>): Promise<DuAnHang | Response> {
  const da = await docDuAn(c, c.req.param('ma')!);
  if (!da) return c.json({ loi: 'khong_co' }, 404);
  if (!(await duocSua(c, da))) return c.json({ loi: 'sai_ma_sua' }, 403);
  return da;
}

app.put('/api/du-an/:ma/pa/:id', async (c) => {
  const da = await choPhepGhi(c);
  if (da instanceof Response) return da;
  const b = await docBody<{ ten?: string; trang_thai?: unknown; tom_tat?: unknown; sua_boi?: string }>(c);
  if (!b) return c.json({ loi: 'qua_lon' }, 413);
  if (b.trang_thai === undefined) return c.json({ loi: 'thieu_trang_thai' }, 400);
  await c.env.DB.prepare(
    `INSERT INTO phuong_an (id, du_an_ma, ten, trang_thai, tom_tat, sua_luc, sua_boi) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (du_an_ma, id) DO UPDATE SET ten = excluded.ten, trang_thai = excluded.trang_thai, tom_tat = excluded.tom_tat, sua_luc = excluded.sua_luc, sua_boi = excluded.sua_boi`,
  )
    .bind(c.req.param('id'), da.ma, b.ten ?? 'PA', JSON.stringify(b.trang_thai), JSON.stringify(b.tom_tat ?? {}), bayGio(), nguoiSua(await emailDangNhap(c), b.sua_boi))
    .run();
  return c.json({ ok: true });
});

/** Ghi bù riêng tóm tắt PA (PA lưu trước khi có trường mới): không đổi trạng thái, giờ sửa, người sửa. */
app.put('/api/du-an/:ma/pa/:id/tom-tat', async (c) => {
  const da = await choPhepGhi(c);
  if (da instanceof Response) return da;
  const b = await docBody<{ tom_tat?: unknown }>(c);
  if (!b) return c.json({ loi: 'qua_lon' }, 413);
  if (!b.tom_tat || typeof b.tom_tat !== 'object') return c.json({ loi: 'thieu_tom_tat' }, 400);
  const r = await c.env.DB.prepare('UPDATE phuong_an SET tom_tat = ? WHERE du_an_ma = ? AND id = ?')
    .bind(JSON.stringify(b.tom_tat), da.ma, c.req.param('id'))
    .run();
  return r.meta.changes ? c.json({ ok: true }) : c.json({ loi: 'khong_co' }, 404);
});

/** Đổi tên (và địa điểm) dự án. Tên rỗng thì giữ tên cũ; địa điểm không gửi thì giữ nguyên. */
app.patch('/api/du-an/:ma', async (c) => {
  const da = await choPhepGhi(c);
  if (da instanceof Response) return da;
  const b = await docBody<{ ten?: string; dia_diem?: string }>(c);
  if (!b) return c.json({ loi: 'qua_lon' }, 413);
  const ten = (b.ten ?? '').trim();
  if (b.ten !== undefined && !ten) return c.json({ loi: 'ten_rong' }, 400);
  await c.env.DB.prepare('UPDATE du_an SET ten = ?, dia_diem = ? WHERE ma = ?')
    .bind(ten || da.ten, b.dia_diem === undefined ? da.dia_diem : b.dia_diem.trim(), da.ma)
    .run();
  return c.json({ ok: true });
});

/** Đổi tên một phương án, không đụng trạng thái. */
app.patch('/api/du-an/:ma/pa/:id', async (c) => {
  const da = await choPhepGhi(c);
  if (da instanceof Response) return da;
  const b = await docBody<{ ten?: string }>(c);
  if (!b) return c.json({ loi: 'qua_lon' }, 413);
  const ten = (b.ten ?? '').trim();
  if (!ten) return c.json({ loi: 'ten_rong' }, 400);
  const r = await c.env.DB.prepare('UPDATE phuong_an SET ten = ? WHERE du_an_ma = ? AND id = ?').bind(ten, da.ma, c.req.param('id')).run();
  if (!r.meta.changes) return c.json({ loi: 'khong_co' }, 404);
  return c.json({ ok: true });
});

app.post('/api/du-an/:ma/pa/:id/nhan-ban', async (c) => {
  const da = await choPhepGhi(c);
  if (da instanceof Response) return da;
  const b = await docBody<{ sua_boi?: string }>(c);
  if (!b) return c.json({ loi: 'qua_lon' }, 413);
  const goc = await c.env.DB.prepare('SELECT ten, trang_thai, tom_tat FROM phuong_an WHERE du_an_ma = ? AND id = ?')
    .bind(da.ma, c.req.param('id'))
    .first<{ ten: string; trang_thai: string; tom_tat: string }>();
  if (!goc) return c.json({ loi: 'khong_co' }, 404);
  const id = 'pa-' + chuoiNgauNhien(6);
  await c.env.DB.prepare('INSERT INTO phuong_an (id, du_an_ma, ten, trang_thai, tom_tat, sua_luc, sua_boi) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, da.ma, `${goc.ten} (bản sao)`, goc.trang_thai, goc.tom_tat, bayGio(), nguoiSua(await emailDangNhap(c), b.sua_boi))
    .run();
  return c.json({ id }, 201);
});

/**
 * Nhân bản cả dự án thành dự án MỚI (mã dự án + mã sửa mới, chủ là người gọi). Ai có link xem cũng nhân bản được —
 * họ vốn đã đọc được toàn bộ dữ liệu; bản sao không dính gì tới mã sửa của dự án gốc.
 */
app.post('/api/du-an/:ma/nhan-ban', async (c) => {
  const quyen = await choPhepTao(c);
  if (quyen instanceof Response) return quyen;
  const da = await docDuAn(c, c.req.param('ma'));
  if (!da) return c.json({ loi: 'khong_co' }, 404);
  const b = await docBody<{ ten?: string; sua_boi?: string }>(c);
  if (!b) return c.json({ loi: 'qua_lon' }, 413);
  const ma = taoMaDuAn();
  const maSua = taoMaSua();
  const bay = bayGio();
  const nguoi = nguoiSua(quyen.email, b.sua_boi);
  const { results } = await c.env.DB.prepare('SELECT id, ten, trang_thai, tom_tat FROM phuong_an WHERE du_an_ma = ?')
    .bind(da.ma)
    .all<{ id: string; ten: string; trang_thai: string; tom_tat: string }>();
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO du_an (ma, ten, dia_diem, bam_ma_sua, tao_luc, tao_boi) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(ma, (b.ten ?? '').trim() || `${da.ten} (bản sao)`, da.dia_diem, await bam(maSua), bay, quyen.email ?? ''),
    ...results.map((r) =>
      c.env.DB.prepare('INSERT INTO phuong_an (id, du_an_ma, ten, trang_thai, tom_tat, sua_luc, sua_boi) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(r.id, ma, r.ten, r.trang_thai, r.tom_tat, bay, nguoi)),
  ]);
  return c.json({ ma, ma_sua: maSua, so_pa: results.length }, 201);
});

/** Xoá dự án = chuyển vào thùng rác (giữ NGAY_GIU_XOA ngày, quản trị khôi phục được). Cần mã sửa. */
app.delete('/api/du-an/:ma', async (c) => {
  const da = await choPhepGhi(c);
  if (da instanceof Response) return da;
  await xoaMem(c.env.DB, da.ma, (await emailDangNhap(c)) ?? '', bayGio());
  return c.body(null, 204);
});

app.delete('/api/du-an/:ma/pa/:id', async (c) => {
  const da = await choPhepGhi(c);
  if (da instanceof Response) return da;
  await c.env.DB.prepare('DELETE FROM phuong_an WHERE du_an_ma = ? AND id = ?').bind(da.ma, c.req.param('id')).run();
  return c.body(null, 204);
});

// Leo AI bằng khoá chung (worker/src/ai.ts): trạng thái + cổng Messages cho SDK (baseURL /api/ai).
app.get('/api/ai/trang-thai', tuyenAI.trangThai);
// bản đồ nền: khoá Google Maps trình duyệt nếu chủ app đã đặt (worker/src/banDo.ts)
app.get('/api/ban-do/cau-hinh', (c) => cauHinhBanDo(c as never));
app.post('/api/ai/v1/messages', tuyenAI.chuyen);
// Leo AI bằng tài khoản Claude trên máy tính, cho điện thoại: trạm chuyển Durable Object (worker/src/tram.ts)
app.all('/api/tram/*', (c) => xuLyTram(c.req.raw, c.env));

app.notFound((c) => c.json({ loi: 'khong_co' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ loi: 'loi_may_chu' }, 500);
});

/** Tác vụ định kỳ (wrangler.toml [triggers]): dọn hẳn dự án nằm trong thùng rác quá NGAY_GIU_XOA ngày. */
export default {
  fetch: app.fetch,
  async scheduled(_ev: ScheduledController, env: Env['Bindings']) {
    await donThungRac(env.DB, ngayGiu(env.NGAY_GIU_XOA));
  },
} satisfies ExportedHandler<Env['Bindings']>;
