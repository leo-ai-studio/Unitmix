/**
 * Trạng thái chung (theo phiên, không lưu PA) của gói Vị trí · Nắng · Gió: lớp bản đồ nền 2D / 3D, nguồn ảnh, độ mờ, ngày / giờ nắng,
 * kết quả phân tích gần nhất. Bản vẽ 2D, khung 3D và hộp điều khiển cùng đọc — đổi ở đâu thì nơi khác vẽ lại (đăng ký nghe).
 * Lựa chọn hiển thị nhớ ở localStorage (từng máy); toạ độ dự án lưu trong PA (`TrangThaiPA.viTri`).
 */
import { useEffect, useState } from 'preact/hooks';
import type { Diem } from '../tinh/kieu';
import type { KetQuaNang } from '../tinh/nangGio/gioNang';
import type { PhanBoGio } from '../tinh/nangGio/gio';

export type NguonBanDo = 'esri' | 'osm' | 'google';
export type LopPhanTich = 'nang' | 'gio' | null;
export type KetQuaGio = {
  luoi: { x0: number; y0: number; buoc: number; nx: number; ny: number };
  /** Lớp tiện nghi 0–4 mỗi ô (255 = trong khối / chưa tính). */
  lop: Uint8Array;
  /** Hệ số tăng tốc (tốc độ / đầu gió) của hướng đang xem, NaN = trong khối. */
  k: Float32Array;
  /** k theo từng hướng 16 phương (đã nội suy từ các hướng mô phỏng), để đổi hướng xem không phải chạy lại. */
  kHuong: Float32Array[];
  huongXem: number;
  /** Đường dòng (m, bản vẽ) của hướng đang xem. */
  dong: Diem[][];
  daXong: number; tong: number;
};

type TrangThai = {
  banDo2D: boolean; banDo3D: boolean; doMo: number; nguon: NguonBanDo;
  ngay: string; luc: number; duongMT: boolean;
  lop: LopPhanTich; hien2D: boolean; hien3D: boolean;
  /** Gió: xem lớp tiện nghi hay hệ số tăng tốc của một hướng. Nắng: hiện mặt đứng (3D). */
  gioXem: 'lop' | 'k'; dongGio: boolean; matDung: boolean;
  /** Bóng đổ 2D lúc giờ đang chọn (khi mở tab Nắng). */
  bong2D: boolean;
  /** Số đọc dưới con trỏ (2D / 3D). */
  docSo: { x: number; y: number; chu: string } | null;
  moHop: boolean; tab: 'viTri' | 'nang' | 'gio';
  nang: { ngay: string; kq: KetQuaNang | null; dang: boolean; loi: string };
  gio: { phanBo: PhanBoGio | null; dangTai: boolean; loiTai: string; kq: KetQuaGio | null; dang: boolean; loi: string };
  /** Chọn điểm trên bản vẽ 2D (khớp hai điểm): 'a' / 'b' đang chờ bấm. */
  chonDiem: 'a' | 'b' | null; diemA: Diem | null; diemB: Diem | null;
  /** Ghi nguồn ảnh (bắt buộc theo điều khoản nhà cung cấp) — 2D / 3D cùng hiện. */
  ghiNguon: string;
};

const LUU = 'unitmix.nang-gio.v1';
const nam = new Date().getFullYear();
const macDinh: TrangThai = {
  banDo2D: false, banDo3D: false, doMo: 0.85, nguon: 'esri',
  ngay: `${nam}-12-21`, luc: 9, duongMT: true,
  lop: null, hien2D: true, hien3D: true,
  gioXem: 'lop', dongGio: true, matDung: true, docSo: null, bong2D: true,
  moHop: false, tab: 'viTri',
  nang: { ngay: `${nam}-12-21`, kq: null, dang: false, loi: '' },
  gio: { phanBo: null, dangTai: false, loiTai: '', kq: null, dang: false, loi: '' },
  chonDiem: null, diemA: null, diemB: null, ghiNguon: '',
};
const doc = (): TrangThai => {
  try {
    const j = JSON.parse(localStorage.getItem(LUU) ?? '{}') as Partial<TrangThai>;
    return { ...macDinh, banDo2D: !!j.banDo2D, banDo3D: !!j.banDo3D, doMo: typeof j.doMo === 'number' ? Math.min(1, Math.max(0.1, j.doMo)) : macDinh.doMo, nguon: j.nguon === 'osm' || j.nguon === 'google' ? j.nguon : 'esri', duongMT: j.duongMT ?? true };
  } catch { return { ...macDinh }; }
};

let tt: TrangThai = typeof localStorage === 'undefined' ? { ...macDinh } : doc();
let phienBan = 0;
const nghe = new Set<() => void>();
export const layNG = (): TrangThai => tt;
export function datNG(p: Partial<TrangThai> | ((t: TrangThai) => Partial<TrangThai>)): void {
  const moi = typeof p === 'function' ? p(tt) : p;
  tt = { ...tt, ...moi };
  phienBan++;
  if ('banDo2D' in moi || 'banDo3D' in moi || 'doMo' in moi || 'nguon' in moi || 'duongMT' in moi) {
    try { localStorage.setItem(LUU, JSON.stringify({ banDo2D: tt.banDo2D, banDo3D: tt.banDo3D, doMo: tt.doMo, nguon: tt.nguon, duongMT: tt.duongMT })); } catch { /* chặn lưu */ }
  }
  nghe.forEach((f) => f());
}
export function ngheNG(f: () => void): () => void { nghe.add(f); return () => void nghe.delete(f); }
/** Hook: vẽ lại khi trạng thái đổi (chọn phần cần để đỡ vẽ lại — `chon` trả giá trị so sánh nông). */
export function useNG<T>(chon: (t: TrangThai) => T): T {
  const [, ve] = useState(0);
  useEffect(() => {
    let cu = chon(tt);
    return ngheNG(() => { const m = chon(tt); if (!bang(m, cu)) { cu = m; ve(phienBan); } });
  }, []);
  return chon(tt);
}
const bang = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
};

/** Máy cảm ứng / màn nhỏ: phân tích ở độ phân giải thấp hơn, ảnh nền nhỏ hơn. */
export const mayYeu = (): boolean => typeof matchMedia === 'function' && (matchMedia('(pointer: coarse)').matches || innerWidth < 768);
