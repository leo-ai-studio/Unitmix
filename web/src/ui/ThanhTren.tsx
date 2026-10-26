import { t, useLang } from '../i18n/i18n';

export type CapDo = { lo: string; coTe: 'tren' | 'duoi'; toa?: string; tang?: string; can?: string };
export type CheDo = 'tu_dong' | 'chinh_tay' | 'chi_xem';
export type CheDoXem = 'mat_bang' | 'mo_hinh' | 'chi_phi';
export type TrangThaiLuu = 'da_luu' | 'dang_luu' | 'chua_luu_duoc';

type Props = {
  capDo?: CapDo;
  cheDoXem?: CheDoXem;
  onCheDoXem?: (x: CheDoXem) => void;
  cheDo?: CheDo;
  onCheDo?: (x: CheDo) => void;
  trangThaiLuu?: TrangThaiLuu;
  dangXuLy?: boolean;
  duocSua?: boolean;
  onHoanTac?: () => void;
  onLamLai?: () => void;
};

export function ThuongHieu({ dangXuLy = false }: { dangXuLy?: boolean }) {
  return (
    <a class="thuong-hieu" href="/" aria-label={t('app.ten')}>
      <span class="mark">
        <img src="/brand/leo_ai_mark_base.png" alt="" />
        <img class={`brand-o${dangXuLy ? ' spinning' : ''}`} src="/brand/leo_ai_o.png" alt="" />
      </span>
      <strong>{t('app.ten').toUpperCase()}</strong>
    </a>
  );
}

export function ChonLang() {
  const [lang, datLang] = useLang();
  return (
    <div class="chon-lang" role="group" aria-label={t('lang.chon')}>
      <button type="button" aria-pressed={lang === 'vi'} onClick={() => datLang('vi')}>VI</button>
      <button type="button" aria-pressed={lang === 'en'} onClick={() => datLang('en')}>EN</button>
    </div>
  );
}

export function ThanhTren(p: Props) {
  useLang();
  const xem: [CheDoXem, string][] = [['mat_bang', 'xem.matBang'], ['mo_hinh', 'xem.moHinh'], ['chi_phi', 'xem.chiPhi']];
  const cheDo: [CheDo, string][] = [['tu_dong', 'cheDo.tuDong'], ['chinh_tay', 'cheDo.chinhTay'], ['chi_xem', 'cheDo.chiXem']];
  const luu = p.trangThaiLuu;
  return (
    <header class="thanh-tren">
      <ThuongHieu dangXuLy={p.dangXuLy} />
      <button class="nut-chu" type="button" aria-label={t('nut.hoanTac')} title={t('nut.hoanTac')} disabled={!p.onHoanTac || p.cheDo === 'chi_xem'} onClick={p.onHoanTac}>↶</button>
      <button class="nut-chu" type="button" aria-label={t('nut.lamLai')} title={t('nut.lamLai')} disabled={!p.onLamLai || p.cheDo === 'chi_xem'} onClick={p.onLamLai}>↷</button>
      <nav class="tab-xem" aria-label={t('xem.nhom')}>
        {xem.map(([k, nhan]) => (
          <button type="button" aria-pressed={p.cheDoXem === k} onClick={() => p.onCheDoXem?.(k)}>{t(nhan)}</button>
        ))}
      </nav>
      <span class="gian" />
      {p.capDo && (
        <nav class="cap-do" aria-label={t('cap.nhom')}>
          <button type="button" aria-label={t('cap.len')}>↑</button>
          <button type="button">{p.capDo.lo}</button>
          <span class="xam">|</span>
          <button type="button">{t(p.capDo.coTe === 'tren' ? 'cap.tren' : 'cap.duoi')} ▾</button>
          {p.capDo.toa && <button type="button">{p.capDo.toa} ▾</button>}
          {p.capDo.tang && <button type="button">{p.capDo.tang} ▾</button>}
          {p.capDo.can && <button type="button">{p.capDo.can} ▾</button>}
        </nav>
      )}
      <span class="gian" />
      {luu && (
        <span class={`trang-thai-luu${luu === 'chua_luu_duoc' ? ' loi' : ''}`} role="status">
          {t(luu === 'da_luu' ? 'luu.daLuu' : luu === 'dang_luu' ? 'luu.dangLuu' : 'luu.chuaLuuDuoc')}
        </span>
      )}
      {p.cheDo && (
        <>
          <span>{t('cheDo.nhan')}</span>
          <div class="nhom-nut" role="group" aria-label={t('cheDo.nhom')}>
            {cheDo.map(([k, nhan]) => (
              <button type="button" aria-pressed={p.cheDo === k} disabled={p.duocSua === false && k !== 'chi_xem'} onClick={() => p.onCheDo?.(k)}>{t(nhan)}</button>
            ))}
          </div>
        </>
      )}
      <button class="nut-chu" type="button">{t('xuat.xls')}</button>
      <button class="nut-chu" type="button">{t('xuat.cad')}</button>
      <ChonLang />
    </header>
  );
}
