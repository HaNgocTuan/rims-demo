/* RIMS — Lop Dia hinh (DEM) qua georaster: color-relief + do mo + dai mau + duong dong muc.
   Be co che tu HydroNet (tham khao), chay tren DEM ha mau toan quoc: data/dem/dem_web.tif */
(function () {
  if (window.RIMSDem) return;
  var map = window.HYDRO_MAP;
  if (!map) { console.warn("[dem] chua co ban do"); return; }
  if (!map.getPane("gis-dem"))  { map.createPane("gis-dem");  map.getPane("gis-dem").style.zIndex = 250; }
  if (!map.getPane("gis-demc")) { map.createPane("gis-demc"); map.getPane("gis-demc").style.zIndex = 262; map.getPane("gis-demc").style.pointerEvents = "none"; }

  var URL = "data/dem/dem_web.tif";
  var DEM = null;
  var STOPS = [[0,[46,125,82]],[0.25,[155,191,90]],[0.5,[232,210,122]],[0.7,[156,107,67]],[1,[242,239,233]]];
  function ramp(t){ t=Math.max(0,Math.min(1,t)); for(var i=1;i<STOPS.length;i++){ if(t<=STOPS[i][0]){ var a=STOPS[i-1],b=STOPS[i],f=(t-a[0])/((b[0]-a[0])||1); var c=a[1].map(function(v,k){return Math.round(v+(b[1][k]-v)*f);}); return "rgb("+c[0]+","+c[1]+","+c[2]+")"; } } return "rgb(242,239,233)"; }
  function colorFn(lo,hi,nd){ return function(v){ var z=v[0]; if(z===null||z===nd||isNaN(z))return null; return ramp((z-lo)/((hi-lo)||1)); }; }
  function $(id){ return document.getElementById(id); }
  function showBusy(on){ var b=$("demBusy"); if(b) b.style.display=on?"inline":"none"; }

  function demStats(gr){
    var vals=gr.values&&gr.values[0], nd=gr.noDataValue;
    if(Array.isArray(vals)){ var lo=Infinity,hi=-Infinity;
      for(var j=0;j<vals.length;j++){ var row=vals[j]; for(var i=0;i<row.length;i++){ var z=row[i]; if(z==null||z===nd||isNaN(z))continue; if(z<lo)lo=z; if(z>hi)hi=z; } }
      if(isFinite(lo)&&isFinite(hi)&&lo<hi) return [Math.round(lo),Math.round(hi)];
    }
    var a=gr.mins&&gr.mins[0], b=gr.maxs&&gr.maxs[0];
    if(typeof a==="number"&&typeof b==="number"&&a<b) return [Math.round(a),Math.round(b)];
    return [0,3000];
  }
  function buildLayer(){ return new GeoRasterLayer({ georaster:DEM.gr, pane:"gis-dem", opacity:DEM.op, resolution:96, pixelValuesToColorFn:colorFn(DEM.lo,DEM.hi,DEM.nd) }); }
  function rebuild(){ var on=DEM.lyr&&map.hasLayer(DEM.lyr); if(DEM.lyr)map.removeLayer(DEM.lyr); DEM.lyr=buildLayer(); if(on)DEM.lyr.addTo(map); }
  function updateLegend(){ if($("demLo"))$("demLo").textContent=DEM.lo; if($("demHi"))$("demHi").textContent=DEM.hi; }

  function load(){
    if(DEM) return Promise.resolve(DEM);
    showBusy(true);
    return fetch(URL).then(function(r){ if(!r.ok) throw new Error("HTTP "+r.status); return r.arrayBuffer(); })
      .then(function(buf){ return parseGeoraster(buf); })
      .then(function(gr){
        var s=demStats(gr);
        DEM={ gr:gr, lo:s[0], hi:s[1], dataMin:s[0], dataMax:s[1], nd:gr.noDataValue, op:0.85, lyr:null, contour:null };
        DEM.lyr=buildLayer(); setupUI(); showBusy(false); return DEM;
      }).catch(function(e){ showBusy(false); console.warn("[dem]",e); alert("Khong nap duoc DEM: "+e.message); throw e; });
  }

  function toggle(on){
    var ctl=$("demCtl"), cb=document.querySelector('input[data-gis="dem"]');
    if(!on){ if(DEM&&DEM.lyr)map.removeLayer(DEM.lyr); if(DEM&&DEM.contour)map.removeLayer(DEM.contour); if(ctl)ctl.style.display="none"; return Promise.resolve(0); }
    return load().then(function(){
      DEM.lyr.addTo(map);
      if(ctl)ctl.style.display="block";
      try{ map.fitBounds(DEM.lyr.getBounds(),{maxZoom:9}); }catch(e){}
      var c=$("demCon"); if(c&&c.checked) buildContours();
      return 1;
    }).catch(function(){ if(cb)cb.checked=false; return 0; });
  }

  function setOpacity(v){ if(!DEM)return; DEM.op=v; if(DEM.lyr&&DEM.lyr.setOpacity)DEM.lyr.setOpacity(v); }
  function setStretch(lo,hi){ if(!DEM)return; DEM.lo=lo; DEM.hi=hi; if(DEM.lyr&&DEM.lyr.updateColors)DEM.lyr.updateColors(colorFn(lo,hi,DEM.nd)); else rebuild(); updateLegend(); }
  function clearContours(){ if(DEM&&DEM.contour){ map.removeLayer(DEM.contour); DEM.contour=null; } }
  function buildContours(){
    if(!DEM)return; var gr=DEM.gr, vals=gr.values&&gr.values[0];
    if(!Array.isArray(vals))return;
    var iv=+($("demInt")?$("demInt").value:100), thr=[];
    for(var z=Math.ceil(DEM.lo/iv)*iv; z<=DEM.hi; z+=iv) thr.push(z);
    if(thr.length>250){ alert("Buoc qua nho cho dai cao do."); return; }
    showBusy(true);
    setTimeout(function(){ try{
      var H=vals.length,W=vals[0].length,S=600,st=Math.max(1,Math.ceil(Math.max(W,H)/S)),w=Math.ceil(W/st),h=Math.ceil(H/st),flat=new Float32Array(w*h);
      for(var j=0;j<h;j++)for(var i=0;i<w;i++){ var zz=vals[Math.min(j*st,H-1)][Math.min(i*st,W-1)]; flat[j*w+i]=(zz===null||zz===DEM.nd||isNaN(zz))?(DEM.dataMin-9999):zz; }
      var cs=d3.contours().size([w,h]).thresholds(thr)(flat), xmin=gr.xmin,ymax=gr.ymax,pw=gr.pixelWidth,ph=gr.pixelHeight;
      var toLL=function(p){ return [xmin+p[0]*st*pw, ymax-p[1]*st*ph]; }, feats=[];
      for(var a=0;a<cs.length;a++){ var C=cs[a]; for(var b2=0;b2<C.coordinates.length;b2++){ var poly=C.coordinates[b2]; for(var r=0;r<poly.length;r++){ feats.push({type:"Feature",properties:{z:C.value},geometry:{type:"LineString",coordinates:poly[r].map(toLL)}}); } } }
      clearContours();
      DEM.contour=L.geoJSON({type:"FeatureCollection",features:feats},{pane:"gis-demc",interactive:false,style:function(f){ return {color:"#5b3a1e",weight:(f.properties.z%(iv*5)===0)?1.1:0.5,opacity:0.7}; }}).addTo(map);
    }catch(e){ alert("Loi dong muc: "+e.message); } showBusy(false); },30);
  }

  var _ui=false;
  function setupUI(){
    if(_ui)return; _ui=true;
    var op=$("demOp"), ov=$("demOpV");
    if(op){ op.value=DEM.op; if(ov)ov.textContent=Math.round(DEM.op*100);
      op.addEventListener("input",function(){ var v=parseFloat(op.value)||0.85; setOpacity(v); if(ov)ov.textContent=Math.round(v*100); }); }
    var lo=$("demSLo"), hi=$("demSHi");
    if(lo&&hi){ [lo,hi].forEach(function(s){ s.min=DEM.dataMin; s.max=DEM.dataMax; s.step=1; }); lo.value=DEM.lo; hi.value=DEM.hi;
      var t=null; var oninput=function(e){ var a=+lo.value,b=+hi.value; if(a>=b){ if(e.target===lo)a=b-1; else b=a+1; lo.value=a; hi.value=b; } clearTimeout(t); t=setTimeout(function(){ setStretch(a,b); var c=$("demCon"); if(c&&c.checked)buildContours(); },120); };
      lo.oninput=oninput; hi.oninput=oninput; }
    var con=$("demCon"), ci=$("demInt");
    if(con) con.onchange=function(){ con.checked?buildContours():clearContours(); };
    if(ci) ci.onchange=function(){ var c=$("demCon"); if(c&&c.checked)buildContours(); };
    updateLegend();
  }

  window.RIMSDem = { toggle:toggle, buildContours:buildContours };
})();
