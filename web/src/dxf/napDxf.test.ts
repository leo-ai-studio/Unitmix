import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dienTich } from '../tinh/hinhHoc';
import { RANH_HATCH, napDxf, taoLoTuDxf } from './napDxf';

const mau = readFileSync(new URL('./__fixtures__/lo_mau.dxf', import.meta.url), 'utf-8');
const hatchMau = readFileSync(new URL('./__fixtures__/hatch_mau.dxf', import.meta.url), 'utf-8');

describe('đọc DXF', () => {
  it('liệt kê lớp và tự đổi mm sang m theo $INSUNITS', () => {
    const d = napDxf(mau);
    expect(d.lop).toEqual(['HT-NHA', 'QH-CGXD', 'QH-RANH-LO', 'QH-TEM']);
    expect(d.donVi).toBe('mm');
    const ranh = d.polyKin('QH-RANH-LO');
    expect(ranh).toHaveLength(2);
    expect(dienTich(ranh[0])).toBeCloseTo(12400, 0);
  });

  it('đường hở không được coi là ranh; báo lỗi ranh_khong_kin khi lớp chỉ có đường hở', () => {
    const d = napDxf(mau);
    expect(d.polyKin('HT-NHA')).toEqual([]);
    expect(d.loiLop('HT-NHA')).toBe('ranh_khong_kin');
    expect(d.loiLop('QH-RANH-LO')).toBeNull();
  });

  it('đọc chữ tem đất (TEXT và MTEXT) kèm vị trí', () => {
    const chu = napDxf(mau).chu('QH-TEM').map((c) => c.noiDung).sort();
    expect(chu).toEqual(['CC-02', 'NOXH-01']);
  });

  it('mỗi đa giác kín là một lô; tem đất và chỉ giới gán vào lô chứa nó', () => {
    const lo = taoLoTuDxf(napDxf(mau), { ranh: 'QH-RANH-LO', chiGioi: 'QH-CGXD', tem: 'QH-TEM', xungQuanh: 'HT-NHA' });
    expect(lo.map((l) => l.temDat.kyHieu)).toEqual(['CC-02', 'NOXH-01']);
    expect(lo.map((l) => l.temDat.chucNang)).toEqual(['khac', 'xh']);
    expect(dienTich(lo[1].chiGioi!)).toBeCloseTo(48 * 48, 0);
    expect(lo[0].xungQuanh).toHaveLength(1);
  });

  it('đọc vòng ngoài của HATCH (cạnh thẳng, đa tuyến, cung); vòng lỗ bị bỏ', () => {
    const d = napDxf(hatchMau);
    expect(d.lopHatch).toEqual(['!QHCT_Đất hỗn hợp', 'QHDH_DAT_CTHTXH_CayxanhCC', 'QHDH_DAT_NO_Nhaochungcu']);
    expect(d.lop).toContain('QHDH_DAT_NO_Nhaochungcu');
    expect(d.hatch('!QHCT_Đất hỗn hợp').map(dienTich)).toEqual([10000, 3000]);
    expect(d.hatch('QHDH_DAT_NO_Nhaochungcu').map(dienTich)).toEqual([12000]);
    expect(dienTich(d.hatch('QHDH_DAT_CTHTXH_CayxanhCC')[0])).toBeCloseTo(Math.PI * 100, -1);
  });

  it('chọn "ô đất tô hatch": mỗi vòng ngoài là một lô, ký hiệu và chức năng theo tên lớp', () => {
    const lo = taoLoTuDxf(napDxf(hatchMau), { ranh: RANH_HATCH, chiGioi: '!!CGXD' });
    expect(lo.map((l) => l.temDat.kyHieu)).toEqual(['CX-1', 'CT-1', 'HH-1', 'HH-2']);
    expect(lo.map((l) => l.temDat.chucNang)).toEqual(['khac', 'tm', 'tm', 'tm']);
    expect(dienTich(lo[1].chiGioi!)).toBeCloseTo(100 * 90, 0);
    expect(lo[2].chiGioi).toBeNull();
  });

  it('nền vẽ tự lấy đường giao thông (lòng, hè, tim), đọc cả LINE và ARC', () => {
    const d = napDxf(hatchMau);
    expect(d.duong('HTKT_GT_Longduong')).toHaveLength(2);
    const cung = d.duong('HTKT_GT_Longduong')[1];
    expect(cung[0][0]).toBeCloseTo(-40, 6);
    expect(cung.at(-1)![1]).toBeCloseTo(300, 6);
    const lo = taoLoTuDxf(d, { ranh: RANH_HATCH });
    expect(lo[0].xungQuanh).toHaveLength(3);
  });

  it('tệp không phải DXF -> ném lỗi dễ hiểu', () => {
    expect(() => napDxf('xin chao')).toThrow(/DXF/);
  });
});

describe('đoán lớp công trình xung quanh', () => {
  it('không nhận lớp hè đường / đất quy hoạch (bản vẽ SDĐ M7)', async () => {
    const { doanLopXungQuanh } = await import('./napDxf');
    const m7 = ['!!CGXD', '!QH-GT-Timduong', 'HTKT_GT_Heduong', 'HTKT_GT_Longduong', 'HT_DAT_CTHTKT_Nghiatrang', 'QHDH_DAT_NO_Nhaochungcu', 'bo lk', '0'];
    expect(doanLopXungQuanh(m7)).toBe('');
    expect(doanLopXungQuanh(['QH-CGXD', 'HT-NHA', 'QH-TEM'])).toBe('HT-NHA');
    expect(doanLopXungQuanh(['A', 'Hiện trạng công trình'])).toBe('Hiện trạng công trình');
  });

  it('chế độ lớp ranh: ký hiệu CX / GD / CC / TMDV… thành lô nền (khac), NOTM / NOXH / TĐC vẫn là nhà ở', () => {
    const d = napDxf(mau);
    const lo = taoLoTuDxf(d, { ranh: 'QH-RANH-LO', tem: 'QH-TEM' });
    expect(lo.find((l) => l.temDat.kyHieu === 'NOXH-01')?.temDat.chucNang).toBe('xh');
    expect(lo.find((l) => l.temDat.kyHieu === 'CC-02')?.temDat.chucNang).toBe('khac');
  });
});
