import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chanToa } from './hinhHoc';
import { HE_SO_MAC_DINH, NGUONG_MAC_DINH, taoThuVien, type CanMau, type ChiTieuQH, type Diem, type Lo, type ToaMau, type TrangThaiPA } from './kieu';
import { traLuat, type BoQuyTac } from './quyTac';
import { themBienThe } from './stretch';
import { apHangLoat, paVoiChon, thuTuLo, xepHangLoat, xepHangLoatNen, xungDotCheo } from './xepHangLoat';
import { kcDaGiac, kcToa261, type LuatXep } from './xepToa';

const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const tv = themBienThe(taoThuVien(doc<ToaMau[]>('toa.json'), doc<CanMau[]>('can.json')));
const bo = doc<BoQuyTac>('quy_tac.json');
const luat: LuatXep = { lo01: traLuat(bo, 'LO-01')!, lo02: traLuat(bo, 'LO-02')! };

const chiTieu: ChiTieuQH = { matDoMax: 40, matDoThapMax: null, hssddMax: 8, tangCaoMax: 25, tangDe: 1, tangCanHo: null, tangHam: null, danSoMax: 3000, soCanMax: null, nguoiMoiCan: 3.6, choDoOtoMoiCan: 1, choXeMayMoiCan: 2, cayXanhMin: 20 };
const lo = (id: string, ranh: Diem[], canhDuong?: (number | null)[]): Lo => ({
  id, ranh, chiGioi: null, xungQuanh: [], ...(canhDuong ? { canhDuong } : {}),
  temDat: { kyHieu: id, chucNang: 'tm', chiTieu, coCauMucTieu: { stu: 10, '1pn': 20, '2pn': 45, '2pnp': 0, '3pn': 25 } },
});
const hcn = (x0: number, w: number, h: number): Diem[] => [[x0, 0], [x0 + w, 0], [x0 + w, h], [x0, h]];
// hai lô sát nhau, cạnh chung không giáp đường (lùi 0) → tòa hai lô có thể sát cạnh chung, chỉ §2.6.1 giữ chúng xa nhau
const A = lo('A', hcn(0, 120, 100), [12, null, 12, 12]);
const B = lo('B', hcn(120, 160, 100), [12, 12, 12, null]);
const C = lo('C', hcn(400, 30, 30)); // lô quá nhỏ: chạy nhưng không có phương án
const P: TrangThaiPA = { phienBan: 1, lo: [A, B, C], heSo: HE_SO_MAC_DINH, nguong: NGUONG_MAC_DINH, toa: [], ham: { soTang: 0, ranh: null, nhip: 8.4, rongLan: 6, choDai: 5, choRong: 2.5, dtKho: 6 } } as TrangThaiPA;

const chan = (p: TrangThaiPA, loId: string) => p.toa.filter((x) => x.loId === loId).map((x) => ({ F: chanToa(tv.toa.get(x.mauId)!, x), H: x.soTangDe * x.caoDe + x.soTangDH * x.caoDH }));

describe('xếp hàng loạt nhiều lô', () => {
  const thuTu = thuTuLo(P, ['A', 'B', 'C']);
  const kq = xepHangLoat({ pa: P, tv, luat, lo: thuTu });

  it('lô lớn chạy trước; mỗi lô một kết quả, mặc định chọn phương án đầu', () => {
    expect(thuTu.map((l) => l.id)).toEqual(['B', 'A', 'C']);
    expect(kq.map((r) => r.loId)).toEqual(['B', 'A', 'C']);
    expect(kq[0].ds.length).toBeGreaterThan(0);
    expect(kq[1].ds.length).toBeGreaterThan(0);
    expect(kq[0].chon).toBe(0);
    expect(kq[2].ds).toEqual([]);
    expect(kq[2].chon).toBeNull();
  });

  it('lô sau giữ khoảng cách §2.6.1 (cạnh dài) tới tòa đã đặt ở lô trước', () => {
    const p = paVoiChon(P, kq);
    for (const a of chan(p, 'A')) for (const b of chan(p, 'B')) {
      expect(kcDaGiac(a.F, b.F)).toBeGreaterThanOrEqual(kcToa261(luat.lo02, Math.max(a.H, b.H)).dai - 1e-6);
    }
    expect(xungDotCheo(P, kq, tv, luat).size).toBe(0);
  });

  it('áp cả lượt: thay đúng tòa các lô có phương án, id mới, lô không phương án giữ nguyên', () => {
    let n = 0;
    const cu = { ...P, toa: [{ ...kq[0].ds[0].toa[0], id: 'cu-C', loId: 'C' }] };
    const p = apHangLoat(cu, kq, () => `moi-${n++}`);
    expect(p.toa.filter((x) => x.loId === 'B').length).toBe(kq[0].ds[0].toa.length);
    expect(p.toa.filter((x) => x.loId === 'A').length).toBe(kq[1].ds[0].toa.length);
    expect(p.toa.find((x) => x.id === 'cu-C')).toBeTruthy();
    expect(p.toa.filter((x) => x.loId !== 'C').every((x) => x.id.startsWith('moi-'))).toBe(true);
  });

  it('đổi phương án một lô: chọn phương án khác thì áp đúng phương án đó; báo xung đột chéo nếu có', () => {
    if (kq[0].ds.length < 2) return;
    const doi = kq.map((r, i) => (i === 0 ? { ...r, chon: 1 } : r));
    const p = paVoiChon(P, doi);
    expect(p.toa.filter((x) => x.loId === 'B').map((x) => [x.mauId, x.x, x.y])).toEqual(kq[0].ds[1].toa.map((x) => [x.mauId, x.x, x.y]));
    const xd = xungDotCheo(P, doi, tv, luat);
    for (const [, v] of xd) expect(v.loi + v.canh).toBeGreaterThan(0);
  });

  it('dừng giữa chừng: trả các lô đã xong, chạy lại từ đó ra cùng kết quả', async () => {
    let buoc = 0, truocDo = -1;
    const r = await xepHangLoatNen({ pa: P, tv, luat, lo: thuTu }, (t) => {
      // tiến độ tính trên cả lượt (3 lô), tăng dần
      expect(t.tongLo).toBe(3);
      const p = (t.lo + t.phan) / t.tongLo;
      expect(p).toBeGreaterThanOrEqual(truocDo);
      truocDo = p;
      if (t.lo === 1) buoc++;
    }, () => buoc > 0);
    expect(r.dung).toBe(true);
    expect(r.kq.map((x) => x.loId)).toEqual(['B']);
    const tiep = await xepHangLoatNen({ pa: P, tv, luat, lo: thuTu, truoc: r.kq });
    expect(tiep.dung).toBe(false);
    expect(tiep.kq.map((x) => x.ds.map((g) => g.khoa))).toEqual(kq.map((x) => x.ds.map((g) => g.khoa)));
  });
});
