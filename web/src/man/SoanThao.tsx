import { chonTangNgoai, nhanPhamVi, tenTang } from '../ui/ChonTang';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { api, LoiApi, type DuAnApi } from '../api';
import { t, useLang } from '../i18n/i18n';
import { useKho } from '../kho/kho';
import { ghiNhoDuAn, layMaSua, nhanMaTuLink } from '../kho/maSua';
import { usePhimSoan } from '../kho/phimSoan';
import type { Lo, ToaDat, TrangThaiPA } from '../tinh/kieu';
import { chuanHoaPA, taoPAMoi } from '../tinh/macDinh';
import { KhungSoan } from '../ui/KhungSoan';
import type { CheDoXem } from '../ui/ThanhTren';
import { chonSauBam, chonSauBamToa } from '../ve3d/chon3d';
import type { Chon3D } from '../ve3d/MoHinh3D';
import { ChonLang, ThuongHieu, type CapDo, type MenuCap } from '../ui/ThanhTren';
import { capHienTai, dsMucTang, giaiKhoaTang, khoaTangDangXem, lenMotCap, type BuocSoan } from '../ui/capDo';
import { mauToa } from '../tinh/canThem';
import { laCaoTang } from '../tinh/loaiDat';
import { tangCoRieng } from '../tinh/matBang';
import { tinhChiTieu, type KetQuaChiTieu } from '../tinh/chiTieu';
import type { ThuVien } from '../tinh/kieu';
import { soCanChuVi, viTriCan } from '../tinh/matBang';
import { taiThuVien } from '../tinh/thuVien';
import { tomTatPA } from '../tinh/tomTat';
import { diemLechPA } from '../tinh/diemPA';
import { xuatBaoCaoPA } from '../xuat/xuatXls';
import { luoi } from '../ui/Luoi';
import { chonTangToa, TangGiua, TangMoHinh, TangPhai, TangTrai, toaDangXem, useChonO } from './ManTang';
import { TmbPhai, TmbTrai, XepGiua, loDangXep } from './ManXepToa';
import { taoNguCanhSoan, type PhuSoan } from '../troLy/nguCanhSoan';
import { HopSoSanhMau } from '../ui/SoSanhMau';
import { oDungCan } from '../tinh/soSanhMau';

// Màn nặng ít dùng: chunk riêng, tải khi mở (vòng O giữ chỗ) — de_xuat_hieu_nang P5.
const napHam = () => import('./ManHam');
const HamTrai = luoi(() => napHam().then((m) => m.HamTrai));
const HamGiua = luoi(() => napHam().then((m) => m.HamGiua), 'giua');
const HamPhai = luoi(() => napHam().then((m) => m.HamPhai));
const napChiPhi = () => import('./ManChiPhi');
const ChiPhiGiua = luoi(() => napChiPhi().then((m) => m.ChiPhiGiua), 'giua');
const ChiPhiPhai = luoi(() => napChiPhi().then((m) => m.ChiPhiPhai));
const HopXuatCad = luoi(() => import('./HopXuatCad').then((m) => m.HopXuatCad), 'hop');
const HopXuatTaiLieu = luoi(() => import('./HopXuatTaiLieu').then((m) => m.HopXuatTaiLieu), 'hop');
// Trợ lý Leo AI (troLy/): chunk riêng, tải khi mở khung lần đầu.
const LeoAI = luoi(() => import('../troLy/LeoAI').then((m) => m.LeoAI), 'hop');

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
        // Thư viện không phụ thuộc PA: tải song song với dự án + PA (bỏ bậc nối đuôi, de_xuat_hieu_nang P2).
        void taiThuVien().catch(() => {});
        const muon = new URLSearchParams(location.search).get('pa');
        // Link có ?pa=: đọc PA cùng lúc với dự án; PA không có trong dự án thì bỏ bản đọc trước.
        const docTruoc = muon ? api.docPA(ma, muon).catch(() => null) : null;
        const [da, quyen] = await Promise.all([api.docDuAn(ma), api.kiemMa(ma, maSua)]);
        let paId = (muon && da.phuong_an.some((p) => p.id === muon) ? muon : da.phuong_an[0]?.id) ?? 'pa-1';
        let ban: TrangThaiPA;
        let tenPA = t('pa.mau');
        if (da.phuong_an.length) {
          const pa = (paId === muon ? await docTruoc : null) ?? (await api.docPA(ma, paId));
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
  usePhimSoan({ chiXem, hoanTac: kho.hoanTac, lamLai: kho.lamLai, luuNgay: kho.luuNgay, conChuaLuu: kho.conChuaLuu });
  // nhớ theo PA: đổi tab / màn (vd. mở 3D) không tính lại chỉ tiêu cả dự án (48 tòa, điện thoại CPU 4×: ~40 ms mỗi lượt vẽ)
  const kq: KetQuaChiTieu | null = useMemo(() => (tv ? tinhChiTieu(kho.pa, tv) : null), [kho.pa, tv]);
  const [buoc, setBuocGoc] = useState<BuocSoan>('tmb');
  // bước trên cốt 0 gần nhất (menu cốt: Dưới → Trên trở lại đúng màn đang làm)
  const buocTren = useRef<'tmb' | 'tang'>('tmb');
  const setBuoc = (b: BuocSoan) => { if (b !== 'ham') buocTren.current = b; setBuocGoc(b); };
  const [tangHam, setTangHam] = useState(1);
  const [canKhoa, setCanKhoa] = useState<string | null>(null);
  const [moXuat, setMoXuat] = useState(false);
  const [moTl, setMoTl] = useState<'pdf' | '3d' | null>(null); // hộp xuất PDF / 3D · BIM
  const [toaId, setToaId] = useState<string | null>(null);
  const chung = { pa: kho.pa, sua: kho.sua, chiXem, loId, chonLo: setLoId };
  const chungXep = { ...chung, tv, toaId, chonToa: setToaId, moTang: (id: string) => { const x = kho.pa.toa.find((q) => q.id === id); if (x) setLoId(x.loId); setToaId(id); setCanKhoa(null); setBuoc('tang'); },
    // căn sát mốc dải dân số → màn Tầng của tòa, chọn ô dùng mẫu căn đó
    moCan: (id: string, canId: string) => { const x = kho.pa.toa.find((q) => q.id === id); if (!x) return; setLoId(x.loId); setToaId(id); setCanKhoa(tv ? oDungCan(tv, x, canId) : null); setBuoc('tang'); } };
  const chungTang = { ...chungXep, canKhoa, chonCan: setCanKhoa };
  const chungHam = { ...chung, tv, tangHam, chonTangHam: setTangHam };
  // chọn trong 3D đi qua đúng state chọn của 2D; bấm đúp tòa → mặt bằng tầng (như bấm đúp ở TMB) và về khung 2D
  const [xemGiua, setXemGiua] = useState<CheDoXem>('mat_bang');
  const soTangHam = Math.max(1, Math.round(kho.pa.ham.soTang));
  const xemXuat = toaDangXem(kho.pa, tv, loId, toaId);
  // 3D Công trình: căn / tầng của tòa đang xem đi qua đúng state màn Tầng (canKhoa + tầng đang xem); bấm đúp căn → màn Tầng tầng đó, chọn căn đó
  const coXem = useChonO(xemXuat?.toa ?? null);
  const tang3d = coXem.tangs?.length === 1 ? coXem.tangs[0] : null;
  // khối đế chọn ở 3D Công trình: nhớ theo id tòa; chỉ còn hiệu lực khi chưa chọn căn / tầng khác (từ 2D, dải cấp…)
  const [deToa3d, setDeToa3d] = useState<string | null>(null);
  // bấm khối đế lúc đang ở màn Tầng thì panel chuyển sang Thông số tòa (TMB); bấm lại căn / tầng thì về màn Tầng
  const deDoiBuoc = useRef(false);
  const chon3d: Chon3D = {
    chon: { toaId, loId, tang: tang3d, canKhoa, de: !!deToa3d && deToa3d === xemXuat?.toa.id && !canKhoa && !tang3d },
    onChon: (d) => { const c = chonSauBam(d); setLoId(c.loId); setToaId(c.toaId); setCanKhoa(null); setDeToa3d(null); },
    onMo: (d) => { if (d.loai === 'toa') { chungXep.moTang(d.id); setXemGiua('mat_bang'); } },
    onChonToa: (d) => {
      const x = xemXuat?.toa;
      if (!x) return;
      const c = chonSauBamToa(d);
      setCanKhoa(c.canKhoa);
      chonTangToa(x, c.tang ? [c.tang] : null);
      setDeToa3d(c.de ? x.id : null);
      if (c.de) { // khối đế: chọn tòa + lô, panel bên cạnh ra thông số tòa như bấm tòa ở Toàn dự án
        setLoId(x.loId); setToaId(x.id);
        if (buoc === 'tang') { deDoiBuoc.current = true; setBuoc('tmb'); }
      } else if (d && deDoiBuoc.current) { deDoiBuoc.current = false; if (buoc === 'tmb') setBuoc('tang'); }
    },
    onMoToa: (d) => {
      const x = xemXuat?.toa;
      if (x && d.loai === 'de') { // bấm đúp khối đế → tổng mặt bằng 2D, tòa này đang chọn
        deDoiBuoc.current = false;
        setLoId(x.loId); setToaId(x.id); setCanKhoa(null); setDeToa3d(null);
        setBuoc('tmb'); setXemGiua('mat_bang');
        return;
      }
      if (!x || (d.loai !== 'can' && d.loai !== 'tang')) return;
      setDeToa3d(null); deDoiBuoc.current = false;
      const c = chonSauBamToa(d);
      setLoId(x.loId); setToaId(x.id); setCanKhoa(c.canKhoa);
      chonTangToa(x, c.tang ? [c.tang] : null);
      setBuoc('tang'); setXemGiua('mat_bang');
    },
  };
  const xemTang = buoc === 'tang' ? toaDangXem(kho.pa, tv, loId, toaId) : null;
  const loDangChon = buoc !== 'tang' ? loDangXep(kho.pa, loId) : xemTang?.lo;
  const toaDangChon = buoc === 'tmb' ? kho.pa.toa.find((x) => x.id === toaId) : xemTang?.toa;
  const chonO = useChonO(buoc === 'tang' ? toaDangChon ?? null : null);
  // Leo AI: công cụ đọc / sửa qua đúng kho + state chọn của trình soạn (troLy/nguCanhSoan.ts); ref cập nhật mỗi lần vẽ.
  const [moLeo, setMoLeo] = useState(false);
  const [leoDang, setLeoDang] = useState(false);
  const xacNhanLeo = useRef<(c: string) => Promise<boolean>>(async () => false);
  const phuLeo = useRef<PhuSoan>(null as unknown as PhuSoan);
  phuLeo.current = {
    ma, da, paId, tenPA, maSua, loi: kho.loi, layCheDo: kho.layCheDo, tv,
    ui: { buoc, xem: xemGiua, loId: loDangChon?.id ?? loId, toaId, canKhoa, tangs: null, tangHam },
    datBuoc: setBuoc, datXem: setXemGiua, datLo: setLoId, datToa: setToaId, datCan: setCanKhoa, datTangHam: setTangHam,
    xuatXls: tv && kq ? () => xuatBaoCaoPA(kho.pa, tv, kq, da.ten, tenPA, diemLechPA(kho.pa, kq)) : undefined,
    moCad: xemXuat && tv ? () => setMoXuat(true) : undefined,
  };
  const ngLeo = useMemo(() => taoNguCanhSoan(phuLeo, xacNhanLeo), []);
  const thongBao = (
    <>
      {!duocSua && <div class="thong-bao" role="status">{t('soan.chiXem')}</div>}
      <HopSoSanhMau pa={kho.pa} tv={tv} sua={kho.sua} chiXem={chiXem} loId={loId}
        daDat={(lo, id) => { setLoId(lo); setToaId(id); setCanKhoa(null); setBuoc('tmb'); setXemGiua('mat_bang'); }} />
      {moTl && tv && <HopXuatTaiLieu nhom={moTl} pa={kho.pa} tv={tv} tenDuAn={da.ten} tenPA={tenPA} toaDangXem={xemXuat?.toa.id ?? null} dong={() => setMoTl(null)} />}
      {moXuat && xemXuat && tv && <HopXuatCad toa={xemXuat.toa} mau={xemXuat.mauTang(null)} mauTang={xemXuat.mauTang} tv={tv} ten={da.ten} dong={() => setMoXuat(false)} />}
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
      capDo={dungCapDo({
        da, paId, tenPA, pa: kho.pa, tv, buoc, buocTren: buocTren.current, loDangChon, toaDangChon, xemTang, chonO, canKhoa, tangHam, soTangHam,
        datBuoc: setBuoc, datLo: setLoId, datToa: setToaId, datCan: setCanKhoa, datTangHam: setTangHam,
        moPA: (id) => location.assign(`/du-an/${encodeURIComponent(ma)}?pa=${encodeURIComponent(id)}`),
      })}
      cheDo={kho.cheDo}
      onCheDo={kho.datCheDo}
      duocSua={duocSua}
      trangThaiLuu={kho.trangThaiLuu}
      onHoanTac={kho.hoanTac}
      onLamLai={kho.lamLai}
      thongBao={thongBao}
      onXuatCad={xemXuat && tv ? () => setMoXuat(true) : undefined}
      onXuatPdf={tv && kho.pa.toa.length ? () => setMoTl('pdf') : undefined}
      onXuat3d={tv && kho.pa.toa.length ? () => setMoTl('3d') : undefined}
      onXuatXls={tv && kq ? () => xuatBaoCaoPA(kho.pa, tv, kq, da.ten, tenPA, diemLechPA(kho.pa, kq)) : undefined}
      xem={xemGiua}
      onXem={setXemGiua}
      leoAi={{ mo: moLeo, dang: leoDang, bat: () => setMoLeo((m) => !m) }}
      lopPhu={moLeo && <LeoAI ng={ngLeo} maDuAn={ma} maSua={maSua} dong={() => setMoLeo(false)} datXacNhan={(f) => { xacNhanLeo.current = f; }} khiChay={setLeoDang} />}
      moHinh={<TangMoHinh {...chungTang} tenDuAn={da.ten} chon3d={chon3d} />}
      chiPhi={<ChiPhiGiua pa={kho.pa} tv={tv} kq={kq} sua={kho.sua} chiXem={chiXem} />}
      chiPhiPhai={<ChiPhiPhai pa={kho.pa} tv={tv} kq={kq} />}
      buoc={{ ds: [['tmb', t('buoc.tmb')], ['tang', t('buoc.tang')], ['ham', t('buoc.ham')]], chon: buoc, onChon: (k) => setBuoc(k as 'tmb' | 'tang' | 'ham') }}
      trai={buoc === 'tmb' ? <TmbTrai {...chungXep} /> : buoc === 'ham' ? <HamTrai {...chungHam} /> : <TangTrai {...chungTang} />}
      giua={buoc === 'tmb' ? <XepGiua {...chungXep} /> : buoc === 'ham' ? <HamGiua {...chungHam} /> : <TangGiua {...chungTang} />}
      phai={buoc === 'tmb' ? <TmbPhai {...chungXep} kq={kq} /> : buoc === 'ham' ? <HamPhai {...chungHam} /> : <TangPhai {...chungTang} />}
    />
  );
}

const tenCH = (so: number) => `CH-${String(so).padStart(2, '0')}`;
/** Căn trên tầng đang xem theo số CH-xx (đánh số theo chu vi như bản vẽ). */
function dsCan(xem: NonNullable<ReturnType<typeof toaDangXem>>, tv: ThuVien | null): [string, number][] {
  if (!tv) return [];
  return [...soCanChuVi(xem.mau.duong_bao, viTriCan(xem.mau, tv)).entries()].sort((a, b) => a[1] - b[1]);
}
const tenMau = (tv: ThuVien | null, x: ToaDat) => (tv && mauToa(tv, x)?.ten_vi) || x.mauId;

type DauVaoCap = {
  da: DuAnApi; paId: string; tenPA: string; pa: TrangThaiPA; tv: ThuVien | null; buoc: BuocSoan; buocTren: 'tmb' | 'tang';
  loDangChon: Lo | undefined; toaDangChon: ToaDat | undefined; xemTang: ReturnType<typeof toaDangXem>; chonO: { tangs: number[] | null };
  canKhoa: string | null; tangHam: number; soTangHam: number;
  datBuoc: (b: BuocSoan) => void; datLo: (id: string | null) => void; datToa: (id: string | null) => void; datCan: (k: string | null) => void;
  datTangHam: (n: number) => void; moPA: (id: string) => void;
};

/** Dải cấp trên thanh trên: lô / PA · cốt · tòa · tầng · căn, mỗi ô một menu thả xuống; ↑ lên một cấp. Chỉ đổi state chọn của SoanThao. */
function dungCapDo(v: DauVaoCap): CapDo {
  const { da, pa, tv, buoc, loDangChon, toaDangChon, canKhoa } = v;
  const tangHam = Math.min(v.tangHam, v.soTangHam);
  const viTri = { buoc, toaId: toaDangChon?.id ?? null, canKhoa: buoc === 'tang' ? canKhoa : null };
  const cap = capHienTai(viTri);
  const len = lenMotCap(viTri);
  const nhanCap = (c: ReturnType<typeof capHienTai>) => t(c === 'lo' ? 'cap.tmb' : c === 'toa' ? 'cap.capToa' : c === 'tang' ? 'cap.tang' : 'cap.can');
  const chonToa = (id: string) => { const x = pa.toa.find((q) => q.id === id); if (x) v.datLo(x.loId); v.datToa(id); v.datCan(null); };

  // Lô / PA: tên dự án · PA · lô
  const loMenu: MenuCap = {
    nhan: `${da.ten} · ${v.tenPA}${loDangChon ? ' · ' + loDangChon.temDat.kyHieu : ''}`.toUpperCase(),
    tieuDe: `${da.ten} · ${v.tenPA}${loDangChon ? ' · ' + loDangChon.temDat.kyHieu : ''}`,
    dangO: cap === 'lo',
    ds: [
      ...da.phuong_an.map((p) => ({ khoa: `pa:${p.id}`, nhan: p.ten, nhom: t('cap.pa'), chon: p.id === v.paId })),
      ...pa.lo.filter(laCaoTang).map((l) => ({ khoa: `lo:${l.id}`, nhan: l.temDat.kyHieu, nhom: t('cap.lo'), chon: l.id === loDangChon?.id,
        phu: t('cap.soToa').replace('{n}', String(pa.toa.filter((x) => x.loId === l.id).length)) })),
    ],
    onChon: (k) => {
      const [loai, id] = [k.slice(0, k.indexOf(':')), k.slice(k.indexOf(':') + 1)];
      if (loai === 'pa') { if (id !== v.paId) v.moPA(id); return; }
      if (id === loDangChon?.id) return;
      v.datLo(id); v.datToa(null); v.datCan(null);
    },
  };

  // Cốt: Trên (Tầng) / Dưới (Hầm)
  const coTe: MenuCap = {
    nhan: t(buoc === 'ham' ? 'cap.duoi' : 'cap.tren'),
    tieuDe: t('cap.doiCoTe'),
    ds: [
      { khoa: 'tren', nhan: t('cap.tren'), phu: t('cap.phuTren'), chon: buoc !== 'ham' },
      { khoa: 'duoi', nhan: t('cap.duoi'), phu: t('cap.phuDuoi'), chon: buoc === 'ham' },
    ],
    onChon: (k) => { if (k === 'duoi' && buoc !== 'ham') v.datBuoc('ham'); else if (k === 'tren' && buoc === 'ham') v.datBuoc(v.buocTren); },
  };

  // Tòa của lô đang xem (Hầm: không có)
  const loToa = buoc === 'tang' ? v.xemTang?.lo ?? loDangChon : loDangChon;
  const dsToa = pa.toa.filter((x) => !loToa || x.loId === loToa.id);
  // nhiều tòa cùng mẫu trên một lô: đánh số thứ tự cho phân biệt (như danh sách tòa ở panel trái)
  const trungTen = new Set(dsToa.map((x) => tenMau(tv, x))).size < dsToa.length;
  const nhanToa = (x: ToaDat) => { const i = dsToa.indexOf(x); return trungTen && i >= 0 ? `${i + 1} · ${tenMau(tv, x)}` : tenMau(tv, x); };
  const toa: MenuCap | undefined = buoc !== 'ham' && dsToa.length ? {
    // ô trên thanh: mã ngắn ("1 · V4"), tên đầy đủ ở tooltip + menu — tên dài bị cắt "1 · V4 · Chữ …"
    nhan: toaDangChon ? nhanToa(toaDangChon).split(' · ').slice(0, trungTen ? 2 : 1).join(' · ') : t('cap.chonToa'),
    tieuDe: toaDangChon ? nhanToa(toaDangChon) : t('cap.chonToa'),
    dangO: cap === 'toa',
    ds: dsToa.map((x) => ({ khoa: x.id, nhan: nhanToa(x), phu: `${x.soTangDe} + ${x.soTangDH} T`, nhom: loToa ? `${t('cap.toa')} ${loToa.temDat.kyHieu}` : undefined, chon: x.id === toaDangChon?.id })),
    onChon: (id) => { if (id !== toaDangChon?.id) chonToa(id); },
  } : undefined;

  // Tầng: tầng điển hình, từng tầng (đánh dấu tầng riêng), tầng hầm
  const toaTang = buoc === 'tang' ? v.xemTang?.toa : toaDangChon;
  const khoaTang = khoaTangDangXem(buoc, buoc === 'tang' ? v.chonO.tangs : null, tangHam);
  const mucTang = dsMucTang({ soTangDH: toaTang?.soTangDH ?? 0, coRieng: toaTang ? tangCoRieng(toaTang) : [], soTangHam: v.soTangHam, coToa: !!toaTang });
  const nhanTang = buoc === 'ham' ? `B${tangHam}`
    : buoc === 'tang' && toaTang ? (v.chonO.tangs ? nhanPhamVi(v.chonO.tangs, toaTang.soTangDe) : t('tang.dienHinh'))
    : t('cap.chonTang');
  const tang: MenuCap | undefined = buoc !== 'tmb' || toaTang ? {
    nhan: nhanTang,
    tieuDe: nhanTang,
    dangO: cap === 'tang',
    ds: mucTang.map((m) => ({
      khoa: m.khoa,
      nhan: m.loai === 'dh' ? t('tang.dienHinh') : m.loai === 'ham' ? `B${m.so}` : tenTang(toaTang!.soTangDe, m.so),
      nhom: m.loai === 'ham' ? t('cap.ham') : m.loai === 'tang' ? t('cap.tangDH') : undefined,
      phu: m.loai === 'dh' ? t('cap.moiTang') : m.rieng ? t('cap.rieng') : undefined,
      danhDau: m.rieng,
      chon: m.khoa === khoaTang,
    })),
    onChon: (k) => {
      const g = giaiKhoaTang(k);
      if (!g) return;
      if (g.loai === 'ham') { v.datTangHam(g.so); v.datBuoc('ham'); return; }
      if (toaTang) v.datToa(toaTang.id);
      v.datCan(null);
      chonTangNgoai(g.loai === 'dh' ? null : [g.so]);
      if (buoc !== 'tang') v.datBuoc('tang');
    },
  } : undefined;

  // Căn trên tầng đang xem
  const cans = buoc === 'tang' && v.xemTang ? dsCan(v.xemTang, tv) : [];
  const soChon = canKhoa ? cans.find(([k]) => k === canKhoa)?.[1] : undefined;
  const can: MenuCap | undefined = cans.length ? {
    nhan: soChon ? tenCH(soChon) : t('cap.chonCan'),
    tieuDe: soChon ? tenCH(soChon) : t('cap.chonCan'),
    dangO: cap === 'can',
    ds: cans.map(([k, so]) => ({ khoa: k, nhan: tenCH(so), chon: k === canKhoa })),
    onChon: (k) => v.datCan(k),
  } : undefined;

  return {
    lo: loMenu, coTe, toa, tang, can,
    onLen: len ? () => { v.datCan(len.canKhoa); v.datToa(len.toaId); v.datBuoc(len.buoc); } : undefined,
    nhanLen: len ? t('cap.lenToi').replace('{c}', nhanCap(capHienTai(len))) : t('cap.len'),
  };
}
