/* Adapter Ngàn Trươi — nối console vận hành đập Ngàn Trươi vào HHT-MODULEHOST v0.1
 * Nạp TRONG console (sau hht-module-client.js). Không sửa logic console;
 * chỉ khai báo danh mục đối tượng + hành vi lấy nét (onFocus) theo id THẬT của console.
 *
 * Cơ sở id (trích từ console_ntr.html):
 *   - 7 cửa van cung: input độ mở #g1..#g7 (địa chỉ dùng SỐ cửa 1..7; ⚑ tên/mã thật chờ N-09).
 *   - cảm biến KPI: #kMN (MN hồ), #kQin (Q vào), #kQra (Q ra tổng xả), #kRate (cường suất lũ).
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
    } // chờ hht-module-client.js

    // ref (địa chỉ đối tượng {category}/{côngtrình}/{loại}/{mã}) -> id phần tử THẬT trong console
    var TARGET = {
      'dam/ngantruoi/gate/1': 'g1',
      'dam/ngantruoi/gate/2': 'g2',
      'dam/ngantruoi/gate/3': 'g3',
      'dam/ngantruoi/gate/4': 'g4',
      'dam/ngantruoi/gate/5': 'g5',
      'dam/ngantruoi/gate/6': 'g6',
      'dam/ngantruoi/gate/7': 'g7',
      'dam/ngantruoi/sensor/reservoir-level': 'kMN',
      'dam/ngantruoi/sensor/inflow': 'kQin',
      'dam/ngantruoi/sensor/outflow': 'kQra',
      'dam/ngantruoi/sensor/flood-rate': 'kRate'
    };

    var objects = [
      { ref: 'dam/ngantruoi/gate/1', label: 'Cửa van cung 1 ⚑', kind: 'gate' },
      { ref: 'dam/ngantruoi/gate/2', label: 'Cửa van cung 2 ⚑', kind: 'gate' },
      { ref: 'dam/ngantruoi/gate/3', label: 'Cửa van cung 3 ⚑', kind: 'gate' },
      { ref: 'dam/ngantruoi/gate/4', label: 'Cửa van cung 4 ⚑', kind: 'gate' },
      { ref: 'dam/ngantruoi/gate/5', label: 'Cửa van cung 5 ⚑', kind: 'gate' },
      { ref: 'dam/ngantruoi/gate/6', label: 'Cửa van cung 6 ⚑', kind: 'gate' },
      { ref: 'dam/ngantruoi/gate/7', label: 'Cửa van cung 7 ⚑', kind: 'gate' },
      { ref: 'dam/ngantruoi/sensor/reservoir-level', label: 'Mực nước hồ', kind: 'sensor' },
      { ref: 'dam/ngantruoi/sensor/inflow', label: 'Lưu lượng vào (Q vào)', kind: 'sensor' },
      { ref: 'dam/ngantruoi/sensor/outflow', label: 'Lưu lượng xả (Q ra)', kind: 'sensor' },
      { ref: 'dam/ngantruoi/sensor/flood-rate', label: 'Cường suất lũ', kind: 'sensor' }
    ];
    // ⚑ Nhãn cửa đánh dấu ⚑: đang dùng SỐ 1..7 (chờ chốt tên/mã thật 7 cửa — nợ N-09). Đổi label + TARGET khi có.

    // style tô sáng tạm khi lấy nét
    if (!document.getElementById('hht-focus-css')) {
      var st = document.createElement('style'); st.id = 'hht-focus-css';
      st.textContent = '.hht-focus{outline:2px solid #1f93e3;outline-offset:3px;border-radius:8px;' +
                       'box-shadow:0 0 0 4px rgba(31,147,227,.18);transition:outline .2s,box-shadow .2s}';
      document.head.appendChild(st);
    }

    function highlightTarget(el) {
      if (!el) return;
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

    window.HHTModule.init({ id: 'dam.ngantruoi', objects: objects, onFocus: onFocus });
  }

  boot();
})();
