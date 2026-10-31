/**
 * TRẠM CHUYỂN Leo AI cho ĐIỆN THOẠI. Leo AI dùng tài khoản Claude trên MÁY TÍNH qua cầu scripts/cau_claude.py (127.0.0.1); điện
 * thoại không tới được 127.0.0.1 của máy tính. Cầu TỰ NỐI RA (WebSocket) tới trạm này trên chính Worker của app; điện thoại gọi trạm
 * bằng https cùng nguồn với trang. Không mở cổng nào trên máy tính, địa chỉ cố định → ghép MỘT lần (mở link có mã) là xong.
 *
 * Mã ghép: cầu sinh khoá ngẫu nhiên 32 byte (LeoUnitmix/ghep.json). Trạm KHÔNG lưu khoá: tên Durable Object = SHA-256(khoá), ai không
 * có khoá thì không tìm ra phòng. Cầu và điện thoại cùng trình khoá đó ở header X-Leo-Khoa.
 *
 *   GET  /api/tram/cau   (Upgrade: websocket)  → cầu nối vào phòng; mỗi phòng một cầu (cầu mới đá cầu cũ)
 *   POST /api/tram/hoi   {duong: "/suc-khoe" | "/v1/messages", than}  → {ma_http, than, loai} khi xong trong 25 s, hoặc {ma} chờ tiếp
 *   GET  /api/tram/kq?ma=…  → {ma_http, than, loai} · 204 = còn đang chạy (hỏi lại) · 404 = không có / hết hạn
 *   cầu → trạm (tin WebSocket): {ma, ma_http, than, loai}   ·   trạm → cầu: {ma, duong, than}   ·   "ping" → "pong" (không đánh thức)
 *
 * Durable Object dùng WebSocket ngủ đông: lúc không ai hỏi, phòng ngủ, không tính thời gian chạy. Kết quả lưu storage (ngủ đông xoá
 * bộ nhớ), xoá khi điện thoại đã lấy hoặc quá 15 phút. `than` của /v1/messages là luồng SSE đã gom đủ (cầu trả sau khi Claude xong).
 */
import { DurableObject } from 'cloudflare:workers';

export type EnvTram = {
  TRAM: DurableObjectNamespace<Tram>;
  /** ms một lần chờ kết quả (mặc định 25000; test đặt nhỏ) */
  TRAM_CHO_MS?: string;
};

const CHO_MS = 25_000; // dưới trần ~100 s của proxy
const HET_HAN_MS = 15 * 60_000; // kết quả không ai lấy
const TRAN_PHUT = 30; // ≤ 30 câu / phút / phòng
const TRAN_THAN = 20 * 1_048_576;
const DUONG_OK = new Set(['/suc-khoe', '/v1/messages']);

type Kq = { ma_http: number; than: string; loai: string; t: number };

const json = (o: unknown, ma = 200) =>
  new Response(JSON.stringify(o), { status: ma, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

async function tenPhong(khoa: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(khoa));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Cổng vào: kiểm dạng mã ghép rồi chuyển tới phòng của mã đó. */
export async function xuLyTram(req: Request, env: EnvTram): Promise<Response> {
  const khoa = req.headers.get('X-Leo-Khoa') ?? '';
  if (!/^[A-Za-z0-9_-]{32,100}$/.test(khoa)) return json({ loi: 'thiếu hoặc sai mã ghép', ma: 'sai_khoa' }, 401);
  return env.TRAM.get(env.TRAM.idFromName(await tenPhong(khoa))).fetch(req);
}

export class Tram extends DurableObject<EnvTram> {
  /** ma → người đang chờ kết quả (chỉ sống khi phòng thức) */
  private cho = new Map<string, ((kq: Kq | null) => void)[]>();

  constructor(ctx: DurableObjectState, env: EnvTram) {
    super(ctx, env);
    // "ping" của cầu được trả "pong" tại biên Cloudflare, không đánh thức phòng
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  private choMs = () => Number(this.env.TRAM_CHO_MS) || CHO_MS;
  private cau = () => this.ctx.getWebSockets('cau')[0] ?? null;

  async fetch(req: Request): Promise<Response> {
    const u = new URL(req.url);
    if (u.pathname === '/api/tram/cau') {
      if (req.headers.get('Upgrade') !== 'websocket') return json({ loi: 'cần WebSocket' }, 426);
      for (const cu of this.ctx.getWebSockets('cau')) { try { cu.close(4000, 'cau moi'); } catch { /* đã đóng */ } }
      const [khach, chu] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(chu, ['cau']);
      return new Response(null, { status: 101, webSocket: khach });
    }
    if (u.pathname === '/api/tram/hoi' && req.method === 'POST') return this.hoi(req);
    if (u.pathname === '/api/tram/kq' && req.method === 'GET') return this.kq(u.searchParams.get('ma') ?? '');
    return json({ loi: 'không có' }, 404);
  }

  private async hoi(req: Request): Promise<Response> {
    const tho = await req.text();
    if (tho.length > TRAN_THAN) return json({ loi: 'câu hỏi quá lớn (ảnh?)', ma: 'qua_lon' }, 413);
    let d: { duong?: string; than?: unknown };
    try { d = JSON.parse(tho); } catch { return json({ loi: 'JSON hỏng' }, 400); }
    if (!d.duong || !DUONG_OK.has(d.duong)) return json({ loi: 'không có' }, 404);
    const ws = this.cau();
    if (!ws) return json({ loi: 'Máy tính chưa nối: máy đang tắt, ngủ, hoặc chưa chạy cầu AI', ma: 'may_tat' }, 503);
    if (d.duong === '/v1/messages') {
      const bay = Date.now();
      const dem = ((await this.ctx.storage.get<number[]>('dem')) ?? []).filter((t) => bay - t < 60_000);
      if (dem.length >= TRAN_PHUT) return json({ loi: `quá ${TRAN_PHUT} câu / phút — chờ một lát`, ma: 'rate_limited' }, 429);
      dem.push(bay);
      await this.ctx.storage.put('dem', dem);
    }
    const ma = crypto.randomUUID();
    await this.ctx.storage.put('dang:' + ma, Date.now());
    await this.hen();
    try { ws.send(JSON.stringify({ ma, duong: d.duong, than: d.than == null ? null : String(d.than) })); } catch {
      await this.ctx.storage.delete('dang:' + ma);
      return json({ loi: 'Máy tính vừa mất nối — thử lại', ma: 'may_tat' }, 503);
    }
    return this.doi(ma, true);
  }

  private kq(ma: string): Promise<Response> | Response {
    if (!/^[0-9a-f-]{36}$/.test(ma)) return json({ loi: 'không có' }, 404);
    return this.doi(ma, false);
  }

  /** Chờ kết quả của `ma` tối đa choMs: có → {ma_http, than, loai}; chưa → {ma} (lần đầu) / 204 (lần hỏi lại). */
  private async doi(ma: string, lanDau: boolean): Promise<Response> {
    const co = await this.ctx.storage.get<Kq>('kq:' + ma);
    if (co) { await this.ctx.storage.delete('kq:' + ma); return json({ ma_http: co.ma_http, than: co.than, loai: co.loai }); }
    if (!lanDau && !(await this.ctx.storage.get('dang:' + ma))) return json({ loi: 'không có hoặc đã hết hạn', ma: 'het_han' }, 404);
    const kq = await new Promise<Kq | null>((xong) => {
      const ds = this.cho.get(ma) ?? [];
      ds.push(xong);
      this.cho.set(ma, ds);
      // hết giờ chờ: gỡ người chờ khỏi danh sách — còn sót thì kết quả đến sau bị coi là "có người nhận" và mất
      setTimeout(() => {
        const con = (this.cho.get(ma) ?? []).filter((x) => x !== xong);
        if (con.length) this.cho.set(ma, con); else this.cho.delete(ma);
        xong(null);
      }, this.choMs());
    });
    if (!kq) return lanDau ? json({ ma }) : new Response(null, { status: 204 });
    await this.ctx.storage.delete('kq:' + ma);
    return json({ ma_http: kq.ma_http, than: kq.than, loai: kq.loai });
  }

  async webSocketMessage(_ws: WebSocket, tin: string | ArrayBuffer): Promise<void> {
    if (typeof tin !== 'string' || tin === 'ping') return;
    let d: { ma?: unknown; ma_http?: unknown; than?: unknown; loai?: unknown };
    try { d = JSON.parse(tin); } catch { return; }
    if (typeof d.ma !== 'string' || !(await this.ctx.storage.get('dang:' + d.ma))) return; // mã lạ / đã hết hạn
    const kq: Kq = { ma_http: Number(d.ma_http) || 502, than: d.than == null ? '' : String(d.than), loai: typeof d.loai === 'string' ? d.loai : 'application/json', t: Date.now() };
    await this.ctx.storage.delete('dang:' + d.ma);
    const ds = this.cho.get(d.ma);
    this.cho.delete(d.ma);
    if (ds?.length) ds.forEach((x) => x(kq));
    else await this.ctx.storage.put('kq:' + d.ma, kq);
    await this.hen();
  }

  private async hen() {
    if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + HET_HAN_MS);
  }

  /** Kết quả không ai lấy (điện thoại đóng giữa chừng) và việc treo quá 15 phút: xoá; còn gì thì hẹn lần sau. */
  async alarm(): Promise<void> {
    const bay = Date.now();
    let con = 0;
    const xoa: string[] = [];
    for (const [k, v] of await this.ctx.storage.list<number>({ prefix: 'dang:' })) { if (bay - v > HET_HAN_MS) xoa.push(k); else con++; }
    for (const [k, v] of await this.ctx.storage.list<Kq>({ prefix: 'kq:' })) { if (bay - v.t > HET_HAN_MS) xoa.push(k); else con++; }
    if (xoa.length) await this.ctx.storage.delete(xoa);
    if (con) await this.ctx.storage.setAlarm(bay + HET_HAN_MS);
  }

  webSocketClose(ws: WebSocket, ma: number): void { try { ws.close(ma, 'dong'); } catch { /* đã đóng */ } }
  webSocketError(): void { /* cầu rớt: phòng tự thấy getWebSockets rỗng ở lần hỏi sau */ }
}
