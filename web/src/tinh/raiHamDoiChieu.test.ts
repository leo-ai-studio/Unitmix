import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { raiHamTinh } from './ham';
import { chuKyHam, type ChuKyHam } from './chuKyHam';
import { taoThuVien, type TrangThaiPA } from './kieu';
import { themBienThe } from './stretch';

/*
 * Đối chiếu rải hầm trước / sau tối ưu (lưới chỉ mục vật cản, gộp tầng giống nhau): cùng số chỗ, cùng toạ độ đến từng bit.
 * `__mau__/hamDoiChieu.json`: PA thật trong DB local (PA gọn: lô + tòa thuộc lô) + chữ ký. Chữ ký sinh lại bằng mã bố trí hầm
 * đợt 2 (2026-10-29: phòng kỹ thuật, khoang cháy, thang thoát nạn, làn không cụt — kết quả đổi có chủ đích); trước đó: commit 808abb3.
 * Tối ưu tốc độ sau này phải giữ đúng chữ ký này.
 */
type Mau = { ten: string; msTruoc: number; pa: TrangThaiPA; loId: string; ky: ChuKyHam };
const lib = (f: string) => JSON.parse(readFileSync(new URL(`../../public/lib/${f}`, import.meta.url), 'utf-8'));
const tv = themBienThe(taoThuVien(lib('toa.json'), lib('can.json')));
const ds: Mau[] = JSON.parse(readFileSync(new URL('./__mau__/hamDoiChieu.json', import.meta.url), 'utf-8'));

describe('raiHamTinh khớp kết quả trước tối ưu trên PA thật', () => {
  for (const m of ds) {
    it(m.ten, () => {
      const lo = m.pa.lo.find((l) => l.id === m.loId)!;
      const ky = chuKyHam(raiHamTinh(m.pa, tv, lo));
      expect(ky?.tang.map((t) => t.soCho)).toEqual(m.ky?.tang.map((t) => t.soCho));
      expect(ky).toEqual(m.ky);
    });
  }
});
