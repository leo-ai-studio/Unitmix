import { LOAI_CAN, type LoaiCan, type ThuVien, type TrangThaiPA } from './kieu';
import { canCaToa } from './matBang';
import { mauToa } from './canThem';

export const coCauRong = (): Record<LoaiCan, number> => ({ stu: 0, '1pn': 0, '2pn': 0, '2pnp': 0, '3pn': 0 });

/** Id căn thực dùng ở một vị trí: id gốc của mẫu tòa, hoặc căn thay nếu đã đổi. */
export const canThucTe = (canGoc: string, canTheo: Record<string, string>): string => canTheo[canGoc] ?? canGoc;

/** Số căn theo loại của từng tòa: cộng từng tầng điển hình theo bố cục của tầng đó (chung hoặc riêng); ô đổi công năng không tính. */
export function demCan(pa: TrangThaiPA, tv: ThuVien): Record<string, Record<LoaiCan, number>> {
  const kq: Record<string, Record<LoaiCan, number>> = {};
  for (const t of pa.toa) {
    const dem = coCauRong();
    const mau = mauToa(tv, t);
    if (mau) {
      for (const [id, n] of canCaToa(mau, t, tv)) {
        const can = tv.can.get(id);
        if (can) dem[can.loai] += n;
      }
    }
    kq[t.id] = dem;
  }
  return kq;
}

export function congCoCau(ds: Record<LoaiCan, number>[]): Record<LoaiCan, number> {
  const tong = coCauRong();
  for (const d of ds) for (const l of LOAI_CAN) tong[l] += d[l];
  return tong;
}

/** Đổi số căn ra % (tổng 0 thì mọi loại là 0). */
export function phanTram(dem: Record<LoaiCan, number>): Record<LoaiCan, number> {
  const tong = LOAI_CAN.reduce((a, l) => a + dem[l], 0);
  const kq = coCauRong();
  if (tong > 0) for (const l of LOAI_CAN) kq[l] = (dem[l] / tong) * 100;
  return kq;
}

/** Điểm lệch cơ cấu = Σ |% đạt − % mục tiêu|. Thấp là tốt. */
export function diemLechCoCau(datPct: Record<LoaiCan, number>, mucTieuPct: Record<LoaiCan, number>): number {
  return LOAI_CAN.reduce((a, l) => a + Math.abs((datPct[l] ?? 0) - (mucTieuPct[l] ?? 0)), 0);
}

/** Mẫu căn loại `loaiMoi`, cùng nhóm và cùng bề ngang với `canId`; ưu tiên cùng vị trí (giữa/góc). Không có thì null. */
export function doiMauCungBeNgang(canId: string, loaiMoi: LoaiCan, tv: ThuVien): string | null {
  const goc = tv.can.get(canId);
  if (!goc) return null;
  const ung = [...tv.can.values()]
    .filter((c) => c.nhom === goc.nhom && c.loai === loaiMoi && c.rong_mm === goc.rong_mm && c.id !== canId)
    .sort((a, b) => Number(b.vi_tri === goc.vi_tri) - Number(a.vi_tri === goc.vi_tri) || a.id.localeCompare(b.id));
  return ung[0]?.id ?? null;
}

/** DT thông thủy trung bình theo loại căn của các tòa trên lô (để so với DT đề bài KD); loại không có căn thì null. */
export function dtTbTheoLoai(pa: TrangThaiPA, tv: ThuVien, loId: string): Record<LoaiCan, number | null> {
  const tong = coCauRong(), dem = coCauRong();
  for (const t of pa.toa) {
    const mau = t.loId === loId ? mauToa(tv, t) : undefined;
    if (!mau) continue;
    for (const [id, n] of canCaToa(mau, t, tv)) {
      const can = tv.can.get(id);
      if (!can) continue;
      tong[can.loai] += n * can.dt_tt_m2;
      dem[can.loai] += n;
    }
  }
  return Object.fromEntries(LOAI_CAN.map((k) => [k, dem[k] ? tong[k] / dem[k] : null])) as Record<LoaiCan, number | null>;
}
