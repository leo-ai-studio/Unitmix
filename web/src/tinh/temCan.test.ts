/**
 * Tem căn ngoài mặt tiền — luật app cũ `xepTem` / `temGoc` / `neoTemKhung` (QT-11 · QT-34) + bổ sung QT-34b (tinh/temCan.ts):
 *  - mọi mẫu tòa × góc xoay × mặt bằng tự chỉnh / tầng riêng: 0 tem đè hình (căn, lõi, thang, nét bao DTXD), 0 cặp tem chồng nhau;
 *  - khớp app cũ: tem đặt ở đúng chỗ app cũ đặt (thu/tem_cu.json, chụp bằng scripts/tem_cu.js trên MDI_Unitmix_v4);
 *  - tem dời có đường dẫn; tem gốc cách mặt tiền đúng TAG_OFF.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { napThuVien, toaThu } from '../thu/thuVienThat';
import type { Diem, ToaDat } from './kieu';
import { daGiacCacLoi, mauHieuDung, type ToaMB } from './loiThang';
import { boCucTang, canDangDung, congNangTai, viTriCan, type ToaCoMat } from './matBang';
import { datTemCan, hopChamDG, hopTem, TEM_CACH, TEM_H, TEM_W, vatCanTem, type CanTem, type KetQuaTem } from './temCan';

const { tv, dl, toaDs } = napThuVien();
const ds = toaDs as unknown as (ToaCoMat & ToaMB)[];
type TemCu = { code: string; chong: number; de: number; truoc: { chong: number; de: number }; tem: { no: string; goc: Diem; tam: Diem; dan: Diem[] | null }[] };
const cu = JSON.parse(readFileSync(new URL('../thu/tem_cu.json', import.meta.url), 'utf8')) as Record<string, TemCu>;

const canCua = (mau: ToaCoMat, bc: Pick<ToaDat, 'canTheo' | 'canViTri' | 'congNang' | 'latO'>): CanTem[] =>
  viTriCan(mau, tv, bc).map((vt) => ({ vt, canId: canDangDung(vt, bc), cn: congNangTai(vt.khoa, bc) }));

/** Đếm vi phạm: tem chạm vật cản (căn / lõi / thang / nét bao), cặp tem chồng nhau (hộp đúng cỡ, không lề). */
const loiCua = (mau: ToaCoMat) => daGiacCacLoi(mau as ToaCoMat & ToaMB, dl);
const temCua = (mau: ToaCoMat, can: CanTem[]) => datTemCan(mau, tv, can, loiCua(mau));
function viPham(mau: ToaCoMat, can: CanTem[], kq: KetQuaTem) {
  const vat = vatCanTem(mau, tv, can, loiCua(mau));
  let de = 0, chong = 0;
  kq.tem.forEach((a, i) => {
    if (vat.some((P) => hopChamDG(hopTem(a.cx, a.cy), P))) de++;
    kq.tem.forEach((b, j) => { if (j > i && Math.abs(a.cx - b.cx) < TEM_W && Math.abs(a.cy - b.cy) < TEM_H) chong++; });
  });
  return { de, chong };
}

/** Xoay cả mẫu tòa quanh gốc toạ độ θ độ (mặt, phần tử, nét bao) — như tòa xoay trên TMB vẽ theo hướng thật. */
function xoay<T extends ToaCoMat>(mau: T, th: number): T {
  const r = (th * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const p = ([x, y]: Diem): Diem => [x * c - y * s, x * s + y * c];
  return {
    ...mau, duong_bao: mau.duong_bao.map(p),
    mat: mau.mat.map((m) => ({ ...m, goc_deg: m.goc_deg + th, phan_tu: m.phan_tu.map((q) => {
      const [x, y] = p([q.x, q.y]);
      const { bb_ve_mm: _bb, ...con } = q as typeof q & { bb_ve_mm?: number[] };
      return { ...con, x, y, rot: q.rot + th };
    }) })),
  };
}

const maCu = (id: string) => `hn_${id.replace('-', '_')}`;

describe('tem căn — chép luật app cũ xepTem (QT-11 · QT-34) + QT-34b', () => {
  it('mọi mẫu tòa (bố cục bản vẽ): 0 tem đè hình, 0 tem chồng nhau, mỗi căn một tem', () => {
    const xau: string[] = [];
    for (const mau of ds) {
      const can = canCua(mau, { canTheo: {} });
      const kq = temCua(mau, can);
      const v = viPham(mau, can, kq);
      expect(kq.tem.length).toBe(can.length);
      if (v.de || v.chong || kq.vuong) xau.push(`${mau.id} đè ${v.de} chồng ${v.chong} vướng ${kq.vuong}`);
    }
    expect(xau).toEqual([]);
  });

  it('khớp vị trí tem app cũ (MDI_Unitmix_v4 xepTem) trên bố cục bản vẽ', () => {
    const lech: string[] = [];
    let so = 0, khop = 0;
    for (const mau of ds) {
      const c = cu[maCu(mau.id)];
      if (!c) continue;
      const kq = temCua(mau, canCua(mau, { canTheo: {} }));
      for (const t of c.tem) {
        so++;
        const gan = kq.tem.reduce((m, x) => Math.min(m, Math.hypot(x.cx - t.tam[0], x.cy - t.tam[1])), Infinity);
        if (gan <= 30) khop++;
        else {
          const g = kq.tem.reduce((m, x) => (Math.hypot(x.cx - t.goc[0], x.cy - t.goc[1]) < Math.hypot(m.cx - t.goc[0], m.cy - t.goc[1]) ? x : m));
          lech.push(`${mau.id} ${t.no} cũ gốc ${t.goc} → ${t.tam} · mới ${Math.round(g.cx)},${Math.round(g.cy)} doi=${g.doi}`);
        }
      }
    }
    if (process.env.UNITMIX_IN) process.stderr.write(`tem khớp app cũ: ${khop}/${so}\n${lech.join('\n')}\n`);
    expect(so).toBeGreaterThan(600);
    expect(khop / so).toBeGreaterThan(0.97);
  });

  it('tem gốc cách mặt tiền TAG_OFF; tem dời có đường dẫn bắt đầu ở chân mặt tiền', () => {
    for (const mau of ds) {
      const kq = temCua(mau, canCua(mau, { canTheo: {} }));
      for (const t of kq.tem) {
        const r = (TEM_W / 2) * Math.abs(t.huong[0]) + (TEM_H / 2) * Math.abs(t.huong[1]);
        const d = (t.cx - t.chan[0]) * t.huong[0] + (t.cy - t.chan[1]) * t.huong[1];
        if (!t.doi) expect(Math.abs(d - (TEM_CACH + r))).toBeLessThan(2);
        if (t.dan) expect(Math.hypot(t.dan[0][0] - t.chan[0], t.dan[0][1] - t.chan[1])).toBeLessThan(1);
      }
    }
  });

  it('mọi mẫu × 6 góc xoay: 0 đè, 0 chồng', () => {
    const xau: string[] = [];
    for (const mau0 of ds) for (const th of [30, 45, 90, 135, 210, 333]) {
      const mau = xoay(mau0, th), can = canCua(mau, { canTheo: {} });
      const kq = temCua(mau, can), v = viPham(mau, can, kq);
      if (v.de || v.chong || kq.vuong) xau.push(`${mau0.id}@${th}° đè ${v.de} chồng ${v.chong} vướng ${kq.vuong}`);
    }
    expect(xau).toEqual([]);
  });

  it('mặt bằng tự chỉnh (mặc định) + tầng riêng đổi căn: 0 đè, 0 chồng', () => {
    const xau: string[] = [];
    for (const mau0 of ds) {
      const toa = toaThu(mau0.id, 24);
      const mau = mauHieuDung(toa, mau0, dl, null) as ToaCoMat & ToaMB;
      const bc = boCucTang(toa, null), can = canCua(mau, bc);
      const kq = temCua(mau, can), v = viPham(mau, can, kq);
      if (v.de || v.chong || kq.vuong) xau.push(`${mau0.id} tự chỉnh đè ${v.de} chồng ${v.chong} vướng ${kq.vuong}`);
      // tầng riêng: đổi ô thứ 2 sang công năng khác (vẫn là vật cản, không tem)
      const k2 = can[1]?.vt.khoa;
      if (!k2) continue;
      const toa2: ToaDat = { ...toa, tangRieng: { 3: { congNang: { [k2]: 'ky_thuat' } } } } as ToaDat;
      const mau2 = mauHieuDung(toa2, mau0, dl, 3) as ToaCoMat & ToaMB, bc2 = boCucTang(toa2, 3), can2 = canCua(mau2, bc2);
      const kq2 = temCua(mau2, can2), v2 = viPham(mau2, can2, kq2);
      expect(kq2.tem.length).toBe(can2.filter((c) => c.cn === 'can').length);
      if (v2.de || v2.chong || kq2.vuong) xau.push(`${mau0.id} tầng 3 đè ${v2.de} chồng ${v2.chong} vướng ${kq2.vuong}`);
    }
    expect(xau).toEqual([]);
  });

  it('nhanh: giải một tầng (chưa nhớ) dưới 25 ms mọi mẫu — chạy trên luồng chính không thành tác vụ dài', () => {
    let max = 0, ten = '';
    for (const mau0 of ds) {
      const mau = { ...mau0 }, can = canCua(mau, { canTheo: {} }), L = loiCua(mau);
      const t0 = performance.now();
      datTemCan(mau, tv, can, L);
      const dt = performance.now() - t0;
      if (dt > max) { max = dt; ten = mau0.id; }
    }
    if (process.env.UNITMIX_IN) process.stderr.write(`giải tem chậm nhất ${max.toFixed(1)} ms (${ten})\n`);
    expect(max).toBeLessThan(25);
  });

  it('nhớ theo mặt bằng: gọi lại trả cùng kết quả, không giải lại', () => {
    const mau = ds.find((x) => x.id === 'tm-v1')!, can = canCua(mau, { canTheo: {} });
    const L = loiCua(mau), a = datTemCan(mau, tv, can, L), b = datTemCan(mau, tv, can.map((x) => ({ ...x })), L);
    expect(b).toBe(a);
  });
});
