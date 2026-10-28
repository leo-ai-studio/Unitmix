/**
 * XC-05 · đoạn kẹp (QT-56 · QT-22b · QT-81 app cũ): căn kề lõi hở / đè nét bao lõi > 200 mm mà đoạn không có đầu tự do (kẹp giữa
 * lõi và ô thang / lõi khác / cánh khác, hoặc thang liền không được dời) thì dời đoạn trong khoảng giữa hai mốc, thiếu / thừa thì
 * STRETCH (bước 100, ±500) — 0 đè, 0 khe mới (tinh/khe.ts), thang đứng yên, bố cục đổi ghi vào `tuDong`. Chạy trên mẫu thật.
 */
import { describe, expect, it } from 'vitest';
import { layMau } from '../thu/layMau';
import { existsSync, readFileSync } from 'node:fs';
import { tongKhe } from './khe';
import { taoThuVien, type CanMau, type ToaDat, type ToaMau } from './kieu';
import { apMatBang, daiLoi, doDeKhe, doKhitLoi, goTuDong, matBangMacDinh, TUONG_CHUNG_MM, tuChinhGiam, tuChinhMatBang, tuChinhToa, type DuLieuMB, type HinhLoiMB, type ToaMB } from './loiThang';
import { boCucTang, matDaDon, type BoCuc } from './matBang';
import { chieuCaoPCCC, tinhCuaCan } from './pccc';
import { themBienThe } from './stretch';

const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const toaDs = doc<ToaMau[]>('toa.json'), canDs = doc<CanMau[]>('can.json');
const tv = themBienThe(taoThuVien(toaDs, canDs));
const idLoi = (b: string) => 'loi-' + b.replace(/^x_/, '').replace(/_/g, '-');
const dl: DuLieuMB = { loi: new Map(), cuaCan: {} };
for (const t of toaDs) for (const m of (t as unknown as ToaMB).mat) for (const q of m.phan_tu)
  if (q.loai !== 'can' && !dl.loi.has(q.block) && existsSync(new URL(`loi/${idLoi(q.block)}.json`, lib))) dl.loi.set(q.block, doc<HinhLoiMB>(`loi/${idLoi(q.block)}.json`));
for (const c of canDs) dl.cuaCan[c.ma_goc] = tinhCuaCan(doc<{ ve: { cat: string; pts: [number, number][] }[] }>(`can/${c.id}.json`).ve, c.rong_mm);

const mau = (id: string) => tv.toa.get(id) as unknown as ToaMB;
const H24 = chieuCaoPCCC(1, 4.5, 24, 3.3);
const toaThu = (m: ToaMB, them: Partial<ToaDat> = {}): ToaDat =>
  ({ id: 't', loId: 'l', mauId: m.id, x: 0, y: 0, gocDo: 0, soTangDH: 24, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {}, ...them });
/** Chỗ căn hở / đè nét bao lõi > 200 mm, đo độc lập trên mặt bằng đã tự chỉnh. */
const lechLoi = (m: ToaMB, mb: NonNullable<ToaDat['matBang']>, bc: BoCuc) => {
  const hd = apMatBang(m, mb, dl);
  return doKhitLoi({ ...hd, mat: matDaDon(hd, bc, tv) }, daiLoi(m, dl)).filter((k) => Math.abs(k.chong) > TUONG_CHUNG_MM);
};
const xc05 = (mb: NonNullable<ToaDat['matBang']>) => mb.baoCao!.quyTac.find((q) => q.ma === 'XC-05')!;

describe('XC-05 · đoạn kẹp: dời trong đoạn / STRETCH QT-81 thay vì chỉ cảnh báo', () => {
  it('tm-t2 24 tầng: căn kẹp giữa lõi và ô thang đè lõi 215 mm → dời đoạn về khít, 0 đè, cần xem 0', () => {
    const m = mau('tm-t2'), toa = tuChinhToa(toaThu(m), m, tv, dl), mb = toa.matBang!, bc = boCucTang(toa, null);
    const q = xc05(mb);
    expect(['ok', 'da_sua']).toContain(q.muc);
    expect(q.sua).toBeGreaterThan(0);
    expect(mb.baoCao!.quyTac.filter((x) => x.muc === 'canh_bao')).toEqual([]);
    expect(lechLoi(m, mb, bc)).toEqual([]);
    expect(doDeKhe(m, mb, dl, tv, bc)).toMatchObject({ de: 0, mm: 0, san: 0 });
    // thang giữ nguyên số lượng, không còn căn vượt
    expect(mb.thangBo.length).toBe(3);
    expect(mb.baoCao!.vuotSau).toBe(0);
  });

  it('tm-t2, thang đứng yên (thang liền), căn kề lõi đang STRETCH +500 đè lõi 715 mm → STRETCH lại về khít, ghi tuDong', () => {
    const m = mau('tm-t2'), t0 = tuChinhToa(toaThu(m), m, tv, dl);
    const thang = t0.matBang!.thangBo.map((t) => ({ ...t }));
    const bcVao: BoCuc = { canTheo: {}, canViTri: { '1:0': 'tm-2pnp-g1~s+500' } };
    const r = tuChinhMatBang(m, tv, dl, { bc: bcVao, chieuCaoPCCC: H24, thangEp: thang, giu: [] });
    const q = xc05(r.matBang);
    expect(q.muc).toBe('da_sua');
    expect(q.ghiChu).toMatch(/STRETCH \d+ mm \(QT-81\)/);
    // biến thể mới: bước 100, trong ±500, hẹp hơn +500
    const st = /~s([+-]\d+)$/.exec(r.bc.canViTri!['1:0'])!;
    expect(Number(st[1]) % 100).toBe(0);
    expect(Number(st[1])).toBeLessThan(500);
    expect(lechLoi(m, r.matBang, r.bc)).toEqual([]);
    expect(doDeKhe(m, r.matBang, dl, tv, r.bc)).toMatchObject({ de: 0, mm: 0 });
    // thang không dời
    expect(r.matBang.thangBo.map((t) => [t.matIdx, t.a0])).toEqual(thang.map((t) => [t.matIdx, t.a0]));
    // qua tuChinhGiam: đổi biến thể ghi thành thay đổi tự động (gỡ / hoàn tác được)
    const g = tuChinhGiam(m, tv, dl, { bc: bcVao, chieuCaoPCCC: H24, thangEp: thang, giu: [] }, false);
    expect(g.thayDoi).toContainEqual(expect.objectContaining({ truong: 'canViTri', khoa: '1:0', moi: r.bc.canViTri!['1:0'] }));
    const toa = tuChinhToa(toaThu(m, { canViTri: { '1:0': 'tm-2pnp-g1~s+500' }, giamCanTN: false }), m, tv, dl);
    expect(goTuDong(toa).canViTri).toEqual({ '1:0': 'tm-2pnp-g1~s+500' });
  });

  it('căn người dùng vừa chọn tay (chan) không bị STRETCH: không sửa được thì cảnh báo kèm lý do', () => {
    const m = mau('tm-t2'), t0 = tuChinhToa(toaThu(m), m, tv, dl);
    const thang = t0.matBang!.thangBo.map((t) => ({ ...t }));
    const r = tuChinhMatBang(m, tv, dl, { bc: { canTheo: {}, canViTri: { '1:0': 'tm-2pnp-g1~s+500' } }, chieuCaoPCCC: H24, thangEp: thang, chan: ['1:0'] });
    const q = xc05(r.matBang);
    expect(r.bc.canViTri!['1:0']).toBe('tm-2pnp-g1~s+500');
    expect(q.muc).toBe('canh_bao');
    expect(q.ghiChu).toMatch(/không sửa được: mặt 2 \(715 mm\): /);
  });

  // quét mọi mẫu tòa 24 tầng: XC-05 không còn cảnh báo, đè / khe không nhiều hơn mặt bằng mặc định của mẫu
  const ds = [...tv.toa.values()].filter((t) => Array.isArray((t as unknown as ToaMB).mat)).map((t) => t.id);
  it.each(layMau(ds))('%s 24 tầng: XC-05 không cảnh báo, không thêm đè / khe', (id) => {
    const m = mau(id), toa = tuChinhToa(toaThu(m), m, tv, dl), mb = toa.matBang!, bc = boCucTang(toa, null);
    expect(xc05(mb).muc).not.toBe('canh_bao');
    expect(lechLoi(m, mb, bc)).toEqual([]);
    const goc = tongKhe(apMatBang(m, matBangMacDinh(m, dl), dl), tv, { canTheo: {} }), k = doDeKhe(m, mb, dl, tv, bc);
    expect(k.de).toBeLessThanOrEqual(goc.de);
  });
});
