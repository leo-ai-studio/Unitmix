/**
 * Nguồn bắt điểm đo (tinh/kichThuoc.ts) từ hình của từng màn: Tầng (nét bao, khung căn, ô thang, khung lõi, trục hành lang) và Hầm
 * (ranh lô, ranh hầm, chân tòa, ô đỗ xe, làn, kho, phòng kỹ thuật, lõi, cột). Toạ độ trả về là MÉT, y lên.
 */
import type { Diem } from './kieu';
import { gopNguonBat, nguonBatDaGiac, type Canh, type NguonBat } from './kichThuoc';
import type { ViTriCan } from './matBang';
import type { ToaMB } from './loiThang';

const mm = (P: readonly Diem[]): Diem[] => P.map(([x, y]) => [x / 1000, y / 1000]);

/** Tầng điển hình: mọi toạ độ của `mau` là mm cục bộ của tòa (BanVe vẽ nhóm scale 0,001) → đổi sang mét. */
export function nguonBatTang(mau: Pick<ToaMB, 'mat' | 'duong_bao' | 'hanh_lang'>, vts: readonly ViTriCan[], loi: readonly (readonly Diem[])[]): NguonBat {
  const o: Diem[][] = [];
  for (const v of vts) if (v.goc?.length === 4) o.push(mm(v.goc));
  for (const f of mau.mat ?? []) {
    const r = (f.goc_deg * Math.PI) / 180, u: Diem = [Math.cos(r), Math.sin(r)], n: Diem = [-u[1], u[0]];
    const pt = (a: number, b: number): Diem => [u[0] * a + n[0] * (f.truc_mm + b), u[1] * a + n[1] * (f.truc_mm + b)];
    for (const q of f.phan_tu) if (q.loai === 'thang_bo' && q.rong_mm > 0) o.push(mm([pt(q.a0, 0), pt(q.a1, 0), pt(q.a1, q.sau_mm ?? 8500), pt(q.a0, q.sau_mm ?? 8500)]));
  }
  const dai = nguonBatDaGiac(mm(mau.duong_bao), ...o, ...loi.map((P) => mm(P)));
  // trục hành lang: đoạn thẳng (đầu mút bắt như đỉnh)
  const truc: Canh[] = (mau.hanh_lang ?? []).map((s) => [[s.p0[0] / 1000, s.p0[1] / 1000], [s.p1[0] / 1000, s.p1[1] / 1000]] as Canh);
  return gopNguonBat(dai, { dinh: truc.flatMap(([a, b]) => [a, b]), canh: truc });
}

/** Hầm: các đa giác (m) của tầng đang xem + ranh lô / hầm / chân tòa. */
export function nguonBatHam(...ds: (readonly (readonly Diem[])[] | readonly Diem[] | null | undefined)[]): NguonBat {
  const P: (readonly Diem[])[] = [];
  for (const d of ds) {
    if (!d || !d.length) continue;
    if (typeof (d as readonly Diem[])[0][0] === 'number') P.push(d as readonly Diem[]);
    else P.push(...(d as readonly (readonly Diem[])[]));
  }
  return nguonBatDaGiac(...P);
}
