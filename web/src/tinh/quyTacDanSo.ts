/**
 * Quy tắc tính dân số nhà chung cư theo tỉnh / thành (địa giới CŨ, trước sáp nhập 1/7/2025).
 *
 * Nguồn: `E:\Projects\MDI_Unitmix_v4\docs\quy-tac-tinh-dan-so-chung-cu.md` (thuật toán 4 bước, 5 kiểu QĐ A–E, bảng
 * Hà Nội / TP.HCM) và khối `TINH` / `occPhongO` / `occQD83` trong `prototype/shell.src.html` của app cũ.
 * Đối chiếu bản gốc (29/10/2026): QĐ 32/2025 TP.HCM theo kho `E:\OneDrive\_QCVN-TCVN\32_2025_QĐ-UBND.pdf`; QĐ 34/2024 +
 * 39/2026 Hà Nội, QĐ 83/2026 TP.HCM, QĐ 11/2024 Hải Dương, QĐ 05/2025 Phú Yên, QĐ 09/2025 Đồng Nai theo toàn văn trên
 * CSDL quốc gia về pháp luật (vbpl.vn) → `daDoiChieu: true`, `dieu` ghi tận Điều / khoản / điểm.
 *
 * Loại hình (NOTM / NOXH / TĐC): QĐ tỉnh chỉ quy định cho loại hình ghi ở `loaiHinh` (thiếu = QĐ không phân biệt loại
 * hình → áp mọi loại hình). Loại hình QĐ không quy định → mặc định quốc gia `FALLBACK_QG_LH` (P = S / 32): QCVN 01:2021/BXD
 * và QCVN 04:2021/BXD (kho local) không có chỉ tiêu người / căn hay m²/người riêng cho NOXH / TĐC; QCVN 01:2026/BXD chưa có
 * trong kho để rà.
 *
 * Bảng là THANG DIỆN TÍCH SỬ DỤNG căn (= DT thông thủy, QCVN 04:2021/BXD 1.4.13), không tra theo số phòng — như app cũ;
 * QĐ 32/2025 Điều 4 khoản 4 cũng cho lấy theo DT khi số phòng và DT không thống nhất. Riêng Đồng Nai (QĐ 09/2025) cùng dải
 * DT nhưng khác số người theo số phòng ở → `bangPhong`, tra theo loại căn.
 * Không bịa trị số: tỉnh có số hiệu QĐ nhưng chưa có bảng trị số trong nguồn thì `phuongPhap` = null → tính theo
 * mốc quốc gia (fallback) và gắn cờ "giá trị tạm, chờ chủ nhiệm chốt".
 */

import type { GiaiDoan, LoaiCan, LoaiHinh } from './kieu';

export type { GiaiDoan, LoaiHinh };
export const LOAI_HINH: LoaiHinh[] = ['notm', 'noxh', 'tdc'];
/** Kiểu QĐ tỉnh (tài liệu nguồn §2): A tách 3 nhóm · B gộp NOXH + TĐC · C TĐC theo NOTM · D một bảng chung · E công thức S / S_tb. */
export type KieuQD = 'A' | 'B' | 'C' | 'D' | 'E';

/** Một mốc: căn có DT ≤ `den` (hoặc < `den` khi `nho`) và trên mốc trước → `nguoi` người. Mốc cuối `den` = Infinity. */
export type MocDT = { den: number; nguoi: number; nho?: boolean };
export type BangDanSo = { moc: MocDT[]; dtMin: number; dieu: string };

export type PhuongPhap =
  /** Tra bảng theo loại hình: `bang[loaiHinh] ?? bang.chung ?? bang.notm`. */
  | { kieu: 'bang'; bang: Partial<Record<LoaiHinh | 'chung', BangDanSo>> }
  /** P = S / S_tb (S = DT sử dụng căn). `tam` = trị số S_tb chưa có trong nguồn. */
  | { kieu: 'sTb'; sTb: number; dieu: string; tam?: boolean }
  /** QĐ 83/2026 TP.HCM: ≤ 45 m² → 1 · NOTM / TĐC > 45–160 → S ÷ 32 · > 160 → 5 · NOXH > 45 → S ÷ 32. */
  | { kieu: 'qd83'; sTb: number; dieu: string }
  /**
   * Bảng theo SỐ PHÒNG Ở + DT (Đồng Nai QĐ 09/2025): mỗi cột số phòng một thang DT, cùng dải DT khác số người theo số phòng.
   * Số phòng lấy theo loại căn (`SO_PHONG_O`); DT ngoài thang cột đó → dòng gần nhất + cờ ngoài bảng.
   */
  | { kieu: 'bangPhong'; phong: Record<SoPhongO, BangDanSo>; dieu: string };

/** Số phòng ở của căn (1 · 2 · 3 · 4 trở lên). */
export type SoPhongO = 1 | 2 | 3 | 4;

export type QuyTacTinh = {
  id: string;
  ten: string;
  /** Số hiệu quyết định đang áp; null = tỉnh chưa có QĐ riêng (fallback quốc gia). */
  qd: string | null;
  kieu: KieuQD | null;
  hieuLuc?: string;
  /** Đã đối chiếu từng mốc với bản gốc trong kho QCVN-TCVN. */
  daDoiChieu: boolean;
  /** Phương pháp theo giai đoạn; null = chưa có trị số trong nguồn → dùng fallback quốc gia, gắn cờ tạm. */
  phuongPhap: Record<GiaiDoan, PhuongPhap> | null;
  /** Loại hình QĐ có quy định; thiếu = QĐ không phân biệt loại hình (áp mọi loại hình). Ngoài danh sách → `FALLBACK_QG_LH`. */
  loaiHinh?: LoaiHinh[];
  /** Cách thay thế "bình quân người / căn" mà QĐ cho phép — chỉ ở giai đoạn / loại hình QĐ ghi (thiếu = mọi). */
  bqCan?: { so: number; dieu: string; tam?: boolean; giaiDoan?: GiaiDoan; loaiHinh?: LoaiHinh[] };
  /** Tỉnh cũ đã sáp nhập và QĐ cũ hết hiệu lực → áp quy tắc của tỉnh này. */
  theo?: string;
  ghiChu?: string;
};

const VO_CUC = Number.POSITIVE_INFINITY;
/** QCVN 04:2021/BXD 2.2.4.1: căn hộ chung cư tối thiểu 25 m². */
export const DT_CAN_MIN = 25;
/** Mốc quốc gia DT sàn nhà ở bình quân ~32 m²/người — Chiến lược phát triển nhà ở quốc gia 2021–2030 (QĐ 2161/QĐ-TTg). */
export const S_TB_QUOC_GIA = 32;
const DIEU_QG = 'QĐ 2161/QĐ-TTg (Chiến lược phát triển nhà ở quốc gia 2021–2030): ~32 m² sàn nhà ở / người';

/**
 * Mặc định quốc gia cho loại hình QĐ tỉnh không quy định (VD TĐC ở Hà Nội): không quy chuẩn / tiêu chuẩn nào trong kho
 * cho chỉ tiêu riêng NOXH / TĐC → dùng mốc chung 32 m²/người.
 */
export const FALLBACK_QG_LH: PhuongPhap = {
  kieu: 'sTb', sTb: S_TB_QUOC_GIA,
  dieu: `${DIEU_QG} — mặc định quốc gia: QĐ tỉnh không quy định riêng loại hình này; QCVN 01:2021/BXD, QCVN 04:2021/BXD không có chỉ tiêu người/căn riêng cho NOXH, TĐC`,
};

/* ---------- Hà Nội · QĐ 34/2024/QĐ-UBND (QĐ 39/2026/QĐ-UBND, hiệu lực 15/4/2026, không sửa Điều 4) · kiểu C ---------- */
/** Điều 4 khoản 1: 25–45 → 1 · trên 45–70 → 2 · trên 70–100 → 3 · trên 100–125 → 4 · từ 125 trở lên → 5 (125 đúng mốc lấy dòng trên). */
const HN_NOTM: BangDanSo = {
  dtMin: 25, dieu: 'QĐ 34/2024/QĐ-UBND Hà Nội, Điều 4 khoản 1 (nhà ở thương mại)',
  moc: [{ den: 45, nguoi: 1 }, { den: 70, nguoi: 2 }, { den: 100, nguoi: 3 }, { den: 125, nguoi: 4 }, { den: VO_CUC, nguoi: 5 }],
};
/** Điều 4 khoản 2: 25–40 → 1 · trên 40–55 → 2 · trên 55–70 → 3 · trên 70–77 → 4. */
const HN_NOXH: BangDanSo = {
  dtMin: 25, dieu: 'QĐ 34/2024/QĐ-UBND Hà Nội, Điều 4 khoản 2 (nhà ở xã hội)',
  moc: [{ den: 40, nguoi: 1 }, { den: 55, nguoi: 2 }, { den: 70, nguoi: 3 }, { den: 77, nguoi: 4 }],
};
// TĐC: QĐ không quy định → mặc định quốc gia (`loaiHinh` của mục 'hn' không có 'tdc')
const HN_BANG: PhuongPhap = { kieu: 'bang', bang: { notm: HN_NOTM, noxh: HN_NOXH } };

/* ---------- TP.HCM · QĐ 32/2025/QĐ-UBND (hiệu lực 09/01/2026) · kiểu B — đã đối chiếu bản gốc (Công báo TP.HCM số 36+37) ---------- */
const HCM_NOTM: BangDanSo = {
  dtMin: 25, dieu: 'QĐ 32/2025/QĐ-UBND, Quy định kèm theo Điều 4 khoản 2 điểm a',
  moc: [
    { den: 32, nguoi: 1 }, { den: 56, nguoi: 2 }, { den: 64, nguoi: 2 }, { den: 96, nguoi: 3 },
    { den: 128, nguoi: 4 }, { den: 160, nguoi: 5 }, { den: VO_CUC, nguoi: 6 },
  ],
};
/** Điểm b: "từ 25 đến 32" → 1; "từ 32 đến dưới 45" → 1,5 … — 32 m² đúng mốc lấy dòng đầu (1 người). */
const HCM_NOXH_TDC: BangDanSo = {
  dtMin: 25, dieu: 'QĐ 32/2025/QĐ-UBND, Quy định kèm theo Điều 4 khoản 2 điểm b (tái định cư hoặc nhà ở xã hội)',
  moc: [{ den: 32, nguoi: 1 }, { den: 45, nguoi: 1.5, nho: true }, { den: 55, nguoi: 2, nho: true }, { den: 70, nguoi: 2.5, nho: true }, { den: 75, nguoi: 3, nho: true }],
};
const HCM_QH: PhuongPhap = { kieu: 'sTb', sTb: S_TB_QUOC_GIA, dieu: 'QĐ 32/2025/QĐ-UBND, Quy định kèm theo Điều 4 khoản 1 (theo QĐ 2161/QĐ-TTg: ~32 m²/người)' };

/* ---------- Hải Dương (cũ) · QĐ 11/2024/QĐ-UBND (ban hành 15/4/2024, hiệu lực 26/4/2024) · kiểu D ---------- */
/** Điều 3 khoản 2 điểm a–e: 25–45 → 1 · trên 45–80 → 2 · trên 80–120 → 3 · trên 120–150 → 4 · trên 150–180 → 5 · trên 180 → 6. */
const HD_CP: PhuongPhap = {
  kieu: 'bang',
  bang: {
    chung: {
      dtMin: 25, dieu: 'QĐ 11/2024/QĐ-UBND Hải Dương, Điều 3 khoản 2 điểm a–e (một bảng chung)',
      moc: [{ den: 45, nguoi: 1 }, { den: 80, nguoi: 2 }, { den: 120, nguoi: 3 }, { den: 150, nguoi: 4 }, { den: 180, nguoi: 5 }, { den: VO_CUC, nguoi: 6 }],
    },
  },
};
const HD_QH: PhuongPhap = { kieu: 'sTb', sTb: 35.5, dieu: 'QĐ 11/2024/QĐ-UBND Hải Dương, Điều 3 khoản 1 điểm b — 35,5 m² sàn/người' };

/* ---------- Đồng Nai (cũ) · QĐ 09/2025/QĐ-UBND (ban hành 17/02/2025, hiệu lực 01/3/2025) · bảng số phòng ở + DT ---------- */
const DN_DIEU = 'QĐ 09/2025/QĐ-UBND Đồng Nai, Quy định kèm theo Điều 4 khoản 3';
/**
 * Điều 4 khoản 3 điểm a–d. Lời văn ghi "từ trên 100 m2 đến 125 m2" và "từ 125 m2 trở lên" (trùng mốc 125), bảng tóm tắt lại
 * ghi "100 đến < 125" và "> 125" — app lấy 125 đúng mốc ở dòng trên, như bảng Hà Nội.
 */
const DN_CP: PhuongPhap = {
  kieu: 'bangPhong', dieu: `${DN_DIEU} điểm a–d`,
  phong: {
    1: { dtMin: 25, dieu: `${DN_DIEU} điểm a (01 phòng ở)`, moc: [{ den: 45, nguoi: 1.5 }, { den: 70, nguoi: 2 }] },
    2: { dtMin: 45, dieu: `${DN_DIEU} điểm b (02 phòng ở)`, moc: [{ den: 70, nguoi: 2.5 }, { den: 100, nguoi: 3 }, { den: 125, nguoi: 3.5 }, { den: VO_CUC, nguoi: 4.5 }] },
    3: { dtMin: 70, dieu: `${DN_DIEU} điểm c (03 phòng ở)`, moc: [{ den: 100, nguoi: 3.5 }, { den: 125, nguoi: 4 }, { den: VO_CUC, nguoi: 5 }] },
    4: { dtMin: 100, dieu: `${DN_DIEU} điểm d (04 phòng ở trở lên)`, moc: [{ den: 125, nguoi: 4.5 }, { den: VO_CUC, nguoi: 5.5 }] },
  },
};
const DN_QH: PhuongPhap = { kieu: 'sTb', sTb: 31, dieu: 'QĐ 09/2025/QĐ-UBND Đồng Nai, Quy định kèm theo Điều 4 khoản 1 — 31,0 m² sàn/người (khu vực đô thị)' };

/* ---------- Phú Yên (cũ) · QĐ 05/2025/QĐ-UBND (ban hành 16/01/2025, hiệu lực 30/01/2025) · kiểu E ---------- */
const PY_STB: PhuongPhap = {
  kieu: 'sTb', sTb: S_TB_QUOC_GIA, tam: true,
  dieu: 'QĐ 05/2025/QĐ-UBND Phú Yên, Quy định kèm theo Điều 4 — P = S / Stb (Stb theo Chương trình phát triển nhà ở tỉnh; QĐ không ghi trị số, tạm 32)',
};

export const QUY_TAC_DAN_SO: QuyTacTinh[] = [
  {
    id: 'hn', ten: 'Hà Nội', qd: 'QĐ 34/2024/QĐ-UBND (sửa bởi QĐ 39/2026/QĐ-UBND)', kieu: 'C', hieuLuc: '15/4/2026 (QĐ 39/2026)', daDoiChieu: true,
    phuongPhap: { qh: HN_BANG, cp: HN_BANG }, loaiHinh: ['notm', 'noxh'],
    bqCan: { so: 3.6, dieu: 'QĐ 34/2024/QĐ-UBND Hà Nội, Điều 4 khoản 1 — hoặc 3,6 người/căn hộ (chỉ nhà ở thương mại)', loaiHinh: ['notm'] },
    ghiChu: 'Điều 4 khoản 1, 2 áp cho giai đoạn lập QHCT, QH tổng mặt bằng, phương án kiến trúc: app dùng cùng bảng cho cả hai giai đoạn. QĐ 39/2026 chỉ sửa tên QĐ, Điều 5 khoản 3, 6, Điều 6 — không sửa Điều 4. QĐ không quy định căn TĐC → TĐC tính theo mặc định quốc gia 32 m²/người.',
  },
  {
    id: 'hcm', ten: 'TP. Hồ Chí Minh — QĐ 32/2025', qd: 'QĐ 32/2025/QĐ-UBND', kieu: 'B', hieuLuc: '09/01/2026', daDoiChieu: true,
    phuongPhap: { qh: HCM_QH, cp: { kieu: 'bang', bang: { notm: HCM_NOTM, noxh: HCM_NOXH_TDC, tdc: HCM_NOXH_TDC } } },
    bqCan: { so: 3.5, dieu: 'QĐ 32/2025/QĐ-UBND, Quy định kèm theo Điều 4 khoản 2 — 3,5 người/căn hộ', giaiDoan: 'cp' },
  },
  {
    id: 'hcm83', ten: 'TP. Hồ Chí Minh — QĐ 83/2026', qd: 'QĐ 83/2026/QĐ-UBND (sửa Điều 4 Quy định kèm QĐ 32/2025)', kieu: 'B', hieuLuc: '30/10/2026', daDoiChieu: true,
    phuongPhap: { qh: HCM_QH, cp: { kieu: 'qd83', sTb: S_TB_QUOC_GIA, dieu: 'QĐ 83/2026/QĐ-UBND Điều 1 — Điều 4 khoản 2 điểm a (TM, TĐC), điểm b (NOXH) sửa đổi' } },
    bqCan: { so: 3.5, dieu: 'QĐ 83/2026/QĐ-UBND Điều 1 — Điều 4 khoản 2 sửa đổi: 3,5 người/căn hộ', giaiDoan: 'cp' },
    ghiChu: 'Hồ sơ nộp trước 30/10/2026 tiếp tục theo QĐ 32/2025 (Điều 3 chuyển tiếp). Điểm a gộp căn thương mại, căn TĐC và căn hộ lưu trú; điểm b riêng NOXH. S ÷ 32 giữ số thực, không làm tròn từng căn — văn bản không quy định, giá trị tạm, chờ chủ nhiệm chốt. Khoản 4 (≥ 5 phòng ở → 1 người/phòng) không xảy ra với loại căn của app (tối đa 3PN).',
  },
  {
    id: 'brvt', ten: 'Bà Rịa – Vũng Tàu (cũ)', qd: 'QĐ 43/2023/QĐ-UBND — hết hiệu lực từ 09/01/2026', kieu: 'D', daDoiChieu: true, phuongPhap: null, theo: 'hcm',
    ghiChu: 'QĐ 32/2025/QĐ-UBND TP.HCM Điều 2 khoản 2: QĐ 43/2023 BR-VT hết hiệu lực kể từ ngày QĐ 32/2025 có hiệu lực → áp quy tắc TP.HCM.',
  },
  {
    id: 'hd', ten: 'Hải Dương (cũ)', qd: 'QĐ 11/2024/QĐ-UBND', kieu: 'D', hieuLuc: '26/4/2024', daDoiChieu: true,
    phuongPhap: { qh: HD_QH, cp: HD_CP },
    bqCan: { so: 3, dieu: 'QĐ 11/2024/QĐ-UBND Hải Dương, Điều 3 khoản 1 điểm a — 3,0 người/hộ (giai đoạn lập quy hoạch)', giaiDoan: 'qh' },
    ghiChu: 'QĐ không phân biệt loại hình: một bảng chung cho TM, NOXH, TĐC. Khoản 1 (lập quy hoạch, chưa đủ cơ sở tính chi tiết DT căn) ghi cả 3,0 người/hộ và 35,5 m² sàn/người; khoản 2 (lập dự án, TMB, phương án kiến trúc) tra bảng DT sử dụng căn.',
  },
  {
    id: 'py', ten: 'Phú Yên (cũ)', qd: 'QĐ 05/2025/QĐ-UBND', kieu: 'E', hieuLuc: '30/01/2025', daDoiChieu: true,
    phuongPhap: { qh: PY_STB, cp: PY_STB },
    ghiChu: 'Quy định kèm theo Điều 4: P = S / Stb, S = tổng DT sàn tòa nhà, Stb theo Chương trình phát triển nhà ở được UBND tỉnh phê duyệt tại thời điểm lập quy hoạch / phương án — QĐ không ghi trị số. Báo chí dẫn Chương trình 2021–2030 (khoảng 31,8 m²/người đô thị năm 2025; 35,9 năm 2030) nhưng chưa đọc được bản gốc Chương trình → tạm 32 m²/người, giá trị tạm, chờ chủ nhiệm chốt. App lấy S = DT sử dụng từng căn. QĐ không phân biệt loại hình.',
  },
  {
    id: 'dnai', ten: 'Đồng Nai (cũ)', qd: 'QĐ 09/2025/QĐ-UBND', kieu: 'D', hieuLuc: '01/3/2025', daDoiChieu: true,
    phuongPhap: { qh: DN_QH, cp: DN_CP },
    bqCan: { so: 3.53, dieu: 'QĐ 09/2025/QĐ-UBND Đồng Nai, Quy định kèm theo Điều 4 khoản 1 — 3,53 người/căn hộ (giai đoạn lập quy hoạch)', giaiDoan: 'qh' },
    ghiChu: 'QĐ không phân biệt loại hình (điểm đ chỉ giới hạn căn < 45 m² ≤ 25% ở dự án thương mại). Khoản 1: 3,53 người/căn hoặc 31,0 m²/người đô thị, 28,5 m²/người nông thôn — app dùng mốc đô thị. Khoản 3 tra theo số phòng ở + DT: Studio, 1PN → 1 phòng ở; 2PN, 2PN+ → 2; 3PN → 3 (2PN+ coi là 2 phòng ở — chờ chủ nhiệm chốt). Khoản 4: DT và số phòng không thống nhất → theo DT; app tra cột số phòng, DT ngoài thang cột đó lấy dòng gần nhất và gắn cờ ngoài bảng.',
  },
  {
    id: 'khac', ten: 'Tỉnh / thành khác (chưa có QĐ riêng)', qd: null, kieu: null, daDoiChieu: false, phuongPhap: null,
    bqCan: { so: 3.5, dieu: 'Tổng điều tra dân số và nhà ở 2019 / giữa kỳ 2024: bình quân 3,5–3,6 người/căn (tài liệu nguồn §3.2)', tam: true },
  },
];

/** Fallback quốc gia (tài liệu nguồn §3.1): P = S / S_tb, S_tb = 32 m²/người. */
export const FALLBACK_QG: PhuongPhap = { kieu: 'sTb', sTb: S_TB_QUOC_GIA, dieu: DIEU_QG };

/** Số phòng ở theo loại căn của app (tra `bangPhong`): Studio, 1PN → 1 · 2PN, 2PN+ → 2 (phòng đa năng không tính) · 3PN → 3. */
export const SO_PHONG_O: Record<LoaiCan, SoPhongO> = { stu: 1, '1pn': 1, '2pn': 2, '2pnp': 2, '3pn': 3 };

export const timQuyTac =(id: string | undefined): QuyTacTinh | undefined => QUY_TAC_DAN_SO.find((q) => q.id === id);
