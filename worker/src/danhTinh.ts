/**
 * Danh tính người dùng qua Cloudflare Access (đăng nhập bằng mail công ty): đọc JWT `Cf-Access-Jwt-Assertion` / cookie
 * `CF_Authorization`, kiểm chữ ký RS256 bằng khoá công khai của team, hạn dùng, audience và nơi cấp.
 * Chưa đặt `CF_ACCESS_TEAM` + `CF_ACCESS_AUD` thì tắt hẳn (ai cũng như khách, không chặn gì). `MIEN_TAO_DA` (vd "meygroup.vn")
 * bật yêu cầu: chỉ mail thuộc miền đó mới được tạo / nhân bản dự án. Xem docs/dang_nhap_cloudflare.md.
 */
export type EnvDanhTinh = { CF_ACCESS_TEAM?: string; CF_ACCESS_AUD?: string; MIEN_TAO_DA?: string };

export type KhoaCongKhai = JsonWebKey & { kid?: string };
type Thanh = { alg?: string; kid?: string };
type Tai = { email?: string; exp?: number; nbf?: number; aud?: string | string[]; iss?: string };

const gb64 = (s: string): Uint8Array => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
const docJson = <T>(s: string): T => JSON.parse(new TextDecoder().decode(gb64(s))) as T;

/** Kiểm một JWT Access; trả mail (chữ thường) nếu hợp lệ, ngược lại null. `bayGio` tính bằng giây. */
export async function xacThucJwt(
  token: string, khoa: KhoaCongKhai[], aud: string, noiCap: string, bayGio = Date.now() / 1000,
): Promise<string | null> {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) return null;
  try {
    const dau = docJson<Thanh>(h);
    if (dau.alg !== 'RS256') return null;
    const tai = docJson<Tai>(p);
    const k = khoa.find((x) => x.kid === dau.kid);
    if (!k) return null;
    const key = await crypto.subtle.importKey('jwk', k, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, gb64(s), new TextEncoder().encode(`${h}.${p}`));
    if (!ok) return null;
    if (!tai.exp || tai.exp <= bayGio || (tai.nbf && tai.nbf > bayGio + 60)) return null;
    if (tai.iss !== noiCap || !(Array.isArray(tai.aud) ? tai.aud : [tai.aud]).includes(aud)) return null;
    return tai.email ? tai.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

let boNho: { team: string; han: number; khoa: KhoaCongKhai[] } | null = null;
async function khoaTeam(team: string, goi: typeof fetch): Promise<KhoaCongKhai[]> {
  if (boNho && boNho.team === team && boNho.han > Date.now()) return boNho.khoa;
  const r = await goi(`https://${team}.cloudflareaccess.com/cdn-cgi/access/certs`);
  if (!r.ok) return boNho?.khoa ?? [];
  const khoa = ((await r.json()) as { keys?: KhoaCongKhai[] }).keys ?? [];
  boNho = { team, han: Date.now() + 3_600_000, khoa };
  return khoa;
}

const layCookie = (c: string | null, ten: string) => c?.split(/;\s*/).find((x) => x.startsWith(ten + '='))?.slice(ten.length + 1) ?? null;

/** Mail đã đăng nhập qua Access, hoặc null (chưa bật Access / chưa đăng nhập / JWT sai). */
export async function docDanhTinh(req: Request, env: EnvDanhTinh, goi: typeof fetch = fetch): Promise<string | null> {
  if (!env.CF_ACCESS_TEAM || !env.CF_ACCESS_AUD) return null;
  const token = req.headers.get('Cf-Access-Jwt-Assertion') ?? layCookie(req.headers.get('Cookie'), 'CF_Authorization');
  if (!token) return null;
  return xacThucJwt(token, await khoaTeam(env.CF_ACCESS_TEAM, goi), env.CF_ACCESS_AUD, `https://${env.CF_ACCESS_TEAM}.cloudflareaccess.com`);
}

/** Mail có thuộc miền được tạo dự án không (`MIEN_TAO_DA` trống = không giới hạn). */
export const thuocMien = (email: string | null, mien?: string): boolean =>
  !mien || (!!email && email.endsWith('@' + mien.trim().replace(/^@/, '').toLowerCase()));
