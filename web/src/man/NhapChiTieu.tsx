import { useMemo, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { useDongHop } from '../ui/useDongHop';
import { LopNoi } from '../ui/LopNoi';
import { apChiTieu, chonSheet, docBangChiTieu, ghepLo, ghepTay, type BangChiTieu, type KetQuaGhep, type TruongBang } from '../nhap/bangChiTieu';
import { docTepExcel } from '../nhap/docExcel';
import type { Sheet } from '../nhap/luoi';
import { dienTich } from '../tinh/hinhHoc';
import type { Lo } from '../tinh/kieu';
import { fmtSo } from '../ui/so';

const LECH_OK = 0.5, LECH_CANH_BAO = 2; // % lệch DT bảng / DXF

const lopLech = (p: number | null) => (p === null ? '' : Math.abs(p) <= LECH_OK ? 'ok' : Math.abs(p) <= LECH_CANH_BAO ? 'canh-bao' : 'vuot');
const fmtLech = (p: number | null) => (p === null ? '—' : `${p > 0 ? '+' : ''}${fmtSo(p, { thapPhan: 2 })} %`);
const dtLo = (l: Lo) => (l.ranh.length >= 3 ? dienTich(l.ranh) : 0);
const COT_HIEN: TruongBang[] = ['matDoDe', 'matDoThap', 'tangHam', 'tangDe', 'tangThap', 'tangCao', 'hssdd', 'soCan', 'danSo'];

/** Hộp thoại: chọn Excel chỉ tiêu QH → chọn sheet → đối chiếu với lô DXF (DT lệch %) → áp chỉ tiêu vào lô. */
export function NhapChiTieu({ lo, dong, ap }: { lo: Lo[]; dong: () => void; ap: (moi: Lo[]) => void }) {
  const { lop, dongMem } = useDongHop(dong);
  const [tep, setTep] = useState('');
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [bang, setBang] = useState<BangChiTieu | null>(null);
  const [ghep, setGhep] = useState<KetQuaGhep | null>(null);
  const [loi, setLoi] = useState('');

  async function chonTep(f: File) {
    setLoi('');
    try {
      const ds = await docTepExcel(f);
      const b = chonSheet(ds);
      setTep(f.name);
      setSheets(ds);
      if (!b) { setBang(null); setGhep(null); setLoi(t('nct.khongNhan')); return; }
      setBang(b);
      setGhep(ghepLo(b, lo));
    } catch {
      setLoi(t('lo.loiDoc'));
    }
  }
  function doiSheet(ten: string) {
    const b = docBangChiTieu(sheets!.find((s) => s.ten === ten)!);
    setBang(b);
    setGhep(b ? ghepLo(b, lo) : null);
    setLoi(b ? '' : t('nct.khongNhan'));
  }

  const dongCua = useMemo(() => {
    const m = new Map<string, number>();
    ghep?.ghep.forEach((g) => g.loIds.forEach((id) => m.set(id, g.dong)));
    return m;
  }, [ghep]);
  const dongBang = (n: number) => bang!.dong.find((d) => d.dong === n)!;
  const soLoGhep = dongCua.size;
  const dongThieuLo = bang && ghep ? bang.dong.filter((d) => !d.noiBo && !d.tongHop && d.gt.dtDat && !ghep.ghep.find((g) => g.dong === d.dong)!.loIds.length) : [];

  return (
    <LopNoi>
    <div class={`hop-thoai${lop}`} role="dialog" aria-modal="true" aria-labelledby="tieu-de-nct">
      <div class="hop-rong">
        <h2 id="tieu-de-nct">{t('nct.tieuDe')}</h2>
        <p class="muted" style={{ margin: 0 }}>{t('nct.giaiThich')}</p>
        <div class="dong dong-tep" style={{ gap: '8px', padding: 0 }}>
          <label class="nut-phu" title={t('gt.nct.chonTep')} style={{ cursor: 'pointer', flexDirection: 'row' }}>
            {t('nct.chonTep')}
            <input type="file" accept=".xlsx,.xls,.xlsm" class="sr-only" onChange={(e) => e.currentTarget.files?.[0] && chonTep(e.currentTarget.files[0])} />
          </label>
          {tep && <span class="muted">{tep}</span>}
          {sheets && bang && (
            <label class="o-chon" style={{ flexDirection: 'row', marginLeft: 'auto' }} title={t('gt.nct.sheet')}>
              <span>{t('nct.sheet')}</span>
              <select value={bang.sheet} onChange={(e) => doiSheet(e.currentTarget.value)}>
                {sheets.map((s) => <option value={s.ten}>{s.ten}</option>)}
              </select>
            </label>
          )}
        </div>
        {loi && <p class="vuot" role="alert" style={{ margin: 0 }}>{loi}</p>}
        {bang && ghep && (
          <>
            <p class="muted" style={{ margin: 0 }}>
              {t('nct.daNhan').replace('{d}', String(bang.dong.length)).replace('{c}', Object.keys(bang.cot).filter((k) => k !== 'ten' && k !== 'stt').map((k) => t(`nct.f.${k}`)).join(', '))}
            </p>
            <div class="bang-nhap" role="table" aria-label={t('nct.doiChieu')}>
              <div class="hang-nhap dau" role="row">
                <span>{t('lo.kyHieu')}</span><span>{t('nct.dtDxf')}</span><span>{t('nct.dongBang')}</span><span>{t('nct.dtBang')}</span><span>{t('nct.lech')}</span>
                {COT_HIEN.map((k) => <span key={k}>{t(`nct.f.${k}`)}</span>)}
              </div>
              {lo.map((l) => {
                const n = dongCua.get(l.id);
                const d = n ? dongBang(n) : null;
                const g = n ? ghep.ghep.find((x) => x.dong === n)! : null;
                return (
                  <div class="hang-nhap" role="row" key={l.id}>
                    <b>{l.temDat.kyHieu}</b>
                    <span>{fmtSo(dtLo(l), { donVi: 'm²' })}</span>
                    <span>
                      <select aria-label={`${t('nct.dongBang')} ${l.temDat.kyHieu}`} value={n ?? ''} onChange={(e) => setGhep(ghepTay(ghep, bang, lo, l.id, e.currentTarget.value ? Number(e.currentTarget.value) : null))}>
                        <option value="">{t('nct.khongGhep')}</option>
                        {bang.dong.filter((x) => !x.noiBo).map((x) => <option value={x.dong}>{`${x.stt ? `${x.stt} · ` : ''}${x.ten}`}</option>)}
                      </select>
                      {g && g.loIds.length > 1 && <small class="muted"> {t('nct.nhomLo').replace('{n}', String(g.loIds.length))}</small>}
                    </span>
                    <span>{fmtSo(d?.gt.dtDat ?? null, { donVi: 'm²' })}</span>
                    <span class={lopLech(g?.lechPct ?? null)}>{fmtLech(g?.lechPct ?? null)}</span>
                    {COT_HIEN.map((k) => <span key={k}>{fmtSo(d?.gt[k] ?? null, { thapPhan: k === 'hssdd' ? 2 : k.startsWith('matDo') ? 1 : 0 })}</span>)}
                  </div>
                );
              })}
            </div>
            {dongThieuLo.length > 0 && (
              <p class="canh-bao" style={{ margin: 0 }}>
                {t('nct.dongThieuLo')}: {dongThieuLo.map((d) => `${d.stt ? `${d.stt} ` : ''}${d.ten} (${fmtSo(d.gt.dtDat!, { donVi: 'm²' })})`).join(' · ')}
              </p>
            )}
            {ghep.loChuaGhep.length > 0 && (
              <p class="canh-bao" style={{ margin: 0 }}>
                {t('nct.loChuaGhep')}: {ghep.loChuaGhep.map((id) => lo.find((l) => l.id === id)!).map((l) => `${l.temDat.kyHieu} (${fmtSo(dtLo(l), { donVi: 'm²' })})`).join(' · ')}
              </p>
            )}
            <p class="muted" style={{ margin: 0 }}>{t('nct.ghiChuChia')}</p>
          </>
        )}
        <div class="chan-hop">
          <button type="button" class="nut-phu" onClick={dongMem}>{t('duAn.huy')}</button>
          <button type="button" class="nut-chinh" disabled={!bang || !ghep || !soLoGhep}
            onClick={() => { ap(apChiTieu(lo, bang!, ghep!, tep)); dongMem(); }}>
            {t('nct.ap').replace('{n}', String(soLoGhep))}
          </button>
        </div>
      </div>
    </div>
    </LopNoi>
  );
}
