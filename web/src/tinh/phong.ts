import type { Diem, LoaiPhong, NguongMau, Phong } from './kieu';

/**
 * Mục tiêu từng loại phòng: DT tối thiểu (m²) và kích thước tối thiểu = đường kính vòng tròn nội tiếp lớn nhất (m).
 * Là THAM SỐ: trừ DT phòng ngủ (QCVN 04:2021/BXD, 2.2.4.4: không nhỏ hơn 9 m²), mọi giá trị là mặc định TẠM,
 * chờ chủ nhiệm chốt (`choChot`). null = không đánh giá chỉ tiêu đó.
 */
export type MucTieuPhong = { dtM2: number | null; dMinM: number | null; nguon: string; choChot: boolean };
export const MUC_TIEU_PHONG: Record<LoaiPhong, { dt: MucTieuPhong; d: MucTieuPhong }> = {
  ngu: { dt: { dtM2: 9, dMinM: null, nguon: 'QCVN 04:2021/BXD 2.2.4.4', choChot: false }, d: { dtM2: null, dMinM: 2.4, nguon: 'tạm', choChot: true } },
  khach: { dt: { dtM2: 14, dMinM: null, nguon: 'tạm', choChot: true }, d: { dtM2: null, dMinM: 3, nguon: 'tạm', choChot: true } },
  bep: { dt: { dtM2: 5, dMinM: null, nguon: 'tạm', choChot: true }, d: { dtM2: null, dMinM: 1.5, nguon: 'tạm', choChot: true } },
  wc: { dt: { dtM2: 2.5, dMinM: null, nguon: 'tạm', choChot: true }, d: { dtM2: null, dMinM: 1.2, nguon: 'tạm', choChot: true } },
  khac: { dt: { dtM2: null, dMinM: null, nguon: '—', choChot: true }, d: { dtM2: null, dMinM: null, nguon: '—', choChot: true } },
};

/** Mức đạt so với mục tiêu tối thiểu: xanh = đạt, cam = thiếu trong ngưỡng, đỏ = thiếu quá ngưỡng, null = không có mục tiêu. */
export type MucDat = 'xanh' | 'cam' | 'do';
export function mucDat(giaTri: number, mucTieu: number | null, nguong: number): MucDat | null {
  if (mucTieu === null) return null;
  if (giaTri >= mucTieu - 1e-9) return 'xanh';
  return mucTieu - giaTri <= nguong + 1e-9 ? 'cam' : 'do';
}

/** Đánh giá một phòng theo mục tiêu loại phòng và ngưỡng của PA (`dtCanM2` cho DT, `kichThuocM` cho kích thước). */
export function danhGiaPhong(p: Phong, nguong: Pick<NguongMau, 'dtCanM2' | 'kichThuocM'>, mt = MUC_TIEU_PHONG) {
  const m = mt[p.loai];
  return {
    dt: { muc: mucDat(p.dt_m2, m.dt.dtM2, nguong.dtCanM2), chenh: m.dt.dtM2 === null ? null : p.dt_m2 - m.dt.dtM2 },
    d: { muc: mucDat(p.d_min_m, m.d.dMinM, nguong.kichThuocM), chenh: m.d.dMinM === null ? null : p.d_min_m - m.d.dMinM },
  };
}

/** Loại phòng từ nhãn chữ (khi CAD có tên phòng): "P. NGỦ 1" → ngu, "WC", "VỆ SINH" → wc, "BẾP" → bep, "KHÁCH" → khach. */
export function phanLoaiTen(ten: string): LoaiPhong {
  const s = ten.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toUpperCase();
  if (/\bWC\b|VE SINH|TOILET|BATH/.test(s)) return 'wc';
  if (/NGU\b|BED/.test(s)) return 'ngu';
  if (/KHACH|SINH HOAT|LIVING/.test(s)) return 'khach';
  if (/BEP|KITCHEN|\bAN\b/.test(s)) return 'bep';
  return 'khac';
}

const trong = (p: Diem, P: Diem[]): boolean => {
  let kq = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) kq = !kq;
  }
  return kq;
};

const kcDoan = (p: Diem, a: Diem, b: Diem): number => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};

/** Khoảng cách có dấu từ p tới biên đa giác (dương = bên trong). */
const kcBien = (p: Diem, P: Diem[]): number => {
  let d = Infinity;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) d = Math.min(d, kcDoan(p, P[j], P[i]));
  return trong(p, P) ? d : -d;
};

/**
 * Vòng tròn nội tiếp lớn nhất (cực điểm khó tiếp cận, kiểu polylabel): chia lưới ô vuông, ưu tiên ô có cận trên lớn,
 * dừng khi không ô nào có thể hơn kết quả quá `doChinh` (cùng đơn vị toạ độ).
 */
export function vongNoiTiep(P: Diem[], doChinh = 5): { tam: Diem; r: number } {
  if (P.length < 3) return { tam: P[0] ?? [0, 0], r: 0 };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of P) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const canh = Math.min(x1 - x0, y1 - y0);
  if (canh <= 0) return { tam: [x0, y0], r: 0 };
  type O = { c: Diem; h: number; d: number; max: number };
  const o = (c: Diem, h: number): O => { const d = kcBien(c, P); return { c, h, d, max: d + h * Math.SQRT2 }; };
  const hang: O[] = [];
  for (let x = x0; x < x1; x += canh) for (let y = y0; y < y1; y += canh) hang.push(o([x + canh / 2, y + canh / 2], canh / 2));
  // khởi đầu: trọng tâm đỉnh nếu nằm trong
  let tot = o([(x0 + x1) / 2, (y0 + y1) / 2], 0);
  for (const q of hang) if (q.d > tot.d) tot = q;
  while (hang.length) {
    let k = 0;
    for (let i = 1; i < hang.length; i++) if (hang[i].max > hang[k].max) k = i;
    const q = hang.splice(k, 1)[0];
    if (q.d > tot.d) tot = q;
    if (q.max - tot.d <= doChinh) continue;
    const h = q.h / 2;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) hang.push(o([q.c[0] + dx * h, q.c[1] + dy * h], h));
  }
  return { tam: tot.c, r: Math.max(0, tot.d) };
}
