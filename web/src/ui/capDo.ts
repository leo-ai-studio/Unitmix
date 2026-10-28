/** Phần tính thuần của dải cấp trên thanh trên (lô / PA · cốt · tòa · tầng · căn): danh sách mục, "lên một cấp", phím menu. */

export type BuocSoan = 'tmb' | 'tang' | 'ham';

/** Vị trí đang xem: bước, tòa đang xem (thực), căn đang chọn (chỉ có nghĩa ở màn Tầng). */
export type ViTriCap = { buoc: BuocSoan; toaId: string | null; canKhoa: string | null };
export type CapXem = 'lo' | 'toa' | 'tang' | 'can';

/** Cấp đang đứng: Tầng có căn → căn; Tầng / Hầm → tầng; TMB có tòa chọn → tòa; còn lại → lô. */
export function capHienTai(v: ViTriCap): CapXem {
  if (v.buoc === 'tang') return v.canKhoa ? 'can' : 'tang';
  if (v.buoc === 'ham') return 'tang';
  return v.toaId ? 'toa' : 'lo';
}

/** Lên một cấp: căn → tầng (bỏ chọn căn) → tòa (về TMB, giữ tòa) → lô / TMB (bỏ chọn tòa). Hầm → lô. Đã ở lô → null. */
export function lenMotCap(v: ViTriCap): ViTriCap | null {
  switch (capHienTai(v)) {
    case 'can': return { ...v, canKhoa: null };
    case 'tang': return v.buoc === 'ham' ? { buoc: 'tmb', toaId: null, canKhoa: null } : { buoc: 'tmb', toaId: v.toaId, canKhoa: null };
    case 'toa': return { ...v, toaId: null, canKhoa: null };
    default: return null;
  }
}

/** Mục menu tầng: `dh` = tầng điển hình (bố cục chung), `t<k>` = tầng điển hình thứ k, `b<n>` = tầng hầm Bn. */
export type MucTang = { khoa: string; loai: 'dh' | 'tang' | 'ham'; so: number; rieng: boolean };

export function dsMucTang(o: { soTangDH: number; coRieng: number[]; soTangHam: number; coToa: boolean }): MucTang[] {
  const kq: MucTang[] = [];
  if (o.coToa) {
    kq.push({ khoa: 'dh', loai: 'dh', so: 0, rieng: false });
    const rieng = new Set(o.coRieng);
    for (let k = 1; k <= Math.max(0, Math.floor(o.soTangDH)); k++) kq.push({ khoa: `t${k}`, loai: 'tang', so: k, rieng: rieng.has(k) });
  }
  for (let n = 1; n <= Math.max(0, Math.floor(o.soTangHam)); n++) kq.push({ khoa: `b${n}`, loai: 'ham', so: n, rieng: false });
  return kq;
}

/** Khoá mục tầng đang xem: Hầm → `b<n>`; Tầng → tầng đầu đang chọn hoặc `dh`; TMB → không có. */
export function khoaTangDangXem(buoc: BuocSoan, tangs: number[] | null, tangHam: number): string | null {
  if (buoc === 'ham') return `b${tangHam}`;
  if (buoc === 'tang') return tangs?.length ? `t${tangs[0]}` : 'dh';
  return null;
}

/** Đọc ngược khoá mục tầng. */
export function giaiKhoaTang(khoa: string): { loai: MucTang['loai']; so: number } | null {
  if (khoa === 'dh') return { loai: 'dh', so: 0 };
  const m = /^([tb])(\d+)$/.exec(khoa);
  return m ? { loai: m[1] === 't' ? 'tang' : 'ham', so: Number(m[2]) } : null;
}

/** Phím trong menu: ↑ / ↓ vòng, Home / End; trả chỉ số mục mới (bỏ qua mục tắt), null nếu không phải phím điều hướng. */
export function buocPhim(phim: string, i: number, tat: boolean[]): number | null {
  const n = tat.length;
  if (!n || tat.every(Boolean)) return null;
  const tim = (tu: number, b: number) => {
    let j = tu;
    for (let d = 0; d < n; d++) { j = (j + b + n) % n; if (!tat[j]) return j; }
    return i;
  };
  if (phim === 'ArrowDown') return tim(i < 0 ? -1 : i, 1);
  if (phim === 'ArrowUp') return tim(i < 0 ? 0 : i, -1);
  if (phim === 'Home') return tim(-1, 1);
  if (phim === 'End') return tim(0, -1);
  return null;
}
