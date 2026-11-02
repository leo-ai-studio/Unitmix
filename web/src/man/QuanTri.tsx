import { useEffect, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { api, type QuanTriApi } from '../api';
import { t, useLang } from '../i18n/i18n';
import { ChonLang, ThuongHieu } from '../ui/ThanhTren';
import { xacNhan } from '../ui/HopHoi';

const SO_DONG = 15;

/** Trang quản trị (chỉ mail quản trị): duyệt người được tạo dự án, xem ai tạo dự án nào, xoá / khôi phục dự án (thùng rác). */
export function QuanTri() {
  const [lang] = useLang();
  const { route } = useLocation();
  const [ds, setDs] = useState<QuanTriApi | null>(null);
  const [loi, setLoi] = useState('');
  const [mail, setMail] = useState('');
  const [hetDuAn, setHetDuAn] = useState(false);
  const nap = () => api.quanTri().then((d) => { setDs(d); setLoi(''); }, () => setLoi(t('qt.khongVao')));
  useEffect(() => { nap(); }, []);
  const lam = async (viec: () => Promise<unknown>) => {
    try { await viec(); await nap(); } catch { setLoi(t('soan.loiMang')); }
  };
  const loc = lang === 'vi' ? 'vi-VN' : 'en-GB';
  const ngay = (s: string | null) => (s ? new Date(s).toLocaleDateString(loc) : '—');
  const ngayGio = (s: string | null) => (s ? new Date(s).toLocaleString(loc, { dateStyle: 'short', timeStyle: 'short' }) : '—');
  const themMail = (e: Event) => {
    e.preventDefault();
    const m = mail.trim();
    if (m) lam(() => api.duyet(m, 'duyet')).then(() => setMail(''));
  };
  const xoaDuAn = (ma: string, ten: string) => {
    xacNhan(t('qt.xoaHoi').replace('{ten}', ten).replace('{n}', String(ds?.ngay_giu ?? 30)), { nguyHiem: true, dongY: t('qt.xoa') }).then((ok) => { if (ok) void lam(() => api.quanTriXoa(ma)); });
  };
  const duAnHien = ds ? (hetDuAn ? ds.du_an : ds.du_an.slice(0, SO_DONG)) : [];

  return (
    <div class="khung">
      <header class="thanh-tren tren-du-an">
        <ThuongHieu anBan />
        <span class="gian" />
        <button type="button" class="nut-phu" onClick={() => route('/')}>{t('qt.ve')}</button>
        <ChonLang />
      </header>
      <main class="trang trang-du-an qt-trang">
        <div class="dau-trang"><div class="dau-chu"><h1>{t('qt.tieuDe')}</h1><p>{t('qt.moTa')}</p></div></div>
        {loi && <p class="vuot" role="alert">{loi}</p>}
        {ds && (
          <>
            <section class="qt-khoi" aria-label={t('qt.nguoiDung')}>
              <div class="qt-dau">
                <h2>{t('qt.nguoiDung')} <small>{ds.nguoi.length}</small></h2>
                <form class="qt-them" onSubmit={themMail}>
                  <input type="email" aria-label={t('qt.themMail')} placeholder={t('qt.themMail')} value={mail} onInput={(e) => setMail(e.currentTarget.value)} />
                  <button type="submit" class="nut-phu" disabled={!mail.trim()}>{t('qt.duyetTruoc')}</button>
                </form>
              </div>
              {!ds.nguoi.length && <p class="qt-trong">{t('qt.chuaCo')}</p>}
              {ds.nguoi.map((n) => (
                <div class="qt-hang" key={n.email}>
                  <span class="qt-mail" title={[n.ho_ten, n.email, n.phong, n.ghi_chu].filter(Boolean).join(' · ')}>
                    {n.ho_ten ? <>{n.ho_ten} <small>{n.email}</small></> : n.email}
                    {(n.phong || n.ghi_chu) && <small class="qt-ghi">{[n.phong, n.ghi_chu].filter(Boolean).join(' · ')}</small>}
                  </span>
                  <span class={`qt-nhan qt-nhan-${n.trang_thai}`}>{t(`qt.tt.${n.trang_thai}`)}</span>
                  <span class="qt-phu">{t('qt.soDuAn').replace('{n}', String(n.so_du_an))}</span>
                  <span class="qt-phu qt-an-hep" title={ngayGio(n.yeu_cau_luc)}>{ngay(n.yeu_cau_luc)}</span>
                  <span class="qt-nut">
                    {n.trang_thai !== 'duyet' && <button type="button" class="nut-chinh" onClick={() => lam(() => api.duyet(n.email, 'duyet'))}>{t('qt.duyet')}</button>}
                    {n.trang_thai === 'cho' && <button type="button" class="nut-phu" onClick={() => lam(() => api.duyet(n.email, 'tu_choi'))}>{t('qt.tuChoi')}</button>}
                    {n.trang_thai === 'duyet' && <button type="button" class="nut-phu" onClick={() => xacNhan(t('qt.thuHoiHoi').replace('{mail}', n.email), { nguyHiem: true, dongY: t('qt.thuHoi') }).then((ok) => { if (ok) void lam(() => api.duyet(n.email, 'cho')); })}>{t('qt.thuHoi')}</button>}
                  </span>
                </div>
              ))}
            </section>

            <section class="qt-khoi" aria-label={t('qt.duAn')}>
              <div class="qt-dau"><h2>{t('qt.duAn')} <small>{ds.du_an.length}</small></h2></div>
              {duAnHien.map((d) => (
                <div class="qt-hang" key={d.ma}>
                  <a class="qt-mail" href={`/du-an/${d.ma}`} title={d.ten}>{d.ten}</a>
                  <span class="qt-phu qt-nguoi" title={d.tao_boi}>{d.tao_boi || t('qt.khongRo')}</span>
                  <span class="qt-phu">{t('duAn.soPANgan').replace('{n}', String(d.so_pa))}</span>
                  <span class="qt-phu qt-an-hep" title={ngayGio(d.tao_luc)}>{ngay(d.tao_luc)}</span>
                  <span class="qt-nut"><button type="button" class="nut-phu qt-xoa" onClick={() => xoaDuAn(d.ma, d.ten)}>{t('qt.xoa')}</button></span>
                </div>
              ))}
              {ds.du_an.length > SO_DONG && (
                <button type="button" class="qt-them-nua" onClick={() => setHetDuAn(!hetDuAn)}>
                  {hetDuAn ? t('qt.thuGon') : t('qt.xemThem').replace('{n}', String(ds.du_an.length - SO_DONG))}
                </button>
              )}
            </section>

            <details class="qt-khoi qt-rac" open={ds.thung_rac.length > 0}>
              <summary><h2>{t('qt.thungRac')} <small>{ds.thung_rac.length}</small></h2><span class="qt-phu">{t('qt.giuNgay').replace('{n}', String(ds.ngay_giu))}</span></summary>
              {!ds.thung_rac.length && <p class="qt-trong">{t('qt.racTrong')}</p>}
              {ds.thung_rac.map((d) => (
                <div class="qt-hang" key={d.ma}>
                  <span class="qt-mail" title={d.ten}>{d.ten}</span>
                  <span class="qt-phu qt-nguoi" title={d.xoa_boi}>{d.xoa_boi ? t('qt.xoaBoi').replace('{mail}', d.xoa_boi) : t('qt.xoaKhongRo')}</span>
                  <span class="qt-phu">{t('duAn.soPANgan').replace('{n}', String(d.so_pa))}</span>
                  <span class="qt-phu qt-han" title={ngayGio(d.xoa_luc)}>{t('qt.conNgay').replace('{n}', String(d.con_lai_ngay))}</span>
                  <span class="qt-nut"><button type="button" class="nut-chinh" onClick={() => lam(() => api.khoiPhuc(d.ma))}>{t('qt.khoiPhuc')}</button></span>
                </div>
              ))}
            </details>
          </>
        )}
      </main>
    </div>
  );
}
