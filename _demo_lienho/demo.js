/* =====================================================================
 * RIMS · DEMO LIÊN HỒ — Hệ thống sông Ngàn Sâu (MOCK, GỠ ĐƯỢC)
 * ---------------------------------------------------------------------
 * Addon TRÌNH DIỄN — KHÔNG tích hợp. Gỡ = xoá thư mục _demo_lienho/ +
 * xoá đúng một dòng <script src="_demo_lienho/demo.js"> trong index.html.
 * KHÔNG sửa file lõi nào của RIMS.
 *
 * Luồng:
 *  1) Thêm "Hệ thống sông Ngàn Sâu (demo)" vào ô Tìm hệ thống sông.
 *  2) Chọn → HYDRO_MAP bay vào vùng HydroNet + 2 đập Hố Hô & Ngàn Trươi
 *     NỔI LÊN; nhắc mở Công cụ › Vận hành hồ chứa › Liên hồ.
 *  3) Bấm tile "Liên hồ" (Công cụ) → băng phải (#opsPanel) tung lụa (band.html).
 *  4) Lớp ngập + nhà cửa vẽ trên chính HYDRO_MAP, nghe BroadcastChannel "hydronet".
 * ===================================================================== */
(function(){
"use strict";
/* Đường dẫn CỐ ĐỊNH (addon luôn nằm ở app/web/_demo_lienho/, index.html ở app/web/) —
   không suy từ currentScript để tránh hỏng khi script dùng defer. */
var BASE='_demo_lienho/';
var DATA=null, S={overlay:null,grid:null,gridKey:null,map:null,bcv:null,on:false,armed:false,damLayer:null,obs:null};
console.log('[demo-lienho] script đã chạy');

/* Tải data (nền) — KHÔNG chốt giao diện theo nó */
fetch(BASE+'data.json').then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
  .then(function(d){ DATA=d; console.log('[demo-lienho] data.json OK ('+(d.rungs?d.rungs.length:0)+' bậc)'); resolveMap(); })
  .catch(function(e){ console.warn('[demo-lienho] KHÔNG đọc được '+BASE+'data.json —',e); });

/* Tìm bản đồ RIMS để gắn lớp lũ (nền) */
function resolveMap(){
  var t=0, iv=setInterval(function(){ t++;
    if(window.HYDRO_MAP&&window.HYDRO_MAP.getPane){ clearInterval(iv); S.map=window.HYDRO_MAP; setupMap(); console.log('[demo-lienho] đã gắn lớp lũ vào HYDRO_MAP'); }
    else if(t>240){ clearInterval(iv); console.warn('[demo-lienho] không thấy window.HYDRO_MAP'); }
  },500);
}

/* Giao diện (search + tile Công cụ) chạy NGAY, độc lập data/map */
function boot(){
  injectCSS();
  waitEl('sysBox', function(sb){ setupSearch(sb); console.log('[demo-lienho] đã tiêm mục tìm Ngàn Sâu'); });
  setupToolInjector();
  hookEraser();
}
function waitEl(id, cb){ var t=0, iv=setInterval(function(){ t++; var el=document.getElementById(id);
  if(el){ clearInterval(iv); cb(el); } else if(t>240){ clearInterval(iv); console.warn('[demo-lienho] không thấy #'+id); } },500); }
/* boot() được gọi Ở CUỐI IIFE (sau khi mọi biến như LINK_IC đã gán) */

function injectCSS(){
  if(document.getElementById('demo-lienho-css'))return;
  var st=document.createElement('style'); st.id='demo-lienho-css';
  st.textContent=
   '@keyframes dlhPop{0%{transform:translateY(-8px) scale(.2);opacity:0}60%{transform:translateY(2px) scale(1.12)}100%{transform:translateY(0) scale(1);opacity:1}}'
  +'@keyframes dlhPulse{0%,100%{box-shadow:0 0 0 0 rgba(95,182,230,.0)}50%{box-shadow:0 0 0 4px rgba(95,182,230,.35)}}'
  +'.dlh-dam{will-change:transform;animation:dlhPop .5s cubic-bezier(.2,1.2,.3,1) both;text-align:center}'
  +'.dlh-dam .dwrap{width:30px;height:30px;margin:0 auto;border-radius:50%;background:#12a5c9;border:2.5px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.55),0 0 0 4px rgba(18,165,201,.28);display:flex;align-items:center;justify-content:center}'
  +'.dlh-dam .dwrap svg{width:18px;height:18px;stroke:#fff;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}'
  +'.dlh-dam .lab{margin-top:4px;font:800 12px system-ui;color:#fff;white-space:nowrap;text-shadow:0 1px 3px #000,0 0 3px #000}'
  +'.dlh-dam .sub{font:600 10px system-ui;color:#bfeffb;text-shadow:0 1px 3px #000}'
  +'.rtab.dlh-pulse{animation:dlhPulse 1.3s ease-in-out infinite;border-radius:8px}'
  +'.tbx-tool.dlh-tool{position:relative;cursor:pointer}'
  +'.tbx-tool.dlh-tool.dlh-armed{animation:dlhPulse 1.3s ease-in-out infinite;border-color:#5fb6e6}'
  +'.tbx-tool.dlh-tool .badge.new{background:rgba(95,182,230,.16);color:#bfe3f7;border:1px solid rgba(95,182,230,.4)}'
  /* drawer băng phải riêng của addon (không đụng layout RIMS) */
  +'#dlhDrawer{position:fixed;top:0;right:0;height:100vh;width:396px;max-width:92vw;z-index:99998;background:#111d2b;border-left:1px solid #22364a;box-shadow:-10px 0 40px rgba(0,0,0,.45);display:flex;flex-direction:column;transform:translateX(100%);transition:transform .38s cubic-bezier(.22,1,.3,1)}'
  +'#dlhDrawer.open{transform:translateX(0)}'
  +'#dlhDrawer .dh{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid #22364a;background:#0e1a28}'
  +'#dlhDrawer .dh .t{font:800 13px system-ui;color:#e9eff6}'
  +'#dlhDrawer .dh .x{margin-left:auto;cursor:pointer;border:0;background:transparent;color:#9fb2c2;font-size:17px;line-height:1}'
  +'#dlhDrawer .dlh-tabs{display:flex;gap:5px;padding:8px 10px;border-bottom:1px solid #22364a;background:#0e1a28}'
  +'#dlhDrawer .dlh-tab{flex:1;border:1px solid #22364a;background:#0b1622;color:#9fb2c2;font:700 12px system-ui;padding:7px;border-radius:8px;cursor:pointer}'
  +'#dlhDrawer .dlh-tab.on{background:#5fb6e6;color:#04121d;border-color:#5fb6e6}'
  +'#dlhDrawer .dlh-body{flex:1;position:relative;display:flex;min-height:0}'
  +'#dlhDrawer iframe{flex:1;border:0;width:100%;height:100%}'
  +'#dlhDrawer iframe.dlh-hide{display:none}';
  document.head.appendChild(st);
}

/* ---------- decode + color ---------- */
function decode(r){ if(r._dec)return r._dec; var a=new Int16Array(r.w*r.h),rl=r.rle,k=0;
  for(var i=0;i<rl.length;i+=2){var v=rl[i],c=rl[i+1];for(var j=0;j<c;j++)a[k++]=v;} r._dec=a; return a; }
var STOPS=[[0,207,232,251],[.5,167,216,245],[1,109,189,236],[2,58,151,221],[4,21,115,194],[8,21,115,194]];
function colorFor(d){ if(d<=STOPS[0][0])return STOPS[0].slice(1);
  for(var i=1;i<STOPS.length;i++){if(d<=STOPS[i][0]){var a=STOPS[i-1],b=STOPS[i],t=(d-a[0])/(b[0]-a[0]);
    return [a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,a[3]+(b[3]-a[3])*t];}} return STOPS[STOPS.length-1].slice(1); }
function alphaFor(d){ return .34+.36*Math.min(d/4,1); }

/* ---------- map layers on HYDRO_MAP ---------- */
function setupMap(){
  var L=window.L, map=S.map;
  if(!map.getPane('demoFlood')){ map.createPane('demoFlood'); map.getPane('demoFlood').style.zIndex=420; }
  if(!map.getPane('demoBld')){ var bp=map.createPane('demoBld'); bp.style.zIndex=430; bp.style.pointerEvents='none';
    S.bcv=document.createElement('canvas'); S.bcv.style.position='absolute'; S.bcv.style.pointerEvents='none'; bp.appendChild(S.bcv); }
  map.on('move zoom viewreset zoomend moveend',drawBuildings);
  try{S.bc=new BroadcastChannel('hydronet');}catch(e){}
  if(S.bc) S.bc.onmessage=function(ev){ var d=ev&&ev.data; if(!d||d.type!=='flood:frame')return;
    if(d.mode==='sim') showIntensity(d.intensity); else clearFlood(); };
}
function showDams(){
  if(!S.map||!DATA) return;
  var L=window.L, map=S.map;
  if(S.damLayer){ map.removeLayer(S.damLayer); S.damLayer=null; }
  S.damLayer=L.layerGroup().addTo(map);
  var DAM_SVG='<svg viewBox="0 0 24 24"><path d="M5 20 L8.5 5 L15.5 5 L19 20"/><path d="M3.5 20 H20.5"/><path d="M7 12 H17"/></svg>';
  (DATA.dams||[]).forEach(function(dm,i){
    var html='<div class="dlh-dam" style="animation-delay:'+(i*140)+'ms"><div class="dwrap">'+DAM_SVG+'</div><div class="lab">'+dm.name+'</div><div class="sub">'+(dm.loai||'')+'</div></div>';
    L.marker([dm.lat,dm.lon],{icon:L.divIcon({className:'',html:html,iconSize:[90,52],iconAnchor:[45,15]}),interactive:false,zIndexOffset:1000}).addTo(S.damLayer);
  });
}
function pickRung(Lv){ var idx=-1; for(var i=0;i<DATA.rungs.length;i++){if(DATA.rungs[i].chule<=Lv+1e-6)idx=i;} return idx<0?null:DATA.rungs[idx]; }
function showIntensity(Lv){ var r=pickRung(Lv); S.on=true; if(!r){ clearFlood(); return; }
  if(S.gridKey===r.chule){ drawBuildings(); return; } paintRung(r); S.gridKey=r.chule; drawBuildings(); }
function paintRung(r){
  var L=window.L, map=S.map, a=decode(r), cv=document.createElement('canvas'); cv.width=r.w; cv.height=r.h;
  var ctx=cv.getContext('2d'), img=ctx.createImageData(r.w,r.h), n=r.w*r.h;
  for(var i=0;i<n;i++){var cm=a[i],o=i*4;
    if(cm===-2){img.data[o]=150;img.data[o+1]=170;img.data[o+2]=190;img.data[o+3]=55;continue;}
    if(cm<0){img.data[o+3]=0;continue;}
    var d=cm/100,c=colorFor(d);img.data[o]=c[0]|0;img.data[o+1]=c[1]|0;img.data[o+2]=c[2]|0;img.data[o+3]=Math.round(alphaFor(d)*255);}
  ctx.putImageData(img,0,0);
  var west=r.lon0-r.dlon/2,east=r.lon0+(r.w-.5)*r.dlon,north=r.lat0+r.dlat/2,south=r.lat0-(r.h-.5)*r.dlat;
  if(S.overlay)map.removeLayer(S.overlay);
  S.overlay=L.imageOverlay(cv.toDataURL(),[[south,west],[north,east]],{pane:'demoFlood',opacity:1,interactive:false}).addTo(map);
  S.grid=r;
}
function clearFlood(){ S.on=false; S.gridKey=null; if(S.overlay){S.map.removeLayer(S.overlay);S.overlay=null;} S.grid=null; drawBuildings(); }
function sampleDepth(lat,lon){ var g=S.grid; if(!g)return -1; var col=Math.round((lon-g.lon0)/g.dlon),row=Math.round((g.lat0-lat)/g.dlat);
  if(col<0||col>=g.w||row<0||row>=g.h)return -1; return decode(g)[row*g.w+col]; }
var ZB=14;
function drawBuildings(){
  if(!S.bcv||!DATA.buildings)return; var map=S.map, z=map.getZoom(), size=map.getSize();
  S.bcv.width=size.x; S.bcv.height=size.y;
  var pos=map.containerPointToLayerPoint([0,0]); window.L.DomUtil.setPosition(S.bcv,pos);
  var ctx=S.bcv.getContext('2d'); ctx.clearRect(0,0,size.x,size.y);
  if(!S.on || z<ZB) return;
  var bnds=map.getBounds();
  Object.keys(DATA.buildings).forEach(function(xk){ var arr=DATA.buildings[xk]||[];
    for(var i=0;i<arr.length;i++){ var r=arr[i].r, c0=r[0];
      if(c0[1]<bnds.getSouth()||c0[1]>bnds.getNorth()||c0[0]<bnds.getWest()||c0[0]>bnds.getEast()) continue;
      var flooded=(sampleDepth(c0[1],c0[0])>0);
      ctx.beginPath();
      for(var j=0;j<r.length;j++){ var p=map.latLngToContainerPoint([r[j][1],r[j][0]]); if(j===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}
      ctx.closePath();
      if(flooded){ctx.fillStyle='rgba(227,86,77,.82)';ctx.strokeStyle='rgba(120,20,18,.9)';}
      else{ctx.fillStyle=arr[i].k===2?'rgba(224,179,74,.7)':'rgba(210,224,236,.62)';ctx.strokeStyle='rgba(20,34,48,.7)';}
      ctx.fill(); ctx.lineWidth=.5; ctx.stroke();
    }
  });
}

/* ---------- search injection ---------- */
function boDau(x){x=(x||'').normalize('NFD');var o='';for(var i=0;i<x.length;i++){var c=x.charCodeAt(i);if(c>=768&&c<=879)continue;o+=x[i];}return o.replace(/đ/g,'d').replace(/Đ/g,'d').toLowerCase();}
function setupSearch(sb){
  var sr=document.getElementById('sysRes');
  function inject(){
    if(!sr) return; var q=boDau(sb.value.trim());
    if(q && 'he thong song ngan sau'.indexOf(q)<0 && q.indexOf('ngan')<0) return;
    if(sr.querySelector('[data-demo="nsau"]')) return;
    var none=sr.querySelector('.none'); if(none) none.remove();
    var b=document.createElement('b'); b.setAttribute('data-demo','nsau');
    b.innerHTML='Hệ thống sông Ngàn Sâu <span>· demo</span>';
    b.addEventListener('mousedown',function(e){e.preventDefault();});
    b.addEventListener('click',function(){ sr.style.display='none'; sb.value='Hệ thống sông Ngàn Sâu'; armSystem(); });
    sr.appendChild(b); sr.style.display='block';
  }
  sb.addEventListener('input',function(){ setTimeout(inject,0); });
  sb.addEventListener('focus',function(){ setTimeout(inject,0); });
}

/* ---------- BƯỚC 1: chọn hệ thống → zoom + 2 đập nổi lên ---------- */
function armSystem(retry){
  S.armed=true;
  var tab=document.querySelector('.rtab[data-panel="tool"]'); if(tab) tab.classList.add('dlh-pulse');
  injectTool(); // nếu Công cụ đang mở, làm tile Liên hồ nhấp nháy
  toast('Hệ thống Ngàn Sâu · 2 hồ Hố Hô + Ngàn Trươi — mở Công cụ › Vận hành hồ chứa › bấm "Liên hồ"');
  // Zoom + 2 đập cần map + DATA — chờ nếu chưa sẵn
  var map=S.map||window.HYDRO_MAP, L=window.L;
  if(!map||!map.getPane||!DATA||!DATA.bounds){ if((retry||0)<20){ setTimeout(function(){armSystem((retry||0)+1);},400); } return; }
  S.map=map;
  try{
    var b=L.latLngBounds(DATA.bounds);
    var z=map.getBoundsZoom(b,false,[30,30]);
    z=Math.max(10,Math.min(z,11));                 // zoom hẳn vào vùng HydroNet
    map.flyTo(b.getCenter(), z, {duration:.9});
  }catch(e){ try{map.fitBounds(DATA.bounds);}catch(e2){} }
  showDams();
}

/* ---------- tile "Liên hồ" trong Công cụ › Vận hành hồ chứa ---------- */
function toolSection(){ return document.querySelector('#panel section[data-panel="tool"]'); }
var LINK_IC='<svg viewBox="0 0 24 24"><path d="M9 12h6M8.5 8H7a4 4 0 0 0 0 8h1.5M15.5 8H17a4 4 0 0 1 0 8h-1.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
function injectTool(){
  var s=toolSection(); if(!s) return;
  if(!s.querySelector('.tbx-grid')) return;            // đang mở khung tool con, không phải launcher
  if(s.querySelector('[data-demo-tool="lienho"]')){    // đã có → chỉ cập nhật nhấp nháy
    var ex=s.querySelector('[data-demo-tool="lienho"]'); ex.classList.toggle('dlh-armed', !!S.armed); return; }
  // tìm nhóm "Vận hành hồ chứa"
  var grp=null, grps=s.querySelectorAll('.tbx-grp');
  for(var i=0;i<grps.length;i++){ if(boDau(grps[i].textContent).indexOf('van hanh ho chua')>=0){ grp=grps[i]; break; } }
  if(!grp) return;
  var grid=grp.nextElementSibling; if(!grid||grid.className.indexOf('tbx-grid')<0) return;
  var tile=document.createElement('div');
  tile.className='tbx-tool dlh-tool'+(S.armed?' dlh-armed':'');
  tile.setAttribute('data-demo-tool','lienho');
  tile.innerHTML='<span class="badge new">MỚI</span><div class="ic" style="color:#5fb6e6">'+LINK_IC+'</div><div class="nm">Liên hồ</div>';
  tile.addEventListener('click',onLienHo);
  grid.appendChild(tile);
}
function setupToolInjector(){
  injectTool();
  var s=toolSection(); if(!s) return;
  S.obs=new MutationObserver(function(){ injectTool(); });
  S.obs.observe(s,{childList:true,subtree:true});
  // panel Công cụ có thể chưa render tới lúc bấm tab → cũng thử lại khi bấm tab
  var tab=document.querySelector('.rtab[data-panel="tool"]'); if(tab) tab.addEventListener('click',function(){ setTimeout(injectTool,60); });
}
function onLienHo(){
  if(!S.armed){ toast('Chọn "Hệ thống sông Ngàn Sâu" ở ô Tìm hệ thống sông trước.');
    var sb=document.getElementById('sysBox'); if(sb){ sb.focus(); } return; }
  var tab=document.querySelector('.rtab[data-panel="tool"]'); if(tab) tab.classList.remove('dlh-pulse');
  openBand();
}

/* ---------- BƯỚC 2: băng phải tung lụa (drawer riêng của addon) ---------- */
function openBand(){
  var dr=document.getElementById('dlhDrawer');
  if(!dr){
    dr=document.createElement('div'); dr.id='dlhDrawer';
    dr.innerHTML='<div class="dh"><span class="t">Vận hành liên hồ — Ngàn Sâu</span><button class="x" title="Đóng">✕</button></div>'
      +'<div class="dlh-tabs"><button class="dlh-tab on" data-tab="giamsat">Giám sát</button><button class="dlh-tab" data-tab="canhbao">Cảnh báo</button></div>'
      +'<div class="dlh-body"><iframe data-pane="giamsat" src="'+BASE+'band.html"></iframe><iframe class="dlh-hide" data-pane="canhbao" src="'+BASE+'canhbao.html?mode=embed"></iframe></div>';
    document.body.appendChild(dr);
    dr.querySelector('.x').addEventListener('click',closeBand);
    (function(){ var tabs=dr.querySelectorAll('.dlh-tab'),panes=dr.querySelectorAll('.dlh-body iframe');
      for(var i=0;i<tabs.length;i++){ tabs[i].addEventListener('click',function(){ var name=this.getAttribute('data-tab');
        for(var k=0;k<tabs.length;k++) tabs[k].classList.toggle('on', tabs[k]===this);
        for(var j=0;j<panes.length;j++) panes[j].classList.toggle('dlh-hide', panes[j].getAttribute('data-pane')!==name);
      }); } })();
  }
  // ép reflow rồi thêm .open để chạy hoạt ảnh trượt
  void dr.offsetWidth; dr.classList.add('open');
  setTimeout(function(){ try{S.map&&S.map.invalidateSize();}catch(e){} drawBuildings(); },420);
}
function closeBand(){
  var dr=document.getElementById('dlhDrawer'); if(dr) dr.classList.remove('open');
  try{ if(S.bc) S.bc.postMessage({type:'demo:stop'}); }catch(e){}
  clearFlood();
}
/* DỌN MÀN HÌNH: dừng mô phỏng + gỡ lũ + gỡ 2 đập + đóng băng → về trắng */
function stopDemo(){
  try{ if(S.bc) S.bc.postMessage({type:'demo:stop'}); }catch(e){}   // báo band dừng tua + về Hiện nay
  clearFlood();                                                     // gỡ lớp ngập + nhà cửa
  if(S.damLayer){ try{S.map.removeLayer(S.damLayer);}catch(e){} S.damLayer=null; }  // gỡ 2 đập
  var dr=document.getElementById('dlhDrawer'); if(dr) dr.classList.remove('open');  // đóng băng
  S.armed=false;
  var tab=document.querySelector('.rtab[data-panel="tool"]'); if(tab) tab.classList.remove('dlh-pulse');
  var tile=document.querySelector('[data-demo-tool="lienho"]'); if(tile) tile.classList.remove('dlh-armed');
}
function hookEraser(){ waitEl('btnDonMH', function(b){ b.addEventListener('click', function(){ setTimeout(stopDemo,0); }); }); }

/* ---------- toast ---------- */
var _tEl=null,_tT=null;
function toast(m){
  if(!_tEl){ _tEl=document.createElement('div'); _tEl.style.cssText='position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:99999;background:#16283a;border:1px solid #5fb6e6;color:#eaf6ff;padding:9px 15px;border-radius:9px;font:13px/1.4 system-ui;max-width:520px;box-shadow:0 8px 24px rgba(0,0,0,.5)'; document.body.appendChild(_tEl); }
  _tEl.textContent=m; _tEl.style.display='block'; if(_tT)clearTimeout(_tT); _tT=setTimeout(function(){_tEl.style.display='none';},4200);
}

/* KHỞI ĐỘNG — đặt ở CUỐI để mọi biến (LINK_IC…) đã gán trước khi boot chạy */
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
