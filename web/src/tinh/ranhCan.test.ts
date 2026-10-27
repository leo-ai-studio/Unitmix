import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { taoThuVien, type CanMau, type Diem } from './kieu';
import { canVuaModule, coDaGiac, hinhLogia, khungCanNet, ranhTo, veCanTaiViTri, viTriCan, vungCatCan, type NetVe, type ToaCoMat } from './matBang';

const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const toaDs = doc<ToaCoMat[]>('toa.json');
const canDs = doc<CanMau[]>('can.json');
const tv = taoThuVien(toaDs, canDs);
const ve = (id: string) => doc<{ ve: NetVe[] }>(`can/${id}.json`).ve;
const dt = (P: Diem[]) => { let a = 0; for (let i = 0; i < P.length; i++) { const A = P[i], B = P[(i + 1) % P.length]; a += A[0] * B[1] - B[0] * A[1]; } return Math.abs(a) / 2; };
/** Vị trí đầu tiên trên mọi mẫu tòa mà căn đang dùng là `canId`. */
const tim = (canId: string) => { for (const t of toaDs) { const vt = viTriCan(t, tv).find((v) => v.canGocId === canId); if (vt) return { t, vt }; } throw new Error(canId); };

describe('ranh tô và vành tường căn', () => {
  it('căn có hốc logia: ranh tô nhỏ hơn ô module đúng phần hốc, hinhLogia trùng diện tích đó', () => {
    const id = canDs.find((x) => x.logia_lui?.length && toaDs.some((t) => viTriCan(t, tv).some((v) => v.canGocId === x.id)))!.id;
    const { t, vt } = tim(id);
    const c = tv.can.get(id)!, nets = veCanTaiViTri(ve(id), vt, t);
    const module_ = dt(vt.goc), ranh = ranhTo(nets)!;
    expect(ranh).not.toBeNull();
    const hoc = (c.logia_lui![0][1] - c.logia_lui![0][0]) * (1 - c.logia_lui![0][2]) * module_;
    expect(dt(ranh)).toBeLessThan(module_ - hoc * 0.5);
    expect(dt(hinhLogia(vt, t, c.logia_lui)!)).toBeCloseTo(module_ - hoc, -3);
  });
  it('căn không hốc: hinhLogia là null; ranh tô xấp xỉ ô module (±8 %)', () => {
    const { t, vt } = tim('tm-1pn-m1');
    expect(hinhLogia(vt, t, undefined)).toBeNull();
    const nets = veCanTaiViTri(ve('tm-1pn-m1'), vt, t);
    expect(dt(ranhTo(nets)!) / dt(vt.goc)).toBeGreaterThan(0.92);
    expect(dt(ranhTo(nets)!) / dt(vt.goc)).toBeLessThan(1.08);
  });
  it('hốc logia khi căn lật gương nằm ở phía ngược lại', () => {
    const id = canDs.find((x) => x.logia_lui?.length && toaDs.some((t) => viTriCan(t, tv).some((v) => v.canGocId === x.id)))!.id;
    const ds = toaDs.flatMap((t) => viTriCan(t, tv).filter((v) => v.canGocId === id).map((vt) => ({ t, vt })));
    const g = ds.find((x) => x.vt.guong), th = ds.find((x) => !x.vt.guong);
    if (!g || !th) return;
    const c = tv.can.get(id)!;
    const tb = (x: typeof g) => { const P = hinhLogia(x.vt, x.t, c.logia_lui)!; return P.length; };
    expect(tb(g)).toBe(tb(th)); // cùng hình, chỉ khác bên
  });
  it('mọi mẫu căn có nét tim; mẫu V có khung', () => {
    for (const c of canDs) { const v = ve(c.id); expect(v.some((n) => n.cat === 'tim'), c.id).toBe(true); }
    expect(khungCanNet(ve('tm-2pn-v1'))).not.toBeNull();
    expect(khungCanNet(ve('tm-2pn-m1'))).toBeNull();
  });
  it('co đa giác: chữ nhật co 125 mm mỗi phía', () => {
    const r: Diem[] = [[0, 0], [7500, 0], [7500, 8500], [0, 8500]];
    expect(dt(coDaGiac(r, 125))).toBeCloseTo((7500 - 250) * (8500 - 250), -2);
    expect(dt(coDaGiac([...r].reverse(), 125))).toBeCloseTo((7500 - 250) * (8500 - 250), -2); // đúng cả chiều ngược
  });
  it('căn vừa module thì cắt nét; căn có khung (V) thì không', () => {
    const vua = canDs.filter((c) => canVuaModule(ve(c.id), c.rong_mm, !!khungCanNet(ve(c.id))));
    expect(vua.length).toBeGreaterThan(15);
    for (const id of ['tm-2pn-v1', 'tm-2pn-v2', 'tm-3pn-v1', 'xh-2pn-v1']) expect(vua.some((c) => c.id === id), id).toBe(false);
    expect(vua.some((c) => c.id === 'tm-1pn-m1')).toBe(true);
  });
  it('vùng cắt = ô module mở 125 mm hai bên và 2 % chiều sâu hai đầu', () => {
    const { t, vt } = tim('tm-1pn-m1');
    expect(dt(vungCatCan(vt, t))).toBeCloseTo((5800 + 250) * (8500 * 1.04), -3);
  });
});
