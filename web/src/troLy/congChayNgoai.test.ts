/**
 * Cổng window.unitmixTools: bật chỉ khi ?congCu=1; gọi thẳng công cụ trên kho thật (một bước hoàn tác); hộp xác nhận mặc định từ chối;
 * lệnh chạy tuần tự; không qua vòng AI (không gọi mạng).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { taoKhoLoi, type KhoLoi } from '../kho/khoLoi';
import { napThuVien } from '../thu/thuVienThat';
import type { ChiTieuQH, Lo, TrangThaiPA } from '../tinh/kieu';
import { taoPAMoi } from '../tinh/macDinh';
import { traLuat, type BoQuyTac } from '../tinh/quyTac';
import { readFileSync } from 'node:fs';
import type { NguCanh, TrangThaiUi } from './congCu/nguCanh';
import { nguCanhGon } from './congCu/doc';
import { baoCongNgoai, chayViecMcp, congDuocBat, congMcp, taoCongNgoai } from './congChayNgoai';

const { tv, dl } = napThuVien();
const bo = JSON.parse(readFileSync(new URL('../../public/lib/quy_tac.json', import.meta.url), 'utf8')) as BoQuyTac;
const luat = { lo01: traLuat(bo, 'LO-01')!, lo02: traLuat(bo, 'LO-02')! };
const chiTieu: ChiTieuQH = { matDoMax: 40, matDoThapMax: null, hssddMax: 8, tangCaoMax: 25, tangDe: 1, tangCanHo: null, tangHam: null, danSoMax: 3000, soCanMax: null, nguoiMoiCan: 3.6, choDoOtoMoiCan: 1, choXeMayMoiCan: 2, cayXanhMin: 20 };
const lo: Lo = {
  id: 'A', ranh: [[0, 0], [160, 0], [160, 120], [0, 120]], chiGioi: null, xungQuanh: [],
  temDat: { kyHieu: 'A', chucNang: 'tm', chiTieu, coCauMucTieu: { stu: 10, '1pn': 20, '2pn': 45, '2pnp': 0, '3pn': 25 } },
};
let kho: KhoLoi;
let hoi: string[] = [];
let daXoa: string[] = [];
const ng = (): NguCanh => ({
  kho, chiXem: () => false, tv: () => tv, dl: async () => dl, luat: async () => luat, cuaCan: async () => dl.cuaCan,
  duAn: { ma: 'thu', ten: 'Dự án thử', paId: 'pa-1', tenPA: 'PA 1', dsPA: () => [{ id: 'pa-1', ten: 'PA 1' }, { id: 'pa-2', ten: 'PA 2' }], coMaSua: true },
  paApi: { nhanBan: async () => 'x', doiTen: async () => {}, xoa: async (id) => { daXoa.push(id); }, taoMoi: async () => 'y', doc: async () => ({ ten: '', pa: taoPAMoi() }), mo: () => {} },
  ui: { lay: () => ({ buoc: 'tmb', xem: 'mat_bang', loId: 'A', toaId: null, canKhoa: null, tangs: null, tangHam: 1 }) as TrangThaiUi, dat: () => {} },
  xacNhan: async (c) => { hoi.push(c); return true; },
});
beforeEach(() => { kho = taoKhoLoi({ ...taoPAMoi(), lo: [lo] } as TrangThaiPA, () => {}); hoi = []; daXoa = []; });

describe('window.unitmixTools', () => {
  beforeEach(() => { (globalThis as unknown as { window?: unknown }).window ??= globalThis; });
  it('chỉ bật khi có ?congCu=1', () => {
    expect(congDuocBat('')).toBe(false);
    expect(congDuocBat('?congCu=0')).toBe(false);
    expect(congDuocBat('?x=1&congCu=1')).toBe(true);
    const w = window as unknown as { unitmixTools?: unknown };
    delete w.unitmixTools;
    baoCongNgoai(ng(), '')();
    expect(w.unitmixTools).toBeUndefined();
    const go = baoCongNgoai(ng(), '?congCu=1');
    expect(w.unitmixTools).toBeDefined();
    go();
    expect(w.unitmixTools).toBeUndefined();
  });

  it('danh sách đủ công cụ; chạy get_state trả JSON; công cụ lạ / đầu vào sai → ok=false', async () => {
    const c = taoCongNgoai(ng());
    expect(c.danhSach().length).toBeGreaterThanOrEqual(40);
    const r = await c.chay('get_state', { gon: true });
    expect(r.ok).toBe(true);
    expect(r.json).toBeTypeOf('object');
    expect((await c.chay('khong_co', {})).ok).toBe(false);
    expect((await c.chay('suggest_arrangements', {})).ok).toBe(false);
  });

  it('gợi ý → áp → kiểm luật trên kho thật: áp = đúng MỘT bước hoàn tác', async () => {
    const c = taoCongNgoai(ng());
    const g = await c.chay('suggest_arrangements', { lot_id: 'A' });
    expect(g.ok, g.noiDung).toBe(true);
    const b0 = kho.soBuoc().truoc;
    const ap = await c.chay('apply_arrangement', { lot_id: 'A', option: 0 });
    expect(ap.ok, ap.noiDung).toBe(true);
    expect(kho.soBuoc().truoc).toBe(b0 + 1);
    expect(kho.lay().toa.length).toBeGreaterThan(0);
    expect((await c.chay('check_rules', {})).ok).toBe(true);
  });

  it('xác nhận mặc định TỪ CHỐI; chỉ qua khi dongY', async () => {
    const c = taoCongNgoai(ng());
    const r = await c.chay('manage_pa', { action: 'delete', pa_id: 'pa-2' });
    expect(r.ok).toBe(false);
    expect(daXoa).toEqual([]);
    expect(hoi).toEqual([]); // không hề hỏi chip: cổng tự từ chối
    const r2 = await c.chay('manage_pa', { action: 'delete', pa_id: 'pa-2' }, { dongY: true });
    expect(r2.ok, r2.noiDung).toBe(true);
    expect(daXoa).toEqual(['pa-2']);
  });

  it('lệnh chạy tuần tự, không chen nhau', async () => {
    const c = taoCongNgoai(ng());
    const t0 = kho.soBuoc().truoc;
    await Promise.all([
      c.chay('apply_arrangement', { lot_id: 'A', option: 0 }),
      c.chay('apply_arrangement', { lot_id: 'A', option: 1 }),
    ]);
    expect(kho.soBuoc().truoc).toBe(t0 + 2);
  });
});

describe('cầu MCP + ngữ cảnh gọn', () => {
  const nen: Lo = { ...lo, id: 'CX', ranh: [[300, 0], [340, 0], [340, 40], [300, 40]], temDat: { ...lo.temDat, kyHieu: 'CX-1', chucNang: 'khac' } };
  beforeEach(() => { kho = taoKhoLoi({ ...taoPAMoi(), lo: [lo, nen] } as TrangThaiPA, () => {}); });

  it('?mcp: cổng hợp lệ mới nối', () => {
    expect(congMcp('?congCu=1')).toBeNull();
    expect(congMcp('?mcp=1')).toBe(3033);
    expect(congMcp('?mcp=3040')).toBe(3040);
    expect(congMcp('?mcp=80')).toBeNull();
    expect(congMcp('?mcp=abc')).toBeNull();
  });

  it('việc goi / nhieu / js / danh_sach chạy bằng cổng; nhieu dừng ở lệnh lỗi', async () => {
    const c = taoCongNgoai(ng());
    const g = (await chayViecMcp(c, { id: '1', loai: 'goi', ten: 'get_state', dau_vao: { gon: true } })) as { ok: boolean; noi_dung: string };
    expect(g.ok).toBe(true);
    const n = (await chayViecMcp(c, { id: '2', loai: 'nhieu', lenh: [{ ten: 'get_state' }, { ten: 'khong_co' }, { ten: 'get_state' }] })) as unknown[];
    expect(n.length).toBe(2);
    expect(await chayViecMcp(c, { id: '3', loai: 'js', ma: 'async (T) => (await T.chay("get_state", {gon:true})).json.lo.length' })).toBe(1);
    expect(((await chayViecMcp(c, { id: '4', loai: 'danh_sach' })) as unknown[]).length).toBeGreaterThanOrEqual(40);
  });

  it('get_state mặc định ẩn lô nền, all_lots / lot_ids để lấy; ngữ cảnh gọn chỉ lô cao tầng', async () => {
    const c = taoCongNgoai(ng());
    const mac = (await c.chay('get_state', { gon: true })).json as { lo: { id: string }[]; lo_an?: number };
    expect(mac.lo.map((l) => l.id)).toEqual(['A']);
    expect(mac.lo_an).toBe(1);
    expect(((await c.chay('get_state', { gon: true, all_lots: true })).json as { lo: unknown[] }).lo.length).toBe(2);
    expect(((await c.chay('get_state', { gon: true, lot_ids: ['CX-1'] })).json as { lo: { id: string }[] }).lo.map((l) => l.id)).toEqual(['CX']);
    const g = nguCanhGon(ng());
    expect(g.lo_cao_tang.map((x) => x[0])).toEqual(['A']);
    expect(g.so_lo_khac).toBe(1);
  });
});
