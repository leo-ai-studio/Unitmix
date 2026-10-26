import { HE_SO_MAC_DINH, NGUONG_MAC_DINH, type TrangThaiPA } from './kieu';

/** Trạng thái một PA mới: chưa có lô, chưa có tòa. Hệ số và ngưỡng là giá trị tạm, chờ chủ nhiệm chốt. */
export const taoPAMoi = (): TrangThaiPA => ({
  phienBan: 1,
  lo: [],
  heSo: { ...HE_SO_MAC_DINH },
  nguong: { ...NGUONG_MAC_DINH },
  toa: [],
  ham: { soTang: 2, ranh: null, nhip: 8.4, rongLan: 6, choDai: 5, choRong: 2.5, dtKho: 6 },
});
