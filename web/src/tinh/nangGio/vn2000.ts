/**
 * TOẠ ĐỘ BẢN VẼ QUY HOẠCH → KINH VĨ ĐỘ. Bản vẽ quy hoạch Việt Nam thường vẽ thẳng theo toạ độ VN-2000 (lưới chiếu trụ ngang đồng góc,
 * múi 3°, k0 = 0,9999, Đông giả 500 000 m, Bắc giả 0): trục x = Đông (~ 2·10⁵–8·10⁵), trục y = Bắc (~ 0,9–2,5·10⁶). Nhận ra dạng đó
 * thì đặt vị trí dự án thẳng từ tâm các lô — không phải dán link Google Maps / Google Earth.
 *
 * Phép chiếu ngược dùng ellipsoid WGS84 (VN-2000 dùng ellipsoid WGS-84; lệch gốc VN-2000 so với WGS84 cỡ vài mét — thừa cho việc đặt
 * ảnh nền / mặt trời; không dùng để cắm mốc). Hàm thuần, không gọi mạng. Kinh tuyến trục theo múi / tỉnh: chỉ liệt kê các tỉnh đã đối
 * chiếu chắc chắn; tỉnh khác nhập kinh tuyến trục tay (Thông tư 973/2001/TT-TCĐC có bảng đầy đủ theo tỉnh) — không đoán.
 */
import type { Diem } from '../kieu';

const RAD = Math.PI / 180;
const A = 6378137, E2 = 0.00669437999014, EP2 = E2 / (1 - E2);
const K0 = 0.9999, DONG_GIA = 500000;

export type LatLng = { lat: number; lng: number };

/** Kinh tuyến trục múi 3° (độ) các tỉnh / thành đã chắc chắn. `khop`: chuỗi (đã bỏ dấu, chữ thường) cần có trong tên địa điểm dự án. */
export const KINH_TUYEN_TRUC: { id: string; ten: string; ktt: number; khop: string[] }[] = [
  { id: 'hn', ten: 'Hà Nội', ktt: 105, khop: ['ha noi'] },
  { id: 'hp', ten: 'Hải Phòng', ktt: 105.75, khop: ['hai phong'] },
  { id: 'hcm', ten: 'TP. Hồ Chí Minh', ktt: 105.75, khop: ['ho chi minh', 'hcm', 'sai gon'] },
  { id: 'dn', ten: 'Đà Nẵng', ktt: 107.75, khop: ['da nang'] },
  { id: 'qn', ten: 'Quảng Ninh', ktt: 107.75, khop: ['quang ninh', 'ha long'] },
];

const boDau = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
/** Tỉnh trong danh sách có tên xuất hiện ở chuỗi địa điểm / tên dự án; không có thì null. */
export function tinhTuTen(chu: string): (typeof KINH_TUYEN_TRUC)[number] | null {
  const s = boDau(chu ?? '');
  return KINH_TUYEN_TRUC.find((t) => t.khop.some((k) => s.includes(k))) ?? null;
}

/** Phép chiếu ngược trụ ngang (Snyder): (Đông, Bắc) m → kinh vĩ độ, kinh tuyến trục `ktt` (độ). Trả thêm hội tụ lưới γ (độ). */
export function tmNghich(dong: number, bac: number, ktt: number): LatLng & { hoiTu: number } {
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const mu = bac / K0 / (A * (1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 ** 3) / 256));
  const p1 = mu + ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) + ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu)
    + ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) + ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const s = Math.sin(p1), c = Math.cos(p1), tg = Math.tan(p1);
  const C1 = EP2 * c * c, T1 = tg * tg, N1 = A / Math.sqrt(1 - E2 * s * s), R1 = (A * (1 - E2)) / Math.pow(1 - E2 * s * s, 1.5);
  const D = (dong - DONG_GIA) / (N1 * K0);
  const lat = p1 - ((N1 * tg) / R1) * (D * D / 2 - ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * D ** 4) / 24
    + ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * D ** 6) / 720);
  const dl = (D - ((1 + 2 * T1 + C1) * D ** 3) / 6 + ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * D ** 5) / 120) / c;
  const latD = lat / RAD, lngD = ktt + dl / RAD;
  return { lat: latD, lng: lngD, hoiTu: (lngD - ktt) * Math.sin(latD * RAD) };
}

/** Tâm khung bao các điểm. */
const tamBao = (ds: Diem[]): Diem => {
  const xs = ds.map((p) => p[0]), ys = ds.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
};

/**
 * Bản vẽ có phải toạ độ VN-2000 (x = Đông, y = Bắc)? Khung bao các lô nằm trong dải Việt Nam (Đông 1,5·10⁵–8,5·10⁵ m, Bắc 0,6·10⁶–2,6·10⁶ m)
 * và không quá lớn (≤ 30 km) — bản vẽ vẽ từ gốc (0, 0) hay hệ cục bộ thì không khớp. Trả tâm khung bao (m) hoặc null.
 */
export function nhanDangVN2000(ranhLo: Diem[]): Diem | null {
  const ds = ranhLo.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (!ds.length) return null;
  const xs = ds.map((p) => p[0]), ys = ds.map((p) => p[1]);
  const rong = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const [cx, cy] = tamBao(ds);
  const trongDai = cx >= 1.5e5 && cx <= 8.5e5 && cy >= 6e5 && cy <= 2.6e6;
  return trongDai && rong <= 3e4 ? [cx, cy] : null;
}

/**
 * Bản vẽ ghi toạ độ ĐẢO TRỤC (x ~ Bắc 0,6–2,6·10⁶, y ~ Đông 1,5–8,5·10⁵)? Trục như vậy là bản vẽ lật gương so với bản đồ — không đổi được bằng
 * xoay + dời, nên app KHÔNG tự đặt vị trí; chỉ nhận ra để báo người dùng (sửa trục trong CAD hoặc dùng tìm địa điểm).
 */
export function nhanDangDaoTruc(ranhLo: Diem[]): boolean {
  return nhanDangVN2000(ranhLo.map(([x, y]): Diem => [y, x])) !== null && nhanDangVN2000(ranhLo) === null;
}

/** Vị trí đặt từ bản vẽ VN-2000: điểm neo = tâm khung bao, kinh vĩ của nó, góc Bắc = hội tụ lưới (trục y bản vẽ = Bắc lưới). */
export function viTriTuVN2000(ranhLo: Diem[], ktt: number): { lat: number; lng: number; neo: Diem; gocBac: number } | null {
  const tam = nhanDangVN2000(ranhLo);
  if (!tam) return null;
  const r = tmNghich(tam[0], tam[1], ktt);
  if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) return null;
  return { lat: r.lat, lng: r.lng, neo: tam, gocBac: r.hoiTu };
}
