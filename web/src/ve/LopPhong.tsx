import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { datCaiTang } from '../man/caiTang';
import type { Diem, NguongMau, Phong, ThuVien } from '../tinh/kieu';
import { veCanTaiViTri, type ToaCoMat, type ViTriCan } from '../tinh/matBang';
import { danhGiaPhong, vongNoiTiep, type MucDat } from '../tinh/phong';
import type { NutHienThi } from '../ui/ThanhHienThi';
import { fmtSo } from '../ui/so';

/**
 * Lớp phòng trên mặt bằng tầng (như Architechtures): mỗi phòng một nhãn `Tên · A: … m² (±chênh) · Ø: … m (±chênh)`
 * và vòng tròn nội tiếp lớn nhất tô xanh / cam / đỏ theo mục tiêu loại phòng (`MUC_TIEU_PHONG`) và ngưỡng của PA.
 * Bật bằng hai nút "Kích thước tối thiểu" (vòng + Ø) và "Diện tích" (A) ở thanh dưới bản vẽ; nhãn một phòng chỉ hiện khi
 * chữ đủ lớn để đọc (≥ 7 px trên màn hình). Toạ độ mm như MatBangTang (nằm trong nhóm scale(0.001 −0.001)).
 */

type CaiPhong = { kt: boolean; dt: boolean; nguong: Pick<NguongMau, 'dtCanM2' | 'kichThuocM'> };
let cai: CaiPhong = { kt: false, dt: false, nguong: { dtCanM2: 2, kichThuocM: 0.2 } };
const nghe = new Set<() => void>();
const dat = (p: Partial<CaiPhong>) => {
  cai = { ...cai, ...p };
  nghe.forEach((f) => f());
  datCaiTang({}); // để thanh nút của màn Tầng vẽ lại trạng thái bật / tắt
};

function useCaiPhong(): CaiPhong {
  const [, ve] = useState(0);
  useLayoutEffect(() => {
    const f = () => ve((n) => n + 1);
    nghe.add(f);
    return () => void nghe.delete(f);
  }, []);
  return cai;
}

/** Hai nút bật / tắt lớp phòng cho `ThanhHienThi`; nhận ngưỡng của PA đang mở (`pa.nguong`) để tô màu. */
export function nutLopPhong(nguong: Pick<NguongMau, 'dtCanM2' | 'kichThuocM'>): NutHienThi[] {
  if (nguong.dtCanM2 !== cai.nguong.dtCanM2 || nguong.kichThuocM !== cai.nguong.kichThuocM) cai = { ...cai, nguong };
  return [
    { khoa: 'phongKt', nhan: t('phong.kichThuoc'), bat: cai.kt, onClick: () => dat({ kt: !cai.kt }) },
    { khoa: 'phongDt', nhan: t('phong.dienTich'), bat: cai.dt, onClick: () => dat({ dt: !cai.dt }) },
  ];
}

const TEN_GOC: [RegExp, string][] = [
  [/^Phòng ngủ/, 'phong.ten.ngu'], [/^WC/, 'phong.ten.wc'], [/^Khách \+ bếp/, 'phong.ten.khachBep'], [/^Phòng khách/, 'phong.ten.khach'],
  [/^Bếp/, 'phong.ten.bep'], [/^Lô gia/, 'phong.ten.logia'], [/^Phòng ở chung/, 'phong.ten.chung'], [/^Sảnh/, 'phong.ten.sanh'],
];
/** Tên phòng theo ngôn ngữ giao diện (dữ liệu ghi tiếng Việt; giữ số thứ tự ở cuối). */
const tenPhong = (ten: string): string => {
  const so = / (\d+)$/.exec(ten)?.[1];
  const k = TEN_GOC.find(([re]) => re.test(ten))?.[1];
  return k ? `${t(k)}${so ? ` ${so}` : ''}` : ten;
};

const dau = (v: number, thapPhan: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fmtSo(Math.abs(v), { thapPhan })}`;

type PhongVe = { khoa: string; p: Phong; ranh: Diem[]; tam: Diem; r: number; h: number; dt: { muc: MucDat | null; chenh: number | null }; d: { muc: MucDat | null; chenh: number | null } };

type Props = { can: { vt: ViTriCan; canId: string }[]; mau: ToaCoMat; tv: ThuVien };

export function LopPhong({ can, mau, tv }: Props) {
  const c = useCaiPhong();
  const g = useRef<SVGGElement>(null);
  const [pxMm, setPxMm] = useState(0);
  const bat = c.kt || c.dt;

  // tỷ lệ màn hình (px / mm): đo sau mỗi lần vẽ và mỗi khi BanVe đổi viewBox (phóng / thu / kéo) hay ô chứa đổi cỡ
  useLayoutEffect(() => {
    const el = g.current, svg = el?.ownerSVGElement;
    if (!el || !svg) return;
    const do_ = () => {
      const m = el.getScreenCTM?.();
      if (m) setPxMm((cu) => { const k = Math.hypot(m.a, m.b); return Math.abs(k - cu) > cu * 0.03 ? k : cu; });
    };
    do_();
    const ob = typeof MutationObserver === 'undefined' ? null : new MutationObserver(do_);
    ob?.observe(svg, { attributes: true, attributeFilter: ['viewBox', 'width', 'height'] });
    return () => ob?.disconnect();
  }, [bat]);

  const ds = useMemo(() => {
    const kq: PhongVe[] = [];
    for (const { vt, canId } of can) {
      const cm = tv.can.get(canId);
      if (!cm?.phong) continue;
      cm.phong.forEach((p, i) => {
        const chuan: Diem[] = p.ranh.map(([x, y]) => [x / cm.rong_mm, y / cm.sau_mm]);
        const ranh = veCanTaiViTri([{ cat: 'phong', pts: chuan }], vt, mau)[0].pts;
        const { tam } = vongNoiTiep(ranh, 10);
        const r = (p.d_min_m * 1000) / 2;
        kq.push({ khoa: `${vt.khoa}#${i}`, p, ranh, tam, r, h: Math.min(240, Math.max(90, r / 5)), ...danhGiaPhong(p, c.nguong) });
      });
    }
    return kq;
  }, [can, mau, tv, c.nguong]);

  if (!bat) return null;
  return (
    <g ref={g} class="lop-phong" pointer-events="none">
      {c.kt && ds.map((x) => (
        <circle key={`v${x.khoa}`} cx={Math.round(x.tam[0])} cy={Math.round(x.tam[1])} r={Math.round(x.r)} class={`vong-phong muc-${x.d.muc ?? 'khong'}`} vector-effect="non-scaling-stroke" />
      ))}
      {pxMm > 0 && ds.filter((x) => x.h * pxMm >= 7).map((x) => {
        const dong: { s: string; muc?: MucDat | null }[] = [{ s: tenPhong(x.p.ten) }];
        if (c.dt) dong.push({ s: `A: ${fmtSo(x.p.dt_m2, { thapPhan: 2 })} m²${x.dt.chenh === null ? '' : ` (${dau(x.dt.chenh, 2)})`}`, muc: x.dt.muc });
        if (c.kt) dong.push({ s: `Ø: ${fmtSo(x.p.d_min_m, { thapPhan: 2 })} m${x.d.chenh === null ? '' : ` (${dau(x.d.chenh, 2)})`}`, muc: x.d.muc });
        const y0 = (-(dong.length - 1) * x.h * 1.2) / 2;
        return (
          <g key={`n${x.khoa}`} transform={`translate(${Math.round(x.tam[0])} ${Math.round(x.tam[1])}) scale(1 -1)`}>
            <text class={`nhan-phong${x.p.doan ? ' doan' : ''}`} font-size={Math.round(x.h)} stroke-width={Math.round(x.h * 0.22)} text-anchor="middle">
              {dong.map((d, i) => (
                <tspan key={i} x="0" y={Math.round(y0 + i * x.h * 1.2 + x.h * 0.35)} class={i === 0 ? 'ten' : `muc-${d.muc ?? 'khong'}`}>{d.s}</tspan>
              ))}
            </text>
          </g>
        );
      })}
    </g>
  );
}
