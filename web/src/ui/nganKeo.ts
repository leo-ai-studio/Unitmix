/**
 * Ngăn kéo đáy màn hẹp (panel trái / phải trên điện thoại, máy tính bảng): kéo tay cầm xuống để đóng.
 * Thuần, không DOM — `ui/KhungSoan.tsx` gọi khi nhấc tay.
 */

/** Kéo xuống quá 1/4 chiều cao ngăn (tối thiểu 72 px) hoặc vuốt nhanh xuống (> 0,5 px/ms) thì đóng; không thì bật về. */
export function nenDongNgan(dy: number, vanToc: number, caoNgan: number): boolean {
  if (vanToc > 0.5 && dy > 12) return true;
  return dy > Math.max(72, caoNgan / 4);
}

/** Kéo lên quá mép thì cản dần (không cho ngăn trồi khỏi chỗ), kéo xuống thì bám tay 1:1. */
export const dichNgan = (dy: number) => (dy >= 0 ? dy : -Math.sqrt(-dy) * 2);
