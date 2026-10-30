/**
 * Đồng hồ giờ nắng (thuần, không DOM): MỘT nguồn giờ — `luc` của kho `nangGio/kho` — giá trị liên tục (giờ thập phân, không làm tròn);
 * chỉ làm tròn khi HIỆN (nhãn, `gioPhut`). 2D (bóng đổ), 3D (đèn mặt trời Khung3D, đường mặt trời) và hộp Vị trí · Nắng · Gió cùng đọc.
 *
 * Lỗi cũ (2026-10-30, thanh giờ 3D "giật lùi"): phần 3D làm tròn giờ 0,1 h rồi đặt vào state React của Khung3D (`datGio`), lượt đặt mặt trời
 * ngay sau đó còn đọc giờ CŨ của state (chưa vẽ lại) và đẩy ngược giờ cũ vào kho → giờ nhảy lùi, bóng chỉ đổi cách một bước.
 * Nay: kho là nguồn duy nhất, Khung3D đọc giờ qua `moRong.gio()`, không ghi ngược (chỉ thao tác của người dùng ở khung — góc có giờ — mới ghi).
 */

/** Tốc độ ▶ chạy giờ: giờ mô phỏng / giây thật. */
export const TOC_DO_CHAY = 1;
/** Bước thời gian tối đa của một khung khi chạy (s) — tab ẩn / máy khựng thì không nhảy cóc. */
export const DT_TOI_DA = 0.1;

/** Giờ thập phân → "h:mm" (làm tròn phút CHỈ để hiện; 9,9917 h → "10:00", không phải "9:00" như bản cũ). */
export function gioPhut(g: number): string {
  if (!Number.isFinite(g)) return '—';
  const p = Math.round(g * 60);
  return `${Math.floor(p / 60)}:${String(p % 60).padStart(2, '0')}`;
}

export const kepGio = (g: number, g0: number, g1: number): number => Math.min(g1, Math.max(g0, g));

/** Đọc giá trị ô trượt / số nhập → giờ (null nếu không phải số). */
export function docGio(v: unknown): number | null {
  const g = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(g) ? g : null;
}

/**
 * Một bước ▶ chạy giờ: tốc độ đều `tocDo` h/s, bước khung kẹp `DT_TOI_DA`; quá giờ lặn thì vòng lại từ giờ mọc (vòng lặp chủ ý, không phải nhảy).
 * Giờ ngoài [g0, g1] (đổi ngày làm khoảng hẹp lại) → bắt đầu từ g0.
 */
export function buocChay(g: number, dtGiay: number, g0: number, g1: number, tocDo = TOC_DO_CHAY): number {
  if (!(g1 > g0)) return g0;
  if (!(g >= g0 && g <= g1)) return g0;
  const dt = Math.min(DT_TOI_DA, Math.max(0, Number.isFinite(dtGiay) ? dtGiay : 0));
  const n = g + dt * tocDo;
  return n > g1 ? g0 : n;
}

/** Gộp nhiều lần gọi trong một khung thành một (rAF): việc nặng theo giờ (đặt mặt trời, vẽ bóng) chạy tối đa một lần / khung, luôn với giá trị mới nhất. */
export function taoNhip(
  viec: () => void,
  raf: (f: () => void) => number = (f) => requestAnimationFrame(f),
  huyRaf: (id: number) => void = (id) => cancelAnimationFrame(id),
): { goi: () => void; huy: () => void } {
  let id = 0;
  return {
    goi() { if (!id) id = raf(() => { id = 0; viec(); }); },
    huy() { if (id) huyRaf(id); id = 0; },
  };
}
