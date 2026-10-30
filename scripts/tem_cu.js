(()=>{
  const ra={}; const cur=S.tower, fl=S.floors;
  const r0=v=>Math.round(v);
  try {
    for(const ma of Object.keys(TOWERS)){
      if(!TOWERS[ma].moc) continue;
      S.tower=ma; S.xepMode="banve"; S.corr=TOWERS[ma].corr; S.axAdj={}; S.floors=25;
      regenerate(); GEOM=buildGeom();
      const cells=GEOM.cells;
      const kq=xepTem(cells);
      const vat=[];
      cells.forEach(c=>{ let P=null;
        if(c.kind==="unit") P=hinhLogia(c)||bienCan(c);
        else if(c.kind==="core") P=baoLoiWorld(c)||c.pts;
        else if(c.kind==="stair") P=c.pts;
        if(P&&P.length>2) vat.push(P.map(q=>[q[0],-q[1]])); });
      const tems=cells.filter(c=>c.kind==="unit"&&byCode[c.code]).map(c=>{ const g=temGoc(c), d=kq.get(c);
        const cx=d?d.cx:g.cx, cy=d?d.cy:g.cy; return {no:c.no, face:c.face, fi:g.fi, goc:[r0(g.cx),r0(-g.cy)], tam:[r0(cx),r0(-cy)], dan:d&&d.dan?d.dan.map(q=>[r0(q[0]),r0(-q[1])]):null, W:g.W,H:g.H,
          r:[cx-g.W/2,cy-g.H/2,cx+g.W/2,cy+g.H/2]} });
      const giao=(A,B)=>A[0]<B[2]&&B[0]<A[2]&&A[1]<B[3]&&B[1]<A[3];
      let chong=0, de=0;
      tems.forEach((t,i)=>{ tems.forEach((o,j)=>{ if(j>i&&giao(t.r,o.r)) chong++ });
        if(vat.some(P=>rectChamDa(t.r,P))) de++; });
      const truoc={chong:0,de:0};
      tems.forEach((t,i)=>{ const g0=[t.goc[0]-t.W/2,-t.goc[1]-t.H/2,t.goc[0]+t.W/2,-t.goc[1]+t.H/2];
        tems.forEach((o,j)=>{ if(j>i){ const g1=[o.goc[0]-o.W/2,-o.goc[1]-o.H/2,o.goc[0]+o.W/2,-o.goc[1]+o.H/2]; if(giao(g0,g1)) truoc.chong++ } });
        if(vat.some(P=>rectChamDa(g0,P))) truoc.de++; });
      ra[ma]={code:TOWERS[ma].code||ma, chong, de, truoc, ngoai:kq.ngoai, tem:tems.map(t=>({no:t.no,face:t.face,fi:t.fi,goc:t.goc,tam:t.tam,dan:t.dan}))};
    }
  } finally { S.tower=cur; S.floors=fl; S.axAdj={}; regenerate(); draw(); }
  return JSON.stringify(ra);
})()
