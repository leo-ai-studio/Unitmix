import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { tinhChiTieu } from '../tinh/chiTieu';
import { chiSoPA, diemLechPA } from '../tinh/diemPA';
import { tinhDuToan, tinhKhoiLuong } from '../tinh/duToan';
import { taoToaTrenLo } from '../tinh/hopLo';
import { tinhTaiChinh } from '../tinh/taiChinh';
import { taoThuVien, type CanMau, type ToaMau } from '../tinh/kieu';
import { taoLo, taoPAMoi } from '../tinh/macDinh';
import { baoCaoPA, baoCaoSoSanh, ghiXls, giaTri, oSo, tenSheet, tenTepXls, type OXls } from './xuatXls';

const doc = <T,>(tep: string) => JSON.parse(readFileSync(new URL(`../../public/lib/${tep}`, import.meta.url), 'utf-8')) as T;
const tv = taoThuVien(doc<ToaMau[]>('toa.json'), doc<CanMau[]>('can.json'));

function paMau(tang: number) {
  const lo = taoLo('A', 'CT-1', 'tm', [[0, 0], [140, 0], [140, 60], [0, 60]]);
  return { ...taoPAMoi(), lo: [lo], toa: [{ ...taoToaTrenLo(tv.toa.get('tm-i1')!, lo, 't1'), soTangDH: tang }] };
}
const tatCa = (hang: OXls[][]) => hang.flat().map(giaTri);
const hangCua = (sheets: ReturnType<typeof baoCaoPA>, ten: string) => sheets.find((x) => x.ten === ten)!.hang;

describe('xuất XLS', () => {
  it('ô trống ra "—", không undefined / NaN', () => {
    expect(oSo(null)).toBe('—');
    expect(oSo(undefined)).toBe('—');
    expect(oSo(NaN)).toBe('—');
    expect(oSo(1.2345)).toBe(1.23);
    expect(tenSheet('a/b:c?'.padEnd(40, 'x')).length).toBeLessThanOrEqual(31);
    expect(tenTepXls('Dự án: A', 'PA 1')).toBe('Dự án A - PA 1.xlsx');
  });

  it('báo cáo PA: 8 sheet tiếng Việt có dấu, số căn khớp, đọc lại được từ tệp xlsx theo brand', async () => {
    const pa = paMau(10), kq = tinhChiTieu(pa, tv);
    const sheets = baoCaoPA(pa, tv, kq, 'Dự án Đồng Quan', 'PA 1', diemLechPA(pa, kq));
    expect(sheets.map((s) => s.ten)).toEqual(['Bìa', 'Tổng hợp chỉ tiêu', 'Biểu diện tích', 'Cơ cấu theo tòa', 'Danh sách căn', 'Luật vượt', 'Dự toán', 'Tài chính']);
    for (const s of sheets) {
      if (s.kieu) expect(s.kieu.length).toBe(s.hang.length);
      for (const o of tatCa(s.hang)) { expect(o).not.toBeUndefined(); expect(Number.isNaN(o)).toBe(false); }
    }
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await ghiXls(sheets));
    expect(wb.worksheets.map((w) => w.name)).toEqual(sheets.map((s) => s.ten));
    const ws = wb.getWorksheet('Tổng hợp chỉ tiêu')!;
    const chu = JSON.stringify(ws.getSheetValues());
    expect(chu).toContain('Mật độ xây dựng');
    expect(chu).toContain('Dự án Đồng Quan');
    // brand: tiêu đề xanh, đầu bảng nền xanh chữ trắng, ẩn đường lưới
    expect(ws.getCell('A1').font?.color?.argb).toBe('FF174F52');
    expect(ws.getCell('A5').fill).toMatchObject({ fgColor: { argb: 'FF174F52' } });
    expect(ws.getCell('A5').font?.color?.argb).toBe('FFFFFFFF');
    expect(ws.views[0].showGridLines).toBe(false);
    const tong = hangCua(sheets, 'Cơ cấu theo tòa').find((h) => h[0] === 'Tổng')!;
    expect(tong[8]).toBe(kq.tong.soCan);
    expect(giaTri(hangCua(sheets, 'Danh sách căn').at(-1)![9])).toBe(kq.tong.soCan);
  });

  it('bìa và biểu diện tích: số khớp hàm tính, có đủ bốn mục', () => {
    const pa = paMau(10), kq = tinhChiTieu(pa, tv), sheets = baoCaoPA(pa, tv, kq, 'D', 'P', diemLechPA(pa, kq));
    const kl = tinhKhoiLuong(pa, tv, false);
    expect(sheets[0].bia).toBe(true);
    expect(tatCa(sheets[0].hang)).toContain('NghiaVT');
    const dt = hangCua(sheets, 'Biểu diện tích');
    const tongSan = dt.find((h) => h[0] === 'Tổng diện tích sàn xây dựng')!;
    expect(giaTri(tongSan[1])).toBeCloseTo(kl.tong.dtSanTong, 6);
    for (const muc of ['1. ', '2. ', '3. ', '4. ']) expect(dt.some((h) => typeof h[0] === 'string' && h[0].startsWith(muc))).toBe(true);
    const loHam = dt.find((h) => h[0] === 'Tổng' && h.length === 9);
    if (loHam) expect(tatCa(dt)).toContain('Ước theo DT hầm'); // xuất không rải hầm
  });

  it('công thức Excel khớp giá trị đã tính (Biểu diện tích, Dự toán)', () => {
    const pa = paMau(10), kq = tinhChiTieu(pa, tv), sheets = baoCaoPA(pa, tv, kq, 'D', 'P', diemLechPA(pa, kq));
    let soCongThuc = 0;
    for (const ten of ['Biểu diện tích', 'Dự toán']) {
      const hang = hangCua(sheets, ten);
      const o = (ref: string): number => { const m = /^([A-Z])(\d+)$/.exec(ref)!; const c = hang[Number(m[2]) - 1]?.[m[1].charCodeAt(0) - 65]; return typeof c === 'number' ? c : typeof c === 'object' ? c.v : 0; };
      hang.forEach((h, i) => h.forEach((c, k) => {
        if (typeof c !== 'object') return;
        soCongThuc++;
        const js = c.f.replace(/SUM\(([A-Z])(\d+):([A-Z])(\d+)\)/g, (_m, a, r1, b, r2) => {
          let tong = 0;
          for (let cot = a.charCodeAt(0); cot <= b.charCodeAt(0); cot++) for (let r = Number(r1); r <= Number(r2); r++) tong += o(`${String.fromCharCode(cot)}${r}`);
          return String(tong);
        }).replace(/([A-Z])(\d+)/g, (_m, a, r) => `(${o(`${a}${r}`)})`);
        const kq2 = Function(`return (${js})`)() as number;
        expect(kq2, `${ten} ${String.fromCharCode(65 + k)}${i + 1} = ${c.f}`).toBeCloseTo(c.v, 4);
      }));
    }
    expect(soCongThuc).toBeGreaterThan(20);
  });

  it('sheet Luật vượt: có dòng khi vượt, báo "không vượt" khi không', () => {
    const pa = paMau(60);
    expect(hangCua(baoCaoPA(pa, tv, tinhChiTieu(pa, tv), 'D', 'P'), 'Luật vượt').length).toBeGreaterThan(6);
    const trong = taoPAMoi();
    expect(tatCa(hangCua(baoCaoPA(trong, tv, tinhChiTieu(trong, tv), 'D', 'P'), 'Luật vượt'))).toContain('Không có chỉ tiêu nào vượt giới hạn.');
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
    const duToan = hangCua(sheets, 'Dự toán'), taiChinh = hangCua(sheets, 'Tài chính');
    expect(tatCa(duToan).join(' ')).toContain('SỐ TẠM');
    expect(tatCa(duToan).join(' ')).toContain('Nghị định 10/2021/NĐ-CP');
    expect(giaTri(duToan.find((h) => h[0] === 'Tổng mức đầu tư (chưa gồm đất)')!.at(-1)!)).toBeCloseTo(dt.tongMuc, 4);
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
