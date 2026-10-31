/**
 * Tìm địa điểm theo tên (khỏi dán link Google): OpenStreetMap Nominatim — không khoá, CORS mở, trình duyệt tự gửi Referer của app.
 * Điều khoản ([operations.osmfoundation.org/policies/nominatim](https://operations.osmfoundation.org/policies/nominatim/)): tối đa 1 yêu cầu / giây,
 * chỉ tìm khi người dùng bấm (không tìm theo từng phím), không tìm hàng loạt. Dữ liệu © OpenStreetMap contributors. Kết quả chỉ để đặt toạ độ.
 */
export type DiaDiem = { ten: string; lat: number; lng: number };

export async function timDiaDiem(chu: string, goi: typeof fetch = fetch, tin?: AbortSignal): Promise<DiaDiem[]> {
  const q = chu.trim();
  if (q.length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=vi&countrycodes=vn&q=${encodeURIComponent(q)}`;
  const r = await goi(url, { signal: tin, headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`nominatim ${r.status}`);
  const j = (await r.json()) as { display_name?: string; lat?: string; lon?: string }[];
  return j.flatMap((x) => {
    const lat = Number(x.lat), lng = Number(x.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [{ ten: x.display_name ?? `${lat}, ${lng}`, lat, lng }] : [];
  });
}
