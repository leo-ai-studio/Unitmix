import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { t, useLang } from '../i18n/i18n';
import { ThanhTren, type CapDo, type CheDo, type CheDoXem, type TrangThaiLuu } from './ThanhTren';

type Props = {
  capDo: CapDo;
  trai: ComponentChildren;
  giua: ComponentChildren;
  /** Nội dung tab MÔ HÌNH (3D); không có thì dùng bản vẽ giữa. */
  moHinh?: ComponentChildren;
  phai: ComponentChildren;
  cheDo?: CheDo;
  onCheDo?: (x: CheDo) => void;
  trangThaiLuu?: TrangThaiLuu;
  dangXuLy?: boolean;
  duocSua?: boolean;
  onHoanTac?: () => void;
  onLamLai?: () => void;
  onXuatCad?: () => void;
  buoc?: { ds: [string, string][]; chon: string; onChon: (k: string) => void };
  thongBao?: ComponentChildren;
};

/** Bố cục soạn thảo: thanh trên, Nhập (trái), Bản vẽ (giữa), Số liệu (phải). */
export function KhungSoan(p: Props) {
  useLang();
  const [xem, setXem] = useState<CheDoXem>('mat_bang');
  return (
    <div class="khung khung-soan">
      <ThanhTren capDo={p.capDo} cheDoXem={xem} onCheDoXem={setXem} cheDo={p.cheDo} onCheDo={p.onCheDo}
        trangThaiLuu={p.trangThaiLuu} dangXuLy={p.dangXuLy} duocSua={p.duocSua}
        onHoanTac={p.onHoanTac} onLamLai={p.onLamLai} onXuatCad={p.onXuatCad} buoc={p.buoc} />
      {p.thongBao}
      <div class="khung-than">
        <aside class="panel-trai" aria-label={t('panel.nhap')}>{p.trai}</aside>
        <main class="panel-giua" aria-label={t('panel.banVe')}>
          {xem === 'chi_phi' ? <p style={{ padding: '24px' }}>{t('chiPhi.dangLam')}</p> : xem === 'mo_hinh' && p.moHinh ? p.moHinh : p.giua}
        </main>
        <aside class="panel-phai" aria-label={t('panel.soLieu')}>{p.phai}</aside>
      </div>
    </div>
  );
}
