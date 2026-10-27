/**
 * Công năng ô trên tầng (L8) và luật SHCĐ ≥ 0,8 m²/căn (S10). DT một ô = DT thông thủy của mẫu căn đang đặt ở ô đó
 * (ô đổi công năng giữ nguyên kích thước module căn).
 */
import { demCan } from './coCau';
import type { MucDo } from './chiTieu';
import type { CongNangO, ThuVien, ToaDat, TrangThaiPA } from './kieu';
import { boCucTang, canDangDung, coMat, congNangTai, nhomTang, viTriCan, type BoCucToa } from './matBang';

export type HangMucO = Exclude<CongNangO, 'can' | 'bo'>;
export type DtCongNang = Record<HangMucO, number>;
export const dtCongNangRong = (): DtCongNang => ({ shcd: 0, ky_thuat: 0, thuong_mai: 0, trong: 0 });

/** Ngưỡng SHCĐ tối thiểu theo QCVN 04:2021/BXD 2.2.7 (m² / căn hộ). */
export const SHCD_M2_MOI_CAN = 0.8;
export const CAN_CU_SHCD = 'QCVN 04:2021/BXD 2.2.7';
const SAT_NGUONG = 0.03; // như chiTieu.ts: trong 3 % so với ngưỡng thì cảnh báo

/** DT (m²) các ô đổi công năng của cả tòa, cộng theo từng tầng điển hình. */
export function dtCongNangToa(toa: BoCucToa & Pick<ToaDat, 'mauId'>, tv: ThuVien): DtCongNang {
  const kq = dtCongNangRong();
  const mau = tv.toa.get(toa.mauId);
  if (!mau || !coMat(mau)) return kq;
  const vts = viTriCan(mau, tv);
  for (const { tang, so } of nhomTang(toa)) {
    const bc = boCucTang(toa, tang);
    if (!bc.congNang) continue;
    for (const vt of vts) {
      const cn = congNangTai(vt.khoa, bc);
      if (cn !== 'can' && cn !== 'bo') kq[cn] += so * (tv.can.get(canDangDung(vt, bc))?.dt_tt_m2 ?? 0);
    }
  }
  return kq;
}

export type KiemShcd = { dtShcd: number; soCan: number; m2MoiCan: number | null; nguong: number; canCu: string; muc: MucDo };

/** SHCĐ / căn của một nhóm tòa (một tòa, hoặc cả lô khi `loc` lọc theo lô). Chưa có căn thì không đánh giá. */
export function kiemShcd(pa: TrangThaiPA, tv: ThuVien, loc: (t: ToaDat) => boolean): KiemShcd {
  const dem = demCan(pa, tv);
  let dtShcd = 0, soCan = 0;
  for (const t of pa.toa) {
    if (!loc(t)) continue;
    dtShcd += dtCongNangToa(t, tv).shcd;
    soCan += Object.values(dem[t.id] ?? {}).reduce((a, b) => a + b, 0);
  }
  const m2MoiCan = soCan ? dtShcd / soCan : null;
  let muc: MucDo = 'ok';
  if (m2MoiCan !== null) {
    const chenh = m2MoiCan - SHCD_M2_MOI_CAN;
    muc = chenh < -1e-9 ? 'vuot' : Math.abs(chenh) <= SHCD_M2_MOI_CAN * SAT_NGUONG ? 'canh_bao' : 'ok';
  }
  return { dtShcd, soCan, m2MoiCan, nguong: SHCD_M2_MOI_CAN, canCu: CAN_CU_SHCD, muc };
}
