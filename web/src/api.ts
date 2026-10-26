/** Gọi API Unitmix (cùng tên miền, đường /api). Lỗi HTTP ném LoiApi có mã trạng thái. */
export class LoiApi extends Error {
  constructor(public trangThai: number) {
    super(`API ${trangThai}`);
  }
}

export type TomTatPA = { soCan?: number; coCau?: Record<string, number>; dtSan?: number; dtHam?: number };
export type PAtrongDuAn = { id: string; ten: string; tom_tat: TomTatPA; sua_luc: string };
export type DuAnApi = { ma: string; ten: string; dia_diem: string; phuong_an: PAtrongDuAn[] };
export type PAApi = { id: string; ten: string; trang_thai: unknown; sua_luc: string };

async function goi<T>(duong: string, init: RequestInit = {}, maSua?: string | null): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (maSua) headers['X-Ma-Sua'] = maSua;
  const r = await fetch(duong, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
  if (!r.ok) throw new LoiApi(r.status);
  return (r.status === 204 ? undefined : await r.json()) as T;
}

export const api = {
  taoDuAn: (ten: string, dia_diem: string) =>
    goi<{ ma: string; ma_sua: string }>('/api/du-an', { method: 'POST', body: JSON.stringify({ ten, dia_diem }) }),
  docDuAn: (ma: string) => goi<DuAnApi>(`/api/du-an/${ma}`),
  kiemMa: (ma: string, maSua: string | null) => goi<{ duocSua: boolean }>(`/api/du-an/${ma}/kiem-ma`, {}, maSua),
  docPA: (ma: string, id: string) => goi<PAApi>(`/api/du-an/${ma}/pa/${id}`),
  ghiPA: (ma: string, id: string, maSua: string, ten: string, trang_thai: unknown, tom_tat: unknown) =>
    goi<{ ok: true }>(`/api/du-an/${ma}/pa/${id}`, { method: 'PUT', body: JSON.stringify({ ten, trang_thai, tom_tat }) }, maSua),
  nhanBan: (ma: string, id: string, maSua: string) =>
    goi<{ id: string }>(`/api/du-an/${ma}/pa/${id}/nhan-ban`, { method: 'POST' }, maSua),
  xoaPA: (ma: string, id: string, maSua: string) => goi<void>(`/api/du-an/${ma}/pa/${id}`, { method: 'DELETE' }, maSua),
};
