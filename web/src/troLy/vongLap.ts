/**
 * Vòng tác tử Leo AI (vòng tay, không dùng tool runner): gửi lịch sử + công cụ → nhận luồng (chữ, suy nghĩ tóm tắt, tool_use) →
 * kiểm stop_reason TRƯỚC khi chạy công cụ (refusal / max_tokens / pause_turn) → chạy các tool_use của lượt theo thứ tự (phép sửa
 * cần tuần tự) → trả MỌI tool_result của lượt trong MỘT tin user (lỗi = is_error) → lặp tới khi Claude xong.
 * Lịch sử luôn nối nguyên `response.content` (khối thinking giữ nguyên chữ ký). Dừng (AbortSignal) giữa chừng vẫn để lịch sử hợp lệ.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { CONG_CU_API, chayCongCu } from './congCu';
import type { NguCanh } from './congCu/nguCanh';
import { HE_THONG } from './heThong';
import { moHinhTheoId, type MaMoHinh, type MucNghi } from './moHinh';

export type TinNhan = Anthropic.Beta.BetaMessageParam;
export type ThanYeuCau = Anthropic.Beta.MessageCreateParamsNonStreaming;

/** Luồng một lượt: lặp sự kiện + bản cuối (như BetaMessageStream của SDK). Tách ra để test bằng khách giả. */
export interface LuongClaude extends AsyncIterable<Anthropic.Beta.BetaRawMessageStreamEvent> {
  finalMessage(): Promise<Anthropic.Beta.BetaMessage>;
}
export interface KhachClaude {
  luong(than: ThanYeuCau, tuyChon: { signal: AbortSignal }): LuongClaude;
}

export type SuKien =
  | { loai: 'luot'; i: number }
  | { loai: 'chu'; chu: string }
  | { loai: 'nghi'; chu: string }
  | { loai: 'cong_cu_bat_dau'; id: string; ten: string }
  | { loai: 'cong_cu_xong'; id: string; ten: string; dauVao: unknown; ketQua: string; loi: boolean; ms: number }
  | { loai: 'dung_luong'; usage: Anthropic.Beta.BetaUsage; moHinh: string };

export type KetThuc =
  | { lyDo: 'xong' }
  | { lyDo: 'tu_choi'; chiTiet?: string }
  | { lyDo: 'het_token' }
  | { lyDo: 'huy' }
  | { lyDo: 'gioi_han_vong' };

export const TOI_DA_VONG = 24;

/** Thân yêu cầu: tools + system cố định có cache_control (tiền tố cache), cache tự động phần hội thoại, effort đặt rõ, adaptive thinking. */
export function taoThan(moHinh: MaMoHinh, nghi: MucNghi, lichSu: TinNhan[]): ThanYeuCau {
  const mh = moHinhTheoId(moHinh);
  return {
    model: mh.id,
    max_tokens: mh.toiDaToken,
    system: [{ type: 'text', text: HE_THONG, cache_control: { type: 'ephemeral' } }],
    tools: CONG_CU_API,
    tool_choice: { type: 'auto' }, // ép công cụ (any / tool) trả 400 trên Opus 5.5 / Sonnet 5.5
    // Opus 5.5 luôn suy nghĩ (không gửi disabled / budget_tokens); display "summarized" để hiện tiến trình, Sonnet 5.5 đưa ghi chú giữa các công cụ vào đây.
    thinking: { type: 'adaptive', display: 'summarized' },
    output_config: { effort: nghi },
    cache_control: { type: 'ephemeral' },
    messages: lichSu,
    // Server-side fallback khi mô hình từ chối vì chính sách (Claude API); Haiku 5.5 không hỗ trợ → không gửi.
    ...(mh.duPhong ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
  };
}

const laHuy = (e: unknown, signal: AbortSignal) => signal.aborted || (e instanceof Error && (e.name === 'AbortError' || e.constructor?.name === 'APIUserAbortError'));

export async function chayVong(v: {
  khach: KhachClaude;
  moHinh: MaMoHinh;
  nghi: MucNghi;
  /** lịch sử (đã có tin user mới nhất); hàm NỐI thêm vào mảng này */
  lichSu: TinNhan[];
  ng: NguCanh;
  signal: AbortSignal;
  khiSuKien: (s: SuKien) => void;
  toiDaVong?: number;
}): Promise<KetThuc> {
  const { khach, lichSu, ng, signal, khiSuKien } = v;
  for (let i = 0; i < (v.toiDaVong ?? TOI_DA_VONG); i++) {
    if (signal.aborted) return { lyDo: 'huy' };
    khiSuKien({ loai: 'luot', i });
    let msg: Anthropic.Beta.BetaMessage;
    try {
      const luong = khach.luong(taoThan(v.moHinh, v.nghi, lichSu), { signal });
      for await (const e of luong) {
        if (e.type === 'content_block_start' && e.content_block.type === 'tool_use') khiSuKien({ loai: 'cong_cu_bat_dau', id: e.content_block.id, ten: e.content_block.name });
        else if (e.type === 'content_block_delta') {
          if (e.delta.type === 'text_delta') khiSuKien({ loai: 'chu', chu: e.delta.text });
          else if (e.delta.type === 'thinking_delta') khiSuKien({ loai: 'nghi', chu: e.delta.thinking });
        }
      }
      msg = await luong.finalMessage();
    } catch (e) {
      if (laHuy(e, signal)) return { lyDo: 'huy' }; // lượt dở không vào lịch sử
      throw e;
    }
    khiSuKien({ loai: 'dung_luong', usage: msg.usage, moHinh: msg.model });

    // stop_reason trước khi chạy công cụ
    if (msg.stop_reason === 'refusal') {
      const d = (msg as { stop_details?: { category?: string | null; explanation?: string | null } }).stop_details;
      return { lyDo: 'tu_choi', chiTiet: d?.explanation ?? d?.category ?? undefined };
    }
    const dungCu = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    if (msg.stop_reason === 'max_tokens') {
      // tool_use có thể dở dang (đầu vào cắt cụt): không chạy, không đưa lượt này vào lịch sử (tool_use không có tool_result → 400 lượt sau)
      if (!dungCu.length) lichSu.push({ role: 'assistant', content: msg.content as never });
      return { lyDo: 'het_token' };
    }
    lichSu.push({ role: 'assistant', content: msg.content as never });
    if (msg.stop_reason === 'pause_turn') continue;
    if (msg.stop_reason !== 'tool_use' || !dungCu.length) return { lyDo: 'xong' };

    // Chạy tuần tự (phép sửa phụ thuộc thứ tự), gom mọi kết quả vào MỘT tin user.
    const ketQua: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const b of dungCu) {
      if (signal.aborted) { ketQua.push({ type: 'tool_result', tool_use_id: b.id, content: 'Người dùng đã bấm Dừng — công cụ không chạy.', is_error: true }); continue; }
      const t0 = Date.now();
      const r = await chayCongCu(b.name, b.input, ng);
      ketQua.push({ type: 'tool_result', tool_use_id: b.id, content: r.noiDung, ...(r.loi ? { is_error: true } : {}) });
      khiSuKien({ loai: 'cong_cu_xong', id: b.id, ten: b.name, dauVao: b.input, ketQua: r.noiDung, loi: r.loi, ms: Date.now() - t0 });
    }
    lichSu.push({ role: 'user', content: ketQua });
    if (signal.aborted) return { lyDo: 'huy' };
  }
  return { lyDo: 'gioi_han_vong' };
}

/**
 * Gọn lịch sử để tiết kiệm token: khi lịch sử dài, kết quả công cụ CŨ (trước `giu` tin cuối) rút còn ~300 ký tự và bỏ khối thinking
 * từ chỗ sửa trở đi (tài liệu API: sửa tin cũ thì bỏ thinking từ lượt bị sửa — tránh lỗi ràng buộc khối). Ảnh cũ thay bằng chữ.
 * Chỉ gọi lúc BẮT ĐẦU một câu hỏi mới (giữa vòng giữ lịch sử chỉ-nối-thêm cho cache).
 */
export function gonLichSu(ls: TinNhan[], nguong = 60_000, giu = 6): TinNhan[] {
  if (JSON.stringify(ls).length <= nguong) return ls;
  const cat = Math.max(0, ls.length - giu);
  const ra: TinNhan[] = [];
  ls.forEach((m, i) => {
    if (m.role === 'system' || typeof m.content === 'string' || !m.content) { ra.push(m); return; }
    if (m.role === 'assistant') {
      // giữ đủ số tin (thời điểm tin `luc` cùng chỉ số); lượt chỉ có thinking thành '…'
      const c = m.content.filter((b) => b.type !== 'thinking' && b.type !== 'redacted_thinking');
      ra.push({ ...m, content: c.length ? c : [{ type: 'text', text: '…' }] });
      return;
    }
    if (i >= cat) { ra.push(m); return; }
    ra.push({
      ...m,
      content: m.content.map((b) => {
        if (b.type === 'tool_result' && typeof b.content === 'string' && b.content.length > 300) return { ...b, content: b.content.slice(0, 300) + ' …[đã rút gọn]' };
        if (b.type === 'image' || b.type === 'document') return { type: 'text' as const, text: '[tệp đính kèm cũ đã bỏ khỏi lịch sử]' };
        return b;
      }),
    });
  });
  return ra;
}
