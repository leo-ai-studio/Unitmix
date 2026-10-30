/**
 * Tài liệu bán hàng (Salekit) và phụ lục hợp đồng mua bán (HĐMB) — làm LẠI đúng bản mới nhất của app cũ MDI_Unitmix_v4
 * (`baoSalekit` / `baoHDMB`, mẫu Viện data/mb-salekit · mb-hdmb), không có số liệu nội bộ (rổ hàng, tỷ lệ %, tổng căn):
 *   · SALEKIT (mẫu HH1, A3): trang MẶT BẰNG TẦNG ĐIỂN HÌNH — ngang / dọc theo tỷ lệ tòa, đầu trang cam, "TẦNG a–b", mặt bằng có nội thất
 *     và tem căn, chân trang GHI CHÚ (màu loại căn + cách đọc tem) + đoạn ghi chú diện tích; rồi MỖI MẪU CĂN một trang A3 dọc:
 *     tên căn "1PN · LOẠI 1", bảng DT thông thuỷ / tim tường, hình căn có nội thất và chuỗi kích thước, KEYPLAN đơn sắc, ghi chú.
 *   · HĐMB (A4): MỘT tờ mặt bằng tầng điển hình (tô màu loại nhạt, tem như Salekit, chú thích, KHUYẾN CÁO, chỗ ký BÊN BÁN / BÊN MUA)
 *     rồi MỖI MẪU CĂN một trang (hình căn không nội thất có kích thước + keyplan + bảng 6 dòng + KHUYẾN CÁO).
 * Mặt bằng tầng dùng đúng `MatBangTang` của màn Tầng (cùng tem, nét, tự chỉnh).
 */
import { t } from '../../i18n/i18n';
import { hinhLogia } from '../../tinh/matBang';
import type { CanMau, Diem, LoaiCan } from '../../tinh/kieu';
import { fmtSo } from '../../ui/so';
import { KIEU_MB, NET, NET_NOI_THAT, NHAN_LOAI, type KieuMb } from '../../ve/kieuMb';
import type { DuLieuIn, NhomToaIn } from './duLieuIn';
import { MbTang } from './TrangIn';

const m2 = (v: number) => v.toFixed(2).replace('.', ',');

// ---------- dùng chung ----------

/** Tầng điển hình = từ tầng ngay trên khối đế tới tầng trên cùng (app cũ `tangDienHinh`). */
const tangDH = (n: NhomToaIn): [number, number] => { const a = n.dai.soTangDe + 1; return [a, Math.max(a, n.dai.soTangDe + n.dai.soTangDH)]; };
const chuTang = (n: NhomToaIn) => { const [a, b] = tangDH(n); return a === b ? String(a) : `${a}–${b}`; };
/** Hướng giấy theo tỷ lệ tòa như app cũ: dài hơn 1,25 lần bề cao thì ngang, không thì dọc. */
const laNgang = (n: NhomToaIn) => { const x = n.mau.duong_bao.map((p) => p[0]), y = n.mau.duong_bao.map((p) => p[1]); return Math.max(...x) - Math.min(...x) > (Math.max(...y) - Math.min(...y)) * 1.25; };
const nhanToa = (n: NhomToaIn, d: DuLieuIn) => {
  const lo = d.pa.lo.find((l) => l.id === n.dai.loId);
  return `${n.ten} · ${lo?.temDat.chucNang === 'xh' ? 'NOXH' : 'TM'}`;
};
/** Loại căn có trong tầng, theo thứ tự STU → 3PN. */
const loaiCoMat = (n: NhomToaIn): LoaiCan[] => (['stu', '1pn', '2pn', '2pnp', '3pn'] as LoaiCan[]).filter((l) => n.canTang.some((c) => c.can.loai === l));
/** Mã căn có trong tòa theo thứ tự "Loại 1 / 2 / 3…" (thứ tự xuất hiện theo số CH). */
const maCanTheoLoai = (n: NhomToaIn): CanMau[] => n.canTang.map((c) => c.can).sort((a, b) => (n.sl.loai.get(a.id) ?? 0) - (n.sl.loai.get(b.id) ?? 0));
const tenLoai = (n: NhomToaIn, c: CanMau) => `${NHAN_LOAI[c.loai]} · ${t('pdf.loaiN').replace('{n}', String(n.sl.loai.get(c.id) ?? '—'))}`;

const o = (mau: string, op = 1) => (
  <svg viewBox="0 0 74 15" preserveAspectRatio="none"><rect width="74" height="15" fill={mau} fill-opacity={op} stroke="rgba(0,0,0,.15)" /></svg>
);

/** Hình căn đơn lẻ (toạ độ mm, y xuống): tường / cửa / (nội thất), kèm chuỗi kích thước rộng (dưới) × sâu (phải) ngoài hình. */
function CanDon({ n, d, c, kieu, noiThat }: { n: NhomToaIn; d: DuLieuIn; c: CanMau; kieu: KieuMb; noiThat: boolean }) {
  const ve = d.hinh.can.get(c.id) ?? [];
  const W = c.rong_mm, D = c.sau_mm, K = KIEU_MB[kieu];
  void n;
  const M = Math.max(W, D), u = M / 460;
  const nets = ve.filter((x) => NET[x.cat] && x.pts.length > 1 && (noiThat || !NET_NOI_THAT.has(x.cat)));
  const P = (p: number[]) => `${Math.round(p[0] * W)} ${Math.round(D - p[1] * D)}`;
  const gioiHan = nets.flatMap((x) => x.pts).reduce((a, p) => [Math.min(a[0], p[0] * W), Math.min(a[1], D - p[1] * D), Math.max(a[2], p[0] * W), Math.max(a[3], D - p[1] * D)], [0, 0, W, D]);
  const [x0, y0, x1, y1] = gioiHan;
  const fs = M * 0.03, gap = M * 0.06, ext = M * 0.014, ink = '#2F5D5A', sw = M * 0.0016;
  const tick = (x: number, y: number) => <line x1={x - fs * 0.3} y1={y + fs * 0.3} x2={x + fs * 0.3} y2={y - fs * 0.3} stroke={ink} stroke-width={sw} />;
  const yd = y1 + gap, xr = x1 + gap;
  const rong = Math.round(W), sau = Math.round(D);
  const dayDu = M * 0.06;
  return (
    <svg class="in-can" viewBox={`${x0 - dayDu} ${y0 - dayDu} ${x1 - x0 + 2 * dayDu + gap * 2.2} ${y1 - y0 + 2 * dayDu + gap * 2.2}`} preserveAspectRatio="xMidYMid meet" role="img">
      {nets.map((x, i) => {
        const s = NET[x.cat], day = (x.cat === 'wall' ? 2.4 : s.w * 0.9) * u * 1.0;
        return <path key={i} d={'M' + x.pts.map(P).join('L')} fill="none" stroke={K[s.mau]} stroke-width={day} stroke-opacity={s.o} stroke-dasharray={s.d ? `${u * 4} ${u * 3}` : undefined} stroke-linejoin="round" stroke-linecap="round" />;
      })}
      <g fill="none" stroke={ink} stroke-width={sw}>
        <line x1={x0} y1={yd} x2={x1} y2={yd} />
        {[x0, x1].map((x) => <g key={x}><line x1={x} y1={y1 + ext} x2={x} y2={yd + ext} />{tick(x, yd)}</g>)}
        <line x1={xr} y1={y0} x2={xr} y2={y1} />
        {[y0, y1].map((y) => <g key={y}><line x1={x1 + ext} y1={y} x2={xr + ext} y2={y} />{tick(xr, y)}</g>)}
      </g>
      <text x={(x0 + x1) / 2} y={yd - fs * 0.45} text-anchor="middle" font-size={fs} fill={ink} font-weight="500">{rong}</text>
      <text transform={`translate(${xr + fs} ${(y0 + y1) / 2}) rotate(-90)`} text-anchor="middle" font-size={fs} fill={ink} font-weight="500">{sau}</text>
    </svg>
  );
}

/** KEYPLAN đơn sắc: chỉ nét bao từng căn + lõi + nét bao tòa một màu mực; căn đúng mã tô đỏ nhạt (app cũ `keyPlanDonSac`). */
function KeyPlan({ n, d, canId }: { n: NhomToaIn; d: DuLieuIn; canId: string }) {
  const bao = n.mau.duong_bao;
  const all = [...bao, ...n.sl.can.flatMap((c) => c.vt.goc), ...n.loiDG.flat()];
  const xs = all.map((p) => p[0]), ys = all.map((p) => -p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const M = Math.max(x1 - x0, y1 - y0), pad = M * 0.02, w = M * 0.0022, ink = '#2F5D5A';
  const poly = (pts: Diem[], fill: string, sw: number, k: string) => <polygon key={k} points={pts.map((p) => `${Math.round(p[0])},${Math.round(-p[1])}`).join(' ')} fill={fill} stroke={ink} stroke-width={sw} stroke-linejoin="round" />;
  return (
    <svg viewBox={`${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`} preserveAspectRatio="xMidYMid meet" role="img">
      {bao.length > 2 && poly(bao, '#fff', w * 1.6, 'bao')}
      {n.sl.can.map((c) => {
        const cm = d.tv.can.get(c.canId);
        const dg = c.cn === 'can' ? (hinhLogia(c.vt, n.mau, cm?.logia_lui) ?? c.vt.goc) : c.vt.goc;
        return poly(dg, c.cn === 'can' ? (c.canId === canId ? '#F6B8B0' : '#fff') : '#F1F3F3', w, c.vt.khoa);
      })}
      {n.loiDG.map((p, i) => poly(p, '#F1F3F3', w, `l${i}`))}
    </svg>
  );
}

const GhiChuSk = () => (
  <div class="skfn"><p>{t('pdf.sk.fn1')}</p><p>{t('pdf.sk.fn2')}</p></div>
);

// ---------- SALEKIT ----------

function TrangTangSk({ d, n, kieu }: { d: DuLieuIn; n: NhomToaIn; kieu: KieuMb }) {
  const K = KIEU_MB[kieu];
  const tem = kieu === 'sk_galia'
    ? <>{o('#C6CBCB')}<span>{t('pdf.sk.tem.g1')}</span>{o('#EEF2F1')}<span>{t('pdf.sk.tem.g2')}</span></>
    : kieu === 'sk_rivea'
      ? <>{o('#F1E4D7')}<span>{t('pdf.sk.tem.r1')}</span>{o('#FFF7EE')}<span>{t('pdf.sk.tem.r2')}</span></>
      : <>{o('#306361')}<span>{t('pdf.sk.tem.h1')}</span>{o('#E7C2A9')}<span>{t('pdf.sk.tem.h2')}</span>{o('#FBEDD6')}<span>{t('pdf.sk.tem.h3')}</span></>;
  return (
    <section class={`trang-in ${laNgang(n) ? 'a3n' : 'a3d'} sk sk-tang`}>
      <div class="skhd"><span>{t('pdf.sk.mbTang')}</span><span>{d.tenDuAn}</span></div>
      <div class="skti"><h1>{t('pdf.sk.tang')} {chuTang(n)}</h1><span class="cap">{nhanToa(n, d)}</span></div>
      <div class="skplan"><MbTang n={n} d={d} kieu={kieu} tem noiThat sach /></div>
      <div class="skft">
        <div class="skgc">
          <div><h2>{t('pdf.sk.ghiChu')}</h2><div class="sksw">{loaiCoMat(n).map((l) => <>{o(K.u[l])}<span>{NHAN_LOAI[l]}</span></>)}</div></div>
          <div><h2>&nbsp;</h2><div class="sksw sktem">{tem}</div></div>
        </div>
        <GhiChuSk />
      </div>
    </section>
  );
}

function TrangCanSk({ d, n, c, kieu }: { d: DuLieuIn; n: NhomToaIn; c: CanMau; kieu: KieuMb }) {
  return (
    <section class="trang-in a3d sk sk-can">
      <div class="skhd"><span>{t('pdf.sk.mbCan')}</span><span>{d.tenDuAn}</span></div>
      <div class="skti"><h1>{tenLoai(n, c)}</h1>
        <table class="skdt"><tbody>
          <tr><th>{t('pdf.sk.dtTt')}</th><td>{m2(c.dt_tt_m2)} m²</td></tr>
          <tr><th>{t('pdf.sk.dtTim')}</th><td>{m2(c.dt_tim_m2)} m²</td></tr>
        </tbody></table></div>
      <div class="skve"><CanDon n={n} d={d} c={c} kieu={kieu} noiThat /></div>
      <div class="skkp"><div class="lab">{t('pdf.sk.keyplan')}</div><div class="kp"><div><KeyPlan n={n} d={d} canId={c.id} /></div><span>{t('pdf.sk.tang')} {chuTang(n)}</span></div></div>
      <GhiChuSk />
    </section>
  );
}

export function SalekitIn({ d, kieu }: { d: DuLieuIn; kieu: KieuMb }) {
  return <>{d.nhom.flatMap((n) => [<TrangTangSk key={n.khoa} d={d} n={n} kieu={kieu} />, ...maCanTheoLoai(n).map((c) => <TrangCanSk key={`${n.khoa}|${c.id}`} d={d} n={n} c={c} kieu={kieu} />)])}</>;
}

// ---------- HỢP ĐỒNG MUA BÁN ----------

const KC_1 = ['pdf.hd.kc1', 'pdf.hd.kc2', 'pdf.hd.kc3', 'pdf.hd.kc4', 'pdf.hd.kc5', 'pdf.hd.kc6'];
const KC_2 = ['pdf.hd.kc1', 'pdf.hd.kc2', 'pdf.hd.kc3', 'pdf.hd.kc4'];

function KhuyenCao({ ds }: { ds: string[] }) {
  return <div class="note"><b>{t('pdf.hd.khuyenCao')}</b><ul>{ds.map((k) => <li key={k}>{t(k)}</li>)}</ul></div>;
}

function TrangTangHd({ d, n }: { d: DuLieuIn; n: NhomToaIn }) {
  const [a, b] = tangDH(n);
  const sw = (mau: string, ten: string) => <span><svg class="swh" viewBox="0 0 74 15" preserveAspectRatio="none"><rect width="74" height="15" fill={mau} stroke="rgba(0,0,0,.2)" /></svg>{ten}</span>;
  return (
    <section class={`trang-in ${laNgang(n) ? 'a4n' : 'a4d'} hd-mb hd-tang`}>
      <div class="hd"><div><h1>{t('pdf.hd.tieuDe')}</h1><div class="mt">{t('pdf.hd.mt').replace('{ten}', `${d.tenDuAn} · ${nhanToa(n, d)}`).replace('{a}', String(a)).replace('{b}', String(b)).replace('{n}', String(n.sl.can.filter((c) => c.cn === 'can').length))}</div></div>
        <div class="dd">{t('pdf.hd.dinhKem')}<br />{t('pdf.hd.ngay').replace('{d}', d.ngay)}</div></div>
      <div class="plan"><MbTang n={n} d={d} kieu="hd_mb" kieuTem="sk_hh1" tem noiThat={false} sach /></div>
      <div class="ft2">
        <div class="chuthich">
          {loaiCoMat(n).map((l) => <span key={l}><svg class="swh" viewBox="0 0 74 15" preserveAspectRatio="none"><rect width="74" height="15" fill={`var(--u-${l})`} fill-opacity="0.3" stroke="rgba(0,0,0,.2)" /></svg>{NHAN_LOAI[l]}</span>)}
          {sw('#2F5D5A', t('pdf.hd.tenCanLoai'))}{sw('#E9C4AB', t('pdf.hd.dtTt'))}{sw('#FCE9D3', t('pdf.hd.dtTim'))}
        </div>
        <KhuyenCao ds={KC_1} />
        <div class="ky"><div><b>{t('pdf.hd.ban')}</b><span /></div><div><b>{t('pdf.hd.mua')}</b><span /></div></div>
      </div>
    </section>
  );
}

function TrangMauHd({ d, n, c }: { d: DuLieuIn; n: NhomToaIn; c: CanMau }) {
  const soTang = n.chTheoMau.get(c.id)?.length ?? 0, soToa = soTang * n.dai.soTangDH;
  const dong = (a: string, b: string) => <tr><td>{a}</td><td>{b}</td></tr>;
  return (
    <section class={`trang-in ${laNgang(n) ? 'a4n' : 'a4d'} hd-mb hd-mau`}>
      <div class="hd"><div><h1>{tenLoaiHd(n, c)}</h1><div class="mt">{t('pdf.hd.mauMt').replace('{ten}', `${d.tenDuAn} · ${nhanToa(n, d)}`)}</div></div>
        <div class="dd">{t('pdf.hd.ngay').replace('{d}', d.ngay)}</div></div>
      <div class="typepg">
        <div class="tpdraw"><CanDon n={n} d={d} c={c} kieu="hd_mb" noiThat={false} /></div>
        <div class="tpside">
          <div class="tpkey"><KeyPlan n={n} d={d} canId={c.id} /></div>
          <table><tbody>
            {dong(t('pdf.hd.loai'), `${NHAN_LOAI[c.loai]} · ${t('pdf.loaiN').replace('{n}', String(n.sl.loai.get(c.id) ?? '—'))}`)}
            {dong(t('pdf.hd.kichThuoc'), `${fmtSo(c.rong_mm)} × ${fmtSo(c.sau_mm)} mm`)}
            {dong(t('pdf.sk.dtTim'), `${m2(c.dt_tim_m2)} m²`)}
            {dong(t('pdf.sk.dtTt'), `${m2(c.dt_tt_m2)} m²`)}
            {dong(t('pdf.hd.soCan'), t('pdf.hd.soCanVal').replace('{a}', fmtSo(soTang)).replace('{b}', fmtSo(soToa)))}
          </tbody></table>
        </div>
      </div>
      <KhuyenCao ds={KC_2} />
    </section>
  );
}
const tenLoaiHd = (n: NhomToaIn, c: CanMau) => `${t('pdf.loaiN').replace('{n}', String(n.sl.loai.get(c.id) ?? '—'))} · ${NHAN_LOAI[c.loai]}`;

export function HdmbIn({ d }: { d: DuLieuIn }) {
  return <>{d.nhom.flatMap((n) => [<TrangTangHd key={n.khoa} d={d} n={n} />, ...maCanTheoLoai(n).map((c) => <TrangMauHd key={`${n.khoa}|${c.id}`} d={d} n={n} c={c} />)])}</>;
}
