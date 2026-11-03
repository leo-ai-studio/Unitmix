/**
 * Xuất Excel (.xlsx) theo brand LEO bằng ExcelJS: báo cáo một phương án (8 sheet: bìa, chỉ tiêu, biểu diện tích, cơ cấu, căn, luật vượt,
 * dự toán công thức, tài chính số tạm) và bảng so sánh nhiều phương án. Phần dựng bảng là hàm thuần (chữ lấy theo ngôn ngữ
 * đang chọn); trình bày ở `xlsTrinhBay.ts`; ExcelJS chỉ tải khi bấm xuất.
 * Ô trống luôn là "—", không bao giờ undefined / NaN.
 */
import { t } from '../i18n/i18n';
import type { KetQuaChiTieu, KetQuaLo } from '../tinh/chiTieu';
import { demCan } from '../tinh/coCau';
import { chenhChiSo, giaTriCot, KHOA_SO, type ChiSoPA, type KhoaSo } from '../tinh/diemPA';
import { tinhDuToan, tinhKhoiLuong, type DuToan, type KhoiLuong } from '../tinh/duToan';
import { CHI_PHI_MAC_DINH } from '../tinh/macDinh';
import { tinhTaiChinh, type TaiChinh } from '../tinh/taiChinh';
import { LOAI_CAN, type ChiPhiPA, type ThuVien, type TrangThaiPA } from '../tinh/kieu';
import { canCuaToa } from '../tinh/matBang';
import { mauToa } from '../tinh/canThem';
import { nhanPhienBan } from '../phienBan';

/** Ô: chữ, số, hoặc công thức Excel `{ f, v }` (`v` = giá trị đã tính, hiện khi app chưa tính lại). */
export type OXls = string | number | { f: string; v: number };
/** Kiểu dòng để trình bày theo brand (`xlsTrinhBay.ts`). */
export type KieuHang = 'tieuDe' | 'thongTin' | 'muc' | 'dau' | 'dong' | 'tong' | 'ghiChu' | 'trong';
export type SheetXls = {
  ten: string; hang: OXls[][];
  /** Song song `hang`; thiếu thì suy ra bằng `kieuTuDong`. */ kieu?: KieuHang[];
  /** Sheet bìa: chừa chỗ logo phía trên. */ bia?: boolean;
  /** Địa chỉ ô nhập (vd. "B5"): tô nền vàng nhạt để người dùng biết sửa ở đây. */ nhap?: string[];
};
/** Giá trị hiển thị của ô (công thức → giá trị đã tính). */
export const giaTri = (o: OXls): string | number => (typeof o === 'object' ? o.v : o);

/** Đoán kiểu dòng cho sheet dựng bằng mảng thuần: dòng đầu = tiêu đề, tới dòng trống đầu = thông tin, dòng nhiều ô ngay sau = đầu bảng. */
export function kieuTuDong(hang: OXls[][]): KieuHang[] {
  let chuaGapTrong = true, choDau = false;
  return hang.map((h, i) => {
    if (!h.length) { if (chuaGapTrong) { chuaGapTrong = false; choDau = true; } return 'trong'; }
    if (i === 0) return 'tieuDe';
    if (chuaGapTrong) return 'thongTin';
    if (h.length === 1) return 'ghiChu';
    if (choDau) { choDau = false; return 'dau'; }
    return h[0] === t('xls.tong') ? 'tong' : 'dong';
  });
}

/** Dựng sheet từng dòng kèm kiểu; `them` trả số dòng Excel (từ 1) vừa thêm, dùng để viết công thức. */
export class Bang {
  hang: OXls[][] = [];
  kieu: KieuHang[] = [];
  nhap: string[] = [];
  /** Đánh dấu ô (cột 0 = A, số dòng Excel) là ô nhập. */
  danhDauNhap(cot: number, dong: number): void { this.nhap.push(`${cotXls(cot)}${dong}`); }
  them(k: KieuHang, ...o: OXls[]): number { this.hang.push(o); this.kieu.push(k); return this.hang.length; }
  /** Số dòng Excel của dòng sắp thêm. */
  get ke(): number { return this.hang.length + 1; }
  sheet(ten: string, bia = false): SheetXls { return { ten, hang: this.hang, kieu: this.kieu, ...(bia ? { bia } : {}), ...(this.nhap.length ? { nhap: this.nhap } : {}) }; }
}
/** Tên cột Excel (0 → A). */
export const cotXls = (i: number): string => String.fromCharCode(65 + i);

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
    const mau = mauToa(tv, toa);
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

  // 5–6. Dự toán và tài chính (số tạm, chờ chủ nhiệm / QS chốt). Không rải hầm khi xuất (chậm, có lúc treo): số chỗ đỗ ước theo DT hầm.
  const kl = tinhKhoiLuong(pa, tv, false);
  const dt = tinhDuToan(kl, pa.chiPhi ?? CHI_PHI_MAC_DINH);
  const tc = tinhTaiChinh(pa, tv, kl, dt, lech);
  const bDuToan = new Bang(), bTaiChinh = new Bang();
  bDuToan.them('tieuDe', t('xls.sheetDuToan'));
  bTaiChinh.them('tieuDe', t('xls.sheetTaiChinh'));
  for (const b of [bDuToan, bTaiChinh]) { b.them('thongTin', t('xls.duAn'), oChu(tenDuAn)); b.them('thongTin', t('xls.pa'), oChu(tenPA)); b.them('trong'); }
  const cp = pa.chiPhi ?? CHI_PHI_MAC_DINH;
  const bDonGia = new Bang();
  bDonGia.them('tieuDe', t('xls.sheetDonGia'));
  bDonGia.them('thongTin', t('xls.duAn'), oChu(tenDuAn)); bDonGia.them('thongTin', t('xls.pa'), oChu(tenPA)); bDonGia.them('trong');
  const dg = bangDonGia(bDonGia, dt, cp);
  bangDuToan(bDuToan, dt, cp, kl, dg);
  bangTaiChinh(bTaiChinh, tc, lech);

  return [
    bangBia(pa, kq, kl, tenDuAn, tenPA, lech),
    { ten: tenSheet(t('xls.sheetTongHop')), hang: s1 },
    bangDienTich(kq, kl, tc, tenDuAn, tenPA),
    { ten: tenSheet(t('xls.sheetCoCau')), hang: s2 },
    { ten: tenSheet(t('xls.sheetCan')), hang: s3 },
    { ten: tenSheet(t('xls.sheetVuot')), hang: s4 },
    bangTheoToa(kl, tv, tenDuAn, tenPA),
    bDonGia.sheet(tenSheet(t('xls.sheetDonGia'))),
    bDuToan.sheet(tenSheet(t('xls.sheetDuToan'))),
    bTaiChinh.sheet(tenSheet(t('xls.sheetTaiChinh'))),
  ];
}

/** Ô số thô (không làm tròn) cho bảng có công thức; không hữu hạn thì "—". */
const oTho = (v: number | null | undefined): OXls => (v === null || v === undefined || !Number.isFinite(v) ? TRONG : v);

/** Sheet bìa: tên app, dự án, phương án, ngày, tác giả, phiên bản, vài số tóm tắt. Logo chèn ở `xlsTrinhBay`. */
function bangBia(pa: TrangThaiPA, kq: KetQuaChiTieu, kl: KhoiLuong, tenDuAn: string, tenPA: string, lech: number | null): SheetXls {
  const b = new Bang();
  b.them('tieuDe', t('app.ten').toUpperCase(), '');
  b.them('thongTin', t('xls.duAn'), oChu(tenDuAn));
  b.them('thongTin', t('xls.pa'), oChu(tenPA));
  b.them('thongTin', t('xls.ngay'), new Date().toISOString().slice(0, 10));
  b.them('thongTin', t('xls.tacGia'), 'NghiaVT');
  b.them('thongTin', t('xls.banApp'), nhanPhienBan() || TRONG);
  b.them('trong');
  b.them('muc', t('xls.tomTat'), '');
  b.them('dau', t('xls.chiTieu'), t('xls.giaTri'));
  b.them('dong', t('xls.tongCan'), oSo(kq.tong.soCan));
  b.them('dong', t('dong.danSo'), oSo(kq.tong.danSo));
  b.them('dong', `${t('xls.dt.tongSan')} (m²)`, oSo(kl.tong.dtSanTong));
  b.them('dong', `${t('dong.dtSan')} (m²)`, oSo(kq.tong.dtSanTinhHSSDD));
  b.them('dong', t('xls.dt.soToa'), oSo(pa.toa.length));
  b.them('dong', t('xls.diemLech'), oSo(lech));
  return b.sheet(tenSheet(t('xls.sheetBia')), true);
}

/**
 * Biểu diện tích (học báo cáo diện tích của các công cụ quy hoạch): sàn theo khối, chỉ tiêu theo lô, cơ cấu căn kèm DT trung bình,
 * hầm và chỗ đỗ. Tổng, tỷ lệ, hệ số là công thức Excel. Số chỗ đỗ ước theo DT hầm (xuất không rải hầm).
 */
function bangDienTich(kq: KetQuaChiTieu, kl: KhoiLuong, tc: TaiChinh, tenDuAn: string, tenPA: string): SheetXls {
  const b = new Bang(), T = kl.tong;
  b.them('tieuDe', t('xls.sheetDienTich'));
  b.them('thongTin', t('xls.duAn'), oChu(tenDuAn));
  b.them('thongTin', t('xls.pa'), oChu(tenPA));
  b.them('trong');

  // 1. Sàn theo khối
  b.them('muc', t('xls.dt.muc1'), '', '');
  b.them('dau', t('xls.dt.hangMuc'), t('xls.dt.dienTich'), t('xls.dt.tyLe'));
  const r0 = b.ke, rTong = r0 + 4;
  const khoi: [string, number][] = [[t('xls.dt.thap'), T.dtThap], [t('xls.dt.de'), T.dtDe], [t('xls.dt.apMai'), T.dtApMai], [t('xls.dt.ham'), T.dtHam]];
  khoi.forEach(([nhan, v], i) => b.them('dong', nhan, oTho(v), T.dtSanTong > 0 ? { f: `B${r0 + i}/B${rTong}*100`, v: (v / T.dtSanTong) * 100 } : TRONG));
  b.them('tong', t('xls.dt.tongSan'), { f: `SUM(B${r0}:B${r0 + 3})`, v: T.dtSanTong }, T.dtSanTong > 0 ? { f: `SUM(C${r0}:C${r0 + 3})`, v: 100 } : TRONG);
  b.them('dong', t('xls.dt.sanNoi'), { f: `B${r0}+B${r0 + 1}+B${r0 + 2}`, v: T.dtTrenCot0 }, TRONG);
  const rTT = b.them('dong', t('xls.dt.tt'), oTho(T.dtTT), TRONG);
  b.them('dong', t('xls.dt.hieuSuat'), T.dtThap > 0 ? { f: `B${rTT}/B${r0}`, v: T.dtTT / T.dtThap } : TRONG, TRONG);
  b.them('dong', t('xls.dt.hssdd'), oTho(kq.tong.dtSanTinhHSSDD), TRONG);
  b.them('trong');

  // 2. Chỉ tiêu theo lô (chỉ lô có tòa)
  const loCoToa = kl.lo.filter((l) => l.toa.length && kq.theoLo[l.loId]);
  b.them('muc', t('xls.dt.muc2'), '', '', '', '', '', '', '', '', '', '', '');
  b.them('dau', t('xls.lo'), t('xls.dt.dtLo'), t('xls.dt.chiemDat'), nhanChiTieu('matDo'), t('xls.dt.soToa'), t('xls.soCan'), t('xls.dt.sanThap'), t('xls.dt.sanDe'), t('xls.dt.sanApMai'), t('xls.dt.hamTinh'), t('xls.dt.sanHssdd'), t('xls.dt.hsHssdd'));
  const l0 = b.ke;
  for (const l of loCoToa) {
    const k = kq.theoLo[l.loId], c = k.dtSanChiTiet, r = b.ke, sanH = c.thap + c.de + c.apMai + c.hamTinh;
    b.them('dong', oChu(l.kyHieu), oTho(k.dtLo), oTho(l.dtChiemDat),
      k.dtLo > 0 ? { f: `C${r}/B${r}*100`, v: (l.dtChiemDat / k.dtLo) * 100 } : TRONG,
      l.toa.length, oTho(k.soCan), oTho(c.thap), oTho(c.de), oTho(c.apMai), oTho(c.hamTinh),
      { f: `SUM(G${r}:J${r})`, v: sanH }, k.dtLo > 0 ? { f: `K${r}/B${r}`, v: sanH / k.dtLo } : TRONG);
  }
  if (loCoToa.length) {
    const l1 = b.ke - 1, r = b.ke, tong = (f: (l: (typeof loCoToa)[number]) => number) => loCoToa.reduce((a, l) => a + f(l), 0);
    const sum = (col: string, v: number): OXls => ({ f: `SUM(${col}${l0}:${col}${l1})`, v });
    const tDtLo = tong((l) => kq.theoLo[l.loId].dtLo), tCd = tong((l) => l.dtChiemDat);
    const tCt = (g: (c: KetQuaLo['dtSanChiTiet']) => number) => tong((l) => g(kq.theoLo[l.loId].dtSanChiTiet));
    const tSan = tCt((c) => c.thap + c.de + c.apMai + c.hamTinh);
    b.them('tong', t('xls.tong'), sum('B', tDtLo), sum('C', tCd), tDtLo > 0 ? { f: `C${r}/B${r}*100`, v: (tCd / tDtLo) * 100 } : TRONG,
      sum('E', tong((l) => l.toa.length)), sum('F', tong((l) => kq.theoLo[l.loId].soCan)), sum('G', tCt((c) => c.thap)), sum('H', tCt((c) => c.de)),
      sum('I', tCt((c) => c.apMai)), sum('J', tCt((c) => c.hamTinh)), sum('K', tSan), tDtLo > 0 ? { f: `K${r}/B${r}`, v: tSan / tDtLo } : TRONG);
  }
  b.them('ghiChu', t('xls.dt.ghiChuHssdd'));
  b.them('trong');

  // 3. Cơ cấu căn và DT thông thủy trung bình
  b.them('muc', t('xls.dt.muc3'), '', '', '', '');
  b.them('dau', t('xls.loai'), t('xls.soCan'), t('xls.dt.tyLe'), t('xls.dt.dtTB'), t('xls.dt.tongTT'));
  const c0 = b.ke, cTong = c0 + LOAI_CAN.length, tongSoCan = LOAI_CAN.reduce((a, l) => a + tc.theoLoai[l].soCan, 0), tongTT = LOAI_CAN.reduce((a, l) => a + tc.theoLoai[l].dtTT, 0);
  LOAI_CAN.forEach((l, i) => {
    const x = tc.theoLoai[l], r = c0 + i;
    b.them('dong', t(`loai.${l}`), x.soCan, tongSoCan > 0 ? { f: `B${r}/B${cTong}*100`, v: (x.soCan / tongSoCan) * 100 } : TRONG,
      x.soCan > 0 ? { f: `E${r}/B${r}`, v: x.dtTT / x.soCan } : TRONG, oTho(x.dtTT));
  });
  b.them('tong', t('xls.tong'), { f: `SUM(B${c0}:B${cTong - 1})`, v: tongSoCan }, tongSoCan > 0 ? { f: `SUM(C${c0}:C${cTong - 1})`, v: 100 } : TRONG,
    tongSoCan > 0 ? { f: `E${cTong}/B${cTong}`, v: tongTT / tongSoCan } : TRONG, { f: `SUM(E${c0}:E${cTong - 1})`, v: tongTT });
  b.them('trong');

  // 4. Hầm và chỗ đỗ xe
  b.them('muc', t('xls.dt.muc4'), '', '', '', '', '', '', '', '');
  const loHam = kl.lo.filter((l) => l.dtHam > 0 || l.soChoOto > 0);
  if (!loHam.length) b.them('ghiChu', t('xls.dt.khongHam'));
  else {
    b.them('dau', t('xls.lo'), t('xls.soCan'), t('xls.dt.dtHam'), t('xls.dt.choOto'), t('xls.dt.choMoiCan'), t('xls.dt.m2Cho'), t('xls.dt.xeMay'), t('xls.dt.kho'), t('xls.dt.nguon'));
    const h0 = b.ke;
    for (const l of loHam) {
      const r = b.ke, soCan = kq.theoLo[l.loId]?.soCan ?? 0;
      b.them('dong', oChu(l.kyHieu), oTho(soCan), oTho(l.dtHam), oTho(l.soChoOto),
        soCan > 0 ? { f: `D${r}/B${r}`, v: l.soChoOto / soCan } : TRONG, l.soChoOto > 0 ? { f: `C${r}/D${r}`, v: l.dtHam / l.soChoOto } : TRONG,
        oTho(l.soXeMay), oTho(l.soKho), l.nguonHam === 'rai' ? t('xls.dt.rai') : t('xls.dt.uoc'));
    }
    const h1 = b.ke - 1, r = b.ke, s = (f: (l: (typeof loHam)[number]) => number) => loHam.reduce((a, l) => a + f(l), 0);
    const sum = (col: string, v: number): OXls => ({ f: `SUM(${col}${h0}:${col}${h1})`, v });
    const tCan = s((l) => kq.theoLo[l.loId]?.soCan ?? 0), tHam = s((l) => l.dtHam), tCho = s((l) => l.soChoOto);
    b.them('tong', t('xls.tong'), sum('B', tCan), sum('C', tHam), sum('D', tCho), tCan > 0 ? { f: `D${r}/B${r}`, v: tCho / tCan } : TRONG,
      tCho > 0 ? { f: `C${r}/D${r}`, v: tHam / tCho } : TRONG, sum('G', s((l) => l.soXeMay)), sum('H', s((l) => l.soKho)), '');
    if (loHam.some((l) => l.nguonHam !== 'rai')) b.them('ghiChu', t('xls.dt.ghiChuHam'));
  }
  return b.sheet(tenSheet(t('xls.sheetDienTich')));
}

/** Vị trí các ô nhập ở sheet Đơn giá (số dòng Excel, cột B) để sheet Dự toán tham chiếu. */
export type ThamChieuDonGia = {
  ten: string;
  donGia: Record<string, number>;
  dieuChinh: Record<string, number>;
  khac: Record<string, number>;
  tyLe: { qlda: number; tuVan: number; khac: number; duPhongKL: number; duPhongTruotGia: number };
};

/** Sheet Đơn giá: mọi ô nhập của dự toán một chỗ (nền vàng). Dự toán tham chiếu sang đây nên QS chỉ sửa ở một nơi. */
export function bangDonGia(b: Bang, dt: DuToan, cp: ChiPhiPA): ThamChieuDonGia {
  const ref: ThamChieuDonGia = { ten: tenSheet(t('xls.sheetDonGia')), donGia: {}, dieuChinh: {}, khac: {}, tyLe: { qlda: 0, tuVan: 0, khac: 0, duPhongKL: 0, duPhongTruotGia: 0 } };
  b.them('ghiChu', t('xls.dg.ghiChu'));
  b.them('trong');
  b.them('dau', t('xls.dg.thamSo'), t('xls.giaTri'), t('xls.dg.donVi'));
  const nhap = (nhan: string, v: number, donVi: string): number => { const r = b.them('dong', nhan, oTho(v), donVi); b.danhDauNhap(1, r); return r; };
  b.them('muc', t('xls.dg.muc'), '', '');
  for (const d of dt.dong) ref.donGia[d.khoa] = nhap(t(`chiPhi.dong.${d.khoa}`), d.donGia, d.donVi === 'thang' ? t('chiPhi.dv.thang') : `đ/${d.donVi}`);
  b.them('muc', t('xls.dg.mucTyLe'), '', '');
  for (const n of ['xd', 'tb'] as const) {
    const nhan = t(`chiPhi.nhom.${n}`);
    ref.dieuChinh[n] = nhap(t('xls.dg.dieuChinh').replace('{nhom}', nhan), dt.nhom[n].dieuChinh, '%');
    ref.khac[n] = nhap(t('xls.dg.khac').replace('{nhom}', nhan), dt.nhom[n].khac, 'đ');
  }
  ref.tyLe.qlda = nhap(t('chiPhi.lop.qlda'), dt.tlQlda, '%');
  ref.tyLe.tuVan = nhap(t('chiPhi.lop.tuVan'), cp.tyLe.tuVan, '%');
  ref.tyLe.khac = nhap(t('chiPhi.lop.khac'), cp.tyLe.khac, '%');
  ref.tyLe.duPhongKL = nhap(t('chiPhi.lop.duPhongKL'), cp.tyLe.duPhongKL, '%');
  ref.tyLe.duPhongTruotGia = nhap(t('chiPhi.lop.duPhongTruotGia'), cp.tyLe.duPhongTruotGia, '%');
  return ref;
}

/**
 * Sheet Theo tòa: từng tòa gộp theo lô, mỗi lô một dòng tổng. Diện tích hình học thật (chưa nhân hệ số HSSDĐ), sàn đế của lô chia theo tỷ lệ chân tháp.
 * Cột: A tòa · B mẫu · C số tầng · D DT sàn/tầng · E sàn tháp (= C × D) · F sàn đế · G áp mái · H số căn · I DT thông thủy · J hệ số TT/sàn tháp.
 */
function bangTheoToa(kl: KhoiLuong, tv: ThuVien, tenDuAn: string, tenPA: string): SheetXls {
  const b = new Bang();
  b.them('tieuDe', t('xls.sheetTheoToa'));
  b.them('thongTin', t('xls.duAn'), oChu(tenDuAn));
  b.them('thongTin', t('xls.pa'), oChu(tenPA));
  b.them('trong');
  b.them('dau', t('xls.tt.toa'), t('xls.tt.mau'), t('xls.tt.soTang'), t('xls.tt.dtTang'), t('xls.tt.sanThap'), t('xls.tt.sanDe'), t('xls.tt.sanApMai'), t('xls.soCan'), t('xls.tt.dtTT'), t('xls.dt.hieuSuat'));
  const tongLo: number[] = [];
  const loCoToa = kl.lo.filter((l) => l.toa.length);
  const cong = (l: (typeof loCoToa)[number], f: (x: (typeof l.toa)[number]) => number) => l.toa.reduce((a, x) => a + f(x), 0);
  for (const l of loCoToa) {
    b.them('muc', oChu(l.kyHieu), '', '', '', '', '', '', '', '', '');
    const d0 = b.ke;
    l.toa.forEach((x, i) => {
      const r = b.ke, ten = oChu(tv.toa.get(x.mauId)?.ten_vi ?? x.mauId);
      b.them('dong', `${oChu(l.kyHieu)} · ${i + 1}`, ten, x.soTangDH, oTho(x.dtSanDH), { f: `C${r}*D${r}`, v: x.dtThap }, oTho(x.dtDe), oTho(x.dtApMai), oTho(x.tongCan), oTho(x.dtTT),
        x.dtThap > 0 ? { f: `I${r}/E${r}`, v: x.dtTT / x.dtThap } : TRONG);
    });
    const d1 = b.ke - 1, r = b.ke;
    const sum = (col: string, v: number): OXls => ({ f: `SUM(${col}${d0}:${col}${d1})`, v });
    const thap = cong(l, (x) => x.dtThap), tt = cong(l, (x) => x.dtTT);
    tongLo.push(b.them('tong', `${t('xls.tt.tongLo')} ${oChu(l.kyHieu)}`, '', '', '', sum('E', thap), sum('F', cong(l, (x) => x.dtDe)), sum('G', cong(l, (x) => x.dtApMai)),
      sum('H', cong(l, (x) => x.tongCan)), sum('I', tt), thap > 0 ? { f: `I${r}/E${r}`, v: tt / thap } : TRONG));
  }
  if (tongLo.length) {
    const r = b.ke;
    const tong = (col: string, f: (x: (typeof loCoToa)[number]['toa'][number]) => number): OXls => ({ f: tongLo.map((x) => `${col}${x}`).join('+'), v: loCoToa.reduce((a, l) => a + cong(l, f), 0) });
    const thap = loCoToa.reduce((a, l) => a + cong(l, (x) => x.dtThap), 0), tt = loCoToa.reduce((a, l) => a + cong(l, (x) => x.dtTT), 0);
    b.them('tong', t('xls.tong'), '', '', '', tong('E', (x) => x.dtThap), tong('F', (x) => x.dtDe), tong('G', (x) => x.dtApMai), tong('H', (x) => x.tongCan), tong('I', (x) => x.dtTT),
      thap > 0 ? { f: `I${r}/E${r}`, v: tt / thap } : TRONG);
  }
  b.them('ghiChu', t('xls.tt.ghiChu'));
  return b.sheet(tenSheet(t('xls.sheetTheoToa')));
}

/**
 * Bảng dự toán dạng công thức: thành tiền = khối lượng × đơn giá × (1 + % điều chỉnh), cộng nhóm, các lớp tỷ lệ, tổng mức, suất đầu tư.
 * Sửa ô khối lượng / đơn giá / tỷ lệ thì phần còn lại tự tính lại. Tiền tính bằng đồng. Cột: A hạng mục … G thành tiền.
 */
export function bangDuToan(b: Bang, dt: DuToan, cp: ChiPhiPA, kl: KhoiLuong, dg: ThamChieuDonGia): void {
  const tc = (dong: number, v: number): OXls => ({ f: `'${dg.ten}'!B${dong}`, v });
  b.them('ghiChu', t('chiPhi.canhBao'));
  b.them('ghiChu', t('chiPhi.ghiChuND'));
  b.them('ghiChu', t('xls.ghiChuCongThuc'));
  b.them('trong');
  b.them('dau', t('chiPhi.hangMuc'), t('xls.nhom'), t('chiPhi.donVi'), t('chiPhi.khoiLuong'), t('chiPhi.donGia'), t('xls.dieuChinh'), t('xls.thanhTienD'));
  const rNhom: Record<string, number> = {};
  for (const n of ['xd', 'tb'] as const) {
    const nhan = t(`chiPhi.nhom.${n}`), g = dt.nhom[n], dong = dt.dong.filter((x) => x.nhom === n);
    const dau = b.ke;
    for (const d of dong) {
      const r = b.ke;
      b.them('dong', t(`chiPhi.dong.${d.khoa}`), nhan, d.donVi === 'thang' ? t('chiPhi.dv.thang') : d.donVi, oTho(d.kl), tc(dg.donGia[d.khoa], d.donGia), tc(dg.dieuChinh[n], g.dieuChinh),
        { f: `D${r}*E${r}*(1+F${r}/100)`, v: d.thanhTien });
    }
    const cuoi = b.ke - 1, rKhac = b.ke;
    b.them('dong', t('chiPhi.khac'), nhan, TRONG, TRONG, TRONG, TRONG, tc(dg.khac[n], g.khac));
    rNhom[n] = b.them('tong', `${t('chiPhi.congNhom')}: ${nhan}`, nhan, TRONG, TRONG, TRONG, TRONG,
      dong.length ? { f: `SUM(G${dau}:G${cuoi})+G${rKhac}`, v: g.tong } : { f: `G${rKhac}`, v: g.tong });
  }
  b.them('trong');
  const rCs = b.them('tong', t('chiPhi.coSo'), TRONG, TRONG, TRONG, TRONG, TRONG, { f: `G${rNhom.xd}+G${rNhom.tb}`, v: dt.xd + dt.tb });
  const lop: [keyof ThamChieuDonGia['tyLe'], number, number][] = [['qlda', dt.tlQlda, dt.qlda], ['tuVan', cp.tyLe.tuVan, dt.tuVan], ['khac', cp.tyLe.khac, dt.khac]];
  const rLop = lop.map(([k, pct, v]) => { const r = b.ke; return b.them('dong', t(`chiPhi.lop.${k}`), TRONG, '%', tc(dg.tyLe[k], pct), TRONG, TRONG, { f: `G${rCs}*D${r}/100`, v }); });
  const rTruoc = b.them('tong', t('chiPhi.truocDuPhong'), TRONG, TRONG, TRONG, TRONG, TRONG, { f: `G${rCs}+G${rLop[0]}+G${rLop[1]}+G${rLop[2]}`, v: dt.truocDuPhong });
  const rKL = b.ke, rTG = rKL + 1;
  b.them('dong', t('chiPhi.lop.duPhongKL'), TRONG, '%', tc(dg.tyLe.duPhongKL, cp.tyLe.duPhongKL), TRONG, TRONG, { f: `G${rTruoc}*D${rKL}/100`, v: dt.duPhongKL });
  b.them('dong', t('chiPhi.lop.duPhongTruotGia'), TRONG, '%', tc(dg.tyLe.duPhongTruotGia, cp.tyLe.duPhongTruotGia), TRONG, TRONG, { f: `G${rTruoc}*D${rTG}/100`, v: dt.duPhongTruotGia });
  const rTong = b.them('tong', t('chiPhi.tongMuc'), TRONG, TRONG, TRONG, TRONG, TRONG, { f: `G${rTruoc}+G${rKL}+G${rTG}`, v: dt.tongMuc });
  const T = kl.tong;
  const rSan = b.them('dong', `${t('xls.dt.tongSan')} (m²)`, TRONG, 'm²', oTho(T.dtSanTong), TRONG, TRONG, TRONG);
  const rCan = b.them('dong', t('xls.tongCan'), TRONG, t('xls.soCan'), oTho(T.tongCan), TRONG, TRONG, TRONG);
  b.them('dong', t('chiPhi.suatM2'), TRONG, 'đ/m²', TRONG, TRONG, TRONG, dt.suatM2 !== null && T.dtSanTong > 0 ? { f: `G${rTong}/D${rSan}`, v: dt.suatM2 } : TRONG);
  b.them('dong', t('chiPhi.suatCan'), TRONG, 'đ', TRONG, TRONG, TRONG, dt.suatCan !== null && T.tongCan > 0 ? { f: `G${rTong}/D${rCan}`, v: dt.suatCan } : TRONG);
}

/** Bảng tài chính: doanh thu theo loại căn và nguồn, chi phí, lợi nhuận, hoà vốn. Tiền tính bằng đồng. */
export function bangTaiChinh(b: Bang, tc: TaiChinh, lech: number | null): void {
  b.them('ghiChu', t('chiPhi.canhBao'));
  b.them('trong');
  b.them('dau', t('chiPhi.loaiCan'), t('chiPhi.soCan'), t('chiPhi.dtTT'), t('xls.thanhTienD'));
  for (const l of LOAI_CAN) { const x = tc.theoLoai[l]; b.them('dong', t(`loai.${l}`), oSo(x.soCan), oSo(x.dtTT), oSo(x.doanhThu)); }
  b.them('trong');
  b.them('dau', t('chiPhi.hangMuc'), t('xls.giaTri'));
  const dong: [string, number | null, boolean?][] = [
    [t('chiPhi.dtCan'), tc.doanhThuCan], [t('chiPhi.dtOto'), tc.doanhThuOto], [t('chiPhi.dtXeMay'), tc.doanhThuXeMay], [t('chiPhi.dtTM'), tc.doanhThuTM],
    [t('chiPhi.diemLech'), lech], [`${t('chiPhi.phat')} (%)`, tc.tyLePhat * 100], [t('chiPhi.phat'), tc.phatLech ? -tc.phatLech : 0],
    [t('chiPhi.doanhThuRong'), tc.doanhThu, true], [t('chiPhi.tongMuc'), tc.tongMuc], [t('chiPhi.chiPhiDat'), tc.chiPhiDat], [t('chiPhi.chiPhiBan'), tc.chiPhiBan],
    [t('chiPhi.tongChiPhi'), tc.tongChiPhi, true], [t('chiPhi.loiNhuan'), tc.loiNhuan, true], [`${t('chiPhi.bienLN')} (%)`, tc.bienLN],
    [t('chiPhi.giaBQ'), tc.giaBQ], [t('chiPhi.giaHoaVon'), tc.giaHoaVon],
  ];
  for (const [nhan, v, nhat] of dong) b.them(nhat ? 'tong' : 'dong', nhan, oSo(v));
}

/** `tien` (tuỳ chọn): tổng mức đầu tư và lợi nhuận (đ, số tạm) để thêm hàng vào bảng so sánh. */
export type PASoSanh = { ten: string; chiSo: ChiSoPA; tien?: { tongMuc: number | null; loiNhuan: number | null } };
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
  if (ds.some((x) => x.tien)) {
    hang.push([t('xls.tongMuc'), ...ds.map((x) => oSo(x.tien?.tongMuc))]);
    hang.push([t('xls.loiNhuan'), ...ds.map((x) => oSo(x.tien?.loiNhuan))]);
  }
  if (g) {
    hang.push([], [t('xls.chenhGoc')]);
    hang.push([t('xls.chiSo'), ...ds.map((x) => oChu(x.ten))]);
    const cl = ds.map((x) => chenhChiSo(x.chiSo, g.chiSo));
    for (const k of KHOA_SO) hang.push([nhanKhoa(k), ...cl.map((c) => oSo(c[k]))]);
  }
  const iChenh = hang.findIndex((h) => h[0] === t('xls.chenhGoc'));
  const kieu: KieuHang[] = hang.map((h, i) => {
    if (i === 0) return 'tieuDe';
    if (!h.length) return 'trong';
    if (i < 3) return 'thongTin';
    if (i === 4 || (iChenh >= 0 && i === iChenh + 1)) return 'dau';
    if (i === iChenh) return 'muc';
    return 'dong';
  });
  return [{ ten: tenSheet(t('xls.sheetSoSanh')), hang, kieu }];
}

/** Tên tệp an toàn, vẫn giữ dấu tiếng Việt. */
export const tenTepXls = (...phan: string[]): string =>
  phan.map((p) => p.replace(/[\\/:*?"<>|]/g, '').trim()).filter(Boolean).join(' - ').replace(/\s+/g, ' ').slice(0, 120) + '.xlsx';

/** Logo cho sheet bìa (PNG trong `public/brand`); không tải được thì bìa không có logo. */
async function taiLogo(): Promise<ArrayBuffer | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}brand/leo_ai_mark.png`);
    return r.ok ? await r.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/** Ghi workbook ra .xlsx dạng byte (dùng cho tải về và test). */
export async function ghiXls(sheets: SheetXls[], logo: ArrayBuffer | null = null): Promise<ArrayBuffer> {
  const [{ default: Excel }, { taoSachBrand }] = await Promise.all([import('exceljs'), import('./xlsTrinhBay')]);
  return (await taoSachBrand(Excel, sheets, logo).xlsx.writeBuffer()) as ArrayBuffer;
}

/** Tải tệp .xlsx về máy theo brand. ExcelJS chỉ nạp ở lần bấm đầu. */
export async function xuatXls(sheets: SheetXls[], tenTep: string): Promise<void> {
  const du = await ghiXls(sheets, await taiLogo());
  const url = URL.createObjectURL(new Blob([du], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url; a.download = tenTep;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Xuất báo cáo một PA (nút XLS thanh trên). Không chờ rải hầm: sheet dự toán dùng số chỗ đỗ ước theo diện tích hầm. */
export async function xuatBaoCaoPA(pa: TrangThaiPA, tv: ThuVien, kq: KetQuaChiTieu, tenDuAn: string, tenPA: string, lech: number | null = null): Promise<void> {
  await xuatXls(baoCaoPA(pa, tv, kq, tenDuAn, tenPA, lech), tenTepXls(tenDuAn, tenPA));
}
