import { useEffect, useState } from 'preact/hooks';
import type { BanDxf } from '../dxf/napDxf';
import { t } from '../i18n/i18n';
import type { DongChiTieu } from '../tinh/chiTieu';
import { dienTich } from '../tinh/hinhHoc';
import { LOAI_CAN, PHAN_HAM_MAC_DINH, type ChiTieuQH, type ChucNang, type HeSoDTSan, type Lo, type TrangThaiPA } from '../tinh/kieu';
import { loDangChonHoacDatO, taoLo } from '../tinh/macDinh';
import { laCaoTang } from '../tinh/loaiDat';
import { sucChua } from '../tinh/sucChua';
import { apPreset, chupPreset, type DuLieuPreset, type NhomPreset, type PhamViPreset } from '../kho/preset';
import { DongPreset } from '../ui/Preset';
import { MucGap } from '../ui/MucGap';
import { fmtSo } from '../ui/so';
import { SoDong } from '../ui/SoDong';
import { NhapChiTieu } from './NhapChiTieu';
import { NhapDeBai } from './NhapDeBai';
import { KhaiDanSo } from '../ui/KhaiDanSo';

type Chung = { pa: TrangThaiPA; sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void; chiXem: boolean; loId: string | null; chonLo: (id: string) => void };

const dtLo = (lo: Lo) => (lo.ranh.length >= 3 ? dienTich(lo.ranh) : 0);
const doiLo = (pa: TrangThaiPA, id: string, fn: (l: Lo) => Lo): TrangThaiPA => ({ ...pa, lo: pa.lo.map((l) => (l.id === id ? fn(l) : l)) });

/** Ô nhập số có nhãn và đơn vị. */
function O({ nhan, tip, gt, donVi, onDoi, tat, buoc = 1 }: { nhan: string; tip?: string; gt: number; donVi?: string; onDoi: (v: number) => void; tat: boolean; buoc?: number }) {
  return (
    <label class="o-so" title={tip}>
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
function ON({ nhan, tip, gt, donVi, onDoi, tat, buoc = 1 }: { nhan: string; tip?: string; gt: number | null; donVi?: string; onDoi: (v: number | null) => void; tat: boolean; buoc?: number }) {
  return (
    <label class="o-so" title={tip}>
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

/** Bộ đọc DXF (kèm dxf-parser): chunk riêng, tải khi chọn tệp lần đầu. */
let modDxf: typeof import('../dxf/napDxf') | null = null;
const napModDxf = async () => (modDxf ??= await import('../dxf/napDxf'));

function doanLop(lop: string[], mau: RegExp): string {
  return lop.find((l) => mau.test(l)) ?? '';
}

/** Nhập liệu TMB gọn một hàng: DXF hiện trạng, bảng chỉ tiêu QH (Excel), đề bài kinh doanh; thêm lô tay ở nút ＋. */
export function LoNhap({ pa, sua, chiXem, loId, chonLo }: Chung) {
  const [ban, setBan] = useState<BanDxf | null>(null);
  const [loiDoc, setLoiDoc] = useState('');
  const [chon, setChon] = useState({ ranh: '', chiGioi: '', tem: '', xungQuanh: '' });
  const [kt, setKt] = useState({ rong: 80, dai: 60 });
  const [hop, setHop] = useState<'chiTieu' | 'deBai' | null>(null);
  const [tay, setTay] = useState(false);
  const [moNhap, setMoNhap] = useState(false);
  useEffect(() => {
    if (!moNhap) return;
    const ngoai = (e: Event) => { if (!(e.target as Element).closest?.('.menu-nhap')) setMoNhap(false); };
    const phim = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoNhap(false); };
    document.addEventListener('pointerdown', ngoai); document.addEventListener('keydown', phim);
    return () => { document.removeEventListener('pointerdown', ngoai); document.removeEventListener('keydown', phim); };
  }, [moNhap]);
  const lo = loDangChonHoacDatO(pa.lo, loId);

  async function docTep(f: File) {
    setLoiDoc('');
    try {
      const [{ napDxf, RANH_HATCH, doanLopXungQuanh }, text] = await Promise.all([napModDxf(), f.text()]);
      const b = napDxf(text);
      setBan(b);
      // Ranh lập quy hoạch là ranh cả khu, không phải ranh lô.
      const ranh = doanLop(b.lop.filter((l) => !/l[aậ]p\s*quy\s*ho[aạ]ch/i.test(l)), /RANH|LO|PLOT|BOUND/i);
      const soHatch = b.lopHatch.reduce((a, l) => a + b.hatch(l).length, 0);
      setChon({
        // Bản vẽ SDĐ chỉ có ô đất tô hatch (lớp ranh kín ít ô hơn) thì lấy hatch.
        ranh: soHatch > (ranh ? b.polyKin(ranh).length : 0) ? RANH_HATCH : ranh,
        chiGioi: doanLop(b.lop, /CGXD|CHI.?GIOI|SETBACK|BUILD.?LINE/i),
        tem: doanLop(b.lop, /TEM|KY.?HIEU|TAG|TEXT/i),
        xungQuanh: doanLopXungQuanh(b.lop),
      });
    } catch {
      setBan(null);
      setLoiDoc(t('lo.loiDoc'));
    }
  }

  function taoTuDxf() {
    if (!ban || !chon.ranh || !modDxf) return;
    if (pa.lo.length && !confirm(t('lo.thayLo'))) return;
    const ds = modDxf.taoLoTuDxf(ban, { ranh: chon.ranh, chiGioi: chon.chiGioi || undefined, tem: chon.tem || undefined, xungQuanh: chon.xungQuanh || undefined });
    sua((p) => ({ ...p, lo: ds, toa: p.toa.filter((x) => ds.some((l) => l.id === x.loId)) }));
    setBan(null);
    const dau = ds.find(laCaoTang) ?? ds[0];
    if (dau) chonLo(dau.id);
  }

  function themChuNhat() {
    const id = `lo-${Date.now().toString(36)}`;
    const x0 = Math.max(0, ...pa.lo.flatMap((l) => l.ranh.map((q) => q[0]))) + (pa.lo.length ? 20 : 0);
    const moi = taoLo(id, `Lô ${pa.lo.length + 1}`, 'tm', [[x0, 0], [x0 + kt.rong, 0], [x0 + kt.rong, kt.dai], [x0, kt.dai]]);
    sua((p) => ({ ...p, lo: [...p.lo, moi] }));
    chonLo(id);
  }

  const loiRanh = ban && chon.ranh ? ban.loiLop(chon.ranh) : null;
  return (
    <>
      {/* một nút "Nhập liệu ▾" thay 4 nút nhỏ (DXF · Bảng QH · Đề bài KD · ＋); panel luôn gắn trong DOM để ô chọn tệp DXF còn hoạt động */}
      <div class="hang-nhap-tmb menu-nhap" role="group" aria-label={t('lo.nhapBang')}>
        <button type="button" class="nut-nho" aria-haspopup="menu" aria-expanded={moNhap} disabled={chiXem} onClick={() => setMoNhap(!moNhap)}>{t('lo.nhapLieu')} ▾</button>
        <div class="menu-nhap-bang" role="menu" hidden={!moNhap} onClick={() => setMoNhap(false)}>
          <label class={`nut-nho${chiXem ? ' tat' : ''}`} role="menuitem" title={t('gt.lo.dxf')}>
            {t('lo.nutDxf')}
            <input type="file" accept=".dxf" class="sr-only" disabled={chiXem} onChange={(e) => e.currentTarget.files?.[0] && docTep(e.currentTarget.files[0])} />
          </label>
          <button type="button" class="nut-nho" role="menuitem" disabled={chiXem || !pa.lo.length} title={t('gt.lo.bangQH')} onClick={() => setHop('chiTieu')}>{t('lo.nutBangQH')}</button>
          <button type="button" class="nut-nho" role="menuitem" disabled={chiXem || !lo} title={t('gt.lo.deBai')} onClick={() => setHop('deBai')}>{t('lo.nutDeBai')}</button>
          <button type="button" class="nut-nho" role="menuitem" aria-pressed={tay} disabled={chiXem} title={t('gt.lo.themTay')} onClick={() => setTay(!tay)}>{t('lo.themTay')}</button>
        </div>
      </div>
      {loiDoc && <p class="dong vuot" role="alert">{loiDoc}</p>}
      {ban && (
        <div class="khoi-dxf">
          <span class="muted">{t('lo.daNap').replace('{n}', String(ban.lop.length)).replace('{dv}', ban.donVi)}</span>
          {(['ranh', 'chiGioi', 'tem', 'xungQuanh'] as const).map((k) => (
            <label class="o-chon" key={k} title={t({ ranh: 'gt.lo.lopRanh', chiGioi: 'gt.lo.lopChiGioi', tem: 'gt.lo.lopTem', xungQuanh: 'gt.lo.lopXungQuanh' }[k])}>
              <span>{t({ ranh: 'lo.lopRanh', chiGioi: 'lo.lopChiGioi', tem: 'lo.lopTem', xungQuanh: 'lo.lopXungQuanh' }[k])}</span>
              <select value={chon[k]} onChange={(e) => setChon({ ...chon, [k]: e.currentTarget.value })}>
                <option value="">{t('lo.khongChon')}</option>
                {k === 'ranh' && ban.lopHatch.length > 0 && <option value={modDxf?.RANH_HATCH}>{t('lo.ranhHatch')}</option>}
                {ban.lop.map((l) => <option value={l}>{l}</option>)}
              </select>
            </label>
          ))}
          {loiRanh && <p class="vuot dong" role="alert">{t(`lo.loi.${loiRanh}`)}</p>}
          <div class="dong" style={{ gap: '6px' }}>
            <button type="button" class="nut-chinh" title={t('gt.lo.taoTuDxf')} disabled={chiXem || !chon.ranh || !!loiRanh} onClick={taoTuDxf}>{t('lo.taoTuDxf')}</button>
            <button type="button" class="nut-phu" onClick={() => setBan(null)}>{t('lo.huy')}</button>
          </div>
        </div>
      )}
      {tay && (
        <div class="dong" style={{ gap: '6px', alignItems: 'flex-end' }}>
          <O nhan={t('lo.rong')} tip={t('gt.lo.rong')} gt={kt.rong} donVi="m" tat={chiXem} onDoi={(v) => setKt({ ...kt, rong: v })} />
          <O nhan={t('lo.dai')} tip={t('gt.lo.dai')} gt={kt.dai} donVi="m" tat={chiXem} onDoi={(v) => setKt({ ...kt, dai: v })} />
          <button type="button" class="nut-phu" title={t('gt.lo.them')} disabled={chiXem || kt.rong <= 0 || kt.dai <= 0} onClick={themChuNhat}>{t('lo.them')}</button>
        </div>
      )}
      {hop === 'chiTieu' && <NhapChiTieu lo={pa.lo} dong={() => setHop(null)} ap={(ds) => sua((p) => ({ ...p, lo: ds }))} />}
      {hop === 'deBai' && lo && <NhapDeBai ds={pa.lo} loChon={lo} dong={() => setHop(null)} ap={(ds) => sua((p) => ({ ...p, lo: ds }))} />}
    </>
  );
}

/** Chọn lô làm việc: chỉ lô nhà ở cao tầng; các ô đất khác chỉ hiện trên bản vẽ làm nền. */
export function ChonLoCaoTang({ pa, loId, chonLo }: Pick<Chung, 'pa' | 'loId' | 'chonLo'>) {
  const ds = pa.lo.filter(laCaoTang);
  const lo = ds.find((l) => l.id === loId) ?? ds[0];
  if (!pa.lo.length) return <p class="dong muted">{t('lo.chuaCo')}</p>;
  if (!ds.length) return <p class="dong muted">{t('xep.loKhongXayO')}</p>;
  return (
    <div class="chon-lo-gon">
      <select value={lo?.id} aria-label={t('lo.kyHieu')} title={t('gt.lo.chonLo')} onChange={(e) => chonLo(e.currentTarget.value)}>
        {ds.map((l) => <option value={l.id}>{`${l.temDat.kyHieu} · ${t(`cn.${l.temDat.chucNang}`)} · ${fmtSo(dtLo(l), { donVi: 'm²' })}`}</option>)}
      </select>
      <span class="muted">{t('lo.soLoCaoTang').replace('{n}', String(ds.length)).replace('{m}', String(pa.lo.length))}</span>
    </div>
  );
}

/** Thông số của lô đang làm: chỉ tiêu QH, cơ cấu mục tiêu; hệ số và ngưỡng màu chung PA. Mặc định gập. */
export function LoChiTieu({ pa, sua, chiXem, lo }: Pick<Chung, 'pa' | 'sua' | 'chiXem'> & { lo: Lo | undefined }) {
  const ct = lo?.temDat.chiTieu;
  const datCt = (k: keyof ChiTieuQH) => (v: number | null) => lo && sua((p) => doiLo(p, lo.id, (l) => ({ ...l, temDat: { ...l.temDat, chiTieu: { ...l.temDat.chiTieu, [k]: v } } })));
  const tongCoCau = lo ? LOAI_CAN.reduce((a, k) => a + lo.temDat.coCauMucTieu[k], 0) : 100;
  const datHeSo = (k: keyof HeSoDTSan) => (v: number) => sua((p) => ({ ...p, heSo: { ...p.heSo, [k]: v / 100 } }));
  // Áp preset: dữ liệu đã lọc theo nhóm; chỉ-xem thì không áp.
  const apPresetNhom = (nhom: NhomPreset) => (du: DuLieuPreset, pham: PhamViPreset) => {
    if (!chiXem) sua((p) => apPreset(nhom, p, du, pham, lo?.id ?? null));
  };
  return (
    <>
      <MucGap tieuDe={t('gt.ps.mucCap')} giaiThich={t('gt.ps.giaiThichCap')}>
        <DongPreset nhom="cap" chiXem={chiXem} chonPham chup={() => chupPreset('cap', pa, lo)} ap={apPresetNhom('cap')} />
      </MucGap>
      {lo && ct && (
        <>
          <MucGap tieuDe={`${t('muc.chiTieuQH')} · ${lo.temDat.kyHieu}`} giaiThich={t('gt.muc.chiTieuQH')}>
            <DongPreset nhom="chiTieu" chiXem={chiXem} chup={() => chupPreset('chiTieu', pa, lo)} ap={apPresetNhom('chiTieu')} />
            <label class="o-chon" title={t('gt.lo.kyHieu')}><span>{t('lo.kyHieu')}</span>
              <input value={lo.temDat.kyHieu} disabled={chiXem} onChange={(e) => { const v = e.currentTarget.value.trim(); if (v) sua((p) => doiLo(p, lo.id, (l) => ({ ...l, temDat: { ...l.temDat, kyHieu: v } }))); }} />
            </label>
            <label class="o-chon" title={t('gt.lo.chucNang')}><span>{t('lo.chucNang')}</span>
              <select value={lo.temDat.chucNang} disabled={chiXem} onChange={(e) => { const v = e.currentTarget.value as ChucNang; sua((p) => doiLo(p, lo.id, (l) => ({ ...l, temDat: { ...l.temDat, chucNang: v } }))); }}>
                {(['tm', 'xh', 'khac'] as const).map((c) => <option value={c}>{t(`cn.${c}`)}</option>)}
              </select>
            </label>
            {lo.temDat.nguonChiTieu && (
              <p class="dong muted" style={{ margin: 0 }}>
                {t('lo.nguonCt').replace('{d}', String(lo.temDat.nguonChiTieu.dong)).replace('{t}', lo.temDat.nguonChiTieu.ten).replace('{s}', lo.temDat.nguonChiTieu.sheet)}
                {lo.temDat.nguonChiTieu.soLo > 1 && ` ${t('lo.nguonCtNhom').replace('{n}', String(lo.temDat.nguonChiTieu.soLo))}`}
              </p>
            )}
            <div class="luoi-o">
              <O nhan={t('ct.matDoMax')} tip={t('gt.ct.matDoMax')} gt={ct.matDoMax} donVi="%" tat={chiXem} onDoi={datCt('matDoMax')} />
              <ON nhan={t('ct.matDoThapMax')} tip={t('gt.ct.matDoThapMax')} gt={ct.matDoThapMax} donVi="%" buoc={0.1} tat={chiXem} onDoi={datCt('matDoThapMax')} />
              <O nhan={t('ct.hssddMax')} tip={t('gt.ct.hssddMax')} gt={ct.hssddMax} buoc={0.1} tat={chiXem} onDoi={datCt('hssddMax')} />
              <O nhan={t('ct.tangCaoMax')} tip={t('gt.ct.tangCaoMax')} gt={ct.tangCaoMax} tat={chiXem} onDoi={datCt('tangCaoMax')} />
              <ON nhan={t('ct.tangDe')} tip={t('gt.ct.tangDe')} gt={ct.tangDe} tat={chiXem} onDoi={datCt('tangDe')} />
              <ON nhan={t('ct.tangCanHo')} tip={t('gt.ct.tangCanHo')} gt={ct.tangCanHo} tat={chiXem} onDoi={datCt('tangCanHo')} />
              <ON nhan={t('ct.tangHam')} tip={t('gt.ct.tangHam')} gt={ct.tangHam} tat={chiXem} onDoi={datCt('tangHam')} />
              <ON nhan={t('ct.soCanMax')} tip={t('gt.ct.soCanMax')} gt={ct.soCanMax} buoc={10} tat={chiXem} onDoi={datCt('soCanMax')} />
              <O nhan={t('ct.danSoMax')} tip={t('gt.ct.danSoMax')} gt={ct.danSoMax} buoc={10} tat={chiXem} onDoi={datCt('danSoMax')} />
              <O nhan={t('ct.nguoiMoiCan')} tip={t('gt.ct.nguoiMoiCan')} gt={ct.nguoiMoiCan} buoc={0.1} tat={chiXem} onDoi={datCt('nguoiMoiCan')} />
              <O nhan={t('ct.choDoOtoMoiCan')} tip={t('gt.ct.choDoOtoMoiCan')} gt={ct.choDoOtoMoiCan} buoc={0.1} tat={chiXem} onDoi={datCt('choDoOtoMoiCan')} />
              <O nhan={t('ct.choXeMayMoiCan')} tip={t('gt.ct.choXeMayMoiCan')} gt={ct.choXeMayMoiCan} buoc={0.1} tat={chiXem} onDoi={datCt('choXeMayMoiCan')} />
              <O nhan={t('ct.cayXanhMin')} tip={t('gt.ct.cayXanhMin')} gt={ct.cayXanhMin} donVi="%" tat={chiXem} onDoi={datCt('cayXanhMin')} />
            </div>
            <KhaiDanSo lo={lo} sua={sua} chiXem={chiXem} />
          </MucGap>
          <MucGap tieuDe={t('muc.coCauMucTieu')} giaiThich={t('gt.muc.coCauMucTieu')}>
            <DongPreset nhom="coCau" chiXem={chiXem} chup={() => chupPreset('coCau', pa, lo)} ap={apPresetNhom('coCau')} />
            {lo.temDat.deBai && <p class="dong muted" style={{ margin: 0 }}>{t('lo.nguonDeBai').replace('{n}', lo.temDat.deBai.nguon)}</p>}
            <div class="luoi-o">
              {LOAI_CAN.map((k) => (
                <O key={k} tip={t('gt.coCau.o')} nhan={lo.temDat.deBai?.dtCan[k] ? `${t(`loai.${k}`)} · ${fmtSo(lo.temDat.deBai.dtCan[k]!, { thapPhan: 1, donVi: 'm²' })}` : t(`loai.${k}`)}
                  gt={lo.temDat.coCauMucTieu[k]} donVi="%" tat={chiXem}
                  onDoi={(v) => sua((p) => doiLo(p, lo.id, (l) => ({ ...l, temDat: { ...l.temDat, coCauMucTieu: { ...l.temDat.coCauMucTieu, [k]: v } } })))} />
              ))}
            </div>
            <div class="dong"><span>{t('coCau.tong')}</span><b class={Math.abs(tongCoCau - 100) > 0.01 ? 'vuot' : 'ok'}>{fmtSo(tongCoCau, { donVi: '%' })}</b></div>
            {Math.abs(tongCoCau - 100) > 0.01 && <p class="vuot dong" role="alert">{t('coCau.phaiDu100')}</p>}
          </MucGap>
        </>
      )}
      <MucGap tieuDe={t('muc.heSoNguong')} giaiThich={t('heSo.canCu')}>
        <p class="dong muted">{t('heSo.canCu')}</p>
        <div class="luoi-o">
          {(['can', 'chung', 'thuongMai', 'apMai', 'ham'] as const).map((k) => (
            <O key={k} nhan={t(`heSo.${k}`)} gt={Math.round((pa.heSo[k] ?? 1) * 100)} donVi="%" tat={chiXem} onDoi={datHeSo(k)} />
          ))}
          {(['doXe', 'kyThuat'] as const).map((k) => (
            <O key={k} nhan={t(`phanHam.${k}`)} gt={Math.round((pa.phanHam ?? PHAN_HAM_MAC_DINH)[k] * 100)} donVi="%" tat={chiXem}
              onDoi={(v) => sua((p) => ({ ...p, phanHam: { ...(p.phanHam ?? PHAN_HAM_MAC_DINH), [k]: Math.min(v, 100) / 100 } }))} />
          ))}
          <O nhan={t('ng.dtCan')} gt={pa.nguong.dtCanM2} donVi="m²" buoc={0.5} tat={chiXem} onDoi={(v) => sua((p) => ({ ...p, nguong: { ...p.nguong, dtCanM2: v } }))} />
          <O nhan={t('ng.kichThuoc')} gt={pa.nguong.kichThuocM} donVi="m" buoc={0.05} tat={chiXem} onDoi={(v) => sua((p) => ({ ...p, nguong: { ...p.nguong, kichThuocM: v } }))} />
        </div>
        <p class="dong muted">{t('heSo.ghiChu')}</p>
      </MucGap>
    </>
  );
}

/** Sức chứa của lô theo chỉ tiêu QH (panel phải). */
export function SucChuaLo({ lo }: { lo: Lo }) {
  const sc = sucChua(lo);
  const m2 = { donVi: 'm²' };
  return (
    <MucGap tieuDe={`${t('muc.sucChua')} · ${lo.temDat.kyHieu}`} giaiThich={t('gt.muc.sucChua')}>
      <div class="dong" title={t('gt.sc.dtLo')}><span>{t('sc.dtLo')}</span><b>{fmtSo(sc.dtLo, m2)}</b></div>
      <div class="dong" title={t('gt.sc.dtxdMax')}><span>{t('sc.dtxdMax')}</span><b>{fmtSo(sc.dtxdMax, m2)}</b></div>
      {sc.dtxdThapMax !== null && <div class="dong" title={t('gt.sc.dtxdThapMax')}><span>{t('sc.dtxdThapMax')}</span><b>{fmtSo(sc.dtxdThapMax, m2)}</b></div>}
      <div class="dong" title={t('gt.sc.dtSanMax')}><span>{t('sc.dtSanMax')}</span><b>{fmtSo(sc.dtSanMax, m2)}</b></div>
      <div class="dong" title={t('gt.sc.soCan')}><span>{t(lo.temDat.chiTieu.soCanMax !== null ? 'sc.soCanBang' : 'sc.soCanUoc')}</span><b>{fmtSo(sc.soCanUoc, { donVi: t('sc.can') })}</b></div>
      <div class="dong" title={t('gt.sc.choDo')}><span>{t('sc.choDoCan')}</span><b>{fmtSo(sc.choDoCan, { donVi: t('sc.cho') })}</b></div>
      <div class="dong" title={t('gt.sc.choXeMay')}><span>{t('sc.choXeMayCan')}</span><b>{fmtSo(sc.choXeMayCan, { donVi: t('sc.cho') })}</b></div>
      <div class="dong" title={t('gt.sc.cayXanh')}><span>{t('sc.cayXanhCan')}</span><b>{fmtSo(sc.cayXanhCan, m2)}</b></div>
    </MucGap>
  );
}

/** Bảng chỉ tiêu lô Đạt (kèm chênh) / Mục tiêu; dùng ở cấp Lô và màn Xếp tòa. */
export function BangChiTieuLo({ dong, mo = true }: { dong: DongChiTieu[]; mo?: boolean }) {
  const m2 = { donVi: 'm²' };
  const dv: Record<string, { thapPhan?: number; donVi?: string }> = { matDo: { thapPhan: 1, donVi: '%' }, matDoThap: { thapPhan: 1, donVi: '%' }, dtSan: m2, cayXanh: m2 };
  return (
    <MucGap tieuDe={t('muc.chiTieuLo')} giaiThich={t('gt.muc.chiTieuLo')} mo={mo}>
      <div class="dong bang-ct dau"><span>{t('ct.chiTieu')}</span><span>{t('ct.dat')}</span><span>{t('ct.mucTieu')}</span></div>
      {dong.map((d) => (
        <div class="dong bang-ct" key={d.khoa} title={t(`gt.dong.${d.khoa}`)}>
          <span>{t(`dong.${d.khoa}`)}</span>
          <span class={d.dat === null ? '' : d.muc === 'vuot' ? 'vuot' : d.muc === 'canh_bao' ? 'canh-bao' : 'ok'}>
            <SoDong value={d.dat} {...dv[d.khoa]} />
            {d.chenh !== null && ` (${d.chenh > 0 ? '+' : ''}${fmtSo(d.chenh, { thapPhan: dv[d.khoa]?.thapPhan })})`}
          </span>
          <span>{d.mucTieu === null ? '—' : `${d.chieu === '<=' ? '≤' : '≥'} ${fmtSo(d.mucTieu, dv[d.khoa])}`}</span>
        </div>
      ))}
    </MucGap>
  );
}
