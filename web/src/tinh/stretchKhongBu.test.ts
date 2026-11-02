/**
 * STRETCH không bù ngược (màn Tầng): kéo căn (một hoặc mọi căn cùng mẫu) ±100 mm, KHÔNG đổi căn kề ở bước kéo; dãy khít lại do
 * tự chỉnh (tuChinhSauSua). Kiểm: kết quả chỉ chứa căn đã chọn, vượt ±500 mm thì chặn cả lượt, sau tự chỉnh 0 đè / 0 khe mới,
 * căn vừa kéo giữ đúng mẫu đã kéo (hoặc bị chặn — giữ nguyên), không bị tự đổi sang mẫu khác.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { layMau } from '../thu/layMau';
import { doiCanTaiViTri } from './doiCan';
import { taoThuVien, type CanMau, type ToaDat, type ToaMau } from './kieu';
import { doDeKhe, tuChinhSauSua, tuChinhToa, type DuLieuMB, type HinhLoiMB, type ToaMB } from './loiThang';
import { boCucTang, canDangDung, viTriCan } from './matBang';
import { tinhCuaCan } from './pccc';
import { ST_MAX, stretchKhongBu, tachMa, themBienThe } from './stretch';

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

describe('stretchKhongBu · kết quả thuần', () => {
  const m = mau('tm-i1'), vts = viTriCan(m, tv), bc = { canTheo: {} };
  const keoDuoc = vts.filter((v) => tv.can.get(v.canGocId)?.stretch);

  it('chỉ trả đúng các căn đã chọn, mỗi căn lệch đúng d so với mẫu đang dùng', () => {
    const ks = keoDuoc.slice(0, 3).map((v) => v.khoa);
    const r = stretchKhongBu(m, bc, tv, ks, 100);
    if (!r.ok) throw new Error(r.lyDo);
    expect(r.doi.map(([k]) => k)).toEqual(ks);
    for (const [k, id] of r.doi) {
      const v = vts.find((x) => x.khoa === k)!;
      expect(tachMa(id).goc).toBe(tachMa(canDangDung(v, bc)).goc);
      expect(tachMa(id).st).toBe(tachMa(canDangDung(v, bc)).st + 100);
    }
  });
  it('vượt ±ST_MAX hoặc không phải bội ST_BUOC thì chặn cả lượt, báo đúng căn', () => {
    const k = keoDuoc[0].khoa;
    const r = stretchKhongBu(m, bc, tv, [k], ST_MAX + 100);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.lyDo).toBe('vuotGioiHan'); expect(r.khoa).toBe(k); }
    expect(stretchKhongBu(m, bc, tv, [k], 30).ok).toBe(false);
  });
  it('ô không phải căn thì chặn', () => {
    const khongCan = vts.find((v) => !tv.can.get(v.canGocId)?.stretch);
    if (khongCan) expect(stretchKhongBu(m, bc, tv, [khongCan.khoa], 100).ok).toBe(false);
  });
});

describe('stretchKhongBu + tự chỉnh: dãy tự khít, không khe / đè mới, căn vừa kéo giữ nguyên mẫu đã kéo hoặc bị chặn', () => {
  it.each(['tm-i1', 'tm-l1', 'tm-u1', 'tm-z1', 'xh-z2'])('%s', (id) => {
    const m = mau(id), vts = viTriCan(m, tv), loi: string[] = [];
    const t0 = tuChinhToa(toaThu(m), m, tv, dl), kb = doDeKhe(m, t0.matBang!, dl, tv, boCucTang(t0, null));
    let ca = 0, chan = 0;
    for (const vt of layMau(vts.filter((v) => tv.can.get(v.canGocId)?.stretch))) {
      for (const d of [100, -100]) {
        for (const nhom of ['mot', 'cungMau'] as const) {
          const ks = nhom === 'mot' ? [vt.khoa] : vts.filter((v) => v.canGocId === vt.canGocId).map((v) => v.khoa);
          const truoc = toaThu(m), bc = boCucTang(truoc, null);
          const kq = stretchKhongBu(m, bc, tv, ks, d);
          if (!kq.ok) continue;
          ca++;
          const sau = kq.doi.reduce((a, [kh, mid]) => doiCanTaiViTri(a, vts.find((v) => v.khoa === kh)!, mid, vts, false), truoc);
          const r = tuChinhSauSua(truoc, sau, m, tv, dl);
          const mb = r.toa.matBang!, bc2 = boCucTang(r.toa, null), k = doDeKhe(m, mb, dl, tv, bc2);
          const ten = `${vt.khoa} ${d} ${nhom}`;
          if (k.de > kb.de) loi.push(`${ten}: đè ${k.de}`);
          if (k.mm > kb.mm + 1) loi.push(`${ten}: khe ${Math.round(k.mm - kb.mm)} mm`);
          if (r.chan.length) { chan++; continue; }
          // một căn: giữ đúng mẫu đã kéo. Nhiều căn cùng mẫu: cả dãy có thể không đủ chỗ (tổng bề ngang đoạn cố định) → khít giãn / co lại
          // chính các căn đã chọn theo quy tắc, chỉ đòi 0 đè / 0 khe
          if (nhom === 'cungMau') continue;
          for (const [kh, mid] of kq.doi) {
            const v = vts.find((x) => x.khoa === kh)!;
            // không khít được (đoạn không có chỗ) thì về mẫu cũ — UI báo 'st.loi.khongKhit'; không bao giờ sang mẫu thứ ba
            if (canDangDung(v, bc2) !== mid && canDangDung(v, bc2) !== canDangDung(v, bc)) loi.push(`${ten}: ${kh} bị tự đổi ${mid} → ${canDangDung(v, bc2)}`);
          }
        }
      }
    }
    console.log(id, 'ca', ca, 'chặn', chan, 'lỗi', loi.length, '\n' + loi.join('\n'));
    expect(ca).toBeGreaterThan(0);
    expect(loi).toEqual([]);
  }, 300_000);
});
