/**
 * Căn thêm tay (công cụ "Thêm căn" màn Tầng — app cũ `tAdd`: chèn ô sau ô đang chọn, dồn khít, QT-69 dãy đầy thì dài ra ở đầu cánh).
 * Mẫu tòa thư viện không đổi: `mauMoRong` dựng "mẫu tòa mở rộng" có thêm phần tử căn (nối vào cuối danh sách phần tử của mặt, khoá
 * "<mặt>:<chỉ số>" ổn định), các phần tử phía đầu tự do dời đi đúng bề ngang căn mới, mép mặt + nét bao + DTXD theo. Mọi chỗ cần
 * mẫu của MỘT tòa gọi `mauToa(tv, toa)` (tòa không thêm căn thì trả đúng mẫu thư viện — không đổi hành vi).
 */
import type { CanThem, Diem, ThuVien, ToaDat, ToaMau } from './kieu';
import { coMat, type ToaCoMat } from './matBang';
import { BAY_MM, ghiMauGocLoi, layMauGocLoi, noiNetBao, type ToaMB } from './loiThang';
import { thayLoiMau } from './thayLoi';

const rad = (d: number) => (d * Math.PI) / 180;
const trongDG = (p: Diem, P: Diem[]) => {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};
const dtDG = (P: Diem[]) => Math.abs(P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;

/** Hai phần tử cách nhau ≤ 600 mm coi là cùng một dãy liền (KHE_HUT_MM của XC-03). */
const KHE_LIEN_MM = 600;

export type LyDoThem ='khong_o' | 'khong_mau' | 'khong_dau_tu_do';

/**
 * Thêm MỘT căn vào mẫu `m` (sửa tại chỗ). Phía dời: đầu mặt tự do (điểm cách mép 1 m ra ngoài, giữa bay, nằm ngoài nét bao) mà giữa
 * chỗ chèn và đầu đó không có lõi; ưu tiên đầu cuối. Không có thì trả lý do (không đổi gì).
 */
function themMot(m: ToaCoMat, e: CanThem, tv: ThuVien): LyDoThem | null {
  const f = m.mat[e.mat];
  // chèn sau ô `sau`, hoặc trước ô `truoc` (đầu dãy)
  const neo = e.sau ?? e.truoc, laTruoc = !e.sau && !!e.truoc;
  const iSau = f && neo ? f.phan_tu.findIndex((q, i) => (q.khoa ?? `${e.mat}:${i}`) === neo && q.loai === 'can') : -1;
  if (!f || iSau < 0) return 'khong_o';
  const c = tv.can.get(e.id);
  if (!c) return 'khong_mau';
  const q = f.phan_tu[iSau], w = c.rong_mm, u: Diem = [Math.cos(rad(f.goc_deg)), Math.sin(rad(f.goc_deg))], n: Diem = [-u[1], u[0]];
  const pt = (a: number, b: number): Diem => [u[0] * a + n[0] * (f.truc_mm + b), u[1] * a + n[1] * (f.truc_mm + b)];
  const p = laTruoc ? q.a0 : q.a1;
  // dãy liền chứa ô chọn (khe ≤ 600 mm): chỉ dãy này dời — cánh khác cùng mặt (bên kia sân trong) đứng yên
  const sx = f.phan_tu.filter((x) => x.a1 - x.a0 > 1).sort((a, b) => a.a0 - b.a0);
  const k = sx.indexOf(q);
  let i0 = k, i1 = k;
  while (i1 + 1 < sx.length && sx[i1 + 1].a0 - sx[i1].a1 <= KHE_LIEN_MM) i1++;
  while (i0 > 0 && sx[i0].a0 - sx[i0 - 1].a1 <= KHE_LIEN_MM) i0--;
  const thu = (cuoi: boolean): boolean => {
    // phần dãy phía đầu được dời: sau điểm chèn (dời ra cuối) / trước điểm chèn (dời ra đầu)
    const day = sx.slice(i0, i1 + 1).filter((x) => (cuoi ? x.a0 >= p - 1 : x.a1 <= p + 1));
    const E = cuoi ? sx[i1].a1 : sx[i0].a0;
    // lõi không chiếm bề ngang nằm trong đoạn dời → không dời được
    if (f.phan_tu.some((x) => x.loai !== 'can' && x.loai !== 'thang_bo' && (cuoi ? x.a0 >= p - 1 && x.a0 <= E + 1 : x.a0 >= E - 1 && x.a0 <= p + 1))) return false;
    // đầu dãy phải hở ra ngoài nét bao, đủ chỗ cho căn mới + 1 m, và không lấn tới cánh kế bên (sân còn ≥ 500 mm)
    const ra = cuoi ? 1 : -1;
    if ([1000, w + 1000].some((x) => trongDG(pt(E + ra * x, BAY_MM / 2), m.duong_bao))) return false;
    const ke = cuoi ? sx[i1 + 1] : sx[i0 - 1];
    if (ke && (cuoi ? ke.a0 - (E + w) : E - w - ke.a1) < 500) return false;
    // cạnh nét bao ở đầu dãy (có thể lệch mép khung căn vài chục mm — như noiDauSan của tự chỉnh)
    const r = rad(f.goc_deg), ab = (pp: Diem): Diem => [pp[0] * Math.cos(r) + pp[1] * Math.sin(r), -pp[0] * Math.sin(r) + pp[1] * Math.cos(r) - f.truc_mm];
    const Q = m.duong_bao.map(ab);
    const canh = Q.map((a, i) => [a, Q[(i + 1) % Q.length]] as const)
      .filter(([a, b]) => Math.abs(a[0] - b[0]) <= 5 && Math.abs(a[0] - E) <= 400 && Math.min(a[1], b[1]) <= 60 && Math.max(a[1], b[1]) >= BAY_MM - 60)
      .sort(([a], [b]) => Math.abs(a[0] - E) - Math.abs(b[0] - E))[0];
    if (!canh) return false;
    const P = noiNetBao(m.duong_bao, f.goc_deg, f.truc_mm, canh[0][0], ra, w);
    if (!P) return false;
    const d = cuoi ? w : -w;
    for (const x of day) { x.a0 += d; x.a1 += d; x.x += u[0] * d; x.y += u[1] * d; }
    if (cuoi && Math.abs(E - f.a_cuoi) <= 400) f.a_cuoi += w;
    if (!cuoi && Math.abs(E - f.a_dau) <= 400) f.a_dau -= w;
    m.duong_bao = P;
    const a0 = cuoi ? p : p - w;
    // điểm chèn: cùng độ lệch so với mép ô như căn đứng trước (sx < 0 thì chèn ở mép a1)
    const lech = q.sx < 0 ? w : 0;
    const [x, y] = pt(a0 + lech, 0);
    f.phan_tu.push({ ...q, a0, a1: a0 + w, rong_mm: w, sau_mm: c.sau_mm, ma: c.ma_goc, block: c.ma_goc, ma_thu_vien: c.ma_goc, x, y, khoa: undefined });
    return true;
  };
  if (!thu(true) && !thu(false)) return 'khong_dau_tu_do';
  m.co_cau = { ...m.co_cau, [c.id]: (m.co_cau[c.id] ?? 0) + 1 };
  m.so_can_tang += 1;
  m.dtxd_m2 = Math.round(dtDG(m.duong_bao) / 1e4) / 100;
  return null;
}

const nho = new WeakMap<ToaMau, Map<string, { mau: ToaMau; hong: number[] }>>();

/** Mẫu tòa mở rộng theo danh sách căn thêm (nhớ theo mẫu + danh sách — cùng đầu vào cùng đối tượng). `hong` = chỉ số căn không thêm được. */
export function moRong<T extends ToaMau>(mau: T, ds: CanThem[] | undefined, tv: ThuVien): { mau: T; hong: number[] } {
  if (!ds?.length || !coMat(mau)) return { mau, hong: [] };
  const k = JSON.stringify(ds);
  let theoMau = nho.get(mau);
  const co = theoMau?.get(k);
  if (co) return co as { mau: T; hong: number[] };
  const m = { ...mau, duong_bao: mau.duong_bao.map((p): Diem => [p[0], p[1]]), co_cau: { ...mau.co_cau },
    mat: mau.mat.map((f) => ({ ...f, phan_tu: f.phan_tu.map((q) => ({ ...q })) })) } as T & ToaCoMat;
  const hong: number[] = [];
  ds.forEach((e, i) => { if (themMot(m, e, tv)) hong.push(i); });
  const g0 = layMauGocLoi(mau);
  if (g0) ghiMauGocLoi(m, g0 as unknown as ToaMB);
  const kq = { mau: m as T, hong };
  if (!theoMau) nho.set(mau, (theoMau = new Map()));
  if (theoMau.size > 30) theoMau.clear();
  theoMau.set(k, kq);
  return kq;
}

export const mauMoRong = <T extends ToaMau>(mau: T, ds: CanThem[] | undefined, tv: ThuVien): T => moRong(mau, ds, tv).mau;

/** Mẫu tòa của một tòa: thư viện + căn thêm tay. Không có mẫu thì undefined. */
export function mauToa(tv: ThuVien, toa: Pick<ToaDat, 'mauId' | 'canThem' | 'loiThay'>): ToaMau | undefined {
  const m = tv.toa.get(toa.mauId);
  // lõi thay trước (khoá lõi theo mẫu thư viện), căn thêm tay sau (khoá căn thêm tính theo phần tử của mẫu thư viện)
  return m && mauMoRong(thayLoiMau(m, toa.loiThay), toa.canThem, tv);
}

/** Chỉ số căn thêm có khoá ô `khoa`; không phải căn thêm thì −1. */
export function chiSoCanThem(mau: ToaMau, ds: CanThem[] | undefined, khoa: string): number {
  return (ds ?? []).findIndex((_, i) => khoaCanThem(mau, ds!, i) === khoa);
}

/**
 * Rút căn thêm tay có khoá `khoa` khỏi `ToaDat.canThem` (xoá hẳn, không để công năng 'bo'): các căn thêm sau nó cùng mặt lùi một
 * chỉ số → đổi khoá trong mọi bố cục (chung + tầng riêng: mẫu căn, công năng, lật), bản ghi tự chỉnh, neo của căn thêm / thang tay;
 * vật thể neo vào căn bị rút thì neo sang chỗ căn đó đã neo. Không phải căn thêm thì null.
 */
export function rutCanThem<T extends ToaDat>(toa: T, mau: ToaMau, khoa: string): T | null {
  const ds = toa.canThem ?? [];
  const i = chiSoCanThem(mau, ds, khoa);
  if (i < 0) return null;
  const e = ds[i];
  const doi = new Map<string, string>();
  for (let j = i + 1; j < ds.length; j++) if (ds[j].mat === e.mat) doi.set(khoaCanThem(mau, ds, j)!, `${e.mat}:${Number(khoaCanThem(mau, ds, j)!.split(':')[1]) - 1}`);
  const moi = (k: string) => doi.get(k) ?? k;
  const neoBo = e.sau ? { sau: e.sau } : { truoc: e.truoc };
  const doiNeo = <X extends { sau?: string; truoc?: string }>(x: X): X => {
    if (x.sau === khoa || x.truoc === khoa) {
      const { sau: _s, truoc: _t, ...r } = x;
      void _s; void _t;
      const n = { ...r, ...neoBo } as X;
      return { ...n, ...(n.sau ? { sau: moi(n.sau) } : {}), ...(n.truoc ? { truoc: moi(n.truoc) } : {}) };
    }
    return { ...x, ...(x.sau ? { sau: moi(x.sau) } : {}), ...(x.truoc ? { truoc: moi(x.truoc) } : {}) };
  };
  const banDo = <V>(o: Record<string, V> | undefined): Record<string, V> | undefined => {
    if (!o) return o;
    const r: Record<string, V> = {};
    for (const [k, v] of Object.entries(o)) if (k !== khoa) r[moi(k)] = v;
    return Object.keys(r).length ? r : undefined;
  };
  const canThem = ds.filter((_, j) => j !== i).map(doiNeo);
  const tangRieng = toa.tangRieng && Object.fromEntries(Object.entries(toa.tangRieng).map(([k, g]) => [k, {
    ...g, canViTri: banDo(g.canViTri), congNang: banDo(g.congNang), latO: banDo(g.latO),
  }]));
  const tuDong = toa.tuDong?.filter((d) => d.khoa !== khoa).map((d) => ({ ...d, khoa: moi(d.khoa) }));
  const thangTay = toa.thangTay && { ...toa.thangTay, them: toa.thangTay.them.map(doiNeo) };
  return {
    ...toa, canThem: canThem.length ? canThem : undefined, canViTri: banDo(toa.canViTri), congNang: banDo(toa.congNang), latO: banDo(toa.latO),
    ...(tangRieng ? { tangRieng } : {}), tuDong: tuDong?.length ? tuDong : undefined, ...(thangTay ? { thangTay } : {}),
  };
}

/** Khoá ô của căn thêm thứ `i` (theo mẫu thư viện + các căn thêm trước nó): "<mặt>:<chỉ số phần tử>". */
export function khoaCanThem(mau: ToaMau, ds: CanThem[], i: number): string | null {
  if (!coMat(mau) || !ds[i]) return null;
  const mi = ds[i].mat;
  return `${mi}:${mau.mat[mi].phan_tu.length + ds.slice(0, i).filter((e) => e.mat === mi).length}`;
}
