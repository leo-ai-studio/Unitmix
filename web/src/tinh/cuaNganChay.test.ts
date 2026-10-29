/**
 * Bộ giải cửa ngăn cháy hành lang chép app cũ (QT-95 / 98 / 100–105): (1) đối chiếu với app cũ chạy headless trên bố cục gốc 33 mẫu
 * tòa (`scripts/cnc_cu.js` → `thu/cnc_cu.json`, không tính tủ PCCC vào vật cản — "cửa lý tưởng" QT-77f); (2) ca dựng tay cho từng
 * luật R1–R7: khoang ≤ giới hạn, sảnh thang máy tính chung khoang, cửa ở tường chung hai căn, không chặn cửa căn, bám tường,
 * hai cửa ≥ 6 m, khoang ≥ 5 m.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { napThuVien } from '../thu/thuVienThat';
import type { Diem } from './kieu';
import { matDaDon } from './matBang';
import { cuaTrenMat, type ToaPCCC } from './pccc';
import { cncDatDuoc, cncDem, cncGioiHan, cuaHlCan, cuaNganChay, cuaNganChayTay, dauVaoCNC, doHanhLang, hlDoThi, keoCuaTay, khoiCNC, netCuaCan, sanhCuaLoi, themCuaTay, type DauVaoCNC, type LoiCNC, type OMat } from './cuaNganChay';

const CU = JSON.parse(readFileSync(new URL('../thu/cnc_cu.json', import.meta.url), 'utf8')) as Record<string, Record<'30' | '60', { cua: { p: Diem; sach: boolean }[]; doan: number[] }>>;
const { tv, dl } = napThuVien();
const theoMa = new Map([...tv.can.values()].map((c) => [c.ma_goc, c]));

/** Đầu vào bộ giải trên bố cục gốc mẫu `id` (như app cũ chế độ "banve"), không tủ PCCC. */
function dauVaoMau(id: string): DauVaoCNC {
  const mau = tv.toa.get(id) as unknown as ToaPCCC;
  const mat = matDaDon(mau as never, { canTheo: {} }, tv);
  const { can, thang } = cuaTrenMat({ ...mau, mat }, dl.cuaCan);
  return dauVaoCNC({
    mat, truc: mau.hanh_lang ?? [], hanhLangMm: mau.hanh_lang_mm, corr: mau.hanh_lang_mm,
    loi: (b) => dl.loi.get(b) as LoiCNC | undefined, sanh: (b) => sanhCuaLoi(b, id),
    cuaCan: can.map((c) => c.p), cuaThang: mau.cua_thang?.length ? mau.cua_thang : thang.map((t) => t.p), tu: [],
    cuaCanNet: netCuaCan(mat, (ma) => { const c = theoMa.get(ma); return c ? [{ cat: 'door', pts: cuaHlCan(c, tv) ?? [] }] : undefined; }),
  });
}

describe('đối chiếu app cũ — 33 mẫu tòa, bố cục gốc (25 tầng: 30 m · 20 tầng: 60 m)', () => {
  const ids = Object.keys(CU);
  const kq = ids.map((id) => {
    const v = dauVaoMau(id);
    return { id, r30: cuaNganChay(v, 30000), r60: cuaNganChay(v, 60000) };
  });
  const cua = (r: ReturnType<typeof cuaNganChay>) => r.flatMap((m) => m.cua);
  it('tổng số cửa bằng app cũ: 110 (≤ 30 m) · 49 (≤ 60 m)', () => {
    expect(kq.reduce((a, x) => a + cua(x.r30).length, 0)).toBe(ids.reduce((a, id) => a + CU[id]['30'].cua.length, 0));
    expect(kq.reduce((a, x) => a + cua(x.r60).length, 0)).toBe(ids.reduce((a, id) => a + CU[id]['60'].cua.length, 0));
  });
  it('mọi khoang ≤ giới hạn, không khoang vụn < 5 m (R1 · R7)', () => {
    for (const x of kq) {
      const d30 = x.r30.flatMap((m) => m.doan), d60 = x.r60.flatMap((m) => m.doan);
      expect(Math.max(...d30), x.id).toBeLessThanOrEqual(30000);
      expect(Math.max(...d60), x.id).toBeLessThanOrEqual(60000);
      expect(Math.min(...d30), x.id).toBeGreaterThanOrEqual(5000);
    }
  });
  it('≥ 90 % cửa app cũ có cửa app mới cách ≤ 0,3 m; số cửa từng tòa lệch ≤ 1', () => {
    let trung = 0, tong = 0;
    for (const x of kq) for (const k of ['30', '60'] as const) {
      const moi = cua(k === '30' ? x.r30 : x.r60);
      expect(Math.abs(moi.length - CU[x.id][k].cua.length), `${x.id} ${k}`).toBeLessThanOrEqual(1);
      for (const c of CU[x.id][k].cua) { tong++; if (moi.some((y) => Math.hypot(y.p[0] - c.p[0], y.p[1] - c.p[1]) <= 300)) trung++; }
    }
    expect(trung / tong).toBeGreaterThanOrEqual(0.9);
  });
  it('Z3 (tm-z3) khớp app cũ: 3 cửa, khoang 28,5 · 24,9 · 18,3 · 13,6 m (app cũ 28,5 · 25,0 · 18,2 · 13,6)', () => {
    const x = kq.find((y) => y.id === 'tm-z3')!;
    expect(cua(x.r30)).toHaveLength(3);
    expect(x.r30.flatMap((m) => m.doan).map((d) => Math.round(d / 100) / 10).sort((a, b) => b - a)).toEqual([28.5, 24.9, 18.3, 13.6]);
  });
});

// ---------- ca dựng tay: hành lang thẳng, căn 6 m hai bên ----------
const HL = 1800, hw = HL / 2;
function hanhLangThang(L: number, them: Partial<DauVaoCNC> = {}, cuaGiua = true): DauVaoCNC {
  const o: OMat[] = [], vatCan: { p: Diem; ban: number }[] = [];
  for (const sg of [1, -1]) for (let x = 0; x + 6000 <= L; x += 6000) {
    const y = sg * hw, d = sg * 8500;
    o.push({ loai: 'can', o: [x, y], u: [1, 0], w: 6000, vien: [[x, y], [x + 6000, y], [x + 6000, y + d], [x, y + d]] });
    if (cuaGiua) vatCan.push({ p: [x + 3000, y], ban: 450 }); // cửa căn giữa mặt tiền
  }
  return { truc: [{ ten: 'A', p0: [0, 0], p1: [L, 0], corr: HL, link: false }], o, loiP: [], tuongLoi: [], netLoi: [], vatCan, corr: HL, ...them };
}

describe('luật đặt cửa (QT-105) trên hành lang dựng tay', () => {
  it('giới hạn theo chiều cao PCCC: 60 m (≤ 75 m, 3.3.5) · 30 m (> 75 m, A.2.14)', () => {
    expect(cncGioiHan(75)).toBe(60000);
    expect(cncGioiHan(75.1)).toBe(30000);
  });
  it('72 m, giới hạn 30 m: 2 cửa ở tường chung hai căn (bội 6 m), khoang ≤ 30 m, cách nhau ≥ 6 m', () => {
    const r = cuaNganChay(hanhLangThang(72000), 30000), c = r.flatMap((m) => m.cua);
    expect(c).toHaveLength(2);
    for (const x of c) { expect(x.tuong).toBe(true); expect(x.p[0] % 6000).toBe(0); expect(x.sach).toBe(true); }
    expect(Math.abs(c[0].p[0] - c[1].p[0])).toBeGreaterThanOrEqual(6000);
    expect(Math.max(...r.flatMap((m) => m.doan))).toBeLessThanOrEqual(30000);
  });
  it('≤ 60 m không cửa; 72 m với 60 m một cửa', () => {
    expect(cuaNganChay(hanhLangThang(54000), 60000).flatMap((m) => m.cua)).toHaveLength(0);
    expect(cuaNganChay(hanhLangThang(72000), 60000).flatMap((m) => m.cua)).toHaveLength(1);
  });
  it('R4a: không đặt khuôn cửa trên ô cửa căn — cửa căn ở tường chung thì cửa dời ra (≥ 500 + 100 + ½ ô cửa)', () => {
    const v = hanhLangThang(72000, {}, false);
    for (let x = 6000; x < 72000; x += 6000) v.vatCan.push({ p: [x, hw], ban: 450 });
    const c = cuaNganChay(v, 30000).flatMap((m) => m.cua);
    for (const x of c) for (let y = 6000; y < 72000; y += 6000) expect(Math.abs(x.p[0] - y)).toBeGreaterThanOrEqual(500 + 450 + 100);
  });
  it('R2: không bám tường (đoạn hở không có căn hai bên) thì không đặt cửa ở đó', () => {
    const v = hanhLangThang(72000);
    v.o = v.o.filter((c) => c.o[0] < 24000 || c.o[0] >= 48000); // hở 24–48 m
    const c = cuaNganChay(v, 30000).flatMap((m) => m.cua);
    for (const x of c) expect(x.p[0] <= 24000 - 800 || x.p[0] >= 48000 + 800).toBe(true);
  });
  it('QT-100: sảnh thang máy cụt treo vào hành lang được cộng vào khoang (khoang = hành lang + sảnh)', () => {
    const v = hanhLangThang(24000);
    const goc = cncDem(hlDoThi(v), []).mang[0].L;
    v.truc.push({ ten: 'sảnh', p0: [12000, -hw], p1: [12000, -9000], corr: 3000, link: true, sanhLoi: true, sanhTM: true });
    const L = cncDem(hlDoThi(v), []).mang[0].L;
    expect(L - goc).toBeCloseTo(9000, -2); // tuyến sảnh kéo tới nút giao ở tim hành lang (khe ≤ 2,5 m — app cũ CNC_NOI)
    // 24 m hành lang + 8,1 m sảnh > 30 m → phải có một cửa, không đặt trong / trước sảnh (R3)
    const c = cuaNganChay(v, 30000).flatMap((m) => m.cua);
    expect(c).toHaveLength(1);
    expect(Math.abs(c[0].p[0] - 12000)).toBeGreaterThanOrEqual(1500 + hw + 1000);
  });
});

describe('block cửa (cncKhoi) + cửa kéo tay (QT-101)', () => {
  it('block hai cánh: mỗi tường một khuôn + nửa vòng 17 điểm bán kính ½ cửa, chạm tim hành lang; nhãn cách tim ½ cửa + 450', () => {
    const k = khoiCNC({ p: [0, 0], huong: [1, 0], w: 1800, bu: null });
    expect(k.net).toHaveLength(4);
    const cung = k.net.filter((x) => x.length === 17);
    expect(cung).toHaveLength(2);
    for (const c of cung) {
      expect(Math.abs(c[8][1])).toBeCloseTo(0, 0); // hai nửa vòng chạm nhau ở tim
      expect(Math.hypot(c[0][0] - c[16][0], c[0][1] - c[16][1])).toBeCloseTo(1800, 0); // dây cung = 2 × cánh
    }
    expect(k.nhan).toEqual([1350, 0]);
    expect(k.vung.map((p) => p.map(Math.round))).toEqual([[-900, -900], [900, -900], [900, 900], [-900, 900]]);
  });
  it('bù tường 150 hai bên khi vách xa hơn ½ cửa (chế độ nới / sảnh rộng)', () => {
    const k = khoiCNC({ p: [0, 0], huong: [1, 0], w: 1800, bu: [1500, 900] });
    const bu = k.net.filter((x) => x.length === 5);
    expect(bu).toHaveLength(1); // bên kia vách đúng ½ cửa: không bù
    const ys = bu[0].map((p) => p[1]);
    expect(Math.min(...ys)).toBeCloseTo(900, 0);
    expect(Math.max(...ys)).toBeCloseTo(1500, 0);
    expect(Math.max(...bu[0].map((p) => p[0])) - Math.min(...bu[0].map((p) => p[0]))).toBeCloseTo(150, 0);
  });
  it('kéo cửa: bám tim hành lang, bước 100 mm; xa hành lang (> ½ HL + 3 m) không bám; thêm chỉ khi bấm trong lòng hành lang', () => {
    const dt = hlDoThi(hanhLangThang(72000));
    expect(keoCuaTay(dt, [24130, 600])).toEqual([24100, 0]);
    expect(keoCuaTay(dt, [24130, 6000])).toBeNull();
    expect(themCuaTay(dt, [30010, 300])).toEqual([30010, 0]);
    expect(themCuaTay(dt, [30010, 1500])).toBeNull();
  });
  it('kéo cửa: không vào sảnh thang máy (R3) — chỗ đó trả null, cửa giữ nguyên', () => {
    const v = hanhLangThang(24000);
    v.truc.push({ ten: 'sảnh', p0: [12000, -hw], p1: [12000, -9000], corr: 3000, link: true, sanhLoi: true, sanhTM: true });
    const dt = hlDoThi(v);
    expect(keoCuaTay(dt, [12000, 0])).toBeNull();
    expect(keoCuaTay(dt, [6000, 0])).not.toBeNull();
  });
  it('bộ cửa tay: khoang tính lại trên đồ thị thật, cửa xa hành lang bị bỏ; thiếu cửa thì khoang > K (cảnh báo)', () => {
    const v = hanhLangThang(72000);
    const r = cuaNganChayTay(v, 30000, [[24000, 0], [48000, 0], [36000, 9000]]);
    expect(r.flatMap((m) => m.cua)).toHaveLength(2);
    expect(r.flatMap((m) => m.doan).sort((a, b) => b - a).map(Math.round)).toEqual([24000, 24000, 24000]);
    expect(Math.max(...cuaNganChayTay(v, 30000, [[24000, 0]]).flatMap((m) => m.doan))).toBeGreaterThan(30000);
    expect(cncDatDuoc(hlDoThi(v), 0, 24000)).toBe(true);
  });
  it('nét đo hành lang (Đo HL): mỗi khoang một nhóm khúc, tổng = khoang, vượt khi > K', () => {
    const v = hanhLangThang(72000);
    const cua = cuaNganChay(v, 30000).flatMap((m) => m.cua);
    const d = doHanhLang(v, 30000, cua);
    expect(d).toHaveLength(cua.length + 1);
    for (const k of d) expect(k.khuc.reduce((a, x) => a + x.L, 0)).toBeCloseTo(k.L, 0);
    expect(d.every((k) => !k.vuot)).toBe(true);
    expect(doHanhLang(v, 30000, [])[0].vuot).toBe(true);
  });
});
