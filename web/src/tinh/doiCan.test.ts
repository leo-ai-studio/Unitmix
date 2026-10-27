import { describe, expect, it } from 'vitest';
import { apDoiViTri, doiCanTaiViTri, veMauGoc } from './doiCan';
import { canDangDung, type ViTriCan } from './matBang';

const vt = (khoa: string, canGocId: string): ViTriCan => ({ khoa, matIdx: 0, canGocId, a0: 0, a1: 1, sau: 1, guong: false, goc: [[0, 0], [1, 0], [1, 1], [0, 1]] });
const vts = [vt('0:0', 'A'), vt('0:1', 'B'), vt('0:2', 'A')];
const toa0 = { canTheo: {} as Record<string, string>, canViTri: undefined as Record<string, string> | undefined };
const dang = (t: typeof toa0) => vts.map((v) => canDangDung(v, t));

describe('đổi căn tại vị trí', () => {
  it('chỉ một vị trí: các căn cùng mẫu khác giữ nguyên', () => {
    const t = doiCanTaiViTri(toa0, vts[0], 'X', vts, false);
    expect(dang(t)).toEqual(['X', 'B', 'A']);
    expect(t.canTheo).toEqual({});
  });
  it('sửa nhiều căn: đổi mọi căn cùng mẫu gốc và xoá đổi theo vị trí của chúng', () => {
    const t1 = doiCanTaiViTri(toa0, vts[2], 'Y', vts, false);
    const t2 = doiCanTaiViTri(t1, vts[0], 'X', vts, true);
    expect(dang(t2)).toEqual(['X', 'B', 'X']);
    expect(t2.canViTri).toBeUndefined();
  });
  it('đổi về đúng mẫu mà luật theo mẫu cho thì bỏ khoá vị trí; đổi về gốc thì bỏ luật theo mẫu', () => {
    const t1 = doiCanTaiViTri(toa0, vts[0], 'X', vts, true); // A -> X mọi nơi
    const t2 = doiCanTaiViTri(t1, vts[2], 'Z', vts, false); // riêng vị trí 3 -> Z
    expect(dang(t2)).toEqual(['X', 'B', 'Z']);
    const t3 = doiCanTaiViTri(t2, vts[2], 'X', vts, false);
    expect(t3.canViTri).toBeUndefined();
    expect(doiCanTaiViTri(t1, vts[0], 'A', vts, true).canTheo).toEqual({});
  });
  it('về mẫu gốc xoá hết; áp kết quả tối ưu thay đổi theo vị trí', () => {
    const t = doiCanTaiViTri(doiCanTaiViTri(toa0, vts[0], 'X', vts, true), vts[1], 'Q', vts, false);
    expect(dang(veMauGoc(t))).toEqual(['A', 'B', 'A']);
    expect(dang(apDoiViTri(t, { '0:1': 'W' }))).toEqual(['X', 'W', 'X']);
    expect(apDoiViTri(t, {}).canViTri).toBeUndefined();
  });
});
