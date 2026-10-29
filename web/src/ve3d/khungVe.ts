/**
 * Phần thuần (không DOM, không three) của khung 3D: cỡ bộ đệm vẽ theo ô chứa, độ lệch tỷ lệ bộ đệm ↔ cỡ CSS (để kiểm méo),
 * bậc chất lượng theo thiết bị (máy cảm ứng nhẹ hơn để giữ mượt).
 */

/** Cỡ CSS (px) dùng cho bộ đệm vẽ + tỷ lệ camera: không nhỏ hơn 50 px (ô chứa đang ẩn / đang mở). */
export function coBoDem(rong: number, cao: number): { w: number; h: number } {
  return { w: Math.max(Math.round(rong) || 0, 50), h: Math.max(Math.round(cao) || 0, 50) };
}

/**
 * Độ lệch tỷ lệ khung hình giữa bộ đệm vẽ (canvas.width × height) và ô hiển thị CSS: 0 = khớp; 0,1 = hình bị kéo giãn 10 %.
 * Bộ đệm làm tròn xuống theo pixelRatio nên lệch vài phần nghìn là bình thường.
 */
export function lechTyLe(bufW: number, bufH: number, cssW: number, cssH: number): number {
  if (!bufW || !bufH || !cssW || !cssH) return 0;
  return Math.abs((bufW / bufH) / (cssW / cssH) - 1);
}

/** Bậc chất lượng 3D: `cao` máy bàn; `thap` điện thoại / máy tính bảng (cảm ứng) hoặc máy yếu. */
export type CapDo3D = 'cao' | 'thap';
export type ThongSoCap = {
  /** Mật độ điểm ảnh tối đa của bộ đệm. */
  dpr: number;
  /** Cạnh bản đồ bóng (px). */
  bong: number;
  /** Bóng mềm kiểu PCF (máy bàn) hay PCF thường (điện thoại). */
  bongMem: boolean;
  /** Số cây tối đa cả dự án. */
  cayToiDa: number;
  /** Cây đổ bóng. */
  cayBong: boolean;
};

export function capDo3D(o: { camUng: boolean; soLoi?: number; boNho?: number }): CapDo3D {
  if (o.camUng) return 'thap';
  if ((o.soLoi && o.soLoi <= 2) || (o.boNho && o.boNho <= 2)) return 'thap';
  return 'cao';
}

export const THONG_SO_CAP: Record<CapDo3D, ThongSoCap> = {
  cao: { dpr: 2, bong: 4096, bongMem: true, cayToiDa: 2400, cayBong: true },
  thap: { dpr: 1.5, bong: 2048, bongMem: false, cayToiDa: 700, cayBong: false },
};

/**
 * Hướng tới mặt trời (vector đơn vị, toạ độ three: X = +x bản vẽ, Y = lên, Z = −y bản vẽ) từ góc cao + phương vị (độ, Bắc = 0, theo
 * chiều kim đồng hồ) và góc Bắc dự án theo đúng quy ước `tinh/huongView.phuongVi` (phương vị = góc trên bản vẽ + gocBac).
 * Góc cao kẹp ≥ 8° để luôn có nắng.
 */
export function huongMatTroi(gocCao: number, phuongVi: number, gocBac: number): [number, number, number] {
  const el = (Math.max(8, gocCao) * Math.PI) / 180, az = ((phuongVi - gocBac) * Math.PI) / 180;
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
}
