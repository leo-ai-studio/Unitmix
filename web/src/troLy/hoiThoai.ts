/**
 * Lịch sử trò chuyện Leo AI theo dự án, lưu localStorage của trình duyệt này (`unitmix.leoAi.hoiThoai.<mã dự án>`): tối đa
 * 20 cuộc, mỗi cuộc gọn. Bản lưu bỏ dữ liệu ảnh / tệp đính kèm (thay bằng chữ) và — từ tin có tệp bị bỏ trở đi — bỏ khối thinking
 * (tài liệu API: sửa tin cũ thì bỏ thinking từ chỗ sửa, tránh lỗi ràng buộc khối khi gửi lại).
 */
import type { TinNhan } from './vongLap';

export type CuocTroChuyen = {
  id: string;
  ten: string;
  tao: number;
  sua: number;
  lichSu: TinNhan[];
  /** thời điểm từng tin (cùng chỉ số với lichSu) */
  luc: number[];
  /** mô hình người dùng chọn riêng cho cuộc này (không tự đổi trừ khi chế độ Tự chọn) */
  moHinh?: string;
};

const TOI_DA_CUOC = 20;
const TOI_DA_KY_TU = 600_000;
const khoa = (ma: string) => `unitmix.leoAi.hoiThoai.${ma}`;

export const idCuoc = () => `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Bản để lưu: bỏ ảnh / tài liệu; từ tin đầu tiên có tệp bị bỏ, gỡ thinking ở các lượt assistant sau đó. */
export function banLuu(ls: TinNhan[]): TinNhan[] {
  let tu = -1;
  const boTep = ls.map((m, i) => {
    if (typeof m.content === 'string' || !m.content || m.role !== 'user') return m;
    if (!m.content.some((b) => b.type === 'image' || b.type === 'document')) return m;
    if (tu < 0) tu = i;
    return { ...m, content: m.content.map((b) => (b.type === 'image' || b.type === 'document' ? { type: 'text' as const, text: '[đã gửi một tệp đính kèm — không lưu trong lịch sử]' } : b)) };
  });
  if (tu < 0) return boTep;
  return boTep.map((m, i) => {
    if (i < tu || m.role !== 'assistant' || typeof m.content === 'string' || !m.content) return m;
    const c = m.content.filter((b) => b.type !== 'thinking' && b.type !== 'redacted_thinking');
    return { ...m, content: c.length ? c : [{ type: 'text' as const, text: '…' }] };
  });
}

export function docCuoc(ma: string): CuocTroChuyen[] {
  try {
    const v = JSON.parse(localStorage.getItem(khoa(ma)) ?? '[]') as CuocTroChuyen[];
    return Array.isArray(v) ? v.filter((c) => c && Array.isArray(c.lichSu)) : [];
  } catch { return []; }
}

export function ghiCuoc(ma: string, ds: CuocTroChuyen[]): void {
  let gon = [...ds].sort((a, b) => b.sua - a.sua).slice(0, TOI_DA_CUOC).map((c) => ({ ...c, lichSu: banLuu(c.lichSu) }));
  // quá lớn: bỏ dần cuộc cũ nhất (giữ cuộc mới nhất)
  while (gon.length > 1 && JSON.stringify(gon).length > TOI_DA_KY_TU) gon = gon.slice(0, -1);
  try { localStorage.setItem(khoa(ma), JSON.stringify(gon)); } catch { /* hết chỗ / chặn lưu: giữ trong phiên */ }
}

/** Tên cuộc từ câu hỏi đầu. */
export const tenTuCau = (cau: string) => { const s = cau.replace(/\s+/g, ' ').trim(); return s.length > 48 ? s.slice(0, 46) + '…' : s || '—'; };
