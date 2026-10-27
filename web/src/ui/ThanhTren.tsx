import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
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
  onXuatCad?: () => void;
  onXuatXls?: () => void;
  /** Các bước làm việc chính (tab cố định trên thanh trên). */
  buoc?: { ds: [string, string][]; chon: string; onChon: (k: string) => void };
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

/** Nhóm tab có nền trượt: `<b>` tuyệt đối lấy vị trí / rộng của nút đang chọn. Lần đo đầu không trượt. */
function TabTruot({ lop, nhan, children }: { lop: string; nhan: string; children: ComponentChildren }) {
  const nav = useRef<HTMLElement>(null);
  const [vt, setVt] = useState({ l: 0, w: 0, san: false });
  const [lang] = useLang();
  const do_ = () => {
    const b = nav.current?.querySelector<HTMLElement>('button[aria-pressed="true"]');
    const l = b?.offsetLeft ?? 0, w = b?.offsetWidth ?? 0;
    setVt((o) => (o.l === l && o.w === w ? o : { l, w, san: o.w > 0 }));
  };
  useLayoutEffect(do_);
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !nav.current) return;
    const ob = new ResizeObserver(do_);
    ob.observe(nav.current);
    return () => ob.disconnect();
  }, [lang]);
  return (
    <nav class={`${lop} tab-truot`} aria-label={nhan} ref={nav}>
      <b class={`nen-truot${vt.san ? ' san' : ''}`} aria-hidden="true" style={{ left: `${vt.l}px`, width: `${vt.w}px` }} />
      {children}
    </nav>
  );
}

/** Menu "⋯" khi thanh hẹp: lớp phủ cố định dưới nút, không đẩy gì và không bị thanh cuộn ngang cắt. */
function MenuThem({ onXls, onCad }: { onXls?: () => void; onCad?: () => void }) {
  const [mo, setMo] = useState(false);
  const [vt, setVt] = useState({ top: 0, right: 0 });
  const nut = useRef<HTMLButtonElement>(null);
  const [lang, datLang] = useLang();
  useEffect(() => {
    if (!mo) return;
    const dong = () => setMo(false);
    const phim = (e: KeyboardEvent) => { if (e.key === 'Escape') setMo(false); };
    const ngoai = (e: Event) => { if (!(e.target as Element).closest?.('.menu-them')) setMo(false); };
    document.addEventListener('keydown', phim);
    document.addEventListener('pointerdown', ngoai);
    window.addEventListener('resize', dong);
    return () => { document.removeEventListener('keydown', phim); document.removeEventListener('pointerdown', ngoai); window.removeEventListener('resize', dong); };
  }, [mo]);
  const bam = () => {
    const b = nut.current?.getBoundingClientRect();
    if (b) setVt({ top: b.bottom + 4, right: Math.max(4, window.innerWidth - b.right) });
    setMo(!mo);
  };
  return (
    <span class="menu-them">
      <button class="nut-chu nut-them" type="button" ref={nut} aria-haspopup="menu" aria-expanded={mo} aria-label={t('menu.them')} title={t('menu.them')} onClick={bam}>⋯</button>
      {mo && (
        <div class="menu-them-bang" role="menu" style={{ top: `${vt.top}px`, right: `${vt.right}px` }} onClick={() => setMo(false)}>
          <button type="button" role="menuitem" onClick={onXls}>{t('xuat.xls')}</button>
          <button type="button" role="menuitem" disabled={!onCad} onClick={onCad}>{t('xuat.cad')}</button>
          <div class="menu-them-lang" role="group" aria-label={t('lang.chon')}>
            <button type="button" aria-pressed={lang === 'vi'} onClick={() => datLang('vi')}>VI</button>
            <button type="button" aria-pressed={lang === 'en'} onClick={() => datLang('en')}>EN</button>
          </div>
        </div>
      )}
    </span>
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
      {p.buoc && (
        <TabTruot lop="tab-buoc" nhan={t('buoc.nhom')}>
          {p.buoc.ds.map(([k, nhan]) => (
            <button type="button" key={k} aria-pressed={p.buoc!.chon === k} onClick={() => p.buoc!.onChon(k)}>{nhan}</button>
          ))}
        </TabTruot>
      )}
      <TabTruot lop="tab-xem" nhan={t('xem.nhom')}>
        {xem.map(([k, nhan]) => (
          <button type="button" key={k} aria-pressed={p.cheDoXem === k} onClick={() => p.onCheDoXem?.(k)}>{t(nhan)}</button>
        ))}
      </TabTruot>
      <span class="gian" />
      {p.capDo && (
        <nav class="cap-do" aria-label={t('cap.nhom')}>
          <button type="button" aria-label={t('cap.len')}>↑</button>
          <button type="button" title={p.capDo.lo}>{p.capDo.lo}</button>
          <span class="xam">|</span>
          <button type="button" title={t(p.capDo.coTe === 'tren' ? 'cap.tren' : 'cap.duoi')}>{t(p.capDo.coTe === 'tren' ? 'cap.tren' : 'cap.duoi')} ▾</button>
          {p.capDo.toa && <button type="button" title={p.capDo.toa}>{p.capDo.toa} ▾</button>}
          {p.capDo.tang && <button type="button" title={p.capDo.tang}>{p.capDo.tang} ▾</button>}
          {p.capDo.can && <button type="button" title={p.capDo.can}>{p.capDo.can} ▾</button>}
        </nav>
      )}
      <span class="gian" />
      {luu && (
        <span key={luu} class={`trang-thai-luu${luu === 'chua_luu_duoc' ? ' loi' : luu === 'dang_luu' ? ' dang' : ' da'}`} role="status">
          {t(luu === 'da_luu' ? 'luu.daLuu' : luu === 'dang_luu' ? 'luu.dangLuu' : 'luu.chuaLuuDuoc')}
        </span>
      )}
      {p.cheDo && (
        <>
          <span class="nhan-che-do">{t('cheDo.nhan')}</span>
          <div class="nhom-nut" role="group" aria-label={t('cheDo.nhom')}>
            {cheDo.map(([k, nhan]) => (
              <button type="button" aria-pressed={p.cheDo === k} disabled={p.duocSua === false && k !== 'chi_xem'} onClick={() => p.onCheDo?.(k)}>{t(nhan)}</button>
            ))}
          </div>
        </>
      )}
      <button class="nut-chu nhom-xuat" type="button" disabled={!p.onXuatXls} onClick={p.onXuatXls}>{t('xuat.xls')}</button>
      <button class="nut-chu nhom-xuat" type="button" disabled={!p.onXuatCad} onClick={p.onXuatCad}>{t('xuat.cad')}</button>
      <span class="nhom-xuat"><ChonLang /></span>
      <MenuThem onXls={p.onXuatXls} onCad={p.onXuatCad} />
    </header>
  );
}
