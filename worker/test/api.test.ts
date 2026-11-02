import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const goi = (duong: string, init: RequestInit = {}) => SELF.fetch(`https://unitmix.leo-ai.dev${duong}`, init);
const json = (body: unknown, maSua?: string): RequestInit => ({
  method: 'PUT',
  headers: { 'content-type': 'application/json', ...(maSua ? { 'X-Ma-Sua': maSua } : {}) },
  body: JSON.stringify(body),
});
const PA = { ten: 'PA 1', trang_thai: { phienBan: 1, toa: [] }, tom_tat: { soCan: 0 } };

async function taoDuAn() {
  const r = await goi('/api/du-an', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ten: 'Lô CC-02', dia_diem: 'Hà Đông' }) });
  expect(r.status).toBe(201);
  return (await r.json()) as { ma: string; ma_sua: string };
}

describe('API dự án và phương án', () => {
  it('tạo dự án trả mã 8 ký tự và mã sửa; mã sửa không lưu dạng rõ', async () => {
    const { ma, ma_sua } = await taoDuAn();
    expect(ma).toMatch(/^[a-z0-9]{8}$/);
    expect(ma_sua).toMatch(/^[A-Za-z0-9]{20}$/);
    const hang = await env.DB.prepare('SELECT * FROM du_an WHERE ma = ?').bind(ma).first();
    expect(JSON.stringify(hang)).not.toContain(ma_sua);
  });

  it('ghi không có mã sửa -> 403 và không đổi dữ liệu', async () => {
    const { ma } = await taoDuAn();
    expect((await goi(`/api/du-an/${ma}/pa/p1`, json(PA))).status).toBe(403);
    expect((await goi(`/api/du-an/${ma}/pa/p1`, json(PA, 'saima'))).status).toBe(403);
    const da = (await (await goi(`/api/du-an/${ma}`)).json()) as { phuong_an: unknown[] };
    expect(da.phuong_an).toHaveLength(0);
  });

  it('ghi đúng mã -> đọc lại đúng trạng thái; nhân bản ra 2 PA; xoá sai mã -> 403', async () => {
    const { ma, ma_sua } = await taoDuAn();
    expect((await goi(`/api/du-an/${ma}/pa/p1`, json(PA, ma_sua))).status).toBe(200);
    const pa = (await (await goi(`/api/du-an/${ma}/pa/p1`)).json()) as { ten: string; trang_thai: unknown };
    expect(pa).toMatchObject({ ten: 'PA 1', trang_thai: PA.trang_thai });

    const nb = await goi(`/api/du-an/${ma}/pa/p1/nhan-ban`, { method: 'POST', headers: { 'X-Ma-Sua': ma_sua } });
    expect(nb.status).toBe(201);
    const ds = (await (await goi(`/api/du-an/${ma}`)).json()) as { ten: string; phuong_an: { id: string; tom_tat: unknown }[] };
    expect(ds.ten).toBe('Lô CC-02');
    expect(ds.phuong_an).toHaveLength(2);
    expect(ds.phuong_an[0].tom_tat).toEqual({ soCan: 0 });

    expect((await goi(`/api/du-an/${ma}/pa/p1`, { method: 'DELETE', headers: { 'X-Ma-Sua': 'sai' } })).status).toBe(403);
    expect((await goi(`/api/du-an/${ma}/pa/p1`, { method: 'DELETE', headers: { 'X-Ma-Sua': ma_sua } })).status).toBe(204);
  });

  it('ghi bù tóm tắt: đổi tom_tat, giữ nguyên giờ + người sửa; sai mã -> 403', async () => {
    const { ma, ma_sua } = await taoDuAn();
    await goi(`/api/du-an/${ma}/pa/p1`, json({ ...PA, sua_boi: 'An' }, ma_sua));
    const truoc = (await (await goi(`/api/du-an/${ma}`)).json()) as { phuong_an: { sua_luc: string; sua_boi: string }[] };
    expect((await goi(`/api/du-an/${ma}/pa/p1/tom-tat`, json({ tom_tat: { danSo: 9 } }, 'sai'))).status).toBe(403);
    expect((await goi(`/api/du-an/${ma}/pa/p1/tom-tat`, json({ tom_tat: { soCan: 5, danSo: 9 } }, ma_sua))).status).toBe(200);
    expect((await goi(`/api/du-an/${ma}/pa/khong-co/tom-tat`, json({ tom_tat: { danSo: 1 } }, ma_sua))).status).toBe(404);
    const sau = (await (await goi(`/api/du-an/${ma}`)).json()) as { phuong_an: { tom_tat: unknown; sua_luc: string; sua_boi: string }[] };
    expect(sau.phuong_an[0].tom_tat).toEqual({ soCan: 5, danSo: 9 });
    expect(sau.phuong_an[0].sua_luc).toBe(truoc.phuong_an[0].sua_luc);
    expect(sau.phuong_an[0].sua_boi).toBe(truoc.phuong_an[0].sua_boi);
  });

  it('dự án hoặc PA không tồn tại -> 404', async () => {
    expect((await goi('/api/du-an/khongco1')).status).toBe(404);
    const { ma } = await taoDuAn();
    expect((await goi(`/api/du-an/${ma}/pa/khong`)).status).toBe(404);
  });

  it('body quá 2 MB -> 413', async () => {
    const { ma, ma_sua } = await taoDuAn();
    const lon = { ...PA, trang_thai: { x: 'a'.repeat(2_100_000) } };
    expect((await goi(`/api/du-an/${ma}/pa/p1`, json(lon, ma_sua))).status).toBe(413);
  });

  it('kiểm mã sửa: link sửa trả 200, link xem trả quyền chỉ xem', async () => {
    const { ma, ma_sua } = await taoDuAn();
    const dung = (await (await goi(`/api/du-an/${ma}/kiem-ma`, { headers: { 'X-Ma-Sua': ma_sua } })).json()) as { duocSua: boolean };
    const sai = (await (await goi(`/api/du-an/${ma}/kiem-ma`, { headers: { 'X-Ma-Sua': 'x' } })).json()) as { duocSua: boolean };
    expect(dung.duocSua).toBe(true);
    expect(sai.duocSua).toBe(false);
  });

  it('đổi tên dự án và phương án cần mã sửa; tên rỗng bị từ chối; không đụng trạng thái PA', async () => {
    const { ma, ma_sua } = await taoDuAn();
    await goi(`/api/du-an/${ma}/pa/p1`, json(PA, ma_sua));
    const patch = (duong: string, body: unknown, maSua?: string): Promise<Response> =>
      goi(duong, { method: 'PATCH', headers: { 'content-type': 'application/json', ...(maSua ? { 'X-Ma-Sua': maSua } : {}) }, body: JSON.stringify(body) });
    expect((await patch(`/api/du-an/${ma}`, { ten: 'X' })).status).toBe(403);
    expect((await patch(`/api/du-an/${ma}/pa/p1`, { ten: 'X' }, 'saima')).status).toBe(403);
    expect((await patch(`/api/du-an/${ma}`, { ten: '  ' }, ma_sua)).status).toBe(400);
    expect((await patch(`/api/du-an/${ma}/pa/p1`, { ten: '' }, ma_sua)).status).toBe(400);
    expect((await patch(`/api/du-an/${ma}/pa/khongco`, { ten: 'X' }, ma_sua)).status).toBe(404);
    expect((await patch(`/api/du-an/${ma}`, { ten: '  M7 Đan Phượng ', dia_diem: 'Hà Nội' }, ma_sua)).status).toBe(200);
    expect((await patch(`/api/du-an/${ma}/pa/p1`, { ten: 'PA chốt' }, ma_sua)).status).toBe(200);
    const da = (await (await goi(`/api/du-an/${ma}`)).json()) as { ten: string; dia_diem: string; phuong_an: { ten: string }[] };
    expect([da.ten, da.dia_diem, da.phuong_an[0].ten]).toEqual(['M7 Đan Phượng', 'Hà Nội', 'PA chốt']);
    const pa = (await (await goi(`/api/du-an/${ma}/pa/p1`)).json()) as { trang_thai: unknown };
    expect(pa.trang_thai).toEqual(PA.trang_thai);
    // chỉ gửi địa điểm: giữ tên
    await patch(`/api/du-an/${ma}`, { dia_diem: 'Đan Phượng' }, ma_sua);
    expect(((await (await goi(`/api/du-an/${ma}`)).json()) as { ten: string }).ten).toBe('M7 Đan Phượng');
  });
});

describe('nhân bản phương án', () => {
  const nhanBan = (ma: string, id: string, maSua?: string) =>
    goi(`/api/du-an/${ma}/pa/${id}/nhan-ban`, { method: 'POST', headers: maSua ? { 'X-Ma-Sua': maSua } : {} });

  it('cần mã sửa; PA không có -> 404; dự án không có -> 404', async () => {
    const { ma, ma_sua } = await taoDuAn();
    await goi(`/api/du-an/${ma}/pa/p1`, json(PA, ma_sua));
    expect((await nhanBan(ma, 'p1')).status).toBe(403);
    expect((await nhanBan(ma, 'p1', 'sai')).status).toBe(403);
    expect((await nhanBan(ma, 'khong', ma_sua)).status).toBe(404);
    expect((await nhanBan('khongco1', 'p1', ma_sua)).status).toBe(404);
    expect(((await (await goi(`/api/du-an/${ma}`)).json()) as { phuong_an: unknown[] }).phuong_an).toHaveLength(1);
  });

  it('bản sao có id mới, tên "(bản sao)", cùng trạng thái và tóm tắt; sửa bản sao không đụng bản gốc', async () => {
    const { ma, ma_sua } = await taoDuAn();
    const goc = { ...PA, trang_thai: { phienBan: 1, toa: [{ id: 'a' }] }, tom_tat: { soCan: 120 } };
    await goi(`/api/du-an/${ma}/pa/p1`, json(goc, ma_sua));
    const r = await nhanBan(ma, 'p1', ma_sua);
    expect(r.status).toBe(201);
    const { id } = (await r.json()) as { id: string };
    expect(id).toMatch(/^pa-[a-z0-9]{6}$/);
    const ban = (await (await goi(`/api/du-an/${ma}/pa/${id}`)).json()) as { ten: string; trang_thai: unknown };
    expect(ban).toMatchObject({ ten: 'PA 1 (bản sao)', trang_thai: goc.trang_thai });
    await goi(`/api/du-an/${ma}/pa/${id}`, json({ ...goc, trang_thai: { phienBan: 1, toa: [] } }, ma_sua));
    const g = (await (await goi(`/api/du-an/${ma}/pa/p1`)).json()) as { trang_thai: unknown };
    expect(g.trang_thai).toEqual(goc.trang_thai);
    const ds = (await (await goi(`/api/du-an/${ma}`)).json()) as { phuong_an: { tom_tat: unknown }[] };
    expect(ds.phuong_an.map((p) => p.tom_tat)).toEqual([{ soCan: 120 }, { soCan: 120 }]);
  });
});


describe('nhân bản dự án và người sửa', () => {
  it('nhân bản cả dự án: mã + mã sửa mới, đủ PA; bản gốc không đổi; mã sửa gốc không dùng được cho bản sao', async () => {
    const { ma, ma_sua } = await taoDuAn();
    await goi(`/api/du-an/${ma}/pa/p1`, json({ ...PA, tom_tat: { soCan: 50 } }, ma_sua));
    await goi(`/api/du-an/${ma}/pa/p2`, json({ ...PA, ten: 'PA 2' }, ma_sua));
    const r = await goi(`/api/du-an/${ma}/nhan-ban`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sua_boi: ' An ' }) });
    expect(r.status).toBe(201);
    const b = (await r.json()) as { ma: string; ma_sua: string; so_pa: number };
    expect(b.ma).not.toBe(ma);
    expect(b.so_pa).toBe(2);
    const da = (await (await goi(`/api/du-an/${b.ma}`)).json()) as { ten: string; dia_diem: string; phuong_an: { id: string; sua_boi: string; tom_tat: unknown }[] };
    expect(da.ten).toBe('Lô CC-02 (bản sao)');
    expect(da.dia_diem).toBe('Hà Đông');
    expect(da.phuong_an.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
    expect(da.phuong_an.every((p) => p.sua_boi === 'An')).toBe(true);
    expect(((await (await goi(`/api/du-an/${b.ma}/kiem-ma`, { headers: { "X-Ma-Sua": b.ma_sua } })).json()) as { duocSua: boolean }).duocSua).toBe(true);
    expect(((await (await goi(`/api/du-an/${b.ma}/kiem-ma`, { headers: { 'X-Ma-Sua': ma_sua } })).json()) as { duocSua: boolean }).duocSua).toBe(false);
    expect(((await (await goi(`/api/du-an/${ma}`)).json()) as { phuong_an: unknown[] }).phuong_an).toHaveLength(2);
    expect((await goi('/api/du-an/khongco1/nhan-ban', { method: 'POST' })).status).toBe(404);
  });

  it('lưu tên người sửa theo từng PA (mỗi người một PA), cắt khoảng trắng', async () => {
    const { ma, ma_sua } = await taoDuAn();
    await goi(`/api/du-an/${ma}/pa/p1`, json({ ...PA, sua_boi: '  Bình ' }, ma_sua));
    await goi(`/api/du-an/${ma}/pa/p2`, json({ ...PA, ten: 'PA 2', sua_boi: 'Châu' }, ma_sua));
    await goi(`/api/du-an/${ma}/pa/p3`, json({ ...PA, ten: 'PA 3' }, ma_sua));
    const ds = (await (await goi(`/api/du-an/${ma}`)).json()) as { phuong_an: { id: string; sua_boi: string }[] };
    const theo = Object.fromEntries(ds.phuong_an.map((p) => [p.id, p.sua_boi]));
    expect(theo).toEqual({ p1: 'Bình', p2: 'Châu', p3: '' });
    expect(((await (await goi(`/api/du-an/${ma}/pa/p1`)).json()) as { sua_boi: string }).sua_boi).toBe('Bình');
  });
});

describe('đăng nhập công ty (Cloudflare Access)', () => {
  it('chưa cấu hình Access: /api/toi báo không yêu cầu, ai cũng tạo được dự án', async () => {
    const r = await goi('/api/toi');
    expect(await r.json()).toEqual({ yeuCau: false, email: null, duocTao: true, trangThai: null, lyDo: null, laQuanTri: false, soCho: 0, hoTen: '', daDangKy: false, mien: '', dangNhap: '/api/dang-nhap' });
    await taoDuAn();
  });
  it('/api/dang-nhap chỉ quay về đường nội bộ', async () => {
    const quay = async (q: string) => (await goi(`/api/dang-nhap?quay=${encodeURIComponent(q)}`, { redirect: 'manual' })).headers.get('location');
    expect(await quay('/du-an/abc')).toBe('/du-an/abc');
    expect(await quay('//evil.com')).toBe('/');
    expect(await quay('https://evil.com')).toBe('/');
  });
});
