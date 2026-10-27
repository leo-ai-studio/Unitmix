import { useMemo, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { diemLechCoCau, phanTram } from '../tinh/coCau';
import { apDoiViTri, doiCanTaiViTri, veMauGoc } from '../tinh/doiCan';
import { LOAI_CAN, type Lo, type LoaiCan, type ThuVien, type ToaDat, type TrangThaiPA } from '../tinh/kieu';
import { coMat, ungVienDoi, viTriCan } from '../tinh/matBang';
import { dtHanhLangTang, phanChungPhanBo } from '../tinh/phanChung';
import { toiUuCoCau } from '../tinh/toiUu';
import { BanVe, khungBao, type DieuKhienVe } from '../ve/BanVe';
import { idLoi, useHinhHoc } from '../ve/hinhHocThuVien';
import { DS_KIEU_MB, KIEU_MB, NHAN_LOAI } from '../ve/kieuMb';
import { MatBangTang, soLieuTang, type ToaVe } from '../ve/MatBangTang';
import { BangTuanThu } from '../ui/BangTuanThu';
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

/** Tòa đang xem tầng: tòa đã chọn, không thì tòa đầu của lô đang làm, không thì tòa đầu tiên. */
export function toaDangXem(pa: TrangThaiPA, tv: ThuVien | null, loId: string | null, toaId: string | null): { toa: ToaDat; mau: ToaVe; lo: Lo | undefined } | null {
  if (!tv) return null;
  const co = pa.toa.filter((x) => tv.toa.has(x.mauId) && coMat(tv.toa.get(x.mauId)!));
  const toa = co.find((x) => x.id === toaId) ?? co.find((x) => x.loId === loId) ?? co[0];
  if (!toa) return null;
  return { toa, mau: tv.toa.get(toa.mauId) as ToaVe, lo: pa.lo.find((l) => l.id === toa.loId) };
}

const mucTieuCua = (lo: Lo | undefined): Record<LoaiCan, number> => lo?.temDat.coCauMucTieu ?? { stu: 0, '1pn': 0, '2pn': 0, '2pnp': 0, '3pn': 0 };
const demLoai = (ds: { canId: string }[], tv: ThuVien): Record<LoaiCan, number> => {
  const d = Object.fromEntries(LOAI_CAN.map((k) => [k, 0])) as Record<LoaiCan, number>;
  for (const x of ds) { const c = tv.can.get(x.canId); if (c) d[c.loai]++; }
  return d;
};

/** Panel trái: chọn tòa, cơ cấu mục tiêu + tối ưu, hiển thị. */
export function TangTrai(p: ChungTang) {
  const { pa, sua, chiXem, tv, chonToa, chonCan } = p;
  const cai = useCaiTang();
  const [ghiChu, setGhiChu] = useState('');
  const xem = toaDangXem(pa, tv, p.loId, p.toaId);
  if (!tv) return <p class="dong muted">{t('lo.dangTaiThuVien')}</p>;
  if (!xem) return <p class="dong muted">{t('tang.chuaCoToa')}</p>;
  const { toa, mau, lo } = xem;
  const muc = mucTieuCua(lo);
  const sl = soLieuTang(mau, toa, tv);
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
      <MucGap tieuDe={t('tang.coCauMucTieu')} giaiThich={t('tang.mixGhiChu')} mo>
        {LOAI_CAN.map((k) => (
          <div class="dong" key={k}><span><i class="o-mau" style={{ background: `var(--u-${k})` }} /> {t(`loai.${k}`)}</span><b>{fmtSo(muc[k], { thapPhan: 1, donVi: '%' })}</b></div>
        ))}
        {lo?.temDat.deBai && <p class="dong muted" style={{ margin: 0 }}>{t('lo.nguonDeBai').replace('{n}', lo.temDat.deBai.nguon)}</p>}
        <div class="dong" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
          <button type="button" class="nut-chinh" title={t('gt.tang.toiUu')} disabled={chiXem}
            onClick={() => {
              const kq = toiUuCoCau(mau, toa, tv, muc);
              sua((q) => doiToa(q, toa.id, (x) => apDoiViTri(x, kq.canViTri)));
              setGhiChu(kq.soDoi ? t('tang.daToiUu').replace('{n}', String(kq.soDoi)).replace('{a}', fmtSo(kq.diemTruoc, { thapPhan: 1 })).replace('{b}', fmtSo(kq.diemSau, { thapPhan: 1 })) : t('tang.khongDoiDuoc'));
            }}>{t('tang.toiUu')}</button>
          <button type="button" class="nut-phu" title={t('gt.tang.veGoc')} disabled={chiXem || (!Object.keys(toa.canTheo).length && !toa.canViTri)}
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
        <p class="dong muted" style={{ margin: 0 }}>{t('tang.phamVi').replace('{n}', String(toa.soTangDH))} · {t('xep.canTang').replace('{n}', String(sl.vts.length))}</p>
      </MucGap>
    </>
  );
}

/** Bản vẽ giữa: mặt bằng tầng điển hình của tòa đang xem. */
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

function TangVe({ tv, toa, mau, lo, canKhoa, chonCan, pa }: ChungTang & { tv: ThuVien; toa: ToaDat; mau: ToaVe; lo: Lo | undefined }) {
  const cai = useCaiTang();
  const [dk, setDk] = useState<DieuKhienVe | null>(null);
  const sl = useMemo(() => soLieuTang(mau, toa, tv), [mau, toa.canTheo, toa.canViTri, tv]);
  const loiIds = useMemo(() => mau.mat.flatMap((m) => m.phan_tu.filter((q) => q.loai !== 'can').map((q) => idLoi(q.block))), [mau]);
  const hinh = useHinhHoc(sl.can.map((c) => c.canId), loiIds);
  const khung = useMemo(() => {
    const k = khungBao([mau.duong_bao.map(([x, y]): [number, number] => [x / 1000, y / 1000])]);
    return k ? ([k[0] - 6, k[1] - 6, k[2] + 6, k[3] + 6] as [number, number, number, number]) : null;
  }, [mau]);
  return (
    <>
      <div class="the-tang" role="status">
        {tenNgan(mau.ten_vi)} · {t('tang.dienHinh')} · {t('tang.apCho').replace('{n}', String(toa.soTangDH))} · {t('xep.canTang').replace('{n}', String(sl.vts.length))}
        {hinh.dangTai && <img class="spin-o" src="/brand/leo_ai_o.png" alt="" style={{ width: '14px', height: '14px', marginLeft: '8px', verticalAlign: '-2px' }} />}
      </div>
      <BanVe khung={khung} nhan={t('tang.banVe')} onDieuKhien={setDk} gocBac={toa.gocDo}>
        <MatBangTang mau={mau} toa={toa} tv={tv} hinh={hinh} kieu={cai.kieu} noiThat={cai.noiThat} hienTem={cai.hienTem} canKhoa={canKhoa} chonCan={chonCan}
          deBai={cai.chamMau ? lo?.temDat.deBai?.dtCan : undefined} nguongDt={pa.nguong.dtCanM2} />
      </BanVe>
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

/** Panel phải: căn trong tòa so với mục tiêu, loại căn trong tầng, căn đang chọn. */
export function TangPhai(p: ChungTang) {
  const { pa, sua, chiXem, tv, canKhoa, chonCan } = p;
  const cai = useCaiTang();
  const [mo3d, setMo3d] = useState(false);
  const xem = toaDangXem(pa, tv, p.loId, p.toaId);
  const sl = useMemo(() => (xem && tv ? soLieuTang(xem.mau, xem.toa, tv) : null), [xem?.mau, xem?.toa.canTheo, xem?.toa.canViTri, tv]);
  const hl = useMemo(() => (xem ? dtHanhLangTang(xem.mau) : null), [xem?.mau]);
  if (!tv || !xem || !sl || !hl) return null;
  const { toa, mau, lo } = xem;
  const m2 = { donVi: 'm²' };
  const muc = mucTieuCua(lo);
  const dem = demLoai(sl.can, tv);
  const tong = sl.can.length;
  const pct = phanTram(dem);
  const deBai = lo?.temDat.deBai?.dtCan ?? {};

  // loại căn trong tầng: theo mẫu căn đang dùng
  const theoMau = new Map<string, number>();
  sl.can.forEach((c) => theoMau.set(c.canId, (theoMau.get(c.canId) ?? 0) + 1));
  const dtTim = Object.fromEntries([...theoMau.keys()].map((id) => [id, tv.can.get(id)?.dt_tim_m2 ?? 0]));
  const chung = phanChungPhanBo(hl.m2, Object.fromEntries(theoMau), dtTim);
  const dsMau = [...theoMau].map(([id, n]) => ({ id, n, c: tv.can.get(id)! })).filter((x) => x.c)
    .sort((a, b) => LOAI_CAN.indexOf(a.c.loai) - LOAI_CAN.indexOf(b.c.loai) || a.c.id.localeCompare(b.c.id));

  const chon = sl.can.find((c) => c.vt.khoa === canKhoa);
  const cChon = chon && tv.can.get(chon.canId);
  const doi = (canMoi: string) => chon && sua((q) => doiToa(q, toa.id, (x) => doiCanTaiViTri(x, chon.vt, canMoi, sl.vts, cai.suaNhieu)));

  return (
    <>
      <MucGap tieuDe={`${t('tang.canTrongToa')} · ${tenNgan(mau.ten_vi)}`} giaiThich={t('gt.tang.canTrongToa')} mo>
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
        <div class="dong"><span>{t('tang.soCanToa')}</span><b>{fmtSo(tong * toa.soTangDH)} {t('sc.can')}</b></div>
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

      <MucGap tieuDe={chon ? `${t('tang.canDangChon')} · CH-${String(chon.no).padStart(2, '0')}` : t('tang.canDangChon')} giaiThich={t('gt.tang.canDangChon')} mo>
        {!chon || !cChon ? <p class="dong muted">{t('tang.chonMotCan')}</p> : (
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
                  {(Object.keys(toa.canTheo).length > 0 || toa.canViTri) && viTriCan(mau, tv).find((v) => v.khoa === chon.vt.khoa)?.canGocId !== chon.canId && (
                    <button type="button" class="nut-phu" disabled={chiXem} style={{ margin: '4px 12px' }} onClick={() => doi(chon.vt.canGocId)}>{t('tang.doiVeGoc')}</button>
                  )}
                </>
              );
            })()}
            <div class="dong"><button type="button" class="nut-chinh" onClick={() => setMo3d(true)}>{t('m3d.xemCan')}</button><button type="button" class="nut-phu" onClick={() => chonCan(null)}>{t('tang.boChon')}</button></div>
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
