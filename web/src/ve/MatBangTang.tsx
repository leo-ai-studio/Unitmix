import { useMemo } from 'preact/hooks';
import type { Diem, LoaiCan, ThuVien, ToaDat } from '../tinh/kieu';
import { canDangDung, canVuaModule, coDaGiac, hinhLogia, khungCanNet, ranhTo, soCanChuVi, veCanTaiViTri, veLoiTaiViTri, viTriCan, vungCatCan, type ToaCoMat } from '../tinh/matBang';
import { datTemCan, TEM_H, TEM_W } from '../tinh/temCan';
import { idLoi, type HinhHocTai } from './hinhHocThuVien';
import { CHU_CO_CHAN, CHU_KHONG_CHAN, CHU_MAY, KIEU_MB, NET, NET_NOI_THAT, NHAN_LOAI, type KieuMb } from './kieuMb';

export type ToaVe = ToaCoMat & { duong_bao: Diem[] };

type Props = {
  mau: ToaVe;
  toa: Pick<ToaDat, 'canTheo' | 'canViTri'>;
  tv: ThuVien;
  hinh: HinhHocTai;
  kieu: KieuMb;
  noiThat: boolean;
  hienTem: boolean;
  canKhoa: string | null;
  chonCan: (khoa: string | null) => void;
  /** DT thông thủy đề bài KD theo loại (m²); có thì tem hiện chấm màu so với DT căn. */
  deBai?: Partial<Record<LoaiCan, number>>;
  /** Sai lệch DT còn coi là đạt (m²). */
  nguongDt: number;
};

const d = (pts: Diem[]) => 'M' + pts.map((p) => `${Math.round(p[0])} ${Math.round(p[1])}`).join('L');
const fmt = (n: number) => n.toFixed(2);

/** Số liệu từng căn trên tầng dùng chung cho bản vẽ, panel và tem: CH-xx, mẫu đang dùng, Loại N. */
export function soLieuTang(mau: ToaVe, toa: Pick<ToaDat, 'canTheo' | 'canViTri'>, tv: ThuVien) {
  const vts = viTriCan(mau, tv);
  const so = soCanChuVi(mau.duong_bao, vts);
  const theoCH = vts.map((vt) => ({ vt, canId: canDangDung(vt, toa), no: so.get(vt.khoa)! })).sort((a, b) => a.no - b.no);
  const loai = new Map<string, number>();
  for (const x of theoCH) if (!loai.has(x.canId)) loai.set(x.canId, loai.size + 1);
  return { vts, can: theoCH, loai };
}

/** Mặt bằng tầng điển hình vẽ trong BanVe (toạ độ mm, lật trục y bằng phép biến đổi nhóm). */
export function MatBangTang({ mau, toa, tv, hinh, kieu, noiThat, hienTem, canKhoa, chonCan, deBai, nguongDt }: Props) {
  const K = KIEU_MB[kieu];
  const { can, loai } = useMemo(() => soLieuTang(mau, toa, tv), [mau, toa.canTheo, toa.canViTri, tv]);
  const tem = useMemo(() => datTemCan(can.map((c) => c.vt)), [can]);

  const lop = useMemo(
    () =>
      can.map(({ vt, canId }) => {
        const ve = hinh.can.get(canId) ?? [];
        const canMau = tv.can.get(canId);
        const nets = veCanTaiViTri(ve, vt, mau);
        const theoNhom = new Map<string, string[]>();
        for (const n of nets) {
          if (!NET[n.cat] || n.pts.length < 2) continue;
          (theoNhom.get(n.cat) ?? theoNhom.set(n.cat, []).get(n.cat)!).push(d(n.pts));
        }
        // Như app cũ: tô theo đường bao tim tường (đã loại hốc logia); vành tường 125 mm theo khung căn V / ô có hốc logia / ô module.
        const khung = khungCanNet(nets);
        const daGiac = khung ?? hinhLogia(vt, mau, canMau?.logia_lui) ?? vt.goc;
        const ranh = ranhTo(nets) ?? daGiac;
        const vanh = ve.length ? d(daGiac) + 'Z' + d(coDaGiac(daGiac, 125)) + 'Z' : '';
        const cat = canMau && ve.length && canVuaModule(ve, canMau.rong_mm, !!khung) ? d(vungCatCan(vt, mau)) + 'Z' : null;
        return { vt, canId, ranh: d(ranh) + 'Z', vanh, cat, nhom: [...theoNhom].map(([cat2, ds]) => [cat2, ds.join('')] as const) };
      }),
    [can, hinh.can, mau, tv],
  );

  const loi = useMemo(() => {
    const kq: { khoa: string; san: string | null; nhom: (readonly [string, string])[] }[] = [];
    mau.mat.forEach((m, mi) =>
      m.phan_tu.forEach((q, i) => {
        if (q.loai === 'can') return;
        const g = hinh.loi.get(idLoi(q.block));
        if (!g) return;
        const theoNhom = new Map<string, string[]>();
        for (const n of veLoiTaiViTri(g.paths, q)) {
          if (!NET[n.cat] || n.pts.length < 2) continue;
          (theoNhom.get(n.cat) ?? theoNhom.set(n.cat, []).get(n.cat)!).push(d(n.pts));
        }
        let san: string | null = null;
        if (g.bao_tuong_mm) {
          const [a, b, c, e] = g.bao_tuong_mm;
          san = d(veLoiTaiViTri([{ cat: 'bao', pts: [[a, b], [c, b], [c, e], [a, e]] }], q)[0].pts) + 'Z';
        }
        kq.push({ khoa: `${mi}:${i}`, san, nhom: [...theoNhom].map(([cat, ds]) => [cat, ds.join('')] as const) });
      }),
    );
    return kq;
  }, [mau, hinh.loi]);

  const nhomNet = (nhom: readonly (readonly [string, string])[], khoa: string) =>
    nhom
      .filter(([cat]) => noiThat || !NET_NOI_THAT.has(cat))
      .map(([cat, dd]) => {
        const n = NET[cat];
        return (
          <path key={`${khoa}${cat}`} d={dd} fill="none" stroke={K[n.mau]} stroke-width={n.w} stroke-opacity={n.o} stroke-dasharray={n.d}
            stroke-linejoin="round" stroke-linecap={n.d ? 'butt' : 'round'} vector-effect="non-scaling-stroke" pointer-events="none" />
        );
      });

  return (
    <g transform="scale(0.001 -0.001)">
      {/* sàn hành lang và sảnh */}
      <path d={d(mau.duong_bao) + 'Z'} fill={K.sanMau} pointer-events="none" />
      {loi.map((l) => l.san && <path key={`s${l.khoa}`} d={l.san} fill={K.loiMau} pointer-events="none" />)}
      <defs>
        {lop.map(({ vt, cat }) => cat && <clipPath key={`cp${vt.khoa}`} id={`cat-${vt.khoa.replace(':', '_')}`}><path d={cat} /></clipPath>)}
      </defs>
      {lop.map(({ vt, canId, ranh }) => {
        const c = tv.can.get(canId);
        return (
          <path key={`f${vt.khoa}`} d={ranh} fill={c ? K.u[c.loai] : '#eee'} fill-opacity={K.doDac} style={{ cursor: 'pointer' }}
            onClick={() => chonCan(vt.khoa === canKhoa ? null : vt.khoa)} />
        );
      })}
      {/* vành tường quanh căn: tường chung giữa hai căn chỉ được vẽ một lần trong CAD nên phải bù lại */}
      {lop.map(({ vt, vanh }) => vanh && <path key={`v${vt.khoa}`} d={vanh} fill-rule="evenodd" fill={K.tuong} fill-opacity={K.sanTrang ? 0.85 : 0.42} pointer-events="none" />)}
      {lop.map(({ vt, nhom, cat }) => <g key={`n${vt.khoa}`} clip-path={cat ? `url(#cat-${vt.khoa.replace(':', '_')})` : undefined}>{nhomNet(nhom, vt.khoa)}</g>)}
      {loi.map((l) => <g key={`l${l.khoa}`}>{nhomNet(l.nhom, `l${l.khoa}`)}</g>)}
      {/* nét bao DTXD */}
      <path d={d(mau.duong_bao) + 'Z'} fill="none" stroke={K.sanTrang ? K.duongDan : 'var(--vuot, #E0382B)'} stroke-width={K.sanTrang ? 0.8 : 1.4}
        stroke-dasharray={K.sanTrang ? undefined : '6 3'} vector-effect="non-scaling-stroke" pointer-events="none" />
      {canKhoa && lop.filter((x) => x.vt.khoa === canKhoa).map(({ ranh }) => (
        <path key="chon" d={ranh} fill="none" stroke="var(--green)" stroke-width="3" vector-effect="non-scaling-stroke" pointer-events="none" />
      ))}
      {hienTem && can.map(({ vt, canId, no }, i) => {
        const c = tv.can.get(canId);
        const t = tem[i];
        if (!c || !t) return null;
        return (
          <g key={`t${vt.khoa}`} transform={`translate(${Math.round(t.cx)} ${Math.round(t.cy)}) scale(1 -1)`} onClick={() => chonCan(vt.khoa === canKhoa ? null : vt.khoa)} style={{ cursor: 'pointer' }}>
            <TemCan kieu={kieu} no={`CH-${String(no).padStart(2, '0')}`} loai={NHAN_LOAI[c.loai]} soLoai={`Loại ${loai.get(canId)}`}
              tt={fmt(c.dt_tt_m2)} tim={fmt(c.dt_tim_m2)} mauLoai={K.u[c.loai]}
              chamMau={deBai?.[c.loai] ? Math.abs(c.dt_tt_m2 - deBai[c.loai]!) <= nguongDt ? '#2f7d4f' : c.dt_tt_m2 > deBai[c.loai]! ? '#d98a00' : '#b42318' : undefined} />
          </g>
        );
      })}
    </g>
  );
}

type TemProps = { kieu: KieuMb; no: string; loai: string; soLoai: string; tt: string; tim: string; mauLoai: string; chamMau?: string };

/** Tem căn theo mẫu tài liệu của Viện, khung 3760 × 2600 mm, gốc ở tâm tem, y hướng xuống. */
function TemCan({ kieu, no, loai, soLoai, tt, tim, mauLoai, chamMau }: TemProps) {
  const W = TEM_W, H = TEM_H, x = -W / 2, y = -H / 2;
  const T = (s: string, px: number, py: number, size: number, bold: number, mau: string, font: string, anchor: 'start' | 'middle' = 'middle', maxW = W - 300) => (
    <text x="0" y="0" text-anchor={anchor} font-size={size} font-weight={bold} fill={mau} font-family={font}
      transform={`translate(${Math.round(px)} ${Math.round(py)}) scale(${Math.min(1, maxW / Math.max(1, s.length * size * 0.6)).toFixed(3)} 1)`} pointer-events="none">{s}</text>
  );
  const R = (rx: number, ry: number, rw: number, rh: number, fill: string, vien?: string, op = 1) => (
    <rect x={Math.round(rx)} y={Math.round(ry)} width={Math.round(rw)} height={Math.round(rh)} fill={fill} fill-opacity={op} stroke={vien} stroke-width={vien ? 0.6 : undefined} vector-effect="non-scaling-stroke" />
  );
  const cham = chamMau && <circle cx={W / 2 - 260} cy={y + 260} r="150" fill={chamMau} stroke="#fff" stroke-width="0.6" vector-effect="non-scaling-stroke" />;
  if (kieu === 'sk_galia') {
    const h0 = H * 0.44, h1 = (H - h0) / 2;
    return (
      <g>
        {R(x, y, W, H, '#FFFFFF', undefined, 0.9)}{T(no, 0, y + h0 * 0.88, 860, 400, '#0A1817', CHU_CO_CHAN)}
        {R(x, y + h0, W, h1, '#C6CBCB')}{R(x, y + h0 + h1, W, h1, '#EEF2F1')}
        {T(loai, x + W * 0.25, y + h0 + h1 * 0.72, 480, 500, '#0A1817', CHU_KHONG_CHAN, 'middle', W / 2 - 200)}{T(soLoai, x + W * 0.75, y + h0 + h1 * 0.72, 480, 500, '#0A1817', CHU_KHONG_CHAN, 'middle', W / 2 - 200)}
        {T(`${tt} m²`, x + W * 0.25, y + h0 + h1 * 1.72, 480, 400, '#0A1817', CHU_KHONG_CHAN, 'middle', W / 2 - 200)}{T(`${tim} m²`, x + W * 0.75, y + h0 + h1 * 1.72, 480, 400, '#0A1817', CHU_KHONG_CHAN, 'middle', W / 2 - 200)}
        {cham}
      </g>
    );
  }
  if (kieu === 'sk_rivea') {
    const h0 = H * 0.5, xs = x + W * 0.6;
    return (
      <g>
        {R(x, y, W, H, '#FFFFFF', undefined, 0.85)}{R(x, y, xs - x, h0, '#F1E4D7', '#655954')}{R(xs, y, x + W - xs, h0, '#FFF7EE', '#655954')}
        {T(no, (x + xs) / 2, y + h0 * 0.72, 720, 500, '#491E12', CHU_CO_CHAN, 'middle', xs - x - 240)}
        {T(loai, (xs + x + W) / 2, y + h0 * 0.44, 380, 500, '#491E12', CHU_CO_CHAN, 'middle', x + W - xs - 160)}{T(soLoai, (xs + x + W) / 2, y + h0 * 0.86, 340, 400, '#491E12', CHU_CO_CHAN, 'middle', x + W - xs - 160)}
        {T(`DT TT : ${tt} m²`, x + 120, y + h0 + (H - h0) * 0.42, 430, 400, '#645A55', CHU_CO_CHAN, 'start', W - 240)}{T(`DT Tim : ${tim} m²`, x + 120, y + h0 + (H - h0) * 0.86, 430, 400, '#645A55', CHU_CO_CHAN, 'start', W - 240)}
        {cham}
      </g>
    );
  }
  if (kieu === 'sk_hh1') {
    const h1 = H * 0.46, h2 = (H - h1) / 2;
    return (
      <g>
        {R(x, y, W, h1, '#306361')}{R(x, y + h1, W, h2, '#E7C2A9')}{R(x, y + h1 + h2, W, h2, '#FBEDD6')}
        {T(`${no} · ${soLoai}`, 0, y + h1 * 0.72, 720, 700, '#fff', CHU_KHONG_CHAN)}
        {T(`${tt} m²`, 0, y + h1 + h2 * 0.76, 520, 500, '#3B2416', CHU_KHONG_CHAN)}{T(`${tim} m²`, 0, y + h1 + h2 * 1.76, 520, 500, '#3B2416', CHU_KHONG_CHAN)}
        {cham}
      </g>
    );
  }
  const hh = H * 0.42, vien = '#292D2D';
  return (
    <g>
      {R(x, y, W, H, '#FFFFFF', vien, 0.94)}{R(x, y, W, hh, mauLoai, vien, 0.7)}
      {T(`${no} · ${loai}`, 0, y + hh * 0.76, Math.min(hh * 0.62, 900), 700, '#132132', CHU_MAY)}
      {T('DT-TIM', x + W * 0.25, y + hh + 560, 400, 500, '#7C8B9C', CHU_MAY)}{T('DT-TT', x + W * 0.75, y + hh + 560, 400, 500, '#7C8B9C', CHU_MAY)}
      {T(tim, x + W * 0.25, y + H - 320, 520, 600, '#132132', CHU_MAY)}{T(tt, x + W * 0.75, y + H - 320, 520, 600, '#132132', CHU_MAY)}
      {cham}
    </g>
  );
}
