/**
 * Quét thang liền suốt chiều cao (hợp thang mọi tầng): ở tầng 5 riêng, đổi lần lượt từng căn giữa sang mẫu rộng nhất cùng loại
 * và mẫu loại khác — sau tự chỉnh phải 0 đè, 0 khe (tinh/khe.ts) ở mọi tầng và thang liền mọi tầng.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { tongKhe } from './khe';
import { taoThuVien, type CanMau, type ToaDat, type ToaMau } from './kieu';
import { apMatBang, matBangRiengTang, tuChinhToa, type DuLieuMB, type HinhLoiMB, type ToaMB } from './loiThang';
import { boCucTang, viTriCan, type BoCuc } from './matBang';
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
const khe = (m: ToaMB, mb: NonNullable<ToaDat['matBang']>, bc: BoCuc) => tongKhe(apMatBang(m, mb, dl), tv, bc);
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

describe('quét thang liền: tầng riêng đổi căn giữa → 0 đè, 0 khe, thang liền mọi tầng', () => {
  it.each(MAU)('%s 24 tầng', (id) => {
    const m = mau(id), vts = viTriCan(m, tv), loi: string[] = [];
    // mốc: tòa không có tầng riêng (khe sẵn có của mẫu — vd. sân trong chữ U — không tính là khe mới)
    const t0 = tuChinhToa(toaThu(m), m, tv, dl), kb = khe(m, t0.matBang!, boCucTang(t0, null));
    let soCa = 0;
    const tk = { ca: 0, cungLoai: 0, khacLoai: 0, chonCung: 0, chonKhac: 0, bo: 0 };
    for (const vt of vts) {
      const c = tv.can.get(vt.canGocId);
      if (!c || c.vi_tri !== 'giua') continue;
      for (const den of dich(c)) {
        soCa++;
        const toa = tuChinhToa(doiCanTheoTang(toaThu(m), [5], vt, den, vts, false), m, tv, dl);
        const chung = toa.matBang!, mb5 = matBangRiengTang(toa, 5) ?? chung;
        const k5 = khe(m, mb5, boCucTang(toa, 5)), kc = khe(m, chung, boCucTang(toa, null));
        const ten = `${vt.khoa} ${vt.canGocId}→${den}`;
        const l = mb5.baoCao?.thangLien;
        if (k5.de > kb.de || kc.de > kb.de) loi.push(`${ten}: đè ${k5.de}/${kc.de} ${l ? 'lệch ' + l.conLech : 'không hợp thang'}`);
        if (k5.mm > kb.mm + 1 || kc.mm > kb.mm + 1) loi.push(`${ten}: khe ${Math.round(k5.mm - kb.mm)}/${Math.round(kc.mm - kb.mm)} ${l ? 'lệch ' + l.conLech : 'không hợp thang'}`);
        if (kyThang(mb5) !== kyThang(chung)) loi.push(`${ten}: thang không liền`);
        if (l?.conLech) loi.push(`${ten}: báo còn lệch ${l.conLech} mm`);
        // khít đoạn kẹp: không bỏ căn người dùng chọn; mỗi thay đổi có trong báo cáo và ghi ở tuDong (gỡ / hoàn tác được)
        for (const kk of new Set([mb5.baoCao?.khitKep, chung.baoCao?.khitKep])) {
          if (!kk) continue;
          tk.ca++;
          if (kk.bo.some((b) => b.khoa === vt.khoa)) loi.push(`${ten}: bỏ căn người dùng chọn`);
          for (const d of kk.doi) {
            const cung = tv.can.get(d.tu)?.loai === tv.can.get(d.den)?.loai;
            if (d.khoa === vt.khoa) tk[cung ? 'chonCung' : 'chonKhac']++; else tk[cung ? 'cungLoai' : 'khacLoai']++;
            if (!toa.tuDong?.some((x) => x.khoa === d.khoa && x.moi === d.den)) loi.push(`${ten}: đổi ${d.khoa} không ghi tuDong`);
          }
          tk.bo += kk.bo.length;
          for (const b of kk.bo) if (!toa.tuDong?.some((x) => x.khoa === b.khoa && x.moi === 'bo')) loi.push(`${ten}: bỏ ${b.khoa} không ghi tuDong`);
          if (kk.conMm) loi.push(`${ten}: còn ${kk.conMm} mm`);
        }
      }
    }
    console.log(id, 'số ca', soCa, 'khít', JSON.stringify(tk), 'lỗi', loi.length, '\n' + loi.join('\n'));
    expect(soCa).toBeGreaterThan(0);
    expect(loi).toEqual([]);
    if (process.env.THONG_KE) throw new Error('thống kê');
  }, 300_000);
});
