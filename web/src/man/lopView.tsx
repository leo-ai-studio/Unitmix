/**
 * PHÂN TÍCH VIEW căn hộ ở Tổng mặt bằng (tinh/huongView.ts): dải màu liên tục ở mặt ngoài từng căn (thang LEO tinh/mauView.ts), tia
 * view của tòa đang chọn, chú giải thang màu + lọc khoảng điểm + hoa hướng (lớp phủ), panel phân tích (điểm TB lớn, Tốt / Khá / Kém,
 * biểu đồ tần suất, từng tòa theo tầng, vấn đề bấm để tìm, Thiết lập gập). Chỉ đọc PA; cài đặt ghi `TrangThaiPA.huongView` qua `sua`.
 * Heuristic thiết kế — không phải quy chuẩn. Trạng thái bật lớp / lọc / tia ở cấp module (không lưu PA), dùng chung với 3D + màn Tầng.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { mauToa } from '../tinh/canThem';
import { chanToa } from '../tinh/hinhHoc';
import {
  caiDatView, danhGiaViewPA, xepLoai,
  type CaiDatView, type DiemViewCan, type KcTheoH, type KetQuaViewPA, type TongHopView, type TrongSoView, type XepLoaiView,
} from '../tinh/huongView';
import type { CaiDatViewLuu, Diem, Lo, ThuVien, TrangThaiPA } from '../tinh/kieu';
import { bieuDoView, chuTrenView, gradientCss, mauViewCss } from '../tinh/mauView';
import { danhGiaViewNen, msViewNen } from '../tinh/viewNen';
import { kcToa261 } from '../tinh/xepToa';
import { MucGap } from '../ui/MucGap';
import { NutBieuTuong } from '../ui/NutBieuTuong';
import { fmtSo } from '../ui/so';
import type { NutHienThi } from '../ui/ThanhHienThi';
import { useLuatTMB } from './tmbThaoTac';
import { nhanToa } from '../ui/nhanToa';

// ---- trạng thái lớp (cấp module, không lưu vào PA): bật, lọc khoảng điểm, tia view ----
type TrangThaiLop = { bat: boolean; loc: [number, number] | null; tia: boolean };
let tt: TrangThaiLop = { bat: false, loc: null, tia: true };
const nghe = new Set<() => void>();
const dat = (p: Partial<TrangThaiLop>) => { tt = { ...tt, ...p }; nghe.forEach((f) => f()); };
export const datLopView = (v: boolean) => dat({ bat: v });
export const datLocView = (loc: [number, number] | null) => dat({ loc });
export const datTiaView = (v: boolean) => dat({ tia: v });
function useTT(): TrangThaiLop {
  const [, ve] = useState(0);
  useEffect(() => { const f = () => ve((n) => n + 1); nghe.add(f); return () => void nghe.delete(f); }, []);
  return tt;
}
export function useLopView(): boolean { return useTT().bat; }
export function useLocView(): [number, number] | null { return useTT().loc; }
/** Nút trong danh sách Lớp (GocBanVe) của TMB / màn Tầng. */
export const nutLopView = (): NutHienThi => ({ khoa: 'view', nhan: t('view.lop'), bat: tt.bat, onClick: () => datLopView(!tt.bat) });

/** Màu xếp loại (chip, thanh Tốt / Khá / Kém): lấy từ thang liên tục ở điểm đại diện từng hạng. */
export const MAU_XEP: Record<XepLoaiView, string> = { tot: mauViewCss(90), kha: mauViewCss(70), kem: mauViewCss(30) };
export const TEN_HUONG = (i: number) => t(`view.h8.${i}`);
/** Điểm nằm trong bộ lọc khoảng (null = không lọc). */
export const trongLoc = (v: number, loc: [number, number] | null) => !loc || (v >= loc[0] - 1e-9 && v <= loc[1] + 1e-9);

// ---- tính (nhớ kết quả gần nhất: panel trái, panel phải, bản vẽ cùng dùng) ----
let nho: { khoa: string; tv: ThuVien; kq: KetQuaViewPA } | null = null;
export const khoaPA = (pa: TrangThaiPA, coLuat: boolean) => JSON.stringify([
  pa.lo.map((l) => [l.id, l.ranh, l.canhDuong ?? null, l.temDat.kyHieu, l.temDat.chucNang]),
  pa.toa.map((x) => [x.id, x.loId, x.mauId, x.x, x.y, x.gocDo, !!x.lat, x.soTangDH, x.soTangDe, x.caoDe, x.caoDH, x.canTheo, x.canViTri ?? null, x.congNang ?? null, x.latO ?? null, x.canThem ?? null]),
  pa.huongView ?? null, coLuat,
]);
/** Đánh giá view cả PA ở tầng giữa (nhớ theo chữ ký PA + thư viện). Luật LO-02 chưa tải thì quy đổi thoáng theo `nguongGan`. */
export function useViewPA(pa: TrangThaiPA, tv: ThuVien | null): KetQuaViewPA | null {
  const luat = useLuatTMB();
  if (!tv) return null;
  const k = khoaPA(pa, !!luat);
  if (nho?.khoa !== k || nho.tv !== tv) {
    const kc: KcTheoH | undefined = luat ? (H) => kcToa261(luat.lo02, H).dai : undefined;
    nho = { khoa: k, tv, kq: danhGiaViewPA(pa, tv, { kc }) };
  }
  return nho.kq;
}

// ---- theo dải tầng (3D, panel "theo tầng"): tính nền trong Web Worker, nhớ theo chữ ký PA ----
let nhoTang: { khoa: string; tv: ThuVien; kq: KetQuaViewPA | null; ms: number; xong: boolean } | null = null;
const ngheTang = new Set<() => void>();
/**
 * Điểm view theo dải tầng (≤ 40 dải / tòa) — chỉ tính khi `can` (lớp bật / 3D đang phân tích). Trả kết quả gần nhất (cũ vẫn trả
 * trong lúc tính lượt mới, `dang` = true) để lớp 3D không chớp.
 */
export function useViewTang(pa: TrangThaiPA, tv: ThuVien | null, can: boolean): { kq: KetQuaViewPA | null; dang: boolean; ms: number } {
  const luat = useLuatTMB();
  const [, ve] = useState(0);
  useEffect(() => { const f = () => ve((n) => n + 1); ngheTang.add(f); return () => void ngheTang.delete(f); }, []);
  const k = tv ? khoaPA(pa, !!luat) : '';
  const moi = !!tv && can && (nhoTang?.khoa !== k || nhoTang.tv !== tv);
  useEffect(() => {
    if (!moi || !tv) return;
    const cu = nhoTang?.tv === tv ? nhoTang.kq : null;
    nhoTang = { khoa: k, tv, kq: cu, ms: 0, xong: false };
    // lượt mới thay lượt cũ (danhGiaViewNen trả null cho lượt bị thay); kết quả chỉ nhận khi chữ ký PA còn khớp
    danhGiaViewNen(pa, tv, luat?.lo02 ?? null, 40).then((kq) => {
      if (!kq || nhoTang?.khoa !== k) return;
      nhoTang = { khoa: k, tv, kq, ms: msViewNen, xong: true };
      ngheTang.forEach((f) => f());
    }).catch(() => { if (nhoTang?.khoa === k) { nhoTang = { ...nhoTang, xong: true }; ngheTang.forEach((f) => f()); } });
  }, [moi, k, tv]);
  if (!tv || !nhoTang || nhoTang.tv !== tv) return { kq: null, dang: can, ms: 0 };
  return { kq: nhoTang.kq, dang: !nhoTang.xong || nhoTang.khoa !== k, ms: nhoTang.ms };
}

// ---- lớp bản vẽ TMB ----
const xoay = (n: Diem, deg: number): Diem => { const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r); return [n[0] * c - n[1] * s, n[0] * s + n[1] * c]; };
const GOC_TIA = [-30, -15, 0, 15, 30];
/** Sâu dải màu ngoài mặt căn (m): theo cỡ chữ bản vẽ (≈ 18 px trên màn ở mọi mức phóng), tối thiểu 4 m. */
const sauDai = (coChu: number) => Math.max(4, coChu * 1.4);

/** Số mức màu khi gộp nét / dải theo màu (thang liên tục lượng tử 40 mức ≈ 2,5 điểm / mức — mắt không phân biệt được). */
const MUC = 40;
/** Độ mờ 4 lớp dải (gần mặt → xa): giả gradient theo pháp tuyến mà không cần mỗi mặt một <linearGradient>. */
const LOP_DAI = [0.55, 0.32, 0.16, 0.06];

/**
 * Lớp TMB: mỗi mặt căn một dải màu mờ dần ra ngoài (4 lớp độ mờ theo pháp tuyến) + nét mặt có viền sáng; nhãn chip "View nn" dưới
 * tên tòa; tòa đang chọn: 5 tia view mỗi căn tới vật cản (mờ dần, chấm cuối khi bị che). Chỉ hiện khi bật lớp.
 * Gộp theo mức màu: mỗi mức một <path> cho mỗi lớp dải + một <path> nét — dự án 50 tòa / 1 300 mặt căn còn ~200 phần tử SVG
 * (trước: 1 300 gradient + 4 000 phần tử, bật lớp ~150 ms).
 */
export function LopViewTmb({ pa, tv, coChu, toaId }: { pa: TrangThaiPA; tv: ThuVien | null; coChu: number; toaId?: string | null }) {
  const s = useTT();
  const kq = useViewPA(pa, tv);
  if (!s.bat || !kq) return null;
  return <LopTmbTrong pa={pa} kq={kq} coChu={coChu} toaId={toaId ?? null} loc={s.loc} tia={s.tia} />;
}
function LopTmbTrong({ pa, kq, coChu, toaId, loc, tia }: { pa: TrangThaiPA; kq: KetQuaViewPA; coChu: number; toaId: string | null; loc: [number, number] | null; tia: boolean }) {
  const nhom = useMemo(() => {
    const sd = sauDai(coChu), f = (v: number) => v.toFixed(2);
    // khoá = mức màu (0..MUC) hoặc -1 = ngoài bộ lọc
    const g = new Map<number, { dai: string[]; net: string }>();
    let vien = '';
    for (const d of kq.can) {
      const k = trongLoc(d.tong, loc) ? Math.round((d.tong / 100) * MUC) : -1;
      let o = g.get(k);
      if (!o) g.set(k, (o = { dai: LOP_DAI.map(() => ''), net: '' }));
      const seg = `M${f(d.A[0])},${f(-d.A[1])}L${f(d.B[0])},${f(-d.B[1])}`;
      o.net += seg; vien += seg;
      LOP_DAI.forEach((_, j) => {
        const a = (sd * j) / LOP_DAI.length, b = (sd * (j + 1)) / LOP_DAI.length, nx = d.n[0], ny = d.n[1];
        o!.dai[j] += `M${f(d.A[0] + nx * a)},${f(-(d.A[1] + ny * a))}L${f(d.B[0] + nx * a)},${f(-(d.B[1] + ny * a))}L${f(d.B[0] + nx * b)},${f(-(d.B[1] + ny * b))}L${f(d.A[0] + nx * b)},${f(-(d.A[1] + ny * b))}Z`;
      });
    }
    return { g: [...g].sort((p, q) => p[0] - q[0]), vien };
  }, [kq, coChu, loc]);
  const tiaToa = tia && toaId ? kq.can.filter((d) => d.toaId === toaId) : [];
  return (
    <g class="lop-view" pointer-events="none">
      <defs>
        {tiaToa.flatMap((d, i) => d.tiaL.map((L, j) => {
          const dv = xoay(d.n, GOC_TIA[j]), E: Diem = [d.O[0] + dv[0] * L, d.O[1] + dv[1] * L];
          return (
            <linearGradient key={`t${i}-${j}`} id={`tv${i}-${j}`} gradientUnits="userSpaceOnUse" x1={d.O[0]} y1={-d.O[1]} x2={E[0]} y2={-E[1]}>
              <stop offset="0" stop-color={mauViewCss(d.tong)} stop-opacity="0.85" />
              <stop offset="1" stop-color={mauViewCss(d.tong)} stop-opacity={L < 149 ? 0.5 : 0} />
            </linearGradient>
          );
        }))}
      </defs>
      {tiaToa.length > 0 && (
        <g class="tia-view">
          {tiaToa.flatMap((d, i) => d.tiaL.map((L, j) => {
            const dv = xoay(d.n, GOC_TIA[j]), E: Diem = [d.O[0] + dv[0] * L, d.O[1] + dv[1] * L];
            return (
              <g key={`${i}-${j}`} opacity={trongLoc(d.tong, loc) ? 1 : 0.15}>
                <line x1={d.O[0]} y1={-d.O[1]} x2={E[0]} y2={-E[1]} stroke={`url(#tv${i}-${j})`} stroke-width={j === 2 ? 1.6 : 0.9} stroke-linecap="round" vector-effect="non-scaling-stroke" />
                {L < 149 && <circle cx={E[0]} cy={-E[1]} r={coChu * 0.09} fill={mauViewCss(d.tong)} fill-opacity="0.75" />}
              </g>
            );
          }))}
        </g>
      )}
      {nhom.g.map(([k, o]) => (k < 0 ? null : o.dai.map((d, j) => <path key={`d${k}-${j}`} d={d} fill={mauViewCss((k / MUC) * 100)} fill-opacity={LOP_DAI[j]} />)))}
      <path d={nhom.vien} fill="none" stroke="var(--panel)" stroke-width="5.5" stroke-linecap="round" vector-effect="non-scaling-stroke" />
      {nhom.g.map(([k, o]) => (
        <path key={`n${k}`} d={o.net} fill="none" stroke={k < 0 ? 'var(--secondary)' : mauViewCss((k / MUC) * 100)} stroke-opacity={k < 0 ? 0.45 : 1}
          stroke-width="3.5" stroke-linecap="round" vector-effect="non-scaling-stroke" />
      ))}
      {pa.toa.map((x) => {
        const th = kq.theoToa.get(x.id);
        if (th?.tb == null) return null;
        const w = coChu * 3.1, h = coChu * 1.05, y = -x.y + coChu * 1.9;
        return (
          <g key={x.id} class="nhan-view-toa">
            <rect x={x.x - w / 2} y={y} width={w} height={h} rx={h / 2} fill={mauViewCss(th.tb)} stroke="var(--panel)" stroke-width={coChu * 0.1} />
            <text x={x.x} y={y + h / 2} text-anchor="middle" dominant-baseline="central" font-size={coChu * 0.66} font-weight="700" fill={chuTrenView(th.tb)}>
              {`${t('view.ngan')} ${fmtSo(th.tb, { thapPhan: 0 })}`}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ---- thang màu + chú giải ----
/** Thanh thang màu 0–100 (gradient liên tục), vạch 0 · 20 · … · 100, mốc ngưỡng Khá / Tốt; ba đoạn xếp loại bấm để lọc. */
export function ThanhMauView({ cai, gon = false }: { cai: Pick<CaiDatView, 'nguongKha' | 'nguongTot'>; gon?: boolean }) {
  const loc = useLocView();
  const doan: [XepLoaiView, number, number][] = [['kem', 0, cai.nguongKha], ['kha', cai.nguongKha, cai.nguongTot], ['tot', cai.nguongTot, 100]];
  const tren = (k: XepLoaiView, b: number) => (k === 'tot' ? 100 : b - 0.001);
  const dangLoc = (a: number, b: number) => !!loc && loc[0] === a && loc[1] === b;
  return (
    <div class={`thang-view${gon ? ' gon' : ''}`}>
      <div class="thang-view-thanh" style={{ background: gradientCss() }} role="img" aria-label={t('view.thangMau')}>
        {loc && <i class="thang-view-loc" style={{ left: `${loc[0]}%`, width: `${loc[1] - loc[0]}%` }} />}
        {[cai.nguongKha, cai.nguongTot].map((v) => <b key={v} class="thang-view-moc" style={{ left: `${v}%` }} />)}
      </div>
      {!gon && <div class="thang-view-vach" aria-hidden="true">{[0, 20, 40, 60, 80, 100].map((v) => <span key={v} style={{ left: `${v}%` }}>{v}</span>)}</div>}
      <div class="thang-view-doan" role="group" aria-label={t('view.locHang')}>
        {doan.map(([k, a, b]) => (
          <button type="button" key={k} aria-pressed={dangLoc(a, tren(k, b))} style={{ flexGrow: 1 }}
            title={`${k === 'kem' ? `< ${fmtSo(b)}` : k === 'tot' ? `≥ ${fmtSo(a)}` : `${fmtSo(a)}–${fmtSo(b)}`} · ${t('view.locGoiY')}`}
            onClick={() => datLocView(dangLoc(a, tren(k, b)) ? null : [a, tren(k, b)])}>
            <i style={{ background: MAU_XEP[k] }} />{t(`view.${k}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Đếm căn (theo số tầng) + điểm TB theo 8 hướng. */
function theoHuong(ds: DiemViewCan[]): { n: number; tb: number }[] {
  const o = Array.from({ length: 8 }, () => ({ n: 0, s: 0 }));
  for (const d of ds) { o[d.h8].n += d.so; o[d.h8].s += d.so * d.tong; }
  return o.map((x) => ({ n: x.n, tb: x.n ? x.s / x.n : 0 }));
}

/**
 * Hoa hướng kiểu hoa gió: vòng ngoài 8 cung tô nhóm hướng (tốt / trung bình / kém), cánh trong dài theo số căn nhìn hướng đó, màu theo
 * điểm TB; quay theo góc Bắc dự án (B = Bắc thật).
 */
export function HoaHuongView({ ds, cai, co = 92 }: { ds: DiemViewCan[]; cai: CaiDatView; co?: number }) {
  const h = theoHuong(ds), max = Math.max(1, ...h.map((x) => x.n));
  const R = 40, r0 = 9;
  const cung = (i: number, a: number, b: number, ra: number, rb: number) => {
    const p = (deg: number, r: number) => { const q = ((deg - 90) * Math.PI) / 180; return `${(r * Math.cos(q)).toFixed(2)},${(r * Math.sin(q)).toFixed(2)}`; };
    const a0 = i * 45 + a, a1 = i * 45 + b;
    return `M${p(a0, ra)} A${ra},${ra} 0 0 1 ${p(a1, ra)} L${p(a1, rb)} A${rb},${rb} 0 0 0 ${p(a0, rb)}Z`;
  };
  const nhom = (g: number) => (g > 0 ? MAU_XEP.tot : g < 0 ? MAU_XEP.kem : MAU_XEP.kha);
  return (
    <svg class="hoa-huong-view" viewBox="-50 -50 100 100" width={co} height={co} role="img" aria-label={t('view.hoaHuong')}>
      <g transform={`rotate(${-cai.gocBac})`}>
        {h.map((x, i) => <path key={`v${i}`} d={cung(i, -21, 21, R + 2, R + 7)} fill={nhom(cai.nhomHuong[i])} opacity="0.85"><title>{`${TEN_HUONG(i)} · ${t(cai.nhomHuong[i] > 0 ? 'view.tot' : cai.nhomHuong[i] < 0 ? 'view.kem' : 'view.tb3')}`}</title></path>)}
        <circle r={R} fill="none" stroke="var(--line)" stroke-width="0.6" />
        <circle r={R * 0.5} fill="none" stroke="var(--line)" stroke-width="0.5" stroke-dasharray="1.5 2" />
        {h.map((x, i) => x.n > 0 && (
          <path key={`c${i}`} d={cung(i, -17, 17, r0 + (R - r0) * Math.sqrt(x.n / max), r0)} fill={mauViewCss(x.tb)} stroke="var(--panel)" stroke-width="0.8">
            <title>{`${TEN_HUONG(i)}: ${fmtSo(x.n)} ${t('view.canNgan')} · ${t('view.ngan')} ${fmtSo(x.tb, { thapPhan: 0 })}`}</title>
          </path>
        ))}
        {[0, 2, 4, 6].map((i) => {
          const q = ((i * 45 - 90) * Math.PI) / 180, rr = R + 4.5;
          return <text key={i} x={rr * Math.cos(q)} y={rr * Math.sin(q)} transform={`rotate(${cai.gocBac} ${rr * Math.cos(q)} ${rr * Math.sin(q)})`} text-anchor="middle" dominant-baseline="central" font-size="7" font-weight={i === 0 ? 700 : 600} fill={i === 0 ? 'var(--ink)' : 'var(--panel)'}>{TEN_HUONG(i)}</text>;
        })}
      </g>
    </svg>
  );
}

/** Chú giải lớp view (lớp phủ trên khung giữa, chỉ khi bật lớp): thang màu + lọc, hoa hướng, tia view, tắt lớp. */
export function ChuGiaiView({ pa, tv }: { pa: TrangThaiPA; tv?: ThuVien | null }) {
  const s = useTT();
  const kq = useViewPA(pa, tv ?? null);
  if (!s.bat) return null;
  const c = kq?.cai ?? caiDatView(pa.huongView);
  return (
    <div class="chu-giai-view" role="note" aria-label={t('view.chuGiai')}>
      <div class="cgv-dau">
        <b>{t('view.phanTich')}</b>
        <span class="gian" />
        <label class="cgv-tia" title={t('gt.view.tia')}><input type="checkbox" checked={s.tia} onChange={(e) => datTiaView(e.currentTarget.checked)} />{t('view.tia')}</label>
        <button type="button" class="nut-dong-view" aria-label={t('view.tatLop')} title={t('view.tatLop')} onClick={() => datLopView(false)}>×</button>
      </div>
      <div class="cgv-than">
        <ThanhMauView cai={c} />
        {kq && kq.can.length > 0 && <HoaHuongView ds={kq.can} cai={c} co={78} />}
      </div>
    </div>
  );
}

// ---- khối số ----
/** Thanh xếp chồng Tốt / Khá / Kém + chú thích. */
function ThanhHang({ th, nho = false }: { th: TongHopView; nho?: boolean }) {
  const p = (v: number) => fmtSo(v, { thapPhan: 0, donVi: '%' });
  const ds: [XepLoaiView, number, number][] = [['tot', th.pctTot, th.soTot], ['kha', th.pctKha, th.soKha], ['kem', th.pctKem, th.soKem]];
  return (
    <div class={`hang-view${nho ? ' nho' : ''}`}>
      <div class="thanh-view" role="img" aria-label={ds.map(([k, v]) => `${t(`view.${k}`)} ${p(v)}`).join(' · ')}>
        {ds.map(([k, v]) => v > 0 && <i key={k} style={{ width: `${v}%`, background: MAU_XEP[k] }} title={`${t(`view.${k}`)} ${p(v)}`} />)}
      </div>
      {!nho && (
        <div class="hang-view-chu">
          {ds.map(([k, v, n]) => <span key={k}><i style={{ background: MAU_XEP[k] }} />{t(`view.${k}`)} <b>{p(v)}</b> <small>{fmtSo(n)}</small></span>)}
        </div>
      )}
    </div>
  );
}

/** Biểu đồ tần suất 20 ô: cột tô theo thang màu, mốc ngưỡng, vạch điểm TB. */
function BieuDoTanSuat({ ds, cai, tb }: { ds: DiemViewCan[]; cai: CaiDatView; tb: number | null }) {
  const h = bieuDoView(ds, 20), max = Math.max(1, ...h);
  const W = 200, H = 54;
  return (
    <svg class="bieu-do-view" viewBox={`0 0 ${W} ${H + 12}`} role="img" aria-label={t('view.tanSuat')}>
      <line x1="0" x2={W} y1={H} y2={H} stroke="var(--line)" stroke-width="1" />
      {h.map((n, i) => {
        const bh = (n / max) * (H - 4);
        return n > 0 && (
          <rect key={i} x={(i * W) / 20 + 0.8} y={H - bh} width={W / 20 - 1.6} height={bh} rx="1.5" fill={mauViewCss((i + 0.5) * 5)}>
            <title>{`${i * 5}–${i * 5 + 5}: ${fmtSo(n)} ${t('view.canNgan')}`}</title>
          </rect>
        );
      })}
      {[cai.nguongKha, cai.nguongTot].map((v) => <line key={v} x1={(v / 100) * W} x2={(v / 100) * W} y1="0" y2={H} stroke="var(--muted-text)" stroke-width="0.8" stroke-dasharray="2 2" />)}
      {tb !== null && <path d={`M${(tb / 100) * W},${H + 1} l-3.5,6 h7 z`} fill="var(--ink)"><title>{`${t('view.tb')} ${fmtSo(tb, { thapPhan: 1 })}`}</title></path>}
      {[0, 50, 100].map((v) => <text key={v} x={(v / 100) * W} y={H + 11} font-size="8" fill="var(--muted-text)" text-anchor={v === 0 ? 'start' : v === 100 ? 'end' : 'middle'}>{v}</text>)}
    </svg>
  );
}

/** Bốn thành phần: thanh ngang nhỏ 0–100. */
function ThanhPhan({ tp, w }: { tp: TrongSoView; w: TrongSoView }) {
  return (
    <div class="tp-view" title={t('gt.view.thanhPhan')}>
      {(['huong', 'thoang', 'canh', 'nang'] as const).map((k) => (
        <div class="tp-view-dong" key={k}>
          <span>{t(`view.tp.${k}`)} <small>{fmtSo(w[k])}</small></span>
          <span class="tp-view-thanh"><i style={{ width: `${Math.max(0, Math.min(100, tp[k]))}%`, background: mauViewCss(tp[k]) }} /></span>
          <b>{fmtSo(tp[k], { thapPhan: 0 })}</b>
        </div>
      ))}
    </div>
  );
}

/** Số lớn kiểu KPI: điểm TB / 100 + chip xếp loại. */
function SoLon({ th, cai, phu }: { th: TongHopView; cai: CaiDatView; phu?: ComponentChildren }) {
  const xl = th.tb === null ? null : xepLoai(th.tb, cai);
  return (
    <div class="so-lon-view" title={t('gt.view.tb')}>
      <div class="so-lon-view-gt">
        <b style={{ color: th.tb === null ? undefined : mauViewCss(Math.min(th.tb, 92)) }}>{fmtSo(th.tb, { thapPhan: 0 })}</b><small>/ 100</small>
        {xl && th.tb !== null && <span class="chip-view" style={{ background: mauViewCss(th.tb), color: chuTrenView(th.tb) }}>{t(`view.${xl}`)}</span>}
      </div>
      <div class="so-lon-view-phu">{t('view.tb')} · {phu}</div>
    </div>
  );
}

/** Khối view của tòa đang chọn (panel trái, mục Thông số tòa). */
export function TheViewToa({ pa, tv, toaId }: { pa: TrangThaiPA; tv: ThuVien | null; toaId: string }) {
  const kq = useViewPA(pa, tv);
  const th = kq?.theoToa.get(toaId);
  if (!kq || !th) return null;
  return (
    <div class="the-view-toa">
      <SoLon th={th} cai={kq.cai} phu={t('view.canTinh').replace('{n}', fmtSo(th.soCan))} />
      <ThanhHang th={th} />
    </div>
  );
}

/** Ô số nhỏ cho cài đặt. */
function OSo({ nhan, tip, gt, onDoi, tat, buoc = 1, min, max, donVi }: { nhan: string; tip?: string; gt: number; onDoi: (v: number) => void; tat: boolean; buoc?: number; min?: number; max?: number; donVi?: string }) {
  return (
    <label class="o-so" title={tip}>
      <span>{nhan}</span>
      <span class="o-so-nhap">
        <input type="number" value={gt} step={buoc} min={min} max={max} disabled={tat}
          onChange={(e) => { const v = Number(e.currentTarget.value); if (Number.isFinite(v)) onDoi(v); }} />
        {donVi && <small>{donVi}</small>}
      </span>
    </label>
  );
}

/** Đường nhỏ điểm TB theo dải tầng (thấp → cao, trái → phải). */
function DuongTang({ ys }: { ys: number[] }) {
  if (ys.length < 2) return <span class="duong-tang" />;
  const W = 64, H = 18, n = ys.length;
  const lo = Math.min(...ys), hi = Math.max(...ys), mid = (lo + hi) / 2, span = Math.max(hi - lo, 10);
  const y = (v: number) => H / 2 - ((v - mid) / span) * (H - 4);
  const d = ys.map((v, i) => `${i ? 'L' : 'M'}${((i / (n - 1)) * W).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg class="duong-tang" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${fmtSo(ys[0], { thapPhan: 0 })} → ${fmtSo(ys[n - 1], { thapPhan: 0 })}`}>
      <defs>
        <linearGradient id={`dt-${Math.round(lo)}-${Math.round(hi)}-${n}`} x1="0" x2="1">{ys.filter((_, i) => i % Math.ceil(n / 6) === 0 || i === n - 1).map((v, i, a) => <stop key={i} offset={a.length > 1 ? i / (a.length - 1) : 0} stop-color={mauViewCss(v)} />)}</linearGradient>
      </defs>
      <path d={d} fill="none" stroke={`url(#dt-${Math.round(lo)}-${Math.round(hi)}-${n})`} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx={W} cy={y(ys[n - 1])} r="2" fill={mauViewCss(ys[n - 1])} />
    </svg>
  );
}

/** Điểm TB từng dải tầng của một tòa (theo kết quả nhiều tầng). */
const tbTheoTang = (kq: KetQuaViewPA | null, toaId: string): number[] => {
  if (!kq) return [];
  const ds = kq.can.filter((d) => d.toaId === toaId && d.bang);
  if (!ds.length) return [];
  const n = ds[0].bang!.tong.length;
  return Array.from({ length: n }, (_, i) => ds.reduce((s, d) => s + d.bang!.tong[i], 0) / ds.length);
};

/** Vấn đề: căn hướng Tây, bị che gần, cặp tòa mặt đối mặt — mỗi mục có tòa để bấm tìm. */
type VanDe = { khoa: string; nhan: string; so: number; toa: string[]; tip: string };
function timVanDe(pa: TrangThaiPA, tv: ThuVien, ds: DiemViewCan[], cai: CaiDatView): VanDe[] {
  const dem = (f: (d: DiemViewCan) => boolean) => {
    const m = new Map<string, number>();
    let n = 0;
    for (const d of ds) if (f(d)) { n += d.so; m.set(d.toaId, (m.get(d.toaId) ?? 0) + d.so); }
    return { n, toa: [...m].sort((a, b) => b[1] - a[1]).map(([id]) => id) };
  };
  const tay = dem((d) => d.h8 === 6), gan = dem((d) => d.doiDien), kem = dem((d) => d.xep === 'kem');
  // cặp mặt đối mặt: điểm cuối tia giữa của căn bị che gần nằm trong chân tòa nào
  const chan = pa.toa.flatMap((x) => { const m = mauToa(tv, x); return m ? [{ id: x.id, P: chanToa(m, x) }] : []; });
  const trong = (p: Diem, P: Diem[]) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [x1, y1] = P[i], [x2, y2] = P[j]; if ((y1 > p[1]) !== (y2 > p[1]) && p[0] < ((x2 - x1) * (p[1] - y1)) / (y2 - y1) + x1) c = !c; } return c; };
  const cap = new Map<string, [string, string]>();
  for (const d of ds) {
    if (!d.doiDien || d.kcCan === null) continue;
    const p: Diem = [d.O[0] + d.n[0] * (d.kcCan + 0.5), d.O[1] + d.n[1] * (d.kcCan + 0.5)];
    const o = chan.find((c) => c.id !== d.toaId && trong(p, c.P));
    if (o) { const k = [d.toaId, o.id].sort() as [string, string]; cap.set(k.join('|'), k); }
  }
  return [
    { khoa: 'kem', nhan: t('view.vd.kem').replace('{v}', fmtSo(cai.nguongKha)), so: kem.n, toa: kem.toa, tip: t('gt.view.nguong') },
    { khoa: 'tay', nhan: t('view.soTay'), so: tay.n, toa: tay.toa, tip: t('gt.view.tay') },
    { khoa: 'gan', nhan: t('view.soGan').replace('{m}', fmtSo(cai.nguongGan)), so: gan.n, toa: gan.toa, tip: t('gt.view.gan').replace('{m}', fmtSo(cai.nguongGan)) },
    { khoa: 'cap', nhan: t('view.vd.cap'), so: cap.size, toa: [...cap.values()].flat().filter((v, i, a) => a.indexOf(v) === i), tip: t('gt.view.cap').replace('{m}', fmtSo(cai.nguongGan)) },
  ];
}

/** Panel phải TMB: phân tích view lô đang chọn (hoặc cả dự án). */
export function KpiView({ pa, tv, lo, sua, chiXem, toaId, chonToa }: {
  pa: TrangThaiPA; tv: ThuVien | null; lo: Lo; sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void; chiXem: boolean;
  toaId?: string | null; chonToa?: (id: string | null) => void;
}) {
  const kq = useViewPA(pa, tv);
  const s = useTT();
  const tang = useViewTang(pa, tv, s.bat);
  const [caDuAn, setCaDuAn] = useState(false);
  const [buocVD, setBuocVD] = useState<Record<string, number>>({});
  const dsPham = useMemo(() => (kq ? kq.can.filter((d) => caDuAn || d.loId === lo.id) : []), [kq, caDuAn, lo.id]);
  const vanDe = useMemo(() => (kq && tv ? timVanDe(pa, tv, dsPham, kq.cai) : []), [kq, dsPham, tv]);
  if (!kq) return null;
  const th = caDuAn ? kq.tong : kq.theoLo.get(lo.id);
  const c = kq.cai;
  const luu = (p: CaiDatViewLuu) => sua((q) => ({ ...q, huongView: { ...(q.huongView ?? {}), ...p } }));
  const luuW = (k: keyof TrongSoView, v: number) => luu({ trongSo: { ...(pa.huongView?.trongSo ?? {}), [k]: Math.max(0, v) } });
  const toaLo = pa.toa.filter((x) => (caDuAn || x.loId === lo.id) && kq.theoToa.has(x.id));
  const tim = (v: VanDe) => {
    if (!v.toa.length || !chonToa) return;
    const i = (buocVD[v.khoa] ?? 0) % v.toa.length;
    chonToa(v.toa[i]);
    setBuocVD({ ...buocVD, [v.khoa]: i + 1 });
    if (!s.bat) datLopView(true);
  };
  return (
    <MucGap tieuDe={t('view.tieuDe')} giaiThich={t('gt.view.tieuDe')} mo>
      <div class="panel-view">
        <div class="dong kpi-view-dau">
          <div class="kpi-pham-vi" role="radiogroup" aria-label={t('kpi.phamVi')}>
            <button type="button" role="radio" aria-checked={!caDuAn} class={!caDuAn ? 'chon' : ''} onClick={() => setCaDuAn(false)}>{t('kpi.lo')} {lo.temDat.kyHieu}</button>
            <button type="button" role="radio" aria-checked={caDuAn} class={caDuAn ? 'chon' : ''} onClick={() => setCaDuAn(true)}>{t('kpi.duAn')}</button>
          </div>
          <NutBieuTuong k="view" bat={s.bat} nhan={t('view.phanTich')} ghiChu={t('view.lop')} onClick={() => datLopView(!s.bat)} />
        </div>
        {!th || !th.soCan ? <p class="dong muted">{t('view.chuaCo')}</p> : (
          <>
            <SoLon th={th} cai={c} phu={t('view.canTinh').replace('{n}', fmtSo(th.soCan))} />
            <ThanhHang th={th} />
            <div class="nhom-view">
              <div class="nhom-view-dau"><span>{t('view.tanSuat')}</span><small class="muted">{t('view.tangGiua')}</small></div>
              <BieuDoTanSuat ds={dsPham} cai={c} tb={th.tb} />
            </div>
            {th.thanhPhan && <div class="nhom-view"><div class="nhom-view-dau"><span>{t('view.thanhPhan')}</span><small class="muted">{t('view.trongSoNgan')}</small></div><ThanhPhan tp={th.thanhPhan} w={c.trongSo} /></div>}
            <div class="nhom-view">
              <div class="nhom-view-dau"><span>{t('view.vanDe')}</span></div>
              <div class="van-de-view">
                {vanDe.map((v) => (
                  <button type="button" key={v.khoa} class={`van-de${v.so ? ' co' : ''}`} disabled={!v.so || !chonToa} title={v.tip} onClick={() => tim(v)}>
                    <span>{v.nhan}</span><b>{fmtSo(v.so)}</b>{v.so > 0 && chonToa && <small aria-hidden="true">⌖</small>}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        {toaLo.length > 0 && (
          <div class="nhom-view">
            <div class="nhom-view-dau"><span>{t('view.theoToa')}</span><small class="muted">{s.bat ? (tang.kq ? t('view.thapCao') : t('view.dangTinh')) : t('view.batDeXemTang')}</small></div>
            <div class="bang-view" role="table" aria-label={t('view.theoToa')}>
              {toaLo.map((x) => {
                const r = kq.theoToa.get(x.id)!;
                return (
                  <button type="button" class={`dong-toa-view${x.id === toaId ? ' chon' : ''}`} role="row" key={x.id} onClick={() => chonToa?.(x.id)} disabled={!chonToa}>
                    <span class="ten">{nhanToa(pa, tv, x.id, { lo: caDuAn })} <small>{x.soTangDH} T</small></span>
                    <span class="chip-view" style={{ background: mauViewCss(r.tb ?? 0), color: chuTrenView(r.tb ?? 0) }}>{fmtSo(r.tb, { thapPhan: 0 })}</span>
                    <ThanhHang th={r} nho />
                    <DuongTang ys={tbTheoTang(tang.kq, x.id)} />
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <MucGap tieuDe={t('view.thietLap')} giaiThich={t('gt.view.caiDat')}>
          <p class="dong muted ghi-heuristic">{t('view.heuristic')}</p>
          <div class="luoi-o">
            <OSo nhan={t('view.gocBac')} tip={t('gt.view.gocBac')} gt={c.gocBac} buoc={1} min={-360} max={360} donVi="°" tat={chiXem} onDoi={(v) => luu({ gocBac: ((v % 360) + 360) % 360 })} />
            <OSo nhan={t('view.viDo')} tip={pa.viTri ? t('ng.vt.viDoTheoViTri') : t('gt.view.viDo')} gt={c.viDo} buoc={0.1} min={-66} max={66} donVi="°" tat={chiXem || !!pa.viTri} onDoi={(v) => luu({ viDo: v })} />
            <OSo nhan={t('view.nguongGan')} tip={t('gt.view.nguongGan')} gt={c.nguongGan} buoc={1} min={1} max={200} donVi="m" tat={chiXem} onDoi={(v) => luu({ nguongGan: v })} />
            <OSo nhan={t('view.nguongTot')} tip={t('gt.view.nguong')} gt={c.nguongTot} buoc={5} min={0} max={100} tat={chiXem} onDoi={(v) => luu({ nguongTot: v })} />
            <OSo nhan={t('view.nguongKha')} tip={t('gt.view.nguong')} gt={c.nguongKha} buoc={5} min={0} max={100} tat={chiXem} onDoi={(v) => luu({ nguongKha: v })} />
          </div>
          <p class="dong muted" style={{ margin: '4px 0 0' }}>{t('view.trongSo')}</p>
          <div class="luoi-o">
            {(['huong', 'thoang', 'canh', 'nang'] as const).map((k) => (
              <OSo key={k} nhan={t(`view.tp.${k}`)} tip={t(`gt.view.tp.${k}`)} gt={c.trongSo[k]} buoc={5} min={0} max={100} tat={chiXem} onDoi={(v) => luuW(k, v)} />
            ))}
          </div>
          <div class="nhom-huong" role="group" aria-label={t('view.nhomHuong')} title={t('gt.view.nhomHuong')}>
            {c.nhomHuong.map((g, i) => (
              <button type="button" key={i} disabled={chiXem} class={g > 0 ? 'tot' : g < 0 ? 'kem' : ''} aria-label={`${TEN_HUONG(i)}: ${t(g > 0 ? 'view.tot' : g < 0 ? 'view.kem' : 'view.tb3')}`}
                onClick={() => { const n = c.nhomHuong.slice(); n[i] = g > 0 ? 0 : g === 0 ? -1 : 1; luu({ nhomHuong: n }); }}>{TEN_HUONG(i)}</button>
            ))}
          </div>
          <div class="dong" style={{ justifyContent: 'flex-end' }}>
            <button type="button" class="nut-phu" disabled={chiXem || !pa.huongView}
              onClick={() => sua((q) => ({ ...q, huongView: undefined }))}>{t('view.macDinh')}</button>
          </div>
        </MucGap>
      </div>
    </MucGap>
  );
}

/** Nội dung bong bóng một căn (3D, màn Tầng): điểm lớn + xếp loại, 4 thành phần, hướng, khoảng che, giờ nắng. */
export function TheDiemCan({ tieuDe, phu, tong, huong, thoang, canh, nang, h8, kcCan, gioNang, cai }: {
  tieuDe: string; phu?: string; tong: number; huong: number; thoang: number; canh: number; nang: number; h8: number; kcCan: number | null; gioNang: number; cai: CaiDatView;
}) {
  const xl = xepLoai(tong, cai);
  return (
    <div class="the-diem-can">
      <div class="tdc-dau">
        <span class="tdc-so" style={{ background: mauViewCss(tong), color: chuTrenView(tong) }}>{fmtSo(tong, { thapPhan: 0 })}</span>
        <span class="tdc-ten"><b>{tieuDe}</b>{phu && <small>{phu}</small>}<small>{t(`view.${xl}`)} · {t('view.nhinHuong').replace('{h}', TEN_HUONG(h8))}</small></span>
      </div>
      <ThanhPhan tp={{ huong, thoang, canh, nang }} w={cai.trongSo} />
      <div class="tdc-chan">
        <span>{kcCan === null ? t('view.khongChe') : t('view.cheCach').replace('{m}', fmtSo(kcCan, { thapPhan: 0 }))}</span>
        <span>{t('view.gioNang').replace('{h}', fmtSo(gioNang))}</span>
      </div>
    </div>
  );
}

/** Góc Bắc dự án (°) cho hoa gió bản vẽ. */
export const gocBacPA = (pa: Pick<TrangThaiPA, 'huongView'>) => caiDatView(pa.huongView).gocBac;
