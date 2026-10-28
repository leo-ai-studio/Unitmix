import { describe, expect, it } from 'vitest';
import { buocPhim, capHienTai, dsMucTang, giaiKhoaTang, khoaTangDangXem, lenMotCap } from './capDo';

describe('lên một cấp', () => {
  it('căn → tầng → tòa → lô → hết', () => {
    let v = lenMotCap({ buoc: 'tang', toaId: 'toa-1', canKhoa: '0:3' });
    expect(v).toEqual({ buoc: 'tang', toaId: 'toa-1', canKhoa: null });
    expect(capHienTai(v!)).toBe('tang');
    v = lenMotCap(v!);
    expect(v).toEqual({ buoc: 'tmb', toaId: 'toa-1', canKhoa: null });
    expect(capHienTai(v!)).toBe('toa');
    v = lenMotCap(v!);
    expect(v).toEqual({ buoc: 'tmb', toaId: null, canKhoa: null });
    expect(capHienTai(v!)).toBe('lo');
    expect(lenMotCap(v!)).toBeNull();
  });
  it('hầm về thẳng lô / TMB', () => {
    expect(lenMotCap({ buoc: 'ham', toaId: 'toa-1', canKhoa: null })).toEqual({ buoc: 'tmb', toaId: null, canKhoa: null });
  });
  it('căn ở TMB không tính (chỉ màn Tầng mới có căn)', () => {
    expect(capHienTai({ buoc: 'tmb', toaId: 'x', canKhoa: '0:1' })).toBe('toa');
  });
});

describe('danh sách tầng', () => {
  it('điển hình, từng tầng (đánh dấu tầng riêng), rồi hầm', () => {
    const ds = dsMucTang({ soTangDH: 3, coRieng: [2], soTangHam: 2, coToa: true });
    expect(ds.map((x) => x.khoa)).toEqual(['dh', 't1', 't2', 't3', 'b1', 'b2']);
    expect(ds.filter((x) => x.rieng).map((x) => x.khoa)).toEqual(['t2']);
  });
  it('chưa có tòa thì chỉ còn hầm', () => {
    expect(dsMucTang({ soTangDH: 5, coRieng: [], soTangHam: 1, coToa: false }).map((x) => x.khoa)).toEqual(['b1']);
  });
  it('khoá tầng đang xem và đọc ngược', () => {
    expect(khoaTangDangXem('ham', null, 2)).toBe('b2');
    expect(khoaTangDangXem('tang', null, 1)).toBe('dh');
    expect(khoaTangDangXem('tang', [4, 5], 1)).toBe('t4');
    expect(khoaTangDangXem('tmb', null, 1)).toBeNull();
    expect(giaiKhoaTang('t12')).toEqual({ loai: 'tang', so: 12 });
    expect(giaiKhoaTang('b3')).toEqual({ loai: 'ham', so: 3 });
    expect(giaiKhoaTang('dh')).toEqual({ loai: 'dh', so: 0 });
    expect(giaiKhoaTang('x')).toBeNull();
  });
});

describe('phím menu', () => {
  const tat = [false, true, false, false];
  it('xuống / lên vòng, bỏ mục tắt', () => {
    expect(buocPhim('ArrowDown', 0, tat)).toBe(2);
    expect(buocPhim('ArrowDown', 3, tat)).toBe(0);
    expect(buocPhim('ArrowUp', 2, tat)).toBe(0);
    expect(buocPhim('ArrowUp', 0, tat)).toBe(3);
    expect(buocPhim('ArrowDown', -1, tat)).toBe(0);
  });
  it('Home / End, phím khác', () => {
    expect(buocPhim('Home', 3, [true, false, false])).toBe(1);
    expect(buocPhim('End', 0, [false, false, true])).toBe(1);
    expect(buocPhim('Enter', 0, tat)).toBeNull();
    expect(buocPhim('ArrowDown', 0, [true, true])).toBeNull();
  });
});
