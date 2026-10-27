/** Đọc tệp Excel (.xlsx/.xls) thành các lưới ô bằng SheetJS. Ô gộp được chép giá trị ô đầu sang cả vùng. */
import type { WorkBook } from 'xlsx';
import type { Luoi, O, Sheet } from './luoi';

export function sheetTuWorkbook(wb: WorkBook, XLSX: typeof import('xlsx')): Sheet[] {
  return wb.SheetNames.map((ten) => {
    const ws = wb.Sheets[ten];
    const luoi = XLSX.utils.sheet_to_json<O[]>(ws, { header: 1, raw: true, defval: null, blankrows: true }) as Luoi;
    for (const m of ws['!merges'] ?? []) {
      const v = luoi[m.s.r]?.[m.s.c] ?? null;
      if (v === null) continue;
      for (let r = m.s.r; r <= m.e.r; r++) {
        luoi[r] ??= [];
        for (let c = m.s.c; c <= m.e.c; c++) if (r !== m.s.r || c !== m.s.c) luoi[r][c] = v;
      }
    }
    return { ten, luoi };
  });
}

/** Đọc tệp người dùng chọn; SheetJS chỉ tải khi cần (không làm nặng lần mở app). */
export async function docTepExcel(f: File): Promise<Sheet[]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: false });
  return sheetTuWorkbook(wb, XLSX);
}

/** Bảng dán từ Excel (chép ô → dán): các cột cách nhau bằng Tab. */
export function luoiTuChuDan(chu: string): Luoi {
  return chu
    .replace(/\r/g, '')
    .split('\n')
    .map((h) => h.split('\t').map((o) => (o.trim() === '' ? null : o.trim())));
}
