/**
 * Khách Claude thật bằng SDK chính thức `@anthropic-ai/sdk`:
 * - có khoá riêng (dán trong Cài đặt Leo AI, chỉ lưu localStorage trình duyệt này) → gọi thẳng api.anthropic.com
 *   (`dangerouslyAllowBrowser: true`; khoá không bao giờ gửi về máy chủ Unitmix);
 * - tài khoản Claude đã đăng nhập trên máy → cầu 127.0.0.1 (scripts/cau_claude.py, troLy/cau.ts), không cần khoá;
 * - không có → khoá chung của máy chủ qua Worker `/api/ai` (worker/src/ai.ts), kèm mã dự án + mã sửa ở header (không ở URL).
 * Lỗi đổi sang câu tiếng Việt dễ hiểu (`loiTiengViet`) theo lớp lỗi có kiểu của SDK.
 */
import Anthropic from '@anthropic-ai/sdk';
import { GOC_TRAM, taoFetchTram } from './cau';
import type { KhachClaude } from './vongLap';

export type NguonKhoa = 'rieng' | 'chung' | 'cau';

/** `nguon` chọn nguồn; 'cau' = tài khoản Claude qua cầu trên máy (troLy/cau.ts) tại `diaChiCau`. */
export function taoKhach(v: { nguon?: NguonKhoa; khoaRieng: string | null; maDuAn: string; maSua: string | null; diaChiCau?: string; qua?: 'may' | 'tram'; maGhep?: string | null }): KhachClaude & { nguon: NguonKhoa } {
  const nguon: NguonKhoa = v.nguon ?? (v.khoaRieng ? 'rieng' : 'chung');
  const client = nguon === 'cau'
    // cầu tự gọi Claude Code bằng tài khoản đăng nhập trên máy; SDK không tự gọi lại (mỗi lần gọi lại là thêm một lượt claude -p)
    ? v.qua === 'tram' && v.maGhep
      // điện thoại: đi qua trạm chuyển trên Worker (cầu trên máy tính tự nối ra trạm); fetch riêng lo hỏi + chờ tiếp
      ? new Anthropic({ apiKey: 'tai-khoan-claude', baseURL: location.origin + GOC_TRAM, fetch: taoFetchTram(v.maGhep), dangerouslyAllowBrowser: true, maxRetries: 0 })
      : new Anthropic({ apiKey: 'tai-khoan-claude', baseURL: v.diaChiCau, dangerouslyAllowBrowser: true, maxRetries: 0 })
    : nguon === 'rieng' && v.khoaRieng
    ? new Anthropic({ apiKey: v.khoaRieng, dangerouslyAllowBrowser: true, maxRetries: 2 })
    : new Anthropic({
      apiKey: 'khoa-chung-may-chu', // không phải khoá thật: Worker bỏ header này, dùng secret của máy chủ
      baseURL: `${location.origin}/api/ai`,
      dangerouslyAllowBrowser: true,
      maxRetries: 1,
      defaultHeaders: { 'X-Du-An': v.maDuAn, ...(v.maSua ? { 'X-Ma-Sua': v.maSua } : {}) },
    });
  return {
    nguon: nguon === 'rieng' && !v.khoaRieng ? 'chung' : nguon,
    luong: (than, { signal }) => client.beta.messages.stream(than, { signal }),
  };
}

/** Lỗi → câu tiếng Việt + gợi ý hành động. `can` = 'khoa' khi nên mở Cài đặt để dán khoá riêng. */
export function loiTiengViet(e: unknown, nguon: NguonKhoa): { chu: string; can?: 'khoa' } {
  const kieu = (e as { error?: { error?: { type?: string; message?: string } } })?.error?.error;
  // khoá chung chưa đặt: đường chính giờ là tài khoản Claude qua cầu — chỉ cách làm, không bảo đi tìm khoá API
  if (nguon === 'chung' && kieu?.type === 'chua_cau_hinh') return { chu: 'Leo AI chưa nối tài khoản Claude. Trên điện thoại: mở Cài đặt Leo AI → mục "Ghép với máy tính" và dán link ghép lấy từ máy tính (Cài đặt Leo AI → Chép link ghép điện thoại). Trên máy tính: Cài đặt Leo AI → Tải bộ cài cầu AI.', can: 'khoa' };
  if (kieu?.type === 'chua_cau_hinh' || kieu?.type === 'can_ma_sua' || kieu?.type === 'het_luot') return { chu: kieu.message ?? 'Máy chủ từ chối.', can: 'khoa' };
  if (nguon === 'cau') {
    // cầu trả lỗi theo dạng Anthropic (scripts/cau_claude.py); câu ở đây chỉ rõ việc người dùng làm được
    if (kieu?.type === 'ma_ghep_sai') return { chu: 'Mã ghép điện thoại không còn đúng — mở Leo AI trên máy tính, Cài đặt → Dùng trên điện thoại, rồi ghép lại.', can: 'khoa' };
    if (kieu?.type === 'may_tat') return { chu: 'Máy tính chưa nối: máy đang tắt, đang ngủ, hoặc cầu AI chưa chạy. Bật máy tính rồi thử lại.', can: 'khoa' };
    if (kieu?.type === 'chua_cai_claude') return { chu: 'Máy chưa cài Claude Code — chạy bộ cài cầu AI (Cài đặt Leo AI).', can: 'khoa' };
    if (e instanceof Anthropic.AuthenticationError) return { chu: 'Claude Code trên máy chưa đăng nhập hoặc phiên đã hết hạn — bấm "Đăng nhập Claude" trong Cài đặt Leo AI.', can: 'khoa' };
    if (e instanceof Anthropic.RateLimitError) return { chu: 'Tài khoản Claude của bạn hết hạn mức tạm thời (gói Pro/Max) — đợi hạn mức làm mới rồi thử lại, hoặc chọn mô hình nhẹ hơn.' };
    if (e instanceof Anthropic.APIConnectionError) return { chu: 'Không nối được cầu AI trên máy — kiểm tra cầu đang chạy (Cài đặt Leo AI → Tài khoản Claude).', can: 'khoa' };
  }
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
