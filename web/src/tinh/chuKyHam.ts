/** Chữ ký kết quả rải hầm để đối chiếu trước / sau tối ưu (test `raiHamDoiChieu.test.ts`): số chỗ từng tầng + băm toàn bộ toạ độ. */
import type { KetQuaHam } from './ham';

/** FNV-1a 32 bit trên chuỗi. */
export function bam(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export type ChuKyHam = {
  tang: { soCho: number; soXeLan: number; soKho: number; cho: string; lan: string; kho: string; xeMay: string; kyThuat: string; vungSac: string }[];
  tong: string;
  toanBo: string;
} | null;

export function chuKyHam(kq: KetQuaHam | null): ChuKyHam {
  if (!kq) return null;
  return {
    tang: kq.tang.map((t) => ({
      soCho: t.soCho, soXeLan: t.soXeLan, soKho: t.soKho,
      cho: bam(JSON.stringify([t.cho, t.xeLan])), lan: bam(JSON.stringify(t.lan)), kho: bam(JSON.stringify(t.kho)),
      xeMay: bam(JSON.stringify(t.xeMay)), kyThuat: bam(JSON.stringify(t.kyThuat)), vungSac: bam(JSON.stringify(t.vungSac)),
    })),
    tong: JSON.stringify(kq.tong),
    toanBo: bam(JSON.stringify(kq)),
  };
}
