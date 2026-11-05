/**
 * Khối "Mẫu tòa · lõi thang máy & lưu" ở panel phải màn Tầng: thay lõi thang máy cùng mẫu (tinh/thayLoi.ts — căn dồn khít vào lõi mới
 * như app cũ QT-71), Kiểm tra (tinh/kiemMauToa.ts), Thử phá (tinh/thuMauToa.ts — chuỗi thao tác ngẫu nhiên: thêm bớt, đảo, STRETCH,
 * thang, kéo hành lang, thay lõi) và Lưu thành mẫu tòa (kho/mauToaLuu.ts, đặt lại ở Thư viện mẫu). Chạy tự chỉnh nền như phép tay.
 */
import { useMemo, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { docMauToaLuu, ghiMauToaLuu, maMauMoi, taoMauToaLuu, themMauToaLuu } from '../kho/mauToaLuu';
import type { KetQuaKiemMau } from '../tinh/kiemMauToa';
import type { ThuVien, ToaDat, TrangThaiPA } from '../tinh/kieu';
import type { ToaMB } from '../tinh/loiThang';
import { dieuPhoiTay, phepTay } from '../tinh/tayNen';
import { dsLoiToa, loiThayDuocToa } from '../tinh/thaoTacTay';
import type { KetQuaThu } from '../tinh/thuMauToa';
import { chuViPham } from '../ui/chuKiem';
import { moThuVienMau } from '../ui/HopThuVienMau';
import { MucGap } from '../ui/MucGap';
import { datBaoStretch } from './baoStretch';
import { napLoiThayDuoc, useDuLieuDayDu } from './tuChinhTang';

type Props = { pa: TrangThaiPA; tv: ThuVien; toa: ToaDat; chiXem: boolean; sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void };
const tenLoi = (b: string) => b.replace(/^x_/, '').replace(/_tm_\d+$/, '').replace(/_/g, ' ');

export function KhoiMauToa({ tv, toa, chiXem, sua }: Props) {
  // gồm hình các khối lõi khác của thư viện (nạp khi mở khối này, kho riêng — xem napLoiThayDuoc)
  const dl = useDuLieuDayDu();
  const [kq, setKq] = useState<KetQuaKiemMau | null>(null);
  const [thu, setThu] = useState<KetQuaThu | 'dang' | null>(null);
  const [ten, setTen] = useState('');
  const [bao, setBao] = useState<string | null>(null);
  const ctx = dl ? { tv, dl } : null;
  const loi = useMemo(() => (ctx ? dsLoiToa(toa, ctx) : []), [toa, tv, dl]);
  const goc = tv.toa.get(toa.mauId) as ToaMB | undefined;
  const thayDuoc = useMemo(() => Object.fromEntries(loi.map((l) => [l.khoa, ctx ? loiThayDuocToa(toa, ctx, l.khoa) : []])), [toa, tv, dl]);
  const gocCua = (khoa: string) => goc?.mat?.[Number(khoa.split(':')[0])]?.phan_tu[Number(khoa.split(':')[1])]?.block ?? '';

  const chayPhep = (ph: ReturnType<typeof phepTay>, chuOk: string) => {
    if (!ctx || chiXem) return;
    const goc0 = toa;
    void dieuPhoiTay.chayPhep(ph, ctx).then((r) => {
      if (!r) return;
      if (!r.ok) {
        const n = r.chiTiet ? (r.lyDo === 'khong_thay_loi' ? t(`mt.ly.${r.chiTiet}`) : r.chiTiet) : '';
        datBaoStretch({ loai: 'loi', chu: t(`cc.loi.${r.lyDo}`).replace('{n}', n) });
        setBao(null);
        return;
      }
      sua((p) => ({ ...p, toa: p.toa.map((x) => (x.id === goc0.id ? r.toa : x)) }));
      setKq(null); setThu(null); setBao(chuOk);
    });
  };
  const doiLoi = (khoa: string, block: string) => {
    if (block === gocCua(khoa)) chayPhep(phepTay('huyThayLoiTay', toa, khoa), t('mt.loiDaTra'));
    else chayPhep(phepTay('thayLoiTay', toa, khoa, block), t('mt.loiDaThay').replace('{ten}', tenLoi(block)));
  };
  const kiem = async () => {
    if (!ctx) return;
    setThu(null);
    const r = await dieuPhoiTay.chay('kiemMauToa', ctx, toa);
    if (r) setKq(r);
  };
  const thuPha = async () => {
    if (!ctx) return;
    setThu('dang'); setKq(null);
    setThu(await dieuPhoiTay.chay('thuMauToa', ctx, toa, { hat: Math.floor(Math.random() * 1e6), buoc: 24, hanMs: 8000 }));
  };
  const luu = async () => {
    if (!ctx) return;
    const r = await dieuPhoiTay.chay('kiemMauToa', ctx, toa);
    if (!r) return;
    const ds = docMauToaLuu();
    const m = taoMauToaLuu(toa, ten.trim() || (goc?.ten_vi ?? toa.mauId), maMauMoi(ds), { soCan: r.soCan, dtxdM2: r.dtxdM2 });
    const moi = themMauToaLuu(ds, m);
    setBao(ghiMauToaLuu(moi) ? t('mt.luuXong').replace('{ten}', m.ten).replace('{n}', String(moi.length)) : t('mt.luuLoi'));
    setTen('');
  };

  const dsLoiHien = (v: KetQuaKiemMau['vi']) => v.slice(0, 12).map((x, i) => <li key={i} class={x.muc === 'loi' ? 'vuot' : 'canh'}>{chuViPham(x)}</li>);
  const khongDoiDuoc = (khoa: string, block: string) => (thayDuoc[khoa] ?? []).length === 0 && block === gocCua(khoa);
  return (
    <MucGap tieuDe={t('mt.tieuDe')} giaiThich={t('mt.gt')} onMo={() => napLoiThayDuoc(tv)}>
      <div class="khoi-mau-toa">
        {!ctx && <p class="dong muted">{t('mt.loiDangTai')}</p>}
        {ctx && loi.map((l) => (
          <label class="o-chon dong" key={l.khoa}>
            <span>{t('mt.loi')}{loi.length > 1 ? ` ${l.khoa}` : ''}</span>
            <select value={l.block} disabled={chiXem || khongDoiDuoc(l.khoa, l.block)} onChange={(e) => doiLoi(l.khoa, e.currentTarget.value)}>
              {[...new Set([gocCua(l.khoa), l.block, ...(thayDuoc[l.khoa] ?? [])])].map((b) => <option key={b} value={b}>{tenLoi(b)}{b === gocCua(l.khoa) ? ` · ${t('mt.loiBanVe')}` : ''}</option>)}
            </select>
          </label>
        ))}
        {ctx && loi.length > 0 && loi.every((l) => khongDoiDuoc(l.khoa, l.block)) && <p class="dong muted">{t('mt.loiKhongCo')}</p>}
        <div class="dong nhom-nut" role="group">
          <button type="button" disabled={!ctx} onClick={() => void kiem()}>{t('mt.kiem')}</button>
          <button type="button" disabled={!ctx} onClick={() => (thu === 'dang' ? dieuPhoiTay.huy() : void thuPha())}>{thu === 'dang' ? `${t('mt.thuDang')} · ${t('mt.huy')}` : t('mt.thu')}</button>
          <button type="button" class="nut-phu" onClick={() => moThuVienMau()}>{t('mt.moThuVien')}</button>
        </div>
        <div class="dong">
          <input type="text" value={ten} maxLength={60} placeholder={t('mt.tenMau')} aria-label={t('mt.tenMau')} onInput={(e) => setTen(e.currentTarget.value)} />
          <button type="button" class="nut-chinh" disabled={!ctx} onClick={() => void luu()}>{t('mt.luu')}</button>
        </div>
        {bao && <p class="dong ok" role="status">{bao}</p>}
        {kq && (
          <div class="dong" role="status">
            <b class={kq.soLoi ? 'vuot' : 'ok'}>{kq.soLoi
              ? t('mt.kiemLoi').replace('{loi}', String(kq.soLoi)).replace('{canhBao}', String(kq.soCanhBao))
              : t('mt.kiemSach').replace('{canhBao}', String(kq.soCanhBao)).replace('{soCan}', String(kq.soCan)).replace('{soThang}', String(kq.soThang)).replace('{dtxd}', String(Math.round(kq.dtxdM2)))}</b>
            <ul class="ds-kiem">{dsLoiHien(kq.vi)}</ul>
          </div>
        )}
        {thu && thu !== 'dang' && (
          <div class="dong" role="status">
            <b class={thu.soLoi ? 'vuot' : 'ok'}>{t('mt.thuXong').replace('{buoc}', String(thu.soBuoc)).replace('{nhan}', String(thu.soNhan)).replace('{tuChoi}', String(thu.soTuChoi)).replace('{loi}', String(thu.soLoi))}</b>
            <ul class="ds-kiem">{thu.loi.slice(0, 8).map((b) => <li key={b.buoc} class="vuot"><i>{t('mt.buoc').replace('{b}', String(b.buoc)).replace('{op}', b.op)}</i> — {b.vi.map(chuViPham).join(' ')}</li>)}</ul>
          </div>
        )}
      </div>
    </MucGap>
  );
}
