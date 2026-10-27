import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import type { ThuVien, ToaDat } from '../tinh/kieu';
import { tai } from '../ve/hinhHocThuVien';
import type { NetVe } from '../tinh/matBang';
import type { ToaVe } from '../ve/MatBangTang';
import { asciiHoa, danhSachChen, taoDxf, taoScr, THU_VIEN_XREF_MAC_DINH } from '../xuat/xuatCad';

type Props = { toa: ToaDat; mau: ToaVe; tv: ThuVien; ten: string; dong: () => void };

function taiVe(noiDung: string, tenTep: string, loai: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([noiDung], { type: loai }));
  a.download = tenTep;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Hộp xuất CAD của tòa đang xem: `.scr` ghép XREF → .dwg, hoặc `.dxf` nhúng hình học. */
export function HopXuatCad({ toa, mau, tv, ten, dong }: Props) {
  const [tenBv, setTenBv] = useState(asciiHoa(`${ten} ${mau.ten_vi.split(' · ')[0]}`).trim().replace(/\s+/g, '_'));
  const [goc, setGoc] = useState(THU_VIEN_XREF_MAC_DINH);
  const [hinh, setHinh] = useState<Map<string, NetVe[]> | null>(null);
  const [loi, setLoi] = useState<Map<string, { paths: NetVe[] }> | null>(null);
  useEffect(() => {
    let huy = false;
    const ds = danhSachChen({ mau, toa, tv, ten: '', goc: '', hinh: new Map() });
    const canIds = [...new Set(ds.filter((x) => x.loai === 'can' && x.no).map((x) => x.no!))];
    const blocks = [...new Set(ds.filter((x) => x.loai !== 'can').map((x) => x.ten))];
    Promise.all([
      Promise.all(canIds.map((id) => tai<{ ve: NetVe[] }>(`/lib/can/${id}.json`).then((j) => [id, j?.ve ?? []] as const))),
      Promise.all(blocks.map((b) => tai<{ paths: NetVe[] }>(`/lib/loi/loi-${b.replace(/^x_/, '').replace(/_/g, '-')}.json`).then((j) => [b, j ?? { paths: [] }] as const))),
    ]).then(([a, b]) => { if (!huy) { setHinh(new Map(a)); setLoi(new Map(b)); } });
    return () => { huy = true; };
  }, [mau, toa.canTheo, toa.canViTri, tv]);
  const du = () => ({ mau, toa, tv, ten: tenBv || 'MatBang', goc: goc || THU_VIEN_XREF_MAC_DINH, hinh: hinh!, loi: loi! });
  const san = !!hinh && !!loi;
  const ten0 = asciiHoa(tenBv || 'MatBang');
  return (
    <div class="hop-3d" role="dialog" aria-modal="true" aria-label={t('xcad.tieuDe')} onClick={(e) => { if (e.target === e.currentTarget) dong(); }}>
      <div class="hop-xuat">
        <button type="button" class="dong-hop" onClick={dong} aria-label={t('m3d.dong')}>×</button>
        <h3>{t('xcad.tieuDe')}</h3>
        <p class="muted">{t('xcad.moTa').replace('{t}', mau.ten_vi.split(' · ')[0])}</p>
        <label class="o-chon"><span>{t('xcad.tenBanVe')}</span><input type="text" value={tenBv} onInput={(e) => setTenBv(e.currentTarget.value)} /></label>
        <label class="o-chon"><span>{t('xcad.thuMuc')}</span><input type="text" value={goc} onInput={(e) => setGoc(e.currentTarget.value)} /></label>
        <div class="khoi-xuat">
          <b>{t('xcad.scr')}</b>
          <span class="muted">{t('xcad.scrMoTa')}</span>
          <button type="button" class="nut-chinh" disabled={!san} onClick={() => taiVe(taoScr(du()), `${ten0}.scr`, 'text/plain;charset=us-ascii')}>{t('xcad.taiScr')}</button>
        </div>
        <div class="khoi-xuat">
          <b>{t('xcad.dxf')}</b>
          <span class="muted">{t('xcad.dxfMoTa')}</span>
          <button type="button" class="nut-chinh" disabled={!san} onClick={() => taiVe(taoDxf(du()), `${ten0}.dxf`, 'application/dxf')}>{t('xcad.taiDxf')}</button>
        </div>
        {!san && <p class="muted">{t('m3d.dangDung')}</p>}
      </div>
    </div>
  );
}
