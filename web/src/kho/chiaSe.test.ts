import { describe, expect, it } from 'vitest';
import { boMa, chenLai, linkChiaSe, phanTichLink, taoLinkSua, taoLinkXem, type DuAnDaMo } from './maSua';

const GOC = 'https://unitmix.leo-ai.dev';

describe('link chia sẻ: chỉ xem / có thể sửa', () => {
  it('link xem không bao giờ chứa mã sửa', () => {
    expect(linkChiaSe(GOC, 'x7k2p9ab', 'xem', 'Ab12Cd34Ef56Gh78Ij90')).toBe(`${GOC}/du-an/x7k2p9ab`);
    expect(linkChiaSe(GOC, 'x7k2p9ab', 'xem', null)).toBe(`${GOC}/du-an/x7k2p9ab`);
  });
  it('link sửa kèm ?sua=<mã>, chỉ dựng được khi máy giữ mã sửa', () => {
    expect(linkChiaSe(GOC, 'x7k2p9ab', 'sua', 'Ab12Cd34Ef56Gh78Ij90')).toBe(`${GOC}/du-an/x7k2p9ab?sua=Ab12Cd34Ef56Gh78Ij90`);
    expect(linkChiaSe(GOC, 'x7k2p9ab', 'sua', null)).toBeNull();
    expect(linkChiaSe(GOC, 'x7k2p9ab', 'sua', '')).toBeNull();
  });
  it('gốc có dấu / cuối không sinh "//"; mã lạ được mã hoá', () => {
    expect(taoLinkXem(GOC + '/', 'x7k2p9ab')).toBe(`${GOC}/du-an/x7k2p9ab`);
    expect(taoLinkSua(GOC, 'x7k2p9ab', 'a b&c')).toBe(`${GOC}/du-an/x7k2p9ab?sua=a%20b%26c`);
  });
  it('dán lại link vừa chép → ra đúng mã dự án và (link sửa) đúng mã sửa', () => {
    expect(phanTichLink(linkChiaSe(GOC, 'x7k2p9ab', 'xem', 'Ab12')!)).toEqual({ ma: 'x7k2p9ab', maSua: null });
    expect(phanTichLink(linkChiaSe(GOC, 'x7k2p9ab', 'sua', 'Ab12Cd34Ef56Gh78Ij90')!)).toEqual({ ma: 'x7k2p9ab', maSua: 'Ab12Cd34Ef56Gh78Ij90' });
  });
});

describe('bỏ khỏi danh sách (chỉ trên máy này) + hoàn tác', () => {
  const m = (ma: string, coMaSua = false): DuAnDaMo => ({ ma, ten: ma, moLuc: '2026-10-29T00:00:00Z', coMaSua });
  const ds = [m('aaaaaaaa'), m('bbbbbbbb', true), m('cccccccc')];

  it('bỏ đúng mục, trả mục + vị trí cũ, không đụng danh sách gốc', () => {
    const r = boMa(ds, 'bbbbbbbb');
    expect(r.ds.map((d) => d.ma)).toEqual(['aaaaaaaa', 'cccccccc']);
    expect(r.bo?.ma).toBe('bbbbbbbb');
    expect(r.viTri).toBe(1);
    expect(ds).toHaveLength(3);
  });
  it('mã không có trong danh sách → giữ nguyên', () => {
    const r = boMa(ds, 'zzzzzzzz');
    expect(r.ds).toBe(ds);
    expect(r.bo).toBeNull();
  });
  it('hoàn tác chèn lại đúng chỗ cũ; đã có lại (mở lại bằng link) thì không nhân đôi', () => {
    const r = boMa(ds, 'bbbbbbbb');
    expect(chenLai(r.ds, r.bo!, r.viTri).map((d) => d.ma)).toEqual(['aaaaaaaa', 'bbbbbbbb', 'cccccccc']);
    expect(chenLai(ds, r.bo!, r.viTri)).toBe(ds);
    expect(chenLai([], r.bo!, 5).map((d) => d.ma)).toEqual(['bbbbbbbb']);
  });
});
