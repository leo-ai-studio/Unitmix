import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { CanMau, Diem, Phong } from './kieu';
import { danhGiaPhong, mucDat, MUC_TIEU_PHONG, phanLoaiTen, vongNoiTiep } from './phong';

const can = JSON.parse(readFileSync(new URL('../../public/lib/can.json', import.meta.url), 'utf8')) as (CanMau & { so_phong_ngu: number; so_wc: number })[];
/** Khung bao đường tim tường của hình học web (mm, cùng hệ với `ranh`). */
function khungTim(c: CanMau): number[] {
  const ve = JSON.parse(readFileSync(new URL(`../../public/lib/can/${c.id}.json`, import.meta.url), 'utf8')).ve as { cat: string; pts: Diem[] }[];
  const pts = ve.filter((n) => n.cat === 'tim').flatMap((n) => n.pts).map(([u, v]) => [u * c.rong_mm, v * c.sau_mm]);
  return [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
}
const dtDG = (P: Diem[]) => Math.abs(P.reduce((a, p, i) => { const q = P[(i + 1) % P.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;

describe('vòng tròn nội tiếp', () => {
  it('hình chữ nhật 3 × 4 m: Ø = cạnh ngắn, tâm nằm trên trục giữa', () => {
    const { tam, r } = vongNoiTiep([[0, 0], [4000, 0], [4000, 3000], [0, 3000]], 1);
    expect(r * 2).toBeCloseTo(3000, -1);
    expect(tam[1]).toBeCloseTo(1500, -1);
  });
  it('chữ L: vòng nằm ở cánh rộng, không ở góc trong', () => {
    // cánh ngang 6 × 2, cánh đứng 3 × 5 (rộng 3)
    const L: Diem[] = [[0, 0], [6000, 0], [6000, 2000], [3000, 2000], [3000, 5000], [0, 5000]];
    const { tam, r } = vongNoiTiep(L, 1);
    expect(r * 2).toBeGreaterThan(2900);
    expect(r * 2).toBeLessThan(3600);
    expect(tam[0]).toBeLessThan(3000);
  });
  it('tam giác vuông 3-4-5: r = (a + b − c) / 2 = 1', () => {
    expect(vongNoiTiep([[0, 0], [4, 0], [0, 3]], 0.001).r).toBeCloseTo(1, 2);
  });
});

describe('phân loại', () => {
  it('nhãn tên phòng tiếng Việt / Anh', () => {
    expect(phanLoaiTen('P. NGỦ 1')).toBe('ngu');
    expect(phanLoaiTen('Phòng ngủ master')).toBe('ngu');
    expect(phanLoaiTen('WC 2')).toBe('wc');
    expect(phanLoaiTen('Vệ sinh chung')).toBe('wc');
    expect(phanLoaiTen('BẾP + ĂN')).toBe('bep');
    expect(phanLoaiTen('P. KHÁCH')).toBe('khach');
    expect(phanLoaiTen('Lô gia')).toBe('khac');
    expect(phanLoaiTen('Sảnh')).toBe('khac');
  });
  it('mức đạt theo ngưỡng', () => {
    expect(mucDat(9.2, 9, 2)).toBe('xanh');
    expect(mucDat(8, 9, 2)).toBe('cam');
    expect(mucDat(6.5, 9, 2)).toBe('do');
    expect(mucDat(5, null, 2)).toBeNull();
  });
  it('phòng ngủ 9 m² theo QCVN 04:2021/BXD là mục tiêu cứng, còn lại chờ chốt', () => {
    expect(MUC_TIEU_PHONG.ngu.dt).toMatchObject({ dtM2: 9, choChot: false });
    const p: Phong = { ten: 'Phòng ngủ', loai: 'ngu', ranh: [], dt_m2: 8.5, d_min_m: 2.5, ke_mat_ngoai: true };
    const g = danhGiaPhong(p, { dtCanM2: 2, kichThuocM: 0.2 });
    expect(g.dt.muc).toBe('cam');
    expect(g.dt.chenh).toBeCloseTo(-0.5);
  });
});

describe('dữ liệu phòng trong can.json', () => {
  it('mọi mẫu căn có phòng, mỗi căn có đúng số phòng ngủ khai báo (trừ studio / phòng ngủ không vách)', () => {
    for (const c of can) {
      expect(c.phong?.length, c.id).toBeGreaterThan(0);
      const pn = c.phong!.filter((p) => p.loai === 'ngu').length;
      if (c.loai === 'stu' || c.id === 'xh-1pn-m3') expect(pn).toBe(0);
      else expect(pn, c.id).toBe(c.so_phong_ngu);
      expect(c.phong!.filter((p) => p.loai === 'wc').length, c.id).toBe(c.so_wc);
    }
  });
  it('tổng DT phòng lệch DT thông thủy không quá 5 % (phần thiếu là vách ngăn trong căn + hộp kỹ thuật)', () => {
    for (const c of can) {
      const tong = c.phong!.reduce((a, p) => a + p.dt_m2, 0);
      expect(Math.abs(tong - c.dt_tt_m2) / c.dt_tt_m2, c.id).toBeLessThan(0.05);
    }
  });
  it('ranh khớp DT và nằm trong khung mẫu căn; Ø nội tiếp tính lại khớp d_min_m', () => {
    for (const c of can) for (const p of c.phong!) {
      expect(Math.abs(dtDG(p.ranh) / 1e6 - p.dt_m2), `${c.id} ${p.ten}`).toBeLessThan(0.08 * p.dt_m2 + 0.1);
      const [x0, y0, x1, y1] = khungTim(c);
      for (const [x, y] of p.ranh) {
        expect(x, `${c.id} ${p.ten}`).toBeGreaterThan(x0 - 50); expect(x).toBeLessThan(x1 + 50);
        expect(y, `${c.id} ${p.ten}`).toBeGreaterThan(y0 - 50); expect(y).toBeLessThan(y1 + 50);
      }
      expect(Math.abs(vongNoiTiep(p.ranh, 5).r * 2 / 1000 - p.d_min_m), `${c.id} ${p.ten}`).toBeLessThan(0.08);
    }
  });
});
