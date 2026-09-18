/* Adapter CẢNH BÁO (module flood.canhbao) — nối console_canhbao.html vào HHT-MODULEHOST.
 * Nạp SAU hht-module-client.js (client trước, adapter sau). Đối tượng: flood/canhbao/{loại}/{mã}.
 * onFocus: cuộn tới + tô sáng khối trong console. Khuôn theo hht-flood.ngansau-adapter.js. Playbook §3.
 */
(function () {
  'use strict';
  var _tries = 0;
  function boot() {
    if (!window.HHTModule) {
      if (++_tries > 200) { if (window.console) console.warn('[canhbao-adapter] khong thay HHTModule sau 40s — bo cuoc'); return; }
      return setTimeout(boot, 200);
    }
    var MODULE_ID = 'flood.canhbao';

    var TARGET = {
      'flood/canhbao/station/chule':    'frmChuLe',
      'flood/canhbao/station/hoaduyet': 'frmHoaDuyet',
      'flood/canhbao/tinhhinh':         'genBox',
      'flood/canhbao/xa':               'xaBox',
      'flood/canhbao/thap':             'thapBox',
      'flood/canhbao/bantin':           'btnExport'
    };
    var objects = [
      { ref: 'flood/canhbao/station/chule',    label: 'Báo động — Chu Lễ',    kind: 'alarm' },
      { ref: 'flood/canhbao/station/hoaduyet', label: 'Báo động — Hòa Duyệt', kind: 'alarm' },
      { ref: 'flood/canhbao/tinhhinh',         label: 'Tình hình ngập lụt',   kind: 'assess' },
      { ref: 'flood/canhbao/xa',               label: 'Ảnh hưởng theo xã',    kind: 'table' },
      { ref: 'flood/canhbao/thap',             label: 'Tháp báo lũ VFASS',    kind: 'tower' },
      { ref: 'flood/canhbao/bantin',           label: 'Xuất bản tin',         kind: 'action' }
    ];

    if (!document.getElementById('hht-focus-css')) {
      var st = document.createElement('style'); st.id = 'hht-focus-css';
      st.textContent = '.hht-focus{outline:2px solid #5fb6e6;outline-offset:3px;border-radius:10px;box-shadow:0 0 0 4px rgba(95,182,230,.18);transition:outline .2s,box-shadow .2s}';
      document.head.appendChild(st);
    }
    function highlight(el) {
      if (!el) return;
      var box = el.closest ? el.closest('.stn,.gen,.card,.vf,.sec,section,div') : null;
      var t = box || el;
      try { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      t.classList.add('hht-focus');
      setTimeout(function () { t.classList.remove('hht-focus'); }, 1600);
    }
    function onFocus(ref) { var id = TARGET[ref]; if (id) highlight(document.getElementById(id)); }

    try {
      var embedded = (window.parent && window.parent !== window);
      if (embedded) { document.body.classList.add('embed'); var x = document.querySelector('.hd0 .x'); if (x) x.style.display = 'none'; }
    } catch (e) {}

    window.HHTModule.init({ id: MODULE_ID, objects: objects, onFocus: onFocus });
  }
  boot();
})();
