/* hht-chart-fullscreen.js — Nút PHÓNG TO cho đồ thị chính (#chart)
 * HNT HydroNet · viewer · dùng chung cho console đập / console trạm / console tháp
 * ---------------------------------------------------------------------------
 * Vì sao có file này: đồ thị hydrograph nằm trong băng phải hoặc cửa sổ nhỏ thì khó đọc.
 * Nút ⛶ ở góc phải đồ thị cho xem toàn màn hình khi cần, bấm lại (hoặc Esc) là về chỗ cũ.
 *
 * Cách chạy:
 *   1) Ưu tiên Fullscreen API thật (tràn cả màn hình, kể cả khi console nằm trong iframe —
 *      với điều kiện iframe có allowfullscreen; tower-layer.js gắn thuộc tính này lúc chạy).
 *   2) Trình duyệt/khung chặn fullscreen → TỰ LÙI về phóng to phủ kín khung hiện tại
 *      (overlay position:fixed) — vẫn to hơn nhiều so với ô đồ thị gốc.
 *
 * KHÔNG sao chép đồ thị: node <svg id="chart"> gốc được DI CHUYỂN vào khung phóng to rồi
 * trả về đúng chỗ khi thoát ⇒ mọi hàm vẽ tìm theo id vẫn chạy, số liệu vẫn cập nhật khi đang phóng to.
 * Chú giải (.legend) và băng cảnh báo (.qcbanner) đi kèm cũng được mượn tạm theo, trả lại nguyên vị trí.
 */
(function () {
  "use strict";

  var CHART_ID = "chart";
  var COMPANION = ".legend, .qcbanner";     // các khối đi kèm đồ thị, mượn tạm khi phóng to

  var STYLE =
    '.hht-fswrap{position:relative}' +
    '.hht-fsbtn{position:absolute;top:6px;right:6px;z-index:6;display:inline-flex;align-items:center;justify-content:center;' +
      'width:28px;height:28px;padding:0;border:1px solid rgba(255,255,255,.14);border-radius:8px;' +
      'background:rgba(16,22,29,.62);color:#c9d1d9;cursor:pointer;opacity:.42;' +
      'transition:opacity .15s,border-color .15s,background .15s,color .15s}' +
    '.hht-fswrap:hover>.hht-fsbtn{opacity:1}' +
    '.hht-fsbtn:hover{background:rgba(16,22,29,.92);border-color:#3d9be0;color:#fff}' +
    '.hht-fsbtn:focus-visible{opacity:1;outline:none;border-color:#3d9be0;box-shadow:0 0 0 2px rgba(61,155,224,.22)}' +
    '.hht-fsbtn svg{width:15px;height:15px;display:block;pointer-events:none}' +
    /* trạng thái phóng to — dùng chung cho fullscreen thật và bản dự phòng.
       padding-top chừa một dải cho nút thoát, khỏi đè lên tên trục của đồ thị. */
    '.hht-fswrap.hht-fson{background:#0d1218;display:flex;flex-direction:column;gap:8px;padding:44px 16px 14px;box-sizing:border-box}' +
    '.hht-fswrap.hht-fsfake{position:fixed;inset:0;z-index:99990;margin:0;border-radius:0}' +
    '.hht-fswrap.hht-fson>.hht-fsbtn{top:10px;right:14px;opacity:1}' +
    '.hht-fswrap.hht-fson>svg,.hht-fswrap.hht-fson>.chartbox{flex:1 1 auto;min-height:0;width:100%;height:auto}' +
    '.hht-fswrap.hht-fson>.chartbox{overflow:auto}' +
    '.hht-fswrap.hht-fson>.chartbox>svg{width:100%;height:100%}' +
    '.hht-fswrap.hht-fson>svg{height:100%}' +
    '.hht-fswrap.hht-fson>.legend,.hht-fswrap.hht-fson>.qcbanner{flex:none}' +
    /* khung cao-hẹp (băng phải, màn dọc): đồ thị 2:1 nếu ép vừa bề ngang sẽ thành một dải bé xíu
       giữa hai vùng đen. Cho nó CAO HẾT KHUNG rồi vuốt ngang để xem — to và đọc được. */
    '.hht-fswrap.hht-fson.hht-fsport{overflow:auto}' +
    '.hht-fswrap.hht-fson.hht-fsport>svg,.hht-fswrap.hht-fson.hht-fsport>.chartbox>svg{height:100%;width:auto;max-width:none}' +
    /* svg là con TRỰC TIẾP của khung flex-column ⇒ mặc định bị kéo rộng bằng khung (align stretch);
       phải cho tự co theo nội dung thì width:auto mới có tác dụng. */
    '.hht-fswrap.hht-fson.hht-fsport>svg{align-self:flex-start;flex:1 1 auto;min-height:0}' +
    '.hht-fswrap.hht-fson.hht-fsport>.chartbox{overflow:auto}' +
    '';   /* 19/08: bỏ dòng gợi ý "Vuốt ngang…" — xem ghi chú ở chỗ dựng phần tử. */

  var ICO_IN  = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">' +
                '<path d="M6 2H2v4M14 6V2h-4M10 14h4v-4M2 10v4h4"/></svg>';
  var ICO_OUT = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">' +
                '<path d="M2 6h4V2M14 6h-4V2M14 10h-4v4M2 10h4v4"/></svg>';

  var wrap = null, btn = null, borrowed = [], fake = false;

  function injectStyle() {
    if (document.getElementById("hht-fs-css")) return;
    var st = document.createElement("style");
    st.id = "hht-fs-css"; st.textContent = STYLE;
    document.head.appendChild(st);
  }

  /* mượn tạm chú giải / băng cảnh báo đứng SAU đồ thị (cùng cha) — có nút đánh dấu để trả đúng chỗ */
  function borrow(base) {
    var par = base.parentNode; if (!par) return;
    var after = false;
    Array.prototype.slice.call(par.children).forEach(function (n) {
      if (n === base) { after = true; return; }
      if (!after || n === wrap || n === btn) return;
      if (!n.matches || !n.matches(COMPANION)) return;
      var ph = document.createComment("hht-fs");
      par.insertBefore(ph, n);
      wrap.appendChild(n);
      borrowed.push([n, ph]);
    });
  }
  function giveBack() {
    borrowed.forEach(function (p) {
      var n = p[0], ph = p[1];
      if (ph.parentNode) { ph.parentNode.insertBefore(n, ph); ph.parentNode.removeChild(ph); }
    });
    borrowed = [];
  }

  function fsElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }
  function canFullscreen() {
    // trong iframe KHÔNG có allowfullscreen thì fullscreenEnabled = false → dùng bản dự phòng
    return !!(wrap.requestFullscreen || wrap.webkitRequestFullscreen) &&
           (document.fullscreenEnabled !== false);
  }

  /* khung cao-hẹp so với tỉ lệ đồ thị → chuyển sang chế độ "cao hết khung + vuốt ngang" */
  function syncPortrait() {
    var svg = document.getElementById(CHART_ID);
    if (!svg || !wrap.classList.contains("hht-fson")) return;
    var vb = svg.viewBox && svg.viewBox.baseVal, r = wrap.getBoundingClientRect();
    if (!vb || !vb.width || !vb.height || !r.height) return;
    var need = vb.width / vb.height;                 // tỉ lệ đồ thị (vd 1200/600 = 2,0)
    var have = r.width / Math.max(1, r.height - 70); // tỉ lệ vùng vẽ còn lại (trừ dải nút + chú giải)
    wrap.classList.toggle("hht-fsport", have < need * 0.8);
  }

  function paint(on) {
    wrap.classList.toggle("hht-fson", on);
    wrap.classList.toggle("hht-fsfake", on && fake);
    if (!on) wrap.classList.remove("hht-fsport"); else syncPortrait();
    btn.innerHTML = on ? ICO_OUT : ICO_IN;
    btn.title = on ? "Thu nhỏ (Esc)" : "Phóng to đồ thị";
    btn.setAttribute("aria-label", btn.title);
    // báo cho mã vẽ biết khung đổi cỡ (đồ thị dùng viewBox nên chỉ để chắc chắn)
    try { window.dispatchEvent(new Event("resize")); } catch (e) {}
  }

  function enter() {
    borrow(wrap);                                                // mượn các khối đi kèm đứng sau khung bọc
    if (canFullscreen()) {
      fake = false;
      var req = wrap.requestFullscreen || wrap.webkitRequestFullscreen;
      var r;
      try { r = req.call(wrap); } catch (e) { r = null; }
      if (r && r.catch) { r.then(function () { paint(true); }).catch(function () { fake = true; paint(true); }); return; }
      if (fsElement()) { paint(true); return; }
      fake = true; paint(true); return;                          // gọi được nhưng khung chặn
    }
    fake = true; paint(true);
  }

  function exit() {
    if (fsElement()) {
      try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) {}
      return;                                                    // fullscreenchange sẽ dọn nốt
    }
    fake = false; paint(false); giveBack();
  }

  function toggle() { (wrap.classList.contains("hht-fson") ? exit : enter)(); }

  function onFsChange() {
    if (fsElement() === wrap) { fake = false; paint(true); }
    else if (!fake) { paint(false); giveBack(); }
  }

  function init() {
    var svg = document.getElementById(CHART_ID);
    if (!svg || document.querySelector(".hht-fswrap")) return;
    injectStyle();

    // khung bọc: nếu đồ thị đã nằm trong .chartbox riêng thì bọc cả .chartbox
    var base = (svg.parentNode && svg.parentNode.classList && svg.parentNode.classList.contains("chartbox"))
      ? svg.parentNode : svg;

    wrap = document.createElement("div");
    wrap.className = "hht-fswrap";
    base.parentNode.insertBefore(wrap, base);
    wrap.appendChild(base);

    btn = document.createElement("button");
    btn.type = "button"; btn.className = "hht-fsbtn"; btn.innerHTML = ICO_IN;
    btn.title = "Phóng to đồ thị"; btn.setAttribute("aria-label", "Phóng to đồ thị");
    btn.addEventListener("click", function (e) { e.preventDefault(); toggle(); });
    wrap.appendChild(btn);

    /* 19/08 (Tuấn): BỎ dòng "Vuốt ngang để xem hết đồ thị". Nó chỉ hiện ở chế độ toàn
       màn hình dọc, nhưng người dùng gặp nó mà không hiểu từ đâu ra. Thao tác vuốt là
       bản năng trên màn hình cảm ứng, không cần dạy. */

    window.addEventListener("resize", syncPortrait);

    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && fake && wrap.classList.contains("hht-fson")) exit();
    });

    window.HHTChartFS = { toggle: toggle, enter: enter, exit: exit, el: function () { return wrap; } };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
