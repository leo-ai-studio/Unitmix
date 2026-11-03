import { describe, expect, it } from 'vitest';
import { napThuVien, toaThu } from '../thu/thuVienThat';
import { layMau } from '../thu/layMau';
import { dauHanhLangNgoai, mauHieuDung, tuChinhToa, type ToaMB } from './loiThang';
import { keoHanhLangTay } from './thaoTacTay';
import type { ToaDat } from './kieu';

// Số điểm kéo đầu hành lang theo QT app cũ (MDI_Unitmix_v4 p17c: một Circle CAD lớp MDI-HANHLANG = một điểm kéo, `hanhlang_moc` trong
// toa_dwg.json): I 2 · L 3 · T 4 · U 6 · V 2 · Y 3 · Z 4. Mọi mẫu trong thư viện phải đủ đúng số đó, ở mọi chiều cao, sau khi kéo tay,
// khi lật; và kéo thả từng điểm theo cả hai chiều đều được nhận (không bị chặn).
const { tv, dl } = napThuVien();
const QT: Record<string, number> = { i: 2, l: 3, t: 4, u: 6, v: 2, y: 3, z: 4 };
const ids = [...tv.toa.keys()].filter((id) => /^(tm|xh)-[a-z]\d$/.test(id));
const mauGoc = (id: string) => tv.toa.get(id) as unknown as ToaMB;
const diem = (toa: ToaDat) => {
  const hd = mauHieuDung(toa, mauGoc(toa.mauId), dl, null), hl = hd.hanh_lang ?? [];
  return hl.map((_, i) => dauHanhLangNgoai(hl, i, hd.duong_bao));
};
const tuChinh = (id: string, cao: number, them: Partial<ToaDat> = {}) => tuChinhToa({ ...toaThu(id, cao), ...them }, mauGoc(id), tv, dl);

describe('Điểm kéo đầu hành lang theo QT (mọi mẫu tòa)', () => {
  it('thư viện có đủ 33 mẫu', () => expect(ids.length).toBe(33));

  it('mặt bằng mặc định mọi chiều cao: đúng số điểm kéo của QT', () => {
    for (const id of layMau(ids, 3)) for (const cao of [9, 24, 40]) {
      const n = diem(tuChinh(id, cao)).flat().length;
      expect(n, `${id} cao ${cao}`).toBe(QT[id.split('-')[1][0]]);
    }
  });

  it('tòa lật và tòa đã kéo hết điểm +3 m vẫn đủ điểm kéo', () => {
    for (const id of layMau(ids, 3)) {
      const t0 = tuChinh(id, 24), ds = diem(t0), tay: Record<string, [number, number]> = {};
      ds.forEach((d, i) => { if (d.length) tay[i] = [d.includes(0) ? 3000 : 0, d.includes(1) ? 3000 : 0]; });
      const n = QT[id.split('-')[1][0]];
      expect(diem(tuChinh(id, 24, { hanhLangTay: tay })).flat().length, `${id} đã kéo`).toBe(n);
      expect(diem(tuChinh(id, 24, { lat: true })).flat().length, `${id} lật`).toBe(n);
    }
  });

  it('kéo thả từng điểm (dài ra, ngắn lại, quá giới hạn) đều được nhận, không bị chặn', () => {
    const c = { tv, dl };
    for (const id of layMau(ids, 3)) {
      const t0 = tuChinh(id, 24);
      diem(t0).forEach((ds, i) => ds.forEach((dau) => {
        for (const d of [3000, -1500, 20000]) {
          const r = keoHanhLangTay(t0, i, dau, d, c);
          expect(r.ok, `${id} đoạn ${i} đầu ${dau} d=${d}`).toBe(true);
        }
      }));
    }
  });
});
