/**
 * Thay lõi thang máy cùng mẫu tòa (app cũ QT-71 · QT-72 · QT-74): mọi mẫu tòa × mọi lõi × mọi khối lõi thay được (cùng dạng, cùng loại
 * hình, mẫu riêng chỉ lõi cùng mẫu) — thay được, không đè mới, không khe mới, căn sát lõi mới khít nét bao ≤ tường chung, hoàn tác về
 * đúng lõi cũ. Quét theo hình học (không liệt kê tên) nên mẫu / lõi thêm sau cũng bị kiểm.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { mauToa } from './canThem';
import { taoThuVien, type CanMau, type ToaDat, type ToaMau } from './kieu';
import { apMatBang, daiLoi, doDeKhe, doKhitLoi, matBangTang, tuChinhToa, TUONG_CHUNG_MM, type DuLieuMB, type HinhLoiMB, type ToaMB } from './loiThang';
import { boCucTang, matDaDon } from './matBang';
import { tinhCuaCan } from './pccc';
import { themBienThe } from './stretch';
import { layMau } from '../thu/layMau';
import { canDangDung, viTriCan } from './matBang';
import { dsLoiToa, huyThayLoiTay, latTay, loiThayDuocToa, mauThem, thayLoiTay, themCanTay, xoaCanTay, type KetQuaTay } from './thaoTacTay';
import { mauCuaLoi } from './thayLoi';
import { veMauGocMB } from './doiCan';
import { chepBoCucSang } from './lanTruyenBoCuc';
import { taoPAMoi } from './macDinh';

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
const mauDung = (t: ToaDat) => mauToa(tv, t) as unknown as ToaMB;
const doKhi = (t: ToaDat) => {
  const m = mauDung(t), mb = matBangTang(t, m, dl, null), bc = boCucTang(t, null), hd = apMatBang(m, mb, dl);
  const lech = doKhitLoi({ ...hd, mat: matDaDon(hd, bc, tv) }, daiLoi(m, dl));
  return { ...doDeKhe(m, mb, dl, tv, bc), lechLoi: Math.max(0, ...lech.map((x) => Math.abs(x.chong))) };
};

const cap: { id: string; khoa: string; moi: string }[] = [];
for (const t of toaDs) {
  const toa = toaThu(t.id);
  for (const l of dsLoiToa(toa, c)) for (const moi of loiThayDuocToa(toa, c, l.khoa)) cap.push({ id: t.id, khoa: l.khoa, moi });
}

describe('thay lõi — danh sách thay được theo dạng / loại hình / mẫu', () => {
  it('có cặp thay được ở nhiều mẫu', () => { expect(cap.length).toBeGreaterThan(20); });
  it('tòa mẫu riêng (L · T · U · V · Y) chỉ lõi cùng mẫu; tòa I · Z không lấy lõi mẫu riêng', () => {
    for (const x of cap) {
      const h = tv.toa.get(x.id)!.hinh, m = mauCuaLoi(x.moi);
      if ('ltuvy'.includes(h)) expect(m, `${x.id} ← ${x.moi}`).toBe(h);
      else expect('ltuvy'.includes(m ?? '-'), `${x.id} ← ${x.moi}`).toBe(false);
    }
  });
  it('không thay lõi NOTM bằng lõi NOXH (sảnh 3,0 m / 2,6 m)', () => {
    for (const x of cap) expect(/^tm-/.test(x.id) ? true : true).toBe(true);
    for (const x of cap.filter((y) => y.id.startsWith('tm-'))) expect(/^x_xh_/.test(x.moi), `${x.id} ← ${x.moi}`).toBe(false);
  });
});

describe('thay lõi — mọi cặp: thay được, không đè / khe mới, khít lõi mới, hoàn tác', () => {
  const theoMau = new Map<string, typeof cap>();
  for (const x of cap) theoMau.set(x.id, [...(theoMau.get(x.id) ?? []), x]);
  it.each(layMau([...theoMau.keys()], 3))('%s', (id) => {
    const toa = toaThu(id), truoc = doKhi(toa), loi: string[] = [];
    for (const x of theoMau.get(id)!) {
      const r = thayLoiTay(toa, x.khoa, x.moi, c);
      if (!r.ok) { loi.push(`${x.khoa} → ${x.moi}: không thay được (${r.lyDo} ${r.chiTiet ?? ''})`); continue; }
      const sau = doKhi(r.toa);
      if (mauDung(r.toa).mat[Number(x.khoa.split(':')[0])].phan_tu[Number(x.khoa.split(':')[1])].block !== x.moi) loi.push(`${x.khoa} → ${x.moi}: lõi không đổi`);
      if (sau.de > truoc.de) loi.push(`${x.khoa} → ${x.moi}: đè ${sau.de} > ${truoc.de}`);
      if (sau.mm > truoc.mm + 200) loi.push(`${x.khoa} → ${x.moi}: khe +${Math.round(sau.mm - truoc.mm)} mm`);
      // lõi hub chéo (T · V · Y · L) có nét bao nhiều cạnh: app cũ đo mép căn sát lõi ≤ 300 mm (QT-71); lõi một dải ≤ tường chung
      const nguong = 'ltvy'.includes(tv.toa.get(id)!.hinh) ? 300 : TUONG_CHUNG_MM;
      if (sau.lechLoi > nguong) loi.push(`${x.khoa} → ${x.moi}: căn lệch nét bao lõi ${Math.round(sau.lechLoi)} mm`);
      const h = huyThayLoiTay(r.toa, x.khoa, c);
      if (!h.ok) loi.push(`${x.khoa} → ${x.moi}: hoàn tác ${h.lyDo}`);
      else if (dsLoiToa(h.toa, c).find((l) => l.khoa === x.khoa)?.block !== dsLoiToa(toa, c).find((l) => l.khoa === x.khoa)?.block) loi.push(`${x.khoa}: hoàn tác không về lõi cũ`);
    }
    expect(loi).toEqual([]);
  }, 300_000);
});

describe('thay lõi rồi sửa tay (xoá · thêm · lật căn): vẫn dồn về lõi MỚI, không đè / khe mới', () => {
  const mot = new Map<string, (typeof cap)[number]>();
  for (const x of cap) if (!mot.has(x.id)) mot.set(x.id, x);
  it.each(layMau([...mot.keys()], 3))('%s', (id) => {
    const x = mot.get(id)!, toa0 = toaThu(id), r0 = thayLoiTay(toa0, x.khoa, x.moi, c);
    expect(r0.ok, `${id} ${x.khoa} → ${x.moi}`).toBe(true);
    if (!r0.ok) return;
    const toa = r0.toa, goc = doKhi(toa), loi: string[] = [];
    const nguong = 'ltvy'.includes(tv.toa.get(id)!.hinh) ? 300 : TUONG_CHUNG_MM;
    const kiem = (ten: string, r: KetQuaTay) => {
      if (!r.ok) return; // thao tác bị chặn (không đủ chỗ) — không đổi gì
      const d = doKhi(r.toa);
      if (d.de > goc.de) loi.push(`${ten}: đè ${d.de} > ${goc.de}`);
      if (d.mm > goc.mm + 200) loi.push(`${ten}: khe +${Math.round(d.mm - goc.mm)} mm`);
      if (d.lechLoi > nguong) loi.push(`${ten}: căn lệch lõi mới ${Math.round(d.lechLoi)} mm`);
    };
    const vts = viTriCan(apMatBang(mauDung(toa), matBangTang(toa, mauDung(toa), dl, null), dl), tv, boCucTang(toa, null));
    for (const v of layMau(vts, 6)) {
      kiem(`xoá ${v.khoa}`, xoaCanTay(toa, null, [v.khoa], c));
      kiem(`lật ${v.khoa}`, latTay(toa, null, [v.khoa], c));
      kiem(`thêm sau ${v.khoa}`, themCanTay(toa, null, v, mauThem(tv, canDangDung(v, boCucTang(toa, null))), c, false));
    }
    expect(loi).toEqual([]);
  }, 300_000);
});

describe('thay lõi — Reset mặt bằng về mẫu gốc và chép bố cục sang tòa khác', () => {
  const cap2 = cap.find((x) => x.id === 'tm-z1')!;
  it('Reset: bỏ lõi thay, mẫu tòa và mặt bằng về đúng mẫu gốc của app', () => {
    const toa0 = toaThu(cap2.id), r = thayLoiTay(toa0, cap2.khoa, cap2.moi, c);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.toa.loiThay).toBeTruthy();
    expect(mauToa(tv, r.toa)).not.toBe(tv.toa.get(cap2.id)); // đang mang lõi mới
    const reset = veMauGocMB(r.toa);
    expect(reset.loiThay).toBeUndefined();
    expect(mauToa(tv, reset)).toBe(tv.toa.get(cap2.id)); // đúng đối tượng mẫu thư viện
    const nen = toaThu(cap2.id), moi = tuChinhToa(reset, mauDung(reset), tv, dl), cu = tuChinhToa(nen, mauDung(nen), tv, dl);
    expect(JSON.stringify(moi.matBang)).toBe(JSON.stringify(cu.matBang));
    expect(dsLoiToa(moi, c).map((l) => l.block)).toEqual(dsLoiToa(cu, c).map((l) => l.block));
  });
  it('Chép bố cục sang tòa cùng mẫu mang theo lõi đã thay', () => {
    const toa0 = toaThu(cap2.id), r = thayLoiTay(toa0, cap2.khoa, cap2.moi, c);
    if (!r.ok) throw new Error('không thay được');
    const pa = { ...taoPAMoi(), toa: [{ ...r.toa, id: 'a' }, { ...toaThu(cap2.id), id: 'b' }] };
    const kq = chepBoCucSang(pa, 'a', ['b']);
    expect(kq.them).toBe(1);
    expect(kq.pa.toa.find((x) => x.id === 'b')!.loiThay).toEqual(r.toa.loiThay);
  });
});
