/**
 * Công cụ SỬA MẶT BẰNG TẦNG của Leo AI — đúng đường giao diện màn Tầng:
 * - đổi căn / công năng / STRETCH / tối ưu / về mẫu / cơ cấu tầng: updater của `man/ManTang.tsx` + tự chỉnh `suaTuChinh` (tangChung.ts);
 * - thanh công cụ tay (đổi chỗ, thêm / xoá căn, lật, thang bộ): `PhepTay` qua `chayPhep` (tinh/tayNen.ts) như `man/CongCuTang.tsx`.
 * Mỗi công cụ = một `kho.sua` = một bước hoàn tác; không hợp lệ thì trả lý do (câu `cc.loi.*` của giao diện), PA giữ nguyên.
 * Quy tắc thang bộ (AI_START 7): mặc định 2, tối đa 3, luôn có một N2 + một N3 — các phép thang tự kiểm (`nhieu_thang`, `it_thang`).
 */
import { t } from '../../i18n/i18n';
import { mauToa } from '../../tinh/canThem';
import { apDoiViTri, apDoiViTriTang, datCoCauTang, doiCanTaiViTri, doiCanTheoTang, doiCongNang, veMauGoc } from '../../tinh/doiCan';
import { LOAI_CAN, type CongNangO, type LoaiCan, type ThuVien, type ToaDat } from '../../tinh/kieu';
import { sanToa } from '../../tinh/kpi';
import { THANG_N2, THANG_N3, tuChinhToa, type DuLieuMB, type ToaMB } from '../../tinh/loiThang';
import { boCucTang, coCauRiengTang, ungVienDoi, ungVienKhacRong, viTriCan } from '../../tinh/matBang';
import { chieuCaoPCCC } from '../../tinh/pccc';
import { ST_BUOC, ST_MAX, stretchTay } from '../../tinh/stretch';
import { chayPhep, phepTay, type PhepTay } from '../../tinh/tayNen';
import { mauThem } from '../../tinh/thaoTacTay';
import { toiUuCoCau } from '../../tinh/toiUu';
import { LOAI_CAN_SCHEMA, S, type CongCu, type Schema } from './dinhNghia';
import { buocHoanTac, canTV, kiemSua, LoiCongCu, suaPA, timToa, tron, type NguCanh } from './nguCanh';
import { doiToa, dungTang, suaTuChinhVoi, tangHopLe, tenCH, timO, tomTatTang } from './tangChung';

const tangSchema: Schema = { type: 'array', items: { type: 'integer', minimum: 1 }, description: 'tầng điển hình (1..soTangDH) áp thao tác; bỏ trống = mặt bằng điển hình chung (mọi tầng không có bố cục riêng)' };
const oSchema = S.chu('ô: key "mặt:phần tử" hoặc nhãn CH-xx (từ get_floor_plan)');

type ChuanBi = { tv: ThuVien; dl: DuLieuMB; toa: ToaDat; tangs: number[] | null; k0: number | null; tang: ReturnType<typeof dungTang> };

async function chuanBi(ng: NguCanh, v: Record<string, unknown>, sua = true): Promise<ChuanBi> {
  if (sua) kiemSua(ng);
  const tv = canTV(ng), pa = ng.kho.lay();
  const toa = timToa(pa, v.tower_id as string);
  const tangs = tangHopLe(toa, v.floors);
  const dl = await ng.dl(pa);
  if (!dl) throw new LoiCongCu(t('cc.loi.chuaTai'));
  const toaMoi = ng.kho.lay().toa.find((x) => x.id === toa.id) ?? toa; // PA có thể đổi trong lúc chờ tải
  const k0 = tangs?.[0] ?? null;
  return { tv, dl, toa: toaMoi, tangs, k0, tang: dungTang(tv, dl, toaMoi, k0) };
}

/** Kết quả gọn sau sửa tầng: tầng vừa sửa + tổng căn của tòa. */
function sauSua(ng: NguCanh, c: ChuanBi, them: Record<string, unknown> = {}) {
  const toa = ng.kho.lay().toa.find((x) => x.id === c.toa.id)!;
  ng.ui.dat({ toaId: toa.id, loId: toa.loId, tangs: c.tangs });
  return { ...them, toa: toa.id, so_can_toa: sanToa(c.tv, toa).soCan, tang_sau: tomTatTang(c.tv, c.dl, toa, c.k0, false), buoc_hoan_tac: buocHoanTac(ng) };
}

/** Chạy một phép tay (thanh công cụ màn Tầng) rồi chốt vào kho như `apKetQua` của CongCuTang. */
function chotPhep(ng: NguCanh, c: ChuanBi, ph: PhepTay) {
  const r = chayPhep(ph, { tv: c.tv, dl: c.dl });
  if (!r.ok) throw new LoiCongCu(t(`cc.loi.${r.lyDo}`).replace('{n}', r.chiTiet ?? '') + (r.chiTiet ? ` (${r.chiTiet})` : ''));
  suaPA(ng, (p) => ({ ...p, toa: p.toa.map((y) => (y.id === c.toa.id ? r.toa : y)) }));
  return { canh_bao: r.canhBao ?? null, chan: r.chan.map((x) => `${x.khoa} ${x.loai}`) };
}

/** Sửa qua `suaTuChinh` (tự chỉnh XC-03…PC-11 trong cùng bước). Trả căn bị chặn (không vừa, giữ căn cũ). */
function chotTuChinh(ng: NguCanh, c: ChuanBi, fn: (x: ToaDat) => ToaDat, tay = true) {
  let chan: string[] = [];
  suaPA(ng, (q) => {
    const r = suaTuChinhVoi(q, c.tv, c.dl, c.toa.id, (p) => doiToa(p, c.toa.id, fn), tay);
    chan = r.chan.map((x) => `${x.khoa} (${x.loai}, ô ${x.rongO} mm < ${x.rongMin} mm)`);
    return r.pa;
  });
  return chan;
}

/** Chọn mẫu căn mới cho ô: theo unit_id, hoặc theo loại (ưu tiên cùng bề ngang như danh sách đổi căn của màn Tầng). */
function chonMauDoi(tv: ThuVien, canId: string, unitId?: string, loai?: LoaiCan): { id: string; cungRong: boolean } {
  const cung = ungVienDoi(canId, tv), khac = ungVienKhacRong(canId, tv);
  if (unitId) {
    if (unitId === canId) throw new LoiCongCu(`Ô đã là ${unitId}.`);
    if (cung.some((c) => c.id === unitId)) return { id: unitId, cungRong: true };
    if (khac.some((c) => c.id === unitId)) return { id: unitId, cungRong: false };
    throw new LoiCongCu(`Mẫu ${unitId} không đổi được ở ô đang dùng ${canId}. Cùng bề ngang: ${cung.map((c) => c.id).join(', ') || '—'}; khác bề ngang: ${khac.map((c) => c.id).join(', ') || '—'}.`);
  }
  const a = cung.find((c) => c.loai === loai) ?? khac.find((c) => c.loai === loai);
  if (!a) throw new LoiCongCu(`Không có mẫu ${loai} đổi được ở ô đang dùng ${canId} (cùng nhóm, cùng chiều sâu).`);
  return { id: a.id, cungRong: cung.includes(a) };
}

export const CONG_CU_TANG: CongCu[] = [
  {
    ten: 'change_units', nhom: 'tang', sua: true,
    moTa: 'Đổi mẫu căn ở các ô (như chọn căn rồi bấm mẫu khác ở panel phải màn Tầng), có tự chỉnh mặt bằng; MỘT bước hoàn tác cho cả danh sách. Mỗi thay đổi: cell + unit_id, hoặc cell + unit_type (stu/1pn/2pn/2pnp/3pn — tự chọn mẫu cùng bề ngang trước). same_template_all = true (mặc định, như "sửa nhiều") đổi mọi ô cùng mẫu gốc trên phạm vi tầng; đổi sang mẫu khác bề ngang luôn chỉ một ô. Căn không vừa thì bị chặn, giữ căn cũ (báo trong "chan").',
    schema: S.doiTuong({
      tower_id: S.chu(), floors: tangSchema,
      changes: S.ds(S.doiTuong({ cell: oSchema, unit_id: S.chu(), unit_type: S.chon([...LOAI_CAN]) }, ['cell'])),
      same_template_all: S.bool(),
    }, ['tower_id', 'changes']),
    chay: async (v, ng) => {
      const c = await chuanBi(ng, v);
      const ds = v.changes as { cell: string; unit_id?: string; unit_type?: LoaiCan }[];
      if (!ds.length) throw new LoiCongCu('changes rỗng.');
      const nhieu0 = v.same_template_all !== false;
      const vts = c.tang.sl.vts;
      const viec = ds.map((d) => {
        if (!d.unit_id && !d.unit_type) throw new LoiCongCu(`Ô ${d.cell}: thiếu unit_id hoặc unit_type.`);
        const o = timO(c.tang.sl.can, d.cell);
        if (o.cn !== 'can') throw new LoiCongCu(`Ô ${tenCH(o.no)} đang là "${o.cn}", không phải căn hộ — đổi công năng trước (set_cell_function).`);
        const m = chonMauDoi(c.tv, o.canId, d.unit_id, d.unit_type);
        return { o, ...m, truoc: o.canId };
      });
      const chan = chotTuChinh(ng, c, (x0) => viec.reduce((x, w) => (c.tangs
        ? doiCanTheoTang(x, c.tangs, w.o.vt, w.id, vts, w.cungRong && nhieu0)
        : doiCanTaiViTri(x, w.o.vt, w.id, vts, w.cungRong && nhieu0)), x0));
      return sauSua(ng, c, { da_doi: viec.map((w) => `${tenCH(w.o.no)} ${w.truoc} → ${w.id}`), chan });
    },
  },
  {
    ten: 'swap_units', nhom: 'tang', sua: true,
    moTa: 'Đổi chỗ hai căn (kéo ✥ căn thả lên căn khác): đổi mẫu, công năng, lật rồi dồn khít; không vừa thì trả lý do.',
    schema: S.doiTuong({ tower_id: S.chu(), floors: tangSchema, a: oSchema, b: oSchema }, ['tower_id', 'a', 'b']),
    chay: async (v, ng) => {
      const c = await chuanBi(ng, v);
      const a = timO(c.tang.sl.can, v.a as string), b = timO(c.tang.sl.can, v.b as string);
      return sauSua(ng, c, { ...chotPhep(ng, c, phepTay('doiChoTay', c.toa, c.tangs, a.vt, b.vt)), doi_cho: [tenCH(a.no), tenCH(b.no)] });
    },
  },
  {
    ten: 'add_unit', nhom: 'tang', sua: true,
    moTa: 'Thêm căn (＋): ô neo là căn thì chèn căn mới ngay sau (before = true: ngay trước) — dãy dài ra ở đầu tự do; ô neo đang trống / đã xoá / kỹ thuật thì đặt căn vào chính ô đó. unit_id mặc định = mẫu thêm hợp với căn neo. Số căn phải tăng (không làm căn khác vượt cự ly thoát nạn).',
    schema: S.doiTuong({ tower_id: S.chu(), floors: tangSchema, cell: oSchema, unit_id: S.chu(), before: S.bool() }, ['tower_id', 'cell']),
    chay: async (v, ng) => {
      const c = await chuanBi(ng, v);
      const o = timO(c.tang.sl.can, v.cell as string);
      const id = (v.unit_id as string) ?? (o.cn !== 'can' ? o.vt.canGocId : mauThem(c.tv, o.canId)); // ô trống / đã xoá: đặt lại đúng mẫu gốc của ô
      if (!c.tv.can.has(id)) throw new LoiCongCu(`Không có mẫu căn "${id}".`);
      const ph = o.cn !== 'can' ? phepTay('themVaoO', c.toa, c.tangs, o.vt, id) : phepTay('themCanTay', c.toa, c.tangs, o.vt, id, v.before === true);
      return sauSua(ng, c, { ...chotPhep(ng, c, ph), them: id, neo: tenCH(o.no) });
    },
  },
  {
    ten: 'delete_units', nhom: 'tang', sua: true,
    moTa: 'Xoá căn (✕ / Delete): bỏ hẳn ô, dồn khít, dãy ngắn lại ở đầu tự do; ô không bỏ được thì trả lý do.',
    schema: S.doiTuong({ tower_id: S.chu(), floors: tangSchema, cells: S.ds(oSchema) }, ['tower_id', 'cells']),
    chay: async (v, ng) => {
      const c = await chuanBi(ng, v);
      const os = (v.cells as string[]).map((r) => timO(c.tang.sl.can, r));
      return sauSua(ng, c, { ...chotPhep(ng, c, phepTay('xoaCanTay', c.toa, c.tangs, os.map((o) => o.vt.khoa))), da_xoa: os.map((o) => tenCH(o.no)) });
    },
  },
  {
    ten: 'flip_units', nhom: 'tang', sua: true,
    moTa: 'Lật căn (⇋) — một hoặc nhiều ô một bước.',
    schema: S.doiTuong({ tower_id: S.chu(), floors: tangSchema, cells: S.ds(oSchema) }, ['tower_id', 'cells']),
    chay: async (v, ng) => {
      const c = await chuanBi(ng, v);
      const os = (v.cells as string[]).map((r) => timO(c.tang.sl.can, r));
      return sauSua(ng, c, { ...chotPhep(ng, c, phepTay('latTay', c.toa, c.tangs, os.map((o) => o.vt.khoa))), da_lat: os.map((o) => tenCH(o.no)) });
    },
  },
  {
    ten: 'set_cell_function', nhom: 'tang', sua: true,
    moTa: 'Đổi công năng ô (menu chuột phải): can (căn hộ), shcd (sinh hoạt cộng đồng), ky_thuat, thuong_mai, trong (để trống). Có tự chỉnh.',
    schema: S.doiTuong({ tower_id: S.chu(), floors: tangSchema, cells: S.ds(oSchema), function: S.chon(['can', 'shcd', 'ky_thuat', 'thuong_mai', 'trong']) }, ['tower_id', 'cells', 'function']),
    chay: async (v, ng) => {
      const c = await chuanBi(ng, v);
      const os = (v.cells as string[]).map((r) => timO(c.tang.sl.can, r));
      const chan = chotTuChinh(ng, c, (x) => doiCongNang(x, c.tangs, os.map((o) => o.vt.khoa), v.function as CongNangO));
      return sauSua(ng, c, { cong_nang: v.function, o: os.map((o) => tenCH(o.no)), chan });
    },
  },
  {
    ten: 'stairs', nhom: 'tang', sua: true,
    moTa: 'Thang bộ (áp MỌI tầng): add (thêm thang ngay sau ô after_cell; tối đa 3), delete (stair_key; tối thiểu 2), move (stair_key tới ngay sau after_cell), set_type (stair_key → N2/N3; luôn giữ ít nhất một N2 và một N3, đổi N2 duy nhất thì thang gần nhất đổi sang N2), reset_auto (thang về tự động PC-11, bỏ thang đặt tay). Quy tắc: mặc định 2 thang (một N2 + một N3), tối đa 3.',
    schema: S.doiTuong({ tower_id: S.chu(), action: S.chon(['add', 'delete', 'move', 'set_type', 'reset_auto']), stair_key: S.chu('key thang từ get_floor_plan'), after_cell: oSchema, type: S.chon(['N2', 'N3']) }, ['tower_id', 'action']),
    chay: async (v, ng) => {
      const c = await chuanBi(ng, { ...v, floors: undefined });
      const thang = () => { const k = v.stair_key as string; const x = c.tang.thang.find((q) => q.khoa === k); if (!x) throw new LoiCongCu(`Không có thang "${k ?? ''}". Thang hiện có: ${c.tang.thang.map((q) => `${q.khoa} (${q.loai})`).join(', ')}.`); return x; };
      const sau = () => { if (!v.after_cell) throw new LoiCongCu('Thiếu after_cell.'); return timO(c.tang.sl.can, v.after_cell as string); };
      let ph: PhepTay;
      switch (v.action) {
        case 'add': { const o = sau(); ph = phepTay('themThangTay', c.toa, o.vt.matIdx, o.vt.khoa); break; }
        case 'delete': ph = phepTay('xoaThangTay', c.toa, thang().khoa); break;
        case 'move': { const th = thang(), o = sau(); ph = phepTay('doiThangTay', c.toa, th.khoa, o.vt.matIdx, o.vt.khoa); break; }
        case 'set_type': { if (!v.type) throw new LoiCongCu('Thiếu type (N2 / N3).'); ph = phepTay('doiLoaiThangTay', c.toa, thang().khoa, v.type === 'N2' ? THANG_N2 : THANG_N3); break; }
        default: ph = phepTay('thangTuDongLai', c.toa);
      }
      return sauSua(ng, c, chotPhep(ng, c, ph));
    },
  },
  {
    ten: 'optimize_floor', nhom: 'tang', sua: true,
    moTa: 'Tối ưu cơ cấu tầng (nút Tối ưu màn Tầng): đổi mẫu căn để sát cơ cấu mục tiêu (cơ cấu riêng tầng nếu có, không thì của lô) + giảm căn vượt cự ly thoát nạn; change_width (mặc định true) cho phép đổi căn khác bề ngang. Tự chỉnh thang / lõi PC-11 theo.',
    schema: S.doiTuong({ tower_id: S.chu(), floors: tangSchema, change_width: S.bool() }, ['tower_id']),
    chay: async (v, ng) => {
      const c = await chuanBi(ng, v);
      const lo = ng.kho.lay().lo.find((l) => l.id === c.toa.loId);
      const muc = coCauRiengTang(c.toa, c.k0) ?? lo?.temDat.coCauMucTieu ?? { stu: 0, '1pn': 0, '2pn': 0, '2pnp': 0, '3pn': 0 };
      const mau = c.tang.mau;
      const kq = toiUuCoCau(mau, c.tang.bc, c.tv, muc, {
        doiBeNgang: v.change_width !== false, cuaCan: c.dl.cuaCan, dtDeBai: lo?.temDat.deBai?.dtCan,
        chieuCaoPCCC: chieuCaoPCCC(c.toa.soTangDe, c.toa.caoDe, c.toa.soTangDH, c.toa.caoDH),
      });
      if (!kq.soDoi) throw new LoiCongCu('Không tìm được thay đổi nào tốt hơn (cơ cấu đã sát mục tiêu hoặc không còn mẫu đổi được).');
      const vts = viTriCan(mau, c.tv);
      chotTuChinh(ng, c, (x) => (c.tangs ? apDoiViTriTang(x, c.tangs, kq.canViTri, vts) : apDoiViTri(x, kq.canViTri)), false);
      return sauSua(ng, c, { so_doi: kq.soDoi, so_doi_be_ngang: kq.soDoiRong, diem_lech_truoc: tron(kq.diemTruoc, 1), diem_lech_sau: tron(kq.diemSau, 1), pccc_vuot_truoc: kq.pcccTruoc, pccc_vuot_sau: kq.pcccSau, muc_tieu: muc });
    },
  },
  {
    ten: 'reset_floor_units', nhom: 'tang', sua: true,
    moTa: 'Đưa mọi căn của tòa về mẫu gốc (nút Về mẫu): bỏ mọi đổi căn (chung + từng tầng), tự chỉnh lại.',
    schema: S.doiTuong({ tower_id: S.chu() }, ['tower_id']),
    chay: async (v, ng) => {
      const c = await chuanBi(ng, { ...v, floors: undefined });
      chotTuChinh(ng, c, veMauGoc, false);
      return sauSua(ng, c);
    },
  },
  {
    ten: 'stretch_unit', nhom: 'tang', sua: true,
    moTa: `STRETCH tay một căn (QT-81): delta_mm bội số ${ST_BUOC}, tổng tối đa ±${ST_MAX} mm so mẫu gốc; căn kề cùng đoạn bù ngược, không bù được thì dãy dài ra ở đầu tự do (điển hình chung) hoặc bị chặn.`,
    schema: S.doiTuong({ tower_id: S.chu(), floors: tangSchema, cell: oSchema, delta_mm: S.nguyen(undefined, -ST_MAX, ST_MAX) }, ['tower_id', 'cell', 'delta_mm']),
    chay: async (v, ng) => {
      const c = await chuanBi(ng, v);
      const d = v.delta_mm as number;
      if (!d || d % ST_BUOC) throw new LoiCongCu(`delta_mm phải là bội số khác 0 của ${ST_BUOC}.`);
      const o = timO(c.tang.sl.can, v.cell as string);
      const ks = c.tangs ?? [null];
      const kqs = ks.map((k) => ({ k, r: stretchTay(c.tang.mau, boCucTang(c.toa, k), c.tv, o.vt.khoa, d, { choDaiRa: k === null }) }));
      const hong = kqs.find((x) => !x.r.ok);
      if (hong && !hong.r.ok) throw new LoiCongCu(t(`st.loi.${hong.r.lyDo}`).replace('{v}', String(ST_MAX)).replace('{n}', String(o.no)));
      const vtOf = (kh: string) => c.tang.sl.vts.find((x) => x.khoa === kh)!;
      const chan = chotTuChinh(ng, c, (x0) => kqs.reduce((x, { k, r }) => (!r.ok ? x : r.doi.reduce((a, [kh, id]) =>
        (k === null ? doiCanTaiViTri(a, vtOf(kh), id, c.tang.sl.vts, false) : doiCanTheoTang(a, [k], vtOf(kh), id, c.tang.sl.vts, false)), x)), x0));
      return sauSua(ng, c, { stretch: `${tenCH(o.no)} ${d > 0 ? '+' : ''}${d} mm`, chan });
    },
  },
  {
    ten: 'set_floor_mix_target', nhom: 'tang', sua: true,
    moTa: 'Cơ cấu mục tiêu riêng cho các tầng (thay cơ cấu của lô khi tối ưu các tầng đó); mix = null để bỏ, về theo lô.',
    schema: S.doiTuong({ tower_id: S.chu(), floors: tangSchema, mix: { ...LOAI_CAN_SCHEMA('%'), nullable: true } }, ['tower_id', 'floors', 'mix']),
    chay: (v, ng) => {
      const pa = ng.kho.lay(), toa = timToa(pa, v.tower_id as string);
      const tangs = tangHopLe(toa, v.floors);
      if (!tangs) throw new LoiCongCu('Cần floors (tầng điển hình cụ thể).');
      const lo = pa.lo.find((l) => l.id === toa.loId);
      const muc = v.mix === null ? null : { ...(lo?.temDat.coCauMucTieu ?? { stu: 0, '1pn': 0, '2pn': 0, '2pnp': 0, '3pn': 0 }), ...(v.mix as Record<LoaiCan, number>) };
      suaPA(ng, (p) => doiToa(p, toa.id, (x) => datCoCauTang(x, tangs, muc)));
      return { toa: toa.id, tang: tangs, co_cau: muc ?? 'theo_lo', buoc_hoan_tac: buocHoanTac(ng) };
    },
  },
  {
    ten: 'repack_floor', nhom: 'tang', sua: true,
    moTa: 'Chạy lại tự chỉnh mặt bằng tòa (dồn khít XC-04, thang / lõi PC-11, sảnh, hành lang QT-69) — dùng khi mặt bằng còn khe / đè.',
    schema: S.doiTuong({ tower_id: S.chu() }, ['tower_id']),
    chay: async (v, ng) => {
      const c = await chuanBi(ng, { ...v, floors: undefined });
      suaPA(ng, (p) => doiToa(p, c.toa.id, (x) => tuChinhToa(x, mauToa(c.tv, x) as ToaMB, c.tv, c.dl)), 'Mặt bằng đã khít — tự chỉnh không đổi gì.');
      return sauSua(ng, c);
    },
  },
];

