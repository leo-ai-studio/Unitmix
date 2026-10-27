import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { demCan, diemLechCoCau, phanTram } from '../tinh/coCau';
import { dtCongNangToa, kiemShcd } from '../tinh/congNang';
import { apDoiViTri, apDoiViTriTang, boTangRieng, datCoCauTang, datLoi, doiCanTaiViTri, doiCanTheoTang, doiCongNang, thongTinLoi, veMauGoc } from '../tinh/doiCan';
import { LOAI_CAN, type CongNangO, type Lo, type LoaiCan, type ThuVien, type ToaDat, type TrangThaiPA } from '../tinh/kieu';
import { boCucTang, coCauRiengTang, coMat, ghiDeTang, tangCoRieng, ungVienDoi, viTriCan, type BoCuc } from '../tinh/matBang';
import { dtHanhLangTang, phanChungPhanBo } from '../tinh/phanChung';
import { toiUuCoCau } from '../tinh/toiUu';
import { BanVe, khungBao, type DieuKhienVe } from '../ve/BanVe';
import { idLoi, useHinhHoc } from '../ve/hinhHocThuVien';
import { DS_KIEU_MB, KIEU_MB, NHAN_LOAI } from '../ve/kieuMb';
import { MatBangTang, soLieuTang, type ToaVe } from '../ve/MatBangTang';
import { BangTuanThu } from '../ui/BangTuanThu';
import { MenuCongNang, MenuLoi } from '../ve/MenuO';
import { ChonTang, nhanPhamVi, tenTang } from '../ui/ChonTang';
import { MucGap } from '../ui/MucGap';
import { ThanhHienThi } from '../ui/ThanhHienThi';
import { fmtSo } from '../ui/so';
import { MoHinhCan, MoHinhChinh } from '../ve3d/MoHinh3D';
import { datCaiTang, useCaiTang } from './caiTang';

export type ChungTang = {
  pa: TrangThaiPA;
  sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void;
  chiXem: boolean;
  loId: string | null;
  chonLo: (id: string) => void;
  tv: ThuVien | null;
  toaId: string | null;
  chonToa: (id: string | null) => void;
  canKhoa: string | null;
  chonCan: (khoa: string | null) => void;
};

const tenNgan = (s?: string) => s?.split(' · ')[0] ?? '?';
const doiToa = (p: TrangThaiPA, id: string, fn: (x: ToaDat) => ToaDat): TrangThaiPA => ({ ...p, toa: p.toa.map((x) => (x.id === id ? fn(x) : x)) });
const LOP_MUC = { ok: 'ok', canh_bao: 'canh-bao', vuot: 'vuot' } as const;

/** Tòa đang xem tầng: tòa đã chọn, không thì tòa đầu của lô đang làm, không thì tòa đầu tiên. */
export function toaDangXem(pa: TrangThaiPA, tv: ThuVien | null, loId: string | null, toaId: string | null): { toa: ToaDat; mau: ToaVe; lo: Lo | undefined } | null {
  if (!tv) return null;
  const co = pa.toa.filter((x) => tv.toa.has(x.mauId) && coMat(tv.toa.get(x.mauId)!));
  const toa = co.find((x) => x.id === toaId) ?? co.find((x) => x.loId === loId) ?? co[0];
  if (!toa) return null;
  return { toa, mau: tv.toa.get(toa.mauId) as ToaVe, lo: pa.lo.find((l) => l.id === toa.loId) };
}

// ---- Trạng thái chọn của màn Tầng (dùng chung panel trái, bản vẽ, panel phải; không lưu vào PA) ----
type MenuMo = { loai: 'o' | 'loi'; khoa: string; x: number; y: number };
type ChonO = { toaId: string | null; tangs: number[] | null; ds: string[]; menu: MenuMo | null };
let chonO: ChonO = { toaId: null, tangs: null, ds: [], menu: null };
const ngheO = new Set<() => void>();
const datChonO = (p: Partial<ChonO>) => { chonO = { ...chonO, ...p }; ngheO.forEach((f) => f()); };
function useChonO(toa: ToaDat | null): ChonO {
  const [, ve] = useState(0);
  useEffect(() => {
    const f = () => ve((n) => n + 1);
    ngheO.add(f);
    return () => void ngheO.delete(f);
  }, []);
  // đổi tòa thì về bố cục chung, bỏ chọn nhiều; tầng chọn vượt số tầng điển hình thì bỏ
  if (!toa || chonO.toaId !== toa.id) return { toaId: toa?.id ?? null, tangs: null, ds: [], menu: null };
  const tangs = chonO.tangs?.filter((k) => k <= toa.soTangDH) ?? null;
  return { ...chonO, tangs: tangs?.length ? tangs : null };
}
const datChonToa = (toa: ToaDat, p: Partial<ChonO>) => datChonO({ ...(chonO.toaId === toa.id ? {} : { tangs: null, ds: [], menu: null }), toaId: toa.id, ...p });

/** Các ô đang chọn: ô chính (canKhoa) + ô chọn thêm. */
const oDangChon = (canKhoa: string | null, ds: string[]) => [...new Set([...(canKhoa ? [canKhoa] : []), ...ds])];

const mucTieuCua = (lo: Lo | undefined): Record<LoaiCan, number> => lo?.temDat.coCauMucTieu ?? { stu: 0, '1pn': 0, '2pn': 0, '2pnp': 0, '3pn': 0 };
const demLoai = (ds: { canId: string; cn: CongNangO }[], tv: ThuVien): Record<LoaiCan, number> => {
  const d = Object.fromEntries(LOAI_CAN.map((k) => [k, 0])) as Record<LoaiCan, number>;
  for (const x of ds) { const c = x.cn === 'can' && tv.can.get(x.canId); if (c) d[c.loai]++; }
  return d;
};
/** Tầng đang xem: tầng đầu trong danh sách chọn, không thì null (bố cục chung). */
const tangXem = (tangs: number[] | null) => (tangs?.length ? tangs[0] : null);
/** Mục tiêu cơ cấu dùng cho tầng đang xem: riêng của tầng (S12) nếu có, không thì của lô. */
const mucTieuTang = (toa: ToaDat, lo: Lo | undefined, tangs: number[] | null) => coCauRiengTang(toa, tangXem(tangs)) ?? mucTieuCua(lo);

/** Panel trái: chọn tòa, tầng áp dụng, cơ cấu mục tiêu + tối ưu, hiển thị. */
export function TangTrai(p: ChungTang) {
  const { pa, sua, chiXem, tv, chonToa, chonCan } = p;
  const cai = useCaiTang();
  const [ghiChu, setGhiChu] = useState('');
  const xem = toaDangXem(pa, tv, p.loId, p.toaId);
  const co = useChonO(xem?.toa ?? null);
  if (!tv) return <p class="dong muted">{t('lo.dangTaiThuVien')}</p>;
  if (!xem) return <p class="dong muted">{t('tang.chuaCoToa')}</p>;
  const { toa, mau, lo } = xem;
  const tangs = co.tangs;
  const k0 = tangXem(tangs);
  const bc = boCucTang(toa, k0);
  const ccRieng = coCauRiengTang(toa, k0);
  const muc = ccRieng ?? mucTieuCua(lo);
  const sl = soLieuTang(mau, bc, tv);
  const coRieng = tangCoRieng(toa);
  const coCauRieng = Object.keys(toa.tangRieng ?? {}).map(Number).filter((k) => ghiDeTang(toa, k)?.coCauMucTieu);
  const datTangs = (v: number[] | null) => { datChonToa(toa, { tangs: v, ds: [], menu: null }); setGhiChu(''); };
  const datMucRieng = (k: LoaiCan, v: number) => sua((q) => doiToa(q, toa.id, (x) => datCoCauTang(x, tangs!, { ...muc, [k]: Math.max(0, v) })));
  const coDoiCan = Object.keys(toa.canTheo).length > 0 || !!toa.canViTri || Object.values(toa.tangRieng ?? {}).some((g) => g.canViTri);
  return (
    <>
      <MucGap tieuDe={`${t('tang.toa')} · ${pa.toa.length}`} giaiThich={t('gt.tang.toa')} mo>
        {pa.toa.map((x) => {
          const m = tv.toa.get(x.mauId), l = pa.lo.find((q) => q.id === x.loId);
          return (
            <button type="button" key={x.id} class={`muc-lo${x.id === toa.id ? ' chon' : ''}`} aria-pressed={x.id === toa.id} onClick={() => { chonToa(x.id); chonCan(null); setGhiChu(''); }}>
              <b>{tenNgan(m?.ten_vi)} · {l?.temDat.kyHieu ?? '—'}</b>
              <span>{x.soTangDe} + {x.soTangDH} T · {t('xep.canTang').replace('{n}', String(m?.so_can_tang ?? 0))}</span>
            </button>
          );
        })}
      </MucGap>
      <MucGap tieuDe={`${t('oc.tr.tieuDe')} · ${nhanPhamVi(tangs, toa.soTangDe)}`} mo>
        <ChonTang soTangDH={toa.soTangDH} soTangDe={toa.soTangDe} tangs={tangs} datTangs={datTangs} coRieng={coRieng} coCauRieng={coCauRieng} />
        {coRieng.length > 0 && <p class="dong muted" style={{ margin: 0 }}>{t('oc.tr.coRieng').replace('{n}', String(coRieng.length))}</p>}
        {tangs && (
          <div class="dong">
            <button type="button" class="nut-phu" disabled={chiXem || !tangs.some((k) => coRieng.includes(k))}
              onClick={() => sua((q) => doiToa(q, toa.id, (x) => boTangRieng(x, tangs)))}>{t('oc.tr.boRieng')}</button>
          </div>
        )}
      </MucGap>
      <MucGap tieuDe={t('tang.coCauMucTieu')} giaiThich={t('tang.mixGhiChu')} mo>
        {tangs && (
          <label class="o-tg"><input type="checkbox" disabled={chiXem} checked={!!ccRieng}
            onChange={(e) => sua((q) => doiToa(q, toa.id, (x) => datCoCauTang(x, tangs, e.currentTarget.checked ? { ...mucTieuCua(lo) } : null)))} />
            <span>{t('oc.cc.rieng')}</span></label>
        )}
        {LOAI_CAN.map((k) => (
          <div class="dong" key={k}><span><i class="o-mau" style={{ background: `var(--u-${k})` }} /> {t(`loai.${k}`)}</span>
            {ccRieng && !chiXem
              ? <input class="o-so-nho" type="number" min="0" max="100" step="1" value={muc[k]} aria-label={t(`loai.${k}`)} onChange={(e) => datMucRieng(k, Number(e.currentTarget.value) || 0)} />
              : <b>{fmtSo(muc[k], { thapPhan: 1, donVi: '%' })}</b>}
          </div>
        ))}
        <p class="dong muted" style={{ margin: 0 }}>{ccRieng ? t('oc.cc.dangDungRieng').replace('{v}', nhanPhamVi(tangs, toa.soTangDe)) : t('oc.cc.theoLo')}</p>
        {lo?.temDat.deBai && <p class="dong muted" style={{ margin: 0 }}>{t('lo.nguonDeBai').replace('{n}', lo.temDat.deBai.nguon)}</p>}
        <div class="dong" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
          <button type="button" class="nut-chinh" title={t('gt.tang.toiUu')} disabled={chiXem}
            onClick={() => {
              const kq = toiUuCoCau(mau, bc, tv, muc);
              const vts = viTriCan(mau, tv);
              sua((q) => doiToa(q, toa.id, (x) => (tangs ? apDoiViTriTang(x, tangs, kq.canViTri, vts) : apDoiViTri(x, kq.canViTri))));
              setGhiChu(kq.soDoi ? t('tang.daToiUu').replace('{n}', String(kq.soDoi)).replace('{a}', fmtSo(kq.diemTruoc, { thapPhan: 1 })).replace('{b}', fmtSo(kq.diemSau, { thapPhan: 1 })) : t('tang.khongDoiDuoc'));
            }}>{t('tang.toiUu')}{tangs ? ` · ${nhanPhamVi(tangs, toa.soTangDe)}` : ''}</button>
          <button type="button" class="nut-phu" title={t('gt.tang.veGoc')} disabled={chiXem || !coDoiCan}
            onClick={() => { sua((q) => doiToa(q, toa.id, veMauGoc)); setGhiChu(''); }}>{t('tang.veGoc')}</button>
        </div>
        {ghiChu && <p class="dong canh-bao" role="status" style={{ margin: 0 }}>{ghiChu}</p>}
        <p class="dong muted" style={{ margin: 0 }}>{t('tang.mixGhiChu')}</p>
      </MucGap>
      <MucGap tieuDe={t('tang.hienThi')} giaiThich={t('gt.tang.hienThi')} mo>
        <label class="o-chon" title={t('gt.tang.kieu')}><span>{t('tang.kieu')}</span>
          <select value={cai.kieu} onChange={(e) => datCaiTang({ kieu: e.currentTarget.value as typeof cai.kieu })}>
            {DS_KIEU_MB.map((k) => <option value={k}>{t(`kieu.${k}`)}</option>)}
          </select>
        </label>
        {([['hienTem', 'tang.hienTem'], ['noiThat', 'tang.noiThat'], ['chamMau', 'tang.chamMau'], ['suaNhieu', 'tang.suaNhieu']] as const).map(([k, nhan]) => (
          <label class="o-tg" key={k} title={t(`gt.${nhan}`)}><input type="checkbox" checked={cai[k]} onChange={(e) => datCaiTang({ [k]: e.currentTarget.checked })} /><span>{t(nhan)}</span></label>
        ))}
        <p class="dong muted" style={{ margin: 0 }}>{t('tang.phamVi').replace('{n}', String(toa.soTangDH))} · {t('xep.canTang').replace('{n}', String(sl.can.filter((c) => c.cn === 'can').length))}</p>
        <p class="dong muted" style={{ margin: 0 }}>{t('oc.goiYChon')}</p>
      </MucGap>
    </>
  );
}

/** Bản vẽ giữa: mặt bằng tầng điển hình (chung hoặc tầng riêng) của tòa đang xem. */
export function TangGiua(p: ChungTang) {
  const xem = toaDangXem(p.pa, p.tv, p.loId, p.toaId);
  if (!p.tv) return <div class="giua-man"><img class="spin-o" src="/brand/leo_ai_o.png" alt="" /><span>{t('lo.dangTaiThuVien')}</span></div>;
  if (!xem) return <div class="giua-man"><span>{t('tang.chuaCoToa')}</span></div>;
  return <TangVe {...p} tv={p.tv} toa={xem.toa} mau={xem.mau} lo={xem.lo} />;
}

/** Tab 3D: toàn dự án hoặc công trình đang xem. */
export function TangMoHinh(p: ChungTang & { tenDuAn: string }) {
  const xem = toaDangXem(p.pa, p.tv, p.loId, p.toaId);
  if (!p.tv) return <div class="giua-man"><img class="spin-o" src="/brand/leo_ai_o.png" alt="" /><span>{t('lo.dangTaiThuVien')}</span></div>;
  return <MoHinhChinh pa={p.pa} tv={p.tv} sua={p.sua} chiXem={p.chiXem} toa={xem?.toa ?? null} mau={xem?.mau ?? null} tenDuAn={p.tenDuAn} />;
}

/** Đổi công năng các ô trên phạm vi đang chọn (chung hoặc các tầng). */
const suaCongNang = (p: Pick<ChungTang, 'sua'>, toa: ToaDat, tangs: number[] | null, khoas: string[], cn: CongNangO) =>
  p.sua((q) => doiToa(q, toa.id, (x) => doiCongNang(x, tangs, khoas, cn)));

type KhungChon = { x0: number; y0: number; x1: number; y1: number };

function TangVe(p: ChungTang & { tv: ThuVien; toa: ToaDat; mau: ToaVe; lo: Lo | undefined }) {
  const { tv, toa, mau, lo, canKhoa, chonCan, pa, chiXem } = p;
  const cai = useCaiTang();
  const co = useChonO(toa);
  const [dk, setDk] = useState<DieuKhienVe | null>(null);
  const [khungChon, setKhungChon] = useState<KhungChon | null>(null);
  const boc = useRef<HTMLDivElement>(null);
  const nuotClick = useRef(false);
  const k0 = tangXem(co.tangs);
  const bc: BoCuc = useMemo(() => boCucTang(toa, k0), [toa, k0]);
  const sl = useMemo(() => soLieuTang(mau, bc, tv), [mau, bc, tv]);
  const loiIds = useMemo(() => mau.mat.flatMap((m) => m.phan_tu.filter((q) => q.loai !== 'can').map((q) => idLoi(q.block))), [mau]);
  const hinh = useHinhHoc(sl.can.map((c) => c.canId), loiIds);
  const khung = useMemo(() => {
    const k = khungBao([mau.duong_bao.map(([x, y]): [number, number] => [x / 1000, y / 1000])]);
    return k ? ([k[0] - 6, k[1] - 6, k[2] + 6, k[3] + 6] as [number, number, number, number]) : null;
  }, [mau]);
  const dsO = oDangChon(canKhoa, co.ds);
  const soCanTang = sl.can.filter((c) => c.cn === 'can').length;
  const phamVi = nhanPhamVi(co.tangs, toa.soTangDe);

  const onChonO = (khoa: string, e: MouseEvent) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      const ds = dsO.includes(khoa) ? dsO.filter((k) => k !== khoa) : [...dsO, khoa];
      chonCan(ds[0] ?? null);
      datChonToa(toa, { ds: ds.slice(1), menu: null });
      return;
    }
    datChonToa(toa, { ds: [], menu: null });
    chonCan(khoa === canKhoa && !co.ds.length ? null : khoa);
  };
  const onMenu = (loai: 'o' | 'loi', khoa: string, x: number, y: number) => {
    if (loai === 'o' && !dsO.includes(khoa)) { chonCan(khoa); datChonToa(toa, { ds: [] }); }
    datChonToa(toa, { menu: { loai, khoa, x, y } });
  };
  const dongMenu = () => datChonToa(toa, { menu: null });

  // Shift + kéo trên bản vẽ: chọn khung (chặn kéo di bản vẽ của BanVe). Ô có tâm nằm trong khung được chọn thêm.
  const batDauKhung = (e: PointerEvent) => {
    if (!e.shiftKey || e.button !== 0) return;
    e.stopPropagation();
    const x0 = e.clientX, y0 = e.clientY;
    let k: KhungChon = { x0, y0, x1: x0, y1: y0 };
    const di = (ev: PointerEvent) => { k = { x0, y0, x1: ev.clientX, y1: ev.clientY }; setKhungChon(k); };
    const tha = () => {
      window.removeEventListener('pointermove', di);
      window.removeEventListener('pointerup', tha);
      setKhungChon(null);
      if (Math.abs(k.x1 - k.x0) + Math.abs(k.y1 - k.y0) < 6) return; // chỉ là Shift + bấm: để click xử lý
      nuotClick.current = true;
      setTimeout(() => { nuotClick.current = false; }, 0);
      const [l, r, tp, bt] = [Math.min(k.x0, k.x1), Math.max(k.x0, k.x1), Math.min(k.y0, k.y1), Math.max(k.y0, k.y1)];
      const trong = [...(boc.current?.querySelectorAll<SVGElement>('[data-o]') ?? [])].filter((el) => {
        const b = el.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
        return cx >= l && cx <= r && cy >= tp && cy <= bt;
      }).map((el) => el.getAttribute('data-o')!);
      const ds = [...new Set([...dsO, ...trong])];
      chonCan(ds[0] ?? null);
      datChonToa(toa, { ds: ds.slice(1), menu: null });
    };
    window.addEventListener('pointermove', di);
    window.addEventListener('pointerup', tha);
  };

  const menu = co.menu;
  const cnChon = [...new Set(dsO.map((k) => sl.can.find((c) => c.vt.khoa === k)?.cn ?? 'can'))];
  return (
    <>
      <div class="the-tang" role="status">
        {tenNgan(mau.ten_vi)} · {k0 === null ? t('tang.dienHinh') : phamVi} · {k0 === null ? t('tang.apCho').replace('{n}', String(toa.soTangDH - tangCoRieng(toa).length)) : ''}{k0 === null ? ' · ' : ''}{t('xep.canTang').replace('{n}', String(soCanTang))}
        {hinh.dangTai && <img class="spin-o" src="/brand/leo_ai_o.png" alt="" style={{ width: '14px', height: '14px', marginLeft: '8px', verticalAlign: '-2px' }} />}
      </div>
      {dsO.length > 0 && !menu && (
        <div class="thanh-o-chon" role="toolbar" aria-label={t('oc.congNang')}>
          <span>{t('oc.soO').replace('{n}', String(dsO.length))}</span>
          <button type="button" class="nut-phu" disabled={chiXem} onClick={(e) => {
            const b = (e.currentTarget as HTMLElement).getBoundingClientRect();
            datChonToa(toa, { menu: { loai: 'o', khoa: dsO[0], x: b.left, y: b.bottom + 4 } });
          }}>{t('oc.doiCongNang')} ▾</button>
          <button type="button" class="nut-phu" onClick={() => { chonCan(null); datChonToa(toa, { ds: [] }); }}>{t('oc.boChon')}</button>
        </div>
      )}
      <div class="boc-ve" ref={boc} onPointerDownCapture={batDauKhung} onClickCapture={(e) => { if (nuotClick.current) { e.stopPropagation(); e.preventDefault(); } }}>
        <BanVe khung={khung} nhan={t('tang.banVe')} onDieuKhien={setDk} gocBac={toa.gocDo}>
          <MatBangTang mau={mau} toa={bc} tv={tv} hinh={hinh} kieu={cai.kieu} noiThat={cai.noiThat} hienTem={cai.hienTem} canKhoa={canKhoa}
            onChonO={onChonO} dsChon={co.ds} onMenu={onMenu} loiTT={(k) => thongTinLoi(toa, k)} loiKhoa={menu?.loai === 'loi' ? menu.khoa : null}
            nhanCongNang={(cn) => t(`oc.nhan.${cn}`)}
            deBai={cai.chamMau ? lo?.temDat.deBai?.dtCan : undefined} nguongDt={pa.nguong.dtCanM2} />
        </BanVe>
      </div>
      {khungChon && (
        <div class="khung-chon" aria-hidden="true" style={{
          left: `${Math.min(khungChon.x0, khungChon.x1)}px`, top: `${Math.min(khungChon.y0, khungChon.y1)}px`,
          width: `${Math.abs(khungChon.x1 - khungChon.x0)}px`, height: `${Math.abs(khungChon.y1 - khungChon.y0)}px`,
        }} />
      )}
      {menu?.loai === 'o' && (
        <MenuCongNang x={menu.x} y={menu.y} dong={dongMenu} soO={dsO.length} hienTai={cnChon.length === 1 ? cnChon[0] : null} phamVi={phamVi} chiXem={chiXem}
          chon={(cn) => suaCongNang(p, toa, co.tangs, dsO, cn)} />
      )}
      {menu?.loai === 'loi' && (
        <MenuLoi x={menu.x} y={menu.y} dong={dongMenu} tt={thongTinLoi(toa, menu.khoa)} chiXem={chiXem}
          doi={(tt) => p.sua((q) => doiToa(q, toa.id, (x) => datLoi(x, menu.khoa, tt)))} />
      )}
      <div class="noi-duoi">
        <ThanhHienThi nhan={t('ht.nhom')} nut={[
          { khoa: 'phong', nhan: t('ht.phong'), onClick: () => dk?.phong() },
          { khoa: 'thu', nhan: t('ht.thu'), onClick: () => dk?.thu() },
          { khoa: 'vua', nhan: t('ht.vua'), onClick: () => dk?.vuaKhung() },
          { khoa: 'tem', nhan: t('tang.hienTem'), bat: cai.hienTem, onClick: () => datCaiTang({ hienTem: !cai.hienTem }) },
          { khoa: 'noi', nhan: t('tang.noiThat'), bat: cai.noiThat, onClick: () => datCaiTang({ noiThat: !cai.noiThat }) },
        ]} />
      </div>
    </>
  );
}

/** Panel phải: căn trong tòa so với mục tiêu, công năng ô + SHCĐ, loại căn trong tầng, căn đang chọn. */
export function TangPhai(p: ChungTang) {
  const { pa, sua, chiXem, tv, canKhoa, chonCan } = p;
  const cai = useCaiTang();
  const [mo3d, setMo3d] = useState(false);
  const xem = toaDangXem(pa, tv, p.loId, p.toaId);
  const co = useChonO(xem?.toa ?? null);
  const k0 = tangXem(co.tangs);
  const bc = useMemo(() => (xem ? boCucTang(xem.toa, k0) : null), [xem?.toa, k0]);
  const sl = useMemo(() => (xem && tv && bc ? soLieuTang(xem.mau, bc, tv) : null), [xem?.mau, bc, tv]);
  const hl = useMemo(() => (xem ? dtHanhLangTang(xem.mau) : null), [xem?.mau]);
  if (!tv || !xem || !sl || !hl || !bc) return null;
  const { toa, mau, lo } = xem;
  const m2 = { donVi: 'm²' };
  const muc = mucTieuTang(toa, lo, co.tangs);
  const coRiengCC = !!coCauRiengTang(toa, k0);
  const dem = demLoai(sl.can, tv);
  const tong = LOAI_CAN.reduce((a, k) => a + dem[k], 0);
  const pct = phanTram(dem);
  const deBai = lo?.temDat.deBai?.dtCan ?? {};
  const caToa = Object.values(demCan(pa, tv)[toa.id] ?? {}).reduce((a, b) => a + b, 0);
  const phamVi = nhanPhamVi(co.tangs, toa.soTangDe);

  // công năng ô + SHCĐ (S10)
  const dtCN = dtCongNangToa(toa, tv);
  const shToa = kiemShcd(pa, tv, (x) => x.id === toa.id);
  const shLo = kiemShcd(pa, tv, (x) => x.loId === toa.loId);

  // loại căn trong tầng: theo mẫu căn đang dùng (bỏ ô đổi công năng)
  const theoMau = new Map<string, number>();
  sl.can.forEach((c) => c.cn === 'can' && theoMau.set(c.canId, (theoMau.get(c.canId) ?? 0) + 1));
  const dtTim = Object.fromEntries([...theoMau.keys()].map((id) => [id, tv.can.get(id)?.dt_tim_m2 ?? 0]));
  const chung = phanChungPhanBo(hl.m2, Object.fromEntries(theoMau), dtTim);
  const dsMau = [...theoMau].map(([id, n]) => ({ id, n, c: tv.can.get(id)! })).filter((x) => x.c)
    .sort((a, b) => LOAI_CAN.indexOf(a.c.loai) - LOAI_CAN.indexOf(b.c.loai) || a.c.id.localeCompare(b.c.id));

  const chon = sl.can.find((c) => c.vt.khoa === canKhoa);
  const cChon = chon && tv.can.get(chon.canId);
  const doi = (canMoi: string) => chon && sua((q) => doiToa(q, toa.id, (x) =>
    co.tangs ? doiCanTheoTang(x, co.tangs, chon.vt, canMoi, sl.vts, cai.suaNhieu) : doiCanTaiViTri(x, chon.vt, canMoi, sl.vts, cai.suaNhieu)));
  const dsO = oDangChon(canKhoa, co.ds);
  const dongSh = (nhan: string, k: typeof shToa) => (
    <div class="dong"><span>{nhan}</span><b class={k.m2MoiCan === null ? '' : LOP_MUC[k.muc]}>{k.m2MoiCan === null ? '—' : fmtSo(k.m2MoiCan, { thapPhan: 2, donVi: t('oc.sh.donVi') })}</b></div>
  );

  return (
    <>
      <MucGap tieuDe={`${t('tang.canTrongToa')} · ${tenNgan(mau.ten_vi)}${k0 !== null ? ' · ' + tenTang(toa.soTangDe, k0) : ''}`} giaiThich={t('gt.tang.canTrongToa')} mo>
        <div class="bang-co-cau" role="table">
          <div class="dong bang-cc dau" style={{ gridTemplateColumns: '1.3fr 1fr 1fr 1fr 1fr' }} role="row"><span /><span>{t('tang.canTang')}</span><span>{t('xep.tyLe')}</span><span>{t('xep.mucTieu')}</span><span>{t('xep.lech')}</span></div>
          {LOAI_CAN.map((k) => {
            const l = tong ? pct[k] - muc[k] : 0;
            return (
              <div class="dong bang-cc" style={{ gridTemplateColumns: '1.3fr 1fr 1fr 1fr 1fr' }} role="row" key={k}>
                <span><i class="o-mau" style={{ background: `var(--u-${k})` }} /> {NHAN_LOAI[k]}</span>
                <span>{fmtSo(dem[k])}</span><span>{fmtSo(pct[k], { thapPhan: 1 })}</span><span>{fmtSo(muc[k], { thapPhan: 1 })}</span>
                <span class={Math.abs(l) > pa.nguong.coCauDiem ? 'vuot' : 'ok'}>{tong ? `${l > 0 ? '+' : ''}${fmtSo(l, { thapPhan: 1 })}` : '—'}</span>
              </div>
            );
          })}
        </div>
        <div class="dong"><span>{t('xep.diemLech')}</span><b>{tong ? fmtSo(diemLechCoCau(pct, muc), { thapPhan: 1 }) : '—'}</b></div>
        {coRiengCC && <p class="dong muted" style={{ margin: 0 }}>{t('oc.cc.dangDungRieng').replace('{v}', phamVi)}</p>}
        <div class="dong"><span>{t('tang.soCanToa')}</span><b>{fmtSo(caToa)} {t('sc.can')}</b></div>
      </MucGap>

      <MucGap tieuDe={t('oc.sh.tieuDe')} mo>
        {(['shcd', 'ky_thuat', 'thuong_mai', 'trong'] as const).map((k) => (
          <div class="dong" key={k}><span><i class={`o-mau-cn o-mau-${k}`} aria-hidden="true" /> {t(`oc.${k}`)}</span><b>{fmtSo(dtCN[k], { thapPhan: 1, ...m2 })}</b></div>
        ))}
        {dongSh(t('oc.sh.toa'), shToa)}
        {dongSh(t('oc.sh.lo'), shLo)}
        <p class="dong muted" style={{ margin: 0 }}>{t('oc.sh.nguong').replace('{n}', fmtSo(shToa.nguong, { thapPhan: 1 })).replace('{c}', shToa.canCu)}</p>
        <p class="dong muted" style={{ margin: 0 }}>{t('oc.sh.cum')} {t('oc.sh.dtGhiChu')}</p>
      </MucGap>

      <MucGap tieuDe={t('tang.loaiCanTrongTang')} giaiThich={t('gt.tang.loaiCanTrongTang')} mo>
        <div class="bang-nhap-nho" role="table">
          <div class="dong hang-lc hang-lc7 dau" role="row"><span>{t('tang.mauCan')}</span><span>{t('tang.soCan')}</span><span>{t('tang.thongThuy')}</span><span>{t('tang.timTuong')}</span><span>{t('tang.phanChung')}</span><span class="tieu-co-tip" title={t('tang.dtBanGhiChu')}>{t('tang.banDT')}</span><span class="tieu-co-tip" title={t('tang.dtBanGhiChu')}>{t('tang.heSoTt')}</span></div>
          {dsMau.map(({ id, n, c }) => {
            const db = deBai[c.loai];
            return (
              <div class={`dong hang-lc hang-lc7${chon?.canId === id ? ' chon' : ''}`} role="row" key={id}>
                <span><i class="o-mau" style={{ background: KIEU_MB.leo.u[c.loai] }} /> {c.ten_vi}</span>
                <span>{n}</span>
                <span>{fmtSo(c.dt_tt_m2, { thapPhan: 2 })}{db ? <small class={Math.abs(c.dt_tt_m2 - db) <= pa.nguong.dtCanM2 ? 'ok' : 'vuot'}> ({c.dt_tt_m2 - db > 0 ? '+' : ''}{fmtSo(c.dt_tt_m2 - db, { thapPhan: 1 })})</small> : null}</span>
                <span>{fmtSo(c.dt_tim_m2, { thapPhan: 2 })}</span>
                <span>{hl.uocTinh ? '≈ ' : ''}{fmtSo(chung[id] ?? 0, { thapPhan: 1 })}</span>
                <span>{hl.uocTinh ? '≈ ' : ''}{fmtSo(c.dt_tt_m2 + (chung[id] ?? 0), { thapPhan: 1 })}</span>
                <span>{c.dt_tim_m2 > 0 ? fmtSo(c.dt_tt_m2 / c.dt_tim_m2, { thapPhan: 2 }) : '—'}</span>
              </div>
            );
          })}
        </div>
        <p class="dong muted" style={{ margin: 0 }}>{t('tang.phanChungGhiChu').replace('{m}', fmtSo(hl.m2, { thapPhan: 1 }))}{hl.uocTinh ? ` ${t('tang.uocTinh')}` : ''}</p>
      </MucGap>

      <MucGap tieuDe={t('tt.tieuDe')} mo>
        {tv.toa.get(toa.mauId) && <BangTuanThu pa={pa} sua={sua} chiXem={chiXem} toa={toa} mau={tv.toa.get(toa.mauId)!} tv={tv} />}
      </MucGap>

      <MucGap tieuDe={chon ? `${t('tang.canDangChon')} · CH-${String(chon.no).padStart(2, '0')}${dsO.length > 1 ? ` (+${dsO.length - 1})` : ''}` : t('tang.canDangChon')} giaiThich={t('gt.tang.canDangChon')} mo>
        {!chon || !cChon ? <p class="dong muted">{t('tang.chonMotCan')}</p> : (
          <>
            <div class="dong"><span>{t('oc.congNang')}</span><b>{t(`oc.${chon.cn}`)}</b></div>
            <div class="dong" style={{ flexWrap: 'wrap', gap: '4px' }}>
              {(['can', 'shcd', 'ky_thuat', 'thuong_mai', 'trong'] as const).filter((cn) => cn !== chon.cn).map((cn) => (
                <button type="button" key={cn} class="nut-phu nut-cn" disabled={chiXem} onClick={() => suaCongNang(p, toa, co.tangs, dsO, cn)}>
                  <i class={`o-mau-cn o-mau-${cn}`} aria-hidden="true" /> {cn === 'can' ? t('oc.traLaiCan') : t(`oc.${cn}`)}
                </button>
              ))}
            </div>
            <p class="dong muted" style={{ margin: 0 }}>{t('oc.apCho').replace('{v}', phamVi)}{dsO.length > 1 ? ` · ${t('oc.soO').replace('{n}', String(dsO.length))}` : ''}</p>
            {chon.cn !== 'can' ? <p class="dong muted" style={{ margin: 0 }}>{t('oc.khongTinhCan')}</p> : (
              <>
                <div class="dong"><span>{t('tang.mauCan')}</span><b>{cChon.ten_vi}</b></div>
                <div class="dong"><span>{t('tang.loai')}</span><b>{NHAN_LOAI[cChon.loai]} · {t('tang.loaiN').replace('{n}', String(sl.loai.get(chon.canId)))}</b></div>
                <div class="dong"><span>{t('tang.kichThuoc')}</span><b>{fmtSo(cChon.rong_mm / 1000, { thapPhan: 1 })} × {fmtSo(cChon.sau_mm / 1000, { thapPhan: 1 })} m</b></div>
                <div class="dong"><span>{t('tang.thongThuy')}</span><b>{fmtSo(cChon.dt_tt_m2, { thapPhan: 2, ...m2 })}</b></div>
                <div class="dong"><span>{t('tang.timTuong')}</span><b>{fmtSo(cChon.dt_tim_m2, { thapPhan: 2, ...m2 })}</b></div>
                {deBai[cChon.loai] ? <div class="dong"><span>{t('xep.dtDeBai')}</span><b>{fmtSo(deBai[cChon.loai]!, { thapPhan: 1, ...m2 })}</b></div> : null}
                {(() => {
                  const ung = ungVienDoi(chon.canId, tv);
                  return (
                    <>
                      <p class="dong muted" style={{ margin: 0 }}>{t(cai.suaNhieu ? 'tang.doiNhieu' : 'tang.doiMot')}</p>
                      {!ung.length && <p class="dong muted" style={{ margin: 0 }}>{t('tang.khongCoMauDoi')}</p>}
                      {ung.map((c) => (
                        <button type="button" key={c.id} class="muc-lo" disabled={chiXem} onClick={() => doi(c.id)}>
                          <b>{c.ten_vi} · {NHAN_LOAI[c.loai]}</b>
                          <span>{fmtSo(c.dt_tt_m2, { thapPhan: 2, ...m2 })}{c.vi_tri !== cChon.vi_tri ? ` · ⚠ ${t('tang.khacViTri')}` : ''}</span>
                        </button>
                      ))}
                      {chon.vt.canGocId !== chon.canId && (
                        <button type="button" class="nut-phu" disabled={chiXem} style={{ margin: '4px 12px' }} onClick={() => doi(chon.vt.canGocId)}>{t('tang.doiVeGoc')}</button>
                      )}
                    </>
                  );
                })()}
              </>
            )}
            <div class="dong">
              {chon.cn === 'can' && <button type="button" class="nut-chinh" onClick={() => setMo3d(true)}>{t('m3d.xemCan')}</button>}
              <button type="button" class="nut-phu" onClick={() => { chonCan(null); if (xem) datChonToa(toa, { ds: [] }); }}>{t('tang.boChon')}</button>
            </div>
            {mo3d && (
              <div class="hop-3d" role="dialog" aria-modal="true" aria-label={t('m3d.xemCan')} onClick={(e) => { if (e.target === e.currentTarget) setMo3d(false); }}>
                <div class="hop-3d-trong">
                  <button type="button" class="dong-hop" onClick={() => setMo3d(false)} aria-label={t('m3d.dong')}>×</button>
                  <MoHinhCan canId={chon.canId} ten={`CH-${String(chon.no).padStart(2, '0')} · ${cChon.ten_vi}`} />
                </div>
              </div>
            )}
          </>
        )}
      </MucGap>
    </>
  );
}
