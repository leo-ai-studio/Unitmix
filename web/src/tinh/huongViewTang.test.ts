/** Điểm view theo dải tầng (3D phân tích view) + thang màu + biểu đồ tần suất. */
import { describe, expect, it } from 'vitest';
import { napThuVien } from '../thu/thuVienThat';
import { taoToaTrenLo } from './hopLo';
import { BoDemView, boiCanhView, caiDatView, chiaDaiTang, danhGiaViewPA, matTang, type MatCan, type ToaView } from './huongView';
import type { Diem, Lo, ToaDat, TrangThaiPA } from './kieu';
import { taoPAMoi } from './macDinh';
import type { ToaCoMat } from './matBang';
import { bieuDoView, chuTrenView, doTuongPhan, labView, mauView, mauViewCss, MOC_THANG, oklabRgb } from './mauView';

const hcn = (x0: number, y0: number, x1: number, y1: number): Diem[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const can = (khoa: string, O: Diem, n: Diem): MatCan => ({ khoa, canId: 'c', loai: '2pn', goc: false, O, n, A: O, B: O });
const cai = caiDatView();
/** Tòa giả cao H, mắt giữa H/2, dải mắt `mat`. */
const toa = (id: string, F: Diem[], H: number, ds: MatCan[] = [], mat?: number[]): ToaView => ({ id, loId: 'L', F, H, can: ds, eye: H / 2, so: 10, kc: 25, mat });

describe('dải tầng', () => {
  it('chia tầng: ≤ toiDa thì mỗi tầng một dải; nhiều hơn thì gộp đều, mắt giữa dải', () => {
    const x = { soTangDe: 1, caoDe: 4.5, caoDH: 3, soTangDH: 30 };
    const a = chiaDaiTang(x, 40);
    expect(a.tu.length).toBe(30);
    expect(a.mat[0]).toBeCloseTo(matTang(x, 1));
    const b = chiaDaiTang(x, 10);
    expect(b.tu).toEqual([1, 4, 7, 10, 13, 16, 19, 22, 25, 28]);
    expect(b.den.at(-1)).toBe(30);
    expect(b.mat[0]).toBeCloseTo(matTang(x, 2));
    expect(chiaDaiTang({ ...x, soTangDH: 0 }).tu).toEqual([1]);
  });

  it('tòa đối diện thấp: tầng dưới bị che (thoáng thấp), tầng trên nhìn vượt; tầng giữa khớp chấm một tầng', () => {
    // A cao 90 m nhìn Bắc; B cao 40 m cách 30 m
    const mat = [5, 20, 35, 45, 60, 80];
    const mk = (nt: boolean) => {
      const bo = new BoDemView(cai, boiCanhView({ lo: [] }), { nhieuTang: nt });
      bo.them(toa('A', hcn(0, 0, 60, 10), 90, [can('1', [30, 10.3], [0, 1])], mat));
      bo.them(toa('B', hcn(0, 40, 60, 50), 40));
      return bo.diem()[0];
    };
    const d = mk(true), d1 = mk(false);
    expect(d1.bang).toBeUndefined();
    const b = d.bang!;
    expect(b.tong.length).toBe(mat.length);
    expect(b.kcCan[0]).toBeCloseTo(29.7, 5);
    expect(b.kcCan[2]).toBeCloseTo(29.7, 5);
    expect(b.kcCan[3]).toBeNull(); // mắt 45 > 40: nhìn vượt
    expect(b.thoang[4]).toBeGreaterThan(b.thoang[0]);
    expect(b.tong[5]).toBeGreaterThan(b.tong[0]);
    // điểm tầng giữa (mắt 45) không đổi khi bật nhiều tầng
    expect(d.tong).toBeCloseTo(d1.tong, 9);
    expect(d.kcCan).toBe(d1.kcCan);
    // dải có mắt = mắt giữa cho ra cùng điểm
    expect(b.tong[3]).toBeCloseTo(d1.tong, 9);
  });

  it('nắng: bóng tòa phía Nam che tầng thấp nhiều giờ hơn tầng cao', () => {
    const bo = new BoDemView(cai, boiCanhView({ lo: [] }), { nhieuTang: true });
    bo.them(toa('A', hcn(0, 0, 60, 10), 90, [can('1', [30, -0.3], [0, -1])], [3, 30, 60, 85]));
    bo.them(toa('B', hcn(0, -40, 60, -30), 50));
    const g = bo.diem()[0].bang!.gioNang;
    expect(g[0]).toBeLessThan(g[3]);
    for (let i = 1; i < g.length; i++) expect(g[i]).toBeGreaterThanOrEqual(g[i - 1]);
  });

  it('tăng dần = tính lại (thứ tự thêm tòa) cả theo dải', () => {
    const mat = [4, 25, 50];
    const ds = [toa('A', hcn(0, 0, 60, 10), 60, [can('1', [30, 10.3], [0, 1])], mat), toa('B', hcn(10, 35, 40, 45), 30, [can('3', [25, 34.7], [0, -1])], mat), toa('C', hcn(-20, 60, 80, 70), 70)];
    const a = new BoDemView(cai, boiCanhView({ lo: [] }), { nhieuTang: true }), b = new BoDemView(cai, boiCanhView({ lo: [] }), { nhieuTang: true });
    for (const x of ds) a.them(x);
    for (const x of ds.slice().reverse()) b.them(x);
    const sx = (v: ReturnType<BoDemView['diem']>) => v.slice().sort((p, q) => p.khoa.localeCompare(q.khoa)).map((d) => d.bang!.tong.map((x) => x.toFixed(6)));
    expect(sx(a.diem())).toEqual(sx(b.diem()));
  });

  it('danhGiaViewPA nhieuTang: mỗi căn có điểm theo dải của tòa; tổng hợp giữ nguyên', () => {
    const { tv } = napThuVien();
    const mau = tv.toa.get('tm-i1') as ToaCoMat;
    const lo: Lo = {
      id: 'A', ranh: hcn(0, 0, 200, 200), chiGioi: null, xungQuanh: [],
      temDat: { kyHieu: 'NO-01', chucNang: 'tm', chiTieu: taoPAMoi().lo[0]?.temDat.chiTieu ?? ({} as never), coCauMucTieu: { stu: 0, '1pn': 0, '2pn': 0, '2pnp': 0, '3pn': 0 } },
    };
    const dat = (x: number, y: number, id: string, n: number): ToaDat => ({ ...taoToaTrenLo(mau, lo, id), x, y, gocDo: 0, soTangDH: n, soTangDe: 1, caoDe: 4.5, caoDH: 3.3 });
    const pa: TrangThaiPA = { ...taoPAMoi(), lo: [lo], toa: [dat(100, 60, 'a', 30), dat(100, 100, 'b', 12)] };
    const k0 = danhGiaViewPA(pa, tv), k = danhGiaViewPA(pa, tv, { nhieuTang: 40 });
    expect(k.tong.tb).toBeCloseTo(k0.tong.tb!, 9);
    expect(k.daiTang!.get('a')!.tu.length).toBe(30);
    expect(k.daiTang!.get('b')!.tu.length).toBe(12);
    for (const d of k.can) expect(d.bang!.tong.length).toBe(k.daiTang!.get(d.toaId)!.tu.length);
    // tòa a (30 tầng) mặt Bắc nhìn tòa b (12 tầng): tầng trên cao thoáng hơn tầng dưới
    const bac = k.can.filter((d) => d.toaId === 'a' && d.n[1] > 0.9);
    expect(bac.length).toBeGreaterThan(0);
    for (const d of bac) expect(d.bang!.thoang[29]).toBeGreaterThanOrEqual(d.bang!.thoang[0]);
    expect(bac.some((d) => d.bang!.thoang[29] > d.bang!.thoang[0] + 5)).toBe(true);
  });
});

describe('thang màu view', () => {
  it('độ sáng OKLab giảm đơn điệu 0 → 100 và mọi mức nằm trong gam sRGB', () => {
    let truoc = Infinity;
    for (let v = 0; v <= 100; v += 1) {
      const L = labView(v)[0];
      expect(L).toBeLessThanOrEqual(truoc + 1e-9);
      truoc = L;
      for (const c of oklabRgb(labView(v))) { expect(c).toBeGreaterThanOrEqual(-0.002); expect(c).toBeLessThanOrEqual(1.002); }
    }
    expect(labView(0)[0] - labView(100)[0]).toBeGreaterThan(0.3); // đủ dải sáng để đọc khi mù màu / in đen trắng
    expect(MOC_THANG[0][0]).toBe(0);
    expect(MOC_THANG.at(-1)![0]).toBe(1);
  });
  it('ánh xạ: kẹp ngoài 0..100, NaN → 0, CSS hex', () => {
    expect(mauView(-20)).toEqual(mauView(0));
    expect(mauView(150)).toEqual(mauView(100));
    expect(mauView(Number.NaN)).toEqual(mauView(0));
    expect(mauViewCss(100)).toMatch(/^#[0-9a-f]{6}$/);
    expect(mauViewCss(0)).not.toBe(mauViewCss(100));
  });
  it('chữ trên chip (in đậm) đủ tương phản ở mọi mức: ≥ 4 giữa thang, ≥ 4,5 hai đầu', () => {
    for (let v = 0; v <= 100; v += 1) {
      const chu = chuTrenView(v) === '#ffffff' ? [255, 255, 255] as [number, number, number] : [20, 24, 24] as [number, number, number];
      expect(doTuongPhan(mauView(v), chu)).toBeGreaterThanOrEqual(v < 25 || v > 85 ? 4.5 : 4);
    }
  });
});

describe('biểu đồ tần suất', () => {
  it('20 ô đều, đếm theo số tầng, 100 vào ô cuối, NaN bỏ', () => {
    const h = bieuDoView([{ tong: 0, so: 2 }, { tong: 4.99, so: 1 }, { tong: 5, so: 3 }, { tong: 100, so: 4 }, { tong: 99.9, so: 1 }, { tong: Number.NaN, so: 9 }]);
    expect(h.length).toBe(20);
    expect(h[0]).toBe(3);
    expect(h[1]).toBe(3);
    expect(h[19]).toBe(5);
    expect(h.reduce((a, b) => a + b, 0)).toBe(11);
    expect(bieuDoView([], 10)).toEqual(new Array(10).fill(0));
  });
});
