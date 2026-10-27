import { CAU_TAO_MAC_DINH, type CanMau, type ThuVien, type ToaDat, type ToaMau, type TrangThaiPA } from './kieu';
import { canCuaToa } from './matBang';

/** Kiểm các điều QCVN 04:2021/BXD theo từng tòa. Hàm thuần; thiếu dữ liệu thì "chưa đủ dữ liệu", không bao giờ "đạt". */

export type TrangThaiTuanThu = 'dat' | 'canh_bao' | 'vuot' | 'chua_du_du_lieu' | 'bo_qua';
export type IdKiem =
  | 'qcvn04_min_area'
  | 'qcvn04_small_ratio'
  | 'qcvn04_phong_ngu_9'
  | 'qcvn04_phong_ngu_sang'
  | 'qcvn04_thong_thuy'
  | 'qcvn04_cua_cuu_nan'
  | 'qcvn04_thang_bang_ca'
  | 'qcvn04_nhan_vien';

export type KetQuaKiem = {
  id: IdKiem;
  trangThai: TrangThaiTuanThu;
  /** Điều khoản làm căn cứ (đúng như trong quy_tac.json). */
  canCu: string;
  /** Tham số thế vào câu giải thích i18n `tt.<id>.<trangThai>`; số hoặc chuỗi. */
  tham: Record<string, number | string>;
};

export const CAN_CU: Record<IdKiem, string> = {
  qcvn04_min_area: 'QCVN 04:2021/BXD 2.2.4.1',
  qcvn04_small_ratio: 'QCVN 04:2021/BXD 2.2.4.2',
  qcvn04_phong_ngu_9: 'QCVN 04:2021/BXD 2.2.4.4',
  qcvn04_phong_ngu_sang: 'QCVN 04:2021/BXD 2.2.4.4',
  qcvn04_thong_thuy: 'QCVN 04:2021/BXD 2.2.10',
  qcvn04_cua_cuu_nan: 'QCVN 04:2021/BXD 2.2.11',
  qcvn04_thang_bang_ca: 'QCVN 04:2021/BXD chú thích 2.4.1',
  qcvn04_nhan_vien: 'QCVN 04:2021/BXD 2.2.18',
};

export const NGUONG = {
  dtCanMin: 25, // m²
  dtCanNho: 45, // m²
  tyLeCanNhoMax: 25, // %
  phongNguMin: 9, // m²
  thongThuyO: 2.6, // m — phòng ở
  thongThuyBepWc: 2.3, // m
  thongThuyHamKyThuat: 2.0, // m
  cuaCuuNanMm: 600, // 600 × 600 mm
  nhanVienM2MoiNguoi: 5, // m²/người
} as const;

const EPS = 1e-9;
const r2 = (x: number) => Math.round(x * 100) / 100;

/** Các mẫu căn có mặt trong tòa (một lần mỗi mẫu) kèm số căn mỗi tầng. */
export function canTrongToa(mau: ToaMau, toa: ToaDat, tv: ThuVien): { can: CanMau; n: number }[] {
  const dem = new Map<string, number>();
  for (const [id, n] of canCuaToa(mau, toa, tv)) dem.set(id, (dem.get(id) ?? 0) + n);
  return [...dem].flatMap(([id, n]) => { const c = tv.can.get(id); return c ? [{ can: c, n }] : []; });
}

const kq = (id: IdKiem, trangThai: TrangThaiTuanThu, tham: KetQuaKiem['tham'] = {}): KetQuaKiem => ({ id, trangThai, canCu: CAN_CU[id], tham });

/** 2.2.4.1 — mọi căn có DT thông thủy ≥ 25 m². */
export function kiemDtCanToiThieu(cs: { can: CanMau; n: number }[]): KetQuaKiem {
  if (!cs.length) return kq('qcvn04_min_area', 'bo_qua');
  const sai = cs.filter((x) => x.can.dt_tt_m2 < NGUONG.dtCanMin - EPS);
  if (!sai.length) return kq('qcvn04_min_area', 'dat', { min: NGUONG.dtCanMin });
  return kq('qcvn04_min_area', 'vuot', { so: sai.reduce((a, x) => a + x.n, 0), mau: sai.length, min: NGUONG.dtCanMin, ten: sai.map((x) => x.can.ten_vi).join(', ') });
}

/** 2.2.4.2 — với nhà ở thương mại, số căn có DT thông thủy ≤ 45 m² không quá 25 % tổng số căn (vượt = cảnh báo). */
export function kiemTyLeCanNho(cs: { can: CanMau; n: number }[], nhom: 'tm' | 'xh'): KetQuaKiem {
  const tong = cs.reduce((a, x) => a + x.n, 0);
  if (nhom !== 'tm' || !tong) return kq('qcvn04_small_ratio', 'bo_qua');
  const nho = cs.filter((x) => x.can.dt_tt_m2 <= NGUONG.dtCanNho + EPS).reduce((a, x) => a + x.n, 0);
  const pct = (nho / tong) * 100;
  return kq('qcvn04_small_ratio', pct > NGUONG.tyLeCanNhoMax + EPS ? 'canh_bao' : 'dat', { pct: r2(pct), max: NGUONG.tyLeCanNhoMax, nho, tong });
}

/** 2.2.4.4 — phòng ngủ ≥ 9 m². Cần `phong` của mẫu căn. */
export function kiemPhongNgu9(cs: { can: CanMau; n: number }[]): KetQuaKiem {
  const co = cs.filter((x) => x.can.phong?.length);
  const thieu = cs.length - co.length;
  if (!co.length) return kq('qcvn04_phong_ngu_9', 'chua_du_du_lieu', { thieu, tong: cs.length });
  const sai: string[] = [];
  for (const x of co) for (const p of x.can.phong!) if (p.loai === 'ngu' && p.dt_m2 < NGUONG.phongNguMin - EPS) sai.push(`${x.can.ten_vi}/${p.ten} ${r2(p.dt_m2)}`);
  if (sai.length) return kq('qcvn04_phong_ngu_9', 'vuot', { so: sai.length, min: NGUONG.phongNguMin, ten: sai.join('; ') });
  if (thieu) return kq('qcvn04_phong_ngu_9', 'chua_du_du_lieu', { thieu, tong: cs.length });
  return kq('qcvn04_phong_ngu_9', 'dat', { min: NGUONG.phongNguMin });
}

/** 2.2.4.4 — phòng ngủ có tường ngoài để thông thoáng, lấy sáng tự nhiên. Cần `phong[].ke_mat_ngoai`. */
export function kiemPhongNguSang(cs: { can: CanMau; n: number }[]): KetQuaKiem {
  let biet = 0, thieu = 0;
  const sai: string[] = [];
  for (const x of cs) {
    const ngu = (x.can.phong ?? []).filter((p) => p.loai === 'ngu');
    if (!ngu.length) { if (!x.can.phong?.length) thieu++; continue; }
    for (const p of ngu) {
      if (p.ke_mat_ngoai === undefined) { thieu++; continue; }
      biet++;
      if (!p.ke_mat_ngoai) sai.push(`${x.can.ten_vi}/${p.ten}`);
    }
  }
  if (sai.length) return kq('qcvn04_phong_ngu_sang', 'vuot', { so: sai.length, ten: sai.join('; ') });
  if (!biet || thieu) return kq('qcvn04_phong_ngu_sang', 'chua_du_du_lieu', { thieu, tong: cs.length });
  return kq('qcvn04_phong_ngu_sang', 'dat');
}

/** 2.2.10 — thông thủy = cao tầng − dày sàn + trần; tầng căn hộ ≥ 2,6 m; tầng đế chỉ cảnh báo nếu < 2,6 m (không rõ có phòng ở), vượt nếu < 2,0 m. */
export function kiemThongThuy(toa: Pick<ToaDat, 'caoDH' | 'caoDe' | 'soTangDe' | 'soTangDH'>, day: number): KetQuaKiem {
  const tt = (c: number) => r2(c - day);
  const dh = tt(toa.caoDH);
  const de = tt(toa.caoDe);
  const tham = { dh, de: toa.soTangDe > 0 ? de : '—', day, min: NGUONG.thongThuyO, minBep: NGUONG.thongThuyBepWc, minKt: NGUONG.thongThuyHamKyThuat };
  if (toa.soTangDH > 0 && dh < NGUONG.thongThuyO - EPS) return kq('qcvn04_thong_thuy', 'vuot', tham);
  if (toa.soTangDe > 0 && de < NGUONG.thongThuyHamKyThuat - EPS) return kq('qcvn04_thong_thuy', 'vuot', { ...tham, tang: 'de' });
  if (toa.soTangDe > 0 && de < NGUONG.thongThuyO - EPS) return kq('qcvn04_thong_thuy', 'canh_bao', { ...tham, tang: 'de' });
  return kq('qcvn04_thong_thuy', 'dat', tham);
}

const coLogia = (c: CanMau) => (c.logia_lui?.length ?? 0) > 0;

/** 2.2.11 — căn không có ban công / lô gia phải có cửa sổ tường ngoài ≥ 600×600 mm. Dữ liệu cửa chưa có thì cảnh báo cần kiểm. */
export function kiemCuaCuuNan(cs: { can: CanMau; n: number }[]): KetQuaKiem {
  if (!cs.length) return kq('qcvn04_cua_cuu_nan', 'bo_qua');
  const khongLogia = cs.filter((x) => !coLogia(x.can));
  const thieu = khongLogia.filter((x) => x.can.cua_cuu_nan === undefined);
  const khong = khongLogia.filter((x) => x.can.cua_cuu_nan === false);
  const tham = { mm: NGUONG.cuaCuuNanMm };
  if (khong.length) return kq('qcvn04_cua_cuu_nan', 'vuot', { ...tham, so: khong.reduce((a, x) => a + x.n, 0), ten: khong.map((x) => x.can.ten_vi).join(', ') });
  if (thieu.length) return kq('qcvn04_cua_cuu_nan', 'canh_bao', { ...tham, so: thieu.reduce((a, x) => a + x.n, 0), mau: thieu.length, ten: thieu.map((x) => x.can.ten_vi).join(', ') });
  return kq('qcvn04_cua_cuu_nan', 'dat', tham);
}

/** Chú thích 2.4.1 — nhà có thang máy phải có ≥ 1 thang chở được băng ca. Chưa khai thì cảnh báo. */
export function kiemThangBangCa(toa: Pick<ToaDat, 'thangBangCa'>): KetQuaKiem {
  if (toa.thangBangCa === undefined) return kq('qcvn04_thang_bang_ca', 'canh_bao');
  return kq('qcvn04_thang_bang_ca', toa.thangBangCa ? 'dat' : 'vuot');
}

/** 2.2.18 — không gian nhân viên quản lý, trông xe, bảo vệ, kỹ thuật ≥ 5 m²/người. Chưa khai thì bỏ qua. */
export function kiemNhanVien(toa: Pick<ToaDat, 'nhanVien'>): KetQuaKiem {
  const nv = toa.nhanVien;
  if (!nv || !(nv.so > 0)) return kq('qcvn04_nhan_vien', 'bo_qua');
  const mot = nv.dtM2 / nv.so;
  return kq('qcvn04_nhan_vien', mot < NGUONG.nhanVienM2MoiNguoi - EPS ? 'vuot' : 'dat', { mot: r2(mot), min: NGUONG.nhanVienM2MoiNguoi, so: nv.so, dt: r2(nv.dtM2) });
}

/** Toàn bộ kết quả QCVN 04 cho một tòa, theo thứ tự điều khoản. */
export function kiemQCVN04(pa: Pick<TrangThaiPA, 'cauTao'>, toa: ToaDat, mau: ToaMau, tv: ThuVien): KetQuaKiem[] {
  const cs = canTrongToa(mau, toa, tv);
  const day = pa.cauTao?.daySanTranM ?? CAU_TAO_MAC_DINH.daySanTranM;
  return [
    kiemDtCanToiThieu(cs),
    kiemTyLeCanNho(cs, mau.nhom),
    kiemPhongNgu9(cs),
    kiemPhongNguSang(cs),
    kiemThongThuy(toa, day),
    kiemCuaCuuNan(cs),
    kiemThangBangCa(toa),
    kiemNhanVien(toa),
  ];
}
