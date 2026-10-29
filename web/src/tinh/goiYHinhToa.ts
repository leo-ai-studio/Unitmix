/**
 * Xếp hạng mẫu tòa + GỢI Ý DẠNG TÒA theo yêu cầu bằng lời (lãnh đạo 29/10/2026: "Tạo prompt là với diện tích và unitmix vừa sắp thì
 * các mẫu shape khác gợi ý nên chọn shape nào với tiêu chí prompt. Rồi việc sắp vào TMB là việc khác.").
 *
 * - `phanTichYeuCau(chu)`: bộ đọc theo luật (0 token, không gọi AI) — "ưu tiên hiệu suất > 75%, 2PN 55%, nhiều căn góc, lõi gọn",
 *   "20 căn/tầng", "DT sàn 1.600 m²", "dạng L", "NOXH"… → trọng số tiêu chí + ngưỡng / mục tiêu. Leo AI dùng công cụ
 *   `recommend_tower_shapes` với tham số có cấu trúc (cùng `YeuCauMau`).
 * - `xepHang(ds, yc)`: điểm minh bạch = Σ trọng số × điểm tiêu chí (0–100) ÷ Σ trọng số. Mỗi tiêu chí một thang tuyệt đối ghi ở
 *   `THANG` (không chuẩn hoá theo tập — thêm / bớt mẫu không đổi điểm mẫu khác), trừ "số căn" khi không có mục tiêu (so với mẫu
 *   nhiều căn nhất trong tập). Tiêu chí thiếu số liệu (view chưa tính) không vào mẫu số.
 * - `uuNhuoc(...)`: ưu / nhược từng mẫu (top 3) từ chính điểm tiêu chí, dạng khoá i18n + tham số.
 * Mọi ngưỡng thang là giá trị tạm, chờ chủ nhiệm chốt; hiệu suất mặc định theo MT-03 ≥ 75 % (quy_tac.json `mdi_eff`).
 */
import { LOAI_CAN, type LoaiCan } from './kieu';
import { HIEU_SUAT_MIN } from './kpi';
import type { KetQuaMau } from './soSanhMau';

export type TieuChi = 'hieuSuat' | 'coCau' | 'thoatNan' | 'loiGon' | 'canGoc' | 'soCan' | 'dtSan' | 'view';
export const TIEU_CHI: TieuChi[] = ['hieuSuat', 'coCau', 'thoatNan', 'loiGon', 'canGoc', 'soCan', 'dtSan', 'view'];
/** Trọng số mặc định (0–5). DT sàn chỉ có trọng số khi có mục tiêu; view chờ tinh/huongView.ts. */
export const TRONG_SO_MAC_DINH: Record<TieuChi, number> = { hieuSuat: 3, coCau: 3, thoatNan: 2, loiGon: 1, canGoc: 1, soCan: 1, dtSan: 0, view: 0 };
/** Trọng số khi yêu cầu nhắc tới tiêu chí / khi ghi "ưu tiên". */
export const TS_NHAC = 4;
export const TS_UU_TIEN = 5;

export type YeuCauMau = {
  trongSo: Record<TieuChi, number>;
  /** Hiệu suất tối thiểu (0–1). */
  hsMin: number;
  /** Cơ cấu yêu cầu (một phần, %); ghép với mục tiêu lô bằng `hopCoCau`. */
  coCau: Partial<Record<LoaiCan, number>>;
  soCanTang: number | null;
  /** DTXD 1 sàn mục tiêu (m²). */
  dtSan: number | null;
  /** Lọc dạng hình (i, l, t, u, v, y, z); rỗng = mọi dạng. */
  hinh: string[];
  nhom: 'tm' | 'xh' | null;
  /** Những gì bộ đọc nhận ra (hiện thành chip): khoá i18n + tham số. */
  nhanDien: Nhan[];
};
export type Nhan = { k: string; p?: Record<string, string | number> };

export const yeuCauMacDinh = (): YeuCauMau => ({ trongSo: { ...TRONG_SO_MAC_DINH }, hsMin: HIEU_SUAT_MIN, coCau: {}, soCanTang: null, dtSan: null, hinh: [], nhom: null, nhanDien: [] });

/** Bỏ dấu tiếng Việt, chữ thường, gom khoảng trắng. */
export const boDau = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Số viết kiểu VN / EN: "1.600" và "1,600" (nhóm nghìn) → 1600; "0,75" / "72,5" → thập phân; "75" → 75.
 */
export function docSo(s: string): number {
  const x = s.trim();
  if (/^\d{1,3}(\.\d{3})+$/.test(x)) return Number(x.replace(/\./g, ''));
  if (/^\d{1,3}(,\d{3})+$/.test(x)) return Number(x.replace(/,/g, ''));
  return Number(x.replace(',', '.'));
}

const SO = String.raw`(\d[\d.,]*\d|\d)`;
const LOAI_RE = String.raw`(studio|stu|2\s*pn\s*\+|2\s*pn\s*p\b|2\s*pn\s*plus|2\s*br\s*\+|[123]\s*pn|[123]\s*br|[123]\s*bed(?:room)?s?|[123]\s*phong ngu)`;
function loaiTu(s: string): LoaiCan | null {
  const x = s.replace(/\s+/g, '');
  if (/^(studio|stu)$/.test(x)) return 'stu';
  if (/^2(pn\+|pnp|pnplus|br\+)$/.test(x)) return '2pnp';
  const m = /^([123])/.exec(x);
  return m ? (`${m[1]}pn` as LoaiCan) : null;
}
const TEN_LOAI: Record<LoaiCan, string> = { stu: 'Studio', '1pn': '1PN', '2pn': '2PN', '2pnp': '2PN+', '3pn': '3PN' };

/** Có cụm "ưu tiên / quan trọng / priority" ngay trước vị trí `i` (≤ 24 ký tự, cùng mệnh đề) không. */
const uuTienTruoc = (s: string, i: number) => /(uu tien|quan trong|chu trong|priori|focus|important)[^,;.]{0,24}$/.test(s.slice(Math.max(0, i - 40), i));
const boQuaTruoc = (s: string, i: number) => /(khong can|khong quan tam|bo qua|ignore|don'?t care|no need)[^,;.]{0,16}$/.test(s.slice(Math.max(0, i - 36), i));

/**
 * Đọc yêu cầu bằng lời → trọng số + ngưỡng (luật, 0 token). Nhận cả tiếng Việt có / không dấu và tiếng Anh. Không hiểu thì giữ
 * mặc định. Một tiêu chí được nhắc → trọng số ≥ 4; có "ưu tiên" ngay trước → 5; "không cần / bỏ qua" trước → 0.
 */
export function phanTichYeuCau(chu: string): YeuCauMau {
  const yc = yeuCauMacDinh();
  const s = boDau(chu ?? '');
  if (!s) return yc;
  const nhac = (tc: TieuChi, i: number) => {
    yc.trongSo[tc] = boQuaTruoc(s, i) ? 0 : Math.max(yc.trongSo[tc], uuTienTruoc(s, i) ? TS_UU_TIEN : TS_NHAC);
  };

  // hiệu suất (MT-03): "hiệu suất > 75%", "efficiency ≥ 0.78", "hs 76%"
  const hs = new RegExp(String.raw`(hieu suat|efficiency|\bhs\b)\s*(?:san\s*)?(?:>=|≥|>|tren|toi thieu|it nhat|at least|min(?:imum)?|tu|=|:)?\s*${SO}?\s*(%)?`, 'g');
  for (const m of s.matchAll(hs)) {
    nhac('hieuSuat', m.index!);
    if (m[2]) {
      const v = docSo(m[2]);
      const f = m[3] || v > 1.5 ? v / 100 : v;
      if (f > 0.3 && f < 1) { yc.hsMin = f; yc.nhanDien.push({ k: 'gh.nd.hsMin', p: { n: Math.round(f * 1000) / 10 } }); }
    } else yc.nhanDien.push({ k: 'gh.nd.tc', p: { tc: 'hieuSuat' } });
  }

  // cơ cấu: "2PN 55%", "55% 2PN", "studio: 10 %"
  const daLoai = new Set<LoaiCan>();
  const datLoai = (l: LoaiCan | null, v: number, i: number) => {
    if (!l || !(v >= 0 && v <= 100) || daLoai.has(l)) return;
    daLoai.add(l);
    yc.coCau[l] = v;
    nhac('coCau', i);
    yc.nhanDien.push({ k: 'gh.nd.coCau', p: { l: TEN_LOAI[l], n: v } });
  };
  for (const m of s.matchAll(new RegExp(`${LOAI_RE}\\s*[:=]?\\s*${SO}\\s*%`, 'g'))) datLoai(loaiTu(m[1]), docSo(m[2]), m.index!);
  for (const m of s.matchAll(new RegExp(`${SO}\\s*%\\s*(?:can\\s*|la\\s*)?${LOAI_RE}`, 'g'))) datLoai(loaiTu(m[2]), docSo(m[1]), m.index!);
  if (!daLoai.size) for (const m of s.matchAll(/(co cau|unit ?mix|\bmix\b|ty le can)/g)) { nhac('coCau', m.index!); yc.nhanDien.push({ k: 'gh.nd.tc', p: { tc: 'coCau' } }); break; }

  // số căn / tầng: "20 căn/tầng", "20 căn mỗi tầng", "20 units per floor"; "nhiều căn" (không kèm góc) → nhiều nhất trong tập
  const sc = new RegExp(String.raw`${SO}\s*(?:can|units?|apartments?|ch)\s*(?:\/|tren|moi|mot|per|a|each)\s*(?:1\s*)?(?:tang|san|floor|storey|level)`, 'g');
  for (const m of s.matchAll(sc)) {
    const v = docSo(m[1]);
    if (v >= 2 && v <= 80) { yc.soCanTang = v; nhac('soCan', m.index!); yc.nhanDien.push({ k: 'gh.nd.soCan', p: { n: v } }); }
  }
  if (yc.soCanTang === null) for (const m of s.matchAll(/(nhieu can|toi da (?:so )?can|max(?:imum)? units|more units|many units)(?! goc)/g)) { nhac('soCan', m.index!); yc.nhanDien.push({ k: 'gh.nd.tc', p: { tc: 'soCan' } }); break; }

  // DT sàn 1 tầng: "DT sàn 1.600 m²", "diện tích xây dựng ~1600m2", "floor area 1,600 m2", "1600 m2/sàn"
  const dt1 = new RegExp(String.raw`(?:dt|dien tich|floor ?(?:plate|area)|footprint|gfa)\s*(?:san|xay dung|xd|1 san|mot san|tang|typical)?\s*(?:khoang|tam|chung|~|≈|=|:|la|about|around)?\s*${SO}\s*(?:m2|m²|m\b)`, 'g');
  const dt2 = new RegExp(String.raw`${SO}\s*(?:m2|m²)\s*(?:\/\s*san|\/\s*tang|moi san|mot san|1 san|san|per floor)`, 'g');
  for (const m of [...s.matchAll(dt1), ...s.matchAll(dt2)]) {
    const v = docSo(m[1]);
    if (v >= 300 && v <= 6000 && yc.dtSan === null) { yc.dtSan = v; nhac('dtSan', m.index!); yc.nhanDien.push({ k: 'gh.nd.dtSan', p: { n: v } }); }
  }

  const tu = (re: RegExp, tc: TieuChi) => { for (const m of s.matchAll(re)) { nhac(tc, m.index!); yc.nhanDien.push({ k: 'gh.nd.tc', p: { tc } }); return; } };
  tu(/(can goc|corner units?|corner apartments?|goc nhieu)/g, 'canGoc');
  tu(/(loi gon|loi nho|loi (?:it|toi gian)|it thang|compact core|small core|core efficien)/g, 'loiGon');
  tu(/(thoat nan|pccc|an toan chay|cu ly|escape|fire safety|egress)/g, 'thoatNan');
  tu(/(\bview\b|tam nhin|huong nhin|outlook)/g, 'view');

  // dạng hình: "dạng L", "chữ U", "shape T", "L1 L2 L3", "kiểu Z"
  const hinh = new Set<string>();
  // chữ dạng phải viết HOA ở câu gốc ("dạng L") để "chú ý" không thành dạng Y; "L1 L2" / "l1" nhận cả chữ thường
  const goc = (chu ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd');
  for (const m of goc.matchAll(/(?:dang|chu|hinh|kieu|shape|form|type|loai)\s+([ILTUVYZ])(?![A-Za-z])/gi)) if (/[ILTUVYZ]/.test(m[1])) hinh.add(m[1].toLowerCase());
  for (const m of s.matchAll(/\b([iltuvyz])\s?([1-9])\b/g)) hinh.add(m[1]);
  yc.hinh = [...hinh].sort();
  if (yc.hinh.length) yc.nhanDien.push({ k: 'gh.nd.hinh', p: { h: yc.hinh.map((x) => x.toUpperCase()).join(', ') } });

  if (/(xa hoi|noxh|\bxh\b|social housing|affordable)/.test(s)) yc.nhom = 'xh';
  else if (/(thuong mai|notm|commercial)/.test(s)) yc.nhom = 'tm';
  if (yc.nhom) yc.nhanDien.push({ k: 'gh.nd.nhom', p: { g: yc.nhom } });
  return yc;
}

/**
 * Cơ cấu mục tiêu = cơ cấu yêu cầu cho loại đã nêu; phần còn lại (100 − tổng đã nêu) chia cho loại chưa nêu theo tỉ lệ mục tiêu
 * gốc (lô); gốc các loại đó bằng 0 thì để 0. Không nêu gì → mục tiêu gốc.
 */
export function hopCoCau(goc: Record<LoaiCan, number>, yc: Partial<Record<LoaiCan, number>>): Record<LoaiCan, number> {
  const neu = LOAI_CAN.filter((l) => yc[l] !== undefined);
  if (!neu.length) return { ...goc };
  const daNeu = neu.reduce((a, l) => a + yc[l]!, 0);
  const con = Math.max(0, 100 - daNeu);
  const chua = LOAI_CAN.filter((l) => yc[l] === undefined);
  const tongGoc = chua.reduce((a, l) => a + (goc[l] ?? 0), 0);
  return Object.fromEntries(LOAI_CAN.map((l) => [l, yc[l] !== undefined ? yc[l]! : tongGoc > 0 ? (con * (goc[l] ?? 0)) / tongGoc : 0])) as Record<LoaiCan, number>;
}

// ---------- điểm từng tiêu chí (0–100, thang tuyệt đối — giá trị tạm, chờ chủ nhiệm chốt) ----------
const kep = (v: number) => Math.max(0, Math.min(1, v));
/** Thang điểm: ghi trong tooltip / tài liệu. */
export const THANG = {
  /** đạt ngưỡng hs → 70, hơn ngưỡng 8 điểm % → 100; thiếu 10 điểm % → 0. */
  hieuSuat: { tren: 0.08, duoi: 0.1 },
  /** điểm lệch cơ cấu 0 → 100, ≥ 100 → 0. */
  coCau: 100,
  /** 0 căn vượt → 100 (−15 mỗi căn tự chỉnh phải gỡ); còn vượt → 40 − 20 mỗi căn. */
  thoatNan: { goCan: 15, vuot: 20 },
  /** tỉ lệ (lõi + thang) / DTXD: ≤ 8 % → 100, ≥ 16 % → 0. */
  loiGon: { tot: 0.08, xau: 0.16 },
  /** % căn góc ≥ 35 % → 100. */
  canGoc: 0.35,
  /** lệch ±50 % mục tiêu → 0 (số căn / tầng, DT sàn). */
  lechMuc: 0.5,
} as const;

export type DiemMau = { khoa: string; tong: number; theoTC: Partial<Record<TieuChi, number>> };

export function diemTieuChi(r: KetQuaMau, yc: YeuCauMau, ctx: { soCanMax: number }): Partial<Record<TieuChi, number>> {
  const d: Partial<Record<TieuChi, number>> = {};
  const hs = r.hieuSuat;
  d.hieuSuat = hs === null ? 0 : hs >= yc.hsMin ? 70 + 30 * kep((hs - yc.hsMin) / THANG.hieuSuat.tren) : 70 * kep((hs - (yc.hsMin - THANG.hieuSuat.duoi)) / THANG.hieuSuat.duoi);
  d.coCau = 100 * kep(1 - r.lech / THANG.coCau);
  d.thoatNan = r.vuot === null ? 50 : r.vuot === 0 ? Math.max(0, 100 - THANG.thoatNan.goCan * r.canGo) : Math.max(0, 40 - THANG.thoatNan.vuot * r.vuot);
  d.loiGon = r.tyLeLoi === null ? 50 : 100 * kep((THANG.loiGon.xau - r.tyLeLoi) / (THANG.loiGon.xau - THANG.loiGon.tot));
  d.canGoc = r.soCan > 0 ? 100 * kep(r.soCanGoc / r.soCan / THANG.canGoc) : 0;
  d.soCan = yc.soCanTang ? 100 * kep(1 - Math.abs(r.soCan - yc.soCanTang) / (THANG.lechMuc * yc.soCanTang)) : ctx.soCanMax > 0 ? (100 * r.soCan) / ctx.soCanMax : 0;
  if (yc.dtSan) d.dtSan = 100 * kep(1 - Math.abs(r.dtxd - yc.dtSan) / (THANG.lechMuc * yc.dtSan));
  if (typeof r.diemView === 'number') d.view = kep(r.diemView / 100) * 100;
  return d;
}

/** Điểm tổng = Σ w·s ÷ Σ w (tiêu chí có số liệu). */
export function chamDiem(ds: KetQuaMau[], yc: YeuCauMau): DiemMau[] {
  const soCanMax = Math.max(0, ...ds.map((r) => r.soCan));
  return ds.map((r) => {
    const theoTC = diemTieuChi(r, yc, { soCanMax });
    let tu = 0, mau = 0;
    for (const tc of TIEU_CHI) {
      const w = yc.trongSo[tc], v = theoTC[tc];
      if (!(w > 0) || v === undefined) continue;
      tu += w * v; mau += w;
    }
    return { khoa: r.khoa, tong: mau > 0 ? tu / mau : 0, theoTC };
  });
}

export type HangMau = KetQuaMau & { diem: DiemMau; hang: number };

/** Lọc theo dạng hình / nhóm của yêu cầu, chấm, xếp (điểm ↓, hiệu suất ↓, ít lệch). */
export function xepHang(ds: KetQuaMau[], yc: YeuCauMau): HangMau[] {
  const loc = ds.filter((r) => (!yc.hinh.length || yc.hinh.includes(r.hinh)) && (!yc.nhom || r.nhom === yc.nhom));
  const diem = new Map(chamDiem(loc, yc).map((d) => [d.khoa, d]));
  return loc
    .map((r) => ({ ...r, diem: diem.get(r.khoa)!, hang: 0 }))
    .sort((a, b) => b.diem.tong - a.diem.tong || (b.hieuSuat ?? 0) - (a.hieuSuat ?? 0) || a.lech - b.lech || a.khoa.localeCompare(b.khoa))
    .map((r, i) => ({ ...r, hang: i + 1 }));
}

/** Giá trị hiển thị của tiêu chí (để ghép câu ưu / nhược). */
function giaTri(r: KetQuaMau, tc: TieuChi): string | number {
  switch (tc) {
    case 'hieuSuat': return r.hieuSuat === null ? '—' : Math.round(r.hieuSuat * 10000) / 100;
    case 'coCau': return Math.round(r.lech * 10) / 10;
    case 'thoatNan': return r.vuot ?? '—';
    case 'loiGon': return r.tyLeLoi === null ? '—' : Math.round(r.tyLeLoi * 1000) / 10;
    case 'canGoc': return r.soCanGoc;
    case 'soCan': return r.soCan;
    case 'dtSan': return Math.round(r.dtxd);
    case 'view': return r.diemView ?? '—';
  }
}

/**
 * Ưu / nhược của một mẫu đã xếp hạng (để giải thích top 3): ưu = tiêu chí có trọng số đạt ≥ 75 điểm hoặc tốt nhất tập (≥ 50);
 * nhược = < 45 điểm, hiệu suất dưới ngưỡng, còn căn vượt cự ly, tự chỉnh phải gỡ căn. Sắp theo trọng số.
 */
export function uuNhuoc(r: HangMau, ds: HangMau[], yc: YeuCauMau): { uu: Nhan[]; nhuoc: Nhan[] } {
  const uu: Nhan[] = [], nhuoc: Nhan[] = [];
  const tcs = TIEU_CHI.filter((tc) => yc.trongSo[tc] > 0 && r.diem.theoTC[tc] !== undefined).sort((a, b) => yc.trongSo[b] - yc.trongSo[a]);
  for (const tc of tcs) {
    const v = r.diem.theoTC[tc]!;
    // "tốt nhất" chỉ khi hơn hẳn ít nhất một mẫu; mọi mẫu bằng nhau thì tiêu chí không phân biệt → không kể là ưu
    const tot = ds.every((x) => (x.diem.theoTC[tc] ?? -1) <= v + 1e-9) && ds.some((x) => (x.diem.theoTC[tc] ?? -1) < v - 1e-9);
    const ngang = ds.length > 1 && ds.every((x) => Math.abs((x.diem.theoTC[tc] ?? -1) - v) < 1e-9);
    const p = { v: giaTri(r, tc), d: Math.round(v) };
    if (!ngang && (v >= 75 || (tot && v >= 50))) uu.push({ k: `gh.uu.${tc}`, p: { ...p, tot: tot ? 1 : 0 } });
    else if (v < 45) nhuoc.push({ k: `gh.nhuoc.${tc}`, p });
  }
  if (r.hieuSuat !== null && r.hieuSuat < yc.hsMin && !nhuoc.some((x) => x.k === 'gh.nhuoc.hieuSuat'))
    nhuoc.unshift({ k: 'gh.nhuoc.hsDuoi', p: { v: giaTri(r, 'hieuSuat'), n: Math.round(yc.hsMin * 1000) / 10 } });
  if ((r.vuot ?? 0) > 0 && !nhuoc.some((x) => x.k === 'gh.nhuoc.thoatNan')) nhuoc.push({ k: 'gh.nhuoc.thoatNan', p: { v: r.vuot!, d: Math.round(r.diem.theoTC.thoatNan ?? 0) } });
  if (r.canGo > 0) nhuoc.push({ k: 'gh.nhuoc.canGo', p: { n: r.canGo } });
  return { uu: uu.slice(0, 4), nhuoc: nhuoc.slice(0, 4) };
}
