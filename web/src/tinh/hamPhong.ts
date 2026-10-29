/**
 * Chương trình phòng kỹ thuật tầng hầm (hàm thuần): danh sách phòng + DT tính từ dự án (số căn, dân số, khối tích, số khoang
 * cháy, số tòa). Mỗi số ghi căn cứ: điều khoản QCVN đọc từ kho `E:\OneDrive\_QCVN-TCVN` (PyMuPDF), hoặc "tham khảo hồ sơ"
 * (docs/ham_tham_khao.md), hoặc "giá trị tạm, chờ chủ nhiệm chốt". Người dùng chỉnh DT / bỏ từng loại qua `ThongSoHam.phong`.
 */
import type { ThongSoHam } from './kieu';
import { soTiaBang11 } from './pccc';

export type LoaiPhong =
  | 'beSH' | 'bomSH' | 'bePCCC' | 'bomPCCC' | 'xlnt' | 'vanHanhXlnt'
  | 'tba' | 'mayPhat' | 'baoVe' | 'trucPCCC' | 'dienNhe' | 'khoVatTu'
  | 'quatHut' | 'quatCap' | 'rac';

/** Nhóm bố trí: `dai` = dải kỹ thuật đầu hầm (phòng lớn); `tuong` = sát tường ngoài từng khoang (quạt); `loi` = cạnh lõi tòa (rác). */
export type NhomPhong = 'dai' | 'tuong' | 'loi';

export type MucPhong = {
  loai: LoaiPhong;
  /** Mã duy nhất (loại + khoang / tòa / trạm). */
  ma: string;
  dt: number;
  /** Tầng hầm đặt (1 = B1). */
  tang: number;
  nhom: NhomPhong;
  canCu: string;
  /** Số chưa có căn cứ quy chuẩn: giá trị tạm / tham khảo hồ sơ — hiện nhãn "tạm" trên giao diện. */
  tam: boolean;
  khoang?: number;
  toaId?: string;
  /** Diễn giải cách tính (hiện ở tooltip). */
  dienGiai: string;
};

export type ToaPhong = { id: string; dtxd: number; soTang: number; khoiTich: number; daiHanhLangMm: number };

export type DauVaoPhong = {
  soCan: number;
  danSo: number;
  soTangHam: number;
  dtSanHam: number; // m² một tầng hầm
  caoTang: number;
  soKhoang: number; // số khoang cháy mỗi tầng hầm
  toa: ToaPhong[];
  ts: Pick<Required<ThongSoHam>, 'qSinhHoat' | 'ngayDuTru' | 'kvaMoiCan' | 'phong'>;
};

export type SoLieuPhong = {
  qSH: number; // m³/ngày đêm
  vBeSH: number; // m³
  qNgoai: number; // L/s chữa cháy ngoài nhà (1 đám cháy)
  qTrong: number; // L/s họng nước trong nhà
  vBePCCC: number; // m³
  kva: number;
  soTram: number;
};

/* Căn cứ (trích ngắn, xem docs/ham_tham_khao.md). */
export const CC = {
  qc01Nuoc: 'QCVN 01:2021/BXD 2.10.2 (≥ 80 L/người/ngày đêm)',
  qc06Gio: 'QCVN 06:2022/BXD 5.1.3.3 (3 giờ)',
  qc06B8: 'QCVN 06:2022/BXD Bảng 8 (F1.3)',
  qc06B9: 'QCVN 06:2022/BXD Bảng 9 (F5, hạng C)',
  qc06B11: 'QCVN 06:2022/BXD Bảng 11 (2,5 L/s/tia)',
  qc13KhoC: 'QCVN 13:2018/BXD 2.3.1.1 (gara như kho hạng C)',
  qc13B1: 'QCVN 13:2018/BXD 2.2.2 b) (biến thế khô, chỉ hầm 1)',
  qc06A210: 'QCVN 06:2022/BXD A.2.10 (máy phát không sâu hơn hầm 1)',
  qc04Rac: 'QCVN 04:2021/BXD 2.7.3 (tầng 1 / nửa hầm / hầm 1)',
  qc04Gio: 'QCVN 04:2021/BXD 2.6.5 (6 lần/h, 9 lần/h khi hút khói)',
  thamKhao: 'Tham khảo hồ sơ (docs/ham_tham_khao.md)',
  tam: 'Giá trị tạm, chờ chủ nhiệm chốt',
} as const;

/** QCVN 06:2022 Bảng 8, mục 1 (nhà F1.3, F1.4): L/s theo số tầng và khối tích (nghìn m³: ≤1, ≤5, ≤25, ≤50, >50). "-" lấy cột kế. */
export function luuLuongBang8(soTang: number, khoiTich1000: number): number {
  const hang = soTang <= 3 ? [10, 10, 15, 15, 20] : soTang <= 12 ? [10, 15, 15, 20, 20] : soTang <= 16 ? [20, 20, 20, 25, 25] : [20, 20, 25, 25, 30];
  const cot = khoiTich1000 <= 1 ? 0 : khoiTich1000 <= 5 ? 1 : khoiTich1000 <= 25 ? 2 : khoiTich1000 <= 50 ? 3 : 4;
  return hang[cot];
}

/** QCVN 06:2022 Bảng 9 (nhà F5, bậc I–II, S0, hạng A, B, C): L/s theo khối tích (nghìn m³). */
export function luuLuongBang9C(khoiTich1000: number): number {
  const moc = [50, 100, 200, 300, 400, 500, 600, 700];
  const i = moc.findIndex((m) => khoiTich1000 <= m);
  return i < 0 ? 100 : 20 + 10 * i;
}

/** Hệ số tạm (chờ chủ nhiệm chốt; không có TCVN 2622 / 7336 / 9206 trong kho). */
export const TAM = {
  sauBe: 2.7, // m, sâu nước hữu ích bể (tham khảo M1: 2,7 m)
  phuBe: 1.1, // +10% vách / ngăn 2 khoang (tham khảo DAHY: bể chia 2 khoang)
  sprinklerLs: 30, // L/s
  sprinklerGio: 1,
  thaiTheoCap: 1.0, // nước thải = 100% nước cấp
  luuXlntNgay: 1.0, // ngày lưu bể XLNT
  sauXlnt: 3.0, // m (tham khảo M1 "ngầm sâu 3 m")
  kvaMoiTram: 2000,
  kvaHamMoiM2: 0.02,
};

/** Chương trình phòng; `ts.phong[loai]` chỉnh DT (dt) hoặc bỏ (bo). */
export function chuongTrinhPhong(dv: DauVaoPhong): { ds: MucPhong[]; soLieu: SoLieuPhong } {
  const { soCan, danSo, soTangHam, dtSanHam, caoTang, soKhoang, toa, ts } = dv;
  const day = Math.max(1, Math.round(soTangHam));
  const sau = day; // tầng sâu nhất
  const ds: MucPhong[] = [];
  const them = (m: Omit<MucPhong, 'dt'> & { dt: number }) => {
    const sua = ts.phong?.[m.loai];
    if (sua?.bo) return;
    const dt = sua?.dt != null && sua.dt > 0 ? sua.dt : m.dt;
    ds.push({ ...m, dt: Math.round(dt * 10) / 10, tam: m.tam || (sua?.dt != null && sua.dt > 0) });
  };

  // Nước sinh hoạt: Q = dân số × q (≥ 80 L theo QCVN 01 2.10.2); bể dự trữ `ngayDuTru` ngày (tham khảo DAHY 1,5 ngày), sâu 2,7 m.
  const qSH = (danSo * ts.qSinhHoat) / 1000;
  const vBeSH = qSH * ts.ngayDuTru;
  if (soCan > 0) {
    them({ loai: 'beSH', ma: 'beSH', dt: (vBeSH / TAM.sauBe) * TAM.phuBe, tang: sau, nhom: 'dai', tam: true,
      canCu: `${CC.qc01Nuoc}; ${CC.thamKhao}`,
      dienGiai: `${Math.round(danSo)} người × ${ts.qSinhHoat} L × ${ts.ngayDuTru} ngày = ${Math.round(vBeSH)} m³ ÷ sâu ${TAM.sauBe} m × ${TAM.phuBe}` });
    them({ loai: 'bomSH', ma: 'bomSH', dt: 40, tang: sau, nhom: 'dai', tam: true, canCu: CC.thamKhao, dienGiai: 'KDAS 36 m², M1 40–73 m²' });
  }

  // Nước chữa cháy: ngoài nhà max(Bảng 8 tòa cao nhất, Bảng 9 hầm hạng C) × 3 giờ; trong nhà Bảng 11 × 2,5 L/s × 3 giờ; sprinkler tạm.
  const toaLon = toa.reduce<ToaPhong | null>((a, x) => (!a || x.khoiTich > a.khoiTich ? x : a), null);
  const vHam = dtSanHam * caoTang * day;
  const qB8 = toaLon ? luuLuongBang8(toaLon.soTang, toaLon.khoiTich / 1000) : 0;
  const qB9 = dtSanHam > 0 ? luuLuongBang9C(vHam / 1000) : 0;
  const qNgoai = Math.max(qB8, qB9);
  const tia = toaLon ? soTiaBang11(toaLon.soTang, toaLon.daiHanhLangMm).tia : 2;
  const qTrong = tia * 2.5;
  const vBePCCC = qNgoai > 0 ? qNgoai * 3 * 3.6 + qTrong * 3 * 3.6 + TAM.sprinklerLs * TAM.sprinklerGio * 3.6 : 0;
  if (vBePCCC > 0) {
    them({ loai: 'bePCCC', ma: 'bePCCC', dt: (vBePCCC / TAM.sauBe) * TAM.phuBe, tang: sau, nhom: 'dai', tam: true,
      canCu: `${CC.qc06B8}; ${CC.qc06B9}; ${CC.qc13KhoC}; ${CC.qc06Gio}; ${CC.qc06B11}; sprinkler: ${CC.tam}`,
      dienGiai: `ngoài nhà ${qNgoai} L/s × 3 h + trong nhà ${tia} tia × 2,5 L/s × 3 h + sprinkler ${TAM.sprinklerLs} L/s × ${TAM.sprinklerGio} h (tạm) = ${Math.round(vBePCCC)} m³` });
    them({ loai: 'bomPCCC', ma: 'bomPCCC', dt: 50, tang: sau, nhom: 'dai', tam: true, canCu: CC.thamKhao, dienGiai: 'KDAS 51 m²' });
  }

  // Xử lý nước thải: Q thải = 100% Q cấp (tạm), lưu 1 ngày, sâu 3 m (tham khảo M1) + phòng vận hành.
  if (soCan > 0) {
    const vX = qSH * TAM.thaiTheoCap * TAM.luuXlntNgay;
    them({ loai: 'xlnt', ma: 'xlnt', dt: vX / TAM.sauXlnt, tang: sau, nhom: 'dai', tam: true, canCu: `${CC.thamKhao}; ${CC.tam}`,
      dienGiai: `${Math.round(vX)} m³ ÷ sâu ${TAM.sauXlnt} m (M1: 286–403 m²)` });
    them({ loai: 'vanHanhXlnt', ma: 'vanHanhXlnt', dt: 30, tang: sau, nhom: 'dai', tam: true, canCu: CC.thamKhao, dienGiai: 'M1: 33,6–47 m²' });
  }

  // Điện: công suất tạm theo căn + hầm; mỗi trạm ≤ 2 000 kVA, ít nhất một trạm / tòa (tham khảo M1). Trạm = trung thế 23 + MBA khô 41
  // + hạ thế 74 m² (tham khảo KDAS); chỉ đặt hầm 1 (QCVN 13 2.2.2 b). Máy phát mỗi trạm, hầm 1 (QCVN 06 A.2.10).
  const kva = soCan * ts.kvaMoiCan + dtSanHam * day * TAM.kvaHamMoiM2;
  const soTram = soCan > 0 ? Math.max(Math.ceil(kva / TAM.kvaMoiTram), Math.min(toa.length, Math.ceil(kva / 500)), 1) : 0;
  for (let i = 0; i < soTram; i++) {
    them({ loai: 'tba', ma: `tba${i + 1}`, dt: 23 + 41 + 74, tang: 1, nhom: 'dai', tam: true, canCu: `${CC.qc13B1}; ${CC.thamKhao}`,
      dienGiai: `${Math.round(kva)} kVA (${ts.kvaMoiCan} kVA/căn + ${TAM.kvaHamMoiM2} kVA/m² hầm, tạm) ÷ ${soTram} trạm; trung thế 23 + MBA 41 + hạ thế 74 m² (KDAS)` });
    them({ loai: 'mayPhat', ma: `mayPhat${i + 1}`, dt: 55, tang: 1, nhom: 'dai', tam: true, canCu: `${CC.qc06A210}; ${CC.thamKhao}`, dienGiai: 'M1: 48,9–82,5 m² (máy 1 250 kVA + bồn dầu ngày)' });
  }

  if (soCan > 0) {
    them({ loai: 'baoVe', ma: 'baoVe', dt: 22, tang: 1, nhom: 'dai', tam: true, canCu: CC.thamKhao, dienGiai: 'KDAS P. an ninh 22 m²; M1 42,5 m²' });
    them({ loai: 'trucPCCC', ma: 'trucPCCC', dt: 31, tang: 1, nhom: 'dai', tam: true, canCu: CC.thamKhao, dienGiai: 'KDAS P. trực PCCC 31 m²' });
    them({ loai: 'dienNhe', ma: 'dienNhe', dt: 22, tang: 1, nhom: 'dai', tam: true, canCu: CC.thamKhao, dienGiai: 'KDAS KT điện nhẹ 22 m², kích sóng 21 m²' });
    them({ loai: 'khoVatTu', ma: 'khoVatTu', dt: 25, tang: 1, nhom: 'dai', tam: true, canCu: CC.thamKhao, dienGiai: 'KDAS vật tư không cháy 25 m²' });
  }

  // Quạt hút khói / thải và cấp gió tươi: mỗi khoang cháy mỗi tầng một cặp (tham khảo KDAS "P.QUẠT n.1 / n.2", 27–63 m²).
  for (let k = 1; k <= day; k++) {
    for (let i = 0; i < soKhoang; i++) {
      them({ loai: 'quatHut', ma: `quatHut${k}.${i + 1}`, dt: 30, tang: k, nhom: 'tuong', khoang: i, tam: true, canCu: `${CC.qc04Gio}; ${CC.thamKhao}`, dienGiai: 'một phòng / khoang / tầng (KDAS 27–63 m²)' });
      them({ loai: 'quatCap', ma: `quatCap${k}.${i + 1}`, dt: 25, tang: k, nhom: 'tuong', khoang: i, tam: true, canCu: `${CC.qc04Gio}; ${CC.thamKhao}`, dienGiai: 'cấp gió tươi ≈ 80% gió thải (DAHY)' });
    }
  }

  // Rác: dưới ống đổ rác mỗi tòa, ở hầm 1 (QCVN 04 2.7.3 cho phép tầng 1 / nửa hầm / hầm 1; thông thủy ≥ 2,5 m). DT tạm.
  for (const t of toa) them({ loai: 'rac', ma: `rac.${t.id}`, dt: 12, tang: 1, nhom: 'loi', toaId: t.id, tam: true, canCu: `${CC.qc04Rac}; ${CC.tam}`, dienGiai: 'một phòng / tòa cạnh lõi (M1: phòng rác mỗi lõi)' });

  return { ds, soLieu: { qSH, vBeSH, qNgoai, qTrong, vBePCCC, kva, soTram } };
}
