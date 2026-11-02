import { useEffect, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { api, type QuanTriApi } from '../api';
import { t, useLang } from '../i18n/i18n';
import { ChonLang, ThuongHieu } from '../ui/ThanhTren';

type TT = 'cho' | 'duyet' | 'tu_choi';

/** Trang quản trị (chỉ mail quản trị): duyệt / từ chối / thu hồi người được tạo dự án, xem ai đã tạo dự án nào. */
export function QuanTri() {
  const [lang] = useLang();
  const { route } = useLocation();
  const [ds, setDs] = useState<QuanTriApi | null>(null);
  const [loi, setLoi] = useState('');
  const [mail, setMail] = useState('');
  const nap = () => api.quanTri().then((d) => { setDs(d); setLoi(''); }, () => setLoi(t('qt.khongVao')));
  useEffect(() => { nap(); }, []);
  const datTT = async (email: string, tt: TT) => {
    try { await api.duyet(email, tt); await nap(); } catch { setLoi(t('soan.loiMang')); }
  };
  const gio = (s: string | null) => (s ? new Date(s).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-GB') : '—');
  const themMail = async (e: Event) => {
    e.preventDefault();
    if (!mail.trim()) return;
    await datTT(mail.trim(), 'duyet');
    setMail('');
  };

  return (
    <div class="khung">
      <header class="thanh-tren tren-du-an">
        <ThuongHieu anBan />
        <span class="gian" />
        <button type="button" class="nut-phu" onClick={() => route('/')}>{t('qt.ve')}</button>
        <ChonLang />
      </header>
      <main class="trang trang-du-an">
        <div class="dau-trang"><div class="dau-chu"><h1>{t('qt.tieuDe')}</h1><p>{t('qt.moTa')}</p></div></div>
        {loi && <p class="vuot" role="alert">{loi}</p>}
        {ds && (
          <>
            <section class="the-du-an qt-khoi">
              <h2>{t('qt.nguoiDung')}</h2>
              <form class="mo-link" onSubmit={themMail}>
                <input type="email" aria-label={t('qt.themMail')} placeholder={t('qt.themMail')} value={mail} onInput={(e) => setMail(e.currentTarget.value)} />
                <button type="submit" class="nut-phu">{t('qt.duyetTruoc')}</button>
              </form>
              {!ds.nguoi.length && <p class="trong">{t('qt.chuaCo')}</p>}
              {ds.nguoi.map((n) => (
                <div class={`qt-hang qt-${n.trang_thai}`} key={n.email}>
                  <span class="qt-mail">{n.email}</span>
                  <span class={`qt-nhan qt-nhan-${n.trang_thai}`}>{t(`qt.tt.${n.trang_thai}`)}</span>
                  <span class="qt-phu">{t('qt.soDuAn').replace('{n}', String(n.so_du_an))} · {gio(n.yeu_cau_luc)}</span>
                  <span class="qt-nut">
                    {n.trang_thai !== 'duyet' && <button type="button" class="nut-chinh" onClick={() => datTT(n.email, 'duyet')}>{t('qt.duyet')}</button>}
                    {n.trang_thai === 'cho' && <button type="button" class="nut-phu" onClick={() => datTT(n.email, 'tu_choi')}>{t('qt.tuChoi')}</button>}
                    {n.trang_thai === 'duyet' && <button type="button" class="nut-phu" onClick={() => confirm(t('qt.thuHoiHoi').replace('{mail}', n.email)) && datTT(n.email, 'cho')}>{t('qt.thuHoi')}</button>}
                  </span>
                </div>
              ))}
            </section>
            <section class="the-du-an qt-khoi">
              <h2>{t('qt.duAn')} · {ds.du_an.length}</h2>
              {ds.du_an.map((d) => (
                <div class="qt-hang" key={d.ma}>
                  <a class="qt-mail" href={`/du-an/${d.ma}`}>{d.ten}</a>
                  <span class="qt-phu">{d.tao_boi || t('qt.khongRo')}</span>
                  <span class="qt-phu">{t('duAn.soPANgan').replace('{n}', String(d.so_pa))} · {gio(d.tao_luc)}</span>
                </div>
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
