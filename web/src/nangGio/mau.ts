/**
 * Thang màu phân tích + đổi lưới số thành ảnh (blob URL) cho 2D (SVG `<image>`) và 3D (texture).
 * Thang giờ nắng: liên tục, tối (ít nắng) → vàng sáng (nhiều nắng), sáng dần đều theo độ sáng cảm nhận — đọc được cả khi in đen trắng.
 * Màu tiện nghi gió: 5 lớp kiểu Lawson (xanh = êm → đỏ = không tiện nghi). Màu riêng của app, không chép bảng màu Forma.
 */
const MOC_NANG: [number, [number, number, number]][] = [
  [0, [32, 36, 74]], [0.2, [74, 48, 120]], [0.42, [150, 62, 112]], [0.62, [214, 98, 72]], [0.82, [244, 168, 66]], [1, [250, 232, 128]],
];
export function mauNang(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  for (let i = 1; i < MOC_NANG.length; i++) {
    const [b, cb] = MOC_NANG[i];
    if (x <= b) {
      const [a, ca] = MOC_NANG[i - 1], k = (x - a) / (b - a);
      return [ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k].map(Math.round) as [number, number, number];
    }
  }
  return MOC_NANG[MOC_NANG.length - 1][1];
}
export const GRADIENT_NANG = `linear-gradient(90deg, ${MOC_NANG.map(([t, c]) => `rgb(${c.join(',')}) ${t * 100}%`).join(', ')})`;

/** Lớp tiện nghi 0 ngồi lâu · 1 đứng · 2 dạo bộ · 3 đi nhanh · 4 không tiện nghi. */
export const MAU_GIO: [number, number, number][] = [[58, 143, 183], [108, 195, 160], [242, 209, 107], [242, 155, 75], [217, 83, 79]];
const css = (c: [number, number, number]) => `rgb(${c.join(',')})`;
export const MAU_GIO_CSS = MAU_GIO.map(css);
/** Thang hệ số tăng tốc K (0 → 1,6): xanh lặng → trắng (bằng đầu gió) → đỏ (tăng tốc). */
export function mauK(k: number): [number, number, number] {
  if (!Number.isFinite(k)) return [0, 0, 0];
  const lo: [number, number, number] = [40, 110, 170], mid: [number, number, number] = [235, 235, 225], hi: [number, number, number] = [200, 40, 40];
  const t = Math.min(1.6, Math.max(0, k));
  const [a, b, s] = t < 1 ? [lo, mid, t] : [mid, hi, (t - 1) / 0.6];
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * s)) as [number, number, number];
}
export const GRADIENT_K = 'linear-gradient(90deg, rgb(40,110,170) 0%, rgb(235,235,225) 62.5%, rgb(200,40,40) 100%)';

/** Lưới → RGBA theo thứ tự lưới (hàng 0 = phía Nam / y0), ô `mau` trả null thì trong suốt. Dùng thẳng làm DataTexture 3D. */
export function rgbaLuoi(nx: number, ny: number, mau: (i: number) => [number, number, number] | null, alpha = 255): Uint8Array {
  const d = new Uint8Array(nx * ny * 4);
  for (let i = 0; i < nx * ny; i++) {
    const m = mau(i);
    if (!m) continue;
    const o = i * 4;
    d[o] = m[0]; d[o + 1] = m[1]; d[o + 2] = m[2]; d[o + 3] = alpha;
  }
  return d;
}

/**
 * RGBA lưới → ảnh PNG blob URL cho SVG `<image>` (lật hàng: hàng đầu ảnh = phía Bắc). Mã hoá PNG chạy ngoài luồng chính khi có
 * OffscreenCanvas.convertToBlob. Nhớ `URL.revokeObjectURL` khi bỏ.
 */
export async function anhTuRgba(rgba: Uint8Array, nx: number, ny: number): Promise<string> {
  const d = new Uint8ClampedArray(nx * ny * 4);
  for (let r = 0; r < ny; r++) d.set(rgba.subarray(r * nx * 4, (r + 1) * nx * 4), (ny - 1 - r) * nx * 4);
  const im = new ImageData(d, nx, ny);
  if (typeof OffscreenCanvas !== 'undefined') {
    const cv = new OffscreenCanvas(nx, ny);
    cv.getContext('2d')!.putImageData(im, 0, 0);
    return URL.createObjectURL(await cv.convertToBlob({ type: 'image/png' }));
  }
  const cv = document.createElement('canvas');
  cv.width = nx; cv.height = ny;
  cv.getContext('2d')!.putImageData(im, 0, 0);
  const blob = await new Promise<Blob | null>((ok) => cv.toBlob(ok, 'image/png'));
  return blob ? URL.createObjectURL(blob) : cv.toDataURL();
}
