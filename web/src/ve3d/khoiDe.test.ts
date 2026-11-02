/** Khối đế chi tiết (dungToa.dungKhoiDe): sàn 150 · dầm 700 · vách kính 3.150 chia đố 1,2 m / 2,4 m · cột và vách lõi cắm thẳng từ tháp xuống. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Diem } from '../tinh/kieu';
import { taoVatLieu } from './dungCan';
import { CAO_DO_NGANG_MM, CAO_TANG_DE_MM, DAM_DE_MM, dungKhoiDe, SAN_DE_MM } from './dungToa';

const M = taoVatLieu(THREE as never, [], 'vatlieu');
const foot: Diem[] = [[0, 0], [20000, 0], [20000, 12000], [0, 12000]];
const loi: Diem[][] = [[[8000, 4000], [12000, 4000], [12000, 8000], [8000, 8000]]];
const khoiDac = (g: THREE.Object3D) => (pts: Diem[], h: number, m: THREE.Material, z0: number) => {
  const s = new THREE.Shape(); pts.forEach((p, i) => (i ? s.lineTo(p[0] * 0.001, p[1] * 0.001) : s.moveTo(p[0] * 0.001, p[1] * 0.001)));
  const geo = new THREE.ExtrudeGeometry(s, { depth: h * 0.001, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
  const me = new THREE.Mesh(geo, m); me.position.y = z0 * 0.001; g.add(me); return me;
};
const cao = (me: THREE.Mesh) => { me.geometry.computeBoundingBox(); const b = me.geometry.boundingBox!; return Math.round((b.max.y - b.min.y) * 1000); };
const theoVL = (g: THREE.Object3D, m: THREE.Material) => g.children.filter((o): o is THREE.Mesh => (o as THREE.Mesh).isMesh && (o as THREE.Mesh).material === m);

describe('khối đế: sàn · dầm · vách kính chia đố · cột vách', () => {
  const g = new THREE.Group();
  dungKhoiDe(THREE as never, g, M, foot, 2, loi, khoiDac(g));

  it('chiều cao: sàn 150 + kính 3.150 + dầm 700 = 4.000 mỗi tầng', () => {
    expect(SAN_DE_MM + (CAO_TANG_DE_MM - SAN_DE_MM - DAM_DE_MM) + DAM_DE_MM).toBe(CAO_TANG_DE_MM);
    const kinh = theoVL(g, M.kinhDe);
    expect(kinh).toHaveLength(2 * 4); // 2 tầng × 4 cạnh
    kinh.forEach((k) => expect(cao(k)).toBe(3150));
    const sans = theoVL(g, M.san);
    expect(sans).toHaveLength(2);
    sans.forEach((s) => expect(cao(s)).toBe(150));
    const dam = theoVL(g, M.de).filter((m) => cao(m) === DAM_DE_MM);
    expect(dam).toHaveLength(2 * 4);
  });

  it('vách kính cao tới mặt dưới dầm; đố ngang nằm cao 2,4 m trên mặt sàn', () => {
    const kinh = theoVL(g, M.kinhDe)[0];
    const tam = kinh.position.y * 1000, nua = 3150 / 2;
    expect(Math.round(tam - nua)).toBe(150); // chân kính = mặt sàn tầng 1
    expect(Math.round(tam + nua)).toBe(CAO_TANG_DE_MM - DAM_DE_MM); // đỉnh kính = đáy dầm
    const ngang = theoVL(g, M.khung).filter((m) => cao(m) === 60 && [150 + CAO_DO_NGANG_MM, CAO_TANG_DE_MM + 150 + CAO_DO_NGANG_MM].includes(Math.round(m.position.y * 1000)));
    expect(ngang.length).toBe(2 * 4);
  });

  it('đố đứng nhịp ≈ 1,2 m, chia đều (cạnh 20 m → 17 nhịp, 16 đố; cạnh 12 m → 10 nhịp, 9 đố)', () => {
    const dung = theoVL(g, M.khung).filter((m) => cao(m) === 3150);
    expect(dung).toHaveLength(2 * (16 + 16 + 9 + 9));
  });

  it('cột chu vi và vách lõi cao suốt khối đế (2 × 4 m = 8 m)', () => {
    const cotVach = theoVL(g, M.lov).filter((m) => cao(m) === 2 * CAO_TANG_DE_MM);
    // cột: 4 góc + cạnh 20 m chia 3 nhịp (2 cột giữa) × 2 + cạnh 12 m chia 2 nhịp (1 cột giữa) × 2 = 4 + 4 + 2 = 10; + 1 vách lõi
    expect(cotVach).toHaveLength(10 + 1);
  });
});
