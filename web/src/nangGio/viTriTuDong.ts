/**
 * Đặt vị trí dự án KHÔNG cần dán link: (1) từ toạ độ thật của bản vẽ quy hoạch (VN-2000, tinh/nangGio/vn2000.ts) khi biết tỉnh;
 * (2) tìm địa điểm theo tên (timDiaDiem.ts); (3) dán link / toạ độ (cách cũ, còn trong hộp). Hàm thuần — giao diện gọi `sua`.
 */
import type { Diem, TrangThaiPA } from '../tinh/kieu';
import { ganViTri, viTriPA } from '../tinh/viTri';
import { nhanDangVN2000, tinhTuTen, viTriTuVN2000 } from '../tinh/nangGio/vn2000';

const ranhMoiLo = (pa: Pick<TrangThaiPA, 'lo'>): Diem[] => pa.lo.flatMap((l) => l.ranh);

/** Bản vẽ có toạ độ thật (VN-2000) để đặt vị trí? */
export const coToaDoThat = (pa: Pick<TrangThaiPA, 'lo'>): boolean => !!nhanDangVN2000(ranhMoiLo(pa));

/** PA mới có vị trí đặt từ toạ độ bản vẽ (kinh tuyến trục `ktt`); null nếu bản vẽ không có toạ độ thật. */
export function apDungTuBanVe(pa: TrangThaiPA, ktt: number): TrangThaiPA | null {
  const r = viTriTuVN2000(ranhMoiLo(pa), ktt);
  return r ? ganViTri(pa, { lat: r.lat, lng: r.lng, neo: r.neo, cachDat: 'banVe' }, r.gocBac) : null;
}

/**
 * Việc nút "Vị trí" làm khi bấm: 'tat' (đang bật → tắt), 'bat' (đã có toạ độ → bật), 'tuDat' (chưa có: đặt từ bản vẽ theo tỉnh đoán từ tên dự án),
 * 'hoi' (chưa đặt được → mở hộp tab Vị trí để chọn tỉnh / tìm địa điểm).
 */
export function viecNutViTri(pa: TrangThaiPA, dangBat: boolean, tenDuAn: string, chiXem: boolean): { viec: 'tat' | 'bat' | 'hoi' } | { viec: 'tuDat'; pa: TrangThaiPA } {
  if (dangBat) return { viec: 'tat' };
  if (viTriPA(pa).coToaDo) return { viec: 'bat' };
  const tinh = tinhTuTen(tenDuAn);
  const moi = tinh && !chiXem ? apDungTuBanVe(pa, tinh.ktt) : null;
  return moi ? { viec: 'tuDat', pa: moi } : { viec: 'hoi' };
}
