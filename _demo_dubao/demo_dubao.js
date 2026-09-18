/* =====================================================================
 * RIMS · DEMO DỰ BÁO THỦY VĂN (MOCK trình diễn, GỠ ĐƯỢC)
 * ---------------------------------------------------------------------
 * Gá-hờ — KHÔNG tích hợp, KHÔNG sửa file lõi RIMS.
 * Làm GIỐNG công cụ "Dự báo khí tượng" (dbkt): kích hoạt tile CÓ SẴN
 * "Dự báo thủy văn" (data-tool="dbtv", đang SẮP CÓ) -> bấm hiện panel nhỏ
 * (mô tả + nút) -> bấm nút bung TRANG RIÊNG _demo_dubao/dubao.html.
 * Chỉ thao tác DOM launcher + API công khai window.RIMS_moToolbox.
 * Gỡ: xoá thư mục _demo_dubao/ + 1 dòng include trong app/web/index.html.
 * ===================================================================== */
(function(){
"use strict";
var BASE='_demo_dubao/';
console.log('[demo-dubao] script đã chạy (bản panel+cửa sổ)');

function toolSection(){ return document.querySelector('#panel section[data-panel="tool"]'); }

function openPanel(){
  var s=toolSection(); if(!s) return;
  s.innerHTML='<div class="p-title"><button class="tbx-back" id="ddbBack">‹ Công cụ</button>'
    +'<span class="tbx-ttl">Dự báo thủy văn</span></div>'
    +'<div class="p-body">'
    +'<div class="tbx-mota">Hỗ trợ dự báo viên · kiểm soát mô hình &amp; chất lượng dự báo thủy văn (bản trình diễn — hệ thống WeatherPlus).</div>'
    +'<button class="tbx-run" id="ddbOpen">Mở cửa sổ công cụ</button>'
    +'<div class="tbx-hint">Mở trang riêng · buồng vận hành dự báo lưu lượng · số liệu minh hoạ (Sông Chảy 3).</div>'
    +'</div>';
  var back=document.getElementById('ddbBack');
  if(back) back.addEventListener('click',function(){ try{ window.RIMS_moToolbox(); }catch(e){} });
  var op=document.getElementById('ddbOpen');
  if(op) op.addEventListener('click',function(){ window.open(BASE+'dubao.html','rims_dbtv','width=1500,height=950'); });
}

function activate(){
  var s=toolSection(); if(!s) return;
  var tile=s.querySelector('.tbx-tool[data-tool="dbtv"]'); if(!tile) return;
  if(tile.getAttribute('data-ddb')==='1') return;
  tile.setAttribute('data-ddb','1');
  tile.classList.remove('sapco');
  var b=tile.querySelector('.badge'); if(b) b.remove();
  tile.addEventListener('click',function(e){ e.stopPropagation(); openPanel(); });
}

function setup(retry){
  var s=toolSection();
  if(!s){ if((retry||0)<40){ setTimeout(function(){ setup((retry||0)+1); },500); } return; }
  activate();
  new MutationObserver(function(){ activate(); }).observe(s,{childList:true,subtree:true});
  var tab=document.querySelector('.rtab[data-panel="tool"]'); if(tab) tab.addEventListener('click',function(){ setTimeout(activate,60); });
}

function boot(){ setup(); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
