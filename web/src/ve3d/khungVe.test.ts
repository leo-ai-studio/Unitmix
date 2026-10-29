import { describe, expect, it } from 'vitest';
import { capDo3D, coBoDem, huongMatTroi, lechTyLe, THONG_SO_CAP } from './khungVe';

describe('khung 3D: bộ đệm khớp cỡ hiển thị', () => {
  it('cỡ bộ đệm theo ô chứa, tối thiểu 50 px', () => {
    expect(coBoDem(870.4, 848.6)).toEqual({ w: 870, h: 849 });
    expect(coBoDem(0, 0)).toEqual({ w: 50, h: 50 });
    expect(coBoDem(NaN, 300)).toEqual({ w: 50, h: 300 });
  });
  it('lệch tỷ lệ: khớp = 0, ca méo đo được trên app (bộ đệm 870×848 hiện trong 530×748) ≈ 45 %', () => {
    expect(lechTyLe(1740, 1696, 870, 848)).toBeCloseTo(0, 6);
    expect(lechTyLe(870, 848, 530, 748)).toBeGreaterThan(0.4);
    // bộ đệm làm tròn xuống theo pixelRatio 1,5: lệch < 0,5 %
    expect(lechTyLe(Math.floor(391 * 1.5), Math.floor(677 * 1.5), 391, 677)).toBeLessThan(0.005);
  });
  it('sau khi đổi cỡ, tỷ lệ camera = tỷ lệ CSS (cùng một hàm cỡ)', () => {
    for (const [r, c] of [[1440, 900], [390, 844], [844, 390], [12, 3000]]) {
      const { w, h } = coBoDem(r, c);
      expect(lechTyLe(w * 2, h * 2, Math.max(r, 50), Math.max(c, 50))).toBeLessThan(1e-9);
    }
  });
});

describe('bậc chất lượng 3D', () => {
  it('cảm ứng hoặc máy yếu → thấp', () => {
    expect(capDo3D({ camUng: true })).toBe('thap');
    expect(capDo3D({ camUng: false, soLoi: 2 })).toBe('thap');
    expect(capDo3D({ camUng: false, soLoi: 8, boNho: 8 })).toBe('cao');
    expect(THONG_SO_CAP.thap.dpr).toBeLessThanOrEqual(1.5);
    expect(THONG_SO_CAP.thap.bong).toBeLessThan(THONG_SO_CAP.cao.bong);
  });
});

describe('hướng mặt trời', () => {
  it('trưa hướng Nam (phương vị 180°), Bắc = +Y bản vẽ → mặt trời phía +Z three (Nam), đơn vị', () => {
    const [x, y, z] = huongMatTroi(60, 180, 0);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 9);
    expect(z).toBeGreaterThan(0.4); expect(Math.abs(x)).toBeLessThan(1e-9); expect(y).toBeCloseTo(Math.sin(Math.PI / 3), 9);
  });
  it('góc Bắc 90° (quy ước tinh/huongView.phuongVi: trục +Y bản vẽ ở phương vị 90°) → nắng Nam chiếu từ +X; dưới chân trời kẹp 8°', () => {
    const [x] = huongMatTroi(45, 180, 90);
    expect(x).toBeGreaterThan(0.5);
    expect(huongMatTroi(-5, 90, 0)[1]).toBeCloseTo(Math.sin((8 * Math.PI) / 180), 9);
  });
});
