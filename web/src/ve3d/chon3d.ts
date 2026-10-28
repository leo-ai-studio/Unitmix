/**
 * Chọn tòa / lô trong 3D (phần tính thuần, không cần WebGL): đối tượng 3D → id tòa / lô, phân biệt bấm với kéo xoay camera,
 * bấm đúp (chuột hoặc chạm hai lần), ngưỡng LOD chi tiết / dải cửa.
 */

/** Đối tượng chọn được, gắn ở `userData.chon` của mesh khi dựng. */
export type DoiTuong3D = { loai: 'toa'; id: string; loId: string } | { loai: 'lo'; id: string };
/** Đang chọn (đi qua state chọn của 2D trong `man/SoanThao.tsx`). */
export type DangChon3D = { toaId: string | null; loId: string | null };

type CoCha = { userData?: Record<string, unknown>; parent?: CoCha | null };

/** Tìm `userData.chon` từ đối tượng trúng tia ngược lên các nút cha (mesh con của nhóm tòa vẫn ra đúng tòa). */
export function doiTuongCua(o: CoCha | null | undefined): DoiTuong3D | null {
  for (let v = o; v; v = v.parent ?? null) {
    const c = v.userData?.chon as DoiTuong3D | undefined;
    if (c && (c.loai === 'toa' || c.loai === 'lo') && typeof c.id === 'string') return c;
  }
  return null;
}

/** Danh sách giao điểm (gần trước) → đối tượng chọn được đầu tiên; không trúng gì chọn được = bấm nền. */
export function doiTuongTrung(ds: { object: CoCha }[]): DoiTuong3D | null {
  for (const g of ds) { const d = doiTuongCua(g.object); if (d) return d; }
  return null;
}

/** Ngưỡng (px) chuột / ngón tay xê dịch giữa lúc nhấn và nhả mà vẫn tính là bấm; quá ngưỡng = kéo xoay camera. */
export const NGUONG_BAM_PX = { mouse: 5, pen: 6, touch: 12 } as const;
/** Giữ lâu hơn ngưỡng này (ms) thì không tính là bấm (đang giữ để xoay chậm). */
export const BAM_TOI_DA_MS = 700;

export type DiemBam = { x: number; y: number; t: number; kieu?: string };

/** Nhả chuột / nhấc ngón có phải là bấm (không phải kéo) không. */
export function laBam(xuong: DiemBam, len: DiemBam): boolean {
  const k = (xuong.kieu ?? 'mouse') as keyof typeof NGUONG_BAM_PX;
  const nguong = NGUONG_BAM_PX[k] ?? NGUONG_BAM_PX.mouse;
  return Math.hypot(len.x - xuong.x, len.y - xuong.y) <= nguong && len.t - xuong.t <= BAM_TOI_DA_MS;
}

/** Hai lần bấm liền nhau thành bấm đúp: cách ≤ 350 ms, lệch ≤ 24 px (ngón tay khó chạm trùng chỗ). */
export function laBamDup(truoc: DiemBam | null, sau: DiemBam): boolean {
  return !!truoc && sau.t - truoc.t <= 350 && Math.hypot(sau.x - truoc.x, sau.y - truoc.y) <= 24;
}

/** Áp kết quả bấm vào state chọn: bấm tòa → chọn tòa + lô của nó; bấm lô → chọn lô, bỏ tòa; bấm nền → bỏ chọn cả hai. */
export function chonSauBam(d: DoiTuong3D | null): DangChon3D {
  if (!d) return { toaId: null, loId: null };
  return d.loai === 'toa' ? { toaId: d.id, loId: d.loId } : { toaId: null, loId: d.id };
}

/** Đối tượng này có đang chọn (tô viền) không. Lô chỉ tô khi không có tòa nào đang chọn, tránh hai lớp nhấn chồng nhau. */
export function dangChon(d: DoiTuong3D, c: DangChon3D): boolean {
  return d.loai === 'toa' ? d.id === c.toaId : !c.toaId && d.id === c.loId;
}

/**
 * Khoảng cách camera → tâm tòa (m) từ đó vẽ tầng kiểu dải cửa thay cho từng căn chi tiết.
 * Góc mặc định của khung tòa đứng cách tâm ≈ 2,2 × cỡ cảnh (`gocMacDinh`), nên ngưỡng 4 × cỡ cảnh giữ chi tiết ở mọi góc đề xuất;
 * tối thiểu 120 m để tòa nhỏ không chuyển sớm.
 */
export function nguongLod(coCanh: number): number {
  return Math.max(120, coCanh * 4);
}

/** Mức chi tiết theo khoảng cách: 'gan' = từng căn (cửa, khung, lan can), 'xa' = khối + dải cửa theo tầng. */
export function mucLod(khoangCach: number, coCanh: number): 'gan' | 'xa' {
  return khoangCach < nguongLod(coCanh) ? 'gan' : 'xa';
}
