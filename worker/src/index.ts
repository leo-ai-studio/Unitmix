import { Hono, type Context } from 'hono';
import { bam, bangNhau, chuoiNgauNhien, taoMaDuAn, taoMaSua } from './maSua';
import { tuyenAI, type EnvAI } from './ai';
import { cauHinhBanDo, type EnvBanDo } from './banDo';
import { xuLyTram, type EnvTram } from './tram';

export { Tram } from './tram';

type Env = { Bindings: EnvAI & EnvBanDo & EnvTram };
const app = new Hono<Env>();
const GIOI_HAN_BODY = 2_000_000; // byte

type DuAnHang = { ma: string; ten: string; dia_diem: string; bam_ma_sua: string };

const docDuAn = (c: Context<Env>, ma: string) =>
  c.env.DB.prepare('SELECT ma, ten, dia_diem, bam_ma_sua FROM du_an WHERE ma = ?').bind(ma).first<DuAnHang>();

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

app.post('/api/du-an', async (c) => {
  const b = await docBody<{ ten?: string; dia_diem?: string }>(c);
  if (!b) return c.json({ loi: 'qua_lon' }, 413);
  const ma = taoMaDuAn();
  const maSua = taoMaSua();
  await c.env.DB.prepare('INSERT INTO du_an (ma, ten, dia_diem, bam_ma_sua, tao_luc) VALUES (?, ?, ?, ?, ?)')
    .bind(ma, (b.ten ?? '').trim() || 'Dự án mới', (b.dia_diem ?? '').trim(), await bam(maSua), bayGio())
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
    .bind(c.req.param('id'), da.ma, b.ten ?? 'PA', JSON.stringify(b.trang_thai), JSON.stringify(b.tom_tat ?? {}), bayGio(), tenNguoi(b.sua_boi))
    .run();
  return c.json({ ok: true });
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
    .bind(id, da.ma, `${goc.ten} (bản sao)`, goc.trang_thai, goc.tom_tat, bayGio(), tenNguoi(b.sua_boi))
    .run();
  return c.json({ id }, 201);
});

/**
 * Nhân bản cả dự án thành dự án MỚI (mã dự án + mã sửa mới, chủ là người gọi). Ai có link xem cũng nhân bản được —
 * họ vốn đã đọc được toàn bộ dữ liệu; bản sao không dính gì tới mã sửa của dự án gốc.
 */
app.post('/api/du-an/:ma/nhan-ban', async (c) => {
  const da = await docDuAn(c, c.req.param('ma'));
  if (!da) return c.json({ loi: 'khong_co' }, 404);
  const b = await docBody<{ ten?: string; sua_boi?: string }>(c);
  if (!b) return c.json({ loi: 'qua_lon' }, 413);
  const ma = taoMaDuAn();
  const maSua = taoMaSua();
  const bay = bayGio();
  const nguoi = tenNguoi(b.sua_boi);
  const { results } = await c.env.DB.prepare('SELECT id, ten, trang_thai, tom_tat FROM phuong_an WHERE du_an_ma = ?')
    .bind(da.ma)
    .all<{ id: string; ten: string; trang_thai: string; tom_tat: string }>();
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO du_an (ma, ten, dia_diem, bam_ma_sua, tao_luc) VALUES (?, ?, ?, ?, ?)')
      .bind(ma, (b.ten ?? '').trim() || `${da.ten} (bản sao)`, da.dia_diem, await bam(maSua), bay),
    ...results.map((r) =>
      c.env.DB.prepare('INSERT INTO phuong_an (id, du_an_ma, ten, trang_thai, tom_tat, sua_luc, sua_boi) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(r.id, ma, r.ten, r.trang_thai, r.tom_tat, bay, nguoi)),
  ]);
  return c.json({ ma, ma_sua: maSua, so_pa: results.length }, 201);
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

export default app;
