/* HHT-MODULEHOST — quản lý module phía host (nạp trong index.html) v0.1
 * Nguyên tắc: KHÔNG viết lại viewer; chỉ bao quanh cơ chế iframe/ops sẵn có.
 *  - Đọc modules.json -> dựng rail nút bên phải theo nhóm phân loại (Đập / Trạm / Tháp)
 *  - Nhúng module qua #opsFrame sẵn có; giữ nguyên kéo-giãn panel + "đẩy nền" (ResizeObserver cũ)
 *  - Nút tách -> cửa sổ riêng (đa màn hình), vẫn đồng bộ qua bus 'hydronet'
 *  - Bus đồng bộ lựa chọn; chỉ mục đối tượng; command palette (Ctrl/Cmd+K)
 * Phụ thuộc DOM sẵn có trong index.html: #opsDock, #opsPanel, #opsFrame, .oph .t, #opsClose, #opsTab.
 * Tương thích: nếu có window.HHT_openOps/closeOps (IIFE cũ) thì dùng lại; nếu không, tự xử lý.
 */
(function (w, d) {
  'use strict';

  var H = { modules: [], byId: {}, byCat: {}, active: null, detached: {}, index: [], _bc: null, _pendingFocus: null };

  var opsDock, panel, frame, titleEl;

  function grab() {
    opsDock = d.getElementById('opsDock');
    panel   = d.getElementById('opsPanel');
    frame   = d.getElementById('opsFrame');
    titleEl = opsDock ? opsDock.querySelector('.oph .t') : null;
  }

  // Host tự quản trạng thái panel bằng lớp .collapsed (KHÔNG gọi HHT_openOps để tránh
  // đệ quy và tránh việc IIFE cũ nạp cứng frame.src). Kéo-giãn + "đẩy nền" vẫn chạy
  // vì ResizeObserver cũ bám theo bề rộng panel khi lớp .collapsed thay đổi.
  function openPanel()  { if (panel) panel.classList.remove('collapsed'); }
  function closePanel() { if (panel) panel.classList.add('collapsed'); }

  H.init = function (url) {
    grab();
    injectCSS();
    setupBus();
    setupPalette();
    setupDetachButton();
    url = url || 'modules.json';
    var bust = (url.indexOf('?') < 0 ? '?v=' : '&v=') + Date.now();
    return fetch(url + bust)
      .then(function (r) { return r.json(); })
      .then(function (j) { loadRegistry((j && j.modules) || []); return H; })
      .catch(function (e) { console.warn('[modulehost] không đọc được ' + url, e); });
  };

  function loadRegistry(list) {
    H.modules = list; H.byId = {}; H.byCat = {};
    list.forEach(function (m) {
      H.byId[m.id] = m;
      (H.byCat[m.category] = H.byCat[m.category] || []).push(m);
    });
    buildRail();
  }

  // ---------- Rail 2 tầng: nút NHÓM (Đập / Trạm thủy văn / Tháp báo lũ) -> dropdown chọn công trình ----------
  // Thiết kế này gọn khi có nhiều trạm/tháp: rail chỉ 3 nút nhóm; bấm nhóm mở menu liệt kê các công trình.
  function catsInOrder() {
    var seen = {}, out = [];
    H.modules.forEach(function (m) {
      if (!seen[m.category]) { seen[m.category] = 1; out.push({ cat: m.category, label: m.categoryLabel || m.category }); }
    });
    return out;
  }
  function buildRail() {
    if (!opsDock) return;
    var rail = d.getElementById('opsRail');
    if (!rail) { rail = d.createElement('div'); rail.id = 'opsRail'; opsDock.insertBefore(rail, opsDock.firstChild); }
    rail.innerHTML = '';
    var oldTab = d.getElementById('opsTab'); if (oldTab) oldTab.style.display = 'none'; // thay nút THEO DÕI tĩnh
    catsInOrder().forEach(function (c) {
      var b = d.createElement('button');
      b.className = 'ops-cbtn'; b.type = 'button';
      b.setAttribute('data-cat', c.cat); b.title = c.label;
      b.textContent = c.label;
      b.addEventListener('click', function (ev) { ev.stopPropagation(); toggleCatMenu(c.cat, b); });
      rail.appendChild(b);
    });
  }
  // ----- Menu thả xuống (flyout) cho một nhóm -----
  function closeCatMenu() {
    var m = d.getElementById('opsCatMenu'); if (m) m.parentNode.removeChild(m);
    var rail = d.getElementById('opsRail');
    if (rail) Array.prototype.forEach.call(rail.querySelectorAll('.ops-cbtn.open'), function (b) { b.classList.remove('open'); });
  }
  function toggleCatMenu(cat, btn) {
    var cur = d.getElementById('opsCatMenu');
    if (cur && cur.getAttribute('data-cat') === cat) { closeCatMenu(); return; } // bấm lại nhóm đang mở -> đóng
    closeCatMenu();
    var list = H.byCat[cat] || [];
    var menu = d.createElement('div'); menu.id = 'opsCatMenu'; menu.className = 'ops-catmenu'; menu.setAttribute('data-cat', cat);
    var hd = d.createElement('div'); hd.className = 'ops-cm-hd'; hd.textContent = btn.title; menu.appendChild(hd);
    if (!list.length) {
      var em = d.createElement('div'); em.className = 'ops-cm-empty'; em.textContent = 'Chưa có công trình'; menu.appendChild(em);
    }
    list.forEach(function (m) {
      var it = d.createElement('button'); it.className = 'ops-cm-it'; it.type = 'button'; it.setAttribute('data-mid', m.id);
      it.textContent = m.title || m.short || m.id;
      if (H.active === m.id) it.classList.add('on');
      it.addEventListener('click', function (ev) { ev.stopPropagation(); closeCatMenu(); H.toggleModule(m.id); });
      menu.appendChild(it);
    });
    d.body.appendChild(menu);
    btn.classList.add('open');
    // đặt menu BÊN TRÁI rail, canh theo nút nhóm; nếu tràn đáy thì đẩy lên
    var br = btn.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.right = Math.round(w.innerWidth - br.left + 8) + 'px';
    var top = br.top; var mh = menu.offsetHeight;
    if (top + mh > w.innerHeight - 8) top = Math.max(8, w.innerHeight - 8 - mh);
    menu.style.top = Math.round(top) + 'px';
    menu.addEventListener('click', function (ev) { ev.stopPropagation(); });
  }
  // đóng menu khi bấm ra ngoài / Esc
  d.addEventListener('click', function () { closeCatMenu(); });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCatMenu(); });

  function markActive(id) {
    var rail = d.getElementById('opsRail'); if (!rail) return;
    var m = H.byId[id]; var activeCat = m ? m.category : null;
    Array.prototype.forEach.call(rail.querySelectorAll('.ops-cbtn'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-cat') === activeCat);
    });
    var menu = d.getElementById('opsCatMenu');
    if (menu) Array.prototype.forEach.call(menu.querySelectorAll('.ops-cm-it'), function (it) {
      it.classList.toggle('on', it.getAttribute('data-mid') === id);
    });
  }

  // ---------- Mở / chuyển module ----------
  // Bấm nút module đang mở -> thu gọn (collapse); ngược lại -> mở
  H.toggleModule = function (id) {
    var isOpen = (H.active === id) && panel && !panel.classList.contains('collapsed') && !H.detached[id];
    if (isOpen) { closePanel(); } else { H.openModule(id); }
  };

  H.openModule = function (id) {
    var m = H.byId[id]; if (!m) return;
    if (H.detached[id]) { try { H.detached[id].focus(); } catch (e) {} return; }
    if (H.active !== id) {
      H.active = id;
      if (frame) frame.src = withBust(m.url);
      if (titleEl) titleEl.textContent = 'Theo dõi — ' + m.title;
      markActive(id);
    }
    openPanel();
  };
  function withBust(u) { return u + (u.indexOf('?') < 0 ? '?v=' : '&v=') + Date.now(); }

  // ---------- Tách cửa sổ (đa màn hình) ----------
  function setupDetachButton() {
    if (!opsDock) return;
    var oph = opsDock.querySelector('.oph'); if (!oph || d.getElementById('opsDetach')) return;
    var btn = d.createElement('button');
    btn.id = 'opsDetach'; btn.type = 'button'; btn.title = 'Tách ra cửa sổ riêng (đa màn hình)'; btn.textContent = '⧉';
    var closeBtn = d.getElementById('opsClose');
    oph.insertBefore(btn, closeBtn || null);
    btn.addEventListener('click', function () { if (H.active) H.detach(H.active); });
  }
  H.detach = function (id) {
    var m = H.byId[id]; if (!m || m.detachable === false) return;
    var url = m.detachUrl || m.url;
    var features = m.detachFeatures || 'width=1400,height=920';
    var ref = w.open(url, 'hht_' + id.replace(/\W/g, '_'), features);
    if (!ref) { console.warn('[modulehost] popup bị chặn cho ' + id); return; }
    H.detached[id] = ref;
    if (H.active === id) { H.active = null; closePanel(); markActive(null); }
    var t = setInterval(function () { if (ref.closed) { clearInterval(t); delete H.detached[id]; } }, 1500);
    // Ghi chú: đặt cửa sổ vào màn hình cụ thể (Window Management API) sẽ bổ sung ở bước sau,
    // có lui về window.open thường như hiện tại khi API không khả dụng / bị từ chối quyền.
  };

  // ---------- Bus đồng bộ 'hydronet' ----------
  function setupBus() {
    try { H._bc = new BroadcastChannel('hydronet'); H._bc.onmessage = function (ev) { onAnyMsg(ev && ev.data); }; }
    catch (e) { H._bc = null; }
    w.addEventListener('message', function (ev) { onAnyMsg(ev && ev.data); }, false);
  }
  function onAnyMsg(m) {
    if (!m || typeof m !== 'object') return;
    if (m.type === 'module:ready') {
      indexObjects(m.moduleId, m.objects || []);
      // Console vừa nạp xong -> nếu có lấy nét đang chờ cho ĐÚNG module này thì gửi bây giờ
      // (lúc select() gọi, iframe chưa nạp nên bus/postMessage cũ bị lỡ). (M-02)
      var pf = H._pendingFocus;
      if (pf && pf.mid === m.moduleId && frame && frame.contentWindow) {
        H._pendingFocus = null;
        try { frame.contentWindow.postMessage({ type: 'host:focus', ref: pf.ref }, '*'); } catch (e) {}
      }
    }
  }
  // Phân giải ref -> id module SỞ HỮU. ref = "{category}/{côngtrình}/{loại}/{mã}".
  // (1) module đã CÔNG BỐ ref (chỉ mục đối tượng) = chuẩn nhất;
  // (2) suy theo địa chỉ "{category}.{côngtrình}" (khớp đúng id: dam/ngantruoi -> dam.ngantruoi);
  // (3) lui về module đầu nhóm (hành vi cũ). (M-02: trước đây chỉ có (3) nên 2 đập cùng nhóm mở nhầm.)
  function ownerOf(ref) {
    var parts = String(ref).split('/'), cat = parts[0], i;
    for (i = 0; i < H.index.length; i++) { if (H.index[i].ref === ref) return H.index[i].mid; }
    if (parts[1] && H.byId[cat + '.' + parts[1]]) return cat + '.' + parts[1];
    var list = H.byCat[cat] || []; return list[0] ? list[0].id : null;
  }
  // API công khai để bản đồ / lớp GIS gọi: đưa hệ thống tới một đối tượng bất kỳ
  H.select = function (ref) {
    if (typeof ref !== 'string') return;
    var owner = ownerOf(ref);
    if (!owner) return;
    var willLoad = (H.active !== owner) && !H.detached[owner]; // frame sẽ nạp lại -> hoãn lấy nét
    H.openModule(owner); // mở ĐÚNG console phụ trách (không còn cố định module đầu nhóm)
    // Phát bus cho MỌI cửa sổ (kể cả bản đã tách đa màn hình); console tự lọc theo belongsHere.
    try { if (H._bc) H._bc.postMessage({ kind: 'select', ref: ref }); } catch (e) {}
    if (H.detached[owner]) return;                       // bản tách nhận qua bus, xong
    if (willLoad) { H._pendingFocus = { mid: owner, ref: ref }; return; } // chờ module:ready
    if (frame && frame.contentWindow) { try { frame.contentWindow.postMessage({ type: 'host:focus', ref: ref }, '*'); } catch (e) {} }
  };

  // ---------- Chỉ mục đối tượng + command palette ----------
  function indexObjects(mid, objs) {
    H.index = H.index.filter(function (o) { return o.mid !== mid; });
    objs.forEach(function (o) { H.index.push({ mid: mid, ref: o.ref, label: o.label || o.ref, kind: o.kind || '' }); });
  }
  function setupPalette() {
    d.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); togglePalette(); }
      else if (e.key === 'Escape') hidePalette();
    });
  }
  var pal;
  function ensurePal() {
    if (pal) return pal;
    pal = d.createElement('div'); pal.id = 'hhtPalette';
    pal.innerHTML =
      '<div class="pal-box"><input id="hhtPalInp" autocomplete="off" ' +
      'placeholder="Nhảy tới đối tượng… (cửa van, cảm biến, trạm, tháp)"><ul id="hhtPalList"></ul></div>';
    d.body.appendChild(pal);
    pal.addEventListener('mousedown', function (e) { if (e.target === pal) hidePalette(); });
    var inp = pal.querySelector('#hhtPalInp');
    inp.addEventListener('input', function () { renderPal(this.value); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { var f = pal.querySelector('.pal-item'); if (f) { H.select(f.getAttribute('data-ref')); hidePalette(); } }
    });
    return pal;
  }
  function togglePalette() { if (pal && pal.classList.contains('show')) hidePalette(); else showPalette(); }
  function showPalette() { ensurePal().classList.add('show'); var i = pal.querySelector('#hhtPalInp'); i.value = ''; renderPal(''); i.focus(); }
  function hidePalette() { if (pal) pal.classList.remove('show'); }
  function renderPal(q) {
    q = (q || '').toLowerCase();
    var items = H.index.filter(function (o) { return !q || (o.label + ' ' + o.ref).toLowerCase().indexOf(q) >= 0; }).slice(0, 50);
    var ul = pal.querySelector('#hhtPalList');
    ul.innerHTML = items.length
      ? items.map(function (o, i) {
          return '<li class="pal-item' + (i === 0 ? ' first' : '') + '" data-ref="' + esc(o.ref) + '">' +
                 '<b>' + esc(o.label) + '</b> <span class="pal-ref">' + esc(o.ref) + '</span></li>';
        }).join('')
      : '<li class="pal-empty">Chưa có đối tượng nào được module công bố. Mở một module để nạp danh mục.</li>';
    Array.prototype.forEach.call(ul.querySelectorAll('.pal-item'), function (li) {
      li.addEventListener('click', function () { H.select(li.getAttribute('data-ref')); hidePalette(); });
    });
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  // ---------- CSS bơm từ JS (giữ index.html gọn) ----------
  function injectCSS() {
    if (d.getElementById('hht-modulehost-css')) return;
    var s = d.createElement('style'); s.id = 'hht-modulehost-css';
    s.textContent = [
      '#opsRail{display:flex;flex-direction:column;gap:10px;padding:8px 6px;pointer-events:auto;align-self:center}',
      /* Nút NHÓM (Đập / Trạm thủy văn / Tháp báo lũ): tab dọc, chữ quay 180° đọc thoải mái */
      '#opsRail .ops-cbtn{writing-mode:vertical-rl;transform:rotate(180deg);appearance:none;border:0;cursor:pointer;padding:14px 8px;border-radius:9px 0 0 9px;background:var(--surface,#fff);color:var(--ink,#1b2a3a);font:800 12px/1 var(--font-head,sans-serif);letter-spacing:.05em;box-shadow:0 6px 18px rgba(0,0,0,.18);transition:.18s}',
      '#opsRail .ops-cbtn:hover{background:var(--azure,#1f93e3);color:#fff}',
      '#opsRail .ops-cbtn.on,#opsRail .ops-cbtn.open{background:var(--azure,#1f93e3);color:#fff}',
      /* Menu thả xuống chọn công trình — chữ NGANG đọc bình thường */
      '.ops-catmenu{position:fixed;z-index:6100;min-width:186px;max-width:300px;background:var(--surface,#fff);border:1px solid var(--line2,#e6ebf1);border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.34);padding:6px}',
      '.ops-catmenu .ops-cm-hd{font:800 10px/1 var(--font-head,sans-serif);letter-spacing:.08em;text-transform:uppercase;color:var(--azure,#1f93e3);padding:7px 10px 6px}',
      '.ops-catmenu .ops-cm-it{display:block;width:100%;text-align:left;appearance:none;border:0;background:transparent;cursor:pointer;padding:9px 11px;border-radius:8px;font:600 13px/1.15 var(--font-head,sans-serif);color:var(--ink,#1b2a3a)}',
      '.ops-catmenu .ops-cm-it:hover{background:rgba(31,147,227,.12)}',
      '.ops-catmenu .ops-cm-it.on{background:var(--azure,#1f93e3);color:#fff}',
      '.ops-catmenu .ops-cm-empty{padding:9px 11px;color:var(--slate,#7a8aa0);font-size:12px}',
      '#opsDetach{appearance:none;border:0;background:transparent;color:var(--slate,#7a8aa0);font-size:16px;line-height:1;cursor:pointer;padding:2px 8px;border-radius:6px}',
      '#opsDetach:hover{background:rgba(0,0,0,.06);color:var(--ink,#1b2a3a)}',
      '#hhtPalette{position:fixed;inset:0;z-index:6000;display:none;background:rgba(12,20,30,.42);backdrop-filter:blur(2px)}',
      '#hhtPalette.show{display:block}',
      '#hhtPalette .pal-box{max-width:620px;margin:10vh auto 0;background:var(--surface,#fff);border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.4);overflow:hidden}',
      '#hhtPalette #hhtPalInp{width:100%;box-sizing:border-box;border:0;outline:0;padding:16px 18px;font:500 15px/1.2 var(--font-head,sans-serif);color:var(--ink,#1b2a3a);border-bottom:1px solid var(--line2,#e6ebf1)}',
      '#hhtPalette #hhtPalList{list-style:none;margin:0;padding:6px;max-height:52vh;overflow:auto}',
      '#hhtPalette .pal-item{padding:9px 12px;border-radius:9px;cursor:pointer;display:flex;align-items:baseline;gap:10px}',
      '#hhtPalette .pal-item:hover,#hhtPalette .pal-item.first{background:rgba(31,147,227,.12)}',
      '#hhtPalette .pal-item b{color:var(--ink,#1b2a3a);font-weight:600}',
      '#hhtPalette .pal-ref{color:var(--slate,#7a8aa0);font:400 11px/1 ui-monospace,monospace;margin-left:auto}',
      '#hhtPalette .pal-empty{padding:14px;color:var(--slate,#7a8aa0);font-size:13px}'
    ].join('\n');
    d.head.appendChild(s);
  }

  w.HHTHost = H;
  if (d.readyState !== 'loading') H.init();
  else d.addEventListener('DOMContentLoaded', function () { H.init(); });
})(window, document);
/* HHT-MODULEHOST v0.2.0 — rail 2 TẦNG (mở rộng được): 3 nút NHÓM Đập/Trạm thủy văn/Tháp báo lũ (tab dọc),
   bấm nhóm -> menu thả xuống liệt kê CÔNG TRÌNH (chữ ngang, đọc bình thường) -> chọn mở console.
   Kèm M-02: select() phân giải ref -> đúng console + hoãn host:focus tới module:ready. */
