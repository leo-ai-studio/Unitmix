/** Phiên bản app do Vite chèn lúc build / chạy dev (xem `define` trong vite.config.ts). */
declare const __PHIEN_BAN__: string;
declare const __COMMIT__: string;
declare const __NGAY_BUILD__: string;

const doc = (f: () => string, mac: string) => {
  try {
    return f() || mac;
  } catch {
    return mac; // chạy ngoài Vite (vd. test node thuần): hằng chưa được thay
  }
};

export const PHIEN_BAN = doc(() => __PHIEN_BAN__, '0.0.0');
export const COMMIT = doc(() => __COMMIT__, '');
export const NGAY_BUILD = doc(() => __NGAY_BUILD__, '');

/** Chuỗi ngắn hiện trên app, vd. "v0.2.0 · 6b9436c · 2026-10-28". */
export const nhanPhienBan = (): string => ['v' + PHIEN_BAN, COMMIT, NGAY_BUILD].filter(Boolean).join(' · ');
