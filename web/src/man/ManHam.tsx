import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { diemTheoDoDai, dongRanhVe, type HamDayDu, type KetQuaHam, type KiemHam } from '../tinh/ham';
import { useRaiHam } from '../tinh/hamNen';
import { chanToa } from '../tinh/hinhHoc';
import { PHAN_HAM_MAC_DINH, type Diem, type LoaiRam, type ThongSoHam, type ThuVien, type TrangThaiPA } from '../tinh/kieu';
import { chuanHoaHam } from '../tinh/macDinh';
import { MucGap } from '../ui/MucGap';
import { GocBanVe } from '../ui/GocBanVe';
import { fmtSo } from '../ui/so';
import { BanVe, khungBao, sPoly, type DieuKhienVe } from '../ve/BanVe';
import { ChuGiaiHam, ChuGiaiT1, MatBangHam, MatBangT1 } from '../ve/MatBangHam';
import { VeRanh } from '../ve/VeRanh';
import { ChonLoCaoTang } from './ManLo';
import { loDangXep } from './ManXepToa';
import { mauToa } from '../tinh/canThem';

export type ChungHam = {
  pa: TrangThaiPA;
  sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void;
  chiXem: boolean;
  loId: string | null;
  chonLo: (id: string) => void;
  tv: ThuVien | null;
  /** Tầng hầm đang xem: 1 = B1. */
  tangHam: number;
  chonTangHam: (n: number) => void;
};

/* Ba panel cùng cần kết quả rải: rải trong Web Worker (tinh/hamNen.ts), trúng cache thì có ngay; đang rải thì giữ kết quả cũ. */
const VongRai = ({ nho }: { nho?: boolean }) => (
  <img class="spin-o" src="/brand/leo_ai_o.png" alt="" style={nho ? { width: '14px', height: '14px', verticalAlign: '-2px', marginRight: '6px' } : undefined} />
);
/** Lớp phủ "Đang rải hầm…" trên bản vẽ (không đổi kích thước khung giữa). */
const PhuDangRai = () => <div class="ham-dang-rai" role="status"><VongRai nho />{t('ham.dangRai')}</div>;

const suaHam = (sua: ChungHam['sua'], f: (h: HamDayDu) => Partial<ThongSoHam>) =>
  sua((p) => {
    const h = chuanHoaHam(p.ham);
    return { ...p, ham: { ...h, ...f(h) } };
  });

/** Ô số có chặn min / max (min theo quy chuẩn ghi trong `goiY`). `choTrong`: để trống = tự tính (null). */
function ONhap({ nhan, gt, donVi, onDoi, tat, buoc = 0.1, min = 0, max, goiY, choTrong = false }: {
  nhan: string; gt: number | null; donVi?: string; onDoi: (v: number | null) => void; tat: boolean;
  buoc?: number; min?: number; max?: number; goiY?: string; choTrong?: boolean;
}) {
  return (
    <label class="o-so" title={goiY}>
      <span>{nhan}</span>
      <span class="o-so-nhap">
        <input type="number" value={gt ?? ''} step={buoc} min={min} max={max} disabled={tat} placeholder={choTrong ? t('ham.tu') : undefined}
          onChange={(e) => {
            const raw = e.currentTarget.value;
            if (raw === '' && choTrong) return onDoi(null);
            const v = Number(raw);
            if (raw === '' || !Number.isFinite(v)) { e.currentTarget.value = gt === null ? '' : String(gt); return; }
            const kep = Math.max(min, max === undefined ? v : Math.min(max, v));
            if (kep !== v) e.currentTarget.value = String(kep);
            onDoi(kep);
          }} />
        {donVi && <small>{donVi}</small>}
      </span>
    </label>
  );
}

function OTich({ nhan, bat, onDoi, tat, goiY }: { nhan: string; bat: boolean; onDoi: (v: boolean) => void; tat: boolean; goiY?: string }) {
  return (
    <label class="o-tich" title={goiY}>
      <input type="checkbox" checked={bat} disabled={tat} onChange={(e) => onDoi(e.currentTarget.checked)} />
      <span>{nhan}</span>
    </label>
  );
}

/** Panel trái màn Hầm: lô, số tầng, ranh (lùi), chỗ đỗ, xe máy / kho / kỹ thuật, ram, khu xe điện (dự thảo). */
export function HamTrai({ pa, sua, chiXem, loId, chonLo, tv, tangHam, chonTangHam }: ChungHam) {
  const lo = loDangXep(pa, loId);
  const h = chuanHoaHam(pa.ham);
  const kq = useRaiHam('ham.trai', pa, tv, lo).kq ?? null;
  const tat = chiXem;
  const so = (k: keyof ThongSoHam) => (v: number | null) => suaHam(sua, () => ({ [k]: v }));
  const ram = (k: keyof HamDayDu['ram']) => (v: unknown) => suaHam(sua, (x) => ({ ram: { ...x.ram, [k]: v } }));
  const xd = (k: keyof HamDayDu['xeDien']) => (v: unknown) => suaHam(sua, (x) => ({ xeDien: { ...x.xeDien, [k]: v } }));
  /** Sửa toạ độ ram khi đang tự đặt: lấy vị trí đang tự đặt làm gốc rồi đổi một trường. */
  const ramViTri = (k: 'x' | 'y' | 'gocDo') => (v: number | null) =>
    suaHam(sua, (x) => ({ ram: { ...x.ram, x: x.ram.x ?? kq?.ram?.x ?? 0, y: x.ram.y ?? kq?.ram?.y ?? 0, gocDo: x.ram.gocDo ?? kq?.ram?.gocDo ?? 0, [k]: v ?? 0 } }));
  const QC13 = 'QCVN 13:2018/BXD';
  const D0711 = 'QCVN 07-11:2025/BXD (dự thảo)';
  const DT = t('ham.duThaoCanCu');

  return (
    <>
      <ChonLoCaoTang pa={pa} loId={lo?.id ?? null} chonLo={chonLo} />
      {lo && !pa.toa.some((x) => x.loId === lo.id) && <p class="ham-ghi-chu">{t('ham.chuaCoToa')}</p>}

      <MucGap tieuDe={t('ham.mucTang')} mo>
        <ONhap nhan={t('ham.soTang')} gt={h.soTang} buoc={1} min={1} max={6} tat={tat} onDoi={(v) => { so('soTang')(Math.round(v ?? 1)); if (tangHam > (v ?? 1)) chonTangHam(Math.round(v ?? 1)); }} />
        <ONhap nhan={t('ham.caoTang')} gt={h.caoTang} donVi="m" buoc={0.05} min={2} tat={tat} onDoi={so('caoTang')} />
        <ONhap nhan={t('ham.dayKetCau')} gt={h.dayKetCau} donVi="m" buoc={0.05} tat={tat} onDoi={so('dayKetCau')} />
        <div class="dong"><span>{t('ham.thongThuy')}</span><b class={h.caoTang - h.dayKetCau < 2 ? 'vuot' : 'ok'}>{fmtSo(h.caoTang - h.dayKetCau, { thapPhan: 2, donVi: 'm' })}</b></div>
      </MucGap>

      <MucGap tieuDe={t('ham.mucRanh')} giaiThich={t('ham.ranhGiaiThich')} mo>
        <ONhap nhan={t(lo?.chiGioi ? 'ham.luiChiGioi' : 'ham.luiRanh')} gt={h.lui} donVi="m" buoc={0.5} tat={tat || !!h.ranh} onDoi={so('lui')} />
        <p class="ham-ghi-chu">{h.ranh ? t('ham.ranhCoDinh') : t('ham.ranhTheoLo')} · {fmtSo(kq?.tang[0]?.dtSan ?? null, { donVi: 'm²' })}</p>
        <div class="dong" style={{ justifyContent: 'flex-start', gap: '6px' }}>
          {h.ranh
            ? <button type="button" class="nut-phu" disabled={tat} onClick={() => suaHam(sua, () => ({ ranh: null }))}>{t('ham.ranhBoCoDinh')}</button>
            : <button type="button" class="nut-phu" disabled={tat || !kq} title={t('ham.ranhCoDinhGiaiThich')} onClick={() => kq && suaHam(sua, () => ({ ranh: kq.ranh.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]) }))}>{t('ham.ranhCoDinhNut')}</button>}
        </div>
      </MucGap>

      <MucGap tieuDe={t('ham.mucCho')} mo>
        <ONhap nhan={t('ham.choDai')} gt={h.choDai} donVi="m" buoc={0.1} min={5} goiY={`${QC13} 2.2.1.25: ≥ 5 m`} tat={tat} onDoi={so('choDai')} />
        <ONhap nhan={t('ham.choRong')} gt={h.choRong} donVi="m" buoc={0.1} min={2.3} goiY={`${QC13} 2.2.1.25: ≥ 2,3 m`} tat={tat} onDoi={so('choRong')} />
        <ONhap nhan={t('ham.rongLan')} gt={h.rongLan} donVi="m" buoc={0.1} min={1} tat={tat} onDoi={so('rongLan')} />
        <OTich nhan={t('ham.xeLanTuDong')} bat={h.xeLanTuDong} goiY="QCVN 10:2024/BXD 2.1.1, Bảng 1" tat={tat} onDoi={(v) => suaHam(sua, () => ({ xeLanTuDong: v }))} />
        {!h.xeLanTuDong && <ONhap nhan={t('ham.choXeLan')} gt={h.choXeLan} buoc={1} goiY={`QCVN 04:2021/BXD 2.2.17.3; ${QC13} 2.2.1.25: 3,5 m`} tat={tat} onDoi={(v) => so('choXeLan')(Math.round(v ?? 0))} />}
        <ONhap nhan={t('ham.nhip')} gt={h.nhip} donVi="m" buoc={0.1} min={3} tat={tat} onDoi={so('nhip')} />
        <ONhap nhan={t('ham.cotRong')} gt={h.cotRong} donVi="m" buoc={0.05} tat={tat} onDoi={so('cotRong')} />
        <OTich nhan={t('ham.garaCoKhi')} bat={h.garaCoKhi} goiY="QCVN 04:2021/BXD 2.2.17.1 d)" tat={tat} onDoi={(v) => suaHam(sua, () => ({ garaCoKhi: v }))} />
      </MucGap>

      <MucGap tieuDe={t('ham.mucXeMayKho')}>
        <ONhap nhan={t('ham.tangXeMay')} gt={h.tangXeMay} buoc={1} min={1} max={h.soTang} tat={tat} onDoi={(v) => so('tangXeMay')(Math.round(v ?? 1))} />
        <ONhap nhan={t('ham.dtXeMay')} gt={h.dtXeMay ?? null} donVi="m²" buoc={10} choTrong goiY={t('ham.dtXeMayGoiY')} tat={tat} onDoi={so('dtXeMay')} />
        <ONhap nhan={t('ham.xeMayRong')} gt={h.xeMayRong} donVi="m" buoc={0.05} min={0.75} goiY={`${D0711} 2.4.2.2: ≥ 0,75 m`} tat={tat} onDoi={so('xeMayRong')} />
        <ONhap nhan={t('ham.xeMayDai')} gt={h.xeMayDai} donVi="m" buoc={0.1} min={2} goiY={`${D0711} 2.4.2.2: ≥ 2,0 m`} tat={tat} onDoi={so('xeMayDai')} />
        <ONhap nhan={t('ham.xeMayLan')} gt={h.xeMayLan} donVi="m" buoc={0.1} min={1.5} goiY={`${D0711} 2.4.3.4: một chiều ≥ 1,5 m`} tat={tat} onDoi={so('xeMayLan')} />
        <ONhap nhan={t('ham.khoMoiTang')} gt={h.khoMoiTang} buoc={1} tat={tat} onDoi={(v) => so('khoMoiTang')(Math.round(v ?? 0))} />
        <ONhap nhan={t('ham.dtKho')} gt={h.dtKho} donVi="m²" buoc={0.5} min={1} tat={tat} onDoi={so('dtKho')} />
        <ONhap nhan={t('ham.rongKho')} gt={h.rongKho} donVi="m" buoc={0.1} min={1} tat={tat} onDoi={so('rongKho')} />
        <ONhap nhan={t('ham.lanKho')} gt={h.lanKho} donVi="m" buoc={0.1} tat={tat} onDoi={so('lanKho')} />
        {!h.tuDongPhong && <ONhap nhan={t('ham.tyLeKyThuat')} gt={Math.round(h.tyLeKyThuat * 1000) / 10} donVi="%" buoc={1} max={50} tat={tat} onDoi={(v) => so('tyLeKyThuat')((v ?? 0) / 100)} />}
      </MucGap>

      <MucGap tieuDe={t('ham.mucPhongNhap')} giaiThich={t('ham.phongGiaiThich')}>
        <OTich nhan={t('ham.tuDongPhong')} bat={h.tuDongPhong} tat={tat} onDoi={(v) => suaHam(sua, () => ({ tuDongPhong: v }))} />
        {h.tuDongPhong && (
          <>
            <ONhap nhan={t('ham.qSinhHoat')} gt={h.qSinhHoat} donVi="L/ng.ngđ" buoc={10} min={80} goiY="QCVN 01:2021/BXD 2.10.2: ≥ 80 L/người/ngày đêm" tat={tat} onDoi={so('qSinhHoat')} />
            <ONhap nhan={t('ham.ngayDuTru')} gt={h.ngayDuTru} donVi="ngày" buoc={0.5} min={0.5} goiY={t('ham.tam')} tat={tat} onDoi={so('ngayDuTru')} />
            <ONhap nhan={t('ham.kvaMoiCan')} gt={h.kvaMoiCan} donVi="kVA" buoc={0.5} min={0} goiY={t('ham.tam')} tat={tat} onDoi={so('kvaMoiCan')} />
          </>
        )}
      </MucGap>

      <MucGap tieuDe={t('ham.mucKhoangNhap')} giaiThich={t('ham.khoangGiaiThich')}>
        <ONhap nhan={t('ham.dtKhoangMax')} gt={h.dtKhoangMax} donVi="m²" buoc={100} min={300} goiY={`${QC13} 2.2.2 a), Bảng 4: bậc I, S0 ≤ 3 000 m²`} tat={tat} onDoi={so('dtKhoangMax')} />
        <ONhap nhan={t('ham.cuLyThoat')} gt={h.cuLyThoat} donVi="m" buoc={1} min={10} goiY={`${QC13} Bảng 3: ngầm 40 m (giữa hai lối ra), 20 m (cụt)`} tat={tat} onDoi={so('cuLyThoat')} />
        <ONhap nhan={t('ham.thangRong')} gt={h.thangRong} donVi="m" buoc={0.1} min={2.4} goiY={`${QC13} 2.2.1.14: thang ≥ 1 m mỗi vế; ${t('ham.tam')}`} tat={tat} onDoi={so('thangRong')} />
        <ONhap nhan={t('ham.thangDai')} gt={h.thangDai} donVi="m" buoc={0.1} min={4} goiY={t('ham.tam')} tat={tat} onDoi={so('thangDai')} />
      </MucGap>

      <MucGap tieuDe={t('ham.mucRam')}>
        <label class="o-chon" title={`${QC13} 2.2.1.28 a)`}><span>{t('ham.loaiRam')}</span>
          <select value={h.ram.loai} disabled={tat} onChange={(e) => ram('loai')(e.currentTarget.value as LoaiRam)}>
            {(['thang_mai', 'cong', 'ho'] as const).map((k) => <option value={k}>{t(`ham.ram_${k}`)}</option>)}
          </select>
        </label>
        <ONhap nhan={t('ham.ramDai')} gt={h.ram.dai} donVi="m" buoc={0.5} min={1} tat={tat} onDoi={(v) => ram('dai')(v)} />
        <ONhap nhan={t('ham.ramRong')} gt={h.ram.rong} donVi="m" buoc={0.1} min={2} tat={tat} onDoi={(v) => ram('rong')(v)} />
        <ONhap nhan={t('ham.ramChuyen')} gt={h.ram.doanChuyen ?? 0} donVi="m" buoc={0.1} goiY={`${D0711} 2.4.3.8.3: đổi dốc ≤ 12,5%`} tat={tat} onDoi={(v) => ram('doanChuyen')(v ?? 0)} />
        <ONhap nhan={t('ham.ramThangDuoi')} gt={h.ram.doanThangDuoi ?? 0} donVi="m" buoc={0.5} goiY={t('ham.tam')} tat={tat} onDoi={(v) => ram('doanThangDuoi')(v ?? 0)} />
        <ONhap nhan={t('ham.ramThangTren')} gt={h.ram.doanThangTren ?? 0} donVi="m" buoc={0.5} goiY={t('ham.tam')} tat={tat} onDoi={(v) => ram('doanThangTren')(v ?? 0)} />
        {h.ram.loai === 'cong' && <ONhap nhan={t('ham.ramBanKinh')} gt={h.ram.banKinh ?? 6} donVi="m" buoc={0.5} min={1} goiY={`${D0711} 2.4.7.4.3: ≥ 6 m`} tat={tat} onDoi={(v) => ram('banKinh')(v ?? 6)} />}
        <ONhap nhan={t('ham.ramDocNgang')} gt={h.ram.docNgang} donVi="%" buoc={0.5} goiY={`${QC13} 2.2.1.28 b): ≤ 6%`} tat={tat} onDoi={(v) => ram('docNgang')(v)} />
        <OTich nhan={t('ham.ramNguoiDi')} bat={h.ram.coNguoiDi} goiY={`${QC13} 2.2.1.28 c)`} tat={tat} onDoi={(v) => ram('coNguoiDi')(v)} />
        {h.ram.coNguoiDi && <ONhap nhan={t('ham.ramViaHe')} gt={h.ram.viaHe} donVi="m" buoc={0.1} goiY={`${QC13} 2.2.1.28 c): ≥ 0,8 m`} tat={tat} onDoi={(v) => ram('viaHe')(v)} />}
        <ONhap nhan={t('ham.ramX')} gt={h.ram.x ?? kq?.ram?.x ?? null} donVi="m" buoc={0.5} min={-1e6} tat={tat} onDoi={ramViTri('x')} />
        <ONhap nhan={t('ham.ramY')} gt={h.ram.y ?? kq?.ram?.y ?? null} donVi="m" buoc={0.5} min={-1e6} tat={tat} onDoi={ramViTri('y')} />
        <ONhap nhan={t('ham.ramGoc')} gt={h.ram.gocDo ?? kq?.ram?.gocDo ?? null} donVi="°" buoc={5} min={-360} max={360} tat={tat} onDoi={ramViTri('gocDo')} />
        <p class="ham-ghi-chu">{h.ram.x === null ? t('ham.ramTuDat') : t('ham.ramDaNhap')}</p>
        {h.ram.x !== null && (
          <div class="dong" style={{ justifyContent: 'flex-start' }}>
            <button type="button" class="nut-phu" disabled={tat} onClick={() => suaHam(sua, (x) => ({ ram: { ...x.ram, x: null, y: null, gocDo: null } }))}>{t('ham.ramTuDatNut')}</button>
          </div>
        )}
      </MucGap>

      <MucGap tieuDe={t('ham.mucXeDien')} giaiThich={t('ham.xeDienGiaiThich')}>
        <OTich nhan={t('ham.xeDienBat')} bat={h.xeDien.bat} tat={tat} onDoi={(v) => xd('bat')(v)} />
        <p class="ham-ghi-chu">{t('ham.xeDienGiaiThich')}</p>
        {h.xeDien.bat && (
          <>
            <ONhap nhan={t('ham.xdTang')} gt={h.xeDien.tang} buoc={1} min={1} max={h.soTang} tat={tat} onDoi={(v) => xd('tang')(Math.round(v ?? 1))} />
            <ONhap nhan={t('ham.xdChoOto')} gt={h.xeDien.choOto} buoc={1} tat={tat} onDoi={(v) => xd('choOto')(Math.round(v ?? 0))} />
            <ONhap nhan={t('ham.xdTyLe')} gt={h.xeDien.tyLeOto ?? 10} donVi="%" buoc={1} max={100} goiY={`${D0711} 2.3.5: ≥ 10%`} tat={tat} onDoi={(v) => xd('tyLeOto')(v ?? 10)} />
            <ONhap nhan={t('ham.xdVungOto')} gt={h.xeDien.vungOto} buoc={1} min={1} goiY={`${DT} 2.10.2.1 b): ≤ 25`} tat={tat} onDoi={(v) => xd('vungOto')(Math.round(v ?? 1))} />
            <ONhap nhan={t('ham.xdChoXeMay')} gt={h.xeDien.choXeMay} buoc={1} tat={tat} onDoi={(v) => xd('choXeMay')(Math.round(v ?? 0))} />
            <ONhap nhan={t('ham.xdVungXeMay')} gt={h.xeDien.vungXeMay} buoc={1} min={1} goiY={`${DT} 2.10.2.1 b): ≤ 50`} tat={tat} onDoi={(v) => xd('vungXeMay')(Math.round(v ?? 1))} />
            <ONhap nhan={t('ham.xdDtXeMay')} gt={h.xeDien.dtXeMayMoiCho} donVi="m²" buoc={0.1} tat={tat} onDoi={(v) => xd('dtXeMayMoiCho')(v)} />
            <ONhap nhan={t('ham.xdKhoangCach')} gt={h.xeDien.khoangCach} donVi="m" buoc={0.5} goiY={`${DT} 2.10.1.1 b): ≥ 2 m`} tat={tat} onDoi={(v) => xd('khoangCach')(v)} />
            <OTich nhan={t('ham.xdTuong')} bat={h.xeDien.tuongNgan} tat={tat} onDoi={(v) => xd('tuongNgan')(v)} />
            <ONhap nhan={t('ham.xdDoiPin')} gt={h.xeDien.tuDoiPinTang} buoc={1} min={1} max={h.soTang} choTrong goiY={`${DT} 2.11.1 b)`} tat={tat} onDoi={(v) => xd('tuDoiPinTang')(v === null ? null : Math.round(v))} />
          </>
        )}
      </MucGap>
    </>
  );
}

/** Bản vẽ màn Hầm: ranh lô, chân tòa (nét đứt), mặt bằng tầng hầm đang chọn; chọn tầng và công cụ Vẽ ranh ở lớp phủ trên. */
export function HamGiua({ pa, sua, chiXem, loId, tv, tangHam, chonTangHam }: ChungHam) {
  const [dk, setDk] = useState<DieuKhienVe | null>(null);
  const [ve, setVe] = useState(false);
  const [pts, setPts] = useState<Diem[]>([]);
  const [con, setCon] = useState<Diem | null>(null);
  const [bao, setBao] = useState('');
  const [doDai, setDoDai] = useState('');
  /** Xem mặt bằng tầng 1 (cốt 0) trên hầm thay cho tầng hầm. */
  const [xemT1, setXemT1] = useState(false);
  const lo = loDangXep(pa, loId);
  const { kq, dangCho } = useRaiHam('ham.giua', pa, tv, lo);
  const huyVe = () => { setVe(false); setPts([]); setCon(null); setBao(''); setDoDai(''); };
  const dongVe = (ds: Diem[]) => {
    const r = dongRanhVe(ds);
    if (!r) { setBao(t('ham.ve.khongHopLe')); return; }
    suaHam(sua, () => ({ ranh: r.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000] as Diem) }));
    huyVe();
  };
  const lui = () => { setPts(pts.slice(0, -1)); setBao(''); };
  useEffect(() => { huyVe(); }, [lo?.id]);
  useEffect(() => {
    if (!ve) return;
    const phim = (e: KeyboardEvent) => {
      const trongO = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement;
      if (e.key === 'Escape') huyVe();
      else if (trongO) return;
      else if (e.key === 'Enter') dongVe(pts);
      else if (e.key === 'Backspace') { e.preventDefault(); lui(); }
    };
    window.addEventListener('keydown', phim);
    return () => window.removeEventListener('keydown', phim);
  }, [ve, pts]);
  if (!lo) return <div class="giua-man"><span>{t('xep.chuaCoLo')}</span></div>;
  if (kq === undefined) return <div class="giua-man"><VongRai /><span>{t('ham.dangRai')}</span></div>;
  if (!kq) return <div class="giua-man"><span>{t('ham.ranhRong')}</span>{dangCho && <PhuDangRai />}</div>;
  const tang = kq.tang[Math.min(Math.max(1, tangHam), kq.tang.length) - 1];
  const h = chuanHoaHam(pa.ham);
  const khung = khungBao([lo.ranh, kq.ranh]);
  const coChu = Math.max(1, khung ? (khung[2] - khung[0]) / 70 : 2);
  const chan = tv ? pa.toa.filter((x) => x.loId === lo.id && tv.toa.has(x.mauId)).map((x) => chanToa(mauToa(tv, x)!, x)) : [];
  const nut: Diem[] = [...lo.ranh, ...(lo.chiGioi ?? [])];
  const datDoDai = () => {
    const v = Number(doDai.replace(',', '.')), a = pts[pts.length - 1];
    if (!a || !con || !(v > 0)) return;
    const p = diemTheoDoDai(a, con, v);
    if (p) { setPts([...pts, p]); setDoDai(''); setBao(''); }
  };
  return (
    <>
      <BanVe khung={khung} nhan={t('ham.banVe')} onDieuKhien={setDk}>
        {xemT1 && kq.t1 ? <MatBangT1 kq={kq} lo={lo} coChu={coChu} /> : (
          <>
            <g class="ham-ve"><polygon class="ranh-lo" points={sPoly(lo.ranh)} vector-effect="non-scaling-stroke" /></g>
            <MatBangHam kq={kq} tang={tang} coChu={coChu} />
            <g class="ham-ve">{chan.map((p, i) => <polygon key={i} class="chan-toa" points={sPoly(p)} vector-effect="non-scaling-stroke" />)}</g>
          </>
        )}
        <VeRanh dangVe={ve} pts={pts} con={con} nut={nut} ranh={h.ranh} coChu={coChu} chiXem={chiXem}
          onCon={setCon} onBam={(p) => {
            if (pts.length >= 3 && p[0] === pts[0][0] && p[1] === pts[0][1]) dongVe(pts);
            else { setPts([...pts, p]); setBao(''); }
          }}
          onSuaRanh={(r) => suaHam(sua, () => ({ ranh: r }))} />
      </BanVe>
      <div class="noi-tren">
        <nav class="ham-tang" aria-label={t('ham.chonTang')}>
          <button type="button" aria-pressed={xemT1} title={t('ham.t1.nutGoiY')} onClick={() => { setXemT1(true); huyVe(); }}>{t('ham.t1.nut')}</button>
          <span class="sep" aria-hidden="true" />
          {kq.tang.map((x) => (
            <button type="button" key={x.tang} aria-pressed={!xemT1 && x.tang === tang.tang} onClick={() => { setXemT1(false); chonTangHam(x.tang); }}>{`B${x.tang}`}</button>
          ))}
          {!chiXem && !xemT1 && <button type="button" class="nut-ve-ranh" aria-pressed={ve} onClick={() => (ve ? huyVe() : setVe(true))}>{t('ham.ve.nut')}</button>}
        </nav>
        {ve && (
          <div class="ham-ve-thanh" role="group" aria-label={t('ham.ve.nut')}>
            <span class="ham-ve-ghi">{t('ham.ve.huongDan')}</span>
            <label title={t('ham.ve.doDaiGoiY')}>
              <span>{t('ham.ve.doDai')}</span>
              <input type="number" min="0" step="0.1" value={doDai} disabled={!pts.length}
                onInput={(e) => setDoDai(e.currentTarget.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); datDoDai(); } }} />
            </label>
            <button type="button" disabled={!pts.length} onClick={lui}>{t('ham.ve.lui')}</button>
            <button type="button" class="nut-chinh" disabled={pts.length < 3} onClick={() => dongVe(pts)}>{t('ham.ve.dong')}</button>
            <button type="button" onClick={huyVe}>{t('ham.ve.huy')}</button>
            {bao && <span class="vuot" role="alert">{bao}</span>}
          </div>
        )}
        {!ve && !chiXem && h.ranh && <p class="ham-ve-ghi">{t('ham.ve.keoDinh')}</p>}
      </div>
      {dangCho && <PhuDangRai />}
      <GocBanVe zoom={dk ? { phong: () => dk.phong(), thu: () => dk.thu(), vua: () => dk.vuaKhung() } : null} chuGiai={xemT1 ? <ChuGiaiT1 /> : <ChuGiaiHam coSac={tang.vungSac.length > 0} />} />
    </>
  );
}

const lop = (k: KiemHam) => (k.dat === null || k.mucTieu === null ? '' : k.muc === 'vuot' ? 'vuot' : k.muc === 'canh_bao' ? 'canh-bao' : 'ok');

function DongKiem({ k }: { k: KiemHam }) {
  const dv = { thapPhan: k.thapPhan, donVi: k.donVi || undefined };
  const dat = k.khoa === 'xdKhoangCach' && k.dat === null ? t('ham.coTuong') : fmtSo(k.dat, dv);
  const canCu = k.canCu === 'QH' ? t('ham.canCuQH') : k.canCu === 'QHXM' ? t('ham.canCuQHXM') : k.canCu;
  return (
    <div class="ham-kiem" title={canCu}>
      <span>
        {t(`ham.k.${k.khoa}`)}
        {k.duThao && <i class="nhan-du-thao">{t('ham.duThao')}</i>}
      </span>
      <span class={lop(k)}>{dat}</span>
      <span>{k.mucTieu === null ? '—' : `${k.chieu === '<=' ? '≤' : '≥'} ${fmtSo(k.mucTieu, dv)}`}</span>
    </div>
  );
}

/** Chương trình phòng kỹ thuật: gộp theo loại, DT sửa được (ghi đè), bỏ tích = không bố trí. */
function BangPhong({ kq, sua, chiXem }: { kq: KetQuaHam; sua: ChungHam['sua']; chiXem: boolean }) {
  if (!kq.ts.tuDongPhong) return null;
  const ghiDe = kq.ts.phong ?? {};
  const dat = new Map<string, number>();
  for (const x of kq.tang) for (const p of x.phong ?? []) dat.set(p.ma, (dat.get(p.ma) ?? 0) + p.dt);
  const nhom = new Map<string, { loai: string; dt: number; so: number; tang: Set<number>; daDat: number; tam: boolean; canCu: string; dienGiai: string }>();
  for (const m of kq.phongCT ?? []) {
    const g = nhom.get(m.loai) ?? { loai: m.loai, dt: m.dt, so: 0, tang: new Set<number>(), daDat: 0, tam: m.tam, canCu: m.canCu, dienGiai: m.dienGiai };
    g.so++; g.tang.add(m.tang); g.daDat += dat.get(m.ma) ?? 0;
    nhom.set(m.loai, g);
  }
  // loại đang bỏ vẫn hiện để tích lại
  for (const [loai, v] of Object.entries(ghiDe)) if (v?.bo && !nhom.has(loai)) nhom.set(loai, { loai, dt: 0, so: 0, tang: new Set(), daDat: 0, tam: true, canCu: '', dienGiai: '' });
  const doi = (loai: string, f: (x: { dt?: number | null; bo?: boolean }) => { dt?: number | null; bo?: boolean }) =>
    sua((p) => { const h = chuanHoaHam(p.ham); return { ...p, ham: { ...h, phong: { ...h.phong, [loai]: f(h.phong?.[loai] ?? {}) } } }; });
  const sl = kq.soLieuPhong;
  const m2 = { donVi: 'm²' };
  return (
    <MucGap tieuDe={t('ham.mucPhong')} giaiThich={t('ham.phongGiaiThich')} mo>
      <div class="ham-phong-dong dau"><span>{t('ham.phongTen')}</span><span>{t('ham.tang')}</span><span>{t('ham.phongDt')}</span><span>{t('ham.phongCo')}</span></div>
      {[...nhom.values()].map((g) => {
        const bo = !!ghiDe[g.loai]?.bo;
        return (
          <div class="ham-phong-dong" key={g.loai} title={`${g.canCu}
${g.dienGiai}`}>
            <span>{t(`ham.phong.${g.loai}`)}{g.so > 1 ? ` ×${g.so}` : ''}{g.tam && <i class="nhan-tam">{t('ham.tam')}</i>}<small>{g.so ? `${t('ham.phongCo')} ${fmtSo(g.daDat, m2)}` : ''}</small></span>
            <span>{[...g.tang].sort().map((x) => `B${x}`).join(', ') || '—'}</span>
            <input type="number" min={0} step={1} disabled={chiXem || bo} value={ghiDe[g.loai]?.dt ?? ''} placeholder={fmtSo(g.dt, { thapPhan: 0 })}
              aria-label={`${t(`ham.phong.${g.loai}`)} m²`}
              onChange={(e) => { const raw = e.currentTarget.value; const v = Number(raw); doi(g.loai, (x) => ({ ...x, dt: raw === '' || !(v > 0) ? null : v })); }} />
            <input type="checkbox" checked={!bo} disabled={chiXem} aria-label={t('ham.phongCo')} onChange={(e) => { const c = e.currentTarget.checked; doi(g.loai, (x) => ({ ...x, bo: !c })); }} />
          </div>
        );
      })}
      {sl && <p class="ham-ghi-chu">{t('ham.soLieuNuoc').replace('{q}', fmtSo(sl.qSH, { thapPhan: 0 })).replace('{v}', fmtSo(sl.vBeSH, { thapPhan: 0 })).replace('{p}', fmtSo(sl.vBePCCC, { thapPhan: 0 })).replace('{n}', fmtSo(sl.qNgoai)).replace('{k}', fmtSo(sl.kva, { thapPhan: 0 })).replace('{t}', fmtSo(sl.soTram))}</p>}
    </MucGap>
  );
}

/** Khoang cháy: DT, lối ra, cự ly lớn nhất, hộp gió + louver từng khoang; thang lõi / thang thêm / rèm. */
function BangKhoang({ kq }: { kq: KetQuaHam }) {
  if (!kq.khoang?.length) return null;
  const m2 = { donVi: 'm²' };
  const thangThem = kq.thang.filter((x) => x.nguon === 'them');
  const rem = kq.tang.reduce((a, x) => a + (x.remChay?.length ?? 0), 0);
  const cot = { gridTemplateColumns: '0.5fr 1fr 0.6fr 0.8fr' };
  return (
    <MucGap tieuDe={t('ham.mucKhoang')} giaiThich={t('ham.khoangGiaiThich')} mo>
      <div class="ham-kiem dau" style={cot}><span>{t('ham.khoangCot')}</span><span>{t('ham.khoangDt')}</span><span>{t('ham.khoangRa')}</span><span>{t('ham.khoangCuLy')}</span></div>
      {kq.khoang.map((k) => (
        <div class="ham-kiem" style={cot} key={k.so}>
          <span>{k.so + 1}</span>
          <span class={k.dt > kq.ts.dtKhoangMax ? 'vuot' : ''}>{fmtSo(k.dt, m2)}</span>
          <span class={k.thang.length < 2 ? 'vuot' : ''}>{fmtSo(k.thang.length)}</span>
          <span class={!Number.isFinite(k.cuLyMax) || k.cuLyMax > kq.ts.cuLyThoat ? 'vuot' : ''}>{Number.isFinite(k.cuLyMax) ? fmtSo(k.cuLyMax, { thapPhan: 1, donVi: 'm' }) : '—'}</span>
        </div>
      ))}
      <div class="ham-kiem dau" style={{ gridTemplateColumns: '0.5fr 2.4fr' }}><span>{t('ham.khoangCot')}</span><span>{t('ham.khoangGio')}</span></div>
      {kq.thongGio.map((g) => (
        <div class="ham-kiem" style={{ gridTemplateColumns: '0.5fr 2.4fr' }} key={`g${g.khoang}`}>
          <span>{g.khoang + 1}</span>
          <span class={g.daDat ? '' : 'vuot'}>{`${fmtSo(g.dtOngThai, { thapPhan: 1 })} / ${fmtSo(g.dtOngCap, { thapPhan: 1 })} m² · ${fmtSo(g.dtLouver, { thapPhan: 0, donVi: 'm²' })}`}</span>
        </div>
      ))}
      <div class="dong"><span>{t('ham.thangLoi')}</span><b>{fmtSo(kq.thang.length - thangThem.length)}</b></div>
      <div class="dong"><span>{t('ham.thangThem')}</span><b>{`${fmtSo(thangThem.length)} (TB* ${fmtSo(thangThem.filter((x) => x.chung).length)})`}</b></div>
      <div class="dong"><span>{t('ham.remChay')}</span><b>{fmtSo(rem)}</b></div>
    </MucGap>
  );
}

/** Tầng 1: cảnh quan còn lại, đầu ram tới đường, miệng gió dưới tháp. */
function BangT1({ kq, cayXanhMin }: { kq: KetQuaHam; cayXanhMin: number | null }) {
  const t1 = kq.t1;
  if (!t1) return null;
  const pct = t1.dtLo > 0 ? (t1.dtCanhQuan / t1.dtLo) * 100 : null;
  return (
    <MucGap tieuDe={t('ham.t1.muc')}>
      <div class="dong"><span>{t('ham.t1.dtCanhQuan')}</span><b>{`${fmtSo(t1.dtCanhQuan, { donVi: 'm²' })} (${fmtSo(pct, { thapPhan: 1, donVi: '%' })})`}</b></div>
      <div class="dong"><span>{t('ham.t1.cayXanh')}</span><b>{fmtSo(cayXanhMin, { donVi: '%' })}</b></div>
      <div class="dong"><span>{t('ham.t1.kcDuong')}</span><b>{fmtSo(t1.kcDuong, { thapPhan: 1, donVi: 'm' })}</b></div>
      <div class="dong"><span>{t('ham.t1.soLouver')}</span><b>{`${fmtSo(t1.miengGio.length)} / ${fmtSo(t1.thangRa.length)}`}</b></div>
      <div class="dong"><span>{t('ham.t1.gioDuoiToa')}</span><b class={t1.gioDuoiToa ? 'vuot' : 'ok'}>{fmtSo(t1.gioDuoiToa)}</b></div>
      <div class="dong" title="QCVN 06:2022/BXD 3.2.2 a)"><span>{t('ham.t1.thangDuoiToa')}</span><b class={t1.thangDuoiToa ? 'vuot' : 'ok'}>{fmtSo(t1.thangDuoiToa ?? 0)}</b></div>
    </MucGap>
  );
}

/** Panel phải màn Hầm: kiểm theo quy chuẩn, số liệu đỗ xe, tỷ lệ sàn hầm (áp vào DT sàn tính HSSDĐ), bảng từng tầng. */
export function HamPhai({ pa, sua, chiXem, loId, tv }: ChungHam) {
  const lo = loDangXep(pa, loId);
  const { kq, dangCho } = useRaiHam('ham.phai', pa, tv, lo);
  const [chiLoi, setChiLoi] = useState(false);
  if (!lo) return null;
  if (kq === undefined) return <p class="ham-ghi-chu" role="status"><VongRai nho />{t('ham.dangRai')}</p>;
  if (!kq) return <p class="ham-ghi-chu">{t('ham.ranhRong')}</p>;
  const { tong, soCan } = kq;
  const m2 = { donVi: 'm²' };
  const pct = (v: number) => fmtSo(v * 100, { thapPhan: 1, donVi: '%' });
  const dangDung = pa.phanHam ?? PHAN_HAM_MAC_DINH;
  /** mục chưa đạt lên đầu; bật "chỉ hiện chưa đạt" thì ẩn mục đạt (panel Hầm dài ~4.400 px) */
  const hong = (k: KiemHam) => (k.dat !== null && k.mucTieu !== null && k.muc !== 'ok' ? 0 : 1);
  const sapXep = (ds: KiemHam[]) => [...ds].sort((a, b) => hong(a) - hong(b));
  const kiem = sapXep(kq.kiem.filter((k) => !k.duThao)), duThao = sapXep(kq.kiem.filter((k) => k.duThao));
  const soHong = kq.kiem.filter((k) => hong(k) === 0).length;
  const hienKiem = (ds: KiemHam[]) => (chiLoi ? ds.filter((k) => hong(k) === 0) : ds);
  return (
    <>
      {dangCho && <p class="ham-ghi-chu" role="status"><VongRai nho />{t('ham.dangRai')}</p>}
      <MucGap tieuDe={`${t('ham.mucKiem')} · ${lo.temDat.kyHieu}`} mo>
        <div class="ham-kiem dau"><span>{t('ct.chiTieu')}</span><span>{t('ct.dat')}</span><span>{t('ham.yeuCau')}</span></div>
        <label class="ham-chi-loi"><input type="checkbox" checked={chiLoi} onChange={(e) => setChiLoi(e.currentTarget.checked)} /> {t('ham.chiChuaDat')} ({soHong})</label>
        {hienKiem(kiem).map((k) => <DongKiem key={k.khoa} k={k} />)}
        {soCan === 0 && <p class="ham-ghi-chu">{t('ham.chuaCoCan')}</p>}
        {kq.noxh && <p class="ham-ghi-chu">{t('ham.noxh60')}</p>}
        {(tong.soCutDuong ?? 0) > 0 && <p class="ham-ghi-chu vuot">{t('ham.cutDuongGhi').replace('{n}', String(tong.soCutDuong))}</p>}
      </MucGap>
      {duThao.length > 0 && (
        <MucGap tieuDe={t('ham.mucXeDienKiem')} giaiThich={t('ham.xeDienGiaiThich')} mo>
          {hienKiem(duThao).map((k) => <DongKiem key={k.khoa} k={k} />)}
          <p class="ham-ghi-chu">{t('ham.xeDienGiaiThich')}</p>
        </MucGap>
      )}
      <BangPhong kq={kq} sua={sua} chiXem={chiXem} />
      <BangKhoang kq={kq} />
      <BangT1 kq={kq} cayXanhMin={lo.temDat.chiTieu.cayXanhMin ?? null} />
      <MucGap tieuDe={t('ham.mucSoLieu')} mo>
        <div class="dong"><span>{t('ham.soCan')}</span><b>{fmtSo(soCan)}</b></div>
        <div class="dong"><span>{t('ham.dtsd')}</span><b>{fmtSo(kq.dtsd, m2)}</b></div>
        <div class="dong"><span>{t('ham.dtSanHam')}</span><b>{`${kq.tang.length} × ${fmtSo(kq.tang[0]?.dtSan ?? 0, m2)}`}</b></div>
        <div class="dong"><span>{t('ham.dtDoXeYeuCau')}</span><b>{fmtSo(soCan ? kq.yeuCau.tong : null, m2)}</b></div>
        <div class="dong"><span>{t('ham.dtDoXeCo')}</span><b>{fmtSo(tong.dtOto + tong.dtXeMay, m2)}</b></div>
        <div class="dong"><span>{t('ham.soChoOto')}</span><b>{`${fmtSo(tong.soCho)} (${t('ham.xeLanNgan')} ${fmtSo(tong.soXeLan)})`}</b></div>
        <div class="dong"><span>{t('ham.xeMayCho')}</span><b>{fmtSo(tong.soXeMay ?? null)}</b></div>
        <div class="dong"><span>{t('ham.choMoiCan')}</span><b>{fmtSo(soCan ? tong.soCho / soCan : null, { thapPhan: 2 })}</b></div>
        <div class="dong"><span>{t('ham.m2MoiCho')}</span><b>{fmtSo(tong.soCho ? tong.dtOto / tong.soCho : null, { thapPhan: 1, donVi: 'm²' })}</b></div>
        <div class="dong"><span>{t('ham.dtXeMayCo')}</span><b>{fmtSo(tong.dtXeMay, m2)}</b></div>
        <div class="dong"><span>{t('ham.xeMayMoiCan')}</span><b>{fmtSo(soCan ? tong.dtXeMay / soCan : null, { thapPhan: 1, donVi: 'm²' })}</b></div>
        <div class="dong"><span>{t('ham.soKho')}</span><b>{fmtSo(tong.soKho)}</b></div>
        <div class="dong"><span>{t('ham.khoMoiCan')}</span><b>{fmtSo(soCan ? tong.soKho / soCan : null, { thapPhan: 2 })}</b></div>
        <div class="dong"><span>{t('ham.dtKyThuat')}</span><b>{fmtSo(tong.dtKyThuat, m2)}</b></div>
        <div class="dong"><span>{t('ham.dtLoiCot')}</span><b>{fmtSo(tong.dtLoi, m2)}</b></div>
      </MucGap>
      <MucGap tieuDe={t('ham.mucTyLe')} giaiThich={t('ham.tyLeGiaiThich')} mo>
        <div class="ham-kiem dau"><span /><span>{t('ham.doDuoc')}</span><span>{t('ham.dangDung')}</span></div>
        <div class="ham-kiem"><span>{t('phanHam.doXe')}</span><span>{pct(kq.tyLe.doXe)}</span><span>{pct(dangDung.doXe)}</span></div>
        <div class="ham-kiem"><span>{t('phanHam.kyThuat')}</span><span>{pct(kq.tyLe.kyThuat)}</span><span>{pct(dangDung.kyThuat)}</span></div>
        <p class="ham-ghi-chu">{t('ham.tyLeGiaiThich')}</p>
        <div class="dong" style={{ justifyContent: 'flex-start' }}>
          <button type="button" class="nut-phu" disabled={chiXem || tong.dtSan <= 0}
            onClick={() => sua((p) => ({ ...p, phanHam: { doXe: Math.round(kq.tyLe.doXe * 1000) / 1000, kyThuat: Math.round(kq.tyLe.kyThuat * 1000) / 1000 } }))}>
            {t('ham.apTyLe')}
          </button>
        </div>
      </MucGap>
      <MucGap tieuDe={t('ham.mucTheoTang')}>
        <div class="ham-kiem dau" style={{ gridTemplateColumns: '0.6fr 1fr 1fr 1fr 0.8fr' }}><span>{t('ham.tang')}</span><span>{t('ham.choOto')}</span><span>{t('ham.xeMay')}</span><span>{t('ham.kho')}</span><span>{t('ham.k.cutDuong')}</span></div>
        {kq.tang.map((x) => (
          <div class="ham-kiem" style={{ gridTemplateColumns: '0.6fr 1fr 1fr 1fr 0.8fr' }} key={x.tang}>
            <span>{`B${x.tang}`}</span><span>{fmtSo(x.soCho)}</span><span>{fmtSo(x.soXeMay ?? null)}</span><span>{fmtSo(x.soKho)}</span><span class={x.cutDuong?.length ? 'vuot' : ''}>{fmtSo(x.cutDuong?.length ?? 0)}</span>
          </div>
        ))}
      </MucGap>
    </>
  );
}
