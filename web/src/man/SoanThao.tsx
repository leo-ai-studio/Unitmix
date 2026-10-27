import { useEffect, useState } from 'preact/hooks';
import { api, LoiApi, type DuAnApi } from '../api';
import { t, useLang } from '../i18n/i18n';
import { useKho } from '../kho/kho';
import { ghiNhoDuAn, layMaSua, nhanMaTuLink } from '../kho/maSua';
import type { TrangThaiPA } from '../tinh/kieu';
import { chuanHoaPA, loDangChonHoacDatO, taoPAMoi } from '../tinh/macDinh';
import { KhungSoan } from '../ui/KhungSoan';
import { ChonLang, ThuongHieu } from '../ui/ThanhTren';
import { tinhChiTieu, type KetQuaChiTieu } from '../tinh/chiTieu';
import type { ThuVien } from '../tinh/kieu';
import { soCanChuVi, viTriCan } from '../tinh/matBang';
import { taiThuVien } from '../tinh/thuVien';
import { tomTatPA } from '../tinh/tomTat';
import { LoGiua, LoPhai, LoTrai } from './ManLo';
import { TangGiua, TangMoHinh, TangPhai, TangTrai, toaDangXem } from './ManTang';
import { XepGiua, XepPhai, XepTrai, loDangXep } from './ManXepToa';

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
          ban = chuanHoaPA(pa.trang_thai as TrangThaiPA);
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
  const [tv, setTv] = useState<ThuVien | null>(null);
  const kho = useKho({ ma, paId, tenPA, maSua, duocSua, ban, tomTat: tv ? (p) => tomTatPA(p, tv) : undefined });
  const [boQuaNhap, setBoQuaNhap] = useState(false);
  const [loId, setLoId] = useState<string | null>(null);
  useEffect(() => void taiThuVien().then(setTv, () => setTv(null)), []);
  const coNhap = duocSua && !boQuaNhap && kho.nhapCu !== null;
  const chiXem = kho.cheDo === 'chi_xem';
  const kq: KetQuaChiTieu | null = tv ? tinhChiTieu(kho.pa, tv) : null;
  const [buoc, setBuoc] = useState<'lo' | 'xep' | 'tang'>('lo');
  const [canKhoa, setCanKhoa] = useState<string | null>(null);
  const [toaId, setToaId] = useState<string | null>(null);
  const chung = { pa: kho.pa, sua: kho.sua, chiXem, loId, chonLo: setLoId };
  const chungXep = { ...chung, tv, toaId, chonToa: setToaId };
  const chungTang = { ...chungXep, canKhoa, chonCan: setCanKhoa };
  const xemTang = buoc === 'tang' ? toaDangXem(kho.pa, tv, loId, toaId) : null;
  const loDangChon = buoc === 'xep' ? loDangXep(kho.pa, loId) : buoc === 'tang' ? xemTang?.lo : loDangChonHoacDatO(kho.pa.lo, loId);
  const toaDangChon = buoc === 'xep' ? kho.pa.toa.find((x) => x.id === toaId) : xemTang?.toa;
  const chonBuoc = (
    <div class="chon-buoc">
      <div class="nhom-nut" role="group" aria-label={t('buoc.nhom')}>
        <button type="button" aria-pressed={buoc === 'lo'} onClick={() => setBuoc('lo')}>{t('buoc.lo')}</button>
        <button type="button" aria-pressed={buoc === 'xep'} onClick={() => setBuoc('xep')}>{t('buoc.xep')}</button>
        <button type="button" aria-pressed={buoc === 'tang'} onClick={() => setBuoc('tang')}>{t('buoc.tang')}</button>
      </div>
    </div>
  );

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
      capDo={{
        lo: `${da.ten} · ${tenPA}${loDangChon ? ' · ' + loDangChon.temDat.kyHieu : ''}`.toUpperCase(),
        coTe: 'tren',
        toa: toaDangChon ? tv?.toa.get(toaDangChon.mauId)?.ten_vi ?? toaDangChon.mauId : undefined,
        tang: buoc === 'tang' && toaDangChon ? t('tang.dienHinh') : undefined,
        can: buoc === 'tang' && canKhoa && xemTang ? tenCanChon(xemTang, tv, canKhoa) : undefined,
      }}
      cheDo={kho.cheDo}
      onCheDo={kho.datCheDo}
      duocSua={duocSua}
      trangThaiLuu={kho.trangThaiLuu}
      onHoanTac={kho.hoanTac}
      onLamLai={kho.lamLai}
      thongBao={thongBao}
      moHinh={<TangMoHinh {...chungTang} />}
      trai={<>{chonBuoc}{buoc === 'lo' ? <LoTrai {...chung} /> : buoc === 'xep' ? <XepTrai {...chungXep} /> : <TangTrai {...chungTang} />}</>}
      giua={buoc === 'lo' ? <LoGiua {...chung} /> : buoc === 'xep' ? <XepGiua {...chungXep} /> : <TangGiua {...chungTang} />}
      phai={buoc === 'lo' ? <LoPhai {...chung} kq={kq} /> : buoc === 'xep' ? <XepPhai {...chungXep} kq={kq} /> : <TangPhai {...chungTang} />}
    />
  );
}

/** Tên CH-xx của căn đang chọn trên tầng (cho đường dẫn trên thanh trên). */
function tenCanChon(xem: NonNullable<ReturnType<typeof toaDangXem>>, tv: ThuVien | null, khoa: string): string | undefined {
  if (!tv) return undefined;
  const so = soCanChuVi(xem.mau.duong_bao, viTriCan(xem.mau, tv)).get(khoa);
  return so ? `CH-${String(so).padStart(2, '0')}` : undefined;
}
