import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chanToa } from './hinhHoc';
import type { Diem, Lo, ThuVien, ToaDat, ToaMau, TrangThaiPA } from './kieu';
import { traLuat, type BoQuyTac } from './quyTac';
import {
  batDiem, batDinh, batGoc, capGanBien, dichBatDinh, dichNhom, hinhToa, kichThuocToa, kiemViPham, latNhom, namTrongNhanh, toaTrongKhung,
  viTriNhanBan, xoayNhom, type LuatTMB,
} from './thaoTacToa';
import { kcToa261, luiBang27 } from './xepToa';

const bo = JSON.parse(readFileSync(new URL('../../public/lib/quy_tac.json', import.meta.url), 'utf8')) as BoQuyTac;
const luat: LuatTMB = { lo01: traLuat(bo, 'LO-01')!, lo02: traLuat(bo, 'LO-02')! };

// mẫu tòa chữ nhật 40 × 20 m (mm), tòa chữ L để thử lật
const mauCN = { id: 'cn', duong_bao: [[0, 0], [40000, 0], [40000, 20000], [0, 20000]] } as unknown as ToaMau;
const mauL = { id: 'L', duong_bao: [[0, 0], [40000, 0], [40000, 10000], [10000, 10000], [10000, 30000], [0, 30000]] } as unknown as ToaMau;
const tv = { toa: new Map([['cn', mauCN], ['L', mauL]]) } as unknown as ThuVien;

const lo: Lo = {
  id: 'lo1',
  temDat: { kyHieu: 'A', chucNang: 'tm', chiTieu: {} as never, coCauMucTieu: {} as never },
  ranh: [[0, 0], [200, 0], [200, 150], [0, 150]],
  chiGioi: [[6, 6], [194, 6], [194, 144], [6, 144]],
  xungQuanh: [],
};
const toa = (id: string, x: number, y: number, p: Partial<ToaDat> = {}): ToaDat => ({
  id, loId: 'lo1', mauId: 'cn', x, y, gocDo: 0, soTangDH: 20, soTangDe: 2, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {}, ...p,
});
const pa = (ds: ToaDat[]) => ({ lo: [lo], toa: ds }) as unknown as TrangThaiPA;
const H = 2 * 4.5 + 20 * 3.3; // 75 m

describe('ngưỡng đọc từ quy_tac.json (không chép số)', () => {
  it('LO-01 / LO-02 có bảng và ngưỡng', () => {
    expect(luiBang27(luat.lo01, 12, H)).toBeGreaterThan(0);
    const k = kcToa261(luat.lo02, H);
    expect(k.dai).toBeGreaterThan(k.hoi);
  });
});

describe('bắt dính khi kéo', () => {
  it('bắt mép tòa vào đường lùi LO-01 khi cách dưới ngưỡng', () => {
    const lui = luiBang27(luat.lo01, 12, H);
    const muc = dichBatDinh(lo, [], H, luat);
    // tòa 40 × 20, mép trái cách ranh lô lui + 0,4 m
    const x = 20 + lui + 0.4, F = chanToa(mauCN, toa('a', x, 75));
    const b = batDinh(F, [x, 75], 0, muc, [], 1);
    expect(b.dx).toBeCloseTo(-0.4, 6);
    expect(Math.abs(b.dy)).toBeLessThan(1); // phương kia có thể bắt mép khác trong ngưỡng
    expect(b.dan.some((m) => m.loai === 'lui')).toBe(true);
  });
  it('bắt đúng khoảng cách §2.6.1 tới tòa khác và thẳng trục', () => {
    const k = kcToa261(luat.lo02, H);
    const A = toa('a', 60, 75), FA = chanToa(mauCN, A);
    const muc = dichBatDinh(undefined, [{ F: FA, H }], H, luat);
    // B đặt bên phải A, khe = k.hoi + 0,3; tâm lệch trục 0,2 m
    const x = 60 + 40 + k.hoi + 0.3, F = chanToa(mauCN, toa('b', x, 75.2));
    const b = batDinh(F, [x, 75.2], 0, muc, [[60, 75]], 0.5);
    expect(capGanBien(chanToa(mauCN, toa('b', x + b.dx, 75.2 + b.dy)), FA).kc).toBeCloseTo(k.hoi, 4);
    expect(75.2 + b.dy).toBeCloseTo(75, 4);
  });
  it('không bắt khi xa hơn ngưỡng', () => {
    const F = chanToa(mauCN, toa('a', 100, 75));
    expect(batDinh(F, [100, 75], 0, dichBatDinh(lo, [], H, luat), [], 0.5)).toEqual({ dx: 0, dy: 0, dan: [] });
  });
});

describe('xoay', () => {
  it('bắt góc theo cạnh lô / hướng, Shift bội 15°, còn lại làm tròn 1°', () => {
    expect(batGoc(88.2, []).goc).toBe(90);
    expect(batGoc(31.6, [30]).goc).toBe(30);
    expect(batGoc(122, [30]).goc).toBe(120);
    expect(batGoc(37.4, [], true).goc).toBe(30);
    expect(batGoc(47.4, []).goc).toBe(47);
  });
  it('xoay nhóm quanh tâm giữ khoảng cách tương đối', () => {
    const ds = xoayNhom([toa('a', 0, 0), toa('b', 10, 0)], [5, 0], 90);
    expect(ds[0].x).toBeCloseTo(5); expect(ds[0].y).toBeCloseTo(-5);
    expect(ds[1].y).toBeCloseTo(5);
    expect(ds.every((x) => x.gocDo === 90)).toBe(true);
    expect(xoayNhom([toa('a', 0, 0, { gocDo: 300 })], [0, 0], 90)[0].gocDo).toBe(30);
  });
});

describe('lật', () => {
  it('lật tại chỗ: chân đối xứng qua trục dọc, diện tích / khung bao giữ', () => {
    const a = toa('a', 50, 50, { mauId: 'L' });
    const [b] = latNhom([a]);
    expect(b.lat).toBe(true);
    const F = chanToa(mauL, a), G = chanToa(mauL, b);
    const xs = (P: Diem[]) => P.map((p) => p[0]);
    expect(Math.min(...xs(G))).toBeCloseTo(Math.min(...xs(F)));
    // chữ L lật: cánh đứng chuyển từ trái sang phải
    expect(G.some((p) => p[0] > 60 && p[1] > 55)).toBe(true);
    expect(F.some((p) => p[0] > 60 && p[1] > 55)).toBe(false);
    expect(latNhom([b])[0].lat).toBe(false);
  });
  it('lật nhóm: hai tòa đổi bên qua trục giữa', () => {
    const ds = latNhom([toa('a', 0, 0), toa('b', 30, 0)]);
    expect(ds[0].x).toBeCloseTo(30); expect(ds[1].x).toBeCloseTo(0);
  });
});

describe('kiểm vi phạm trực tiếp', () => {
  it('LO-01 thiếu lùi, LO-05 ra ngoài chỉ giới, LO-02 lỗi / cảnh báo', () => {
    const k = kcToa261(luat.lo02, H);
    const ds = [
      toa('sat', 21, 30), // mép trái cách ranh 1 m: ngoài chỉ giới + thiếu lùi
      toa('a', 100, 100),
      toa('b', 100 + 40 + (k.hoi + k.dai) / 2, 100), // giữa đầu hồi và cạnh dài → cảnh báo
      toa('c', 100, 100 - 20 - k.hoi / 2), // dưới đầu hồi so với a → lỗi
    ];
    const kq = kiemViPham(pa(ds), hinhToa(pa(ds), tv), luat);
    expect(kq.ngoai.has('sat')).toBe(true);
    expect(kq.lui.some((v) => v.toaId === 'sat' && v.kc < v.can)).toBe(true);
    expect(kq.cap.find((c) => c.a === 'a' && c.b === 'b')?.muc).toBe('canh');
    expect(kq.cap.find((c) => c.a === 'a' && c.b === 'c')?.muc).toBe('loi');
    expect(kq.muc.get('a')).toBe('loi');
  });
  it('bố cục đủ khoảng cách: không vi phạm', () => {
    const k = kcToa261(luat.lo02, H);
    const ds = [toa('a', 60, 75), toa('b', 60 + 40 + k.dai + 1, 75)];
    const kq = kiemViPham(pa(ds), hinhToa(pa(ds), tv), luat);
    expect(kq.cap).toEqual([]); expect(kq.lui).toEqual([]); expect(kq.ngoai.size).toBe(0);
  });
  it('vị trí tạm khi kéo được dùng thay vị trí trong PA', () => {
    const ds = [toa('a', 60, 75), toa('b', 150, 75)];
    const tam = new Map([['b', { ...ds[1], x: 101 }]]);
    expect(kiemViPham(pa(ds), hinhToa(pa(ds), tv, tam), luat).cap[0]?.muc).toBe('loi');
  });
  it('kích thước tới ranh / chỉ giới / tòa gần nhất', () => {
    const F = chanToa(mauCN, toa('a', 60, 75));
    const kt = kichThuocToa(F, H, lo, [{ F: chanToa(mauCN, toa('b', 130, 75)), H }], luat);
    expect(kt.find((k) => k.loai === 'ranh')?.kc).toBeCloseTo(40);
    expect(kt.find((k) => k.loai === 'chiGioi')?.kc).toBeCloseTo(34);
    expect(kt.find((k) => k.loai === 'toa')?.kc).toBeCloseTo(30);
  });
});

describe('nhân bản, chọn khung, đo', () => {
  it('bản sao vào chỗ trống: trong chỉ giới, đủ lùi, cách mọi tòa ≥ cạnh dài §2.6.1', () => {
    const goc = toa('a', 100, 75, { khoa: true, lat: true });
    const { toa: b, hopLe } = viTriNhanBan(goc, pa([goc]), tv, luat, 'moi');
    expect(hopLe).toBe(true);
    expect(b.id).toBe('moi'); expect(b.khoa).toBe(false); expect(b.lat).toBe(true); expect(b.mauId).toBe('cn');
    const F = chanToa(mauCN, b);
    expect(namTrongNhanh(F, lo.chiGioi!)).toBe(true);
    expect(capGanBien(F, chanToa(mauCN, goc)).kc).toBeGreaterThanOrEqual(kcToa261(luat.lo02, H).dai - 1e-6);
  });
  it('không còn chỗ thì vẫn trả bản sao (hopLe = false) để người dùng kéo tiếp', () => {
    const nho: Lo = { ...lo, ranh: [[0, 0], [60, 0], [60, 40], [0, 40]], chiGioi: null };
    const goc = toa('a', 30, 20);
    const r = viTriNhanBan(goc, { lo: [nho], toa: [goc] } as unknown as TrangThaiPA, tv, luat, 'moi');
    expect(r.hopLe).toBe(false);
    expect(r.toa.id).toBe('moi');
  });
  it('chọn khung lấy tòa có tâm / đỉnh trong khung', () => {
    const ds = [toa('a', 30, 30), toa('b', 150, 120)];
    expect(toaTrongKhung(hinhToa(pa(ds), tv), [0, 0], [60, 60])).toEqual(['a']);
    expect(toaTrongKhung(hinhToa(pa(ds), tv), [0, 0], [200, 150]).sort()).toEqual(['a', 'b']);
  });
  it('đo bắt vào đỉnh gần nhất trong ngưỡng', () => {
    expect(batDiem([0.3, 0.2], [[0, 0], [10, 0]], 1)).toEqual([0, 0]);
    expect(batDiem([5, 5], [[0, 0]], 1)).toEqual([5, 5]);
  });
  it('dời nhóm làm tròn cm', () => {
    expect(dichNhom([toa('a', 1, 1)], 0.1234, -1)[0]).toMatchObject({ x: 1.12, y: 0 });
  });
});
