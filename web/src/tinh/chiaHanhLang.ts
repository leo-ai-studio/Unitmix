/**
 * Chia hành lang thành khoang bằng cửa ngăn cháy / ngăn khói (hàm thuần trên đồ thị hành lang của tinh/pccc.ts `dungDoThi`).
 *
 * Ngưỡng theo chiều cao PCCC (như app cũ `cncGioiHan`, QT-95 / QT-98):
 *  - H ≤ 75 m: QCVN 06:2022 (SĐ1:2023) 3.3.5 — "Các hành lang dài hơn 60 m phải được phân chia …" thành đoạn ≤ 60 m.
 *  - H > 75 m: A.3.1.7 dẫn A.2.14 — "Đối với khối căn hộ: không quá 30 m".
 * Khoang = phần hành lang LIỀN NHAU giữa các cửa (nhánh L / T không có cửa ở chỗ nối cộng dồn — như app cũ).
 * App cũ còn cộng sảnh thang máy vào khoang (QT-100) và giải chính xác (quy hoạch động trên cây cầu, R1–R7 QT-105); ở đây đặt
 * tham lam từ lá về gốc trên cây khung, chừa 1,5 m dự phòng để dời cửa tránh cửa căn / cửa thang — sảnh thang máy chưa cộng.
 */
import type { Diem } from './kieu';

export type CanhHL = { i: number; j: number; L: number; p0: Diem; p1: Diem; huong: Diem };
export type CuaHL = { e: number; t: number; p: Diem; huong: Diem };

/** Giới hạn chiều dài khoang hành lang (m) theo chiều cao PCCC. */
export const gioiHanKhoangHL = (H: number) =>
  H > 75 ? { m: 30, canCu: 'QCVN 06:2022 A.3.1.7 → A.2.14' } : { m: 60, canCu: 'QCVN 06:2022 3.3.5' };

const DU_PHONG = 1500; // mm chừa để dời cửa tránh cửa căn / thang
const CACH_NUT = 600; // mm cửa đặt cách nút (chỗ rẽ / chỗ nối) tối thiểu
const TRANH = 1200; // mm cửa cách tim cửa căn / cửa thang tối thiểu (dọc hành lang)

const diemTren = (e: CanhHL, t: number): Diem => [e.p0[0] + (e.p1[0] - e.p0[0]) * t, e.p0[1] + (e.p1[1] - e.p0[1]) * t];

/** Chiều dài các khoang (mm) khi hành lang bị chia tại các cửa `cua`: tách cạnh tại cửa, gộp mảnh qua nút. */
export function doKhoang(canh: CanhHL[], soNut: number, cua: Pick<CuaHL, 'e' | 't'>[]): number[] {
  const goc: number[] = [];
  for (let k = 0; k < soNut; k++) goc.push(k);
  const tim = (x: number): number => { while (goc[x] !== x) { goc[x] = goc[goc[x]]; x = goc[x]; } return x; };
  const hop = (a: number, b: number) => { const x = tim(a), y = tim(b); if (x !== y) goc[x] = y; };
  const manh: { id: number; len: number }[] = [];
  canh.forEach((e, k) => {
    const ts = cua.filter((c) => c.e === k).map((c) => Math.min(1, Math.max(0, c.t))).sort((a, b) => a - b);
    const moc = [0, ...ts, 1];
    for (let s = 0; s + 1 < moc.length; s++) {
      const len = (moc[s + 1] - moc[s]) * e.L;
      const dau = s === 0, cuoi = s === moc.length - 2;
      if (dau && cuoi) hop(e.i, e.j);
      const id = dau ? e.i : cuoi ? e.j : (goc.push(goc.length), goc.length - 1);
      manh.push({ id, len });
    }
  });
  const tong = new Map<number, number>();
  for (const m of manh) tong.set(tim(m.id), (tong.get(tim(m.id)) ?? 0) + m.len);
  return [...tong.values()].filter((x) => x > 1).sort((a, b) => b - a);
}

/**
 * Đặt cửa chia khoang: mỗi mạng liền có tổng ≤ giới hạn thì không cửa. Còn lại dựng cây khung từ nút bậc lớn nhất, đi từ lá về
 * gốc: phần treo dưới nút + cạnh vượt giới hạn thì cắt trên cạnh (cách đầu dưới đúng phần còn thiếu, rồi mỗi `gioiHan`); tổng các
 * nhánh tại nút vượt thì cắt nhánh dài nhất sát nút. Cạnh ngoài cây (vòng) cắt giữa cạnh. Cửa dời ±1,5 m tránh `tranh`.
 */
export function chiaHanhLang(canh: CanhHL[], soNut: number, gioiHanMm: number, tranh: Diem[] = []): CuaHL[] {
  const lim = gioiHanMm - DU_PHONG;
  const ke: [number, number][][] = Array.from({ length: soNut }, () => []);
  canh.forEach((e, k) => { ke[e.i].push([e.j, k]); ke[e.j].push([e.i, k]); });
  const cua: { e: number; t: number }[] = [];
  /** cửa trên cạnh k, cách đầu `tu` (nút) một đoạn d mm */
  const datCua = (k: number, tu: number, d: number) => {
    const e = canh[k], dd = Math.min(Math.max(d, Math.min(CACH_NUT, e.L / 2)), Math.max(e.L - Math.min(CACH_NUT, e.L / 2), 0));
    cua.push({ e: k, t: tu === e.i ? dd / e.L : 1 - dd / e.L });
  };
  const daXet = new Array(soNut).fill(false);
  for (let s = 0; s < soNut; s++) {
    if (daXet[s] || !ke[s].length) continue;
    // mạng liền chứa s
    const mang: number[] = [], q = [s];
    daXet[s] = true;
    while (q.length) { const u = q.pop()!; mang.push(u); for (const [v] of ke[u]) if (!daXet[v]) { daXet[v] = true; q.push(v); } }
    const canhMang = new Set(mang.flatMap((u) => ke[u].map(([, k]) => k)));
    const tong = [...canhMang].reduce((a, k) => a + canh[k].L, 0);
    if (tong <= gioiHanMm) continue;
    const goc0 = mang.reduce((a, u) => (ke[u].length > ke[a].length ? u : a), mang[0]);
    // cây khung BFS
    const cha = new Map<number, { u: number; k: number }>(), thuTu = [goc0], thay = new Set([goc0]), dungCay = new Set<number>();
    for (let h = 0; h < thuTu.length; h++) {
      const u = thuTu[h];
      for (const [v, k] of ke[u]) if (!thay.has(v)) { thay.add(v); cha.set(v, { u, k }); dungCay.add(k); thuTu.push(v); }
    }
    const treo = new Map<number, number>(mang.map((u) => [u, 0]));
    for (const k of canhMang) if (!dungCay.has(k)) {
      const e = canh[k];
      cua.push({ e: k, t: 0.5 });
      treo.set(e.i, treo.get(e.i)! + e.L / 2);
      treo.set(e.j, treo.get(e.j)! + e.L / 2);
    }
    const dongGop = new Map<number, number>(); // phần nhánh v đưa lên cha (mm)
    for (let h = thuTu.length - 1; h >= 0; h--) {
      const u = thuTu[h];
      // các con của u
      const con = thuTu.filter((v) => cha.get(v)?.u === u).map((v) => ({ v, k: cha.get(v)!.k, gt: dongGop.get(v)! }));
      let S = treo.get(u)! + con.reduce((a, c) => a + c.gt, 0);
      con.sort((a, b) => b.gt - a.gt);
      for (const c of con) {
        if (S <= lim) break;
        const e = canh[c.k], d = Math.min(CACH_NUT, e.L / 2);
        datCua(c.k, u, d);
        S = S - c.gt + d;
      }
      const p = cha.get(u);
      if (!p) break;
      // đi dọc cạnh lên cha
      const e = canh[p.k];
      let dau = S, d = 0;
      if (dau + e.L <= lim) { dongGop.set(u, dau + e.L); continue; }
      d = Math.max(0, lim - dau);
      datCua(p.k, u, d);
      let con2 = e.L - d;
      while (con2 > lim) { d += lim; datCua(p.k, u, d); con2 -= lim; }
      dongGop.set(u, con2);
    }
  }
  // dời cửa tránh cửa căn / cửa thang (dọc cạnh, trong phạm vi dự phòng)
  return cua.map(({ e: k, t }) => {
    const e = canh[k];
    const gan = tranh.map((p) => {
      const v: Diem = [e.p1[0] - e.p0[0], e.p1[1] - e.p0[1]];
      const s = ((p[0] - e.p0[0]) * v[0] + (p[1] - e.p0[1]) * v[1]) / (e.L * e.L);
      const q = diemTren(e, Math.max(0, Math.min(1, s)));
      return Math.hypot(p[0] - q[0], p[1] - q[1]) < 3000 ? s * e.L : null;
    }).filter((x): x is number => x !== null);
    const x0 = t * e.L;
    const tot = (x: number) => gan.every((g) => Math.abs(g - x) >= TRANH);
    let x = x0;
    if (!tot(x0)) {
      for (let dx = 100; dx <= DU_PHONG; dx += 100) {
        if (x0 + dx <= e.L - 300 && tot(x0 + dx)) { x = x0 + dx; break; }
        if (x0 - dx >= 300 && tot(x0 - dx)) { x = x0 - dx; break; }
      }
    }
    return { e: k, t: x / e.L, p: diemTren(e, x / e.L), huong: e.huong };
  });
}
