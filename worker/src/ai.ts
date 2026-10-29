/**
 * Leo AI — cổng Claude bằng KHOÁ CHUNG của máy chủ (secret ANTHROPIC_API_KEY, chủ app đặt bằng `npx wrangler secret put
 * ANTHROPIC_API_KEY`). Trình duyệt dùng SDK Anthropic với baseURL `/api/ai` → SDK gọi `POST /api/ai/v1/messages?beta=true`.
 * Chặn lạm dụng: chỉ dự án mở bằng mã sửa đúng; trần lượt / ngày theo dự án và theo IP (D1 `ai_luot`); danh sách mô hình cho phép;
 * trần max_tokens; chỉ chuyển các trường / beta đã biết. Không ghi log khoá, không đưa khoá vào URL, không trả header thượng nguồn thô.
 * Người dùng dán khoá riêng thì trình duyệt gọi thẳng Anthropic, không qua đây.
 */
import type { Context } from 'hono';
import { bam, bangNhau } from './maSua';

export type EnvAI = {
  DB: D1Database;
  ANTHROPIC_API_KEY?: string;
  /** trần lượt / ngày (chuỗi số); thiếu = mặc định */
  AI_GIOI_HAN_DU_AN?: string;
  AI_GIOI_HAN_IP?: string;
};

/** Giữ khớp với web/src/troLy/moHinh.ts `DS_MO_HINH`. */
export const MO_HINH_CHO_PHEP = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'] as const;
export const MO_HINH_MAC_DINH = 'claude-sonnet-5-5';
export const TRAN_TOKEN = 16_000;
export const BETA_CHO_PHEP = new Set(['server-side-fallback-2026-07-01']);
const TRUONG_CHO_PHEP = new Set(['model', 'max_tokens', 'system', 'messages', 'tools', 'tool_choice', 'thinking', 'output_config', 'stream', 'cache_control', 'fallbacks', 'metadata', 'stop_sequences']);
export const GIOI_HAN_BODY_AI = 8_000_000; // byte — đủ cho vài ảnh / PDF đính kèm
const GIOI_HAN_DU_AN = 300;
const GIOI_HAN_IP = 500;
const URL_ANTHROPIC = 'https://api.anthropic.com/v1/messages';

/** Lỗi theo dạng lỗi Anthropic để SDK phía trình duyệt ra lớp lỗi có kiểu; x-should-retry: false để SDK không thử lại vô ích. */
export const loiAI = (trangThai: number, kieu: string, chu: string) =>
  new Response(JSON.stringify({ type: 'error', error: { type: kieu, message: chu } }), {
    status: trangThai,
    headers: { 'content-type': 'application/json', 'x-should-retry': 'false' },
  });

const ngayHom = () => new Date().toISOString().slice(0, 10);

/** Tăng và đọc bộ đếm (một câu lệnh UPSERT … RETURNING). */
async function dem(db: D1Database, khoa: string): Promise<number> {
  const r = await db.prepare('INSERT INTO ai_luot (ngay, khoa, so) VALUES (?, ?, 1) ON CONFLICT (ngay, khoa) DO UPDATE SET so = so + 1 RETURNING so')
    .bind(ngayHom(), khoa).first<{ so: number }>();
  return r?.so ?? 1;
}

export async function trangThaiAI(env: EnvAI): Promise<Response> {
  return Response.json({ coKhoaChung: !!env.ANTHROPIC_API_KEY, moHinh: MO_HINH_CHO_PHEP, macDinh: MO_HINH_MAC_DINH, tranToken: TRAN_TOKEN });
}

/** Chuyển một yêu cầu Messages tới Anthropic bằng khoá chung. `goi` = fetch (thay được khi test). */
export async function chuyenAI(req: Request, env: EnvAI, goi: typeof fetch = fetch): Promise<Response> {
  const khoa = env.ANTHROPIC_API_KEY;
  if (!khoa) return loiAI(503, 'chua_cau_hinh', 'Máy chủ chưa có khoá Claude chung (ANTHROPIC_API_KEY). Hãy dán khoá API Anthropic riêng trong Cài đặt Leo AI.');

  // Chỉ dự án mở bằng mã sửa đúng.
  const ma = req.headers.get('X-Du-An') ?? '', maSua = req.headers.get('X-Ma-Sua') ?? '';
  const da = ma ? await env.DB.prepare('SELECT bam_ma_sua FROM du_an WHERE ma = ?').bind(ma).first<{ bam_ma_sua: string }>() : null;
  if (!da || !maSua || !bangNhau(await bam(maSua), da.bam_ma_sua))
    return loiAI(403, 'can_ma_sua', 'Leo AI dùng khoá chung chỉ cho dự án mở bằng link có mã sửa. Mở bằng link sửa, hoặc dán khoá API riêng.');

  // Thân yêu cầu
  const chu = await req.text();
  if (new TextEncoder().encode(chu).length > GIOI_HAN_BODY_AI) return loiAI(413, 'qua_lon', 'Yêu cầu quá lớn (tệp đính kèm quá nặng).');
  let than: Record<string, unknown>;
  try { than = JSON.parse(chu) as Record<string, unknown>; } catch { return loiAI(400, 'invalid_request_error', 'Thân yêu cầu không phải JSON.'); }
  if (!MO_HINH_CHO_PHEP.includes(than.model as (typeof MO_HINH_CHO_PHEP)[number]))
    return loiAI(400, 'mo_hinh_khong_cho_phep', `Mô hình không được phép. Cho phép: ${MO_HINH_CHO_PHEP.join(', ')}.`);
  if (typeof than.max_tokens !== 'number' || than.max_tokens < 1) return loiAI(400, 'invalid_request_error', 'Thiếu max_tokens.');
  const sach: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(than)) if (TRUONG_CHO_PHEP.has(k)) sach[k] = v;
  sach.max_tokens = Math.min(than.max_tokens, TRAN_TOKEN);

  // Trần lượt / ngày (đếm sau khi yêu cầu hợp lệ)
  const ip = req.headers.get('CF-Connecting-IP') ?? 'khong-ro';
  const [nDa, nIp] = [await dem(env.DB, `da:${ma}`), await dem(env.DB, `ip:${(await bam(ip)).slice(0, 32)}`)];
  if (nDa > Number(env.AI_GIOI_HAN_DU_AN ?? GIOI_HAN_DU_AN) || nIp > Number(env.AI_GIOI_HAN_IP ?? GIOI_HAN_IP))
    return loiAI(429, 'het_luot', 'Hết lượt Leo AI dùng khoá chung hôm nay. Thử lại ngày mai, hoặc dán khoá API riêng.');

  const beta = (req.headers.get('anthropic-beta') ?? '').split(',').map((x) => x.trim()).filter((x) => BETA_CHO_PHEP.has(x));
  const tim = new URL(req.url).searchParams.get('beta') === 'true' ? '?beta=true' : '';
  const len = await goi(URL_ANTHROPIC + tim, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': khoa,
      'anthropic-version': req.headers.get('anthropic-version') ?? '2023-06-01',
      ...(beta.length ? { 'anthropic-beta': beta.join(',') } : {}),
    },
    body: JSON.stringify(sach),
    signal: req.signal,
  });
  // Chỉ chuyển header cần cho SDK (kiểu nội dung, request-id); không trả header thượng nguồn thô.
  const h = new Headers({ 'content-type': len.headers.get('content-type') ?? 'application/json', 'cache-control': 'no-store' });
  const rid = len.headers.get('request-id');
  if (rid) h.set('request-id', rid);
  if (len.status >= 500 || len.status === 429) h.set('x-should-retry', len.headers.get('x-should-retry') ?? 'true');
  return new Response(len.body, { status: len.status, headers: h });
}

export const tuyenAI = {
  trangThai: (c: Context<{ Bindings: EnvAI }>) => trangThaiAI(c.env),
  chuyen: (c: Context<{ Bindings: EnvAI }>) => chuyenAI(c.req.raw, c.env),
};
