import { useEffect, useMemo, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { dieuPhoiHam, useNgheHam } from '../tinh/hamNen';
import type { GocNhin, ThuVien, ToaDat, TrangThaiPA } from '../tinh/kieu';
import { chuKyMatBang } from '../tinh/loiThang';
import { boCucTang, canDangDung, congNangTai, nhomTang, soCanChuVi, tangCoRieng, viTriCan } from '../tinh/matBang';
import { idTepCan } from '../tinh/stretch';
import { idLoi, tai, type HinhLoi } from '../ve/hinhHocThuVien';
import type { ToaVe } from '../ve/MatBangTang';
import { dungCan, type Khoi3d } from './dungCan';
import { dungToa, ranhTumCo, type LoiHinh } from './dungToa';
import { dungDuAn } from './dungDuAn';
import { docLopAn, dungTrucThang, luuLopAn, type Lop3D } from './lop3d';
import { coMat } from '../tinh/matBang';
import { mauToa } from '../tinh/canThem';
import { xoayTinhTien } from '../tinh/hinhHoc';
import { mauCuaToa } from '../man/tuChinhTang';
import type { Diem } from '../tinh/kieu';
import type { NutHienThi } from '../ui/ThanhHienThi';
import { chonTiaToa, doiTuongDangChonToa, hinhNhanToa, type DangChon3D, type DoiTuong3D } from './chon3d';
import { dtVung, khoiDe } from '../tinh/hinhHoc';
import { tenTang } from '../ui/ChonTang';
import { fmtSo } from '../ui/so';
import { Khung3D, type PhanTich3D } from './Khung3D';
import { CAO_TANG_DE_MM } from './dungToa';
import { dungHinhView, oDuAn, type OView } from './lopView3d';
import { datLopView, TheDiemCan, ThanhMauView, useLocView, useLopView, useViewTang } from '../man/lopView';
import { gradientCss } from '../tinh/mauView';
import type { KetQuaViewPA } from '../tinh/huongView';
import { khoi3dTheoId } from './stretch3d';
import { caiDatView } from '../tinh/huongView'; // góc Bắc dự án (TMB › Điểm view › Cài đặt): mặt trời 3D cả dự án quay theo

type Nap = { khoi3d: Map<string, Khoi3d | null>; loi: Map<string, LoiHinh>; xong: boolean };

/** Tải làm biếng khối 3D các mẫu căn và hình học lõi đang cần. */
export function useNap3d(canIds: string[], loiIds: string[], tv?: ThuVien | null): Nap {
  const khoa = [...new Set(canIds)].sort().join() + '|' + [...new Set(loiIds)].sort().join();
  const [kq, setKq] = useState<Nap>({ khoi3d: new Map(), loi: new Map(), xong: false });
  useEffect(() => {
    let huy = false;
    const [c, l] = khoa.split('|').map((x) => (x ? x.split(',') : []));
    setKq((o) => ({ ...o, xong: false }));
    Promise.all([
      Promise.all(c.map((id) => tai<{ khoi3d: Khoi3d | null }>(`/lib/can/${idTepCan(id)}.json`).then((j) => [id, khoi3dTheoId(id, j?.khoi3d ?? null, tv)] as const))),
      Promise.all(l.map((id) => tai<HinhLoi>(`/lib/loi/${id}.json`).then((j) => [id, { bao_tuong_mm: j?.bao_tuong_mm }] as const))),
    ]).then(([a, b]) => { if (!huy) setKq({ khoi3d: new Map(a), loi: new Map(b), xong: true }); });
    return () => { huy = true; };
  }, [khoa, tv]);
  return kq;
}

// ---------- phân tích view 3D ----------
const soKq = new WeakMap<KetQuaViewPA, number>();
let demKq = 0;
const idKq = (kq: KetQuaViewPA) => { let n = soKq.get(kq); if (!n) soKq.set(kq, (n = ++demKq)); return n; };

/** Nút "Phân tích view" trên thanh 3D (bật chung với lớp view TMB / màn Tầng). */
function NutPhanTich() {
  const bat = useLopView();
  return (
    <span class="nhom-3d" role="group" aria-label={t('view.phanTich')}>
      <button type="button" class="nut-phan-tich-view" aria-pressed={bat} title={t('gt.view.phanTich3d')} onClick={() => datLopView(!bat)}>
        <i class="cham-thang" aria-hidden="true" style={{ background: gradientCss() }} />{t('view.phanTich')}
      </button>
    </span>
  );
}

/** Chú giải lớp phân tích 3D: tiêu đề + thang màu (lọc được) + số ô, gợi ý rê chuột. */
function ChuGiai3D({ kq, soO, phamVi }: { kq: KetQuaViewPA; soO: number; phamVi: string }) {
  return (
    <>
      <div class="cg3-dau">
        <b>{t('view.phanTich')}</b><span class="muted">{phamVi}</span>
        <span class="gian" />
        <button type="button" class="nut-dong-view" aria-label={t('view.tatLop')} title={t('view.tatLop')} onClick={() => datLopView(false)}>×</button>
      </div>
      <ThanhMauView cai={kq.cai} />
      <div class="cg3-chan muted">{t('view.soO').replace('{n}', fmtSo(soO))} · {t('view.goiYRe')}</div>
    </>
  );
}

/** Bong bóng một ô: tên tòa / căn, tầng (dải), điểm + thành phần của dải đó. */
function docO(o: OView, kq: KetQuaViewPA, tenToa: (id: string) => string, tenCan: (o: OView) => string, soTangDe: (id: string) => number) {
  const b = o.d.bang!, i = o.bang, de = soTangDe(o.toaId);
  const tang = o.tu === o.den ? t('oc.tr.tang').replace('{n}', String(de + o.tu)) : t('view.tuTang').replace('{a}', String(de + o.tu)).replace('{b}', String(de + o.den));
  return (
    <TheDiemCan tieuDe={`${tenToa(o.toaId)} · ${tenCan(o)}`} phu={tang} tong={b.tong[i]} huong={o.d.huong} thoang={b.thoang[i]} canh={b.canh[i]} nang={b.nang[i]}
      h8={o.d.h8} kcCan={b.kcCan[i]} gioNang={b.gioNang[i]} cai={kq.cai} />
  );
}

type LuuGoc = { gocLuu?: GocNhin[]; onLuuGoc?: (g: Omit<GocNhin, 'id' | 'che' | 'toaId'>) => void; onXoaGoc?: (id: string) => void };
type PropsToa = { toa: ToaDat; mau: ToaVe; mauTang?: (tang: number | null) => ToaVe; tv: ThuVien; pa: TrangThaiPA; dauThanh?: preact.ComponentChildren } & LuuGoc;


/**
 * Thông tin căn / tầng / khối đế đang chọn ở 3D Công trình: CH-xx (đánh số chu vi như bản vẽ tầng), loại, DT thông thủy, tầng;
 * khối đế: số tầng đế + DT một sàn đế (chân tháp nới `deOffset`, như chỉ tiêu lô). Theo mặt bằng + bố cục của chính tầng đó.
 */
export function thongTinChonToa(toa: ToaDat, mau: ToaVe, mauTang: ((tang: number | null) => ToaVe) | undefined, tv: ThuVien, c: { tang: number | null; canKhoa: string | null; de?: boolean }): string | null {
  if (c.de) {
    if (!toa.soTangDe) return null;
    const de = khoiDe([mau.duong_bao.map(([x, y]): [number, number] => [x / 1000, y / 1000])], [toa.deOffset ?? 0]);
    return t('m3d.chonDe').replace('{n}', String(toa.soTangDe)).replace('{dt}', fmtSo(de.length ? dtVung(de) : null, { thapPhan: 1 }));
  }
  const tang = c.tang && c.tang <= toa.soTangDH ? c.tang : null;
  const nhanTang = tang ? tenTang(toa.soTangDe, tang) : t('tang.dienHinh');
  if (!c.canKhoa) return tang ? t('m3d.chonTang').replace('{tang}', nhanTang) : null;
  const mT = (tang && tangCoRieng(toa).includes(tang) ? mauTang?.(tang) : null) ?? mau, bc = boCucTang(toa, tang);
  const vts = viTriCan(mT, tv, bc), vt = vts.find((v) => v.khoa === c.canKhoa);
  if (!vt || congNangTai(vt.khoa, bc) !== 'can') return null;
  const no = soCanChuVi(mT.duong_bao, vts).get(vt.khoa) ?? 0, cm = tv.can.get(canDangDung(vt, bc));
  return t('m3d.chonCan').replace('{tang}', nhanTang).replace('{can}', `CH-${String(no).padStart(2, '0')}`)
    .replace('{loai}', cm ? t(`loai.${cm.loai}`) : '—').replace('{dt}', fmtSo(cm?.dt_tt_m2, { thapPhan: 1 }));
}

/** Tab Mô hình: 3D cả tòa đang xem (khối đế + tầng điển hình + mái + tum). Có `chon3d` thì bấm chọn căn / tầng, bấm đúp mở mặt bằng. */
/** Trạng thái lớp 3D dùng chung Toàn dự án / Công trình, nhớ theo máy (localStorage `unitmix.lop-3d.v1`). */
function useLop3D(): [Lop3D[], (k: Lop3D) => void] {
  const [an, setAn] = useState<Lop3D[]>(docLopAn);
  const doi = (k: Lop3D) => setAn((a) => { const b = a.includes(k) ? a.filter((x) => x !== k) : [...a, k]; luuLopAn(b); return b; });
  return [an, doi];
}
const nutLop = (ds: Lop3D[], an: Lop3D[], doi: (k: Lop3D) => void): NutHienThi[] =>
  ds.map((k) => ({ khoa: k, nhan: t(`m3d.lop.${k}`), bat: !an.includes(k), onClick: () => doi(k) }));

export function MoHinhToa({ toa, mau, mauTang, tv, pa, dauThanh, chon3d, ...luu }: PropsToa & { chon3d?: Chon3D }) {
  const [lopAn, doiLop] = useLop3D();
  const bat = useLopView(), loc = useLocView();
  const vt = useViewTang(pa, tv, bat);
  // căn của mọi bố cục tầng (chung + tầng riêng); chữ ký bố cục vào khoá để dựng lại khi đổi theo tầng / công năng ô
  const canIds = useMemo(() => [...new Set(nhomTang(toa).flatMap(({ tang }) => { const bc = boCucTang(toa, tang); return viTriCan(mau, tv).map((vt) => canDangDung(vt, bc)); }))], [mau, toa.canTheo, toa.canViTri, toa.tangRieng, tv]);
  // khối lõi / thang của mọi mặt bằng tầng (thang PC-11 thêm có thể là khối khác bản vẽ)
  const loiIds = useMemo(() => [...new Set(nhomTang(toa).flatMap(({ tang }) => (mauTang?.(tang) ?? mau).mat.flatMap((m) => m.phan_tu.filter((q) => q.loai !== 'can').map((q) => idLoi(q.block)))))], [mau, mauTang, toa]);
  const nap = useNap3d(canIds, loiIds, tv);
  if (!nap.xong) return <div class="giua-man"><img class="spin-o" src="/brand/leo_ai_o.png" alt="" /><span>{t('m3d.dangDung')}</span></div>;
  const khoa = ['toa', mau.id, toa.soTangDe, toa.soTangDH, canIds.join(), JSON.stringify([toa.canTheo, toa.canViTri, toa.congNang, toa.tangRieng]), chuKyMatBang(toa)].join('|');
  const c = chon3d?.chon, tang = c?.tang ?? null, canKhoa = c?.canKhoa ?? null;
  const chu = chon3d ? thongTinChonToa(toa, mau, mauTang, tv, { tang, canKhoa, de: c?.de }) ?? t('m3d.goiYChonToa') : null;
  const kq = vt.kq, dt = kq?.daiTang?.get(toa.id);
  const canToa = kq ? kq.can.filter((d) => d.toaId === toa.id && d.bang) : [];
  const phanTich: PhanTich3D = {
    bat, loc, khoa: kq ? `${idKq(kq)}|${mau.id}|${khoa}` : '',
    dung: kq && dt && canToa.length ? (T, P) => {
      const K = 0.001, hDe = toa.soTangDe * CAO_TANG_DE_MM * K, ht = P.tang * K;
      const theoKhoa = new Map(canToa.map((d) => [d.khoa, d]));
      const o: OView[] = [];
      for (const v of viTriCan(mau, tv, boCucTang(toa, null))) {
        const d = theoKhoa.get(v.khoa), m = mau.mat[v.matIdx];
        if (!d?.bang || !m) continue;
        const r = (m.goc_deg * Math.PI) / 180, n: [number, number] = [-Math.sin(r), Math.cos(r)];
        const A: [number, number] = [v.goc[3][0] * K, v.goc[3][1] * K], B: [number, number] = [v.goc[2][0] * K, v.goc[2][1] * K];
        dt.tu.forEach((tu, i) => o.push({ toaId: toa.id, A, B, n, y0: hDe + (tu - 1) * ht, y1: hDe + dt.den[i] * ht, v: d.bang!.tong[i], d, bang: i, tu, den: dt.den[i] }));
      }
      return dungHinhView(T, o);
    } : null,
    doc: (o) => {
      const vts = viTriCan(mau, tv, boCucTang(toa, null)), no = soCanChuVi(mau.duong_bao, vts).get(o.d.khoa) ?? 0;
      return docO(o, kq!, () => mau.ten_vi.split(' · ')[0], (x) => `CH-${String(no).padStart(2, '0')} · ${x.d.loai ? t(`loai.${x.d.loai}`) : '—'}`, () => toa.soTangDe);
    },
    chuGiai: kq ? <ChuGiai3D kq={kq} soO={canToa.length * (dt?.tu.length ?? 0)} phamVi={mau.ten_vi.split(' · ')[0]} /> : null,
  };
  return (
    <Khung3D khoa={khoa} gocBac={toa.gocDo} viDo={caiDatView(pa.huongView).viDo} chinhThamSo toaNguyen dauThanh={<>{dauThanh}<NutPhanTich /></>} {...luu} tenAnh={`Unitmix-${mau.id}`} phanTich={phanTich}
      lop={nutLop(['thang'], lopAn, doiLop)} lopAn={lopAn}
      tieuDe={`${mau.ten_vi.split(' · ')[0]} · ${toa.soTangDe ? toa.soTangDe + ' + ' : ''}${toa.soTangDH} ${t('m3d.tang')}`}
      chon={c} onChon={chon3d?.onChonToa} onMo={chon3d?.onMoToa} chuThich={chu}
      dung={({ T, goc, M, G, P }) => {
        const r = dungToa(T, goc, M, G, P, { mau, toa, tv, khoi3d: nap.khoi3d, loi: nap.loi, idLoi, mauTang });
        // lớp Trục thang bộ / lõi: khối xuyên tòa từ đất tới mái tum (mm mặt tòa → m)
        dungTrucThang(T, goc, ranhTumCo(mau, nap.loi, idLoi).map((x) => ({ pts: x.pts.map(([a, b]) => [a / 1000, b / 1000] as Diem), thang: x.thang, y0: 0, y1: r.canh.cao })));
        const bd = r.chon, hc = (P.tang - P.san) / 1000;
        return {
          ...r.canh, nen: true,
          chonTia: (o, h, catY) => chonTiaToa(bd, o, h, catY),
          hinhNhan: (d) => hinhNhanToa(bd, d, hc),
          doiTuongChon: (cc) => doiTuongDangChonToa(bd, cc),
        };
      }} />
  );
}

/** 3D một căn hộ theo mẫu căn trong thư viện. */
export function MoHinhCan({ canId, ten, tv }: { canId: string; ten: string; tv?: ThuVien | null }) {
  const nap = useNap3d([canId], [], tv);
  if (!nap.xong) return <div class="giua-man"><img class="spin-o" src="/brand/leo_ai_o.png" alt="" /><span>{t('m3d.dangDung')}</span></div>;
  const d = nap.khoi3d.get(canId);
  if (!d) return <div class="giua-man"><span>{t('m3d.chuaCoDuLieu')}</span></div>;
  return (
    <Khung3D khoa={'can|' + canId} chinhThamSo tieuDe={ten} tenAnh={`Unitmix-${canId}`}
      dung={({ T, goc, M, G, P }) => {
        dungCan(T, d, P, M, goc, G);
        const K = 0.001, bb = d.bb, cx = ((bb[0] + bb[2]) / 2) * K, cz = -((bb[1] + bb[3]) / 2) * K;
        const co = Math.max(bb[2] - bb[0], bb[3] - bb[1]) * K;
        return { tam: [cx, (P.tang - P.san) * K * 0.3, cz], coCanh: co, cao: (P.tang - P.san) * K };
      }} />
  );
}

/**
 * Nối chọn trong 3D với state chọn của 2D (`man/SoanThao.tsx`): đang chọn, bấm chọn, bấm đúp mở mặt bằng tầng.
 * Toàn dự án: tòa / lô (`onChon`, `onMo`). Công trình: căn / tầng của tòa đang xem (`onChonToa`, `onMoToa`).
 */
export type Chon3D = { chon: DangChon3D; onChon: (d: DoiTuong3D | null) => void; onMo: (d: DoiTuong3D) => void; onChonToa?: (d: DoiTuong3D | null) => void; onMoToa?: (d: DoiTuong3D) => void };
type PropsChinh = { pa: TrangThaiPA; tv: ThuVien; sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void; chiXem: boolean; toa: ToaDat | null; mau: ToaVe | null; mauTang?: (tang: number | null) => ToaVe; tenDuAn: string; chon3d?: Chon3D };

/** Tab 3D: chọn Toàn dự án (ô đất, cây xanh, mặt nước, khối tòa) hoặc Công trình (tòa đang chọn, chi tiết từng căn); góc nhìn lưu trong PA. */
export function MoHinhChinh({ pa, tv, sua, chiXem, toa, mau, mauTang, tenDuAn, chon3d }: PropsChinh) {
  const [che, setChe] = useState<'du_an' | 'toa'>('du_an');
  const [lopAn, doiLop] = useLop3D();
  const hienHam = !lopAn.includes('ham');
  const bat = useLopView(), loc = useLocView();
  const vt = useViewTang(pa, tv, bat && che === 'du_an');
  const vHam = useNgheHam('3d'); // hầm rải trong Web Worker: có kết quả mới thì dựng lại (khoaNhe)
  // tầng tum + trục thang mọi tòa: mặt bằng hiệu dụng (đã tự chỉnh) + hình lõi; nạp lõi lười, chưa xong thì dựng không tum rồi dựng lại
  const mbToa = useMemo(() => new Map(pa.toa.flatMap((x) => {
    const m0 = mauToa(tv, x);
    return m0 && coMat(m0) ? [[x.id, { x, m0, m: mauCuaToa(x, m0 as ToaVe, null) }] as const] : [];
  })), [pa.toa, tv]);
  const loiDA = useMemo(() => [...new Set([...mbToa.values()].flatMap(({ m }) => m.mat.flatMap((f) => f.phan_tu.filter((q) => q.loai !== 'can' && !q.bang).map((q) => idLoi(q.block)))))], [mbToa]);
  const napLoi = useNap3d([], loiDA, tv);
  const tumToa = (id: string) => {
    const d = mbToa.get(id);
    if (!d || !napLoi.xong) return [];
    // như chanToa (tinh/hinhHoc): tâm khung bao nét mẫu, lật, xoay + dời theo tòa — mm → m
    const xs = d.m0.duong_bao.map((p) => p[0]), ys = d.m0.duong_bao.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, s = d.x.lat ? -1 : 1;
    return ranhTumCo(d.m, napLoi.loi, idLoi).map((r) => {
      const m = r.pts.map(([px, py]) => [(s * (px - cx)) / 1000, (py - cy) / 1000] as Diem);
      return { pts: xoayTinhTien(d.x.lat ? m.reverse() : m, d.x.x, d.x.y, d.x.gocDo), thang: r.thang };
    });
  };
  const xem = che === 'toa' && toa && mau ? 'toa' : 'du_an';
  const gocLuu = (pa.gocNhin ?? []).filter((g) => g.che === xem && (xem === 'du_an' || g.toaId === toa?.id));
  const luu: LuuGoc = {
    gocLuu,
    onLuuGoc: chiXem ? undefined : (g) => sua((p) => ({ ...p, gocNhin: [...(p.gocNhin ?? []), { ...g, id: `g-${Date.now().toString(36)}`, che: xem, toaId: xem === 'toa' ? toa?.id : undefined }] })),
    onXoaGoc: chiXem ? undefined : (id) => sua((p) => ({ ...p, gocNhin: (p.gocNhin ?? []).filter((g) => g.id !== id) })),
  };
  const nut = (
    <span class="nhom-3d chon-che" role="group" aria-label={t('m3d.che')}>
      <button type="button" aria-pressed={xem === 'du_an'} onClick={() => setChe('du_an')}>{t('m3d.duAn')}</button>
      <button type="button" aria-pressed={xem === 'toa'} disabled={!toa} onClick={() => setChe('toa')}>{t('m3d.congTrinh')}</button>
    </span>
  );
  const nutHam = (
    <span class="nhom-3d" role="group" aria-label={t('m3d.ham')}>
      <button type="button" aria-pressed={hienHam} title={t('m3d.hamGiaiThich')} onClick={() => doiLop('ham')}>{t('m3d.ham')}</button>
      {hienHam && dieuPhoiHam.dangChoKenh('3d') && <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0 8px' }}><img class="spin-o" src="/brand/leo_ai_o.png" alt="" style={{ width: '14px', height: '14px' }} />{t('ham.dangRai')}</span>}
    </span>
  );
  if (xem === 'toa' && toa && mau) return <MoHinhToa pa={pa} tv={tv} toa={toa} mau={mau} mauTang={mauTang} dauThanh={nut} chon3d={chon3d} {...luu} />;
  const kq = vt.kq;
  const phanTich: PhanTich3D = {
    bat, loc, khoa: kq ? String(idKq(kq)) : '',
    dung: kq?.daiTang ? (T) => dungHinhView(T, oDuAn(kq.can, kq.daiTang!, new Map(pa.toa.map((x) => [x.id, { z0: 0.2 + x.soTangDe * x.caoDe, caoDH: x.caoDH }])))) : null,
    doc: (o) => {
      const x = pa.toa.find((q) => q.id === o.toaId), lo = pa.lo.find((l) => l.id === o.d.loId);
      return docO(o, kq!, () => `${x ? tv.toa.get(x.mauId)?.ten_vi.split(' · ')[0] ?? x.mauId : '—'}${lo ? ` · ${lo.temDat.kyHieu}` : ''}`,
        (q) => (q.d.loai ? t(`loai.${q.d.loai}`) : '—'), (id) => pa.toa.find((q) => q.id === id)?.soTangDe ?? 0);
    },
    chuGiai: kq ? <ChuGiai3D kq={kq} soO={kq.can.reduce((s, d) => s + (d.bang?.tong.length ?? 0), 0)} phamVi={t('m3d.duAn')} /> : null,
  };
  // tòa đang xem không vào khoá: đổi tòa (kể cả bấm chọn trong 3D) chỉ dựng lại nhẹ, giữ góc nhìn (góc "Cận tòa chọn" theo tòa mới)
  const khoa = ['du_an', pa.lo.length, pa.toa.map((x) => [x.id, x.mauId, x.x, x.y, x.gocDo, x.lat ? 1 : 0, x.soTangDe, x.soTangDH, x.deOffset].join(',')).join(';')].join('|');
  return (
    <Khung3D khoa={khoa} khoaNhe={JSON.stringify(pa.ham) + '|' + vHam + '|' + (toa?.id ?? '') + '|' + napLoi.xong + '|' + loiDA.join()} toaNguyen dauThanh={<>{nut}{nutHam}<NutPhanTich /></>} {...luu} tieuDe={tenDuAn} tenAnh={`Unitmix-${tenDuAn}`} phanTich={phanTich}
      chon={chon3d?.chon} onChon={chon3d?.onChon} onMo={chon3d?.onMo}
      lop={nutLop(['tum', 'ham', 'thang', 'gio', 'cay', 'duong', 'ranh'], lopAn, doiLop)} lopAn={lopAn}
      gocBac={caiDatView(pa.huongView).gocBac} viDo={caiDatView(pa.huongView).viDo} dung={({ T, goc, M, kieu, capDo }) => dungDuAn(T, goc, M, kieu, pa, tv, toa?.id ?? null, { capDo, tumToa })} />
  );
}
