/* Ghi lại tủ họng nước (QT-77 / 77e / 77f / 77g, `tuCC`) mà app cũ (MDI_Unitmix_v4) tự đặt trên BỐ CỤC GỐC từng mẫu tòa — số đối
   chiếu cho web/src/tinh/tuHongNuoc.ts. Hai số tầng: 25 (17–25 tầng: 2 tia / điểm) và 12 (≤ 16 tầng: hành lang > 10 m → 2 tia).
   Chạy trong repo cũ:
     node scripts/chay_selftest.js --jsfile <đường dẫn tệp này>  > web/src/thu/tcc_cu.json */
(()=>{
  const ra={}; const cur=S.tower, fl=S.floors;
  const r0=v=>Math.round(v), r4=v=>Math.round(v*1e4)/1e4;
  try {
    for(const ma of Object.keys(TOWERS)){
      S.tower=ma; S.xepMode="banve"; S.corr=TOWERS[ma].corr; S.axAdj={}; S.cncTay=null; S.tccTay=null;
      const x={corr:S.corr};
      for(const n of [25, 12]){
        S.floors=n; regenerate();
        const g=buildGeom(); TCC_NHO.clear(); if(typeof CNC_NHO!=="undefined") CNC_NHO.clear();
        const kq=tuCC0(g);
        x[n]={can:kq.can, soTia:kq.soTia, Lhl:r0(kq.Lhl), hop:kq.hop, soTham:kq.soTham, nut:kq.nut, muc:kq.muc, soUng:kq.soUng, thieu:kq.thieu,
          H:Math.round(chieuCaoPCCC()*100)/100,
          tu:kq.tu.map(t=>({so:t.so, W:t.W.map(r0), loai:t.loai, kieu:t.kieu, uu:t.uu, ten:t.ten, huong:(t.huong||[]).map(r4), vao:(t.vao||[]).map(r4),
            tru:t.tru?{no:t.tru.no, m2:Math.round(t.tru.m2*1e4)/1e4}:null, nPhu:t.nPhu})),
          ung:kq.bai.ung.map(o=>({W:o.W.map(r0), loai:o.loai, kieu:o.kieu, uu:o.uu, xc:o.xc||0, m2:o.tru?Math.round(o.tru.m2*1e4)/1e4:0}))};
      }
      ra[ma]=x;
    }
  } finally { S.tower=cur; S.floors=fl; S.axAdj={}; regenerate(); }
  return JSON.stringify(ra);
})()
