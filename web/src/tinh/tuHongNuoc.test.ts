/**
 * Bộ đặt tủ họng nước chép app cũ (QT-77 / 77e / 77f / 77g): đối chiếu với app cũ chạy headless trên bố cục gốc 33 mẫu tòa, 25 tầng
 * (`scripts/tcc_cu.js` → `thu/tcc_cu.json`): số vị trí, số hộp, vị trí từng tủ, loại tủ / kiểu tường; thao tác tay (kéo bám tường,
 * tách / gộp) và hình block.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { napThuVien } from '../thu/thuVienThat';
import type { Diem } from './kieu';
import { matDaDon } from './matBang';
import { cuaTrenMat, dungDoThi, type ToaPCCC } from './pccc';
import { cuaHlCan, cuaNganChay, dauVaoCNC, netCuaCan, sanhCuaLoi, type LoiCNC } from './cuaNganChay';
import { bamTuongTu, datTuPCCC, dauVaoTCC, doiTuTay, hinhTu, khoiTu, tachGopTu, truM2, type DauVaoTCC, type HinhLoiTCC } from './tuHongNuoc';

type TuCu = { W: Diem; loai: string; kieu: string; uu: number; m2: number };
const CU = JSON.parse(readFileSync(new URL('../thu/tcc_cu.json', import.meta.url), 'utf8')) as Record<string, { corr: number; can: number; hop: number; thieu: string[]; tu: TuCu[] }>;
const { tv, dl } = napThuVien();
const theoMa = new Map([...tv.can.values()].map((c) => [c.ma_goc, c]));

/** Đầu vào trên bố cục gốc mẫu `id`, 25 tầng (H 87,2 m → khoang cửa lý tưởng ≤ 30 m). */
export function dauVaoGoc(id: string, tay: DauVaoTCC['tay'] = null): DauVaoTCC {
  const mau = tv.toa.get(id) as unknown as ToaPCCC;
  const mat = matDaDon(mau as never, { canTheo: {} }, tv);
  const toa = { ...mau, mat };
  const { can, thang } = cuaTrenMat(toa, dl.cuaCan);
  const cuaThang = mau.cua_thang?.length ? mau.cua_thang : thang.map((t) => t.p);
  const corr = CU[id]?.corr ?? (mau.nhom === 'xh' ? 1600 : 1800);
  const vc = dauVaoCNC({
    mat, truc: mau.hanh_lang ?? [], hanhLangMm: mau.hanh_lang_mm, corr: mau.hanh_lang_mm,
    loi: (b) => dl.loi.get(b) as LoiCNC | undefined, sanh: (b) => sanhCuaLoi(b, id),
    cuaCan: can.map((c) => c.p), cuaThang, tu: [],
    cuaCanNet: netCuaCan(mat, (ma) => { const c = theoMa.get(ma); return c ? [{ cat: 'door', pts: cuaHlCan(c, tv) ?? [] }] : undefined; }),
  });
  const cuaLT = cuaNganChay(vc, 30000).flatMap((m) => m.cua).map((c) => ({ p: c.p, u: c.u, w: c.w, bu: c.bu }));
  const G = dungDoThi(toa);
  return dauVaoTCC({
    mat, canh: G.canh.map((e) => ({ p0: e.p0, p1: e.p1, L: e.L })), truc: (mau.hanh_lang ?? []).map((a) => ({ p0: a.p0, p1: a.p1 })), corr,
    cuaCan: can.map((c) => c.p), cuaThang, loi: (b) => dl.loi.get(b) as HinhLoiTCC | undefined, canMau: (ma) => theoMa.get(ma), tv, soTang: 25, cuaLT, tay,
  });
}

describe('đối chiếu app cũ — 33 mẫu tòa, bố cục gốc, 25 tầng', () => {
  const ids = Object.keys(CU);
  const kq = ids.map((id) => ({ id, r: datTuPCCC(dauVaoGoc(id)) }));
  it('tổng số vị trí và số hộp bằng app cũ (139 vị trí)', () => {
    const tongCu = ids.reduce((a, id) => a + CU[id].tu.length, 0), hopCu = ids.reduce((a, id) => a + CU[id].hop, 0);
    const lech = kq.filter((x) => x.r.tu.length !== CU[x.id].tu.length).map((x) => `${x.id} ${x.r.tu.length}/${CU[x.id].tu.length}`);
    console.log('[tcc] số vị trí lệch:', lech.join(' · ') || '0', '· tổng', kq.reduce((a, x) => a + x.r.tu.length, 0), '/', tongCu);
    expect(kq.reduce((a, x) => a + x.r.tu.length, 0)).toBe(tongCu);
    expect(kq.reduce((a, x) => a + x.r.hop, 0)).toBe(hopCu);
  });
  it('số vị trí từng tòa lệch ≤ 1; ≥ 97 % tủ app cũ có tủ mới cùng loại cách ≤ 0,3 m (136 / 139 — lệch duy nhất V3 do cửa lý tưởng khác)', () => {
    let trung = 0, tong = 0;
    const sai: string[] = [];
    for (const x of kq) {
      expect(Math.abs(x.r.tu.length - CU[x.id].tu.length), x.id).toBeLessThanOrEqual(1);
      for (const t of CU[x.id].tu) {
        tong++;
        if (x.r.tu.some((y) => Math.hypot(y.W[0] - t.W[0], y.W[1] - t.W[1]) <= 300 && y.loai === t.loai)) trung++;
        else sai.push(`${x.id} ${t.W.join(',')} ${t.loai}/${t.kieu}`);
      }
    }
    console.log(`[tcc] khớp vị trí ${trung}/${tong}`, sai.slice(0, 40).join(' | '));
    expect(trung / tong).toBeGreaterThanOrEqual(0.97);
  });
  it('mọi tòa phủ đủ 2 tia (không căn thiếu) như app cũ', () => {
    for (const x of kq) expect(x.r.thieu, x.id).toEqual([]);
  });
  it('Z3 (tm-z3) khớp từng tủ: 2 tủ đôi lõi + cụm HKT + cụm tường ngăn L', () => {
    const x = kq.find((y) => y.id === 'tm-z3')!.r;
    expect(x.tu.map((t) => `${t.loai}/${t.kieu}`).sort()).toEqual(CU['tm-z3'].tu.map((t) => `${t.loai}/${t.kieu}`).sort());
    for (const t of CU['tm-z3'].tu) expect(Math.min(...x.tu.map((y) => Math.hypot(y.W[0] - t.W[0], y.W[1] - t.W[1])))).toBeLessThanOrEqual(300);
  });
});

describe('thao tác tay + hình block', () => {
  const v = dauVaoGoc('tm-z3'), kq = datTuPCCC(v);
  it('kéo tủ: bám tường hành lang (cách tim ½ HL), tủ khác giữ nguyên, phủ tính lại', () => {
    const t = kq.tu[1], p: Diem = [t.W[0] + 2000, t.W[1] + 300];
    const ds = doiTuTay(v, kq, null, 1, p)!;
    expect(ds).toHaveLength(kq.tu.length);
    const b = bamTuongTu(v, p)!;
    expect(Math.abs(b.pr.d - v.corr / 2)).toBeLessThan(2);
    const kq2 = datTuPCCC({ ...v, tay: ds });
    expect(kq2.tay).toBe(true);
    expect(kq2.tu).toHaveLength(kq.tu.length);
    expect(doiTuTay(v, kq, null, 1, [t.W[0], t.W[1] + 20000])).toBeNull(); // xa hành lang
  });
  it('kích đúp cụm → 2 tủ đơn cách 3 m; kích đúp tủ đơn → gộp lại một vị trí', () => {
    const i = kq.tu.findIndex((t) => t.loai === 'cum');
    const r = tachGopTu(v, kq, null, i);
    expect('ds' in r && r.kieu).toBe('tach');
    if (!('ds' in r)) return;
    const kq2 = datTuPCCC({ ...v, tay: r.ds });
    const don = kq2.tu.filter((t) => t.loai === 'don');
    expect(don).toHaveLength(2);
    expect(Math.hypot(don[0].W[0] - don[1].W[0], don[0].W[1] - don[1].W[1])).toBeGreaterThan(2500);
    const g = tachGopTu(v, kq2, r.ds, kq2.tu.indexOf(don[0]));
    expect('ds' in g && g.kieu).toBe('gop');
    if ('ds' in g) expect(datTuPCCC({ ...v, tay: g.ds }).tu.filter((t) => t.loai === 'don')).toHaveLength(0);
  });
  it('block CAD pccc-800x200: hai thân 400 × 200 âm vào tường, tường chữ L / U, DT trừ như QT-77g', () => {
    const t = kq.tu[0], k = khoiTu(t);
    expect(k.than).toHaveLength(t.loai === 'don' ? 1 : 2);
    const q = hinhTu(t).q;
    expect(Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1])).toBeCloseTo(800, 0);
    expect(khoiTu({ ...t, kieu: 'U' }).tuong).toHaveLength(8);
    expect(khoiTu({ ...t, kieu: 'L' }).tuong).toHaveLength(6);
    expect(truM2('doi', 'U', 140)).toBeCloseTo(0.1386, 4);
    expect(truM2('don', 'U', 140)).toBeCloseTo(0.0966, 4);
    expect(truM2('cum', 'loi', 140)).toBe(0);
  });
});
