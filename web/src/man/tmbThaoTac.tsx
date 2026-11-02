/**
 * Công cụ tay màn Tổng mặt bằng (học màn ③ app cũ): lựa chọn nhiều tòa (cấp module, không lưu PA), luật LO-01 / LO-02 đọc từ
 * quy_tac.json, thanh công cụ biểu tượng (lớp phủ `.noi-tren`, không bóp khung giữa) và hộp nhập toạ độ / góc / khoảng dời.
 * Mọi thay đổi đi qua `sua` của kho → hoàn tác được.
 */
import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import type { ToaDat, TrangThaiPA } from '../tinh/kieu';
import { taiQuyTac, traLuat } from '../tinh/quyTac';
import type { KetQuaKiem, LuatTMB } from '../tinh/thaoTacToa';
import { NutBieuTuong } from '../ui/NutBieuTuong';
import { fmtSo } from '../ui/so';
import { batTatHangLoat, useHangLoat } from './xepHangLoat';

// ---- lựa chọn nhiều tòa ----
let chonDs: string[] = [];
const ngheChon = new Set<() => void>();
export const datChonNhieu = (ids: string[]) => { chonDs = [...new Set(ids)]; ngheChon.forEach((f) => f()); };
export function useChonNhieu(): string[] {
  const [, ve] = useState(0);
  useEffect(() => { const f = () => ve((n) => n + 1); ngheChon.add(f); return () => void ngheChon.delete(f); }, []);
  return chonDs;
}
/** Lựa chọn hiệu lực: danh sách nhiều tòa nếu chứa tòa chính, không thì chỉ tòa chính. */
export const luaChon = (pa: TrangThaiPA, ds: string[], toaId: string | null): string[] => {
  const co = new Set(pa.toa.map((x) => x.id));
  return toaId && ds.includes(toaId) ? ds.filter((id) => co.has(id)) : toaId && co.has(toaId) ? [toaId] : [];
};

// ---- tuỳ chọn công cụ (giữ suốt phiên) ----
export type TuyChonTMB = { khung: boolean; bat: boolean; khoaCG: boolean; do: boolean; toaDo: boolean; dsCanhBao: boolean; nhanVP: boolean; nhanToa: boolean };
let tuyChon: TuyChonTMB = { khung: false, bat: true, khoaCG: true, do: false, toaDo: false, dsCanhBao: false, nhanVP: true, nhanToa: true };
const ngheTC = new Set<() => void>();
export const datTuyChon = (p: Partial<TuyChonTMB>) => { tuyChon = { ...tuyChon, ...p }; ngheTC.forEach((f) => f()); };
export function useTuyChon(): TuyChonTMB {
  const [, ve] = useState(0);
  useEffect(() => { const f = () => ve((n) => n + 1); ngheTC.add(f); return () => void ngheTC.delete(f); }, []);
  return tuyChon;
}

// ---- luật LO-01 / LO-02 ----
let luatDaTai: LuatTMB | null = null;
export function useLuatTMB(): LuatTMB | null {
  const [l, setL] = useState(luatDaTai);
  useEffect(() => {
    if (luatDaTai) return;
    let song = true;
    taiQuyTac().then((bo) => {
      const lo01 = traLuat(bo, 'LO-01'), lo02 = traLuat(bo, 'LO-02');
      if (lo01 && lo02) { luatDaTai = { lo01, lo02 }; if (song) setL(luatDaTai); }
    }).catch(() => { /* không tải được luật: vẫn thao tác được, chỉ không kiểm */ });
    return () => { song = false; };
  }, []);
  return l;
}

/** Áp một phép biến đổi lên nhóm tòa (bỏ qua tòa khoá) qua `sua` — một bước hoàn tác. */
export function suaNhom(sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void, ids: string[], fn: (ds: ToaDat[]) => ToaDat[]) {
  sua((p) => {
    const ds = p.toa.filter((x) => ids.includes(x.id) && !x.khoa);
    if (!ds.length) return p;
    const moi = new Map(fn(ds).map((x) => [x.id, x]));
    return { ...p, toa: p.toa.map((x) => moi.get(x.id) ?? x) };
  });
}

type ThanhProps = {
  chiXem: boolean;
  soChon: number;
  coDiChuyen: boolean; // có tòa chọn không khoá
  tatCaKhoa: boolean;
  kiem: KetQuaKiem | null;
  xoay90: () => void;
  lat: () => void;
  nhanBan: () => void;
  khoa: () => void;
  xoa: () => void;
};

/** Thanh công cụ biểu tượng TMB (lớp phủ trên bản vẽ). */
export function ThanhTMB(p: ThanhProps) {
  const tc = useTuyChon();
  const hl = useHangLoat();
  const soLoi = p.kiem ? p.kiem.ngoai.size + p.kiem.lui.length + p.kiem.cap.filter((c) => c.muc === 'loi').length : 0;
  const soCanh = p.kiem ? p.kiem.cap.filter((c) => c.muc === 'canh').length : 0;
  const sua = !p.chiXem;
  return (
    <div class="thanh-tmb" role="toolbar" aria-label={t('tmb.congCu')}>
      <div class="nhom-bt">
        <NutBieuTuong k="chonNhieu" ghiChu={t('tmb.gc.chonNhieu')} bat={tc.khung} onClick={() => datTuyChon({ khung: !tc.khung, do: false })} />
        <NutBieuTuong k="batDinh" ghiChu={t('tmb.gc.batDinh')} bat={tc.bat} onClick={() => datTuyChon({ bat: !tc.bat })} />
        <NutBieuTuong k="khoaCG" ghiChu={t('tmb.gc.khoaCG')} bat={tc.khoaCG} onClick={() => datTuyChon({ khoaCG: !tc.khoaCG })} />
        <NutBieuTuong k="do" ghiChu={t('tmb.gc.do')} bat={tc.do} onClick={() => datTuyChon({ do: !tc.do, khung: false })} />
      </div>
      <div class="nhom-bt">
        <NutBieuTuong k="xoay" ghiChu={t('tmb.gc.xoay')} tat={!sua || !p.coDiChuyen} onClick={p.xoay90} />
        <NutBieuTuong k="lat" ghiChu={t('tmb.gc.lat')} tat={!sua || !p.coDiChuyen} onClick={p.lat} />
        <NutBieuTuong k="nhanBan" ghiChu={t('tmb.gc.nhanBan')} tat={!sua || !p.soChon} onClick={p.nhanBan} />
        <NutBieuTuong k={p.tatCaKhoa ? 'moKhoa' : 'khoa'} ghiChu={t('tmb.gc.khoa')} tat={!sua || !p.soChon} onClick={p.khoa} />
        <NutBieuTuong k="xoa" ghiChu={t('tmb.gc.xoa')} tat={!sua || !p.coDiChuyen} onClick={p.xoa} />
      </div>
      <div class="nhom-bt">
        <NutBieuTuong k="toaDo" ghiChu={t('tmb.gc.toaDo')} bat={tc.toaDo} tat={!p.soChon} onClick={() => datTuyChon({ toaDo: !tc.toaDo })} />
        <NutBieuTuong k="hangLoat" ghiChu={t('tmb.gc.hangLoat')} bat={hl.mo} onClick={batTatHangLoat} />
        <NutBieuTuong k="canhBao" ghiChu={t('tmb.gc.canhBao')} bat={tc.dsCanhBao} onClick={() => datTuyChon({ dsCanhBao: !tc.dsCanhBao })}>
          {soLoi + soCanh > 0 && <span class={soLoi ? 'tmb-dem loi' : 'tmb-dem'}>{soLoi + soCanh}</span>}
        </NutBieuTuong>
      </div>
      {p.soChon > 1 && <span class="tmb-ghi">{t('tmb.daChon').replace('{n}', String(p.soChon))}</span>}
    </div>
  );
}

/** Danh sách vi phạm hiện tại (LO-01 · LO-02 · LO-05), bấm một dòng để chọn tòa. */
export function DsCanhBao({ kiem, ten, chon }: { kiem: KetQuaKiem | null; ten: (id: string) => string; chon: (ids: string[]) => void }) {
  if (!kiem) return null;
  const m = (v: number) => fmtSo(v, { thapPhan: 1, donVi: 'm' });
  const dong = [
    ...[...kiem.ngoai].map((id) => ({ ids: [id], loi: true, chu: `${ten(id)} · ${t('tmb.cb.ngoai')}` })),
    ...kiem.lui.map((v) => ({ ids: [v.toaId], loi: true, chu: `${ten(v.toaId)} · ${t('tmb.cb.lui').replace('{kc}', m(v.kc)).replace('{can}', m(v.can)).replace('{i}', String(v.canh + 1)).replace('{r}', v.rong === null ? '—' : m(v.rong))}` })),
    ...kiem.cap.map((c) => ({ ids: [c.a, c.b], loi: c.muc === 'loi', chu: `${ten(c.a)} ↔ ${ten(c.b)} · ${t(c.muc === 'loi' ? 'tmb.cb.capLoi' : 'tmb.cb.capCanh').replace('{kc}', m(c.kc)).replace('{hoi}', m(c.hoi)).replace('{dai}', m(c.dai))}` })),
  ];
  return (
    <div class="tmb-ds-cb" role="list" aria-label={t('bt.canhBao')}>
      {!dong.length && <span class="muted">{t('tmb.cb.khong')}</span>}
      {dong.map((d, i) => (
        <button type="button" role="listitem" key={i} class={d.loi ? 'loi' : 'canh'} onClick={() => chon(d.ids)}>{d.chu}</button>
      ))}
    </div>
  );
}

/** Hộp nhập chính xác: X / Y / góc (một tòa) và dời Δx / Δy / xoay Δ° cho cả nhóm. */
export function HopToaDo({ ds, tat, datTuyetDoi, doi }: {
  ds: ToaDat[]; tat: boolean;
  datTuyetDoi: (k: 'x' | 'y' | 'gocDo', v: number) => void;
  doi: (dx: number, dy: number, dGoc: number) => void;
}) {
  const [dx, setDx] = useState('0'), [dy, setDy] = useState('0'), [dg, setDg] = useState('0');
  if (!ds.length) return null;
  const mot = ds.length === 1 ? ds[0] : null;
  const so = (s: string) => { const v = Number(s.replace(',', '.')); return Number.isFinite(v) ? v : 0; };
  const ap = () => { doi(so(dx), so(dy), so(dg)); setDx('0'); setDy('0'); setDg('0'); };
  const o = (nhan: string, tip: string, gt: number | string, onDoi: (v: string) => void, enter?: () => void) => (
    <label title={tip}>
      <span>{nhan}</span>
      <input type="number" step="0.1" value={gt} disabled={tat}
        onInput={enter ? (e) => onDoi(e.currentTarget.value) : undefined}
        onChange={enter ? undefined : (e) => onDoi(e.currentTarget.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && enter) { e.preventDefault(); enter(); } e.stopPropagation(); }} />
    </label>
  );
  return (
    <div class="tmb-toa-do" role="group" aria-label={t('bt.toaDo')}>
      {mot && (
        <>
          {o(t('xep.x'), t('gt.xep.x'), mot.x, (v) => datTuyetDoi('x', so(v)))}
          {o(t('xep.y'), t('gt.xep.y'), mot.y, (v) => datTuyetDoi('y', so(v)))}
          {o(t('xep.goc'), t('gt.xep.goc'), mot.gocDo, (v) => datTuyetDoi('gocDo', so(v)))}
          <i class="tmb-vach" />
        </>
      )}
      {o('Δx', t('tmb.gc.dx'), dx, setDx, ap)}
      {o('Δy', t('tmb.gc.dy'), dy, setDy, ap)}
      {o('Δ°', t('tmb.gc.dg'), dg, setDg, ap)}
      <button type="button" class="nut-phu" disabled={tat} onClick={ap}>{t('tmb.apDung')}</button>
    </div>
  );
}
