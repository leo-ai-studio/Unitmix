import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { demCan, diemLechCoCau, phanTram } from '../tinh/coCau';
import { dtCongNangToa, kiemShcd } from '../tinh/congNang';
import { apDoiViTri, apDoiViTriTang, boTangRieng, datCoCauTang, datLoi, doiCanTaiViTri, doiCanTheoTang, doiCongNang, dsMauDoiCan, thongTinLoi, veMauGoc, veMauGocMB } from '../tinh/doiCan';
import { LOAI_CAN, type BaoCaoTuChinh, type CongNangO, type Lo, type LoaiCan, type ThuVien, type ToaDat, type TrangThaiPA } from '../tinh/kieu';
import { boCucTang, canDangDung, coCauRiengTang, coMat, ghiDeTang, tangCoRieng, viTriCan, type BoCuc } from '../tinh/matBang';
import { dtHanhLangTang, phanChungPhanBo } from '../tinh/phanChung';
import { toiUuCoCau } from '../tinh/toiUu';
import { BanVe, khungBao, type DieuKhienVe } from '../ve/BanVe';
import { idLoi, taiCuaCan, useHinhHoc } from '../ve/hinhHocThuVien';
import { chieuCaoPCCC } from '../tinh/pccc';
import { DS_KIEU_MB, KIEU_MB, NHAN_LOAI } from '../ve/kieuMb';
import { MatBangTang, soLieuTang, type ToaVe } from '../ve/MatBangTang';
import { BangTuanThu } from '../ui/BangTuanThu';
import { MenuCongNang, MenuLoi } from '../ve/MenuO';
import { ChonTang, nhanPhamVi, tenTang } from '../ui/ChonTang';
import { nutLopPhong } from '../ve/LopPhong';
import { MucGap } from '../ui/MucGap';
import { toaNhanSua } from '../tinh/lanTruyenBoCuc';
import { LopNoi } from '../ui/LopNoi';
import { GocBanVe } from '../ui/GocBanVe';
import { fmtSo } from '../ui/so';
import { MoHinhCan, MoHinhChinh, type Chon3D } from '../ve3d/MoHinh3D';
import { datCaiTang, useCaiTang } from './caiTang';
import { datBaoStretch, useBaoStretch } from './baoStretch';
import { mauCuaToa, suaTuChinh, useDuLieuMB } from './tuChinhTang';
import { daGiacCacLoi, matBangRiengTang, type ChanSua, type ToaMB } from '../tinh/loiThang';
import { datTemCan, hopCacTem } from '../tinh/temCan';
import { ST_BUOC, stretchKhongBu, tachMa } from '../tinh/stretch';
import { goiYVuaO } from '../tinh/goiYVuaO';
import { ThanhCongCuTang, useKeoHanhLang, useKeoTay, useToaTam, type ChoSang, type PropsCongCu } from './CongCuTang';
import { TayHanhLang } from '../ve/TayHanhLang';
import { mauToa } from '../tinh/canThem';
import { KpiTang } from '../ui/KpiTang';
import { batLopPCCC, ChuGiaiPCCC, LopPCCC, nutLopPCCC, useCaiPCCC, usePCCCTang } from '../ve/LopPCCC';
import { KhoiPCCC } from '../ui/KpiPCCC';
import { ChuGiaiViewTang, LopViewTang } from '../ve/LopViewTang';
import { gocBacPA, nutLopView } from './lopView';
import { nhanToa } from '../ui/nhanToa';

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

/**
 * Tòa đang xem tầng: tòa đã chọn, không thì tòa đầu của lô đang làm, không thì tòa đầu tiên. `mau` = mặt bằng hiệu dụng của tầng
 * đang xem (tầng riêng có mặt bằng tự chỉnh riêng thì theo nó); `mauTang` cho 3D / xuất CAD dựng từng tầng.
 */
export function toaDangXem(pa: TrangThaiPA, tv: ThuVien | null, loId: string | null, toaId: string | null): { toa: ToaDat; mau: ToaVe; lo: Lo | undefined; mauTang: (tang: number | null) => ToaVe } | null {
  if (!tv) return null;
  const co = pa.toa.filter((x) => tv.toa.has(x.mauId) && coMat(mauToa(tv, x)!));
  const toa = co.find((x) => x.id === toaId) ?? co.find((x) => x.loId === loId) ?? co[0];
  if (!toa) return null;
  const goc = mauToa(tv, toa) as ToaVe;
  const tang = chonO.toaId === toa.id ? tangXem(chonO.tangs?.filter((k) => k <= toa.soTangDH) ?? null) : null;
  return { toa, mau: mauCuaToa(toa, goc, tang), lo: pa.lo.find((l) => l.id === toa.loId), mauTang: (k) => mauCuaToa(toa, goc, k) };
}

// ---- Trạng thái chọn của màn Tầng (dùng chung panel trái, bản vẽ, panel phải; không lưu vào PA) ----
type MenuMo = { loai: 'o' | 'loi'; khoa: string; x: number; y: number };
/** `thang`: ô thang bộ đang chọn (công cụ tay: thêm sau / xoá / dời thang). */
type ChonO = { toaId: string | null; tangs: number[] | null; ds: string[]; menu: MenuMo | null; thang?: string | null };
let chonO: ChonO = { toaId: null, tangs: null, ds: [], menu: null, thang: null };
const ngheO = new Set<() => void>();
const datChonO = (p: Partial<ChonO>) => { chonO = { ...chonO, ...p }; ngheO.forEach((f) => f()); };
/** Tầng / ô đang chọn ở màn Tầng (store cấp module); SoanThao đọc để ghi breadcrumb. */
export function useChonO(toa: ToaDat | null): ChonO {
  const [, ve] = useState(0);
  useEffect(() => {
    const f = () => ve((n) => n + 1);
    ngheO.add(f);
    return () => void ngheO.delete(f);
  }, []);
  // đổi tòa thì về bố cục chung, bỏ chọn nhiều; tầng chọn vượt số tầng điển hình thì bỏ
  if (!toa || chonO.toaId !== toa.id) return { toaId: toa?.id ?? null, tangs: null, ds: [], menu: null, thang: null };
  const tangs = chonO.tangs?.filter((k) => k <= toa.soTangDH) ?? null;
  return { ...chonO, tangs: tangs?.length ? tangs : null };
}
const datChonToa = (toa: ToaDat, p: Partial<ChonO>) => datChonO({ ...(chonO.toaId === toa.id ? {} : { tangs: null, ds: [], menu: null, thang: null }), toaId: toa.id, ...p });
/** Chọn tầng điển hình đang xem của tòa từ ngoài màn Tầng (3D Công trình bấm căn / tầng): null = bố cục chung. Dùng được cả khi ô ChonTang chưa gắn. */
export const chonTangToa = (toa: ToaDat, tangs: number[] | null) => datChonToa(toa, { tangs, ds: [], menu: null });

/** Tầng điển hình đang xem của tòa (null = bố cục chung) — trợ lý Leo AI đọc. */
export const tangDangXem = (toaId: string | null): number[] | null => (toaId && chonO.toaId === toaId ? chonO.tangs : null);

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
  useDuLieuMB(tv, pa);
  const cai = useCaiTang();
  const [ghiChu, setGhiChu] = useState('');
  // Đổi khác bề ngang + STRETCH khi tối ưu (A8 · DC-04/05, như app cũ): mặc định bật
  const [doiRong, setDoiRong] = useState(true);
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
  const coRieng = tangCoRieng(toa);
  const coCauRieng = Object.keys(toa.tangRieng ?? {}).map(Number).filter((k) => ghiDeTang(toa, k)?.coCauMucTieu);
  const datTangs = (v: number[] | null) => { datChonToa(toa, { tangs: v, ds: [], menu: null }); setGhiChu(''); };
  const datMucRieng = (k: LoaiCan, v: number) => sua((q) => doiToa(q, toa.id, (x) => datCoCauTang(x, tangs!, { ...muc, [k]: Math.max(0, v) })));
  const coDoiCan = Object.keys(toa.canTheo).length > 0 || !!toa.canViTri || Object.values(toa.tangRieng ?? {}).some((g) => g.canViTri);
  return (
    <>
      <MucGap tieuDe={`${t('tang.toa')} · ${pa.toa.length}`} giaiThich={t('gt.tang.toa')} mo>
        {pa.toa.map((x) => {
          const m = mauToa(tv, x);
          return (
            <button type="button" key={x.id} class={`muc-lo${x.id === toa.id ? ' chon' : ''}`} aria-pressed={x.id === toa.id} onClick={() => { chonToa(x.id); chonCan(null); setGhiChu(''); }}>
              <b>{nhanToa(pa, tv, x.id, { lo: true })}</b>
              {/* Số căn/tầng theo mặt bằng đã tự chỉnh (căn bị gỡ vì thoát nạn không còn tính), không theo mẫu thư viện. */}
              <span>{x.soTangDe} + {x.soTangDH} T · {t('xep.canTang').replace('{n}', String(m && coMat(m) ? soLieuTang(mauCuaToa(x, m as ToaVe), boCucTang(x, null), tv).can.filter((c) => c.cn === 'can').length : 0))}</span>
            </button>
          );
        })}
      </MucGap>
      <MucGap tieuDe={t('tang.phamVi.tieuDe')} giaiThich={t('tang.phamVi.gt')} mo>
        <div class="pham-vi-sua" role="radiogroup" aria-label={t('tang.phamVi.tieuDe')}>
          {(['toa', 'lo', 'duAn'] as const).map((k) => {
            const n = toaNhanSua(pa, toa, k).length;
            return (
              <label key={k} class={k !== 'toa' && !n ? 'tat' : ''}>
                <input type="radio" name="pham-vi-sua" checked={cai.phamViSua === k} disabled={chiXem || (k !== 'toa' && !n)} onChange={() => datCaiTang({ phamViSua: k })} />
                <span>{t(`tang.phamVi.${k}`).replace('{n}', String(n))}</span>
              </label>
            );
          })}
        </div>
        <p class="dong muted" style={{ margin: '6px 0 0' }}>{t('oc.tr.tieuDe')} · {nhanPhamVi(tangs, toa.soTangDe)}</p>
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
          <button type="button" class="nut-chinh" title={chiXem ? t('soan.chiXem') : t('gt.tang.toiUu')} disabled={chiXem}
            onClick={async () => {
              const cuaCan = await taiCuaCan(tv, mau.nhom);
              const kq = toiUuCoCau(mau, bc, tv, muc, {
                doiBeNgang: doiRong, cuaCan, dtDeBai: lo?.temDat.deBai?.dtCan,
                chieuCaoPCCC: chieuCaoPCCC(toa.soTangDe, toa.caoDe, toa.soTangDH, toa.caoDH),
              });
              const vts = viTriCan(mau, tv);
              suaTuChinh(sua, tv, toa.id, { tay: false })((q) => doiToa(q, toa.id, (x) => (tangs ? apDoiViTriTang(x, tangs, kq.canViTri, vts) : apDoiViTri(x, kq.canViTri))));
              setGhiChu(kq.soDoi ? t('tang.daToiUu').replace('{n}', String(kq.soDoi)).replace('{a}', fmtSo(kq.diemTruoc, { thapPhan: 1 })).replace('{b}', fmtSo(kq.diemSau, { thapPhan: 1 }))
                + (kq.soDoiRong ? ' ' + t('tang.doiRongKq').replace('{n}', String(kq.soDoiRong)) : '')
                + (kq.pcccSau !== null ? ' ' + t('tang.pcccKq').replace('{a}', String(kq.pcccTruoc)).replace('{b}', String(kq.pcccSau)) : '') : t('tang.khongDoiDuoc'));
            }}>{t('tang.toiUu')}{tangs ? ` · ${nhanPhamVi(tangs, toa.soTangDe)}` : ''}</button>
          <label class="o-tg" title={t('gt.tang.doiRong')}><input type="checkbox" disabled={chiXem} checked={doiRong} onChange={(e) => setDoiRong(e.currentTarget.checked)} /><span>{t('tang.doiRong')}</span></label>
          <button type="button" class="nut-phu" title={chiXem ? t('soan.chiXem') : t('gt.tang.veGoc')} disabled={chiXem || !coDoiCan}
            onClick={() => { suaTuChinh(sua, tv, toa.id, { tay: false })((q) => doiToa(q, toa.id, veMauGoc)); setGhiChu(''); }}>{t('tang.veGoc')}</button>
          <button type="button" class="nut-phu" title={chiXem ? t('soan.chiXem') : t('gt.tang.veGocMB')} disabled={chiXem}
            onClick={() => { suaTuChinh(sua, tv, toa.id, { tay: false })((q) => doiToa(q, toa.id, veMauGocMB)); setGhiChu(t('tang.daVeGocMB')); }}>{t('tang.veGocMB')}</button>
        </div>
        {ghiChu && <p class="dong canh-bao" role="status" style={{ margin: 0 }}>{ghiChu}</p>}
      </MucGap>
      {/* Gọn: tem căn / nội thất / chấm màu ở nút Lớp góc bản vẽ; hướng dẫn chọn ô nằm trong tooltip — mục này gập mặc định. */}
      <MucGap tieuDe={t('tang.hienThi')} giaiThich={`${t('gt.tang.hienThi')} ${t('oc.goiYChon')}`}>
        <label class="o-chon" title={t('gt.tang.kieu')}><span>{t('tang.kieu')}</span>
          <select value={cai.kieu} onChange={(e) => datCaiTang({ kieu: e.currentTarget.value as typeof cai.kieu })}>
            {DS_KIEU_MB.map((k) => <option value={k}>{t(`kieu.${k}`)}</option>)}
          </select>
        </label>
        {([['suaNhieu', 'tang.suaNhieu']] as const).map(([k, nhan]) => (
          <label class="o-tg" key={k} title={t(`gt.${nhan}`)}><input type="checkbox" checked={cai[k]} onChange={(e) => datCaiTang({ [k]: e.currentTarget.checked })} /><span>{t(nhan)}</span></label>
        ))}
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
export function TangMoHinh(p: ChungTang & { tenDuAn: string; chon3d?: Chon3D }) {
  const xem = toaDangXem(p.pa, p.tv, p.loId, p.toaId);
  if (!p.tv) return <div class="giua-man"><img class="spin-o" src="/brand/leo_ai_o.png" alt="" /><span>{t('lo.dangTaiThuVien')}</span></div>;
  return <MoHinhChinh pa={p.pa} tv={p.tv} sua={p.sua} chiXem={p.chiXem} toa={xem?.toa ?? null} mau={xem ? xem.mauTang(null) : null} mauTang={xem?.mauTang} tenDuAn={p.tenDuAn} chon3d={p.chon3d} />;
}

/** Đổi công năng các ô trên phạm vi đang chọn (chung hoặc các tầng). */
const suaCongNang = (p: Pick<ChungTang, 'sua' | 'tv'>, toa: ToaDat, tangs: number[] | null, khoas: string[], cn: CongNangO) =>
  (p.tv ? suaTuChinh(p.sua, p.tv, toa.id) : p.sua)((q) => doiToa(q, toa.id, (x) => doiCongNang(x, tangs, khoas, cn)));

type KhungChon = { x0: number; y0: number; x1: number; y1: number };

const baoChanDoiCho = (tv: ThuVien, can: ReturnType<typeof soLieuTang>['can']) => (ds: ChanSua[]) => {
  const m = (mm: number) => fmtSo(mm / 1000, { thapPhan: 1 });
  const ten = (k: string) => { const x = can.find((c) => c.vt.khoa === k); return x ? `CH-${String(x.no).padStart(2, '0')}` : k; };
  // Gợi ý mẫu khác loại vừa ô (cùng nhóm / vị trí / chiều sâu, rộng ≤ ô + STRETCH tối đa) — chỉ gợi ý, không tự đổi.
  const goiY = (c: ChanSua) => {
    const tot = goiYVuaO(tv, can.find((x) => x.vt.khoa === c.khoa)?.canId ?? '', c.loai, c.rongO);
    return tot.length ? ' ' + t('tc.chan.goiY').replace('{ds}', tot.map((x) => `${tenNgan(x.ten_vi)} (${m(x.rong_mm)} m)`).join(', ')) : '';
  };
  datBaoStretch({ loai: 'loi', chu: ds.map((c) => t(`tc.chan.${c.kieu}`).replace('{l}', t(`loai.${c.loai}`)).replace('{x}', m(c.rongO)).replace('{y}', m(c.rongMin))
    + (ds.length > 1 ? ` (${ten(c.khoa)})` : '') + goiY(c)).join(' · ') + ' ' + t('tc.chan.giu') });
};

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
  const pccc = usePCCCTang(pa, tv, toa, mau, bc); // lớp PCCC (ve/LopPCCC.tsx), cùng mặt bằng KPI dùng
  // phép tay đang chạy nền: vẽ mặt bằng tạm (phần hình học nhanh, chưa tự chỉnh); công cụ tay vẫn dựa trên tòa trong PA
  const tam = useToaTam(toa);
  const mauVe = useMemo(() => (tam ? mauCuaToa(tam, mauToa(tv, tam) as ToaVe, k0) : mau), [tam, mau, tv, k0]);
  const bcVe = useMemo(() => (tam ? boCucTang(tam, k0) : bc), [tam, bc, k0]);
  const loiIds = useMemo(() => mau.mat.flatMap((m) => m.phan_tu.filter((q) => q.loai !== 'can').map((q) => idLoi(q.block))), [mau]);
  const hinh = useHinhHoc(sl.can.map((c) => c.canId), loiIds, tv);
  // lõi là vật cản khi đặt tem (QT-34): hình lõi có khi đã nạp DuLieuMB (cùng lúc mặt bằng tự chỉnh)
  const dlMB = useDuLieuMB(tv);
  const loiDG = useMemo(() => daGiacCacLoi(mau as unknown as ToaMB, dlMB), [mau, dlMB]);
  const loiDGVe = useMemo(() => (mauVe === mau ? loiDG : daGiacCacLoi(mauVe as unknown as ToaMB, dlMB)), [mauVe, mau, loiDG, dlMB]);
  // vừa khung = nét bao + 6 m, nới thêm cho tem bị dời ra hàng ngoài (QT-34) để tem không nằm dưới la bàn / thanh công cụ
  const hopTem = useMemo(() => (cai.hienTem ? hopCacTem(datTemCan(mau, tv, sl.can, loiDG)) : null), [cai.hienTem, mau, tv, sl.can, loiDG]);
  const khung = useMemo(() => {
    const k = khungBao([mau.duong_bao.map(([x, y]): [number, number] => [x / 1000, y / 1000])]);
    if (!k) return null;
    const h = hopTem ? [hopTem[0] / 1000 - 1.5, hopTem[1] / 1000 - 1.5, hopTem[2] / 1000 + 1.5, hopTem[3] / 1000 + 1.5] : null;
    return [Math.min(k[0] - 6, h?.[0] ?? Infinity), Math.min(k[1] - 6, h?.[1] ?? Infinity), Math.max(k[2] + 6, h?.[2] ?? -Infinity), Math.max(k[3] + 6, h?.[3] ?? -Infinity)] as [number, number, number, number];
  }, [mau, hopTem]);
  const dsO = oDangChon(canKhoa, co.ds);
  // tab "Đổi căn" của menu ô: mọi ô đang chọn đều là căn cùng mẫu gốc — đổi ĐÚNG những ô đang chọn (trừ khi bật "Sửa nhiều căn")
  const canChonO = dsO.map((k) => sl.can.find((c) => c.vt.khoa === k));
  const oMenu = canChonO.length && canChonO.every((c) => c && c.cn === 'can' && c.vt.canGocId === canChonO[0]!.vt.canGocId) ? canChonO[0] : undefined;
  const doiO = (canMoi: string) => suaTuChinh(p.sua, tv, toa.id, { baoChan: baoChanDoiCho(tv, sl.can) })((q) => doiToa(q, toa.id, (x0) =>
    canChonO.reduce((x, c) => (!c ? x : co.tangs ? doiCanTheoTang(x, co.tangs, c.vt, canMoi, sl.vts, cai.suaNhieu) : doiCanTaiViTri(x, c.vt, canMoi, sl.vts, cai.suaNhieu)), x0)));
  /** Chuột phải → chọn mọi căn cùng mẫu gốc với căn đang chọn (trong tầng đang xem); STRETCH sau đó áp cho cả nhóm. */
  const canChinh = sl.can.find((c) => c.vt.khoa === canKhoa && c.cn === 'can');
  const cungMau = canChinh ? sl.can.filter((c) => c.cn === 'can' && c.vt.canGocId === canChinh.vt.canGocId).map((c) => c.vt.khoa) : [];
  const chonCungMau = () => {
    chonCan(cungMau[0] ?? null);
    datChonToa(toa, { ds: cungMau.slice(1), menu: null, thang: null });
  };
  const soCanTang = sl.can.filter((c) => c.cn === 'can').length;
  const phamVi = nhanPhamVi(co.tangs, toa.soTangDe);
  const baoSt = useBaoStretch();

  const onChonO = (khoa: string, e: MouseEvent) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      const ds = dsO.includes(khoa) ? dsO.filter((k) => k !== khoa) : [...dsO, khoa];
      chonCan(ds[0] ?? null);
      datChonToa(toa, { ds: ds.slice(1), menu: null, thang: null });
      return;
    }
    datChonToa(toa, { ds: [], menu: null, thang: null });
    chonCan(khoa === canKhoa && !co.ds.length ? null : khoa);
  };
  const onChonThang = (khoa: string) => { chonCan(null); datChonToa(toa, { ds: [], menu: null, thang: co.thang === khoa ? null : khoa }); };
  // công cụ tay (sắp xếp / thêm / xoá / lật) — lớp phủ, kéo thả bám tay
  const [keoBat, setKeoBat] = useState(false);
  const [hienHL, setHienHL] = useState(true);
  const [choSang, setChoSang] = useState<ChoSang>(null);
  const ccProps: PropsCongCu = {
    pa, sua: p.sua, chiXem, tv, toa, mau, bc, can: sl.can, tangs: co.tangs, dsO, thangKhoa: co.thang ?? null,
    chonThang: (k) => datChonToa(toa, { thang: k }), chonCan: (k) => { chonCan(k); datChonToa(toa, { ds: [] }); },
    keoBat, datKeoBat: setKeoBat, hienHL, datHienHL: setHienHL, datChoSang: setChoSang,
  };
  const keoTay = useKeoTay(ccProps);
  const keoHL = useKeoHanhLang(ccProps);
  // lớp Thoát nạn bật: tô căn vượt cự ly (chỉ cảnh báo)
  const caiPC = useCaiPCCC();
  const canVuot = useMemo(() => (caiPC.thoatNan && pccc ? pccc.thoatNan.can.filter((x) => x.vuot).map((x) => x.khoa) : undefined), [caiPC.thoatNan, pccc]);
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
      <div class="boc-ve" ref={boc} onPointerDownCapture={(e) => { keoTay.batDau(e); batDauKhung(e); }} onClickCapture={(e) => { if (nuotClick.current) { e.stopPropagation(); e.preventDefault(); } }}>
        <BanVe khung={khung} nhanDang={`${toa.id}|${tangXem(co.tangs) ?? ''}`} nhan={t('tang.banVe')} onDieuKhien={setDk} gocBac={toa.gocDo - gocBacPA(pa)}>
          <MatBangTang mau={mauVe} toa={bcVe} tv={tv} hinh={hinh} kieu={cai.kieu} noiThat={cai.noiThat} hienTem={cai.hienTem} canKhoa={canKhoa}
            onChonO={onChonO} dsChon={co.ds} onMenu={onMenu} loiTT={(k) => thongTinLoi(toa, k)} loiKhoa={menu?.loai === 'loi' ? menu.khoa : null}
            nhanCongNang={(cn) => t(`oc.nhan.${cn}`)}
            deBai={cai.chamMau ? lo?.temDat.deBai?.dtCan : undefined} nguongDt={pa.nguong.dtCanM2}
            thangKhoa={co.thang ?? null} onChonThang={onChonThang} oDich={keoTay.oDich} dichLoi={keoTay.dichLoi} oKeo={keoTay.oKeo} hienHanhLang={hienHL} choSang={choSang} canVuot={canVuot} loiDaGiac={loiDGVe} />
          <g transform="scale(0.001 -0.001)"><LopPCCC kq={pccc} chiXem={chiXem} toa={toa}
            datTuTay={(ds) => p.sua((q) => doiToa(q, toa.id, (x) => ({ ...x, tuPCCCTay: ds ?? undefined })))}
            datCncTay={(ds) => p.sua((q) => doiToa(q, toa.id, (x) => ({ ...x, cncTay: ds ?? undefined })))} /></g>
          {!chiXem && !tam && <g transform="scale(0.001 -0.001)"><TayHanhLang mau={mauVe} hanhLangTay={toa.hanhLangTay} onKeo={keoHL} /></g>}
          <LopViewTang pa={pa} tv={tv} toa={toa} mau={mauVe} bc={bcVe} tang={k0} />
        </BanVe>
      </div>
      <ThanhCongCuTang {...ccProps} />
      <ChuGiaiViewTang pa={pa} />
      {keoTay.bongKeo}
      {baoSt && (
        <div key={baoSt.id} class={`lop-st-bao ${baoSt.loai}`} role={baoSt.loai === 'loi' ? 'alert' : 'status'}>
          <span>{baoSt.chu}</span>
          <button type="button" aria-label={t('m3d.dong')} onClick={() => datBaoStretch(null)}>×</button>
        </div>
      )}
      {khungChon && (
        <div class="khung-chon" aria-hidden="true" style={{
          left: `${Math.min(khungChon.x0, khungChon.x1)}px`, top: `${Math.min(khungChon.y0, khungChon.y1)}px`,
          width: `${Math.abs(khungChon.x1 - khungChon.x0)}px`, height: `${Math.abs(khungChon.y1 - khungChon.y0)}px`,
        }} />
      )}
      {menu?.loai === 'o' && (
        <MenuCongNang x={menu.x} y={menu.y} dong={dongMenu} soO={dsO.length} hienTai={cnChon.length === 1 ? cnChon[0] : null} phamVi={phamVi} chiXem={chiXem}
          cungMau={cungMau.length > 1 ? { n: cungMau.length, chon: chonCungMau } : undefined}
          chon={(cn) => suaCongNang(p, toa, co.tangs, dsO, cn)}
          doiCan={oMenu && oMenu.cn === 'can' ? { ds: dsMauDoiCan(tv, oMenu.vt.canGocId), dangDung: oMenu.canId, guong: oMenu.vt.guong, kieu: cai.kieu, noiThat: cai.noiThat, doi: (id) => doiO(id) } : undefined} />
      )}
      {menu?.loai === 'loi' && (
        <MenuLoi x={menu.x} y={menu.y} dong={dongMenu} tt={thongTinLoi(toa, menu.khoa)} chiXem={chiXem}
          doi={(tt) => p.sua((q) => doiToa(q, toa.id, (x) => datLoi(x, menu.khoa, tt)))} />
      )}
      <GocBanVe zoom={dk ? { phong: () => dk.phong(), thu: () => dk.thu(), vua: () => dk.vuaKhung() } : null} lop={[
        { khoa: 'tem', nhan: t('tang.hienTem'), bat: cai.hienTem, onClick: () => datCaiTang({ hienTem: !cai.hienTem }) },
        { khoa: 'noi', nhan: t('tang.noiThat'), bat: cai.noiThat, onClick: () => datCaiTang({ noiThat: !cai.noiThat }) },
        { khoa: 'cham', nhan: t('tang.chamMau'), bat: cai.chamMau, onClick: () => datCaiTang({ chamMau: !cai.chamMau }) },
        ...nutLopPhong(pa.nguong),
        ...nutLopPCCC(),
        nutLopView(),
      ]} chuGiai={batLopPCCC() ? <ChuGiaiPCCC kq={pccc} /> : undefined} />
    </>
  );
}

/**
 * Panel phải · gỡ căn vượt cự ly (app cũ giamCanThoatNan) + thang liền suốt chiều cao: dòng báo kết quả (số căn đổi / bỏ, căn và
 * cơ cấu trước → sau), nút tắt tự gỡ (giữ nguyên căn, chỉ báo vượt), chọn cách giữ thang liền khi tòa có tầng riêng.
 */
function KhoiGiamCan({ bcTc, toa, coRieng, chiXem, datToa, tenO, tenCan }: {
  bcTc: BaoCaoTuChinh | undefined; toa: ToaDat; coRieng: boolean; chiXem: boolean; datToa: (fn: (x: ToaDat) => ToaDat) => void;
  tenO: (khoa: string) => string; tenCan: (id: string) => string;
}) {
  const g = bcTc?.giamCan, l = bcTc?.thangLien, kk = bcTc?.khitKep;
  const bat = toa.giamCanTN === true;
  const coCau = g ? LOAI_CAN.filter((k) => g.coCauTruoc[k] || g.coCauSau[k]).map((k) => `${NHAN_LOAI[k]} ${g.coCauTruoc[k]}→${g.coCauSau[k]}`).join(' · ') : '';
  return (
    <div class="khoi-giam-can">
      {g && (g.bat ? (
        <>
          <p class={`dong ${g.vuotSau ? 'vuot' : 'muted'}`} role="status" style={{ margin: 0 }} title={t('tc.giam.gt')}>
            {t('tc.giam.tomTat').replace('{a}', String(g.vuotTruoc)).replace('{b}', String(g.vuotSau)).replace('{x}', String(g.xepLai))
              .replace('{d}', String(g.doi)).replace('{o}', String(g.bo)).replace('{c1}', String(g.soCanTruoc)).replace('{c2}', String(g.soCanSau))}
          </p>
          {(g.doi || g.bo || g.xepLai) ? <p class="dong muted" style={{ margin: 0 }}>{t('tc.giam.coCau').replace('{v}', coCau)}</p> : null}
        </>
      ) : <p class="dong vuot" role="status" style={{ margin: 0 }}>{t('tc.giam.tat').replace('{v}', String(g.vuotSau))}</p>)}
      <label class="o-tg" title={t('tc.giam.gt')}>
        <input type="checkbox" id="giam-can-tn" disabled={chiXem} checked={bat}
          onChange={(e) => { const on = e.currentTarget.checked; datToa((x) => ({ ...x, giamCanTN: on ? true : undefined })); }} />
        <span>{t('tc.giam.nut')}</span>
      </label>
      {l && (
        <p class={`dong ${l.conLech || l.khongDat ? 'canh-bao' : 'muted'}`} role="status" style={{ margin: 0 }} title={t('tc.lien.gt')}>
          {t('tc.lien.tomTat').replace('{m}', t(`tc.lien.${l.cheDo}`)).replace('{n}', String(l.soThang)).replace('{k}', String(l.soTang))}
          {l.nhuong ? t('tc.lien.nhuong').replace('{n}', String(l.nhuong)) : ''}
          {l.conLech ? t('tc.lien.lech').replace('{n}', fmtSo(l.conLech)) : ''}
          {l.khongDat ? t('tc.lien.khongDat').replace('{n}', String(l.khongDat)) : ''}
        </p>
      )}
      {kk && (kk.doi.length + kk.bo.length > 0 || kk.conMm > 0) && (
        <div class={`dong ${kk.conMm ? 'canh-bao' : 'muted'}`} role="status" title={t('tc.khit.gt')} id="khit-kep" style={{ flexDirection: 'column', gap: '2px' }}>
          <p style={{ margin: 0 }}>{t('tc.khit.tomTat').replace('{d}', String(kk.doi.length)).replace('{b}', String(kk.bo.length))}</p>
          <ul style={{ margin: 0, paddingLeft: '1.1em' }}>
            {kk.doi.map((d) => <li key={`d${d.khoa}`}>{t('tc.khit.doi').replace('{o}', tenO(d.khoa)).replace('{a}', tenCan(d.tu)).replace('{b}', tenCan(d.den))}</li>)}
            {kk.bo.map((b) => <li key={`b${b.khoa}`}>{t('tc.khit.bo').replace('{o}', tenO(b.khoa)).replace('{a}', tenCan(b.id))}</li>)}
          </ul>
          {kk.conMm ? <p style={{ margin: 0 }}>{t('tc.khit.con').replace('{n}', fmtSo(kk.conMm))}</p> : null}
        </div>
      )}
      {bcTc?.daiSan && (
        <p class="dong muted" role="status" id="dai-san" style={{ margin: 0 }} title={t('tc.san.gt')}>
          {t(bcTc.daiSan.mm >= 0 ? 'tc.san.dai' : 'tc.san.ngan').replace('{n}', String(bcTc.daiSan.so)).replace('{m}', fmtSo(Math.abs(bcTc.daiSan.mm)))}
        </p>
      )}
      {coRieng && (
        <label class="o-chon" title={t('tc.lien.gt')}><span>{t('tc.lien.cheDo')}</span>
          <select id="thang-lien" disabled={chiXem} value={toa.thangLien ?? 'hop'}
            onChange={(e) => { const v = e.currentTarget.value as 'hop' | 'chung'; datToa((x) => ({ ...x, thangLien: v === 'hop' ? undefined : v })); }}>
            <option value="hop">{t('tc.lien.hop')}</option>
            <option value="chung">{t('tc.lien.chung')}</option>
          </select>
        </label>
      )}
    </div>
  );
}

/** Panel phải: căn trong tòa so với mục tiêu, công năng ô + SHCĐ, loại căn trong tầng, căn đang chọn. */
export function TangPhai(p: ChungTang) {
  const { pa, sua, chiXem, tv, canKhoa, chonCan } = p;
  useDuLieuMB(tv);
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
  // báo cáo tự chỉnh: của tầng đang xem nếu tầng có mặt bằng riêng, không thì của bố cục chung
  const mbRieng = matBangRiengTang(toa, k0);
  const bcTc = (mbRieng ?? toa.matBang)?.baoCao;
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
  const dsO = oDangChon(canKhoa, co.ds);
  /** Căn vừa chọn tay không đặt vừa ô (khít đoạn kẹp): phép đổi ở ô đó đã bị chặn, giữ căn cũ — báo bằng lớp phủ trên bản vẽ. */
  const baoChanDoi = baoChanDoiCho(tv, sl.can);
  /**
   * STRETCH tay (DC-04 · QT-81): kéo mọi căn đang chọn `d` mm (không bù ngược sang căn kề); dãy tự dồn khít theo quy tắc tự chỉnh
   * (suaTuChinh), không khít thì chặn và báo bằng lớp phủ. Áp sang tòa cùng mẫu theo "Áp dụng sửa cho" (phamViSua).
   */
  const keoTay = (d: number) => {
    if (!chon) return;
    const khoas = dsO.filter((k) => sl.can.some((c) => c.vt.khoa === k && c.cn === 'can'));
    const ks = co.tangs ?? [null];
    const kqs = ks.map((k) => ({ k, r: stretchKhongBu(mau, boCucTang(toa, k), tv, khoas, d) }));
    const hong = kqs.find((x) => !x.r.ok);
    if (hong && !hong.r.ok) {
      const h = hong.r, no = sl.can.find((c) => c.vt.khoa === h.khoa)?.no ?? chon.no;
      datBaoStretch({ loai: 'loi', chu: t(`st.loi.${h.lyDo}`).replace('{v}', h.chiTiet ?? '').replace('{n}', String(no).padStart(2, '0')) });
      return;
    }
    const vtOf = (kh: string) => sl.vts.find((v) => v.khoa === kh)!;
    const dau = (v: number) => `${v > 0 ? '+' : ''}${v}`;
    // sau tự chỉnh: căn nào không còn đúng mẫu đã kéo là do dãy phải khít lại (không đủ chỗ) — báo rõ, không im lặng
    const ketQua = (sau: ToaDat) => {
      const yeuCau = kqs.flatMap(({ k, r }) => (r.ok ? r.doi.map(([kh, id]) => ({ k, kh, id })) : []));
      const dung = yeuCau.filter(({ k, kh, id }) => canDangDung(vtOf(kh), boCucTang(sau, k)) === id).length;
      if (!dung) { datBaoStretch({ loai: 'loi', chu: t('st.loi.khongKhit') }); return; }
      if (dung < yeuCau.length) { datBaoStretch({ loai: 'ok', chu: t('st.okMotPhan').replace('{a}', String(dung)).replace('{b}', String(yeuCau.length)).replace('{d}', dau(d)) }); return; }
      datBaoStretch({ loai: 'ok', chu: khoas.length > 1
        ? t('st.okNhieu').replace('{n}', String(khoas.length)).replace('{d}', dau(d))
        : t('st.okMot').replace('{a}', String(chon.no).padStart(2, '0')).replace('{d}', dau(d)) });
    };
    suaTuChinh(sua, tv, toa.id, { baoChan: baoChanDoi, ketQua })((q) => doiToa(q, toa.id, (x0) => kqs.reduce((x, { k, r }) => (!r.ok ? x : r.doi.reduce((a, [kh, id]) =>
      (k === null ? doiCanTaiViTri(a, vtOf(kh), id, sl.vts, false) : doiCanTheoTang(a, [k], vtOf(kh), id, sl.vts, false)), x)), x0)));
  };
  const dongSh = (nhan: string, k: typeof shToa) => (
    <div class="dong"><span>{nhan}</span><b class={k.m2MoiCan === null ? '' : LOP_MUC[k.muc]}>{k.m2MoiCan === null ? '—' : fmtSo(k.m2MoiCan, { thapPhan: 2, donVi: t('oc.sh.donVi') })}</b></div>
  );

  const khoiCanChon = (
    <MucGap tieuDe={chon ? `${t('tang.canDangChon')} · CH-${String(chon.no).padStart(2, '0')}${dsO.length > 1 ? ` (+${dsO.length - 1})` : ''}` : t('tang.canDangChon')} giaiThich={t('gt.tang.canDangChon')} mo>
      {!chon || !cChon ? <p class="dong muted">{t('tang.chonMotCan')}</p> : (
        <>
          <div class="can-chon-dau">
            <b class="can-chon-ten">{chon.cn === 'can' ? cChon.ten_vi.split(' · ').slice(0, 2).join(' · ') : t(`oc.${chon.cn}`)}</b>
            {chon.cn === 'can' && <span class="can-chon-phu">{NHAN_LOAI[cChon.loai]} · {t('tang.loaiN').replace('{n}', String(sl.loai.get(chon.canId)))}</span>}
          </div>
          {chon.cn !== 'can' ? <p class="dong muted" style={{ margin: 0 }}>{t('oc.khongTinhCan')}</p> : (
            <div class="can-chon-so">
              <div><small>{t('tang.kichThuoc')}</small><b>{fmtSo(cChon.rong_mm / 1000, { thapPhan: 1 })} × {fmtSo(cChon.sau_mm / 1000, { thapPhan: 1 })} m</b></div>
              <div><small>{t('tang.thongThuy')}</small><b>{fmtSo(cChon.dt_tt_m2, { thapPhan: 2, ...m2 })}</b></div>
              <div><small>{t('tang.timTuong')}</small><b>{fmtSo(cChon.dt_tim_m2, { thapPhan: 2, ...m2 })}</b></div>
              {deBai[cChon.loai] ? <div><small>{t('xep.dtDeBai')}</small><b>{fmtSo(deBai[cChon.loai]!, { thapPhan: 1, ...m2 })}</b></div> : null}
            </div>
          )}
          {chon.cn === 'can' && (() => {
            const { goc, st } = tachMa(chon.canId), g = tv.can.get(goc);
            if (!g?.stretch) return <p class="dong muted" style={{ margin: 0 }} title={t('gt.st.nut')}>{t('st.khongApDung')}</p>;
            const nut = (d: number, nhan: string, id: string) => (
              <button type="button" id={id} class="nut-phu nut-st" disabled={chiXem || !d} title={t('gt.st.nut')} onClick={() => keoTay(d)}>{nhan}</button>
            );
            return (
              <div class="can-chon-khoi khoi-st" role="group" aria-label={t('st.tieuDe')} title={`${t('st.gioiHan')} — ${t('gt.st.nut')}`}>
                <span class="st-nhan">{t('st.tieuDe')}</span>
                <div class="st-hang">
                  {nut(-ST_BUOC, `−${ST_BUOC}`, 'st-tru')}
                  <b class="st-muc">{st > 0 ? '+' : ''}{st} <small>mm</small></b>
                  {nut(ST_BUOC, `+${ST_BUOC}`, 'st-cong')}
                  {nut(-st, t('st.ve0'), 'st-ve0')}
                </div>
              </div>
            );
          })()}
          <div class="dong can-chon-nut">
            {chon.cn === 'can' && <button type="button" class="nut-chinh" onClick={() => setMo3d(true)}>{t('m3d.xemCan')}</button>}
            <button type="button" class="nut-phu" onClick={() => { chonCan(null); if (xem) datChonToa(toa, { ds: [] }); }}>{t('tang.boChon')}</button>
          </div>
          {mo3d && (
            <LopNoi>
              <div class="hop-3d" role="dialog" aria-modal="true" aria-label={t('m3d.xemCan')} onClick={(e) => { if (e.target === e.currentTarget) setMo3d(false); }}>
                <div class="hop-3d-trong">
                  <button type="button" class="dong-hop" onClick={() => setMo3d(false)} aria-label={t('m3d.dong')}>×</button>
                  <MoHinhCan canId={chon.canId} tv={tv} ten={`CH-${String(chon.no).padStart(2, '0')} · ${cChon.ten_vi}`} />
                </div>
              </div>
            </LopNoi>
          )}
        </>
      )}
    </MucGap>
  );

  return (
    <>
      <KpiTang pa={pa} tv={tv} toa={toa} lo={lo} tang={k0} can={sl.can} mucTieu={muc} nguongLech={pa.nguong.coCauDiem} tenTang={phamVi} canChon={khoiCanChon} />
      <KhoiPCCC pa={pa} tv={tv} toa={toa} mau={mau} bc={bc} chiXem={chiXem} datToa={(fn) => sua((q) => doiToa(q, toa.id, fn))} />
      <MucGap tieuDe={`${t('tang.canTrongToa')} · ${tenNgan(mau.ten_vi)}${k0 !== null ? ' · ' + tenTang(toa.soTangDe, k0) : ''}`} giaiThich={t('gt.tang.canTrongToa')}>
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

      <MucGap tieuDe={t('tang.loaiCanTrongTang')} giaiThich={t('gt.tang.loaiCanTrongTang')}>
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

      {bcTc && (
        <p class="dong muted tu-chinh-mb" role="status" style={{ margin: 0 }} title={(mbRieng ? t('tc.tangRieng') + '\n' : '') + bcTc.quyTac.map((q) => `${q.ma}: ${q.ghiChu}`).join('\n')}>
          {mbRieng ? `${t('tc.tangRieng')} · ` : ''}
          {t('tc.tomTat').replace('{n}', String(bcTc.quyTac.filter((q) => q.muc === 'da_sua').length)).replace('{c}', String(bcTc.quyTac.filter((q) => q.muc === 'canh_bao' || q.muc === 'vuot').length))
            .replace('{t}', `${bcTc.soThangTruoc}→${bcTc.soThangSau}`).replace('{v}', `${bcTc.vuotTruoc ?? '—'}→${bcTc.vuotSau ?? '—'}`).replace('{d}', fmtSo(bcTc.dtxdM2, { thapPhan: 1 }))}
        </p>
      )}
      <KhoiGiamCan bcTc={bcTc} toa={toa} coRieng={tangCoRieng(toa).length > 0} chiXem={chiXem}
        tenO={(k) => { const x = sl.can.find((c) => c.vt.khoa === k); return x ? `CH-${String(x.no).padStart(2, '0')}` : `ô ${k}`; }}
        tenCan={(id) => { const c = tv.can.get(id), { st } = tachMa(id); return c ? `${NHAN_LOAI[c.loai]} ${tachMa(id).goc}${st ? ` (STRETCH ${st > 0 ? '+' : ''}${st})` : ''}` : id; }}
        datToa={(fn) => suaTuChinh(sua, tv, toa.id, { tay: false })((q) => doiToa(q, toa.id, fn))} />
      <MucGap tieuDe={t('tt.tieuDe')} mo>
        {mauToa(tv, toa) && <BangTuanThu pa={pa} sua={sua} chiXem={chiXem} toa={toa} mau={mauToa(tv, toa)!} tv={tv} />}
      </MucGap>
    </>
  );
}
