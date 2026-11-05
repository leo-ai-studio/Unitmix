/**
 * Tầng hầm — CHỈ TÍNH SỐ (không bố trí mặt bằng): ranh hầm, DT sàn / DTXD hầm, và số chỗ đỗ ô tô, xe máy
 * (1) yêu cầu theo hệ số chỉ tiêu của lô (chỗ / căn), (2) yêu cầu theo QCVN 04:2021/BXD 2.2.17.1, (3) khả năng theo DT sàn hầm × tỷ lệ đỗ xe.
 * Phần layout hầm (rải ô đỗ, ram, khoang cháy, phòng kỹ thuật...) chưa hoàn thiện: nằm ở nhánh `feat/ham-layout`, không ở main.
 * Hàm thuần, toạ độ mét.
 */
import { demCan } from './coCau';
import { vungDat } from './hopLo';
import { coVao, dtHop } from './hamHinh';
import type { Diem, Lo, ThuVien, TrangThaiPA } from './kieu';
import { PHAN_HAM_MAC_DINH } from './kieu';
import { chuanHoaHam, type HAM_MAC_DINH } from './macDinh';
import { canCuaToa } from './matBang';
import { mauToa } from './canThem';

export type HamDayDu = typeof HAM_MAC_DINH;

export { coVao, dtHop } from './hamHinh';

/** m² sàn hầm cho một chỗ ô tô / xe máy (gồm làn, ram…) — ước, như tinh/chiTieu.ts. */
export const M2_MOI_CHO_OTO = 30;
export const M2_MOI_XE_MAY = 2.5;

/** Ranh hầm: ranh đã cố định trong PA, không thì chỉ giới (hoặc ranh lô) co vào `lui` mét. */
export const ranhHam = (lo: Lo, ts: Pick<HamDayDu, 'ranh' | 'lui'>): Diem[] =>
  ts.ranh && ts.ranh.length >= 3 ? ts.ranh : coVao(vungDat(lo), ts.lui);

export type YeuCauDoXe = { heSo: number; theoCan: number; theoDT: number; tong: number; xeMay: number; garaCoKhi: boolean };

/**
 * DT chỗ để xe yêu cầu theo QCVN 04:2021/BXD 2.2.17.1:
 * b) ≥ 25 m² / 4 căn nhưng ≥ 20 m² / 100 m² DT sử dụng căn, trong đó ≥ 6 m² xe máy, xe đạp mỗi căn;
 * c) NOXH, tái định cư, thu nhập thấp: lấy 60% định mức b) và vẫn ≥ 6 m² xe máy mỗi căn;
 * d) gara cơ khí: ≥ 12 m² / 100 m² DT sử dụng căn (ở đây cộng thêm phần xe máy 6 m²/căn).
 */
export function yeuCauDoXe(soCan: number, dtsd: number, noxh: boolean, garaCoKhi: boolean): YeuCauDoXe {
  const heSo = noxh ? 0.6 : 1;
  const theoCan = (heSo * 25 * soCan) / 4;
  const theoDT = heSo * 0.2 * dtsd;
  const xeMay = 6 * soCan;
  const tong = garaCoKhi ? 0.12 * dtsd + xeMay : Math.max(theoCan, theoDT, xeMay);
  return { heSo, theoCan, theoDT, tong, xeMay, garaCoKhi };
}

/** Số căn và DT sử dụng (thông thủy) căn của các tòa trên lô. */
export function canTrenLo(pa: TrangThaiPA, tv: ThuVien, loId: string): { soCan: number; dtsd: number } {
  const dem = demCan(pa, tv);
  let soCan = 0, dtsd = 0;
  for (const t of pa.toa) {
    if (t.loId !== loId) continue;
    soCan += Object.values(dem[t.id] ?? {}).reduce((a, b) => a + b, 0);
    const mau = mauToa(tv, t);
    if (!mau) continue;
    for (const [id, n] of canCuaToa(mau, t, tv)) dtsd += n * t.soTangDH * (tv.can.get(id)?.dt_tt_m2 ?? 0);
  }
  return { soCan, dtsd };
}

export type KetQuaHamSo = {
  ts: HamDayDu;
  ranh: Diem[];
  soTang: number;
  /** DT một tầng hầm (m²) = DT ranh hầm. */
  dtSanTang: number;
  /** DTXD hầm = DT sàn một tầng × số tầng (m²). */
  dtXdHam: number;
  soCan: number;
  dtsd: number;
  noxh: boolean;
  /** Yêu cầu theo hệ số chỉ tiêu lô (chỗ / căn × số căn). */
  theoHeSo: { oto: number; xeMay: number; hsOto: number; hsXeMay: number };
  /** Yêu cầu theo QCVN 04:2021 2.2.17.1: DT (m²) và quy đổi số chỗ (ước). */
  theoQcvn: { dtTong: number; dtXeMay: number; dtOto: number; oto: number; xeMay: number; heSo: number; garaCoKhi: boolean };
  /** Khả năng bố trí theo DT sàn hầm × tỷ lệ đỗ xe (hệ số `phanHam.doXe`), ước. */
  khaNang: { dtDoXe: number; tyLeDoXe: number; oto: number; xeMay: number };
};

/** Tính số hầm cho một lô: không bố trí mặt bằng. null khi chưa có ranh hầm. */
export function tinhHamSo(pa: TrangThaiPA, tv: ThuVien | null, lo: Lo): KetQuaHamSo | null {
  const ts = chuanHoaHam(pa.ham);
  const ranh = ranhHam(lo, ts);
  if (ranh.length < 3) return null;
  const soTang = Math.max(1, Math.min(6, Math.round(ts.soTang)));
  const dtSanTang = dtHop([ranh]);
  const { soCan, dtsd } = tv ? canTrenLo(pa, tv, lo.id) : { soCan: 0, dtsd: 0 };
  const ct = lo.temDat.chiTieu;
  const noxh = lo.temDat.chucNang === 'xh';
  const hsOto = ct.choDoOtoMoiCan ?? 0, hsXeMay = ct.choXeMayMoiCan ?? 0;
  const yc = yeuCauDoXe(soCan, dtsd, noxh, ts.garaCoKhi);
  const dtXdHam = dtSanTang * soTang;
  const ph = pa.phanHam ?? PHAN_HAM_MAC_DINH;
  const dtDoXe = dtXdHam * ph.doXe;
  const dtXeMayKn = ts.dtXeMay ?? yc.xeMay;
  return {
    ts, ranh, soTang, dtSanTang, dtXdHam, soCan, dtsd, noxh,
    theoHeSo: { oto: soCan ? Math.ceil(soCan * hsOto) : 0, xeMay: soCan ? Math.ceil(soCan * hsXeMay) : 0, hsOto, hsXeMay },
    theoQcvn: {
      dtTong: yc.tong, dtXeMay: yc.xeMay, dtOto: Math.max(0, yc.tong - yc.xeMay),
      oto: Math.ceil(Math.max(0, yc.tong - yc.xeMay) / M2_MOI_CHO_OTO), xeMay: Math.ceil(yc.xeMay / M2_MOI_XE_MAY),
      heSo: yc.heSo, garaCoKhi: yc.garaCoKhi,
    },
    khaNang: { dtDoXe, tyLeDoXe: ph.doXe, oto: Math.max(0, Math.floor((dtDoXe - dtXeMayKn) / M2_MOI_CHO_OTO)), xeMay: Math.floor(dtXeMayKn / M2_MOI_XE_MAY) },
  };
}
