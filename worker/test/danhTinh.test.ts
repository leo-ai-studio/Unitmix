import { describe, expect, it } from 'vitest';
import { thuocMien, xacThucJwt, type KhoaCongKhai } from '../src/danhTinh';

const b64 = (b: ArrayBuffer | string) => {
  const u = typeof b === 'string' ? new TextEncoder().encode(b) : new Uint8Array(b);
  return btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const NOI_CAP = 'https://congty.cloudflareaccess.com';

async function taoKhoa(kid: string) {
  const cap = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const jwk = { ...(await crypto.subtle.exportKey('jwk', cap.publicKey)), kid } as KhoaCongKhai;
  const ky = async (tai: object, dau: object = { alg: 'RS256', kid }) => {
    const m = `${b64(JSON.stringify(dau))}.${b64(JSON.stringify(tai))}`;
    return `${m}.${b64(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cap.privateKey, new TextEncoder().encode(m)))}`;
  };
  return { jwk, ky };
}

describe('xác thực JWT Cloudflare Access', () => {
  const bay = 1_800_000_000;
  const tai = (them: object = {}) => ({ email: 'An@MeyGroup.vn', exp: bay + 600, aud: ['AUD1'], iss: NOI_CAP, ...them });

  it('hợp lệ → trả mail chữ thường', async () => {
    const { jwk, ky } = await taoKhoa('k1');
    expect(await xacThucJwt(await ky(tai()), [jwk], 'AUD1', NOI_CAP, bay)).toBe('an@meygroup.vn');
  });
  it('sai chữ ký / hết hạn / sai audience / sai nơi cấp / sai thuật toán / không có khoá → null', async () => {
    const { jwk, ky } = await taoKhoa('k1');
    const khac = await taoKhoa('k1');
    expect(await xacThucJwt(await khac.ky(tai()), [jwk], 'AUD1', NOI_CAP, bay)).toBeNull();
    expect(await xacThucJwt(await ky(tai({ exp: bay - 1 })), [jwk], 'AUD1', NOI_CAP, bay)).toBeNull();
    expect(await xacThucJwt(await ky(tai()), [jwk], 'AUD2', NOI_CAP, bay)).toBeNull();
    expect(await xacThucJwt(await ky(tai({ iss: 'https://khac.cloudflareaccess.com' })), [jwk], 'AUD1', NOI_CAP, bay)).toBeNull();
    expect(await xacThucJwt(await ky(tai(), { alg: 'none', kid: 'k1' }), [jwk], 'AUD1', NOI_CAP, bay)).toBeNull();
    expect(await xacThucJwt(await ky(tai()), [], 'AUD1', NOI_CAP, bay)).toBeNull();
    expect(await xacThucJwt('rac.roi', [jwk], 'AUD1', NOI_CAP, bay)).toBeNull();
  });
});

describe('miền được tạo dự án', () => {
  it('trống = không giới hạn; có miền thì chỉ mail đúng miền', () => {
    expect(thuocMien(null, undefined)).toBe(true);
    expect(thuocMien(null, 'meygroup.vn')).toBe(false);
    expect(thuocMien('an@meygroup.vn', 'meygroup.vn')).toBe(true);
    expect(thuocMien('an@meygroup.vn', '@MeyGroup.vn')).toBe(true);
    expect(thuocMien('an@evilmeygroup.vn', 'meygroup.vn')).toBe(false);
    expect(thuocMien('an@gmail.com', 'meygroup.vn')).toBe(false);
  });
});
