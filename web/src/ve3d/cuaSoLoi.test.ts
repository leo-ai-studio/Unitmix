import { describe, expect, it } from 'vitest';
import { idLoiTep, napThuVien } from '../thu/thuVienThat';
import { CUA_SO_LOI, cuaSoLoi, ranhTumCo, type LoiHinh } from './dungToa';
import type { Diem } from '../tinh/kieu';

const trong = (p: Diem, P: Diem[]) => {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};

function loiTheoToa() {
  const { toaDs, dl } = napThuVien();
  const loi = new Map<string, LoiHinh>();
  dl.loi.forEach((v, k) => loi.set(idLoiTep(k), { bao_tuong_mm: v.bao_tuong_mm as LoiHinh['bao_tuong_mm'], bao_tm: v.bao_tm }));
  return { toaDs: toaDs as unknown as { id: string; duong_bao: Diem[]; mat: never[] }[], loi };
}

describe('lõi 3D theo đa giác khung tường (bao_tm), không theo hộp chữ nhật', () => {
  it('lõi chữ V / chữ L không lòi ra ngoài nét bao DTXD', () => {
    const { toaDs, loi } = loiTheoToa();
    const loiRa: string[] = [];
    for (const t of toaDs) {
      for (const r of ranhTumCo(t as never, loi, idLoiTep)) {
        if (r.thang) continue;
        const xs = r.pts.map((p) => p[0]), ys = r.pts.map((p) => p[1]);
        let ra = 0;
        for (let x = Math.min(...xs) + 50; x < Math.max(...xs); x += 100) for (let y = Math.min(...ys) + 50; y < Math.max(...ys); y += 100) {
          if (trong([x, y], r.pts) && !trong([x, y], t.duong_bao)) ra++;
        }
        if (ra * 1e4 > 1e6) loiRa.push(`${t.id}: ${(ra * 0.01).toFixed(1)} m²`); // > 1 m²
      }
    }
    // xh-l1 / xh-l2: thư viện chưa có bao_tm cho lõi xh-l1-tm-08 → còn hộp chữ nhật (đã ghi NHAT_KY)
    expect(loiRa.filter((s) => !/^xh-l[12]:/.test(s))).toEqual([]);
  });
});

describe('cửa sổ lõi (sảnh thang máy / hành lang)', () => {
  it('cạnh lõi sát mặt ngoài có cửa sổ, nằm trọn trong cạnh, quay ra ngoài', () => {
    const { toaDs, loi } = loiTheoToa();
    let tong = 0;
    for (const id of ['tm-i1', 'tm-v1', 'xh-v1']) {
      const t = toaDs.find((x) => x.id === id)!;
      const cs = ranhTumCo(t as never, loi, idLoiTep).filter((r) => !r.thang).flatMap((r) => cuaSoLoi(r.pts, t.duong_bao).map((c) => ({ c, r })));
      expect(cs.length, id).toBeGreaterThan(0);
      for (const { c, r } of cs) {
        tong++;
        const tam: Diem = [c.a[0] + c.t[0] * c.tam, c.a[1] + c.t[1] * c.tam];
        const ra: Diem = [tam[0] + c.n[0] * 300, tam[1] + c.n[1] * 300];
        expect(trong(ra, r.pts), `${id} cửa sổ quay vào trong lõi`).toBe(false);
        expect(c.tam - CUA_SO_LOI.rong / 2, `${id} cửa sổ tràn đầu cạnh`).toBeGreaterThanOrEqual(CUA_SO_LOI.chua - 1);
      }
    }
    expect(tong).toBeGreaterThan(5);
  });

  it('cạnh trong nhà (không sát nét bao) không có cửa sổ', () => {
    const r: Diem[] = [[0, 0], [8000, 0], [8000, 5000], [0, 5000]];
    const foot: Diem[] = [[-5000, -5000], [20000, -5000], [20000, 15000], [-5000, 15000]];
    expect(cuaSoLoi(r, foot)).toEqual([]);
    const sat = cuaSoLoi(r, [[0, 0], [8000, 0], [8000, 9000], [0, 9000]]); // cạnh đáy và hai cạnh bên sát nét bao, cạnh đỉnh y = 5000 thì không
    expect(sat.length).toBeGreaterThan(0);
    expect(sat.some((c) => c.a[1] === 0 && c.n[1] === -1)).toBe(true);
    expect(sat.some((c) => c.n[1] === 1)).toBe(false);
  });
});
