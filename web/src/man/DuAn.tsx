import { t, useLang } from '../i18n/i18n';
import { ChonLang, ThuongHieu } from '../ui/ThanhTren';

/** Màn 0 · Dự án của tôi (khung; nối API ở Task 5). */
export function DuAn() {
  useLang();
  return (
    <div class="khung">
      <header class="thanh-tren">
        <ThuongHieu />
        <span class="gian" />
        <ChonLang />
      </header>
      <main style={{ width: '100%', maxWidth: '1440px', margin: '0 auto', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <h1 style={{ margin: 0, textAlign: 'center', fontWeight: 300, fontSize: '40px', letterSpacing: '.06em', color: 'var(--green)' }}>
          {t('duAn.tieuDe')}
        </h1>
        <p style={{ margin: 0, textAlign: 'center', color: 'var(--muted-text)' }}>{t('duAn.moTa')}</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
          <button type="button" class="nut-chu" style={{ border: '1px solid var(--secondary)', padding: '8px 12px' }}>{t('duAn.moBangLink')}</button>
          <a href="/du-an/thu" style={{ background: 'var(--green)', color: '#fff', padding: '8px 14px', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }}>
            {t('duAn.moi')}
          </a>
        </div>
        <p style={{ color: 'var(--muted-text)' }}>{t('duAn.trong')}</p>
      </main>
      <footer class="chan-trang">{t('app.tacGia')}</footer>
    </div>
  );
}
