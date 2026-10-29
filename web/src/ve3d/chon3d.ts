/**
 * Chọn tòa / lô trong 3D (phần tính thuần, không cần WebGL): đối tượng 3D → id tòa / lô, phân biệt bấm với kéo xoay camera,
 * bấm đúp (chuột hoặc chạm hai lần), ngưỡng LOD chi tiết / dải cửa.
 */

/**
 * Đối tượng chọn được. Toàn dự án: tòa / lô (gắn ở `userData.chon` của mesh khi dựng). Công trình (một tòa): tầng điển hình
 * (`tang` 1…n) hoặc căn (`id` = khoá ô trên mặt bằng tầng, `tang` null = cột căn của bố cục chung), dò bằng tia (`chonTiaToa`).
 */
export type DoiTuong3D =
  | { loai: 'toa'; id: string; loId: string }
  | { loai: 'lo'; id: string }
  | { loai: 'tang'; id: string; tang: number }
  | { loai: 'can'; id: string; tang: number | null; canId: string; no: number };
/** Đang chọn (đi qua state chọn của 2D trong `man/SoanThao.tsx`); `tang` / `canKhoa` chỉ dùng ở 3D Công trình. */
export type DangChon3D = { toaId: string | null; loId: string | null; tang?: number | null; canKhoa?: string | null };

type CoCha = { userData?: Record<string, unknown>; parent?: CoCha | null };
const LOAI = new Set(['toa', 'lo', 'tang', 'can']);

/** Tìm `userData.chon` từ đối tượng trúng tia ngược lên các nút cha (mesh con của nhóm tòa vẫn ra đúng tòa). */
export function doiTuongCua(o: CoCha | null | undefined): DoiTuong3D | null {
  for (let v = o; v; v = v.parent ?? null) {
    const c = v.userData?.chon as DoiTuong3D | undefined;
    if (c && LOAI.has(c.loai) && typeof c.id === 'string') return c;
  }
  return null;
}

/** Khoá so sánh hai đối tượng (căn cùng ô khác tầng là hai đối tượng khác nhau). */
export const khoaDoiTuong = (d: DoiTuong3D | null | undefined): string =>
  !d ? '' : d.loai === 'tang' || d.loai === 'can' ? `${d.loai}:${d.id}:${d.tang ?? ''}` : `${d.loai}:${d.id}`;

/** Danh sách giao điểm (gần trước) → đối tượng chọn được đầu tiên; không trúng gì chọn được = bấm nền. */
export function doiTuongTrung(ds: { object: CoCha }[]): DoiTuong3D | null {
  for (const g of ds) { const d = doiTuongCua(g.object); if (d) return d; }
  return null;
}

/** Ngưỡng (px) chuột / ngón tay xê dịch giữa lúc nhấn và nhả mà vẫn tính là bấm; quá ngưỡng = kéo xoay camera. */
export const NGUONG_BAM_PX = { mouse: 5, pen: 6, touch: 12 } as const;
/** Giữ lâu hơn ngưỡng này (ms) thì không tính là bấm (đang giữ để xoay chậm). */
export const BAM_TOI_DA_MS = 700;

export type DiemBam = { x: number; y: number; t: number; kieu?: string };

/** Nhả chuột / nhấc ngón có phải là bấm (không phải kéo) không. */
export function laBam(xuong: DiemBam, len: DiemBam): boolean {
  const k = (xuong.kieu ?? 'mouse') as keyof typeof NGUONG_BAM_PX;
  const nguong = NGUONG_BAM_PX[k] ?? NGUONG_BAM_PX.mouse;
  return Math.hypot(len.x - xuong.x, len.y - xuong.y) <= nguong && len.t - xuong.t <= BAM_TOI_DA_MS;
}

/** Hai lần bấm liền nhau thành bấm đúp: cách ≤ 350 ms, lệch ≤ 24 px (ngón tay khó chạm trùng chỗ). */
export function laBamDup(truoc: DiemBam | null, sau: DiemBam): boolean {
  return !!truoc && sau.t - truoc.t <= 350 && Math.hypot(sau.x - truoc.x, sau.y - truoc.y) <= 24;
}

/** Áp kết quả bấm vào state chọn: bấm tòa → chọn tòa + lô của nó; bấm lô → chọn lô, bỏ tòa; bấm nền → bỏ chọn cả hai. */
export function chonSauBam(d: DoiTuong3D | null): DangChon3D {
  if (!d) return { toaId: null, loId: null };
  return d.loai === 'toa' ? { toaId: d.id, loId: d.loId } : { toaId: null, loId: d.id };
}

/** Đối tượng này có đang chọn (tô viền) không. Lô chỉ tô khi không có tòa nào đang chọn, tránh hai lớp nhấn chồng nhau. */
export function dangChon(d: DoiTuong3D, c: DangChon3D): boolean {
  if (d.loai === 'toa') return d.id === c.toaId;
  if (d.loai === 'lo') return !c.toaId && d.id === c.loId;
  if (d.loai === 'tang') return !c.canKhoa && (c.tang ?? null) === d.tang;
  return d.id === c.canKhoa && (c.tang ?? null) === d.tang;
}

/** Bấm trong 3D Công trình → căn / tầng chọn mới: căn → ô + tầng của nó; tầng → tầng, bỏ căn; nền → bỏ cả hai (về bố cục chung). */
export function chonSauBamToa(d: DoiTuong3D | null): { canKhoa: string | null; tang: number | null } {
  if (d?.loai === 'can') return { canKhoa: d.id, tang: d.tang };
  if (d?.loai === 'tang') return { canKhoa: null, tang: d.tang };
  return { canKhoa: null, tang: null };
}

// ---------- dò tia trong 3D Công trình (thuần, không cần WebGL) ----------

type Diem = [number, number];
type V3 = [number, number, number];
/** Căn trên một tầng: khoá ô, mẫu đang dùng, số CH-xx, 4 góc (mm, toạ độ bản vẽ). */
export type CanChon = { khoa: string; canId: string; no: number; goc: Diem[] };
/**
 * Bản đồ chọn của một tòa (đơn vị mét, toạ độ bản vẽ x, y; cao = Y three, mặt bằng three Z = −y): chân tháp, cao độ tầng điển hình,
 * căn của từng tầng (theo mặt bằng / bố cục của tầng đó — cùng khoá ô với màn Tầng).
 */
export type BanDoChonToa = { chan: Diem[]; hDe: number; caoTang: number; nDH: number; canTang: (tang: number) => CanChon[]; canChung: () => CanChon[] };

/** Điểm trong đa giác (chẵn lẻ). */
export function trongDaGiac(p: Diem, P: Diem[]): boolean {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

/** Khoảng cách điểm → cạnh đa giác. */
function cachBien(p: Diem, P: Diem[]): number {
  let d = Infinity;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
    d = Math.min(d, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy));
  }
  return d;
}

/** Căn chứa điểm (mm); không căn nào chứa thì căn gần nhất trong `dungSai` mm (tường ngoài nhô khỏi khung căn), không thì null. */
export function canTaiDiem<C extends { goc: Diem[] }>(ds: C[], p: Diem, dungSai = 350): C | null {
  let tot: C | null = null, dTot = dungSai;
  for (const c of ds) {
    if (trongDaGiac(p, c.goc)) return c;
    const d = cachBien(p, c.goc);
    if (d < dTot) { dTot = d; tot = c; }
  }
  return tot;
}

/** Tầng điển hình (1…n) ở cao độ y (m); ngoài thân tháp → null. */
export function tangTaiCao(y: number, hDe: number, caoTang: number, nDH: number): number | null {
  if (nDH <= 0 || caoTang <= 0 || y < hDe - 1e-6 || y > hDe + nDH * caoTang + 1e-6) return null;
  return Math.min(nDH, Math.max(1, Math.floor((y - hDe) / caoTang) + 1));
}

/**
 * Tia (gốc `o`, hướng `d`, toạ độ three) vào lăng trụ đứng chân `P` (mét, bản vẽ) từ cao y0 tới y1: tham số t nhỏ nhất > 0 khi tia
 * chạm mặt bên hoặc nắp trên / dưới, không chạm → Infinity.
 */
export function tiaVaoLangTru(o: V3, d: V3, P: Diem[], y0: number, y1: number): number {
  // bản vẽ: x = X, y = −Z
  const ox = o[0], oy = -o[2], dx = d[0], dy = -d[2];
  let tot = Infinity;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], ex = b[0] - a[0], ey = b[1] - a[1];
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((a[0] - ox) * ey - (a[1] - oy) * ex) / den, s = ((a[0] - ox) * dy - (a[1] - oy) * dx) / den;
    if (t <= 1e-6 || s < 0 || s > 1 || t >= tot) continue;
    const y = o[1] + t * d[1];
    if (y >= y0 && y <= y1) tot = t;
  }
  if (Math.abs(d[1]) > 1e-12) for (const yc of [y0, y1]) {
    const t = (yc - o[1]) / d[1];
    if (t > 1e-6 && t < tot && trongDaGiac([ox + t * dx, oy + t * dy], P)) tot = t;
  }
  return tot;
}

/**
 * Bấm / rê trong 3D Công trình: tia → căn (hoặc tầng nếu trúng lõi / hành lang / sàn) của tầng điển hình đầu tiên tia chạm.
 * Khối đế che trước thân tháp thì không chọn gì. `catY` = cao độ mặt cắt ngang (m): phần trên mặt cắt đã ẩn nên tia đi qua.
 * Điểm chạm lùi vào trong 0,15 m theo tia để trúng mặt tường ngoài vẫn ra căn sau tường.
 */
export function chonTiaToa(bd: BanDoChonToa, o: V3, d: V3, catY = Infinity): DoiTuong3D | null {
  const L = Math.hypot(d[0], d[1], d[2]) || 1, u: V3 = [d[0] / L, d[1] / L, d[2] / L];
  const top = Math.min(bd.hDe + bd.nDH * bd.caoTang, catY);
  if (top <= bd.hDe) return null;
  const tThan = tiaVaoLangTru(o, u, bd.chan, bd.hDe, top);
  if (!Number.isFinite(tThan)) return null;
  if (bd.hDe > 0 && tiaVaoLangTru(o, u, bd.chan, 0, Math.min(bd.hDe, catY)) < tThan - 1e-6) return null;
  const t = tThan + 0.15, p: V3 = [o[0] + u[0] * t, o[1] + u[1] * t, o[2] + u[2] * t];
  const tang = tangTaiCao(Math.min(p[1], top - 1e-3), bd.hDe, bd.caoTang, bd.nDH);
  if (!tang) return null;
  const c = canTaiDiem(bd.canTang(tang), [p[0] * 1000, -p[2] * 1000]);
  return c ? { loai: 'can', id: c.khoa, tang, canId: c.canId, no: c.no } : { loai: 'tang', id: `t${tang}`, tang };
}

/** Hình tô nhấn của đối tượng Công trình: chân (mét, bản vẽ) + cao độ đáy / đỉnh. Căn tầng null = cả cột căn mọi tầng. */
export function hinhNhanToa(bd: BanDoChonToa, d: DoiTuong3D, caoThongThuy: number): { chan: Diem[]; y0: number; y1: number; xuyen: true } | null {
  if (d.loai === 'tang') {
    const y0 = bd.hDe + (d.tang - 1) * bd.caoTang;
    return { chan: bd.chan, y0, y1: y0 + bd.caoTang, xuyen: true };
  }
  if (d.loai !== 'can') return null;
  const c = (d.tang ? bd.canTang(d.tang) : bd.canChung()).find((x) => x.khoa === d.id);
  if (!c) return null;
  const chan = c.goc.map((q): Diem => [q[0] / 1000, q[1] / 1000]);
  if (d.tang === null) return { chan, y0: bd.hDe, y1: bd.hDe + bd.nDH * bd.caoTang, xuyen: true };
  const y0 = bd.hDe + (d.tang - 1) * bd.caoTang;
  return { chan, y0, y1: y0 + caoThongThuy, xuyen: true };
}

/** Đối tượng Công trình ứng với state chọn: căn (tầng đang xem hoặc cột căn bố cục chung) hoặc tầng; không có → null. */
export function doiTuongDangChonToa(bd: BanDoChonToa, c: DangChon3D): DoiTuong3D | null {
  const tang = c.tang ?? null;
  if (c.canKhoa) {
    const x = (tang ? bd.canTang(tang) : bd.canChung()).find((q) => q.khoa === c.canKhoa);
    return x ? { loai: 'can', id: x.khoa, tang, canId: x.canId, no: x.no } : null;
  }
  return tang && tang <= bd.nDH ? { loai: 'tang', id: `t${tang}`, tang } : null;
}

/**
 * Khoảng cách camera → tâm tòa (m) từ đó vẽ tầng kiểu dải cửa thay cho từng căn chi tiết.
 * Góc mặc định của khung tòa đứng cách tâm ≈ 2,2 × cỡ cảnh (`gocMacDinh`), nên ngưỡng 4 × cỡ cảnh giữ chi tiết ở mọi góc đề xuất;
 * tối thiểu 120 m để tòa nhỏ không chuyển sớm.
 */
export function nguongLod(coCanh: number): number {
  return Math.max(120, coCanh * 4);
}

/** Mức chi tiết theo khoảng cách: 'gan' = từng căn (cửa, khung, lan can), 'xa' = khối + dải cửa theo tầng. */
export function mucLod(khoangCach: number, coCanh: number): 'gan' | 'xa' {
  return khoangCach < nguongLod(coCanh) ? 'gan' : 'xa';
}
