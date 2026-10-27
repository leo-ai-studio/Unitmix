import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { locLuat, nguongSo, theoBuoc, traLuat, traQTCu, type BoQuyTac } from './quyTac';

const bo = JSON.parse(readFileSync(new URL('../../public/lib/quy_tac.json', import.meta.url), 'utf8')) as BoQuyTac;

describe('quy_tac.json', () => {
  it('đủ 7 bước theo thứ tự app mới, mỗi luật thuộc một bước', () => {
    expect(bo.buoc.map((b) => b.ma)).toEqual(['lo_qh', 'chon_mau_toa', 'xep_day_can', 'doi_mau_can', 'pccc', 'ham', 'chi_tieu']);
    const nhom = theoBuoc(bo);
    expect(nhom.reduce((s, x) => s + x.luat.length, 0)).toBe(bo.luat.length);
    expect(nhom.find((x) => x.buoc.ma === 'ham')!.luat).toEqual([]); // app cũ chưa có luật hầm
  });

  it('lọc theo nhóm, bước, bắt buộc', () => {
    const qc06 = locLuat(bo, { nhom: 'qcvn06' });
    expect(qc06.map((l) => l.id)).toContain('qcvn06_deadend');
    expect(qc06.every((l) => l.nhom === 'qcvn06')).toBe(true);
    const pccc = locLuat(bo, { buoc: 'pccc' });
    const dauNoiBo = pccc.findIndex((l) => !l.bat_buoc);
    expect(pccc.slice(dauNoiBo).every((l) => !l.bat_buoc)).toBe(true); // bắt buộc trước
    expect(locLuat(bo, { nhom: ['qcvn01', 'qd34'], batBuoc: true }).length).toBeGreaterThanOrEqual(4);
    expect(locLuat(bo, { loaiHinh: 'xh' }).length).toBe(bo.luat.length); // hiện mọi luật áp cả hai loại hình
  });

  it('tra theo id, mã mới, mã cũ', () => {
    const l = traLuat(bo, 'qcvn06_deadend')!;
    expect(l.ma).toMatch(/^PC-\d\d$/);
    expect(traLuat(bo, l.ma)).toBe(l);
    expect(traLuat(bo, 'QT-45')!.id).toBe('qcvn06_travel_max');
    expect(traLuat(bo, 'mdi_eff')!.buoc).toBe('chon_mau_toa');
    expect(traLuat(bo, 'không-có')).toBeUndefined();
  });

  it('ngưỡng giữ nguyên app cũ', () => {
    const l = traLuat(bo, 'qcvn06_deadend')!;
    expect(nguongSo(l, 'H ≤ 75')).toBe(25);
    expect(nguongSo(l, '75 < H')).toBe(15);
    expect(nguongSo(traLuat(bo, 'qcvn06_two_stairs_travel')!, '75 < H')).toBe(20);
    expect(nguongSo(traLuat(bo, 'qcvn04_min_area')!)).toBe(25);
    expect(nguongSo(traLuat(bo, 'mdi_eff')!)).toBe(0.75);
  });

  it('QT cũ: giữ thì trỏ luật mới, bỏ thì có lý do / QT thay thế', () => {
    const q15 = traQTCu(bo, 'QT-15')!;
    expect(q15.giu).toBe(false);
    if (!q15.giu) expect(q15.thay_the_boi).toBe('QT-45');
    const q77 = traQTCu(bo, 'QT-77')!;
    expect(q77.giu && q77.luat_moi).toEqual([traLuat(bo, 'qcvn06_52_hong_nuoc')!.ma]);
    expect(traLuat(bo, 'qcvn06_travel_max')!.thay_cho).toContain('QT-15');
  });
});
