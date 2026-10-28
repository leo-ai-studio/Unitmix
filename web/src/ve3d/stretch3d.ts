/**
 * Khối 3D của căn đã STRETCH (DC-04 · QT-81): cùng luật hình 2D (`veBienThe`) — mọi điểm có x > x_cắt dời st, bên trái đứng yên.
 * Tường, sàn, dầm kéo theo đỉnh; cửa đi / lan can / lover bên phải đường cắt dời nguyên khối, cửa sổ và cửa trượt vắt qua đường
 * cắt thì giãn theo hai đầu. Khối 3D không lưu "nét thuộc block" (`cung`) như nét 2D nên cửa vắt đường cắt có thể lệch vài chục mm.
 */
import type { CanMau, ThuVien } from '../tinh/kieu';
import { tachMa } from '../tinh/stretch';
import type { Cua3d, Khoi3d } from './dungCan';

/** Khối 3D của mẫu căn gốc `goc` sau khi kéo `st` mm (st = 0 hoặc mẫu không kéo được: trả nguyên khối). */
export function khoi3dBienThe(d: Khoi3d, goc: CanMau, st: number): Khoi3d {
  const K = goc.stretch;
  if (!K || !st) return d;
  const xc = K.x_mm;
  const mx = (x: number) => (x > xc ? x + st : x);
  const dich = (a: number, b: number) => ((a + b) / 2 > xc ? st : 0); // dời nguyên khối theo tâm
  const vong = (r: number[][]) => r.map(([x, y]) => [mx(x), y]);
  const cua = (o: Cua3d): Cua3d => {
    if (o.ax === 's') return { ...o, o: o.o && o.o[0] > xc ? [o.o[0] + st, ...o.o.slice(1)] : o.o };
    if (o.ax === 'y') { const s = dich(o.n[0], o.n[1]); return { ...o, n: [o.n[0] + s, o.n[1] + s] }; } // mặt phẳng đứng tại x = n
    if (o.t === 'swing') { const s = dich(o.c[0], o.c[1]); return { ...o, a: [o.a[0] + s, o.a[1] + s], c: [o.c[0] + s, o.c[1] + s] }; }
    return { ...o, a: [mx(o.a[0]), mx(o.a[1])], c: [mx(o.c[0]), mx(o.c[1])] };
  };
  return {
    ...d,
    walls: d.walls.map(vong),
    slab: d.slab.map(vong),
    damS: d.damS?.map(vong),
    openings: d.openings.map(cua),
    rails: d.rails.map((r) => {
      const b = r.b;
      if (r.ax === 'x') return { ...r, b: [mx(b[0]), b[1], mx(b[2]), b[3]] };
      const s = dich(b[0], b[2]);
      return { ...r, b: [b[0] + s, b[1], b[2] + s, b[3]] };
    }),
    lovers: d.lovers.map((l) => {
      if (l.ax === 'x') return { ...l, a: [mx(l.a[0]), mx(l.a[1])] };
      const s = dich(l.n[0], l.n[1]);
      return { ...l, n: [l.n[0] + s, l.n[1] + s] };
    }),
    bb: [d.bb[0], d.bb[1], mx(d.bb[2]), d.bb[3]],
  };
}

/** Khối 3D của một id căn bất kỳ (gốc hoặc biến thể `id~s+300`) từ khối 3D tệp mẫu gốc. */
export function khoi3dTheoId(id: string, dGoc: Khoi3d | null, tv?: ThuVien | null): Khoi3d | null {
  if (!dGoc || !tv) return dGoc;
  const { goc, st } = tachMa(id), g = tv.can.get(goc);
  if (!st || !g) return dGoc;
  // nhớ theo khối gốc × mức kéo: cùng một đối tượng mỗi lần nạp lại → bộ nhớ hình 3D (dungToa) trúng, không dựng lại căn kéo
  let m = nhoBienThe.get(dGoc);
  if (!m) nhoBienThe.set(dGoc, (m = new Map()));
  const k = `${goc}|${st}`;
  let d = m.get(k);
  if (!d) m.set(k, (d = khoi3dBienThe(dGoc, g, st)));
  return d;
}
const nhoBienThe = new WeakMap<Khoi3d, Map<string, Khoi3d>>();
