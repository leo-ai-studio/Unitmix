/**
 * Đo thời gian đánh giá view cả PA, tầng giữa vs theo dải tầng (3D phân tích view), trên PA cỡ CT-2 tổng hợp: 6 lô × 8 tòa tm-i1
 * 30 tầng. Chỉ chạy khi UNITMIX_DO_VIEW=1 (không nằm trong cổng kiểm).
 */
import { it } from 'vitest';
import { napThuVien } from '../thu/thuVienThat';
import { taoToaTrenLo } from './hopLo';
import { danhGiaViewPA } from './huongView';
import type { Diem, Lo, ToaDat } from './kieu';
import { taoPAMoi } from './macDinh';

const hcn = (x0: number, y0: number, x1: number, y1: number): Diem[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

it.skipIf(!process.env.UNITMIX_DO_VIEW)('PA 48 tòa: view tầng giữa / theo dải', () => {
  const { tv } = napThuVien();
  const mau = tv.toa.get('tm-i1')!;
  const lo: Lo[] = [], toa: ToaDat[] = [];
  const goc = taoPAMoi().lo[0]?.temDat.chiTieu ?? ({} as never);
  for (let i = 0; i < 6; i++) {
    const x0 = (i % 3) * 260, y0 = Math.floor(i / 3) * 300;
    const L: Lo = { id: `L${i}`, ranh: hcn(x0, y0, x0 + 240, y0 + 280), chiGioi: null, xungQuanh: [], temDat: { kyHieu: `CT-${i}`, chucNang: 'tm', chiTieu: goc, coCauMucTieu: { stu: 0, '1pn': 0, '2pn': 0, '2pnp': 0, '3pn': 0 } } };
    lo.push(L);
    for (let k = 0; k < 8; k++) toa.push({ ...taoToaTrenLo(mau, L, `t${i}-${k}`), x: x0 + 60 + (k % 2) * 120, y: y0 + 40 + Math.floor(k / 2) * 65, gocDo: (k % 3) * 15, soTangDH: 28 + (k % 4) * 3, soTangDe: 2, caoDe: 4.5, caoDH: 3.3 });
  }
  const pa = { ...taoPAMoi(), lo, toa };
  for (const nt of [0, 40, 0, 40, 40]) {
    const t0 = performance.now();
    const k = danhGiaViewPA(pa, tv, { nhieuTang: nt });
    const o = k.can.reduce((s, d) => s + (d.bang?.tong.length ?? 0), 0);
    console.log(`DO nhieuTang=${nt}: ${(performance.now() - t0).toFixed(1)} ms · ${k.can.length} mặt căn · ${o} ô tầng`);
  }
});
