import { useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { useDongHop } from '../ui/useDongHop';
import { LopNoi } from '../ui/LopNoi';
import { docDeBai, type DeBaiDoc } from '../nhap/deBaiKD';
import { docTepExcel, luoiTuChuDan } from '../nhap/docExcel';
import type { Sheet } from '../nhap/luoi';
import { LOAI_CAN, type Lo } from '../tinh/kieu';
import { fmtSo } from '../ui/so';
import { chonSheetTheoLoai, DS_LOAI_NHA, loaiNhaCuaLo, loaiTrongTen, type LoaiNhaO } from '../tinh/loaiNha';
import { anhThanhBang } from '../troLy/docAnhDeBai';

type PhamVi = 'lo' | 'cungLoai' | 'datO';

/** Hộp thoại: chọn loại nhà ở, dán bảng / chọn Excel / chọn ảnh đề bài của kinh doanh → xem trước → áp cơ cấu + DT căn vào các lô loại đó. */
export function NhapDeBai({ ds, loChon, dong, ap }: { ds: Lo[]; loChon: Lo; dong: () => void; ap: (moi: Lo[]) => void }) {
  const { lop, dongMem } = useDongHop(dong);
  const [chu, setChu] = useState('');
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [sheet, setSheet] = useState('');
  const [nguon, setNguon] = useState('');
  const [kq, setKq] = useState<DeBaiDoc | null>(null);
  const [pham, setPham] = useState<PhamVi>('cungLoai');
  const [loai, setLoai] = useState<LoaiNhaO>(loaiNhaCuaLo(loChon) ?? 'tm');
  const [dangDocAnh, setDangDocAnh] = useState(false);
  const [loiAnh, setLoiAnh] = useState('');

  function docChu(v: string) {
    setChu(v);
    setSheets(null);
    setNguon(t('db.nguonDan'));
    setKq(v.trim() ? docDeBai(luoiTuChuDan(v)) : null);
  }
  async function chonTep(f: File) {
    const s = await docTepExcel(f);
    const l = loaiTrongTen(f.name) ?? loai;
    setLoai(l);
    setSheets(s);
    setNguon(f.name);
    doiSheet(s, sheetTot(s, l), f.name, l);
  }
  /** Sheet đọc được dòng loại căn, ưu tiên sheet ghi đúng loại nhà ở đang chọn. */
  const sheetTot = (s: Sheet[], l: LoaiNhaO) => chonSheetTheoLoai(s, (x) => docDeBai(x.luoi, l).dong.length > 0, l)!.ten;
  function chonLoai(l: LoaiNhaO) {
    setLoai(l);
    if (sheets) doiSheet(sheets, sheetTot(sheets, l), nguon, l);
  }
  /** Ảnh / PDF: mô hình chép bảng ra chữ, sau đó đi đúng đường bảng dán để người dùng xem trước và sửa. */
  async function chonAnh(f: File) {
    setDangDocAnh(true); setLoiAnh('');
    try {
      const l = loaiTrongTen(f.name);
      if (l) setLoai(l);
      docChu(await anhThanhBang(f));
      setNguon(f.name || t('db.nguonAnh'));
    } catch (e) {
      setLoiAnh(t('db.loiAnh').replace('{e}', String((e as Error).message ?? e)));
    } finally { setDangDocAnh(false); }
  }
  function danAnh(e: ClipboardEvent) {
    const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/'));
    if (f) { e.preventDefault(); void chonAnh(f); }
  }
  function doiSheet(s: Sheet[], ten: string, tep = nguon, l = loai) {
    setSheet(ten);
    setNguon(tep);
    setKq(docDeBai(s.find((x) => x.ten === ten)!.luoi, l));
  }

  const apDung = (l: Lo) =>
    pham === 'lo' ? l.id === loChon.id : pham === 'cungLoai' ? loaiNhaCuaLo(l) === loai : l.temDat.chucNang !== 'khac';
  const soLo = ds.filter(apDung).length;

  return (
    <LopNoi>
    <div class={`hop-thoai${lop}`} role="dialog" aria-modal="true" aria-labelledby="tieu-de-db">
      <div>
        <h2 id="tieu-de-db">{t('db.tieuDe')}</h2>
        <p class="muted" style={{ margin: 0 }}>{t('db.giaiThich')}</p>
        <div class="nhom-nut" role="group" aria-label={t('db.loaiNha')}>
          {DS_LOAI_NHA.map((k) => <button type="button" key={k} aria-pressed={loai === k} title={t('gt.db.loaiNha')} onClick={() => chonLoai(k)}>{t(`cn.${k}`)}</button>)}
        </div>
        <label title={t('gt.db.dan')}>{t('db.dan')}
          <textarea rows={6} value={chu} placeholder={'Loại căn\tTỷ lệ\tDT (m²)\nStudio\t5%\t30\n1PN\t20%\t45\n2PN\t45%\t65\n2PN+1\t15%\t75\n3PN\t15%\t90'}
            onInput={(e) => docChu(e.currentTarget.value)} onPaste={danAnh} style={{ fontFamily: 'monospace', fontSize: '12px', padding: '8px', border: '1px solid var(--line)', borderRadius: '5px' }} />
        </label>
        <div class="dong" style={{ gap: '8px', padding: 0 }}>
          <label class="nut-phu" title={t('gt.db.chonTep')} style={{ cursor: 'pointer', flexDirection: 'row' }}>
            {t('db.chonTep')}
            <input type="file" accept=".xlsx,.xls,.xlsm" class="sr-only" onChange={(e) => e.currentTarget.files?.[0] && chonTep(e.currentTarget.files[0])} />
          </label>
          <label class="nut-phu" title={t('gt.db.chonAnh')} style={{ cursor: dangDocAnh ? 'wait' : 'pointer', flexDirection: 'row' }}>
            {dangDocAnh ? t('db.dangDocAnh') : t('db.chonAnh')}
            <input type="file" accept="image/*,application/pdf,.pdf" class="sr-only" disabled={dangDocAnh} onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (f) void chonAnh(f); }} />
          </label>
          {sheets && (
            <select aria-label={t('nct.sheet')} title={t('gt.db.sheet')} value={sheet} onChange={(e) => doiSheet(sheets, e.currentTarget.value)}>
              {sheets.map((s) => <option value={s.ten}>{s.ten}</option>)}
            </select>
          )}
        </div>
        {loiAnh && <p class="vuot" role="alert" style={{ margin: 0 }}>{loiAnh}</p>}
        {kq && (
          <>
            <div class="bang-nhap" role="table" aria-label={t('db.xemTruoc')}>
              <div class="hang-nhap hang-db dau" role="row"><span>{t('db.loai')}</span><span>{t('db.tyLe')}</span><span>{t('db.soCan')}</span><span>{t('db.dtCan')}</span></div>
              {LOAI_CAN.map((k) => {
                const d = kq.dong.find((x) => x.loai === k);
                return (
                  <div class="hang-nhap hang-db" role="row" key={k}>
                    <span><i class="o-mau" style={{ background: `var(--u-${k})` }} /> {t(`loai.${k}`)}{d && d.nhan !== t(`loai.${k}`) && <small class="muted"> ({d.nhan})</small>}</span>
                    <span>{fmtSo(kq.coCau[k], { thapPhan: 1, donVi: '%' })}</span>
                    <span>{fmtSo(d?.soCan ?? null)}</span>
                    <span>{fmtSo(d?.dtCan ?? null, { thapPhan: 1, donVi: 'm²' })}</span>
                  </div>
                );
              })}
            </div>
            {kq.canhBao.map((c) => <p class="canh-bao" style={{ margin: 0 }} key={c}>{c}</p>)}
            <label title={t('gt.db.apCho')}>{t('db.apCho')}
              <select value={pham} onChange={(e) => setPham(e.currentTarget.value as PhamVi)}>
                <option value="lo">{t('db.pv.lo').replace('{l}', loChon.temDat.kyHieu)}</option>
                <option value="cungLoai">{t('db.pv.cungChucNang').replace('{c}', t(`cn.${loai}`))}</option>
                <option value="datO">{t('db.pv.datO')}</option>
              </select>
            </label>
          </>
        )}
        <div class="chan-hop">
          <button type="button" class="nut-phu" onClick={dongMem}>{t('duAn.huy')}</button>
          <button type="button" class="nut-chinh" disabled={!kq || !kq.dong.length || !soLo}
            onClick={() => {
              const deBai = {
                dtCan: Object.fromEntries(kq!.dong.filter((d) => d.dtCan !== null).map((d) => [d.loai, d.dtCan!])),
                soCan: Object.fromEntries(kq!.dong.filter((d) => d.soCan !== null).map((d) => [d.loai, d.soCan!])),
                nguon: sheet ? `${nguon} · ${sheet}` : nguon,
              };
              ap(ds.map((l) => (apDung(l) ? { ...l, temDat: { ...l.temDat, coCauMucTieu: { ...kq!.coCau }, deBai } } : l)));
              dongMem();
            }}>
            {t('db.ap').replace('{n}', String(soLo))}
          </button>
        </div>
      </div>
    </div>
    </LopNoi>
  );
}
