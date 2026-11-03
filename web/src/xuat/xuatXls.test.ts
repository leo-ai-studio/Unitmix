import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { tinhChiTieu } from '../tinh/chiTieu';
import { chiSoPA, diemLechPA } from '../tinh/diemPA';
import { tinhDuToan, tinhKhoiLuong } from '../tinh/duToan';
import { taoToaTrenLo } from '../tinh/hopLo';
import { tinhTaiChinh } from '../tinh/taiChinh';
import { taoThuVien, type CanMau, type ToaMau } from '../tinh/kieu';
import { taoLo, taoPAMoi } from '../tinh/macDinh';
import { baoCaoPA, baoCaoSoSanh, oSo, taoSach, tenSheet, tenTepXls } from './xuatXls';

const doc = <T,>(tep: string) => JSON.parse(readFileSync(new URL(`../../public/lib/${tep}`, import.meta.url), 'utf-8')) as T;
const tv = taoThuVien(doc<ToaMau[]>('toa.json'), doc<CanMau[]>('can.json'));

function paMau(tang: number) {
  const lo = taoLo('A', 'CT-1', 'tm', [[0, 0], [140, 0], [140, 60], [0, 60]]);
  return { ...taoPAMoi(), lo: [lo], toa: [{ ...taoToaTrenLo(tv.toa.get('tm-i1')!, lo, 't1'), soTangDH: tang }] };
}
const tatCa = (hang: unknown[][]) => hang.flat();

describe('xuất XLS', () => {
  it('ô trống ra "—", không undefined / NaN', () => {
    expect(oSo(null)).toBe('—');
    expect(oSo(undefined)).toBe('—');
    expect(oSo(NaN)).toBe('—');
    expect(oSo(1.2345)).toBe(1.23);
    expect(tenSheet('a/b:c?'.padEnd(40, 'x')).length).toBeLessThanOrEqual(31);
    expect(tenTepXls('Dự án: A', 'PA 1')).toBe('Dự án A - PA 1.xlsx');
  });

  it('báo cáo PA: 6 sheet tiếng Việt có dấu, số căn khớp, đọc lại được từ tệp xlsx', () => {
    const pa = paMau(10), kq = tinhChiTieu(pa, tv);
    const sheets = baoCaoPA(pa, tv, kq, 'Dự án Đồng Quan', 'PA 1', diemLechPA(pa, kq));
    expect(sheets.map((s) => s.ten)).toEqual(['Tổng hợp chỉ tiêu', 'Cơ cấu theo tòa', 'Danh sách căn', 'Luật vượt', 'Dự toán', 'Tài chính']);
    for (const s of sheets) for (const o of tatCa(s.hang)) { expect(o).not.toBeUndefined(); expect(Number.isNaN(o)).toBe(false); }
    const buf = XLSX.write(taoSach(XLSX, sheets), { type: 'array', bookType: 'xlsx' });
    const wb = XLSX.read(buf, { type: 'array' });
    expect(wb.SheetNames).toEqual(sheets.map((s) => s.ten));
    const lai = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Tổng hợp chỉ tiêu'], { header: 1 });
    expect(JSON.stringify(lai)).toContain('Mật độ xây dựng');
    expect(JSON.stringify(lai)).toContain('Dự án Đồng Quan');
    const tong = sheets[1].hang.find((h) => h[0] === 'Tổng')!;
    expect(tong[8]).toBe(kq.tong.soCan);
    expect(sheets[2].hang.at(-1)![9]).toBe(kq.tong.soCan);
  });

  it('sheet Luật vượt: có dòng khi vượt, báo "không vượt" khi không', () => {
    const pa = paMau(60);
    expect(baoCaoPA(pa, tv, tinhChiTieu(pa, tv), 'D', 'P')[3].hang.length).toBeGreaterThan(6);
    const trong = taoPAMoi();
    expect(tatCa(baoCaoPA(trong, tv, tinhChiTieu(trong, tv), 'D', 'P')[3].hang)).toContain('Không có chỉ tiêu nào vượt giới hạn.');
  });

  it('bảng so sánh: cột theo PA, chênh so với PA gốc bằng 0 ở chính nó', () => {
    const a = paMau(10), b = paMau(20);
    const ds = [{ ten: 'PA A', chiSo: chiSoPA(a, tinhChiTieu(a, tv)) }, { ten: 'PA B', chiSo: chiSoPA(b, tinhChiTieu(b, tv)) }];
    const [s] = baoCaoSoSanh(ds, 0, 'Dự án');
    const hang = s.hang.find((h) => h[0] === 'Tổng căn')!;
    expect(hang[1]).toBe(ds[0].chiSo.soCan);
    expect(hang[2]).toBe(ds[1].chiSo.soCan);
    const iChenh = s.hang.findIndex((h) => h[0] === 'Chênh so với PA gốc');
    const chenh = s.hang.slice(iChenh).find((h) => h[0] === 'Tổng căn')!;
    expect(chenh[1]).toBe(0);
    expect(chenh[2]).toBe(ds[1].chiSo.soCan - ds[0].chiSo.soCan);
    for (const o of tatCa(s.hang)) expect(Number.isNaN(o)).toBe(false);
  });
  it('sheet Dự toán / Tài chính: tổng mức và lợi nhuận khớp hàm tính, có ghi chú số tạm', () => {
    const pa = paMau(10), kq = tinhChiTieu(pa, tv), lech = diemLechPA(pa, kq);
    const sheets = baoCaoPA(pa, tv, kq, 'D', 'P', lech);
    const kl = tinhKhoiLuong(pa, tv, false), dt = tinhDuToan(kl, pa.chiPhi), tc = tinhTaiChinh(pa, tv, kl, dt, lech);
    const duToan = sheets[4].hang, taiChinh = sheets[5].hang;
    expect(tatCa(duToan).join(' ')).toContain('SỐ TẠM');
    expect(tatCa(duToan).join(' ')).toContain('Nghị định 10/2021/NĐ-CP');
    expect(duToan.find((h) => h[0] === 'Tổng mức đầu tư (chưa gồm đất)')!.at(-1)).toBe(oSo(dt.tongMuc));
    expect(taiChinh.find((h) => h[0] === 'Lợi nhuận')![1]).toBe(oSo(tc.loiNhuan));
    expect(dt.tongMuc).toBeGreaterThan(0);
  });

  it('bảng so sánh: thêm hàng tổng mức, lợi nhuận khi có', () => {
    const a = paMau(10);
    const chiSo = chiSoPA(a, tinhChiTieu(a, tv));
    const [s] = baoCaoSoSanh([{ ten: 'A', chiSo, tien: { tongMuc: 1e12, loiNhuan: null } }, { ten: 'B', chiSo }], 0, 'D');
    expect(s.hang.find((h) => h[0] === 'Tổng mức đầu tư (đ)')).toEqual(['Tổng mức đầu tư (đ)', 1e12, '—']);
    expect(s.hang.find((h) => h[0] === 'Lợi nhuận (đ)')).toEqual(['Lợi nhuận (đ)', '—', '—']);
    const [k] = baoCaoSoSanh([{ ten: 'B', chiSo }], 0, 'D');
    expect(k.hang.some((h) => h[0] === 'Lợi nhuận (đ)')).toBe(false);
  });
});
