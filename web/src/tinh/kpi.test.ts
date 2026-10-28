/** KPI lãnh đạo (Tổng mặt bằng + màn Tầng) trên mẫu tòa / căn thật trong public/lib. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { tinhChiTieu } from './chiTieu';
import { danSoLo } from './danSo';
import { HE_SO_MAC_DINH, NGUONG_MAC_DINH, taoThuVien, type CanMau, type ChiTieuQH, type Lo, type ToaDat, type ToaMau, type TrangThaiPA } from './kieu';
import { HIEU_SUAT_MIN, kpiTang, kpiTmb, sanToa, soVoi } from './kpi';
import { boCucTang, congNangTai, canDangDung, coMat, viTriCan } from './matBang';

const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const toaDs = doc<ToaMau[]>('toa.json'), canDs = doc<CanMau[]>('can.json');
const tv = taoThuVien(toaDs, canDs);

const ct = (danSoMax: number): ChiTieuQH => ({ matDoMax: 40, matDoThapMax: null, hssddMax: 9, tangCaoMax: 40, tangDe: null, tangCanHo: null, tangHam: 0,
  danSoMax, soCanMax: null, nguoiMoiCan: 3.5, choDoOtoMoiCan: 1, choXeMayMoiCan: 2, cayXanhMin: 20 });
const lo = (id: string, x0: number, danSoMax: number, khai = false): Lo => ({
  id, ranh: [[x0, 0], [x0 + 120, 0], [x0 + 120, 100], [x0, 100]], chiGioi: null, xungQuanh: [],
  temDat: { kyHieu: id, chucNang: 'tm', chiTieu: ct(danSoMax), coCauMucTieu: { stu: 0, '1pn': 20, '2pn': 50, '2pnp': 10, '3pn': 20 },
    ...(khai ? { danSo: { tinh: 'hn', giaiDoan: 'cp' as const } } : {}) },
});
const toa = (id: string, loId: string, mauId: string, x: number, soTangDH = 25): ToaDat =>
  ({ id, loId, mauId, x, y: 50, gocDo: 0, soTangDH, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {} });
const pa = (l: Lo[], t: ToaDat[]): TrangThaiPA => ({ phienBan: 1, lo: l, heSo: HE_SO_MAC_DINH, nguong: NGUONG_MAC_DINH, toa: t,
  ham: { soTang: 0, ranh: null, nhip: 8.4, rongLan: 6, choDai: 5, choRong: 2.5, dtKho: 6 } });
const canTangCua = (t: ToaDat) => {
  const mau = tv.toa.get(t.mauId)!;
  if (!coMat(mau)) throw new Error('mẫu không có mặt');
  const bc = boCucTang(t, null);
  return viTriCan(mau, tv, bc).map((vt) => ({ canId: canDangDung(vt, bc), cn: congNangTai(vt.khoa, bc) }));
};

describe('soVoi', () => {
  it('trần: đạt / sát / vượt; sàn: chưa đạt; không ngưỡng = null', () => {
    expect(soVoi(80, 100).tt).toBe('dat');
    expect(soVoi(98, 100).tt).toBe('sat');
    expect(soVoi(101, 100).tt).toBe('vuot');
    expect(soVoi(0.72, 0.75, '>=').tt).toBe('chuaDat');
    expect(soVoi(0.75, 0.75, '>=').tt).toBe('dat');
    expect(soVoi(5, null).tt).toBeNull();
    expect(soVoi(null, 10).tt).toBeNull();
  });
});

describe('KPI màn Tầng — mẫu thật', () => {
  for (const mauId of ['tm-i1', 'tm-t2', 'tm-l1']) {
    it(`${mauId}: căn / tầng, DTSD = Σ thông thủy, hiệu suất = DTSD / DTXD, dân cộng các loại = dân tòa`, () => {
      const l = lo('A', 0, 5000, true), t = toa('T', 'A', mauId, 60);
      const p = pa([l], [t]);
      const cs = canTangCua(t);
      const k = kpiTang(p, tv, t, l, null, cs, l.temDat.coCauMucTieu);
      const soCan = cs.filter((c) => c.cn === 'can').length;
      expect(k.soCanTang).toBe(soCan);
      expect(k.soCanToa).toBe(soCan * 25);
      const dtsd = cs.reduce((a, c) => a + (tv.can.get(c.canId)?.dt_tt_m2 ?? 0), 0);
      expect(k.dtsd).toBeCloseTo(dtsd, 6);
      // DTXD sàn = nét bao mẫu; khớp DTXD ghi trong thư viện (bản vẽ CAD) trong 3 %
      expect(Math.abs(k.dtxd / tv.toa.get(mauId)!.dtxd_m2 - 1)).toBeLessThan(0.03);
      expect(k.hieuSuat.gt).toBeCloseTo(dtsd / k.dtxd, 9);
      // hiệu suất mẫu thật nằm quanh mốc Viện (72–78 %)
      expect(k.hieuSuat.gt!).toBeGreaterThan(0.6);
      expect(k.hieuSuat.gt!).toBeLessThan(0.9);
      expect(k.hieuSuat.tt).toBe(k.hieuSuat.gt! >= HIEU_SUAT_MIN ? 'dat' : 'chuaDat');
      // dân: cộng theo loại = dân tòa của danSoLo (QĐ Hà Nội từng căn)
      const ds = danSoLo(p, l, tv);
      expect(k.danToa).toBeCloseTo(ds.theoToa.T.nguoi, 6);
      expect(Object.values(k.theoLoai).reduce((a, x) => a + x.danToa, 0)).toBeCloseTo(k.danToa, 6);
      // % cộng 100, lệch = % − mục tiêu
      expect(Object.values(k.theoLoai).reduce((a, x) => a + x.pct, 0)).toBeCloseTo(100, 6);
      for (const x of Object.values(k.theoLoai)) {
        expect(x.lech).toBeCloseTo(x.pct - x.mucTieu, 9);
        if (x.nTang) expect(x.dtMin! <= x.dtBq! + 1e-9 && x.dtBq! <= x.dtMax! + 1e-9).toBe(true);
        else expect(x.dtBq).toBeNull();
      }
    });
  }

  it('ô đổi công năng không tính căn, không tính DTSD', () => {
    const l = lo('A', 0, 5000), t = toa('T', 'A', 'tm-i1', 60);
    const cs = canTangCua(t);
    const k0 = kpiTang(pa([l], [t]), tv, t, l, null, cs, l.temDat.coCauMucTieu);
    const cs1 = cs.map((c, i) => (i === 0 ? { ...c, cn: 'shcd' as const } : c));
    const k1 = kpiTang(pa([l], [t]), tv, t, l, null, cs1, l.temDat.coCauMucTieu);
    expect(k1.soCanTang).toBe(k0.soCanTang - 1);
    expect(k1.dtsd).toBeCloseTo(k0.dtsd - tv.can.get(cs[0].canId)!.dt_tt_m2, 6);
  });
});

describe('KPI Tổng mặt bằng — nhiều lô / nhiều tòa mẫu thật', () => {
  const lA = lo('A', 0, 3000, true), lB = lo('B', 200, 200);
  const ts = [toa('T1', 'A', 'tm-i1', 40), toa('T2', 'A', 'tm-l1', 90, 20), toa('T3', 'B', 'tm-t2', 260)];
  const p = pa([lA, lB], ts);
  const kq = tinhChiTieu(p, tv);

  it('theo lô: số căn, dân, DT sàn = dòng chỉ tiêu; DTSD = Σ thông thủy × tầng; hiệu suất = Σ DTSD / Σ sàn tháp', () => {
    const k = kpiTmb(p, tv, kq, ['A']);
    expect(k.soCan.gt).toBe(kq.theoLo.A.soCan);
    expect(k.danSo.gt).toBeCloseTo(kq.theoLo.A.dong.find((d) => d.khoa === 'danSo')!.dat!, 6);
    expect(k.danSo.nguong).toBe(3000);
    expect(k.dtSan.gt).toBeCloseTo(kq.theoLo.A.dtSanTinhHSSDD, 6);
    expect(k.dtSan.nguong).toBeCloseTo(9 * 120 * 100, 6);
    const s1 = sanToa(tv, ts[0]), s2 = sanToa(tv, ts[1]);
    expect(k.dtsd).toBeCloseTo(s1.dtsd + s2.dtsd, 6);
    expect(k.dtxd1San).toBeCloseTo(s1.dtxd1San + s2.dtxd1San, 6);
    expect(k.hieuSuat.gt).toBeCloseTo((s1.dtsd + s2.dtsd) / (s1.dtSanThap + s2.dtSanThap), 9);
    expect(k.toa.map((x) => x.toaId)).toEqual(['T1', 'T2']);
    // sàn tháp: không tầng riêng → DTXD × số tầng
    expect(s2.dtSanThap).toBeCloseTo(s2.dtxd1San * 20, 6);
    expect(k.matDo.gt).toBeCloseTo((kq.theoLo.A.dtDe / kq.theoLo.A.dtLo) * 100, 9);
  });

  it('cả dự án = cộng các lô; lô B ngưỡng dân nhỏ → vượt', () => {
    const a = kpiTmb(p, tv, kq, ['A']), b = kpiTmb(p, tv, kq, ['B']), d = kpiTmb(p, tv, kq, ['A', 'B']);
    expect(d.soLo).toBe(2);
    expect(d.soCan.gt).toBe(a.soCan.gt! + b.soCan.gt!);
    expect(d.danSo.gt).toBeCloseTo(a.danSo.gt! + b.danSo.gt!, 6);
    expect(d.danSo.nguong).toBe(3200);
    expect(d.dtsd).toBeCloseTo(a.dtsd + b.dtsd, 6);
    expect(d.dtSan.gt).toBeCloseTo(kq.tong.dtSanTinhHSSDD, 6);
    expect(b.danSo.tt).toBe('vuot'); // tm-t2 25 tầng × 3,5 người ≫ 200
    // lô B chưa khai QĐ tỉnh → dân tòa = căn × hệ số
    expect(b.toa[0].dan).toBeCloseTo(b.toa[0].soCan * 3.5, 6);
    // Σ dân từng tòa = dân lô
    expect(a.toa.reduce((s, x) => s + x.dan, 0)).toBeCloseTo(a.danSo.gt!, 6);
  });

  it('lô chưa có tòa: số liệu trống ("—"), không NaN', () => {
    const p0 = pa([lo('C', 0, 1000)], []);
    const k = kpiTmb(p0, tv, tinhChiTieu(p0, tv), ['C']);
    expect(k.danSo.gt).toBeNull();
    expect(k.hieuSuat.gt).toBeNull();
    expect(k.dtsd).toBe(0);
    expect(k.toa).toEqual([]);
  });
});
