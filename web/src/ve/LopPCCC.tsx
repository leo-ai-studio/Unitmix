import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { datCaiTang } from '../man/caiTang';
import { layDuLieuMB, useDuLieuMB } from '../man/tuChinhTang';
import type { Diem, ThuVien, ToaDat, TrangThaiPA } from '../tinh/kieu';
import type { ToaMB } from '../tinh/loiThang';
import type { BoCuc } from '../tinh/matBang';
import { chieuCaoPCCC } from '../tinh/pccc';
import { phanTichPCCCTang, soLieuToaPCCC, type KetQuaPCCCTang, type LoaiCuaNC } from '../tinh/pcccTang';
import type { NutHienThi } from '../ui/ThanhHienThi';
import { fmtSo } from '../ui/so';

/**
 * Lớp PCCC trên mặt bằng tầng (nút "Lớp" góc bản vẽ): thoát nạn (cự ly cửa căn → cửa buồng thang, chỉ cảnh báo), thang máy +
 * thang máy chữa cháy với bán kính phục vụ, tủ họng nước + bán kính 18 m (kéo được để đặt tay), cửa ngăn cháy, cửa chia khoang
 * hành lang. Tính ở tinh/pcccTang.ts (nhớ kết quả theo mặt bằng). Toạ độ mm như MatBangTang (nhóm scale(0.001 −0.001)).
 */

export type CaiPCCC = { thoatNan: boolean; thangMay: boolean; tu: boolean; cua: boolean; hanhLang: boolean };
const KHOA_LUU = 'unitmix.lopPCCC';
const docLuu = (): CaiPCCC => {
  const mac = { thoatNan: false, thangMay: false, tu: false, cua: false, hanhLang: false };
  try { return { ...mac, ...JSON.parse(localStorage.getItem(KHOA_LUU) ?? '{}') }; } catch { return mac; }
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

/** Có lớp PCCC nào đang bật (để hiện nút Chú giải). */
export const batLopPCCC = () => cai.thoatNan || cai.thangMay || cai.tu || cai.cua || cai.hanhLang;

/** Năm nút lớp PCCC cho GocBanVe. */
export function nutLopPCCC(): NutHienThi[] {
  return (['thoatNan', 'thangMay', 'tu', 'cua', 'hanhLang'] as const).map((k) => ({
    khoa: `pccc-${k}`, nhan: t(`pc.lop.${k}`), bat: cai[k], onClick: () => datCaiPCCC({ [k]: !cai[k] }),
  }));
}

/** Phân tích PCCC tầng đang xem (cùng mặt bằng KPI dùng); null khi chưa có dữ liệu lõi / tim cửa căn. */
export function usePCCCTang(pa: TrangThaiPA, tv: ThuVien, toa: ToaDat, mau: ToaMB, bc: BoCuc): KetQuaPCCCTang | null {
  useDuLieuMB(tv);
  const dl = layDuLieuMB();
  const sl = useMemo(() => soLieuToaPCCC(pa, tv, toa), [pa, tv, toa]);
  return useMemo(() => {
    if (!dl || !Array.isArray(mau.truc)) return null;
    try {
      return phanTichPCCCTang({
        mau, bc, tv, dl, H: chieuCaoPCCC(toa.soTangDe, toa.caoDe, toa.soTangDH, toa.caoDH), soTangDH: toa.soTangDH,
        soTangNoi: toa.soTangDe + toa.soTangDH, soCanToa: sl.soCan, danToa: sl.dan, tuTay: toa.tuPCCCTay ?? null,
      });
    } catch { return null; }
  }, [mau, bc, tv, dl, toa.soTangDe, toa.caoDe, toa.soTangDH, toa.caoDH, toa.tuPCCCTay, sl]);
}

const r0 = (x: number) => Math.round(x);
const d = (pts: Diem[]) => 'M' + pts.map((p) => `${r0(p[0])} ${r0(p[1])}`).join('L');
/** chữ trong nhóm lật y: đặt tại p, dựng thẳng lại */
const Chu = ({ p, s, cls, co = 520 }: { p: Diem; s: string; cls: string; co?: number }) => (
  <text x="0" y="0" class={cls} font-size={co} text-anchor="middle" transform={`translate(${r0(p[0])} ${r0(p[1])}) scale(1 -1)`}>{s}</text>
);
const MAU_CUA: Record<LoaiCuaNC, string> = { thang: 'pc-cua-thang', can: 'pc-cua-can', tmcc: 'pc-cua-tmcc', rac: 'pc-cua-rac', hanhLang: 'pc-cua-hl' };

/** Bám vị trí tủ vào tường hành lang gần nhất (lệch ½ bề rộng khỏi tim, phía con trỏ). */
function bamTuong(p: Diem, kq: KetQuaPCCCTang): Diem {
  let tot: Diem = p, dTot = Infinity;
  const nua = kq.hanhLang.rong / 2;
  for (const e of kq.hanhLang.doan) {
    const v: Diem = [e.p1[0] - e.p0[0], e.p1[1] - e.p0[1]], L2 = v[0] * v[0] + v[1] * v[1] || 1;
    const s = Math.max(0, Math.min(1, ((p[0] - e.p0[0]) * v[0] + (p[1] - e.p0[1]) * v[1]) / L2));
    const q: Diem = [e.p0[0] + v[0] * s, e.p0[1] + v[1] * s], dd = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (dd >= dTot) continue;
    const n: Diem = [-e.huong[1], e.huong[0]], phia = (p[0] - q[0]) * n[0] + (p[1] - q[1]) * n[1] >= 0 ? 1 : -1;
    tot = [q[0] + n[0] * nua * phia, q[1] + n[1] * nua * phia];
    dTot = dd;
  }
  return tot;
}

export function LopPCCC({ kq, chiXem, datTuTay }: { kq: KetQuaPCCCTang | null; chiXem: boolean; datTuTay: (ds: Diem[] | null) => void }) {
  const c = useCaiPCCC();
  const g = useRef<SVGGElement>(null);
  const [keo, setKeo] = useState<{ i: number; p: Diem } | null>(null);
  if (!kq || !(c.thoatNan || c.thangMay || c.tu || c.cua || c.hanhLang)) return null;
  const hl = kq.hanhLang.rong;

  const veMm = (e: PointerEvent): Diem | null => {
    const m = g.current?.getScreenCTM?.();
    if (!m) return null;
    const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [q.x, q.y];
  };
  const batDauKeo = (i: number) => (e: PointerEvent) => {
    if (chiXem || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const ds = kq.tu.viTri.map((x): Diem => [x[0], x[1]]);
    let cuoi: Diem | null = null;
    const di = (ev: PointerEvent) => { const p = veMm(ev); if (p) { cuoi = bamTuong(p, kq); setKeo({ i, p: cuoi }); } };
    const tha = () => {
      removeEventListener('pointermove', di);
      removeEventListener('pointerup', tha);
      setKeo(null);
      if (!cuoi) return;
      ds[i] = cuoi;
      datTuTay(ds);
    };
    addEventListener('pointermove', di);
    addEventListener('pointerup', tha);
  };

  const tuVe = kq.tu.viTri.map((p, i) => (keo?.i === i ? keo.p : p));
  const canThieuTu = new Set(kq.tu.thieu);
  return (
    <g ref={g} class="lop-pccc">
      {/* hành lang: cửa chia khoang (3.3.5 / A.2.14) — vạch ngang hành lang */}
      {c.hanhLang && kq.hanhLang.cua.map((x, i) => {
        const n: Diem = [-x.huong[1], x.huong[0]], a: Diem = [x.p[0] - n[0] * hl / 2, x.p[1] - n[1] * hl / 2], b: Diem = [x.p[0] + n[0] * hl / 2, x.p[1] + n[1] * hl / 2];
        return (
          <g key={`hl${i}`} class="pc-cnc">
            <path d={d([a, b])} stroke-width="260" />
            <Chu p={[b[0] + n[0] * 700, b[1] + n[1] * 700]} s={`CNC-${String(i + 1).padStart(2, '0')}`} cls="pc-chu pc-chu-cnc" co={480} />
          </g>
        );
      })}
      {/* thang máy: mọi giếng (ô vuông), thang chữa cháy (tô đỏ) + vòng bán kính phục vụ, điểm ngoài bán kính */}
      {c.thangMay && (
        <g class="pc-thang-may">
          {kq.tmcc.batBuoc && kq.tmcc.chon.map((x, i) => <circle key={`r${i}`} class="pc-vong-tmcc" cx={r0(x.p[0])} cy={r0(x.p[1])} r={kq.tmcc.r * 1000} vector-effect="non-scaling-stroke" />)}
          {kq.thangMay.gieng.map((x, i) => {
            const cc = kq.tmcc.batBuoc && kq.tmcc.chon.includes(x);
            return <rect key={`g${i}`} class={cc ? 'pc-gieng tmcc' : 'pc-gieng'} x={r0(x.p[0] - 700)} y={r0(x.p[1] - 700)} width="1400" height="1400" vector-effect="non-scaling-stroke" />;
          })}
          {kq.tmcc.batBuoc && kq.tmcc.chon.map((x, i) => <Chu key={`tl${i}`} p={[x.p[0], x.p[1] - 260]} s={t('pc.tmcc')} cls="pc-chu pc-chu-tmcc" co={560} />)}
          {kq.tmcc.ngoai.map((p, i) => <path key={`n${i}`} class="pc-ngoai" d={`M${r0(p[0] - 350)} ${r0(p[1] - 350)}L${r0(p[0] + 350)} ${r0(p[1] + 350)}M${r0(p[0] - 350)} ${r0(p[1] + 350)}L${r0(p[0] + 350)} ${r0(p[1] - 350)}`} vector-effect="non-scaling-stroke" />)}
        </g>
      )}
      {/* tủ họng nước: vòng R 18 m (QT-77), tủ kéo được; căn chưa phủ khoanh đỏ ở cửa */}
      {c.tu && (
        <g class="pc-tu">
          {tuVe.map((p, i) => <circle key={`rt${i}`} class="pc-vong-tu" cx={r0(p[0])} cy={r0(p[1])} r={kq.tu.r * 1000} vector-effect="non-scaling-stroke" />)}
          {kq.thoatNan.can.filter((x) => canThieuTu.has(x.so)).map((x) => <circle key={`ct${x.so}`} class="pc-thieu" cx={r0(x.p[0])} cy={r0(x.p[1])} r="600" vector-effect="non-scaling-stroke" />)}
          {tuVe.map((p, i) => (
            <g key={`t${i}`} class={`pc-tu-o${chiXem ? '' : ' keo'}`} onPointerDown={batDauKeo(i)}>
              <rect x={r0(p[0] - kq.tu.rongTu / 2 - 150)} y={r0(p[1] - 350)} width={kq.tu.rongTu + 300} height="700" vector-effect="non-scaling-stroke" />
              <Chu p={[p[0], p[1] + 520]} s={`TCC-${String(i + 1).padStart(2, '0')}`} cls="pc-chu pc-chu-tu" co={460} />
            </g>
          ))}
        </g>
      )}
      {/* cửa ngăn cháy: dấu tại tim cửa + nhãn EI */}
      {c.cua && kq.cuaNC.filter((x) => x.loai !== 'hanhLang').map((x, i) => (
        <g key={`c${i}`} class={`pc-cua ${MAU_CUA[x.loai]}`}>
          <rect x={r0(x.p[0] - 450)} y={r0(x.p[1] - 450)} width="900" height="900" transform={`rotate(${r0((Math.atan2(x.huong[1], x.huong[0]) * 180) / Math.PI)} ${r0(x.p[0])} ${r0(x.p[1])})`} vector-effect="non-scaling-stroke" />
          {x.loai !== 'can' && <Chu p={[x.p[0], x.p[1] + 750]} s={x.ei} cls="pc-chu pc-chu-cua" co={420} />}
        </g>
      ))}
      {/* thoát nạn: cự ly từng căn tại cửa căn (đỏ khi vượt), cửa buồng thang khoanh tròn */}
      {c.thoatNan && (
        <g class="pc-thoat-nan">
          {kq.thangBo.map((x, i) => <circle key={`tb${i}`} class="pc-thang-bo" cx={r0(x.p[0])} cy={r0(x.p[1])} r="900" vector-effect="non-scaling-stroke" />)}
          {kq.thoatNan.can.map((x) => (
            <Chu key={`tn${x.so}`} p={[x.p[0], x.p[1] - 1100]} s={x.cuLy === null ? '—' : `${fmtSo(x.cuLy, { thapPhan: 1 })} m`}
              cls={`pc-chu pc-chu-tn${x.vuot ? ' vuot' : ''}`} co={560} />
          ))}
        </g>
      )}
    </g>
  );
}

/** Chú giải PCCC (chỉ các lớp đang bật) cho nút Chú giải góc bản vẽ. */
export function ChuGiaiPCCC({ kq }: { kq: KetQuaPCCCTang | null }) {
  const c = useCaiPCCC();
  if (!kq || !(c.thoatNan || c.thangMay || c.tu || c.cua || c.hanhLang)) return null;
  const dong = (cls: string, chu: string, tip?: string) => <li title={tip}><i class={`pc-ky ${cls}`} aria-hidden="true" /> {chu}</li>;
  return (
    <div class="chu-giai-pccc" aria-label={t('pc.chuGiai')}>
      <b>{t('pc.chuGiai')} · H {fmtSo(kq.H, { thapPhan: 1 })} m</b>
      <ul>
        {c.thoatNan && dong('ky-tn', t('pc.cg.thoatNan').replace('{c}', String(kq.thoatNan.cut)).replace('{d}', String(kq.thoatNan.doi)), kq.thoatNan.canCu)}
        {c.thangMay && dong('ky-gieng', t('pc.cg.gieng'), 'QCVN 04:2021 2.4.1 · 2.4.2')}
        {c.thangMay && dong('ky-tmcc', kq.tmcc.batBuoc ? t('pc.cg.tmcc').replace('{r}', String(kq.tmcc.r)) : t('pc.cg.tmccKhong'), kq.tmcc.canCu)}
        {c.tu && dong('ky-tu', t('pc.cg.tu').replace('{r}', String(kq.tu.r)), t('pc.gt.tu'))}
        {c.cua && dong('ky-cua-thang', t('pc.cg.cuaThang'), 'QCVN 06:2022 3.2.11')}
        {c.cua && dong('ky-cua-can', t('pc.cg.cuaCan'), 'QCVN 06:2022 3.3.5')}
        {c.cua && kq.tmcc.batBuoc && dong('ky-cua-tmcc', t('pc.cg.cuaTmcc'), 'QCVN 06:2022 6.13 · Bảng 3 · Bảng 2')}
        {c.cua && dong('ky-cua-rac', t('pc.cg.cuaRac'), kq.H > 75 ? 'QCVN 06:2022 4.24 · A.2.30.2' : 'QCVN 06:2022 4.24')}
        {c.hanhLang && dong('ky-cnc', t('pc.cg.cnc').replace('{m}', String(kq.hanhLang.gioiHan)), kq.hanhLang.canCu)}
      </ul>
    </div>
  );
}
