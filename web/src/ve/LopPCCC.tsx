import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { datCaiTang } from '../man/caiTang';
import { datBaoStretch } from '../man/baoStretch';
import { layDuLieuMB, useDuLieuMB } from '../man/tuChinhTang';
import type { Diem, ThuVien, ToaDat, TrangThaiPA } from '../tinh/kieu';
import type { ToaMB } from '../tinh/loiThang';
import type { BoCuc } from '../tinh/matBang';
import { chieuCaoPCCC } from '../tinh/pccc';
import { soLieuToaPCCC, type CuaHLTang, type KetQuaPCCCTang } from '../tinh/pcccTang';
import { nenPCCC } from '../tinh/pcccNen';
import { cncTaoTay, hlDoThi, keoCuaTay, khoiCNC, themCuaTay, cncBam, type DoThiCNC } from '../tinh/cuaNganChay';
import { datTuPCCC, doiTuTay, hinhTu, khoiTu, nhanTu, tachGopTu, TCC_LOAI, tuTayTuKq, type KetQuaTCC, type TuTay } from '../tinh/tuHongNuoc';
import type { NutHienThi } from '../ui/ThanhHienThi';
import { fmtSo } from '../ui/so';

/**
 * Lớp PCCC trên mặt bằng tầng — trình bày như app cũ MDI_Unitmix_v4 (shell.src.html, khối vẽ "QT-77 · tủ họng nước" / "QT-95 ·
 * cửa ngăn cháy hành lang" / "NÉT ĐO HÀNH LANG" / "BÁN KÍNH TỦ"): bốn nút như menu "⚑ PCCC" app cũ — Tủ PCCC (bật), Cửa ngăn cháy HL
 * (bật), Đo HL, Vòi CC — cộng Thoát nạn (cự ly cửa căn, chỉ cảnh báo). Nét KHÔNG đổi dày theo zoom (`vector-effect`), chữ theo mm
 * (phóng theo zoom) đúng cỡ app cũ. Kéo tủ dọc tường HL (QT-77e), kích đúp tủ tách / gộp (QT-77f); kéo cửa dọc hành lang, kích đúp cửa
 * xoá, kích đúp lên hành lang thêm cửa (QT-101). Toạ độ mm (nhóm scale(0.001 −0.001) của MatBangTang).
 */

export type CaiPCCC = { thoatNan: boolean; tu: boolean; cnc: boolean; doHL: boolean; voi: boolean };
const KHOA_LUU = 'unitmix.lopPCCC.v2';
const MAC: CaiPCCC = { thoatNan: false, tu: true, cnc: true, doHL: false, voi: false }; // app cũ: showTcc / showCnc bật, Đo HL / Vòi CC tắt
const docLuu = (): CaiPCCC => {
  try { return { ...MAC, ...JSON.parse(localStorage.getItem(KHOA_LUU) ?? '{}') }; } catch { return { ...MAC }; }
};
let cai: CaiPCCC = docLuu();
const nghe = new Set<() => void>();
export const datCaiPCCC = (p: Partial<CaiPCCC>) => {
  cai = { ...cai, ...p };
  try { localStorage.setItem(KHOA_LUU, JSON.stringify(cai)); } catch { /* chế độ riêng tư */ }
  nghe.forEach((f) => f());
  datCaiTang({}); // thanh nút Lớp vẽ lại trạng thái
};
export function useCaiPCCC(): CaiPCCC {
  const [, ve] = useState(0);
  useLayoutEffect(() => {
    const f = () => ve((n) => n + 1);
    nghe.add(f);
    return () => void nghe.delete(f);
  }, []);
  return cai;
}

const DS_LOP = ['tu', 'cnc', 'doHL', 'voi', 'thoatNan'] as const;
/** Có lớp PCCC nào đang bật (để hiện nút Chú giải). */
export const batLopPCCC = () => DS_LOP.some((k) => cai[k]);

/** Nút lớp PCCC cho GocBanVe (như menu "⚑ PCCC" app cũ). */
export function nutLopPCCC(): NutHienThi[] {
  return DS_LOP.map((k) => ({ khoa: `pccc-${k}`, nhan: t(`pc.lop.${k}`), bat: cai[k], onClick: () => datCaiPCCC({ [k]: !cai[k] }) }));
}

// ---------- phân tích (chạy nền, nhớ theo mặt bằng) ----------
const cuoiTheoToa = new Map<string, KetQuaPCCCTang>();
/** Phân tích PCCC tầng đang xem (cùng mặt bằng KPI dùng). Tính nền: trong lúc chờ trả kết quả gần nhất của tòa (null khi chưa có). */
export function usePCCCTang(pa: TrangThaiPA, tv: ThuVien, toa: ToaDat, mau: ToaMB, bc: BoCuc): KetQuaPCCCTang | null {
  useDuLieuMB(tv);
  const dl = layDuLieuMB();
  const [, ve] = useState(0);
  useEffect(() => nenPCCC.ngheXong(() => ve((n) => n + 1)), []);
  const sl = useMemo(() => soLieuToaPCCC(pa, tv, toa), [pa, tv, toa]);
  if (!dl || !Array.isArray(mau.truc)) return null;
  let kq: KetQuaPCCCTang | null = null;
  try {
    kq = nenPCCC.lay({
      mau, bc, tv, dl, H: chieuCaoPCCC(toa.soTangDe, toa.caoDe, toa.soTangDH, toa.caoDH), soTangDH: toa.soTangDH,
      soTangNoi: toa.soTangDe + toa.soTangDH, soCanToa: sl.soCan, danToa: sl.dan, tuTay: toa.tuPCCCTay ?? null, cncTay: toa.cncTay ?? null,
    });
  } catch { kq = null; }
  if (kq) { cuoiTheoToa.set(toa.id, kq); return kq; }
  return cuoiTheoToa.get(toa.id) ?? null;
}

// ---------- hình học vẽ ----------
const r0 = (x: number) => Math.round(x);
const P = (pts: Diem[]) => pts.map((p) => `${r0(p[0])},${r0(p[1])}`).join(' ');
const cong = (a: Diem, b: Diem): Diem => [a[0] + b[0], a[1] + b[1]];
const nhan = (a: Diem, s: number): Diem => [a[0] * s, a[1] * s];
const fm = (x: number) => (x / 1000).toFixed(1).replace('.', ',');
/** góc chữ chạy dọc u (app cũ `goc`): trong hệ y xuống của màn hình, giữ chữ không lộn ngược */
const gocChu = (u: Diem) => { let a = (-Math.atan2(u[1], u[0]) * 180) / Math.PI; if (a > 90) a -= 180; if (a < -90) a += 180; return a; };
/** chữ trong nhóm lật y, cỡ mm như app cũ (Roboto đậm, viền nền bản vẽ) */
const Chu = ({ p, s, mau, co, vien, u, tip }: { p: Diem; s: string; mau: string; co: number; vien: number; u?: Diem; tip?: string }) => (
  <text x="0" y="0" class="pc-chu" fill={mau} font-size={co} stroke-width={vien} text-anchor="middle" dominant-baseline="middle"
    transform={`translate(${r0(p[0])} ${r0(p[1])}) scale(1 -1)${u ? ` rotate(${gocChu(u).toFixed(1)})` : ''}`}>{tip && <title>{tip}</title>}{s}</text>
);
/** Đang kéo (hoặc đã thả, `xong`: giữ hình nháp tới khi kết quả nền mới về — không nháy về chỗ cũ). */
type KeoTu = { ci: number; ds: TuTay[] | null; kq: KetQuaTCC | null; moved: boolean; xong?: object };
type KeoCua = { i: number; ds: Diem[]; moved: boolean; xong?: object };
const dtNho = new WeakMap<object, DoThiCNC>();
const doThi = (kq: KetQuaPCCCTang) => { let d = dtNho.get(kq.hanhLang.vao); if (!d) { d = hlDoThi(kq.hanhLang.vao); dtNho.set(kq.hanhLang.vao, d); } return d; };

export function LopPCCC({ kq, chiXem, toa, datTuTay, datCncTay }: {
  kq: KetQuaPCCCTang | null; chiXem: boolean; toa: ToaDat;
  datTuTay: (ds: TuTay[] | null) => void; datCncTay: (ds: Diem[] | null) => void;
}) {
  const c = useCaiPCCC();
  const g = useRef<SVGGElement>(null);
  const [keoTu, setKeoTu] = useState<KeoTu | null>(null);
  const [keoCua, setKeoCua] = useState<KeoCua | null>(null);
  const bamCuoi = useRef<{ loai: 'tu' | 'cua'; i: number; t: number; x: number; y: number } | null>(null);
  // kết quả nền mới (khác bản lúc thả) thì bỏ hình nháp
  useEffect(() => {
    if (keoTu?.xong && keoTu.xong !== kq) setKeoTu(null);
    if (keoCua?.xong && keoCua.xong !== kq) setKeoCua(null);
  }, [kq]);
  if (!kq || !batLopPCCC()) return null;
  const tc = keoTu?.kq ?? kq.tu, hl = kq.hanhLang;

  const veMm = (e: { clientX: number; clientY: number }): Diem | null => {
    const m = g.current?.getScreenCTM?.();
    if (!m) return null;
    const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [q.x, q.y];
  };
  /** kích đúp nhận ở lần nhấn thứ hai (cùng vật, ≤ 450 ms, lệch ≤ 6 px) — vật vẽ lại sau lần nhả đầu nên không có dblclick gốc (QT-77f) */
  const laKichDup = (loai: 'tu' | 'cua', i: number, e: PointerEvent) => {
    const b = bamCuoi.current, now = performance.now();
    if (b && b.loai === loai && b.i === i && now - b.t < 450 && Math.hypot(e.clientX - b.x, e.clientY - b.y) <= 6) { bamCuoi.current = null; return true; }
    bamCuoi.current = { loai, i, t: now, x: e.clientX, y: e.clientY };
    return false;
  };
  const theo = (move: (ev: PointerEvent) => void, up: () => void) => {
    const tha = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', tha); removeEventListener('pointercancel', tha); up(); };
    addEventListener('pointermove', move);
    addEventListener('pointerup', tha);
    addEventListener('pointercancel', tha);
  };

  // ---- tủ: kéo bám tường HL (phủ tính lại ngay trên luồng chính, chỉ phần phủ — không giải tối ưu), kích đúp tách / gộp ----
  const batDauTu = (ci: number) => (e: PointerEvent) => {
    if (chiXem || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    if (laKichDup('tu', ci, e)) {
      const r = tachGopTu(kq.vaoTu, kq.tu, toa.tuPCCCTay, ci);
      if ('ds' in r) {
        datTuTay(r.ds);
        datBaoStretch({ loai: 'ok', chu: t(r.kieu === 'tach' ? 'pc.bao.tach' : 'pc.bao.gop').replace('{so}', kq.tu.tu[ci]?.so ?? '') });
      } else datBaoStretch({ loai: 'loi', chu: t(`pc.bao.${r.loi}`).replace('{so}', kq.tu.tu[ci]?.so ?? '') });
      return;
    }
    let cur: KeoTu = { ci, ds: null, kq: null, moved: false }, cho: Diem | null = null, hen = 0;
    // phủ tính lại 15–35 ms / lần (mẫu lớn): gộp các lần rê trong một khung hình
    const tinh = () => {
      hen = 0;
      const p = cho;
      cho = null;
      if (!p) return;
      const ds = doiTuTay(kq.vaoTu, kq.tu, toa.tuPCCCTay, ci, p);
      if (!ds) return; // xa hành lang: tủ đứng yên
      cur = { ci, ds, kq: datTuPCCC({ ...kq.vaoTu, tay: ds }), moved: true };
      setKeoTu(cur);
    };
    theo((ev) => {
      cho = veMm(ev);
      if (cho && !hen) hen = requestAnimationFrame(tinh);
    }, () => {
      if (hen) { cancelAnimationFrame(hen); tinh(); }
      setKeoTu(cur.moved && cur.ds ? { ...cur, xong: kq } : null);
      if (cur.moved && cur.ds) {
        datTuTay(cur.ds);
        const k = cur.kq!, x = k.tu.find((y) => y.iTay === (kq.tu.tay ? kq.tu.tu[ci]?.iTay : ci));
        datBaoStretch({ loai: k.thieu.length || k.thieuHL ? 'loi' : 'ok', chu: (x ? `${x.so} · ` : '') + (k.thieu.length || k.thieuHL
          ? t('pc.bao.thieu').replace('{n}', String(k.thieuDiem.length)) : t('pc.bao.du').replace('{r}', String(k.ban / 1000)).replace('{n}', String(k.tu.length)))
          + (x?.vuong ? ` · ${t('pc.bao.satCua')}` : '') });
      }
    });
    setKeoTu(cur);
  };

  // ---- cửa hành lang: kéo dọc tim hành lang (bước 100 mm), kích đúp xoá; kích đúp lên hành lang thêm ----
  const cuaHien = (): Diem[] => hl.cua.map((x) => [r0(x.p[0]), r0(x.p[1])] as Diem);
  const batDauCua = (i: number) => (e: PointerEvent) => {
    if (chiXem || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    if (laKichDup('cua', i, e)) {
      const ds = cuaHien();
      ds.splice(i, 1);
      datCncTay(ds);
      datBaoStretch({ loai: 'ok', chu: t('pc.bao.xoaCua').replace('{so}', hl.cua[i]?.so ?? '') });
      return;
    }
    const dt = doThi(kq);
    let cur: KeoCua = { i, ds: cuaHien(), moved: false };
    theo((ev) => {
      const p = veMm(ev);
      const q = p && keoCuaTay(dt, p);
      if (!q) return; // không kéo vào lõi / sảnh thang / chỗ không vách
      const ds = cur.ds.slice();
      ds[i] = q;
      cur = { i, ds, moved: true };
      setKeoCua(cur);
    }, () => { setKeoCua(cur.moved ? { ...cur, xong: kq } : null); if (cur.moved) datCncTay(cur.ds); });
  };
  const themCua = (e: MouseEvent) => {
    if (chiXem) return;
    e.stopPropagation();
    const p = veMm(e), q = p && themCuaTay(doThi(kq), p);
    if (!q) return;
    datCncTay([...cuaHien(), q]);
    datBaoStretch({ loai: 'ok', chu: t('pc.bao.themCua') });
  };
  // cửa đang vẽ (kéo: cửa i ở chỗ mới, cờ sạch / lõi tính lại tại chỗ)
  const cuaVe: CuaHLTang[] = hl.cua.map((x, i) => {
    if (keoCua?.i !== i || !keoCua.moved) return x;
    const dt = doThi(kq), h = cncBam(dt, keoCua.ds[i], 600);
    if (!h) return x;
    const y = cncTaoTay(dt, h.ci, h.t, hl.vao.corr);
    return { ...x, p: y.p, huong: y.u, sach: y.sach, loi: y.loi, bu: y.bu };
  });

  const nhanCanCu = (x: CuaHLTang) => (x.K <= 30000 ? t('pc.cnc.canCu30') : t('pc.cnc.canCu60'));
  return (
    <g ref={g} class="lop-pccc">
      {/* hành lang: vùng bấm đúp thêm cửa (QT-101) */}
      {c.cnc && !chiXem && (
        <g class="pc-hl-bam" onDblClick={themCua}>
          {hl.doan.map((e, i) => <line key={i} x1={r0(e.p0[0])} y1={r0(e.p0[1])} x2={r0(e.p1[0])} y2={r0(e.p1[1])} stroke-width={r0(hl.rong * 0.9)} />)}
        </g>
      )}
      {/* NÉT ĐO HÀNH LANG (Đo HL, QT-98): tim từng khoang, số từng khúc + tổng khoang / giới hạn; khoang vượt tô đỏ */}
      {c.doHL && (
        <g class="pc-do-hl">
          {hl.doHL.map((k, ki) => {
            const mau = k.vuot ? 'var(--pc-do)' : 'var(--pc-do-hl)';
            const m0 = k.khuc.reduce((a, b) => (b.L > a.L ? b : a)), n0: Diem = [-m0.u[1], m0.u[0]];
            return (
              <g key={ki} style={{ color: mau }}>
                {k.khuc.map((m, mi) => {
                  const n: Diem = [-m.u[1], m.u[0]];
                  return (
                    <g key={mi}>
                      <polyline points={P([m.a, m.b])} class="pc-do-net" stroke-dasharray="6 3" vector-effect="non-scaling-stroke" />
                      {[m.a, m.b].map((q, z) => <polyline key={z} points={P([cong(q, nhan(n, -250)), cong(q, nhan(n, 250))])} class="pc-do-net" vector-effect="non-scaling-stroke" />)}
                      {m.L >= 1500 && <Chu p={cong(nhan(cong(m.a, m.b), 0.5), nhan(n, -380))} s={fm(m.L)} mau={mau} co={340} vien={90} u={m.u} />}
                    </g>
                  );
                })}
                <Chu p={cong(nhan(cong(m0.a, m0.b), 0.5), nhan(n0, 520))} s={`K${ki + 1} Σ ${fm(k.L)} / ${k.K / 1000} m`} mau={mau} co={420} vien={90} u={m0.u} />
              </g>
            );
          })}
        </g>
      )}
      {/* tủ họng nước (QT-77): tường xây sau lưng (cam), thân tủ hồng viền đỏ + block CAD pccc-800x200 / 500x200, mã TCC-xx */}
      {(c.tu || c.voi || keoTu) && (
        <g class="pc-tcc">
          {tc.tu.map((x, ci) => {
            const { q, nhan: tp } = hinhTu(x), kh = khoiTu(x), K = TCC_LOAI[x.loai], r = K.rong / 2 + 250, h = x.huong, v = x.vao;
            const vung = ([[-r, -650], [r, -650], [r, K.sau + 150], [-r, K.sau + 150]] as Diem[]).map(([a, b]) => cong(cong(x.W, nhan(h, a)), nhan(v, b)));
            const tip = `${x.so} · ${K.ten} ${K.rong}×${K.sau} · ${x.ten} · ${t('pc.tcc.phu').replace('{n}', String(x.nPhu))}` + (x.vuong ? ` · ${t('pc.bao.satCua')}` : '')
              + (x.tru?.m2 ? ` · ${t('pc.tcc.tru').replace('{k}', x.kieu).replace('{m}', x.tru.m2.toFixed(4))}` : '')
              + (chiXem ? '' : ` · ${t(x.loai === 'don' ? 'pc.tcc.keoGop' : 'pc.tcc.keoTach')}`);
            const dang = keoTu?.ci === ci;
            return (
              <g key={ci} class={c.tu ? 'pc-tcc-tu' : 'pc-tcc-tu mo'}>
                {kh.tuong && <polygon points={P(kh.tuong)} class="pc-tcc-tuong" vector-effect="non-scaling-stroke"><title>{tip}</title></polygon>}
                <polygon points={P(q)} class="pc-tcc-than" vector-effect="non-scaling-stroke"><title>{tip}</title></polygon>
                {c.tu && kh.than.map((Q, k) => <polygon key={`t${k}`} points={P(Q)} class="pc-tcc-net" vector-effect="non-scaling-stroke" />)}
                {c.tu && kh.net.map((Q, k) => <polyline key={`n${k}`} points={P(Q)} class="pc-tcc-net" vector-effect="non-scaling-stroke" />)}
                {x.vuong && <polygon points={P(q)} class="pc-tcc-vuong" vector-effect="non-scaling-stroke" />}
                <polygon points={P(vung)} class={`pc-tcc-vung${chiXem ? '' : ' keo'}${dang ? ' dang' : ''}`} onPointerDown={batDauTu(ci)}><title>{tip}</title></polygon>
                {c.tu && <Chu p={tp} s={nhanTu(x)} mau="var(--pc-tcc)" co={300} vien={80} />}
              </g>
            );
          })}
        </g>
      )}
      {/* BÁN KÍNH TỦ (Vòi CC): vòng R 18 m + đường thẳng tới điểm xa nhất "L = …m"; điểm thiếu tia khoanh đỏ. Đang kéo tủ: luôn hiện */}
      {(c.voi || keoTu) && (
        <g class="pc-voi">
          {tc.tu.map((x, i) => {
            const xa = x.xa, ok = xa ? xa.tong <= tc.ban + 1 : true, mau = ok ? 'var(--pc-voi)' : 'var(--pc-do)';
            const L = xa ? Math.hypot(xa.p[0] - x.W[0], xa.p[1] - x.W[1]) : 0, u: Diem = xa ? [(xa.p[0] - x.W[0]) / (L || 1), (xa.p[1] - x.W[1]) / (L || 1)] : [1, 0];
            return (
              <g key={i}>
                <circle cx={r0(x.W[0])} cy={r0(x.W[1])} r={tc.ban} class="pc-voi-ban" vector-effect="non-scaling-stroke" />
                {xa && <polyline points={P([x.W, xa.p])} class="pc-voi-duong" style={{ stroke: mau }} vector-effect="non-scaling-stroke" />}
                {xa && <Chu p={cong(nhan(cong(x.W, xa.p), 0.5), nhan([-u[1], u[0]], 300))} s={`${x.so}→${xa.so == null ? 'HL' : `CH-${String(xa.so).padStart(2, '0')}`}: L=${fm(xa.tong)} / ${fm(tc.ban)} m`}
                  mau={mau} co={320} vien={90} u={u} />}
              </g>
            );
          })}
          {tc.thieuDiem.map((q, i) => (
            <circle key={`t${i}`} cx={r0(q.p[0])} cy={r0(q.p[1])} r={420} class="pc-voi-thieu" vector-effect="non-scaling-stroke">
              <title>{`${q.so == null ? 'HL' : `CH-${String(q.so).padStart(2, '0')}`} · ${t('pc.tcc.thieu').replace('{r}', fm(tc.ban))}`}</title>
            </circle>
          ))}
        </g>
      )}
      {/* cửa ngăn cháy hành lang (QT-95 / 98 / 101): block hai cánh + mã CNC-xx; vùng quét tô nhạt (đỏ đậm hơn khi cánh chồng cửa) */}
      {c.cnc && (
        <g class="pc-cnc">
          {cuaVe.map((x, i) => {
            const k = khoiCNC(x);
            const tip = `${x.so} · ${nhanCanCu(x)} · ${t('pc.cnc.rong').replace('{w}', String(r0(x.w)))}` + (x.sach ? '' : ` · ${t('pc.cnc.quet')}`)
              + (x.loi ? ` · ${t('pc.cnc.loi')}` : '') + (chiXem ? '' : ` · ${t('pc.cnc.keo')}`);
            return (
              <g key={i}>
                <polygon points={P(k.vung)} class={`pc-cnc-vung${x.sach ? '' : ' quet'}${chiXem ? '' : ' keo'}`} onPointerDown={batDauCua(i)}><title>{tip}</title></polygon>
                {k.net.map((q, z) => <polyline key={z} points={P(q)} class="pc-cnc-net" vector-effect="non-scaling-stroke" />)}
                <Chu p={k.nhan} s={x.so} mau="var(--pc-tcc)" co={260} vien={70} />
              </g>
            );
          })}
        </g>
      )}
      {/* thoát nạn: cự ly từng căn tại cửa căn (đỏ khi vượt), cửa buồng thang khoanh tròn */}
      {c.thoatNan && (
        <g class="pc-thoat-nan">
          {kq.thangBo.map((x, i) => <circle key={`tb${i}`} class="pc-thang-bo" cx={r0(x.p[0])} cy={r0(x.p[1])} r={900} vector-effect="non-scaling-stroke" />)}
          {kq.thoatNan.can.map((x) => (
            <Chu key={`tn${x.so}`} p={[x.p[0], x.p[1] - 300]} s={x.cuLy === null ? '—' : `${fmtSo(x.cuLy, { thapPhan: 1 })} m`}
              mau={x.vuot ? 'var(--pc-do)' : 'var(--pc-muc)'} co={420} vien={110} />
          ))}
        </g>
      )}
    </g>
  );
}

/** Chú giải PCCC (chỉ các lớp đang bật) cho nút Chú giải góc bản vẽ — ký hiệu y như trên bản vẽ. */
export function ChuGiaiPCCC({ kq }: { kq: KetQuaPCCCTang | null }) {
  const c = useCaiPCCC();
  if (!kq || !batLopPCCC()) return null;
  const dong = (cls: string, chu: string, tip?: string) => <li title={tip}><i class={`pc-ky ${cls}`} aria-hidden="true" /> {chu}</li>;
  return (
    <div class="chu-giai-pccc" aria-label={t('pc.chuGiai')}>
      <b>{t('pc.chuGiai')} · H {fmtSo(kq.H, { thapPhan: 1 })} m</b>
      <ul>
        {c.tu && dong('ky-tu', t('pc.cg.tu'), t('pc.gt.tu'))}
        {c.tu && kq.tu.truDT.length > 0 && dong('ky-tuong', t('pc.cg.tuong'))}
        {c.voi && dong('ky-voi', t('pc.cg.voi').replace('{r}', String(kq.tu.r)))}
        {c.cnc && dong('ky-cnc', t('pc.cg.cnc').replace('{m}', String(kq.hanhLang.gioiHan)), kq.hanhLang.canCu)}
        {c.doHL && dong('ky-dohl', t('pc.cg.doHL').replace('{m}', String(kq.hanhLang.gioiHan)))}
        {c.thoatNan && dong('ky-tn', t('pc.cg.thoatNan').replace('{c}', String(kq.thoatNan.cut)).replace('{d}', String(kq.thoatNan.doi)), kq.thoatNan.canCu)}
      </ul>
    </div>
  );
}

/** Bộ tủ tay hiện tại (lần sửa đầu chép bộ tự đặt) — cho nút ngoài lớp. */
export const tuTayHienTai = (kq: KetQuaPCCCTang, toa: ToaDat) => tuTayTuKq(kq.tu, toa.tuPCCCTay);
