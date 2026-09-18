/* Adapter Hố Hô — nối console vận hành đập Hố Hô vào HHT-MODULEHOST v0.1
 * Nạp TRONG console (sau hht-module-client.js). Không sửa logic console;
 * chỉ khai báo danh mục đối tượng + hành vi lấy nét (onFocus) theo id THẬT của console.
 *
 * Cơ sở id (trích từ console.html):
 *   - 3 cửa van cung: slot 1←CVC3, 2←CVC2, 3←CVC1 → input độ mở #g1/#g2/#g3
 *   - cảm biến KPI: #kMN (MN hồ), #kQin (Q vào), #kQra (Q ra tổng xả), #kRate (cường suất lũ)
 */
(function () {
  'use strict';

  var _bootTries = 0;

  function boot() {
    /* T1-01 (20/08/2026): vong nay truoc day KHONG co tran thu — thieu HHTModule
    (404/CSP/loi cu phap) la quay vong 5 lan/giay SUOT CA (12h ~ 216.000 lan danh thuc)
    ma khong mot dong bao nao. hht-tower-adapter.js da lam dung; 5 file kia chua.
    Nay: tran 200 lan (~40s) roi bo cuoc + canh bao. */
    if (!window.HHTModule) {
      if (++_bootTries > 200) { if (window.console) console.warn('[adapter] khong thay HHTModule sau 40s — bo cuoc'); return; }
      return setTimeout(boot, 200);
    } // chờ adapter client sẵn sàng

    // ref (địa chỉ đối tượng) -> id phần tử trong console
    var TARGET = {
      'dam/hoho/gate/CVC1': 'g3',
      'dam/hoho/gate/CVC2': 'g2',
      'dam/hoho/gate/CVC3': 'g1',
      'dam/hoho/sensor/reservoir-level': 'kMN',
      'dam/hoho/sensor/inflow': 'kQin',
      'dam/hoho/sensor/outflow': 'kQra',
      'dam/hoho/sensor/flood-rate': 'kRate'
    };

    var objects = [
      { ref: 'dam/hoho/gate/CVC1', label: 'Cửa van cung CVC1', kind: 'gate' },
      { ref: 'dam/hoho/gate/CVC2', label: 'Cửa van cung CVC2', kind: 'gate' },
      { ref: 'dam/hoho/gate/CVC3', label: 'Cửa van cung CVC3', kind: 'gate' },
      { ref: 'dam/hoho/sensor/reservoir-level', label: 'Mực nước hồ', kind: 'sensor' },
      { ref: 'dam/hoho/sensor/inflow', label: 'Lưu lượng vào (Q vào)', kind: 'sensor' },
      { ref: 'dam/hoho/sensor/outflow', label: 'Lưu lượng xả (Q ra)', kind: 'sensor' },
      { ref: 'dam/hoho/sensor/flood-rate', label: 'Cường suất lũ', kind: 'sensor' }
    ];

    // chèn style tô sáng tạm khi lấy nét
    if (!document.getElementById('hht-focus-css')) {
      var st = document.createElement('style'); st.id = 'hht-focus-css';
      st.textContent = '.hht-focus{outline:2px solid #1f93e3;outline-offset:3px;border-radius:8px;' +
                       'box-shadow:0 0 0 4px rgba(31,147,227,.18);transition:outline .2s,box-shadow .2s}';
      document.head.appendChild(st);
    }

    function highlightTarget(el) {
      if (!el) return;
      // tô sáng khối chứa gần nhất (thẻ KPI / hàng cửa van) cho dễ thấy, fallback về chính phần tử
      var box = el.closest ? el.closest('.kpi,.card,.k,.gate,label,section,div') : null;
      var t = box || el;
      try { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      t.classList.add('hht-focus');
      setTimeout(function () { t.classList.remove('hht-focus'); }, 1600);
    }

    function onFocus(ref) {
      var id = TARGET[ref];
      if (!id) return;
      highlightTarget(document.getElementById(id));
    }

    // Ẩn nút tách "gốc" của console khi đang NHÚNG — tầng chủ đã có nút tách chung (tránh trùng 2 nút)
    try {
      var con = document.getElementById('console');
      var embedded = (window.parent && window.parent !== window) ||
                     (con && con.classList.contains('mode-embed'));
      if (embedded) { var nd = document.getElementById('btnDetach'); if (nd) nd.style.display = 'none'; }
    } catch (e) {}

    window.HHTModule.init({ id: 'dam.hoho', objects: objects, onFocus: onFocus });
  }

  boot();
})();
