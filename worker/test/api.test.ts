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
