import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chanToa } from './hinhHoc';
import { HE_SO_MAC_DINH, NGUONG_MAC_DINH, taoThuVien, type CanMau, type Diem, type Lo, type ThuVien, type ToaDat, type ToaMau, type TrangThaiPA } from './kieu';
import { chuanHoaCanhDuong } from './macDinh';
import { traLuat, type BoQuyTac } from './quyTac';
import { themBienThe } from './stretch';
import { boCanhDuong, canhGan, datCanhDuong, dichBatDinh, hinhToa, kichThuocToa, kiemViPham, viTriNhanBan, type LuatTMB } from './thaoTacToa';
import { coCanhDuong, goiYXepToa, kcToiDoan, luiBang27, luiTungCanh, rongCanh } from './xepToa';

// LO-01 theo lộ giới từng cạnh lô (`Lo.canhDuong`) — mọi số khoảng lùi tra từ quy_tac.json qua luiBang27, không chép số.
const bo = JSON.parse(readFileSync(new URL('../../public/lib/quy_tac.json', import.meta.url), 'utf8')) as BoQuyTac;
const luat: LuatTMB = { lo01: traLuat(bo, 'LO-01')!, lo02: traLuat(bo, 'LO-02')! };

const mauCN = { id: 'cn', duong_bao: [[0, 0], [40000, 0], [40000, 20000], [0, 20000]] } as unknown as ToaMau;
const tvCN = { toa: new Map([['cn', mauCN]]) } as unknown as ThuVien;
// cạnh 0: y = 0 (đáy) · 1: x = 200 · 2: y = 150 · 3: x = 0
const loCo = (canhDuong?: (number | null)[]): Lo => ({
  id: 'lo1', temDat: { kyHieu: 'A', chucNang: 'tm', chiTieu: {} as never, coCauMucTieu: {} as never },
  ranh: [[0, 0], [200, 0], [200, 150], [0, 150]], chiGioi: null, xungQuanh: [], ...(canhDuong ? { canhDuong } : {}),
});
// 1 đế + 6 tầng → H = 4,5 + 6 × 3,3 = 24,3 m: cột 22–28 của Bảng 2.7 (lùi khác nhau theo lộ giới)
const toa = (id: string, x: number, y: number): ToaDat => ({
  id, loId: 'lo1', mauId: 'cn', x, y, gocDo: 0, soTangDH: 6, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {},
});
const H = 4.5 + 6 * 3.3;
const pa = (lo: Lo, ds: ToaDat[]) => ({ lo: [lo], toa: ds }) as unknown as TrangThaiPA;

describe('lộ giới từng cạnh lô (LO-01 · Bảng 2.7)', () => {
  it('chưa khai thì mọi cạnh là đường 12 m (hành vi cũ); khai rồi thì theo từng cạnh, null = không giáp đường', () => {
    const L0 = loCo();
    expect(coCanhDuong(L0)).toBe(false);
    expect(luiTungCanh(luat.lo01, L0, H)).toEqual([0, 1, 2, 3].map(() => luiBang27(luat.lo01, 12, H)));
    const L = loCo([30, 12, null, 20]);
    expect(rongCanh(L, 2)).toBeNull();
    expect(luiTungCanh(luat.lo01, L, H)).toEqual([luiBang27(luat.lo01, 30, H), luiBang27(luat.lo01, 12, H), 0, luiBang27(luat.lo01, 20, H)]);
    // Bảng 2.7 cột 22–28 m: đường rộng hơn thì lùi ít hơn
    expect(luiBang27(luat.lo01, 12, H)).toBeGreaterThan(luiBang27(luat.lo01, 30, H));
  });

  it('chuẩn hoá PA cũ: số cạnh không khớp ranh thì bỏ, phần tử lạ thành null', () => {
    expect(chuanHoaCanhDuong(loCo()).canhDuong).toBeUndefined();
    expect(chuanHoaCanhDuong({ ...loCo(), canhDuong: [12, 12] }).canhDuong).toBeUndefined();
    expect(chuanHoaCanhDuong({ ...loCo(), canhDuong: [12, 'x', -3, null] as never }).canhDuong).toEqual([12, null, null, null]);
  });

  it('kiểm vi phạm: sát cạnh không giáp đường thì đạt; sát cạnh giáp đường 12 m thì thiếu lùi, ghi đúng cạnh + lộ giới', () => {
    const lui12 = luiBang27(luat.lo01, 12, H);
    expect(lui12).toBeGreaterThan(1);
    // tòa cách cạnh 2 (y = 150, không giáp đường) 1 m, cách cạnh 1 (x = 200, đường 12 m) 1 m
    const L = loCo([30, 12, null, 20]);
    const ds = [toa('a', 100, 150 - 10 - 1), toa('b', 200 - 20 - 1, 60)];
    const kq = kiemViPham(pa(L, ds), hinhToa(pa(L, ds), tvCN), luat);
    expect(kq.lui.find((v) => v.toaId === 'a')).toBeUndefined();
    const b = kq.lui.find((v) => v.toaId === 'b')!;
    expect(b).toBeTruthy();
    expect(b.canh).toBe(1);
    expect(b.rong).toBe(12);
    expect(b.can).toBe(lui12);
    expect(b.kc).toBeCloseTo(1);
    // lô chưa khai: tòa a cũng thiếu lùi như trước (mọi cạnh 12 m)
    const L0 = loCo();
    const kq0 = kiemViPham(pa(L0, ds), hinhToa(pa(L0, ds), tvCN), luat);
    expect(kq0.lui.map((v) => v.toaId).sort()).toEqual(['a', 'b']);
  });

  it('bắt dính: chỉ cạnh giáp đường có đường lùi, đúng khoảng theo lộ giới cạnh', () => {
    const L = loCo([30, 12, null, 20]);
    const lui = dichBatDinh(L, [], H, luat).filter((m) => m.loai === 'lui');
    const can = luiTungCanh(luat.lo01, L, H);
    expect(lui.length).toBe(can.filter((v) => v > 0).length);
    // đường lùi cạnh 1 (x = 200) nằm ở x = 200 − lùi 12 m
    expect(lui.some((m) => Math.abs(m.doan[0][0] - (200 - can[1])) < 1e-9 && Math.abs(m.doan[1][0] - (200 - can[1])) < 1e-9)).toBe(true);
  });

  it('kích thước tới ranh lấy cạnh thiếu lùi nhất (không phải cạnh gần nhất)', () => {
    const L = loCo([30, 12, null, 20]);
    // gần cạnh 2 (0,5 m, không giáp đường) hơn cạnh 1 (2 m, đường 12 m)
    const F = chanToa(mauCN, toa('a', 200 - 20 - 2, 150 - 10 - 0.5));
    const r = kichThuocToa(F, H, L, [], luat).find((k) => k.loai === 'ranh')!;
    expect(r.kc).toBeCloseTo(2);
    expect(r.can).toBe(luiBang27(luat.lo01, 12, H));
  });

  it('nhân bản: chỗ trống đủ lùi theo từng cạnh', () => {
    const L = loCo([30, 12, null, 20]);
    const goc = toa('a', 100, 75);
    const { toa: b, hopLe } = viTriNhanBan(goc, pa(L, [goc]), tvCN, luat, 'b');
    expect(hopLe).toBe(true);
    const F = chanToa(mauCN, b), can = luiTungCanh(luat.lo01, L, H);
    L.ranh.forEach((a, i) => expect(kcToiDoan(F, a, L.ranh[(i + 1) % 4])).toBeGreaterThanOrEqual(can[i] - 1e-6));
  });
});

describe('khai lộ giới cạnh trên bản vẽ', () => {
  it('bấm gần cạnh thì tìm đúng cạnh; khai một cạnh giữ mặc định các cạnh khác; bỏ khai về hành vi cũ', () => {
    const L = loCo();
    expect(canhGan(L, [199, 70], 2)).toBe(1);
    expect(canhGan(L, [100, 75], 2)).toBeNull();
    const L1 = datCanhDuong(L, 2, null);
    expect(L1.canhDuong).toEqual([12, 12, null, 12]);
    expect(datCanhDuong(L1, 0, 30).canhDuong).toEqual([30, 12, null, 12]);
    expect(datCanhDuong(L1, 0, -1).canhDuong![0]).toBeNull();
    expect(coCanhDuong(boCanhDuong(L1))).toBe(false);
  });
});

describe('gợi ý xếp tòa theo lộ giới từng cạnh', () => {
  const lib = new URL('../../public/lib/', import.meta.url);
  const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
  const tv = themBienThe(taoThuVien(doc<ToaMau[]>('toa.json'), doc<CanMau[]>('can.json')));
  const ranh: Diem[] = [[0, 0], [160, 0], [160, 110], [0, 110]];
  const L: Lo = {
    id: 'L1', ranh, chiGioi: null, xungQuanh: [], canhDuong: [null, 40, null, 12],
    temDat: {
      kyHieu: 'CT-01', chucNang: 'tm', coCauMucTieu: { stu: 10, '1pn': 20, '2pn': 45, '2pnp': 0, '3pn': 25 },
      chiTieu: { matDoMax: 40, matDoThapMax: null, hssddMax: 8, tangCaoMax: 25, tangDe: 1, tangCanHo: null, tangHam: null, danSoMax: 3000, soCanMax: null, nguoiMoiCan: 3.6, choDoOtoMoiCan: 1, choXeMayMoiCan: 2, cayXanhMin: 20 },
    },
  };
  const P: TrangThaiPA = { phienBan: 1, lo: [L], heSo: HE_SO_MAC_DINH, nguong: NGUONG_MAC_DINH, toa: [], ham: { soTang: 0, ranh: null, nhip: 8.4, rongLan: 6, choDai: 5, choRong: 2.5, dtKho: 6 } } as TrangThaiPA;
  it('mọi tòa của mọi phương án đủ lùi theo lộ giới cạnh mình giáp', () => {
    const ds = goiYXepToa({ pa: P, lo: L, tv, luat });
    expect(ds.length).toBeGreaterThan(0);
    for (const g of ds) {
      const can = luiTungCanh(luat.lo01, L, 4.5 + g.soTangDH * 3.3);
      for (const t of g.toa) {
        const F = chanToa(tv.toa.get(t.mauId)!, t);
        ranh.forEach((a, i) => expect(kcToiDoan(F, a, ranh[(i + 1) % 4])).toBeGreaterThanOrEqual(can[i] - 1e-6));
      }
    }
  });
});
