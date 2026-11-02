import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { datTrangThai, docTrangThai, ghiNhanYeuCau, lietKeQuanTri, quyetDinhTao } from '../src/nguoiDung';

const MIEN = 'meygroup.vn', QT = 'nghiavt.ai1@gmail.com';
const q = (email: string | null, trangThai: 'cho' | 'duyet' | 'tu_choi' | null = null, mien: string | undefined = MIEN) =>
  quyetDinhTao({ email, mien, mailQuanTri: QT, trangThai });

describe('quyết định quyền tạo dự án', () => {
  it('tắt (không đặt miền): ai cũng tạo được', () => {
    expect(q(null, null, '').duocTao).toBe(true);
    expect(q('x@gmail.com', null, '').duocTao).toBe(true);
  });
  it('quản trị luôn được, kể cả mail ngoài miền và khác hoa thường', () => {
    expect(q('Nghiavt.AI1@gmail.com')).toMatchObject({ duocTao: true, laQuanTri: true });
  });
  it('chưa đăng nhập → chua_dang_nhap', () => {
    expect(q(null)).toMatchObject({ duocTao: false, lyDo: 'chua_dang_nhap' });
  });
  it('mail công ty mới → chờ duyệt; duyệt → được; từ chối → không', () => {
    expect(q('an@meygroup.vn')).toMatchObject({ duocTao: false, trangThai: 'cho', lyDo: 'cho_duyet' });
    expect(q('an@meygroup.vn', 'duyet')).toMatchObject({ duocTao: true, lyDo: null });
    expect(q('an@meygroup.vn', 'tu_choi')).toMatchObject({ duocTao: false, lyDo: 'tu_choi' });
  });
  it('mail ngoài miền: không được, trừ khi quản trị đã duyệt riêng', () => {
    expect(q('b@gmail.com')).toMatchObject({ duocTao: false, lyDo: 'sai_mien' });
    expect(q('b@gmail.com', 'duyet').duocTao).toBe(true);
  });
});

describe('bảng người dùng', () => {
  it('ghi nhận chờ duyệt một lần; quản trị duyệt / thu hồi; liệt kê chờ duyệt lên đầu kèm số dự án', async () => {
    const bay = '2026-11-02T10:00:00.000Z';
    await ghiNhanYeuCau(env.DB, 'Binh@MeyGroup.vn', bay);
    await ghiNhanYeuCau(env.DB, 'binh@meygroup.vn', '2026-11-02T11:00:00.000Z');
    expect(await docTrangThai(env.DB, 'binh@meygroup.vn')).toBe('cho');
    await datTrangThai(env.DB, 'chau@meygroup.vn', 'duyet', QT, bay);
    await env.DB.prepare('INSERT INTO du_an (ma, ten, dia_diem, bam_ma_sua, tao_luc, tao_boi) VALUES (?, ?, ?, ?, ?, ?)')
      .bind('daChau01', 'LB', '', 'x', bay, 'chau@meygroup.vn').run();
    const ds = await lietKeQuanTri(env.DB);
    expect(ds.nguoi.map((n) => [n.email, n.trang_thai, n.so_du_an])).toEqual([['binh@meygroup.vn', 'cho', 0], ['chau@meygroup.vn', 'duyet', 1]]);
    expect(ds.nguoi[1].duyet_boi).toBe(QT);
    expect(ds.du_an.find((d) => d.ma === 'daChau01')?.tao_boi).toBe('chau@meygroup.vn');
    await datTrangThai(env.DB, 'chau@meygroup.vn', 'cho', QT, bay);
    expect(await docTrangThai(env.DB, 'chau@meygroup.vn')).toBe('cho');
  });
});

describe('API quản trị', () => {
  it('chưa đăng nhập → 401 (không lộ danh sách), duyệt cũng 401', async () => {
    expect((await SELF.fetch('https://unitmix.leo-ai.dev/api/quan-tri')).status).toBe(401);
    const r = await SELF.fetch('https://unitmix.leo-ai.dev/api/quan-tri/duyet', { method: 'POST', body: JSON.stringify({ email: 'a@meygroup.vn', trang_thai: 'duyet' }) });
    expect(r.status).toBe(401);
  });
});
