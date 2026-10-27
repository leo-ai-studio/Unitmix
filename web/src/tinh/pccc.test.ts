import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  chieuCaoPCCC, gioiHanThoatNan, kiemTraPCCC, soTiaBang11, thoatNan, tinhCuaCan, tuPCCC,
  type PhanTuMat, type ThuVienTuPCCC, type ToaPCCC,
} from './pccc';

const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const toa = new Map(doc<ToaPCCC[]>('toa.json').map((t) => [t.id, t]));
const can = doc<{ id: string; ma_goc: string; rong_mm: number }[]>('can.json');
const cuaCan: Record<string, number> = {};
for (const c of can) cuaCan[c.ma_goc] = tinhCuaCan(doc<{ ve: { cat: string; pts: [number, number][] }[] }>(`can/${c.id}.json`).ve, c.rong_mm);
const tuLib = doc<ThuVienTuPCCC>('pccc.json');
const H = 90.5; // app cũ mặc định 26 tầng → H PCCC 90,5 m
const gan = (a: number, b: number, sai = 0.1) => expect(Math.abs(a - b)).toBeLessThanOrEqual(sai);

describe('ngưỡng', () => {
  it('đổi theo chiều cao PCCC (QT-24)', () => {
    expect(gioiHanThoatNan(75)).toMatchObject({ cut: 25, doi: 40 });
    expect(gioiHanThoatNan(75.1)).toMatchObject({ cut: 15, doi: 20 });
    expect(chieuCaoPCCC(1, 4.5, 25, 3.3)).toBeCloseTo(4.5 + 79.2 + 1.4);
    expect(soTiaBang11(16, 9000)).toEqual({ tia: 1, can: 1 });
    expect(soTiaBang11(20, 30000)).toEqual({ tia: 3, can: 2 });
    expect(soTiaBang11(30, 30000)).toEqual({ tia: 2, can: 2 });
  });
  it('tim cửa căn từ nét cửa (doorX)', () => {
    expect(cuaCan['chtm_hn_2pn_g1_8500x9000']).toBeCloseTo(0.11, 2); // căn góc: cửa sát mép (nét cửa x 0,05…0,17)
    expect(Object.keys(cuaCan)).toHaveLength(can.length);
    expect(Object.values(cuaCan).every((v) => v > 0 && v < 1)).toBe(true);
    expect(tinhCuaCan([], 6000)).toBe(0.5);
  });
});

describe('mẫu tòa thật — đối chiếu app cũ (26 tầng, H 90,5 m)', () => {
  // số app cũ chạy headless trên MDI_Unitmix_v4 @ 7373a5a (metrics(buildGeom()))
  const CU = {
    'tm-i1': { dead: 17.48, doi: 19.64, cut: 13, soDoi: 15, vuot: 2, thang: 2 },
    'tm-u2': { dead: 13.78, doi: 14.73, cut: 10, soDoi: 17, vuot: 0, thang: 3 },
    'tm-z1': { dead: 19.37, doi: 9.93, cut: 18, soDoi: 6, vuot: 6, thang: 2 },
    'xh-y1': { dead: 15.94, doi: 16.92, cut: 15, soDoi: 10, vuot: 2, thang: 3 },
    // tòa L / T: đoạn nối góc vẽ tay trùng trục giữ làm cạnh riêng (QT-51) → căn cánh đó thoát hai hướng
    'tm-l1': { dead: 19.29, doi: 18.81, cut: 8, soDoi: 17, vuot: 2, thang: 2 },
    'tm-t1': { dead: 12.12, doi: 19.03, cut: 6, soDoi: 27, vuot: 0, thang: 3 },
    'tm-t2': { dead: 15.8, doi: 20.9, cut: 14, soDoi: 28, vuot: 3, thang: 3 },
    // xh-u1: trục B tách B1/B2 theo mốc CAD, giữa hai cánh không có hành lang
    'xh-u1': { dead: 13.06, doi: 13.04, cut: 10, soDoi: 11, vuot: 0, thang: 3 },
  } as const;
  for (const [id, o] of Object.entries(CU)) {
    it(id, () => {
      const r = thoatNan(toa.get(id)!, { cuaCan, chieuCaoPCCC: H });
      gan(r.deadEnd, o.dead);
      gan(r.doiMax, o.doi);
      expect([r.soCanCut, r.soCanDoi, r.soVuot, r.soThang]).toEqual([o.cut, o.soDoi, o.vuot, o.thang]);
    });
  }

  it('tòa V: căn mặt xiên ở góc gán vào đoạn nối góc, thoát hai hướng (app cũ đặt nhầm lên trục A)', () => {
    const r = thoatNan(toa.get('tm-v1')!, { cuaCan, chieuCaoPCCC: H });
    const goc = r.can.filter((c) => c.so === 15 || c.so === 16);
    expect(goc.map((c) => c.cut)).toEqual([false, false]);
    gan(goc[0].cuLy!, 11.66);
    gan(goc[1].cuLy!, 18.88);
    // các căn còn lại khớp app cũ: 11 cụt / 9 đôi trừ 2 căn góc
    expect([r.soCanCut, r.soCanDoi]).toEqual([9, 11]);
  });

  it('tm-i1: danh sách luật và mức', () => {
    const kq = kiemTraPCCC(toa.get('tm-i1')!, { cuaCan, chieuCaoPCCC: H, tuPCCC: tuLib });
    const m = Object.fromEntries(kq.map((x) => [x.id, x]));
    expect(Object.keys(m)).toEqual(['qcvn06_two_stairs_travel', 'qcvn06_deadend', 'qcvn06_travel_max', 'qcvn06_escape_stairs', 'qcvn06_335_corridor', 'qcvn06_52_hong_nuoc']);
    expect(m.qcvn06_deadend).toMatchObject({ muc: 'vuot', nguong: 15 }); // 17,48 > 15
    expect(m.qcvn06_two_stairs_travel).toMatchObject({ muc: 'ok', nguong: 20 }); // 19,64 ≤ 20
    expect(m.qcvn06_travel_max.muc).toBe('vuot');
    expect(m.qcvn06_escape_stairs).toMatchObject({ muc: 'ok', giaTri: 2 });
    expect(m.qcvn06_335_corridor.muc).toBe('canh_bao'); // 102 m liền, phải chia
    expect(m.qcvn06_52_hong_nuoc.muc).toBe('ok');
  });

  it('tm-u2 ở 20 tầng (H ≤ 75 m): đạt cả hai cự ly, 3 thang = cảnh báo', () => {
    const kq = kiemTraPCCC(toa.get('tm-u2')!, { cuaCan, chieuCaoPCCC: chieuCaoPCCC(1, 4.5, 20, 3.3), soTang: 20 });
    const m = Object.fromEntries(kq.map((x) => [x.id, x]));
    expect(m.qcvn06_deadend).toMatchObject({ muc: 'ok', nguong: 25 });
    expect(m.qcvn06_two_stairs_travel).toMatchObject({ muc: 'ok', nguong: 40 });
    expect(m.qcvn06_escape_stairs.muc).toBe('canh_bao');
  });

  it('tủ PCCC tự đặt phủ hết cửa căn mọi mẫu tòa (R 18 m)', () => {
    for (const t of toa.values()) {
      const tu = tuPCCC(t, { cuaCan, chieuCaoPCCC: H, tuPCCC: tuLib });
      expect(tu.thieu, t.id).toEqual([]);
      expect(tu.viTri.length, t.id).toBeGreaterThanOrEqual(2);
      expect(tu.viTri.length, t.id).toBeLessThanOrEqual(8);
      expect(tu.rongTu).toBe(800); // 26 tầng → 2 tia/điểm → cụm 2 hộp (pccc-800x200)
    }
  });
});

describe('ca hỏng dựng tay', () => {
  // thanh đơn 60 m, một dãy 10 căn 6 m, MỘT thang bộ ở đầu trái
  const pt = (o: Partial<PhanTuMat>): PhanTuMat => ({ loai: 'can', ma: 'x', block: 'x', ma_thu_vien: 'x', a0: 0, a1: 0, rong_mm: 0, sau_mm: 8500, x: 0, y: 0, rot: 0, sx: 1, sy: 1, ...o });
  const hong: ToaPCCC = {
    id: 'thu-hong', nhom: 'tm', hanh_lang_mm: 1800,
    truc: [{ ten: 'A', goc_deg: 0, hanh_lang_mm: 1800, a_dau: 0, a_cuoi: 63000, dai_mm: 63000, b_mm: -900 }],
    hanhlang_ve: [],
    mat: [{
      goc_deg: 0, truc_mm: 0, a_dau: 0, a_cuoi: 63000,
      phan_tu: [
        pt({ loai: 'thang_bo', block: 'x_tb_n3', ma_thu_vien: null, a0: 0, a1: 3000, rong_mm: 3000, x: 0, y: 0 }),
        ...Array.from({ length: 10 }, (_, i) => pt({ a0: 3000 + i * 6000, a1: 9000 + i * 6000, rong_mm: 6000, x: 3000 + i * 6000 })),
      ],
    }],
  };

  it('một thang, hành lang cụt 59 m: mọi luật thoát nạn vượt', () => {
    const r = thoatNan(hong, { chieuCaoPCCC: H });
    expect(r.soThang).toBe(1);
    expect(r.soCanDoi).toBe(0);
    gan(r.deadEnd, (3000 + 9 * 6000 + 3000 - 865) / 1000, 0.01); // cửa căn cuối (tim 0,5) → cửa thang 865
    const m = Object.fromEntries(kiemTraPCCC(hong, { chieuCaoPCCC: H }).map((x) => [x.id, x]));
    expect(m.qcvn06_deadend.muc).toBe('vuot');
    expect(m.qcvn06_travel_max.muc).toBe('vuot');
    expect(m.qcvn06_escape_stairs.muc).toBe('vuot');
    expect(m.qcvn06_335_corridor.muc).toBe('canh_bao');
  });

  it('thêm thang ở đầu phải: căn giữa thành lối đôi', () => {
    const hai: ToaPCCC = { ...hong, mat: [{ ...hong.mat[0], phan_tu: [...hong.mat[0].phan_tu, pt({ loai: 'thang_bo', block: 'x_tb_n3', ma_thu_vien: null, a0: 63000, a1: 66000, x: 63000 })] }] };
    const r = thoatNan(hai, { chieuCaoPCCC: H });
    expect(r.soThang).toBe(2);
    expect(r.soCanDoi).toBe(10);
    expect(r.soCanCut).toBe(0);
  });

  it('một tủ đặt tay ở đầu trái: căn xa hơn 18 m bị báo thiếu', () => {
    const tu = tuPCCC(hong, { chieuCaoPCCC: H, viTriTu: [[1500, -1800]] });
    expect(tu.tuDat).toBe(false);
    expect(tu.thieu.length).toBeGreaterThan(5);
    expect(tu.thieu).toContain(10);
    const m = kiemTraPCCC(hong, { chieuCaoPCCC: H, viTriTu: [[1500, -1800]] }).find((x) => x.id === 'qcvn06_52_hong_nuoc')!;
    expect(m.muc).toBe('vuot');
  });
});
