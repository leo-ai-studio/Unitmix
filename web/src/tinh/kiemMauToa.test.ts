/**
 * Kiểm mẫu tòa (tinh/kiemMauToa.ts): mọi mẫu thư viện sạch lỗi so với chính nền của nó; sửa hỏng cố ý (đè căn, bỏ thang, đặt căn sai
 * vị trí, nét bao sai) thì bị bắt đúng mã lỗi.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { taoThuVien, type CanMau, type ToaDat, type ToaMau } from './kieu';
import { tuChinhToa, type DuLieuMB, type HinhLoiMB, type ToaMB } from './loiThang';
import { kiemMauToa, type MaKiemMau } from './kiemMauToa';
import { tinhCuaCan } from './pccc';
import { themBienThe } from './stretch';
import { viTriCan } from './matBang';


const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const toaDs = doc<ToaMau[]>('toa.json'), canDs = doc<CanMau[]>('can.json');
const tv = themBienThe(taoThuVien(toaDs, canDs));
const idLoi = (b: string) => 'loi-' + b.replace(/^x_/, '').replace(/_/g, '-');
const dl: DuLieuMB = { loi: new Map(), cuaCan: {} };
for (const t of toaDs) for (const m of (t as unknown as ToaMB).mat) for (const q of m.phan_tu)
  if (q.loai !== 'can' && !dl.loi.has(q.block) && existsSync(new URL(`loi/${idLoi(q.block)}.json`, lib))) dl.loi.set(q.block, doc<HinhLoiMB>(`loi/${idLoi(q.block)}.json`));
dl.loi.set('x_tb_n2', doc<HinhLoiMB>('loi/loi-tb-n2.json'));
for (const c of canDs) dl.cuaCan[c.ma_goc] = tinhCuaCan(doc<{ ve: { cat: string; pts: [number, number][] }[] }>(`can/${c.id}.json`).ve, c.rong_mm);
const c = { tv, dl };
const toaThu = (id: string): ToaDat =>
  tuChinhToa({ id: 't', loId: 'l', mauId: id, x: 0, y: 0, gocDo: 0, soTangDH: 24, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {} }, tv.toa.get(id) as unknown as ToaMB, tv, dl);
const ma = (t: ToaDat): MaKiemMau[] => kiemMauToa(t, c).vi.filter((v) => v.muc === 'loi').map((v) => v.ma);

describe('kiểm mẫu tòa — mẫu thư viện sạch lỗi', () => {
  it.each(toaDs.map((t) => t.id))('%s', (id) => {
    const r = kiemMauToa(toaThu(id), c);
    expect(r.vi.filter((v) => v.muc === 'loi'), id).toEqual([]);
    expect(r.soCan).toBeGreaterThanOrEqual(8);
    expect(r.soThang).toBeGreaterThanOrEqual(2);
  });
});

describe('kiểm mẫu tòa — bắt đúng lỗi cố ý', () => {
  it('bỏ hết thang → thang_so', () => {
    const t = toaThu('tm-i2');
    expect(ma({ ...t, matBang: { ...t.matBang!, thangBo: [] } })).toContain('thang_so');
  });
  it('chỉ còn thang N3 → thang_n2n3', () => {
    const t = toaThu('tm-i2'), ds = t.matBang!.thangBo.filter((x) => x.block.includes('n3'));
    expect(ma({ ...t, matBang: { ...t.matBang!, thangBo: [ds[0], { ...ds[0], khoa: 'x:9' }] } })).toContain('thang_n2n3');
  });
  it('dời một căn đè căn kề → de hoặc khe', () => {
    const t = toaThu('tm-i2'), k = viTriCan(tv.toa.get('tm-i2') as never, tv)[1].khoa;
    const ds = ma({ ...t, matBang: { ...t.matBang!, dich: { ...(t.matBang!.dich ?? {}), [k]: 3000 } } });
    expect(ds.includes('de') || ds.includes('khe')).toBe(true);
  });
  it('nét bao phóng 20 % → lệch nét bao / ô (dinh_xa · goc_ngoai · dtxd)', () => {
    const t = toaThu('tm-i2'), bao = t.matBang?.duongBao ?? (tv.toa.get('tm-i2') as ToaMau).duong_bao;
    const to = bao.map(([x, y]) => [x * 1.2, y * 1.2] as [number, number]);
    const ds = ma({ ...t, matBang: { ...t.matBang!, duongBao: to } });
    expect(ds.some((x) => x === 'dinh_xa' || x === 'goc_ngoai' || x === 'dtxd')).toBe(true);
  });
});
