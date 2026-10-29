import { describe, expect, it } from 'vitest';
import { batDauChum, bienDoi, laChamDup, MS_GIU, nhinKhiChum, nhinKhiKeo, phanLoai, raPx, zoomTu, type NhinThay } from './camUng';

const R = 390, C = 700;
const v0: NhinThay = { cx: 50, cy: -30, w: 120 };
const gan = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('phân biệt chạm / kéo / chụm / giữ', () => {
  const dau = { x: 100, y: 100, t: 0 };
  it('đứng yên nhấc nhanh = chạm; run ngón dưới 10 px vẫn là chạm', () => {
    expect(phanLoai(dau, { x: 100, y: 100, t: 120 }, 0, 1, 'touch')).toBe('cham');
    expect(phanLoai(dau, { x: 107, y: 104, t: 150 }, 8, 1, 'touch')).toBe('cham');
  });
  it('chuột ngưỡng nhỏ hơn ngón: 8 px là kéo', () => {
    expect(phanLoai(dau, { x: 108, y: 100, t: 100 }, 8, 1, 'mouse')).toBe('keo');
  });
  it('đi xa rồi quay về chỗ cũ vẫn là kéo (theo quãng xa nhất)', () => {
    expect(phanLoai(dau, { x: 100, y: 100, t: 400 }, 60, 1, 'touch')).toBe('keo');
  });
  it('hai ngón là chụm, kể cả khi ngón đầu đứng yên', () => {
    expect(phanLoai(dau, { x: 100, y: 100, t: 100 }, 0, 2, 'touch')).toBe('chum');
  });
  it('giữ yên lâu = nhấn giữ', () => {
    expect(phanLoai(dau, { x: 102, y: 101, t: MS_GIU + 10 }, 3, 1, 'touch')).toBe('giu');
  });
  it('chạm hai lần: gần về thời gian và chỗ', () => {
    expect(laChamDup({ x: 10, y: 10, t: 0 }, { x: 18, y: 14, t: 250 })).toBe(true);
    expect(laChamDup({ x: 10, y: 10, t: 0 }, { x: 18, y: 14, t: 600 })).toBe(false);
    expect(laChamDup({ x: 10, y: 10, t: 0 }, { x: 80, y: 10, t: 200 })).toBe(false);
    expect(laChamDup(null, { x: 10, y: 10, t: 0 })).toBe(false);
  });
});

describe('phóng quanh tâm', () => {
  it('điểm dưới con trỏ / giữa hai ngón đứng yên khi phóng', () => {
    const p = { x: 300, y: 120 };
    const v = zoomTu(v0, R, C, 0.5, p.x, p.y);
    gan(v.w, 60);
    // điểm thế giới dưới p trước khi phóng
    const m = v0.w / R, wx = v0.cx + (p.x - R / 2) * m, wy = v0.cy + (p.y - C / 2) * m;
    const q = raPx(v, R, C, wx, wy);
    gan(q.x, p.x); gan(q.y, p.y);
  });
  it('chụm: hai ngón tách gấp đôi quanh trung điểm → bề rộng còn một nửa, trung điểm đứng yên', () => {
    const a = { x: 150, y: 300 }, b = { x: 250, y: 300 };
    const g = batDauChum(v0, a, b);
    const v = nhinKhiChum(g, { x: 100, y: 300 }, { x: 300, y: 300 }, R, C);
    gan(v.w, 60);
    const m = v0.w / R, wx = v0.cx + (200 - R / 2) * m, wy = v0.cy + (300 - C / 2) * m;
    const q = raPx(v, R, C, wx, wy);
    gan(q.x, 200); gan(q.y, 300);
  });
  it('chụm kèm dời: trung điểm đi 40 px thì điểm dưới trung điểm đi theo', () => {
    const a = { x: 150, y: 300 }, b = { x: 250, y: 300 };
    const g = batDauChum(v0, a, b);
    const v = nhinKhiChum(g, { x: 190, y: 340 }, { x: 290, y: 340 }, R, C);
    gan(v.w, v0.w);
    const m = v0.w / R, wx = v0.cx + (200 - R / 2) * m, wy = v0.cy + (300 - C / 2) * m;
    const q = raPx(v, R, C, wx, wy);
    gan(q.x, 240); gan(q.y, 340);
  });
  it('kéo một ngón: bản vẽ đi đúng theo ngón', () => {
    const v = nhinKhiKeo(v0, 30, -20, R);
    const p0 = raPx(v0, R, C, 40, -10), p1 = raPx(v, R, C, 40, -10);
    gan(p1.x - p0.x, 30); gan(p1.y - p0.y, -20);
  });
});

describe('transform bám tay khớp với vẽ lại', () => {
  it('ảnh vẽ theo khung cũ + transform trùng ảnh vẽ theo khung mới', () => {
    const nay = zoomTu(nhinKhiKeo(v0, 25, 40, R), R, C, 0.7, 120, 500);
    const { tx, ty, s } = bienDoi(v0, nay, R);
    for (const [x, y] of [[0, 0], [50, -30], [123, 45], [-80, 10]]) {
      const p0 = raPx(v0, R, C, x, y);
      // gốc biến đổi ở tâm ô chứa
      const qx = s * (p0.x - R / 2) + R / 2 + tx, qy = s * (p0.y - C / 2) + C / 2 + ty;
      const p1 = raPx(nay, R, C, x, y);
      gan(qx, p1.x); gan(qy, p1.y);
    }
  });
});
