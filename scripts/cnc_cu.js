/* Ghi lại cửa ngăn cháy hành lang (QT-95 / 98 / 100–105, `cuaNganChay`) mà app cũ (MDI_Unitmix_v4) tự đặt trên BỐ CỤC GỐC của từng
   mẫu tòa — làm số đối chiếu cho web/src/tinh/cuaNganChay.ts. Không tính tủ PCCC vào vật cản (TCC_KHONG, "cửa lý tưởng" QT-77f) để
   so được độc lập với cách đặt tủ của hai app. Hai giới hạn: 30 m (25 tầng, H > 75 m · A.2.14) và 60 m (3.3.5).
   Chạy trong repo cũ:  node scripts/chay_selftest.js --jsfile <đường dẫn tệp này>  > web/src/thu/cnc_cu.json */
(()=>{
  const ra={}; const cur=S.tower, fl=S.floors, tk=TCC_KHONG;
  const r0=v=>Math.round(v);
  TCC_KHONG=true;
  try {
    for(const ma of Object.keys(TOWERS)){
      S.tower=ma; S.xepMode="banve"; S.corr=TOWERS[ma].corr; S.axAdj={}; S.cncTay=null; S.tccTay=null; S.floors=25; regenerate();
      const g=buildGeom(), x={};
      for(const K of [30000, 60000]){
        CNC_NHO.clear();
        const kq=cuaNganChay0(g, K);
        x[K/1000]={
          cua: kq.flatMap(m=>m.cua).map(c=>({p:c.p.map(r0), u:c.u.map(v=>Math.round(v*1e4)/1e4), sach:!!c.sach, tuong:!!c.tuong, xuyen:!!c.xuyen, bu:!!c.bu})),
          mang: kq.map(m=>({L:r0(m.L), doan:m.doan.map(r0).sort((a,b)=>b-a), toiThieu:m.toiThieu})),
        };
      }
      x.sanh=hlSanhTruc(g, g.axes).map(a=>({ten:a.ten, tm:!!a.sanhTM, p0:a.p0.map(r0), p1:a.p1.map(r0), w:r0(a.corr)}));
      x.corr=S.corr;
      ra[ma]=x;
    }
  } finally { TCC_KHONG=tk; S.tower=cur; S.floors=fl; S.axAdj={}; regenerate(); }
  return JSON.stringify(ra);
})()
