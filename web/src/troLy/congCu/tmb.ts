/**
 * Công cụ SỬA TỔNG MẶT BẰNG của Leo AI — cùng hàm / cùng updater như màn TMB (man/ManXepToa.tsx `XepTrai` / `XepGiua`,
 * ui/GoiYXepToa.tsx, man/xepHangLoat.tsx, man/loGioiCanh.tsx, man/ManLo.tsx). Mỗi công cụ = một `kho.sua` = một bước hoàn tác.
 */
import { suaNhom } from '../../man/tmbThaoTac';
import { tinhChiTieu } from '../../tinh/chiTieu';
import { taoToaTrenLo } from '../../tinh/hopLo';
import { LOAI_CAN, PHAN_HAM_MAC_DINH, type ChiTieuQH, type KhaiDanSo, type Lo, type ToaDat, type TrangThaiPA } from '../../tinh/kieu';
import { laCaoTang } from '../../tinh/loaiDat';
import { taoLo } from '../../tinh/macDinh';
import { timQuyTac } from '../../tinh/quyTacDanSo';
import { boCanhDuong, datCanhDuong, dichNhom, hinhToa, kiemViPham, latNhom, tamNhom, viTriNhanBan, xoayNhom } from '../../tinh/thaoTacToa';
import { apHangLoat, loXepDuoc, thuTuLo, xepHangLoatNen, type KetQuaLo } from '../../tinh/xepHangLoat';
import { goiYXepToaNen, type GoiYXep } from '../../tinh/xepToa';
import { LOAI_CAN_SCHEMA, S, type CongCu } from './dinhNghia';
import { buocHoanTac, canTV, idToaMoi, kiemSua, LoiCongCu, suaPA, timLo, timToa, tron, type NguCanh } from './nguCanh';

const doiLo = (p: TrangThaiPA, id: string, fn: (l: Lo) => Lo): TrangThaiPA => ({ ...p, lo: p.lo.map((l) => (l.id === id ? fn(l) : l)) });
const doiToa = (p: TrangThaiPA, id: string, fn: (x: ToaDat) => ToaDat): TrangThaiPA => ({ ...p, toa: p.toa.map((x) => (x.id === id ? fn(x) : x)) });

/** Tóm tắt sau sửa TMB: số tòa / căn lô, chỉ tiêu QH chưa đạt, cảnh báo LO-01/02/05 của các tòa liên quan. */
async function sauSuaTmb(ng: NguCanh, loIds: string[], toaIds: string[] = []) {
  const pa = ng.kho.lay(), tv = canTV(ng);
  const kq = tinhChiTieu(pa, tv);
  const luat = await ng.luat();
  const kv = kiemViPham(pa, hinhToa(pa, tv), luat);
  const lienQuan = (id: string) => !toaIds.length || toaIds.includes(id) || loIds.includes(pa.toa.find((x) => x.id === id)?.loId ?? '');
  return {
    lo: loIds.map((id) => ({
      id, so_toa: pa.toa.filter((x) => x.loId === id).length, so_can: kq.theoLo[id]?.soCan ?? 0,
      chi_tieu_chua_dat: (kq.theoLo[id]?.dong ?? []).filter((d) => d.muc !== 'ok').map((d) => `${d.khoa} ${tron(d.dat)} ${d.chieu} ${tron(d.mucTieu)} (${d.muc})`),
    })),
    canh_bao: [
      ...[...kv.ngoai].filter(lienQuan).map((id) => `LO-05 ${id} ra ngoài chỉ giới`),
      ...kv.lui.filter((x) => lienQuan(x.toaId)).map((x) => `LO-01 ${x.toaId} lùi ${tron(x.kc)} m < ${tron(x.can)} m (cạnh ${x.canh})`),
      ...kv.cap.filter((x) => lienQuan(x.a) || lienQuan(x.b)).map((x) => `LO-02 ${x.a}–${x.b} cách ${tron(x.kc)} m < ${tron(x.hoi)} m (${x.muc})`),
    ],
    tong_can_du_an: kq.tong.soCan,
    buoc_hoan_tac: buocHoanTac(ng),
  };
}

const tomGoiY = (g: GoiYXep, i: number) => ({
  option: i, mau: g.mau, so_toa: g.toa.length, tang_dh: g.soTangDH, so_can: g.soCan, so_can_muc_tieu: g.soCanMuc, lech_co_cau: tron(g.lech, 1),
  ty_le_san: tron(g.tyLeSan, 3), mat_do: tron(g.matDo, 1), dan_so: tron(g.danSo, 0), loi_qh: g.loiQH, pccc_vuot: g.pcccVuot, huong_tot: g.huongTot, canh_bao: g.canhBao,
  ...(g.theoMucTieu ? { theo_muc_tieu: { mau_du_kien: g.theoMucTieu.duKien, thieu_toa: g.theoMucTieu.thieuToa, dtxd_pct: tron(g.theoMucTieu.dtxdPct, 1), thieu_dtxd_pct: tron(g.theoMucTieu.thieuDtxd, 1) } } : {}),
  view_tb: g.view === null || g.view === undefined ? null : tron(g.view, 1), view_pct_tot: g.viewTot === null || g.viewTot === undefined ? null : tron(g.viewTot, 0),
});

/** Nhớ phương án gợi ý theo lô (như ui/GoiYXepToa giữ theo `khoaLo`). */
const nhoGoiY = new Map<string, { khoa: string; ds: GoiYXep[] }>();
const khoaLo = (pa: TrangThaiPA, lo: Lo) => lo.id + '|' + JSON.stringify([lo.ranh, lo.chiGioi, lo.canhDuong ?? null, lo.temDat.chucNang, lo.temDat.chiTieu, lo.temDat.coCauMucTieu,
  pa.toa.filter((x) => x.loId !== lo.id).map((x) => [x.mauId, x.x, x.y, x.gocDo, x.soTangDH]), pa.huongView ?? null]);

async function goiYLo(ng: NguCanh, lo: Lo, theoMucTieu = false): Promise<GoiYXep[]> {
  const pa = ng.kho.lay(), tv = canTV(ng);
  if (!loXepDuoc(lo)) throw new LoiCongCu(`Lô ${lo.temDat.kyHieu} chưa đủ điều kiện tự xếp: cần chức năng ở (tm/xh), ranh ≥ 3 đỉnh, MĐXD và HSSDĐ > 0.`);
  const k = khoaLo(pa, lo) + (theoMucTieu ? '|mt' : '');
  const co = nhoGoiY.get(lo.id);
  if (co && co.khoa === k) return co.ds;
  const luat = await ng.luat();
  if (!luat) throw new LoiCongCu('Chưa tải được luật LO-01 / LO-02.');
  const cuaCan = await ng.cuaCan(lo.temDat.chucNang === 'xh' ? 'xh' : 'tm');
  const ds = (await goiYXepToaNen({ pa, lo, tv, luat, cuaCan, theoMucTieu })) ?? [];
  nhoGoiY.set(lo.id, { khoa: k, ds });
  return ds;
}

const MA_CHI_TIEU: (keyof ChiTieuQH)[] = ['matDoMax', 'matDoThapMax', 'hssddMax', 'tangCaoMax', 'tangDe', 'tangCanHo', 'tangHam', 'danSoMax', 'soCanMax', 'nguoiMoiCan', 'choDoOtoMoiCan', 'choXeMayMoiCan', 'cayXanhMin'];
const CHI_TIEU_NULL = new Set<keyof ChiTieuQH>(['matDoThapMax', 'tangDe', 'tangCanHo', 'tangHam', 'soCanMax']);

const idsSchema = S.ds(S.chu(), 'id các tòa');
const layToaChon = (pa: TrangThaiPA, ids: string[]) => {
  if (!ids.length) throw new LoiCongCu('Chưa chỉ tòa nào (tower_ids).');
  return ids.map((id) => timToa(pa, id));
};

export const CONG_CU_TMB: CongCu[] = [
  {
    ten: 'suggest_arrangements', nhom: 'tmb',
    moTa: 'Chạy gợi ý tự xếp tòa (MT-05) cho một lô như nút Gợi ý ở TMB (có chế độ target_mode theo mục tiêu DTXD + cơ cấu căn — dùng khi người dùng đặt cơ cấu mục tiêu / muốn đạt MĐXD mà không chỉ định mẫu): trả tối đa 5 phương án (mẫu × số tòa, tầng, số căn, lệch cơ cấu, MĐXD, tỷ lệ sàn/trần, dân số, điểm view TB 0–100, cảnh báo; trọng số view theo PA huongView.trongSoXep). Không sửa PA — dùng apply_arrangement để áp.',
    schema: S.doiTuong({ lot_id: S.chu('id hoặc ký hiệu lô'), target_mode: S.bool('true = THEO MỤC TIÊU: tự chọn / trộn mẫu tòa sao cho DTXD (MĐXD) ≥ 85 % mức tối đa của lô và cơ cấu căn sát cơ cấu mục tiêu của lô (update_lot), rồi tự đặt; mỗi phương án có theo_muc_tieu {mau_du_kien, thieu_toa, dtxd_pct}. Mặc định false.') }, ['lot_id']),
    chay: async (v, ng) => {
      const lo = timLo(ng.kho.lay(), v.lot_id as string);
      const ds = await goiYLo(ng, lo, v.target_mode === true);
      return { lo: lo.id, so_phuong_an: ds.length, phuong_an: ds.map(tomGoiY) };
    },
  },
  {
    ten: 'apply_arrangement', nhom: 'tmb', sua: true,
    moTa: 'Áp phương án gợi ý thứ `option` (0 = tốt nhất) cho lô: THAY mọi tòa đang có trên lô bằng tòa của phương án (một bước hoàn tác). Tự chạy gợi ý nếu chưa có.',
    schema: S.doiTuong({ lot_id: S.chu(), option: S.nguyen('chỉ số phương án, mặc định 0', 0), target_mode: S.bool('đúng giá trị đã dùng ở suggest_arrangements (true = theo mục tiêu DTXD + cơ cấu)') }, ['lot_id']),
    chay: async (v, ng) => {
      kiemSua(ng);
      const lo = timLo(ng.kho.lay(), v.lot_id as string);
      const ds = await goiYLo(ng, lo, v.target_mode === true);
      const i = (v.option as number | undefined) ?? 0;
      const g = ds[i];
      if (!g) throw new LoiCongCu(ds.length ? `Chỉ có ${ds.length} phương án (0..${ds.length - 1}).` : 'Lô không có phương án xếp tòa nào (lô nhỏ / chỉ tiêu chặt).');
      const moi: ToaDat[] = g.toa.map((x) => ({ ...x, id: idToaMoi() }));
      suaPA(ng, (p) => ({ ...p, toa: [...p.toa.filter((x) => x.loId !== lo.id), ...moi] }));
      ng.ui.dat({ loId: lo.id, toaId: moi[0]?.id ?? null, canKhoa: null });
      return { da_ap: tomGoiY(g, i), toa_moi: moi.map((x) => x.id), ...(await sauSuaTmb(ng, [lo.id])) };
    },
  },
  {
    ten: 'batch_arrange', nhom: 'tmb', sua: true,
    moTa: 'Xếp hàng loạt nhiều lô (nút ▦): lô lớn trước, lô sau giữ §2.6.1 tới tòa lô trước; mỗi lô chọn phương án tốt nhất (hoặc theo choices). Áp cả lượt = MỘT bước hoàn tác. preview_only = true thì chỉ trả kết quả, không sửa.',
    schema: S.doiTuong({
      lot_ids: S.ds(S.chu(), 'mặc định mọi lô cao tầng xếp được'),
      choices: { type: 'object', description: 'lô → chỉ số phương án (null = giữ nguyên lô đó)', additionalProperties: { type: 'integer', minimum: 0, nullable: true } },
      preview_only: S.bool(),
    }),
    chay: async (v, ng) => {
      const pa = ng.kho.lay(), tv = canTV(ng);
      if (!v.preview_only) kiemSua(ng);
      const ids = (v.lot_ids as string[] | undefined)?.map((id) => timLo(pa, id).id) ?? pa.lo.filter(laCaoTang).filter(loXepDuoc).map((l) => l.id);
      if (!ids.length) throw new LoiCongCu('Không có lô nào xếp được (cần lô ở có chỉ tiêu MĐXD, HSSDĐ).');
      const luat = await ng.luat();
      if (!luat) throw new LoiCongCu('Chưa tải được luật LO-01 / LO-02.');
      const [cuaTm, cuaXh] = await Promise.all([ng.cuaCan('tm'), ng.cuaCan('xh')]);
      const r = await xepHangLoatNen({ pa, tv, luat, lo: thuTuLo(pa, ids), cuaCan: (lo: Lo) => (lo.temDat.chucNang === 'xh' ? cuaXh : cuaTm) });
      const chon = (v.choices ?? {}) as Record<string, number | null>;
      const kq: KetQuaLo[] = r.kq.map((x) => {
        const lo = pa.lo.find((l) => l.id === x.loId)!;
        const c = chon[x.loId] !== undefined ? chon[x.loId] : chon[lo.temDat.kyHieu] !== undefined ? chon[lo.temDat.kyHieu] : x.chon;
        if (c !== null && c !== undefined && !x.ds[c]) throw new LoiCongCu(`Lô ${x.loId} chỉ có ${x.ds.length} phương án.`);
        return { ...x, chon: c ?? null };
      });
      const tom = kq.map((x) => ({ lo: x.loId, chon: x.chon, so_phuong_an: x.ds.length, ...(x.chon !== null ? { da_chon: tomGoiY(x.ds[x.chon], x.chon) } : {}) }));
      if (v.preview_only) return { xem_truoc: tom };
      if (!kq.some((x) => x.chon !== null)) throw new LoiCongCu('Không lô nào có phương án để áp.');
      suaPA(ng, (p) => apHangLoat(p, kq, idToaMoi));
      return { da_ap: tom, ...(await sauSuaTmb(ng, kq.map((x) => x.loId))) };
    },
  },
  {
    ten: 'add_tower', nhom: 'tmb', sua: true,
    moTa: 'Đặt thêm một tòa từ mẫu (như nút Đặt ở panel trái TMB): tâm ở trọng tâm chỉ giới lô, góc hợp lô, số tầng theo chỉ tiêu; có thể cho x, y (m), góc. Xem list_templates kind=towers lot_id để chọn mẫu vừa lô.',
    schema: S.doiTuong({ lot_id: S.chu(), template_id: S.chu('id mẫu tòa'), x: S.so(), y: S.so(), angle: S.so('độ') }, ['lot_id', 'template_id']),
    chay: async (v, ng) => {
      const pa = ng.kho.lay(), tv = canTV(ng);
      const lo = timLo(pa, v.lot_id as string);
      const m = tv.toa.get(v.template_id as string);
      if (!m) throw new LoiCongCu(`Không có mẫu tòa "${v.template_id}" (xem list_templates).`);
      let moi = taoToaTrenLo(m, lo, idToaMoi());
      if (v.x !== undefined) moi = { ...moi, x: tron(v.x as number)! };
      if (v.y !== undefined) moi = { ...moi, y: tron(v.y as number)! };
      if (v.angle !== undefined) moi = { ...moi, gocDo: (((v.angle as number) % 360) + 360) % 360 };
      suaPA(ng, (p) => ({ ...p, toa: [...p.toa, moi] }));
      ng.ui.dat({ loId: lo.id, toaId: moi.id });
      return { toa_moi: { id: moi.id, mau: moi.mauId, x: moi.x, y: moi.y, goc: moi.gocDo, tang_dh: moi.soTangDH, tang_de: moi.soTangDe }, ...(await sauSuaTmb(ng, [lo.id], [moi.id])) };
    },
  },
  {
    ten: 'update_tower', nhom: 'tmb', sua: true,
    moTa: 'Sửa thông số một tòa như các ô ở panel trái TMB: x, y (m, tâm), angle (độ), floors (số tầng điển hình ≥ 1), podium_floors (tầng đế ≥ 0), podium_offset (m ≥ 0), template_id (đổi mẫu tòa — bỏ mọi sửa mặt bằng tầng của tòa). Tòa đang khoá thì không sửa được (mở khoá bằng lock_towers).',
    schema: S.doiTuong({
      tower_id: S.chu(), x: S.so(), y: S.so(), angle: S.so(), floors: S.nguyen(undefined, 1, 200), podium_floors: S.nguyen(undefined, 0, 20), podium_offset: S.so(undefined, 0), template_id: S.chu(),
    }, ['tower_id']),
    chay: async (v, ng) => {
      const pa = ng.kho.lay(), tv = canTV(ng);
      const toa = timToa(pa, v.tower_id as string);
      if (toa.khoa) throw new LoiCongCu(`Tòa ${toa.id} đang khoá — mở khoá trước (lock_towers locked=false).`);
      if (v.template_id !== undefined && !tv.toa.has(v.template_id as string)) throw new LoiCongCu(`Không có mẫu tòa "${v.template_id}".`);
      suaPA(ng, (p) => doiToa(p, toa.id, (x) => {
        let y: ToaDat = { ...x };
        if (v.x !== undefined) y.x = v.x as number;
        if (v.y !== undefined) y.y = v.y as number;
        if (v.angle !== undefined) y.gocDo = (((v.angle as number) % 360) + 360) % 360;
        if (v.floors !== undefined) y.soTangDH = Math.round(v.floors as number);
        if (v.podium_floors !== undefined) y.soTangDe = Math.round(v.podium_floors as number);
        if (v.podium_offset !== undefined) y.deOffset = v.podium_offset as number;
        if (v.template_id !== undefined && v.template_id !== x.mauId) {
          // Đổi mẫu: giữ vị trí / tầng / khoá / lật; mặt bằng tầng theo mẫu mới (không có thao tác này trên giao diện TMB).
          y = { id: x.id, loId: x.loId, mauId: v.template_id as string, x: y.x, y: y.y, gocDo: y.gocDo, soTangDH: y.soTangDH, soTangDe: y.soTangDe,
            caoDe: x.caoDe, caoDH: x.caoDH, coApMai: x.coApMai, deOffset: y.deOffset, canTheo: {}, ...(x.lat ? { lat: true } : {}) };
        }
        return y;
      }));
      const x = ng.kho.lay().toa.find((q) => q.id === toa.id)!;
      return { toa: { id: x.id, mau: x.mauId, x: x.x, y: x.y, goc: x.gocDo, tang_dh: x.soTangDH, tang_de: x.soTangDe }, ...(await sauSuaTmb(ng, [x.loId], [x.id])) };
    },
  },
  {
    ten: 'transform_towers', nhom: 'tmb', sua: true,
    moTa: 'Dời / xoay / lật một nhóm tòa như thanh công cụ TMB (bỏ qua tòa khoá): action move (dx, dy m), rotate (degrees, quanh tâm nhóm; một tòa thì quanh tâm tòa), mirror (lật đối xứng nhóm).',
    schema: S.doiTuong({ tower_ids: idsSchema, action: S.chon(['move', 'rotate', 'mirror']), dx: S.so(), dy: S.so(), degrees: S.so() }, ['tower_ids', 'action']),
    chay: async (v, ng) => {
      kiemSua(ng);
      const pa = ng.kho.lay();
      const ds = layToaChon(pa, v.tower_ids as string[]);
      const di = ds.filter((x) => !x.khoa).map((x) => x.id);
      if (!di.length) throw new LoiCongCu('Mọi tòa chọn đều đang khoá.');
      let doi = false;
      const sua = (fn: (p: TrangThaiPA) => TrangThaiPA) => { doi = ng.kho.sua(fn); };
      if (v.action === 'move') {
        if (v.dx === undefined && v.dy === undefined) throw new LoiCongCu('Thiếu dx / dy.');
        suaNhom(sua, di, (d) => dichNhom(d, (v.dx as number) ?? 0, (v.dy as number) ?? 0));
      } else if (v.action === 'rotate') {
        if (v.degrees === undefined) throw new LoiCongCu('Thiếu degrees.');
        suaNhom(sua, di, (d) => xoayNhom(d, d.length > 1 ? tamNhom(d) : [d[0].x, d[0].y], v.degrees as number));
      } else suaNhom(sua, di, latNhom);
      if (!doi) throw new LoiCongCu('Không có gì thay đổi.');
      const sau = ng.kho.lay().toa.filter((x) => di.includes(x.id));
      return { da_doi: sau.map((x) => ({ id: x.id, x: x.x, y: x.y, goc: x.gocDo, lat: !!x.lat })), bo_qua_khoa: ds.filter((x) => x.khoa).map((x) => x.id), ...(await sauSuaTmb(ng, [...new Set(sau.map((x) => x.loId))], di)) };
    },
  },
  {
    ten: 'duplicate_towers', nhom: 'tmb', sua: true,
    moTa: 'Nhân bản tòa (Ctrl+D): bản sao đặt ở chỗ trống đầu tiên giữ khoảng lùi và khoảng cách giữa tòa.',
    schema: S.doiTuong({ tower_ids: idsSchema }, ['tower_ids']),
    chay: async (v, ng) => {
      const pa = ng.kho.lay(), tv = canTV(ng);
      const ds = layToaChon(pa, v.tower_ids as string[]);
      const luat = await ng.luat();
      let p2 = pa;
      const moi: ToaDat[] = [];
      const hop: boolean[] = [];
      for (const x of ds) {
        const r = viTriNhanBan(x, p2, tv, luat, idToaMoi());
        moi.push(r.toa); hop.push(r.hopLe);
        p2 = { ...p2, toa: [...p2.toa, r.toa] };
      }
      suaPA(ng, (p) => ({ ...p, toa: [...p.toa, ...moi] }));
      return { toa_moi: moi.map((x, i) => ({ id: x.id, tu: ds[i].id, x: x.x, y: x.y, vi_tri_hop_le: hop[i] })), ...(await sauSuaTmb(ng, [...new Set(moi.map((x) => x.loId))], moi.map((x) => x.id))) };
    },
  },
  {
    ten: 'delete_towers', nhom: 'tmb', sua: true,
    moTa: 'Xoá tòa (phím Delete) — tòa đang khoá không xoá. Hoàn tác được bằng undo.',
    schema: S.doiTuong({ tower_ids: idsSchema }, ['tower_ids']),
    chay: async (v, ng) => {
      const pa = ng.kho.lay();
      const ds = layToaChon(pa, v.tower_ids as string[]);
      const xoa = ds.filter((x) => !x.khoa).map((x) => x.id);
      if (!xoa.length) throw new LoiCongCu('Mọi tòa chọn đều đang khoá — mở khoá trước.');
      suaPA(ng, (p) => ({ ...p, toa: p.toa.filter((x) => !xoa.includes(x.id)) }));
      const ui = ng.ui.lay();
      if (ui.toaId && xoa.includes(ui.toaId)) ng.ui.dat({ toaId: null, canKhoa: null });
      return { da_xoa: xoa, bo_qua_khoa: ds.filter((x) => x.khoa).map((x) => x.id), ...(await sauSuaTmb(ng, [...new Set(ds.map((x) => x.loId))])) };
    },
  },
  {
    ten: 'lock_towers', nhom: 'tmb', sua: true,
    moTa: 'Khoá / mở khoá tòa (không kéo, không sửa thông số khi khoá).',
    schema: S.doiTuong({ tower_ids: idsSchema, locked: S.bool() }, ['tower_ids', 'locked']),
    chay: (v, ng) => {
      const pa = ng.kho.lay();
      const ids = layToaChon(pa, v.tower_ids as string[]).map((x) => x.id);
      suaPA(ng, (p) => ({ ...p, toa: p.toa.map((x) => (ids.includes(x.id) ? { ...x, khoa: v.locked as boolean } : x)) }));
      return { ok: true, khoa: v.locked, toa: ids, buoc_hoan_tac: buocHoanTac(ng) };
    },
  },
  {
    ten: 'set_road_edges', nhom: 'tmb', sua: true,
    moTa: 'Khai lộ giới từng cạnh lô (LO-01): cạnh i = ranh[i] → ranh[i+1]; width = bề rộng đường (m), null = không giáp đường. clear = true thì bỏ khai (mọi cạnh coi như đường 12 m). Lần khai đầu điền 12 m cho mọi cạnh rồi đặt cạnh chỉ định (như hộp cạnh lô).',
    schema: S.doiTuong({
      lot_id: S.chu(),
      edges: S.ds(S.doiTuong({ index: S.nguyen(undefined, 0), width: { ...S.so('m > 0', 0), nullable: true } }, ['index', 'width'])),
      clear: S.bool(),
    }, ['lot_id']),
    chay: async (v, ng) => {
      const pa = ng.kho.lay();
      const lo = timLo(pa, v.lot_id as string);
      if (v.clear) suaPA(ng, (p) => doiLo(p, lo.id, boCanhDuong));
      else {
        const ds = (v.edges as { index: number; width: number | null }[] | undefined) ?? [];
        if (!ds.length) throw new LoiCongCu('Thiếu edges (hoặc clear = true).');
        for (const e of ds) if (e.index >= lo.ranh.length) throw new LoiCongCu(`Lô có ${lo.ranh.length} cạnh (0..${lo.ranh.length - 1}).`);
        suaPA(ng, (p) => doiLo(p, lo.id, (l) => ds.reduce((a, e) => datCanhDuong(a, e.index, e.width), l)));
      }
      return { canh_duong: ng.kho.lay().lo.find((l) => l.id === lo.id)?.canhDuong ?? 'mac_dinh_12m', ...(await sauSuaTmb(ng, [lo.id])) };
    },
  },
  {
    ten: 'add_lot', nhom: 'tmb', sua: true,
    moTa: 'Thêm một lô chữ nhật (như nút thêm lô ở panel trái): rộng × dài (m), đặt bên phải các lô đã có; chỉ tiêu mặc định (sửa bằng update_lot).',
    schema: S.doiTuong({ width: S.so('m, mặc định 80', 1), depth: S.so('m, mặc định 60', 1), code: S.chu('ký hiệu lô') }),
    chay: (v, ng) => {
      const pa = ng.kho.lay();
      const kt = { rong: (v.width as number) ?? 80, dai: (v.depth as number) ?? 60 };
      const id = `lo-${Date.now().toString(36)}`;
      const x0 = Math.max(0, ...pa.lo.flatMap((l) => l.ranh.map((q) => q[0]))) + (pa.lo.length ? 20 : 0);
      const moi = taoLo(id, (v.code as string) || `Lô ${pa.lo.length + 1}`, 'tm', [[x0, 0], [x0 + kt.rong, 0], [x0 + kt.rong, kt.dai], [x0, kt.dai]]);
      suaPA(ng, (p) => ({ ...p, lo: [...p.lo, moi] }));
      ng.ui.dat({ loId: id, toaId: null });
      return { lo_moi: { id, ky_hieu: moi.temDat.kyHieu, chi_tieu: moi.temDat.chiTieu }, buoc_hoan_tac: buocHoanTac(ng) };
    },
  },
  {
    ten: 'update_lot', nhom: 'tmb', sua: true,
    moTa: 'Sửa lô (một bước hoàn tác) như panel chỉ tiêu: code (ký hiệu), use (tm thương mại / xh NOXH / khac), indicators (chỉ tiêu QH: matDoMax %, matDoThapMax, hssddMax lần, tangCaoMax, tangDe, tangCanHo, tangHam, danSoMax, soCanMax, nguoiMoiCan, choDoOtoMoiCan, choXeMayMoiCan, cayXanhMin %; trường có thể null: matDoThapMax, tangDe, tangCanHo, tangHam, soCanMax), mix_target (cơ cấu mục tiêu %, nên cộng 100), population (khai dân số theo QĐ tỉnh: province = mã tỉnh từ get_population, stage qh|cp, type notm|noxh|tdc, area doThi|nongThon, method bang|bq, round_area = { enabled, tolerance_m2 } làm tròn DT căn khi tính dân: căn trên mốc dải bảng QĐ không quá tolerance m² đếm ở đúng mốc dải dưới; population = null để bỏ khai). apply_population_to_all_lots = true áp khai dân số cho mọi lô cao tầng.',
    schema: S.doiTuong({
      lot_id: S.chu(), code: S.chu(), use: S.chon(['tm', 'xh', 'khac']),
      indicators: { type: 'object', additionalProperties: { type: 'number', minimum: 0, nullable: true }, description: 'khoá ChiTieuQH → số' },
      mix_target: LOAI_CAN_SCHEMA('cơ cấu mục tiêu %'),
      population: { ...S.doiTuong({ province: S.chu(), stage: S.chon(['qh', 'cp']), type: { ...S.chon(['notm', 'noxh', 'tdc']), nullable: true }, area: S.chon(['doThi', 'nongThon']), method: S.chon(['bang', 'bq']), round_area: S.doiTuong({ enabled: S.bool(), tolerance_m2: S.so(undefined, 0, 5) }, ['enabled']) }, ['province']), nullable: true },
      apply_population_to_all_lots: S.bool(),
    }, ['lot_id']),
    chay: async (v, ng) => {
      const pa = ng.kho.lay();
      const lo = timLo(pa, v.lot_id as string);
      const ct = (v.indicators ?? {}) as Record<string, number | null>;
      for (const [k, x] of Object.entries(ct)) {
        if (!MA_CHI_TIEU.includes(k as keyof ChiTieuQH)) throw new LoiCongCu(`Chỉ tiêu "${k}" không có. Có: ${MA_CHI_TIEU.join(', ')}.`);
        if (x === null && !CHI_TIEU_NULL.has(k as keyof ChiTieuQH)) throw new LoiCongCu(`Chỉ tiêu ${k} không được để trống.`);
      }
      let khai: KhaiDanSo | undefined | null = null; // null = không đụng
      if (v.population === null) khai = undefined;
      else if (v.population) {
        const d = v.population as { province: string; stage?: 'qh' | 'cp'; type?: KhaiDanSo['loaiHinh'] | null; area?: KhaiDanSo['khuVuc']; method?: KhaiDanSo['cach']; round_area?: { enabled: boolean; tolerance_m2?: number } };
        if (!timQuyTac(d.province)) throw new LoiCongCu(`Mã tỉnh "${d.province}" không có (xem get_population).`);
        const cu = lo.temDat.danSo;
        khai = { ...(cu ?? {}), tinh: d.province, giaiDoan: d.stage ?? cu?.giaiDoan ?? 'cp' };
        if (d.type !== undefined) { if (d.type === null) delete khai.loaiHinh; else khai.loaiHinh = d.type; }
        if (d.area) khai.khuVuc = d.area;
        if (d.method) khai.cach = d.method;
        if (d.round_area) khai.lamTron = { bat: d.round_area.enabled, dungSai: d.round_area.tolerance_m2 ?? khai.lamTron?.dungSai ?? 0.5 };
      }
      const mix = v.mix_target as Record<string, number> | undefined;
      suaPA(ng, (p) => {
        let q = doiLo(p, lo.id, (l) => {
          let td = { ...l.temDat };
          if (v.code !== undefined) { const c = String(v.code).trim(); if (!c) throw new LoiCongCu('Ký hiệu lô rỗng.'); td.kyHieu = c; }
          if (v.use) td.chucNang = v.use as Lo['temDat']['chucNang'];
          if (Object.keys(ct).length) td.chiTieu = { ...td.chiTieu, ...ct } as ChiTieuQH;
          if (mix) td.coCauMucTieu = { ...td.coCauMucTieu, ...mix };
          if (khai !== null) { const { danSo: _bo, ...r } = td; td = khai ? { ...r, danSo: khai } : r; }
          return { ...l, temDat: td };
        });
        if (v.apply_population_to_all_lots && khai) q = { ...q, lo: q.lo.map((l) => (laCaoTang(l) ? { ...l, temDat: { ...l.temDat, danSo: { ...khai } } } : l)) };
        return q;
      });
      const l2 = ng.kho.lay().lo.find((l) => l.id === lo.id)!;
      const tong = LOAI_CAN.reduce((s, k) => s + (l2.temDat.coCauMucTieu[k] ?? 0), 0);
      return { lo_da_sua: { id: l2.id, ky_hieu: l2.temDat.kyHieu, chuc_nang: l2.temDat.chucNang, chi_tieu: l2.temDat.chiTieu, co_cau_muc_tieu: l2.temDat.coCauMucTieu, dan_so: l2.temDat.danSo ?? null },
        ...(Math.abs(tong - 100) > 0.01 ? { canh_bao_co_cau: `cơ cấu mục tiêu cộng ${tron(tong, 1)}% (nên 100%)` } : {}), ...(await sauSuaTmb(ng, [lo.id])) };
    },
  },
  {
    ten: 'update_coefficients', nhom: 'tmb', sua: true,
    moTa: 'Hệ số chung của PA (panel chỉ tiêu, nhập %): area_coefficients (can, chung, thuongMai, apMai, ham — % DT sàn), basement_split (doXe, kyThuat — % hầm không tính HSSDĐ), thresholds (dtCanM2, kichThuocM).',
    schema: S.doiTuong({
      area_coefficients: S.doiTuong({ can: S.so(undefined, 0), chung: S.so(undefined, 0), thuongMai: S.so(undefined, 0), apMai: S.so(undefined, 0), ham: S.so(undefined, 0) }),
      basement_split: S.doiTuong({ doXe: S.so(undefined, 0, 100), kyThuat: S.so(undefined, 0, 100) }),
      thresholds: S.doiTuong({ dtCanM2: S.so(undefined, 0), kichThuocM: S.so(undefined, 0) }),
    }),
    chay: (v, ng) => {
      const hs = (v.area_coefficients ?? {}) as Record<string, number>, ph = (v.basement_split ?? {}) as Record<string, number>, ngg = (v.thresholds ?? {}) as Record<string, number>;
      suaPA(ng, (p) => ({
        ...p,
        heSo: { ...p.heSo, ...Object.fromEntries(Object.entries(hs).map(([k, x]) => [k, x / 100])) },
        ...(Object.keys(ph).length ? { phanHam: { ...(p.phanHam ?? PHAN_HAM_MAC_DINH), ...Object.fromEntries(Object.entries(ph).map(([k, x]) => [k, Math.min(x, 100) / 100])) } } : {}),
        nguong: { ...p.nguong, ...ngg },
      }));
      const p = ng.kho.lay();
      return { he_so: p.heSo, phan_ham: p.phanHam, nguong: p.nguong, buoc_hoan_tac: buocHoanTac(ng) };
    },
  },
];

export const _xoaNhoGoiY = () => nhoGoiY.clear();
