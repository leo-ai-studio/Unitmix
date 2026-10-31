import { NGAY_BUILD, nhanPhienBan, PHIEN_BAN } from '../phienBan';
import { LICH_SU_PHIEN_BAN } from '../lichSuPhienBan';
import { Fragment, type ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t, useLang } from '../i18n/i18n';
import { buocPhim } from './capDo';
import { useDongHop } from './useDongHop';

/** Một mục trong menu cấp: `nhom` = tiêu đề nhóm (hiện khi đổi nhóm), `phu` = chữ phụ xám bên phải, `danhDau` = chấm (vd. tầng có bố cục riêng). */
export type MucCap = { khoa: string; nhan: string; phu?: string; nhom?: string; chon?: boolean; danhDau?: boolean; tat?: boolean };
/** Một ô trên dải cấp: chữ đang hiện (cắt … khi chật), tooltip đủ tên, danh sách mục thả xuống. `dangO` = cấp đang đứng (tô --selected). */
export type MenuCap = { nhan: string; tieuDe: string; ds: MucCap[]; onChon: (khoa: string) => void; dangO?: boolean };
/** Dải cấp giữa thanh trên: lô / PA · cốt · tòa · tầng · căn; `onLen` lên một cấp (căn → tầng → tòa → lô). */
export type CapDo = { lo: MenuCap; coTe: MenuCap; toa?: MenuCap; tang?: MenuCap; can?: MenuCap; onLen?: () => void; nhanLen?: string };
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
  /** Mở hộp xuất PDF (báo cáo, Salekit, HĐMB) / xuất 3D · BIM (SketchUp .dae, Revit .ifc). */
  onXuatPdf?: () => void;
  onXuat3d?: () => void;
  /** Trả Promise thì nút hiện vòng O tới khi xong (xuất chờ rải hầm chạy nền). */
  onXuatXls?: () => void | Promise<void>;
  /** Các bước làm việc chính (tab cố định trên thanh trên). */
  buoc?: { ds: [string, string][]; chon: string; onChon: (k: string) => void };
  /** Nút mở trợ lý Leo AI (troLy/LeoAI.tsx): mo = đang hiện khung, dang = Leo AI đang chạy (vòng O quay). */
  leoAi?: { mo: boolean; dang: boolean; bat: () => void };
};

/** Mở / đóng bảng lịch sử phiên bản: bấm ngoài (trừ chính nút `.ban`) hoặc Esc thì đóng. */
function useLichSu(): [boolean, (f: (m: boolean) => boolean) => void] {
  const [moLs, setMoLs] = useState(false);
  useEffect(() => {
    if (!moLs) return;
    const dong = (e: Event) => { if (!(e.target as Element).closest?.('.lich-su-ban, .ban')) setMoLs(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoLs(false); };
    addEventListener('pointerdown', dong); addEventListener('keydown', esc);
    return () => { removeEventListener('pointerdown', dong); removeEventListener('keydown', esc); };
  }, [moLs]);
  return [moLs, setMoLs];
}

/** Bảng lịch sử phiên bản tóm tắt (LICH_SU_PHIEN_BAN), mới nhất ở trên. */
function BangLichSu() {
  const [lang] = useLang();
  return (
    <div class="lich-su-ban" role="dialog" aria-label={t('ls.tieuDe')} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      <b>{t('ls.tieuDe')}</b>
      {LICH_SU_PHIEN_BAN.map((m) => (
        <div key={m.v} class="ls-muc">
          <div class="ls-dau"><span>v{m.v}</span><small>{m.ngay}</small></div>
          <ul>{(lang === 'en' ? m.en : m.vi).map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      ))}
      <small class="ls-chan">{nhanPhienBan()}</small>
    </div>
  );
}

/** Logo + tên app. `anBan`: không hiện số phiên bản dưới tên (trang đã có `TacGiaBan` cạnh nút ngôn ngữ). */
export function ThuongHieu({ dangXuLy = false, anBan = false }: { dangXuLy?: boolean; anBan?: boolean }) {
  const [moLs, setMoLs] = useLichSu();
  return (
    <a class="thuong-hieu" href="/" aria-label={t('app.ten')} title={`${t('app.ten')} ${nhanPhienBan()}`}>
      <span class="mark">
        <img src="/brand/leo_ai_mark_base.png" alt="" />
        <img class={`brand-o${dangXuLy ? ' spinning' : ''}`} src="/brand/leo_ai_o.png" alt="" />
      </span>
      <span class="ten-ban">
        <strong>{t('app.ten').toUpperCase()}</strong>
        {/* Bấm số phiên bản (không về trang chủ) → lịch sử phiên bản tóm tắt. */}
        {!anBan && (
          <small class="ban" role="button" tabIndex={0} aria-expanded={moLs} title={t('ls.tieuDe')}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMoLs((m) => !m); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMoLs((m) => !m); } }}>v{PHIEN_BAN}</small>
        )}
      </span>
      {moLs && <BangLichSu />}
    </a>
  );
}

/** Ngày của bản đang chạy: lấy ở LICH_SU_PHIEN_BAN (đúng số PHIEN_BAN), chưa ghi thì ngày build. */
export const ngayPhienBan = (): string => LICH_SU_PHIEN_BAN.find((m) => m.v === PHIEN_BAN)?.ngay ?? NGAY_BUILD;

/** Người tạo + phiên bản + ngày — MỘT chỗ cố định trên thanh trên, cạnh nút VI / EN (trang Dự án). Bấm số phiên bản → lịch sử. */
export function TacGiaBan() {
  const [moLs, setMoLs] = useLichSu();
  return (
    <div class="tac-gia-boc">
      {/* cả khối là một nút (đủ 40 px cho ngón tay): dòng 1 người tạo, dòng 2 phiên bản · ngày */}
      <button type="button" class="tac-gia-ban ban" aria-expanded={moLs} aria-haspopup="dialog"
        aria-label={`${t('app.tacGia')} · v${PHIEN_BAN} · ${ngayPhienBan()} — ${t('ls.tieuDe')}`} title={`${t('ls.tieuDe')} · ${nhanPhienBan()}`}
        onClick={() => setMoLs((m) => !m)}>
        <span class="tg">NghiaVT</span>
        <span class="dong-ban"><b>v{PHIEN_BAN}</b> · {ngayPhienBan()}</span>
      </button>
      {moLs && <BangLichSu />}
    </div>
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

/**
 * Nhóm tab có nền trượt: `<b>` tuyệt đối lấy vị trí / rộng của nút đang chọn. Lần đo đầu không trượt.
 * Chỉ đo khi đổi tab (`chon`), đổi ngôn ngữ hoặc đổi cỡ (trước đây đo sau MỌI lần vẽ lại thanh trên): đọc offsetLeft
 * trong useLayoutEffect ép trình duyệt tính bố cục cả trang (gồm bản vẽ SVG) ngay giữa lượt vẽ — ~0,3 s CPU trên điện thoại.
 */
function TabTruot({ lop, nhan, chon, children }: { lop: string; nhan: string; chon?: string; children: ComponentChildren }) {
  const nav = useRef<HTMLElement>(null);
  const [vt, setVt] = useState({ l: 0, w: 0, san: false });
  const [lang] = useLang();
  const do_ = () => {
    const b = nav.current?.querySelector<HTMLElement>('button[aria-pressed="true"]');
    const l = b?.offsetLeft ?? 0, w = b?.offsetWidth ?? 0;
    setVt((o) => (o.l === l && o.w === w ? o : { l, w, san: o.w > 0 }));
  };
  // lần gắn đầu: để ResizeObserver đo (chạy sau bố cục của khung hình, không ép tính sớm); sau đó đo khi đổi tab
  const daGan = useRef(false);
  useLayoutEffect(() => { if (daGan.current) do_(); daGan.current = true; }, [chon, lang]);
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

/**
 * Menu "⋯" khi thanh hẹp: lớp phủ cố định dưới nút, không đẩy gì và không bị thanh cuộn ngang cắt.
 * Màn hẹp (≤ 1024 px) gom thêm phần ít dùng của thanh vào đây (`hep`): dải cấp, chế độ sửa, trạng thái lưu (CSS `.chi-hep`).
 */
function MenuThem({ onXls, onCad, onPdf, on3d, hep }: { onXls?: () => void; onCad?: () => void; onPdf?: () => void; on3d?: () => void; hep?: ComponentChildren }) {
  const [mo, setMo] = useState(false);
  const [vt, setVt] = useState({ top: 0, right: 0 });
  const nut = useRef<HTMLButtonElement>(null);
  const [lang, datLang] = useLang();
  useEffect(() => {
    if (!mo) return;
    // điện thoại ẩn / hiện thanh địa chỉ cũng bắn resize: chỉ đóng khi bề ngang đổi (xoay máy, kéo cửa sổ)
    const w0 = window.innerWidth;
    const dong = () => { if (window.innerWidth !== w0) setMo(false); };
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
        <div class="menu-them-bang" role="menu" style={{ top: `${vt.top}px`, right: `${vt.right}px`, maxHeight: `calc(100dvh - ${Math.round(vt.top) + 8}px)` }}
          onClick={(e) => { if ((e.target as Element).closest?.('[role=menuitem], [role=menuitemradio], .menu-them-lang button, .che-do button')) setMo(false); }}>
          {hep && <div class="chi-hep menu-them-hep">{hep}</div>}
          <button type="button" role="menuitem" onClick={onXls}>{t('xuat.xls')}</button>
          <button type="button" role="menuitem" disabled={!onCad} onClick={onCad}>{t('xuat.cad')}</button>
          <button type="button" role="menuitem" disabled={!onPdf} onClick={onPdf}>{t('xuat.pdf')}</button>
          <button type="button" role="menuitem" disabled={!on3d} onClick={on3d}>{t('xuat.mo3d')}</button>
          <div class="menu-them-lang" role="group" aria-label={t('lang.chon')}>
            <button type="button" aria-pressed={lang === 'vi'} onClick={() => datLang('vi')}>VI</button>
            <button type="button" aria-pressed={lang === 'en'} onClick={() => datLang('en')}>EN</button>
          </div>
        </div>
      )}
    </span>
  );
}

/** Dải cấp: một nhóm liền khung như `.nhom-nut`; mỗi ô mở menu thả xuống (lớp phủ cố định, không xô thanh / khung giữa). */
function DaiCap({ c }: { c: CapDo }) {
  const o = ([['lo', c.lo], ['cot', c.coTe], ['toa', c.toa], ['tang', c.tang], ['can', c.can]] as const).filter((x): x is [typeof x[0], MenuCap] => !!x[1]);
  return (
    <nav class="cap-do" aria-label={t('cap.nhom')}>
      <button type="button" class="cap-len" aria-label={t('cap.len')} title={c.nhanLen ?? t('cap.len')} disabled={!c.onLen} onClick={c.onLen}>↑</button>
      {o.map(([k, m]) => <NutCap key={k} m={m} lop={`cap-${k}`} />)}
    </nav>
  );
}

/** Một ô cấp: bấm (hoặc ↓) mở menu; menu đóng bằng phím thì trả focus về ô. */
function NutCap({ m, lop }: { m: MenuCap; lop: string }) {
  const [mo, setMo] = useState(false);
  const nut = useRef<HTMLButtonElement>(null);
  const dong = (traFocus: boolean) => { setMo(false); if (traFocus) nut.current?.focus(); };
  return (
    <>
      <button type="button" ref={nut} class={`nut-cap ${lop}${m.dangO ? ' dang-o' : ''}`} title={m.tieuDe} aria-haspopup="menu" aria-expanded={mo}
        onClick={() => setMo(!mo)} onKeyDown={(e) => { if (e.key === 'ArrowDown' && !mo) { e.preventDefault(); setMo(true); } }}>
        <span class="cap-chu">{m.nhan}</span><span class="cap-mui" aria-hidden="true">▾</span>
      </button>
      {mo && nut.current && <BangCap m={m} nut={nut.current} dong={dong} />}
    </>
  );
}

/** Bảng menu cấp: `position: fixed` dưới ô, ↑ ↓ Home End chuyển mục, Enter chọn, Esc / bấm ngoài / Tab đóng (hiệu ứng như hộp thoại). */
function BangCap({ m, nut, dong }: { m: MenuCap; nut: HTMLElement; dong: (traFocus: boolean) => void }) {
  const bang = useRef<HTMLDivElement>(null);
  const traFocus = useRef(true);
  const { lop, dongMem } = useDongHop(() => dong(traFocus.current));
  const b = nut.getBoundingClientRect();
  const [vt, setVt] = useState({ top: b.bottom + 4, left: b.left });
  const nuts = () => [...(bang.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitemradio"]') ?? [])];
  useLayoutEffect(() => {
    const el = bang.current;
    if (!el) return;
    // không tràn mép phải màn hình
    setVt({ top: b.bottom + 4, left: Math.max(4, Math.min(b.left, window.innerWidth - el.offsetWidth - 4)) });
    const ds = nuts();
    const dau = ds.find((x) => x.getAttribute('aria-checked') === 'true' && !x.disabled) ?? ds.find((x) => !x.disabled);
    dau?.focus();
    dau?.scrollIntoView?.({ block: 'nearest' });
  }, []);
  useEffect(() => {
    const ngoai = (e: Event) => {
      const el = e.target as Node;
      if (bang.current?.contains(el)) return;
      traFocus.current = false;
      // bấm lại chính ô đang mở: để onClick của ô đóng (tránh đóng rồi mở lại)
      if (nut.contains(el)) return;
      dongMem();
    };
    const thoi = () => { traFocus.current = false; dong(false); };
    document.addEventListener('pointerdown', ngoai);
    window.addEventListener('resize', thoi);
    return () => { document.removeEventListener('pointerdown', ngoai); window.removeEventListener('resize', thoi); };
  }, []);
  const phim = (e: KeyboardEvent) => {
    if (e.key === 'Tab') { traFocus.current = false; dongMem(); return; }
    // Esc chỉ đóng menu, không lọt xuống phím tắt bản vẽ (vd. Esc bỏ chọn tòa ở TMB)
    if (e.key === 'Escape') { e.stopPropagation(); dongMem(); return; }
    const ds = nuts();
    const j = buocPhim(e.key, ds.indexOf(document.activeElement as HTMLButtonElement), ds.map((x) => x.disabled));
    if (j !== null) { e.preventDefault(); ds[j].focus(); }
  };
  let nhom: string | undefined;
  return (
    <div class={`bang-cap${lop}`} role="menu" aria-label={m.tieuDe} ref={bang} onKeyDown={phim}
      style={{ top: `${vt.top}px`, left: `${vt.left}px`, maxHeight: `calc(var(--vv-h, 100dvh) - ${Math.round(vt.top) + 12}px)` }}>
      {m.ds.length === 0 && <div class="bang-cap-trong">{t('cap.trong')}</div>}
      {m.ds.map((x) => {
        const dau = x.nhom !== undefined && x.nhom !== nhom;
        nhom = x.nhom;
        return (
          <Fragment key={x.khoa}>
            {dau && <div class="bang-cap-nhom" role="presentation">{x.nhom}</div>}
            <button type="button" role="menuitemradio" aria-checked={!!x.chon} disabled={x.tat} title={x.phu ? `${x.nhan} · ${x.phu}` : x.nhan}
              onClick={() => { m.onChon(x.khoa); dongMem(); }}>
              <span class="bang-cap-chu">{x.nhan}</span>
              {x.danhDau && <i class="bang-cap-dau" aria-hidden="true" />}
              {x.phu && <small>{x.phu}</small>}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}

/** Nhãn ngắn của tab bước cho màn hẹp (`buoc.ngan.<khoá>`); thiếu thì dùng nhãn đủ. */
const nhanNgan = (k: string, nhan: string) => { const x = t(`buoc.ngan.${k}`); return x === `buoc.ngan.${k}` ? nhan : x; };

export function ThanhTren(p: Props) {
  useLang();
  const xem: [CheDoXem, string][] = [['mat_bang', 'xem.matBang'], ['mo_hinh', 'xem.moHinh'], ['chi_phi', 'xem.chiPhi']];
  const cheDo: [CheDo, string][] = [['tu_dong', 'cheDo.tuDong'], ['chinh_tay', 'cheDo.chinhTay'], ['chi_xem', 'cheDo.chiXem']];
  const luu = p.trangThaiLuu;
  // Xuất XLS có thể chờ rải hầm chạy nền: hiện vòng O trên nút, chặn bấm lặp.
  const [dangXls, setDangXls] = useState(false);
  const xuatXls = () => {
    if (dangXls || !p.onXuatXls) return;
    const r = p.onXuatXls();
    if (!r) return;
    setDangXls(true);
    r.catch((e) => console.error('xuat xls:', e)).finally(() => setDangXls(false));
  };
  const nhomCheDo = p.cheDo && (
    <div class="nhom-nut che-do" role="group" aria-label={t('cheDo.nhom')}>
      {cheDo.map(([k, nhan]) => (
        <button type="button" key={k} aria-pressed={p.cheDo === k} title={t(nhan)} disabled={p.duocSua === false && k !== 'chi_xem'} onClick={() => p.onCheDo?.(k)}>{t(nhan)}</button>
      ))}
    </div>
  );
  const chuLuu = (vai: boolean) => luu && (
    <span key={luu} class={`trang-thai-luu${luu === 'chua_luu_duoc' ? ' loi' : luu === 'dang_luu' ? ' dang' : ' da'}`} role={vai ? 'status' : undefined}>
      {t(luu === 'da_luu' ? 'luu.daLuu' : luu === 'dang_luu' ? 'luu.dangLuu' : 'luu.chuaLuuDuoc')}
    </span>
  );
  return (
    <header class="thanh-tren">
      <ThuongHieu dangXuLy={p.dangXuLy} />
      <button class="nut-chu nut-hoan" type="button" aria-label={t('nut.hoanTac')} title={t('nut.hoanTac')} disabled={!p.onHoanTac || p.cheDo === 'chi_xem'} onClick={p.onHoanTac}>↶</button>
      <button class="nut-chu nut-hoan" type="button" aria-label={t('nut.lamLai')} title={t('nut.lamLai')} disabled={!p.onLamLai || p.cheDo === 'chi_xem'} onClick={p.onLamLai}>↷</button>
      {p.buoc && (
        <TabTruot lop="tab-buoc" nhan={t('buoc.nhom')} chon={p.buoc.chon}>
          {p.buoc.ds.map(([k, nhan]) => (
            <button type="button" key={k} aria-pressed={p.buoc!.chon === k} title={nhan} onClick={() => p.buoc!.onChon(k)}>
              <span class="nhan-dai">{nhan}</span><span class="nhan-ngan" aria-hidden="true">{nhanNgan(k, nhan)}</span>
            </button>
          ))}
        </TabTruot>
      )}
      <TabTruot lop="tab-xem" nhan={t('xem.nhom')} chon={p.cheDoXem}>
        {xem.map(([k, nhan]) => (
          <button type="button" key={k} aria-pressed={p.cheDoXem === k} onClick={() => p.onCheDoXem?.(k)}>{t(nhan)}</button>
        ))}
      </TabTruot>
      {/* Chế độ sửa đứng ngay cạnh 2D / 3D / Chi phí (bên trái); bên phải chỉ còn lưu / xuất / ngôn ngữ. */}
      {nhomCheDo}
      <span class="gian" />
      {p.capDo && <DaiCap c={p.capDo} />}
      <span class="gian" />
      {chuLuu(true)}
      {p.leoAi && (
        <button type="button" class={`nut-leo-ai${p.leoAi.mo ? ' mo' : ''}`} aria-pressed={p.leoAi.mo} aria-label={t('leo.mo')} title={t('leo.mo')} onClick={p.leoAi.bat}>
          <span class="mark" aria-hidden="true"><img src="/brand/leo_ai_mark_base.png" alt="" /><img class={`brand-o${p.leoAi.dang ? ' spinning' : ''}`} src="/brand/leo_ai_o.png" alt="" /></span>
          <span class="nhan-dai">{t('leo.ten')}</span>
        </button>
      )}
      <button class="nut-chu nhom-xuat" type="button" disabled={!p.onXuatXls || dangXls} aria-busy={dangXls} onClick={xuatXls}>
        {dangXls && <img class="spin-o" src="/brand/leo_ai_o.png" alt="" style={{ width: '14px', height: '14px', verticalAlign: '-2px', marginRight: '6px' }} />}{t('xuat.xls')}
      </button>
      <button class="nut-chu nhom-xuat" type="button" disabled={!p.onXuatCad} onClick={p.onXuatCad}>{t('xuat.cad')}</button>
      <button class="nut-chu nhom-xuat" type="button" disabled={!p.onXuatPdf} onClick={p.onXuatPdf}>{t('xuat.pdf')}</button>
      <button class="nut-chu nhom-xuat" type="button" disabled={!p.onXuat3d} onClick={p.onXuat3d}>{t('xuat.mo3d')}</button>
      <span class="nhom-xuat"><ChonLang /></span>
      <MenuThem onXls={p.onXuatXls && xuatXls} onCad={p.onXuatCad} onPdf={p.onXuatPdf} on3d={p.onXuat3d}
        hep={<>{p.capDo && <DaiCap c={p.capDo} />}{nhomCheDo}{chuLuu(false)}</>} />
    </header>
  );
}
