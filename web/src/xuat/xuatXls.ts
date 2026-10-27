/**
 * Xuất Excel (.xlsx) bằng SheetJS: báo cáo một phương án (4 sheet) và bảng so sánh nhiều phương án.
 * Phần dựng bảng là hàm thuần (chữ lấy theo ngôn ngữ đang chọn); SheetJS chỉ tải khi bấm xuất.
 * Ô trống luôn là "—", không bao giờ undefined / NaN.
 */
import { t } from '../i18n/i18n';
import type { KetQuaChiTieu } from '../tinh/chiTieu';
import { demCan } from '../tinh/coCau';
import { chenhChiSo, giaTriCot, KHOA_SO, type ChiSoPA, type KhoaSo } from '../tinh/diemPA';
import { LOAI_CAN, type ThuVien, type TrangThaiPA } from '../tinh/kieu';
import { canCuaToa } from '../tinh/matBang';

export type OXls = string | number;
export type SheetXls = { ten: string; hang: OXls[][] };

const TRONG = '—';
/** Số làm tròn 2 chữ số thập phân; trống hoặc không hữu hạn thì "—". */
export const oSo = (v: number | null | undefined): OXls => (v === null || v === undefined || !Number.isFinite(v) ? TRONG : Math.round(v * 100) / 100);
const oChu = (v: string | null | undefined): OXls => (v && v.trim() ? v : TRONG);
const DON_VI: Record<string, string> = { matDo: '%', matDoThap: '%', dtSan: 'm²', cayXanh: 'm²' };
const MUC: Record<string, string> = { ok: 'xls.muc.ok', canh_bao: 'xls.muc.canhBao', vuot: 'xls.muc.vuot' };

/** Tên sheet hợp lệ của Excel: ≤ 31 ký tự, không chứa : \ / ? * [ ]. */
export const tenSheet = (s: string): string => s.replace(/[:\\/?*[\]]/g, '-').slice(0, 31) || 'Sheet';

const nhanChiTieu = (khoa: string): string => {
  const ten = t(`dong.${khoa}`);
  return DON_VI[khoa] ? `${ten} (${DON_VI[khoa]})` : ten;
};

/** Báo cáo một phương án: tổng hợp chỉ tiêu theo lô, cơ cấu theo tòa, danh sách căn, chỉ tiêu vượt. */
export function baoCaoPA(pa: TrangThaiPA, tv: ThuVien, kq: KetQuaChiTieu, tenDuAn: string, tenPA: string, lech: number | null = null): SheetXls[] {
  const dau = (tieuDe: string): OXls[][] => [[tieuDe], [t('xls.duAn'), oChu(tenDuAn)], [t('xls.pa'), oChu(tenPA)], []];
  const kyHieu = (loId: string) => oChu(pa.lo.find((l) => l.id === loId)?.temDat.kyHieu ?? loId);
  const tenToa = (mauId: string) => oChu(tv.toa.get(mauId)?.ten_vi ?? mauId);

  // 1. Tổng hợp chỉ tiêu theo lô
  const s1: OXls[][] = [...dau(t('xls.sheetTongHop'))];
  s1.push([t('xls.lo'), t('xls.chiTieu'), t('xls.dat'), t('xls.gioiHan'), t('xls.chenh'), t('xls.muc'), t('xls.chieu')]);
  for (const lo of pa.lo) {
    const k = kq.theoLo[lo.id];
    if (!k) continue;
    s1.push([kyHieu(lo.id), t('xls.dtLo') + ' (m²)', oSo(k.dtLo), TRONG, TRONG, TRONG, TRONG]);
    for (const d of k.dong) s1.push([kyHieu(lo.id), nhanChiTieu(d.khoa), oSo(d.dat), oSo(d.mucTieu), oSo(d.chenh), d.dat === null || d.mucTieu === null ? TRONG : t(MUC[d.muc]), d.chieu === '<=' ? '≤' : '≥']);
  }
  s1.push([], [t('xls.tong'), t('xls.tongCan'), oSo(kq.tong.soCan)], [t('xls.tong'), t('duAn.dtSan') + ' (m²)', oSo(kq.tong.dtSanTinhHSSDD)], [t('xls.tong'), t('dong.danSo'), oSo(kq.tong.danSo)]);
  s1.push([t('xls.tong'), t('xls.diemLech'), oSo(lech)]);

  // 2. Cơ cấu căn theo tòa × loại
  const dem = demCan(pa, tv);
  const s2: OXls[][] = [...dau(t('xls.sheetCoCau'))];
  s2.push([t('xls.lo'), t('xls.toa'), t('xls.soTang'), ...LOAI_CAN.map((l) => t(`loai.${l}`)), t('xls.tongCan'), ...LOAI_CAN.map((l) => `% ${t(`loai.${l}`)}`)]);
  const cong = Object.fromEntries(LOAI_CAN.map((l) => [l, 0])) as Record<string, number>;
  for (const toa of pa.toa) {
    const d = dem[toa.id], tong = d ? LOAI_CAN.reduce((a, l) => a + d[l], 0) : 0;
    for (const l of LOAI_CAN) cong[l] += d?.[l] ?? 0;
    s2.push([kyHieu(toa.loId), tenToa(toa.mauId), oSo(toa.soTangDH), ...LOAI_CAN.map((l) => oSo(d?.[l])), oSo(tong), ...LOAI_CAN.map((l) => (tong > 0 ? oSo(((d?.[l] ?? 0) / tong) * 100) : TRONG))]);
  }
  const tongCan = LOAI_CAN.reduce((a, l) => a + cong[l], 0);
  s2.push([t('xls.tong'), TRONG, TRONG, ...LOAI_CAN.map((l) => oSo(cong[l])), oSo(tongCan), ...LOAI_CAN.map((l) => (tongCan > 0 ? oSo((cong[l] / tongCan) * 100) : TRONG))]);
  s2.push([t('xls.mucTieuPct'), TRONG, TRONG, ...LOAI_CAN.map(() => TRONG), TRONG, ...LOAI_CAN.map((l) => oSo(pa.lo.length === 1 ? pa.lo[0].temDat.coCauMucTieu[l] : null))]);
  s2.push([t('xls.diemLech'), TRONG, TRONG, oSo(lech)]);

  // 3. Danh sách căn theo tòa
  const s3: OXls[][] = [...dau(t('xls.sheetCan'))];
  s3.push([t('xls.lo'), t('xls.toa'), t('xls.mauCan'), t('xls.maCan'), t('xls.loai'), t('xls.dtTt'), t('xls.dtTim'), t('xls.canMoiTang'), t('xls.soTang'), t('xls.soLuong'), t('xls.tongDtTt')]);
  let tongSl = 0, tongDt = 0;
  for (const toa of pa.toa) {
    const mau = tv.toa.get(toa.mauId);
    if (!mau) continue;
    for (const [id, n] of canCuaToa(mau, toa, tv)) {
      const c = tv.can.get(id);
      const sl = n * toa.soTangDH;
      tongSl += sl;
      tongDt += sl * (c?.dt_tt_m2 ?? 0);
      s3.push([kyHieu(toa.loId), tenToa(toa.mauId), oChu(c?.ten_vi ?? id), oChu(c?.ma_goc ?? id), c ? t(`loai.${c.loai}`) : TRONG, oSo(c?.dt_tt_m2), oSo(c?.dt_tim_m2), oSo(n), oSo(toa.soTangDH), oSo(sl), c ? oSo(sl * c.dt_tt_m2) : TRONG]);
    }
  }
  s3.push([t('xls.tong'), TRONG, TRONG, TRONG, TRONG, TRONG, TRONG, TRONG, TRONG, oSo(tongSl), oSo(tongDt)]);

  // 4. Chỉ tiêu vượt giới hạn
  const s4: OXls[][] = [...dau(t('xls.sheetVuot'))];
  s4.push([t('xls.lo'), t('xls.chiTieu'), t('xls.dat'), t('xls.gioiHan'), t('xls.chenh'), t('xls.chieu')]);
  let coVuot = false;
  for (const lo of pa.lo) for (const d of kq.theoLo[lo.id]?.dong ?? []) {
    if (d.muc !== 'vuot') continue;
    coVuot = true;
    s4.push([kyHieu(lo.id), nhanChiTieu(d.khoa), oSo(d.dat), oSo(d.mucTieu), oSo(d.chenh), d.chieu === '<=' ? '≤' : '≥']);
  }
  if (!coVuot) s4.push([t('xls.khongVuot')]);

  return [
    { ten: tenSheet(t('xls.sheetTongHop')), hang: s1 },
    { ten: tenSheet(t('xls.sheetCoCau')), hang: s2 },
    { ten: tenSheet(t('xls.sheetCan')), hang: s3 },
    { ten: tenSheet(t('xls.sheetVuot')), hang: s4 },
  ];
}

export type PASoSanh = { ten: string; chiSo: ChiSoPA };
export const nhanKhoa = (k: KhoaSo): string => {
  switch (k) {
    case 'lech': return t('xls.diemLech');
    case 'soCan': return t('xls.tongCan');
    case 'dtSan': return `${t('duAn.dtSan')} (m²)`;
    case 'matDo': return nhanChiTieu('matDo');
    case 'tangCao': return t('dong.tangCao');
    case 'soLuatVuot': return t('xls.soVuot');
    default: return `% ${t(`loai.${k}`)}`;
  }
};

/** Bảng so sánh phương án: chỉ số theo hàng, mỗi PA một cột; kèm khối chênh so với PA gốc (`goc` = chỉ số trong `ds`). */
export function baoCaoSoSanh(ds: PASoSanh[], goc: number, tenDuAn: string): SheetXls[] {
  const g = ds[goc] ?? ds[0];
  const hang: OXls[][] = [[t('xls.sheetSoSanh')], [t('xls.duAn'), oChu(tenDuAn)], [t('xls.paGoc'), oChu(g?.ten)], []];
  hang.push([t('xls.chiSo'), ...ds.map((x) => oChu(x.ten))]);
  for (const k of KHOA_SO) hang.push([nhanKhoa(k), ...ds.map((x) => oSo(giaTriCot(x.chiSo, k)))]);
  for (const l of ['stu', '1pn', '2pn', '2pnp', '3pn'] as const) hang.push([`${t('xls.soCan')} ${t(`loai.${l}`)}`, ...ds.map((x) => oSo(x.chiSo.coCau[l]))]);
  hang.push([t('dong.danSo'), ...ds.map((x) => oSo(x.chiSo.danSo))]);
  if (g) {
    hang.push([], [t('xls.chenhGoc')]);
    hang.push([t('xls.chiSo'), ...ds.map((x) => oChu(x.ten))]);
    const cl = ds.map((x) => chenhChiSo(x.chiSo, g.chiSo));
    for (const k of KHOA_SO) hang.push([nhanKhoa(k), ...cl.map((c) => oSo(c[k]))]);
  }
  return [{ ten: tenSheet(t('xls.sheetSoSanh')), hang }];
}

/** Dựng workbook SheetJS từ các sheet; độ rộng cột theo nội dung dài nhất (tối đa 48). */
export function taoSach(XLSX: typeof import('xlsx'), sheets: SheetXls[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.hang);
    const soCot = Math.max(0, ...s.hang.map((h) => h.length));
    ws['!cols'] = Array.from({ length: soCot }, (_, c) => ({ wch: Math.min(48, Math.max(8, ...s.hang.slice(1).map((h) => String(h[c] ?? '').length + 2))) }));
    XLSX.utils.book_append_sheet(wb, ws, s.ten);
  }
  return wb;
}

/** Tên tệp an toàn, vẫn giữ dấu tiếng Việt. */
export const tenTepXls = (...phan: string[]): string =>
  phan.map((p) => p.replace(/[\\/:*?"<>|]/g, '').trim()).filter(Boolean).join(' - ').replace(/\s+/g, ' ').slice(0, 120) + '.xlsx';

/** Tải tệp .xlsx về máy. SheetJS chỉ nạp ở lần bấm đầu. */
export async function xuatXls(sheets: SheetXls[], tenTep: string): Promise<void> {
  const XLSX = await import('xlsx');
  XLSX.writeFile(taoSach(XLSX, sheets), tenTep);
}
