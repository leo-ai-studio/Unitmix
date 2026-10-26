import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { taoToaTrenLo } from './hopLo';
import { LOAI_CAN, taoThuVien, type CanMau, type ToaMau } from './kieu';
import { taoLo, taoPAMoi } from './macDinh';
import { tomTatPA } from './tomTat';

const doc = <T,>(tep: string) => JSON.parse(readFileSync(new URL(`../../public/lib/${tep}`, import.meta.url), 'utf-8')) as T;
const tv = taoThuVien(doc<ToaMau[]>('toa.json'), doc<CanMau[]>('can.json'));

it('tóm tắt PA: tổng căn = số căn/tầng × số tầng điển hình, cơ cấu cộng đủ, DT sàn > 0', () => {
  const lo = taoLo('A', 'CT-1', 'tm', [[0, 0], [140, 0], [140, 60], [0, 60]]);
  const toa = { ...taoToaTrenLo(tv.toa.get('tm-i1')!, lo, 't1'), soTangDH: 10 };
  const kq = tomTatPA({ ...taoPAMoi(), lo: [lo], toa: [toa] }, tv);
  expect(kq.soCan).toBe(tv.toa.get('tm-i1')!.so_can_tang * 10);
  expect(LOAI_CAN.reduce((a, k) => a + kq.coCau[k], 0)).toBe(kq.soCan);
  expect(kq.dtSan).toBeGreaterThan(0);
  expect(Number.isInteger(kq.dtSan)).toBe(true);
});

it('PA chưa có tòa: 0 căn, DT sàn 0', () => {
  expect(tomTatPA(taoPAMoi(), tv)).toMatchObject({ soCan: 0, dtSan: 0 });
});
