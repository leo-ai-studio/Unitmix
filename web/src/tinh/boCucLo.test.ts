import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { napThuVien, toaThu } from '../thu/thuVienThat';
import { chamHienTrang, cheNangPct, chiaDay, doiDauHoi, gioTheoHuong, gioXuyen, sinhBoCuc, trucDai } from './boCucLo';
import { chanToa, dienTich } from './hinhHoc';
import { HE_SO_MAC_DINH, NGUONG_MAC_DINH, type ChiTieuQH, type Diem, type Lo, type ToaDat, type TrangThaiPA } from './kieu';
import { traLuat, type BoQuyTac } from './quyTac';
import { duLuiTungCanh, kcDaGiac, kcToa261, luiTungCanh, namTrongNhanh, type DauVaoXep, type GoiYXep } from './xepToa';

const { tv } = napThuVien();
const bo = JSON.parse(readFileSync(new URL('../../public/lib/quy_tac.json', import.meta.url), 'utf8')) as BoQuyTac;
const luat = { lo01: traLuat(bo, 'LO-01')!, lo02: traLuat(bo, 'LO-02')! };
const chiTieu = { matDoMax: 40, matDoThapMax: 22, hssddMax: 8, tangCaoMax: 25, tangDe: 1, tangCanHo: 24, soCanMax: null, danSoMax: null, nguoiMoiCan: 3 } as unknown as ChiTieuQH;
/** Lô hình thang vát góc, rộng chừng 3,5 ha. */
const RANH: Diem[] = [[0, 0], [190, -12], [200, 170], [40, 200], [0, 170]];
const lo = { id: 'A', ranh: RANH, chiGioi: null, xungQuanh: [], canhDuong: RANH.map(() => 12), temDat: { kyHieu: 'A', chucNang: 'tm', chiTieu, coCauMucTieu: { stu: 5, '1pn': 20, '2pn': 45, '2pnp': 15, '3pn': 15 } } } as unknown as Lo;
const toa = (id: string, x: number, y: number, gocDo: number, khoa = false): ToaDat => ({ ...toaThu('tm-z1', 23), id, loId: 'A', x, y, gocDo, khoa });
const taoPA = (ds: ToaDat[]) => ({ phienBan: 1, lo: [lo], heSo: HE_SO_MAC_DINH, nguong: NGUONG_MAC_DINH, toa: ds, ham: { soTang: 0 } } as unknown as TrangThaiPA);
const chay = (v: Partial<DauVaoXep> & Pick<DauVaoXep, 'pa'>): GoiYXep[] => {
  const g = sinhBoCuc({ lo, tv, luat, ...v });
  for (;;) { const r = g.next(); if (r.done) return r.value; }
};
const baToa = () => [toa('a', 50, 50, 10), toa('b', 150, 50, 10), toa('c', 100, 130, 10)];
const hopLe = (ds: ToaDat[], H: number) => {
  const F = ds.map((x) => chanToa(tv.toa.get(x.mauId)!, x)), lui = luiTungCanh(luat.lo01, lo, H, 12), kc = kcToa261(luat.lo02, H);
  for (const f of F) { expect(namTrongNhanh(f, RANH)).toBe(true); expect(duLuiTungCanh(f, RANH, lui)).toBe(true); }
  for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) {
    const d = kcDaGiac(F[i], F[j]);
    expect(d).toBeGreaterThanOrEqual((doiDauHoi(F[i], F[j]) ? kc.hoi : kc.dai) - 1e-6);
  }
};

describe('sắp lại các tòa đang có', () => {
  const ds = chay({ pa: taoPA(baToa()), cheDoBoCuc: 'sap_lai' });

  it('ra nhiều phương án, đúng số tòa, đúng mẫu, giữ id và số tầng', () => {
    expect(ds.length).toBeGreaterThanOrEqual(5);
    for (const g of ds) {
      expect(g.toa.map((x) => x.id).sort()).toEqual(['a', 'b', 'c']);
      expect(g.toa.every((x) => x.mauId === 'tm-z1' && x.soTangDH === 23)).toBe(true);
    }
  });

  it('mọi phương án đủ lùi LO-01, khoảng cách LO-02, nằm trong lô', () => {
    for (const g of ds) hopLe(g.toa, 1 * 4.5 + 23 * 3.3);
  });

  it('bản đồ khoảng lùi không làm lọt tòa phạm chỉ giới ở lô chật', () => {
    const hep: Diem[] = [[0, 0], [110, 0], [110, 70], [0, 70]];
    const lo2 = { ...lo, ranh: hep, canhDuong: hep.map(() => 12) };
    const r = chay({ pa: { ...taoPA([]), lo: [lo2], toa: [{ ...toaThu('tm-i2', 23), id: 'a', loId: 'A', x: 55, y: 35, gocDo: 0 }] }, lo: lo2, cheDoBoCuc: 'sap_lai' });
    const lui = luiTungCanh(luat.lo01, lo2, 4.5 + 23 * 3.3, 12);
    for (const g of r) for (const x of g.toa) expect(duLuiTungCanh(chanToa(tv.toa.get(x.mauId)!, x), hep, lui)).toBe(true);
  });

  it('tòa khoá đứng yên, các phương án né tòa khoá', () => {
    const khoa = toa('k', 50, 50, 10, true);
    const r = chay({ pa: taoPA([khoa, toa('b', 150, 50, 10), toa('c', 100, 130, 10)]), cheDoBoCuc: 'sap_lai' });
    const Fk = chanToa(tv.toa.get('tm-z1')!, khoa), kc = kcToa261(luat.lo02, 4.5 + 23 * 3.3).hoi;
    expect(r.length).toBeGreaterThan(0);
    for (const g of r) {
      expect(g.toa.some((x) => x.id === 'k')).toBe(false);
      for (const x of g.toa) expect(kcDaGiac(chanToa(tv.toa.get(x.mauId)!, x), Fk)).toBeGreaterThanOrEqual(kc - 1e-6);
    }
  });

  it('tòa khác dòng sản phẩm của lô vẫn được xếp (lô thương mại đang đặt mẫu NOXH)', () => {
    const r = chay({ pa: taoPA([{ ...toaThu('xh-z6', 23), id: 'a', loId: 'A', x: 100, y: 90, gocDo: 10 }]), cheDoBoCuc: 'sap_lai' });
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].mau[0][0]).toBe('xh-z6');
  });

  it('điểm năm tiêu chí nằm trong 0–100, ưu tiên gió đẩy gió lên đầu', () => {
    for (const g of ds) for (const k of ['nang', 'gio', 'view', 'mat', 'san'] as const) { expect(g.boCuc![k]).toBeGreaterThanOrEqual(0); expect(g.boCuc![k]).toBeLessThanOrEqual(100); }
    const uu = chay({ pa: taoPA(baToa()), cheDoBoCuc: 'sap_lai', uuTien: 'gio' });
    expect(uu[0].boCuc!.gio).toBeGreaterThanOrEqual(ds[0].boCuc!.gio);
  });
});

describe('tự tổ hợp', () => {
  const ds = chay({ pa: taoPA([]), cheDoBoCuc: 'to_hop' });

  it('tổ hợp sát DTXD tối đa, không vượt chỉ tiêu, có nhiều tập mẫu', () => {
    expect(ds.length).toBeGreaterThanOrEqual(5);
    expect(ds.every((g) => g.loiQH === 0)).toBe(true);
    expect(new Set(ds.map((g) => g.mau.map((m) => m[0]).join('+'))).size).toBeGreaterThanOrEqual(2);
    const dtLo = dienTich(RANH);
    const tot = Math.max(...ds.map((g) => g.toa.reduce((s, x) => s + dienTich(chanToa(tv.toa.get(x.mauId)!, x)), 0) / dtLo));
    expect(tot * 100).toBeGreaterThan(22 * 0.8);
    expect(tot * 100).toBeLessThanOrEqual(22 + 1e-6);
  });

  it('chỉ dùng các mẫu đã chọn', () => {
    const r = chay({ pa: taoPA([]), cheDoBoCuc: 'to_hop', chiMau: ['tm-z1', 'tm-v2'] });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((g) => g.mau.every(([m]) => m === 'tm-z1' || m === 'tm-v2'))).toBe(true);
  });
});

describe('hiện trạng và kiểu mới', () => {
  it('sắp lại kèm điểm hiện trạng cùng thang đo, đánh dấu sapLai', () => {
    const r = chay({ pa: taoPA(baToa()), cheDoBoCuc: 'sap_lai' });
    expect(r[0].sapLai).toBe(true);
    expect(r[0].hienTrang).toBeTruthy();
    expect(r[0].hienTrang!.tong).toBeGreaterThan(0);
    expect(r[0].boCuc!.cheNangPct).toBeGreaterThanOrEqual(0);
  });

  it('tòa chữ L ôm góc lô, hợp lệ', () => {
    const r = chay({ pa: taoPA([{ ...toaThu('tm-l1', 23), id: 'a', loId: 'A', x: 90, y: 90, gocDo: 0 }, { ...toaThu('tm-l1', 23), id: 'b', loId: 'A', x: 90, y: 150, gocDo: 0 }]), cheDoBoCuc: 'sap_lai', soGoiY: 12 });
    const g = r.find((x) => x.kieu === 'om_goc');
    expect(g).toBeTruthy();
    hopLe(g!.toa, 4.5 + 23 * 3.3);
  });

  it('dùng hướng gió truyền vào', () => {
    const a = chay({ pa: taoPA(baToa()), cheDoBoCuc: 'sap_lai', huongGio: [{ pv: 180, ts: 1 }] });
    const b = chay({ pa: taoPA(baToa()), cheDoBoCuc: 'sap_lai', huongGio: [{ pv: 90, ts: 1 }] });
    expect(a[0].hienTrang!.gioPct).not.toBeCloseTo(b[0].hienTrang!.gioPct, 3);
  });

  it('lô tam giác, tòa chữ L: quy tắc dãy không chứa đủ thì vẫn có phương án, đúng số tòa, hợp lệ', () => {
    const ranh: Diem[] = [[0, 0], [240, 0], [0, 200]];
    const lo2 = { ...lo, ranh, canhDuong: ranh.map(() => 12) } as Lo;
    const ds = [[40, 40], [110, 40], [40, 100]].map(([x, y], i) => ({ ...toaThu('tm-l1', 23), id: `t${i}`, loId: 'A', x, y, gocDo: 0 }));
    const r = chay({ pa: { ...taoPA(ds), lo: [lo2] }, lo: lo2, cheDoBoCuc: 'sap_lai' });
    expect(r.length).toBeGreaterThan(0);
    const lui = luiTungCanh(luat.lo01, lo2, 4.5 + 23 * 3.3, 12);
    for (const g of r) {
      expect(g.toa.length).toBe(3);
      for (const x of g.toa) expect(duLuiTungCanh(chanToa(tv.toa.get(x.mauId)!, x), ranh, lui)).toBe(true);
    }
  });

  it('có cây xanh cạnh lô thì đo độ mở về phía đó', () => {
    const cx = { ...lo, id: 'CX', ranh: [[210, 0], [300, 0], [300, 150], [210, 150]] as Diem[], canhDuong: undefined, temDat: { ...lo.temDat, kyHieu: 'CX-1', chucNang: 'khac' } } as unknown as Lo;
    const r = chay({ pa: { ...taoPA(baToa()), lo: [lo, cx] }, cheDoBoCuc: 'sap_lai' });
    expect(r[0].boCuc!.moXanhPct).not.toBeNull();
  });
});

describe('tiêu chí bố cục', () => {
  const vuong: Diem[] = [[0, 0], [100, 0], [100, 100], [0, 100]];
  const tam = (x: number, y: number, w: number, h: number): Diem[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

  it('gió: thanh nằm dọc gió chắn ít hơn thanh nằm ngang gió', () => {
    // gió Nam (180°) thổi theo trục y: thanh dài theo y chỉ che bề rộng của nó
    expect(gioXuyen(vuong, [tam(45, 10, 10, 80)], 180)).toBeCloseTo(90, 5);
    expect(gioXuyen(vuong, [tam(10, 45, 80, 10)], 180)).toBeCloseTo(20, 5);
  });

  it('gió: tính hợp phần che, hai tòa trùng dải không che hai lần', () => {
    expect(gioXuyen(vuong, [tam(40, 10, 20, 10), tam(40, 60, 20, 10)], 180)).toBeCloseTo(80, 5);
  });

  it('sân: gom tòa về một phía cho điểm sân cao hơn đặt giữa lô', () => {
    const v = (ds: ToaDat[]) => chamHienTrang({ pa: taoPA(ds), lo, tv, luat })!;
    const rai = v([toa('a', 50, 50, 10), toa('b', 150, 50, 10), toa('c', 100, 100, 10), toa('d', 60, 150, 10), toa('e', 150, 150, 10)]);
    const gom = v([toa('a', 50, 40, 0), toa('b', 110, 40, 0), toa('c', 170, 40, 0)]);
    expect(gom.sanM2).toBeGreaterThan(rai.sanM2);
  });

  it('§2.6.1: hai thanh song song là cạnh dài, nối đuôi là đầu hồi', () => {
    expect(doiDauHoi(tam(0, 0, 60, 18), tam(0, 40, 60, 18))).toBe(false);
    expect(doiDauHoi(tam(0, 0, 60, 18), tam(80, 0, 60, 18))).toBe(true);
    expect(doiDauHoi(tam(0, 0, 60, 18), tam(50, 40, 60, 18))).toBe(true); // chỉ chồng 10 m
  });

  it('gió nhiều hướng: gộp theo trọng số', () => {
    const F = [tam(45, 10, 10, 80)];
    expect(gioTheoHuong(vuong, F, [{ pv: 180, ts: 1 }, { pv: 90, ts: 1 }])).toBeCloseTo((90 + 20) / 2, 5);
  });

  it('che nắng: tòa cao sát phía Nam che tòa sau, đứng xa hoặc thấp thì không', () => {
    const sau = { F: tam(0, 0, 60, 15), H: 60 };
    const che = cheNangPct([sau, { F: tam(0, -30, 60, 15), H: 80 }], [], 21);
    const xa = cheNangPct([sau, { F: tam(0, -400, 60, 15), H: 80 }], [], 21);
    const thap = cheNangPct([sau, { F: tam(0, -30, 60, 15), H: 10 }], [], 21);
    expect(che).toBeGreaterThan(xa);
    expect(thap).toBeLessThan(che);
    expect(xa).toBeCloseTo(0, 5);
  });

  it('trục dài và cách chia dãy', () => {
    expect(trucDai(tam(0, 0, 60, 10))).toBeCloseTo(0, 5);
    expect(Math.abs(trucDai(tam(0, 0, 10, 60)))).toBeCloseTo(90, 5);
    expect(chiaDay(4)).toEqual([[4], [1, 3], [2, 2], [3, 1], [1, 1, 2], [1, 2, 1], [2, 1, 1]]);
  });
});
