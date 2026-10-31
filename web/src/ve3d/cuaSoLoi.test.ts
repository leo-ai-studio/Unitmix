import { describe, expect, it } from 'vitest';
import { idLoiTep, napThuVien } from '../thu/thuVienThat';
import { CUA_SO_LOI, cuaSoLoi, ranhTumCo, type LoiHinh } from './dungToa';
import { kheHoNetBao, type DauHanhLang } from './kheHo';
import { khungTaiO, veLoiTaiViTri, viTriCan } from '../tinh/matBang';
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
  const { toaDs, dl, tv } = napThuVien();
  const loi = new Map<string, LoiHinh>();
  dl.loi.forEach((v, k) => loi.set(idLoiTep(k), { bao_tuong_mm: v.bao_tuong_mm as LoiHinh['bao_tuong_mm'], bao_tm: v.bao_tm, tuong: v.paths?.filter((n) => n.cat === 'wall' && n.pts.length >= 4).map((n) => n.pts) }));
  return { toaDs: toaDs as unknown as { id: string; duong_bao: Diem[]; mat: never[] }[], loi, dl, tv };
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

describe('cửa sổ sảnh thang máy (mặt ngoài lõi)', () => {
  it('tòa I · V: mỗi mặt ngoài lõi đúng MỘT cửa 1.800 ở giữa cạnh, quay ra ngoài', () => {
    const { toaDs, loi } = loiTheoToa();
    const dem: Record<string, number> = {};
    for (const id of ['tm-i1', 'tm-v1', 'xh-v1', 'xh-i1']) {
      const t = toaDs.find((x) => x.id === id)!;
      const cs = ranhTumCo(t as never, loi, idLoiTep).filter((r) => !r.thang).flatMap((r) => cuaSoLoi(r.pts, t.duong_bao).map((c) => ({ c, r })));
      dem[id] = cs.length;
      expect(cs.length, id).toBeGreaterThan(0);
      for (const { c, r } of cs) {
        const tam: Diem = [c.a[0] + c.t[0] * c.tam, c.a[1] + c.t[1] * c.tam];
        const ra: Diem = [tam[0] + c.n[0] * 300, tam[1] + c.n[1] * 300];
        expect(trong(ra, r.pts), `${id} cửa sổ quay vào trong lõi`).toBe(false);
        expect(CUA_SO_LOI.rong).toBe(1800);
      }
    }
    expect(dem['tm-i1']).toBe(2); // hai lõi, mỗi lõi một mặt tiền sảnh
    expect(dem['tm-v1']).toBe(1);
  });

  it('cạnh trong nhà (không sát nét bao) không có cửa sổ; cạnh sát nét bao có đúng một cửa ở giữa', () => {
    const r: Diem[] = [[0, 0], [8000, 0], [8000, 5000], [0, 5000]];
    expect(cuaSoLoi(r, [[-5000, -5000], [20000, -5000], [20000, 15000], [-5000, 15000]])).toEqual([]);
    const sat = cuaSoLoi(r, [[0, 0], [8000, 0], [8000, 9000], [0, 9000]]); // đáy y = 0 + hai cạnh bên (5.000 m) sát nét bao, cạnh đỉnh thì không
    expect(sat.some((c) => c.a[1] === 0 && c.n[1] === -1 && c.tam === 4000)).toBe(true);
    expect(sat.some((c) => c.n[1] === 1)).toBe(false);
    expect(sat.every((c) => c.tam > 0)).toBe(true);
  });
});

describe('khe hở nét bao (đầu hành lang)', () => {
  function khe(id: string) {
    const { toaDs, loi, dl, tv } = loiTheoToa();
    const t = toaDs.find((x) => x.id === id) as unknown as { id: string; duong_bao: Diem[]; mat: { phan_tu: { loai: string; bang?: boolean; block: string; x: number; y: number; rot: number; sx: number; sy: number }[] }[]; hanhlang_ve?: Diem[][]; hanh_lang_mm?: number };
    const vts = viTriCan(t as never, tv);
    const polys: Diem[][] = vts.map((vt) => { const cm = tv.can.get(vt.canGocId); return khungTaiO(t as never, vt.matIdx, vt.a0, vt.a1, cm?.sau_mm ?? vt.sau, vt.guong, cm?.khung) ?? vt.goc; });
    const tuong: Diem[][] = [];
    for (const m of t.mat) for (const q of m.phan_tu) {
      if (q.loai === 'can' || q.bang) continue;
      const l = loi.get(idLoiTep(q.block));
      if (l?.tuong?.length) l.tuong.forEach((w) => tuong.push(veLoiTaiViTri([{ cat: 'wall', pts: w }], q)[0].pts));
    }
    void dl;
    const w = t.hanh_lang_mm || 1800;
    const dau: DauHanhLang[] = (t.hanhlang_ve ?? []).flatMap((pl) => (pl.length > 1 ? [{ p: pl[0], c: w }, { p: pl[pl.length - 1], c: w }] : []));
    return { khe: kheHoNetBao(t.duong_bao, polys, tuong, dau), w };
  }

  it('đầu hành lang hở: cửa sổ rộng = hành lang − 200, vào trong nhà', () => {
    for (const id of ['tm-i1', 'tm-v1', 'tm-z1', 'xh-z1']) {
      const { khe: ds, w } = khe(id);
      expect(ds.length, id).toBeGreaterThan(0);
      for (const e of ds.filter((x) => x.hl)) {
        expect(Math.abs(e.cw - (e.w - 200)), id).toBeLessThan(1);
        expect(Math.abs(e.w - w), id).toBeLessThanOrEqual(300);
      }
    }
    expect(khe('tm-i1').khe.filter((e) => e.hl)).toHaveLength(2); // hai đầu tòa I
  });

  it('không có khe nào ngoài khoảng 1,0–2,2 m hay cửa quá 1,8 m ở sảnh', () => {
    for (const id of ['tm-i1', 'tm-l1', 'tm-t1', 'tm-u1', 'tm-v4', 'xh-u1', 'xh-y1']) {
      for (const e of khe(id).khe) {
        expect(e.w, id).toBeGreaterThanOrEqual(1000);
        expect(e.w, id).toBeLessThanOrEqual(2200 + 50);
        if (!e.hl) expect(e.cw, id).toBeLessThanOrEqual(1800);
      }
    }
  });
});
