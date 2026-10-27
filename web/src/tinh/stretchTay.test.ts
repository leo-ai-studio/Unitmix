import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { doiCanTaiViTri } from './doiCan';
import { taoThuVien, type CanMau, type ToaMau } from './kieu';
import { canCuaToa, canDangDung, doanCan, donKhit, matDaDon, viTriCan, type BoCuc, type ToaCoMat } from './matBang';
import { thoatNan, chieuCaoPCCC, type ToaPCCC } from './pccc';
import { ST_MAX, stretchTay, tachMa, themBienThe } from './stretch';

const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const toaDs = doc<ToaMau[]>('toa.json'), canDs = doc<CanMau[]>('can.json');
const tv = themBienThe(taoThuVien(toaDs, canDs));
const mau = (id: string) => tv.toa.get(id) as ToaCoMat;
const trong: BoCuc = { canTheo: {} };

/** Áp kết quả `stretchTay` vào bố cục như ManTang làm (doiCanTaiViTri từng cặp). */
const ap = (bc: BoCuc, doi: [string, string][], m: ToaCoMat): BoCuc => {
  const vts = viTriCan(m, tv);
  return doi.reduce((a, [kh, id]) => doiCanTaiViTri(a as never, vts.find((v) => v.khoa === kh)!, id, vts, false) as BoCuc, bc);
};
const tongDoan = (m: ToaCoMat, bc: BoCuc) => {
  const dk = donKhit(m, viTriCan(m, tv), bc, tv);
  return doanCan(viTriCan(m, tv)).map((d) => ({ a0: d.a0, a1: d.a1, dung: d.ds.reduce((s, i) => s + dk.vts[i].a1 - dk.vts[i].a0, 0) }));
};

/** Tòa + vị trí đầu tiên kéo +100 được, tìm trong thư viện thật. */
function timCa() {
  for (const t of toaDs) {
    const m = mau(t.id);
    if (!Array.isArray(m.mat)) continue;
    for (const vt of viTriCan(m, tv)) {
      const r = stretchTay(m, trong, tv, vt.khoa, 100);
      if (r.ok) return { m, vt, r };
    }
  }
  throw new Error('không có căn nào kéo được');
}

describe('STRETCH tay từng căn (DC-04 · QT-81)', () => {
  it('kéo +100: căn kề bù −100, tổng bề ngang mỗi đoạn không đổi, không khe, không đè', () => {
    const { m, vt, r } = timCa();
    if (!r.ok) throw new Error();
    expect(r.doi).toHaveLength(2);
    const [[k1, id1], [, id2]] = r.doi;
    expect(k1).toBe(vt.khoa);
    expect(tachMa(id1).st).toBe(100);
    expect(tachMa(id2).st).toBe(-100);
    expect(tv.can.get(id1)!.rong_mm - tv.can.get(vt.canGocId)!.rong_mm).toBe(100);
    const bc = ap(trong, r.doi, m);
    const dk = donKhit(m, viTriCan(m, tv), bc, tv);
    expect(dk.lech).toEqual([]);
    expect(dk.de).toEqual([]);
    for (const d of tongDoan(m, bc)) expect(d.dung).toBeCloseTo(d.a1 - d.a0, 6);
    // hai đầu đoạn đứng yên: vị trí đầu / cuối của đoạn chứa căn kéo không dời
    const goc = viTriCan(m, tv), moi = dk.vts;
    for (const d of doanCan(goc)) {
      expect(moi[d.ds[0]].a0).toBeCloseTo(d.a0, 6);
      expect(moi[d.ds.at(-1)!].a1).toBeCloseTo(d.a1, 6);
    }
  });
  it('căn kề gần nhất được chọn bù khi nó kéo được', () => {
    const { m, vt, r } = timCa();
    if (!r.ok) throw new Error();
    const vts = viTriCan(m, tv), dn = doanCan(vts).find((o) => o.ds.includes(vts.findIndex((v) => v.khoa === vt.khoa)))!;
    const k = dn.ds.indexOf(vts.findIndex((v) => v.khoa === vt.khoa)), bu = vts.findIndex((v) => v.khoa === r.doi[1][0]);
    const gan = [dn.ds[k - 1], dn.ds[k + 1]].filter((i) => i !== undefined && tv.can.get(vts[i].canGocId)?.stretch);
    if (gan.length) expect(gan).toContain(bu);
  });
  it('DT, số căn và thoát nạn tính lại từ bố cục mới', () => {
    const { m, vt, r } = timCa();
    if (!r.ok) throw new Error();
    const bc = ap(trong, r.doi, m);
    const dem = canCuaToa(m, bc, tv);
    expect(dem.reduce((s, [, n]) => s + n, 0)).toBe(canCuaToa(m, trong, tv).reduce((s, [, n]) => s + n, 0)); // số căn không đổi
    const ids = dem.map(([id]) => id);
    expect(ids).toContain(r.doi[0][1]); // căn kéo là một mẫu riêng, có DT riêng
    const g = tv.can.get(vt.canGocId)!, b = tv.can.get(r.doi[0][1])!;
    expect(b.dt_tt_m2).toBeGreaterThan(g.dt_tt_m2);
    // thoát nạn chạy được trên mặt đã dồn khít
    if (Array.isArray((m as unknown as ToaPCCC).truc)) {
      const mat = matDaDon(m, bc, tv);
      expect(() => thoatNan({ ...(m as unknown as ToaPCCC), mat }, { chieuCaoPCCC: chieuCaoPCCC(1, 4.5, 25, 3.3) })).not.toThrow();
    }
  });
  it('chặn khi vượt ±500 (mỗi căn); kéo dồn tới 500 rồi bước thứ 6 bị từ chối', () => {
    const { m, vt } = timCa();
    let bc: BoCuc = trong, buoc = 0;
    for (; buoc < 8; buoc++) {
      const r = stretchTay(m, bc, tv, vt.khoa, 100);
      if (!r.ok) {
        expect(['vuotGioiHan', 'khongBu', 'khongKhit']).toContain(r.lyDo);
        break;
      }
      bc = ap(bc, r.doi, m);
      expect(Math.abs(tachMa(canDangDung(vt, bc)).st)).toBeLessThanOrEqual(ST_MAX);
    }
    expect(buoc).toBeLessThanOrEqual(ST_MAX / 100);
    if (buoc === ST_MAX / 100) expect(stretchTay(m, bc, tv, vt.khoa, 100)).toMatchObject({ ok: false, lyDo: 'vuotGioiHan' });
    expect(Math.abs(tachMa(canDangDung(vt, bc)).st)).toBeLessThanOrEqual(ST_MAX);
  });
  it('bước khác bội 100 bị từ chối; ô đổi công năng không phải căn', () => {
    const { m, vt } = timCa();
    expect(stretchTay(m, trong, tv, vt.khoa, 150)).toMatchObject({ ok: false, lyDo: 'khongKeoDuoc' });
    expect(stretchTay(m, { canTheo: {}, congNang: { [vt.khoa]: 'ky_thuat' } }, tv, vt.khoa, 100)).toMatchObject({ ok: false, lyDo: 'khongPhaiCan' });
  });
  it('không có căn kề bù: QT-69 dài dãy ở đầu cánh tự do, không thì chặn; tầng riêng (choDaiRa = false) luôn chặn', () => {
    const { m, vt } = timCa();
    const vts = viTriCan(m, tv), dn = doanCan(vts).find((o) => o.ds.includes(vts.findIndex((v) => v.khoa === vt.khoa)))!;
    const congNang = Object.fromEntries(dn.ds.filter((i) => vts[i].khoa !== vt.khoa).map((i) => [vts[i].khoa, 'ky_thuat' as const]));
    const r = stretchTay(m, { canTheo: {}, congNang }, tv, vt.khoa, 100);
    if (r.ok) {
      expect(r.daiRa).toMatchObject({ matIdx: vt.matIdx, mm: 100 });
      expect(r.doi).toHaveLength(1);
    } else expect(['daiRa', 'khongBu']).toContain(r.lyDo);
    const r2 = stretchTay(m, { canTheo: {}, congNang }, tv, vt.khoa, 100, { choDaiRa: false });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(['daiRa', 'khongBu']).toContain(r2.lyDo);
  });
  it('hoàn tác: kéo +100 rồi −100 trả đúng bố cục ban đầu (mẫu, số căn, tổng DT)', () => {
    const { m, vt, r } = timCa();
    if (!r.ok) throw new Error();
    const bc1 = ap(trong, r.doi, m);
    const r2 = stretchTay(m, bc1, tv, vt.khoa, -100);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    const bc2 = ap(bc1, r2.doi, m);
    const ids = (b: BoCuc) => viTriCan(m, tv).map((v) => canDangDung(v, b));
    expect(ids(bc2)).toEqual(ids(trong));
    expect(bc2.canViTri ?? {}).toEqual({});
    const tong = (b: BoCuc) => canCuaToa(m, b, tv).reduce((s, [id, n]) => s + tv.can.get(id)!.dt_tt_m2 * n, 0);
    expect(tong(bc2)).toBeCloseTo(tong(trong), 6);
  });
  it('quét mọi tòa: kéo ±100 từng căn kéo được — không khe, không đè, đoạn giữ tổng bề ngang', () => {
    let ok = 0, chan = 0;
    for (const t of toaDs) {
      const m = mau(t.id);
      if (!Array.isArray(m.mat)) continue;
      for (const vt of viTriCan(m, tv)) for (const d of [100, -100]) {
        const r = stretchTay(m, trong, tv, vt.khoa, d);
        if (!r.ok) { chan++; continue; }
        ok++;
        const bc = ap(trong, r.doi, m), dk = donKhit(m, viTriCan(m, tv), bc, tv);
        // QT-69: không có căn bù thì đúng một đoạn dài ra / ngắn lại đúng d ở đầu tự do; còn lại tổng bề ngang giữ nguyên
        if (r.daiRa) expect(dk.lech.map((l) => [l.matIdx, l.mm]), `${t.id} ${vt.khoa} ${d}`).toEqual([[vt.matIdx, d]]);
        else expect(dk.lech, `${t.id} ${vt.khoa} ${d}`).toEqual([]);
        expect(dk.de, `${t.id} ${vt.khoa} ${d}`).toEqual([]);
      }
    }
    expect(ok).toBeGreaterThan(1000); // đo được 1298 lượt kéo được / 246 lượt bị chặn
    expect(chan).toBeGreaterThan(0);
  });
});
