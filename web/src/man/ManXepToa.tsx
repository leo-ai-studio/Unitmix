import { useMemo, useRef, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import type { KetQuaChiTieu } from '../tinh/chiTieu';
import { demCan, diemLechCoCau, dtTbTheoLoai } from '../tinh/coCau';
import { chanToa, dienTich, khoiDe, namTrong } from '../tinh/hinhHoc';
import { hopLo, taoToaTrenLo, vungDat } from '../tinh/hopLo';
import { LOAI_CAN, type Diem, type Lo, type LoaiCan, type ThuVien, type ToaDat, type ToaMau, type TrangThaiPA } from '../tinh/kieu';
import { BanVe, khungBao, s, sPoly, type DieuKhienVe } from '../ve/BanVe';
import { MucGap } from '../ui/MucGap';
import { ThanhHienThi } from '../ui/ThanhHienThi';
import { fmtSo } from '../ui/so';
import { laCaoTang, loaiDat, MAU_DAT } from '../tinh/loaiDat';
import { BangChiTieuLo, ChonLoCaoTang, LoChiTieu, LoNhap, SucChuaLo } from './ManLo';

type Chung = {
  pa: TrangThaiPA;
  sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void;
  chiXem: boolean;
  loId: string | null;
  chonLo: (id: string) => void;
  tv: ThuVien | null;
  toaId: string | null;
  chonToa: (id: string | null) => void;
};

const xayO = laCaoTang;
/** Lô đang xếp: lô đã chọn nếu xây nhà ở, không thì lô nhà ở đầu tiên. */
export const loDangXep = (pa: TrangThaiPA, loId: string | null): Lo | undefined =>
  pa.lo.find((l) => l.id === loId && xayO(l)) ?? pa.lo.find(xayO);
const doiToa = (p: TrangThaiPA, id: string, fn: (x: ToaDat) => ToaDat): TrangThaiPA => ({ ...p, toa: p.toa.map((x) => (x.id === id ? fn(x) : x)) });
const idMoi = () => `toa-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const tenNgan = (m: ToaMau | undefined) => m?.ten_vi.split(' · ')[0] ?? '?';

function O({ nhan, tip, gt, donVi, onDoi, tat, buoc = 1, am = false }: { nhan: string; tip?: string; gt: number; donVi?: string; onDoi: (v: number) => void; tat: boolean; buoc?: number; am?: boolean }) {
  return (
    <label class="o-so" title={tip}>
      <span>{nhan}</span>
      <span class="o-so-nhap">
        <input type="number" value={gt} step={buoc} min={am ? undefined : 0} disabled={tat}
          onChange={(e) => {
            const v = Number(e.currentTarget.value);
            if (Number.isFinite(v) && (am || v >= 0)) onDoi(v);
          }} />
        {donVi && <small>{donVi}</small>}
      </span>
    </label>
  );
}

/** Panel trái màn Xếp tòa: chọn lô, thư viện mẫu tòa (hợp lô trước), tòa trên lô và thông số tòa đang chọn. */
export function XepTrai({ pa, sua, chiXem, loId, tv, toaId, chonToa }: Chung) {
  const lo = loDangXep(pa, loId);
  const [nhom, setNhom] = useState<'tm' | 'xh' | null>(null);
  const nhomXem = nhom ?? (lo?.temDat.chucNang === 'xh' ? 'xh' : 'tm');
  const vung = lo ? vungDat(lo) : [];
  const khoaVung = vung.map((p) => p.map((n) => n.toFixed(1)).join()).join(';');
  const dsMau = useMemo(() => {
    if (!tv || !lo) return [];
    return [...tv.toa.values()]
      .filter((m) => m.nhom === nhomXem)
      .map((m) => ({ m, ...hopLo(m, vung) }))
      .sort((a, b) => Number(b.hop) - Number(a.hop) || b.m.so_can_tang - a.m.so_can_tang);
  }, [tv, nhomXem, khoaVung]);

  if (!pa.lo.length) return <p class="dong muted">{t('xep.chuaCoLo')}</p>;
  const toaLo = lo ? pa.toa.filter((x) => x.loId === lo.id) : [];
  const toa = toaLo.find((x) => x.id === toaId);
  const tat = chiXem || !!toa?.khoa;
  const datTs = (k: keyof ToaDat) => (v: number) => toa && sua((p) => doiToa(p, toa.id, (x) => ({ ...x, [k]: v })));

  return (
    <>
      {lo && (
        <MucGap tieuDe={t('xep.thuVien')} giaiThich={t('xep.thuVienGiaiThich')} mo={!toaLo.length}>
          <div class="dong">
            <div class="nhom-nut" role="group" aria-label={t('xep.thuVien')}>
              {(['tm', 'xh'] as const).map((k) => (
                <button type="button" title={t('gt.xep.nhom')} aria-pressed={nhomXem === k} onClick={() => setNhom(k)}>{t(k === 'tm' ? 'xep.nhomTm' : 'xep.nhomXh')}</button>
              ))}
            </div>
          </div>
          {!tv && <p class="dong muted">{t('lo.dangTaiThuVien')}</p>}
          {dsMau.map(({ m, hop }) => (
            <div class="the-mau" key={m.id}>
              <div>
                <b>{m.ten_vi}</b>
                <span class="muted">{t('xep.canTang').replace('{n}', String(m.so_can_tang))} · {fmtSo(m.dtxd_m2, { donVi: 'm²' })}</span>
                <span class={hop ? 'ok' : 'vuot'}>{hop ? `✓ ${t('xep.hopLo')}` : `✕ ${t('xep.khongHop')}`}</span>
              </div>
              <button type="button" class="nut-phu" title={t('gt.xep.dat')} disabled={chiXem}
                onClick={() => { const moi = taoToaTrenLo(m, lo, idMoi()); sua((p) => ({ ...p, toa: [...p.toa, moi] })); chonToa(moi.id); }}>
                {t('xep.dat')}
              </button>
            </div>
          ))}
        </MucGap>
      )}

      {lo && (
        <MucGap tieuDe={`${t('xep.toaTrenLo')} · ${toaLo.length}`} giaiThich={t('gt.xep.toaTrenLo')} mo>
          {!toaLo.length && <p class="dong muted">{t('xep.chuaCoToa')}</p>}
          {toaLo.map((x) => {
            const m = tv?.toa.get(x.mauId);
            return (
              <button type="button" key={x.id} class={`muc-lo${x.id === toaId ? ' chon' : ''}`} aria-pressed={x.id === toaId} onClick={() => chonToa(x.id)}>
                <b>{m?.ten_vi ?? x.mauId}{x.khoa ? ` · ${t('xep.daKhoa')}` : ''}</b>
                <span>{x.soTangDe} + {x.soTangDH} T · {fmtSo(x.gocDo, { donVi: '°' })}</span>
              </button>
            );
          })}
        </MucGap>
      )}

      {toa && (
        <MucGap tieuDe={`${t('xep.thongSo')} · ${tenNgan(tv?.toa.get(toa.mauId))}`} giaiThich={t('gt.xep.thongSo')} mo>
          <O nhan={t('xep.soTangDH')} tip={t('gt.xep.soTangDH')} gt={toa.soTangDH} tat={tat} onDoi={(v) => v >= 1 && datTs('soTangDH')(Math.round(v))} />
          <O nhan={t('xep.soTangDe')} tip={t('gt.xep.soTangDe')} gt={toa.soTangDe} tat={tat} onDoi={(v) => datTs('soTangDe')(Math.round(v))} />
          <O nhan={t('xep.goc')} tip={t('gt.xep.goc')} gt={toa.gocDo} donVi="°" buoc={5} am tat={tat} onDoi={(v) => datTs('gocDo')(((v % 360) + 360) % 360)} />
          <O nhan={t('xep.deOffset')} tip={t('gt.xep.deOffset')} gt={toa.deOffset} donVi="m" buoc={0.5} tat={tat} onDoi={datTs('deOffset')} />
          <O nhan={t('xep.x')} tip={t('gt.xep.x')} gt={toa.x} donVi="m" buoc={0.5} am tat={tat} onDoi={datTs('x')} />
          <O nhan={t('xep.y')} tip={t('gt.xep.y')} gt={toa.y} donVi="m" buoc={0.5} am tat={tat} onDoi={datTs('y')} />
          <div class="dong" style={{ justifyContent: 'flex-start', flexWrap: 'wrap', gap: '6px' }}>
            <button type="button" class="nut-phu" title={t('gt.xep.nhanBan')} disabled={chiXem}
              onClick={() => {
                // Dời bản sao sang cạnh bản gốc theo phương ngang thân tòa: bề sâu tòa + 12 m.
                const m = tv?.toa.get(toa.mauId);
                const sau = m ? (Math.max(...m.duong_bao.map((p) => p[1])) - Math.min(...m.duong_bao.map((p) => p[1]))) / 1000 : 20;
                const a = (toa.gocDo * Math.PI) / 180, d = sau + 12;
                const ban = { ...toa, id: idMoi(), x: Math.round((toa.x + d * Math.sin(a)) * 100) / 100, y: Math.round((toa.y - d * Math.cos(a)) * 100) / 100, khoa: false };
                sua((p) => ({ ...p, toa: [...p.toa, ban] }));
                chonToa(ban.id);
              }}>
              {t('xep.nhanBan')}
            </button>
            <button type="button" class="nut-phu" title={t('gt.xep.khoa')} disabled={chiXem} onClick={() => sua((p) => doiToa(p, toa.id, (x) => ({ ...x, khoa: !x.khoa })))}>
              {toa.khoa ? t('xep.moKhoa') : t('xep.khoa')}
            </button>
            <button type="button" class="nut-phu" title={t('gt.xep.xoa')} disabled={tat} onClick={() => { sua((p) => ({ ...p, toa: p.toa.filter((x) => x.id !== toa.id) })); chonToa(null); }}>
              {t('xep.xoa')}
            </button>
          </div>
        </MucGap>
      )}
    </>
  );
}

const duongPath = (vung: Diem[][]) => vung.map((p) => `M${p.map(s).join(' L')} Z`).join(' ');

/** Bản vẽ màn Xếp tòa: lô đang xếp, chỉ giới, khối đế, chân tháp; kéo tòa để di chuyển. */
export function XepGiua({ pa, sua, chiXem, loId, chonLo, tv, toaId, chonToa }: Chung) {
  const [dk, setDk] = useState<DieuKhienVe | null>(null);
  const [keo, setKeo] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const batDau = useRef<{ id: string; cx: number; cy: number; k: number } | null>(null);
  const lo = loDangXep(pa, loId);
  if (!pa.lo.length) return <div class="giua-man"><span>{t('xep.chuaCoLo')}</span></div>;
  const khung = khungBao(pa.lo.map((l) => l.ranh));
  const coChu = Math.max(1.2, khung ? (khung[2] - khung[0]) / 70 : 2);
  const viTri = (x: ToaDat): ToaDat => (keo?.id === x.id ? { ...x, x: x.x + keo.dx, y: x.y + keo.dy } : x);
  const toaCoMau = tv ? pa.toa.filter((x) => tv.toa.has(x.mauId)).map(viTri) : [];
  const dem = tv ? demCan(pa, tv) : {};

  return (
    <>
      <BanVe khung={khung} nhan={t('xep.banVe')} onDieuKhien={setDk}>
        {pa.lo.flatMap((l) => l.xungQuanh).map((d, i) => (
          <polyline key={`xq${i}`} points={sPoly(d)} fill="none" stroke="var(--muted)" stroke-width="1" vector-effect="non-scaling-stroke" />
        ))}
        {pa.lo.map((l) => {
          const loai = loaiDat(l), caoTang = loai === 'o_cao_tang', chon = l.id === lo?.id;
          const [nen, vien] = MAU_DAT[loai];
          return (
            <g key={l.id} onClick={() => caoTang && !chon && (chonLo(l.id), chonToa(null))} style={{ cursor: caoTang ? 'pointer' : 'default' }}>
              <polygon points={sPoly(l.ranh)} fill={chon ? 'var(--soft)' : caoTang ? 'var(--panel)' : nen} stroke={chon ? 'var(--green)' : vien}
                stroke-width={chon ? 2.5 : caoTang ? 1.6 : 1} vector-effect="non-scaling-stroke" />
              {caoTang && l.chiGioi && <polygon points={sPoly(l.chiGioi)} fill="none" stroke="#b42318" stroke-width="1.2" stroke-dasharray="8 5" vector-effect="non-scaling-stroke" />}
            </g>
          );
        })}
        {tv && pa.lo.map((l) => {
          const ts = toaCoMau.filter((x) => x.loId === l.id);
          const de = khoiDe(ts.map((x) => chanToa(tv.toa.get(x.mauId)!, x)), ts.map((x) => x.deOffset));
          return de.length ? <path key={`de${l.id}`} d={duongPath(de)} fill="var(--secondary)" fill-opacity="0.25" fill-rule="nonzero" stroke="var(--secondary)" stroke-width="1" vector-effect="non-scaling-stroke" /> : null;
        })}
        {tv && toaCoMau.map((x) => {
          const mau = tv.toa.get(x.mauId)!;
          const chan = chanToa(mau, x);
          const loCua = pa.lo.find((l) => l.id === x.loId);
          const ngoai = loCua ? !namTrong(chan, vungDat(loCua)) : true;
          const chon = x.id === toaId;
          const soCan = Object.values(dem[x.id] ?? {}).reduce((a, b) => a + b, 0);
          return (
            <g key={x.id} style={{ cursor: chiXem || x.khoa ? 'pointer' : 'move' }}
              onPointerDown={(e) => {
                e.stopPropagation();
                chonToa(x.id);
                if (x.loId !== lo?.id) chonLo(x.loId);
                if (chiXem || x.khoa) return;
                const svg = (e.currentTarget as SVGGElement).ownerSVGElement!;
                (e.currentTarget as Element).setPointerCapture(e.pointerId);
                batDau.current = { id: x.id, cx: e.clientX, cy: e.clientY, k: svg.getScreenCTM()?.a || 1 };
              }}
              onPointerMove={(e) => {
                const b = batDau.current;
                if (!b || b.id !== x.id) return;
                setKeo({ id: x.id, dx: (e.clientX - b.cx) / b.k, dy: -(e.clientY - b.cy) / b.k });
              }}
              onLostPointerCapture={() => { batDau.current = null; setKeo(null); }}
              onPointerUp={() => {
                const b = batDau.current;
                batDau.current = null;
                if (b && keo && keo.id === b.id && Math.hypot(keo.dx, keo.dy) > 0.05) {
                  const { dx, dy } = keo;
                  sua((p) => doiToa(p, b.id, (q) => ({ ...q, x: Math.round((q.x + dx) * 100) / 100, y: Math.round((q.y + dy) * 100) / 100 })));
                }
                setKeo(null);
              }}>
              <polygon points={sPoly(chan)} fill={ngoai ? '#f6d8d4' : 'var(--u-2pn)'} fill-opacity="0.85"
                stroke={ngoai ? 'var(--vuot)' : chon ? 'var(--green)' : 'var(--ink)'} stroke-width={chon ? 3 : 1.5} vector-effect="non-scaling-stroke" />
              <text x={x.x} y={-x.y} text-anchor="middle" font-size={coChu} font-weight="700" fill="var(--ink)" style={{ pointerEvents: 'none' }}>{tenNgan(mau)}</text>
              <text x={x.x} y={-x.y + coChu * 1.3} text-anchor="middle" font-size={coChu * 0.8} fill="var(--ink)" style={{ pointerEvents: 'none' }}>
                {`${x.soTangDe + x.soTangDH}T · ${t('xep.tongCan').replace('{n}', String(soCan))}`}
              </text>
            </g>
          );
        })}
        {pa.lo.map((l) => {
          if (pa.toa.some((x) => x.loId === l.id)) return null;
          const caoTang = laCaoTang(l), xs = l.ranh.map((q) => q[0]), ys = l.ranh.map((q) => q[1]);
          const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
          return (
            <text key={`n${l.id}`} x={cx} y={-cy} text-anchor="middle" font-size={coChu * (caoTang ? 1.25 : 0.85)} font-weight={caoTang ? 700 : 500}
              fill={caoTang ? 'var(--green)' : MAU_DAT[loaiDat(l)][1]} style={{ pointerEvents: 'none' }}>{l.temDat.kyHieu}</text>
          );
        })}
      </BanVe>
      <div class="noi-duoi">
        <ChuGiaiDat />
        <p class="dong muted" style={{ justifyContent: 'center' }}>{t('xep.keoGoiY')}</p>
        <ThanhHienThi nhan={t('ht.nhom')} nut={[
          { khoa: 'phong', nhan: t('ht.phong'), onClick: () => dk?.phong() },
          { khoa: 'thu', nhan: t('ht.thu'), onClick: () => dk?.thu() },
          { khoa: 'vua', nhan: t('ht.vua'), onClick: () => dk?.vuaKhung() },
        ]} />
      </div>
    </>
  );
}

/** Biểu đồ vòng cơ cấu căn (% theo loại), màu theo loại căn. */
function VongCoCau({ pct }: { pct: Record<string, number> }) {
  const r = 15.915; // chu vi ≈ 100
  let daQua = 0;
  return (
    <svg viewBox="0 0 42 42" width="96" height="96" role="img" aria-label={t('xep.coCau')}>
      <circle cx="21" cy="21" r={r} fill="none" stroke="var(--line)" stroke-width="7" />
      {LOAI_CAN.map((k) => {
        const v = pct[k] ?? 0;
        const c = <circle key={k} cx="21" cy="21" r={r} fill="none" stroke={`var(--u-${k})`} stroke-width="7"
          stroke-dasharray={`${v} ${100 - v}`} stroke-dashoffset={25 - daQua} />;
        daQua += v;
        return v > 0 ? c : null;
      })}
    </svg>
  );
}

const coCauRongNull = (): Record<LoaiCan, number | null> => ({ stu: null, '1pn': null, '2pn': null, '2pnp': null, '3pn': null });

/** Panel phải màn Xếp tòa: chỉ tiêu lô, diện tích hai cột, cơ cấu căn theo tòa so với mục tiêu. */
export function XepPhai({ pa, loId, tv, toaId, chonToa, kq }: Chung & { kq: KetQuaChiTieu | null }) {
  const lo = loDangXep(pa, loId);
  if (!lo) return null;
  const r = kq?.theoLo[lo.id];
  const toaLo = pa.toa.filter((x) => x.loId === lo.id);
  const dem = tv ? demCan(pa, tv) : {};
  const dtLo = lo.ranh.length >= 3 ? dienTich(lo.ranh) : 0;
  const mucTieu = lo.temDat.coCauMucTieu;
  const dtTb = tv ? dtTbTheoLoai(pa, tv, lo.id) : coCauRongNull();
  const pct = r?.coCauPct ?? { stu: 0, '1pn': 0, '2pn': 0, '2pnp': 0, '3pn': 0 };
  const m2 = { donVi: 'm²' };
  const cot = { gridTemplateColumns: `1.3fr repeat(${LOAI_CAN.length}, 1fr) 1fr` };
  return (
    <>
      <BangChiTieuLo dong={r?.dong ?? []} />
      <MucGap tieuDe={`${t('xep.dtLo')} · ${lo.temDat.kyHieu}`} giaiThich={t('gt.xep.dtLo')} mo>
        <div class="dong bang-ct dau"><span /><span>{t('xep.xayDung')}</span><span>{t('xep.tinhHSSDD')}</span></div>
        <div class="dong bang-ct"><span>{t('sc.dtLo')}</span><span>{fmtSo(dtLo, m2)}</span><span>{fmtSo(dtLo, m2)}</span></div>
        <div class="dong bang-ct"><span>{t('xep.dtDe')} / {t('xep.dtSan')}</span><span>{fmtSo(r && toaLo.length ? r.dtDe : null, m2)}</span><span>{fmtSo(r && toaLo.length ? r.dtSanTinhHSSDD : null, m2)}</span></div>
        <div class="dong bang-ct"><span>{t('xep.matDo')} / {t('xep.hssdd')}</span>
          <span>{fmtSo(r && toaLo.length && dtLo ? (r.dtDe / dtLo) * 100 : null, { thapPhan: 1, donVi: '%' })}</span>
          <span>{fmtSo(r && toaLo.length && dtLo ? r.dtSanTinhHSSDD / dtLo : null, { thapPhan: 2 })}</span>
        </div>
      </MucGap>
      <MucGap tieuDe={t('xep.coCau')} giaiThich={t('gt.xep.coCau')} mo>
        <div class="dong" style={{ alignItems: 'center' }}>
          <VongCoCau pct={pct} />
          <div style={{ flex: 1 }}>
            {LOAI_CAN.map((k) => (
              <div class="dong" style={{ padding: '1px 0' }} key={k}>
                <span><i class="o-mau" style={{ background: `var(--u-${k})` }} /> {t(`loai.${k}`)}</span>
                <b>{fmtSo(pct[k], { thapPhan: 1, donVi: '%' })}</b>
              </div>
            ))}
          </div>
        </div>
        <div class="bang-co-cau" role="table" aria-label={t('xep.coCau')}>
          <div class="dong bang-cc dau" style={cot} role="row"><span>{t('xep.toa')}</span>{LOAI_CAN.map((k) => <span key={k}>{t(`loai.${k}`)}</span>)}<span>{t('xep.tong')}</span></div>
          {toaLo.map((x) => {
            const d = dem[x.id] ?? { stu: 0, '1pn': 0, '2pn': 0, '2pnp': 0, '3pn': 0 };
            return (
              <button type="button" class={`dong bang-cc${x.id === toaId ? ' chon' : ''}`} style={cot} role="row" key={x.id} onClick={() => chonToa(x.id)}>
                <span>{tenNgan(tv?.toa.get(x.mauId))}</span>
                {LOAI_CAN.map((k) => <span key={k}>{fmtSo(d[k])}</span>)}
                <b>{fmtSo(LOAI_CAN.reduce((a, k) => a + d[k], 0))}</b>
              </button>
            );
          })}
          <div class="dong bang-cc tong" style={cot} role="row"><span>{t('xep.tong')}</span>{LOAI_CAN.map((k) => <span key={k}>{fmtSo(r?.coCau[k] ?? 0)}</span>)}<b>{fmtSo(r?.soCan ?? 0)}</b></div>
          <div class="dong bang-cc" style={cot} role="row"><span>{t('xep.tyLe')}</span>{LOAI_CAN.map((k) => <span key={k}>{fmtSo(pct[k], { thapPhan: 1 })}</span>)}<span>100</span></div>
          <div class="dong bang-cc" style={cot} role="row"><span>{t('xep.mucTieu')}</span>{LOAI_CAN.map((k) => <span key={k}>{fmtSo(mucTieu[k], { thapPhan: 1 })}</span>)}<span /></div>
          {lo.temDat.deBai && Object.keys(lo.temDat.deBai.dtCan).length > 0 && (
            <>
              <div class="dong bang-cc" style={cot} role="row"><span>{t('xep.dtDeBai')}</span>{LOAI_CAN.map((k) => <span key={k}>{fmtSo(lo.temDat.deBai!.dtCan[k] ?? null, { thapPhan: 1 })}</span>)}<span>m²</span></div>
              <div class="dong bang-cc" style={cot} role="row"><span>{t('xep.dtDat')}</span>
                {LOAI_CAN.map((k) => {
                  const muc = lo.temDat.deBai!.dtCan[k], dat = dtTb[k];
                  const lech = muc && dat !== null ? Math.abs(dat - muc) > pa.nguong.dtCanM2 : false;
                  return <span key={k} class={dat === null || !muc ? '' : lech ? 'vuot' : 'ok'}>{fmtSo(dat, { thapPhan: 1 })}</span>;
                })}
                <span>m²</span>
              </div>
            </>
          )}
          <div class="dong bang-cc" style={cot} role="row"><span>{t('xep.lech')}</span>
            {LOAI_CAN.map((k) => {
              const l = (r?.soCan ? pct[k] : 0) - mucTieu[k];
              return <span key={k} class={Math.abs(l) > pa.nguong.coCauDiem ? 'vuot' : 'ok'}>{r?.soCan ? `${l > 0 ? '+' : ''}${fmtSo(l, { thapPhan: 1 })}` : '—'}</span>;
            })}
            <span />
          </div>
        </div>
        <div class="dong"><span>{t('xep.diemLech')}</span><b>{r?.soCan ? fmtSo(diemLechCoCau(pct, mucTieu), { thapPhan: 1 }) : '—'}</b></div>
      </MucGap>
    </>
  );
}

/** Chú giải màu loại đất trên TMB. */
function ChuGiaiDat() {
  const ds = ['o_cao_tang', 'cay_xanh', 'mat_nuoc', 'giao_duc', 'cong_cong', 'hon_hop', 'ha_tang'] as const;
  return (
    <div class="chu-giai-dat" aria-label={t('dat.chuGiai')}>
      {ds.map((k) => <span key={k}><i style={{ background: MAU_DAT[k][0], borderColor: MAU_DAT[k][1] }} />{t(`dat.${k}`)}</span>)}
    </div>
  );
}

/** Panel trái bước Tổng mặt bằng: nhập liệu một hàng, chọn lô cao tầng, tòa trên lô; chỉ tiêu lô gập dưới cùng. */
export function TmbTrai(p: Chung) {
  const lo = loDangXep(p.pa, p.loId);
  return (
    <>
      <LoNhap {...p} />
      <ChonLoCaoTang pa={p.pa} loId={lo?.id ?? null} chonLo={(id) => { p.chonLo(id); p.chonToa(null); }} />
      {lo && <XepTrai {...p} loId={lo.id} />}
      <LoChiTieu pa={p.pa} sua={p.sua} chiXem={p.chiXem} lo={lo} />
    </>
  );
}

/** Panel phải bước Tổng mặt bằng: chỉ tiêu lô đạt / mục tiêu, cơ cấu theo tòa; sức chứa gập. */
export function TmbPhai(p: Chung & { kq: KetQuaChiTieu | null }) {
  const lo = loDangXep(p.pa, p.loId);
  if (!lo) return null;
  return (
    <>
      <XepPhai {...p} />
      <SucChuaLo lo={lo} />
    </>
  );
}
