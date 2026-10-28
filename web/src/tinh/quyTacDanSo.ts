/**
 * Quy tắc tính dân số nhà chung cư theo tỉnh / thành (địa giới CŨ, trước sáp nhập 1/7/2025).
 *
 * Nguồn: `E:\Projects\MDI_Unitmix_v4\docs\quy-tac-tinh-dan-so-chung-cu.md` (thuật toán 4 bước, 5 kiểu QĐ A–E, bảng
 * Hà Nội / TP.HCM) và khối `TINH` / `occPhongO` / `occQD83` trong `prototype/shell.src.html` của app cũ.
 * Đối chiếu bản gốc: chỉ QĐ 32/2025/QĐ-UBND TP.HCM có trong kho `E:\OneDrive\_QCVN-TCVN\32_2025_QĐ-UBND.pdf`
 * (đã trích chữ, khớp từng mốc ở Điều 4 Quy định kèm theo) → `daDoiChieu: true`. Các QĐ khác chép từ tài liệu app cũ,
 * chưa có bản gốc trong kho → `daDoiChieu: false`, giao diện ghi "chưa đối chiếu bản gốc".
 *
 * Bảng là THANG DIỆN TÍCH SỬ DỤNG căn (= DT thông thủy, QCVN 04:2021/BXD 1.4.13), không tra theo số phòng — như app cũ;
 * QĐ 32/2025 Điều 4 khoản 4 cũng cho lấy theo DT khi số phòng và DT không thống nhất.
 * Không bịa trị số: tỉnh có số hiệu QĐ nhưng chưa có bảng trị số trong nguồn thì `phuongPhap` = null → tính theo
 * mốc quốc gia (fallback) và gắn cờ "giá trị tạm, chờ chủ nhiệm chốt".
 */

import type { GiaiDoan, LoaiHinh } from './kieu';

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
  | { kieu: 'qd83'; sTb: number; dieu: string };

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
  /** Cách thay thế "bình quân người / căn" mà QĐ cho phép (chữ "hoặc"). */
  bqCan?: { so: number; dieu: string; tam?: boolean };
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

/* ---------- Hà Nội · QĐ 34/2024/QĐ-UBND, sửa bởi QĐ 39/2026/QĐ-UBND (hiệu lực 15/4/2026) · kiểu C ---------- */
const HN_NOTM: BangDanSo = {
  dtMin: 25, dieu: 'QĐ 34/2024/QĐ-UBND (sửa bởi QĐ 39/2026) — bảng nhà ở thương mại',
  moc: [{ den: 45, nguoi: 1 }, { den: 70, nguoi: 2 }, { den: 100, nguoi: 3 }, { den: 125, nguoi: 4 }, { den: VO_CUC, nguoi: 5 }],
};
const HN_NOXH: BangDanSo = {
  dtMin: 25, dieu: 'QĐ 34/2024/QĐ-UBND (sửa bởi QĐ 39/2026) — bảng nhà ở xã hội',
  moc: [{ den: 40, nguoi: 1 }, { den: 55, nguoi: 2 }, { den: 70, nguoi: 3 }, { den: 77, nguoi: 4 }],
};
const HN_BANG: PhuongPhap = { kieu: 'bang', bang: { notm: HN_NOTM, noxh: HN_NOXH } }; // TĐC không có bảng riêng → bảng NOTM

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

export const QUY_TAC_DAN_SO: QuyTacTinh[] = [
  {
    id: 'hn', ten: 'Hà Nội', qd: 'QĐ 34/2024/QĐ-UBND (sửa bởi QĐ 39/2026/QĐ-UBND)', kieu: 'C', hieuLuc: '15/4/2026 (QĐ 39/2026)', daDoiChieu: false,
    phuongPhap: { qh: HN_BANG, cp: HN_BANG },
    bqCan: { so: 3.6, dieu: 'QĐ 34/2024/QĐ-UBND — hoặc bình quân 3,6 người/căn' },
    ghiChu: 'Tài liệu nguồn không tách giai đoạn: dùng cùng bảng cho quy hoạch và cấp phép. TĐC áp bảng NOTM.',
  },
  {
    id: 'hcm', ten: 'TP. Hồ Chí Minh — QĐ 32/2025', qd: 'QĐ 32/2025/QĐ-UBND', kieu: 'B', hieuLuc: '09/01/2026', daDoiChieu: true,
    phuongPhap: { qh: HCM_QH, cp: { kieu: 'bang', bang: { notm: HCM_NOTM, noxh: HCM_NOXH_TDC, tdc: HCM_NOXH_TDC } } },
    bqCan: { so: 3.5, dieu: 'QĐ 32/2025/QĐ-UBND, Quy định kèm theo Điều 4 khoản 2 — 3,5 người/căn hộ' },
  },
  {
    id: 'hcm83', ten: 'TP. Hồ Chí Minh — QĐ 83/2026', qd: 'QĐ 83/2026/QĐ-UBND (sửa Điều 4 Quy định kèm QĐ 32/2025)', kieu: 'B', hieuLuc: '30/10/2026', daDoiChieu: false,
    phuongPhap: { qh: HCM_QH, cp: { kieu: 'qd83', sTb: S_TB_QUOC_GIA, dieu: 'QĐ 83/2026/QĐ-UBND — Điều 4 khoản 2 điểm a, b (sửa)' } },
    bqCan: { so: 3.5, dieu: 'QĐ 83/2026/QĐ-UBND — 3,5 người/căn' },
    ghiChu: 'Hồ sơ nộp trước 30/10/2026 tiếp tục theo QĐ 32/2025 (Điều 3 chuyển tiếp). S ÷ 32 giữ số thực, không làm tròn từng căn — văn bản không quy định, giá trị tạm, chờ chủ nhiệm chốt. Mục 4 (≥ 5 phòng ở → 1 người/phòng) không xảy ra với loại căn của app (tối đa 3PN).',
  },
  {
    id: 'brvt', ten: 'Bà Rịa – Vũng Tàu (cũ)', qd: 'QĐ 43/2023/QĐ-UBND — hết hiệu lực từ 09/01/2026', kieu: 'D', daDoiChieu: true, phuongPhap: null, theo: 'hcm',
    ghiChu: 'QĐ 32/2025/QĐ-UBND TP.HCM Điều 2 khoản 2: QĐ 43/2023 BR-VT hết hiệu lực kể từ ngày QĐ 32/2025 có hiệu lực → áp quy tắc TP.HCM.',
  },
  {
    id: 'hd', ten: 'Hải Dương (cũ)', qd: 'QĐ 11/2024/QĐ-UBND', kieu: 'D', daDoiChieu: false, phuongPhap: null,
    ghiChu: 'Kiểu D (một bảng chung) — nguồn chưa chép bảng trị số: đang tính theo mốc quốc gia 32 m²/người, giá trị tạm, chờ chủ nhiệm chốt.',
  },
  {
    id: 'py', ten: 'Phú Yên (cũ)', qd: 'QĐ 05/2025/QĐ-UBND', kieu: 'E', daDoiChieu: false,
    phuongPhap: {
      qh: { kieu: 'sTb', sTb: S_TB_QUOC_GIA, dieu: 'QĐ 05/2025/QĐ-UBND — P = S / S_tb', tam: true },
      cp: { kieu: 'sTb', sTb: S_TB_QUOC_GIA, dieu: 'QĐ 05/2025/QĐ-UBND — P = S / S_tb', tam: true },
    },
    ghiChu: 'Kiểu E (công thức P = S / S_tb) — nguồn chưa ghi trị số S_tb của tỉnh: tạm dùng 32 m²/người, giá trị tạm, chờ chủ nhiệm chốt.',
  },
  {
    id: 'dnai', ten: 'Đồng Nai (cũ)', qd: 'QĐ 09/2025/QĐ-UBND', kieu: null, daDoiChieu: false, phuongPhap: null,
    ghiChu: 'Nguồn chỉ ghi số hiệu QĐ, chưa có kiểu và bảng trị số: đang tính theo mốc quốc gia 32 m²/người, giá trị tạm, chờ chủ nhiệm chốt.',
  },
  {
    id: 'khac', ten: 'Tỉnh / thành khác (chưa có QĐ riêng)', qd: null, kieu: null, daDoiChieu: false, phuongPhap: null,
    bqCan: { so: 3.5, dieu: 'Tổng điều tra dân số và nhà ở 2019 / giữa kỳ 2024: bình quân 3,5–3,6 người/căn (tài liệu nguồn §3.2)', tam: true },
  },
];

/** Fallback quốc gia (tài liệu nguồn §3.1): P = S / S_tb, S_tb = 32 m²/người. */
export const FALLBACK_QG: PhuongPhap = { kieu: 'sTb', sTb: S_TB_QUOC_GIA, dieu: DIEU_QG };

export const timQuyTac = (id: string | undefined): QuyTacTinh | undefined => QUY_TAC_DAN_SO.find((q) => q.id === id);
