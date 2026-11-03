import { describe, expect, it } from 'vitest';
import { dichYeuCau, LoiNhaKhac, NHA_KHAC_MAC_DINH, taoKhachKhac, type NhaKhac } from './khachKhac';
import type { ThanYeuCau } from './vongLap';

const cfg: NhaKhac = { ...NHA_KHAC_MAC_DINH, dung: true, url: 'http://localhost:11434/v1/', moHinh: 'qwen3:8b' };

const than = {
  model: 'claude-sonnet-5-5', max_tokens: 16000,
  system: [{ type: 'text', text: 'He thong' }],
  tools: [{ name: 'doc_tmb', description: 'Doc TMB', input_schema: { type: 'object', properties: { a: { type: 'string' } } } }],
  messages: [
    { role: 'user', content: [{ type: 'text', text: 'Xin chao' }] },
    { role: 'assistant', content: [{ type: 'thinking', thinking: 'x', signature: 's' }, { type: 'text', text: 'Dang doc' }, { type: 'tool_use', id: 't1', name: 'doc_tmb', input: { a: '1' } }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ket qua' }, { type: 'text', text: 'tiep' }] },
  ],
} as unknown as ThanYeuCau;

const sse = (...chunks: unknown[]) => new Response(chunks.map((c) => `data: ${typeof c === 'string' ? c : JSON.stringify(c)}\n\n`).join(''), { status: 200 });

async function chay(res: Response, c: NhaKhac = cfg) {
  const cuoc: { url?: string; body?: Record<string, unknown>; auth?: string } = {};
  const k = taoKhachKhac(c, (async (url: string, init: RequestInit) => {
    cuoc.url = url; cuoc.body = JSON.parse(init.body as string); cuoc.auth = (init.headers as Record<string, string>).Authorization;
    return res;
  }) as unknown as typeof fetch);
  const l = k.luong(than, { signal: new AbortController().signal });
  const sk: { type: string; [x: string]: unknown }[] = [];
  for await (const e of l) sk.push(e as never);
  return { cuoc, sk, msg: await l.finalMessage() };
}

describe('dichYeuCau', () => {
  it('dịch system, lịch sử, công cụ; bỏ thinking', () => {
    const b = dichYeuCau(than, cfg) as { messages: { role: string; content?: unknown; tool_calls?: { id: string; function: { arguments: string } }[]; tool_call_id?: string }[]; tools: { function: { name: string } }[]; max_tokens: number; model: string };
    expect(b.model).toBe('qwen3:8b');
    expect(b.max_tokens).toBe(8192);
    expect(b.messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'tool', 'user']);
    expect(b.messages[2].content).toBe('Dang doc');
    expect(b.messages[2].tool_calls![0]).toMatchObject({ id: 't1', function: { arguments: '{"a":"1"}' } });
    expect(b.messages[3]).toMatchObject({ tool_call_id: 't1', content: 'ket qua' });
    expect(b.tools[0].function.name).toBe('doc_tmb');
  });
  it('tắt công cụ thì không gửi tools', () => {
    expect('tools' in dichYeuCau(than, { ...cfg, congCu: false })).toBe(false);
  });
});

describe('taoKhachKhac', () => {
  it('chảy chữ + bản cuối end_turn, gọi đúng URL, có Bearer khi có khoá', async () => {
    const r = await chay(sse(
      { id: 'a', choices: [{ delta: { content: 'Xin ' } }] },
      { choices: [{ delta: { content: 'chào' }, finish_reason: 'stop' }] },
      { choices: [], usage: { prompt_tokens: 5, completion_tokens: 2 } },
      '[DONE]',
    ), { ...cfg, khoa: 'k1' });
    expect(r.cuoc.url).toBe('http://localhost:11434/v1/chat/completions');
    expect(r.cuoc.auth).toBe('Bearer k1');
    expect(r.sk.filter((e) => e.type === 'content_block_delta').map((e) => (e.delta as { text: string }).text).join('')).toBe('Xin chào');
    expect(r.msg.stop_reason).toBe('end_turn');
    expect(r.msg.content).toEqual([{ type: 'text', text: 'Xin chào' }]);
    expect(r.msg.usage.output_tokens).toBe(2);
  });
  it('gộp tool_call chảy từng mảnh thành tool_use', async () => {
    const r = await chay(sse(
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'doc_tmb', arguments: '{"a":' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"1"}' } }] }, finish_reason: 'tool_calls' }] },
    ));
    expect(r.sk[0]).toMatchObject({ type: 'content_block_start', content_block: { type: 'tool_use', id: 'c1', name: 'doc_tmb' } });
    expect(r.msg.stop_reason).toBe('tool_use');
    expect(r.msg.content).toEqual([{ type: 'tool_use', id: 'c1', name: 'doc_tmb', input: { a: '1' } }]);
  });
  it('mô hình tự sinh id khi thiếu; đầu vào hỏng → {}', async () => {
    const r = await chay(sse({ choices: [{ delta: { tool_calls: [{ function: { name: 'x', arguments: '{"a' } }] }, finish_reason: 'stop' }] }));
    const b = (r.msg.content as { id: string; input: unknown }[])[0];
    expect(b.id).toMatch(/^goi_0_/);
    expect(b.input).toEqual({});
    expect(r.msg.stop_reason).toBe('tool_use');
  });
  it('finish_reason length → max_tokens', async () => {
    const r = await chay(sse({ choices: [{ delta: { content: 'a' }, finish_reason: 'length' }] }));
    expect(r.msg.stop_reason).toBe('max_tokens');
  });
  it('HTTP 429 → LoiNhaKhac có câu tiếng Việt', async () => {
    const k = taoKhachKhac(cfg, (async () => new Response('quota', { status: 429 })) as unknown as typeof fetch);
    const l = k.luong(than, { signal: new AbortController().signal });
    await expect((async () => { for await (const _ of l) void _; })()).rejects.toBeInstanceOf(LoiNhaKhac);
    await expect(l.finalMessage()).rejects.toMatchObject({ status: 429 });
  });
  it('không nối được → status 0, nhắc OLLAMA_ORIGINS', async () => {
    const k = taoKhachKhac(cfg, (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch);
    const l = k.luong(than, { signal: new AbortController().signal });
    const e = await (async () => { try { for await (const _ of l) void _; } catch (x) { return x as LoiNhaKhac; } })();
    expect(e?.status).toBe(0);
    expect(e?.chuViet).toContain('OLLAMA_ORIGINS');
  });
});
