import type { ThuVien, TrangThaiPA } from '../tinh/kieu';

/**
 * Nhãn ngắn một tòa cho bảng / danh sách: mã mẫu ("V4"); hai tòa cùng mẫu trên MỘT lô thì thêm số thứ tự trong lô ("V4 · 1",
 * "V4 · 2") — trước đây bảng Chi tiết theo tòa, View theo tòa, Thang máy theo tòa, Cơ cấu căn trên lô hiện hai dòng "V4" y hệt.
 * `lo`: thêm ký hiệu lô (danh sách cả dự án: "V4 · NO-01", "V4 · 2 · CX-3").
 */
export function nhanToa(pa: TrangThaiPA, tv: ThuVien | null | undefined, id: string, o: { lo?: boolean; day?: boolean } = {}): string {
  const x = pa.toa.find((q) => q.id === id);
  if (!x) return '?';
  const ten = (mauId: string) => { const t = tv?.toa.get(mauId)?.ten_vi ?? mauId; return o.day ? t : t.split(' · ')[0]; };
  const cungLo = pa.toa.filter((q) => q.loId === x.loId);
  const trung = cungLo.filter((q) => q.mauId === x.mauId);
  let s = ten(x.mauId);
  // tên đầy đủ: số đứng trước như menu cấp "Chọn tòa" (man/SoanThao `nhanToa`); mã ngắn: số đứng sau
  if (trung.length > 1) s = o.day ? `${cungLo.indexOf(x) + 1} · ${s}` : `${s} · ${cungLo.indexOf(x) + 1}`;
  if (o.lo) { const l = pa.lo.find((q) => q.id === x.loId); if (l) s += ` · ${l.temDat.kyHieu}`; }
  return s;
}
