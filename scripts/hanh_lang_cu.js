/* Ghi lại đồ thị hành lang + cửa buồng thang mà app cũ (MDI_Unitmix_v4) dựng cho BỐ CỤC GỐC của từng mẫu tòa.
   App cũ cắt đầu trục theo vòng tròn mốc CAD (QT-54) và mép ô căn đặc, tách trục theo mốc (vd B1/B2), nối góc theo
   nét vẽ tay (QT-51), nới ô thang thiếu (QT-60) — dữ liệu đó không có sẵn trong data/master nên chép kết quả.
   Chạy trong repo cũ:  node scripts/chay_selftest.js --jsfile <đường dẫn tệp này>  > scripts/du_lieu/hanh_lang_cu.json */
(()=>{
  const ra={}; const cur=S.tower;
  const r1=v=>Math.round(v*10)/10;
  for(const ma of Object.keys(TOWERS)){
    S.tower=ma; S.xepMode="banve"; S.corr=TOWERS[ma].corr; S.axAdj={}; regenerate();
    const g=buildGeom();
    ra[ma]={
      hanh_lang:g.axes.filter(a=>a.p0&&a.p1).map(a=>({ten:a.ten, noi:!!a.link, p0:a.p0.map(r1), p1:a.p1.map(r1)})),
      cua_thang:g.cells.filter(c=>c.kind==="stair").map(c=>V.add(c.o, V.mul(c.u, c.doorA-c.a0)).map(r1)),
    };
  }
  S.tower=cur; S.axAdj={}; regenerate();
  return JSON.stringify(ra);
})()
