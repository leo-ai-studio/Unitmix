/**
 * KÉO / ĐẨY TỪNG MẶT KHỐI ĐẾ (như Forma push-pull): dời cạnh i của vòng ngoài một đoạn δ theo pháp tuyến ngoài, hai đỉnh kề được tính lại
 * bằng giao điểm với cạnh trước / sau (cạnh kề song song thì thêm một bậc vuông góc). Kết quả luôn được làm sạch bằng phép hợp (tự cắt → gỡ).
 * Hàm thuần, toạ độ mét như TMB. δ > 0 = đẩy ra ngoài, δ < 0 = kéo vào.
 */
import { dtCoDau, hopVung } from './hinhHoc';
import type { Diem } from './kieu';

export type CanhDe = { vong: number; i: number; a: Diem; b: Diem; ra: Diem; dai: number };
const CANH_NGAN_NHAT = 0.5; // m — cạnh ngắn hơn không đưa tay nắm

/** Các cạnh kéo được: chỉ vòng ngoài (diện tích dương). Pháp tuyến ngoài của vòng ngược chiều kim đồng hồ là (dy, −dx). */
export function cacCanhDe(vung: Diem[][]): CanhDe[] {
  const kq: CanhDe[] = [];
  vung.forEach((r, vong) => {
    if (r.length < 3 || dtCoDau(r) <= 0) return;
    for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length], dx = b[0] - a[0], dy = b[1] - a[1], dai = Math.hypot(dx, dy);
      if (dai >= CANH_NGAN_NHAT) kq.push({ vong, i, a, b, ra: [dy / dai, -dx / dai], dai });
    }
  });
  return kq;
}

type Duong = { p: Diem; d: Diem };
const cat = (u: Duong, v: Duong): Diem | null => {
  const m = u.d[0] * v.d[1] - u.d[1] * v.d[0];
  if (Math.abs(m) < 1e-9 * Math.hypot(...u.d) * Math.hypot(...v.d)) return null;
  const t = ((v.p[0] - u.p[0]) * v.d[1] - (v.p[1] - u.p[1]) * v.d[0]) / m;
  return [u.p[0] + t * u.d[0], u.p[1] + t * u.d[1]];
};
const GIOI_HAN_DINH = 250; // m — đỉnh nhọn bắn quá xa thì dùng dời thẳng

export function keoCanh(vung: Diem[][], vong: number, i: number, delta: number): Diem[][] {
  const r = vung[vong];
  if (!r || r.length < 3 || Math.abs(delta) < 1e-9 || dtCoDau(r) <= 0) return vung;
  const n = r.length, a = r[i], b = r[(i + 1) % n];
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  if (L < 1e-9) return vung;
  const nr: Diem = [dy / L, -dx / L], dich: Diem = [nr[0] * delta, nr[1] * delta];
  const duongMoi: Duong = { p: [a[0] + dich[0], a[1] + dich[1]], d: [dx, dy] };
  const truoc = r[(i - 1 + n) % n], sau = r[(i + 2) % n];
  const dTruoc: Duong = { p: truoc, d: [a[0] - truoc[0], a[1] - truoc[1]] }, dSau: Duong = { p: b, d: [sau[0] - b[0], sau[1] - b[1]] };
  const xa = (p: Diem | null, goc: Diem) => (p && Math.hypot(p[0] - goc[0], p[1] - goc[1]) <= GIOI_HAN_DINH + Math.abs(delta) ? p : null);
  const a2 = xa(cat(dTruoc, duongMoi), a), b2 = xa(cat(duongMoi, dSau), b);
  const ring: Diem[] = [];
  r.forEach((p, k) => {
    if (k === i) {
      if (a2) ring.push(a2); else ring.push(p, [p[0] + dich[0], p[1] + dich[1]]);       // cạnh kề song song: thêm bậc
    } else if (k === (i + 1) % n) {
      if (b2) ring.push(b2); else ring.push([p[0] + dich[0], p[1] + dich[1]], p);
    } else ring.push(p);
  });
  const ra = vung.map((x, k) => (k === vong ? ring : x));
  return hopVung(ra).map((x) => x.map(([px, py]) => [+px.toFixed(3), +py.toFixed(3)] as Diem));
}
