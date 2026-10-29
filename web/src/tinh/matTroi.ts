/**
 * MẶT TRỜI theo vị trí dự án, ngày, giờ địa phương — bọc thuật toán NOAA rút gọn ở `ba_chieu/nang.ts` (sai số độ cao < 0,1° trong 1800–2100,
 * NOAA Solar Calculator: https://gml.noaa.gov/grad/solcalc/calcdetails.html). Hàm thuần, dùng cả trong Web Worker.
 * Phương vị đo từ Bắc thật theo chiều kim đồng hồ; đổi sang bản vẽ bằng góc Bắc dự án (`huongView.gocBac`).
 */
import { viTriMatTroi } from '../ba_chieu/nang';

const RAD = Math.PI / 180;
export type MatTroi = { cao: number; phuongVi: number };
/** Một bước thời gian có nắng: giờ địa phương (giữa bước), độ dài bước (h), hướng TỚI mặt trời trên bản vẽ (x, y, z lên, đơn vị). */
export type BuocNang = { gio: number; dh: number; cao: number; phuongVi: number; huong: [number, number, number] };

/** Múi giờ (h) mặc định theo kinh độ; Việt Nam (102–110° Đ) = UTC+7. */
export const muiGioTheoKinhDo = (lng: number) => (lng >= 102 && lng <= 110 ? 7 : Math.round(lng / 15));

/** Thời điểm UTC của `ngay` (YYYY-MM-DD) lúc `gio` (giờ địa phương thập phân) ở múi `muiGio`. */
export function thoiDiem(ngay: string, gio: number, muiGio: number): Date {
  const [y, m, d] = ngay.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0) + (gio - muiGio) * 3600e3);
}

export function matTroi(lat: number, lng: number, ngay: string, gio: number, muiGio = muiGioTheoKinhDo(lng)): MatTroi {
  const r = viTriMatTroi(lat, lng, thoiDiem(ngay, gio, muiGio));
  return { cao: r.gocCao, phuongVi: r.phuongVi };
}

/** Véc-tơ đơn vị hướng tới mặt trời trong hệ bản vẽ (x, y theo bản vẽ, z lên) — `gocBac` = góc từ Bắc thật tới +Y bản vẽ. */
export function huongTia(m: MatTroi, gocBac: number): [number, number, number] {
  const a = (m.phuongVi - gocBac) * RAD, c = m.cao * RAD;
  return [Math.sin(a) * Math.cos(c), Math.cos(a) * Math.cos(c), Math.sin(c)];
}

/** Giờ mọc / lặn (giờ địa phương, độ cao tâm −0,833° gồm khúc xạ + bán kính đĩa); null nếu cả ngày trên / dưới chân trời. */
export function mocLan(lat: number, lng: number, ngay: string, muiGio = muiGioTheoKinhDo(lng)): { moc: number; lan: number } | null {
  const f = (g: number) => matTroi(lat, lng, ngay, g, muiGio).cao + 0.833;
  // trưa mặt trời ≈ giờ có độ cao lớn nhất (dò thô 10 phút rồi chia đôi hai phía)
  let gTrua = 12, cMax = -99;
  for (let g = 0; g <= 24; g += 1 / 6) { const c = f(g); if (c > cMax) { cMax = c; gTrua = g; } }
  if (cMax <= 0) return null;
  const chia = (a: number, b: number) => { for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if ((f(a) > 0) === (f(m) > 0)) a = m; else b = m; } return (a + b) / 2; };
  const a0 = gTrua - 12, b0 = gTrua + 12;
  if (f(a0) > 0 || f(b0) > 0) return null; // mặt trời không lặn (vùng cực)
  return { moc: chia(a0, gTrua), lan: chia(gTrua, b0) };
}

/** Đường đi mặt trời trong ngày (bước `phut`): các điểm có độ cao > −2°. */
export function duongDi(lat: number, lng: number, ngay: string, phut = 15, muiGio = muiGioTheoKinhDo(lng)): ({ gio: number } & MatTroi)[] {
  const kq: ({ gio: number } & MatTroi)[] = [];
  for (let g = 0; g <= 24 + 1e-9; g += phut / 60) {
    const m = matTroi(lat, lng, ngay, g, muiGio);
    if (m.cao > -2) kq.push({ gio: g, ...m });
  }
  return kq;
}

/**
 * Các bước thời gian có nắng trong ngày, chia đều `phut` phút từ mọc tới lặn (giữa mỗi bước). Bước có độ cao < `caoMin`° bỏ
 * (nắng sát chân trời: bóng dài vô hạn, Forma / Ladybug cũng bỏ). Tổng `dh` = số giờ mặt trời trên `caoMin`.
 */
export function buocNangTrongNgay(lat: number, lng: number, ngay: string, gocBac: number, phut = 15, caoMin = 1, muiGio = muiGioTheoKinhDo(lng)): BuocNang[] {
  const ml = mocLan(lat, lng, ngay, muiGio);
  if (!ml) return [];
  const kq: BuocNang[] = [], dh = phut / 60;
  for (let g0 = Math.floor(ml.moc * (60 / phut)) * dh; g0 < ml.lan; g0 += dh) {
    const a = Math.max(g0, ml.moc), b = Math.min(g0 + dh, ml.lan);
    if (b <= a) continue;
    const g = (a + b) / 2, m = matTroi(lat, lng, ngay, g, muiGio);
    if (m.cao < caoMin) continue;
    kq.push({ gio: g, dh: b - a, cao: m.cao, phuongVi: m.phuongVi, huong: huongTia(m, gocBac) });
  }
  return kq;
}

/** Ngày mặc định của phân tích: Đông chí / Hạ chí năm hiện tại. */
export const NGAY_DONG_CHI = (nam = new Date().getFullYear()) => `${nam}-12-21`;
export const NGAY_HA_CHI = (nam = new Date().getFullYear()) => `${nam}-06-21`;
