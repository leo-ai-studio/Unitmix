import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { t, useLang } from '../i18n/i18n';
import { ThanhTren, type CapDo, type CheDo, type CheDoXem, type TrangThaiLuu } from './ThanhTren';

type Props = {
  capDo: CapDo;
  trai: ComponentChildren;
  giua: ComponentChildren;
  phai: ComponentChildren;
  cheDo?: CheDo;
  onCheDo?: (x: CheDo) => void;
  trangThaiLuu?: TrangThaiLuu;
  dangXuLy?: boolean;
  duocSua?: boolean;
  onHoanTac?: () => void;
  onLamLai?: () => void;
  thongBao?: ComponentChildren;
};

/** Bố cục soạn thảo: thanh trên, Nhập (trái), Bản vẽ (giữa), Số liệu (phải). */
export function KhungSoan(p: Props) {
  useLang();
  const [xem, setXem] = useState<CheDoXem>('mat_bang');
  return (
    <div class="khung">
      <ThanhTren capDo={p.capDo} cheDoXem={xem} onCheDoXem={setXem} cheDo={p.cheDo} onCheDo={p.onCheDo}
        trangThaiLuu={p.trangThaiLuu} dangXuLy={p.dangXuLy} duocSua={p.duocSua}
        onHoanTac={p.onHoanTac} onLamLai={p.onLamLai} />
      {p.thongBao}
      <div class="khung-than">
        <aside class="panel-trai" aria-label={t('panel.nhap')}>{p.trai}</aside>
        <main class="panel-giua" aria-label={t('panel.banVe')}>
          {xem === 'chi_phi' ? <p style={{ padding: '24px' }}>{t('chiPhi.dangLam')}</p> : p.giua}
        </main>
        <aside class="panel-phai" aria-label={t('panel.soLieu')}>{p.phai}</aside>
      </div>
    </div>
  );
}
