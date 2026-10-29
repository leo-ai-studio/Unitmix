/** Lớp phân tích đang hiện (giờ nắng / gió) → ảnh RGBA trên lưới bản vẽ, dùng chung 2D và 3D; số đọc tại một điểm. Nhớ theo kết quả. */
import { t } from '../i18n/i18n';
import type { Diem } from '../tinh/kieu';
import type { LuoiNang } from '../tinh/nangGio/gioNang';
import { fmtSo } from '../ui/so';
import { layNG } from './kho';
import { MAU_GIO, mauK, mauNang, rgbaLuoi } from './mau';

export type AnhPT = { loai: 'nang' | 'gio'; luoi: LuoiNang; rgba: Uint8Array; /** cao độ mặt từng ô (nắng: mặt đất / mái) */ cao: Float32Array | null; khoa: object };

let nho: { k1: object; k2: string; a: AnhPT } | null = null;
export function anhPhanTich(): AnhPT | null {
  const s = layNG();
  if (s.lop === 'nang' && s.nang.kq) {
    const kq = s.nang.kq;
    if (nho && nho.k1 === kq && nho.k2 === 'nang') return nho.a;
    const T = Math.max(kq.tongGio, 1e-6);
    const a: AnhPT = { loai: 'nang', luoi: kq.luoi, rgba: rgbaLuoi(kq.luoi.nx, kq.luoi.ny, (i) => (Number.isFinite(kq.gio[i]) ? mauNang(kq.gio[i] / T) : null), 230), cao: kq.cao, khoa: kq };
    nho = { k1: kq, k2: 'nang', a };
    return a;
  }
  if (s.lop === 'gio' && s.gio.kq) {
    const kq = s.gio.kq, xemLop = s.gioXem === 'lop' && kq.kHuong.length > 0;
    const k2 = xemLop ? 'lop' : 'k' + kq.huongXem;
    if (nho && nho.k1 === kq && nho.k2 === k2) return nho.a;
    const a: AnhPT = {
      loai: 'gio', luoi: kq.luoi, cao: null, khoa: kq,
      rgba: rgbaLuoi(kq.luoi.nx, kq.luoi.ny, (i) => (xemLop ? (kq.lop[i] < 5 ? MAU_GIO[kq.lop[i]] : null) : Number.isFinite(kq.k[i]) ? mauK(kq.k[i]) : null), 215),
    };
    nho = { k1: kq, k2, a };
    return a;
  }
  return null;
}

export const TEN_LOP_GIO = (i: number) => t(`ng.gio.lop${i}`);
/** Số đọc của lớp đang hiện tại điểm bản vẽ p (m), null nếu ngoài lưới / ô trống. */
export function docTai(p: Diem): string | null {
  const s = layNG(), a = anhPhanTich();
  if (!a) return null;
  const L = a.luoi, c = Math.floor((p[0] - L.x0) / L.buoc), r = Math.floor((p[1] - L.y0) / L.buoc);
  if (c < 0 || r < 0 || c >= L.nx || r >= L.ny) return null;
  const i = r * L.nx + c;
  if (a.loai === 'nang' && s.nang.kq) {
    const v = s.nang.kq.gio[i], h = s.nang.kq.cao[i];
    if (!Number.isFinite(v)) return null;
    return `${fmtSo(v, { thapPhan: 1 })} h${h > 0.5 ? ` · ${t('ng.nang.mai')} +${fmtSo(h, { thapPhan: 1 })} m` : ''}`;
  }
  if (a.loai === 'gio' && s.gio.kq) {
    const kq = s.gio.kq, k = kq.k[i];
    const lop = kq.lop[i] < 5 ? TEN_LOP_GIO(kq.lop[i]) : null;
    if (!lop && !Number.isFinite(k)) return null;
    return [lop, Number.isFinite(k) ? `K ${fmtSo(k, { thapPhan: 2 })}` : null].filter(Boolean).join(' · ');
  }
  return null;
}
