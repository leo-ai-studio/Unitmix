/**
 * Nguồn ảnh bản đồ nền (ô XYZ Web Mercator 256 px) — xem docs/vi_tri_nang_gio.md mục Nguồn ảnh & điều khoản.
 * - `esri` (mặc định): Esri World Imagery, không cần khoá. Ghi "Powered by Esri" + nguồn ảnh. Muốn dùng thương mại đúng điều khoản:
 *   chủ app tạo khoá ArcGIS Location Platform (bậc miễn phí 2 triệu ô / tháng) → biến build `VITE_ESRI_KEY` (gắn `?token=`).
 * - `osm`: bản đồ OpenStreetMap (tile.openstreetmap.org) — chỉ dùng nhẹ theo chính sách OSMF, ghi "© OpenStreetMap contributors".
 * - `google`: Google Map Tiles API (2D, vệ tinh) — CHỈ khi chủ app cấu hình khoá (`VITE_GOOGLE_MAPS_KEY` lúc build hoặc biến Worker
 *   `GOOGLE_MAPS_KEY` đọc qua `/api/ban-do/cau-hinh`). Cần phiên (createSession), ghi logo / chữ "Google" + chuỗi bản quyền từ viewport.
 * Không lưu đệm ô ngoài bộ đệm HTTP của trình duyệt (điều khoản Google / OSM cấm tải trước / lưu kho).
 */
import type { NguonBanDo } from './kho';

type Env = { VITE_GOOGLE_MAPS_KEY?: string; VITE_ESRI_KEY?: string };
const env = ((import.meta as unknown as { env?: Env }).env ?? {}) as Env;

export const GHI_ESRI = 'Powered by Esri · Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community';
export const GHI_OSM = '© OpenStreetMap contributors';

let cauHinh: Promise<{ google: string | null }> | null = null;
/** Khoá Google (nếu chủ app cấu hình). Khoá trình duyệt nên giới hạn theo tên miền (HTTP referrer) trong Google Cloud Console. */
export function docCauHinh(): Promise<{ google: string | null }> {
  return (cauHinh ??= (async () => {
    if (env.VITE_GOOGLE_MAPS_KEY) return { google: env.VITE_GOOGLE_MAPS_KEY };
    try {
      const r = await fetch('/api/ban-do/cau-hinh');
      if (!r.ok) return { google: null };
      const j = (await r.json()) as { google?: string | null };
      return { google: typeof j.google === 'string' && j.google ? j.google : null };
    } catch { return { google: null }; }
  })());
}

type PhienGoogle = { session: string; het: number; key: string };
let phien: Promise<PhienGoogle | null> | null = null;
async function phienGoogle(): Promise<PhienGoogle | null> {
  const { google } = await docCauHinh();
  if (!google) return null;
  try {
    const cu = JSON.parse(sessionStorage.getItem('unitmix.ggPhien') ?? 'null') as PhienGoogle | null;
    if (cu && cu.key === google && cu.het > Date.now() + 3600e3) return cu;
  } catch { /* bỏ */ }
  const r = await fetch(`https://tile.googleapis.com/v1/createSession?key=${encodeURIComponent(google)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mapType: 'satellite', language: 'vi-VN', region: 'VN' }),
  });
  if (!r.ok) return null;
  const j = (await r.json()) as { session: string; expiry: string };
  const p = { session: j.session, het: +j.expiry * 1000, key: google };
  try { sessionStorage.setItem('unitmix.ggPhien', JSON.stringify(p)); } catch { /* bỏ */ }
  return p;
}

export type MauO = { url: (z: number, x: number, y: number) => string; zMax: number; ghi: string; google?: { session: string; key: string } };
/** Mẫu URL ô của nguồn; Google chưa cấu hình → trả về Esri. */
export async function mauO(n: NguonBanDo): Promise<MauO> {
  if (n === 'google') {
    const p = await (phien ??= phienGoogle().catch(() => null));
    if (p) return { url: (z, x, y) => `https://tile.googleapis.com/v1/2dtiles/${z}/${x}/${y}?session=${p.session}&key=${p.key}`, zMax: 21, ghi: 'Google', google: p };
  }
  if (n === 'osm') return { url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`, zMax: 19, ghi: GHI_OSM };
  const tk = env.VITE_ESRI_KEY ? `?token=${encodeURIComponent(env.VITE_ESRI_KEY)}` : '';
  return { url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}${tk}`, zMax: 19, ghi: GHI_ESRI };
}

/** Chuỗi bản quyền Google cho khung nhìn (bắt buộc hiện cạnh logo Google). */
export async function banQuyenGoogle(m: MauO, z: number, k: { w: number; s: number; e: number; n: number }): Promise<string> {
  if (!m.google) return m.ghi;
  try {
    const r = await fetch(`https://tile.googleapis.com/tile/v1/viewport?session=${m.google.session}&key=${m.google.key}&zoom=${z}&north=${k.n}&south=${k.s}&east=${k.e}&west=${k.w}`);
    const j = (await r.json()) as { copyright?: string };
    return `Google${j.copyright ? ' · ' + j.copyright : ''}`;
  } catch { return 'Google'; }
}
