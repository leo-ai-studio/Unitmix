import { useEffect, useState } from 'preact/hooks';
import { api, LoiApi, type DuAnApi } from '../api';
import { t, useLang } from '../i18n/i18n';
import { useKho } from '../kho/kho';
import { ghiNhoDuAn, layMaSua, nhanMaTuLink } from '../kho/maSua';
import type { TrangThaiPA } from '../tinh/kieu';
import { taoPAMoi } from '../tinh/macDinh';
import { KhungSoan } from '../ui/KhungSoan';
import { ChonLang, ThuongHieu } from '../ui/ThanhTren';
import { tinhChiTieu, type KetQuaChiTieu } from '../tinh/chiTieu';
import type { ThuVien } from '../tinh/kieu';
import { taiThuVien } from '../tinh/thuVien';
import { LoGiua, LoPhai, LoTrai } from './ManLo';

type DaTai = { da: DuAnApi; paId: string; tenPA: string; ban: TrangThaiPA; maSua: string | null; duocSua: boolean };

function ManThongBao({ chu, dangTai = false }: { chu: string; dangTai?: boolean }) {
  return (
    <div class="khung">
      <header class="thanh-tren"><ThuongHieu dangXuLy={dangTai} /><span class="gian" /><ChonLang /></header>
      <div class="giua-man" role="status">
        {dangTai && <img class="spin-o" src="/brand/leo_ai_o.png" alt="" />}
        <span>{chu}</span>
        {!dangTai && <a href="/">{t('soan.veDuAn')}</a>}
      </div>
    </div>
  );
}

/** Màn soạn thảo một dự án: tải dự án + PA, kiểm quyền sửa, rồi mở trình soạn. */
export function SoanThao({ ma }: { ma: string }) {
  useLang();
  const [kq, setKq] = useState<DaTai | 'dang_tai' | 'khong_co' | 'loi_mang'>('dang_tai');

  useEffect(() => {
    let huy = false;
    (async () => {
      try {
        nhanMaTuLink(ma);
        const maSua = layMaSua(ma);
        const [da, quyen] = await Promise.all([api.docDuAn(ma), api.kiemMa(ma, maSua)]);
        const muon = new URLSearchParams(location.search).get('pa');
        let paId = (muon && da.phuong_an.some((p) => p.id === muon) ? muon : da.phuong_an[0]?.id) ?? 'pa-1';
        let ban: TrangThaiPA;
        let tenPA = t('pa.mau');
        if (da.phuong_an.length) {
          const pa = await api.docPA(ma, paId);
          ban = pa.trang_thai as TrangThaiPA;
          tenPA = pa.ten;
        } else {
          ban = taoPAMoi();
          paId = 'pa-1';
          if (quyen.duocSua && maSua) await api.ghiPA(ma, paId, maSua, tenPA, ban, {});
        }
        ghiNhoDuAn(ma, da.ten);
        if (!huy) setKq({ da, paId, tenPA, ban, maSua, duocSua: quyen.duocSua });
      } catch (e) {
        if (!huy) setKq(e instanceof LoiApi && e.trangThai === 404 ? 'khong_co' : 'loi_mang');
      }
    })();
    return () => {
      huy = true;
    };
  }, [ma]);

  if (kq === 'dang_tai') return <ManThongBao chu={t('soan.dangTai')} dangTai />;
  if (kq === 'khong_co') return <ManThongBao chu={t('soan.khongCo')} />;
  if (kq === 'loi_mang') return <ManThongBao chu={t('soan.loiMang')} />;
  return <TrinhSoan ma={ma} {...kq} />;
}

function TrinhSoan({ ma, da, paId, tenPA, ban, maSua, duocSua }: DaTai & { ma: string }) {
  useLang();
  const kho = useKho({ ma, paId, tenPA, maSua, duocSua, ban });
  const [boQuaNhap, setBoQuaNhap] = useState(false);
  const [loId, setLoId] = useState<string | null>(null);
  const [tv, setTv] = useState<ThuVien | null>(null);
  useEffect(() => void taiThuVien().then(setTv, () => setTv(null)), []);
  const coNhap = duocSua && !boQuaNhap && kho.nhapCu !== null;
  const chiXem = kho.cheDo === 'chi_xem';
  const kq: KetQuaChiTieu | null = tv ? tinhChiTieu(kho.pa, tv) : null;
  const chung = { pa: kho.pa, sua: kho.sua, chiXem, loId, chonLo: setLoId };
  const loDangChon = kho.pa.lo.find((l) => l.id === loId) ?? kho.pa.lo[0];

  const thongBao = (
    <>
      {!duocSua && <div class="thong-bao" role="status">{t('soan.chiXem')}</div>}
      {coNhap && (
        <div class="thong-bao canh" role="status">
          {t('soan.coNhap')}
          <button type="button" onClick={() => { kho.sua(() => kho.nhapCu!.trangThai as TrangThaiPA); setBoQuaNhap(true); }}>{t('soan.khoiPhuc')}</button>
          <button type="button" onClick={() => setBoQuaNhap(true)}>{t('soan.boQua')}</button>
        </div>
      )}
    </>
  );

  return (
    <KhungSoan
      capDo={{ lo: `${da.ten} · ${tenPA}${loDangChon ? ' · ' + loDangChon.temDat.kyHieu : ''}`.toUpperCase(), coTe: 'tren' }}
      cheDo={kho.cheDo}
      onCheDo={kho.datCheDo}
      duocSua={duocSua}
      trangThaiLuu={kho.trangThaiLuu}
      onHoanTac={kho.hoanTac}
      onLamLai={kho.lamLai}
      thongBao={thongBao}
      trai={<LoTrai {...chung} />}
      giua={<LoGiua {...chung} />}
      phai={<LoPhai {...chung} kq={kq} />}
    />
  );
}
