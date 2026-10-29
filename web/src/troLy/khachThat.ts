/**
 * Khách Claude thật bằng SDK chính thức `@anthropic-ai/sdk`:
 * - có khoá riêng (dán trong Cài đặt Leo AI, chỉ lưu localStorage trình duyệt này) → gọi thẳng api.anthropic.com
 *   (`dangerouslyAllowBrowser: true`; khoá không bao giờ gửi về máy chủ Unitmix);
 * - không có → khoá chung của máy chủ qua Worker `/api/ai` (worker/src/ai.ts), kèm mã dự án + mã sửa ở header (không ở URL).
 * Lỗi đổi sang câu tiếng Việt dễ hiểu (`loiTiengViet`) theo lớp lỗi có kiểu của SDK.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { KhachClaude } from './vongLap';

export type NguonKhoa = 'rieng' | 'chung';

export function taoKhach(v: { khoaRieng: string | null; maDuAn: string; maSua: string | null }): KhachClaude & { nguon: NguonKhoa } {
  const client = v.khoaRieng
    ? new Anthropic({ apiKey: v.khoaRieng, dangerouslyAllowBrowser: true, maxRetries: 2 })
    : new Anthropic({
      apiKey: 'khoa-chung-may-chu', // không phải khoá thật: Worker bỏ header này, dùng secret của máy chủ
      baseURL: `${location.origin}/api/ai`,
      dangerouslyAllowBrowser: true,
      maxRetries: 1,
      defaultHeaders: { 'X-Du-An': v.maDuAn, ...(v.maSua ? { 'X-Ma-Sua': v.maSua } : {}) },
    });
  return {
    nguon: v.khoaRieng ? 'rieng' : 'chung',
    luong: (than, { signal }) => client.beta.messages.stream(than, { signal }),
  };
}

/** Lỗi → câu tiếng Việt + gợi ý hành động. `can` = 'khoa' khi nên mở Cài đặt để dán khoá riêng. */
export function loiTiengViet(e: unknown, nguon: NguonKhoa): { chu: string; can?: 'khoa' } {
  const kieu = (e as { error?: { error?: { type?: string; message?: string } } })?.error?.error;
  if (kieu?.type === 'chua_cau_hinh' || kieu?.type === 'can_ma_sua' || kieu?.type === 'het_luot') return { chu: kieu.message ?? 'Máy chủ từ chối.', can: 'khoa' };
  if (e instanceof Anthropic.AuthenticationError) return { chu: nguon === 'rieng' ? 'Khoá API riêng không hợp lệ hoặc đã bị thu hồi — kiểm tra lại trong Cài đặt.' : 'Khoá chung của máy chủ không hợp lệ — báo chủ app, hoặc dán khoá riêng.', can: 'khoa' };
  if (e instanceof Anthropic.PermissionDeniedError) return { chu: 'Khoá không có quyền dùng mô hình này — thử mô hình khác hoặc kiểm tra tài khoản Anthropic.', can: 'khoa' };
  if (e instanceof Anthropic.RateLimitError) return { chu: 'Đang vượt giới hạn tốc độ / hạn mức của tài khoản Claude — đợi một lát rồi thử lại.' };
  if (e instanceof Anthropic.BadRequestError) return { chu: `Yêu cầu bị từ chối (400): ${kieu?.message ?? (e as Error).message}` };
  if (e instanceof Anthropic.NotFoundError) return { chu: 'Không tìm thấy mô hình hoặc địa chỉ API — kiểm tra tên mô hình trong Cài đặt.' };
  if (e instanceof Anthropic.InternalServerError) return { chu: 'Máy chủ Claude đang quá tải hoặc lỗi tạm thời — thử lại sau ít phút.' };
  if (e instanceof Anthropic.APIConnectionError) return { chu: 'Không kết nối được tới Claude — kiểm tra mạng (5G / Wi-Fi) rồi thử lại.' };
  if (e instanceof Anthropic.APIError) return { chu: `Lỗi Claude ${e.status ?? ''}: ${kieu?.message ?? e.message}` };
  return { chu: `Lỗi không rõ: ${e instanceof Error ? e.message : String(e)}` };
}
