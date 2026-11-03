/**
 * Khách cho nhà cung cấp KHÔNG phải Claude (Ollama, LM Studio, Gemini, OpenAI, OpenRouter…): mọi nơi có API kiểu OpenAI
 * `POST {url}/chat/completions`. Vòng tác tử (vongLap.ts) vẫn nói định dạng Anthropic, nên ở đây dịch hai chiều:
 * yêu cầu Messages → Chat Completions, luồng SSE chunk → sự kiện Anthropic (chữ, tool_use) + bản cuối.
 * Khoá lưu ở localStorage trình duyệt này, gọi thẳng nhà cung cấp (không qua máy chủ Unitmix). Bỏ qua phần chỉ Claude có:
 * thinking, cache_control, fallbacks, output_config; PDF không gửi được.
 */
import type { KhachClaude, LuongClaude, ThanYeuCau } from './vongLap';

export type NhaKhac = {
  /** bật = Leo AI dùng nhà cung cấp này thay Claude */
  dung: boolean;
  /** id mẫu trong `MAU_NHA_KHAC` ('tuy_chinh' = tự nhập URL) */
  mau: string;
  /** địa chỉ gốc, VD http://localhost:11434/v1 (không kèm /chat/completions) */
  url: string;
  khoa: string;
  moHinh: string;
  /** cho gửi công cụ (tool calling); tắt cho mô hình nhỏ không gọi được công cụ → chỉ trả lời chữ */
  congCu: boolean;
};

export const MAU_NHA_KHAC: { id: string; ten: string; url: string; goiY: string; canKhoa: boolean }[] = [
  { id: 'ollama', ten: 'Ollama (trên máy)', url: 'http://localhost:11434/v1', goiY: 'qwen3:8b', canKhoa: false },
  { id: 'lmstudio', ten: 'LM Studio (trên máy)', url: 'http://localhost:1234/v1', goiY: '', canKhoa: false },
  { id: 'gemini', ten: 'Google Gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai', goiY: 'gemini-2.5-flash', canKhoa: true },
  { id: 'openai', ten: 'OpenAI', url: 'https://api.openai.com/v1', goiY: 'gpt-4.1-mini', canKhoa: true },
  { id: 'openrouter', ten: 'OpenRouter', url: 'https://openrouter.ai/api/v1', goiY: '', canKhoa: true },
  { id: 'tuy_chinh', ten: 'Tự nhập địa chỉ', url: '', goiY: '', canKhoa: true },
];

export const NHA_KHAC_MAC_DINH: NhaKhac = { dung: false, mau: 'ollama', url: MAU_NHA_KHAC[0].url, khoa: '', moHinh: '', congCu: true };

const KHOA_LUU = 'unitmix.leoAi.nhaKhac';

export function docNhaKhac(): NhaKhac {
  try {
    const v = JSON.parse(localStorage.getItem(KHOA_LUU) ?? '{}') as Partial<NhaKhac>;
    const s = (x: unknown, md: string) => (typeof x === 'string' ? x : md);
    return {
      dung: v.dung === true,
      mau: s(v.mau, NHA_KHAC_MAC_DINH.mau),
      url: s(v.url, NHA_KHAC_MAC_DINH.url),
      khoa: s(v.khoa, ''),
      moHinh: s(v.moHinh, ''),
      congCu: v.congCu !== false,
    };
  } catch { return { ...NHA_KHAC_MAC_DINH }; }
}
export function ghiNhaKhac(c: NhaKhac) {
  try { localStorage.setItem(KHOA_LUU, JSON.stringify(c)); } catch { /* chặn lưu: chỉ trong phiên */ }
}
/** đủ thông tin để gọi: bật + có địa chỉ + có tên mô hình */
export const nhaKhacDungDuoc = (c: NhaKhac) => c.dung && !!c.url.trim() && !!c.moHinh.trim();

/** Lỗi từ nhà cung cấp khác, đã kèm câu tiếng Việt cho người dùng (`loiTiengViet` trả nguyên `chuViet`). */
export class LoiNhaKhac extends Error {
  chuViet: string;
  constructor(public status: number, chiTiet: string, url: string) {
    super(`Nhà cung cấp trả ${status}: ${chiTiet}`);
    this.name = 'LoiNhaKhac';
    const ct = chiTiet.trim().slice(0, 240);
    this.chuViet = status === 0
      ? `Không nối được tới ${url} — kiểm tra máy chủ đang chạy và địa chỉ đúng. Với Ollama, đặt biến OLLAMA_ORIGINS cho phép trang này gọi (VD OLLAMA_ORIGINS=*).`
      : status === 401 || status === 403 ? 'Khoá API không hợp lệ hoặc không có quyền dùng mô hình này — kiểm tra lại trong Cài đặt Leo AI.'
      : status === 404 ? 'Không tìm thấy mô hình hoặc địa chỉ — kiểm tra tên mô hình và địa chỉ gốc (thường kết thúc bằng /v1).'
      : status === 429 ? 'Hết lượt hoặc vượt giới hạn tốc độ của nhà cung cấp (bậc miễn phí hay gặp) — đợi một lát hoặc đổi mô hình.'
      : status >= 500 ? `Máy chủ nhà cung cấp đang lỗi (${status}) — thử lại sau.`
      : `Nhà cung cấp từ chối yêu cầu (${status}): ${ct}${/tool|function/i.test(ct) ? ' — mô hình này có thể không hỗ trợ công cụ, thử tắt "Cho phép công cụ" trong Cài đặt.' : ''}`;
  }
}

type Khoi = { type: string; [k: string]: unknown };
type TinOA = { role: 'system' | 'user' | 'assistant' | 'tool'; content?: unknown; tool_calls?: unknown[]; tool_call_id?: string };

const chuTuKetQua = (c: unknown): string => {
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return (c as Khoi[]).map((b) => (b.type === 'text' ? String(b.text ?? '') : '')).filter(Boolean).join('\n');
  return '';
};

/** Yêu cầu Messages (Anthropic) → thân Chat Completions. Xuất để test. */
export function dichYeuCau(than: ThanYeuCau, cfg: NhaKhac) {
  const messages: TinOA[] = [];
  const he = Array.isArray(than.system) ? than.system.map((b) => b.text).join('\n\n') : (than.system ?? '');
  if (he) messages.push({ role: 'system', content: he });
  for (const m of than.messages) {
    const khoi: Khoi[] = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : (m.content as unknown as Khoi[]);
    if (m.role === 'user') {
      for (const b of khoi) if (b.type === 'tool_result') messages.push({ role: 'tool', tool_call_id: String(b.tool_use_id), content: chuTuKetQua(b.content) || '(trống)' });
      const phan: unknown[] = [];
      for (const b of khoi) {
        if (b.type === 'text') phan.push({ type: 'text', text: String(b.text ?? '') });
        else if (b.type === 'image') {
          const nguon = b.source as { type?: string; media_type?: string; data?: string; url?: string } | undefined;
          const url = nguon?.type === 'base64' ? `data:${nguon.media_type};base64,${nguon.data}` : nguon?.url;
          if (url) phan.push({ type: 'image_url', image_url: { url } });
        } else if (b.type === 'document') phan.push({ type: 'text', text: '[Tệp PDF đính kèm — nhà cung cấp này không nhận được tệp PDF]' });
      }
      if (phan.length) messages.push({ role: 'user', content: phan.length === 1 && (phan[0] as Khoi).type === 'text' ? (phan[0] as Khoi).text : phan });
    } else {
      const chu = khoi.filter((b) => b.type === 'text').map((b) => String(b.text ?? '')).join('');
      const goi = khoi.filter((b) => b.type === 'tool_use').map((b) => ({ id: String(b.id), type: 'function', function: { name: String(b.name), arguments: JSON.stringify(b.input ?? {}) } }));
      if (!chu && !goi.length) continue; // lượt rỗng làm nhiều nhà cung cấp trả 400
      messages.push({ role: 'assistant', content: goi.length && !chu ? null : chu, ...(goi.length ? { tool_calls: goi } : {}) });
    }
  }
  const dc = (than.tools ?? []) as unknown as { name: string; description?: string; input_schema?: unknown }[];
  return {
    model: cfg.moHinh.trim(),
    messages,
    stream: true,
    stream_options: { include_usage: true },
    max_tokens: Math.min(than.max_tokens, 8192),
    ...(cfg.congCu && dc.length ? { tools: dc.map((c) => ({ type: 'function', function: { name: c.name, description: c.description ?? '', parameters: c.input_schema ?? { type: 'object', properties: {} } } })) } : {}),
  };
}

type Chunk = {
  id?: string;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
  choices?: { finish_reason?: string | null; delta?: { content?: string | null; reasoning_content?: string | null; reasoning?: string | null; tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[] } }[];
};

export function taoKhachKhac(cfg: NhaKhac, goi: typeof fetch = (...a) => fetch(...a)): KhachClaude {
  const goc = cfg.url.trim().replace(/\/+$/, '');
  return {
    luong(than, { signal }) {
      let xong!: (m: never) => void;
      let hong!: (e: unknown) => void;
      const cuoi = new Promise<never>((ok, no) => { xong = ok; hong = no; });
      cuoi.catch(() => undefined); // lỗi đã ném ở vòng lặp; tránh báo "unhandled"

      async function* chay() {
        try {
          let res: Response;
          try {
            res = await goi(`${goc}/chat/completions`, {
              method: 'POST', signal,
              headers: { 'Content-Type': 'application/json', ...(cfg.khoa.trim() ? { Authorization: `Bearer ${cfg.khoa.trim()}` } : {}) },
              body: JSON.stringify(dichYeuCau(than, cfg)),
            });
          } catch (e) {
            if (signal.aborted || (e instanceof Error && e.name === 'AbortError')) throw e;
            throw new LoiNhaKhac(0, e instanceof Error ? e.message : String(e), goc);
          }
          if (!res.ok || !res.body) throw new LoiNhaKhac(res.status, await res.text().catch(() => ''), goc);

          let chu = '';
          let ketThuc: string | null = null;
          let dungLuong = { input: 0, output: 0 };
          let idMsg = '';
          const goiCu = new Map<number, { id: string; ten: string; args: string }>();
          const doc = res.body.getReader();
          const giaiMa = new TextDecoder();
          let dem = '';
          for (;;) {
            const { done, value } = await doc.read();
            if (done) break;
            dem += giaiMa.decode(value, { stream: true });
            let nl: number;
            while ((nl = dem.indexOf('\n')) >= 0) {
              const dong = dem.slice(0, nl).trim();
              dem = dem.slice(nl + 1);
              if (!dong.startsWith('data:')) continue;
              const tai = dong.slice(5).trim();
              if (!tai || tai === '[DONE]') continue;
              let c: Chunk;
              try { c = JSON.parse(tai) as Chunk; } catch { continue; }
              if (c.id && !idMsg) idMsg = c.id;
              if (c.usage) dungLuong = { input: c.usage.prompt_tokens ?? 0, output: c.usage.completion_tokens ?? 0 };
              const ch = c.choices?.[0];
              if (!ch) continue;
              if (ch.finish_reason) ketThuc = ch.finish_reason;
              const d = ch.delta;
              if (!d) continue;
              const nghi = d.reasoning_content ?? d.reasoning;
              if (nghi) yield { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: nghi } } as never;
              if (d.content) { chu += d.content; yield { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: d.content } } as never; }
              for (const tc of d.tool_calls ?? []) {
                const i = tc.index ?? 0;
                let e = goiCu.get(i);
                if (!e) {
                  e = { id: tc.id || `goi_${i}_${Date.now().toString(36)}`, ten: '', args: '' };
                  goiCu.set(i, e);
                  e.ten = tc.function?.name ?? '';
                  yield { type: 'content_block_start', index: i + 1, content_block: { type: 'tool_use', id: e.id, name: e.ten, input: {} } } as never;
                } else if (tc.function?.name) e.ten += tc.function.name;
                if (tc.function?.arguments) e.args += tc.function.arguments;
              }
            }
          }

          const dsGoi = [...goiCu.entries()].sort((a, b) => a[0] - b[0]).map(([, e]) => e);
          const noiDung: unknown[] = [
            ...(chu ? [{ type: 'text', text: chu }] : []),
            ...dsGoi.map((e) => {
              let input: unknown = {};
              try { input = e.args.trim() ? JSON.parse(e.args) : {}; } catch { /* đầu vào dở dang: công cụ sẽ báo thiếu tham số */ }
              return { type: 'tool_use', id: e.id, name: e.ten, input };
            }),
          ];
          xong({
            id: idMsg || `nk_${Date.now().toString(36)}`, type: 'message', role: 'assistant', model: cfg.moHinh,
            content: noiDung, stop_reason: dsGoi.length ? 'tool_use' : ketThuc === 'length' ? 'max_tokens' : ketThuc === 'content_filter' ? 'refusal' : 'end_turn',
            stop_sequence: null,
            usage: { input_tokens: dungLuong.input, output_tokens: dungLuong.output, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
          } as never);
        } catch (e) { hong(e); throw e; }
      }
      return { [Symbol.asyncIterator]: () => chay(), finalMessage: () => cuoi } as unknown as LuongClaude;
    },
  };
}
