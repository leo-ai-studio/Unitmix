/**
 * Mô hình Claude cho Leo AI + cài đặt người dùng (lưu ở trình duyệt này). Mã mô hình đúng như tài liệu Claude API (không hậu tố ngày).
 * Giá USD / 1 triệu token (vào / ra) dùng để ước chi phí tương đối khi gợi ý mô hình — cập nhật khi Anthropic đổi giá.
 */
import { DS_NGUON, type NguonChon } from './cau';

export type MaMoHinh = 'claude-opus-5-5' | 'claude-sonnet-5-5' | 'claude-haiku-5-5';
export type MucNghi = 'low' | 'medium' | 'high';

export type MoHinh = {
  id: MaMoHinh;
  ten: string;
  /** khoá i18n mô tả một dòng */
  moTa: string;
  gia: { vao: number; ra: number };
  /** trần max_tokens mỗi lượt (đủ cho suy nghĩ + trả lời; máy chủ cũng chặn trần) */
  toiDaToken: number;
  /** có server-side fallback `fallbacks: "default"` (beta server-side-fallback-2026-07-01) */
  duPhong: boolean;
};

export const DS_MO_HINH: MoHinh[] = [
  { id: 'claude-opus-5-5', ten: 'Claude Opus 5.5', moTa: 'leo.mh.opus', gia: { vao: 4, ra: 20 }, toiDaToken: 16000, duPhong: true },
  { id: 'claude-sonnet-5-5', ten: 'Claude Sonnet 5.5', moTa: 'leo.mh.sonnet', gia: { vao: 2, ra: 10 }, toiDaToken: 16000, duPhong: true },
  // Haiku 5.5: không có server-side fallback (danh sách fallbacks trả 400) → không gửi.
  { id: 'claude-haiku-5-5', ten: 'Claude Haiku 5.5', moTa: 'leo.mh.haiku', gia: { vao: 0.1, ra: 0.5 }, toiDaToken: 8000, duPhong: false },
];
export const MO_HINH_MAC_DINH: MaMoHinh = 'claude-sonnet-5-5';
export const NGHI_MAC_DINH: MucNghi = 'medium';
export const moHinhTheoId = (id: string): MoHinh => DS_MO_HINH.find((m) => m.id === id) ?? DS_MO_HINH[1];

/** Chi phí tương đối so với Opus (cùng bộ đếm token): Sonnet ½, Haiku 1/40. */
export const tyLeSoOpus = (id: MaMoHinh) => moHinhTheoId(id).gia.ra / DS_MO_HINH[0].gia.ra;

export type CaiDatLeo = {
  /** 'tu_chon' = tự chọn mô hình theo câu hỏi (bộ phân loại goiYMoHinh.ts, không tốn token) */
  moHinh: MaMoHinh | 'tu_chon';
  nghi: MucNghi;
  /** đọc to câu trả lời (speechSynthesis) */
  docTo: boolean;
  /** nguồn gọi Claude: tự động (khoá riêng → tài khoản Claude qua cầu → khoá chung) hoặc ép một nguồn */
  nguon: NguonChon;
};
export const CAI_DAT_MAC_DINH: CaiDatLeo = { moHinh: MO_HINH_MAC_DINH, nghi: NGHI_MAC_DINH, docTo: false, nguon: 'tu_dong' };

const KHOA_CAI_DAT = 'unitmix.leoAi.caiDat';
const KHOA_API = 'unitmix.leoAi.khoaApi';

const doc = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const ghi = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* chặn lưu: chỉ trong phiên */ } };

export function docCaiDat(): CaiDatLeo {
  try {
    const v = JSON.parse(doc(KHOA_CAI_DAT) ?? '{}') as Partial<CaiDatLeo>;
    return {
      moHinh: v.moHinh === 'tu_chon' || DS_MO_HINH.some((m) => m.id === v.moHinh) ? v.moHinh! : CAI_DAT_MAC_DINH.moHinh,
      nghi: v.nghi === 'low' || v.nghi === 'medium' || v.nghi === 'high' ? v.nghi : NGHI_MAC_DINH,
      docTo: v.docTo === true,
      nguon: DS_NGUON.includes(v.nguon as NguonChon) ? v.nguon! : CAI_DAT_MAC_DINH.nguon,
    };
  } catch { return { ...CAI_DAT_MAC_DINH }; }
}
export const ghiCaiDat = (c: CaiDatLeo) => ghi(KHOA_CAI_DAT, JSON.stringify(c));

/** Khoá API riêng: CHỈ lưu ở localStorage trình duyệt này, không bao giờ gửi về máy chủ Unitmix. */
export const docKhoaApi = (): string | null => doc(KHOA_API);
export const ghiKhoaApi = (k: string | null) => ghi(KHOA_API, k?.trim() || null);
/** Hiện khoá dạng che: sk-ant-…abcd */
export const cheKhoa = (k: string) => (k.length > 12 ? `${k.slice(0, 7)}…${k.slice(-4)}` : '••••');
