/**
 * STRETCH mẫu căn qua phòng khách như lệnh STRETCH của CAD (DC-04 · QT-81 app cũ `stDangKy`).
 * Mỗi mức kéo là một MÃ BIẾN THỂ `<id>~s+300` đăng ký vào thư viện như một mẫu căn thật, nên đếm căn, DT, bản vẽ, lưu/mở
 * đi qua đúng một chỗ. Hình: đỉnh có x > x_cắt dời st, bên trái đứng yên; nét thuộc block (`cung`) dời cứng theo điểm chèn
 * (1 = dời, 0 = đứng). DT TT += st·sau_tt, DT tim += st·sau_tim. Đường cắt do scripts/boc_stretch.py (app cũ) dò từ CAD.
 */
import type { CanMau, Diem, Phong, ThuVien } from './kieu';
import { canDangDung, congNangTai, doanCan, donKhit, viTriCan, type BoCuc, type NetVe, type ToaCoMat } from './matBang';

/** Bước và giới hạn kéo (mm) — DC-04 trong quy_tac.json (bước 100 · tối đa ±500). */
export const ST_BUOC = 100;
export const ST_MAX = 500;

export const tachMa = (id: string): { goc: string; st: number } => {
  const m = /^(.*)~s([+-]\d+)$/.exec(id);
  return m ? { goc: m[1], st: Number(m[2]) } : { goc: id, st: 0 };
};
export const maBienThe = (goc: string, st: number): string => (st ? `${goc}~s${st > 0 ? '+' : ''}${st}` : goc);
export const laBienThe = (id: string): boolean => tachMa(id).st !== 0;
/** Id tệp hình học trong /lib/can/: biến thể dùng tệp của mẫu gốc. */
export const idTepCan = (id: string): string => tachMa(id).goc;

const tron2 = (v: number) => Math.round(v * 100) / 100;
const dtDG = (P: Diem[]) => Math.abs(P.reduce((a, p, i) => { const q = P[(i + 1) % P.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;

/** Mẫu căn biến thể (null khi mẫu không kéo được hoặc mức kéo sai luật). */
export function bienThe(goc: CanMau, st: number): CanMau | null {
  const K = goc.stretch;
  if (!K || !st || Math.abs(st) > ST_MAX || st % ST_BUOC) return null;
  const F = goc.rong_mm, F2 = F + st, xc = K.x_mm;
  const mx = (X: number) => (X > xc ? X + st : X);
  return {
    ...goc,
    id: maBienThe(goc.id, st),
    ma_goc: maBienThe(goc.ma_goc, st),
    rong_mm: F2,
    ten_vi: `${goc.ten_vi} · ${st > 0 ? '+' : ''}${st}`,
    ten_en: `${goc.ten_en} · ${st > 0 ? '+' : ''}${st}`,
    dt_tt_m2: tron2(goc.dt_tt_m2 + (st * K.sau_tt_mm) / 1e6),
    dt_tim_m2: tron2(goc.dt_tim_m2 + (st * K.sau_tim_mm) / 1e6),
    logia_lui: goc.logia_lui ? goc.logia_lui.map((z) => [mx(z[0] * F) / F2, mx(z[1] * F) / F2, ...z.slice(2)]) : goc.logia_lui,
    phong: goc.phong?.map((p): Phong => {
      const ranh = p.ranh.map(([x, y]): Diem => [mx(x), y]);
      return { ...p, ranh, dt_m2: tron2(dtDG(ranh) / 1e6) };
    }),
    cua_cuu_nan: goc.cua_cuu_nan,
    stretch: undefined,
    stretchGoc: { id: goc.id, st },
  };
}

/** Thêm mọi biến thể ±100…±500 của các mẫu có đường cắt vào thư viện (một lần; gọi lại không thêm trùng). */
export function themBienThe(tv: ThuVien): ThuVien {
  for (const c of [...tv.can.values()]) {
    if (!c.stretch) continue;
    for (let st = -ST_MAX; st <= ST_MAX; st += ST_BUOC) {
      const b = st ? bienThe(c, st) : null;
      if (b && !tv.can.has(b.id)) tv.can.set(b.id, b);
    }
  }
  return tv;
}

/** Nét vẽ biến thể (toạ độ chuẩn hoá theo bề rộng mới) từ nét mẫu gốc — đúng luật lệnh STRETCH. */
export function veBienThe(ve: NetVe[], goc: CanMau, st: number): NetVe[] {
  const K = goc.stretch;
  if (!K || !st) return ve;
  const F = goc.rong_mm, F2 = F + st, xc = K.x_mm;
  const cung = new Map(K.cung.map(([i, d]) => [i, d]));
  const mx = (X: number, d: number | undefined) => (d === 1 ? X + st : d === 0 ? X : X > xc ? X + st : X);
  return ve.map((n, i) => ({ cat: n.cat, pts: n.pts.map(([x, y]): Diem => [mx(x * F, cung.get(i)) / F2, y]) }));
}

/** Nét vẽ của một id căn bất kỳ (gốc hoặc biến thể), từ nét tệp gốc. */
export function veTheoId(id: string, veGoc: NetVe[], tv: ThuVien): NetVe[] {
  const { goc, st } = tachMa(id);
  const g = tv.can.get(goc);
  return st && g ? veBienThe(veGoc, g, st) : veGoc;
}

// ---- STRETCH tay từng căn (DC-04 · QT-81): kéo một căn ±100 mm, căn kề co / giãn bù để dãy khít ----

/** Lý do không kéo được (khoá i18n `st.loi.<lyDo>`). */
export type LyDoStretch = 'khongPhaiCan' | 'khongKeoDuoc' | 'vuotGioiHan' | 'daiRa' | 'khongBu' | 'khongKhit';
export type KetQuaStretchTay =
  | { ok: true; doi: [string, string][]; mm: number }
  | { ok: false; lyDo: LyDoStretch; chiTiet?: string };

/**
 * Kéo căn tại vị trí `khoa` thêm `d` mm (±ST_BUOC, tổng ≤ ±ST_MAX). Luật "dồn khít" XC-04: tổng bề ngang của đoạn (giữa hai mốc
 * lõi / thang / khe) không đổi, nên căn kề trong cùng đoạn STRETCH được bù ngược `-d` (gần nhất trước). Không có căn bù thì chặn:
 * dãy dài ra / ngắn lại ở đầu tự do (QT-69 app cũ) cần dời nét bao và DTXD của mẫu tòa — app này giữ nét bao cố định theo mẫu tòa.
 * Trả danh sách [khoá vị trí, id căn mới] cho `doiCanTaiViTri` / `doiCanTheoTang`; không đụng vào bố cục.
 */
export function stretchTay(mau: ToaCoMat, bc: BoCuc, tv: ThuVien, khoa: string, d: number): KetQuaStretchTay {
  const vts = viTriCan(mau, tv);
  const i0 = vts.findIndex((v) => v.khoa === khoa);
  if (i0 < 0 || congNangTai(khoa, bc) !== 'can') return { ok: false, lyDo: 'khongPhaiCan' };
  if (!d || d % ST_BUOC) return { ok: false, lyDo: 'khongKeoDuoc' };
  const hien = vts.map((v) => canDangDung(v, bc));
  const keo = (i: number, dd: number): { id: string; st: number } | 'khongKeoDuoc' | 'vuot' => {
    const { goc, st } = tachMa(hien[i]), g = tv.can.get(goc);
    if (!g?.stretch) return 'khongKeoDuoc';
    const st2 = st + dd;
    if (Math.abs(st2) > ST_MAX) return 'vuot';
    const id = maBienThe(goc, st2);
    return tv.can.has(id) ? { id, st: st2 } : 'khongKeoDuoc';
  };
  const a = keo(i0, d);
  if (a === 'khongKeoDuoc') return { ok: false, lyDo: 'khongKeoDuoc' };
  if (a === 'vuot') return { ok: false, lyDo: 'vuotGioiHan', chiTiet: `±${ST_MAX}` };
  // căn bù: cùng đoạn dồn khít, ô căn hộ, kéo ngược được; gần nhất trước (trái rồi phải khi bằng nhau)
  const dn = doanCan(vts).find((o) => o.ds.includes(i0));
  const thuTu = dn ? dn.ds.slice().sort((x, y) => Math.abs(dn.ds.indexOf(x) - dn.ds.indexOf(i0)) - Math.abs(dn.ds.indexOf(y) - dn.ds.indexOf(i0)) || x - y).filter((i) => i !== i0) : [];
  if (!thuTu.length) return { ok: false, lyDo: 'daiRa' };
  let khongBu = true;
  for (const j of thuTu) {
    if (congNangTai(vts[j].khoa, bc) !== 'can') continue;
    const b = keo(j, -d);
    if (typeof b === 'string') continue;
    khongBu = false;
    const canViTri = { ...(bc.canViTri ?? {}), [vts[i0].khoa]: a.id, [vts[j].khoa]: b.id };
    const kq = donKhit(mau, vts, { canTheo: bc.canTheo, canViTri }, tv);
    const truoc = donKhit(mau, vts, bc, tv);
    if (kq.lech.length > truoc.lech.length || kq.de.length > truoc.de.length) continue;
    return { ok: true, doi: [[vts[i0].khoa, a.id], [vts[j].khoa, b.id]], mm: d };
  }
  return { ok: false, lyDo: khongBu ? 'khongBu' : 'khongKhit' };
}
