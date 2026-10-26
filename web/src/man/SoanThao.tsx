import { useState } from 'preact/hooks';
import { t, useLang } from '../i18n/i18n';
import { KhungSoan } from '../ui/KhungSoan';
import { MucGap } from '../ui/MucGap';
import { ThanhHienThi } from '../ui/ThanhHienThi';
import type { CheDo } from '../ui/ThanhTren';
import { fmtSo } from '../ui/so';

/** Màn soạn thảo dự án (khung; nội dung các cấp làm ở Task 6–11). */
export function SoanThao({ ma }: { ma: string }) {
  useLang();
  const [cheDo, setCheDo] = useState<CheDo>('tu_dong');
  return (
    <KhungSoan
      capDo={{ lo: ma.toUpperCase(), coTe: 'tren' }}
      cheDo={cheDo}
      onCheDo={setCheDo}
      trangThaiLuu="da_luu"
      trai={<MucGap tieuDe={t('muc.chiTieuQH')} mo><div class="dong"><span>{t('ct.dtLo')}</span><b>{fmtSo(null)}</b></div></MucGap>}
      giua={
        <>
          <div style={{ flex: 1 }} />
          <ThanhHienThi nhan={t('ht.nhom')} nut={[{ khoa: 'do', nhan: t('ht.do') }, { khoa: 'kt', nhan: t('ht.kichThuoc'), bat: true }, { khoa: 'cc', nhan: t('ht.coCau'), bat: true }]} />
        </>
      }
      phai={<MucGap tieuDe={t('muc.chiTieuLo')} mo><div class="dong"><span>{t('ct.matDo')}</span><span>{fmtSo(undefined)}</span></div></MucGap>}
    />
  );
}
