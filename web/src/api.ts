import { layTenNguoi } from './kho/maSua';

/** Gọi API Unitmix (cùng tên miền, đường /api). Lỗi HTTP ném LoiApi có mã trạng thái. */
export class LoiApi extends Error {
  constructor(public trangThai: number) {
    super(`API ${trangThai}`);
  }
}

export type TomTatPA = { soCan?: number; coCau?: Record<string, number>; dtSan?: number; dtHam?: number; danSo?: number };
export type PAtrongDuAn = { id: string; ten: string; tom_tat: TomTatPA; sua_luc: string; sua_boi?: string };
export type DuAnApi = { ma: string; ten: string; dia_diem: string; phuong_an: PAtrongDuAn[] };
export type PAApi = { id: string; ten: string; trang_thai: unknown; sua_luc: string; sua_boi?: string };

async function goi<T>(duong: string, init: RequestInit = {}, maSua?: string | null): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (maSua) headers['X-Ma-Sua'] = maSua;
  const r = await fetch(duong, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
  if (!r.ok) throw new LoiApi(r.status);
  return (r.status === 204 ? undefined : await r.json()) as T;
}

export type Toi = {
  yeuCau: boolean; email: string | null; duocTao: boolean; dangNhap: string;
  trangThai: 'cho' | 'duyet' | 'tu_choi' | null; lyDo: string | null; laQuanTri: boolean; soCho: number;
};
export type QuanTriApi = {
  nguoi: { email: string; trang_thai: 'cho' | 'duyet' | 'tu_choi'; yeu_cau_luc: string; duyet_luc: string | null; duyet_boi: string | null; so_du_an: number }[];
  du_an: { ma: string; ten: string; tao_boi: string; tao_luc: string; so_pa: number }[];
};

export const api = {
  /** Ai đang dùng: có yêu cầu đăng nhập (mail công ty) để tạo dự án không, đã đăng nhập chưa. */
  toi: () => goi<Toi>('/api/toi'),
  quanTri: () => goi<QuanTriApi>('/api/quan-tri'),
  duyet: (email: string, trang_thai: 'cho' | 'duyet' | 'tu_choi') =>
    goi<{ ok: true }>('/api/quan-tri/duyet', { method: 'POST', body: JSON.stringify({ email, trang_thai }) }),
  taoDuAn: (ten: string, dia_diem: string) =>
    goi<{ ma: string; ma_sua: string }>('/api/du-an', { method: 'POST', body: JSON.stringify({ ten, dia_diem }) }),
  docDuAn: (ma: string) => goi<DuAnApi>(`/api/du-an/${ma}`),
  kiemMa: (ma: string, maSua: string | null) => goi<{ duocSua: boolean }>(`/api/du-an/${ma}/kiem-ma`, {}, maSua),
  docPA: (ma: string, id: string) => goi<PAApi>(`/api/du-an/${ma}/pa/${id}`),
  ghiPA: (ma: string, id: string, maSua: string, ten: string, trang_thai: unknown, tom_tat: unknown) =>
    goi<{ ok: true }>(`/api/du-an/${ma}/pa/${id}`, { method: 'PUT', body: JSON.stringify({ ten, trang_thai, tom_tat, sua_boi: layTenNguoi() }) }, maSua),
  nhanBan: (ma: string, id: string, maSua: string) =>
    goi<{ id: string }>(`/api/du-an/${ma}/pa/${id}/nhan-ban`, { method: 'POST', body: JSON.stringify({ sua_boi: layTenNguoi() }) }, maSua),
  /** Nhân bản cả dự án thành dự án mới (mã + mã sửa mới). */
  nhanBanDuAn: (ma: string, ten?: string) =>
    goi<{ ma: string; ma_sua: string; so_pa: number }>(`/api/du-an/${ma}/nhan-ban`, { method: 'POST', body: JSON.stringify({ ten, sua_boi: layTenNguoi() }) }),
  doiTenDuAn: (ma: string, maSua: string, ten: string, dia_diem: string) =>
    goi<{ ok: true }>(`/api/du-an/${ma}`, { method: 'PATCH', body: JSON.stringify({ ten, dia_diem }) }, maSua),
  doiTenPA: (ma: string, id: string, maSua: string, ten: string) =>
    goi<{ ok: true }>(`/api/du-an/${ma}/pa/${id}`, { method: 'PATCH', body: JSON.stringify({ ten }) }, maSua),
  xoaPA: (ma: string, id: string, maSua: string) => goi<void>(`/api/du-an/${ma}/pa/${id}`, { method: 'DELETE' }, maSua),
};
