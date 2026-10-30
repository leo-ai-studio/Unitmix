import { describe, expect, it } from 'vitest';
import { buocChay, docGio, DT_TOI_DA, gioPhut, kepGio, taoNhip } from './dongHo';

describe('đồng hồ giờ nắng (thuần)', () => {
  it('gioPhut: làm tròn phút chỉ để hiện, sang giờ đúng', () => {
    expect(gioPhut(9)).toBe('9:00');
    expect(gioPhut(9.05)).toBe('9:03');
    expect(gioPhut(9.5)).toBe('9:30');
    expect(gioPhut(9.9917)).toBe('10:00'); // bản cũ ra "9:00" — nhãn giật lùi khi ▶ chạy qua giờ chẵn
    expect(gioPhut(17.999)).toBe('18:00');
    expect(gioPhut(NaN)).toBe('—');
  });

  it('docGio / kepGio: đọc ô trượt (chuỗi) không làm tròn; rác → null', () => {
    expect(docGio('9.05')).toBe(9.05);
    expect(docGio(12.35)).toBe(12.35);
    expect(docGio('')).toBeNull();
    expect(docGio('abc')).toBeNull();
    expect(docGio(undefined)).toBeNull();
    expect(kepGio(5, 6.25, 17.5)).toBe(6.25);
    expect(kepGio(18, 6.25, 17.5)).toBe(17.5);
    expect(kepGio(9.05, 6.25, 17.5)).toBe(9.05);
  });

  it('buocChay: tốc độ đều, đơn điệu, không làm tròn; vòng lại ở giờ lặn', () => {
    const g0 = 6.25, g1 = 17.5;
    let g = 9, truoc = g, vong = 0;
    const buoc: number[] = [];
    for (let i = 0; i < 60 * 12; i++) {
      const n = buocChay(g, 1 / 60, g0, g1);
      if (n < g) { vong++; expect(n).toBe(g0); } else { expect(n).toBeGreaterThan(g); buoc.push(n - g); }
      truoc = g; g = n;
    }
    expect(truoc).toBeGreaterThan(0);
    expect(vong).toBe(1);
    // mọi bước = 1/60 h (1 h/s) — không có bước nhảy / bước 0
    for (const b of buoc) expect(b).toBeCloseTo(1 / 60, 9);
  });

  it('buocChay: khung khựng / tab ẩn không nhảy cóc; giờ ngoài khoảng → bắt đầu từ mọc', () => {
    expect(buocChay(9, 5, 6, 18)).toBeCloseTo(9 + DT_TOI_DA, 9);
    expect(buocChay(9, -1, 6, 18)).toBe(9);
    expect(buocChay(9, NaN, 6, 18)).toBe(9);
    expect(buocChay(19, 0.016, 6, 18)).toBe(6);
    expect(buocChay(NaN, 0.016, 6, 18)).toBe(6);
    expect(buocChay(9, 0.016, 10, 10)).toBe(10);
  });

  it('taoNhip: nhiều lần gọi trong một khung → chạy một lần; huỷ được', () => {
    const hang: (() => void)[] = [];
    let n = 0;
    const nh = taoNhip(() => n++, (f) => hang.push(f), () => { hang.length = 0; });
    nh.goi(); nh.goi(); nh.goi();
    expect(hang.length).toBe(1);
    hang.shift()!();
    expect(n).toBe(1);
    nh.goi(); nh.huy();
    expect(hang.length).toBe(0);
    nh.goi();
    hang.shift()!();
    expect(n).toBe(2);
  });
});
