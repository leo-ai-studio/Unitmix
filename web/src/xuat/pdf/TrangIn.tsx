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
import { canNhoLo, DT_CAN_NHO, thongKeLo, tongHopChiTieu, unitmixToa, type CotTongHop, type DuLieuIn, type NhomToaIn } from './duLieuIn';
import { CAN_MOI_THANG, DAN_MOI_THANG } from '../../tinh/thangMay';

const m2 = (v: number | null | undefined, n = 1) => (v === null || v === undefined ? '—' : fmtSo(v, { thapPhan: n }));

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
export function MbTang({ n, d, kieu, kieuTem, tem, noiThat, chiO, chon, le = 3, sach, doDay }: { doDay?: boolean; n: NhomToaIn; d: DuLieuIn; kieu: KieuMb; kieuTem?: KieuMb; tem: boolean; noiThat: boolean; chiO?: Diem[]; chon?: string[]; le?: number; sach?: boolean }) {
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
      {doDay && <DoDay n={n} />}
    </svg>
  );
}

/** Đường kích thước theo dãy ô (mm), ngoài mép căn của từng mặt, như bản vẽ tầng điển hình trình duyệt. */
function DoDay({ n }: { n: NhomToaIn }) {
  const CACH = 1.5, CHU = 0.62; // m
  return (
    <g class="in-do-day">
      {n.mau.mat.filter((f) => f.a_cuoi - f.a_dau > 1).flatMap((f, fi) => {
        const r = (f.goc_deg * Math.PI) / 180, u: Diem = [Math.cos(r), Math.sin(r)], m: Diem = [-u[1], u[0]];
        const ds = f.phan_tu.filter((q) => q.loai !== 'loi' && q.rong_mm > 0).sort((a, b) => a.a0 - b.a0);
        if (!ds.length) return [];
        const sau = Math.max(...ds.map((q) => q.sau_mm ?? 8500));
        const pt = (a: number): [number, number] => { const b = f.truc_mm + sau, k = a; return [(u[0] * k + m[0] * b) / 1000 + m[0] * CACH, -((u[1] * k + m[1] * b) / 1000 + m[1] * CACH)]; };
        const mocs = [...new Set(ds.flatMap((q) => [q.a0, q.a1]))].sort((a, b) => a - b);
        const [x0, y0] = pt(mocs[0]), [x1, y1] = pt(mocs[mocs.length - 1]);
        // chữ đọc được: quay theo cạnh, không lộn ngược
        let g = -f.goc_deg % 360; if (g > 90) g -= 180; if (g <= -90) g += 180; if (g > 90) g -= 180;
        return [
          <line key={`l${fi}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#4b5555" stroke-width="0.04" />,
          ...mocs.map((a) => { const [x, y] = pt(a); return <line key={`m${fi}-${a}`} x1={x - m[0] * 0.3} y1={y + m[1] * 0.3} x2={x + m[0] * 0.3} y2={y - m[1] * 0.3} stroke="#4b5555" stroke-width="0.06" />; }),
          ...ds.map((q, i) => {
            const [x, y] = pt((q.a0 + q.a1) / 2), tx = x + m[0] * 0.5, ty = y - m[1] * 0.5;
            return <text key={`t${fi}-${i}`} x={tx} y={ty} font-size={CHU} text-anchor="middle" dominant-baseline="central" fill="#2b3333" transform={`rotate(${g} ${tx} ${ty})`}>{fmtSo(Math.round(q.a1 - q.a0))}</text>;
          }),
        ];
      })}
    </g>
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
          <polygon points={P(l.ranh)} fill={MAU_CN[l.temDat.chucNang] ?? MAU_CN.khac} stroke="#d21f1f" stroke-width={co / 420} stroke-dasharray={`${co / 70} ${co / 140}`} />
          {l.chiGioi && <polygon points={P(l.chiGioi)} fill="none" stroke="#2b52c4" stroke-width={co / 900} stroke-dasharray={`${co / 150} ${co / 300}`} />}
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

/** Keyplan: mọi lô, chân tòa xám, tòa của nhóm đang in tô đỏ. */
function KeyPlan({ d, n }: { d: DuLieuIn; n: NhomToaIn }) {
  const pts = d.pa.lo.flatMap((l) => l.ranh);
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), le = Math.max(x1 - x0, y1 - y0) * 0.04;
  const P = (ps: Diem[]) => ps.map((p) => `${p[0]},${-p[1]}`).join(' ');
  return (
    <svg class="in-tmb" viewBox={`${x0 - le} ${-(y1 + le)} ${x1 - x0 + 2 * le} ${y1 - y0 + 2 * le}`} preserveAspectRatio="xMidYMid meet" role="img">
      {d.pa.lo.map((l) => <polygon key={l.id} points={P(l.ranh)} fill="#f4f3ef" stroke="#8a8f8c" stroke-width="1" vector-effect="non-scaling-stroke" />)}
      {d.pa.toa.map((x) => { const m = mauToa(d.tv, x); return m ? <polygon key={x.id} points={P(chanToa(m, x))} fill={n.toas.some((q) => q.id === x.id) ? '#d21f1f' : '#b7bcb9'} /> : null; })}
    </svg>
  );
}

/** Bảng màu báo cáo: mỗi loại căn một màu dễ phân biệt, như bản vẽ trình duyệt. */
const KIEU_BC: KieuMb = 'sk_rivea';

/** Bảng unit mix một tòa, theo mẫu trình duyệt: DTSD · DTXD · hiệu suất · thang máy theo TK so với 70 căn và 200 dân mỗi thang. */
function BangUnitmix({ n, d }: { n: NhomToaIn; d: DuLieuIn }) {
  const u = unitmixToa(d, n), K = KIEU_MB[KIEU_BC], tt = u.thang;
  return (
    <table class="in-bang in-um">
      <caption>{n.ten} · {fmtSo(u.soTang)} {t('pdf.tangCH')}</caption>
      <thead><tr>
        <th>{t('pdf.loaiCan')}</th><th class="so">{t('pdf.dtKhoang')}</th><th class="so">{t('pdf.tyLeTk')}</th><th class="so">{t('pdf.canTangN')}</th>
        <th class="so">{t('pdf.canToa')}</th><th class="so">{t('pdf.danCan')}</th><th class="so">{t('pdf.danToa')}</th>
      </tr></thead>
      <tbody>{u.dong.map((x) => (
        <tr key={x.can.id}>
          <td style={{ background: K.u[x.can.loai] }}><b>{NHAN_LOAI[x.can.loai]}</b> <small>{x.can.ten_vi.split(' · ')[1] ?? ''}</small></td>
          <td class="so">{m2(x.dt, 2)}</td><td class="so">{m2(x.tyLe)}%</td><td class="so">{x.canTang}</td><td class="so">{fmtSo(x.canToa)}</td><td class="so">{m2(x.nguoi, 1)}</td><td class="so">{fmtSo(x.danToa)}</td>
        </tr>
      ))}</tbody>
      <tfoot>
        <tr class="noi"><td>DTSD</td><td class="so">{m2(u.dtsd, 2)}</td><td class="so">100%</td><td class="so vang">{u.canTang}</td><td class="so vang">{fmtSo(u.canToa)}</td><td /><td class="so vang">{fmtSo(u.danToa)}</td></tr>
        <tr><td>DTXD</td><td class="so">{m2(u.dtxd, 2)}</td><td colSpan={5} /></tr>
        <tr><td>{t('pdf.hieuSuat')}</td><td class="so do">{m2(u.hieuSuat)}%</td><td colSpan={5} /></tr>
        <tr class="noi thang"><td rowSpan={2}>{t('pdf.thangMay')}</td><td class="so">{t('pdf.theoTk')}</td><td colSpan={2} class="so">{CAN_MOI_THANG} {t('pdf.canMoiThang')}</td><td colSpan={3} class="so">{DAN_MOI_THANG} {t('pdf.danMoiThang')}</td></tr>
        <tr class="thang"><td class="so do">{tt.co || '—'}</td><td colSpan={2} class="so do">{m2(tt.canMoiThang, 0)}</td><td colSpan={3} class="so do">{m2(tt.danMoiThang, 0)}</td></tr>
      </tfoot>
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
          <h2>{t('pdf.bangLo')}</h2>
          <table class="in-bang">
            <thead><tr><th>{t('pdf.viTri')}</th><th class="so">{t('pdf.soToa')}</th><th class="so">{t('pdf.tongSoCan')}</th><th class="so">{t('pdf.canNho').replace('{n}', String(DT_CAN_NHO))}</th><th class="so">{t('pdf.tyLeCanNho').replace('{n}', String(DT_CAN_NHO))}</th></tr></thead>
            <tbody>{loCoToa(d).map((l) => { const c = canNhoLo(d, l.id); return <tr key={l.id}><td>{l.temDat.kyHieu}</td><td class="so">{d.pa.toa.filter((x) => x.loId === l.id).length}</td><td class="so">{fmtSo(c.tong)}</td><td class="so">{fmtSo(c.nho)}</td><td class="so do">{c.tong ? m2((c.nho / c.tong) * 100) : '—'}%</td></tr>; })}</tbody>
          </table>
          <h2>{t('pdf.coCauChung')}</h2>
          <table class="in-bang">
            <thead><tr><th>{t('pdf.loaiCan')}</th><th class="so">{t('pdf.soCan')}</th><th class="so">%</th></tr></thead>
            <tbody>{LOAI_CAN.map((l) => <tr key={l}><td><span class="sw" style={{ background: `var(--u-${l})` }} />{NHAN_LOAI[l]}</td><td class="so">{fmtSo(k.coCau[l])}</td><td class="so">{m2(k.coCauPct[l])}</td></tr>)}</tbody>
          </table>
          <h2>{t('pdf.chuGiai')}</h2>
          <ul class="in-chu-giai">{Object.entries({ tm: t('cn.tm'), xh: t('cn.xh'), khac: t('cn.khac') }).map(([k2, v]) => <li key={k2}><span class="sw" style={{ background: MAU_CN[k2] }} />{v}</li>)}
            <li><span class="sw to" style={{ background: '#8fb3ad' }} />{t('pdf.chanToa')}</li><li><span class="sw net" />{t('pdf.chiGioi')}</li><li><span class="sw ranh" />{t('pdf.ranhLo')}</li></ul>
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

/** Bảng tổng hợp so sánh chỉ tiêu toàn phương án: theo QH · theo phương án · chênh, cho từng loại nhà ở và cả dự án. */
function BangTongHop({ d }: { d: DuLieuIn }) {
  const cot = tongHopChiTieu(d);
  type Dong = { nhan: string; qh: (c: CotTongHop) => number | null; pa: (c: CotTongHop) => number | null; so?: number; nguoc?: boolean };
  const ds: Dong[] = [
    { nhan: t('pdf.soToa'), qh: () => null, pa: (c) => c.soToa, so: 0 },
    { nhan: t('pdf.th.dtxd'), qh: (c) => c.dtxd[0], pa: (c) => c.dtxd[1], so: 0 },
    { nhan: t('pdf.th.gfa'), qh: (c) => c.gfa[0], pa: (c) => c.gfa[1], so: 0 },
    { nhan: t('pdf.th.tt'), qh: () => null, pa: (c) => c.dtTt, so: 0 },
    { nhan: t('pdf.soCan'), qh: (c) => c.soCan[0], pa: (c) => c.soCan[1], so: 0 },
    { nhan: t('dong.danSo'), qh: (c) => c.danSo[0], pa: (c) => c.danSo[1], so: 0 },
    { nhan: t('pdf.th.danCan'), qh: (c) => (c.danSo[0] !== null && c.soCan[0] ? c.danSo[0] / c.soCan[0] : null), pa: (c) => (c.soCan[1] ? c.danSo[1] / c.soCan[1] : null), so: 2 },
    { nhan: t('pdf.th.hssdd'), qh: (c) => (c.gfa[0] !== null && c.dtLo ? c.gfa[0] / c.dtLo : null), pa: (c) => (c.dtLo ? c.gfa[1] / c.dtLo : null), so: 2 },
    { nhan: t('pdf.hieuSuat') + ' (%)', qh: () => null, pa: (c) => (c.dtThap ? (c.dtTt / c.dtThap) * 100 : null), so: 1 },
  ];
  const tenCot = (c: CotTongHop) => (c.nhan === 'tong' ? t('pdf.th.tong') : t(`cn.${c.nhan}`));
  return (
    <table class="in-bang in-tong-hop">
      <caption>{t('pdf.th.tieuDe').replace('{pa}', d.tenPA)}</caption>
      <thead>
        <tr><th rowSpan={2}>{t('pdf.cot.chiTieu')}</th>{cot.map((c) => <th key={c.nhan} colSpan={3} class={`giua ${c.nhan === 'tong' ? 'tong' : ''}`}>{tenCot(c)} · {c.soLo} {t('pdf.th.lo')}</th>)}</tr>
        <tr>{cot.flatMap((c) => [<th key={`${c.nhan}q`} class="so">QH</th>, <th key={`${c.nhan}p`} class="so">PA</th>, <th key={`${c.nhan}c`} class="so">{t('pdf.cot.chenh')}</th>])}</tr>
      </thead>
      <tbody>{ds.map((r) => (
        <tr key={r.nhan}>
          <td>{r.nhan}</td>
          {cot.flatMap((c) => {
            const q = r.qh(c), p = r.pa(c), lech = q !== null && p !== null ? p - q : null;
            return [
              <td key={`${c.nhan}q`} class="so">{m2(q, r.so)}</td>, <td key={`${c.nhan}p`} class="so pa">{m2(p, r.so)}</td>,
              <td key={`${c.nhan}c`} class={`so ${lech !== null && lech > 0 ? 'vang' : ''}`}>{lech === null ? '—' : `${lech > 0 ? '+' : ''}${m2(lech, r.so)}`}</td>,
            ];
          })}
        </tr>
      ))}</tbody>
    </table>
  );
}

function TrangTongHop({ d, so }: { d: DuLieuIn; so: string }) {
  return (
    <Trang d={d} kho="a3n" tieuDe={t('pdf.th.trang')} so={so}>
      <div class="in-hang-lo"><BangTongHop d={d} /><p class="in-ghi">{t('pdf.th.ghi')}</p></div>
    </Trang>
  );
}

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
        <div class="in-khung-ve"><MbTang n={n} d={d} kieu={KIEU_BC} tem noiThat={false} le={4} sach doDay /></div>
        <aside>
          <dl class="in-so-lieu">
            <div><dt>{t('pdf.cauTrucTang')}</dt><dd>{dsTang(n)}</dd></div>
            <div><dt>{t('pdf.soToa')}</dt><dd>{n.toas.length}</dd></div>
          </dl>
          <BangUnitmix n={n} d={d} />
          <h2>{t('pdf.keyplan')}</h2>
          <div class="in-key"><KeyPlan d={d} n={n} /></div>
        </aside>
      </div>
    </Trang>
  );
}

export function BaoCaoIn({ d }: { d: DuLieuIn }) {
  const trang = chiaTrang(d), tong = 2 + trang.length + d.nhom.length, so = (i: number) => `${i}/${tong}`;
  return (
    <>
      <TrangTmb d={d} so={so(1)} />
      <TrangTongHop d={d} so={so(2)} />
      {trang.map((ds, i) => <TrangChiTieu key={i} d={d} ds={ds} so={so(3 + i)} />)}
      {d.nhom.map((n, i) => <TrangMbToa key={n.khoa} d={d} n={n} so={so(3 + trang.length + i)} />)}
    </>
  );
}
