import type { ToaDat } from './kieu';
import type { ViTriCan } from './matBang';

type DoiCan = Pick<ToaDat, 'canTheo' | 'canViTri'>;

const gon = (canViTri: Record<string, string>): Record<string, string> | undefined => (Object.keys(canViTri).length ? canViTri : undefined);

/**
 * Đổi căn tại một vị trí sang mẫu `canMoi`.
 * `nhieu` (Sửa nhiều căn): đổi mọi căn cùng mẫu gốc trong tòa (đổi theo mẫu, xoá đổi theo vị trí của các căn đó).
 * Không bật thì chỉ đổi đúng vị trí này; đổi về đúng mẫu mà luật theo mẫu đã cho thì bỏ khoá vị trí.
 */
export function doiCanTaiViTri<T extends DoiCan>(toa: T, vt: ViTriCan, canMoi: string, vts: ViTriCan[], nhieu: boolean): T {
  const canTheo = { ...toa.canTheo };
  const canViTri = { ...(toa.canViTri ?? {}) };
  if (nhieu) {
    if (canMoi === vt.canGocId) delete canTheo[vt.canGocId]; else canTheo[vt.canGocId] = canMoi;
    for (const v of vts) if (v.canGocId === vt.canGocId) delete canViTri[v.khoa];
  } else if (canMoi === (canTheo[vt.canGocId] ?? vt.canGocId)) delete canViTri[vt.khoa];
  else canViTri[vt.khoa] = canMoi;
  return { ...toa, canTheo, canViTri: gon(canViTri) };
}

/** Bỏ mọi đổi căn: về đúng mẫu căn gốc của mẫu tòa. */
export const veMauGoc = <T extends DoiCan>(toa: T): T => ({ ...toa, canTheo: {}, canViTri: undefined });

/** Áp kết quả tối ưu: thay toàn bộ đổi theo vị trí (đổi theo mẫu giữ nguyên). */
export const apDoiViTri = <T extends DoiCan>(toa: T, canViTri: Record<string, string>): T => ({ ...toa, canViTri: gon(canViTri) });
