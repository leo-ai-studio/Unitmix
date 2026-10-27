import { useMemo } from 'preact/hooks';
import type { CongNangO, Diem, LoaiCan, ThongTinLoi, ThuVien } from '../tinh/kieu';
import { canDangDung, canVuaModule, congNangTai, coDaGiac, hinhLogia, khungCanNet, ranhTo, soCanChuVi, veCanTaiViTri, veLoiTaiViTri, viTriCan, vungCatCan, type BoCuc, type ToaCoMat } from '../tinh/matBang';
import { datTemCan, TEM_H, TEM_W } from '../tinh/temCan';
import { idLoi, type HinhHocTai } from './hinhHocThuVien';
import { LopPhong } from './LopPhong';
import { CHU_CO_CHAN, CHU_KHONG_CHAN, CHU_MAY, KIEU_MB, NET, NET_NOI_THAT, NHAN_LOAI, type KieuMb } from './kieuMb';

export type ToaVe = ToaCoMat & { duong_bao: Diem[] };

type Props = {
  mau: ToaVe;
  /** Bố cục của tầng đang xem (chung hoặc tầng riêng). */
  toa: BoCuc;
  tv: ThuVien;
  hinh: HinhHocTai;
  kieu: KieuMb;
  noiThat: boolean;
  hienTem: boolean;
  canKhoa: string | null;
  /** Bấm ô (e để biết Shift / Ctrl: chọn thêm). */
  onChonO: (khoa: string, e: MouseEvent) => void;
  /** Ô đang chọn thêm (chọn nhiều). */
  dsChon?: string[];
  /** Chuột phải ô / bấm lõi: mở menu ngữ cảnh tại toạ độ màn hình. */
  onMenu?: (loai: 'o' | 'loi', khoa: string, x: number, y: number) => void;
  /** Lõi: thông tin cửa vào / xuống hầm, lên mái để ghi nhãn; lõi đang mở menu. */
  loiTT?: (khoa: string) => ThongTinLoi;
  loiKhoa?: string | null;
  /** Nhãn công năng ô (đã dịch). */
  nhanCongNang?: (cn: CongNangO) => string;
  /** DT thông thủy đề bài KD theo loại (m²); có thì tem hiện chấm màu so với DT căn. */
  deBai?: Partial<Record<LoaiCan, number>>;
  /** Sai lệch DT còn coi là đạt (m²). */
  nguongDt: number;
};

const d = (pts: Diem[]) => 'M' + pts.map((p) => `${Math.round(p[0])} ${Math.round(p[1])}`).join('L');
const fmt = (n: number) => n.toFixed(2);
const trongTam = (P: Diem[]): Diem => [P.reduce((a, p) => a + p[0], 0) / P.length, P.reduce((a, p) => a + p[1], 0) / P.length];

/** Số liệu từng căn trên tầng dùng chung cho bản vẽ, panel và tem: CH-xx, mẫu đang dùng, Loại N. */
export function soLieuTang(mau: ToaVe, toa: BoCuc, tv: ThuVien) {
  const vts = viTriCan(mau, tv);
  const so = soCanChuVi(mau.duong_bao, vts);
  const theoCH = vts.map((vt) => ({ vt, canId: canDangDung(vt, toa), no: so.get(vt.khoa)!, cn: congNangTai(vt.khoa, toa) })).sort((a, b) => a.no - b.no);
  const loai = new Map<string, number>();
  for (const x of theoCH) if (x.cn === 'can' && !loai.has(x.canId)) loai.set(x.canId, loai.size + 1);
  return { vts, can: theoCH, loai };
}

/** Mặt bằng tầng điển hình vẽ trong BanVe (toạ độ mm, lật trục y bằng phép biến đổi nhóm). */
export function MatBangTang({ mau, toa, tv, hinh, kieu, noiThat, hienTem, canKhoa, onChonO, dsChon = [], onMenu, loiTT, loiKhoa, nhanCongNang, deBai, nguongDt }: Props) {
  const K = KIEU_MB[kieu];
  const { can, loai } = useMemo(() => soLieuTang(mau, toa, tv), [mau, toa.canTheo, toa.canViTri, toa.congNang, tv]);
  const menu = (loaiMenu: 'o' | 'loi', khoa: string) => (e: MouseEvent) => {
    if (!onMenu) return;
    e.preventDefault();
    e.stopPropagation();
    onMenu(loaiMenu, khoa, e.clientX, e.clientY);
  };
  const daChon = new Set([...dsChon, ...(canKhoa ? [canKhoa] : [])]);
  const tem = useMemo(() => datTemCan(can.map((c) => c.vt)), [can]);

  const lop = useMemo(
    () =>
      can.map(({ vt, canId, cn }) => {
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
        const tam = trongTam(vt.goc);
        return { vt, canId, cn, tam, ranh: d(ranh) + 'Z', vanh, cat, nhom: cn === 'can' ? [...theoNhom].map(([cat2, ds]) => [cat2, ds.join('')] as const) : [] };
      }),
    [can, hinh.can, mau, tv],
  );

  const loi = useMemo(() => {
    const kq: { khoa: string; san: string | null; tam: Diem; nhom: (readonly [string, string])[] }[] = [];
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
        let san: string | null = null, tam: Diem = [q.x, q.y];
        if (g.bao_tuong_mm) {
          const [a, b, c, e] = g.bao_tuong_mm;
          const pts = veLoiTaiViTri([{ cat: 'bao', pts: [[a, b], [c, b], [c, e], [a, e]] }], q)[0].pts;
          san = d(pts) + 'Z';
          tam = trongTam(pts);
        }
        kq.push({ khoa: `${mi}:${i}`, san, tam, nhom: [...theoNhom].map(([cat, ds]) => [cat, ds.join('')] as const) });
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
      <defs>
        <pattern id="o-gach" patternUnits="userSpaceOnUse" width="700" height="700" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="700" stroke="var(--o-gach)" stroke-width="90" />
        </pattern>
      </defs>
      {lop.map(({ vt, canId, cn, ranh }) => {
        const c = tv.can.get(canId);
        return (
          <path key={`f${vt.khoa}`} d={ranh} data-o={vt.khoa} fill={cn !== 'can' ? `var(--o-${cn})` : c ? K.u[c.loai] : '#eee'}
            fill-opacity={cn !== 'can' ? 0.9 : K.doDac} style={{ cursor: 'pointer' }}
            onClick={(e) => onChonO(vt.khoa, e)} onContextMenu={menu('o', vt.khoa)} />
        );
      })}
      {/* ô đổi công năng: gạch chéo phủ lên màu riêng (ô trống chỉ để màu nền) */}
      {lop.map(({ vt, cn, ranh }) => cn !== 'can' && cn !== 'trong' && <path key={`h${vt.khoa}`} d={ranh} fill="url(#o-gach)" pointer-events="none" />)}
      {/* vành tường quanh căn: tường chung giữa hai căn chỉ được vẽ một lần trong CAD nên phải bù lại */}
      {lop.map(({ vt, vanh }) => vanh && <path key={`v${vt.khoa}`} d={vanh} fill-rule="evenodd" fill={K.tuong} fill-opacity={K.sanTrang ? 0.85 : 0.42} pointer-events="none" />)}
      {lop.map(({ vt, nhom, cat }) => <g key={`n${vt.khoa}`} clip-path={cat ? `url(#cat-${vt.khoa.replace(':', '_')})` : undefined}>{nhomNet(nhom, vt.khoa)}</g>)}
      {loi.map((l) => <g key={`l${l.khoa}`}>{nhomNet(l.nhom, `l${l.khoa}`)}</g>)}
      {/* lõi bấm được: menu lõi (cửa vào, xuống hầm / lên mái) */}
      {onMenu && loi.map((l) => l.san && (
        <path key={`lb${l.khoa}`} d={l.san} data-loi={l.khoa} fill="transparent" stroke={l.khoa === loiKhoa ? 'var(--green)' : 'none'} stroke-width="3"
          vector-effect="non-scaling-stroke" style={{ cursor: 'context-menu' }}
          onClick={menu('loi', l.khoa)} onContextMenu={menu('loi', l.khoa)} />
      ))}
      {loiTT && loi.map((l) => {
        if (!l.san) return null;
        const tt = loiTT(l.khoa);
        const xuong = [tt.thangBo.ham && 'B', tt.thangMay.ham && 'M', tt.hopKT.ham && 'K'].filter(Boolean).join('');
        const len = [tt.thangBo.mai && 'B', tt.thangMay.mai && 'M', tt.hopKT.mai && 'K'].filter(Boolean).join('');
        return (
          <text key={`lt${l.khoa}`} x="0" y="0" class="nhan-loi" text-anchor="middle" font-size="650" pointer-events="none"
            transform={`translate(${Math.round(l.tam[0])} ${Math.round(l.tam[1])}) scale(1 -1)`}>
            {`${tt.cua === 'trai' ? '◀' : '▶'} ${xuong ? '↓' + xuong : ''} ${len ? '↑' + len : ''}`.trim()}
          </text>
        );
      })}
      {/* nét bao DTXD như app cũ: kiểu màn hình = nét đỏ đứt dày 300 mm theo mét thật (phủ kín mép tường khi phóng); kiểu salekit = nét liền mảnh màu tường */}
      <path d={d(mau.duong_bao) + 'Z'} fill="none" pointer-events="none" stroke-linejoin="miter"
        {...(K.sanTrang
          ? { stroke: K.tuong, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }
          : { stroke: '#E0201B', 'stroke-width': 300, 'stroke-dasharray': '2000 1000' })} />
      {lop.filter((x) => daChon.has(x.vt.khoa)).map(({ vt, ranh }) => (
        <path key={`chon${vt.khoa}`} d={ranh} fill="var(--green)" fill-opacity="0.18" stroke="var(--green)" stroke-width="3" stroke-dasharray={vt.khoa === canKhoa ? undefined : '6 3'}
          vector-effect="non-scaling-stroke" pointer-events="none" />
      ))}
      {/* nhãn ô đổi công năng ở tâm ô */}
      {nhanCongNang && lop.map(({ vt, cn, tam }) => cn !== 'can' && (
        <text key={`cn${vt.khoa}`} x="0" y="0" class="nhan-o" text-anchor="middle" font-size="800" pointer-events="none"
          transform={`translate(${Math.round(tam[0])} ${Math.round(tam[1])}) scale(1 -1)`}>{nhanCongNang(cn)}</text>
      ))}
      <LopPhong can={can} mau={mau} tv={tv} />
      {hienTem && can.map(({ vt, canId, no, cn }, i) => {
        const c = tv.can.get(canId);
        const t = tem[i];
        if (!c || !t || cn !== 'can') return null;
        return (
          <g key={`t${vt.khoa}`} transform={`translate(${Math.round(t.cx)} ${Math.round(t.cy)}) scale(1 -1)`} onClick={(e) => onChonO(vt.khoa, e)} onContextMenu={menu('o', vt.khoa)} style={{ cursor: 'pointer' }}>
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
