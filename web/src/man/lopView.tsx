/**
 * Điểm VIEW căn hộ ở Tổng mặt bằng (tinh/huongView.ts): lớp tô mặt ngoài căn theo xếp loại Tốt / Khá / Kém trên bản vẽ (bật ở nút Lớp),
 * chú giải lớp phủ, khối view của tòa đang chọn (panel trái), bảng view theo lô + cài đặt góc Bắc / vĩ độ / trọng số (panel phải).
 * Chỉ đọc PA; cài đặt ghi `TrangThaiPA.huongView` qua `sua` (một bước hoàn tác). Heuristic thiết kế — không phải quy chuẩn.
 */
import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import {
  caiDatView, danhGiaViewPA,
  type KcTheoH, type KetQuaViewPA, type TongHopView, type TrongSoView, type XepLoaiView,
} from '../tinh/huongView';
import type { CaiDatViewLuu, Lo, ThuVien, TrangThaiPA } from '../tinh/kieu';
import { kcToa261 } from '../tinh/xepToa';
import { MucGap } from '../ui/MucGap';
import { NutBieuTuong } from '../ui/NutBieuTuong';
import { fmtSo } from '../ui/so';
import type { NutHienThi } from '../ui/ThanhHienThi';
import { useLuatTMB } from './tmbThaoTac';

// ---- bật / tắt lớp (cấp module, không lưu vào PA) ----
let bat = false;
const nghe = new Set<() => void>();
export const datLopView = (v: boolean) => { bat = v; nghe.forEach((f) => f()); };
export function useLopView(): boolean {
  const [, ve] = useState(0);
  useEffect(() => { const f = () => ve((n) => n + 1); nghe.add(f); return () => void nghe.delete(f); }, []);
  return bat;
}
/** Nút trong danh sách Lớp (GocBanVe) của TMB / màn Tầng. */
export const nutLopView = (): NutHienThi => ({ khoa: 'view', nhan: t('view.lop'), bat, onClick: () => datLopView(!bat) });

export const MAU_XEP: Record<XepLoaiView, string> = { tot: 'var(--ok)', kha: 'var(--canh-bao)', kem: 'var(--vuot)' };
export const TEN_HUONG = (i: number) => t(`view.h8.${i}`);

// ---- tính (nhớ kết quả gần nhất: panel trái, panel phải, bản vẽ cùng dùng) ----
let nho: { khoa: string; tv: ThuVien; kq: KetQuaViewPA } | null = null;
const khoaPA = (pa: TrangThaiPA, coLuat: boolean) => JSON.stringify([
  pa.lo.map((l) => [l.id, l.ranh, l.canhDuong ?? null, l.temDat.kyHieu, l.temDat.chucNang]),
  pa.toa.map((x) => [x.id, x.loId, x.mauId, x.x, x.y, x.gocDo, !!x.lat, x.soTangDH, x.soTangDe, x.caoDe, x.caoDH, x.canTheo, x.canViTri ?? null, x.congNang ?? null, x.latO ?? null, x.canThem ?? null]),
  pa.huongView ?? null, coLuat,
]);
/** Đánh giá view cả PA (nhớ theo chữ ký PA + thư viện). Luật LO-02 chưa tải thì quy đổi thoáng theo `nguongGan`. */
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

// ---- lớp bản vẽ TMB ----
/** Mặt ngoài từng căn tô theo xếp loại (nét dày, không đổi theo zoom) + điểm TB dưới tên tòa. Chỉ hiện khi bật lớp. */
export function LopViewTmb({ pa, tv, coChu }: { pa: TrangThaiPA; tv: ThuVien | null; coChu: number }) {
  const on = useLopView();
  const kq = useViewPA(pa, tv);
  if (!on || !kq) return null;
  return (
    <g class="lop-view" pointer-events="none">
      {kq.can.map((d, i) => (
        <line key={i} x1={d.A[0]} y1={-d.A[1]} x2={d.B[0]} y2={-d.B[1]} stroke={MAU_XEP[d.xep]} stroke-width="5" stroke-linecap="butt" vector-effect="non-scaling-stroke">
          <title>{`${fmtSo(d.tong, { thapPhan: 0 })} · ${TEN_HUONG(d.h8)}`}</title>
        </line>
      ))}
      {pa.toa.map((x) => {
        const th = kq.theoToa.get(x.id);
        return th?.tb != null ? (
          <text key={x.id} x={x.x} y={-x.y + coChu * 2.5} text-anchor="middle" font-size={coChu * 0.8} font-weight="700" class="nhan-view-toa"
            fill={MAU_XEP[xepTB(th.tb, kq)]} stroke="var(--panel)" stroke-width={coChu * 0.18} paint-order="stroke">
            {`${t('view.ngan')} ${fmtSo(th.tb, { thapPhan: 0 })}`}
          </text>
        ) : null;
      })}
    </g>
  );
}
const xepTB = (v: number, kq: KetQuaViewPA): XepLoaiView => (v >= kq.cai.nguongTot ? 'tot' : v >= kq.cai.nguongKha ? 'kha' : 'kem');

/** Chú giải lớp view (lớp phủ trên khung giữa, chỉ khi bật lớp). */
export function ChuGiaiView({ pa }: { pa: TrangThaiPA }) {
  const on = useLopView();
  if (!on) return null;
  const c = caiDatView(pa.huongView);
  return (
    <div class="chu-giai-view" role="note" aria-label={t('view.chuGiai')}>
      <b>{t('view.lop')}</b>
      <span><i style={{ background: MAU_XEP.tot }} />{t('view.tot')} ≥ {fmtSo(c.nguongTot)}</span>
      <span><i style={{ background: MAU_XEP.kha }} />{t('view.kha')} {fmtSo(c.nguongKha)}–{fmtSo(c.nguongTot)}</span>
      <span><i style={{ background: MAU_XEP.kem }} />{t('view.kem')} &lt; {fmtSo(c.nguongKha)}</span>
      <button type="button" class="nut-dong-view" aria-label={t('view.tatLop')} title={t('view.tatLop')} onClick={() => datLopView(false)}>×</button>
    </div>
  );
}

// ---- khối số ----
/** Thanh phân bố Tốt / Khá / Kém + số chính. */
function KhoiTongHop({ th, cai }: { th: TongHopView; cai: KetQuaViewPA['cai'] }) {
  const p = (v: number) => fmtSo(v, { thapPhan: 0, donVi: '%' });
  return (
    <div class="khoi-view">
      <div class="dong">
        <span title={t('gt.view.tb')}>{t('view.tb')}</span>
        <b style={{ color: th.tb === null ? undefined : MAU_XEP[th.tb >= cai.nguongTot ? 'tot' : th.tb >= cai.nguongKha ? 'kha' : 'kem'] }}>{fmtSo(th.tb, { thapPhan: 0 })}<small> / 100</small></b>
      </div>
      <div class="thanh-view" role="img" aria-label={`${t('view.tot')} ${p(th.pctTot)} · ${t('view.kha')} ${p(th.pctKha)} · ${t('view.kem')} ${p(th.pctKem)}`}>
        {th.pctTot > 0 && <i style={{ width: `${th.pctTot}%`, background: MAU_XEP.tot }} />}
        {th.pctKha > 0 && <i style={{ width: `${th.pctKha}%`, background: MAU_XEP.kha }} />}
        {th.pctKem > 0 && <i style={{ width: `${th.pctKem}%`, background: MAU_XEP.kem }} />}
      </div>
      <div class="dong muted view-pb"><span>{t('view.tot')} {p(th.pctTot)}</span><span>{t('view.kha')} {p(th.pctKha)}</span><span>{t('view.kem')} {p(th.pctKem)}</span></div>
      <div class="dong"><span title={t('gt.view.tay')}>{t('view.soTay')}</span><b class={th.soTay ? 'canh-bao' : ''}>{fmtSo(th.soTay)}</b></div>
      <div class="dong"><span title={t('gt.view.gan').replace('{m}', fmtSo(cai.nguongGan))}>{t('view.soGan').replace('{m}', fmtSo(cai.nguongGan))}</span><b class={th.soGan ? 'canh-bao' : ''}>{fmtSo(th.soGan)}</b></div>
      {th.thanhPhan && (
        <div class="dong muted view-tp" title={t('gt.view.thanhPhan')}>
          {(['huong', 'thoang', 'canh', 'nang'] as const).map((k) => <span key={k}>{t(`view.tp.${k}`)} {fmtSo(th.thanhPhan![k], { thapPhan: 0 })}</span>)}
        </div>
      )}
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
      <div class="dong"><b>{t('view.tieuDe')}</b><span class="muted">{t('view.canTinh').replace('{n}', fmtSo(th.soCan))}</span></div>
      <KhoiTongHop th={th} cai={kq.cai} />
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

/** Panel phải TMB: view lô đang chọn (hoặc cả dự án) + bảng theo tòa + cài đặt. */
export function KpiView({ pa, tv, lo, sua, chiXem }: { pa: TrangThaiPA; tv: ThuVien | null; lo: Lo; sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void; chiXem: boolean }) {
  const kq = useViewPA(pa, tv);
  const on = useLopView();
  const [caDuAn, setCaDuAn] = useState(false);
  if (!kq) return null;
  const th = caDuAn ? kq.tong : kq.theoLo.get(lo.id);
  const c = kq.cai;
  const luu = (p: CaiDatViewLuu) => sua((q) => ({ ...q, huongView: { ...(q.huongView ?? {}), ...p } }));
  const luuW = (k: keyof TrongSoView, v: number) => luu({ trongSo: { ...(pa.huongView?.trongSo ?? {}), [k]: Math.max(0, v) } });
  const toaLo = pa.toa.filter((x) => caDuAn || x.loId === lo.id);
  const ten = (mauId: string) => tv?.toa.get(mauId)?.ten_vi.split(' · ')[0] ?? mauId;
  return (
    <MucGap tieuDe={t('view.tieuDe')} giaiThich={t('gt.view.tieuDe')} mo>
      <div class="dong kpi-view-dau">
        <div class="kpi-pham-vi" role="radiogroup" aria-label={t('kpi.phamVi')}>
          <button type="button" role="radio" aria-checked={!caDuAn} class={!caDuAn ? 'chon' : ''} onClick={() => setCaDuAn(false)}>{t('kpi.lo')} {lo.temDat.kyHieu}</button>
          <button type="button" role="radio" aria-checked={caDuAn} class={caDuAn ? 'chon' : ''} onClick={() => setCaDuAn(true)}>{t('kpi.duAn')}</button>
        </div>
        <NutBieuTuong k="view" bat={on} ghiChu={t('view.lop')} onClick={() => datLopView(!on)} />
      </div>
      {!th || !th.soCan ? <p class="dong muted">{t('view.chuaCo')}</p> : <KhoiTongHop th={th} cai={c} />}
      {toaLo.length > 0 && (
        <div class="bang-view" role="table" aria-label={t('view.theoToa')}>
          <div class="dong dau" role="row"><span>{t('xep.toa')}</span><span>{t('view.ngan')}</span><span>{t('view.tot')}</span><span>{t('view.tayNgan')}</span><span>{t('view.ganNgan')}</span></div>
          {toaLo.map((x) => {
            const r = kq.theoToa.get(x.id);
            return (
              <div class="dong" role="row" key={x.id}>
                <span>{ten(x.mauId)}</span>
                <b style={{ color: r?.tb == null ? undefined : MAU_XEP[r.tb >= c.nguongTot ? 'tot' : r.tb >= c.nguongKha ? 'kha' : 'kem'] }}>{fmtSo(r?.tb ?? null, { thapPhan: 0 })}</b>
                <span>{fmtSo(r ? r.pctTot : null, { thapPhan: 0, donVi: '%' })}</span>
                <span>{fmtSo(r?.soTay ?? null)}</span>
                <span>{fmtSo(r?.soGan ?? null)}</span>
              </div>
            );
          })}
        </div>
      )}
      <MucGap tieuDe={t('view.caiDat')} giaiThich={t('gt.view.caiDat')}>
        <p class="dong muted ghi-heuristic">{t('view.heuristic')}</p>
        <div class="luoi-o">
          <OSo nhan={t('view.gocBac')} tip={t('gt.view.gocBac')} gt={c.gocBac} buoc={1} min={-360} max={360} donVi="°" tat={chiXem} onDoi={(v) => luu({ gocBac: ((v % 360) + 360) % 360 })} />
          <OSo nhan={t('view.viDo')} tip={t('gt.view.viDo')} gt={c.viDo} buoc={0.1} min={-66} max={66} donVi="°" tat={chiXem} onDoi={(v) => luu({ viDo: v })} />
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
    </MucGap>
  );
}

/** Góc Bắc dự án (°) cho hoa gió bản vẽ. */
export const gocBacPA = (pa: Pick<TrangThaiPA, 'huongView'>) => caiDatView(pa.huongView).gocBac;
