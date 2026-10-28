/**
 * Quét thang liền suốt chiều cao (hợp thang mọi tầng): ở tầng 5 riêng, đổi TAY lần lượt từng căn giữa sang mẫu rộng nhất cùng loại
 * và mẫu loại khác (tuChinhSauSua như màn Tầng) — sau tự chỉnh phải 0 đè, 0 khe (tinh/khe.ts, sân hở QT-69 được hẹp / rộng theo
 * đầu dãy) ở mọi tầng, thang liền mọi tầng, và KHÔNG ca nào tự đổi loại căn người dùng vừa chọn: hoặc nhận đúng loại đó, hoặc chặn
 * (giữ căn cũ, báo ô rộng / mẫu hẹp nhất). Thống kê: số ca chặn, số ca dãy dài ra / ngắn lại ở đầu hở ra sân trong.
 */
import { describe, expect, it } from 'vitest';
import { layMau } from '../thu/layMau';
import { existsSync, readFileSync } from 'node:fs';
import { taoThuVien, type CanMau, type ToaDat, type ToaMau } from './kieu';
import { apMatBang, doDeKhe, matBangRiengTang, tuChinhSauSua, tuChinhToa, type DuLieuMB, type HinhLoiMB, type ToaMB } from './loiThang';
import { boCucTang, canDangDung, viTriCan, type BoCuc } from './matBang';
import { tinhCuaCan } from './pccc';
import { themBienThe } from './stretch';
import { doiCanTheoTang } from './doiCan';

const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const toaDs = doc<ToaMau[]>('toa.json'), canDs = doc<CanMau[]>('can.json');
const tv = themBienThe(taoThuVien(toaDs, canDs));
const idLoi = (b: string) => 'loi-' + b.replace(/^x_/, '').replace(/_/g, '-');
const dl: DuLieuMB = { loi: new Map(), cuaCan: {} };
for (const t of toaDs) for (const m of (t as unknown as ToaMB).mat) for (const q of m.phan_tu)
  if (q.loai !== 'can' && !dl.loi.has(q.block) && existsSync(new URL(`loi/${idLoi(q.block)}.json`, lib))) dl.loi.set(q.block, doc<HinhLoiMB>(`loi/${idLoi(q.block)}.json`));
for (const c of canDs) dl.cuaCan[c.ma_goc] = tinhCuaCan(doc<{ ve: { cat: string; pts: [number, number][] }[] }>(`can/${c.id}.json`).ve, c.rong_mm);

const mau = (id: string) => tv.toa.get(id) as unknown as ToaMB;
const toaThu = (m: ToaMB): ToaDat =>
  ({ id: 't', loId: 'l', mauId: m.id, x: 0, y: 0, gocDo: 0, soTangDH: 24, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {} });
const kyThang = (mb: NonNullable<ToaDat['matBang']>) => mb.thangBo.map((t) => `${t.matIdx}:${Math.round(t.a0 + t.dIns)}:${t.sx}`).sort().join('|');

/** Mẫu căn giữa gốc (không biến thể STRETCH) để thử: rộng nhất cùng loại + rộng nhất mỗi loại khác, cùng nhóm, cùng chiều sâu. */
function dich(goc: CanMau): string[] {
  const gi = canDs.filter((x) => x.nhom === goc.nhom && x.vi_tri === 'giua' && x.sau_mm === goc.sau_mm);
  const ds: string[] = [];
  for (const loai of new Set(gi.map((x) => x.loai))) {
    const r = gi.filter((x) => x.loai === loai).sort((a, b) => b.rong_mm - a.rong_mm || a.id.localeCompare(b.id))[0];
    if (r && r.id !== goc.id) ds.push(r.id);
  }
  return ds;
}

const MAU = ['tm-i1', 'tm-l1', 'tm-u1', 'tm-z1', 'xh-z2'];
const tong = { ca: 0, chan: 0, daiSan: 0 };

describe('quét thang liền: tầng riêng đổi căn giữa → 0 đè, 0 khe, thang liền mọi tầng, không tự đổi loại căn vừa chọn', () => {
  it.each(MAU)('%s 24 tầng', (id) => {
    const m = mau(id), vts = viTriCan(m, tv), loi: string[] = [];
    // mốc: tòa không có tầng riêng (khe sẵn có của mẫu — hành lang cắt ngang… — không tính là khe mới)
    const t0 = tuChinhToa(toaThu(m), m, tv, dl), kb = doDeKhe(m, t0.matBang!, dl, tv, boCucTang(t0, null));
    let soCa = 0;
    const tk = { ca: 0, cungLoai: 0, khacLoai: 0, chonCung: 0, chonKhac: 0, bo: 0, chan: 0, chanHep: 0, chanDu: 0, daiSan: 0 };
    for (const vt of layMau(vts)) {
      const c = tv.can.get(vt.canGocId);
      if (!c || c.vi_tri !== 'giua') continue;
      for (const den of dich(c)) {
        soCa++;
        const truoc = toaThu(m);
        const r = tuChinhSauSua(truoc, doiCanTheoTang(truoc, [5], vt, den, vts, false), m, tv, dl), toa = r.toa;
        const chung = toa.matBang!, mb5 = matBangRiengTang(toa, 5) ?? chung;
        const bc5 = boCucTang(toa, 5), bcC = boCucTang(toa, null);
        const k5 = doDeKhe(m, mb5, dl, tv, bc5), kc = doDeKhe(m, chung, dl, tv, bcC);
        const ten = `${vt.khoa} ${vt.canGocId}→${den}`;
        const l = mb5.baoCao?.thangLien;
        if (k5.de > kb.de || kc.de > kb.de) loi.push(`${ten}: đè ${k5.de}/${kc.de} ${l ? 'lệch ' + l.conLech : 'không hợp thang'}`);
        if (k5.mm > kb.mm + 1 || kc.mm > kb.mm + 1) loi.push(`${ten}: khe ${Math.round(k5.mm - kb.mm)}/${Math.round(kc.mm - kb.mm)} ${l ? 'lệch ' + l.conLech : 'không hợp thang'}`);
        if (k5.san > kb.san || kc.san > kb.san) loi.push(`${ten}: sân trong không khớp nét bao ${k5.san}/${kc.san}`);
        if (kyThang(mb5) !== kyThang(chung)) loi.push(`${ten}: thang không liền`);
        if (l?.conLech) loi.push(`${ten}: báo còn lệch ${l.conLech} mm`);
        // căn người dùng vừa chọn: nhận đúng loại đã chọn, hoặc chặn (giữ căn cũ) — không bao giờ tự đổi sang loại thứ ba
        const loaiDen = tv.can.get(den)!.loai, loaiCu = c.loai, coi = tv.can.get(canDangDung(vt, bc5))?.loai;
        if (r.chan.length) {
          tk.chan++;
          const ch = r.chan.find((x) => x.khoa === vt.khoa);
          if (!ch) loi.push(`${ten}: chặn ô khác ${r.chan.map((x) => x.khoa).join(',')}`);
          else if (ch.loai !== loaiDen || !(ch.rongO > 0) || (ch.kieu === 'hep') !== (ch.rongMin > ch.rongO)) loi.push(`${ten}: báo chặn sai ${JSON.stringify(ch)}`);
          else tk[ch.kieu === 'hep' ? 'chanHep' : 'chanDu']++;
          if (coi !== loaiCu) loi.push(`${ten}: chặn mà ô không về loại cũ (${coi})`);
        } else if (coi !== loaiDen) loi.push(`${ten}: tự đổi loại căn vừa chọn ${loaiDen} → ${coi}`);
        if (mb5.baoCao?.daiSan || chung.baoCao?.daiSan) tk.daiSan++;
        // khít đoạn kẹp: không bỏ căn người dùng chọn; mỗi thay đổi có trong báo cáo và ghi ở tuDong (gỡ / hoàn tác được)
        for (const kk of new Set([mb5.baoCao?.khitKep, chung.baoCao?.khitKep])) {
          if (!kk) continue;
          tk.ca++;
          if (kk.bo.some((b) => b.khoa === vt.khoa)) loi.push(`${ten}: bỏ căn người dùng chọn`);
          for (const d of kk.doi) {
            const cung = tv.can.get(d.tu)?.loai === tv.can.get(d.den)?.loai;
            if (d.khoa === vt.khoa) tk[cung ? 'chonCung' : 'chonKhac']++; else tk[cung ? 'cungLoai' : 'khacLoai']++;
            if (d.khoa === vt.khoa && !cung) loi.push(`${ten}: khít đổi loại căn vừa chọn`);
            if (!toa.tuDong?.some((x) => x.khoa === d.khoa && x.moi === d.den)) loi.push(`${ten}: đổi ${d.khoa} không ghi tuDong`);
          }
          tk.bo += kk.bo.length;
          for (const b of kk.bo) if (!toa.tuDong?.some((x) => x.khoa === b.khoa && x.moi === 'bo')) loi.push(`${ten}: bỏ ${b.khoa} không ghi tuDong`);
          if (kk.conMm) loi.push(`${ten}: còn ${kk.conMm} mm`);
        }
      }
    }
    tong.ca += soCa; tong.chan += tk.chan; tong.daiSan += tk.daiSan;
    console.log(id, 'số ca', soCa, 'khít', JSON.stringify(tk), 'lỗi', loi.length, '\n' + loi.join('\n'), '\ncộng dồn', JSON.stringify(tong));
    expect(soCa).toBeGreaterThan(0);
    expect(loi).toEqual([]);
    if (process.env.THONG_KE) throw new Error('thống kê');
  }, 300_000);
});

// tm-u1: hai cánh mặt B nhìn nhau qua sân trong 24,5 m — đầu dãy hở ra sân được dài ra (QT-69), không phải đổi loại căn
describe('QT-69 · tm-u1 đầu dãy hở ra sân trong', () => {
  const m = mau('tm-u1'), vts = viTriCan(m, tv);
  const vt = vts.find((v) => v.khoa === '1:5')!; // 1PN giữa cánh trái mặt B, đoạn giữa ô thang và sân trong
  const den = canDs.filter((x) => x.nhom === 'tm' && x.vi_tri === 'giua' && x.loai === '2pn' && x.sau_mm === 8500).sort((a, b) => b.rong_mm - a.rong_mm)[0];
  const t0 = tuChinhToa(toaThu(m), m, tv, dl);
  const dai = den.rong_mm - tv.can.get(vt.canGocId)!.rong_mm;

  it.each([['chung', null], ['tầng 5 riêng', 5]] as const)('đổi 1PN → 2PN rộng nhất (%s): dãy dài ra ở đầu sân, nét bao + DTXD theo, giữ căn đã chọn', (_, tang) => {
    const truoc = toaThu(m);
    const sau = tang === null ? { ...truoc, canViTri: { [vt.khoa]: den.id } } : doiCanTheoTang(truoc, [tang], vt, den.id, vts, false);
    const r = tuChinhSauSua(truoc, sau, m, tv, dl);
    expect(r.chan).toEqual([]);
    const bc: BoCuc = boCucTang(r.toa, tang), mb = (tang === null ? null : matBangRiengTang(r.toa, tang)) ?? r.toa.matBang!;
    expect(canDangDung(vt, bc)).toBe(den.id);
    expect(mb.baoCao?.daiSan).toEqual({ so: 1, mm: dai });
    expect(mb.baoCao?.khitKep).toBeUndefined(); // không phải đổi / bỏ căn nào
    // DTXD tăng đúng phần dãy dài ra (bề sâu bay 8,5 m)
    const dt0 = t0.matBang!.baoCao!.dtxdM2, dt1 = mb.baoCao!.dtxdM2;
    expect(dt1 - dt0).toBeCloseTo((dai * 8500) / 1e6, 0);
    if (tang === null) expect(r.toa.dtxdM2).toBeCloseTo(dt1, 1);
    const k = doDeKhe(m, mb, dl, tv, bc), kb = doDeKhe(m, t0.matBang!, dl, tv, boCucTang(t0, null));
    expect(k).toEqual({ de: kb.de, mm: kb.mm, san: 0 });
    // thang liền mọi tầng
    expect(kyThang(mb)).toBe(kyThang(r.toa.matBang!));
  });

  it('sân còn lại phải ≥ cỡ hành lang: đổi cả dãy sang căn rộng nhất thì không lấp sân', () => {
    const truoc = toaThu(m);
    const rong = (loai: string) => canDs.filter((x) => x.nhom === 'tm' && x.vi_tri === 'giua' && x.loai === loai && x.sau_mm === 8500).sort((a, b) => b.rong_mm - a.rong_mm)[0].id;
    // hai cánh cùng dài vào một sân: 4 căn → 2PN+ rộng nhất (~ +16 m trên sân 24,5 m) — sân còn lại phải giữ cỡ hành lang
    const sau = { ...truoc, canViTri: { '1:4': rong('2pnp'), '1:5': rong('2pnp'), '1:8': rong('2pnp'), '1:9': rong('2pnp') } };
    const r = tuChinhSauSua(truoc, sau, m, tv, dl);
    const bc = boCucTang(r.toa, null), k = doDeKhe(m, r.toa.matBang!, dl, tv, bc), kb = doDeKhe(m, t0.matBang!, dl, tv, boCucTang(t0, null));
    expect(k.de).toBe(0);
    expect(k.san).toBe(0);
    expect(k.mm).toBeLessThanOrEqual(kb.mm + 1);
    const vs = viTriCan(apMatBang(m, r.toa.matBang!, dl), tv, bc).filter((v) => v.matIdx === 1);
    const trai = Math.max(...vs.filter((v) => v.a1 < 62000).map((v) => v.a1)), phai = Math.min(...vs.filter((v) => v.a0 > 62000).map((v) => v.a0));
    const rongMax = Math.max(...vs.map((v) => v.a1 - v.a0));
    expect(phai - trai).toBeGreaterThan(rongMax + 500); // XC-02: vẫn là khoảng trống cỡ hành lang
    // căn không đặt vừa thì chặn (giữ căn cũ), không tự đổi loại
    for (const k2 of ['1:4', '1:5', '1:8', '1:9']) {
      const loai = tv.can.get(bc.canViTri?.[k2] ?? vts.find((v) => v.khoa === k2)!.canGocId)!.loai;
      expect(r.chan.some((c) => c.khoa === k2) ? loai !== '2pnp' : loai === '2pnp').toBe(true);
    }
  });
});

// tm-i1 ô 0:8 kẹp giữa ô thang và lõi chỉ rộng ~5,9 m: chọn tay 2PN thì chặn, giữ căn cũ, báo ô rộng / mẫu hẹp nhất
describe('chặn đổi căn không vừa ô kẹp', () => {
  const m = mau('tm-i1'), vts = viTriCan(m, tv), vt = vts.find((v) => v.khoa === '0:8')!;
  const den = canDs.filter((x) => x.nhom === 'tm' && x.vi_tri === 'giua' && x.loai === '2pn' && x.sau_mm === 8500).sort((a, b) => a.rong_mm - b.rong_mm)[0];

  it('tm-i1 0:8 → 2PN: chặn, giữ căn cũ, hoàn tác không cần (bố cục như trước)', () => {
    const truoc = toaThu(m);
    const r = tuChinhSauSua(truoc, doiCanTheoTang(truoc, [5], vt, den.id, vts, false), m, tv, dl);
    expect(r.chan.map((c) => [c.khoa, c.loai])).toEqual([['0:8', '2pn']]);
    const ch = r.chan[0];
    expect(ch.rongO).toBeGreaterThan(5000);
    expect(ch.rongO).toBeLessThan(ch.rongMin);
    expect(canDangDung(vt, boCucTang(r.toa, 5))).toBe(vt.canGocId);
    expect(r.toa.tuDong ?? []).toEqual(tuChinhToa(toaThu(m), m, tv, dl).tuDong ?? []);
  });

  it('bộ tối ưu tự động (tuChinhToa, không phải chọn tay) vẫn được đổi loại để khít', () => {
    const t = tuChinhToa(doiCanTheoTang(toaThu(m), [5], vt, den.id, vts, false), m, tv, dl);
    const loai = tv.can.get(canDangDung(vt, boCucTang(t, 5)))?.loai;
    expect(loai).not.toBe('2pn');
    expect(t.tuDong?.some((d) => d.tang === 5 && d.khoa === '0:8' && d.truong === 'canViTri')).toBe(true);
  });
});
