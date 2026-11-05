/**
 * Mẫu tòa đã lưu (kho/mauToaLuu.ts): chụp bố cục sau khi sửa (thay lõi, xoá / lật / STRETCH căn, kéo hành lang), đặt lại trên tòa khác
 * cho đúng bố cục, kiểm sạch lỗi; lưu / đọc / xuất / nhập; bản ghi hỏng bị bỏ.
 */
import { describe, expect, it } from 'vitest';
import { mauToa } from '../tinh/canThem';
import { kiemMauToa } from '../tinh/kiemMauToa';
import type { ToaDat } from '../tinh/kieu';
import { tuChinhToa, type ToaMB } from '../tinh/loiThang';
import { chayPhep, phepTay } from '../tinh/tayNen';
import { dsLoiToa, loiThayDuocToa } from '../tinh/thaoTacTay';
import { napThuVien, toaThu } from '../thu/thuVienThat';
import { apMauToaLuu, chuanHoaMauToaLuu, docMauToaLuu, doiTenMauToaLuu, ghiMauToaLuu, KHOA_MAU_TOA_LUU, maMauMoi, nhapMauToaLuu, SO_MAU_TOI_DA, taoMauToaLuu, themMauToaLuu, xoaMauToaLuu, xuatMauToaLuu, type KhoLuu } from './mauToaLuu';

const { tv, dl } = napThuVien();
const c = { tv, dl };
const khoGia = (): KhoLuu & { du: Record<string, string> } => { const du: Record<string, string> = {}; return { du, getItem: (k) => du[k] ?? null, setItem: (k, v) => { du[k] = v; } }; };

/** Sửa tòa tm-z1 bằng các thao tác tay thật; trả tòa đã sửa + số phép nhận. */
function suaToa(): { toa: ToaDat; nhan: string[] } {
  let toa = tuChinhToa(toaThu('tm-z1'), tv.toa.get('tm-z1') as unknown as ToaMB, tv, dl);
  const nhan: string[] = [];
  const thu = (ten: string, ph: ReturnType<typeof phepTay>) => { const r = chayPhep(ph, c); if (r.ok) { toa = r.toa; nhan.push(ten); } };
  const loi = dsLoiToa(toa, c)[0], moi = loiThayDuocToa(toa, c, loi.khoa)[0];
  thu('thay lõi', phepTay('thayLoiTay', toa, loi.khoa, moi));
  thu('lật', phepTay('latTay', toa, null, ['1:1']));
  thu('xoá', phepTay('xoaCanTay', toa, null, ['3:2']));
  thu('STRETCH', phepTay('stretchCanTay', toa, '3:5', -100));
  return { toa, nhan };
}

describe('mẫu tòa đã lưu — chụp và đặt lại', () => {
  const { toa, nhan } = suaToa();
  const m = taoMauToaLuu(toa, '  Z1 lõi đổi, bớt 1 căn  ', 'luu-a', { soCan: 20, ngay: '2026-11-05' });

  it('có sửa thật: thay lõi + ít nhất hai phép khác', () => {
    expect(nhan).toContain('thay lõi');
    expect(nhan.length).toBeGreaterThanOrEqual(3);
    expect(toa.loiThay).toBeTruthy();
  });
  it('chụp: bỏ vị trí / số tầng / định danh, giữ bố cục; tên được gọt; bản sao sâu', () => {
    expect(m.ten).toBe('Z1 lõi đổi, bớt 1 căn');
    expect(m.mauId).toBe('tm-z1');
    for (const k of ['id', 'loId', 'x', 'y', 'gocDo', 'soTangDH', 'soTangDe', 'caoDe', 'caoDH', 'mauId']) expect(m.bo, k).not.toHaveProperty(k);
    expect(m.bo.loiThay).toEqual(toa.loiThay);
    expect(m.bo.matBang).toBeTruthy();
    const truoc = JSON.stringify(m);
    (toa.loiThay as Record<string, { dx: number }>)[Object.keys(toa.loiThay!)[0]].dx += 999; // sửa tòa gốc sau khi lưu
    expect(JSON.stringify(m)).toBe(truoc);
    (toa.loiThay as Record<string, { dx: number }>)[Object.keys(toa.loiThay!)[0]].dx -= 999;
  });
  it('đặt lại lên tòa khác (vị trí, số tầng khác): bố cục y hệt, sạch lỗi', () => {
    const khac: ToaDat = { ...toaThu('tm-i1'), id: 'khac', loId: 'lo2', x: 55, y: -20, gocDo: 90, soTangDH: 18, soTangDe: 2, khoa: true };
    const ap = apMauToaLuu(khac, m);
    expect(ap).toMatchObject({ id: 'khac', loId: 'lo2', x: 55, y: -20, gocDo: 90, soTangDH: 18, soTangDe: 2, mauId: 'tm-z1', khoa: true });
    expect(ap.loiThay).toEqual(toa.loiThay);
    expect(ap.matBang).toEqual(toa.matBang);
    expect(JSON.stringify(mauToa(tv, ap))).toBe(JSON.stringify(mauToa(tv, toa)));
    expect(kiemMauToa(ap, c).vi.filter((v) => v.muc === 'loi')).toEqual([]);
    ap.loiThay![Object.keys(ap.loiThay!)[0]].dx += 1;
    expect(m.bo.loiThay).toEqual(toa.loiThay); // áp xong sửa ap không làm hỏng mẫu lưu
  });
});

describe('mẫu tòa đã lưu — kho, xuất, nhập', () => {
  const { toa } = suaToa();
  const a = taoMauToaLuu(toa, 'A', 'luu-a'), b = taoMauToaLuu(toa, 'B', 'luu-b');

  it('ghi / đọc qua kho; kho hỏng hoặc rỗng thì trả rỗng', () => {
    const kho = khoGia();
    expect(docMauToaLuu(kho)).toEqual([]);
    expect(ghiMauToaLuu([a, b], kho)).toBe(true);
    expect(docMauToaLuu(kho).map((x) => x.id)).toEqual(['luu-a', 'luu-b']);
    kho.du[KHOA_MAU_TOA_LUU] = '{hỏng';
    expect(docMauToaLuu(kho)).toEqual([]);
    expect(ghiMauToaLuu([a], null)).toBe(false);
  });
  it('thêm (đầu danh sách, thay cùng mã) · xoá · đổi tên · giới hạn số mẫu', () => {
    let ds = themMauToaLuu([], a);
    ds = themMauToaLuu(ds, b);
    expect(ds.map((x) => x.id)).toEqual(['luu-b', 'luu-a']);
    ds = themMauToaLuu(ds, { ...a, ten: 'A mới' });
    expect(ds.map((x) => x.ten)).toEqual(['A mới', 'B']);
    expect(doiTenMauToaLuu(ds, 'luu-b', '  Tên mới ').find((x) => x.id === 'luu-b')!.ten).toBe('Tên mới');
    expect(xoaMauToaLuu(ds, 'luu-a').map((x) => x.id)).toEqual(['luu-b']);
    let nhieu = ds;
    for (let i = 0; i < SO_MAU_TOI_DA + 5; i++) nhieu = themMauToaLuu(nhieu, { ...a, id: maMauMoi(nhieu, i) });
    expect(nhieu.length).toBe(SO_MAU_TOI_DA);
  });
  it('xuất rồi nhập: đủ mẫu, mã trùng được cấp mã mới, mẫu gốc lạ và bản ghi hỏng bị bỏ', () => {
    const txt = xuatMauToaLuu([a, b]);
    const r = nhapMauToaLuu(txt, [a], tv)!;
    expect(r).toMatchObject({ nhan: 2, bo: 0 });
    expect(r.ds.length).toBe(3);
    expect(new Set(r.ds.map((x) => x.id)).size).toBe(3);
    const hong = JSON.stringify({ dinhDang: 'unitmix-mau-toa', phienBan: 1, mau: [a, { ...a, id: 'x', mauId: 'khong-co-mau' }, { id: 1 }, null, 'rác'] });
    expect(nhapMauToaLuu(hong, [], tv)).toMatchObject({ nhan: 1, bo: 4 });
    expect(nhapMauToaLuu('không phải json', [], tv)).toBeNull();
    expect(nhapMauToaLuu('{"a":1}', [], tv)).toBeNull();
    expect(nhapMauToaLuu(JSON.stringify([a]), [], tv)).toMatchObject({ nhan: 1 }); // mảng thô cũng nhận
  });
  it('chuẩn hoá: thiếu trường bắt buộc → null; trường định danh lọt vào bị gỡ', () => {
    expect(chuanHoaMauToaLuu({ id: 'x', ten: 'x', mauId: 'tm-z1' })).toBeNull();
    const m = chuanHoaMauToaLuu({ id: 'x', ten: 'x', mauId: 'tm-z1', bo: { x: 5, id: 'zzz', canTheo: { a: 'b' }, lat: true } })!;
    expect(m.bo).not.toHaveProperty('x');
    expect(m.bo).not.toHaveProperty('id');
    expect(m.bo).toMatchObject({ canTheo: { a: 'b' }, lat: true });
  });
});
