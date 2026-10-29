/**
 * VỊ TRÍ DỰ ÁN TRÊN BẢN ĐỒ — toạ độ WGS84, tham chiếu bản vẽ (m, +Y = trục bản vẽ) → mặt đất (Đông / Bắc, m) → kinh vĩ độ,
 * và toán ô bản đồ Web Mercator (XYZ, như Google / Esri / OSM). Hàm thuần, không gọi mạng.
 *
 * Một nguồn: vĩ / kinh độ ở `TrangThaiPA.viTri`, góc Bắc ở `TrangThaiPA.huongView.gocBac` (la bàn 2D, mặt trời 3D, điểm view đã dùng).
 * Đặt vị trí thì ghi luôn `huongView.viDo` = vĩ độ (`ganViTri`) để điểm view (tinh/huongView.ts) đọc đúng mà không phải sửa tệp đó.
 * PA cũ chưa có `viTri`: vĩ độ lấy `huongView.viDo` (mặc định Hà Nội 21,03), kinh độ Hà Nội 105,85 — `coToaDo = false`.
 *
 * Phép đổi bản vẽ → mặt đất (ENU cục bộ quanh điểm neo): v = tyLe · R(gocBac) · (p − neo), với gocBac = góc (°) theo chiều kim đồng hồ
 * từ Bắc thật tới +Y bản vẽ:  Đông = x·cos g + y·sin g;  Bắc = −x·sin g + y·cos g.  Mặt đất → kinh vĩ: mặt phẳng tiếp xúc trên ellipsoid
 * WGS84 (bán kính kinh tuyến M, vòng thẳng đứng N) — sai số < 1 cm trong 2 km quanh neo, thừa cho một khu đất.
 */
import type { Diem, TrangThaiPA, ViTriLuu } from './kieu';

const RAD = Math.PI / 180;
const A_WGS = 6378137, E2 = 0.00669437999014;

export type LatLng = { lat: number; lng: number };
export type ViTri = { lat: number; lng: number; neo: Diem; tyLe: number; gocBac: number; coToaDo: boolean; cachDat?: ViTriLuu['cachDat'] };

export const VI_TRI_MAC_DINH: LatLng = { lat: 21.03, lng: 105.85 };

const hopLe = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
const chuanGoc = (g: number) => (((Number.isFinite(g) ? g : 0) % 360) + 360) % 360;

/** Vị trí đủ trường của PA (một nguồn cho mọi nơi dùng toạ độ / góc Bắc). */
export function viTriPA(pa: Pick<TrangThaiPA, 'viTri' | 'huongView'>): ViTri {
  const v = pa.viTri, gocBac = chuanGoc(pa.huongView?.gocBac ?? 0);
  if (v && hopLe(v.lat, v.lng)) {
    return { lat: v.lat, lng: v.lng, neo: v.neo ?? [0, 0], tyLe: v.tyLe && v.tyLe > 0 ? v.tyLe : 1, gocBac, coToaDo: true, cachDat: v.cachDat };
  }
  const vd = pa.huongView?.viDo;
  return { lat: typeof vd === 'number' && Number.isFinite(vd) ? vd : VI_TRI_MAC_DINH.lat, lng: VI_TRI_MAC_DINH.lng, neo: [0, 0], tyLe: 1, gocBac, coToaDo: false };
}

/** PA mới có vị trí `v` (+ góc Bắc nếu cho): ghi `viTri` và soi sang `huongView.viDo` / `gocBac` (giữ tương thích điểm view). */
export function ganViTri<P extends Pick<TrangThaiPA, 'viTri' | 'huongView'>>(pa: P, v: ViTriLuu | null, gocBac?: number): P {
  const hv = { ...(pa.huongView ?? {}) };
  if (gocBac !== undefined) hv.gocBac = Math.round(chuanGoc(gocBac) * 100) / 100;
  if (!v) { const { viTri: _bo, ...con } = pa; return { ...con, huongView: hv } as P; }
  hv.viDo = Math.round(v.lat * 1e4) / 1e4;
  const luu: ViTriLuu = { lat: +v.lat.toFixed(7), lng: +v.lng.toFixed(7), neo: [+v.neo[0].toFixed(3), +v.neo[1].toFixed(3)] };
  if (v.tyLe && Math.abs(v.tyLe - 1) > 1e-6) luu.tyLe = +v.tyLe.toFixed(6);
  if (v.cachDat) luu.cachDat = v.cachDat;
  return { ...pa, viTri: luu, huongView: hv };
}

/** Chuẩn hoá khi mở PA: `viTri` hỏng thì bỏ; có `viTri` thì `huongView.viDo` theo vĩ độ của nó. */
export function chuanHoaViTri<P extends Pick<TrangThaiPA, 'viTri' | 'huongView'>>(pa: P): P {
  const v = pa.viTri;
  if (!v) return pa;
  if (!hopLe(v.lat, v.lng) || !Array.isArray(v.neo)) { const { viTri: _bo, ...con } = pa; return con as P; }
  if (pa.huongView?.viDo === Math.round(v.lat * 1e4) / 1e4) return pa;
  return { ...pa, huongView: { ...(pa.huongView ?? {}), viDo: Math.round(v.lat * 1e4) / 1e4 } };
}

// ---------- đọc liên kết Google Maps / Google Earth / chuỗi toạ độ ----------
export type KetQuaLienKet = { lat: number; lng: number; nguon: 'ghim' | 'tam' | 'q' | 'chuoi' | 'dms' } | { loi: 'rutGon' | 'khongDoc' };

const dms = (d: string, m?: string, s?: string, h?: string) => {
  const v = +d + (m ? +m / 60 : 0) + (s ? +s / 3600 : 0);
  return h && /[SWsw]/.test(h) ? -v : v;
};

/**
 * Toạ độ từ liên kết Google Maps / Google Earth hoặc chuỗi người dùng dán. Ưu tiên ghim địa điểm (`!3d…!4d…`) hơn tâm khung nhìn (`@lat,lng`).
 * Dạng nhận: `…/@21.02,105.85,17z`, `…!3d21.02!4d105.85`, `?q=21.02,105.85`, `?query=`, `?ll=`, `/place/21.02,105.85`,
 * Google Earth `earth.google.com/web/@21.02,105.85,12a,…`, "21.0285, 105.8542", "21.0285 105.8542", DMS `21°01'42.6"N 105°51'15.1"E`.
 * Liên kết rút gọn (maps.app.goo.gl, goo.gl/maps) không mở được từ trình duyệt (chặn CORS) → `loi: 'rutGon'`.
 */
export function docLienKet(chuoi: string): KetQuaLienKet {
  let s = (chuoi ?? '').trim();
  if (!s) return { loi: 'khongDoc' };
  if (/^(https?:\/\/)?(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\//i.test(s)) return { loi: 'rutGon' };
  try { s = decodeURIComponent(s.replace(/\+/g, ' ')); } catch { /* giữ nguyên */ }
  const so = '(-?\\d{1,3}(?:\\.\\d+)?)';
  const thu = (re: RegExp, nguon: 'ghim' | 'tam' | 'q' | 'chuoi'): KetQuaLienKet | null => {
    const m = s.match(re);
    if (!m) return null;
    const lat = +m[1], lng = +m[2];
    return hopLe(lat, lng) ? { lat, lng, nguon } : null;
  };
  // ghim địa điểm: lấy cặp !3d!4d cuối (dữ liệu địa điểm đứng sau khung nhìn)
  const ghim = [...s.matchAll(new RegExp(`!3d${so}!4d${so}`, 'g'))].pop();
  if (ghim && hopLe(+ghim[1], +ghim[2])) return { lat: +ghim[1], lng: +ghim[2], nguon: 'ghim' };
  return thu(new RegExp(`[?&](?:q|query|ll|destination|center)=(?:loc:)?\\s*${so}\\s*,\\s*${so}`), 'q')
    ?? thu(new RegExp(`/place/${so}\\s*,\\s*${so}`), 'q')
    ?? thu(new RegExp(`@${so},${so}`), 'tam')
    ?? docDms(s)
    ?? thu(new RegExp(`^\\s*\\(?${so}\\s*[,;\\s]\\s*${so}\\)?\\s*$`), 'chuoi')
    ?? { loi: 'khongDoc' };
}
function docDms(s: string): KetQuaLienKet | null {
  const re = /(\d{1,3})\s*°\s*(?:(\d{1,2}(?:\.\d+)?)\s*['′]\s*)?(?:(\d{1,2}(?:\.\d+)?)\s*["″]\s*)?([NSEW])/gi;
  const m = [...s.matchAll(re)];
  if (m.length < 2) return null;
  const a = m.map((x) => ({ v: dms(x[1], x[2], x[3], x[4]), la: /[NS]/i.test(x[4]) }));
  const lat = a.find((x) => x.la)?.v, lng = a.find((x) => !x.la)?.v;
  return lat !== undefined && lng !== undefined && hopLe(lat, lng) ? { lat, lng, nguon: 'dms' } : null;
}

// ---------- bản vẽ ↔ mặt đất ↔ kinh vĩ ----------
/** Bán kính kinh tuyến M và vòng thẳng đứng N (m) ở vĩ độ lat (WGS84). */
function banKinh(lat: number) {
  const s = Math.sin(lat * RAD), w = 1 - E2 * s * s;
  return { M: (A_WGS * (1 - E2)) / Math.pow(w, 1.5), N: A_WGS / Math.sqrt(w) };
}
/** Điểm bản vẽ (m) → Đông / Bắc (m) so với điểm neo. */
export function banVeSangDat(p: Diem, v: Pick<ViTri, 'neo' | 'tyLe' | 'gocBac'>): Diem {
  const g = v.gocBac * RAD, c = Math.cos(g), s = Math.sin(g), dx = (p[0] - v.neo[0]) * v.tyLe, dy = (p[1] - v.neo[1]) * v.tyLe;
  return [dx * c + dy * s, -dx * s + dy * c];
}
/** Đông / Bắc (m) so với neo → điểm bản vẽ (m). */
export function datSangBanVe(d: Diem, v: Pick<ViTri, 'neo' | 'tyLe' | 'gocBac'>): Diem {
  const g = v.gocBac * RAD, c = Math.cos(g), s = Math.sin(g);
  return [(d[0] * c - d[1] * s) / v.tyLe + v.neo[0], (d[0] * s + d[1] * c) / v.tyLe + v.neo[1]];
}
/** Kinh vĩ → Đông / Bắc (m) quanh gốc (lat0, lng0). */
export function llSangDat(ll: LatLng, goc: LatLng): Diem {
  const { M, N } = banKinh(goc.lat);
  return [(ll.lng - goc.lng) * RAD * N * Math.cos(goc.lat * RAD), (ll.lat - goc.lat) * RAD * M];
}
export function datSangLl(d: Diem, goc: LatLng): LatLng {
  const { M, N } = banKinh(goc.lat);
  return { lat: goc.lat + d[1] / M / RAD, lng: goc.lng + d[0] / (N * Math.cos(goc.lat * RAD)) / RAD };
}
export const banVeSangLl = (p: Diem, v: ViTri): LatLng => datSangLl(banVeSangDat(p, v), v);
export const llSangBanVe = (ll: LatLng, v: ViTri): Diem => datSangBanVe(llSangDat(ll, v), v);

/**
 * Khớp hai điểm: điểm bản vẽ a, b (m) nằm ở kinh vĩ A, B → neo = a ở A, góc Bắc, tỷ lệ (mét thật / mét bản vẽ).
 * Trả null khi hai điểm trùng. `lech` = độ lệch tỷ lệ so với 1 (≥ 2 % thường là chọn sai điểm hoặc bản vẽ không theo mét).
 */
export function khopHaiDiem(a: Diem, A: LatLng, b: Diem, B: LatLng): { viTri: ViTriLuu; gocBac: number; tyLe: number; lech: number } | null {
  const dv: Diem = [b[0] - a[0], b[1] - a[1]], dd = llSangDat(B, A);
  const lv = Math.hypot(dv[0], dv[1]), ld = Math.hypot(dd[0], dd[1]);
  if (lv < 1e-6 || ld < 1e-6) return null;
  // phương vị thật của véc-tơ trên đất − phương vị của nó trên bản vẽ (so với +Y) = góc Bắc
  const pvDat = Math.atan2(dd[0], dd[1]) / RAD, pvVe = Math.atan2(dv[0], dv[1]) / RAD;
  const gocBac = chuanGoc(pvDat - pvVe), tyLe = ld / lv;
  return { viTri: { lat: A.lat, lng: A.lng, neo: a, tyLe, cachDat: 'haiDiem' }, gocBac, tyLe, lech: Math.abs(tyLe - 1) };
}

/** Khung bao kinh vĩ của các điểm bản vẽ (nới thêm `nới` m mỗi phía). */
export function khungLl(diem: Diem[], v: ViTri, noi = 0): { w: number; s: number; e: number; n: number } {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const p of diem) {
    const d = banVeSangDat(p, v);
    w = Math.min(w, d[0] - noi); e = Math.max(e, d[0] + noi); s = Math.min(s, d[1] - noi); n = Math.max(n, d[1] + noi);
  }
  const a = datSangLl([w, s], v), b = datSangLl([e, n], v);
  return { w: a.lng, s: a.lat, e: b.lng, n: b.lat };
}

// ---------- ô bản đồ Web Mercator (XYZ) ----------
export const KICH_O = 256;
/** Kinh vĩ → toạ độ ô (số thực) ở mức z: phần nguyên = chỉ số ô x / y (y tăng xuống Nam). */
export function llSangO(lat: number, lng: number, z: number): [number, number] {
  const n = 2 ** z, la = Math.max(-85.0511, Math.min(85.0511, lat)) * RAD;
  return [((lng + 180) / 360) * n, ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n];
}
/** Toạ độ ô (số thực) → kinh vĩ. */
export function oSangLl(x: number, y: number, z: number): LatLng {
  const n = 2 ** z, lng = (x / n) * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) / RAD;
  return { lat, lng };
}
/** Mét mặt đất trên một điểm ảnh của ô 256 px ở mức z, vĩ độ lat. */
export const metMoiDiemAnh = (lat: number, z: number) => (2 * Math.PI * A_WGS * Math.cos(lat * RAD)) / (KICH_O * 2 ** z);
/** Mức zoom để một điểm ảnh ô ≈ `metPx` m (làm tròn lên cho nét, kẹp trong [zMin, zMax]). */
export function chonMuc(metPx: number, lat: number, zMin = 3, zMax = 19): number {
  const z = Math.log2((2 * Math.PI * A_WGS * Math.cos(lat * RAD)) / (KICH_O * Math.max(metPx, 1e-3)));
  return Math.max(zMin, Math.min(zMax, Math.ceil(z - 0.25)));
}
export type ODb = { z: number; x: number; y: number };
/** Các ô phủ khung kinh vĩ ở mức z (tối đa `toiDa` ô — vượt thì trả rỗng để bên gọi hạ mức). */
export function oPhu(k: { w: number; s: number; e: number; n: number }, z: number, toiDa = 400): ODb[] {
  const [x0, y0] = llSangO(k.n, k.w, z), [x1, y1] = llSangO(k.s, k.e, z), n = 2 ** z;
  const xa = Math.floor(x0), xb = Math.floor(x1), ya = Math.max(0, Math.floor(y0)), yb = Math.min(n - 1, Math.floor(y1));
  if ((xb - xa + 1) * (yb - ya + 1) > toiDa) return [];
  const kq: ODb[] = [];
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) kq.push({ z, x: ((x % n) + n) % n, y });
  return kq;
}
/** Bốn góc của ô (Tây Bắc, Đông Nam) theo mét Đông / Bắc quanh neo vị trí `v`. */
export function khungODat(o: ODb, v: LatLng): { tb: Diem; dn: Diem } {
  return { tb: llSangDat(oSangLl(o.x, o.y, o.z), v), dn: llSangDat(oSangLl(o.x + 1, o.y + 1, o.z), v) };
}
