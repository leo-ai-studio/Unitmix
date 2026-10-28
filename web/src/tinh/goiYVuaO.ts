import { LOAI_CAN, type CanMau, type LoaiCan, type ThuVien } from './kieu';
import { ST_BUOC } from './stretch';

/** STRETCH co tối đa (QT-81 ±500 mm) — mẫu rộng hơn ô trong khoảng này vẫn vừa sau khi co. */
const CO_TOI_DA = 5 * ST_BUOC;

/**
 * Gợi ý mẫu khác loại vừa ô khi phép đổi căn tay bị chặn (khít đoạn kẹp): cùng nhóm / vị trí / chiều sâu với căn đang đặt,
 * khác loại vừa chọn, rộng ≤ ô + STRETCH co tối đa. Mỗi loại lấy mẫu rộng nhất. Chỉ gợi ý, không tự đổi. Không gồm biến thể STRETCH.
 */
export function goiYVuaO(tv: ThuVien, canDangDat: string, loaiChon: LoaiCan, rongO: number): CanMau[] {
  const cu = tv.can.get(canDangDat.split('~')[0]);
  if (!cu) return [];
  const vua = [...tv.can.values()].filter((x) => !x.id.includes('~') && x.nhom === cu.nhom && x.vi_tri === cu.vi_tri
    && x.sau_mm === cu.sau_mm && x.loai !== loaiChon && x.rong_mm <= rongO + CO_TOI_DA);
  return LOAI_CAN.map((l) => vua.filter((x) => x.loai === l).sort((a, b) => b.rong_mm - a.rong_mm || a.id.localeCompare(b.id))[0])
    .filter((x): x is CanMau => !!x);
}
