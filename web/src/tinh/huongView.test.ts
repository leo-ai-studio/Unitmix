import { describe, expect, it } from 'vitest';
import { napThuVien } from '../thu/thuVienThat';
import { chanToa } from './hinhHoc';
import { taoToaTrenLo } from './hopLo';
import {
  BoDemView, boiCanhView, caiDatView, danhGiaViewPA, diemHuong, huong8, matCanCucBo, phuongVi, quyDoiThoang, tongHopView,
  viewXoayMau, viTriMatTroi, VIEW_MAC_DINH, type DiemViewCan, type MatCan, type ToaView,
} from './huongView';
import type { Diem, Lo, ToaDat, TrangThaiPA } from './kieu';
import { taoPAMoi } from './macDinh';
import type { ToaCoMat } from './matBang';

const hcn = (x0: number, y0: number, x1: number, y1: number): Diem[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
/** Một căn tại O nhìn theo n (đơn vị). */
const can = (khoa: string, O: Diem, n: Diem, goc = false): MatCan => ({ khoa, canId: 'c', loai: '2pn', goc, O, n, A: O, B: O });
/** Tòa giả: hộp chữ nhật cao H, mắt H/2. */
const toa = (id: string, F: Diem[], H: number, ds: MatCan[] = [], loId = 'L'): ToaView => ({ id, loId, F, H, can: ds, eye: H / 2, so: 10, kc: 25 });
const lo = (id: string, kyHieu: string, ranh: Diem[], canhDuong?: (number | null)[]): Lo => ({
  id, ranh, chiGioi: null, xungQuanh: [], canhDuong,
  temDat: { kyHieu, chucNang: 'khac', chiTieu: taoPAMoi().lo[0]?.temDat.chiTieu ?? ({} as never), coCauMucTieu: { stu: 0, '1pn': 0, '2pn': 0, '2pnp': 0, '3pn': 0 } },
});
const cai = caiDatView();
const mot = (bo: BoDemView): DiemViewCan => bo.diem()[0];

describe('hướng', () => {
  it('phương vị / 8 hướng theo góc Bắc dự án', () => {
    expect(phuongVi([0, 1])).toBeCloseTo(0);
    expect(huong8([0, -1])).toBe(4); // Nam
    expect(huong8([-1, 0])).toBe(6); // Tây
    expect(huong8([1, 0])).toBe(2); // Đông
    expect(huong8([0.7071, -0.7071])).toBe(3); // Đông Nam
    // +Y bản vẽ lệch 90° (chiều kim đồng hồ) so với Bắc thật: mặt nhìn +Y thực ra nhìn Đông
    expect(huong8([0, 1], 90)).toBe(2);
    expect(huong8([0, 1], 180)).toBe(4);
  });
  it('điểm hướng: tốt 100 · trung bình 60 · kém 20, căn góc +10 (app cũ QT-111)', () => {
    const g = VIEW_MAC_DINH.nhomHuong;
    expect(diemHuong(4, g)).toBe(100);
    expect(diemHuong(3, g)).toBe(100);
    expect(diemHuong(0, g)).toBe(60);
    expect(diemHuong(6, g)).toBe(20);
    expect(diemHuong(6, g, true)).toBe(30);
    expect(diemHuong(4, g, true)).toBe(100);
    // nhóm do người dùng chỉnh
    expect(diemHuong(0, [1, 0, 0, 0, -1, 0, 0, 0])).toBe(100);
  });
  it('cài đặt: thiếu / hỏng → mặc định, góc Bắc chuẩn 0..360', () => {
    expect(caiDatView()).toEqual(VIEW_MAC_DINH);
    const c = caiDatView({ gocBac: -30, trongSo: { huong: 70, thoang: 30, canh: 0, nang: 0 }, nhomHuong: [1, 2] as never, viDo: Number.NaN });
    expect(c.gocBac).toBe(330);
    expect(c.trongSo).toEqual({ huong: 70, thoang: 30, canh: 0, nang: 0 });
    expect(c.nhomHuong).toEqual(VIEW_MAC_DINH.nhomHuong);
    expect(c.viDo).toBe(VIEW_MAC_DINH.viDo);
    expect(caiDatView({ trongSo: { huong: 0, thoang: 0, canh: 0, nang: 0 } }).trongSo).toEqual(VIEW_MAC_DINH.trongSo);
  });
  it('mặt trời Đông chí: trưa ở phương Nam, cao 90 − φ − 23,44°; sáng ở phía Đông', () => {
    const tr = viTriMatTroi(21, 12);
    expect(tr.phuongVi).toBeCloseTo(180, 5);
    expect(tr.cao).toBeCloseTo(90 - 21 - 23.44, 5);
    const s = viTriMatTroi(21, 8);
    expect(s.phuongVi).toBeGreaterThan(100);
    expect(s.phuongVi).toBeLessThan(140);
    expect(s.cao).toBeGreaterThan(0);
    const c = viTriMatTroi(21, 16);
    expect(c.phuongVi).toBeCloseTo(360 - s.phuongVi, 5);
  });
});

describe('khoảng thoáng / vật cản', () => {
  it('quy đổi thoáng: ≥ 100 m = 100, bằng §2.6.1 = 40, ngắn hơn giảm luỹ thừa 1,5', () => {
    expect(quyDoiThoang(150, 25)).toBe(100);
    expect(quyDoiThoang(100, 25)).toBe(100);
    expect(quyDoiThoang(25, 25)).toBeCloseTo(40);
    expect(quyDoiThoang(62.5, 25)).toBeCloseTo(70);
    expect(quyDoiThoang(6.25, 25)).toBeCloseTo(5);
  });
  it('khoảng tới tòa đối diện trên tia giữa; tòa thấp hơn mắt bị nhìn vượt', () => {
    // căn ở mặt Bắc tòa A (y = 10) nhìn lên +Y; tòa B cách 30 m
    const A = hcn(0, 0, 60, 10), B = hcn(0, 40, 60, 50);
    const bo = new BoDemView(cai, boiCanhView({ lo: [] }));
    bo.them(toa('A', A, 60, [can('1', [30, 10.3], [0, 1])]));
    bo.them(toa('B', B, 60));
    const d = mot(bo);
    expect(d.kcCan).toBeCloseTo(29.7, 5);
    expect(d.doiDien).toBe(false);
    expect(d.nhin).toBe('toa');
    // tòa B chỉ cao 20 m < mắt 30 m: không che
    const bo2 = new BoDemView(cai, boiCanhView({ lo: [] }));
    bo2.them(toa('A', A, 60, [can('1', [30, 10.3], [0, 1])]));
    bo2.them(toa('B', B, 20));
    expect(mot(bo2).kcCan).toBeNull();
    expect(mot(bo2).thoang).toBe(100);
  });
  it('mặt đối mặt < 25 m: đếm "bị che gần", cảnh quan tia đó = 0; xa hơn thì thoáng hơn', () => {
    const ket = (kc: number) => {
      const bo = new BoDemView(cai, boiCanhView({ lo: [] }));
      bo.them(toa('A', hcn(0, 0, 60, 10), 60, [can('1', [30, 10.3], [0, 1])]));
      bo.them(toa('B', hcn(0, 10 + kc, 60, 20 + kc), 60));
      return mot(bo);
    };
    const gan = ket(15), xa = ket(60);
    expect(gan.doiDien).toBe(true);
    expect(xa.doiDien).toBe(false);
    expect(gan.thoang).toBeLessThan(xa.thoang);
    expect(gan.canh).toBeLessThan(xa.canh);
    expect(tongHopView([gan]).soGan).toBe(10);
    expect(tongHopView([xa]).soGan).toBe(0);
  });
  it('tăng dần = tính lại từ đầu (thứ tự thêm tòa không đổi kết quả)', () => {
    const ds = [toa('A', hcn(0, 0, 60, 10), 60, [can('1', [30, 10.3], [0, 1]), can('2', [30, -0.3], [0, -1])]), toa('B', hcn(10, 35, 40, 45), 60, [can('3', [25, 34.7], [0, -1])]), toa('C', hcn(-20, -60, 80, -40), 40)];
    const a = new BoDemView(cai, boiCanhView({ lo: [] })), b = new BoDemView(cai, boiCanhView({ lo: [] }));
    for (const x of ds) a.them(x);
    for (const x of ds.slice().reverse()) b.them(x);
    const sx = (v: DiemViewCan[]) => v.slice().sort((p, q) => p.khoa.localeCompare(q.khoa)).map((d) => [d.khoa, d.tong.toFixed(6), d.kcCan]);
    expect(sx(a.diem())).toEqual(sx(b.diem()));
  });
  it('bóng tòa phía Nam che nắng Đông chí của mặt Nam', () => {
    const nam = (H: number) => {
      const bo = new BoDemView(cai, boiCanhView({ lo: [] }));
      bo.them(toa('A', hcn(0, 0, 60, 10), 60, [can('1', [30, -0.3], [0, -1])]));
      bo.them(toa('B', hcn(0, -40, 60, -30), H));
      return mot(bo);
    };
    expect(nam(31).gioNang).toBeGreaterThan(nam(90).gioNang);
    expect(nam(90).nang).toBeLessThan(nam(31).nang);
  });
});

describe('cảnh quan theo lô bên cạnh', () => {
  const ket = (dsLo: Lo[]) => {
    const bo = new BoDemView(cai, boiCanhView({ lo: dsLo }));
    bo.them(toa('A', hcn(0, 0, 60, 10), 60, [can('1', [30, 10.3], [0, 1])]));
    return mot(bo);
  };
  it('nhìn ra cây xanh / mặt nước > quảng trường > đường lớn > không có gì', () => {
    const cx = ket([lo('x', 'CX-01', hcn(-50, 30, 110, 90))]);
    const mn = ket([lo('x', 'MN-1', hcn(-50, 30, 110, 90))]);
    const qt = ket([lo('x', 'QT-1', hcn(-50, 30, 110, 90))]);
    const duong = ket([lo('x', 'NO-02', hcn(-50, 30, 110, 90), [null, null, null, 40])]); // cạnh 4 (x = −50) không cắt; cạnh đáy giáp đường?
    const rong = ket([]);
    expect(cx.nhin).toBe('cay_xanh');
    expect(mn.nhin).toBe('mat_nuoc');
    expect(qt.nhin).toBe('quang_truong');
    expect(cx.canh).toBeGreaterThan(qt.canh);
    expect(qt.canh).toBeGreaterThan(rong.canh);
    expect(cx.canh).toBeCloseTo(mn.canh);
    expect(duong.canh).toBe(rong.canh); // cạnh khai đường không nằm trước mặt căn
    const dl = ket([lo('x', 'NO-02', hcn(-50, 30, 110, 90), [40, null, null, null])]); // cạnh đáy y = 30 giáp đường 40 m
    expect(dl.nhin).toBe('duong');
    expect(dl.canh).toBeCloseTo(62);
    const nho = ket([lo('x', 'NO-02', hcn(-50, 30, 110, 90), [12, null, null, null])]); // đường 12 m < 20 m: không tính
    expect(nho.canh).toBe(rong.canh);
    expect(rong.canh).toBe(45);
  });
  it('cây xanh nằm sau tòa đối diện thì không thấy', () => {
    const bo = new BoDemView(cai, boiCanhView({ lo: [lo('x', 'CX-01', hcn(-50, 60, 110, 120))] }));
    bo.them(toa('A', hcn(0, 0, 60, 10), 60, [can('1', [30, 10.3], [0, 1])]));
    bo.them(toa('B', hcn(-20, 30, 80, 40), 60));
    expect(mot(bo).nhin).toBe('toa');
  });
});

describe('tổng hợp', () => {
  it('đếm theo số tầng, % Tốt / Khá / Kém, hướng Tây', () => {
    const d = (tong: number, h8: number, so: number): DiemViewCan => ({
      toaId: 't', loId: 'l', khoa: String(tong), canId: 'c', loai: null, so, tong, huong: tong, thoang: tong, canh: tong, nang: tong, h8,
      kcCan: null, doiDien: false, gioNang: 0, nhin: null, xep: tong >= 80 ? 'tot' : tong >= 60 ? 'kha' : 'kem', A: [0, 0], B: [0, 0],
    });
    const th = tongHopView([d(90, 4, 10), d(70, 0, 10), d(40, 6, 20)]);
    expect(th.soCan).toBe(40);
    expect(th.tb).toBeCloseTo((900 + 700 + 800) / 40);
    expect(th.pctTot).toBeCloseTo(25);
    expect(th.pctKha).toBeCloseTo(25);
    expect(th.pctKem).toBeCloseTo(50);
    expect(th.soTay).toBe(20);
    expect(tongHopView([]).tb).toBeNull();
  });
});

describe('thư viện thật', () => {
  const { tv } = napThuVien();
  const mau = tv.toa.get('tm-i1') as ToaCoMat;
  const L: Lo = { ...lo('A', 'NO-01', hcn(0, 0, 200, 200)), temDat: { ...lo('A', 'NO-01', []).temDat, chucNang: 'tm' } };
  const dat = (x: number, y: number, gocDo: number, id = 't1'): ToaDat => ({ ...taoToaTrenLo(mau, L, id), x, y, gocDo, soTangDH: 20, soTangDe: 1, caoDe: 4.5, caoDH: 3.3 });
  const pa = (ds: ToaDat[], huongView?: TrangThaiPA['huongView']): TrangThaiPA => ({ ...taoPAMoi(), lo: [L], toa: ds, huongView });

  it('mặt ngoài căn nằm trên nét bao tòa, pháp tuyến hướng ra ngoài', () => {
    const ds = matCanCucBo(mau, tv);
    expect(ds.length).toBe(28);
    const F = chanToa(mau, dat(0, 0, 0));
    const ys = F.map((p) => p[1]);
    for (const m of ds) {
      const yMat = (m.A[1] + m.B[1]) / 2;
      // tm-i1: mặt ngoài căn trùng mép trên / dưới nét bao
      expect(Math.min(Math.abs(yMat - Math.max(...ys)), Math.abs(yMat - Math.min(...ys)))).toBeLessThan(0.05);
      expect(Math.sign(m.n[1])).toBe(Math.sign(yMat));
    }
  });
  it('tòa I đặt ngang: nửa Bắc / nửa Nam; xoay 90° thì Đông / Tây; góc Bắc dự án đổi hướng', () => {
    const k0 = danhGiaViewPA(pa([dat(100, 100, 0)]), tv);
    const h = (k: typeof k0) => k.can.reduce((m, d) => ((m[d.h8] = (m[d.h8] ?? 0) + 1), m), {} as Record<number, number>);
    expect(h(k0)).toEqual({ 0: 14, 4: 14 });
    const k90 = danhGiaViewPA(pa([dat(100, 100, 90)]), tv);
    expect(h(k90)).toEqual({ 2: 14, 6: 14 });
    expect(k90.tong.soTay).toBe(14 * 20);
    expect(k0.tong.soTay).toBe(0);
    expect(k0.tong.tb!).toBeGreaterThan(k90.tong.tb!); // Bắc–Nam tốt hơn Đông–Tây (hướng Tây kém + nắng chiều)
    const b90 = danhGiaViewPA(pa([dat(100, 100, 0)], { gocBac: 90 }), tv);
    expect(h(b90)).toEqual({ 2: 14, 6: 14 });
  });
  it('hai tòa song song sát nhau: căn mặt trong bị che gần, tổng hợp theo tòa và lô', () => {
    const k = danhGiaViewPA(pa([dat(100, 60, 0, 'a'), dat(100, 100, 0, 'b')]), tv); // tâm cách 40 m, mỗi tòa sâu ~19 m → khe ~21 m
    const a = k.theoToa.get('a')!, b = k.theoToa.get('b')!;
    expect(a.soGan).toBeGreaterThan(0);
    expect(b.soGan).toBeGreaterThan(0);
    expect(k.theoLo.get('A')!.soCan).toBe(a.soCan + b.soCan);
    const mot = danhGiaViewPA(pa([dat(100, 60, 0, 'a')]), tv);
    expect(mot.theoToa.get('a')!.tb!).toBeGreaterThan(a.tb!);
    expect(k.can.every((d) => d.tong >= 0 && d.tong <= 100)).toBe(true);
  });
  it('điểm theo góc xoay mẫu (cache): xoay cho mặt dài nhìn Bắc–Nam được ưu tiên', () => {
    const c = caiDatView();
    expect(viewXoayMau(mau, tv, 0, c).huong).toBeGreaterThan(viewXoayMau(mau, tv, 90, c).huong);
    expect(viewXoayMau(mau, tv, 0, c)).toBe(viewXoayMau(mau, tv, 0, c));
  });
});
