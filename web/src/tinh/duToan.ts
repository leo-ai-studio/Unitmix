/**
 * Dự toán sơ bộ: khối lượng lấy tự động từ mô hình (PA + thư viện), nhân đơn giá, cộng các lớp tỷ lệ.
 * Cơ cấu tham khảo tổng mức đầu tư theo Nghị định 10/2021/NĐ-CP (QS kiểm lại): chi phí xây dựng, thiết bị,
 * quản lý dự án, tư vấn đầu tư xây dựng, chi phí khác, dự phòng (khối lượng + trượt giá). Chi phí đất nhập tay ở phần tài chính.
 * MỌI ĐƠN GIÁ / TỶ LỆ MẶC ĐỊNH LÀ SỐ TẠM, chờ chủ nhiệm / QS chốt. Hàm thuần.
 */
import { coCauRong, congCoCau, demCan } from './coCau';
import { tinhHamSo, M2_MOI_CHO_OTO, M2_MOI_XE_MAY } from './ham';
import { khoiDeLo } from './deLo';
import { chanToa, dienTich } from './hinhHoc';
import { LOAI_CAN, PHAN_HAM_MAC_DINH, type ChiPhiPA, type Diem, type KhoaDongDuToan, type LoaiCan, type NhomChiPhi, type ThuVien, type TrangThaiPA } from './kieu';
import { CHI_PHI_MAC_DINH, chuanHoaHam } from './macDinh';
import { canCaToa } from './matBang';
import { mauToa } from './canThem';

/** QCVN 04:2021/BXD 2.4.2: tối thiểu 1 thang máy / 70 căn (dùng khi chưa đếm được thang từ lõi; QS / chủ nhiệm kiểm lại). */
export const CAN_MOI_THANG = 70;
export { M2_MOI_CHO_OTO, M2_MOI_XE_MAY };

export type KhoiLuongToa = {
  toaId: string;
  loId: string;
  mauId: string;
  /** DT sàn một tầng điển hình (= chân tháp), m². */
  dtSanDH: number;
  soTangDH: number;
  dtThap: number; // m² sàn khối tháp (mọi tầng điển hình)
  dtDe: number; // m² sàn khối đế phần của tòa
  dtApMai: number;
  soCan: Record<LoaiCan, number>;
  tongCan: number;
  dtTT: number; // m² thông thủy căn
  chuVi: number; // m, chu vi chân tháp
  caoThap: number; // m, chiều cao mặt đứng khối tháp (tầng điển hình + áp mái)
  dtMatNgoai: number; // m², mặt ngoài khối tháp
  soThang: number;
};
export type KhoiLuongLo = {
  loId: string;
  kyHieu: string;
  dtLo: number;
  dtChiemDat: number;
  /** DT sân / cây xanh trên lô = DT lô − DT chiếm đất (m²). */
  dtSan: number;
  dtDe: number; // m² sàn đế cả lô
  chuViDe: number;
  dtMatNgoaiDe: number;
  dtHam: number;
  soChoOto: number;
  dtXeMay: number;
  soXeMay: number;
  soKho: number;
  /** 'rai' = đếm từ rải hầm; 'uoc' = ước theo DT hầm; 'khong' = lô không có hầm. */
  nguonHam: 'rai' | 'uoc' | 'khong';
  toa: KhoiLuongToa[];
};
export type TongKhoiLuong = {
  dtThap: number; dtDe: number; dtApMai: number; dtHam: number;
  dtTrenCot0: number; dtSanTong: number;
  soCan: Record<LoaiCan, number>; tongCan: number; dtTT: number;
  dtMatNgoai: number; soThang: number;
  soChoOto: number; dtXeMay: number; soXeMay: number; soKho: number;
  dtSanVuon: number;
};
export type KhoiLuong = { lo: KhoiLuongLo[]; tong: TongKhoiLuong };

/** Chu vi một đa giác kín (m). */
export function chuVi(poly: Diem[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    s += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return poly.length >= 2 ? s : 0;
}

/** Số thang theo QCVN 04 2.4.2 (1 thang / 70 căn); tòa có căn thì ít nhất 1. */
export const soThangTheoCan = (soCan: number): number => (soCan > 0 ? Math.max(1, Math.ceil(soCan / CAN_MOI_THANG)) : 0);

/**
 * Khối lượng từng lô / tòa. `coRaiHam` = false thì bỏ rải hầm (nhanh), số chỗ đỗ ước theo DT hầm.
 * Diện tích là diện tích hình học thật (không nhân hệ số tính HSSDĐ).
 */
/** Hầm chỉ tính số (tinh/ham.ts `tinhHamSo`): DT sàn × số tầng, số chỗ ô tô theo tỷ lệ đỗ xe; tham số thứ ba giữ cho nơi gọi cũ (bỏ qua). */
export function tinhKhoiLuong(pa: TrangThaiPA, tv: ThuVien, _coRaiHam = false): KhoiLuong {
  const dem = demCan(pa, tv);
  const ph = pa.phanHam ?? PHAN_HAM_MAC_DINH;
  const ts = chuanHoaHam(pa.ham);
  const ds: KhoiLuongLo[] = [];
  for (const lo of pa.lo) {
    const dtLo = lo.ranh.length >= 3 ? dienTich(lo.ranh) : 0;
    const toaLo = pa.toa.filter((t) => t.loId === lo.id && tv.toa.has(t.mauId));
    const chan = toaLo.map((t) => chanToa(mauToa(tv, t)!, t));
    const kqDe = khoiDeLo(lo, chan, toaLo.map((t) => t.deOffset));
    const de = kqDe.vung;
    const dtChiemDat = toaLo.length ? kqDe.dt : 0;
    const tongChan = chan.reduce((a, p) => a + dienTich(p), 0);
    const caoDe = toaLo.length ? Math.max(...toaLo.map((t) => t.soTangDe * t.caoDe)) : 0;
    const chuViDe = caoDe > 0 ? de.reduce((a, p) => a + chuVi(p), 0) : 0;

    const toa: KhoiLuongToa[] = toaLo.map((t, i) => {
      const mau = mauToa(tv, t)!;
      const dtSanDH = dienTich(chan[i]);
      const soCan = dem[t.id] ?? coCauRong();
      const tongCan = LOAI_CAN.reduce((a, l) => a + soCan[l], 0);
      const dtTT = canCaToa(mau, t, tv).reduce((a, [id, n]) => a + n * (tv.can.get(id)?.dt_tt_m2 ?? 0), 0);
      const cv = chuVi(chan[i]);
      const caoThap = t.caoDH * (t.soTangDH + (t.coApMai ? 1 : 0));
      return {
        toaId: t.id, loId: lo.id, mauId: t.mauId, dtSanDH, soTangDH: t.soTangDH,
        dtThap: dtSanDH * t.soTangDH,
        dtDe: tongChan > 0 ? t.soTangDe * dtChiemDat * (dtSanDH / tongChan) : 0,
        dtApMai: t.coApMai ? dtSanDH : 0,
        soCan, tongCan, dtTT, chuVi: cv, caoThap, dtMatNgoai: cv * caoThap,
        soThang: soThangTheoCan(tongCan),
      };
    });
    const dtDe = toa.reduce((a, x) => a + x.dtDe, 0);
    const tongCanLo = toa.reduce((a, x) => a + x.tongCan, 0);

    // Hầm: chỉ tính số theo DT ranh hầm × số tầng (không bố trí mặt bằng) — chỉ lô có tòa.
    let dtHam = 0, soChoOto = 0, dtXeMay = 0, soKho = 0;
    let nguonHam: KhoiLuongLo['nguonHam'] = 'khong';
    const soTangHam = toaLo.length ? (lo.temDat.chiTieu.tangHam ?? ts.soTang) : 0;
    if (soTangHam > 0) {
      nguonHam = 'uoc';
      const hs = tinhHamSo({ ...pa, ham: { ...pa.ham, soTang: soTangHam } }, tv, lo);
      dtHam = hs ? hs.dtXdHam : soTangHam * dtLo;
      dtXeMay = ts.dtXeMay ?? 6 * tongCanLo; // QCVN 04:2021/BXD 2.2.17.1 b): ≥ 6 m² xe máy / căn
      soChoOto = Math.max(0, Math.floor((dtHam * ph.doXe - dtXeMay) / M2_MOI_CHO_OTO));
      soKho = Math.round(ts.khoMoiTang) * soTangHam;
    }
    ds.push({
      loId: lo.id, kyHieu: lo.temDat.kyHieu, dtLo, dtChiemDat, dtSan: Math.max(0, dtLo - dtChiemDat),
      dtDe, chuViDe, dtMatNgoaiDe: chuViDe * caoDe,
      dtHam, soChoOto, dtXeMay, soXeMay: Math.floor(dtXeMay / M2_MOI_XE_MAY), soKho, nguonHam, toa,
    });
  }

  const toaAll = ds.flatMap((l) => l.toa);
  const cong = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);
  const dtThap = cong(toaAll, (x) => x.dtThap), dtDe = cong(ds, (x) => x.dtDe), dtApMai = cong(toaAll, (x) => x.dtApMai);
  const dtHam = cong(ds, (x) => x.dtHam);
  const soCan = congCoCau(toaAll.map((x) => x.soCan));
  return {
    lo: ds,
    tong: {
      dtThap, dtDe, dtApMai, dtHam,
      dtTrenCot0: dtThap + dtDe + dtApMai,
      dtSanTong: dtThap + dtDe + dtApMai + dtHam,
      soCan, tongCan: LOAI_CAN.reduce((a, l) => a + soCan[l], 0), dtTT: cong(toaAll, (x) => x.dtTT),
      dtMatNgoai: cong(toaAll, (x) => x.dtMatNgoai) + cong(ds, (x) => x.dtMatNgoaiDe),
      soThang: cong(toaAll, (x) => x.soThang),
      soChoOto: cong(ds, (x) => x.soChoOto), dtXeMay: cong(ds, (x) => x.dtXeMay), soXeMay: cong(ds, (x) => x.soXeMay), soKho: cong(ds, (x) => x.soKho),
      // Sân / cây xanh chỉ tính lô có tòa (lô cây xanh, mặt nước riêng không vào dự toán nhà).
      dtSanVuon: cong(ds.filter((l) => l.toa.length), (x) => x.dtSan),
    },
  };
}

/* ---------- Dự toán ---------- */

/**
 * Tỷ lệ chi phí QLDA công trình dân dụng theo quy mô chi phí XD + TB (chưa VAT) — TT 38/2026/TT-BXD Bảng 1.1,
 * nội suy tuyến tính, ngoài dải lấy mốc biên; ×0,8 khi chi phí thiết bị ≥ 50 %. Bảng chép từ app cũ
 * (`MDI_Unitmix_v4/data/master/dinh_muc_du_toan.json` → `qlda_tt38`, nguồn tệp KBB đối chiếu TT 38-2026) — QS kiểm lại.
 */
export const QLDA_TT38 = {
  mocTy: [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 30000],
  danDung: [3.446, 2.923, 2.61, 2.017, 1.886, 1.514, 1.239, 0.958, 0.711, 0.51, 0.381, 0.305],
  kThietBi50: 0.8,
};
/** % QLDA theo TT 38/2026 cho chi phí XD + TB `ty` (tỷ đ), phần thiết bị `phanTB` (0…1). */
export function tyLeQldaTT38(ty: number, phanTB = 0): number {
  const { mocTy: m, danDung: v } = QLDA_TT38;
  let p = v[v.length - 1];
  if (ty <= m[0]) p = v[0];
  else for (let i = 1; i < m.length; i++) if (ty <= m[i]) { p = v[i - 1] - ((v[i - 1] - v[i]) * (ty - m[i - 1])) / (m[i] - m[i - 1]); break; }
  return phanTB >= 0.5 ? p * QLDA_TT38.kThietBi50 : p;
}

/** Một dòng dự toán: nhóm, đơn vị, khối lượng lấy từ tổng khối lượng. */
export type MauDong = { khoa: KhoaDongDuToan; nhom: NhomChiPhi; donVi: string; kl: (t: TongKhoiLuong) => number };
export const DONG_DU_TOAN: MauDong[] = [
  // Định mức app cũ tính mọi gói theo m² sàn nổi (tháp + đế + áp mái); hầm một dòng riêng theo m² sàn hầm.
  { khoa: 'ngam', nhom: 'xd', donVi: 'm²', kl: (t) => t.dtHam },
  { khoa: 'coc', nhom: 'xd', donVi: 'm²', kl: (t) => t.dtTrenCot0 },
  { khoa: 'ketCau', nhom: 'xd', donVi: 'm²', kl: (t) => t.dtTrenCot0 },
  { khoa: 'hoanThien', nhom: 'xd', donVi: 'm²', kl: (t) => t.dtTrenCot0 },
  { khoa: 'cua', nhom: 'xd', donVi: 'm²', kl: (t) => t.dtTrenCot0 },
  { khoa: 'haTang', nhom: 'xd', donVi: 'm²', kl: (t) => t.dtSanVuon },
  { khoa: 'thangMay', nhom: 'tb', donVi: 'm²', kl: (t) => t.dtTrenCot0 },
  { khoa: 'pccc', nhom: 'tb', donVi: 'm²', kl: (t) => t.dtTrenCot0 },
  { khoa: 'me', nhom: 'tb', donVi: 'm²', kl: (t) => t.dtTrenCot0 },
];
export const NHOM_CHI_PHI: NhomChiPhi[] = ['xd', 'tb'];

export type DongDuToan = { khoa: KhoaDongDuToan; nhom: NhomChiPhi; donVi: string; kl: number; donGia: number; thanhTien: number };
export type NhomDuToan = { nhom: NhomChiPhi; dieuChinh: number; khac: number; congDong: number; tong: number };
export type DuToan = {
  dong: DongDuToan[];
  nhom: Record<NhomChiPhi, NhomDuToan>;
  xd: number; tb: number;
  qlda: number; tuVan: number; khac: number;
  /** % QLDA đã dùng (tra TT 38/2026 hoặc nhập tay). */
  tlQlda: number;
  truocDuPhong: number;
  duPhongKL: number; duPhongTruotGia: number;
  /** Tổng mức đầu tư chưa gồm chi phí đất (đ). */
  tongMuc: number;
  /** Suất đầu tư: đ/m² sàn (cả hầm), đ/căn; null khi chưa có sàn / căn. */
  suatM2: number | null;
  suatCan: number | null;
};

/** Dự toán từ khối lượng và chi phí của PA (thiếu thì dùng mặc định — số tạm). */
export function tinhDuToan(kl: KhoiLuong, cp: ChiPhiPA = CHI_PHI_MAC_DINH): DuToan {
  const dong: DongDuToan[] = DONG_DU_TOAN.map((m) => {
    const k = m.kl(kl.tong), dg = cp.donGia[m.khoa] ?? 0;
    const thanhTien = k * dg * (1 + (cp.dieuChinh[m.nhom] ?? 0) / 100);
    return { khoa: m.khoa, nhom: m.nhom, donVi: m.donVi, kl: k, donGia: dg, thanhTien };
  });
  const nhom = Object.fromEntries(NHOM_CHI_PHI.map((n) => {
    const congDong = dong.filter((d) => d.nhom === n).reduce((a, d) => a + d.thanhTien, 0);
    const khac = cp.khac[n] ?? 0;
    return [n, { nhom: n, dieuChinh: cp.dieuChinh[n] ?? 0, khac, congDong, tong: congDong + khac }];
  })) as Record<NhomChiPhi, NhomDuToan>;
  const xd = nhom.xd.tong, tb = nhom.tb.tong, coSo = xd + tb;
  const tlQlda = cp.qldaTT38 ? tyLeQldaTT38(coSo / 1e9, coSo > 0 ? tb / coSo : 0) : cp.tyLe.qlda;
  const qlda = (coSo * tlQlda) / 100, tuVan = (coSo * cp.tyLe.tuVan) / 100, khac = (coSo * cp.tyLe.khac) / 100;
  const truocDuPhong = coSo + qlda + tuVan + khac;
  const duPhongKL = (truocDuPhong * cp.tyLe.duPhongKL) / 100;
  const duPhongTruotGia = (truocDuPhong * cp.tyLe.duPhongTruotGia) / 100;
  const tongMuc = truocDuPhong + duPhongKL + duPhongTruotGia;
  return {
    dong, nhom, xd, tb, qlda, tuVan, khac, tlQlda, truocDuPhong, duPhongKL, duPhongTruotGia, tongMuc,
    suatM2: kl.tong.dtSanTong > 0 ? tongMuc / kl.tong.dtSanTong : null,
    suatCan: kl.tong.tongCan > 0 ? tongMuc / kl.tong.tongCan : null,
  };
}
