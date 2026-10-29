/**
 * Bộ công cụ Leo AI trên thư viện thật: mỗi công cụ sửa — đầu vào đúng → PA đổi + đúng MỘT bước hoàn tác; đầu vào sai → is_error,
 * PA giữ nguyên; chế độ Chỉ xem → từ chối. Công cụ đọc trả JSON. Kiểm thêm mọi công cụ trong bộ đều có ca thử ở đây.
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { taoKhoLoi, type KhoLoi } from '../../kho/khoLoi';
import { napThuVien } from '../../thu/thuVienThat';
import { taoToaTrenLo } from '../../tinh/hopLo';
import type { ChiTieuQH, Lo, ToaDat, TrangThaiPA } from '../../tinh/kieu';
import { tuChinhToa, type ToaMB } from '../../tinh/loiThang';
import { taoPAMoi } from '../../tinh/macDinh';
import { traLuat, type BoQuyTac } from '../../tinh/quyTac';
import { BO_CONG_CU, CONG_CU_API, chayCongCu } from './index';
import { kiemDauVao } from './dinhNghia';
import type { NguCanh, TrangThaiUi } from './nguCanh';

const { tv, dl } = napThuVien();
const bo = JSON.parse(readFileSync(new URL('../../../public/lib/quy_tac.json', import.meta.url), 'utf8')) as BoQuyTac;
const luat = { lo01: traLuat(bo, 'LO-01')!, lo02: traLuat(bo, 'LO-02')! };

const chiTieu: ChiTieuQH = { matDoMax: 40, matDoThapMax: null, hssddMax: 8, tangCaoMax: 25, tangDe: 1, tangCanHo: null, tangHam: null, danSoMax: 3000, soCanMax: null, nguoiMoiCan: 3.6, choDoOtoMoiCan: 1, choXeMayMoiCan: 2, cayXanhMin: 20 };
const lo = (id: string, x0: number, w: number, h: number): Lo => ({
  id, ranh: [[x0, 0], [x0 + w, 0], [x0 + w, h], [x0, h]], chiGioi: null, xungQuanh: [],
  temDat: { kyHieu: id, chucNang: 'tm', chiTieu, coCauMucTieu: { stu: 10, '1pn': 20, '2pn': 45, '2pnp': 0, '3pn': 25 } },
});
// mẫu tòa TM có mặt bằng tầng (mẫu đầu tiên trong thư viện)
const mau = [...tv.toa.values()].find((m) => m.nhom === 'tm' && 'mat' in m)!;
const toaDau = (): ToaDat => tuChinhToa(taoToaTrenLo(mau, lo('A', 0, 120, 100), 't1'), mau as unknown as ToaMB, tv, dl);
const paGoc = (): TrangThaiPA => ({ ...taoPAMoi(), lo: [lo('A', 0, 120, 100), lo('B', 140, 160, 100)], toa: [toaDau()] });

let kho: KhoLoi;
let ui: TrangThaiUi;
let chiXem = false;
let hoi: string[] = [];
const ng = (): NguCanh => ({
  kho, chiXem: () => chiXem, tv: () => tv, dl: async () => dl, luat: async () => luat, cuaCan: async () => dl.cuaCan,
  duAn: { ma: 'thu', ten: 'Dự án thử', paId: 'pa-1', tenPA: 'PA 1', dsPA: () => [{ id: 'pa-1', ten: 'PA 1' }], coMaSua: true },
  ui: { lay: () => ui, dat: (p) => { ui = { ...ui, ...p }; } },
  xacNhan: async (c) => { hoi.push(c); return true; },
});
beforeEach(() => {
  kho = taoKhoLoi(paGoc(), () => {});
  ui = { buoc: 'tmb', xem: 'mat_bang', loId: 'A', toaId: 't1', canKhoa: null, tangs: null, tangHam: 1 };
  chiXem = false;
  hoi = [];
});

const chay = async (ten: string, v: Record<string, unknown>) => {
  const r = await chayCongCu(ten, v, ng());
  return { ...r, json: r.loi ? null : JSON.parse(r.noiDung) };
};
/** Đúng: PA đổi + đúng một bước hoàn tác. */
async function motBuoc(ten: string, v: Record<string, unknown>) {
  const truoc = kho.lay(), b0 = kho.soBuoc().truoc;
  const r = await chay(ten, v);
  expect(r.loi, `${ten}: ${r.noiDung}`).toBe(false);
  expect(kho.soBuoc().truoc).toBe(b0 + 1);
  expect(kho.lay()).not.toBe(truoc);
  return r.json;
}
/** Sai: is_error, PA giữ nguyên, không ghi bước. */
async function loi(ten: string, v: Record<string, unknown>, chua?: RegExp) {
  const truoc = kho.lay(), b0 = kho.soBuoc().truoc;
  const r = await chay(ten, v);
  expect(r.loi, `${ten} phải lỗi`).toBe(true);
  if (chua) expect(r.noiDung).toMatch(chua);
  expect(kho.lay()).toBe(truoc);
  expect(kho.soBuoc().truoc).toBe(b0);
  return r.noiDung;
}
const mb = async (tang?: number) => (await chay('get_floor_plan', { tower_id: 't1', ...(tang ? { floor: tang } : {}) })).json as {
  o: { ch: string; key: string; unit_id: string; loai: string; cong_nang: string }[]; thang_bo: { key: string; loai: string }[]; so_can: number;
};

const daThu = new Set<string>();
const thu = (ten: string, fn: () => Promise<void>) => { daThu.add(ten); it(ten, fn); };

describe('khung công cụ', () => {
  it('định nghĩa API ổn định, đủ eager_input_streaming, tên không trùng', () => {
    expect(new Set(CONG_CU_API.map((c) => c.name)).size).toBe(CONG_CU_API.length);
    expect(CONG_CU_API.every((c) => c.eager_input_streaming === true && c.input_schema.type === 'object')).toBe(true);
    expect(JSON.stringify(CONG_CU_API)).toBe(JSON.stringify(CONG_CU_API)); // không có giá trị đổi theo thời gian
  });
  it('kiểm đầu vào theo schema', () => {
    const s = { type: 'object' as const, properties: { a: { type: 'integer' as const, minimum: 1 }, b: { type: 'string' as const, enum: ['x'] } }, required: ['a'] };
    expect(kiemDauVao(s, { a: 2, b: 'x' })).toBeNull();
    expect(kiemDauVao(s, {})).toMatch(/thiếu/);
    expect(kiemDauVao(s, { a: 1.5 })).toMatch(/nguyên/);
    expect(kiemDauVao(s, { a: 0 })).toMatch(/tối thiểu/);
    expect(kiemDauVao(s, { a: 1, b: 'y' })).toMatch(/một trong/);
    expect(kiemDauVao(s, { a: 1, c: 1 })).toMatch(/không có trường/);
  });
  it('công cụ lạ / đầu vào không phải đối tượng → lỗi', async () => {
    expect((await chayCongCu('khong_co', {}, ng())).loi).toBe(true);
    expect((await chayCongCu('get_state', 'x', ng())).loi).toBe(true);
  });
});

describe('công cụ đọc', () => {
  thu('get_state', async () => {
    const j = (await chay('get_state', {})).json;
    expect(j.lo).toHaveLength(2);
    expect(j.lo[0].toa[0].id).toBe('t1');
    expect(j.tong.so_can).toBeGreaterThan(0);
  });
  thu('get_kpi', async () => {
    expect((await chay('get_kpi', { scope: 'project' })).json.so_can.gt).toBeGreaterThan(0);
    expect((await chay('get_kpi', { scope: 'lot', lot_id: 'A' })).json.chi_tieu_lo.A.length).toBeGreaterThan(0);
    const f = (await chay('get_kpi', { scope: 'floor', tower_id: 't1', floor: 3 })).json;
    expect(f.so_can_tang).toBeGreaterThan(0);
    await loi('get_kpi', { scope: 'floor', tower_id: 't1', floor: 999 }, /không hợp lệ/);
  });
  thu('get_floor_plan', async () => {
    const m = await mb();
    expect(m.o.length).toBeGreaterThan(3);
    expect(m.thang_bo.length).toBeGreaterThanOrEqual(2);
    expect(m.thang_bo.some((x) => x.loai === 'N2') && m.thang_bo.some((x) => x.loai === 'N3')).toBe(true);
    await loi('get_floor_plan', { tower_id: 'khong' }, /Không có tòa/);
  });
  thu('list_templates', async () => {
    expect((await chay('list_templates', { kind: 'towers', group: 'tm', lot_id: 'A' })).json.some((x: { vua: boolean }) => x.vua)).toBe(true);
    const u = (await chay('list_templates', { kind: 'units', unit_type: '2pn' })).json;
    expect(u.length).toBeGreaterThan(0);
    const d = (await chay('list_templates', { kind: 'units', unit_id: (await mb()).o[0].unit_id })).json;
    expect(d.hien_tai).toBeTruthy();
  });
  thu('check_rules', async () => {
    const j = (await chay('check_rules', { only_problems: false })).json;
    expect(j.toa[0].thang_bo.dat).toBe(true);
    expect(j.tmb).toBeTruthy();
  });
  thu('get_view_scores', async () => {
    const j = (await chay('get_view_scores', {})).json;
    expect(j.du_an.so_can).toBeGreaterThan(0);
    expect(j.du_an.tb).toBeGreaterThanOrEqual(0);
    expect(j.du_an.tb).toBeLessThanOrEqual(100);
    expect(j.toa[0].id).toBe('t1');
    expect(j.cai_dat.trong_so).toEqual({ huong: 40, thoang: 30, canh: 20, nang: 10 });
    const t = (await chay('get_view_scores', { lot_id: 'A', tower_id: 't1', floor: 2, limit: 5 })).json;
    expect(t.du_an).toBeUndefined();
    expect(t.can.ds.length).toBe(5);
    expect(t.can.ds[0].ch).toMatch(/^CH-\d{2}$/);
    expect(t.can.ds[0].diem).toBeGreaterThanOrEqual(t.can.ds[4].diem);
    await loi('get_view_scores', { tower_id: 't1', floor: 999 }, /không hợp lệ/);
  });
  thu('get_cost', async () => { expect((await chay('get_cost', {})).json.du_toan.tong_muc).toBeGreaterThan(0); });
  thu('get_population', async () => { expect((await chay('get_population', {})).json.tinh.length).toBeGreaterThan(3); });
  thu('get_basement', async () => {
    const j = (await chay('get_basement', { lot_id: 'A' })).json;
    expect(j.lo).toBe('A');
    if (j.tong) { expect(j.yeu_cau_cho).toBeTruthy(); expect(Array.isArray(j.khoang_chay)).toBe(true); expect(Array.isArray(j.phong_ky_thuat)).toBe(true); }
  });
  thu('recommend_tower_shapes', async () => {
    const truoc = kho.lay(), b0 = kho.soBuoc().truoc;
    const j = (await chay('recommend_tower_shapes', { shape: 'l', group: 'tm', efficiency_min: 73, mix_target: { '2pn': 55 }, request: 'nhiều căn góc', top: 3 })).json;
    expect(j.xep_hang).toHaveLength(3);
    expect(j.xep_hang[0].hang).toBe(1);
    expect(j.xep_hang.every((r: { template_id: string }) => /^tm-l[123]$/.test(r.template_id))).toBe(true);
    expect(j.xep_hang[0].diem).toBeGreaterThanOrEqual(j.xep_hang[1].diem);
    expect(j.hieu_suat_min_pct).toBe(73);
    expect(j.muc_tieu_co_cau_pct['2pn']).toBe(55);
    expect(j.trong_so.canGoc).toBe(4);
    expect(kho.lay()).toBe(truoc); // không sửa PA
    expect(kho.soBuoc().truoc).toBe(b0);
    expect((await chay('recommend_tower_shapes', { template_ids: ['zz'] })).noiDung).toMatch(/Không có mẫu tòa zz/);
  });
  thu('compare_pas', async () => { expect((await chay('compare_pas', {})).json[0].so_can).toBeGreaterThan(0); });
  thu('navigate', async () => {
    await chay('navigate', { screen: 'tang', tower_id: 't1', floor: 2, view: '3d' });
    expect(ui).toMatchObject({ buoc: 'tang', toaId: 't1', tangs: [2], xem: 'mo_hinh' });
    const m = await mb(2);
    await chay('navigate', { cell: m.o[1].ch });
    expect(ui.canKhoa).toBe(m.o[1].key);
    expect(kho.soBuoc().truoc).toBe(0); // điều hướng không vào hoàn tác
  });
  thu('zoom_to_fit', async () => { await loi('zoom_to_fit', {}, /Vừa khung/); });
});

describe('công cụ TMB', () => {
  thu('suggest_arrangements', async () => {
    const j = (await chay('suggest_arrangements', { lot_id: 'B' })).json;
    expect(j.so_phuong_an).toBeGreaterThan(0);
    expect(kho.soBuoc().truoc).toBe(0);
  });
  thu('apply_arrangement', async () => {
    const j = await motBuoc('apply_arrangement', { lot_id: 'B', option: 0 });
    expect(kho.lay().toa.filter((x) => x.loId === 'B').length).toBe(j.da_ap.so_toa);
    await loi('apply_arrangement', { lot_id: 'B', option: 99 }, /phương án/);
  });
  thu('batch_arrange', async () => {
    const xem = (await chay('batch_arrange', { lot_ids: ['B'], preview_only: true })).json;
    expect(xem.xem_truoc[0].lo).toBe('B');
    expect(kho.soBuoc().truoc).toBe(0);
    await motBuoc('batch_arrange', { lot_ids: ['B'] });
  });
  thu('add_tower', async () => {
    const j = await motBuoc('add_tower', { lot_id: 'B', template_id: mau.id });
    expect(kho.lay().toa.some((x) => x.id === j.toa_moi.id && x.loId === 'B')).toBe(true);
    await loi('add_tower', { lot_id: 'B', template_id: 'khong-co' }, /mẫu tòa/);
  });
  thu('update_tower', async () => {
    await motBuoc('update_tower', { tower_id: 't1', floors: 20, podium_floors: 2 });
    expect(kho.lay().toa[0]).toMatchObject({ soTangDH: 20, soTangDe: 2 });
    await loi('update_tower', { tower_id: 't1', floors: 0 }, /tối thiểu/);
    kho.sua((p) => ({ ...p, toa: p.toa.map((x) => ({ ...x, khoa: true })) }));
    await loi('update_tower', { tower_id: 't1', floors: 10 }, /khoá/);
  });
  thu('transform_towers', async () => {
    const x0 = kho.lay().toa[0].x;
    await motBuoc('transform_towers', { tower_ids: ['t1'], action: 'move', dx: 2.5, dy: 0 });
    expect(kho.lay().toa[0].x).toBeCloseTo(x0 + 2.5, 2);
    await motBuoc('transform_towers', { tower_ids: ['t1'], action: 'rotate', degrees: 90 });
    await motBuoc('transform_towers', { tower_ids: ['t1'], action: 'mirror' });
    await loi('transform_towers', { tower_ids: ['t1'], action: 'spin' }, /một trong/);
  });
  thu('duplicate_towers', async () => {
    await motBuoc('duplicate_towers', { tower_ids: ['t1'] });
    expect(kho.lay().toa).toHaveLength(2);
  });
  thu('delete_towers', async () => {
    await motBuoc('delete_towers', { tower_ids: ['t1'] });
    expect(kho.lay().toa).toHaveLength(0);
    await loi('delete_towers', { tower_ids: ['t1'] }, /Không có tòa/);
  });
  thu('lock_towers', async () => {
    await motBuoc('lock_towers', { tower_ids: ['t1'], locked: true });
    expect(kho.lay().toa[0].khoa).toBe(true);
    await loi('delete_towers', { tower_ids: ['t1'] }, /khoá/);
  });
  thu('set_road_edges', async () => {
    await motBuoc('set_road_edges', { lot_id: 'A', edges: [{ index: 1, width: null }, { index: 0, width: 30 }] });
    expect(kho.lay().lo[0].canhDuong).toEqual([30, null, 12, 12]);
    await loi('set_road_edges', { lot_id: 'A', edges: [{ index: 9, width: 5 }] }, /cạnh/);
    await motBuoc('set_road_edges', { lot_id: 'A', clear: true });
    expect(kho.lay().lo[0].canhDuong).toBeUndefined();
  });
  thu('add_lot', async () => {
    await motBuoc('add_lot', { width: 50, depth: 40, code: 'C' });
    expect(kho.lay().lo.at(-1)!.temDat.kyHieu).toBe('C');
  });
  thu('update_lot', async () => {
    await motBuoc('update_lot', { lot_id: 'A', indicators: { matDoMax: 35, soCanMax: null }, mix_target: { '2pn': 55 }, population: { province: 'hn', stage: 'cp' } });
    const l = kho.lay().lo[0].temDat;
    expect(l.chiTieu.matDoMax).toBe(35);
    expect(l.coCauMucTieu['2pn']).toBe(55);
    expect(l.danSo).toMatchObject({ tinh: 'hn', giaiDoan: 'cp' });
    await motBuoc('update_lot', { lot_id: 'A', population: { province: 'hn', round_area: { enabled: true, tolerance_m2: 0.3 } } });
    expect(kho.lay().lo[0].temDat.danSo?.lamTron).toEqual({ bat: true, dungSai: 0.3 });
    expect((await chay('get_population', {})).json.theo_lo.A.sat_moc).toMatchObject({ lam_tron_bat: true, dung_sai_m2: 0.3 });
    await loi('update_lot', { lot_id: 'A', indicators: { khong: 1 } }, /không có/);
    await loi('update_lot', { lot_id: 'A', indicators: { matDoMax: null } }, /trống/);
    await loi('update_lot', { lot_id: 'A', population: { province: 'zz' } }, /tỉnh/);
    await motBuoc('update_lot', { lot_id: 'A', population: null });
    expect(kho.lay().lo[0].temDat.danSo).toBeUndefined();
  });
  thu('update_coefficients', async () => {
    await motBuoc('update_coefficients', { area_coefficients: { can: 80 }, thresholds: { dtCanM2: 30 } });
    expect(kho.lay().heSo.can).toBeCloseTo(0.8);
  });
});

describe('công cụ màn Tầng', () => {
  thu('change_units', async () => {
    const m = await mb();
    const o = m.o.find((x) => x.cong_nang === 'can' && x.loai === '3pn') ?? m.o.find((x) => x.cong_nang === 'can')!;
    const loaiMoi = o.loai === '2pn' ? '3pn' : '2pn';
    const j = await motBuoc('change_units', { tower_id: 't1', changes: [{ cell: o.ch, unit_type: loaiMoi }], same_template_all: false });
    expect(j.da_doi[0]).toContain(o.ch);
    await loi('change_units', { tower_id: 't1', changes: [{ cell: o.ch }] }, /unit_id hoặc unit_type/);
    await loi('change_units', { tower_id: 't1', changes: [{ cell: 'CH-99', unit_type: '2pn' }] }, /Không có ô/);
  });
  thu('swap_units', async () => {
    const m = await mb();
    const c = m.o.filter((x) => x.cong_nang === 'can');
    const a = c[0], b = c.find((x) => x.unit_id !== a.unit_id) ?? c[1];
    const r = await chay('swap_units', { tower_id: 't1', a: a.key, b: b.key });
    // đổi chỗ có thể bị chặn vì không vừa (lý do giao diện) — khi đó PA phải giữ nguyên
    if (r.loi) expect(kho.soBuoc().truoc).toBe(0); else expect(kho.soBuoc().truoc).toBe(1);
    await loi('swap_units', { tower_id: 't1', a: a.key }, /thiếu/);
  });
  thu('add_unit', async () => {
    const m = await mb();
    const c = m.o.filter((x) => x.cong_nang === 'can');
    let ok = false;
    for (const o of c) { const r = await chay('add_unit', { tower_id: 't1', cell: o.key }); if (!r.loi) { ok = true; break; } }
    if (ok) expect(kho.soBuoc().truoc).toBe(1); else expect(kho.soBuoc().truoc).toBe(0);
    await loi('add_unit', { tower_id: 't1', cell: c[0].key, unit_id: 'khong-co' }, /mẫu căn/);
  });
  thu('delete_units', async () => {
    const m = await mb();
    const c = m.o.filter((x) => x.cong_nang === 'can');
    let ok = false;
    for (const o of [c[0], c[c.length - 1], ...c]) { const r = await chay('delete_units', { tower_id: 't1', cells: [o.key] }); if (!r.loi) { ok = true; break; } }
    expect(ok).toBe(true);
    expect(kho.soBuoc().truoc).toBe(1);
    expect((await mb()).so_can).toBeLessThan(m.so_can);
  });
  thu('flip_units', async () => {
    const m = await mb();
    await motBuoc('flip_units', { tower_id: 't1', cells: [m.o.find((x) => x.cong_nang === 'can')!.key] });
  });
  thu('set_cell_function', async () => {
    const m = await mb(4);
    const o = m.o.find((x) => x.cong_nang === 'can')!;
    await motBuoc('set_cell_function', { tower_id: 't1', floors: [4], cells: [o.key], function: 'shcd' });
    expect((await mb(4)).o.find((x) => x.key === o.key)!.cong_nang).toBe('shcd');
    await loi('set_cell_function', { tower_id: 't1', cells: [o.key], function: 'nha_tam' }, /một trong/);
  });
  thu('stairs', async () => {
    const m = await mb();
    expect(m.thang_bo.length).toBeGreaterThanOrEqual(2);
    expect(m.thang_bo.length).toBeLessThanOrEqual(3);
    const canDau = m.o.find((x) => x.cong_nang === 'can')!.key;
    if (m.thang_bo.length === 3) await loi('stairs', { tower_id: 't1', action: 'add', after_cell: canDau }, /tối đa 3/);
    else await loi('stairs', { tower_id: 't1', action: 'delete', stair_key: m.thang_bo[0].key }, /ít nhất 2 thang/);
    // đổi N2 duy nhất sang N3 → thang khác đổi sang N2: luôn còn ít nhất một N2 + một N3
    const n2 = m.thang_bo.filter((x) => x.loai === 'N2');
    await motBuoc('stairs', { tower_id: 't1', action: 'set_type', stair_key: n2[0].key, type: 'N3' });
    const sau = await mb();
    expect(sau.thang_bo.some((x) => x.loai === 'N2')).toBe(true);
    expect(sau.thang_bo.some((x) => x.loai === 'N3')).toBe(true);
    expect(sau.thang_bo.find((x) => x.key === n2[0].key)?.loai).toBe('N3');
    await loi('stairs', { tower_id: 't1', action: 'move', stair_key: 'khong' }, /Không có thang/);
    await loi('stairs', { tower_id: 't1', action: 'reset_auto' }, /Không có gì thay đổi/);
  });
  thu('optimize_floor', async () => {
    kho.sua((p) => ({ ...p, lo: p.lo.map((l) => ({ ...l, temDat: { ...l.temDat, coCauMucTieu: { stu: 0, '1pn': 0, '2pn': 100, '2pnp': 0, '3pn': 0 } } })) }));
    const b0 = kho.soBuoc().truoc;
    const r = await chay('optimize_floor', { tower_id: 't1' });
    if (!r.loi) { expect(kho.soBuoc().truoc).toBe(b0 + 1); expect(r.json.so_doi).toBeGreaterThan(0); } else expect(r.noiDung).toMatch(/Không tìm được/);
  });
  thu('reset_floor_units', async () => {
    const m = await mb();
    const o = m.o.find((x) => x.cong_nang === 'can')!;
    await motBuoc('change_units', { tower_id: 't1', changes: [{ cell: o.key, unit_type: o.loai === '2pn' ? '3pn' : '2pn' }] });
    await motBuoc('reset_floor_units', { tower_id: 't1' });
  });
  thu('stretch_unit', async () => {
    const m = await mb();
    await loi('stretch_unit', { tower_id: 't1', cell: m.o[0].key, delta_mm: 150 }, /bội số/);
    let ok = false;
    for (const o of m.o.filter((x) => x.cong_nang === 'can')) { const r = await chay('stretch_unit', { tower_id: 't1', cell: o.key, delta_mm: 100 }); if (!r.loi) { ok = true; break; } }
    expect(kho.soBuoc().truoc).toBe(ok ? 1 : 0);
  });
  thu('set_floor_mix_target', async () => {
    await motBuoc('set_floor_mix_target', { tower_id: 't1', floors: [5, 6], mix: { '2pn': 60, '3pn': 20 } });
    expect(kho.lay().toa[0].tangRieng?.[5]?.coCauMucTieu?.['2pn']).toBe(60);
    await loi('set_floor_mix_target', { tower_id: 't1', floors: [], mix: null }, /floors/);
  });
  thu('repack_floor', async () => {
    // tòa vừa tự chỉnh → không đổi gì → lỗi (không ghi bước rỗng)
    await loi('repack_floor', { tower_id: 't1' }, /khít/);
  });
});

describe('công cụ khác', () => {
  thu('update_basement', async () => {
    await motBuoc('update_basement', { fields: { soTang: 3, tyLeKyThuat: 12 }, ram: { loai: 'cong' } });
    expect(kho.lay().ham).toMatchObject({ soTang: 3, tyLeKyThuat: 0.12 });
    await loi('update_basement', { fields: { soTang: 9 } }, /khoảng/);
    await loi('update_basement', { fields: { khong: 1 } }, /không có/);
    // đợt 2: khoang cháy, phòng kỹ thuật, xe lăn tự động, ram có đoạn thẳng, xe điện
    await motBuoc('update_basement', { fields: { dtKhoangMax: 2500, qSinhHoat: 120 }, auto_rooms: true, auto_accessible: true, rooms: { xlnt: { bo: true }, bomSH: { dt: 60 } }, ram: { doanThangTren: 8 }, ev: { bat: true, tyLeOto: 20 } });
    expect(kho.lay().ham).toMatchObject({ dtKhoangMax: 2500, qSinhHoat: 120, tuDongPhong: true, xeLanTuDong: true, phong: { xlnt: { bo: true }, bomSH: { dt: 60 } } });
    expect(kho.lay().ham.ram?.doanThangTren).toBe(8);
    expect(kho.lay().ham.xeDien?.tyLeOto).toBe(20);
    await loi('update_basement', { rooms: { phongLa: { bo: true } } }, /không có/);
  });
  thu('update_cost', async () => {
    await motBuoc('update_cost', { unit_prices: { ketCau: 5_000_000 }, rates: { qlda: 2 }, sale: { can: { '2pn': 60_000_000 } } });
    expect(kho.lay().chiPhi!.donGia.ketCau).toBe(5_000_000);
    expect(kho.lay().chiPhi!.ban.can['2pn']).toBe(60_000_000);
    await loi('update_cost', { unit_prices: { vang: 1 } }, /không có/);
  });
  thu('manage_pa', async () => { await loi('manage_pa', { action: 'duplicate', pa_id: 'pa-1' }, /không quản lý/i); });
  thu('export_file', async () => { await loi('export_file', { kind: 'xls' }, /Không xuất/); });
  thu('undo', async () => {
    await motBuoc('lock_towers', { tower_ids: ['t1'], locked: true });
    const r = await chay('undo', {});
    expect(r.loi).toBe(false);
    expect(kho.lay().toa[0].khoa).toBeFalsy();
    expect((await chay('undo', {})).loi).toBe(true);
  });
  thu('redo', async () => {
    await motBuoc('lock_towers', { tower_ids: ['t1'], locked: true });
    await chay('undo', {});
    expect((await chay('redo', {})).loi).toBe(false);
    expect(kho.lay().toa[0].khoa).toBe(true);
  });
  thu('ui_snapshot', async () => { await loi('ui_snapshot', {}, /giao diện/); });
  thu('ui_click', async () => { await loi('ui_click', { id: 'x' }, /giao diện/); });
  thu('ui_set_value', async () => { await loi('ui_set_value', { id: 'x', value: '1' }, /giao diện/); });
});

describe('chế độ Chỉ xem', () => {
  it('mọi công cụ sửa PA đều từ chối, PA giữ nguyên', async () => {
    chiXem = true;
    const m = await mb();
    const ca: [string, Record<string, unknown>][] = [
      ['apply_arrangement', { lot_id: 'B' }], ['batch_arrange', { lot_ids: ['B'] }], ['add_tower', { lot_id: 'A', template_id: mau.id }],
      ['update_tower', { tower_id: 't1', floors: 9 }], ['transform_towers', { tower_ids: ['t1'], action: 'mirror' }], ['duplicate_towers', { tower_ids: ['t1'] }],
      ['delete_towers', { tower_ids: ['t1'] }], ['lock_towers', { tower_ids: ['t1'], locked: true }], ['set_road_edges', { lot_id: 'A', clear: true }],
      ['add_lot', {}], ['update_lot', { lot_id: 'A', code: 'Z' }], ['update_coefficients', { thresholds: { dtCanM2: 1 } }],
      ['change_units', { tower_id: 't1', changes: [{ cell: m.o[0].key, unit_type: '2pn' }] }], ['swap_units', { tower_id: 't1', a: m.o[0].key, b: m.o[1].key }],
      ['add_unit', { tower_id: 't1', cell: m.o[0].key }], ['delete_units', { tower_id: 't1', cells: [m.o[0].key] }], ['flip_units', { tower_id: 't1', cells: [m.o[0].key] }],
      ['set_cell_function', { tower_id: 't1', cells: [m.o[0].key], function: 'trong' }], ['stairs', { tower_id: 't1', action: 'reset_auto' }],
      ['optimize_floor', { tower_id: 't1' }], ['reset_floor_units', { tower_id: 't1' }], ['stretch_unit', { tower_id: 't1', cell: m.o[0].key, delta_mm: 100 }],
      ['set_floor_mix_target', { tower_id: 't1', floors: [2], mix: null }], ['repack_floor', { tower_id: 't1' }],
      ['update_basement', { fields: { soTang: 3 } }], ['update_cost', { rates: { qlda: 1 } }], ['undo', {}], ['redo', {}],
    ];
    for (const [ten, v] of ca) await loi(ten, v, /Chỉ xem/);
  });
});

describe('phủ đủ', () => {
  it('mọi công cụ trong bộ đều có ca thử', () => {
    const thieu = BO_CONG_CU.map((c) => c.ten).filter((x) => !daThu.has(x));
    expect(thieu).toEqual([]);
  });
});
