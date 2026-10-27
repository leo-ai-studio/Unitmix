/**
 * Hiệu quả tài chính sơ bộ: doanh thu bán căn (theo loại, theo tầng), chỗ đỗ, thương mại đế; trừ phạt lệch cơ cấu;
 * chi phí = dự toán + chi phí đất (nhập tay) + bán hàng (% doanh thu). MỌI GIÁ / TỶ LỆ MẶC ĐỊNH LÀ SỐ TẠM. Hàm thuần.
 */
import type { DuToan, KhoiLuong } from './duToan';
import { LOAI_CAN, type GiaBan, type LoaiCan, type ThuVien, type TrangThaiPA } from './kieu';
import { CHI_PHI_MAC_DINH } from './macDinh';
import { boCucTang, canCuaToa, tangCoRieng } from './matBang';

export type TaiChinh = {
  /** Theo loại căn: số căn, DT thông thủy, doanh thu (đã tính hệ số tầng). */
  theoLoai: Record<LoaiCan, { soCan: number; dtTT: number; doanhThu: number }>;
  doanhThuCan: number;
  doanhThuOto: number;
  doanhThuXeMay: number;
  doanhThuTM: number;
  doanhThuGop: number;
  /** Tỷ lệ (0–1) và số tiền trừ do lệch cơ cấu. */
  tyLePhat: number;
  phatLech: number;
  doanhThu: number;
  tongMuc: number;
  chiPhiDat: number;
  chiPhiBan: number;
  tongChiPhi: number;
  loiNhuan: number;
  /** % lợi nhuận / doanh thu; null khi chưa có doanh thu. */
  bienLN: number | null;
  /** Giá bán căn bình quân (đ/m² TT) hiện tại và giá hoà vốn (giữ nguyên các nguồn thu khác). */
  giaBQ: number | null;
  giaHoaVon: number | null;
};

/** Hệ số giá của tầng điển hình thứ `k` (1 = thấp nhất) trong tòa `soTang` tầng. */
export function heSoTang(k: number, soTang: number, b: Pick<GiaBan, 'tangMoiTang' | 'soTangThap' | 'tangThap' | 'tangTren'>): number {
  let h = 1 + (b.tangMoiTang / 100) * (k - 1);
  if (k === soTang && soTang > b.soTangThap) h *= 1 + b.tangTren / 100;
  else if (k <= b.soTangThap) h *= 1 + b.tangThap / 100;
  return h;
}

/** Hiệu quả tài chính. `lech` = điểm lệch cơ cấu của PA (`diemLechPA`), null = không phạt. */
export function tinhTaiChinh(pa: TrangThaiPA, tv: ThuVien, kl: KhoiLuong, dt: DuToan, lech: number | null): TaiChinh {
  const b = (pa.chiPhi ?? CHI_PHI_MAC_DINH).ban;
  const theoLoai = Object.fromEntries(LOAI_CAN.map((l) => [l, { soCan: 0, dtTT: 0, doanhThu: 0 }])) as TaiChinh['theoLoai'];
  for (const t of pa.toa) {
    const mau = tv.toa.get(t.mauId);
    if (!mau) continue;
    const rieng = new Set(tangCoRieng(t));
    const chung = canCuaToa(mau, boCucTang(t, null), tv);
    for (let k = 1; k <= t.soTangDH; k++) {
      const hs = heSoTang(k, t.soTangDH, b);
      for (const [id, n] of rieng.has(k) ? canCuaToa(mau, boCucTang(t, k), tv) : chung) {
        const c = tv.can.get(id);
        if (!c) continue;
        const x = theoLoai[c.loai];
        x.soCan += n;
        x.dtTT += n * c.dt_tt_m2;
        x.doanhThu += n * c.dt_tt_m2 * (b.can[c.loai] ?? 0) * hs;
      }
    }
  }
  const doanhThuCan = LOAI_CAN.reduce((a, l) => a + theoLoai[l].doanhThu, 0);
  const dtTT = LOAI_CAN.reduce((a, l) => a + theoLoai[l].dtTT, 0);
  const doanhThuOto = kl.tong.soChoOto * b.oTo;
  const doanhThuXeMay = kl.tong.soXeMay * b.xeMay;
  const doanhThuTM = kl.tong.dtDe * (b.tyLeBanDe / 100) * b.thuongMai;
  const khac = doanhThuOto + doanhThuXeMay + doanhThuTM;
  const doanhThuGop = doanhThuCan + khac;
  const tyLePhat = lech !== null && Number.isFinite(lech) ? Math.min(1, Math.max(0, (b.phatLech * lech) / 100)) : 0;
  const phatLech = doanhThuGop * tyLePhat;
  const doanhThu = doanhThuGop - phatLech;
  const chiPhiBan = (doanhThu * b.banHang) / 100;
  const tongChiPhi = dt.tongMuc + b.chiPhiDat + chiPhiBan;
  const loiNhuan = doanhThu - tongChiPhi;
  // Hoà vốn: nhân giá căn với f sao cho (f·Rcăn + Rkhác)(1 − phạt)(1 − bán hàng) = tổng mức + đất.
  const conLai = (1 - tyLePhat) * (1 - b.banHang / 100);
  const f = doanhThuCan > 0 && conLai > 0 ? ((dt.tongMuc + b.chiPhiDat) / conLai - khac) / doanhThuCan : null;
  const giaBQ = dtTT > 0 ? doanhThuCan / dtTT : null;
  return {
    theoLoai, doanhThuCan, doanhThuOto, doanhThuXeMay, doanhThuTM, doanhThuGop, tyLePhat, phatLech, doanhThu,
    tongMuc: dt.tongMuc, chiPhiDat: b.chiPhiDat, chiPhiBan, tongChiPhi, loiNhuan,
    bienLN: doanhThu > 0 ? (loiNhuan / doanhThu) * 100 : null,
    giaBQ,
    giaHoaVon: f !== null && giaBQ !== null ? Math.max(0, f * giaBQ) : null,
  };
}

