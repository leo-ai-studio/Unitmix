import { describe, expect, it } from 'vitest';
import { moPhinh } from './napDxf';

const gan = (p: { x: number; y: number }, x: number, y: number) => {
  expect(p.x).toBeCloseTo(x, 6);
  expect(p.y).toBeCloseTo(y, 6);
};

describe('đa tuyến có độ phình (bulge) → cung tròn', () => {
  it('nửa vòng ngược chiều kim đồng hồ: (0,0) → (2,0), bulge 1 đi qua (1,−1)', () => {
    const p = moPhinh([{ x: 0, y: 0, bulge: 1 }, { x: 2, y: 0 }], false);
    gan(p[0], 0, 0);
    gan(p.at(-1)!, 2, 0);
    expect(p.length).toBeGreaterThan(30); // 180° chia ≤ 5°
    for (const q of p) expect(Math.hypot(q.x - 1, q.y)).toBeCloseTo(1, 6);
    gan(p[Math.round((p.length - 1) / 2)], 1, -1);
  });
  it('bulge âm cong về phía ngược lại', () => {
    const p = moPhinh([{ x: 0, y: 0, bulge: -1 }, { x: 2, y: 0 }], false);
    gan(p[Math.round((p.length - 1) / 2)], 1, 1);
  });
  it('cung 90° (bulge = tan 22,5°): mọi điểm cách tâm đúng bán kính', () => {
    const p = moPhinh([{ x: 1, y: 0, bulge: Math.tan(Math.PI / 8) }, { x: 0, y: 1 }], false);
    for (const q of p) expect(Math.hypot(q.x, q.y)).toBeCloseTo(1, 6);
    expect(p.length).toBeGreaterThanOrEqual(19);
  });
  it('đa tuyến kín: đoạn cuối → đầu cũng mở cung; không phình thì giữ nguyên', () => {
    const vuong = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(moPhinh(vuong, true)).toEqual(vuong);
    const p = moPhinh([...vuong.slice(0, 3), { x: 0, y: 10, bulge: 0.2 }], true);
    expect(p.length).toBeGreaterThan(4);
    // các điểm thêm nằm giữa (0,10) và (0,0), lệch khỏi trục x = 0
    expect(p.slice(4).every((q) => q.y > 0 && q.y < 10 && Math.abs(q.x) > 1e-6)).toBe(true);
  });
  it('hở: độ phình ở đỉnh cuối bị bỏ qua', () => {
    expect(moPhinh([{ x: 0, y: 0 }, { x: 5, y: 0, bulge: 1 }], false)).toHaveLength(2);
  });
});

describe('napDxf đọc độ phình của LWPOLYLINE', () => {
  it('ranh kín có một cạnh cong → đa giác có nhiều đỉnh trên cung', async () => {
    const { napDxf } = await import('./napDxf');
    const dong = ['0', 'SECTION', '2', 'ENTITIES', '0', 'LWPOLYLINE', '8', 'RANH', '90', '4', '70', '1',
      '10', '0', '20', '0', '10', '20', '20', '0', '42', '0.5', '10', '20', '20', '20', '10', '0', '20', '20', '0', 'ENDSEC', '0', 'EOF'];
    const ban = napDxf(dong.join('\n'));
    const [ranh] = ban.polyKin('RANH');
    expect(ranh.length).toBeGreaterThan(10);
    // cạnh (20,0) → (20,20) cong ra ngoài (bulge 0,5 ≈ 106°): có điểm x > 20
    expect(Math.max(...ranh.map((p) => p[0]))).toBeGreaterThan(22);
  });
});
