import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { t } from '../i18n/i18n';
import { CONG_NANG_O, type CanMau, type CongNangO, type DiXuyen, type ThongTinLoi } from '../tinh/kieu';
import { nhanMauCan } from '../tinh/doiCan';
import type { KieuMb } from './kieuMb';
import { XemMauCan } from './XemMauCan';

/** Hộp nổi đặt tại toạ độ màn hình (position: fixed), không chiếm chỗ trong bố cục. Esc / bấm ra ngoài thì đóng. */
export function HopNoi({ x, y, dong, nhan, children }: { x: number; y: number; dong: () => void; nhan: string; children: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null);
  const dongRef = useRef(dong);
  dongRef.current = dong;
  useEffect(() => {
    const ra = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) dongRef.current(); };
    const phim = (e: KeyboardEvent) => { if (e.key === 'Escape') dongRef.current(); };
    window.addEventListener('pointerdown', ra, true);
    window.addEventListener('keydown', phim);
    ref.current?.querySelector<HTMLElement>('button:not([disabled]),input:not([disabled])')?.focus();
    return () => { window.removeEventListener('pointerdown', ra, true); window.removeEventListener('keydown', phim); };
  }, []);
  // giữ hộp trong cửa sổ
  const W = 240, H = 300;
  const left = Math.max(8, Math.min(x, (typeof innerWidth === 'number' ? innerWidth : 1200) - W - 8));
  const top = Math.max(8, Math.min(y, (typeof innerHeight === 'number' ? innerHeight : 800) - H - 8));
  return (
    <div ref={ref} class="menu-o" role="menu" aria-label={nhan} style={{ left: `${left}px`, top: `${top}px` }} onContextMenu={(e) => e.preventDefault()}>
      {children}
    </div>
  );
}

type PropsCN = {
  x: number; y: number; dong: () => void;
  soO: number;
  /** Công năng hiện tại (khi mọi ô chọn cùng một công năng), không thì null. */
  hienTai: CongNangO | null;
  /** Nhãn phạm vi áp: "bố cục chung" / "Tầng 5, 6". */
  phamVi: string;
  chiXem: boolean;
  chon: (cn: CongNangO) => void;
  /** Có (ô chính là căn và còn căn khác cùng mẫu): nút chọn mọi căn cùng mẫu để STRETCH / đổi công năng cả nhóm. */
  cungMau?: { n: number; chon: () => void };
  /** Có (đúng một ô đang là căn): thêm tab "Đổi căn" — danh sách mẫu cùng nhóm / vị trí, bấm để xem mặt bằng rồi chọn. */
  doiCan?: { ds: CanMau[]; dangDung: string; guong: boolean; kieu: KieuMb; noiThat: boolean; doi: (id: string) => void };
};

/** Menu ngữ cảnh ô căn (L8): tab Đổi công năng (một hoặc nhiều ô) · tab Đổi căn (một ô căn: đổi sang mẫu khác cùng loại). */
export function MenuCongNang({ x, y, dong, soO, hienTai, phamVi, chiXem, chon, cungMau, doiCan }: PropsCN) {
  const [tab, setTab] = useState<'cn' | 'can'>('cn');
  const [xem, setXem] = useState<string | null>(null);
  const goc = doiCan?.dangDung.split('~')[0];
  const canXem = doiCan?.ds.find((c) => c.id === xem);
  return (
    <HopNoi x={x} y={y} dong={dong} nhan={t('oc.congNang')}>
      {doiCan && (
        <div class="menu-o-tab" role="tablist">
          {(['cn', 'can'] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} class={tab === k ? 'chon' : ''} onClick={() => { setTab(k); setXem(null); }}>
              {t(k === 'cn' ? 'oc.tab.congNang' : 'oc.tab.doiCan')}
            </button>
          ))}
        </div>
      )}
      {tab === 'can' && doiCan ? (
        <>
          {doiCan.ds[0] && <div class="menu-o-nhom">{t(`oc.doiCan.nhom.${doiCan.ds[0].nhom}`)}</div>}
          <ul class="menu-o-ds" role="listbox" aria-label={t('oc.tab.doiCan')}>
            {doiCan.ds.map((c) => (
              <li key={c.id}>
                <button type="button" role="option" aria-selected={xem === c.id} class={c.id === goc ? 'chon' : xem === c.id ? 'xem' : ''} onClick={() => setXem(c.id)}>
                  {nhanMauCan(c)}{c.id === goc ? ' ✓' : ''}
                </button>
              </li>
            ))}
            {!doiCan.ds.length && <li class="muted menu-o-chu">{t('oc.doiCan.khong')}</li>}
          </ul>
          {canXem && (
            <XemMauCan can={canXem} kieu={doiCan.kieu} noiThat={doiCan.noiThat} guong={doiCan.guong} dangDung={canXem.id === goc} chiXem={chiXem}
              chon={() => { doiCan.doi(canXem.id); dong(); }} dong={() => setXem(null)} />
          )}
        </>
      ) : (
        <>
      <div class="menu-o-dau">{t('oc.congNang')} · {t('oc.soO').replace('{n}', String(soO))}</div>
      {CONG_NANG_O.map((cn) => (
        <button key={cn} type="button" role="menuitemradio" aria-checked={hienTai === cn} class={hienTai === cn ? 'chon' : ''} disabled={chiXem}
          onClick={() => { chon(cn); dong(); }}>
          <i class={`o-mau-cn o-mau-${cn}`} aria-hidden="true" /> {t(`oc.${cn}`)}
        </button>
      ))}
      {cungMau && <button type="button" role="menuitem" class="menu-o-cung-mau" onClick={() => { cungMau.chon(); dong(); }}>{t('oc.chonCungMau').replace('{n}', String(cungMau.n))}</button>}
      <div class="menu-o-chu">{t('oc.apCho').replace('{v}', phamVi)}</div>
        </>
      )}
    </HopNoi>
  );
}

type PropsLoi = { x: number; y: number; dong: () => void; tt: ThongTinLoi; chiXem: boolean; doi: (tt: ThongTinLoi) => void };

/** Menu lõi (L9): cửa vào trái / phải; thang bộ, thang máy, hộp kỹ thuật xuống hầm / lên mái. */
export function MenuLoi({ x, y, dong, tt, chiXem, doi }: PropsLoi) {
  const hang = (k: 'thangBo' | 'thangMay' | 'hopKT') => {
    const v: DiXuyen = tt[k];
    return (
      <div class="menu-o-hang" key={k}>
        <span>{t(`oc.loi.${k}`)}</span>
        {(['ham', 'mai'] as const).map((h) => (
          <label key={h}><input type="checkbox" disabled={chiXem} checked={v[h]} onChange={(e) => doi({ ...tt, [k]: { ...v, [h]: e.currentTarget.checked } })} />{t(`oc.loi.${h}`)}</label>
        ))}
      </div>
    );
  };
  return (
    <HopNoi x={x} y={y} dong={dong} nhan={t('oc.loi.tieuDe')}>
      <div class="menu-o-dau">{t('oc.loi.tieuDe')}</div>
      <div class="menu-o-hang" role="radiogroup" aria-label={t('oc.loi.cua')}>
        <span>{t('oc.loi.cua')}</span>
        {(['trai', 'phai'] as const).map((c) => (
          <label key={c}><input type="radio" name="cua-loi" disabled={chiXem} checked={tt.cua === c} onChange={() => doi({ ...tt, cua: c })} />{t(`oc.loi.${c}`)}</label>
        ))}
      </div>
      {hang('thangBo')}{hang('thangMay')}{hang('hopKT')}
      <div class="menu-o-chu">{t('oc.loi.ghiChu')}</div>
    </HopNoi>
  );
}
