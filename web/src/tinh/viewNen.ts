/**
 * Điểm view theo dải tầng chạy nền (Web Worker `viewTang.worker.ts`): PA cỡ CT-2 (≈ 50 tòa, 40 000 ô căn × tầng) mất 30–60 ms —
 * không chạy trên luồng giao diện. Lượt mới thay lượt cũ (lượt cũ trả null). Không có Worker (vitest / node): chạy đồng bộ.
 */
import { danhGiaViewPA, type KcTheoH, type KetQuaViewPA } from './huongView';
import type { ThuVien, TrangThaiPA } from './kieu';
import type { Luat } from './quyTac';
import { kcToa261 } from './xepToa';

export type ThuViewNen = { id: number; pa: TrangThaiPA; lo02: Luat | null; nhieuTang: number; tv?: ThuVien };
export type ThuViewNenVe = { id: number; kq?: KetQuaViewPA; ms?: number; loi?: string };

let worker: Worker | null = null, tvW: ThuVien | null = null, soId = 0;
let huyLuot: (() => void) | null = null;
/** Thời gian tính (ms, trong worker) của lượt gần nhất — để đo. */
export let msViewNen = 0;
const taoWorker = (): Worker | null => {
  if (typeof Worker === 'undefined') return null;
  try { return new Worker(new URL('./viewTang.worker.ts', import.meta.url), { type: 'module' }); } catch { return null; }
};

/** PA chỉ gồm phần view cần (bỏ hầm, chi phí… cho gói gửi worker nhẹ). */
const paGon = (pa: TrangThaiPA): TrangThaiPA => ({ ...pa, gocNhin: undefined, chiPhi: undefined });

export async function danhGiaViewNen(pa: TrangThaiPA, tv: ThuVien, lo02: Luat | null, nhieuTang = 40): Promise<KetQuaViewPA | null> {
  huyLuot?.();
  if (!worker) { worker = taoWorker(); tvW = null; }
  const w = worker;
  if (!w) {
    const kc: KcTheoH | undefined = lo02 ? (H) => kcToa261(lo02, H).dai : undefined;
    return danhGiaViewPA(pa, tv, { kc, nhieuTang });
  }
  const id = ++soId;
  const thu: ThuViewNen = { id, pa: paGon(pa), lo02, nhieuTang };
  if (tvW !== tv) { thu.tv = tv; tvW = tv; }
  return new Promise((xong, hong) => {
    const ket = (giet: boolean) => {
      w.onmessage = null; w.onerror = null; huyLuot = null;
      if (giet) { w.terminate(); if (worker === w) worker = null; }
    };
    huyLuot = () => { ket(false); xong(null); };
    w.onmessage = (e: MessageEvent<ThuViewNenVe>) => {
      const m = e.data;
      if (m.id !== id) return;
      if (m.loi !== undefined) { ket(true); hong(new Error(m.loi.split('\n')[0])); return; }
      ket(false); msViewNen = m.ms ?? 0; xong(m.kq ?? null);
    };
    w.onerror = () => { ket(true); hong(new Error('viewTang worker')); };
    w.postMessage(thu);
  });
}
