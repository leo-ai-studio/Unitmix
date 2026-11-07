import { describe, expect, it } from 'vitest';
import { tachTang, type LuoiVL } from './luoi3d';
import { taoDae } from './xuatDae';
import { guidIfc, taoIfc } from './xuatIfc';

/** Tấm tường đứng 4 m² cao `z0..z1` (hai tam giác) + sàn mỏng ngay dưới mặt tầng. */
const tam = (z0: number, z1: number): number[] => [0, 0, z0, 2, 0, z0, 2, 0, z1, 0, 0, z0, 2, 0, z1, 0, 0, z1];
const luoi = (...z: [number, number][]): LuoiVL => ({ khoa: 'tuong|e4d8c2|1.00', ten: 'Tuong', mau: 0xe4d8c2, doDuc: 1, P: new Float32Array(z.flatMap(([a, b]) => tam(a, b))) });

describe('tách tầng + gộp tầng giống nhau', () => {
  const tang = [{ ten: 'T1', caoDo: 0 }, { ten: 'T2', caoDo: 3 }, { ten: 'T3', caoDo: 6 }, { ten: 'Mai', caoDo: 9 }];
  // ba tầng tường giống hệt nhau (mỗi tầng 0,2 m dưới → 2,9 m trên mặt tầng) + sàn dưới mặt tầng 2 / 3 / mái
  const l = luoi([-0.1, 2.9], [2.9, 5.9], [5.9, 8.9]);
  const t = tachTang([l], tang);
  it('mỗi tam giác về đúng tầng, toạ độ z tính từ mặt tầng', () => {
    expect(t.map((x) => x.phan.reduce((s, p) => s + p.P.length / 9, 0))).toEqual([2, 2, 2, 0]);
    for (const x of t) for (const p of x.phan) for (let i = 2; i < p.P.length; i += 3) expect(p.P[i]).toBeGreaterThanOrEqual(-0.31);
  });
  it('tầng giống nhau chung một id hình (ghi một lần)', () => {
    const ids = t.flatMap((x) => x.phan.map((p) => p.id));
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(1);
    const dae = taoDae([{ ten: 'Toa', x: 10, y: 20, goc: 30, tang: t }], 'Thử');
    expect((dae.match(/<geometry /g) ?? []).length).toBe(1);
    expect((dae.match(/<instance_geometry /g) ?? []).length).toBe(1); // một định nghĩa tầng trong library_nodes
    expect((dae.match(/<instance_node url="#tang/g) ?? []).length).toBe(3); // ba tầng đặt lại component đó
    expect((dae.match(/<instance_node url="#toa/g) ?? []).length).toBe(1);
    expect(dae).toContain('<rotate>0 0 1 30</rotate>');
    const ifc = taoIfc([{ ten: 'Toa', x: 10, y: 20, goc: 30, tang: t }], 'Thử');
    expect((ifc.match(/=IFCREPRESENTATIONMAP\(/g) ?? []).length).toBe(1);
    expect((ifc.match(/=IFCMAPPEDITEM\(/g) ?? []).length).toBe(3);
  });
  it('tầng khác hình thì khác id', () => {
    const k = tachTang([luoi([-0.1, 2.9], [2.9, 5.0])], tang);
    expect(new Set(k.flatMap((x) => x.phan.map((p) => p.id))).size).toBe(2);
  });
});

describe('IFC', () => {
  it('GlobalId 22 ký tự đúng bảng IFC, không trùng', () => {
    const a = Array.from({ length: 200 }, guidIfc);
    expect(a.every((g) => /^[0-9A-Za-z_$]{22}$/.test(g) && '0123'.includes(g[0]))).toBe(true);
    expect(new Set(a).size).toBe(200);
  });
  it('tên có dấu / nháy đơn thoát đúng, không ký tự ngoài ASCII', () => {
    const s = taoIfc([{ ten: "Tòa 'A' Đan Phượng", x: 0, y: 0, goc: 0, tang: [{ ten: 'Tầng 1', caoDo: 0, phan: [] }] }], 'Dự án "M7"');
    expect(/[^\x09\x0a\x0d\x20-\x7e]/.test(s)).toBe(false);
    expect(s).toContain("'Toa ''A'' Dan Phuong'");
  });
});
