import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t, useLang } from '../i18n/i18n';
import { useManHep } from './manHep';
import { dichNgan, nenDongNgan } from './nganKeo';
import { NutBieuTuong } from './NutBieuTuong';
import { ThanhTren, type CapDo, type CheDo, type CheDoXem, type TrangThaiLuu } from './ThanhTren';

type Props = {
  capDo: CapDo;
  trai: ComponentChildren;
  giua: ComponentChildren;
  /** Nội dung tab MÔ HÌNH (3D); không có thì dùng bản vẽ giữa. */
  moHinh?: ComponentChildren;
  /** Nội dung tab CHI PHÍ (dự toán + tài chính) và panel phải tóm tắt khi đang ở tab đó. */
  chiPhi?: ComponentChildren;
  chiPhiPhai?: ComponentChildren;
  phai: ComponentChildren;
  cheDo?: CheDo;
  onCheDo?: (x: CheDo) => void;
  trangThaiLuu?: TrangThaiLuu;
  dangXuLy?: boolean;
  duocSua?: boolean;
  onHoanTac?: () => void;
  onLamLai?: () => void;
  onXuatCad?: () => void;
  onXuatXls?: () => void | Promise<void>;
  buoc?: { ds: [string, string][]; chon: string; onChon: (k: string) => void };
  thongBao?: ComponentChildren;
  /** Chế độ xem giữa do nơi gọi giữ (vd. bấm đúp tòa trong 3D → về 2D mặt bằng tầng); thiếu thì khung tự giữ. */
  xem?: CheDoXem;
  onXem?: (x: CheDoXem) => void;
};

type Ngan = '' | 'trai' | 'phai';

/**
 * Bố cục soạn thảo: thanh trên, Nhập (trái), Bản vẽ (giữa), Số liệu (phải).
 * Màn hẹp (≤ 1024 px, `ui/manHep.ts`): bản vẽ / 3D chiếm gần trọn màn, hai panel thành ngăn kéo trượt từ đáy (một ngăn một lúc,
 * kéo tay cầm xuống để đóng), dock dưới có nút mở ngăn + hoàn tác / làm lại. Ngăn nổi đè, không đổi kích thước khung giữa.
 */
export function KhungSoan(p: Props) {
  useLang();
  const hep = useManHep();
  const [xemRieng, setXemRieng] = useState<CheDoXem>('mat_bang');
  const xem = p.xem ?? xemRieng, setXem = p.onXem ?? setXemRieng;
  const [ngan, setNgan] = useState<Ngan>('');
  const mo = hep ? ngan : '';
  const bat = (k: Ngan) => setNgan((n) => (n === k ? '' : k));
  const chiXem = p.cheDo === 'chi_xem';

  // Esc đóng ngăn; iOS Safari bỏ qua touch-action khi chụm cả trang → chặn cử chỉ phóng trang ở màn soạn (bản vẽ tự phóng).
  useEffect(() => {
    if (!hep) return;
    const phim = (e: KeyboardEvent) => { if (e.key === 'Escape') setNgan(''); };
    const chan = (e: Event) => e.preventDefault();
    addEventListener('keydown', phim);
    document.addEventListener('gesturestart', chan);
    return () => { removeEventListener('keydown', phim); document.removeEventListener('gesturestart', chan); };
  }, [hep]);

  const panel = (ben: 'trai' | 'phai', nhan: string, noiDung: ComponentChildren) => (
    <aside class={`panel-${ben}${hep ? ' ngan-keo' : ''}${mo === ben ? ' mo' : ''}`} aria-label={nhan}
      inert={hep && mo !== ben ? true : undefined} aria-hidden={hep && mo !== ben ? true : undefined}>
      {hep && <DauNgan nhan={nhan} dong={() => setNgan('')} />}
      {noiDung}
    </aside>
  );

  return (
    <div class={`khung khung-soan${hep ? ' hep' : ''}${mo ? ' co-ngan' : ''}`}>
      <ThanhTren capDo={p.capDo} cheDoXem={xem} onCheDoXem={setXem} cheDo={p.cheDo} onCheDo={p.onCheDo}
        trangThaiLuu={p.trangThaiLuu} dangXuLy={p.dangXuLy} duocSua={p.duocSua}
        onHoanTac={p.onHoanTac} onLamLai={p.onLamLai} onXuatCad={p.onXuatCad} onXuatXls={p.onXuatXls} buoc={p.buoc} />
      <div class="khung-than">
        {panel('trai', t('panel.nhap'), p.trai)}
        <main class="panel-giua" aria-label={t('panel.banVe')}>
          {xem === 'chi_phi' ? p.chiPhi ?? <p style={{ padding: '24px' }}>{t('chiPhi.dangLam')}</p> : xem === 'mo_hinh' && p.moHinh ? p.moHinh : p.giua}
          {/* Thông báo nổi trên bản vẽ, không đẩy khung làm việc. */}
          {p.thongBao && <div class="lop-thong-bao">{p.thongBao}</div>}
        </main>
        {panel('phai', t('panel.soLieu'), xem === 'chi_phi' && p.chiPhiPhai ? p.chiPhiPhai : p.phai)}
      </div>
      {hep && (
        <nav class="dock-duoi" aria-label={t('dock.nhom')}>
          <NutBieuTuong k="nganTrai" bat={mo === 'trai'} onClick={() => bat('trai')}><span>{t('dock.nhap')}</span></NutBieuTuong>
          <span class="nhom-bt">
            <NutBieuTuong k="hoanTac" tat={!p.onHoanTac || chiXem} onClick={p.onHoanTac} />
            <NutBieuTuong k="lamLai" tat={!p.onLamLai || chiXem} onClick={p.onLamLai} />
          </span>
          <NutBieuTuong k="nganPhai" bat={mo === 'phai'} onClick={() => bat('phai')}><span>{t('dock.soLieu')}</span></NutBieuTuong>
        </nav>
      )}
    </div>
  );
}

/** Đầu ngăn kéo: tay cầm (kéo xuống bám tay 1:1, nhấc tay quá ngưỡng thì đóng) + tên + nút đóng. */
function DauNgan({ nhan, dong }: { nhan: string; dong: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const keo = useRef<{ id: number; y0: number; y: number; t: number; v: number; raf: number } | null>(null);
  const ngan = () => ref.current?.parentElement as HTMLElement | null;
  const ve = () => {
    const k = keo.current, el = ngan();
    if (!k || !el) return;
    k.raf = 0;
    el.style.transform = `translateY(${dichNgan(k.y - k.y0)}px)`;
  };
  const tha = (dongLai: boolean) => {
    const k = keo.current, el = ngan();
    keo.current = null;
    if (!k || !el) return;
    cancelAnimationFrame(k.raf);
    el.classList.remove('dang-keo');
    el.style.transform = '';
    if (dongLai && nenDongNgan(k.y - k.y0, k.v, el.offsetHeight)) dong();
  };
  return (
    <div class="dau-ngan" ref={ref}
      onPointerDown={(e) => {
        if ((e.target as Element).closest('button')) return;
        try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* bỏ qua */ }
        keo.current = { id: e.pointerId, y0: e.clientY, y: e.clientY, t: e.timeStamp, v: 0, raf: 0 };
        ngan()?.classList.add('dang-keo');
      }}
      onPointerMove={(e) => {
        const k = keo.current;
        if (!k || k.id !== e.pointerId) return;
        const dt = e.timeStamp - k.t;
        if (dt > 0) k.v = (e.clientY - k.y) / dt;
        k.y = e.clientY; k.t = e.timeStamp;
        if (!k.raf) k.raf = requestAnimationFrame(ve);
      }}
      onPointerUp={() => tha(true)}
      onPointerCancel={() => tha(false)}>
      <i class="tay-cam" aria-hidden="true" />
      <b>{nhan}</b>
      <NutBieuTuong k="dongNgan" onClick={dong} />
    </div>
  );
}
