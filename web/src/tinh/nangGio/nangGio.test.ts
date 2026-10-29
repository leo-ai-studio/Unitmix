import { describe, expect, it } from 'vitest';
import { banVeSangDat, banVeSangLl, chonMuc, datSangBanVe, docLienKet, ganViTri, khopHaiDiem, llSangBanVe, llSangO, metMoiDiemAnh, oPhu, oSangLl, viTriPA, type ViTri } from '../viTri';
import { buocNangTrongNgay, duongDi, huongTia, matTroi, mocLan } from '../matTroi';
import { mauMatDung, taoLuoi, thongKeGio, tinhGioNang, toDaGiac } from './gioNang';
import { heSoCaoDiBo, hoaGio, huong16, huongChuDao, lopTienNghi, phanBo, pVuot, SO_HUONG, vuotTheoHuong } from './gio';
import type { TrangThaiPA } from '../kieu';

const gan = (a: number, b: number, sai: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(sai);

describe('docLienKet — liên kết Google Maps / Earth', () => {
  it('tâm khung nhìn @lat,lng', () => {
    expect(docLienKet('https://www.google.com/maps/@21.0285,105.8542,17z')).toMatchObject({ lat: 21.0285, lng: 105.8542, nguon: 'tam' });
  });
  it('ghim địa điểm !3d!4d ưu tiên hơn @', () => {
    const r = docLienKet('https://www.google.com/maps/place/H%E1%BB%93+Ho%C3%A0n+Ki%E1%BA%BFm/@21.0287797,105.8495979,16z/data=!3m1!4b1!4m6!3m5!1s0x3135ab:0x1!8m2!3d21.0287747!4d105.8524194!16s%2Fm%2F02');
    expect(r).toMatchObject({ lat: 21.0287747, lng: 105.8524194, nguon: 'ghim' });
  });
  it('?q=, ?query= (api=1), /place/lat,lng', () => {
    expect(docLienKet('https://maps.google.com/?q=21.0285,105.8542')).toMatchObject({ lat: 21.0285, lng: 105.8542 });
    expect(docLienKet('https://www.google.com/maps/search/?api=1&query=21.0285%2C105.8542')).toMatchObject({ lat: 21.0285, lng: 105.8542 });
    expect(docLienKet('https://www.google.com/maps/place/21.0285,105.8542')).toMatchObject({ lat: 21.0285, lng: 105.8542 });
  });
  it('Google Earth web', () => {
    expect(docLienKet('https://earth.google.com/web/@21.02850000,105.85420000,10.5a,800d,35y,0h,0t,0r')).toMatchObject({ lat: 21.0285, lng: 105.8542 });
  });
  it('chuỗi số và DMS', () => {
    expect(docLienKet('21.0285, 105.8542')).toMatchObject({ lat: 21.0285, lng: 105.8542, nguon: 'chuoi' });
    expect(docLienKet(' 10.7769 106.7009 ')).toMatchObject({ lat: 10.7769, lng: 106.7009 });
    const d = docLienKet(`21°01'42.6"N 105°51'15.1"E`) as { lat: number; lng: number };
    gan(d.lat, 21.0285, 1e-4); gan(d.lng, 105.854194, 1e-4);
    const s = docLienKet(`33°52'S 151°12'E`) as { lat: number; lng: number };
    expect(s.lat).toBeLessThan(0);
  });
  it('rút gọn và rác', () => {
    expect(docLienKet('https://maps.app.goo.gl/AbCdEf')).toEqual({ loi: 'rutGon' });
    expect(docLienKet('xin chào')).toEqual({ loi: 'khongDoc' });
    expect(docLienKet('95, 10')).toEqual({ loi: 'khongDoc' }); // vĩ độ > 90
  });
});

describe('tham chiếu bản vẽ ↔ bản đồ', () => {
  const v: ViTri = { lat: 21.0285, lng: 105.8542, neo: [10, 20], tyLe: 1, gocBac: 30, coToaDo: true };
  it('+Y bản vẽ chỉ hướng phương vị gocBac', () => {
    const d = banVeSangDat([10, 21], v); // 1 m theo +Y
    gan(Math.atan2(d[0], d[1]) * 180 / Math.PI, 30, 1e-9);
    const p = datSangBanVe(banVeSangDat([123, -45], v), v);
    gan(p[0], 123, 1e-9); gan(p[1], -45, 1e-9);
  });
  it('kinh vĩ đi — về < 1 mm trong 1 km', () => {
    const ll = banVeSangLl([800, 600], v), p = llSangBanVe(ll, v);
    gan(p[0], 800, 1e-3); gan(p[1], 600, 1e-3);
    // 1 phút vĩ độ ≈ 1 843 m ở vĩ độ 21°
    const b = llSangBanVe({ lat: v.lat + 1 / 60, lng: v.lng }, { ...v, gocBac: 0, neo: [0, 0] });
    gan(b[1], 1843, 3);
  });
  it('khớp hai điểm tìm lại góc Bắc và tỷ lệ', () => {
    const a: [number, number] = [0, 0], b: [number, number] = [150, 80];
    const v2 = { ...v, neo: a, gocBac: 37.5, tyLe: 1.002 };
    const r = khopHaiDiem(a, banVeSangLl(a, v2), b, banVeSangLl(b, v2))!;
    gan(r.gocBac, 37.5, 1e-4); gan(r.tyLe, 1.002, 1e-5);
    expect(khopHaiDiem(a, { lat: 1, lng: 1 }, a, { lat: 1, lng: 1 })).toBeNull();
  });
  it('viTriPA: PA cũ đọc vĩ độ view; ganViTri soi sang huongView', () => {
    const cu = { huongView: { viDo: 16.05, gocBac: 12 } } as Pick<TrangThaiPA, 'viTri' | 'huongView'>;
    expect(viTriPA(cu)).toMatchObject({ lat: 16.05, gocBac: 12, coToaDo: false });
    const moi = ganViTri(cu, { lat: 10.7769, lng: 106.7009, neo: [0, 0] }, 20);
    expect(moi.huongView).toMatchObject({ viDo: 10.7769, gocBac: 20 });
    expect(viTriPA(moi)).toMatchObject({ lat: 10.7769, lng: 106.7009, gocBac: 20, coToaDo: true });
    expect(viTriPA(ganViTri(moi, null)).coToaDo).toBe(false);
  });
});

describe('toán ô bản đồ', () => {
  it('ô gốc và đi — về', () => {
    expect(llSangO(0, 0, 0)).toEqual([0.5, 0.5]);
    const [x, y] = llSangO(21.0285, 105.8542, 17), ll = oSangLl(x, y, 17);
    gan(ll.lat, 21.0285, 1e-9); gan(ll.lng, 105.8542, 1e-9);
    expect(Math.floor(x)).toBe(104078);
  });
  it('mét / điểm ảnh, chọn mức, ô phủ', () => {
    gan(metMoiDiemAnh(0, 0), 156543.03, 0.01);
    const z = chonMuc(0.5, 21);
    expect(metMoiDiemAnh(21, z)).toBeLessThanOrEqual(0.5 * 1.2);
    const o = oPhu({ w: 105.85, s: 21.02, e: 105.86, n: 21.03 }, 16);
    expect(o.length).toBeGreaterThan(0);
    expect(oPhu({ w: 100, s: 10, e: 110, n: 20 }, 16)).toEqual([]); // quá nhiều ô → rỗng
  });
});

describe('mặt trời (NOAA) — Hà Nội 21,03° B, 105,85° Đ, UTC+7', () => {
  const HN = [21.03, 105.85] as const;
  it('Hạ chí: độ cao lớn nhất ≈ 90 − (23,44 − 21,03) = 87,6°, mặt trời ở phía Bắc thiên đỉnh', () => {
    const d = duongDi(HN[0], HN[1], '2026-06-21', 2);
    const max = d.reduce((a, b) => (b.cao > a.cao ? b : a));
    gan(max.cao, 87.6, 0.3);
    gan(max.gio, 11.98, 0.1);
    expect(max.phuongVi < 30 || max.phuongVi > 330).toBe(true);
  });
  it('Đông chí 12:00: độ cao ≈ 45,5°, hướng Nam', () => {
    const m = matTroi(HN[0], HN[1], '2026-12-21', 12);
    gan(m.cao, 45.5, 0.4); gan(m.phuongVi, 180, 3);
  });
  it('mọc / lặn (timeanddate.com Hà Nội: 21/6 5:13–18:41, 21/12 6:31–17:21) ± 4 phút', () => {
    const h = mocLan(HN[0], HN[1], '2026-06-21')!, d = mocLan(HN[0], HN[1], '2026-12-21')!;
    gan(h.moc, 5 + 13 / 60, 4 / 60); gan(h.lan, 18 + 41 / 60, 4 / 60);
    gan(d.moc, 6 + 31 / 60, 4 / 60); gan(d.lan, 17 + 21 / 60, 4 / 60);
  });
  it('hướng tia theo góc Bắc bản vẽ; bước nắng cộng ra số giờ ban ngày', () => {
    const v = huongTia({ cao: 0, phuongVi: 90 }, 90); // mặt trời phía Đông, +Y bản vẽ chỉ Đông → tia theo +Y
    gan(v[0], 0, 1e-9); gan(v[1], 1, 1e-9);
    const b = buocNangTrongNgay(HN[0], HN[1], '2026-12-21', 0, 15, 0);
    gan(b.reduce((s, x) => s + x.dh, 0), 10.83, 0.15);
  });
});

describe('giờ nắng — bóng khối lên lưới và mặt đứng', () => {
  // khối 10 × 10 m cao 30 m, mặt trời một bước 1 h từ phía Nam, độ cao 45° → bóng dài 30 m về phía Bắc
  const khoi = [{ chan: [[0, 0], [10, 0], [10, 10], [0, 10]] as [number, number][], z0: 0, z1: 30 }];
  const s45 = Math.SQRT1_2;
  const buoc = [{ gio: 12, dh: 1, cao: 45, phuongVi: 180, huong: [0, -s45, s45] as [number, number, number] }];
  const luoi = taoLuoi([-20, -40, 30, 60], 0, 1e6, 1);
  const kq = tinhGioNang({ khoi, luoi, buoc, matDung: { ngang: 2, dung: 3 } });
  const o = (x: number, y: number) => Math.floor((y - luoi.y0) / luoi.buoc) * luoi.nx + Math.floor((x - luoi.x0) / luoi.buoc);
  it('ô sau khối (phía Bắc, trong 30 m) không nắng; phía Nam và xa hơn có nắng; mái có nắng', () => {
    expect(kq.gio[o(5, 20)]).toBe(0);
    expect(kq.gio[o(5, 38)]).toBe(0);
    expect(kq.gio[o(5, 42)]).toBe(1);
    expect(kq.gio[o(5, -5)]).toBe(1);
    expect(kq.gio[o(15, 20)]).toBe(1);
    expect(kq.cao[o(5, 5)]).toBe(30);
    expect(kq.gio[o(5, 5)]).toBe(1);
  });
  it('mặt Nam có nắng, mặt Bắc / Đông / Tây không', () => {
    const m = kq.mat;
    for (let j = 0; j < m.length / 9; j++) {
      const ny = m[j * 9 + 4], h = m[j * 9 + 7];
      expect(h).toBe(ny < -0.5 ? 1 : 0);
    }
  });
  it('khối thấp phía Nam che chân mặt Nam của khối cao', () => {
    const k2 = [...khoi, { chan: [[0, -6], [10, -6], [10, -4], [0, -4]] as [number, number][], z0: 0, z1: 6 }];
    const r = tinhGioNang({ khoi: k2, luoi, buoc, matDung: { ngang: 2, dung: 1 } }).mat;
    let thap = 0, cao = 0;
    for (let j = 0; j < r.length / 9; j++) {
      if (r[j * 9 + 8] !== 0 || r[j * 9 + 4] > -0.5) continue;
      if (r[j * 9 + 2] < 1.5) thap += r[j * 9 + 7]; else if (r[j * 9 + 2] > 3) cao += r[j * 9 + 7];
    }
    expect(thap).toBe(0); // tia 45° từ chân mặt Nam chạm khối 6 m cách 4 m
    expect(cao).toBeGreaterThan(0);
  });
  it('tô quét dòng, mặt tiếp giáp bị bỏ, thống kê', () => {
    let n = 0;
    toDaGiac([[0, 0], [4, 0], [4, 3], [0, 3]], { x0: 0, y0: 0, buoc: 1, nx: 10, ny: 10 }, () => n++);
    expect(n).toBe(12);
    const tren = [{ chan: [[0, 0], [10, 0], [10, 10], [0, 10]] as [number, number][], z0: 0, z1: 5 }, { chan: [[2, 2], [8, 2], [8, 8], [2, 8]] as [number, number][], z0: 5, z1: 20 }];
    const m = mauMatDung(tren, 2, 3);
    for (let j = 0; j < m.length / 9; j++) expect(m[j * 9 + 2] < 5 ? m[j * 9 + 8] : 1).toBe(m[j * 9 + 2] < 5 ? 0 : 1);
    const tk = thongKeGio(new Float32Array([0, 1, 2, 3]), 4, 2);
    expect(tk.tb).toBe(1.5); expect(tk.datNguong).toBe(0.5); expect(tk.cot).toEqual([0.25, 0.25, 0.25, 0.25]);
  });
});

describe('gió — hoa gió, lớp tiện nghi', () => {
  it('gom hướng 16 phương + dải tốc độ', () => {
    expect(huong16(0)).toBe(0); expect(huong16(359)).toBe(0); expect(huong16(11)).toBe(0); expect(huong16(12)).toBe(1); expect(huong16(180)).toBe(8);
    const p = phanBo([0.2, 3, 3, 7, null], [10, 90, 92, 270, 0]);
    expect(p.soGio).toBe(4); expect(p.lang).toBe(0.25);
    const h = hoaGio(p);
    expect(h.tongHuong[4]).toBeCloseTo(0.5); expect(h.tongHuong[12]).toBeCloseTo(0.25);
    expect(h.dai[4][1]).toBeCloseTo(0.5); // dải 2–4 m/s
    expect(huongChuDao(p)[0].i).toBe(12); // gió 7 m/s từ Tây mạnh hơn
  });
  it('xác suất vượt + lớp Lawson', () => {
    const lap = (v: number) => phanBo(new Array(100).fill(v), new Array(100).fill(0));
    const c = vuotTheoHuong(lap(3));
    expect(pVuot(c[0], 2)).toBeCloseTo(1); expect(pVuot(c[0], 4)).toBe(0);
    const k = new Array(SO_HUONG).fill(1);
    expect(lopTienNghi(k, vuotTheoHuong(lap(3)), 1).lop).toBe(0);
    expect(lopTienNghi(k, vuotTheoHuong(lap(7)), 1).lop).toBe(2);
    expect(lopTienNghi(k, vuotTheoHuong(lap(12)), 1).lop).toBe(4);
    expect(lopTienNghi(k.map(() => 0.5), vuotTheoHuong(lap(11)), 1).lop).toBe(1); // khuất gió: 11 × 0,5 < 6 m/s → đứng
    expect(lopTienNghi(k, vuotTheoHuong(lap(16)), 1).pAnToan).toBeGreaterThan(0.5);
    gan(heSoCaoDiBo(0.22), 0.659, 0.002);
  });
});
