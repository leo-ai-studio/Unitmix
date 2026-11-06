/**
 * Số liệu gió theo giờ một năm trọn gần nhất tại vị trí dự án từ Open-Meteo Historical Weather API (không khoá, CC BY 4.0;
 * gói miễn phí chỉ cho dùng phi thương mại — xem docs/vi_tri_nang_gio.md): https://open-meteo.com/en/docs/historical-weather-api
 * Gom ngay thành phân bố hướng × tốc độ (nhỏ) rồi nhớ ở localStorage theo ô 0,1° (lưới mô hình ~ 10 km) — mỗi vị trí tải một lần.
 * Mất mạng / lỗi: trả lỗi để giao diện báo, không chặn gì khác.
 */
import { huongChuDao, phanBo, type PhanBoGio } from '../tinh/nangGio/gio';

const KHOA = 'unitmix.gio.v1.';
export async function taiPhanBoGio(lat: number, lng: number, signal?: AbortSignal): Promise<PhanBoGio> {
  const la = lat.toFixed(1), lo = lng.toFixed(1), nam = new Date().getFullYear() - 1;
  const k = `${KHOA}${la},${lo},${nam}`;
  try { const c = localStorage.getItem(k); if (c) return JSON.parse(c) as PhanBoGio; } catch { /* bỏ */ }
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${la}&longitude=${lo}&start_date=${nam}-01-01&end_date=${nam}-12-31`
    + '&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=GMT';
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
  const j = (await r.json()) as { hourly?: { wind_speed_10m?: (number | null)[]; wind_direction_10m?: (number | null)[] } };
  const v = j.hourly?.wind_speed_10m ?? [], h = j.hourly?.wind_direction_10m ?? [];
  if (!v.length) throw new Error('Open-Meteo: không có số liệu');
  const p = { ...phanBo(v, h), nguon: `Open-Meteo (ERA5) ${nam}, ${la}° ${lo}°, 10 m` };
  // làm tròn để lưu gọn (~ 16 × 60 số)
  const gon = { ...p, f: p.f.map((r2) => r2.map((x) => +x.toFixed(6))) };
  try { localStorage.setItem(k, JSON.stringify(gon)); } catch { /* đầy: bỏ */ }
  return gon;
}

/** Ba hướng gió mạnh nhất của dự án để chấm bố cục; chưa đặt vị trí, mất mạng hoặc quá `choMs` thì null (bộ xếp dùng hướng quy ước). */
export async function huongGioDuAn(vt: { lat: number; lng: number; coToaDo: boolean }, choMs = 4000): Promise<{ ds: { pv: number; ts: number }[]; nguon: string } | null> {
  if (!vt.coToaDo) return null;
  const hoan = new AbortController(), hen = setTimeout(() => hoan.abort(), choMs);
  try {
    const p = await taiPhanBoGio(vt.lat, vt.lng, hoan.signal);
    return { ds: huongChuDao(p).slice(0, 3).map((h) => ({ pv: h.i * 22.5, ts: h.trongSo })), nguon: p.nguon ?? '' };
  } catch { return null; } finally { clearTimeout(hen); }
}
