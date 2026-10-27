import { useState } from 'preact/hooks';
import { RANH_HATCH, napDxf, taoLoTuDxf, type BanDxf } from '../dxf/napDxf';
import { t } from '../i18n/i18n';
import type { DongChiTieu, KetQuaChiTieu } from '../tinh/chiTieu';
import { dienTich } from '../tinh/hinhHoc';
import { LOAI_CAN, type ChiTieuQH, type ChucNang, type HeSoDTSan, type Lo, type TrangThaiPA } from '../tinh/kieu';
import { loDangChonHoacDatO, taoLo } from '../tinh/macDinh';
import { sucChua } from '../tinh/sucChua';
import { BanVe, khungBao, s, sPoly, type DieuKhienVe } from '../ve/BanVe';
import { MucGap } from '../ui/MucGap';
import { ThanhHienThi } from '../ui/ThanhHienThi';
import { fmtSo } from '../ui/so';
import { NhapChiTieu } from './NhapChiTieu';
import { NhapDeBai } from './NhapDeBai';

type Chung = { pa: TrangThaiPA; sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void; chiXem: boolean; loId: string | null; chonLo: (id: string) => void };

const dtLo = (lo: Lo) => (lo.ranh.length >= 3 ? dienTich(lo.ranh) : 0);
const doiLo = (pa: TrangThaiPA, id: string, fn: (l: Lo) => Lo): TrangThaiPA => ({ ...pa, lo: pa.lo.map((l) => (l.id === id ? fn(l) : l)) });

/** Ô nhập số có nhãn và đơn vị. */
function O({ nhan, gt, donVi, onDoi, tat, buoc = 1 }: { nhan: string; gt: number; donVi?: string; onDoi: (v: number) => void; tat: boolean; buoc?: number }) {
  return (
    <label class="o-so">
      <span>{nhan}</span>
      <span class="o-so-nhap">
        <input type="number" value={gt} step={buoc} min={0} disabled={tat}
          onChange={(e) => {
            const v = Number(e.currentTarget.value);
            if (Number.isFinite(v) && v >= 0) onDoi(v);
          }} />
        {donVi && <small>{donVi}</small>}
      </span>
    </label>
  );
}

/** Ô nhập số có thể bỏ trống (null = bảng QH không quy định). */
function ON({ nhan, gt, donVi, onDoi, tat, buoc = 1 }: { nhan: string; gt: number | null; donVi?: string; onDoi: (v: number | null) => void; tat: boolean; buoc?: number }) {
  return (
    <label class="o-so">
      <span>{nhan}</span>
      <span class="o-so-nhap">
        <input type="number" value={gt ?? ''} placeholder="—" step={buoc} min={0} disabled={tat}
          onChange={(e) => {
            const s = e.currentTarget.value.trim();
            const v = Number(s);
            if (!s) onDoi(null);
            else if (Number.isFinite(v) && v >= 0) onDoi(v);
          }} />
        {donVi && <small>{donVi}</small>}
      </span>
    </label>
  );
}

function doanLop(lop: string[], mau: RegExp): string {
  return lop.find((l) => mau.test(l)) ?? '';
}

/** Panel trái của cấp Lô: nạp DXF, danh sách lô, tem đất, chỉ tiêu, cơ cấu mục tiêu, hệ số, ngưỡng. */
export function LoTrai({ pa, sua, chiXem, loId, chonLo }: Chung) {
  const [ban, setBan] = useState<BanDxf | null>(null);
  const [loiDoc, setLoiDoc] = useState('');
  const [chon, setChon] = useState({ ranh: '', chiGioi: '', tem: '', xungQuanh: '' });
  const [kt, setKt] = useState({ rong: 80, dai: 60 });
  const [hop, setHop] = useState<'chiTieu' | 'deBai' | null>(null);
  const lo = loDangChonHoacDatO(pa.lo, loId);

  async function docTep(f: File) {
    setLoiDoc('');
    try {
      const b = napDxf(await f.text());
      setBan(b);
      // Ranh lập quy hoạch là ranh cả khu, không phải ranh lô.
      const ranh = doanLop(b.lop.filter((l) => !/l[aậ]p\s*quy\s*ho[aạ]ch/i.test(l)), /RANH|LO|PLOT|BOUND/i);
      const soHatch = b.lopHatch.reduce((a, l) => a + b.hatch(l).length, 0);
      setChon({
        // Bản vẽ SDĐ chỉ có ô đất tô hatch (lớp ranh kín ít ô hơn) thì lấy hatch.
        ranh: soHatch > (ranh ? b.polyKin(ranh).length : 0) ? RANH_HATCH : ranh,
        chiGioi: doanLop(b.lop, /CGXD|CHI.?GIOI|SETBACK|BUILD.?LINE/i),
        tem: doanLop(b.lop, /TEM|KY.?HIEU|TAG|TEXT/i),
        xungQuanh: doanLop(b.lop, /HT|XQ|NHA|CONTEXT|ENV/i),
      });
    } catch {
      setBan(null);
      setLoiDoc(t('lo.loiDoc'));
    }
  }

  function taoTuDxf() {
    if (!ban || !chon.ranh) return;
    if (pa.lo.length && !confirm(t('lo.thayLo'))) return;
    const ds = taoLoTuDxf(ban, { ranh: chon.ranh, chiGioi: chon.chiGioi || undefined, tem: chon.tem || undefined, xungQuanh: chon.xungQuanh || undefined });
    sua((p) => ({ ...p, lo: ds, toa: p.toa.filter((x) => ds.some((l) => l.id === x.loId)) }));
    if (ds[0]) chonLo(ds[0].id);
  }

  function themChuNhat() {
    const id = `lo-${Date.now().toString(36)}`;
    const x0 = Math.max(0, ...pa.lo.flatMap((l) => l.ranh.map((q) => q[0]))) + (pa.lo.length ? 20 : 0);
    const moi = taoLo(id, `Lô ${pa.lo.length + 1}`, 'tm', [[x0, 0], [x0 + kt.rong, 0], [x0 + kt.rong, kt.dai], [x0, kt.dai]]);
    sua((p) => ({ ...p, lo: [...p.lo, moi] }));
    chonLo(id);
  }

  const loiRanh = ban && chon.ranh ? ban.loiLop(chon.ranh) : null;
  const ct = lo?.temDat.chiTieu;
  const datCt = (k: keyof ChiTieuQH) => (v: number | null) => lo && sua((p) => doiLo(p, lo.id, (l) => ({ ...l, temDat: { ...l.temDat, chiTieu: { ...l.temDat.chiTieu, [k]: v } } })));
  const tongCoCau = lo ? LOAI_CAN.reduce((a, k) => a + lo.temDat.coCauMucTieu[k], 0) : 100;
  const datHeSo = (k: keyof HeSoDTSan) => (v: number) => sua((p) => ({ ...p, heSo: { ...p.heSo, [k]: v / 100 } }));

  return (
    <>
      <MucGap tieuDe={t('lo.napHienTrang')} giaiThich={t('lo.dxfGiaiThich')} mo={!pa.lo.length}>
        <div class="dong" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <label class="nut-phu" style={{ textAlign: 'center', cursor: chiXem ? 'default' : 'pointer' }}>
            {t('lo.chonDxf')}
            <input type="file" accept=".dxf" class="sr-only" disabled={chiXem} onChange={(e) => e.currentTarget.files?.[0] && docTep(e.currentTarget.files[0])} />
          </label>
          {loiDoc && <span class="vuot" role="alert">{loiDoc}</span>}
          {ban && <span class="muted">{t('lo.daNap').replace('{n}', String(ban.lop.length)).replace('{dv}', ban.donVi)}</span>}
        </div>
        {ban && (
          <>
            {(['ranh', 'chiGioi', 'tem', 'xungQuanh'] as const).map((k) => (
              <label class="o-chon" key={k}>
                <span>{t({ ranh: 'lo.lopRanh', chiGioi: 'lo.lopChiGioi', tem: 'lo.lopTem', xungQuanh: 'lo.lopXungQuanh' }[k])}</span>
                <select value={chon[k]} onChange={(e) => setChon({ ...chon, [k]: e.currentTarget.value })}>
                  <option value="">{t('lo.khongChon')}</option>
                  {k === 'ranh' && ban.lopHatch.length > 0 && <option value={RANH_HATCH}>{t('lo.ranhHatch')}</option>}
                  {ban.lop.map((l) => <option value={l}>{l}</option>)}
                </select>
              </label>
            ))}
            {loiRanh && <p class="vuot dong" role="alert">{t(`lo.loi.${loiRanh}`)}</p>}
            <div class="dong"><button type="button" class="nut-chinh" disabled={chiXem || !chon.ranh || !!loiRanh} onClick={taoTuDxf}>{t('lo.taoTuDxf')}</button></div>
          </>
        )}
        <div class="dong" style={{ gap: '6px', alignItems: 'flex-end' }}>
          <O nhan={t('lo.rong')} gt={kt.rong} donVi="m" tat={chiXem} onDoi={(v) => setKt({ ...kt, rong: v })} />
          <O nhan={t('lo.dai')} gt={kt.dai} donVi="m" tat={chiXem} onDoi={(v) => setKt({ ...kt, dai: v })} />
          <button type="button" class="nut-phu" disabled={chiXem || kt.rong <= 0 || kt.dai <= 0} onClick={themChuNhat}>{t('lo.them')}</button>
        </div>
      </MucGap>

      {hop === 'chiTieu' && <NhapChiTieu lo={pa.lo} dong={() => setHop(null)} ap={(ds) => sua((p) => ({ ...p, lo: ds }))} />}
      {hop === 'deBai' && lo && <NhapDeBai ds={pa.lo} loChon={lo} dong={() => setHop(null)} ap={(ds) => sua((p) => ({ ...p, lo: ds }))} />}
      {pa.lo.length > 0 && (
        <MucGap tieuDe={t('lo.nhapBang')} giaiThich={t('nct.giaiThich')} mo>
          <div class="dong" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
            <button type="button" class="nut-phu" disabled={chiXem} onClick={() => setHop('chiTieu')}>{t('lo.nhapChiTieu')}</button>
            <button type="button" class="nut-phu" disabled={chiXem || !lo} onClick={() => setHop('deBai')}>{t('lo.nhapDeBai')}</button>
          </div>
        </MucGap>
      )}
      {pa.lo.length > 0 && (
        <MucGap tieuDe={t('lo.dsLo')} mo>
          {pa.lo.map((l) => (
            <button type="button" key={l.id} class={`muc-lo${l.id === lo?.id ? ' chon' : ''}`} aria-pressed={l.id === lo?.id} onClick={() => chonLo(l.id)}>
              <b>{l.temDat.kyHieu}</b>
              <span>{t(`cn.${l.temDat.chucNang}`)} · {fmtSo(dtLo(l), { donVi: 'm²' })}</span>
            </button>
          ))}
        </MucGap>
      )}

      {lo && ct && (
        <>
          <MucGap tieuDe={t('lo.temDat')} mo>
            <label class="o-chon"><span>{t('lo.kyHieu')}</span>
              <input value={lo.temDat.kyHieu} disabled={chiXem} onChange={(e) => { const v = e.currentTarget.value.trim(); if (v) sua((p) => doiLo(p, lo.id, (l) => ({ ...l, temDat: { ...l.temDat, kyHieu: v } }))); }} />
            </label>
            <label class="o-chon"><span>{t('lo.chucNang')}</span>
              <select value={lo.temDat.chucNang} disabled={chiXem} onChange={(e) => { const v = e.currentTarget.value as ChucNang; sua((p) => doiLo(p, lo.id, (l) => ({ ...l, temDat: { ...l.temDat, chucNang: v } }))); }}>
                {(['tm', 'xh', 'khac'] as const).map((c) => <option value={c}>{t(`cn.${c}`)}</option>)}
              </select>
            </label>
          </MucGap>
          <MucGap tieuDe={t('muc.chiTieuQH')} mo>
            {lo.temDat.nguonChiTieu && (
              <p class="dong muted" style={{ margin: 0 }}>
                {t('lo.nguonCt').replace('{d}', String(lo.temDat.nguonChiTieu.dong)).replace('{t}', lo.temDat.nguonChiTieu.ten).replace('{s}', lo.temDat.nguonChiTieu.sheet)}
                {lo.temDat.nguonChiTieu.soLo > 1 && ` ${t('lo.nguonCtNhom').replace('{n}', String(lo.temDat.nguonChiTieu.soLo))}`}
              </p>
            )}
            <O nhan={t('ct.matDoMax')} gt={ct.matDoMax} donVi="%" tat={chiXem} onDoi={datCt('matDoMax')} />
            <ON nhan={t('ct.matDoThapMax')} gt={ct.matDoThapMax} donVi="%" buoc={0.1} tat={chiXem} onDoi={datCt('matDoThapMax')} />
            <O nhan={t('ct.hssddMax')} gt={ct.hssddMax} buoc={0.1} tat={chiXem} onDoi={datCt('hssddMax')} />
            <O nhan={t('ct.tangCaoMax')} gt={ct.tangCaoMax} tat={chiXem} onDoi={datCt('tangCaoMax')} />
            <ON nhan={t('ct.tangDe')} gt={ct.tangDe} tat={chiXem} onDoi={datCt('tangDe')} />
            <ON nhan={t('ct.tangCanHo')} gt={ct.tangCanHo} tat={chiXem} onDoi={datCt('tangCanHo')} />
            <ON nhan={t('ct.tangHam')} gt={ct.tangHam} tat={chiXem} onDoi={datCt('tangHam')} />
            <ON nhan={t('ct.soCanMax')} gt={ct.soCanMax} buoc={10} tat={chiXem} onDoi={datCt('soCanMax')} />
            <O nhan={t('ct.danSoMax')} gt={ct.danSoMax} buoc={10} tat={chiXem} onDoi={datCt('danSoMax')} />
            <O nhan={t('ct.nguoiMoiCan')} gt={ct.nguoiMoiCan} buoc={0.1} tat={chiXem} onDoi={datCt('nguoiMoiCan')} />
            <O nhan={t('ct.choDoOtoMoiCan')} gt={ct.choDoOtoMoiCan} buoc={0.1} tat={chiXem} onDoi={datCt('choDoOtoMoiCan')} />
            <O nhan={t('ct.choXeMayMoiCan')} gt={ct.choXeMayMoiCan} buoc={0.1} tat={chiXem} onDoi={datCt('choXeMayMoiCan')} />
            <O nhan={t('ct.cayXanhMin')} gt={ct.cayXanhMin} donVi="%" tat={chiXem} onDoi={datCt('cayXanhMin')} />
          </MucGap>
          <MucGap tieuDe={t('muc.coCauMucTieu')}>
            {lo.temDat.deBai && <p class="dong muted" style={{ margin: 0 }}>{t('lo.nguonDeBai').replace('{n}', lo.temDat.deBai.nguon)}</p>}
            {LOAI_CAN.map((k) => (
              <O key={k} nhan={lo.temDat.deBai?.dtCan[k] ? `${t(`loai.${k}`)} · ${fmtSo(lo.temDat.deBai.dtCan[k]!, { thapPhan: 1, donVi: 'm²' })}` : t(`loai.${k}`)}
                gt={lo.temDat.coCauMucTieu[k]} donVi="%" tat={chiXem}
                onDoi={(v) => sua((p) => doiLo(p, lo.id, (l) => ({ ...l, temDat: { ...l.temDat, coCauMucTieu: { ...l.temDat.coCauMucTieu, [k]: v } } })))} />
            ))}
            <div class="dong"><span>{t('coCau.tong')}</span><b class={Math.abs(tongCoCau - 100) > 0.01 ? 'vuot' : 'ok'}>{fmtSo(tongCoCau, { donVi: '%' })}</b></div>
            {Math.abs(tongCoCau - 100) > 0.01 && <p class="vuot dong" role="alert">{t('coCau.phaiDu100')}</p>}
          </MucGap>
        </>
      )}
      <MucGap tieuDe={t('muc.heSo')} giaiThich={t('heSo.ghiChu')}>
        {(['can', 'chung', 'thuongMai', 'ham'] as const).map((k) => (
          <O key={k} nhan={t(`heSo.${k}`)} gt={Math.round(pa.heSo[k] * 100)} donVi="%" tat={chiXem} onDoi={datHeSo(k)} />
        ))}
        <p class="dong muted">{t('heSo.ghiChu')}</p>
      </MucGap>
      <MucGap tieuDe={t('muc.nguong')}>
        <O nhan={t('ng.dtCan')} gt={pa.nguong.dtCanM2} donVi="m²" buoc={0.5} tat={chiXem} onDoi={(v) => sua((p) => ({ ...p, nguong: { ...p.nguong, dtCanM2: v } }))} />
        <O nhan={t('ng.kichThuoc')} gt={pa.nguong.kichThuocM} donVi="m" buoc={0.05} tat={chiXem} onDoi={(v) => sua((p) => ({ ...p, nguong: { ...p.nguong, kichThuocM: v } }))} />
      </MucGap>
    </>
  );
}

/** Bản vẽ cấp Lô: các lô, chỉ giới, công trình xung quanh. */
export function LoGiua({ pa, loId, chonLo }: Chung) {
  const [dk, setDk] = useState<DieuKhienVe | null>(null);
  const khung = khungBao(pa.lo.map((l) => l.ranh));
  if (!pa.lo.length) return <div class="giua-man"><span>{t('lo.chuaCo')}</span></div>;
  const coChu = Math.max(1.5, khung ? (khung[2] - khung[0]) / 45 : 2);
  return (
    <>
      <BanVe khung={khung} nhan={t('lo.banVe')} onDieuKhien={setDk}>
        {pa.lo.flatMap((l) => l.xungQuanh).map((d, i) => (
          <polyline key={`xq${i}`} points={sPoly(d)} fill="none" stroke="var(--muted)" stroke-width="1" vector-effect="non-scaling-stroke" />
        ))}
        {pa.lo.map((l) => {
          const chon = l.id === loDangChonHoacDatO(pa.lo, loId)?.id;
          const xs = l.ranh.map((q) => q[0]), ys = l.ranh.map((q) => q[1]);
          const tam: [number, number] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
          return (
            <g key={l.id} onClick={() => chonLo(l.id)} style={{ cursor: 'pointer' }}>
              <polygon points={sPoly(l.ranh)} fill={chon ? 'var(--soft)' : 'var(--panel)'} stroke={chon ? 'var(--green)' : 'var(--ink)'} stroke-width={chon ? 3 : 2} vector-effect="non-scaling-stroke" />
              {l.chiGioi && <polygon points={sPoly(l.chiGioi)} fill="none" stroke="#b42318" stroke-width="1.5" stroke-dasharray="8 5" vector-effect="non-scaling-stroke" />}
              <text x={tam[0]} y={-tam[1]} text-anchor="middle" font-size={coChu * 1.2} font-weight="600" fill="var(--ink)">{l.temDat.kyHieu}</text>
              <text x={tam[0]} y={-tam[1] + coChu * 1.6} text-anchor="middle" font-size={coChu} fill="var(--muted)">{fmtSo(dtLo(l), { donVi: 'm²' })}</text>
            </g>
          );
        })}
        {khung && <g aria-hidden="true">{(() => { const L = dk?.tyLeM ?? 10; const p0: [number, number] = [khung[0], khung[1] - coChu * 2]; return (<><polyline points={`${s(p0)} ${s([p0[0] + L, p0[1]])}`} stroke="var(--ink)" stroke-width="2" vector-effect="non-scaling-stroke" /><text x={p0[0]} y={-p0[1] + coChu * 1.3} font-size={coChu} fill="var(--ink)">{fmtSo(L, { donVi: 'm' })}</text></>); })()}</g>}
      </BanVe>
      <ThanhHienThi nhan={t('ht.nhom')} nut={[
        { khoa: 'phong', nhan: t('ht.phong'), onClick: () => dk?.phong() },
        { khoa: 'thu', nhan: t('ht.thu'), onClick: () => dk?.thu() },
        { khoa: 'vua', nhan: t('ht.vua'), onClick: () => dk?.vuaKhung() },
      ]} />
    </>
  );
}

/** Panel phải của cấp Lô: sức chứa và chỉ tiêu Đạt / Mục tiêu. */
export function LoPhai({ pa, loId, kq }: Chung & { kq: KetQuaChiTieu | null }) {
  const lo = loDangChonHoacDatO(pa.lo, loId);
  if (!lo) return null;
  const sc = sucChua(lo);
  const dong = kq?.theoLo[lo.id]?.dong ?? [];
  const m2 = { donVi: 'm²' };
  return (
    <>
      <MucGap tieuDe={`${t('muc.sucChua')} · ${lo.temDat.kyHieu}`} mo>
        <div class="dong"><span>{t('sc.dtLo')}</span><b>{fmtSo(sc.dtLo, m2)}</b></div>
        <div class="dong"><span>{t('sc.dtxdMax')}</span><b>{fmtSo(sc.dtxdMax, m2)}</b></div>
        {sc.dtxdThapMax !== null && <div class="dong"><span>{t('sc.dtxdThapMax')}</span><b>{fmtSo(sc.dtxdThapMax, m2)}</b></div>}
        <div class="dong"><span>{t('sc.dtSanMax')}</span><b>{fmtSo(sc.dtSanMax, m2)}</b></div>
        <div class="dong"><span>{t(lo.temDat.chiTieu.soCanMax !== null ? 'sc.soCanBang' : 'sc.soCanUoc')}</span><b>{fmtSo(sc.soCanUoc, { donVi: t('sc.can') })}</b></div>
        <div class="dong"><span>{t('sc.choDoCan')}</span><b>{fmtSo(sc.choDoCan, { donVi: t('sc.cho') })}</b></div>
        <div class="dong"><span>{t('sc.choXeMayCan')}</span><b>{fmtSo(sc.choXeMayCan, { donVi: t('sc.cho') })}</b></div>
        <div class="dong"><span>{t('sc.cayXanhCan')}</span><b>{fmtSo(sc.cayXanhCan, m2)}</b></div>
      </MucGap>
      <BangChiTieuLo dong={dong} />
    </>
  );
}

/** Bảng chỉ tiêu lô Đạt (kèm chênh) / Mục tiêu; dùng ở cấp Lô và màn Xếp tòa. */
export function BangChiTieuLo({ dong }: { dong: DongChiTieu[] }) {
  const m2 = { donVi: 'm²' };
  const dv: Record<string, { thapPhan?: number; donVi?: string }> = { matDo: { thapPhan: 1, donVi: '%' }, matDoThap: { thapPhan: 1, donVi: '%' }, dtSan: m2, cayXanh: m2 };
  return (
    <MucGap tieuDe={t('muc.chiTieuLo')} mo>
      <div class="dong bang-ct dau"><span>{t('ct.chiTieu')}</span><span>{t('ct.dat')}</span><span>{t('ct.mucTieu')}</span></div>
      {dong.map((d) => (
        <div class="dong bang-ct" key={d.khoa}>
          <span>{t(`dong.${d.khoa}`)}</span>
          <span class={d.dat === null ? '' : d.muc === 'vuot' ? 'vuot' : d.muc === 'canh_bao' ? 'canh-bao' : 'ok'}>
            {fmtSo(d.dat, dv[d.khoa])}
            {d.chenh !== null && ` (${d.chenh > 0 ? '+' : ''}${fmtSo(d.chenh, { thapPhan: dv[d.khoa]?.thapPhan })})`}
          </span>
          <span>{d.mucTieu === null ? '—' : `${d.chieu === '<=' ? '≤' : '≥'} ${fmtSo(d.mucTieu, dv[d.khoa])}`}</span>
        </div>
      ))}
    </MucGap>
  );
}
