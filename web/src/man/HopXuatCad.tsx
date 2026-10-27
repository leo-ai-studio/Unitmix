import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { useDongHop } from '../ui/useDongHop';
import type { ThuVien, ToaDat } from '../tinh/kieu';
import { tai } from '../ve/hinhHocThuVien';
import { boCucTang, nhomTang, tangCoRieng, type NetVe } from '../tinh/matBang';
import { idTepCan, laBienThe, veTheoId } from '../tinh/stretch';
import { tenTang } from '../ui/ChonTang';
import type { ToaVe } from '../ve/MatBangTang';
import { asciiHoa, danhSachChen, taoDxf, taoScr, THU_VIEN_XREF_MAC_DINH } from '../xuat/xuatCad';

/** Phạm vi xuất: bố cục chung, một tầng có bố cục riêng, hoặc mỗi nhóm tầng một tệp. */
type PhamVi = 'chung' | 'tat' | number;

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
  const { lop, dongMem } = useDongHop(dong);
  const [tenBv, setTenBv] = useState(asciiHoa(`${ten} ${mau.ten_vi.split(' · ')[0]}`).trim().replace(/\s+/g, '_'));
  const [goc, setGoc] = useState(THU_VIEN_XREF_MAC_DINH);
  const rieng = tangCoRieng(toa);
  const [pv, setPv] = useState<PhamVi>('chung');
  const [hinh, setHinh] = useState<Map<string, NetVe[]> | null>(null);
  const [loi, setLoi] = useState<Map<string, { paths: NetVe[] }> | null>(null);
  const [soKeo, setSoKeo] = useState(0); // số mẫu căn STRETCH đang dùng (xuất nét đã kéo, không XREF)
  useEffect(() => {
    let huy = false;
    // Căn của MỌI bố cục tầng (chung + từng tầng riêng) để chọn phạm vi nào cũng đủ hình.
    const ds = nhomTang(toa).flatMap(({ tang }) => danhSachChen({ mau, toa: boCucTang(toa, tang), tv, ten: '', goc: '', hinh: new Map() }));
    const canIds = [...new Set(ds.filter((x) => x.loai === 'can' && x.no).map((x) => x.no!))];
    const blocks = [...new Set(ds.filter((x) => x.loai !== 'can').map((x) => x.ten))];
    Promise.all([
      Promise.all(canIds.map((id) => tai<{ ve: NetVe[] }>(`/lib/can/${idTepCan(id)}.json`).then((j) => [id, veTheoId(id, j?.ve ?? [], tv)] as const))),
      Promise.all(blocks.map((b) => tai<{ paths: NetVe[] }>(`/lib/loi/loi-${b.replace(/^x_/, '').replace(/_/g, '-')}.json`).then((j) => [b, j ?? { paths: [] }] as const))),
    ]).then(([a, b]) => { if (!huy) { setHinh(new Map(a)); setLoi(new Map(b)); setSoKeo(canIds.filter(laBienThe).length); } });
    return () => { huy = true; };
  }, [mau, toa.canTheo, toa.canViTri, toa.congNang, toa.tangRieng, toa.soTangDH, tv]);
  const du = (tang: number | null) => ({ mau, toa: boCucTang(toa, tang), tv, ten: tenBv || 'MatBang', goc: goc || THU_VIEN_XREF_MAC_DINH, hinh: hinh!, loi: loi! });
  const san = !!hinh && !!loi;
  const ten0 = asciiHoa(tenBv || 'MatBang');
  /** Tên tệp / bản vẽ kèm tên tầng (bố cục chung: "DH"). */
  const duoiTen = (tang: number | null) => `${ten0}_${tang === null ? 'DH' : asciiHoa(tenTang(toa.soTangDe, tang)).replace(/\s+/g, '')}`;
  /** Các tầng cần xuất theo phạm vi đã chọn (null = bố cục chung). */
  const dsTang = (): (number | null)[] => (pv === 'chung' ? [null] : pv === 'tat' ? nhomTang(toa).map((g) => g.tang) : [pv]);
  const xuat = (kieu: 'scr' | 'dxf') => dsTang().forEach((tg, i) => setTimeout(() => {
    const d = du(tg), ten1 = tg === null && pv === 'chung' ? ten0 : duoiTen(tg);
    if (kieu === 'scr') taiVe(taoScr({ ...d, ten: ten1 }), `${ten1}.scr`, 'text/plain;charset=us-ascii');
    else taiVe(taoDxf({ ...d, ten: ten1 }), `${ten1}.dxf`, 'application/dxf');
  }, i * 300)); // tải nhiều tệp: cách nhau để trình duyệt không chặn
  return (
    <div class={`hop-3d${lop}`} role="dialog" aria-modal="true" aria-label={t('xcad.tieuDe')} onClick={(e) => { if (e.target === e.currentTarget) dongMem(); }}>
      <div class="hop-xuat">
        <button type="button" class="dong-hop" onClick={dongMem} aria-label={t('m3d.dong')}>×</button>
        <h3>{t('xcad.tieuDe')}</h3>
        <p class="muted">{t('xcad.moTa').replace('{t}', mau.ten_vi.split(' · ')[0])}</p>
        <label class="o-chon"><span>{t('xcad.tenBanVe')}</span><input type="text" value={tenBv} onInput={(e) => setTenBv(e.currentTarget.value)} /></label>
        <label class="o-chon"><span>{t('xcad.thuMuc')}</span><input type="text" value={goc} onInput={(e) => setGoc(e.currentTarget.value)} /></label>
        {rieng.length > 0 && (
          <label class="o-chon"><span>{t('xcad.phamVi')}</span>
            <select value={String(pv)} onChange={(e) => { const v = e.currentTarget.value; setPv(v === 'chung' || v === 'tat' ? v : Number(v)); }}>
              <option value="chung">{t('xcad.tangChung')}</option>
              {rieng.map((k) => <option value={String(k)}>{tenTang(toa.soTangDe, k)}</option>)}
              <option value="tat">{t('xcad.tatCa')}</option>
            </select>
          </label>
        )}
        <div class="khoi-xuat">
          <b>{t('xcad.scr')}</b>
          <span class="muted">{t('xcad.scrMoTa')}</span>
          <button type="button" class="nut-chinh" disabled={!san} onClick={() => xuat('scr')}>{t('xcad.taiScr')}</button>
        </div>
        <div class="khoi-xuat">
          <b>{t('xcad.dxf')}</b>
          <span class="muted">{t('xcad.dxfMoTa')}</span>
          <button type="button" class="nut-chinh" disabled={!san} onClick={() => xuat('dxf')}>{t('xcad.taiDxf')}</button>
        </div>
        {soKeo > 0 && <p class="muted" title={t('gt.st.xuat')}>{t('st.xuatGhiChu').replace('{n}', String(soKeo))}</p>}
        {!san && <p class="muted">{t('m3d.dangDung')}</p>}
      </div>
    </div>
  );
}
