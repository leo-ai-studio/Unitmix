/**
 * Quy tắc vị trí căn (chủ nhiệm 2026-10-31): căn góc chỉ ở góc, căn giữa chỉ ở giữa, căn góc V / Y khoá đúng chỗ cạnh lõi thang máy.
 * Kiểm trên thư viện thật: danh sách đổi mẫu, đổi chỗ, thêm căn, PA cũ lưu đổi sai.
 */
import { describe, expect, it } from 'vitest';
import { napThuVien, toaThu } from '../thu/thuVienThat';
import type { ToaDat } from './kieu';
import { apMatBang, matBangTang, type ToaMB } from './loiThang';
import { boCucTang, canDangDung, ungVienDoi, ungVienKhacRong, viTriCan, type ViTriCan } from './matBang';
import { mauToa } from './canThem';
import { duocDatVaoO, laCanKhoa, nhomViTri } from './quyTacViTriCan';
import { doiChoTay, themCanTay, themVaoO } from './thaoTacTay';

const { tv, dl, toaDs } = napThuVien();
const c = { tv, dl };

const slots = (toa: ToaDat): ViTriCan[] => {
  const mau = mauToa(tv, toa) as ToaMB, mb = matBangTang(toa, mau, dl, null);
  return viTriCan(apMatBang(mau, mb, dl), tv, boCucTang(toa, null));
};
const nhom = (v: ViTriCan) => nhomViTri(v.canGocId);

describe('quy tắc vị trí căn — hàm cơ sở', () => {
  it('nhóm theo mã đuôi id; biến thể STRETCH tính theo mẫu gốc', () => {
    expect(nhomViTri('tm-1pn-m1')).toBe('giua');
    expect(nhomViTri('xh-2pn-g3')).toBe('goc');
    expect(nhomViTri('tm-2pn-v1')).toBe('khoa');
    expect(nhomViTri('xh-2pn-y1')).toBe('khoa');
    expect(nhomViTri('tm-2pn-v1~s+100')).toBe('khoa');
    expect(laCanKhoa('tm-2pn-y2')).toBe(true);
    expect(laCanKhoa('tm-3pn-g1')).toBe(false);
  });

  it('ô giữa chỉ nhận căn giữa; ô góc chỉ nhận căn góc thường; ô V / Y chỉ nhận chính nó', () => {
    expect(duocDatVaoO('tm-1pn-m1', 'tm-2pn-m2')).toBe(true);
    expect(duocDatVaoO('tm-1pn-m1', 'tm-2pn-g1')).toBe(false);
    expect(duocDatVaoO('tm-1pn-m1', 'tm-2pn-v1')).toBe(false);
    expect(duocDatVaoO('tm-2pn-g1', 'tm-3pn-g2')).toBe(true);
    expect(duocDatVaoO('tm-2pn-g1', 'tm-2pn-m1')).toBe(false);
    expect(duocDatVaoO('tm-2pn-g1', 'tm-2pn-y1')).toBe(false);
    expect(duocDatVaoO('tm-2pn-y1', 'tm-2pn-y1')).toBe(true);
    expect(duocDatVaoO('tm-2pn-y1', 'tm-2pn-y1~s-100')).toBe(true); // STRETCH cùng mẫu không phải đổi mẫu
    expect(duocDatVaoO('tm-2pn-y1', 'tm-2pn-y2')).toBe(false);
    expect(duocDatVaoO('tm-2pn-y1', 'tm-2pn-g1')).toBe(false);
    expect(duocDatVaoO('tm-2pn-v1', 'tm-2pn-y1')).toBe(false);
  });
});

describe('quy tắc vị trí căn — danh sách đổi mẫu (màn Tầng, trợ lý AI, tối ưu)', () => {
  it('không mẫu nào lọt sang loại vị trí khác; ô V / Y không có mẫu để đổi', () => {
    for (const c of tv.can.values()) {
      if (c.stretchGoc) continue;
      const cung = ungVienDoi(c.id, tv), khac = ungVienKhacRong(c.id, tv);
      if (laCanKhoa(c.id)) { expect(cung, c.id).toEqual([]); expect(khac, c.id).toEqual([]); continue; }
      for (const x of [...cung, ...khac]) {
        expect(x.vi_tri, `${c.id} → ${x.id}`).toBe(c.vi_tri);
        expect(laCanKhoa(x.id), `${c.id} → ${x.id}`).toBe(false);
      }
    }
  });

  it('căn góc thường vẫn đổi được cho nhau (cùng bề ngang)', () => {
    expect(ungVienDoi('tm-2pnp-g1', tv).map((x) => x.id)).toContain('tm-2pnp-g2');
  });
});

describe('quy tắc vị trí căn — mọi mẫu tòa', () => {
  const mauCoCan = toaDs.filter((t) => Array.isArray((t as unknown as ToaMB).mat)).map((t) => t.id);

  it.each(mauCoCan)('%s: đổi chỗ / thêm căn / đổi mẫu sai vị trí đều bị chặn, PA cũ lưu đổi sai bị bỏ', (id) => {
    const t0 = toaThu(id), vts = slots(t0);
    const giua = vts.filter((v) => nhom(v) === 'giua'), goc = vts.filter((v) => nhom(v) === 'goc'), khoa = vts.filter((v) => nhom(v) === 'khoa');
    // đổi chỗ căn giữa ↔ căn góc, V / Y ↔ bất kỳ ô khác
    if (giua[0] && goc[0]) expect(doiChoTay(t0, null, giua[0], goc[0], c), 'giữa↔góc').toMatchObject({ ok: false, lyDo: 'sai_vi_tri' });
    if (giua[0] && khoa[0]) expect(doiChoTay(t0, null, khoa[0], giua[0], c), 'V/Y↔giữa').toMatchObject({ ok: false, lyDo: 'sai_vi_tri' });
    if (goc[0] && khoa[0]) expect(doiChoTay(t0, null, goc[0], khoa[0], c), 'V/Y↔góc').toMatchObject({ ok: false, lyDo: 'sai_vi_tri' });
    if (khoa.length > 1 && khoa[0].canGocId !== khoa[1].canGocId) expect(doiChoTay(t0, null, khoa[0], khoa[1], c), 'V/Y↔V/Y').toMatchObject({ ok: false, lyDo: 'sai_vi_tri' });
    // thêm căn góc / V / Y bị chặn; đặt căn góc vào ô giữa bị chặn
    const neo = vts[0];
    for (const x of [...tv.can.values()].filter((m) => !m.stretchGoc && m.vi_tri === 'goc').slice(0, 3))
      expect(themCanTay(t0, null, neo, x.id, c), `thêm ${x.id}`).toMatchObject({ ok: false, lyDo: 'sai_vi_tri' });
    if (giua[0]) expect(themVaoO(t0, null, giua[0], 'tm-2pn-g1', c)).toMatchObject({ ok: false, lyDo: 'sai_vi_tri' });
    // PA cũ lưu đổi sai (canTheo / canViTri) thì căn đang dùng quay về mẫu hợp lệ
    for (const v of [...giua, ...goc, ...khoa]) {
      const sai = nhom(v) === 'giua' ? 'tm-2pn-g1' : nhom(v) === 'goc' ? 'tm-1pn-m1' : 'tm-1pn-m1';
      const t1: ToaDat = { ...t0, canTheo: { [v.canGocId]: sai }, canViTri: { [v.khoa]: sai } };
      expect(canDangDung(v, t1), `${id} ${v.khoa}`).toBe(v.canGocId);
    }
  });
});
