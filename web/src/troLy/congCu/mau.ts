/**
 * Công cụ Leo AI gợi ý / so sánh DẠNG TÒA (ui/SoSanhMau.tsx, tinh/soSanhMau.ts, tinh/goiYHinhToa.ts). Không sửa PA: đo các mẫu như
 * tòa ảo, xếp hạng theo tiêu chí có cấu trúc (Claude truyền), trả top N kèm ưu / nhược. Đặt lên lô là việc riêng (add_tower).
 */
import { t } from '../../i18n/i18n';
import { hopCoCau, phanTichYeuCau, TIEU_CHI, uuNhuoc, xepHang, type TieuChi, type YeuCauMau } from '../../tinh/goiYHinhToa';
import { LOAI_CAN, type LoaiCan, type Lo, type TrangThaiPA } from '../../tinh/kieu';
import { laCaoTang } from '../../tinh/loaiDat';
import { hoMau, soSanhMauNen, soTangMacDinh, toaAo } from '../../tinh/soSanhMau';
import { dichNhan, moSoSanhMau } from '../../ui/SoSanhMau';
import { LOAI_CAN_SCHEMA, S, type CongCu } from './dinhNghia';
import { canTV, LoiCongCu, timLo, tron } from './nguCanh';

const TRONG_SO_SCHEMA = S.doiTuong(Object.fromEntries(TIEU_CHI.map((tc) => [tc, S.so(undefined, 0, 5)])), [],
  'trọng số 0–5: hieuSuat (DTSD/DTXD), coCau (lệch cơ cấu), thoatNan (căn vượt cự ly), loiGon ((lõi+thang)/DTXD), canGoc, soCan (căn/tầng), dtSan (DTXD 1 sàn), view (chưa tính)');

const loMacDinh = (pa: TrangThaiPA, id: string | undefined, uiLo: string | null): Lo | null =>
  id ? timLo(pa, id) : pa.lo.find((l) => l.id === uiLo && laCaoTang(l)) ?? pa.lo.find(laCaoTang) ?? null;

export const CONG_CU_MAU: CongCu[] = [
  {
    ten: 'recommend_tower_shapes', nhom: 'tmb',
    moTa: 'So sánh / gợi ý DẠNG TÒA theo tiêu chí mà KHÔNG đặt lên TMB (như hộp "So sánh mẫu tòa"): dựng mỗi mẫu (họ shape i|l|t|u|v|y|z, hoặc template_ids; kèm biến thể tối ưu cơ cấu + STRETCH) thành tòa ảo, chạy tự chỉnh, đo căn/tầng, cơ cấu + lệch so với mục tiêu, hiệu suất DTSD/DTXD, DTXD/DTSD 1 sàn, thang bộ / thang máy, căn vượt cự ly thoát nạn, dân/tầng, kích thước, tỉ lệ lõi; chấm điểm minh bạch theo trọng số và trả top N kèm ưu / nhược. Truyền tiêu chí có cấu trúc (efficiency_min %, mix_target %, units_per_floor, floor_area_m2, weights) — request (câu chữ của người dùng) chỉ là phụ, được đọc bằng luật. show_in_app = true mở hộp So sánh mẫu tòa trên giao diện. Muốn đặt mẫu đã chọn lên lô: add_tower (template_id), biến thể toiUu thì sau đó optimize_floor.',
    schema: S.doiTuong({
      lot_id: S.chu('lô lấy cơ cấu mục tiêu + quy tắc dân số; mặc định lô đang chọn / lô cao tầng đầu tiên'),
      template_ids: S.ds(S.chu(), 'id mẫu tòa cần so sánh (bỏ trống = theo shape / group)'),
      shape: S.chon(['i', 'l', 't', 'u', 'v', 'y', 'z'], 'họ dạng hình; bỏ trống = mọi dạng của nhóm'),
      group: S.chon(['tm', 'xh'], 'nhóm mẫu; mặc định theo chức năng lô'),
      include_optimized: S.bool('thêm biến thể tối ưu cơ cấu + STRETCH (mặc định true)'),
      efficiency_min: S.so('hiệu suất tối thiểu %, mặc định 75 (MT-03)', 50, 95),
      mix_target: LOAI_CAN_SCHEMA('cơ cấu yêu cầu % (loại nêu thay mục tiêu lô, phần còn lại chia theo tỉ lệ lô)'),
      units_per_floor: S.nguyen('số căn/tầng mong muốn', 2, 80),
      floor_area_m2: S.so('DTXD 1 sàn mong muốn (m²)', 300, 6000),
      floors: S.nguyen('số tầng điển hình (chiều cao PCCC); mặc định theo chỉ tiêu lô', 1, 80),
      weights: TRONG_SO_SCHEMA,
      request: S.chu('câu yêu cầu của người dùng (đọc bằng luật; tham số có cấu trúc thắng)'),
      top: S.nguyen('số mẫu trả về (mặc định 3)', 1, 10),
      show_in_app: S.bool('mở hộp So sánh mẫu tòa trên giao diện với lựa chọn này'),
    }),
    chay: async (v, ng) => {
      const pa = ng.kho.lay(), tv = canTV(ng);
      const lo = loMacDinh(pa, v.lot_id as string | undefined, ng.ui.lay().loId);
      // yêu cầu: câu chữ (luật) rồi tham số có cấu trúc ghi đè
      const yc: YeuCauMau = phanTichYeuCau((v.request as string) ?? '');
      if (v.efficiency_min !== undefined) { yc.hsMin = (v.efficiency_min as number) / 100; yc.trongSo.hieuSuat = Math.max(yc.trongSo.hieuSuat, 4); }
      if (v.mix_target) { yc.coCau = { ...yc.coCau, ...(v.mix_target as Partial<Record<LoaiCan, number>>) }; yc.trongSo.coCau = Math.max(yc.trongSo.coCau, 4); }
      if (v.units_per_floor !== undefined) { yc.soCanTang = v.units_per_floor as number; yc.trongSo.soCan = Math.max(yc.trongSo.soCan, 3); }
      if (v.floor_area_m2 !== undefined) { yc.dtSan = v.floor_area_m2 as number; yc.trongSo.dtSan = Math.max(yc.trongSo.dtSan, 3); }
      for (const [k, w] of Object.entries((v.weights ?? {}) as Record<string, number>)) yc.trongSo[k as TieuChi] = w;
      const nhom = (v.group as 'tm' | 'xh' | undefined) ?? yc.nhom ?? (lo?.temDat.chucNang === 'xh' ? 'xh' : 'tm');
      const shape = (v.shape as string | undefined) ?? (yc.hinh.length === 1 ? yc.hinh[0] : null);
      const ids = (v.template_ids as string[] | undefined)?.length
        ? (v.template_ids as string[])
        : yc.hinh.length > 1 ? yc.hinh.flatMap((h) => hoMau(tv, nhom, h)) : hoMau(tv, nhom, shape);
      const sai = ids.filter((id) => !tv.toa.has(id));
      if (sai.length) throw new LoiCongCu(`Không có mẫu tòa ${sai.join(', ')} (xem list_templates kind=towers).`);
      if (!ids.length) throw new LoiCongCu('Không có mẫu nào để so sánh (shape / group).');
      if (v.template_ids) { yc.hinh = []; yc.nhom = null; }
      const mucTieu = hopCoCau(lo?.temDat.coCauMucTieu ?? { stu: 10, '1pn': 20, '2pn': 45, '2pnp': 10, '3pn': 15 }, yc.coCau);
      const soTang = (v.floors as number | undefined) ?? soTangMacDinh(lo);
      if (v.show_in_app) moSoSanhMau({ tv, nhom, mauIds: ids, yeuCau: (v.request as string) ?? '', toiUu: v.include_optimized !== false });
      const dl = await ng.dl({ ...pa, toa: ids.map((id) => toaAo(id, lo?.id ?? 'ss', soTang, 1)) });
      const ds = await soSanhMauNen({ mauIds: ids, bienThe: v.include_optimized === false ? ['goc'] : ['goc', 'toiUu'], mucTieu, soTangDH: soTang, lo }, tv, dl);
      if (!ds) throw new LoiCongCu('Lượt so sánh bị huỷ (có lượt mới hơn) — gọi lại.');
      const hang = xepHang(ds, yc);
      const top = hang.slice(0, (v.top as number | undefined) ?? 3);
      return {
        lo: lo?.temDat.kyHieu ?? null, nhom, so_tang_dh: soTang,
        yeu_cau_hieu: yc.nhanDien.map(dichNhan), trong_so: yc.trongSo, hieu_suat_min_pct: tron(yc.hsMin * 100, 1),
        muc_tieu_co_cau_pct: Object.fromEntries(LOAI_CAN.map((l) => [l, tron(mucTieu[l], 1)])),
        so_mau_da_do: ds.length,
        xep_hang: top.map((r) => {
          const g = uuNhuoc(r, hang, yc);
          return {
            hang: r.hang, template_id: r.mauId, ten: tv.toa.get(r.mauId)?.ten_vi ?? r.mauId, bien_the: r.bienThe, diem: tron(r.diem.tong, 1),
            diem_tieu_chi: Object.fromEntries(Object.entries(r.diem.theoTC).map(([k, x]) => [k, tron(x, 0)])),
            can_tang: r.soCan, co_cau_pct: Object.fromEntries(LOAI_CAN.map((l) => [l, tron(r.coCauPct[l], 1)])), lech_co_cau: tron(r.lech, 1),
            hieu_suat_pct: r.hieuSuat === null ? null : tron(r.hieuSuat * 100, 1), dtxd_1san_m2: tron(r.dtxd, 0), dtsd_1san_m2: tron(r.dtsd, 0),
            thang_bo: r.soThangBo, thang_may: r.soThangMay, can_vuot_thoat_nan: r.vuot, can_tu_chinh_go: r.canGo, dan_tang: tron(r.danTang, 1),
            kich_thuoc_m: `${tron(r.dai, 1)} × ${tron(r.rong, 1)}`, ty_le_loi_pct: r.tyLeLoi === null ? null : tron(r.tyLeLoi * 100, 1), so_can_goc: r.soCanGoc,
            so_can_doi_toi_uu: r.soDoi, uu: g.uu.map(dichNhan), nhuoc: g.nhuoc.map(dichNhan),
          };
        }),
        ghi_chu: `${t('ssm.chuThich')} Đặt lên lô: add_tower (template_id)${hang.some((r) => r.bienThe === 'toiUu') ? '; biến thể toiUu: add_tower rồi optimize_floor' : ''}.`,
      };
    },
  },
];
