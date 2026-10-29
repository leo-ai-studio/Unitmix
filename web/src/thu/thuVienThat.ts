/**
 * Nạp thư viện thật (toa.json, can.json, lõi, tim cửa căn) cho test chạy trong Node — dùng chung cho test quét mẫu / phá hoại.
 * Nạp cả hai khối thang bộ N2 / N3 (QT-63) dù mẫu tòa chỉ chèn N3.
 */
import { existsSync, readFileSync } from 'node:fs';
import { taoThuVien, type CanMau, type ThuVien, type ToaDat, type ToaMau } from '../tinh/kieu';
import type { DuLieuMB, HinhLoiMB, ToaMB } from '../tinh/loiThang';
import { tinhCuaCan } from '../tinh/pccc';
import { themBienThe } from '../tinh/stretch';

const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
export const idLoiTep = (b: string) => 'loi-' + b.replace(/^x_/, '').replace(/_/g, '-');

let nho: { tv: ThuVien; dl: DuLieuMB; toaDs: ToaMau[]; canDs: CanMau[] } | null = null;
export function napThuVien() {
  if (nho) return nho;
  const toaDs = doc<ToaMau[]>('toa.json'), canDs = doc<CanMau[]>('can.json');
  const tv = themBienThe(taoThuVien(toaDs, canDs));
  const dl: DuLieuMB = { loi: new Map(), cuaCan: {} };
  const khoi = new Set<string>(['x_tb_n2', 'x_tb_n3']);
  for (const t of toaDs) for (const m of (t as unknown as ToaMB).mat ?? []) for (const q of m.phan_tu) if (q.loai !== 'can' && q.block) khoi.add(q.block);
  for (const b of khoi) if (existsSync(new URL(`loi/${idLoiTep(b)}.json`, lib))) dl.loi.set(b, doc<HinhLoiMB>(`loi/${idLoiTep(b)}.json`));
  for (const c of canDs) dl.cuaCan[c.ma_goc] = tinhCuaCan(doc<{ ve: { cat: string; pts: [number, number][] }[] }>(`can/${c.id}.json`).ve, c.rong_mm);
  nho = { tv, dl, toaDs, canDs };
  return nho;
}

/** Tòa thử đặt mẫu `mauId` (như các test quét, mặc định 24 tầng). */
export const toaThu = (mauId: string, soTangDH = 24): ToaDat =>
  ({ id: 't', loId: 'l', mauId, x: 0, y: 0, gocDo: 0, soTangDH, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {} });
