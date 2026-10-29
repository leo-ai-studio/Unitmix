/*
 * Worker ghép ô bản đồ thành một ảnh (atlas) cho mặt đất 3D: tải từng ô (fetch, theo bộ đệm HTTP của trình duyệt), giải mã
 * (createImageBitmap) và vẽ lên OffscreenCanvas — toàn bộ ngoài luồng chính; trả ImageBitmap (chuyển quyền, không chép).
 * Ô lỗi để trống (xám nhạt). Huỷ = terminate.
 */
type Thu = { id: number; urls: string[][]; px: number };
const ctx = self as unknown as { onmessage: ((e: MessageEvent<Thu>) => void) | null; postMessage: (m: unknown, t?: Transferable[]) => void };

ctx.onmessage = async (e) => {
  const { id, urls, px } = e.data;
  const hang = urls.length, cot = urls[0]?.length ?? 0;
  const o = Math.floor(px / Math.max(hang, cot));
  const cv = new OffscreenCanvas(cot * o, hang * o), g = cv.getContext('2d')!;
  g.fillStyle = '#d9d6cc'; g.fillRect(0, 0, cv.width, cv.height);
  let loi = 0;
  await Promise.all(urls.flatMap((r, y) => r.map(async (u, x) => {
    try {
      const res = await fetch(u, { mode: 'cors', credentials: 'omit' });
      if (!res.ok) { loi++; return; }
      const b = await createImageBitmap(await res.blob());
      g.drawImage(b, x * o, y * o, o, o);
      b.close();
    } catch { loi++; }
  })));
  const anh = cv.transferToImageBitmap();
  ctx.postMessage({ id, anh, loi }, [anh]);
};
