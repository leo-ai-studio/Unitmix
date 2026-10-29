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
  | { loai: 'can'; id: string; tang: number | null; canId: string; no: number }
  /**
   * Khối đế. Toàn dự án: `id` = lô, `toaIds` = các tòa chung khối đế đó (bấm → tòa gần điểm chạm, `toaGanDiem`).
   * Công trình: khối đế của tòa đang xem (`DE_TOA`, `toaIds` rỗng).
   */
  | { loai: 'de'; id: string; toaIds: string[] };
/** Đang chọn (đi qua state chọn của 2D trong `man/SoanThao.tsx`); `tang` / `canKhoa` / `de` chỉ dùng ở 3D Công trình. */
export type DangChon3D = { toaId: string | null; loId: string | null; tang?: number | null; canKhoa?: string | null; de?: boolean };

type CoCha = { userData?: Record<string, unknown>; parent?: CoCha | null };
const LOAI = new Set(['toa', 'lo', 'tang', 'can', 'de']);

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

/** Tòa trên khối đế: id + chân (m, toạ độ bản vẽ — đã nới theo `deOffset` như khối đế vẽ). */
export type ToaTrenDe = { id: string; loId: string; chan: Diem[] };

/** Điểm chạm (m, bản vẽ) trên khối đế chung nhiều tòa → tòa có chân đế chứa điểm, không thì tòa có chân gần nhất. */
export function toaGanDiem(ds: ToaTrenDe[], p: Diem): ToaTrenDe | null {
  let tot: ToaTrenDe | null = null, dTot = Infinity;
  for (const x of ds) {
    if (x.chan.length < 3) continue;
    if (trongDaGiac(p, x.chan)) return x;
    const d = cachBien(p, x.chan);
    if (d < dTot) { dTot = d; tot = x; }
  }
  return tot;
}

/**
 * Danh sách giao điểm (gần trước) → đối tượng chọn được đầu tiên; không trúng gì chọn được = bấm nền.
 * Trúng khối đế (Toàn dự án): ra tòa đứng trên phần đế ở điểm chạm (`userData.deToa`); khối đế không có tòa thì ra lô.
 */
export function doiTuongTrung(ds: { object: CoCha; point?: { x: number; z: number } }[]): DoiTuong3D | null {
  for (const g of ds) {
    const d = doiTuongCua(g.object);
    if (!d) continue;
    if (d.loai !== 'de' || !d.toaIds.length) return d;
    const tren = deToaCua(g.object), x = g.point && tren ? toaGanDiem(tren, [g.point.x, -g.point.z]) : null;
    return x ? { loai: 'toa', id: x.id, loId: x.loId } : { loai: 'lo', id: d.id };
  }
  return null;
}
function deToaCua(o: CoCha | null | undefined): ToaTrenDe[] | null {
  for (let v = o; v; v = v.parent ?? null) { const x = v.userData?.deToa as ToaTrenDe[] | undefined; if (x) return x; }
  return null;
}

/** Rê chuột trúng `ro`: đối tượng `d` có tô nhạt không (khối đế tô theo tòa đang rê trên nó). */
export function trungRo(d: DoiTuong3D, ro: DoiTuong3D | null): boolean {
  if (!ro) return false;
  if (d.loai === 'de' && ro.loai === 'toa') return d.toaIds.includes(ro.id);
  return ro.loai === d.loai && ro.id === d.id;
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
  if (d.loai === 'de') return d.toaIds.length === 1 ? { toaId: d.toaIds[0], loId: d.id } : { toaId: null, loId: d.id };
  return d.loai === 'toa' ? { toaId: d.id, loId: d.loId } : { toaId: null, loId: d.id };
}

/** Đối tượng này có đang chọn (tô viền) không. Lô chỉ tô khi không có tòa nào đang chọn, tránh hai lớp nhấn chồng nhau. */
export function dangChon(d: DoiTuong3D, c: DangChon3D): boolean {
  if (d.loai === 'toa') return d.id === c.toaId;
  if (d.loai === 'lo') return !c.toaId && d.id === c.loId;
  // khối đế: Toàn dự án tô khi một tòa trên nó đang chọn; Công trình (không danh sách tòa) theo cờ `de`
  if (d.loai === 'de') return d.toaIds.length ? !!c.toaId && d.toaIds.includes(c.toaId) : !!c.de;
  if (d.loai === 'tang') return !c.de && !c.canKhoa && (c.tang ?? null) === d.tang;
  return d.id === c.canKhoa && (c.tang ?? null) === d.tang;
}

/**
 * Bấm trong 3D Công trình → căn / tầng chọn mới: căn → ô + tầng của nó; tầng → tầng, bỏ căn; khối đế → `de` (chọn tòa, bỏ căn /
 * tầng); nền → bỏ cả hai (về bố cục chung).
 */
export function chonSauBamToa(d: DoiTuong3D | null): { canKhoa: string | null; tang: number | null; de: boolean } {
  if (d?.loai === 'can') return { canKhoa: d.id, tang: d.tang, de: false };
  if (d?.loai === 'tang') return { canKhoa: null, tang: d.tang, de: false };
  return { canKhoa: null, tang: null, de: d?.loai === 'de' };
}

// ---------- dò tia trong 3D Công trình (thuần, không cần WebGL) ----------

type Diem = [number, number];
type V3 = [number, number, number];
/**
 * Căn trên một tầng: khoá ô, mẫu đang dùng, số CH-xx, 4 góc ô (mm, toạ độ bản vẽ); `hinh` = hình bao thật của căn góc V / chữ L
 * (`CanMau.khung` đặt vào ô — `matBang.khungTaiO`), căn chữ nhật không có thì dùng `goc`.
 */
export type CanChon = { khoa: string; canId: string; no: number; goc: Diem[]; hinh?: Diem[] };
/** Hình căn dùng để dò / tô: hình bao thật nếu có, không thì ô chữ nhật. */
export const hinhCan = (c: { goc: Diem[]; hinh?: Diem[] }): Diem[] => (c.hinh && c.hinh.length >= 3 ? c.hinh : c.goc);
/**
 * Bản đồ chọn của một tòa (đơn vị mét, toạ độ bản vẽ x, y; cao = Y three, mặt bằng three Z = −y): chân tháp, cao độ tầng điển hình,
 * căn của từng tầng (theo mặt bằng / bố cục của tầng đó — cùng khoá ô với màn Tầng). `chanTang` = nét bao của chính tầng đó (mặt bằng
 * tự chỉnh / tầng riêng có thể khác chân tháp), `chanDe` = chân khối đế; thiếu thì lấy `chan`.
 */
export type BanDoChonToa = {
  chan: Diem[]; hDe: number; caoTang: number; nDH: number; canTang: (tang: number) => CanChon[]; canChung: () => CanChon[];
  chanTang?: (tang: number) => Diem[]; chanDe?: Diem[];
};
const chanCua = (bd: BanDoChonToa, tang: number): Diem[] => { const c = bd.chanTang?.(tang); return c && c.length >= 3 ? c : bd.chan; };

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

/**
 * Căn chứa điểm (mm) theo hình thật (`hinhCan`: căn góc V / chữ L theo khung, không theo ô bao); không căn nào chứa thì căn gần nhất
 * trong `dungSai` mm (tường ngoài nhô khỏi khung căn), không thì null.
 */
export function canTaiDiem<C extends { goc: Diem[]; hinh?: Diem[] }>(ds: C[], p: Diem, dungSai = 350): C | null {
  let tot: C | null = null, dTot = dungSai;
  for (const c of ds) {
    const P = hinhCan(c);
    if (trongDaGiac(p, P)) return c;
    const d = cachBien(p, P);
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

/** Đối tượng khối đế của 3D Công trình (một tòa). */
export const DE_TOA: DoiTuong3D = { loai: 'de', id: 'de', toaIds: [] };

/**
 * Bấm / rê trong 3D Công trình: tia → căn (hoặc tầng nếu trúng lõi / hành lang / sàn) của tầng điển hình đầu tiên tia chạm, hoặc
 * khối đế (`DE_TOA`) nếu khối đế che trước. Mỗi tầng dò theo nét bao của chính nó (`chanTang`: tầng tự chỉnh / tầng riêng bớt căn
 * thì tia đi qua chỗ trống tới tầng / căn phía sau); căn theo hình thật (căn góc V / chữ L không chiếm chỗ căn bên cạnh bằng ô bao).
 * `catY` = cao độ mặt cắt ngang (m): phần trên mặt cắt đã ẩn nên tia đi qua.
 * Điểm chạm lùi vào trong 0,15 m theo tia để trúng mặt tường ngoài vẫn ra căn sau tường.
 */
export function chonTiaToa(bd: BanDoChonToa, o: V3, d: V3, catY = Infinity): DoiTuong3D | null {
  const L = Math.hypot(d[0], d[1], d[2]) || 1, u: V3 = [d[0] / L, d[1] / L, d[2] / L];
  let tThan = Infinity, tang = 0;
  for (let k = 1; k <= bd.nDH; k++) {
    const y0 = bd.hDe + (k - 1) * bd.caoTang, y1 = Math.min(y0 + bd.caoTang, catY);
    if (y1 <= y0) break;
    const t = tiaVaoLangTru(o, u, chanCua(bd, k), y0, y1);
    if (t < tThan - 1e-9) { tThan = t; tang = k; }
  }
  const tDe = bd.hDe > 0 && catY > 0 ? tiaVaoLangTru(o, u, bd.chanDe ?? bd.chan, 0, Math.min(bd.hDe, catY)) : Infinity;
  if (tDe < tThan - 1e-6) return DE_TOA;
  if (!tang) return null;
  const t = tThan + 0.15, p: V3 = [o[0] + u[0] * t, o[1] + u[1] * t, o[2] + u[2] * t];
  const c = canTaiDiem(bd.canTang(tang), [p[0] * 1000, -p[2] * 1000]);
  return c ? { loai: 'can', id: c.khoa, tang, canId: c.canId, no: c.no } : { loai: 'tang', id: `t${tang}`, tang };
}

/**
 * Hình tô nhấn của đối tượng Công trình: chân (mét, bản vẽ) + cao độ đáy / đỉnh; `theTich` = khối thể tích (Khung3D chỉ tô các mặt
 * nhìn thấy nằm trong khối, theo chiều sâu — không xuyên vật che). Căn tầng null = cả cột căn mọi tầng; căn góc V / chữ L theo hình thật.
 */
export function hinhNhanToa(bd: BanDoChonToa, d: DoiTuong3D, caoThongThuy: number): { chan: Diem[]; y0: number; y1: number; theTich: true } | null {
  if (d.loai === 'de') return bd.hDe > 0 ? { chan: bd.chanDe ?? bd.chan, y0: 0, y1: bd.hDe, theTich: true } : null;
  if (d.loai === 'tang') {
    const y0 = bd.hDe + (d.tang - 1) * bd.caoTang;
    return { chan: chanCua(bd, d.tang), y0, y1: y0 + bd.caoTang, theTich: true };
  }
  if (d.loai !== 'can') return null;
  const c = (d.tang ? bd.canTang(d.tang) : bd.canChung()).find((x) => x.khoa === d.id);
  if (!c) return null;
  const chan = hinhCan(c).map((q): Diem => [q[0] / 1000, q[1] / 1000]);
  if (d.tang === null) return { chan, y0: bd.hDe, y1: bd.hDe + bd.nDH * bd.caoTang, theTich: true };
  const y0 = bd.hDe + (d.tang - 1) * bd.caoTang;
  return { chan, y0, y1: y0 + caoThongThuy, theTich: true };
}

/** Đối tượng Công trình ứng với state chọn: khối đế, căn (tầng đang xem hoặc cột căn bố cục chung) hoặc tầng; không có → null. */
export function doiTuongDangChonToa(bd: BanDoChonToa, c: DangChon3D): DoiTuong3D | null {
  if (c.de) return bd.hDe > 0 ? DE_TOA : null;
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
