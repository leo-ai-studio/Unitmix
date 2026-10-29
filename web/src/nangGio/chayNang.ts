/**
 * Điều phối phân tích giờ nắng: dựng đầu vào từ PA (khối che, lưới, các bước thời gian theo ngày chọn + vị trí), chạy trong Web Worker,
 * đổ kết quả dở dang / cuối vào kho `nangGio/kho.ts`. Chỉ chạy khi người dùng bấm; chạy lại huỷ lượt cũ (terminate). Máy cảm ứng: lưới thưa,
 * bước 30 phút, mẫu mặt đứng 6 m.
 */
import type { ThuVien, TrangThaiPA } from '../tinh/kieu';
import { buocNangTrongNgay } from '../tinh/matTroi';
import { khungBao, taoLuoi, type DauVaoNang, type KetQuaNang } from '../tinh/nangGio/gioNang';
import { khoiPA, khungPA } from '../tinh/nangGio/khoiPA';
import { viTriPA } from '../tinh/viTri';
import { datNG, layNG, mayYeu } from './kho';

let w: Worker | null = null, so = 0;

export function huyNang(): void {
  w?.terminate(); w = null;
  if (layNG().nang.dang) datNG((t) => ({ nang: { ...t.nang, dang: false } }));
}

export function dauVaoNang(pa: TrangThaiPA, tv: ThuVien, ngay: string, yeu = mayYeu()): DauVaoNang | null {
  const vt = viTriPA(pa), khoi = khoiPA(pa, tv);
  const diem = khungPA(pa, khoi);
  if (!diem.length) return null;
  const caoMax = Math.max(0, ...khoi.map((k) => k.z1));
  // nới vùng tính theo bóng chiều: tối đa 1,2 × chiều cao lớn nhất, kẹp 30–120 m
  const noi = Math.min(120, Math.max(30, caoMax * 1.2));
  const luoi = taoLuoi(khungBao(diem), noi, yeu ? 30_000 : 120_000, yeu ? 2 : 1);
  const buoc = buocNangTrongNgay(vt.lat, vt.lng, ngay, vt.gocBac, yeu ? 30 : 15, 1);
  return { khoi, luoi, buoc, matDung: yeu ? { ngang: 6, dung: 6 } : { ngang: 3, dung: 3 } };
}

export function chayNang(pa: TrangThaiPA, tv: ThuVien, ngay: string): void {
  huyNang();
  const dv = dauVaoNang(pa, tv, ngay);
  if (!dv || !dv.buoc.length) { datNG({ nang: { ngay, kq: null, dang: false, loi: 'khongCo' } }); return; }
  const id = ++so;
  try { w = new Worker(new URL('../tinh/nangGio/gioNang.worker.ts', import.meta.url), { type: 'module' }); } catch { datNG({ nang: { ngay, kq: null, dang: false, loi: 'worker' } }); return; }
  datNG({ nang: { ngay, kq: null, dang: true, loi: '' }, lop: 'nang' });
  w.onmessage = (e: MessageEvent<{ id: number; xong?: boolean; kq?: KetQuaNang; loi?: string }>) => {
    const m = e.data;
    if (m.id !== id) return;
    if (m.loi) { datNG({ nang: { ngay, kq: null, dang: false, loi: m.loi } }); w?.terminate(); w = null; return; }
    datNG({ nang: { ngay, kq: m.kq ?? null, dang: !m.xong, loi: '' } });
    if (m.xong) { w?.terminate(); w = null; }
  };
  w.onerror = () => { datNG({ nang: { ngay, kq: null, dang: false, loi: 'worker' } }); w?.terminate(); w = null; };
  w.postMessage({ id, dv });
}
