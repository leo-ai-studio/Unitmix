/**
 * Điểm cắm mở rộng của Khung3D (gói ngoài thêm vật thể / điều khiển vào cảnh mà không sửa Khung3D): Khung3D gọi `gan(ngữ cảnh)` một lần
 * sau khi tạo renderer, `canhMoi` sau mỗi lần dựng cảnh, `nang(gio)` khi đặt mặt trời (trả vị trí mặt trời thay cho mặc định), `huy`
 * khi gỡ khung. Dùng ở gói Vị trí · Nắng · Gió (`nangGio/moRong3D.ts`).
 */
import type { CanhDung } from './Khung3D';

export type NguCanhMoRong = {
  T: typeof import('three');
  R: import('three').WebGLRenderer;
  scene: import('three').Scene;
  /** Nhóm của gói mở rộng do Khung3D giữ: làm nhạt cùng cảnh khi phân tích view, ẩn / hiện theo `userData.lop`, không bị gỡ khi dựng lại. */
  phu: import('three').Group;
  /** Áp lại Lớp + làm nhạt (gọi sau khi thêm vật thể vào `phu`). */
  apLop: () => void;
  cam: import('three').PerspectiveCamera;
  sun: import('three').DirectionalLight;
  /** Vẽ lại một khung (gộp theo rAF). */
  ve: () => void;
  /** Đặt lại mặt trời (gọi `nang`) rồi vẽ. */
  capNang: () => void;
  dom: HTMLCanvasElement;
};
export type GanMoRong = {
  canhMoi?: (c: CanhDung) => void;
  /** Vị trí mặt trời (độ cao, phương vị từ Bắc thật) theo giờ (`gio()` khi có); null = để khung tự tính. */
  nang?: (gio: number) => { gocCao: number; phuongVi: number } | null;
  /**
   * Nguồn giờ DUY NHẤT khi gói ngoài giữ giờ (kho `nangGio/kho` `luc`, liên tục, không làm tròn): Khung3D đọc giờ ở đây mỗi lần đặt mặt
   * trời, không chép vào state riêng (chép + làm tròn rồi đọc lại giờ cũ từng đẩy ngược giờ vào kho — thanh giờ giật lùi).
   */
  gio?: () => number;
  /** Người dùng đổi giờ từ khung (góc nhìn có giờ, góc đã lưu): ghi vào nguồn giờ — không phải lượt đồng bộ. */
  datGio?: (gio: number) => void;
  huy: () => void;
};
export type MoRong3D = { gan: (c: NguCanhMoRong) => GanMoRong };
