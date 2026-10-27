import { hopDienTich } from './hinhHoc';
import type { Diem } from './kieu';

/** Phần mẫu tòa cần để đo hành lang (toa.json). Toạ độ mm. */
export type ToaHanhLang = {
  hanh_lang_mm: number;
  hanhlang_ve?: Diem[][];
  truc?: { goc_deg: number; a_dau: number; a_cuoi: number; b_mm: number }[];
};

/** Hình chữ nhật dày `rong` quanh đoạn p0→p1 (mm), đổi sang mét. */
function dai(p0: Diem, p1: Diem, rong: number): Diem[] | null {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy);
  if (L < 1) return null;
  const nx = (-dy / L) * (rong / 2), ny = (dx / L) * (rong / 2);
  return [[p0[0] + nx, p0[1] + ny], [p1[0] + nx, p1[1] + ny], [p1[0] - nx, p1[1] - ny], [p0[0] - nx, p0[1] - ny]].map(([x, y]): Diem => [x / 1000, y / 1000]);
}

/**
 * DT hành lang của một tầng (m²): hợp các dải bề rộng `hanh_lang_mm` quanh nét hành lang vẽ tay (không cộng trùng chỗ nét chồng nhau).
 * Tòa không có nét hành lang thì đo theo trục × bề rộng và đánh dấu `uocTinh`.
 */
export function dtHanhLangTang(toa: ToaHanhLang): { m2: number; uocTinh: boolean } {
  const dai0: Diem[][] = [];
  for (const pl of toa.hanhlang_ve ?? []) for (let k = 1; k < pl.length; k++) { const d = dai(pl[k - 1], pl[k], toa.hanh_lang_mm); if (d) dai0.push(d); }
  let uocTinh = false;
  if (!dai0.length) {
    uocTinh = true;
    for (const t of toa.truc ?? []) {
      const r = (t.goc_deg * Math.PI) / 180, u: Diem = [Math.cos(r), Math.sin(r)], n: Diem = [-u[1], u[0]];
      const pt = (a: number): Diem => [u[0] * a + n[0] * t.b_mm, u[1] * a + n[1] * t.b_mm];
      const d = dai(pt(t.a_dau), pt(t.a_cuoi), toa.hanh_lang_mm);
      if (d) dai0.push(d);
    }
  }
  return { m2: hopDienTich(dai0), uocTinh };
}

/**
 * Chia DT hành lang cho từng loại căn theo tỷ lệ DT tim tường: trả m² phần chung tính cho MỘT căn của mỗi mẫu.
 * Tổng Σ số căn × phần chung = DT hành lang.
 */
export function phanChungPhanBo(dtHanhLang: number, soCan: Record<string, number>, dtCan: Record<string, number>): Record<string, number> {
  const tong = Object.entries(soCan).reduce((a, [id, n]) => a + n * (dtCan[id] ?? 0), 0);
  return Object.fromEntries(Object.keys(soCan).map((id) => [id, tong > 0 ? (dtHanhLang * (dtCan[id] ?? 0)) / tong : 0]));
}
