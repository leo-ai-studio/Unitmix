import type { ViTriCan } from './matBang';

/** Khung tem căn (mm, thế giới, y lên): kích thước như app cũ, đặt ngoài mặt tiền cách tường TAG_OFF. */
export const TEM_W = 3760;
export const TEM_H = 2600;
export const TEM_CACH = 900;

export type VeTem = { khoa: string; cx: number; cy: number; huong: [number, number]; chan: [number, number] };

const cham = (r: { x0: number; y0: number; x1: number; y1: number }, s: { x0: number; y0: number; x1: number; y1: number }, le = 0) =>
  r.x0 < s.x1 + le && r.x1 > s.x0 - le && r.y0 < s.y1 + le && r.y1 > s.y0 - le;
const khungTem = (cx: number, cy: number) => ({ x0: cx - TEM_W / 2, y0: cy - TEM_H / 2, x1: cx + TEM_W / 2, y1: cy + TEM_H / 2 });
const khungCan = (vt: ViTriCan) => {
  const xs = vt.goc.map((p) => p[0]), ys = vt.goc.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
};

/**
 * Vị trí tem từng căn: giữa mặt tiền, đẩy ra ngoài theo pháp tuyến mặt. Tem chạm tem đã đặt hoặc chạm một căn khác thì
 * đẩy ra ngoài từng bước 400 mm và trượt dọc mặt tới khi hết chạm. `chan` là điểm giữa cạnh ngoài của căn (đầu đường dẫn tem).
 */
export function datTemCan(vts: ViTriCan[]): VeTem[] {
  const khungCans = vts.map(khungCan);
  const kq: VeTem[] = [];
  vts.forEach((vt, i) => {
    const ngoai: [number, number] = [(vt.goc[2][0] + vt.goc[3][0]) / 2, (vt.goc[2][1] + vt.goc[3][1]) / 2];
    const trong: [number, number] = [(vt.goc[0][0] + vt.goc[1][0]) / 2, (vt.goc[0][1] + vt.goc[1][1]) / 2];
    const L = Math.hypot(ngoai[0] - trong[0], ngoai[1] - trong[1]) || 1;
    const huong: [number, number] = [(ngoai[0] - trong[0]) / L, (ngoai[1] - trong[1]) / L];
    const r = (TEM_W / 2) * Math.abs(huong[0]) + (TEM_H / 2) * Math.abs(huong[1]);
    const base = TEM_CACH + r, tan: [number, number] = [-huong[1], huong[0]];
    const va = (cx: number, cy: number) => {
      const k = khungTem(cx, cy);
      return kq.some((t) => cham(k, khungTem(t.cx, t.cy), 120)) || khungCans.some((c, j) => j !== i && cham(k, c, -150));
    };
    // ra ngoài từng bước 400 mm; mỗi bước thử trượt dọc mặt (0, ±600, ±1200…) — hub ba cánh hay kẹt ở góc
    let tot: [number, number] | null = null;
    for (let d = base; d <= base + 5200 && !tot; d += 400) {
      for (let k = 0; k <= 6 && !tot; k++) {
        for (const dau of k === 0 ? [1] : [1, -1]) {
          const s2 = dau * k * 600, x = ngoai[0] + huong[0] * d + tan[0] * s2, y = ngoai[1] + huong[1] * d + tan[1] * s2;
          if (!va(x, y)) { tot = [x, y]; break; }
        }
      }
    }
    const [cx, cy] = tot ?? [ngoai[0] + huong[0] * base, ngoai[1] + huong[1] * base];
    kq.push({ khoa: vt.khoa, cx, cy, huong, chan: ngoai });
  });
  return kq;
}
