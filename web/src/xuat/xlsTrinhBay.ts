/**
 * Ghi các sheet (`SheetXls`) ra .xlsx theo brand LEO Unitmix bằng ExcelJS: tiêu đề xanh `--green`, đầu bảng nền xanh chữ trắng,
 * dòng tổng nền `--soft`, nét vàng `--gold` dưới tiêu đề, ẩn đường lưới, định dạng số, ô công thức `{ f, v }` giữ công thức sống.
 * Màu lấy đúng bảng `web/src/styles/leo-ui.css` (ExcelJS cần ARGB nên chép ra đây một chỗ). Chỉ nạp ExcelJS khi bấm xuất.
 */
import type ExcelJS from 'exceljs';
import type { KieuHang, OXls, SheetXls } from './xuatXls';
import { kieuTuDong } from './xuatXls';

export const MAU = {
  xanh: 'FF174F52', vang: 'FFC7AA76', nen: 'FFF1F0EA', nhat: 'FFE5EEEA', vangNhat: 'FFF6EFE0', ke: 'FFDFE3DC', chu: 'FF292D2D', phu: 'FF737D78', trang: 'FFFFFFFF',
} as const;
const FONT = 'Segoe UI';
/** Số hàng chừa phía trên sheet bìa cho logo. */
export const HANG_LOGO = 9;

const font = (o: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({ name: FONT, size: 11, color: { argb: MAU.chu }, ...o });
const vien = (argb: string, style: ExcelJS.BorderStyle = 'thin'): Partial<ExcelJS.Border> => ({ style, color: { argb } });

const laSo = (o: OXls): boolean => typeof (typeof o === 'object' ? o.v : o) === 'number';
const giaTri = (o: OXls): string | number => (typeof o === 'object' ? o.v : o);
const dinhDangSo = (v: number): string => (Number.isInteger(v) ? '#,##0' : '#,##0.00');

/** Độ rộng cột theo nội dung dài nhất của các dòng bảng (bỏ tiêu đề, thông tin, ghi chú dài), kẹp 10–46. */
function doRongCot(s: SheetXls, kieu: KieuHang[]): number[] {
  const soCot = Math.max(1, ...s.hang.map((h) => h.length));
  return Array.from({ length: soCot }, (_, c) => {
    let m = 8;
    s.hang.forEach((h, i) => {
      if (['tieuDe', 'ghiChu', 'muc'].includes(kieu[i]) || h[c] === undefined) return;
      const v = giaTri(h[c]);
      const dai = typeof v === 'number' ? dinhDangSo(v).length + 3 : String(v).length + 3;
      if (dai > m) m = dai;
    });
    return Math.min(46, Math.max(10, m));
  });
}

/** Dựng workbook ExcelJS có brand. `logo` = ảnh PNG cho sheet bìa (bỏ qua khi null). */
export function taoSachBrand(Excel: typeof ExcelJS, sheets: SheetXls[], logo: ArrayBuffer | null = null): ExcelJS.Workbook {
  const wb = new Excel.Workbook();
  wb.creator = 'Unitmix · NghiaVT';
  wb.created = new Date();
  for (const s of sheets) {
    const kieu = s.kieu && s.kieu.length === s.hang.length ? s.kieu : kieuTuDong(s.hang);
    const ws = wb.addWorksheet(s.ten, { properties: { tabColor: { argb: s.bia ? MAU.vang : MAU.xanh } }, views: [{ showGridLines: false }] });
    const dau = s.bia ? HANG_LOGO : 0; // sheet bìa chừa chỗ cho logo
    const rong = doRongCot(s, kieu);
    const soCot = rong.length;
    rong.forEach((w, c) => { ws.getColumn(c + 1).width = s.bia ? (c === 0 ? 28 : 46) : w; });

    s.hang.forEach((h, i) => {
      const r = ws.getRow(dau + i + 1), k = kieu[i];
      h.forEach((o, c) => {
        const cell = r.getCell(c + 1);
        cell.value = typeof o === 'object' ? { formula: o.f, result: o.v } : o;
        cell.font = font();
        cell.alignment = { vertical: 'middle', horizontal: laSo(o) || o === '—' ? 'right' : 'left', wrapText: false };
        if (laSo(o)) cell.numFmt = dinhDangSo(Number(giaTri(o)));
      });
      const tuCot = 1, denCot = Math.max(soCot, h.length, 1);
      const tungO = (f: (cell: ExcelJS.Cell, c: number) => void) => { for (let c = tuCot; c <= denCot; c++) f(r.getCell(c), c); };
      switch (k) {
        case 'tieuDe':
          r.height = 28;
          tungO((cell) => { cell.font = font({ size: 15, bold: true, color: { argb: MAU.xanh } }); cell.border = { bottom: vien(MAU.vang, 'medium') }; cell.alignment = { vertical: 'middle', horizontal: 'left' }; });
          break;
        case 'thongTin':
          r.getCell(1).font = font({ bold: true, color: { argb: MAU.phu } });
          break;
        case 'muc':
          r.height = 22;
          tungO((cell) => { cell.font = font({ size: 12, bold: true, color: { argb: MAU.xanh } }); cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAU.nhat } }; cell.border = { bottom: vien(MAU.vang) }; cell.alignment = { vertical: 'middle', horizontal: 'left' }; });
          break;
        case 'dau':
          r.height = 30;
          tungO((cell) => { cell.font = font({ bold: true, color: { argb: MAU.trang } }); cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAU.xanh } }; cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; cell.border = { right: vien(MAU.trang, 'hair') }; });
          break;
        case 'dong':
          tungO((cell) => { cell.border = { bottom: vien(MAU.ke, 'hair') }; });
          break;
        case 'tong':
          r.height = 22;
          tungO((cell) => { cell.font = font({ bold: true, color: { argb: MAU.xanh } }); cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAU.nhat } }; cell.border = { top: vien(MAU.xanh), bottom: vien(MAU.xanh) }; });
          break;
        case 'ghiChu': {
          // gộp ngang bảng, tự cao theo độ dài chữ
          const chu = String(giaTri(h[0] ?? '')), tongRong = rong.reduce((a, b) => a + b, 0);
          if (soCot > 1) ws.mergeCells(dau + i + 1, 1, dau + i + 1, soCot);
          const cell = r.getCell(1);
          cell.font = font({ italic: true, size: 10, color: { argb: MAU.phu } });
          cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
          r.height = Math.max(16, Math.ceil(chu.length / Math.max(20, tongRong * 1.05)) * 15);
          break;
        }
        default:
          break;
      }
    });

    // ô nhập: nền vàng nhạt, viền vàng brand
    for (const a of s.nhap ?? []) {
      const cell = ws.getCell(a);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAU.vangNhat } };
      cell.border = { top: vien(MAU.vang), bottom: vien(MAU.vang), left: vien(MAU.vang), right: vien(MAU.vang) };
      cell.font = font({ bold: true });
    }

    if (s.bia) {
      // sheet bìa: tên app lớn ở dòng chừa trên, logo bên trái
      const t = ws.getRow(HANG_LOGO - 1);
      t.height = 4;
      if (logo) {
        const id = wb.addImage({ buffer: logo, extension: 'png' });
        ws.addImage(id, { tl: { col: 0, row: 1 }, ext: { width: 156, height: 102 } });
      }
    } else {
      // sheet một bảng: cố định phần đầu tới đầu bảng khi cuộn (sheet nhiều bảng không cố định, vì đầu bảng khác nhau)
      const iDau = kieu.indexOf('dau');
      if (iDau > 0 && iDau < 14 && kieu.filter((k) => k === 'dau').length === 1) ws.views = [{ showGridLines: false, state: 'frozen', ySplit: iDau + 1 }];
    }
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
    ws.headerFooter.oddFooter = '&L&"Segoe UI,Regular"&8UNITMIX · NghiaVT&R&8&P / &N';
  }
  return wb;
}
