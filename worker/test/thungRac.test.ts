import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { donThungRac, dsThungRac, khoiPhuc, ngayGiu, xoaMem } from '../src/thungRac';

const goi = (duong: string, init: RequestInit = {}) => SELF.fetch(`https://unitmix.leo-ai.dev${duong}`, init);
const json = (body: unknown, maSua?: string): RequestInit => ({ method: 'PUT', headers: { 'content-type': 'application/json', ...(maSua ? { 'X-Ma-Sua': maSua } : {}) }, body: JSON.stringify(body) });
async function taoDuAn(ten = 'Lô A') {
  const r = await goi('/api/du-an', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ten }) });
  return (await r.json()) as { ma: string; ma_sua: string };
}
const NGAY = 86_400_000;

describe('thùng rác dự án', () => {
  it('xoá dự án cần mã sửa; xoá rồi thì không đọc được nữa nhưng PA còn trong DB', async () => {
    const { ma, ma_sua } = await taoDuAn();
    await goi(`/api/du-an/${ma}/pa/p1`, json({ ten: 'PA 1', trang_thai: { a: 1 } }, ma_sua));
    expect((await goi(`/api/du-an/${ma}`, { method: 'DELETE' })).status).toBe(403);
    expect((await goi(`/api/du-an/${ma}`, { method: 'DELETE', headers: { 'X-Ma-Sua': 'sai' } })).status).toBe(403);
    expect((await goi(`/api/du-an/${ma}`)).status).toBe(200);
    expect((await goi(`/api/du-an/${ma}`, { method: 'DELETE', headers: { 'X-Ma-Sua': ma_sua } })).status).toBe(204);
    expect((await goi(`/api/du-an/${ma}`)).status).toBe(404);
    expect((await goi(`/api/du-an/${ma}/pa/p1`, json({ ten: 'x', trang_thai: {} }, ma_sua))).status).toBe(404);
    const rac = await dsThungRac(env.DB, 30);
    expect(rac.find((d) => d.ma === ma)).toMatchObject({ so_pa: 1, con_lai_ngay: 30 });
  });

  it('khôi phục đưa dự án và phương án về nguyên vẹn; khôi phục dự án không ở thùng rác → false', async () => {
    const { ma, ma_sua } = await taoDuAn('Lô B');
    await goi(`/api/du-an/${ma}/pa/p1`, json({ ten: 'PA 1', trang_thai: { toa: [1, 2] } }, ma_sua));
    expect(await khoiPhuc(env.DB, ma)).toBe(false);
    expect(await xoaMem(env.DB, ma, 'qt@x.vn', new Date().toISOString())).toBe(true);
    expect(await xoaMem(env.DB, ma, 'qt@x.vn', new Date().toISOString())).toBe(false);
    expect(await khoiPhuc(env.DB, ma)).toBe(true);
    const da = (await (await goi(`/api/du-an/${ma}`)).json()) as { ten: string; phuong_an: { id: string }[] };
    expect(da).toMatchObject({ ten: 'Lô B', phuong_an: [{ id: 'p1' }] });
    expect(((await (await goi(`/api/du-an/${ma}/pa/p1`)).json()) as { trang_thai: unknown }).trang_thai).toEqual({ toa: [1, 2] });
  });

  it('dọn thùng rác: chỉ xoá hẳn dự án quá hạn (kèm phương án), dự án mới xoá hoặc chưa xoá còn nguyên', async () => {
    const cu = await taoDuAn('cũ'), moi = await taoDuAn('mới'), song = await taoDuAn('sống');
    for (const d of [cu, moi, song]) await goi(`/api/du-an/${d.ma}/pa/p1`, json({ ten: 'PA', trang_thai: {} }, d.ma_sua));
    const bay = Date.now();
    await xoaMem(env.DB, cu.ma, '', new Date(bay - 31 * NGAY).toISOString());
    await xoaMem(env.DB, moi.ma, '', new Date(bay - 5 * NGAY).toISOString());
    expect(await donThungRac(env.DB, 30, bay)).toBe(1);
    const con = async (ma: string) => (await env.DB.prepare('SELECT COUNT(*) AS n FROM du_an WHERE ma = ?').bind(ma).first<{ n: number }>())!.n;
    const conPa = async (ma: string) => (await env.DB.prepare('SELECT COUNT(*) AS n FROM phuong_an WHERE du_an_ma = ?').bind(ma).first<{ n: number }>())!.n;
    expect([await con(cu.ma), await conPa(cu.ma)]).toEqual([0, 0]);
    expect([await con(moi.ma), await conPa(moi.ma)]).toEqual([1, 1]);
    expect([await con(song.ma), await conPa(song.ma)]).toEqual([1, 1]);
    expect((await dsThungRac(env.DB, 30, bay)).find((d) => d.ma === moi.ma)?.con_lai_ngay).toBe(25);
  });

  it('số ngày giữ lấy từ biến, sai thì dùng 30', () => {
    expect([ngayGiu(undefined), ngayGiu(''), ngayGiu('abc'), ngayGiu('0'), ngayGiu('7'), ngayGiu('14.9')]).toEqual([30, 30, 30, 30, 7, 14]);
  });

  it('quản trị: khôi phục / xoá chưa đăng nhập → 401', async () => {
    for (const d of ['khoi-phuc', 'xoa']) {
      expect((await goi(`/api/quan-tri/${d}`, { method: 'POST', body: JSON.stringify({ ma: 'x' }) })).status).toBe(401);
    }
  });
});
