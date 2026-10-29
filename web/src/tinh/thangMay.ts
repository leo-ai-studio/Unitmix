/**
 * Thang máy một tòa (hàm thuần): đếm giếng thang từ lõi mẫu tòa, số thang cần theo QCVN 04:2021/BXD, thang máy chữa cháy
 * theo QCVN 06:2022/BXD (Sửa đổi 1:2023).
 *
 * Căn cứ (tra kho E:\OneDrive\_QCVN-TCVN, trích PyMuPDF):
 *  - QCVN 04:2021 2.4.1: từ 5 tầng ≥ 1 thang, từ 10 tầng ≥ 2 thang. 2.4.2: "1 thang máy cho 200 người cư trú … không kể
 *    số người ở tầng 1" hoặc "1 thang máy cho 70 căn hộ". TT 31/2026 (Sửa đổi 01:2026 QCVN 04) không sửa mục 2.4.
 *  - App cũ (QT-94, chủ nhiệm 19/10/2026): số cần = min(⌈căn / 70⌉, ⌈dân / 200⌉) — hai cách tính là hai lựa chọn của 2.4.2;
 *    số có = MỌI giếng trong lõi (khách + chữa cháy + hàng, QT-76), đếm theo hình vẽ (QT-64: `so_gieng` trong loi/*.json).
 *  - QCVN 06:2022 6.13: mỗi khoang cháy nhà có chiều cao PCCC > 28 m (> 50 m với nhóm F1.3 — chung cư) phải có ≥ 1 thang máy
 *    chữa cháy; bán kính phục vụ từ cửa thang tới điểm bất kỳ của tầng ≤ 60 m. Nhà > 75 m (Phụ lục A, A.2.12): ≤ 45 m.
 *    QCVN 04:2021 2.4.3 cùng ngưỡng 50 m.
 *  - App cũ KHÔNG chỉ định giếng nào là thang chữa cháy (chỉ ô số `fireLifts`); ở đây chọn theo luật: giếng phủ nhiều điểm
 *    của tầng nhất trong bán kính, hoà thì giếng gần cửa buồng thang N3 (sảnh chung khoang đệm, 6.13 cho phép ≥ 6 m²).
 */
import type { Diem } from './kieu';
import type { MatToa } from './pccc';

/** Hình lõi tải từ /lib/loi/<id>.json (chỉ các trường dùng ở đây). */
export type LoiGieng = { so_gieng?: number; vi_tri_gieng?: Diem[] };
export type GiengThang = { p: Diem; loiKhoa: string; block: string; chiSo: number };

const rad = (d: number) => (d * Math.PI) / 180;
const kc = (a: Diem, b: Diem) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Số giếng ghi trong tên khối lõi `x_<tmdv|xh>_<mẫu>_tm_<NN>` (dự phòng khi chưa tải hình lõi; QT-64: 21/24 lõi khớp hình). */
export const soGiengTheoTen = (block: string): number | null => {
  const m = /_tm_(\d+)$/.exec(block);
  return m ? Number(m[1]) : null;
};

/**
 * Giếng thang máy trên một mặt bằng tầng (mm thế giới mẫu tòa): mỗi lõi (phần tử không phải căn / thang bộ, bỏ dải chiếu `bang`,
 * bỏ lượt chèn lặp cùng điểm) lấy `vi_tri_gieng` của hình lõi đã tải; chưa tải thì đếm theo tên khối, không có toạ độ.
 */
export function giengThangMay(mat: MatToa[], loi: (block: string) => LoiGieng | undefined) {
  const gieng: GiengThang[] = [];
  let soTheoTen = 0, thieuHinh = false;
  const da = new Set<string>();
  mat.forEach((m, mi) => m.phan_tu.forEach((q, i) => {
    if (q.loai === 'can' || q.loai === 'thang_bo' || q.bang || !q.block) return;
    const k = `${q.block}@${Math.round(q.x / 50)},${Math.round(q.y / 50)}`;
    if (da.has(k)) return;
    da.add(k);
    const khoa = q.khoa ?? `${mi}:${i}`;
    const h = loi(q.block);
    if (!h || !Array.isArray(h.vi_tri_gieng)) {
      const n = soGiengTheoTen(q.block);
      if (n !== null) { soTheoTen += n; thieuHinh = true; }
      return;
    }
    const c = Math.cos(rad(q.rot)), s = Math.sin(rad(q.rot));
    h.vi_tri_gieng.forEach(([x, y], j) => {
      const X = x * q.sx, Y = y * q.sy;
      gieng.push({ p: [q.x + X * c - Y * s, q.y + X * s + Y * c], loiKhoa: khoa, block: q.block, chiSo: j });
    });
  }));
  return { gieng, so: gieng.length + soTheoTen, thieuHinh };
}

export const CAN_MOI_THANG = 70; // QCVN 04:2021 2.4.2
export const DAN_MOI_THANG = 200; // QCVN 04:2021 2.4.2
export const CAN_CU_SO_THANG = 'QCVN 04:2021/BXD 2.4.1 · 2.4.2';

export type YeuCauThangMay = {
  /** 2.4.1: ≥ 5 tầng → 1, ≥ 10 tầng → 2, dưới 5 tầng → 0 */
  theoTang: number;
  theoCan: number;
  theoDan: number | null;
  /** số cần = max(theoTang, min(theoCan, theoDan)) — QT-94 lấy cách cho ít thang hơn */
  can: number;
  cachTinh: 'can' | 'dan';
};

/** Số thang máy cần cho một tòa: `soTang` = tổng số tầng nổi, `soCan` / `dan` = cả tòa (dân null = chưa tính được). */
export function thangMayCan(soTang: number, soCan: number, dan: number | null): YeuCauThangMay {
  const theoTang = soTang >= 10 ? 2 : soTang >= 5 ? 1 : 0;
  const theoCan = Math.ceil(soCan / CAN_MOI_THANG);
  const theoDan = dan === null ? null : Math.ceil(dan / DAN_MOI_THANG);
  const cachTinh = theoDan !== null && theoDan < theoCan ? 'dan' : 'can';
  const it = cachTinh === 'dan' ? theoDan! : theoCan;
  return { theoTang, theoCan, theoDan, can: Math.max(theoTang, it), cachTinh };
}

export type MucThang = 'ok' | 'canh_bao' | 'vuot';
export type KiemThangMay = YeuCauThangMay & { co: number; muc: MucThang; canMoiThang: number | null; danMoiThang: number | null; thieuHinh: boolean };

export function kiemThangMay(co: number, soTang: number, soCan: number, dan: number | null, thieuHinh = false): KiemThangMay {
  const yc = thangMayCan(soTang, soCan, dan);
  return {
    ...yc, co, thieuHinh,
    muc: co >= yc.can ? 'ok' : 'vuot',
    canMoiThang: co ? soCan / co : null,
    danMoiThang: co && dan !== null ? dan / co : null,
  };
}

// ---------- thang máy chữa cháy ----------
/** Ngưỡng chiều cao PCCC phải có thang máy chữa cháy với nhà nhóm F1.3 (QCVN 06 6.13 · QCVN 04 2.4.3). */
export const H_TMCC_F13 = 50;
/** Bán kính phục vụ thang máy chữa cháy (m): 6.13 → 60 m; nhà > 75 m (A.2.12) → 45 m. */
export const banKinhTMCC = (H: number) => (H > 75 ? { r: 45, canCu: 'QCVN 06:2022 A.2.12' } : { r: 60, canCu: 'QCVN 06:2022 6.13' });
export const canTMCC = (H: number) => H > H_TMCC_F13;

export type ChonTMCC = {
  /** chỉ số giếng (trong danh sách `gieng`) chỉ định là thang chữa cháy */
  chon: number[];
  /** điểm phải phủ nằm ngoài bán kính của mọi thang chữa cháy đã chọn */
  ngoai: number[];
  /** khoảng cách thẳng lớn nhất (mm) từ thang chữa cháy gần nhất tới điểm phải phủ */
  xaNhat: number;
  r: number;
};

/**
 * Chọn giếng thang chữa cháy (phủ tham lam): mỗi lượt chọn giếng phủ nhiều điểm còn lại nhất trong bán kính `rMm`, hoà thì giếng
 * gần cửa buồng thang N3 nhất (gộp khoang đệm), rồi giếng đứng trước. Dừng khi phủ hết hoặc không giếng nào phủ thêm.
 * Đo THẲNG từ tâm giếng (6.13 không ghi "theo đường đi", khác QCVN 04 2.5.3 — cách đọc chờ chủ nhiệm chốt).
 */
export function chonThangChuaChay(gieng: Diem[], diem: Diem[], rMm: number, cuaN3: Diem[] = [], toiThieu = 1): ChonTMCC {
  const chon: number[] = [];
  if (!gieng.length) return { chon, ngoai: diem.map((_, i) => i), xaNhat: Infinity, r: rMm };
  const conLai = new Set(diem.map((_, i) => i));
  const ganN3 = gieng.map((g) => (cuaN3.length ? Math.min(...cuaN3.map((c) => kc(c, g))) : 0));
  while (true) {
    let tot = -1, so = -1;
    gieng.forEach((g, gi) => {
      if (chon.includes(gi)) return;
      let n = 0;
      for (const k of conLai) if (kc(g, diem[k]) <= rMm) n++;
      if (n > so || (n === so && tot >= 0 && ganN3[gi] < ganN3[tot] - 1)) { so = n; tot = gi; }
    });
    if (tot < 0 || (so <= 0 && chon.length >= toiThieu)) break;
    chon.push(tot);
    for (const k of [...conLai]) if (kc(gieng[tot], diem[k]) <= rMm) conLai.delete(k);
    if (!conLai.size && chon.length >= toiThieu) break;
  }
  let xaNhat = 0;
  for (const d of diem) xaNhat = Math.max(xaNhat, Math.min(...chon.map((gi) => kc(gieng[gi], d))));
  return { chon, ngoai: [...conLai].sort((a, b) => a - b), xaNhat, r: rMm };
}
