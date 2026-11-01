/**
 * Khối che của PA cho phân tích nắng / gió: thân tháp + khối đế từng lô, đúng cao độ như 3D Toàn dự án (`ve3d/dungDuAn.ts`):
 * đế từ 0,2 m tới 0,2 + số tầng đế × cao tầng đế; tháp từ đỉnh đế tới + số tầng điển hình × cao tầng.
 */
import { mauToa } from '../canThem';
import { khoiDeLo } from '../deLo';
import { chanToa } from '../hinhHoc';
import type { Diem, ThuVien, TrangThaiPA } from '../kieu';
import type { KhoiLang } from './gioNang';

export function khoiPA(pa: TrangThaiPA, tv: ThuVien): KhoiLang[] {
  const kq: KhoiLang[] = [];
  for (const l of pa.lo) {
    const ts = pa.toa.filter((x) => x.loId === l.id && mauToa(tv, x));
    if (!ts.length) continue;
    const chans = ts.map((x) => chanToa(mauToa(tv, x)!, x));
    const hDe = Math.max(0, ...ts.map((x) => x.soTangDe * x.caoDe));
    if (hDe > 0) for (const p of khoiDeLo(l, chans, ts.map((x) => x.deOffset)).vung) if (p.length >= 3) kq.push({ chan: p, z0: 0, z1: 0.2 + hDe });
    ts.forEach((x, i) => {
      const z0 = 0.2 + x.soTangDe * x.caoDe, h = x.soTangDH * x.caoDH;
      if (h > 0) kq.push({ chan: chans[i], z0, z1: z0 + h });
    });
  }
  return kq;
}

/** Khung bao vùng tính: mọi lô + khối (m). */
export function khungPA(pa: TrangThaiPA, khoi: KhoiLang[]): Diem[] {
  return [...pa.lo.flatMap((l) => l.ranh), ...khoi.flatMap((k) => k.chan)];
}
