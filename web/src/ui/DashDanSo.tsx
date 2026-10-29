import { t } from '../i18n/i18n';
import { danSoDuAn, type KetQuaDanSo } from '../tinh/danSo';
import { LOAI_CAN, type Lo, type ThuVien, type TrangThaiPA } from '../tinh/kieu';
import { BieuTuong } from './NutBieuTuong';
import { LOAI_HINH } from '../tinh/quyTacDanSo';
import { MucGap } from './MucGap';
import { fmtSo } from './so';
import './dan-so.css';
import { nhanToa } from './nhanToa';

const so1 = { thapPhan: 1 };
/** Người / căn: số nguyên hiện không lẻ, số lẻ (1,5 · S ÷ 32) hiện 2 chữ số. */
const fmtNguoi = (v: number) => fmtSo(v, { thapPhan: Number.isInteger(v) ? 0 : 2 });

/** Vòng donut tỉ lệ dân số theo loại căn — cùng kiểu vòng cơ cấu căn ở Tổng mặt bằng (`VongCoCau`). */
function VongDanSo({ k }: { k: KetQuaDanSo }) {
  const r = 15.915; // chu vi ≈ 100
  let daQua = 0;
  return (
    <svg viewBox="0 0 42 42" width="104" height="104" role="img" aria-label={t('ds.vong')}>
      <circle cx="21" cy="21" r={r} fill="none" stroke="var(--line)" stroke-width="6" />
      {LOAI_CAN.map((l) => {
        const v = k.tong > 0 ? (k.theoLoai[l].nguoi / k.tong) * 100 : 0;
        const c = (
          <circle key={l} cx="21" cy="21" r={r} fill="none" stroke={`var(--u-${l})`} stroke-width="6"
            stroke-dasharray={`${v} ${100 - v}`} stroke-dashoffset={25 - daQua}>
            <title>{`${t(`loai.${l}`)}: ${fmtSo(k.theoLoai[l].nguoi)} ${t('ds.nguoi')} (${fmtSo(v, so1)}%)`}</title>
          </circle>
        );
        daQua += v;
        return v > 0 ? c : null;
      })}
      <text x="21" y="21" text-anchor="middle" class="ds-vong-so">{fmtSo(k.tong)}</text>
      <text x="21" y="26.5" text-anchor="middle" class="ds-vong-chu">{t('ds.nguoi')}</text>
    </svg>
  );
}

/** Dòng mô tả cách tính đang dùng + căn cứ (tooltip) + khu vực đô thị / nông thôn đang áp (khi QĐ phân biệt) + cờ tạm / chưa đối chiếu. */
function CachTinh({ k, lo }: { k: KetQuaDanSo; lo: Lo }) {
  if (!k.coKhai) return <p class="ds-ghi canh-bao" role="note">{t('ds.heSoChung').replace('{n}', fmtSo(lo.temDat.chiTieu.nguoiMoiCan, { thapPhan: 2 }))}</p>;
  const q = k.quyTac!;
  return (
    <p class="ds-ghi" title={[...k.canCu, q.ap?.ghiChu ?? ''].filter(Boolean).join('\n')}>
      <b>{t(`ds.tinh.${q.khai?.id ?? 'khac'}`)}</b> · {t(`ds.pp.${k.phuongPhap}`)}
      {q.ap?.qd ? ` · ${q.ap.qd}` : ` · ${t('ds.fallback')}`}
      {q.khuVuc.phanBiet && q.khuVuc.sTb !== null && (
        <span title={t('gt.ds.khai.khuVuc')}>
          {' · '}{t('ds.kvAp').replace('{kv}', t(`ds.kv.${q.khuVuc.ap}`)).replace('{n}', fmtSo(q.khuVuc.sTb, so1))}
        </span>
      )}
      {k.satMoc.bat && <span title={t('gt.ds.khai.lamTron')}> · {t('ds.lamTronAp').replace('{n}', fmtSo(k.satMoc.dungSai, { thapPhan: 2 }))}</span>}
      {q.ap && q.ap.qd && !q.ap.daDoiChieu && <span class="muted"> · {t('ds.chuaDoiChieu')}</span>}
      {q.tam && <b class="canh-bao"> · {t('ds.tam')}</b>}
    </p>
  );
}

/** Cách tính + căn cứ đang áp cho từng loại hình có căn trên lô (TM / XH / TĐC); loại hình QĐ không quy định ghi "mặc định quốc gia". */
function TheoLoaiHinh({ k }: { k: KetQuaDanSo }) {
  if (!k.coKhai) return null;
  const ds = LOAI_HINH.filter((lh) => k.theoLoaiHinh[lh]);
  if (!ds.length) return null;
  return (
    <ul class="ds-lh" aria-label={t('ds.theoLh')}>
      {ds.map((lh) => {
        const h = k.theoLoaiHinh[lh]!;
        return (
          <li key={lh} title={h.dieu.join('\n')}>
            <b>{t(`ds.lh.${lh}`)}</b> · {t(`ds.pp.${h.phuongPhap}`)} · <span class={h.rieng ? '' : 'canh-bao'}>{t(h.rieng ? 'ds.lhRieng' : 'ds.lhQG')}</span>
            <small class="muted"> — {h.dieu.join(' · ')}</small>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Căn sát mốc dải (chủ nhiệm 29/10/2026): mẫu căn có DT vừa vượt mốc bảng QĐ trong dung sai — DT hiện → DT gợi ý, người / căn,
 * giảm mỗi căn × số căn trên lô (căn / tầng × tầng × tòa, tooltip theo tòa), tổng giảm; nhắc phải sửa DT thật trong thiết kế.
 * `moCan` mở màn Tầng tòa có căn đó (chọn căn); `batLamTron` bật làm tròn cho lô (một bước hoàn tác).
 */
function SatMocDS({ k, pa, tv, moCan, batLamTron }: { k: KetQuaDanSo; pa: TrangThaiPA; tv: ThuVien; moCan?: (toaId: string, canId: string) => void; batLamTron?: () => void }) {
  if (!k.coKhai) return null;
  const sm = k.satMoc;
  const coMoc = k.dong.some((d) => d.phuongPhap === 'bang' || d.phuongPhap === 'bangPhong' || d.phuongPhap === 'qd83');
  const soToa = (id: string) => pa.toa.findIndex((x) => x.id === id) + 1;
  return (
    <details class="ds-chi-tiet ds-sat-moc" open={sm.dong.length > 0}>
      <summary title={t('gt.ds.sm.muc')}>
        <BieuTuong k="satMoc" /> {t('ds.sm.muc')}{sm.dong.length ? ` · ${sm.dong.length}` : ''}
        {sm.giam > 0 && <b class="ds-sm-giam"> −{fmtNguoi(Math.round(sm.giam * 100) / 100)} {t('ds.nguoi')}</b>}
      </summary>
      {!coMoc && <p class="ds-ghi muted">{t('ds.sm.khongMoc')}</p>}
      {coMoc && !sm.dong.length && <p class="ds-ghi muted">{t('ds.sm.rong').replace('{n}', fmtSo(sm.dungSai, { thapPhan: 2 }))}</p>}
      {sm.dong.length > 0 && (
        <>
          <div class="ds-bang ds-bang-sm" role="table" aria-label={t('ds.sm.muc')}>
            <div class="ds-hang dau" role="row">
              <span>{t('ds.cot.mau')}</span><span>{t('ds.sm.cot.dtHien')}</span><span>{t('ds.sm.cot.dtGoiY')}</span>
              <span>{t('ds.sm.cot.nguoi')}</span><span>{t('ds.cot.soCan')}</span><span>{t('ds.sm.cot.giam')}</span><span />
            </div>
            {sm.dong.map((d) => {
              const s = d.satMoc!;
              const toaIds = Object.keys(d.theoToa);
              const chiTiet = toaIds.map((id) => {
                const x = pa.toa.find((q) => q.id === id);
                return t('ds.sm.theoToa').replace('{i}', String(soToa(id))).replace('{n}', fmtSo(d.theoToa[id])).replace('{t}', fmtSo(x?.soTangDH ?? null));
              }).join('\n');
              const ten = tv.can.get(d.canId)?.ten_vi ?? d.canId;
              return (
                <div class={`ds-hang${d.lamTron ? ' da-ap' : ''}`} role="row" key={d.canId} title={`${ten}\n${d.dieu}`}>
                  <span><i class="o-mau" style={{ background: `var(--u-${d.loai})` }} /> {ten.split(' · ')[0]}</span>
                  <span>{fmtSo(d.dt, { thapPhan: 2 })}</span>
                  <b>{fmtSo(s.dtGoiY, { thapPhan: 2 })}</b>
                  <span>{fmtNguoi(s.nguoiHien)} → {fmtNguoi(s.nguoiGoiY)}</span>
                  <span title={chiTiet}>{fmtSo(d.so)}</span>
                  <b title={`${fmtNguoi(Math.round(s.giam * 100) / 100)} × ${fmtSo(d.so)}`}>−{fmtSo(s.giam * d.so, { thapPhan: Number.isInteger(s.giam * d.so) ? 0 : 1 })}</b>
                  <span>{moCan && toaIds[0] && (
                    <button type="button" class="nut-bt ds-sm-xem" title={t('gt.ds.sm.xem')} aria-label={`${t('ds.sm.xem')} ${ten}`} onClick={() => moCan(toaIds[0], d.canId)}><BieuTuong k="moTang" /></button>
                  )}</span>
                </div>
              );
            })}
          </div>
          <p class={`ds-ghi${sm.bat ? ' ok' : ''}`}>{t(sm.bat ? 'ds.sm.daAp' : 'ds.sm.chuaAp').replace('{n}', fmtNguoi(Math.round(sm.giam * 100) / 100))}</p>
          <p class="ds-ghi canh-bao" role="note">{t('ds.sm.canhBao')}</p>
          {!sm.bat && batLamTron && (
            <button type="button" class="nut-phu" title={t('gt.ds.sm.batNhanh').replace('{n}', fmtSo(sm.dungSai, { thapPhan: 2 }))} onClick={batLamTron}>{t('ds.sm.batNhanh')}</button>
          )}
        </>
      )}
    </details>
  );
}

/**
 * Dashboard dân số của lô (panel phải mục chỉ tiêu): vòng tỉ lệ dân theo loại căn, tổng dân, dân / ngưỡng QH (thanh, vượt tô
 * `--warn`), người / căn bình quân; bảng chi tiết từng mẫu căn và căn cứ. Hàm tính: `tinh/danSo.ts`.
 */
export function DashDanSo({ pa, tv, lo, sua, chiXem, moCan }: {
  pa: TrangThaiPA; tv: ThuVien | null; lo: Lo;
  /** Có thì hiện nút "Bật làm tròn" ở danh sách căn sát mốc. */
  sua?: (fn: (p: TrangThaiPA) => TrangThaiPA) => void; chiXem?: boolean;
  /** Mở màn Tầng tòa `toaId`, chọn ô dùng mẫu căn `canId`. */
  moCan?: (toaId: string, canId: string) => void;
}) {
  if (!tv) return null;
  const da = danSoDuAn(pa, tv);
  const k = da.theoLo[lo.id];
  if (!k) return null;
  const nguong = lo.temDat.chiTieu.danSoMax;
  const tyLe = nguong > 0 ? k.tong / nguong : null;
  const vuot = tyLe !== null && tyLe > 1 + 1e-9;
  const bq = k.soCan > 0 ? k.tong / k.soCan : null;
  const coToa = Object.keys(k.theoToa).length;
  const soLoCoCan = Object.values(da.theoLo).filter((x) => x.soCan > 0).length;
  return (
    <MucGap tieuDe={`${t('ds.muc')} · ${lo.temDat.kyHieu}`} giaiThich={t('gt.ds.muc')}>
      <div class="ds-dash">
        <VongDanSo k={k} />
        <div class="ds-so-lon">
          <div class="ds-o" title={t('gt.ds.tong')}><small>{t('ds.tong')}</small><b>{fmtSo(k.soCan ? k.tong : null)}</b></div>
          <div class="ds-o" title={t('gt.ds.nguong')}>
            <small>{t('ds.nguong')}</small>
            <b class={vuot ? 'ds-vuot' : ''}>{tyLe === null ? '—' : `${fmtSo(tyLe * 100, so1)}%`}</b>
            <span class={`ds-thanh${vuot ? ' vuot' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={tyLe === null ? undefined : Math.round(tyLe * 100)} aria-label={t('ds.nguong')}>
              <i style={{ width: `${Math.min(100, (tyLe ?? 0) * 100)}%` }} />
            </span>
            <small class="muted">{fmtSo(k.soCan ? k.tong : null)} / {fmtSo(nguong || null)}</small>
          </div>
          <div class="ds-o" title={t('gt.ds.bq')}><small>{t('ds.bq')}</small><b>{fmtSo(bq, { thapPhan: 2 })}</b></div>
        </div>
      </div>
      <CachTinh k={k} lo={lo} />
      <TheoLoaiHinh k={k} />
      <SatMocDS k={k} pa={pa} tv={tv} moCan={moCan}
        batLamTron={sua && !chiXem && lo.temDat.danSo ? () => sua((p) => ({ ...p, lo: p.lo.map((l) => (l.id === lo.id && l.temDat.danSo
          ? { ...l, temDat: { ...l.temDat, danSo: { ...l.temDat.danSo, lamTron: { bat: true, dungSai: k.satMoc.dungSai } } } } : l)) })) : undefined} />
      {k.soNgoaiBang > 0 && <p class="ds-ghi canh-bao" title={t('gt.ds.ngoaiBang')}>{t('ds.ngoaiBang').replace('{n}', fmtSo(k.soNgoaiBang))}</p>}
      <div class="ds-bang" role="table" aria-label={t('ds.vong')}>
        <div class="ds-hang dau" role="row"><span>{t('ds.cot.loai')}</span><span>{t('ds.cot.soCan')}</span><span title={t('ds.dtDung')}>{t('ds.cot.dt')}</span><span>{t('ds.cot.dan')}</span><span>%</span></div>
        {LOAI_CAN.filter((l) => k.theoLoai[l].so > 0).map((l) => {
          const g = k.theoLoai[l];
          return (
            <div class="ds-hang" role="row" key={l}>
              <span><i class="o-mau" style={{ background: `var(--u-${l})` }} /> {t(`loai.${l}`)}</span>
              <span>{fmtSo(g.so)}</span>
              <span>{g.dtMin === g.dtMax ? fmtSo(g.dtMin, so1) : `${fmtSo(g.dtMin, so1)}–${fmtSo(g.dtMax, so1)}`}</span>
              <b>{fmtSo(g.nguoi)}</b>
              <span>{fmtSo(k.tong ? (g.nguoi / k.tong) * 100 : null, so1)}</span>
            </div>
          );
        })}
      </div>
      <details class="ds-chi-tiet">
        <summary title={t('gt.ds.chiTiet')}>{t('ds.chiTiet')}</summary>
        <div class="ds-bang ds-bang6" role="table" aria-label={t('ds.chiTiet')}>
          <div class="ds-hang dau" role="row">
            <span>{t('ds.cot.mau')}</span><span>{t('ds.cot.soCan')}</span><span title={t('ds.dtDung')}>{t('ds.cot.dt')}</span>
            <span>{t('ds.cot.nguoiCan')}</span><span>{t('ds.cot.dan')}</span><span>{t('ds.cot.lh')}</span>
          </div>
          {k.dong.map((d) => (
            <div class={`ds-hang${d.ngoaiBang ? ' ngoai' : ''}`} role="row" key={d.canId}
              title={(d.dieu || t('ds.pp.heSoChung')) + (d.lamTron && d.satMoc ? `\n${t('ds.lamTronAp').replace('{n}', fmtSo(k.satMoc.dungSai, { thapPhan: 2 }))}: ${fmtSo(d.dt, { thapPhan: 2 })} → ${fmtSo(d.satMoc.dtGoiY, { thapPhan: 2 })} m²` : '')}>
              <span title={tv.can.get(d.canId)?.ten_vi ?? d.canId}><i class="o-mau" style={{ background: `var(--u-${d.loai})` }} /> {tv.can.get(d.canId)?.ten_vi.split(' · ')[0] ?? d.canId}</span>
              <span>{fmtSo(d.so)}</span>
              <span>{fmtSo(d.dt, so1)}</span>
              <span>{fmtNguoi(d.nguoiMoiCan)}{d.ngoaiBang ? ' *' : ''}</span>
              <b>{fmtSo(d.nguoi, so1)}</b>
              <span>{t(`ds.lhNgan.${d.loaiHinh}`)}</span>
            </div>
          ))}
          <div class="ds-hang tong" role="row"><span>{t('ds.tongCong')}</span><span>{fmtSo(k.soCan)}</span><span /><span>{fmtSo(bq, { thapPhan: 2 })}</span><b>{fmtSo(k.tong, so1)}</b><span /></div>
        </div>
        {coToa > 1 && (
          <div class="ds-toa">
            <small class="muted">{t('ds.theoToa')}</small>
            {Object.entries(k.theoToa).map(([id, v], i) => (
              <div class="dong" key={id}><span>{nhanToa(pa, tv, id, { lo: true })}</span><span>{fmtSo(v.so)} {t('sc.can')} · <b>{fmtSo(v.nguoi)}</b> {t('ds.nguoi')}</span></div>
            ))}
          </div>
        )}
        <p class="ds-ghi muted">{t('ds.dtDung')}</p>
        {k.canCu.length > 0 && <p class="ds-ghi"><small class="muted">{t('ds.canCu')}:</small> {k.canCu.join(' · ')}</p>}
      </details>
      {soLoCoCan > 1 && <div class="dong ds-du-an" title={t('gt.ds.duAn')}><span>{t('ds.duAn')}</span><b>{fmtSo(da.soCan)} {t('sc.can')} · {fmtSo(da.tong)} {t('ds.nguoi')}</b></div>}
    </MucGap>
  );
}
