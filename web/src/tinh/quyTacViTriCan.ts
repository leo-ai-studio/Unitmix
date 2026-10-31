/**
 * Quy tắc vị trí căn (chủ nhiệm 2026-10-31) — mẫu căn đặt vào ô nào thì theo đúng loại vị trí của ô đó:
 *  - căn GIỮA (mã `m…`) chỉ ở ô giữa, không bao giờ ở góc;
 *  - căn GÓC thường (mã `g…`) chỉ ở ô góc, không bao giờ ở giữa; hai ô góc đổi mẫu góc cho nhau được;
 *  - căn góc ĐẶC BIỆT chữ V / Y (mã `v…`, `y…`) là căn KHOÁ: chỉ đúng chỗ cạnh lõi thang máy như bản vẽ — ô đó không đổi
 *    sang mẫu khác (kể cả STRETCH cùng mẫu thì được), và V / Y không đặt vào ô nào khác.
 * Loại vị trí lấy từ mã đuôi của id mẫu (`tm-2pn-v1` → `v1`), không cần thư viện; biến thể STRETCH (`~s+100`) tính theo mẫu gốc.
 * Ô được xác định bằng mẫu GỐC của bản vẽ (`ViTriCan.canGocId`), không phải căn đang dùng.
 */

export type NhomViTri = 'giua' | 'goc' | 'khoa';

/** Id mẫu gốc (bỏ hậu tố biến thể STRETCH). */
export const idMauGoc = (id: string): string => id.split('~')[0];

/** Nhóm vị trí của một mẫu căn theo mã đuôi id; id lạ (không có mã m / g / v / y) trả null = không ràng buộc. */
export function nhomViTri(id: string): NhomViTri | null {
  const g = idMauGoc(id);
  const ma = g.slice(g.lastIndexOf('-') + 1);
  switch (ma[0]) {
    case 'm': return 'giua';
    case 'g': return 'goc';
    case 'v': case 'y': return 'khoa';
    default: return null;
  }
}

/** Mẫu này là căn góc khoá (V / Y): ô chứa nó không đổi mẫu, nó không đặt vào ô khác. */
export const laCanKhoa = (id: string): boolean => nhomViTri(id) === 'khoa';

/**
 * Ô có mẫu gốc `canGocId` nhận được mẫu `moi` không. Ô khoá (V / Y) chỉ nhận chính mẫu đó (hoặc biến thể STRETCH của nó);
 * ô góc chỉ nhận căn góc thường; ô giữa chỉ nhận căn giữa. Không rõ nhóm thì cho qua.
 */
export function duocDatVaoO(canGocId: string, moi: string): boolean {
  const a = nhomViTri(canGocId), b = nhomViTri(moi);
  if (a === null || b === null) return true;
  if (a === 'khoa') return idMauGoc(canGocId) === idMauGoc(moi);
  return a === b;
}
