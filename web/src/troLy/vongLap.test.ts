/**
 * Vòng tác tử với khách Claude GIẢ (không gọi API thật): luồng tool_use → chạy công cụ thật → tool_result gom một tin; nhiều công cụ
 * một lượt; refusal / max_tokens không chạy công cụ; Dừng giữa luồng / giữa công cụ; thân yêu cầu đúng luật từng mô hình.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { chayVong, gonLichSu, taoThan, type KhachClaude, type LuongClaude, type SuKien, type ThanYeuCau, type TinNhan } from './vongLap';
import { taoNguCanhThu } from './thuNguCanh';

type Khoi = { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: unknown } | { type: 'thinking'; thinking: string; signature: string };

/** Một lượt giả: phát sự kiện như SDK, finalMessage = message ghép. */
function luotGia(khoi: Khoi[], stop: string, them: Record<string, unknown> = {}, huyGiua?: AbortSignal): LuongClaude {
  const msg = { id: 'msg', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content: khoi, stop_reason: stop, stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, ...them } as unknown as Anthropic.Beta.BetaMessage;
  return {
    async *[Symbol.asyncIterator]() {
      for (let i = 0; i < khoi.length; i++) {
        const k = khoi[i];
        yield { type: 'content_block_start', index: i, content_block: k.type === 'tool_use' ? { ...k, input: {} } : k.type === 'text' ? { type: 'text', text: '' } : { type: 'thinking', thinking: '', signature: '' } } as never;
        if (huyGiua?.aborted) { const e = new Error('aborted'); e.name = 'AbortError'; throw e; }
        if (k.type === 'text') yield { type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: k.text } } as never;
        if (k.type === 'thinking') yield { type: 'content_block_delta', index: i, delta: { type: 'thinking_delta', thinking: k.thinking } } as never;
      }
    },
    finalMessage: async () => msg,
  };
}

/** Khách giả phát lần lượt các lượt kịch bản; ghi lại thân yêu cầu nhận được. */
function khachGia(kichBan: ((than: ThanYeuCau, signal: AbortSignal) => LuongClaude)[]): KhachClaude & { nhan: ThanYeuCau[] } {
  const nhan: ThanYeuCau[] = [];
  let i = 0;
  return { nhan, luong: (than, { signal }) => { nhan.push(structuredClone(than)); return kichBan[i++](than, signal); } };
}

const hoi = (chu: string): TinNhan[] => [{ role: 'user', content: chu }];

describe('vòng tác tử Leo AI (khách giả)', () => {
  it('chỉ trả lời chữ → xong, lịch sử nối nguyên content (kể cả thinking)', async () => {
    const { ng } = taoNguCanhThu();
    const k = khachGia([() => luotGia([{ type: 'thinking', thinking: 'nghĩ', signature: 'sig' }, { type: 'text', text: 'Chào bạn' }], 'end_turn')]);
    const ls = hoi('xin chào'), sk: SuKien[] = [];
    const r = await chayVong({ khach: k, moHinh: 'claude-sonnet-5-5', nghi: 'medium', lichSu: ls, ng, signal: new AbortController().signal, khiSuKien: (s) => sk.push(s) });
    expect(r.lyDo).toBe('xong');
    expect(ls).toHaveLength(2);
    expect((ls[1].content as Khoi[])[0]).toMatchObject({ type: 'thinking', signature: 'sig' });
    expect(sk.filter((s) => s.loai === 'chu').map((s) => (s as { chu: string }).chu).join('')).toBe('Chào bạn');
    expect(sk.some((s) => s.loai === 'nghi')).toBe(true);
  });

  it('hai tool_use một lượt: chạy theo thứ tự trên kho thật, gom MỘT tin user, lỗi đầu vào → is_error', async () => {
    const { ng, kho } = taoNguCanhThu();
    const k = khachGia([
      () => luotGia([{ type: 'text', text: 'Để tôi khoá tòa rồi đọc trạng thái.' },
        { type: 'tool_use', id: 'tu1', name: 'lock_towers', input: { tower_ids: ['t1'], locked: true } },
        { type: 'tool_use', id: 'tu2', name: 'get_state', input: { gon: true } },
        { type: 'tool_use', id: 'tu3', name: 'update_tower', input: { tower_id: 't1', floors: 'nhiều' } }], 'tool_use'),
      (than) => {
        const cuoi = than.messages.at(-1)!;
        expect(cuoi.role).toBe('user');
        const kq = cuoi.content as Anthropic.Beta.BetaToolResultBlockParam[];
        expect(kq.map((x) => x.tool_use_id)).toEqual(['tu1', 'tu2', 'tu3']);
        expect(kq[0].is_error).toBeUndefined();
        expect(JSON.parse(kq[1].content as string).lo[0].toa[0].khoa).toBe(true); // công cụ 2 thấy kết quả công cụ 1
        expect(kq[2].is_error).toBe(true);
        return luotGia([{ type: 'text', text: 'Xong: tòa t1 đã khoá.' }], 'end_turn');
      },
    ]);
    const ls = hoi('khoá tòa');
    const r = await chayVong({ khach: k, moHinh: 'claude-opus-5-5', nghi: 'medium', lichSu: ls, ng, signal: new AbortController().signal, khiSuKien: () => {} });
    expect(r.lyDo).toBe('xong');
    expect(kho.soBuoc().truoc).toBe(1);
    expect(ls.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
  });

  it('refusal → dừng, không chạy công cụ', async () => {
    const { ng, kho } = taoNguCanhThu();
    const k = khachGia([() => luotGia([{ type: 'tool_use', id: 'x', name: 'delete_towers', input: { tower_ids: ['t1'] } }], 'refusal', { stop_details: { category: 'general_harms', explanation: 'không' } })]);
    const r = await chayVong({ khach: k, moHinh: 'claude-sonnet-5-5', nghi: 'low', lichSu: hoi('x'), ng, signal: new AbortController().signal, khiSuKien: () => {} });
    expect(r).toEqual({ lyDo: 'tu_choi', chiTiet: 'không' });
    expect(kho.lay().toa).toHaveLength(1);
  });

  it('max_tokens khi đang tool_use → không chạy công cụ dở, không nối lượt hỏng', async () => {
    const { ng, kho } = taoNguCanhThu();
    const k = khachGia([() => luotGia([{ type: 'tool_use', id: 'x', name: 'delete_towers', input: { tower_ids: ['t1'] } }], 'max_tokens')]);
    const ls = hoi('x');
    const r = await chayVong({ khach: k, moHinh: 'claude-haiku-5-5', nghi: 'low', lichSu: ls, ng, signal: new AbortController().signal, khiSuKien: () => {} });
    expect(r.lyDo).toBe('het_token');
    expect(kho.lay().toa).toHaveLength(1);
    expect(ls).toHaveLength(1);
  });

  it('Dừng giữa luồng → huy, lượt dở không vào lịch sử', async () => {
    const { ng } = taoNguCanhThu();
    const ac = new AbortController();
    const k = khachGia([(_t, s) => { ac.abort(); return luotGia([{ type: 'text', text: 'dở' }], 'end_turn', {}, s); }]);
    const ls = hoi('x');
    const r = await chayVong({ khach: k, moHinh: 'claude-sonnet-5-5', nghi: 'medium', lichSu: ls, ng, signal: ac.signal, khiSuKien: () => {} });
    expect(r.lyDo).toBe('huy');
    expect(ls).toHaveLength(1);
  });

  it('Dừng giữa các công cụ → công cụ còn lại trả is_error, lịch sử vẫn hợp lệ (mọi tool_use có tool_result)', async () => {
    const { ng, kho } = taoNguCanhThu();
    const ac = new AbortController();
    const ngDung = { ...ng, kho: { ...kho, sua: (fn: Parameters<typeof kho.sua>[0]) => { const r = kho.sua(fn); ac.abort(); return r; } } };
    const k = khachGia([() => luotGia([
      { type: 'tool_use', id: 'a', name: 'lock_towers', input: { tower_ids: ['t1'], locked: true } },
      { type: 'tool_use', id: 'b', name: 'lock_towers', input: { tower_ids: ['t1'], locked: false } }], 'tool_use')]);
    const ls = hoi('x');
    const r = await chayVong({ khach: k, moHinh: 'claude-sonnet-5-5', nghi: 'medium', lichSu: ls, ng: ngDung, signal: ac.signal, khiSuKien: () => {} });
    expect(r.lyDo).toBe('huy');
    const kq = ls.at(-1)!.content as Anthropic.Beta.BetaToolResultBlockParam[];
    expect(kq.map((x) => [x.tool_use_id, !!x.is_error])).toEqual([['a', false], ['b', true]]);
    expect(kho.lay().toa[0].khoa).toBe(true);
  });

  it('giới hạn số vòng', async () => {
    const { ng } = taoNguCanhThu();
    const lap = () => luotGia([{ type: 'tool_use', id: String(Math.random()), name: 'get_state', input: { gon: true } }], 'tool_use');
    const k = khachGia([lap, lap, lap]);
    const r = await chayVong({ khach: k, moHinh: 'claude-sonnet-5-5', nghi: 'medium', lichSu: hoi('x'), ng, signal: new AbortController().signal, khiSuKien: () => {}, toiDaVong: 3 });
    expect(r.lyDo).toBe('gioi_han_vong');
  });
});

describe('thân yêu cầu theo luật API', () => {
  it('adaptive thinking, effort đặt rõ, tool_choice auto, cache tools + system, eager streaming', () => {
    const t = taoThan('claude-opus-5-5', 'medium', hoi('x'));
    expect(t.thinking).toEqual({ type: 'adaptive', display: 'summarized' });
    expect(t.output_config).toEqual({ effort: 'medium' });
    expect(t.tool_choice).toEqual({ type: 'auto' });
    expect((t.system as { cache_control?: unknown }[])[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(t.cache_control).toEqual({ type: 'ephemeral' });
    expect(t.tools!.every((x) => (x as { eager_input_streaming?: boolean }).eager_input_streaming)).toBe(true);
    expect(JSON.stringify(t)).not.toMatch(/budget_tokens|"disabled"/);
  });
  it('Opus / Sonnet có server-side fallback; Haiku thì không', () => {
    for (const m of ['claude-opus-5-5', 'claude-sonnet-5-5'] as const) {
      const t = taoThan(m, 'high', hoi('x'));
      expect(t.betas).toEqual(['server-side-fallback-2026-07-01']);
      expect(t.fallbacks).toBe('default');
    }
    const h = taoThan('claude-haiku-5-5', 'low', hoi('x'));
    expect(h.betas).toBeUndefined();
    expect(h.fallbacks).toBeUndefined();
    expect(h.max_tokens).toBeLessThanOrEqual(8000);
  });
  it('tiền tố (system + tools) giống hệt giữa các lượt → cache khớp', () => {
    const a = taoThan('claude-sonnet-5-5', 'medium', hoi('a')), b = taoThan('claude-sonnet-5-5', 'medium', hoi('b'));
    expect(JSON.stringify([a.system, a.tools])).toBe(JSON.stringify([b.system, b.tools]));
  });
});

describe('gọn lịch sử', () => {
  it('dưới ngưỡng giữ nguyên; trên ngưỡng rút kết quả công cụ cũ + bỏ thinking', () => {
    const ls: TinNhan[] = [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: [{ type: 'thinking', thinking: 'x', signature: 's' }, { type: 'tool_use', id: '1', name: 'get_state', input: {} }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: '1', content: 'y'.repeat(5000) }] },
      { role: 'assistant', content: [{ type: 'text', text: 'ok' }] },
      { role: 'user', content: 'b' },
    ];
    expect(gonLichSu(ls)).toBe(ls);
    const g = gonLichSu(ls, 100, 2);
    expect((g[1].content as { type: string }[]).map((b) => b.type)).toEqual(['tool_use']);
    expect(((g[2].content as Anthropic.Beta.BetaToolResultBlockParam[])[0].content as string).length).toBeLessThan(400);
    expect(g.at(-1)).toEqual(ls.at(-1));
  });
});
