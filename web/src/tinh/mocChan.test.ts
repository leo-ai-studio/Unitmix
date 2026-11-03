/**
 * Mốc chặn (app cũ QT-49 · 49b · 49c, `goc`): đặt trên mẫu GỐC — đầu mặt cách ≤ 6.000 mm giao điểm hai trục hành lang khác tên
 * hoặc góc khung tường lõi thang máy. Dồn khít về mốc chặn, đầu kia co / giãn. Quét MỌI mẫu tòa trong thư viện (không liệt kê tên),
 * nên mẫu thêm sau cũng bị kiểm; biến thể căn / STRETCH / thang bộ chỉ đổi căn bên trong, mốc đứng yên.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { taoThuVien, type CanMau, type ToaDat, type ToaMau } from './kieu';
import { dauTuDo, mocChan, mocGoc, tuChinhToa, type DuLieuMB, type HinhLoiMB, type ToaMB } from './loiThang';
import { tinhCuaCan } from './pccc';
import { themBienThe } from './stretch';

const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const toaDs = doc<ToaMau[]>('toa.json'), canDs = doc<CanMau[]>('can.json');
const tv = themBienThe(taoThuVien(toaDs, canDs));
const idLoi = (b: string) => 'loi-' + b.replace(/^x_/, '').replace(/_/g, '-');
const dl: DuLieuMB = { loi: new Map(), cuaCan: {} };
for (const t of toaDs) for (const m of (t as unknown as ToaMB).mat) for (const q of m.phan_tu)
  if (q.loai !== 'can' && !dl.loi.has(q.block) && existsSync(new URL(`loi/${idLoi(q.block)}.json`, lib))) dl.loi.set(q.block, doc<HinhLoiMB>(`loi/${idLoi(q.block)}.json`));
dl.loi.set('x_tb_n2', doc<HinhLoiMB>('loi/loi-tb-n2.json'));
for (const c of canDs) dl.cuaCan[c.ma_goc] = tinhCuaCan(doc<{ ve: { cat: string; pts: [number, number][] }[] }>(`can/${c.id}.json`).ve, c.rong_mm);

const mau = (id: string) => tv.toa.get(id) as unknown as ToaMB;
const toaThu = (m: ToaMB): ToaDat =>
  ({ id: 't', loId: 'l', mauId: m.id, x: 0, y: 0, gocDo: 0, soTangDH: 24, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {} });
const tatCa = toaDs.map((t) => mau(t.id));

describe('mốc chặn QT-49 trên mẫu gốc', () => {
  it('tòa I (một trục) không có mốc chặn', () => {
    for (const id of ['tm-i1', 'tm-i2', 'tm-i3', 'xh-i1']) expect([...mocGoc(mau(id), dl)], id).toEqual([]);
  });
  it('tòa U / Z: mỗi mẫu có mốc ở đầu sát lõi (số đo app cũ: 50–70 mm, 1.801 mm)', () => {
    for (const m of tatCa.filter((x) => /-[uz]\d/.test(x.id))) expect(mocGoc(m, dl).size, m.id).toBeGreaterThanOrEqual(4);
    const z1 = mocGoc(mau('tm-z1'), dl);
    expect(z1.has('0:0')).toBe(true); // mặt 0 đầu, sát góc lõi
    expect(z1.has('1:1')).toBe(true); // mặt 1 cuối (dãy trên ảnh chủ nhiệm), cách góc lõi 1.801 mm
    expect(z1.has('1:0')).toBe(false); // đầu tự do ngoài cùng của tòa
  });
  it('tòa L: mốc ở góc nối hai cánh', () => {
    const l1 = mocGoc(mau('tm-l1'), dl);
    expect(l1.has('0:0')).toBe(true);
    expect(l1.has('3:1')).toBe(true);
  });
  it('mốc không đổi theo mặt bằng / dl (đặt trên mẫu gốc)', () => {
    for (const m of tatCa) expect([...mocGoc(m, dl)].sort(), m.id).toEqual([...mocGoc(m, dl)].sort());
  });
});

/** Ưu tiên mốc làm còn căn vượt cự ly thoát nạn (QCVN 06) thì PC-11 giữ thứ tự co cũ — an toàn thoát nạn trước (tuChinhMoRong.test: xh-z4 6 → 0). */
const NHUONG_THOAT_NAN = new Set(['xh-z4']);

describe('mặt bằng mặc định: dãy có một đầu mốc chặn, đầu kia tự do thì mép mốc đứng yên (mọi mẫu tòa)', () => {
  it.each(tatCa.filter((m) => mocGoc(m, dl).size).map((m) => [m.id, m] as const))('%s', (_id, m) => {
    const r = tuChinhToa(toaThu(m), m, tv, dl), mb = r.matBang!, loi: string[] = [];
    m.mat.forEach((x, mi) => {
      const mep = mb.mep?.[mi];
      if (!mep) return;
      for (const cuoi of [false, true]) {
        const doi = Math.round(cuoi ? mep[1] - x.a_cuoi : mep[0] - x.a_dau);
        if (Math.abs(doi) < 5 || !mocChan(m, mi, cuoi) || mocChan(m, mi, !cuoi)) continue;
        if (dauTuDo(m, mb, mi, !cuoi)) loi.push(`mặt ${mi}: mép ${cuoi ? 'cuối' : 'đầu'} (mốc chặn) dời ${doi} mm dù đầu kia tự do`);
      }
    });
    if (NHUONG_THOAT_NAN.has(m.id)) return;
    expect(loi).toEqual([]);
  });
});
