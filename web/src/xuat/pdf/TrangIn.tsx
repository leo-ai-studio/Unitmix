/**
 * Trang in của ba tài liệu PDF: báo cáo phương án (A3 ngang), Salekit (A3 ngang) và phụ lục HĐMB (A4). Chỉ là hình + bảng thuần từ
 * `DuLieuIn` — mặt bằng tầng dùng đúng `MatBangTang` của màn Tầng (cùng kiểu tô, tem CH-xx, nét, tự chỉnh), nên in ra giống màn hình.
 * Mỗi `<section class="trang-in …">` là một tờ; khổ giấy theo class (a3n / a4n / a4d, xem inPdf.ts).
 */
import type { ComponentChildren } from 'preact';
import { t } from '../../i18n/i18n';
import { mauToa } from '../../tinh/canThem';
import { chanToa } from '../../tinh/hinhHoc';
import { LOAI_CAN, type Diem, type Lo } from '../../tinh/kieu';
import { datTemCan, hopCacTem } from '../../tinh/temCan';
import { fmtSo } from '../../ui/so';
import { MatBangTang } from '../../ve/MatBangTang';
import { KIEU_MB, NHAN_LOAI, type KieuMb } from '../../ve/kieuMb';
import { thongKeLo, type DuLieuIn, type NhomToaIn } from './duLieuIn';

const m2 = (v: number | null | undefined, n = 1) => (v === null || v === undefined ? '—' : fmtSo(v, { thapPhan: n }));
const ch = (n: number) => `CH-${String(n).padStart(2, '0')}`;

type KhoTrang = 'a3n' | 'a4n' | 'a4d';

function Trang({ d, kho, tieuDe, so, children, lop = '' }: { d: DuLieuIn; kho: KhoTrang; tieuDe: string; so: string; children: ComponentChildren; lop?: string }) {
  return (
    <section class={`trang-in ${kho} ${lop}`}>
      <header class="in-dau">
        <img src="/brand/leo_ai_mark.png" alt="" />
        <div><h1>{tieuDe}</h1><p>{d.tenDuAn} · {d.tenPA} · {d.ngay}</p></div>
        <span class="in-so">{so}</span>
      </header>
      <div class="in-than">{children}</div>
      <footer class="in-chan"><span>Unitmix · LEO AI · NghiaVT</span><span>{t('pdf.tam')}</span></footer>
    </section>
  );
}

// ---------- hình ----------

/** Hộp bao (m, toạ độ bản vẽ) của nét bao tòa + tem (nếu in tem), nới `le` m. */
function hopMb(n: NhomToaIn, d: DuLieuIn, tem: boolean, le: number): [number, number, number, number] {
  const xs = n.mau.duong_bao.map((p) => p[0]), ys = n.mau.duong_bao.map((p) => p[1]);
  let h: [number, number, number, number] = [Math.min(...xs) / 1000, Math.min(...ys) / 1000, Math.max(...xs) / 1000, Math.max(...ys) / 1000];
  const bt = tem ? hopCacTem(datTemCan(n.mau, d.tv, n.sl.can, n.loiDG)) : null;
  if (bt) h = [Math.min(h[0], bt[0] / 1000), Math.min(h[1], bt[1] / 1000), Math.max(h[2], bt[2] / 1000), Math.max(h[3], bt[3] / 1000)];
  return [h[0] - le, h[1] - le, h[2] + le, h[3] + le];
}

/** Mặt bằng tầng điển hình của một nhóm tòa; `chiO` = chỉ vẽ ô đó (trang riêng mỗi mẫu căn), `chon` = ô tô nhấn (key plan). */
export function MbTang({ n, d, kieu, kieuTem, tem, noiThat, chiO, chon, le = 3, sach }: { n: NhomToaIn; d: DuLieuIn; kieu: KieuMb; kieuTem?: KieuMb; tem: boolean; noiThat: boolean; chiO?: Diem[]; chon?: string[]; le?: number; sach?: boolean }) {
  const lo = d.pa.lo.find((l) => l.id === n.dai.loId);
  let k = hopMb(n, d, tem && !chiO, chiO ? 0 : le);
  if (chiO) { const xs = chiO.map((p) => p[0] / 1000), ys = chiO.map((p) => p[1] / 1000); k = [Math.min(...xs) - 0.6, Math.min(...ys) - 0.6, Math.max(...xs) + 0.6, Math.max(...ys) + 0.6]; }
  const idCp = `cp-${n.khoa.length}-${Math.round(k[0] * 10)}-${Math.round(k[1] * 10)}`;
  return (
    <svg class="in-mb" viewBox={`${k[0]} ${-k[3]} ${k[2] - k[0]} ${k[3] - k[1]}`} preserveAspectRatio="xMidYMid meet" role="img">
      {chiO && <defs><clipPath id={idCp}><polygon points={chiO.map((p) => `${p[0] / 1000},${-p[1] / 1000}`).join(' ')} /></clipPath></defs>}
      <g clip-path={chiO ? `url(#${idCp})` : undefined}>
        <MatBangTang mau={n.mau} toa={n.bc} tv={d.tv} hinh={d.hinh} kieu={kieu} kieuTem={kieuTem} noiThat={noiThat} hienTem={tem && !chiO} canKhoa={null} onChonO={() => {}}
          dsChon={chon} nguongDt={d.pa.nguong.dtCanM2} deBai={sach ? undefined : lo?.temDat.deBai?.dtCan} loiDaGiac={n.loiDG} hienHanhLang={false} />
      </g>
    </svg>
  );
}

const MAU_CN: Record<string, string> = { tm: '#e4eee9', xh: '#e5ecf4', khac: '#efede7' };

/** Tổng mặt bằng quy hoạch: lô (tô theo chức năng), chỉ giới, đường xung quanh, chân tòa, nhãn lô / tòa, thước tỷ lệ. */
function Tmb({ d }: { d: DuLieuIn }) {
  const los = d.pa.lo;
  const pts = los.flatMap((l) => l.ranh);
  if (!pts.length) return null;
  const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0])), y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
  const co = Math.max(x1 - x0, y1 - y0), le = co * 0.06, fs = co / 70;
  const P = (ps: Diem[]) => ps.map((p) => `${p[0]},${-p[1]}`).join(' ');
  const tb = Math.pow(10, Math.floor(Math.log10(co / 4))), thuoc = tb * (co / 4 / tb >= 5 ? 5 : co / 4 / tb >= 2 ? 2 : 1);
  return (
    <svg class="in-tmb" viewBox={`${x0 - le} ${-(y1 + le)} ${x1 - x0 + 2 * le} ${y1 - y0 + 2 * le}`} preserveAspectRatio="xMidYMid meet" role="img">
      {los.flatMap((l) => l.xungQuanh).map((dg, i) => <polyline key={`x${i}`} points={P(dg)} fill="none" stroke="#b9b6ae" stroke-width={co / 900} />)}
      {los.map((l) => (
        <g key={l.id}>
          <polygon points={P(l.ranh)} fill={MAU_CN[l.temDat.chucNang] ?? MAU_CN.khac} stroke="#292d2d" stroke-width={co / 700} />
          {l.chiGioi && <polygon points={P(l.chiGioi)} fill="none" stroke="#a5703c" stroke-width={co / 900} stroke-dasharray={`${co / 150} ${co / 300}`} />}
        </g>
      ))}
      {d.pa.toa.map((x) => {
        const m0 = mauToa(d.tv, x);
        if (!m0) return null;
        const ch0 = chanToa(m0, x);
        const tam = ch0.reduce<Diem>((s, p) => [s[0] + p[0] / ch0.length, s[1] + p[1] / ch0.length], [0, 0]);
        return (
          <g key={x.id}>
            <polygon points={P(ch0)} fill="#8fb3ad" stroke="#174f52" stroke-width={co / 800} />
            <text x={tam[0]} y={-tam[1]} font-size={fs * 0.8} text-anchor="middle" dominant-baseline="central" fill="#022b1e" font-weight="600">{m0.ten_vi.split(' · ')[0]}</text>
          </g>
        );
      })}
      {los.map((l) => {
        const a = l.ranh.reduce<Diem>((s, p) => [s[0] + p[0] / l.ranh.length, s[1] + p[1] / l.ranh.length], [0, 0]);
        return <text key={`n${l.id}`} x={a[0]} y={-a[1] - (l.ranh.length ? fs * 1.6 : 0)} font-size={fs * 1.15} text-anchor="middle" fill="#292d2d" font-weight="700" opacity="0.8">{l.temDat.kyHieu}</text>;
      })}
      <g transform={`translate(${x0 - le * 0.6} ${-(y0 - le * 0.5)})`}>
        <line x1="0" y1="0" x2={thuoc} y2="0" stroke="#292d2d" stroke-width={co / 500} />
        <line x1="0" y1={-fs * 0.4} x2="0" y2={fs * 0.4} stroke="#292d2d" stroke-width={co / 500} /><line x1={thuoc} y1={-fs * 0.4} x2={thuoc} y2={fs * 0.4} stroke="#292d2d" stroke-width={co / 500} />
        <text x={thuoc / 2} y={-fs * 0.7} font-size={fs * 0.9} text-anchor="middle" fill="#292d2d">{fmtSo(thuoc)} m</text>
      </g>
    </svg>
  );
}

// ---------- bảng ----------

function BangLoaiCan({ n, d, mauSw }: { n: NhomToaIn; d: DuLieuIn; mauSw: KieuMb }) {
  const K = KIEU_MB[mauSw];
  const dsLoai = LOAI_CAN.filter((l) => n.canTang.some((c) => c.can.loai === l));
  return (
    <table class="in-bang">
      <thead><tr><th>{t('pdf.loaiCan')}</th><th>{t('pdf.mau')}</th><th class="so">{t('pdf.dtTt')}</th><th class="so">{t('pdf.dtTim')}</th><th class="so">{t('pdf.canTang')}</th><th>{t('pdf.ch')}</th></tr></thead>
      <tbody>
        {dsLoai.flatMap((l) => n.canTang.filter((c) => c.can.loai === l).map((c, i) => (
          <tr key={c.can.id}>
            {i === 0 && <td rowSpan={n.canTang.filter((q) => q.can.loai === l).length}><span class="sw" style={{ background: K.u[l] }} /><b>{NHAN_LOAI[l]}</b></td>}
            <td>{c.can.ten_vi}</td>
            <td class="so">{m2(c.can.dt_tt_m2, 2)}</td><td class="so">{m2(c.can.dt_tim_m2, 2)}</td><td class="so">{c.n}</td>
            <td class="ch">{(n.chTheoMau.get(c.can.id) ?? []).sort((a, b) => a - b).map(ch).join(', ')}</td>
          </tr>
        )))}
      </tbody>
      <tfoot><tr><td colSpan={4}>{t('pdf.tongTang')}</td><td class="so"><b>{n.canTang.reduce((s, c) => s + c.n, 0)}</b></td><td>{t('pdf.tongToa').replace('{n}', fmtSo(n.canTang.reduce((s, c) => s + c.n, 0) * n.dai.soTangDH))}</td></tr></tfoot>
    </table>
  );
}

const tenNhom = (n: NhomToaIn, d: DuLieuIn) => {
  const los = [...new Set(n.toas.map((x) => d.pa.lo.find((l) => l.id === x.loId)?.temDat.kyHieu).filter(Boolean))].join(', ');
  return `${n.ten}${n.toas.length > 1 ? ` × ${n.toas.length}` : ''}${los ? ` · ${los}` : ''}`;
};
const dsTang = (n: NhomToaIn) => `${n.dai.soTangDe ? n.dai.soTangDe + ' + ' : ''}${n.dai.soTangDH} ${t('pdf.tang')}`;

// ---------- BÁO CÁO ----------

function TrangTmb({ d, so }: { d: DuLieuIn; so: string }) {
  const k = d.kq.tong, tong = k.soCan;
  return (
    <Trang d={d} kho="a3n" tieuDe={t('pdf.bc.tmb')} so={so}>
      <div class="in-hai-cot tmb">
        <div class="in-khung-ve"><Tmb d={d} /></div>
        <aside>
          <h2>{t('pdf.bc.tomTat')}</h2>
          <dl class="in-so-lieu">
            <div><dt>{t('pdf.soLo')}</dt><dd>{d.pa.lo.length}</dd></div>
            <div><dt>{t('pdf.soToa')}</dt><dd>{d.pa.toa.length}</dd></div>
            <div><dt>{t('xls.tongCan')}</dt><dd>{fmtSo(tong)}</dd></div>
            <div><dt>{t('dong.danSo')}</dt><dd>{fmtSo(k.danSo)}</dd></div>
            <div><dt>{t('dong.dtSan')} (m²)</dt><dd>{fmtSo(k.dtSanTinhHSSDD)}</dd></div>
          </dl>
          <h2>{t('pdf.coCauChung')}</h2>
          <table class="in-bang">
            <thead><tr><th>{t('pdf.loaiCan')}</th><th class="so">{t('pdf.soCan')}</th><th class="so">%</th></tr></thead>
            <tbody>{LOAI_CAN.map((l) => <tr key={l}><td><span class="sw" style={{ background: `var(--u-${l})` }} />{NHAN_LOAI[l]}</td><td class="so">{fmtSo(k.coCau[l])}</td><td class="so">{m2(k.coCauPct[l])}</td></tr>)}</tbody>
          </table>
          <h2>{t('pdf.chuGiai')}</h2>
          <ul class="in-chu-giai">{Object.entries({ tm: t('cn.tm'), xh: t('cn.xh'), khac: t('cn.khac') }).map(([k2, v]) => <li key={k2}><span class="sw" style={{ background: MAU_CN[k2] }} />{v}</li>)}
            <li><span class="sw to" style={{ background: '#8fb3ad' }} />{t('pdf.chanToa')}</li><li><span class="sw net" />{t('pdf.chiGioi')}</li></ul>
        </aside>
      </div>
    </Trang>
  );
}

/** Lô có tòa trong phương án (các lô khác — cây xanh, giáo dục… — chưa có phương án nên không có gì để so); chưa đặt tòa nào thì in mọi lô. */
const loCoToa = (d: DuLieuIn): Lo[] => { const c = d.pa.lo.filter((l) => d.pa.toa.some((x) => x.loId === l.id)); return c.length ? c : d.pa.lo; };

const NHAN_MUC: Record<string, string> = { ok: 'pdf.muc.ok', canh_bao: 'pdf.muc.canhBao', vuot: 'pdf.muc.vuot' };

function TheQh({ d, l }: { d: DuLieuIn; l: Lo }) {
  const k = d.kq.theoLo[l.id];
  if (!k) return <div />;
  return (
    <div class="in-the">
      <h3>{l.temDat.kyHieu} <small>{t(`cn.${l.temDat.chucNang}`)} · {fmtSo(k.dtLo)} m² · {t('pdf.bc.soQH')}</small></h3>
      <table class="in-bang">
        <thead><tr><th>{t('pdf.cot.chiTieu')}</th><th class="so">{t('pdf.cot.dat')}</th><th class="so">{t('pdf.cot.qh')}</th><th class="so">{t('pdf.cot.chenh')}</th><th>{t('pdf.cot.muc')}</th></tr></thead>
        <tbody>{k.dong.map((r) => (
          <tr key={r.khoa} class={`muc-${r.muc}`}>
            <td>{t(`dong.${r.khoa}`)}</td><td class="so">{m2(r.dat)}</td><td class="so">{r.mucTieu === null ? '—' : `${r.chieu === '<=' ? '≤' : '≥'} ${m2(r.mucTieu)}`}</td>
            <td class="so">{m2(r.chenh)}</td><td>{r.dat === null || r.mucTieu === null ? '—' : t(NHAN_MUC[r.muc])}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function BangKd({ d, lo }: { d: DuLieuIn; lo: Lo }) {
  const s = thongKeLo(d, lo.id), db = lo.temDat.deBai, mt = lo.temDat.coCauMucTieu;
  const tongMt = LOAI_CAN.reduce((a, l) => a + (mt[l] ?? 0), 0) || 100;
  return (
    <div class="in-the">
      <h3>{lo.temDat.kyHieu} <small>{fmtSo(s.tong)} {t('pdf.can')}{db ? ` · ${t('lo.nguonDeBai').replace('{n}', db.nguon)}` : ''}</small></h3>
      <table class="in-bang">
        <thead><tr><th>{t('pdf.loaiCan')}</th><th class="so">{t('pdf.kd.mucTieu')}</th><th class="so">{t('pdf.kd.pa')}</th><th class="so">{t('pdf.kd.lech')}</th><th class="so">{t('pdf.soCan')}</th><th class="so">{t('pdf.kd.soDeBai')}</th><th class="so">{t('pdf.kd.dtPa')}</th><th class="so">{t('pdf.kd.dtDeBai')}</th></tr></thead>
        <tbody>{LOAI_CAN.map((l) => {
          const mtL = ((mt[l] ?? 0) / tongMt) * 100, lech = s.pct[l] - mtL;
          return (
            <tr key={l}>
              <td><span class="sw" style={{ background: `var(--u-${l})` }} />{NHAN_LOAI[l]}</td>
              <td class="so">{m2(mtL)}</td><td class="so">{m2(s.pct[l])}</td><td class={`so ${Math.abs(lech) > 5 ? 'lech' : ''}`}>{lech > 0 ? '+' : ''}{m2(lech)}</td>
              <td class="so">{fmtSo(s.soCan[l])}</td><td class="so">{db?.soCan[l] === undefined ? '—' : fmtSo(db.soCan[l])}</td>
              <td class="so">{m2(s.dtBq[l])}</td><td class="so">{db?.dtCan[l] === undefined ? '—' : m2(db.dtCan[l])}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

/** Bảng chỉ tiêu phương án: mỗi lô một hàng — trái so với quy hoạch, phải so với đề bài kinh doanh (cơ cấu căn, DT). 3 lô một trang A3. */
const LO_MOI_TRANG = 3;
const chiaTrang = (d: DuLieuIn): Lo[][] => { const ds = loCoToa(d), kq: Lo[][] = []; for (let i = 0; i < ds.length; i += LO_MOI_TRANG) kq.push(ds.slice(i, i + LO_MOI_TRANG)); return kq; };

function TrangChiTieu({ d, ds, so }: { d: DuLieuIn; ds: Lo[]; so: string }) {
  return (
    <Trang d={d} kho="a3n" tieuDe={t('pdf.bc.chiTieu')} so={so}>
      <div class="in-hang-lo">
        {ds.map((l) => <div class="in-hai-the" key={l.id}><TheQh d={d} l={l} /><BangKd d={d} lo={l} /></div>)}
      </div>
    </Trang>
  );
}

function TrangMbToa({ d, n, so }: { d: DuLieuIn; n: NhomToaIn; so: string }) {
  return (
    <Trang d={d} kho="a3n" tieuDe={`${t('pdf.bc.mbTang')} · ${tenNhom(n, d)}`} so={so}>
      <div class="in-hai-cot mb">
        <div class="in-khung-ve"><MbTang n={n} d={d} kieu="leo" tem noiThat={false} /></div>
        <aside>
          <dl class="in-so-lieu">
            <div><dt>{t('pdf.cauTrucTang')}</dt><dd>{dsTang(n)}</dd></div>
            <div><dt>{t('pdf.canTang')}</dt><dd>{n.canTang.reduce((s, c) => s + c.n, 0)}</dd></div>
            <div><dt>{t('pdf.dtxd')}</dt><dd>{fmtSo(n.dai.dtxdM2 ?? d.tv.toa.get(n.mauId)?.dtxd_m2 ?? null, { thapPhan: 0 })} m²</dd></div>
          </dl>
          <BangLoaiCan n={n} d={d} mauSw="leo" />
        </aside>
      </div>
    </Trang>
  );
}

export function BaoCaoIn({ d }: { d: DuLieuIn }) {
  const trang = chiaTrang(d), tong = 1 + trang.length + d.nhom.length, so = (i: number) => `${i}/${tong}`;
  return (
    <>
      <TrangTmb d={d} so={so(1)} />
      {trang.map((ds, i) => <TrangChiTieu key={i} d={d} ds={ds} so={so(2 + i)} />)}
      {d.nhom.map((n, i) => <TrangMbToa key={n.khoa} d={d} n={n} so={so(2 + trang.length + i)} />)}
    </>
  );
}
