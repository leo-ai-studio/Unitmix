import { diemLechCoCau, phanTram } from './coCau';
import { LOAI_CAN, type LoaiCan, type ThuVien } from './kieu';
import { canDangDung, congNangTai, ungVienDoi, viTriCan, type BoCuc, type ToaCoMat } from './matBang';

export type KetQuaToiUu = {
  /** Đổi căn theo vị trí sau tối ưu (chỉ các vị trí khác với đổi theo mẫu `canTheo`). */
  canViTri: Record<string, string>;
  diemTruoc: number;
  diemSau: number;
  soDoi: number;
};

/**
 * Tối ưu cơ cấu một tầng điển hình: đổi mẫu căn tại từng vị trí sang mẫu cùng nhóm, cùng bề ngang, cùng vị trí giữa/góc
 * (nên không đổi hình tòa) để giảm điểm lệch cơ cấu so với mục tiêu. Leo đồi: mỗi bước chọn một phép đổi giảm điểm nhiều nhất,
 * dừng khi không còn phép nào giảm. Mix chỉ là hướng dẫn: số căn nguyên không chia đúng tỷ lệ được. Ô đổi công năng không đếm, không đổi.
 */
export function toiUuCoCau(mau: ToaCoMat, toa: BoCuc, tv: ThuVien, mucTieu: Record<LoaiCan, number>): KetQuaToiUu {
  const vts = viTriCan(mau, tv);
  const hienTai = vts.map((vt) => canDangDung(vt, toa));
  const laCan = vts.map((vt) => congNangTai(vt.khoa, toa) === 'can');
  const diem = (ds: string[]) => {
    const dem = Object.fromEntries(LOAI_CAN.map((k) => [k, 0])) as Record<LoaiCan, number>;
    ds.forEach((id, i) => { const c = laCan[i] && tv.can.get(id); if (c) dem[c.loai]++; });
    return diemLechCoCau(phanTram(dem), mucTieu);
  };
  const ungVien = hienTai.map((id, i) => (laCan[i] ? ungVienDoi(id, tv, true).map((c) => c.id) : []));
  const diemTruoc = diem(hienTai);
  let cur = diemTruoc;
  for (let buoc = 0; buoc < 300; buoc++) {
    let tot: { i: number; id: string; d: number } | null = null;
    hienTai.forEach((id, i) => {
      if (!laCan[i]) return;
      for (const moi of [...ungVien[i], ...(ungVienDoi(id, tv, true).map((c) => c.id))]) {
        const thu = hienTai.slice();
        thu[i] = moi;
        const d = diem(thu);
        if (d < cur - 1e-9 && (!tot || d < tot.d)) tot = { i, id: moi, d };
      }
    });
    if (!tot) break;
    const { i, id, d } = tot;
    hienTai[i] = id;
    cur = d;
  }
  const canViTri: Record<string, string> = {};
  let soDoi = 0;
  vts.forEach((vt, i) => {
    if (hienTai[i] !== (toa.canTheo[vt.canGocId] ?? vt.canGocId)) canViTri[vt.khoa] = hienTai[i];
    if (hienTai[i] !== canDangDung(vt, toa)) soDoi++;
  });
  return { canViTri, diemTruoc, diemSau: cur, soDoi };
}
