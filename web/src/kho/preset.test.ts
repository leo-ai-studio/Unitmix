import { describe, expect, it } from 'vitest';
import { apPreset, chupPreset, docPreset, khoaPreset, luuPreset, nhapPreset, xoaPreset, xuatPreset, type KhoPreset } from './preset';
import { taoLo, taoPAMoi } from '../tinh/macDinh';
import type { Diem, TrangThaiPA } from '../tinh/kieu';

function khoGia(): KhoPreset & { du: Map<string, string> } {
  const du = new Map<string, string>();
  return { du, getItem: (k) => du.get(k) ?? null, setItem: (k, v) => void du.set(k, v) };
}
const hcn: Diem[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
function paMau(): TrangThaiPA {
  const pa = taoPAMoi();
  return { ...pa, lo: [taoLo('a', 'A', 'tm', hcn), taoLo('b', 'B', 'xh', hcn), taoLo('c', 'C', 'khac', hcn)] };
}
const coCau100 = { stu: 0, '1pn': 0, '2pn': 100, '2pnp': 0, '3pn': 0 };

describe('preset', () => {
  it('lưu, đọc lại, ghi đè cùng tên, xoá', () => {
    const kho = khoGia();
    const pa = paMau();
    const du = chupPreset('chiTieu', pa, pa.lo[0]);
    expect(luuPreset(kho, 'chiTieu', ' NOTM Hà Nội ', du)).toHaveLength(1);
    luuPreset(kho, 'chiTieu', 'NOTM Hà Nội', { chiTieu: { ...du.chiTieu!, hssddMax: 5 } });
    luuPreset(kho, 'chiTieu', 'NOXH', du);
    const ds = docPreset(kho, 'chiTieu');
    expect(ds.map((p) => p.ten)).toEqual(['NOTM Hà Nội', 'NOXH']);
    expect(ds[0].du.chiTieu!.hssddMax).toBe(5);
    expect(xoaPreset(kho, 'chiTieu', 'NOXH').map((p) => p.ten)).toEqual(['NOTM Hà Nội']);
    expect(kho.du.has(khoaPreset('chiTieu'))).toBe(true);
  });

  it('từ chối tên rỗng và dữ liệu rỗng; kho lỗi không ném', () => {
    const kho = khoGia();
    expect(luuPreset(kho, 'coCau', '  ', { coCau: coCau100 })).toBeNull();
    expect(luuPreset(kho, 'coCau', 'x', {})).toBeNull();
    const hong: KhoPreset = { getItem: () => { throw new Error('chặn'); }, setItem: () => { throw new Error('đầy'); } };
    expect(docPreset(hong, 'cap')).toEqual([]);
    expect(luuPreset(hong, 'coCau', 'x', { coCau: coCau100 })).toBeNull();
  });

  it('dữ liệu hỏng trong kho bị bỏ qua', () => {
    const kho = khoGia();
    kho.du.set(khoaPreset('nguong'), '{không phải json');
    expect(docPreset(kho, 'nguong')).toEqual([]);
    kho.du.set(khoaPreset('nguong'), JSON.stringify([{ ten: 'a', du: { nguong: { dtCanM2: 'x' } } }, { ten: 'b', du: { nguong: { dtCanM2: 1, kichThuocM: 2, coCauDiem: 3 } } }]));
    expect(docPreset(kho, 'nguong').map((p) => p.ten)).toEqual(['b']);
  });

  it('cấp: áp cho lô chỉ đổi lô đó, không đổi phần chung PA', () => {
    const pa = paMau();
    const nguon: TrangThaiPA = {
      ...pa,
      lo: pa.lo.map((l, i) => (i === 0 ? { ...l, temDat: { ...l.temDat, chiTieu: { ...l.temDat.chiTieu, hssddMax: 9 }, coCauMucTieu: coCau100 } } : l)),
      nguong: { dtCanM2: 7, kichThuocM: 7, coCauDiem: 7 },
    };
    const ra = apPreset('cap', pa, chupPreset('cap', nguon, nguon.lo[0]), 'lo', 'b');
    expect(ra.lo[1].temDat.chiTieu.hssddMax).toBe(9);
    expect(ra.lo[1].temDat.coCauMucTieu['2pn']).toBe(100);
    expect(ra.lo[0].temDat.chiTieu.hssddMax).toBe(pa.lo[0].temDat.chiTieu.hssddMax);
    expect(ra.nguong).toEqual(pa.nguong);
  });

  it('cấp: áp cho cả PA đổi mọi lô cao tầng (không đổi lô khác) và phần chung', () => {
    const pa = paMau();
    const nguon: TrangThaiPA = {
      ...pa,
      heSo: { ...pa.heSo, truongLa: 1 } as TrangThaiPA['heSo'],
      nguong: { dtCanM2: 7, kichThuocM: 7, coCauDiem: 7 },
      ham: { ...pa.ham, soTang: 4, ranh: [[0, 0]] },
      lo: pa.lo.map((l) => (l.id === 'a' ? { ...l, temDat: { ...l.temDat, chiTieu: { ...l.temDat.chiTieu, hssddMax: 9 } } } : l)),
    };
    const du = chupPreset('cap', nguon, nguon.lo[0]);
    expect('ranh' in du.ham!).toBe(false);
    const ra = apPreset('cap', pa, du, 'pa', 'a');
    expect(ra.lo[0].temDat.chiTieu.hssddMax).toBe(9);
    expect(ra.lo[1].temDat.chiTieu.hssddMax).toBe(9);
    expect(ra.lo[2].temDat.chiTieu.hssddMax).toBe(pa.lo[2].temDat.chiTieu.hssddMax);
    expect(ra.nguong.dtCanM2).toBe(7);
    expect(ra.ham.soTang).toBe(4);
    expect(ra.ham.ranh).toBeNull();
    expect((ra.heSo as unknown as Record<string, number>).truongLa).toBe(1);
  });

  it('theo mục: hệ số được coi là khối JSON nguyên', () => {
    const pa = paMau();
    const nguon = { ...pa, heSo: { xyz: 0.5, long: { a: 1 } } as unknown as TrangThaiPA['heSo'] };
    const kho = khoGia();
    luuPreset(kho, 'heSo', 'thử', chupPreset('heSo', nguon, null));
    const ra = apPreset('heSo', pa, docPreset(kho, 'heSo')[0].du, 'lo', null);
    expect(ra.heSo).toEqual({ xyz: 0.5, long: { a: 1 } });
  });

  it('cấp: phanHam (nếu PA có) được lưu và áp nguyên khối', () => {
    const pa = paMau();
    const nguon = { ...pa, phanHam: { doXe: { a: 1 }, kyThuat: 2 } } as TrangThaiPA;
    const du = chupPreset('cap', nguon, null);
    expect(du.phanHam).toEqual({ doXe: { a: 1 }, kyThuat: 2 });
    const ra = apPreset('cap', pa, du, 'pa', null) as TrangThaiPA & { phanHam?: unknown };
    expect(ra.phanHam).toEqual({ doXe: { a: 1 }, kyThuat: 2 });
    expect(chupPreset('cap', pa, null).phanHam).toBeUndefined();
  });

  it('xuất rồi nhập sang máy khác; sai nhóm và file hỏng bị từ chối', () => {
    const a = khoGia(), b = khoGia();
    const pa = paMau();
    luuPreset(a, 'chiTieu', 'NOXH', chupPreset('chiTieu', pa, pa.lo[1]));
    const chu = xuatPreset('chiTieu', docPreset(a, 'chiTieu'));
    const kq = nhapPreset(b, 'chiTieu', chu);
    expect(kq.ok && kq.them).toBe(1);
    expect(docPreset(b, 'chiTieu')[0].ten).toBe('NOXH');
    expect(nhapPreset(b, 'coCau', chu)).toEqual({ ok: false, loi: 'sai_nhom' });
    expect(nhapPreset(b, 'chiTieu', 'xyz')).toEqual({ ok: false, loi: 'hong' });
  });
});
