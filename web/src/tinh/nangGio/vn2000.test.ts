import { describe, expect, it } from 'vitest';
import { KINH_TUYEN_TRUC, nhanDangVN2000, tinhTuTen, tmNghich, viTriTuVN2000 } from './vn2000';

// Giá trị đối chiếu: proj4 (+proj=tmerc +k=0.9999 +x_0=500000 +ellps=WGS84), thuận từ kinh vĩ chọn sẵn
const MAU: [string, number, number, number, number, number][] = [
  // tên, ktt, Đông, Bắc, lat, lng
  ['Hà Nội', 105, 588788.226, 2326237.193, 21.0285, 105.8542],
  ['Hải Phòng', 105.75, 597628.552, 2305958.64, 20.8449, 106.6881],
  ['TP.HCM', 105.75, 603992.974, 1191830.248, 10.7769, 106.7009],
  ['Đà Nẵng', 107.75, 550373.577, 1775542.751, 16.0544, 108.2208],
  ['Quảng Ninh', 107.75, 430770.326, 2317619.152, 20.9515, 107.0843],
  ['xa kinh tuyến trục', 105, 427621.505, 2411577.727, 21.8, 104.3],
];

describe('phép chiếu ngược VN-2000 TM-3', () => {
  it.each(MAU)('%s: khớp proj4 trong 1 cm', (_t, ktt, e, n, lat, lng) => {
    const r = tmNghich(e, n, ktt);
    expect(Math.abs(r.lat - lat) * 111_320).toBeLessThan(0.01);
    expect(Math.abs(r.lng - lng) * 111_320 * Math.cos(lat * Math.PI / 180)).toBeLessThan(0.01);
  });
  it('hội tụ lưới: 0 trên kinh tuyến trục, dương phía Đông, âm phía Tây', () => {
    expect(Math.abs(tmNghich(500000, 2300000, 105).hoiTu)).toBeLessThan(1e-9);
    expect(tmNghich(588788, 2326237, 105).hoiTu).toBeGreaterThan(0.2);
    expect(tmNghich(427621, 2411577, 105).hoiTu).toBeLessThan(-0.2);
  });
});

describe('nhận dạng bản vẽ VN-2000', () => {
  const lo = (e: number, n: number) => [[e, n], [e + 400, n], [e + 400, n + 300], [e, n + 300]] as [number, number][];
  it('toạ độ thật trong dải Việt Nam → tâm khung bao', () => {
    expect(nhanDangVN2000(lo(588600, 2326100))).toEqual([588800, 2326250]);
  });
  it('bản vẽ gốc (0, 0) / hệ cục bộ / quá lớn / rỗng → null', () => {
    expect(nhanDangVN2000(lo(0, 0))).toBeNull();
    expect(nhanDangVN2000(lo(124000, 100000))).toBeNull();
    expect(nhanDangVN2000([[588000, 2326000], [688000, 2426000]])).toBeNull(); // rộng > 30 km
    expect(nhanDangVN2000([])).toBeNull();
  });
  it('đặt vị trí từ bản vẽ: neo = tâm, kinh vĩ khớp, góc Bắc = hội tụ lưới', () => {
    const v = viTriTuVN2000(lo(588600, 2326100), 105)!;
    const r = tmNghich(588800, 2326250, 105);
    expect(v.neo).toEqual([588800, 2326250]);
    expect(v.lat).toBeCloseTo(r.lat, 9);
    expect(v.gocBac).toBeCloseTo(r.hoiTu, 9);
    expect(viTriTuVN2000(lo(0, 0), 105)).toBeNull();
  });
});

describe('tỉnh từ tên địa điểm', () => {
  it('bỏ dấu, không phân biệt hoa thường', () => {
    expect(tinhTuTen('Dự án KĐT X, Cầu Giấy, Hà Nội')?.ktt).toBe(105);
    expect(tinhTuTen('quận 7, TP. Hồ Chí Minh')?.ktt).toBe(105.75);
    expect(tinhTuTen('Hạ Long, Quảng Ninh')?.id).toBe('qn');
    expect(tinhTuTen('Đà Nẵng')?.ktt).toBe(107.75);
  });
  it('tỉnh chưa có trong bảng → null (không đoán)', () => {
    expect(tinhTuTen('Thanh Hóa')).toBeNull();
    expect(tinhTuTen('')).toBeNull();
    expect(KINH_TUYEN_TRUC.every((t) => t.ktt > 100 && t.ktt < 110)).toBe(true);
  });
});
