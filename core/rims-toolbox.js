/* ═══════════════════════════════════════════════════════════════════════
   RIMS — BỘ CÔNG CỤ (toolbox)
   ------------------------------------------------------------------------
   Công cụ = CHỨC NĂNG PHÂN TÍCH / TÍNH TOÁN của RIMS (QC trạm mưa, QC mô
   hình, vẽ đẳng trị mưa…), KHÁC hẳn "lớp dữ liệu". Vì vậy nó là một tab
   riêng trên rail trái, không nằm trong menu Lớp GIS / Khí tượng.

   THIẾT KẾ (RIMS-33/34, anh Tuấn duyệt 08/9/2026)
     · Tab "Công cụ" trên rail → panel trái thành LAUNCHER lưới biểu tượng,
       nhóm theo THỂ LOẠI. Bấm tool → chạy NGAY trong panel, nút "‹ Công cụ".
     · Kết quả tool (cờ QC, isohyet…) vẽ thành LỚP RIÊNG trên bản đồ — không
       nhét vào menu Lớp dữ liệu; rời tool vẫn GIỮ lớp, chip gỡ ở đầu launcher.

   RANH GIỚI QC (RIMS-34): engine WeatherPlus = RainLab API
   `/v1/stations/classify` TÍNH TOÀN BỘ QC (rule-check + buddy hàng xóm + đối
   chứng radar) và trả 6 lớp trạm. RIMS chỉ: chọn PHẠM VI → gọi (proxy
   same-origin /api/rainlab/*) → hiển thị. Định danh trạm hai bên TRÙNG nhau.
   Không lưu lịch sử (anh Tuấn chốt: chưa cần truy vết).

   MỞ RỘNG: thêm tool = thêm 1 dòng vào NHOM/TOOL + đăng ký ruột bằng
   window.RIMS_dangKyTool('id', fn(el,ctx)). Chưa nối ruột thì mở khung chờ.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var IC = {
    tool: '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.3 2.3-2-2 2.3-2.3z"/></svg>',
    qc:   '<svg viewBox="0 0 24 24"><path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></svg>',
    mua:  '<svg viewBox="0 0 24 24"><path d="M7 16a4 4 0 1 1 1-7.9A5 5 0 0 1 18 9a3.5 3.5 0 0 1-.5 7"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/></svg>',
    iso:  '<svg viewBox="0 0 24 24"><path d="M3 7c4-3 6 3 10 0s4-3 8 0M3 13c4-3 6 3 10 0s4-3 8 0M3 19c4-3 6 3 10 0s4-3 8 0"/></svg>',
    ho:   '<svg viewBox="0 0 24 24"><path d="M4 14c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2"/><path d="M5 10V5h6l2 3h6v6"/></svg>',
    model:'<svg viewBox="0 0 24 24"><path d="M4 19V5M4 19h16"/><path d="M7 15l3-4 3 3 4-6"/></svg>',
    warn: '<svg viewBox="0 0 24 24"><path d="M12 3l9 16H3l9-16z"/><path d="M12 10v4M12 17h.01"/></svg>',
    flow: '<svg viewBox="0 0 24 24"><path d="M3 6h6l3 6 3-6h6"/><path d="M6 18h12"/></svg>',
    rp:   '<svg viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h4"/></svg>',
    stat: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>'
  };

  var NHOM = [
    { id: 'qc',  ten: 'Kiểm định chất lượng' },
    { id: 'mua', ten: 'Phân tích nguồn nước' },
    { id: 'ho',  ten: 'Vận hành hồ chứa' },
    { id: 'db',  ten: 'Dự báo & cảnh báo' },
    { id: 'htdbv', ten: 'Hỗ trợ dự báo viên' }
  ];

  var TOOL = [
    { id:'qc_mua',   nhom:'qc',  ten:'QC trạm đo mưa',        ic:IC.qc,    tt:'san_sang', mo:'Gắn cờ chất lượng cho mạng trạm mưa (6 lớp) theo thời gian thực, dùng engine RainLab của WeatherPlus.' },
    { id:'qc_tv',    nhom:'qc',  ten:'QC trạm thuỷ văn',      ic:IC.qc,    tt:'sap_co',   mo:'Kiểm định 17 trạm thuỷ văn của mạng RMA.' },
    { id:'qc_model', nhom:'qc',  ten:'QC mô hình dự báo',     ic:IC.model, tt:'sap_co',   mo:'Đối chứng dự báo với quan trắc, tính sai số theo trạm/vùng.' },
    { id:'iso',      nhom:'mua', ten:'Vẽ đường đẳng trị mưa', ic:IC.iso,   tt:'san_sang', mo:'Nội suy trường mưa từ trạm và vẽ đường đẳng trị (isohyet) theo cửa sổ thời gian.' },
    { id:'mua_lv',   nhom:'mua', ten:'Mưa bình quân',         ic:IC.mua,   tt:'san_sang', mo:'Mưa bình quân diện tích (mm) cho lưu vực hoặc vùng hành chính (vùng/tỉnh/xã), Thiessen/IDW; chuỗi ngày/tháng/năm, QC động.' },
    { id:'mua_tk',   nhom:'mua', ten:'Sử dụng nước',          ic:IC.stat,  tt:'san_sang', mo:'Tổng lượng vào hồ, lượng sử dụng (phát điện + tưới), lượng xả theo ngày/tháng/năm — đọc dữ liệu vận hành từ HNT tại hồ.' },
    { id:'canbang',  nhom:'ho',  ten:'Cân bằng nước hồ',      ic:IC.ho,    tt:'sap_co',   mo:'Cân bằng đến – xả – trữ theo từng hồ.' },
    { id:'xa_lu',    nhom:'ho',  ten:'Kịch bản xả lũ',        ic:IC.flow,  tt:'sap_co',   mo:'Dựng kịch bản xả theo quy trình vận hành liên hồ.' },
    { id:'dientoan', nhom:'ho',  ten:'Diễn toán dòng chảy',   ic:IC.flow,  tt:'sap_co',   mo:'Diễn toán lũ về hạ du.' },
    { id:'sosanh',   nhom:'db',  ten:'Dự báo mưa-dòng chảy',  ic:IC.model, tt:'san_sang', mo:'Tổng mưa 3 ngày qua + dự báo 3 ngày tới, tìm đỉnh lũ 6 ngày và xếp hạng hồ có lũ.' },
    { id:'canhbao',  nhom:'db',  ten:'Đánh giá rủi ro',       ic:IC.warn,  tt:'sap_co',   mo:'Đánh giá rủi ro vận hành và độ tin cậy (mưa, Q đến, kết quả mô hình); xếp hạng phương án.' },
    { id:'dbkt',     nhom:'htdbv', ten:'Dự báo khí tượng',    ic:IC.mua,   tt:'san_sang', mo:'Phân tích hình thế thời tiết — mở cửa sổ riêng.' },
    { id:'dbtv',     nhom:'htdbv', ten:'Dự báo thủy văn',     ic:IC.flow,  tt:'sap_co',   mo:'Hỗ trợ dự báo viên lập bản tin dự báo thủy văn.' },
    { id:'baocao',   nhom:'htdbv', ten:'Báo cáo',           ic:IC.rp,    tt:'sap_co',   mo:'Lập bản tin nhanh/đột xuất, báo cáo ngày/tuần/tháng/mùa và báo cáo kịch bản; xuất Word/PDF/Excel.' }
  ];

  var MOUNTS = {};
  window.RIMS_dangKyTool = function (id, mountFn) { MOUNTS[id] = mountFn; };

  /* Lớp KẾT QUẢ đang bật trên bản đồ (giữ khi rời tool). */
  var KETQUA = [];
  window.RIMS_toolKetQua = {
    them: function (toolId, ten, huy) {
      this.xoa(toolId);   /* dọn LỚP cũ (gọi huy) trước khi vẽ lớp mới — tránh chồng marker khi bật/tắt loại */
      KETQUA.push({ id: toolId, ten: ten, huy: huy || function () {} });
      capNhatChip();
    },
    xoa: function (toolId, khongDon) {
      for (var i = KETQUA.length - 1; i >= 0; i--) {
        if (KETQUA[i].id === toolId) {
          if (!khongDon) { try { KETQUA[i].huy(); } catch (e) {} }
          KETQUA.splice(i, 1);
        }
      }
      capNhatChip();
    },
    danhSach: function () { return KETQUA.slice(); }
  };

  /* ── CSS (module tự mang) ── */
  var css = ''
    + '#panel section[data-panel="tool"] .p-title{display:flex;align-items:center;gap:8px}'
    + '.tbx-back{display:inline-flex;align-items:center;gap:4px;background:none;border:1px solid var(--line);color:var(--txt2);border-radius:7px;padding:3px 8px;cursor:pointer;font:inherit;font-size:11.5px}'
    + '.tbx-back:hover{border-color:var(--tealL);color:var(--txt)}'
    + '.tbx-ttl{font-weight:700;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.tbx-active{margin:2px 0 6px}'
    + '.tbx-active .row{display:flex;align-items:center;gap:7px;margin-bottom:5px;padding:6px 9px;border-radius:8px;background:rgba(46,140,143,.14);border:1px solid var(--teal);color:#B8E0E1;font-size:11px;font-weight:600}'
    + '.tbx-active .row .nm{flex:1;line-height:1.3}'
    + '.tbx-active .row .x{flex:none;cursor:pointer;width:17px;height:17px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid rgba(184,224,225,.4)}'
    + '.tbx-active .row .x:hover{background:rgba(255,255,255,.1);color:#fff}'
    + '.tbx-grp{font-size:10.5px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:var(--txt3);margin:14px 0 7px}'
    + '.tbx-grp:first-child{margin-top:2px}'
    + '.tbx-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}'
    + '.tbx-tool{display:flex;flex-direction:column;align-items:center;gap:7px;padding:12px 6px;border:1px solid var(--line);border-radius:10px;background:var(--ink3);cursor:pointer;text-align:center;transition:.13s;position:relative}'
    + '.tbx-tool:hover{border-color:var(--tealL);transform:translateY(-1px)}'
    + '.tbx-tool .ic{width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(46,140,143,.15)}'
    + '.tbx-tool .ic svg{width:19px;height:19px;fill:none;stroke:var(--tealL);stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}'
    + '.tbx-tool .nm{font-size:11px;font-weight:600;line-height:1.25;color:var(--txt)}'
    + '.tbx-tool.sapco{cursor:default;opacity:.55}'
    + '.tbx-tool.sapco:hover{border-color:var(--line);transform:none}'
    + '.tbx-tool.sapco .ic{background:rgba(255,255,255,.05)}'
    + '.tbx-tool.sapco .ic svg{stroke:var(--txt3)}'
    + '.tbx-tool .badge{position:absolute;top:6px;right:6px;font-size:8px;font-weight:700;letter-spacing:.4px;color:var(--txt3);border:1px solid var(--line);border-radius:10px;padding:1px 5px;background:var(--ink2)}'
    + '.tbx-mota{font-size:11.5px;color:var(--txt3);line-height:1.55;margin:2px 0 10px;border-left:2px solid var(--line);padding-left:9px}'
    + '.tbx-fld{margin:11px 0}'
    + '.tbx-fld label{display:block;font-size:11px;color:var(--txt2);margin-bottom:4px;font-weight:600}'
    + '.tbx-fld select,.tbx-fld input{width:100%;padding:6px 9px;border-radius:7px;border:1px solid var(--line);background:var(--ink);color:var(--txt);outline:none}'
    + '.tbx-fld select:focus,.tbx-fld input:focus{border-color:var(--tealL)}'
    + '.tbx-two{display:flex;gap:8px}'
    + '.tbx-run{width:100%;margin-top:6px;padding:9px;border-radius:8px;border:0;background:var(--teal);color:#fff;font-weight:700;cursor:pointer}'
    + '.tbx-run:hover{background:var(--tealL)}'
    + '.tbx-run:disabled{opacity:.6;cursor:default}'
    + '.tbx-xrow{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}'
    + '.tbx-xbtn{flex:1 1 40%;padding:7px 8px;font-weight:600;font-size:12px;border:1px solid var(--line);background:var(--ink3);color:var(--txt2);border-radius:7px;cursor:pointer;white-space:nowrap;transition:.13s}'
    + '.tbx-xbtn:hover{border-color:var(--tealL);color:var(--txt)}'
    + '.tbx-hint{color:var(--txt3);font-size:11px;line-height:1.5;margin-top:10px}'
    + '.tbx-flag{border-left:2px solid var(--silt);background:rgba(200,129,63,.09);padding:7px 9px;border-radius:0 6px 6px 0;color:#E4C39C;font-size:11.5px;line-height:1.5;margin-top:10px}'
    + '.tbx-err{border-left:2px solid var(--crit);background:rgba(196,69,63,.10);padding:7px 9px;border-radius:0 6px 6px 0;color:#E79892;font-size:11.5px;line-height:1.5;margin-top:10px}'
    + '.tbx-sep{height:1px;background:var(--line);margin:14px 0}'
    + '.tbx-resHd{font-size:10.5px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:var(--txt3);margin:2px 0 8px}'
    + '.tbx-leg .r{display:flex;align-items:center;gap:8px;padding:5px 2px;border-top:1px solid var(--line);font-size:12px;cursor:pointer;user-select:none;border-radius:5px}'
    + '.tbx-leg .r:hover{background:rgba(255,255,255,.05)}'
    + '.tbx-leg .r.off{opacity:.4}'
    + '.tbx-leg .r:first-child{border-top:0}'
    + '.tbx-leg .sw{width:11px;height:11px;border-radius:50%;flex:none;box-shadow:0 0 0 2px rgba(0,0,0,.25)}'
    + '.tbx-leg .nm{flex:1;color:var(--txt2)}'
    + '.tbx-leg .v{font-weight:800;font-variant-numeric:tabular-nums}'
    + '.rl-pop{font-family:inherit;min-width:170px}'
    + '.rl-pop b{font-size:13px}'
    + '.rl-pop .cl{display:inline-block;margin:3px 0 6px;padding:1px 7px;border-radius:20px;font-size:11px;font-weight:700;color:#0E1A1E}'
    + '.rl-pop table{border-collapse:collapse;font-size:11px}'
    + '.rl-pop td{padding:1px 0;vertical-align:top}'
    + '.rl-pop td.k{color:#9aa1a9;padding-right:9px;white-space:nowrap}'
    + '.rl-pop .fl{margin-top:5px;color:#E4C39C;font-size:10.5px;line-height:1.4}';
  var st = document.createElement('style');
  st.id = 'rims-toolbox-css';
  st.textContent = css;
  document.head.appendChild(st);

  function sec() { return document.querySelector('#panel section[data-panel="tool"]'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; }); }

  /* ── LAUNCHER ── */
  function veLauncher() {
    qcClearSel();
    var s = sec(); if (!s) return;
    var html = '<div class="p-title">Công cụ</div><div class="p-body">';
    html += '<div class="tbx-active" id="tbxActive"></div>';
    NHOM.forEach(function (g) {
      var ds = TOOL.filter(function (t) { return t.nhom === g.id; });
      if (!ds.length) return;
      html += '<div class="tbx-grp">' + esc(g.ten) + '</div><div class="tbx-grid">';
      ds.forEach(function (t) {
        var sc = t.tt === 'sap_co';
        html += '<div class="tbx-tool' + (sc ? ' sapco' : '') + '" data-tool="' + t.id + '" title="' + esc(t.mo) + '">'
              + (sc ? '<span class="badge">SẮP CÓ</span>' : '')
              + '<div class="ic">' + t.ic + '</div><div class="nm">' + esc(t.ten) + '</div></div>';
      });
      html += '</div>';
    });
    html += '</div>';
    s.innerHTML = html;
    s.querySelectorAll('.tbx-tool[data-tool]').forEach(function (el) {
      var t = TOOL.filter(function (x) { return x.id === el.dataset.tool; })[0];
      if (!t || t.tt === 'sap_co') return;
      el.addEventListener('click', function () { moTool(t); });
    });
    capNhatChip();
  }

  function capNhatChip() {
    var box = document.getElementById('tbxActive');
    if (!box) return;
    if (!KETQUA.length) { box.innerHTML = ''; return; }
    box.innerHTML = KETQUA.map(function (k) {
      return '<div class="row"><span class="nm">Kết quả: ' + esc(k.ten) + '</span>'
           + '<span class="x" data-x="' + esc(k.id) + '" title="Gỡ kết quả khỏi bản đồ">✕</span></div>';
    }).join('');
    box.querySelectorAll('.x[data-x]').forEach(function (x) {
      x.addEventListener('click', function () { window.RIMS_toolKetQua.xoa(x.dataset.x); });
    });
  }

  function khungTool(t) {
    var s = sec(); if (!s) return null;
    s.innerHTML = '<div class="p-title"><button class="tbx-back" id="tbxBack">‹ Công cụ</button>'
                + '<span class="tbx-ttl">' + esc(t.ten) + '</span></div>'
                + '<div class="p-body" id="tbxBody"></div>';
    document.getElementById('tbxBack').addEventListener('click', veLauncher);
    return document.getElementById('tbxBody');
  }

  function ctx() {
    return {
      map: function () { return window.HYDRO_MAP || null; },
      scope: (typeof window.RIMS_scopeState === 'function') ? window.RIMS_scopeState() : null,
      ketQua: window.RIMS_toolKetQua,
      quayLai: veLauncher
    };
  }
  function moTool(t) {
    qcClearSel();
    var body = khungTool(t); if (!body) return;
    if (MOUNTS[t.id]) { try { MOUNTS[t.id](body, ctx()); return; } catch (e) { console.warn('[toolbox]', t.id, e); } }
    khungMacDinh(body, t);
  }
  function khungMacDinh(body, t) {
    body.innerHTML = '<div class="tbx-mota">' + esc(t.mo) + '</div>'
      + '<div class="tbx-flag">Công cụ này đang được xây dựng. Khung đã sẵn — ruột tính toán sẽ nối sau.</div>';
  }

  /* ===== DEMO HTDBV — GỠ KHI CẦN =====
     Trình diễn cho cục. Mở cửa sổ rời modules/_demo_dubaokt/index.html.
     Gỡ: xoá khối này + thư mục modules/_demo_dubaokt/. */
  window.RIMS_dangKyTool('dbkt', function (el, c) {
    var url = 'modules/_demo_dubaokt/index.html', feat = 'width=1500,height=950';
    el.innerHTML =
      '<div class="tbx-mota">Phân tích hình thế thời tiết cho dự báo viên.</div>'
      + '<button class="tbx-run" id="dbktOpen">Mở cửa sổ phân tích</button>'
      + '<div class="tbx-hint">Bản trình diễn · dữ liệu synop mẫu.</div>';
    el.querySelector('#dbktOpen').addEventListener('click', function () {
      window.open(url, 'rims_dbkt', feat);
    });
  });
  /* ===== HẾT DEMO HTDBV ===== */

  /* ═══════════ HÌNH HỌC: bbox + điểm-trong-đa-giác (lọc phạm vi) ═══════════ */
  function bboxGeom(geom) {
    var mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
    function quet(a) {
      if (typeof a[0] === 'number') { if (a[0]<mnx)mnx=a[0]; if(a[0]>mxx)mxx=a[0]; if(a[1]<mny)mny=a[1]; if(a[1]>mxy)mxy=a[1]; return; }
      for (var i=0;i<a.length;i++) quet(a[i]);
    }
    quet(geom.coordinates);
    return [mnx, mny, mxx, mxy];
  }
  function pipRing(x, y, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      var cat = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi);
      if (cat) inside = !inside;
    }
    return inside;
  }
  function pipPoly(x, y, poly) {            // poly = [outer, hole1, ...]
    if (!poly.length || !pipRing(x, y, poly[0])) return false;
    for (var h = 1; h < poly.length; h++) if (pipRing(x, y, poly[h])) return false;
    return true;
  }
  function pipGeom(x, y, geom) {
    if (geom.type === 'Polygon') return pipPoly(x, y, geom.coordinates);
    if (geom.type === 'MultiPolygon') {
      for (var k = 0; k < geom.coordinates.length; k++) if (pipPoly(x, y, geom.coordinates[k])) return true;
      return false;
    }
    return false;
  }

  /* ═══════════ MÀU + NHÃN 6 LỚP QC ═══════════ */
  var QC_MAU = { hoa_thach:'#4A5A62', chet:'#8794A0', bat_thuong:'#C4453F', tac:'#E0A53A', lech_nhip:'#7C6FD6', binh_thuong:'#3E9E6B' };
  var QC_TEN = { hoa_thach:'Ngừng hoạt động (>30 ngày)', chet:'Gián đoạn', bat_thuong:'Mưa lớn bất thường', tac:'Nghi ngờ tắc', lech_nhip:'Sai lệch thời gian', binh_thuong:'Bình thường' };
  var QC_THUTU = ['chet','tac','bat_thuong','lech_nhip','hoa_thach','binh_thuong'];

  /* ═══════════════════════ RUỘT: QC TRẠM ĐO MƯA ═══════════════════════ */
  var TINH_CACHE = null;    // FeatureCollection tỉnh (nạp khi cần)
  var LV_CACHE = null;      // FeatureCollection lưu vực 763 (nạp khi cần)
  var QC_SEL = { off: null, hl: null, map: null, pick: null };   // chế độ chọn lưu vực bằng bấm bản đồ

  window.RIMS_dangKyTool('qc_mua', function (el, c) {
    el.innerHTML =
      '<div class="tbx-fld"><label>Cửa sổ thời gian</label><select id="qcWin">'
        + '<option value="3">3 ngày</option><option value="7" selected>7 ngày</option>'
        + '<option value="14">14 ngày</option><option value="28">28 ngày (đủ để bắt "lệch pha")</option>'
      + '</select></div>'
      + '<div class="tbx-fld"><label>Phạm vi</label><select id="qcScope">'
        + '<option value="toanquoc">Toàn quốc</option>'
        + '<option value="luuvuc">Theo lưu vực (bấm bản đồ)</option>'
        + '<option value="tinh">Theo tỉnh…</option>'
        + '<option value="khungnhin">Trong khung nhìn</option>'
      + '</select></div>'
      + '<div id="qcScopeSub"></div>'
      + '<div class="tbx-fld"><label>Hiển thị</label><select id="qcLoc">'
        + '<option value="all">Tất cả trạm</option>'
        + '<option value="probs">Chỉ trạm có vấn đề (chết · tắc · bất thường · lệch pha)</option>'
      + '</select></div>'
      + '<button class="tbx-run" id="qcRun">Chạy kiểm định</button>'
      + '<div id="qcOut"></div>';

    var subBox = el.querySelector('#qcScopeSub');
    el.querySelector('#qcScope').addEventListener('change', function (e) {
      qcClearSel();               // gỡ chế độ chọn lưu vực cũ (nếu có)
      el._lvChon = null;
      if (e.target.value === 'tinh') { subBox.innerHTML = ''; dungChonTinh(subBox); }
      else if (e.target.value === 'luuvuc') batChonLuuVuc(subBox, el, c);
      else subBox.innerHTML = '';
    });
    el.querySelector('#qcRun').addEventListener('click', function () { chayQc(el, c); });
  });

  function dungChonTinh(subBox) {
    subBox.innerHTML = '<div class="tbx-fld"><label>Chọn tỉnh</label><select id="qcTinh"><option>Đang nạp danh sách tỉnh…</option></select></div>';
    napTinh().then(function (fc) {
      var sel = subBox.querySelector('#qcTinh'); if (!sel) return;
      if (!fc || !fc.features) { sel.innerHTML = '<option value="">(không nạp được)</option>'; return; }
      var fs = fc.features.slice().sort(function (a, b) {
        return String((a.properties||{}).ten).localeCompare(String((b.properties||{}).ten), 'vi'); });
      sel.innerHTML = fs.map(function (ft, i) {
        return '<option value="' + i + '">' + esc((ft.properties||{}).ten) + '</option>'; }).join('');
      sel._fs = fs;
    });
  }
  function napTinh() {
    if (TINH_CACHE) return Promise.resolve(TINH_CACHE);
    return fetch('data/hanhchinh/tinh.geojson', { cache: 'force-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { TINH_CACHE = j; return j; })
      .catch(function () { return null; });
  }

  function boundsToBbox(map) {
    var b = map.getBounds();
    return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map(function (x) { return x.toFixed(4); }).join(',');
  }

  /* ── CHỌN LƯU VỰC BẰNG BẤM BẢN ĐỒ ──
     Bật lớp Lưu vực → bấm một vùng → tìm lưu vực chứa điểm (điểm-trong-đa-giác);
     điểm thuộc nhiều cấp cha–con thì lấy vùng NHỎ NHẤT (dt_km2). Tô sáng vùng đã
     chọn, lưu vào el._lvChon để lúc Chạy dùng bbox + lọc chính xác theo đa giác. */
  function napLuuVuc() {
    if (LV_CACHE) return Promise.resolve(LV_CACHE);
    return fetch('data/luuvuc/luuvuc.geojson', { cache: 'force-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { LV_CACHE = j; return j; })
      .catch(function () { return null; });
  }
  var XA_CACHE = null, VUNG_CACHE = null;   // lớp hành chính (nạp khi cần)
  function napXa() {
    if (XA_CACHE) return Promise.resolve(XA_CACHE);
    return fetch('data/hanhchinh/xa.geojson', { cache: 'force-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { XA_CACHE = j; return j; }).catch(function () { return null; });
  }
  function napVung() {
    if (VUNG_CACHE) return Promise.resolve(VUNG_CACHE);
    return fetch('data/hanhchinh/vung.geojson', { cache: 'force-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { VUNG_CACHE = j; return j; }).catch(function () { return null; });
  }
  function areaBbox(g) { var b = bboxGeom(g); return (b[2] - b[0]) * (b[3] - b[1]); }
  function timLuuVuc(lon, lat, fc) {
    var hit = null, hitArea = Infinity;
    (fc.features || []).forEach(function (f) {
      if (!f.geometry || !pipGeom(lon, lat, f.geometry)) return;
      var a = (f.properties && f.properties.dt_km2) ? +f.properties.dt_km2 : areaBbox(f.geometry);
      if (a < hitArea) { hitArea = a; hit = f; }
    });
    return hit;
  }
  function veHighlight(map, f) {
    if (QC_SEL.hl) { try { map.removeLayer(QC_SEL.hl); } catch (e) {} QC_SEL.hl = null; }
    /* interactive:false để không nuốt click — còn bấm đổi vùng khác được. */
    QC_SEL.hl = L.geoJSON(f, { interactive: false, style: { color: '#F2B705', weight: 2.5, fill: false, dashArray: '4 3' } });
    QC_SEL.hl.addTo(map);
  }
  function qcClearSel() {
    var map = QC_SEL.map;
    if (QC_SEL.off) { try { QC_SEL.off(); } catch (e) {} QC_SEL.off = null; }
    if (QC_SEL.pick && map) { try { map.removeLayer(QC_SEL.pick); } catch (e) {} }
    if (QC_SEL.hl && map) { try { map.removeLayer(QC_SEL.hl); } catch (e) {} }
    if (QC_SEL.hlList && map) { QC_SEL.hlList.forEach(function (h) { try { map.removeLayer(h); } catch (e) {} }); }
    QC_SEL.pick = null; QC_SEL.hl = null; QC_SEL.hlList = null;
  }
  function batChonLuuVuc(subBox, el, c) {
    var map = c.map();
    if (!map || !window.L) { subBox.innerHTML = '<div class="tbx-err">Chưa có bản đồ để chọn lưu vực.</div>'; return; }
    QC_SEL.map = map;
    subBox.innerHTML = '<div class="tbx-hint" id="lvStatus">Đang nạp lớp lưu vực…</div>';
    napLuuVuc().then(function (fc) {
      var stt = subBox.querySelector('#lvStatus');
      if (!fc || !fc.features) { if (stt) stt.innerHTML = '<span style="color:var(--crit)">Không nạp được lớp lưu vực.</span>'; return; }

      function goPick() {   /* bật/khôi phục LỚP PHỦ CHỌN (mờ, bắt click, không popup) */
        if (QC_SEL.pick) { try { map.removeLayer(QC_SEL.pick); } catch (e) {} QC_SEL.pick = null; }
        QC_SEL.pick = L.geoJSON(fc, {
          renderer: L.canvas(),
          style: { color: '#2E8C8F', weight: 0.7, opacity: 0.55, fill: true, fillColor: '#2E8C8F', fillOpacity: 0.04 }
        });
        QC_SEL.pick.addTo(map);
        QC_SEL.pick.on('click', onClick);
        if (stt) stt.textContent = 'Bấm một vùng lưu vực trên bản đồ để chọn.';
      }
      function onClick(e) {
        if (window.L && L.DomEvent) L.DomEvent.stopPropagation(e);
        var f = timLuuVuc(e.latlng.lng, e.latlng.lat, fc);
        if (!f) { if (stt) stt.textContent = 'Chỗ bấm không thuộc lưu vực nào — thử lại.'; return; }
        el._lvChon = f;
        veHighlight(map, f);
        /* chọn xong → GỠ lớp phủ mờ cho bản đồ sạch, chỉ giữ viền vàng vùng đã chọn */
        if (QC_SEL.pick) { try { map.removeLayer(QC_SEL.pick); } catch (e2) {} QC_SEL.pick = null; }
        var p = f.properties || {};
        if (stt) stt.innerHTML = 'Đã chọn: <b style="color:var(--txt)">' + esc(p.ten || '(không tên)') + '</b>'
          + (p.dt_km2 ? ' · ' + Number(p.dt_km2).toLocaleString('vi-VN') + ' km²' : '')
          + ' <button class="tbx-back" id="lvRe" style="margin-left:4px">Chọn lại</button>';
        var reb = subBox.querySelector('#lvRe');
        if (reb) reb.addEventListener('click', function () { el._lvChon = null; qcClearSel(); goPick(); });
      }
      goPick();
    });
  }

  function chayQc(el, c) {
    var out = el.querySelector('#qcOut');
    var btn = el.querySelector('#qcRun');
    var win = el.querySelector('#qcWin').value;
    var scope = el.querySelector('#qcScope').value;
    var loc = el.querySelector('#qcLoc').value;
    var map = c.map();

    /* Dựng tham số + (tuỳ) đa giác lọc chính xác. */
    var qs = 'window_days=' + encodeURIComponent(win) + '&limit=20000';
    var locPoly = null, phamViTen = 'Toàn quốc';

    if (scope === 'khungnhin') {
      if (!map) { out.innerHTML = '<div class="tbx-err">Chưa có bản đồ.</div>'; return; }
      qs += '&bbox=' + boundsToBbox(map); phamViTen = 'Trong khung nhìn';
    } else if (scope === 'luuvuc') {
      var ftLv = el._lvChon;
      if (!ftLv) { out.innerHTML = '<div class="tbx-flag">Chưa chọn lưu vực.</div>'; return; }
      var bbLv = bboxGeom(ftLv.geometry);
      qs += '&bbox=' + bbLv.map(function (x) { return x.toFixed(4); }).join(',');
      locPoly = ftLv.geometry;                       // lọc chính xác theo ranh giới lưu vực
      phamViTen = 'Lưu vực: ' + ((ftLv.properties || {}).ten || '');
    } else if (scope === 'tinh') {
      var selT = el.querySelector('#qcTinh');
      var ft = selT && selT._fs && selT._fs[+selT.value];
      if (!ft) { out.innerHTML = '<div class="tbx-err">Hãy chọn một tỉnh.</div>'; return; }
      var bb = bboxGeom(ft.geometry);
      qs += '&bbox=' + bb.map(function (x) { return x.toFixed(4); }).join(',');
      locPoly = ft.geometry;                       // lọc chính xác theo ranh giới tỉnh
      phamViTen = 'Tỉnh: ' + (ft.properties||{}).ten;
    }
    if (loc === 'probs') qs += '&condition=chet,tac,bat_thuong,lech_nhip';

    btn.disabled = true; btn.textContent = 'Đang chạy… (5–9 giây)';
    out.innerHTML = '<div class="tbx-hint">Đang gọi engine RainLab…</div>';

    fetch('/api/rainlab/v1/stations/classify?' + qs, { cache: 'no-store' })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
      .then(function (res) {
        btn.disabled = false; btn.textContent = 'Chạy kiểm định';
        if (!res.ok || !res.j || res.j.ok === false) {
          var msg = (res.j && (res.j.msg || res.j.detail)) || ('HTTP ' + res.status);
          out.innerHTML = '<div class="tbx-err">Không chạy được QC: ' + esc(msg)
            + '<br><br>Kiểm tra: dịch vụ RainLab có đang chạy ở <code>127.0.0.1:8600</code> trên máy chủ RIMS không.</div>';
          return;
        }
        var data = res.j.data || [];
        if (locPoly) data = data.filter(function (d) {
          var lo = +d.lon, la = +d.lat; return isFinite(lo) && isFinite(la) && pipGeom(lo, la, locPoly); });
        veKetQua(out, res.j, data, phamViTen, c, !!locPoly);
      })
      .catch(function (e) {
        btn.disabled = false; btn.textContent = 'Chạy kiểm định';
        out.innerHTML = '<div class="tbx-err">Lỗi mạng khi gọi QC: ' + esc(e && e.message || e) + '</div>';
      });
  }

  function so(n) { return (n == null || isNaN(n)) ? '–' : Number(n).toLocaleString('vi-VN'); }
  function mm(n) { return (n == null || isNaN(n)) ? '–' : (Math.round(n * 10) / 10).toLocaleString('vi-VN') + ' mm'; }

  /* ═══════════ XUẤT KẾT QUẢ: CHỤP ẢNH BẢN ĐỒ + LƯU DỮ LIỆU ═══════════
     Dùng chung cho QC trạm mưa và Đường đẳng trị. Ảnh: dựng lại đúng khung
     nhìn hiện tại (nền tile + lớp vector canvas + nhãn chữ) rồi bồi thêm tiêu
     đề/chú giải/nguồn. Dữ liệu: CSV (Excel, có BOM) và GeoJSON.            */
  function taiFile(name, blob) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
  }
  function nhanTG() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes());
  }
  function ngayVN() { return new Date().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }); }
  function xuatCSV(name, header, rows) {
    var q = function (v) { v = (v == null ? '' : String(v)); return /[",\n\r;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var L = [header.map(q).join(',')];
    rows.forEach(function (r) { L.push(r.map(q).join(',')); });
    taiFile(name, new Blob(['﻿' + L.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  }
  function xuatGeoJSON(name, fc) { taiFile(name, new Blob([JSON.stringify(fc)], { type: 'application/geo+json;charset=utf-8' })); }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function veKhungXuat(ctx, W, H, meta) {
    var pad = 10;
    // Tiêu đề (trên-trái)
    ctx.font = '700 15px system-ui,sans-serif'; var tW = ctx.measureText(meta.title || '').width;
    ctx.font = '400 11px system-ui,sans-serif'; var sW = meta.sub ? ctx.measureText(meta.sub).width : 0;
    var bW = Math.max(tW, sW) + pad * 2, bH = meta.sub ? 48 : 32;
    roundRect(ctx, 12, 12, bW, bH, 7); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'start';
    ctx.fillStyle = '#12303a'; ctx.font = '700 15px system-ui,sans-serif'; ctx.fillText(meta.title || '', 12 + pad, 12 + 22);
    if (meta.sub) { ctx.fillStyle = '#4a5a62'; ctx.font = '400 11px system-ui,sans-serif'; ctx.fillText(meta.sub, 12 + pad, 12 + 40); }
    // Chú giải (dưới-trái)
    if (meta.legend && meta.legend.length) {
      ctx.font = '500 11px system-ui,sans-serif'; var lw = 0;
      meta.legend.forEach(function (it) { lw = Math.max(lw, ctx.measureText(it.label).width); });
      var hasT = !!meta.legTitle, LW = lw + 18 + pad * 2, LH = meta.legend.length * 18 + pad * 2 + (hasT ? 16 : 0);
      var lx = 12, ly = H - LH - 12;
      roundRect(ctx, lx, ly, LW, LH, 7); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.stroke();
      var yy = ly + pad + (hasT ? 16 : 0);
      if (hasT) { ctx.fillStyle = '#12303a'; ctx.font = '700 11px system-ui,sans-serif'; ctx.fillText(meta.legTitle, lx + pad, ly + pad + 10); }
      meta.legend.forEach(function (it) {
        ctx.fillStyle = it.color; roundRect(ctx, lx + pad, yy + 3, 13, 11, 2); ctx.fill();
        ctx.fillStyle = '#28323a'; ctx.font = '500 11px system-ui,sans-serif'; ctx.fillText(it.label, lx + pad + 20, yy + 12);
        yy += 18;
      });
    }
    // Nguồn (dưới-phải)
    if (meta.footer) {
      ctx.font = '400 10px system-ui,sans-serif'; var fw = ctx.measureText(meta.footer).width;
      ctx.fillStyle = 'rgba(255,255,255,.88)'; roundRect(ctx, W - fw - 18, H - 26, fw + 12, 18, 4); ctx.fill();
      ctx.fillStyle = '#4a5a62'; ctx.fillText(meta.footer, W - fw - 12, H - 13);
    }
  }
  function xuatAnhBanDo(c, meta) {
    var map = c.map(), mapEl = document.getElementById('map');
    if (!map || !mapEl) return;
    var rect = mapEl.getBoundingClientRect(), SS = 2, cw = Math.round(rect.width), ch = Math.round(rect.height);
    function render(withTiles) {
      var cv = document.createElement('canvas'); cv.width = cw * SS; cv.height = ch * SS;
      var ctx = cv.getContext('2d'); ctx.scale(SS, SS);
      ctx.fillStyle = '#e9eef1'; ctx.fillRect(0, 0, cw, ch);
      if (withTiles) mapEl.querySelectorAll('.leaflet-tile-pane img').forEach(function (img) {
        if (!img.complete || !img.naturalWidth) return; var r = img.getBoundingClientRect(); if (!r.width) return;
        try { ctx.drawImage(img, r.left - rect.left, r.top - rect.top, r.width, r.height); } catch (e) {}
      });
      mapEl.querySelectorAll('.leaflet-pane canvas').forEach(function (cvx) {
        var r = cvx.getBoundingClientRect(); if (!r.width) return;
        try { ctx.drawImage(cvx, r.left - rect.left, r.top - rect.top, r.width, r.height); } catch (e) {}
      });
      mapEl.querySelectorAll('.leaflet-pane .leaflet-marker-icon').forEach(function (elm) {
        var r = elm.getBoundingClientRect(); if (!r.width && !r.height) return;
        var cx = r.left - rect.left, cy = r.top - rect.top;
        if (elm.tagName === 'IMG') { if (elm.complete && elm.naturalWidth) { try { ctx.drawImage(elm, cx, cy, r.width, r.height); } catch (e) {} } return; }
        var im = elm.querySelector('img');
        if (im && im.complete && im.naturalWidth) { var ri = im.getBoundingClientRect(); try { ctx.drawImage(im, ri.left - rect.left, ri.top - rect.top, ri.width, ri.height); } catch (e) {} return; }
        var txt = (elm.textContent || '').trim(); if (!txt) return;
        var sp = elm.querySelector('span') || elm, cs = getComputedStyle(sp), fs = parseFloat(cs.fontSize) || 11;
        ctx.font = (cs.fontWeight || '600') + ' ' + fs + 'px ' + (cs.fontFamily || 'system-ui,sans-serif');
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        var tx = cx + r.width / 2, ty = cy + r.height / 2;
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.strokeText(txt, tx, ty);
        ctx.fillStyle = (cs.color && cs.color !== 'rgba(0, 0, 0, 0)') ? cs.color : '#26333b'; ctx.fillText(txt, tx, ty);
        ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
      });
      veKhungXuat(ctx, cw, ch, meta);
      return cv;
    }
    var cv = render(true), ok = true;
    try { cv.toDataURL('image/png'); } catch (e) { ok = false; }
    if (!ok) cv = render(false);   // tile bị chặn CORS → xuất bản không nền
    cv.toBlob(function (b) { if (b) taiFile(meta.file || ('RIMS_' + nhanTG() + '.png'), b); }, 'image/png');
  }
  function nutXuat(container, actions) {
    var row = document.createElement('div'); row.className = 'tbx-xrow';
    actions.forEach(function (a) {
      var b = document.createElement('button'); b.className = 'tbx-xbtn'; b.textContent = a.label;
      b.addEventListener('click', a.fn); row.appendChild(b);
    });
    container.appendChild(row);
  }

  function veKetQua(out, j, data, phamViTen, c, daLoc) {
    /* Đếm theo lớp (tự đếm trên tập đã lọc để khớp cái đang vẽ). */
    var dem = {}; QC_THUTU.forEach(function (k) { dem[k] = 0; });
    data.forEach(function (d) { if (dem[d.condition] == null) dem[d.condition] = 0; dem[d.condition]++; });
    var tong = data.length;
    var soActive = tong - (dem.hoa_thach || 0);   // hoạt động = tổng − "Ngừng hoạt động"

    var hienLoai = {}; QC_THUTU.forEach(function (k) { hienLoai[k] = true; });
    hienLoai.hoa_thach = false;   // trạm ngừng >30 ngày: mặc định KHÔNG biểu diễn (đỡ rối bản đồ)
    var legHtml = QC_THUTU.map(function (k) {
      return '<div class="r' + (hienLoai[k] === false ? ' off' : '') + '" data-k="' + k + '" title="Bật/tắt loại này trên bản đồ">'
           + '<span class="sw" style="background:' + QC_MAU[k] + '"></span>'
           + '<span class="nm">' + QC_TEN[k] + '</span><span class="v">' + so(dem[k]) + '</span></div>';
    }).join('');

    var canhBaoCount = '';
    if (j.counts_complete === false && !daLoc)
      canhBaoCount = '<div class="tbx-hint">⚠ Kết quả bị cắt trang (counts chưa đủ) — tăng <code>limit</code> hoặc thu hẹp phạm vi.</div>';

    out.innerHTML =
      '<div class="tbx-sep"></div>'
      + '<div class="tbx-resHd">Chất lượng trạm · ' + esc(phamViTen) + '</div>'
      + '<div class="tbx-hint" style="margin:0 0 8px">Tổng <b style="color:var(--txt);font-size:14px">' + so(tong) + '</b> trạm · <b style="color:var(--ok)">' + so(soActive) + '</b> hoạt động · cửa sổ ' + so(j.window_days) + ' ngày</div>'
      + '<div class="tbx-leg">' + legHtml + '</div>'
      + canhBaoCount
      + '<label class="tbx-hint" style="display:flex;align-items:center;gap:8px;margin-top:10px;cursor:pointer"><input type="checkbox" id="qcShow" checked> Biểu diễn trạm trên bản đồ</label>';

    function locData() { return data.filter(function (d) { return hienLoai[d.condition] !== false; }); }
    function redraw() {
      var cb = out.querySelector('#qcShow');
      if (cb && !cb.checked) { window.RIMS_toolKetQua.xoa('qc_mua'); return; }
      veLop(locData(), c);
    }
    veLop(locData(), c);
    var chk = out.querySelector('#qcShow');
    if (chk) chk.addEventListener('change', redraw);
    /* Bấm một dòng lớp → bật/tắt loại đó trên bản đồ. */
    out.querySelectorAll('.tbx-leg .r[data-k]').forEach(function (row) {
      row.addEventListener('click', function () {
        var k = row.dataset.k;
        hienLoai[k] = (hienLoai[k] === false);
        row.classList.toggle('off', !hienLoai[k]);
        redraw();
      });
    });

    /* Xuất: chụp ảnh bản đồ (đúng loại đang hiện) + lưu dữ liệu CSV (đầy đủ mọi trạm). */
    nutXuat(out, [
      { label: '📷 Chụp ảnh', fn: function () {
        var leg = QC_THUTU.filter(function (k) { return hienLoai[k] !== false && dem[k] > 0; })
          .map(function (k) { return { color: QC_MAU[k], label: QC_TEN[k] + ' (' + so(dem[k]) + ')' }; });
        xuatAnhBanDo(c, {
          title: 'Chất lượng trạm đo mưa — ' + phamViTen,
          sub: 'Cửa sổ ' + so(j.window_days) + ' ngày · ' + so(tong) + ' trạm · ' + ngayVN(),
          legTitle: 'Phân loại', legend: leg,
          footer: 'RIMS · RainLab (WeatherPlus)',
          file: 'RIMS_QC_tram_' + nhanTG() + '.png'
        });
      } },
      { label: '⬇ Lưu dữ liệu (CSV)', fn: function () {
        var hd = ['ma_tram', 'ten', 'kinh_do', 'vi_do', 'phan_loai', 'ten_phan_loai', 'tong_mua_mm', 'radar_mm', 'tram_lan_can_mm', 'so_tram_lan_can', 'ty_so_radar_tram', 'so_ngay_mat_du_lieu', 'pct_thieu'];
        var rs = data.map(function (d) {
          return [d.station_id, d.name || '', d.lon, d.lat, d.condition, QC_TEN[d.condition] || d.condition,
            d.gauge_mm != null ? d.gauge_mm : '', d.radar_mm != null ? d.radar_mm : '',
            d.neigh_ref_mm != null ? d.neigh_ref_mm : '', d.n_neigh != null ? d.n_neigh : '',
            d.rg_ratio != null ? d.rg_ratio : '', d.days_since_data != null ? d.days_since_data : '',
            d.pct_missing != null ? d.pct_missing : ''];
        });
        xuatCSV('RIMS_QC_tram_' + nhanTG() + '.csv', hd, rs);
      } }
    ]);
  }

  function popupHtml(d) {
    var flagTen = {
      flag_silence:'mất tín hiệu', flag_fossil:'ngừng >30 ngày', flag_missing:'thiếu bản tin', flag_outliers:'ngoại lai',
      flag_rg_high:'radar ≫ trạm', flag_rg_low:'radar ≪ trạm', flag_rg_corr:'lệch tương quan radar',
      flag_gg_high:'trạm lân cận ≫ trạm', flag_gg_low:'trạm lân cận ≪ trạm', flag_gg_corr:'lệch tương quan trạm lân cận'
    };
    var cf = Object.keys(flagTen).filter(function (k) { return d[k] === true; }).map(function (k) { return flagTen[k]; });
    var mau = QC_MAU[d.condition] || '#8794A0';
    var ngayMat = (d.days_since_data == null) ? '–' : (d.days_since_data >= 999 ? 'cả cửa sổ' : d.days_since_data);
    var rows = ''
      + '<tr><td class="k">Trạm</td><td>' + esc(d.gauge_mm != null ? mm(d.gauge_mm) : '–') + '</td></tr>'
      + '<tr><td class="k">Radar</td><td>' + esc(mm(d.radar_mm)) + '</td></tr>'
      + '<tr><td class="k">Trạm lân cận</td><td>' + esc(mm(d.neigh_ref_mm)) + ' (' + so(d.n_neigh) + ' trạm)</td></tr>'
      + '<tr><td class="k">Tỷ số radar/trạm</td><td>' + esc(d.rg_ratio != null ? (Math.round(d.rg_ratio*100)/100) : '–') + '</td></tr>'
      + '<tr><td class="k">Số ngày mất dữ liệu</td><td>' + esc(ngayMat) + '</td></tr>';
    return '<div class="rl-pop"><b>' + esc(d.name || d.station_id) + '</b><br>'
      + '<span class="cl" style="background:' + mau + '">' + esc(QC_TEN[d.condition] || d.condition_label || d.condition) + '</span>'
      + '<table>' + rows + '</table>'
      + (cf.length ? '<div class="fl">Trạng thái: ' + esc(cf.join(', ')) + '</div>' : '')
      + '</div>';
  }

  function veLop(data, c) {
    var map = c.map();
    if (!map || !window.L) return;
    var grp = L.layerGroup();
    data.forEach(function (d) {
      var lo = +d.lon, la = +d.lat; if (!isFinite(lo) || !isFinite(la)) return;
      var mau = QC_MAU[d.condition] || '#8794A0';
      var mk = L.circleMarker([la, lo], {
        radius: 4, color: 'rgba(0,0,0,.5)', weight: 1, fillColor: mau, fillOpacity: 0.9
      });
      mk.bindTooltip(d.name || d.station_id, { direction: 'top' });
      mk.bindPopup(popupHtml(d), { className: 'gis-popup' });
      grp.addLayer(mk);
    });
    grp.addTo(map);
    window.RIMS_toolKetQua.them('qc_mua', 'QC trạm mưa (' + so(data.length) + ' trạm)', function () {
      if (map.hasLayer(grp)) map.removeLayer(grp);
    });
  }

  /* ═══════════════════════ RUỘT: VẼ ĐƯỜNG ĐẲNG TRỊ MƯA ═══════════════════════
     Tổng mưa mỗi trạm theo khoảng chọn → IDW lên lưới → d3-contour → băng màu +
     đường đẳng trị. Nguồn LAI: trận mưa <3 ngày dùng /v1/rain (chính xác, không
     giới hạn tối thiểu); khoảng dài dùng classify gauge_mm (1 lời gọi/cửa sổ cho
     cả mạng). Loại trạm QC xấu khỏi nội suy (mặc định bật).                     */
  function scopeBboxPoly(scopeVal, el, subBox, map) {
    if (scopeVal === 'khungnhin') { if (!map) return null; return { bbox: boundsToBbox(map), poly: null, ten: 'Khung nhìn' }; }
    if (scopeVal === 'tinh') {
      var s = subBox.querySelector('#qcTinh'); var ft = s && s._fs && s._fs[+s.value];
      if (!ft) return null; var b = bboxGeom(ft.geometry);
      return { bbox: b.map(function (x) { return x.toFixed(4); }).join(','), poly: ft.geometry, ten: 'Tỉnh: ' + (ft.properties || {}).ten };
    }
    if (scopeVal === 'luuvuc') {
      var f = el._lvChon; if (!f) return null; var b2 = bboxGeom(f.geometry);
      return { bbox: b2.map(function (x) { return x.toFixed(4); }).join(','), poly: f.geometry, ten: 'Lưu vực: ' + ((f.properties || {}).ten || '') };
    }
    return { bbox: null, poly: null, ten: 'Toàn quốc' };
  }

  function isoPeriod(el) {
    var loai = el.querySelector('#isoLoai').value;
    function d(v) { return v + 'T00:00:00Z'; }
    if (loai === 'tran_mua') {
      var f = el.querySelector('#isoFrom').value, t = el.querySelector('#isoTo').value;
      if (!f || !t) return null;
      var e = new Date(t + 'T00:00:00Z'); e.setUTCDate(e.getUTCDate() + 1);   // 'đến' tính trọn ngày
      return { start: d(f), end: e.toISOString(), nYears: 1, mode: 'tong' };
    }
    if (loai === 'mua_mua') {
      var y = +el.querySelector('#isoYear').value; if (!y) return null;
      return { start: d(y + '-06-01'), end: d(y + '-12-01'), nYears: 1, mode: 'tong' };   // 1/6–30/11
    }
    if (loai === 'mot_nam') {
      var y1 = +el.querySelector('#isoYear').value; if (!y1) return null;
      return { start: d(y1 + '-01-01'), end: d((y1 + 1) + '-01-01'), nYears: 1, mode: 'tong' };
    }
    if (loai === 'nhieu_nam') {
      var a = +el.querySelector('#isoY1').value, b = +el.querySelector('#isoY2').value;
      if (!a || !b || b < a) return null;
      var mode = el.querySelector('input[name=isoTB]:checked'); mode = mode ? mode.value : 'tong';
      return { start: d(a + '-01-01'), end: d((b + 1) + '-01-01'), nYears: (b - a + 1), mode: mode };
    }
    return null;
  }

  function chiaCuaSo(start, end) {   // chia đều thành các cửa sổ ≤31 ngày, mỗi cửa ≥3 ngày (nếu tổng ≥3)
    var s = new Date(start).getTime(), e = new Date(end).getTime();
    var days = (e - s) / 86400000, n = Math.max(1, Math.ceil(days / 31)), out = [];
    for (var i = 0; i < n; i++) out.push([new Date(s + (e - s) * i / n).toISOString(), new Date(s + (e - s) * (i + 1) / n).toISOString()]);
    return out;
  }

  /* Gọi RainLab qua proxy + BÁO LỖI THẬT: proxy 502 / API 422 trả {ok:false|detail}
     → ném lỗi để lớp trên hiện đúng "RainLab chưa chạy", không nuốt thành "không có trạm". */
  function callRL(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || (j && j.ok === false)) throw new Error((j && (j.msg || j.detail)) || ('HTTP ' + r.status));
        return j;
      });
    });
  }

  /* Lấy tổng mưa qua classify. qcFilter (mặc định) = CHỈ dùng lớp "Bình thường" —
     lớp sạch nhất, tránh bắt-oan (nhất là "tắc" ở cửa sổ ngắn). Cộng lượng mưa
     theo TỪNG cửa sổ mà trạm đạt bình thường, nên trạm nay đã ngừng nhưng quá khứ
     còn tốt vẫn được dùng cho các cửa sổ nó bình thường (QC tính theo đúng khoảng). */
  function viaClassify(start, end, bbox, qcFilter, prog) {
    var wins = chiaCuaSo(start, end), acc = {};
    return wins.reduce(function (p, w, idx) {
      return p.then(function () {
        if (prog) prog('Đang lấy dữ liệu QC-mưa · cửa sổ ' + (idx + 1) + '/' + wins.length + '…');
        var qs = 'start=' + encodeURIComponent(w[0]) + '&end=' + encodeURIComponent(w[1]) + '&limit=20000' + (bbox ? '&bbox=' + bbox : '');
        return callRL('/api/rainlab/v1/stations/classify?' + qs)
          .then(function (j) {
            (j.data || []).forEach(function (d) {
              var a = acc[d.station_id] || (acc[d.station_id] = { lon: +d.lon, lat: +d.lat, sum: 0, cnt: 0 });
              var g = (d.gauge_mm != null && isFinite(+d.gauge_mm)) ? +d.gauge_mm : null;
              var ok = (d.condition === 'binh_thuong');
              if (g != null && (!qcFilter || ok)) { a.sum += g; a.cnt++; }
            });
          });
      });
    }, Promise.resolve()).then(function () {
      var out = [];
      Object.keys(acc).forEach(function (id) {
        var a = acc[id]; if (a.cnt === 0) return;
        if (!isFinite(a.lon) || !isFinite(a.lat)) return;
        out.push({ id: id, lon: a.lon, lat: a.lat, total: a.sum });
      });
      return { rows: out, nguon: qcFilter ? 'classify · chỉ trạm Bình thường' : 'classify · mọi trạm' };
    });
  }

  /* Trận mưa <3 ngày: /v1/rain (không giới hạn tối thiểu). Vá QC: classify tối thiểu
     3 ngày nên gọi một cửa sổ 3 ngày kết ở 'end' để lấy DANH SÁCH trạm Bình thường,
     rồi chỉ cộng mưa trận cho các trạm đó (khi bật lọc QC). */
  function viaRain(start, end, bbox, qcFilter) {
    if (!bbox) return Promise.reject(new Error('Trận mưa cần một phạm vi vùng (không dùng toàn quốc). Hãy chọn tỉnh/lưu vực/khung nhìn.'));
    function layTramDat() {
      if (!qcFilter) return Promise.resolve(null);
      var E = new Date(end), S3 = new Date(E.getTime() - 3 * 86400000);
      var qs = 'start=' + encodeURIComponent(S3.toISOString()) + '&end=' + encodeURIComponent(E.toISOString())
             + '&bbox=' + bbox + '&condition=binh_thuong&limit=20000';
      return callRL('/api/rainlab/v1/stations/classify?' + qs)
        .then(function (j) { var s = {}; (j.data || []).forEach(function (d) { s[d.station_id] = 1; }); return s; })
        .catch(function () { return null; });   // classify lỗi → không lọc, vẫn vẽ được
    }
    return layTramDat().then(function (dat) {
      var meta = {};
      return callRL('/api/rainlab/v1/stations?bbox=' + bbox + '&limit=5000')
        .then(function (j) { (j.data || []).forEach(function (s) { meta[s.station_id] = { lon: +s.lon, lat: +s.lat }; }); })
        .then(function () {
          var sum = {}, base = '/api/rainlab/v1/rain?start=' + encodeURIComponent(start) + '&end=' + encodeURIComponent(end) + '&bbox=' + bbox + '&limit=100000';
          function page(cursor) {
            return callRL(base + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''))
              .then(function (j) {
                (j.data || []).forEach(function (d) {
                  if (dat && !dat[d.station_id]) return;   // chỉ trạm đạt QC
                  if (d.rain != null && isFinite(+d.rain)) sum[d.station_id] = (sum[d.station_id] || 0) + (+d.rain);
                });
                if (j.next_cursor) return page(j.next_cursor);
              });
          }
          return page(null).then(function () {
            var out = [];
            Object.keys(sum).forEach(function (id) { var m = meta[id]; if (!m || !isFinite(m.lon)) return; out.push({ id: id, lon: m.lon, lat: m.lat, total: sum[id] }); });
            return { rows: out, nguon: qcFilter ? '/v1/rain · chỉ trạm Bình thường' : '/v1/rain' };
          });
        });
    });
  }

  /* ── IDW + contour + vẽ ── */
  function bboxRows(rows) {
    var mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
    rows.forEach(function (r) { if (r.lon < mnx) mnx = r.lon; if (r.lon > mxx) mxx = r.lon; if (r.lat < mny) mny = r.lat; if (r.lat > mxy) mxy = r.lat; });
    var px = (mxx - mnx) * 0.05 || 0.1, py = (mxy - mny) * 0.05 || 0.1;
    return [mnx - px, mny - py, mxx + px, mxy + py];
  }
  function buocDep(min, max) {
    var raw = (max - min) / 8 || 10, mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var n = raw / mag; var s = n >= 5 ? 5 : n >= 2 ? 2 : 1; return Math.max(1, s * mag);
  }
  var RAIN_STOPS = [[232,245,233],[200,230,201],[165,214,240],[100,181,246],[46,125,214],[26,83,168],[106,63,176],[142,36,170]];
  function lerpPal(t) {
    t = Math.max(0, Math.min(1, t)); var n = RAIN_STOPS.length - 1, i = Math.floor(t * n), f = t * n - i;
    var a = RAIN_STOPS[i], b = RAIN_STOPS[Math.min(i + 1, n)];
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * f) + ',' + Math.round(a[1] + (b[1] - a[1]) * f) + ',' + Math.round(a[2] + (b[2] - a[2]) * f) + ')';
  }
  function toiMau(rgb, k) {
    var m = /(\d+)\D+(\d+)\D+(\d+)/.exec(rgb || '');
    if (!m) return rgb;
    return 'rgb(' + Math.round(m[1] * k) + ',' + Math.round(m[2] * k) + ',' + Math.round(m[3] * k) + ')';
  }
  function injIsoNhanCss() {
    if (document.getElementById('iso-nhan-css')) return;
    var st = document.createElement('style'); st.id = 'iso-nhan-css';
    st.textContent = '.iso-nhan{background:none!important;border:0!important;box-shadow:none!important;text-align:center;'
      + 'font:600 10px/14px system-ui,-apple-system,sans-serif;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff;pointer-events:none;}';
    document.head.appendChild(st);
  }
  function nhanIso(ll, v, col) {
    return L.marker(ll, {
      interactive: false, keyboard: false,
      icon: L.divIcon({ className: 'iso-nhan', html: '<span style="color:' + col + '">' + so(v) + '</span>', iconSize: [46, 14], iconAnchor: [23, 7] })
    });
  }

  /* Mặt nạ vùng: trả Promise<fn(lon,lat)->bool>.
     Có đa giác phạm vi (tỉnh/lưu vực) → nằm trong đa giác đó.
     Toàn quốc / khung nhìn → nằm trên đất liền (trong bất kỳ tỉnh nào). */
  function taoMask(sc) {
    if (sc && sc.poly) {
      var g = sc.poly;
      return Promise.resolve(function (lo, la) { return pipGeom(lo, la, g); });
    }
    return napTinh().then(function (fc) {
      if (!fc || !fc.features) return function () { return true; };
      var feats = fc.features
        .map(function (f) { return f.geometry ? { g: f.geometry, bb: bboxGeom(f.geometry) } : null; })
        .filter(Boolean);
      return function (lo, la) {
        for (var i = 0; i < feats.length; i++) {
          var bb = feats[i].bb;
          if (lo < bb[0] || lo > bb[2] || la < bb[1] || la > bb[3]) continue;
          if (pipGeom(lo, la, feats[i].g)) return true;
        }
        return false;
      };
    }).catch(function () { return function () { return true; }; });
  }

  function veIsohyet(rows, sc, opts, out, c) {
    var map = c.map();
    if (!map || !window.d3 || !window.L) { out.innerHTML = '<div class="tbx-err">Thiếu bản đồ hoặc d3-contour.</div>'; return; }
    // Loại toạ độ rác (0,0 hoặc ngoài lãnh thổ VN) — chính là thứ làm mảng vẽ lan ra thế giới.
    rows = rows.filter(function (r) { return r.lon >= 102 && r.lon <= 110.2 && r.lat >= 7.5 && r.lat <= 23.8; });
    if (rows.length < 3) { out.innerHTML = '<div class="tbx-err">Chỉ có ' + rows.length + ' trạm có dữ liệu hợp lệ — quá ít để nội suy. Mở rộng phạm vi/khoảng thời gian.</div>'; return; }
    if (opts.mode === 'tb' && opts.nYears > 1) rows.forEach(function (r) { r.total = r.total / opts.nYears; });

    var mask = opts.mask || function () { return true; };
    var SENT = -1e9;                 // ô ngoài mặt nạ / ngoài bán kính phủ → dưới mọi ngưỡng → không vẽ
    var RAD2 = 0.7 * 0.7;            // bán kính phủ ~0.7° (~78 km): xa mọi trạm thì không nội suy

    // Lưới bám theo dữ liệu (không phải hình chữ nhật phạm vi) — mặt nạ lo phần cắt.
    var bb = bboxRows(rows);
    var minLon = bb[0], minLat = bb[1], maxLon = bb[2], maxLat = bb[3];
    var W = 160, aspect = (maxLat - minLat) / ((maxLon - minLon) || 1e-6), H = Math.max(40, Math.min(240, Math.round(W * aspect)));
    var pw = (maxLon - minLon) / (W - 1), ph = (maxLat - minLat) / (H - 1);
    var grid = new Float64Array(W * H);
    for (var gy = 0; gy < H; gy++) {
      var lat = maxLat - gy * ph;
      for (var gx = 0; gx < W; gx++) {
        var lon = minLon + gx * pw;
        if (!mask(lon, lat)) { grid[gy * W + gx] = SENT; continue; }
        var num = 0, den = 0, exact = null, near = Infinity;
        for (var i = 0; i < rows.length; i++) {
          var dx = lon - rows[i].lon, dy = lat - rows[i].lat, d2 = dx * dx + dy * dy;
          if (d2 < near) near = d2;
          if (d2 < 1e-10) { exact = rows[i].total; break; }
          var wgt = 1 / d2; num += wgt * rows[i].total; den += wgt;
        }
        grid[gy * W + gx] = (exact == null && near > RAD2) ? SENT
          : (exact != null ? exact : (den > 0 ? num / den : SENT));
      }
    }
    var vals = rows.map(function (r) { return r.total; });
    var vmax = Math.max.apply(null, vals), vmin = Math.min.apply(null, vals);
    var step = opts.step || buocDep(vmin, vmax), levels = [];
    for (var t = Math.max(step, Math.ceil(vmin / step) * step); t <= vmax; t += step) levels.push(Math.round(t));
    if (levels.length < 2) levels = [Math.max(1, Math.round(vmin)), Math.round((vmin + vmax) / 2), Math.round(vmax)].filter(function (v, i, a) { return v > 0 && a.indexOf(v) === i; });
    if (levels.length < 2) levels = [1, Math.max(2, Math.round(vmax))];

    var cs = d3.contours().size([W, H]).thresholds(levels)(grid);
    var lvMin = levels[0], lvMax = levels[levels.length - 1] || (lvMin + 1);
    function mau(v) { return lerpPal((v - lvMin) / ((lvMax - lvMin) || 1)); }
    var feats = cs.map(function (ct) {
      var coords = ct.coordinates.map(function (poly) {
        return poly.map(function (ring) { return ring.map(function (pt) { return [minLon + pt[0] * pw, maxLat - pt[1] * ph]; }); });
      });
      return { type: 'Feature', geometry: { type: ct.type, coordinates: coords }, properties: { value: ct.value } };
    });
    var style = opts.style || 'both';   // 'both' | 'fill' | 'line'
    var fc2 = { type: 'FeatureCollection', features: feats };
    injIsoNhanCss();

    var fillLayer = L.geoJSON(fc2, {
      interactive: false,
      style: function (f) {
        var m = mau(f.properties.value);
        if (style === 'fill') return { color: m, weight: 0.6, opacity: 0.9, fillColor: m, fillOpacity: 0.48 };
        return { stroke: false, fillColor: m, fillOpacity: 0.40 };   // 'both' — để đường + trị số nổi lên
      }
    });
    var lineLayer = L.geoJSON(fc2, {
      interactive: false,
      style: function (f) { var m = toiMau(mau(f.properties.value), 0.60); return { color: m, weight: 1.3, opacity: 0.95, fill: false }; }
    });

    // Trị số đặt dọc theo đường — cách đều theo chiều dài, bỏ vòng quá ngắn.
    var labels = [];
    if (style !== 'fill') {
      var SPACING = Math.max(0.25, (maxLon - minLon) / 6), MAXLBL = 500;
      for (var fi = 0; fi < feats.length && labels.length < MAXLBL; fi++) {
        var val = feats[fi].properties.value, col = toiMau(mau(val), 0.55);
        var polys = feats[fi].geometry.coordinates;
        for (var pi = 0; pi < polys.length; pi++) {
          var rings = polys[pi];
          for (var ri = 0; ri < rings.length; ri++) {
            var ring = rings[ri], total = 0, kk;
            for (kk = 1; kk < ring.length; kk++) total += Math.hypot(ring[kk][0] - ring[kk - 1][0], ring[kk][1] - ring[kk - 1][1]);
            if (total < SPACING * 0.6) continue;
            var acc = SPACING;
            for (kk = 1; kk < ring.length && labels.length < MAXLBL; kk++) {
              var a = ring[kk - 1], b = ring[kk];
              acc += Math.hypot(b[0] - a[0], b[1] - a[1]);
              if (acc >= SPACING) { acc = 0; labels.push(nhanIso([b[1], b[0]], val, col)); }
            }
          }
        }
      }
    }

    var grp = L.layerGroup();
    if (style !== 'line') grp.addLayer(fillLayer);
    if (style !== 'fill') { grp.addLayer(lineLayer); labels.forEach(function (m) { grp.addLayer(m); }); }
    grp.addTo(map);
    window.RIMS_toolKetQua.them('iso', 'Đường đẳng trị mưa', function () { if (map.hasLayer(grp)) map.removeLayer(grp); });
    map.fitBounds([[minLat, minLon], [maxLat, maxLon]], { animate: false, maxZoom: 10 });

    var legRows = levels.slice().reverse().map(function (v) {
      return '<div class="r"><span class="sw" style="background:' + mau(v) + '"></span><span class="nm">≥ ' + so(v) + ' mm</span></div>';
    }).join('');
    out.innerHTML = '<div class="tbx-sep"></div><div class="tbx-resHd">Đường đẳng trị · ' + esc(sc ? sc.ten : '') + '</div>'
      + '<div class="tbx-hint" style="margin:0 0 8px"><b style="color:var(--txt)">' + so(rows.length) + '</b> trạm · bước ' + so(step) + ' mm'
      + (opts.mode === 'tb' && opts.nYears > 1 ? ' · trung bình năm' : '') + '</div>'
      + '<div class="tbx-leg">' + legRows + '</div>'
      + '<label class="tbx-hint" style="display:flex;align-items:center;gap:8px;margin-top:10px;cursor:pointer"><input type="checkbox" id="isoShow" checked> Hiện lớp đẳng trị trên bản đồ</label>';
    var chk = out.querySelector('#isoShow');
    if (chk) chk.addEventListener('change', function (e) {
      if (e.target.checked) { grp.addTo(map); window.RIMS_toolKetQua.them('iso', 'Đường đẳng trị mưa', function () { if (map.hasLayer(grp)) map.removeLayer(grp); }); }
      else window.RIMS_toolKetQua.xoa('iso');
    });

    /* Xuất: chụp ảnh + lưu trạm (CSV) + lưu đường đẳng trị (GeoJSON dùng lại trong GIS). */
    var perSub = (opts.mode === 'tb' && opts.nYears > 1 ? 'Trung bình năm' : 'Tổng tích luỹ') + ' · bước ' + so(step) + ' mm · ' + ngayVN();
    nutXuat(out, [
      { label: '📷 Chụp ảnh', fn: function () {
        xuatAnhBanDo(c, {
          title: 'Đường đẳng trị mưa — ' + (sc ? sc.ten : ''),
          sub: perSub + ' · ' + so(rows.length) + ' trạm',
          legTitle: 'Lượng mưa (mm)',
          legend: levels.slice().reverse().map(function (v) { return { color: mau(v), label: '≥ ' + so(v) + ' mm' }; }),
          footer: 'RIMS · RainLab (WeatherPlus)',
          file: 'RIMS_dangtri_' + nhanTG() + '.png'
        });
      } },
      { label: '⬇ Trạm (CSV)', fn: function () {
        xuatCSV('RIMS_dangtri_tram_' + nhanTG() + '.csv',
          ['ma_tram', 'kinh_do', 'vi_do', 'tong_mua_mm'],
          rows.map(function (r) { return [r.id != null ? r.id : '', r.lon, r.lat, Math.round(r.total * 10) / 10]; }));
      } },
      { label: '⬇ Đường (GeoJSON)', fn: function () {
        var gj = { type: 'FeatureCollection', features: feats.map(function (f) {
          return { type: 'Feature', geometry: f.geometry, properties: { gia_tri_mm: f.properties.value } };
        }) };
        xuatGeoJSON('RIMS_dangtri_duong_' + nhanTG() + '.geojson', gj);
      } }
    ]);
  }

  window.RIMS_dangKyTool('iso', function (el, c) {
    el.innerHTML =
      '<div class="tbx-fld"><label>Khoảng thời gian</label><select id="isoLoai">'
        + '<option value="tran_mua">Một trận mưa</option><option value="mua_mua">Mùa mưa (1/6–30/11)</option>'
        + '<option value="mot_nam">Một năm</option><option value="nhieu_nam">Nhiều năm</option>'
      + '</select></div>'
      + '<div id="isoTime"></div>'
      + '<div class="tbx-fld"><label>Phạm vi</label><select id="isoScope">'
        + '<option value="toanquoc">Toàn quốc</option><option value="luuvuc">Theo lưu vực (bấm bản đồ)</option>'
        + '<option value="tinh">Theo tỉnh…</option><option value="khungnhin">Trong khung nhìn</option>'
      + '</select></div>'
      + '<div id="isoScopeSub"></div>'
      + '<div class="tbx-fld"><label>Kiểu hiển thị</label><select id="isoKieu">'
        + '<option value="both">Màu + đường trị số</option><option value="fill">Chỉ tô màu</option><option value="line">Chỉ đường trị số</option>'
      + '</select></div>'
      + '<div class="tbx-fld tbx-two"><div style="flex:1"><label>Bước đường (mm)</label><input id="isoStep" placeholder="tự động"></div>'
        + '<div style="flex:1"><label>Nội suy</label><select id="isoMethod"><option>IDW</option></select></div></div>'
      + '<label class="tbx-hint" style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="isoQc" checked> Chỉ dùng trạm đạt QC (Bình thường)</label>'
      + '<button class="tbx-run" id="isoRun" style="margin-top:10px">Vẽ đẳng trị</button>'
      + '<div id="isoOut"></div>';

    var yNow = new Date().getUTCFullYear() - 1;
    var timeBox = el.querySelector('#isoTime');
    function veTime() {
      var l = el.querySelector('#isoLoai').value;
      if (l === 'tran_mua') timeBox.innerHTML = '<div class="tbx-fld tbx-two"><div style="flex:1"><label>Từ ngày</label><input type="date" id="isoFrom"></div><div style="flex:1"><label>Đến ngày</label><input type="date" id="isoTo"></div></div>';
      else if (l === 'mua_mua' || l === 'mot_nam') timeBox.innerHTML = '<div class="tbx-fld"><label>Năm</label><input type="number" id="isoYear" value="' + yNow + '"></div>';
      else timeBox.innerHTML = '<div class="tbx-fld tbx-two"><div style="flex:1"><label>Từ năm</label><input type="number" id="isoY1" value="' + (yNow - 4) + '"></div><div style="flex:1"><label>Đến năm</label><input type="number" id="isoY2" value="' + yNow + '"></div></div>'
        + '<div class="tbx-fld"><label>Hiển thị</label><label class="tbx-hint" style="display:inline-flex;gap:5px;margin-right:12px"><input type="radio" name="isoTB" value="tong" checked> Tổng tích luỹ</label><label class="tbx-hint" style="display:inline-flex;gap:5px"><input type="radio" name="isoTB" value="tb"> Trung bình năm</label></div>';
    }
    el.querySelector('#isoLoai').addEventListener('change', veTime); veTime();

    var subBox = el.querySelector('#isoScopeSub');
    el.querySelector('#isoScope').addEventListener('change', function (e) {
      qcClearSel(); el._lvChon = null;
      if (e.target.value === 'tinh') { subBox.innerHTML = ''; dungChonTinh(subBox); }
      else if (e.target.value === 'luuvuc') batChonLuuVuc(subBox, el, c);
      else subBox.innerHTML = '';
    });

    el.querySelector('#isoRun').addEventListener('click', function () {
      var out = el.querySelector('#isoOut'), btn = el.querySelector('#isoRun');
      var per = isoPeriod(el);
      if (!per) { out.innerHTML = '<div class="tbx-err">Chưa nhập đủ thời gian.</div>'; return; }
      var scVal = el.querySelector('#isoScope').value;
      var sc = scopeBboxPoly(scVal, el, subBox, c.map());
      if (!sc) { out.innerHTML = '<div class="tbx-flag">Chưa chọn ' + (scVal === 'tinh' ? 'tỉnh' : 'lưu vực') + '.</div>'; return; }
      var stepV = parseFloat(el.querySelector('#isoStep').value); if (!isFinite(stepV) || stepV <= 0) stepV = 0;
      var styleV = el.querySelector('#isoKieu').value;
      var qcFilter = el.querySelector('#isoQc').checked;
      var days = (new Date(per.end) - new Date(per.start)) / 86400000;
      var nguon = days < 3 ? viaRain : viaClassify;

      btn.disabled = true; btn.textContent = 'Đang lấy dữ liệu…';
      out.innerHTML = '<div class="tbx-hint">Đang lấy dữ liệu' + (days >= 3 ? ' (khoảng dài — có thể mất một lúc)…' : '…') + '</div>';
      function prog(msg) { out.innerHTML = '<div class="tbx-hint">' + esc(msg) + '</div>'; }

      Promise.all([nguon(per.start, per.end, sc.bbox, qcFilter, prog), taoMask(sc)])
        .then(function (arr) {
          var res = arr[0], mask = arr[1];
          btn.disabled = false; btn.textContent = 'Vẽ đẳng trị';
          if (!res.rows.length) { out.innerHTML = '<div class="tbx-err">Không có trạm nào có dữ liệu trong khoảng/phạm vi này.</div>'; return; }
          veIsohyet(res.rows, sc, { step: stepV, mode: per.mode, nYears: per.nYears, mask: mask, style: styleV }, out, c);
        })
        .catch(function (e) {
          btn.disabled = false; btn.textContent = 'Vẽ đẳng trị';
          out.innerHTML = '<div class="tbx-err">Không vẽ được: ' + esc(e && e.message || e) + '<br><br>Kiểm tra dịch vụ RainLab ở <code>127.0.0.1:8600</code>.</div>';
        });
    });
  });

  /* ═══════════════════════ RUỘT: MƯA BÌNH QUÂN LƯU VỰC ═══════════════════════
     Mưa bình quân diện tích (mm) cho MỘT/NHIỀU lưu vực. Bình quân theo Thiessen
     (mỗi ô lưới lấy trạm gần nhất → khỏi dựng Voronoi hình học), hoặc lưới IDW,
     hoặc TB số học. Chuỗi thời gian theo NGÀY (/v1/rain) / THÁNG · NĂM (classify
     tổng từng cửa sổ). QC ĐỘNG theo thời gian: tập trạm "Bình thường" tính lại
     cho từng bước (kế thừa viaClassify). Kết quả: choropleth + trị số + thang màu
     trên bản đồ; tấm nổi kéo được (Bảng sort + đồ thị cột nhóm/đường; lưu PNG+CSV).
     ─────────────────────────────────────────────────────────────────────────── */
  var MLV_STOPS = RAIN_STOPS;               // dùng lại bảng màu mưa
  /* Lọc lưu vực theo NHÓM công trình (gộp các loai_ct cùng bản chất). Chỉ 2 nhóm
     cần dùng; các loại lẻ được gộp vào nhóm tương ứng, không hiện riêng. */
  var LOAI_NHOM = [
    { id: 'td', ten: 'Hồ chứa thuỷ điện', loai: ['Hồ chứa TĐ', 'Thuỷ điện'] },
    { id: 'tl', ten: 'Hồ chứa thuỷ lợi', loai: ['Thuỷ lợi', 'Hồ chứa', 'Đập dâng'] }
  ];
  function mlvNfc(s) { s = String(s == null ? '' : s); return s.normalize ? s.normalize('NFC') : s; }
  function mlvLocFeats(fc, nhomId) {
    if (!nhomId) return fc.features;
    var nh = null; LOAI_NHOM.forEach(function (n) { if (n.id === nhomId) nh = n; });
    if (!nh) return fc.features;
    var set = {}; nh.loai.forEach(function (t) { set[mlvNfc(t)] = 1; });
    return fc.features.filter(function (f) { return set[mlvNfc((f.properties || {}).loai_ct)]; });
  }

  function injMlvCss() {
    if (document.getElementById('mlv-css')) return;
    var s = document.createElement('style'); s.id = 'mlv-css';
    s.textContent = ''
      + '.mlv-nhan{background:none!important;border:0!important;box-shadow:none!important;text-align:center;'
        + 'font:700 11px/13px system-ui,sans-serif;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff;pointer-events:none}'
      + '.mlv-nhan .v{font-weight:800}.mlv-nhan .n{font-weight:600;font-size:9px;opacity:.9}'
      + '.mlv-cbar{background:rgba(255,255,255,.93);border-radius:8px;padding:7px 9px;box-shadow:0 2px 8px rgba(0,0,0,.25);color:#28323a;font:600 10px system-ui,sans-serif}'
      + '.mlv-cbar .lh{font-weight:700;color:#12303a;margin-bottom:4px}'
      + '.mlv-cbar i{display:block;width:150px;height:11px;border-radius:3px;margin-bottom:2px}'
      + '.mlv-cbar .sc{display:flex;justify-content:space-between;width:150px;font-variant-numeric:tabular-nums}'
      + '.mlv-float{position:absolute;right:16px;bottom:16px;width:440px;max-width:72vw;background:var(--ink2);border:1px solid var(--tealL);'
        + 'border-radius:12px;box-shadow:0 14px 50px rgba(0,0,0,.55);z-index:900;overflow:hidden;display:flex;flex-direction:column}'
      + '.mlv-float .bar{display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--ink3);border-bottom:1px solid var(--line);cursor:grab;user-select:none}'
      + '.mlv-float .bar.drag{cursor:grabbing}'
      + '.mlv-float .bar .grip{color:var(--txt3);font-size:13px;letter-spacing:-1px}'
      + '.mlv-float .bar .t{flex:1;font-weight:700;font-size:12.5px;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '.mlv-float .bar .ic{width:22px;height:22px;border-radius:6px;border:1px solid var(--line);color:var(--txt2);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:13px}'
      + '.mlv-float .bar .ic:hover{border-color:var(--tealL);color:var(--txt)}'
      + '.mlv-tabs{display:flex;gap:2px;padding:8px 10px 0}'
      + '.mlv-tabs button{background:none;border:0;border-bottom:2px solid transparent;color:var(--txt3);font:inherit;font-size:12.5px;font-weight:700;padding:5px 10px;cursor:pointer}'
      + '.mlv-tabs button.on{color:var(--txt);border-bottom-color:var(--tealL)}'
      + '.mlv-body{padding:10px 12px 12px;overflow:auto;max-height:52vh}'
      + '.mlv-tbl{width:100%;border-collapse:collapse;font-size:11.5px}'
      + '.mlv-tbl th{text-align:left;color:var(--txt2);font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.03em;padding:5px 6px;border-bottom:1px solid var(--line);cursor:pointer;white-space:nowrap}'
      + '.mlv-tbl th .ar{color:var(--tealL);font-size:9px;margin-left:2px}'
      + '.mlv-tbl td{padding:5px 6px;border-bottom:1px solid rgba(39,70,80,.5)}'
      + '.mlv-tbl td.num{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}'
      + '.mlv-tbl tr{cursor:pointer}.mlv-tbl tr:hover td{background:rgba(70,179,181,.08)}'
      + '.mlv-sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px}'
      + '.mlv-chip{display:inline-block;padding:0 6px;border-radius:20px;font-size:9.5px;font-weight:700}'
      + '.mlv-chip.ok{background:rgba(62,158,107,.18);color:#7FD4A6}.mlv-chip.mid{background:rgba(200,129,63,.16);color:#E4C39C}.mlv-chip.low{background:rgba(196,69,63,.16);color:#E79892}'
      + '.mlv-ctrl{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}'
      + '.mlv-ctrl .lbl{font-size:10.5px;color:var(--txt3);font-weight:600}'
      + '.mlv-seg{display:flex;border:1px solid var(--line);border-radius:7px;overflow:hidden}'
      + '.mlv-seg button{background:var(--ink);color:var(--txt2);border:0;padding:5px 9px;font:inherit;font-size:11px;cursor:pointer;font-weight:600}'
      + '.mlv-seg button.on{background:var(--teal);color:#fff}'
      + '.mlv-leg{display:flex;gap:12px;flex-wrap:wrap;margin-top:6px;font-size:10.5px;color:var(--txt2)}'
      + '.mlv-leg span{display:flex;align-items:center;gap:5px}'
      + '.mlv-rz{position:absolute;right:2px;bottom:2px;color:var(--txt3);font-size:12px;cursor:nwse-resize;line-height:1}'
      + '.mlv-empty{color:var(--txt3);font-size:12px;padding:14px 4px;text-align:center}';
    document.head.appendChild(s);
  }

  function mauMlv(v, lo, hi) { return lerpPal((v - lo) / ((hi - lo) || 1)); }

  /* ── Danh sách các bước thời gian [{key,label,s,e}] ── */
  function mlvBuoc(start, end, buoc) {
    var out = [], S = new Date(start), E = new Date(end);
    function iso(d) { return d.toISOString(); }
    if (buoc === 'nam') {
      for (var y = S.getUTCFullYear(); y <= E.getUTCFullYear(); y++) {
        var a = new Date(Date.UTC(y, 0, 1)), b = new Date(Date.UTC(y + 1, 0, 1));
        if (b <= S || a >= E) continue;
        out.push({ key: String(y), label: String(y), s: iso(a < S ? S : a), e: iso(b > E ? E : b) });
      }
    } else if (buoc === 'thang') {
      var d = new Date(Date.UTC(S.getUTCFullYear(), S.getUTCMonth(), 1));
      while (d < E) {
        var nb = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
        var aa = d < S ? S : d, bb = nb > E ? E : nb;
        if (bb > aa) out.push({ key: d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2),
          label: ('0' + (d.getUTCMonth() + 1)).slice(-2) + '/' + d.getUTCFullYear(), s: iso(aa), e: iso(bb) });
        d = nb;
      }
    } else { /* ngay */
      var t = new Date(Date.UTC(S.getUTCFullYear(), S.getUTCMonth(), S.getUTCDate()));
      while (t < E) {
        var n2 = new Date(t.getTime() + 86400000);
        out.push({ key: t.toISOString().slice(0, 10), label: ('0' + t.getUTCDate()).slice(-2) + '/' + ('0' + (t.getUTCMonth() + 1)).slice(-2), s: iso(t), e: iso(n2 > E ? E : n2) });
        t = n2;
      }
    }
    return out;
  }

  /* Tập trạm "Bình thường" CỐ ĐỊNH cho cả khoảng (QC không động): bình thường ở
     ≥ một nửa số cửa sổ ≤31 ngày của khoảng. Trả Promise<{id:1}> hoặc null. */
  function mlvFixedSet(start, end, bbox, prog) {
    var wins = chiaCuaSo(start, end), cnt = {}, n = wins.length;
    return wins.reduce(function (p, w, i) {
      return p.then(function () {
        if (prog) prog('Xác định tập trạm QC cố định · ' + (i + 1) + '/' + n + '…');
        var qs = 'start=' + encodeURIComponent(w[0]) + '&end=' + encodeURIComponent(w[1]) + '&bbox=' + bbox + '&condition=binh_thuong&limit=20000';
        return callRL('/api/rainlab/v1/stations/classify?' + qs).then(function (j) {
          (j.data || []).forEach(function (d) { cnt[d.station_id] = (cnt[d.station_id] || 0) + 1; }); }).catch(function () {});
      });
    }, Promise.resolve()).then(function () {
      var need = Math.ceil(n / 2), set = {}; Object.keys(cnt).forEach(function (id) { if (cnt[id] >= need) set[id] = 1; }); return set;
    });
  }

  /* Rows/bước cho THÁNG·NĂM qua classify (tổng gauge_mm/cửa sổ).
     qcDyn=true → lọc "Bình thường" theo TỪNG bước (động); qcDyn=false → lấy mọi
     trạm rồi giữ theo tập cố định của cả khoảng. */
  function mlvRowsClassify(steps, bbox, qcFilter, qcDyn, prog) {
    var pre = (qcFilter && !qcDyn) ? mlvFixedSet(steps[0].s, steps[steps.length - 1].e, bbox, prog) : Promise.resolve(null);
    return pre.then(function (fixed) {
      var perWin = qcFilter && qcDyn;                 // viaClassify tự lọc binh_thuong theo cửa sổ
      return steps.reduce(function (p, st, i) {
        return p.then(function (acc) {
          if (prog) prog('Đang lấy dữ liệu · bước ' + (i + 1) + '/' + steps.length + '…');
          return viaClassify(st.s, st.e, bbox, perWin, null).then(function (r) {
            var rows = r.rows; if (fixed) rows = rows.filter(function (x) { return fixed[x.id]; }); acc.push(rows); return acc; });
        });
      }, Promise.resolve([]));
    });
  }

  /* Rows/bước cho NGÀY: /v1/rain theo ngày + QC theo cửa sổ ≤31 ngày bao trọn. */
  function mlvRowsNgay(steps, bbox, qcFilter, qcDyn, prog) {
    if (!bbox) return Promise.reject(new Error('Bước Ngày cần một phạm vi vùng (đã có lưu vực chọn nên luôn có bbox).'));
    var dayKeys = steps.map(function (s) { return s.key; });
    var idxByKey = {}; dayKeys.forEach(function (k, i) { idxByKey[k] = i; });
    var meta = {};                                    // station_id -> {lon,lat}
    var fixedSet = null;                              // tập cố định (qcDyn=false)
    // 1) QC windows: mỗi cửa sổ ≤31 ngày → tập trạm Bình thường; map ngày -> set
    var okByDay = null;
    function buildQc() {
      if (!qcFilter) return Promise.resolve();
      if (!qcDyn) { return mlvFixedSet(steps[0].s, steps[steps.length - 1].e, bbox, prog).then(function (s) { fixedSet = s; }); }
      okByDay = {};
      var wins = chiaCuaSo(steps[0].s, steps[steps.length - 1].e);
      return wins.reduce(function (p, w) {
        return p.then(function () {
          var qs = 'start=' + encodeURIComponent(w[0]) + '&end=' + encodeURIComponent(w[1]) + '&bbox=' + bbox + '&condition=binh_thuong&limit=20000';
          return callRL('/api/rainlab/v1/stations/classify?' + qs).then(function (j) {
            var set = {}; (j.data || []).forEach(function (d) { set[d.station_id] = 1; });
            var ws = new Date(w[0]), we = new Date(w[1]);
            for (var t = new Date(ws); t < we; t = new Date(t.getTime() + 86400000)) { okByDay[t.toISOString().slice(0, 10)] = set; }
          }).catch(function () {});
        });
      }, Promise.resolve());
    }
    // 2) meta trạm
    function loadMeta() {
      return callRL('/api/rainlab/v1/stations?bbox=' + bbox + '&limit=20000')
        .then(function (j) { (j.data || []).forEach(function (s) { meta[s.station_id] = { lon: +s.lon, lat: +s.lat }; }); })
        .catch(function () {});
    }
    // 3) rain phân trang → gom (trạm, ngày)
    function dayOf(d) { var v = d.date || d.day || d.time || d.ts || d.datetime || ''; return String(v).slice(0, 10); }
    return Promise.all([buildQc(), loadMeta()]).then(function () {
      if (prog) prog('Đang lấy mưa ngày…');
      var rowsByStep = steps.map(function () { return {}; });   // idx -> {id:{lon,lat,total}}
      var base = '/api/rainlab/v1/rain?start=' + encodeURIComponent(steps[0].s) + '&end=' + encodeURIComponent(steps[steps.length - 1].e) + '&bbox=' + bbox + '&limit=100000';
      function page(cursor) {
        return callRL(base + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '')).then(function (j) {
          (j.data || []).forEach(function (d) {
            var dk = dayOf(d), i = idxByKey[dk]; if (i == null) return;
            if (d.rain == null || !isFinite(+d.rain)) return;
            if (qcFilter) { if (fixedSet) { if (!fixedSet[d.station_id]) return; } else if (okByDay) { var set = okByDay[dk]; if (!set || !set[d.station_id]) return; } }
            var m = meta[d.station_id]; if (!m || !isFinite(m.lon)) return;
            var bag = rowsByStep[i], a = bag[d.station_id] || (bag[d.station_id] = { id: d.station_id, lon: m.lon, lat: m.lat, total: 0 });
            a.total += (+d.rain);
          });
          if (j.next_cursor) return page(j.next_cursor);
        });
      }
      return page(null).then(function () {
        return rowsByStep.map(function (bag) { return Object.keys(bag).map(function (k) { return bag[k]; }); });
      });
    });
  }

  /* Ô lưới tâm nằm trong ranh lưu vực (tính 1 lần / lưu vực). */
  function mlvCells(geom, target) {
    target = target || 2200;
    var b = bboxGeom(geom), wLon = b[2] - b[0], hLat = b[3] - b[1];
    var aspect = (hLat / (wLon || 1e-6)) || 1;
    var W = Math.max(6, Math.min(90, Math.round(Math.sqrt(target / aspect))));
    var H = Math.max(8, Math.min(150, Math.round(W * aspect)));
    var pw = wLon / (W - 1 || 1), ph = hLat / (H - 1 || 1), cells = [];
    for (var gy = 0; gy < H; gy++) { var la = b[3] - gy * ph;
      for (var gx = 0; gx < W; gx++) { var lo = b[0] + gx * pw; if (pipGeom(lo, la, geom)) cells.push([lo, la]); } }
    if (!cells.length) cells.push([(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]);
    return cells;
  }

  /* Mưa bình quân diện tích trên tập ô, theo phương pháp. rows=[{id,lon,lat,total}].
     occ[id] = số ô mà trạm id CHIẾM HỮU (là gần nhất) trong lưu vực — kể cả trạm
     nằm NGOÀI ranh nhưng đa giác Thiessen cắt vào (công bằng: có chiếm hữu thì được đếm).
     nTouch = số trạm có đóng góp; nEff = số trạm HIỆU DỤNG = 1/Σ(tỉ lệ chiếm hữu)²
     (trạm chiếm nhiều diện tích tính đủ, trạm liếm rìa gần như không tính).
     rad2 = bán kính phủ² (độ²): ô cách trạm gần nhất > bán kính này thì KHÔNG tính
     (trạm quá xa không đại diện — lưu vực nhỏ dùng bán kính chặt để khỏi lôi trạm xa vào).
     pctPhu = tỉ lệ ô trong lưu vực thực sự được phủ (cnt/tổng ô).
     Trả {mm, min, max, nTouch, nEff, pctPhu} (null nếu không đủ dữ liệu). */
  var MLV_OCC_MIN = 0.10;   // trạm chiếm hữu < 10% diện tích của trạm chiếm nhiều nhất → coi như KHÔNG đóng góp → loại
  /* Bán kính phủ (độ) theo kích thước lưu vực: ~0.9× bán kính tương đương, kẹp [0.06°(~7km), 0.7°(~78km)].
     Lưu vực nhỏ → bán kính chặt (khỏi lôi trạm xa vào Thiessen); lớn → rộng (dùng cả trạm sát ranh, kể cả bên Lào). */
  var MLV_RAD_FACTOR = 0.9, MLV_RAD_MIN = 0.06, MLV_RAD_MAX = 0.7;
  function mlvRadDeg(dt) { var rEq = Math.sqrt((dt || 1) / Math.PI) / 111; return Math.min(MLV_RAD_MAX, Math.max(MLV_RAD_MIN, rEq * MLV_RAD_FACTOR)); }
  function mlvBinhQuan(cells, rows, geom, method, rad2) {
    if (!rows || !rows.length) return null;
    rad2 = rad2 || 0.49;
    if (method === 'mean') {
      var s = 0, n = 0, mn = Infinity, mx = -Infinity;
      rows.forEach(function (r) { if (pipGeom(r.lon, r.lat, geom)) { s += r.total; n++; if (r.total < mn) mn = r.total; if (r.total > mx) mx = r.total; } });
      if (!n) return null;
      return { mm: s / n, min: mn, max: mx, nTouch: n, nEff: n, pctPhu: 1 };   // TB số học: các trạm trong ranh
    }
    // Một lượt gán ô→trạm gần nhất (trong bán kính) → tổng, đếm ô chiếm hữu mỗi trạm.
    function pass(rs) {
      var sum = 0, cnt = 0, vmin = Infinity, vmax = -Infinity, occ = {};
      for (var c = 0; c < cells.length; c++) {
        var lo = cells[c][0], la = cells[c][1], val = null, cid = null;
        if (method === 'idw') {
          var num = 0, den = 0, near = Infinity, exact = null, nId = null;
          for (var i = 0; i < rs.length; i++) { var dx = lo - rs[i].lon, dy = la - rs[i].lat, d2 = dx * dx + dy * dy;
            if (d2 < near) { near = d2; nId = rs[i].id; }
            if (d2 < 1e-10) { exact = rs[i].total; break; }
            var w = 1 / d2; num += w * rs[i].total; den += w; }
          if (exact == null && near > rad2) continue;
          val = exact != null ? exact : (den > 0 ? num / den : null); cid = nId;
        } else {
          var best = Infinity, bId = null, bVal = null;
          for (var j = 0; j < rs.length; j++) { var ex = lo - rs[j].lon, ey = la - rs[j].lat, e2 = ex * ex + ey * ey;
            if (e2 < best) { best = e2; bId = rs[j].id; bVal = rs[j].total; } }
          if (best > rad2) continue;
          val = bVal; cid = bId;
        }
        if (val == null || !isFinite(val)) continue;
        sum += val; cnt++; if (val < vmin) vmin = val; if (val > vmax) vmax = val;
        if (cid != null) occ[cid] = (occ[cid] || 0) + 1;
      }
      return cnt ? { sum: sum, cnt: cnt, vmin: vmin, vmax: vmax, occ: occ } : null;
    }
    var p1 = pass(rows); if (!p1) return null;
    // LOẠI trạm chiếm hữu không đáng kể (≈0) so với trạm chiếm nhiều nhất, rồi tính lại — chỉ
    // trạm có tỷ lệ chiếm hữu Thiessen thực sự mới được đếm (đúng nguyên tắc: chiếm hữu 0 thì loại).
    var maxo = 0; Object.keys(p1.occ).forEach(function (id) { if (p1.occ[id] > maxo) maxo = p1.occ[id]; });
    var thr = maxo * MLV_OCC_MIN, keep = {}; Object.keys(p1.occ).forEach(function (id) { if (p1.occ[id] >= thr) keep[id] = 1; });
    var kept = rows.filter(function (r) { return keep[r.id]; });
    var p = (kept.length && kept.length < rows.length) ? (pass(kept) || p1) : p1;
    var ids = Object.keys(p.occ), sumsq = 0;
    ids.forEach(function (id) { var q = p.occ[id] / p.cnt; sumsq += q * q; });
    return { mm: p.sum / p.cnt, min: p.vmin, max: p.vmax, nTouch: ids.length, nEff: sumsq > 0 ? 1 / sumsq : 0,
      pctPhu: cells.length ? p.cnt / cells.length : 0 };
  }

  /* Độ tin cậy theo CHUẨN mật độ trạm mưa: mục tiêu VN ~80 km²/trạm, WMO vùng núi
     100–250 km²/trạm → lấy 100 km²/trạm hiệu dụng làm mức "Đạt". Dùng nEff (số trạm
     hiệu dụng theo diện tích chiếm hữu) để một trạm gánh cả lưu vực lớn không bị coi là đủ. */
  /* Chuẩn mật độ trạm PHỤ THUỘC ĐỊA HÌNH (WMO): đồng bằng 900, đồi/trung du 575,
     núi 250 km²/trạm. Phân lớp theo relief_m (biên độ cao độ p95-p5 trong lưu vực,
     tính sẵn từ DEM & gắn vào luuvuc.geojson). Thiếu relief → suy theo loại công trình. */
  var MLV_RELIEF_DOI = 200, MLV_RELIEF_NUI = 600;
  function mlvDiaHinh(props) {
    var r = props && props.relief_m;
    if (r != null && isFinite(r)) {
      if (r >= MLV_RELIEF_NUI) return { ten: 'núi', kmDat: 250 };
      if (r >= MLV_RELIEF_DOI) return { ten: 'đồi', kmDat: 575 };
      return { ten: 'đồng bằng', kmDat: 900 };
    }
    var lc = mlvNfc((props || {}).loai_ct);
    if (lc === 'Hồ chứa TĐ' || lc === 'Thuỷ điện') return { ten: 'núi', kmDat: 250 };
    if (lc === 'Thuỷ lợi' || lc === 'Hồ chứa' || lc === 'Đập dâng') return { ten: 'đồi', kmDat: 575 };
    return { ten: 'đồng bằng', kmDat: 900 };
  }
  function mlvTinCay(nEff, dtKm2, qcOk, kmDat, pctPhu) {
    kmDat = kmDat || 250;
    var kmPer = (nEff > 0 && dtKm2 > 0) ? dtKm2 / nEff : Infinity, k, ten;
    if (nEff < 1.5 || kmPer > kmDat * 3) { k = 'low'; ten = 'Chưa đạt'; }
    else if (kmPer <= kmDat) { k = 'ok'; ten = 'Đạt'; }
    else { k = 'mid'; ten = 'Gần đạt'; }
    function ha() { if (k === 'ok') { k = 'mid'; ten = 'Gần đạt'; } else if (k === 'mid') { k = 'low'; ten = 'Chưa đạt'; } }
    if (pctPhu != null && pctPhu < 0.6) ha();   // phần lớn diện tích xa mọi trạm (phủ kém) → hạ
    var qcHa = (qcOk === false);                // dùng cả trạm lỗi (chưa lọc QC) → hạ
    if (qcHa) ha();
    return { k: k, ten: ten, kmPer: kmPer, qcHa: qcHa };
  }

  /* Chế độ KIỂM CHỨNG: vẽ đa giác Thiessen trên lưu vực. Có d3-delaunay → đa giác Voronoi
     cạnh THẲNG (chuẩn nhà thuỷ văn), cắt hiển thị theo ranh lưu vực; không có → rơi về lưới ô.
     Trạm giữ = chấm màu; trạm bị loại (chiếm hữu ~0) = chấm xám. Trạm giữ/màu/loại xác định
     bằng ĐÚNG lưới/bán kính/luật-loại của phép tính. */
  function mlvVeThiessen(x, rows, c) {
    var map = c.map(); if (!map || !window.L || !x || !x.f) return;
    if (!rows || !rows.length) { window.RIMS_toolKetQua.xoa('mua_lv_th'); return; }
    var geom = x.f.geometry, dt = x.dt || 1, b = bboxGeom(geom), wLon = b[2] - b[0], hLat = b[3] - b[1];
    var aspect = (hLat / (wLon || 1e-6)) || 1, target = 1400;
    var W = Math.max(6, Math.min(120, Math.round(Math.sqrt(target / aspect))));
    var H = Math.max(8, Math.min(180, Math.round(W * aspect)));
    var pw = wLon / (W - 1 || 1), ph = hLat / (H - 1 || 1);
    var rad = mlvRadDeg(dt), rad2 = rad * rad;
    var cells = [];
    for (var gy = 0; gy < H; gy++) { var la = b[3] - gy * ph; for (var gx = 0; gx < W; gx++) { var lo = b[0] + gx * pw; if (pipGeom(lo, la, geom)) cells.push([lo, la]); } }
    function nearest(rs, lo, la) { var best = Infinity, id = null; for (var i = 0; i < rs.length; i++) { var dx = lo - rs[i].lon, dy = la - rs[i].lat, d2 = dx * dx + dy * dy; if (d2 < best) { best = d2; id = rs[i].id; } } return best <= rad2 ? id : null; }
    var occ1 = {}; cells.forEach(function (cc) { var id = nearest(rows, cc[0], cc[1]); if (id != null) occ1[id] = (occ1[id] || 0) + 1; });
    var maxo = 0; Object.keys(occ1).forEach(function (id) { if (occ1[id] > maxo) maxo = occ1[id]; });
    var thr = maxo * MLV_OCC_MIN, keep = {}; Object.keys(occ1).forEach(function (id) { if (occ1[id] >= thr) keep[id] = 1; });
    var kept = rows.filter(function (r) { return keep[r.id]; });
    var ids = Object.keys(keep), col = {}; ids.forEach(function (id, i) { col[id] = 'hsl(' + ((i * 57) % 360) + ',65%,55%)'; });
    var rend = L.canvas(), grp = L.layerGroup(), occ2 = {};
    cells.forEach(function (cc) { var id = nearest(kept, cc[0], cc[1]); if (id != null) occ2[id] = (occ2[id] || 0) + 1; });
    if (window.d3 && d3.Delaunay && kept.length >= 1) {
      // ĐA GIÁC VORONOI THẬT (cạnh thẳng) — cắt hiển thị theo ranh lưu vực bằng mặt nạ khoét lỗ (SVG evenodd)
      var rsvg = L.svg(), pad2 = Math.max(0.2, rad * 2);
      var del = d3.Delaunay.from(kept, function (s) { return s.lon; }, function (s) { return s.lat; });
      var vor = del.voronoi([b[0] - pad2, b[1] - pad2, b[2] + pad2, b[3] + pad2]);
      kept.forEach(function (s, i) { var poly = vor.cellPolygon(i); if (!poly) return;
        L.polygon(poly.map(function (p) { return [p[1], p[0]]; }), { renderer: rsvg, stroke: true, color: '#ffffff', weight: 0.8,
          fill: true, fillColor: col[s.id], fillOpacity: 0.5, interactive: false }).addTo(grp); });
      var outer = [[b[1] - pad2, b[0] - pad2], [b[1] - pad2, b[2] + pad2], [b[3] + pad2, b[2] + pad2], [b[3] + pad2, b[0] - pad2]];
      var gg = geom.type === 'Polygon' ? [geom.coordinates] : (geom.type === 'MultiPolygon' ? geom.coordinates : []);
      var holes = gg.map(function (poly) { return poly[0].map(function (p) { return [p[1], p[0]]; }); });
      L.polygon([outer].concat(holes), { renderer: rsvg, stroke: false, fill: true, fillColor: '#eef1f2', fillOpacity: 0.96, interactive: false }).addTo(grp);
    } else {
      cells.forEach(function (cc) { var lo = cc[0], la = cc[1], id = nearest(kept, lo, la);
        L.rectangle([[la - ph / 2, lo - pw / 2], [la + ph / 2, lo + pw / 2]], { renderer: rend, stroke: false, fill: true,
          fillColor: id != null ? col[id] : '#aab4b7', fillOpacity: id != null ? 0.55 : 0.22, interactive: false }).addTo(grp); });
    }
    L.geoJSON(x.f, { interactive: false, style: { color: '#12303a', weight: 2, fill: false } }).addTo(grp);
    rows.forEach(function (s) { var isk = !!keep[s.id], pct = Math.round(100 * (occ2[s.id] || 0) / (cells.length || 1));
      L.circleMarker([s.lat, s.lon], { renderer: rend, radius: isk ? 6 : 3, color: '#0a1216', weight: 1,
        fillColor: isk ? col[s.id] : '#7d8a8f', fillOpacity: isk ? 1 : 0.5 })
        .bindTooltip(esc(s.id) + (isk ? ' · chiếm ' + pct + '% lưu vực' : ' · loại (chiếm hữu ~0)'), { direction: 'top' }).addTo(grp); });
    grp.addTo(map);
    window.RIMS_toolKetQua.them('mua_lv_th', 'Chia Thiessen · ' + x.ten + ' (' + ids.length + ' trạm)', function () { if (map.hasLayer(grp)) map.removeLayer(grp); });
    try { map.fitBounds([[b[1], b[0]], [b[3], b[2]]], { animate: true, maxZoom: 11, padding: [30, 30] }); } catch (e) {}
  }

  /* ── Vẽ choropleth + trị số + thang màu lên bản đồ ── */
  function mlvVeBanDo(state, c) {
    var kq = state.kq;
    var map = c.map(); if (!map || !window.L) return;
    injIsoNhanCss(); injMlvCss();
    var vals = kq.map(function (x) { return x.mm; }).filter(function (v) { return v != null && isFinite(v); });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    var grp = L.layerGroup(), bnds = [];
    kq.forEach(function (x) {
      if (!x.f || !x.f.geometry) return;
      var mau = (x.mm == null) ? '#5b6a70' : mauMlv(x.mm, lo, hi);
      var low = x.tin && x.tin.k === 'low';
      var poly = L.geoJSON(x.f, { style: { color: low ? '#C4453F' : '#2E8C8F', weight: low ? 2 : 1.2, dashArray: low ? '5 3' : null, fillColor: mau, fillOpacity: 0.55 } });
      poly.bindTooltip(x.ten + ' · ' + (x.mm == null ? '–' : so(Math.round(x.mm)) + ' mm'), { sticky: true });
      poly.on('click', function () { if (state.show) state.show(x.ma); });
      grp.addLayer(poly);
      var b = bboxGeom(x.f.geometry); bnds.push([[b[1], b[0]], [b[3], b[2]]]);
      var cLat = (b[1] + b[3]) / 2, cLon = (b[0] + b[2]) / 2;
      var html = '<div class="v" style="color:#10222a">' + (x.mm == null ? '–' : so(Math.round(x.mm)) + ' mm') + '</div><div class="n" style="color:#25333b">' + esc(x.ten) + (low ? ' ⚠' : '') + '</div>';
      grp.addLayer(L.marker([cLat, cLon], { interactive: false, keyboard: false,
        icon: L.divIcon({ className: 'mlv-nhan', html: html, iconSize: [96, 26], iconAnchor: [48, 13] }) }));
    });
    // thang màu (Leaflet control)
    var cbar = L.control({ position: 'topright' });
    cbar.onAdd = function () {
      var div = L.DomUtil.create('div', 'mlv-cbar');
      var grad = MLV_STOPS.map(function (s, i) { return 'rgb(' + s.join(',') + ') ' + Math.round(i / (MLV_STOPS.length - 1) * 100) + '%'; }).join(',');
      div.innerHTML = '<div class="lh">Mưa (mm)</div><i style="background:linear-gradient(90deg,' + grad + ')"></i>'
        + '<div class="sc"><span>' + so(Math.round(lo)) + '</span><span>' + so(Math.round((lo + hi) / 2)) + '</span><span>' + so(Math.round(hi)) + '</span></div>';
      return div;
    };
    cbar.addTo(map);
    grp.addTo(map);
    if (bnds.length) { var all = bnds.reduce(function (a, x) { return a ? [[Math.min(a[0][0], x[0][0]), Math.min(a[0][1], x[0][1])], [Math.max(a[1][0], x[1][0]), Math.max(a[1][1], x[1][1])]] : x; }, null);
      try { map.fitBounds(all, { animate: false, maxZoom: 10, padding: [30, 30] }); } catch (e) {} }
    window.RIMS_toolKetQua.them('mua_lv', 'Mưa BQ lưu vực (' + so(kq.length) + ')', function () {
      if (map.hasLayer(grp)) map.removeLayer(grp); try { map.removeControl(cbar); } catch (e) {} });
    return { lo: lo, hi: hi };
  }

  /* ── Đồ thị chuỗi (SVG): cột nhóm hoặc đường ── */
  function mlvChartSVG(steps, kq, kieu, w, h) {
    w = w || 400; h = h || 180; var padL = 38, padB = 22, padT = 10, padR = 8;
    var iw = w - padL - padR, ih = h - padT - padB, ns = steps.length, nb = kq.length;
    var vmax = 0; kq.forEach(function (x) { x.chuoi.forEach(function (v) { if (v != null && v > vmax) vmax = v; }); });
    vmax = vmax || 1; var niceMax = Math.ceil(vmax / Math.pow(10, Math.floor(Math.log(vmax) / Math.LN10))) * Math.pow(10, Math.floor(Math.log(vmax) / Math.LN10));
    var Y = function (v) { return padT + ih - (v / niceMax) * ih; };
    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:auto">';
    // trục
    svg += '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (padT + ih) + '" stroke="#274650"/>';
    svg += '<line x1="' + padL + '" y1="' + (padT + ih) + '" x2="' + (padL + iw) + '" y2="' + (padT + ih) + '" stroke="#274650"/>';
    [0, 0.5, 1].forEach(function (t) { var yv = niceMax * t; svg += '<text x="' + (padL - 4) + '" y="' + (Y(yv) + 3) + '" text-anchor="end" fill="#6B7E84" font-size="8">' + so(Math.round(yv)) + '</text>'; });
    var bw = iw / ns;
    if (kieu === 'duong') {
      kq.forEach(function (x) { var pts = x.chuoi.map(function (v, i) { return (padL + bw * (i + 0.5)) + ',' + (v == null ? (padT + ih) : Y(v)); }).join(' ');
        svg += '<polyline fill="none" stroke="' + x.mau + '" stroke-width="2" points="' + pts + '"/>'; });
    } else {
      var gap = 2, gw = (bw - gap * 2) / (nb || 1), cw = Math.max(1, gw * 0.82);
      steps.forEach(function (st, i) { kq.forEach(function (x, b) { var v = x.chuoi[i]; if (v == null) return;
        var xx = padL + bw * i + gap + b * gw, yy = Y(v);
        svg += '<rect x="' + xx.toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + cw.toFixed(1) + '" height="' + (padT + ih - yy).toFixed(1) + '" fill="' + x.mau + '"/>'; }); });
    }
    // nhãn trục X (thưa nếu quá nhiều)
    var stepLbl = Math.ceil(ns / 8);
    steps.forEach(function (st, i) { if (i % stepLbl) return; svg += '<text x="' + (padL + bw * (i + 0.5)).toFixed(1) + '" y="' + (h - 6) + '" text-anchor="middle" fill="#9FB0B5" font-size="8">' + esc(st.label) + '</text>'; });
    svg += '</svg>';
    return svg;
  }

  /* Vẽ đồ thị ra canvas để LƯU PNG (nền tối, giống hiển thị). */
  function mlvChartPNG(steps, kq, kieu, tieude) {
    var W = 900, H = 460, SS = 2, padL = 70, padB = 60, padT = 54, padR = 24;
    var cv = document.createElement('canvas'); cv.width = W * SS; cv.height = H * SS;
    var ctx = cv.getContext('2d'); ctx.scale(SS, SS);
    ctx.fillStyle = '#0E1A1E'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#E6EDEF'; ctx.font = '700 16px system-ui,sans-serif'; ctx.fillText(tieude || 'Mưa bình quân lưu vực', padL, 26);
    ctx.fillStyle = '#6B7E84'; ctx.font = '400 11px system-ui,sans-serif'; ctx.fillText('RIMS · RainLab (WeatherPlus) · ' + ngayVN(), padL, 44);
    var iw = W - padL - padR, ih = H - padT - padB, ns = steps.length, nb = kq.length;
    var vmax = 0; kq.forEach(function (x) { x.chuoi.forEach(function (v) { if (v != null && v > vmax) vmax = v; }); });
    vmax = vmax || 1; var mag = Math.pow(10, Math.floor(Math.log(vmax) / Math.LN10)); var niceMax = Math.ceil(vmax / mag) * mag;
    var Y = function (v) { return padT + ih - (v / niceMax) * ih; };
    ctx.strokeStyle = '#274650'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + ih); ctx.lineTo(padL + iw, padT + ih); ctx.stroke();
    ctx.fillStyle = '#9FB0B5'; ctx.font = '400 11px system-ui,sans-serif'; ctx.textAlign = 'right';
    [0, 0.25, 0.5, 0.75, 1].forEach(function (t) { var yv = niceMax * t; ctx.fillText(so(Math.round(yv)), padL - 6, Y(yv) + 4);
      ctx.strokeStyle = 'rgba(39,70,80,.5)'; ctx.beginPath(); ctx.moveTo(padL, Y(yv)); ctx.lineTo(padL + iw, Y(yv)); ctx.stroke(); });
    var bw = iw / ns;
    if (kieu === 'duong') {
      kq.forEach(function (x) { ctx.strokeStyle = x.mau; ctx.lineWidth = 2.2; ctx.beginPath(); var started = false;
        x.chuoi.forEach(function (v, i) { if (v == null) return; var px = padL + bw * (i + 0.5), py = Y(v); if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py); }); ctx.stroke(); });
    } else {
      var gap = 3, gw = (bw - gap * 2) / (nb || 1), cw = Math.max(1, gw * 0.82);
      steps.forEach(function (st, i) { kq.forEach(function (x, b) { var v = x.chuoi[i]; if (v == null) return; var xx = padL + bw * i + gap + b * gw, yy = Y(v); ctx.fillStyle = x.mau; ctx.fillRect(xx, yy, cw, padT + ih - yy); }); });
    }
    ctx.fillStyle = '#9FB0B5'; ctx.font = '400 11px system-ui,sans-serif'; ctx.textAlign = 'center';
    var stepLbl = Math.ceil(ns / 12);
    steps.forEach(function (st, i) { if (i % stepLbl) return; ctx.fillText(st.label, padL + bw * (i + 0.5), padT + ih + 16); });
    // chú giải
    ctx.textAlign = 'left'; var lx = padL, ly = H - 22;
    kq.forEach(function (x) { ctx.fillStyle = x.mau; ctx.fillRect(lx, ly - 9, 12, 12); ctx.fillStyle = '#C7D2D5'; ctx.font = '600 11px system-ui,sans-serif';
      ctx.fillText(x.ten, lx + 16, ly + 1); lx += 20 + ctx.measureText(x.ten).width + 14; });
    cv.toBlob(function (b) { if (b) taiFile('RIMS_muaLV_dothi_' + nhanTG() + '.png', b); }, 'image/png');
  }

  /* ── Tấm kết quả nổi (kéo/thu/đóng) ── */
  function mlvMoTamNoi(state, c) {
    injMlvCss();
    var mapEl = document.getElementById('map'); if (!mapEl) return;
    var old = mapEl.querySelector('.mlv-float'); if (old) old.remove();
    var box = document.createElement('div'); box.className = 'mlv-float';
    box.innerHTML =
      '<div class="bar"><span class="grip">⠿</span><span class="t">Kết quả · ' + so(state.kq.length) + ' ' + esc(state.tenLoai || 'lưu vực') + ' · ' + esc(state.tenKhoang) + '</span>'
        + '<span class="ic" data-min title="Thu gọn">–</span><span class="ic" data-close title="Đóng">✕</span></div>'
      + '<div class="mlv-tabs"><button data-tab="bang" class="on">Bảng</button><button data-tab="do">Đồ thị</button></div>'
      + '<div class="mlv-body" id="mlvBody"></div><span class="mlv-rz">◢</span>';
    mapEl.appendChild(box);
    if (window.L && L.DomEvent) { L.DomEvent.disableClickPropagation(box); L.DomEvent.disableScrollPropagation(box); }
    var body = box.querySelector('#mlvBody'), curTab = state._wantTab || 'bang', sortKey = 'mm', sortDir = -1;
    state._wantTab = null;

    function veBang() {
      var rows = state.kq.slice().sort(function (a, b) {
        var va = sortKey === 'ten' ? a.ten : (sortKey === 'so' ? a.nTouch : a.mm);
        var vb = sortKey === 'ten' ? b.ten : (sortKey === 'so' ? b.nTouch : b.mm);
        if (sortKey === 'ten') return sortDir * String(va).localeCompare(String(vb), 'vi');
        return sortDir * ((va || 0) - (vb || 0));
      });
      function ar(k) { return sortKey === k ? '<span class="ar">' + (sortDir < 0 ? '▼' : '▲') + '</span>' : ''; }
      var h = '<table class="mlv-tbl"><thead><tr>'
        + '<th data-s="ten">' + esc(mlvCap(state.tenLoai)) + ar('ten') + '</th>'
        + '<th data-s="mm" style="text-align:right">Mưa (mm)' + ar('mm') + '</th>'
        + '<th data-s="so" style="text-align:right">Trạm' + ar('so') + '</th>'
        + '<th style="text-align:right">Tin cậy</th></tr></thead><tbody>';
      rows.forEach(function (x) {
        h += '<tr data-ma="' + esc(x.ma) + '"><td><span class="mlv-sw" style="background:' + x.mau + '"></span>' + esc(x.ten) + '</td>'
          + '<td class="num"' + (x.tin.k === 'low' ? ' style="color:#E79892"' : '') + '>' + (x.mm == null ? '–' : so(Math.round(x.mm))) + '</td>'
          + '<td class="num">' + so(x.nTouch) + '</td>'
          + '<td class="num"><span class="mlv-chip ' + x.tin.k + '">' + x.tin.ten + '</span></td></tr>';
      });
      h += '</tbody></table>'
        + '<div class="mlv-ctrl" style="margin-top:10px"><button class="tbx-xbtn" data-x="anh">📷 Chụp bản đồ</button><button class="tbx-xbtn" data-x="csvbang">⬇ Bảng (CSV)</button><button class="tbx-xbtn" data-x="csvall">⬇ Chuỗi tất cả (CSV)</button></div>';
      body.innerHTML = h;
      body.querySelectorAll('th[data-s]').forEach(function (th) { th.addEventListener('click', function () {
        var k = th.dataset.s; if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = k === 'ten' ? 1 : -1; } veBang(); }); });
      body.querySelectorAll('tr[data-ma]').forEach(function (tr) { tr.addEventListener('click', function () { state.active = tr.dataset.ma; mlvNhayLuuVuc(tr.dataset.ma, state, c); goTab('do'); }); });
      body.querySelector('[data-x=anh]').addEventListener('click', function () { mlvChupBanDo(state, c); });
      body.querySelector('[data-x=csvbang]').addEventListener('click', function () { mlvXuatBangCSV(state); });
      body.querySelector('[data-x=csvall]').addEventListener('click', function () { mlvXuatChuoiCSV(state); });
    }

    function veDo() {
      var act = null; state.kq.forEach(function (x) { if (x.ma === state.active) act = x; });
      if (!act) { act = state.kq[0]; state.active = act ? act.ma : null; }
      var opts = state.kq.map(function (x) { return '<option value="' + esc(x.ma) + '"' + (act && x.ma === act.ma ? ' selected' : '') + '>' + esc(x.ten) + '</option>'; }).join('');
      var h = '<div class="mlv-ctrl"><span class="lbl">' + esc(mlvCap(state.tenLoai)) + ':</span>'
        + '<select id="mlvPick" style="flex:1;min-width:120px;padding:5px 8px;border-radius:7px;border:1px solid var(--line);background:var(--ink);color:var(--txt);font:inherit;font-size:11.5px;font-weight:600">' + opts + '</select>'
        + '<div class="mlv-seg" id="mlvKieu"><button data-k="cot" class="' + (state.kieu === 'cot' ? 'on' : '') + '">Cột</button><button data-k="duong" class="' + (state.kieu === 'duong' ? 'on' : '') + '">Đường</button></div></div>';
      if (!act) { body.innerHTML = h + '<div class="mlv-empty">Chưa có kết quả.</div>'; return; }
      // số liệu riêng lưu vực đang xem
      h += '<div style="display:flex;gap:16px;flex-wrap:wrap;margin:2px 0 10px;font-size:11.5px">'
        + '<span><span style="color:var(--txt3)">Tổng </span><b style="color:var(--txt)">' + (act.mm == null ? '–' : so(Math.round(act.mm)) + ' mm') + '</b></span>'
        + '<span><span style="color:var(--txt3)">Trạm </span><b style="color:var(--txt)">' + so(act.nTouch) + '</b></span>'
        + '<span><span style="color:var(--txt3)">Mật độ </span><b style="color:var(--txt)">' + (isFinite(act.kmPer) ? so(Math.round(act.kmPer)) + ' km²/trạm' : '–') + '</b> <span style="color:var(--txt3)">(' + esc(act.diaHinh) + ', chuẩn ≤' + so(act.kmDat) + ')</span></span>'
        + '<span><span style="color:var(--txt3)">Độ phủ </span><b style="color:var(--txt)">' + (act.pctPhu != null ? Math.round(act.pctPhu * 100) + '%' : '–') + '</b> <span style="color:var(--txt3)">(bán kính ' + so(act.radKm) + ' km)</span></span>'
        + '<span><span style="color:var(--txt3)">Tin cậy </span><span class="mlv-chip ' + act.tin.k + '">' + act.tin.ten + '</span></span>'
        + '<span><span style="color:var(--txt3)">DT </span><b style="color:var(--txt)">' + (act.dt ? so(Math.round(act.dt)) + ' km²' : '–') + '</b></span></div>';
      var one = [{ ten: act.ten, mau: act.mau, chuoi: act.chuoi }];
      h += '<div style="font-size:10.5px;color:var(--txt3);margin-bottom:4px">' + esc(state.buocTen) + ' · ' + so(state.steps.length) + ' mốc · ' + esc(state.tenKhoang) + '</div>';
      h += state.steps.length ? mlvChartSVG(state.steps, one, state.kieu) : '<div class="mlv-empty">Không có mốc thời gian.</div>';
      h += '<div class="mlv-ctrl" style="margin-top:10px"><button class="tbx-xbtn" data-x="thiessen">🔬 Xem chia Thiessen</button><button class="tbx-xbtn" data-x="png">📷 Lưu đồ thị (PNG)</button><button class="tbx-xbtn" data-x="csv1">⬇ Chuỗi (CSV)</button></div>';
      body.innerHTML = h;
      body.querySelector('#mlvPick').addEventListener('change', function () { state.active = this.value; mlvNhayLuuVuc(this.value, state, c); veDo(); });
      body.querySelectorAll('#mlvKieu button').forEach(function (b) { b.addEventListener('click', function () { state.kieu = b.dataset.k; veDo(); }); });
      body.querySelector('[data-x=thiessen]').addEventListener('click', function () { mlvVeThiessen(act, state.rowsRep, c); });
      body.querySelector('[data-x=png]').addEventListener('click', function () { mlvChartPNG(state.steps, one, state.kieu, act.ten + ' · ' + state.tenKhoang); });
      body.querySelector('[data-x=csv1]').addEventListener('click', function () { mlvXuatChuoi1CSV(state, act); });
    }

    function ve() { if (curTab === 'bang') veBang(); else veDo(); }
    function goTab(name) { curTab = name; box.querySelectorAll('.mlv-tabs button').forEach(function (x) { x.classList.toggle('on', x.dataset.tab === name); }); ve(); }
    state._goTab = goTab;
    box.querySelectorAll('.mlv-tabs button').forEach(function (b) { b.addEventListener('click', function () { goTab(b.dataset.tab); }); });
    box.querySelector('[data-close]').addEventListener('click', function () { box.remove(); });
    box.querySelector('[data-min]').addEventListener('click', function () {
      var tabs = box.querySelector('.mlv-tabs'), bd = box.querySelector('.mlv-body'), rz = box.querySelector('.mlv-rz');
      var hid = tabs.style.display === 'none'; tabs.style.display = hid ? '' : 'none'; bd.style.display = hid ? '' : 'none'; rz.style.display = hid ? '' : 'none';
      box.querySelector('[data-min]').textContent = hid ? '–' : '▢'; });
    // kéo
    var bar = box.querySelector('.bar'), drag = null;
    bar.addEventListener('mousedown', function (e) { if (e.target.closest('.ic')) return;
      drag = { x: e.clientX, y: e.clientY, r: box.getBoundingClientRect(), pr: mapEl.getBoundingClientRect() }; bar.classList.add('drag'); e.preventDefault();
      box.style.right = 'auto'; box.style.bottom = 'auto'; box.style.left = (drag.r.left - drag.pr.left) + 'px'; box.style.top = (drag.r.top - drag.pr.top) + 'px'; });
    window.addEventListener('mousemove', function (e) { if (!drag) return;
      box.style.left = Math.max(0, (e.clientX - drag.x) + (drag.r.left - drag.pr.left)) + 'px';
      box.style.top = Math.max(0, (e.clientY - drag.y) + (drag.r.top - drag.pr.top)) + 'px'; });
    window.addEventListener('mouseup', function () { if (drag) { drag = null; bar.classList.remove('drag'); } });
    // resize
    var rz = box.querySelector('.mlv-rz'), rs = null;
    rz.addEventListener('mousedown', function (e) { rs = { x: e.clientX, w: box.offsetWidth }; e.preventDefault(); e.stopPropagation(); });
    window.addEventListener('mousemove', function (e) { if (!rs) return; box.style.width = Math.max(300, rs.w + (e.clientX - rs.x)) + 'px'; if (curTab === 'do') veDo(); });
    window.addEventListener('mouseup', function () { rs = null; });
    state._box = box;
    goTab(curTab);
  }

  function mlvNhayLuuVuc(ma, state, c) {
    var map = c.map(); if (!map) return; var x = null; state.kq.forEach(function (k) { if (k.ma === ma) x = k; }); if (!x) return;
    if (!QC_SEL.hlList) QC_SEL.hlList = []; QC_SEL.map = map;
    var hl = L.geoJSON(x.f, { interactive: false, style: { color: '#F2B705', weight: 3, fill: false } }).addTo(map);
    QC_SEL.hlList.push(hl);
    try { var b = bboxGeom(x.f.geometry); map.fitBounds([[b[1], b[0]], [b[3], b[2]]], { animate: true, maxZoom: 10, padding: [40, 40] }); } catch (e) {}
    setTimeout(function () { try { map.removeLayer(hl); } catch (e) {} var i = QC_SEL.hlList.indexOf(hl); if (i >= 0) QC_SEL.hlList.splice(i, 1); }, 2600);
  }

  function mlvChupBanDo(state, c) {
    var lo = state.mapRange ? state.mapRange.lo : 0, hi = state.mapRange ? state.mapRange.hi : 1;
    var legend = [];
    [1, 0.66, 0.33, 0].forEach(function (t) { var v = lo + (hi - lo) * t; legend.push({ color: mauMlv(v, lo, hi), label: '≈ ' + so(Math.round(v)) + ' mm' }); });
    xuatAnhBanDo(c, { title: 'Mưa bình quân · ' + mlvCap(state.tenLoai), sub: state.tenKhoang + ' · ' + state.ppTen + ' · ' + so(state.kq.length) + ' ' + (state.tenLoai || 'lưu vực') + ' · ' + ngayVN(),
      legTitle: 'Mưa (mm)', legend: legend, footer: 'RIMS · RainLab (WeatherPlus)', file: 'RIMS_muaLV_' + nhanTG() + '.png' });
  }
  function mlvXuatBangCSV(state) {
    var hd = ['ma_luu_vuc', 'ten', 'loai_ct', 'dt_km2', 'dia_hinh', 'chuan_km2_tram', 'ban_kinh_phu_km', 'do_phu_pct', 'so_tram_dong_gop', 'so_tram_hieu_dung', 'km2_tren_tram', 'mua_tb_mm', 'phuong_phap', 'do_tin_cay'];
    var rs = state.kq.map(function (x) { return [x.ma, x.ten, x.loai || '', x.dt || '', x.diaHinh || '', x.kmDat || '', x.radKm || '', x.pctPhu != null ? Math.round(x.pctPhu * 100) : '',
      x.nTouch, Math.round((x.nEff || 0) * 10) / 10, isFinite(x.kmPer) ? Math.round(x.kmPer) : '', x.mm == null ? '' : Math.round(x.mm * 10) / 10, state.ppTen, x.tin.ten]; });
    xuatCSV('RIMS_muaLV_bang_' + nhanTG() + '.csv', hd, rs);
  }
  function mlvXuatChuoiCSV(state) {
    var hd = ['thoi_diem'].concat(state.kq.map(function (x) { return x.ten; }));
    var rs = state.steps.map(function (st, i) { return [st.label].concat(state.kq.map(function (x) { return x.chuoi[i] == null ? '' : Math.round(x.chuoi[i] * 10) / 10; })); });
    xuatCSV('RIMS_muaLV_chuoi_' + nhanTG() + '.csv', hd, rs);
  }
  function mlvXuatChuoi1CSV(state, act) {
    var rs = state.steps.map(function (st, i) { return [st.label, act.chuoi[i] == null ? '' : Math.round(act.chuoi[i] * 10) / 10]; });
    xuatCSV('RIMS_muaLV_' + String(act.ma).replace(/[^a-zA-Z0-9_-]/g, '') + '_' + nhanTG() + '.csv', ['thoi_diem', 'mua_tb_mm'], rs);
  }

  /* ── Chọn NHIỀU lưu vực bằng bấm bản đồ, lọc theo loại công trình ── */
  /* Chọn PHẠM VI: Lưu vực, hoặc Vùng hành chính (Vùng/Tỉnh/Xã). Mọi loại đều là feature
     có {ma, ten, dt_km2, relief_m} → dùng chung engine tính. el._lvDs = danh sách đã chọn. */
  function mlvTenLoai(el) { return el._dt === 'luuvuc' ? 'lưu vực' : (el._cap === 'vung' ? 'vùng' : el._cap === 'tinh' ? 'tỉnh' : 'xã'); }
  function mlvCap(s) { return String(s || 'lưu vực').replace(/^./, function (m) { return m.toUpperCase(); }); }
  function mlvChonPhamVi(subBox, el, c) {
    var map = c.map();
    if (!map || !window.L) { subBox.innerHTML = '<div class="tbx-err">Chưa có bản đồ để chọn.</div>'; return; }
    QC_SEL.map = map; if (!QC_SEL.hlList) QC_SEL.hlList = [];
    if (!el._lvDs) el._lvDs = [];
    el._dt = el._dt || 'luuvuc'; el._cap = el._cap || 'vung';
    subBox.innerHTML =
      '<div class="tbx-fld"><label>Đối tượng</label><select id="mlvDT">'
        + '<option value="luuvuc">Lưu vực</option><option value="hanhchinh">Vùng hành chính</option></select></div>'
      + '<div id="mlvLoc"></div>'
      + '<div class="tbx-two" style="margin-top:8px"><button type="button" class="tbx-xbtn" id="mlvAll">Chọn tất cả</button><button type="button" class="tbx-xbtn" id="mlvNone">Bỏ chọn</button></div>'
      + '<div class="tbx-hint" id="mlvStat" style="margin-top:8px"></div>'
      + '<div id="mlvPills" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px"></div>';
    var locBox = subBox.querySelector('#mlvLoc'), stat = subBox.querySelector('#mlvStat');
    subBox.querySelector('#mlvDT').value = el._dt;
    var curFeats = [];

    function selHas(ma) { for (var i = 0; i < el._lvDs.length; i++) if (el._lvDs[i].properties.ma === ma) return true; return false; }
    function syncHl() { if (!QC_SEL.pick) return; QC_SEL.pick.eachLayer(function (l) { try { QC_SEL.pick.resetStyle(l); } catch (e) {} }); }
    function locVal() { var s = locBox.querySelector('#mlvLoaiNhom'); return s ? s.value : ''; }
    function xaTinhVal() { var s = locBox.querySelector('#mlvXaTinh'); return s ? mlvNfc(s.value) : ''; }
    function pdConcon(f, acc) { acc[f.properties.ma] = f; var fc = LV_CACHE;
      if (fc && fc.features && locBox.querySelector('#mlvCon') && locBox.querySelector('#mlvCon').checked)
        fc.features.forEach(function (g) { if (g.properties && g.properties.cha === f.properties.ma && !acc[g.properties.ma]) pdConcon(g, acc); }); }
    function vePills() {
      var box = subBox.querySelector('#mlvPills'), n = el._lvDs.length, tl = mlvTenLoai(el);
      if (n > 25) box.innerHTML = '<span class="tbx-hint" style="margin:0">Danh sách dài — <span id="mlvClr" style="cursor:pointer;color:var(--tealL)">Bỏ chọn tất cả</span></span>';
      else box.innerHTML = el._lvDs.map(function (f, i) { return '<span class="pill" style="background:rgba(46,140,143,.16);border:1px solid var(--teal);color:#B8E0E1;border-radius:20px;padding:2px 8px;font-size:11px;font-weight:600;display:inline-flex;align-items:center;gap:6px">'
          + esc(f.properties.ten || f.properties.ma) + '<span data-i="' + i + '" style="cursor:pointer;opacity:.7">✕</span></span>'; }).join('')
          + (n ? '<span id="mlvClr" style="cursor:pointer;color:var(--tealL);font-size:11px;align-self:center;margin-left:2px">Xoá hết</span>' : '');
      stat.innerHTML = 'Đã chọn <b style="color:var(--txt)">' + n + '</b> ' + tl + (n > 60 ? ' <span style="color:var(--silt)">(nhiều — có thể chậm)</span>' : '');
      box.querySelectorAll('[data-i]').forEach(function (x) { x.addEventListener('click', function (e) { e.stopPropagation(); el._lvDs.splice(+x.dataset.i, 1); syncHl(); vePills(); }); });
      var clr = subBox.querySelector('#mlvClr'); if (clr) clr.addEventListener('click', function () { el._lvDs = []; syncHl(); vePills(); });
    }
    function goPick() {
      if (QC_SEL.pick) { try { map.removeLayer(QC_SEL.pick); } catch (e) {} QC_SEL.pick = null; }
      QC_SEL.pick = L.geoJSON({ type: 'FeatureCollection', features: curFeats }, {
        renderer: L.canvas(),
        style: function (f) { var s = selHas((f.properties || {}).ma);
          return { color: s ? '#F2B705' : '#2E8C8F', weight: s ? 2 : 0.7, opacity: s ? 1 : 0.55, fill: true,
            fillColor: s ? '#F2B705' : '#2E8C8F', fillOpacity: s ? 0.20 : 0.05, dashArray: s ? '4 3' : null }; }
      }).addTo(map);
      QC_SEL.pick.on('click', function (e) {
        if (window.L && L.DomEvent) L.DomEvent.stopPropagation(e);
        var f = timLuuVuc(e.latlng.lng, e.latlng.lat, { features: curFeats }); if (!f) return;
        var idx = -1; el._lvDs.forEach(function (g, i) { if (g.properties.ma === f.properties.ma) idx = i; });
        if (idx >= 0) el._lvDs.splice(idx, 1);
        else if (el._dt === 'luuvuc') { var acc = {}; pdConcon(f, acc); Object.keys(acc).forEach(function (m) { if (!el._lvDs.some(function (g) { return g.properties.ma === m; })) el._lvDs.push(acc[m]); }); }
        else el._lvDs.push(f);
        syncHl(); vePills();
      });
    }
    function loadFeats() {
      stat.innerHTML = 'Đang nạp lớp…';
      var p;
      if (el._dt === 'luuvuc') p = napLuuVuc().then(function (fc) { return fc && fc.features ? mlvLocFeats(fc, locVal()) : []; });
      else if (el._cap === 'vung') p = napVung().then(function (fc) { return fc && fc.features ? fc.features : []; });
      else if (el._cap === 'tinh') p = napTinh().then(function (fc) { return fc && fc.features ? fc.features : []; });
      else p = napXa().then(function (fc) { if (!fc || !fc.features) return []; var tv = xaTinhVal(); return tv ? fc.features.filter(function (f) { return mlvNfc((f.properties || {}).tinh) === tv; }) : []; });
      return p.then(function (arr) { curFeats = arr || []; goPick(); vePills(); });
    }
    function veLoc() {
      if (el._dt === 'luuvuc') {
        locBox.innerHTML = '<div class="tbx-fld"><label>Lọc theo công trình</label><select id="mlvLoaiNhom"><option value="">Tất cả</option>'
          + LOAI_NHOM.map(function (n) { return '<option value="' + n.id + '">' + esc(n.ten) + '</option>'; }).join('') + '</select></div>'
          + '<label class="tbx-hint" style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:2px"><input type="checkbox" id="mlvCon"> Gồm các lưu vực con</label>';
        locBox.querySelector('#mlvLoaiNhom').addEventListener('change', loadFeats);
      } else {
        var caps = [['vung', 'Vùng'], ['tinh', 'Tỉnh'], ['xa', 'Xã']];
        var h = '<div class="tbx-fld"><label>Cấp</label><select id="mlvCap">'
          + caps.map(function (o) { return '<option value="' + o[0] + '"' + (el._cap === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>';
        if (el._cap === 'xa') h += '<div class="tbx-fld"><label>Tỉnh (lọc xã)</label><select id="mlvXaTinh"><option value="">— chọn tỉnh —</option></select></div>';
        locBox.innerHTML = h;
        locBox.querySelector('#mlvCap').addEventListener('change', function () { el._cap = this.value; el._lvDs = []; veLoc(); loadFeats(); });
        if (el._cap === 'xa') { var sel = locBox.querySelector('#mlvXaTinh');
          napTinh().then(function (fc) { if (!fc || !fc.features) return;
            var fs = fc.features.slice().sort(function (a, b) { return String(a.properties.ten).localeCompare(String(b.properties.ten), 'vi'); });
            sel.innerHTML = '<option value="">— chọn tỉnh —</option>' + fs.map(function (f) { return '<option value="' + esc(f.properties.ten) + '">' + esc(f.properties.ten) + '</option>'; }).join(''); });
          sel.addEventListener('change', function () { el._lvDs = []; loadFeats(); }); }
      }
    }
    subBox.querySelector('#mlvDT').addEventListener('change', function () { el._dt = this.value; el._lvDs = []; veLoc(); loadFeats(); });
    subBox.querySelector('#mlvAll').addEventListener('click', function () { el._lvDs = curFeats.slice(); syncHl(); vePills(); });
    subBox.querySelector('#mlvNone').addEventListener('click', function () { el._lvDs = []; syncHl(); vePills(); });
    veLoc(); loadFeats();
  }

  window.RIMS_dangKyTool('mua_lv', function (el, c) {
    window.RIMS_noConsoleEl = el;
    el.innerHTML =
      '<div id="mlvScopeSub"></div>'
      + '<div class="tbx-fld"><label>Thống kê theo</label><div class="tbx-two" id="mlvBuoc" style="gap:0">'
        + '<button type="button" class="mlvbtn" data-b="ngay">Ngày</button><button type="button" class="mlvbtn" data-b="thang">Tháng</button><button type="button" class="mlvbtn on" data-b="nam">Năm</button></div></div>'
      + '<div class="tbx-fld"><label>Thời khoảng</label><div id="mlvTime"></div></div>'
      + '<div class="tbx-fld"><label>Phương pháp bình quân</label><select id="mlvPP">'
        + '<option value="thiessen">Thiessen (đa giác ảnh hưởng)</option><option value="idw">Lưới IDW (nội suy)</option><option value="mean">Trung bình số học các trạm</option></select></div>'
      + '<label class="tbx-hint" style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="mlvQc" checked> Chỉ dùng trạm đạt QC (Bình thường)</label>'
      + '<label class="tbx-hint" style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:4px"><input type="checkbox" id="mlvQcDyn" checked> QC động theo thời gian</label>'
      + '<button class="tbx-run" id="mlvRun" style="margin-top:10px">Tính mưa bình quân</button>'
      + '<div id="mlvOut"></div>';
    // style nút bước (dùng .tbx CSS sẵn có cho seg)
    if (!document.getElementById('mlv-seg-css')) { var sc = document.createElement('style'); sc.id = 'mlv-seg-css';
      sc.textContent = '#mlvBuoc .mlvbtn{flex:1;background:var(--ink);color:var(--txt2);border:1px solid var(--line);padding:6px 4px;font:inherit;font-size:11.5px;cursor:pointer;font-weight:600}'
        + '#mlvBuoc .mlvbtn:first-child{border-radius:7px 0 0 7px}#mlvBuoc .mlvbtn:last-child{border-radius:0 7px 7px 0}#mlvBuoc .mlvbtn+.mlvbtn{border-left:0}'
        + '#mlvBuoc .mlvbtn.on{background:var(--teal);color:#fff;border-color:var(--teal)}'
        + '.mlvsub{display:block;font-size:10px;color:var(--txt3);margin-bottom:3px;font-weight:600}'
        + '#mlvTime input{width:100%;padding:6px 9px;border-radius:7px;border:1px solid var(--line);background:var(--ink);color:var(--txt);font:inherit;font-size:12.5px;outline:none}';
      document.head.appendChild(sc); }

    mlvChonPhamVi(el.querySelector('#mlvScopeSub'), el, c);

    var buoc = 'nam';
    var timeBox = el.querySelector('#mlvTime');
    function veTime() {                       // lịch bung đúng theo bước thống kê
      var now = new Date(), y = now.getUTCFullYear();
      if (buoc === 'ngay') {                  // một trận mưa → chọn ngày
        var e = now.toISOString().slice(0, 10), s = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
        timeBox.innerHTML = '<div class="tbx-two"><div style="flex:1"><label class="mlvsub">Từ ngày</label><input type="date" id="mlvFrom" value="' + s + '"></div><div style="flex:1"><label class="mlvsub">Đến ngày</label><input type="date" id="mlvTo" value="' + e + '"></div></div>';
      } else if (buoc === 'thang') {          // từ tháng → tháng
        var ym = now.toISOString().slice(0, 7), d0 = new Date(Date.UTC(y, now.getUTCMonth() - 11, 1)).toISOString().slice(0, 7);
        timeBox.innerHTML = '<div class="tbx-two"><div style="flex:1"><label class="mlvsub">Từ tháng</label><input type="month" id="mlvFrom" value="' + d0 + '"></div><div style="flex:1"><label class="mlvsub">Đến tháng</label><input type="month" id="mlvTo" value="' + ym + '"></div></div>';
      } else {                                // dài hạn → từ năm → năm
        timeBox.innerHTML = '<div class="tbx-two"><div style="flex:1"><label class="mlvsub">Từ năm</label><input type="number" id="mlvFrom" min="1990" max="' + y + '" value="' + (y - 4) + '"></div><div style="flex:1"><label class="mlvsub">Đến năm</label><input type="number" id="mlvTo" min="1990" max="' + y + '" value="' + y + '"></div></div>';
      }
    }
    el.querySelectorAll('#mlvBuoc .mlvbtn').forEach(function (b) { b.addEventListener('click', function () {
      buoc = b.dataset.b; el.querySelectorAll('#mlvBuoc .mlvbtn').forEach(function (x) { x.classList.toggle('on', x === b); }); veTime(); }); });
    veTime();
    function mlvKhoang() {                     // dựng [start,end] UTC + nhãn theo bước
      var f = el.querySelector('#mlvFrom').value, t = el.querySelector('#mlvTo').value; if (!f || !t) return null;
      if (buoc === 'ngay') { if (new Date(f) > new Date(t)) return null; var e = new Date(t + 'T00:00:00Z'); e.setUTCDate(e.getUTCDate() + 1);
        return { start: f + 'T00:00:00Z', end: e.toISOString(), tenKhoang: f.split('-').reverse().join('/') + '–' + t.split('-').reverse().join('/') }; }
      if (buoc === 'thang') { if (f > t) return null; var fp = f.split('-'), tp = t.split('-');
        return { start: new Date(Date.UTC(+fp[0], +fp[1] - 1, 1)).toISOString(), end: new Date(Date.UTC(+tp[0], +tp[1], 1)).toISOString(),
          tenKhoang: (fp[1] + '/' + fp[0]) + '–' + (tp[1] + '/' + tp[0]) }; }
      var y1 = +f, y2 = +t; if (!y1 || !y2 || y1 > y2) return null;
      return { start: new Date(Date.UTC(y1, 0, 1)).toISOString(), end: new Date(Date.UTC(y2 + 1, 0, 1)).toISOString(), tenKhoang: y1 + '–' + y2 };
    }

    el.querySelector('#mlvRun').addEventListener('click', function () {
      var out = el.querySelector('#mlvOut'), btn = el.querySelector('#mlvRun');
      var ds = el._lvDs || [];
      if (!ds.length) { out.innerHTML = '<div class="tbx-flag">Chưa chọn đối tượng nào.</div>'; return; }
      var per = mlvKhoang();
      if (!per) { out.innerHTML = '<div class="tbx-err">Thời khoảng không hợp lệ (Từ phải trước/bằng Đến).</div>'; return; }
      var start = per.start, end = per.end;
      var pp = el.querySelector('#mlvPP').value, ppTen = { thiessen: 'Thiessen', idw: 'Lưới IDW', mean: 'TB số học' }[pp];
      var qcFilter = el.querySelector('#mlvQc').checked, qcDyn = el.querySelector('#mlvQcDyn').checked;
      var buocTen = { ngay: 'Theo ngày', thang: 'Theo tháng', nam: 'Theo năm' }[buoc];

      // bbox bao tất cả lưu vực + đệm 0.4°
      var mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
      ds.forEach(function (x) { var b = bboxGeom(x.geometry); if (b[0] < mnx) mnx = b[0]; if (b[1] < mny) mny = b[1]; if (b[2] > mxx) mxx = b[2]; if (b[3] > mxy) mxy = b[3]; });
      var pad = 0.4, bbox = [mnx - pad, mny - pad, mxx + pad, mxy + pad].map(function (v) { return v.toFixed(4); }).join(',');
      var steps = mlvBuoc(start, end, buoc);
      if (!steps.length) { out.innerHTML = '<div class="tbx-err">Khoảng thời gian không tạo được mốc nào.</div>'; return; }

      btn.disabled = true; btn.textContent = 'Đang tính…';
      function prog(m) { out.innerHTML = '<div class="tbx-hint">' + esc(m) + '</div>'; }
      prog('Đang lấy dữ liệu mưa…');

      var rowsP = (buoc === 'ngay') ? mlvRowsNgay(steps, bbox, qcFilter, qcDyn, prog) : mlvRowsClassify(steps, bbox, qcFilter, qcDyn, prog);

      rowsP.then(function (rowsPerStep) {
        prog('Đang tính bình quân diện tích…');
        // precompute cells / basin — độ mịn co theo số lưu vực để không treo khi chọn tất cả
        var target = Math.max(120, Math.min(2200, Math.round(60000 / ds.length)));
        ds.forEach(function (x) { if (!x._cells || x._cellsT !== target) { x._cells = mlvCells(x.geometry, target); x._cellsT = target; } });
        var mau = ['#1a53a8', '#2E7DD6', '#64b5f6', '#3E9E6B', '#C8813F', '#7C6FD6', '#C4453F', '#46B3B5', '#a5d6f0', '#8e6fd0'];
        var kq = ds.map(function (x, bi) {
          var dt = (x.properties && x.properties.dt_km2) ? +x.properties.dt_km2 : 0;
          var rad = mlvRadDeg(dt), rad2 = rad * rad;
          var tong = 0, has = false, bestTouch = 0, bestEff = 0, bestPct = 0;
          var chuoi = rowsPerStep.map(function (rows) {
            var r = mlvBinhQuan(x._cells, rows, x.geometry, pp, rad2);
            if (r) { tong += r.mm; has = true; if (r.nTouch > bestTouch) { bestTouch = r.nTouch; bestEff = r.nEff; bestPct = r.pctPhu; } return r.mm; }
            return null;
          });
          var dh = mlvDiaHinh(x.properties);
          var tin = mlvTinCay(bestEff, dt, qcFilter, dh.kmDat, bestPct);
          return { ma: x.properties.ma, ten: x.properties.ten || x.properties.ma, loai: (x.properties || {}).loai_ct || '', dt: dt,
            f: x, mm: has ? tong : null, chuoi: chuoi, mau: mau[bi % mau.length],
            nTouch: bestTouch, nEff: bestEff, kmPer: tin.kmPer, pctPhu: bestPct, radKm: Math.round(rad * 111),
            diaHinh: dh.ten, kmDat: dh.kmDat, tin: tin };
        });
        btn.disabled = false; btn.textContent = 'Tính mưa bình quân';
        var thieu = kq.filter(function (x) { return x.mm == null; }).length;
        if (kq.every(function (x) { return x.mm == null; })) {
          out.innerHTML = '<div class="tbx-err">Không có trạm nào có dữ liệu trong khoảng/phạm vi này (hoặc RainLab chưa mở API).</div>'; return;
        }
        var tenKhoang = per.tenKhoang;
        var state = { kq: kq, steps: steps, kieu: 'cot', pp: pp, ppTen: ppTen, buoc: buoc, buocTen: buocTen, tenKhoang: tenKhoang, tenLoai: mlvTenLoai(el), active: kq[0] ? kq[0].ma : null };
        state.show = function (ma) { state.active = ma; if (state._box && document.body.contains(state._box) && state._goTab) state._goTab('do'); else { state._wantTab = 'do'; mlvMoTamNoi(state, c); } };
        var repIdx = 0; rowsPerStep.forEach(function (r, i) { if ((r || []).length > (rowsPerStep[repIdx] || []).length) repIdx = i; });
        state.rowsRep = rowsPerStep[repIdx] || [];   // tập trạm đại diện để vẽ chia Thiessen
        state.mapRange = mlvVeBanDo(state, c);
        out.innerHTML = '<div class="tbx-sep"></div><div class="tbx-resHd">Mưa bình quân · ' + so(kq.length) + ' ' + mlvTenLoai(el) + '</div>'
          + '<div class="tbx-hint" style="margin:0 0 8px">' + esc(ppTen) + ' · ' + esc(buocTen) + ' · ' + esc(tenKhoang)
          + (qcFilter ? ' · chỉ trạm QC' + (qcDyn ? ' (động)' : ' (cố định)') : ' · <span style="color:var(--silt)">dùng cả trạm (chưa lọc QC)</span>') + '</div>'
          + (thieu ? '<div class="tbx-flag">' + thieu + ' lưu vực chưa đủ dữ liệu/trạm — xem cột Tin cậy.</div>' : '')
          + '<button class="tbx-run" id="mlvOpen" style="margin-top:8px">▣ Mở bảng &amp; đồ thị</button>';
        el.querySelector('#mlvOpen').addEventListener('click', function () { mlvMoTamNoi(state, c); });
        mlvMoTamNoi(state, c);
      }).catch(function (e) {
        btn.disabled = false; btn.textContent = 'Tính mưa bình quân';
        out.innerHTML = '<div class="tbx-err">Không tính được: ' + esc(e && e.message || e) + '<br><br>Kiểm tra dịch vụ RainLab (proxy <code>/api/rainlab/*</code>).</div>';
      });
    });
  });

  /* ═══════════ SỬ DỤNG NƯỚC (mua_tk) — ĐA HỒ · nguồn HNT ═══════════
     Giỏ nhiều hồ (nhận từ ô "Tìm hồ chứa" topbar qua RIMS_hoPicker, hoặc nút
     nhanh). Tính Vào hồ / Sử dụng (PĐ+tưới) / Xả theo kỳ; bung tấm nổi:
     Bảng = danh sách hồ, Đồ thị = chuỗi từng hồ. Cờ trung thực: hồ chưa có
     HNT hoặc không có dữ liệu trong kỳ → báo, không bịa. */
  var WU_DAM = { NGANTRUOI: 'ngantruoi', HOHO: 'hoho' };
  function wuKeyOf(maTam) { return WU_DAM[String(maTam || '').toUpperCase()] || null; }
  function wuNum(v) { return (v == null || isNaN(v)) ? 0 : +v; }
  function wuSo2(v) { return (v == null || isNaN(v)) ? '–' : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 2 }); }
  function wuBucketKey(ts, buoc) {
    var d = new Date(ts * 1000);
    var y = d.getUTCFullYear(), m = ('0' + (d.getUTCMonth() + 1)).slice(-2), dd = ('0' + d.getUTCDate()).slice(-2);
    if (buoc === 'ngay') return { k: y + '-' + m + '-' + dd, nhan: dd + '/' + m + '/' + y };
    if (buoc === 'thang') return { k: y + '-' + m, nhan: 'Th' + (d.getUTCMonth() + 1) + '/' + y };
    return { k: '' + y, nhan: 'Năm ' + y };
  }
  function wuTongHop(general, buoc, tStart, tEnd) {
    var g = (general || []).filter(function (x) { return x.date_time != null; }).sort(function (a, b) { return a.date_time - b.date_time; });
    var map = {}, order = [];
    function get(k, nhan) { if (!map[k]) { map[k] = { k: k, nhan: nhan, vao: 0, pd: 0, tuoi: 0, xa: 0 }; order.push(map[k]); } return map[k]; }
    for (var i = 0; i < g.length - 1; i++) {
      var a = g[i], b = g[i + 1], t0 = a.date_time, t1 = b.date_time;
      if (t1 <= tStart || t0 >= tEnd) continue;
      var dt = Math.min(t1, tEnd) - Math.max(t0, tStart); if (dt <= 0) continue;
      var bk = wuBucketKey(Math.round((Math.max(t0, tStart) + Math.min(t1, tEnd)) / 2), buoc);
      var row = get(bk.k, bk.nhan);
      function seg(fa, fb) { return (wuNum(fa) + wuNum(fb)) / 2 * dt / 1e6; }
      row.vao  += seg((wuNum(a.inflow_avg_1h) || wuNum(a.total_discharge_lake)), (wuNum(b.inflow_avg_1h) || wuNum(b.total_discharge_lake)));
      row.pd   += seg(a.total_discharge_turbine, b.total_discharge_turbine);
      row.tuoi += seg(a.total_discharge_conduit, b.total_discharge_conduit);
      row.xa   += seg(wuNum(a.total_discharge_dam) + wuNum(a.total_discharge_surface), wuNum(b.total_discharge_dam) + wuNum(b.total_discharge_surface));
    }
    order.sort(function (a, b) { return a.k < b.k ? -1 : a.k > b.k ? 1 : 0; });
    var tong = { vao: 0, pd: 0, tuoi: 0, xa: 0 };
    order.forEach(function (r) { tong.vao += r.vao; tong.pd += r.pd; tong.tuoi += r.tuoi; tong.xa += r.xa; });
    var ir = g.filter(function (x) { return x.date_time >= tStart && x.date_time <= tEnd && x.lake_capacity != null; });
    var dtru = ir.length >= 2 ? (wuNum(ir[ir.length - 1].lake_capacity) - wuNum(ir[0].lake_capacity)) / 1e6 : null;
    return { buckets: order, tong: tong, dtru: dtru, n: g.length, range: g.length ? { t0: g[0].date_time, t1: g[g.length - 1].date_time } : null };
  }
  function wuLay(key, fromSec, toSec) {
    return fetch('/api/hnt/usage?dam=' + key + '&from=' + fromSec + '&to=' + toSec, { cache: 'no-store' })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (x.ok && x.j && x.j.ok && Array.isArray(x.j.general)) return { general: x.j.general, live: true };
        throw new Error((x.j && x.j.msg) || 'API HNT lỗi');
      })
      .catch(function (e) {
        return fetch('modules/' + key + '/dam_history_' + key + '.json')
          .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
          .then(function (j) { return { general: j.general || [], live: false, reason: (e && e.message) || '' }; });
      });
  }
  function injWuCss() {
    if (document.getElementById('wu-css')) return;
    var s = document.createElement('style'); s.id = 'wu-css';
    s.textContent =
        '#wuBuoc .wubtn{flex:1;background:var(--ink);color:var(--txt2);border:1px solid var(--line);padding:6px 4px;font:inherit;font-size:11.5px;cursor:pointer;font-weight:600}'
      + '#wuBuoc .wubtn:first-child{border-radius:7px 0 0 7px}#wuBuoc .wubtn:last-child{border-radius:0 7px 7px 0}#wuBuoc .wubtn+.wubtn{border-left:0}'
      + '#wuBuoc .wubtn.on{background:var(--teal);color:#fff;border-color:var(--teal)}'
      + '.wusub{display:block;font-size:10px;color:var(--txt3);margin-bottom:3px;font-weight:600}'
      + '#wuTime input{width:100%;padding:6px 9px;border-radius:7px;border:1px solid var(--line);background:var(--ink);color:var(--txt);font:inherit;font-size:12.5px;outline:none}'
      + '#wuCart{display:flex;flex-direction:column;gap:5px;min-height:20px}'
      + '#wuCart .wchip{display:flex;align-items:center;gap:7px;background:var(--ink);border:1px solid var(--line);border-radius:8px;padding:5px 9px;font-size:12px}'
      + '#wuCart .wchip .d{width:8px;height:8px;border-radius:50%;flex:none}'
      + '#wuCart .wchip .x{margin-left:auto;color:var(--txt3);cursor:pointer;font-size:13px}#wuCart .wchip .x:hover{color:var(--crit)}'
      + '#wuCart .wchip .tag{font-size:9px;font-weight:700;color:var(--silt)}'
      + '#wuCart .wempty{font-size:11px;color:var(--txt3);padding:4px 2px}'
      + '.wu-quick{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}'
      + '.wu-kpis{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:0 0 10px}'
      + '.wu-kpi{background:var(--ink);border:1px solid var(--line);border-radius:9px;padding:9px 10px;position:relative;overflow:hidden}'
      + '.wu-kpi::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px}'
      + '.wu-kpi.vao::before{background:#2E7DD6}.wu-kpi.sd::before{background:#46B3B5}.wu-kpi.xa::before{background:#C8813F}'
      + '.wu-kpi .l{font-size:9.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--txt3)}'
      + '.wu-kpi .v{font-size:18px;font-weight:800;margin-top:4px;line-height:1}'
      + '.wu-kpi .u{font-size:10px;color:var(--txt3);font-weight:500;margin-left:3px}'
      + '.wu-kpi .e{margin-top:5px;font-size:10px;color:var(--txt2)}'
      + '.wu-tbl{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:2px}'
      + '.wu-tbl th,.wu-tbl td{padding:5px 7px;border-bottom:1px solid rgba(39,70,80,.5);text-align:right}'
      + '.wu-tbl th:first-child,.wu-tbl td:first-child{text-align:left}'
      + '.wu-tbl thead th{font-size:9.5px;letter-spacing:.4px;text-transform:uppercase;color:var(--txt3);font-weight:700}'
      + '.wu-tbl td.num{font-variant-numeric:tabular-nums;font-weight:600}'
      + '.wu-tbl tbody tr{cursor:pointer}.wu-tbl tbody tr:hover td{background:rgba(70,179,181,.08)}'
      + '.wu-tbl tr.nodata td{color:var(--txt3);font-style:italic;cursor:default}'
      + '.wu-tbl tfoot td{border-top:2px solid var(--line);border-bottom:0;font-weight:800;color:var(--txt);padding-top:8px}'
      + '.wu-sw{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;vertical-align:-1px}'
      + '.wu-lg{display:flex;gap:12px;flex-wrap:wrap;margin:2px 0 8px;font-size:11px;color:var(--txt2)}'
      + '.wu-lg span{display:inline-flex;align-items:center;gap:5px}.wu-lg i{width:10px;height:10px;border-radius:3px}'
      + '.wu-bal{margin-top:9px;font-size:10.5px;color:var(--txt3);background:var(--ink);border:1px solid var(--line);border-radius:7px;padding:8px 10px}'
      + '.wu-bal b{color:var(--txt2)}.wu-float .mlv-body{max-height:56vh}';
    document.head.appendChild(s);
  }
  var WU_MAU = ['#2E7DD6', '#46B3B5', '#8FB55A', '#C8813F', '#7C6FD6', '#C4453F', '#3E9E6B', '#a5d6f0'];
  function wuChartSVG(buckets) {
    var series = [
      { ten: 'Vào hồ', c: '#2E7DD6', d: buckets.map(function (b) { return b.vao; }) },
      { ten: 'Sử dụng', c: '#46B3B5', d: buckets.map(function (b) { return b.pd + b.tuoi; }) },
      { ten: 'Xả', c: '#C8813F', d: buckets.map(function (b) { return b.xa; }) }
    ];
    var n = buckets.length; if (!n) return '';
    var W = 620, H = 230, padL = 40, padR = 10, padT = 10, padB = 40;
    var max = 0; series.forEach(function (s) { s.d.forEach(function (v) { if (v > max) max = v; }); });
    var pow = max <= 0 ? 1 : Math.pow(10, Math.floor(Math.log10(max)));
    var ni = Math.ceil((max || 1) / pow) * pow || 1, stp = ni / 4, iw = W - padL - padR, ih = H - padT - padB;
    function y(v) { return padT + ih - (v / ni) * ih; }
    var g = '';
    for (var q = 0; q <= ni + 1e-9; q += stp) { var yy = y(q);
      g += '<line x1="' + padL + '" y1="' + yy.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + yy.toFixed(1) + '" stroke="var(--line)"/>'
         + '<text x="' + (padL - 5) + '" y="' + (yy + 3).toFixed(1) + '" fill="var(--txt3)" font-size="9.5" text-anchor="end">' + wuSo2(q) + '</text>'; }
    var gw = iw / n, bw = Math.max(2, gw * 0.62 / 3), gap = gw * 0.19, bars = '', everyN = Math.ceil(n / 20);
    for (var i = 0; i < n; i++) { var x0 = padL + i * gw + gap;
      series.forEach(function (s, si) { var v = s.d[i], bx = x0 + si * bw, by = y(v), bh = padT + ih - by;
        bars += '<rect x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0, bh).toFixed(1) + '" fill="' + s.c + '"/>'; });
      if (n <= 20 || i % everyN === 0) { var lx = (x0 + bw * 1.5).toFixed(1);
        bars += '<text x="' + lx + '" y="' + (H - padB + 13) + '" fill="var(--txt3)" font-size="8.5" text-anchor="middle" transform="rotate(35 ' + lx + ' ' + (H - padB + 13) + ')">' + esc(buckets[i].nhan) + '</text>'; }
    }
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto" role="img" aria-label="Đồ thị sử dụng nước">'
      + g + bars + '<line x1="' + padL + '" y1="' + (padT + ih) + '" x2="' + (W - padR) + '" y2="' + (padT + ih) + '" stroke="var(--txt3)"/></svg>';
  }
  function wuKpiHtml(r, sd) {
    return '<div class="wu-kpis">'
      + '<div class="wu-kpi vao"><div class="l">Tổng vào hồ</div><div class="v">' + wuSo2(r.tong.vao) + '<span class="u">10⁶m³</span></div><div class="e">&nbsp;</div></div>'
      + '<div class="wu-kpi sd"><div class="l">Tổng sử dụng</div><div class="v">' + wuSo2(sd) + '<span class="u">10⁶m³</span></div><div class="e">PĐ ' + wuSo2(r.tong.pd) + ' · Tưới ' + wuSo2(r.tong.tuoi) + '</div></div>'
      + '<div class="wu-kpi xa"><div class="l">Tổng xả</div><div class="v">' + wuSo2(r.tong.xa) + '<span class="u">10⁶m³</span></div><div class="e">&nbsp;</div></div></div>';
  }
  function wuMoPopup(state) {
    injMlvCss(); injWuCss();
    var mapEl = document.getElementById('map'); if (!mapEl) return;
    var old = mapEl.querySelector('.wu-float'); if (old) old.remove();
    var box = document.createElement('div'); box.className = 'mlv-float wu-float';
    var nHo = state.items.filter(function (x) { return x.hasData; }).length;
    box.innerHTML =
      '<div class="bar"><span class="grip">⠿</span><span class="t">Sử dụng nước · ' + so(nHo) + ' hồ · ' + esc(state.perTen) + '</span>'
        + '<span class="ic" data-min title="Thu gọn">–</span><span class="ic" data-close title="Đóng">✕</span></div>'
      + '<div class="mlv-tabs"><button data-tab="bang" class="on">Bảng</button><button data-tab="do">Đồ thị</button></div>'
      + '<div class="mlv-body" id="wuBody"></div><span class="mlv-rz">◢</span>';
    mapEl.appendChild(box);
    if (window.L && L.DomEvent) { L.DomEvent.disableClickPropagation(box); L.DomEvent.disableScrollPropagation(box); }
    var body = box.querySelector('#wuBody'), cur = 'bang';

    function metaLine() {
      return '<div style="font-size:10px;color:var(--txt3);margin:0 0 8px">' + esc(state.buocTen) + ' · ' + esc(state.perTen) + ' · ' + esc(state.nguonTxt || '') + '</div>';
    }
    function veBang() {
      var live = state.items.filter(function (x) { return x.hasData; });
      var tv = 0, tp = 0, tt = 0, tx = 0;
      live.forEach(function (x) { tv += x.r.tong.vao; tp += x.r.tong.pd; tt += x.r.tong.tuoi; tx += x.r.tong.xa; });
      var rows = state.items.map(function (x) {
        if (!x.hasData) return '<tr class="nodata"><td><span class="wu-sw" style="background:' + (x.mau || 'var(--txt3)') + ';opacity:.4"></span>' + esc(x.ten) + '</td><td colspan="3">' + (x.key ? 'không có dữ liệu trong kỳ' : 'chưa có HNT') + '</td></tr>';
        return '<tr data-ma="' + esc(x.ma) + '"><td><span class="wu-sw" style="background:' + x.mau + '"></span>' + esc(x.ten) + '</td>'
          + '<td class="num">' + wuSo2(x.r.tong.vao) + '</td><td class="num" style="color:#46B3B5">' + wuSo2(x.sd) + '</td><td class="num">' + wuSo2(x.r.tong.xa) + '</td></tr>';
      }).join('');
      body.innerHTML = metaLine()
        + '<table class="wu-tbl"><thead><tr><th>Hồ</th><th><span class="wu-sw" style="background:#2E7DD6"></span>Vào hồ</th><th><span class="wu-sw" style="background:#46B3B5"></span>Sử dụng</th><th><span class="wu-sw" style="background:#C8813F"></span>Xả</th></tr></thead>'
        + '<tbody>' + rows + '</tbody>'
        + (live.length > 1 ? '<tfoot><tr><td>Tổng ' + so(live.length) + ' hồ</td><td class="num">' + wuSo2(tv) + '</td><td class="num" style="color:#46B3B5">' + wuSo2(tp + tt) + '</td><td class="num">' + wuSo2(tx) + '</td></tr></tfoot>' : '')
        + '</table>'
        + '<div style="font-size:10.5px;color:var(--txt3);margin-top:6px">Đơn vị 10⁶ m³. Sử dụng = Phát điện + Tưới. Bấm một hồ để xem đồ thị.</div>'
        + '<div class="mlv-ctrl" style="margin-top:8px"><button class="tbx-xbtn" data-x="csv">⬇ Xuất CSV (bảng)</button></div>';
      body.querySelectorAll('tr[data-ma]').forEach(function (tr) { tr.addEventListener('click', function () { state.active = tr.dataset.ma; goTab('do'); }); });
      var cb = body.querySelector('[data-x=csv]'); if (cb) cb.addEventListener('click', function () {
        xuatCSV('RIMS_suDungNuoc_bang_' + nhanTG() + '.csv',
          ['ho', 'vao_ho_trieu_m3', 'phat_dien_trieu_m3', 'tuoi_trieu_m3', 'su_dung_trieu_m3', 'xa_trieu_m3', 'trang_thai'],
          state.items.map(function (x) { return x.hasData
            ? [x.ten, x.r.tong.vao.toFixed(3), x.r.tong.pd.toFixed(3), x.r.tong.tuoi.toFixed(3), x.sd.toFixed(3), x.r.tong.xa.toFixed(3), (x.live ? 'HNT trực tiếp' : 'đệm offline')]
            : [x.ten, '', '', '', '', '', (x.key ? 'không có dữ liệu trong kỳ' : 'chưa có HNT')]; })); });
    }
    function veDo() {
      var live = state.items.filter(function (x) { return x.hasData; });
      if (!live.length) { body.innerHTML = metaLine() + '<div class="mlv-empty">Không hồ nào có dữ liệu trong kỳ.</div>'; return; }
      var act = null; live.forEach(function (x) { if (x.ma === state.active) act = x; }); if (!act) { act = live[0]; state.active = act.ma; }
      var opts = live.map(function (x) { return '<option value="' + esc(x.ma) + '"' + (x.ma === act.ma ? ' selected' : '') + '>' + esc(x.ten) + '</option>'; }).join('');
      var r = act.r, sd = act.sd;
      body.innerHTML = metaLine()
        + '<div class="mlv-ctrl"><span class="lbl">Hồ:</span><select id="wuPick" style="flex:1;min-width:120px;padding:5px 8px;border-radius:7px;border:1px solid var(--line);background:var(--ink);color:var(--txt);font:inherit;font-size:11.5px;font-weight:600">' + opts + '</select></div>'
        + wuKpiHtml(r, sd)
        + '<div class="wu-lg"><span><i style="background:#2E7DD6"></i>Vào hồ</span><span><i style="background:#46B3B5"></i>Sử dụng</span><span><i style="background:#C8813F"></i>Xả</span></div>'
        + (r.buckets.length ? wuChartSVG(r.buckets) : '<div class="mlv-empty">Không có mốc.</div>')
        + '<div class="wu-bal">Cân bằng: <b>Vào hồ ' + wuSo2(r.tong.vao) + '</b> = Sử dụng ' + wuSo2(sd) + ' + Xả ' + wuSo2(r.tong.xa) + (r.dtru == null ? '' : ' + ΔTrữ ' + wuSo2(r.dtru)) + ' (10⁶ m³)' + (act.live ? '' : ' · <span style="color:var(--silt)">đệm offline</span>') + '</div>';
      var pk = body.querySelector('#wuPick'); if (pk) pk.addEventListener('change', function () { state.active = this.value; veDo(); });
    }
    function ve() { if (cur === 'bang') veBang(); else veDo(); }
    function goTab(n) { cur = n; box.querySelectorAll('.mlv-tabs button').forEach(function (x) { x.classList.toggle('on', x.dataset.tab === n); }); ve(); }
    box.querySelectorAll('.mlv-tabs button').forEach(function (b) { b.addEventListener('click', function () { goTab(b.dataset.tab); }); });
    box.querySelector('[data-close]').addEventListener('click', function () { box.remove(); });
    box.querySelector('[data-min]').addEventListener('click', function () {
      var tabs = box.querySelector('.mlv-tabs'), bd = box.querySelector('.mlv-body'), rz = box.querySelector('.mlv-rz');
      var hid = tabs.style.display === 'none'; tabs.style.display = hid ? '' : 'none'; bd.style.display = hid ? '' : 'none'; rz.style.display = hid ? '' : 'none';
      box.querySelector('[data-min]').textContent = hid ? '–' : '▢'; });
    var bar = box.querySelector('.bar'), drag = null;
    bar.addEventListener('mousedown', function (e) { if (e.target.closest('.ic')) return;
      drag = { x: e.clientX, y: e.clientY, r: box.getBoundingClientRect(), pr: mapEl.getBoundingClientRect() }; bar.classList.add('drag'); e.preventDefault();
      box.style.right = 'auto'; box.style.bottom = 'auto'; box.style.left = (drag.r.left - drag.pr.left) + 'px'; box.style.top = (drag.r.top - drag.pr.top) + 'px'; });
    window.addEventListener('mousemove', function (e) { if (!drag) return;
      box.style.left = Math.max(0, (e.clientX - drag.x) + (drag.r.left - drag.pr.left)) + 'px';
      box.style.top = Math.max(0, (e.clientY - drag.y) + (drag.r.top - drag.pr.top)) + 'px'; });
    window.addEventListener('mouseup', function () { if (drag) { drag = null; bar.classList.remove('drag'); } });
    var rz = box.querySelector('.mlv-rz'), rs = null;
    rz.addEventListener('mousedown', function (e) { rs = { x: e.clientX, w: box.offsetWidth }; e.preventDefault(); e.stopPropagation(); });
    window.addEventListener('mousemove', function (e) { if (!rs) return; box.style.width = Math.max(320, rs.w + (e.clientX - rs.x)) + 'px'; if (cur === 'do') veDo(); });
    window.addEventListener('mouseup', function () { rs = null; });
    goTab('bang');
  }

  window.RIMS_dangKyTool('mua_tk', function (el, c) {
    injWuCss();
    el.innerHTML =
        '<div class="tbx-fld"><label>Hồ chứa đã chọn</label><div id="wuCart"></div>'
        + '<div class="tbx-hint" style="margin-top:5px">Tìm hồ ở ô “Tìm hồ chứa” trên cùng để thêm vào giỏ.</div></div>'
      + '<div class="tbx-fld"><label>Thống kê theo</label><div class="tbx-two" id="wuBuoc" style="gap:0">'
        + '<button type="button" class="wubtn on" data-b="ngay">Ngày</button><button type="button" class="wubtn" data-b="thang">Tháng</button><button type="button" class="wubtn" data-b="nam">Năm</button></div></div>'
      + '<div class="tbx-fld"><label>Thời khoảng</label><div id="wuTime"></div></div>'
      + '<button class="tbx-run" id="wuRun" style="margin-top:6px">Tính sử dụng nước</button>'
      + '<div id="wuOut"></div>';

    var CART = [];
    function veCart() {
      var box = el.querySelector('#wuCart');
      if (!CART.length) { box.innerHTML = '<div class="wempty">Chưa có hồ nào.</div>'; return; }
      box.innerHTML = CART.map(function (h, i) {
        var mau = WU_MAU[i % WU_MAU.length];
        return '<div class="wchip"><span class="d" style="background:' + (h.key ? mau : 'var(--txt3)') + '"></span>' + esc(h.ten) + (h.key ? '' : '<span class="tag">chưa HNT</span>') + '<span class="x" data-i="' + i + '">✕</span></div>';
      }).join('');
      box.querySelectorAll('.x').forEach(function (x) { x.addEventListener('click', function () { CART.splice(+x.dataset.i, 1); veCart(); }); });
    }
    function themHo(maTam, ten) {
      var ma = String(maTam || '').toUpperCase();
      var id = ma || String(ten || '').trim().toUpperCase();
      if (!id) return;
      if (CART.some(function (h) { return h.id === id; })) return;
      CART.push({ id: id, ma: ma, ten: ten || id, key: wuKeyOf(ma) }); veCart();
    }
    veCart();
    window.RIMS_noConsoleEl = el;
    window.RIMS_hoPicker = function (h) {
      if (!document.body.contains(el)) { window.RIMS_hoPicker = null; return false; }
      var ma = String((h && (h.ma_tam || h.ma)) || '').toUpperCase();
      if (!ma && h && h.console_id) { var m = /dam[._]([a-z0-9]+)/i.exec(h.console_id); if (m) ma = m[1].toUpperCase(); }
      themHo(ma, (h && h.ten) || ma); return true;
    };

    var buoc = 'ngay', timeBox = el.querySelector('#wuTime');
    function veTime() {
      var now = new Date(), y = now.getUTCFullYear();
      if (buoc === 'ngay') { timeBox.innerHTML = '<div class="tbx-two"><div style="flex:1"><label class="wusub">Từ ngày</label><input type="date" id="wuFrom" value="2026-08-23"></div><div style="flex:1"><label class="wusub">Đến ngày</label><input type="date" id="wuTo" value="2026-09-10"></div></div>'; }
      else if (buoc === 'thang') { timeBox.innerHTML = '<div class="tbx-two"><div style="flex:1"><label class="wusub">Từ tháng</label><input type="month" id="wuFrom" value="2026-08"></div><div style="flex:1"><label class="wusub">Đến tháng</label><input type="month" id="wuTo" value="2026-09"></div></div>'; }
      else { timeBox.innerHTML = '<div class="tbx-two"><div style="flex:1"><label class="wusub">Từ năm</label><input type="number" id="wuFrom" min="2000" max="' + y + '" value="2025"></div><div style="flex:1"><label class="wusub">Đến năm</label><input type="number" id="wuTo" min="2000" max="' + y + '" value="2026"></div></div>'; }
    }
    el.querySelectorAll('#wuBuoc .wubtn').forEach(function (b) { b.addEventListener('click', function () {
      buoc = b.dataset.b; el.querySelectorAll('#wuBuoc .wubtn').forEach(function (x) { x.classList.toggle('on', x === b); }); veTime(); }); });
    veTime();
    function wuKhoang() {
      var f = el.querySelector('#wuFrom').value, t = el.querySelector('#wuTo').value; if (!f || !t) return null;
      if (buoc === 'ngay') { if (new Date(f) > new Date(t)) return null; var e = new Date(t + 'T00:00:00Z'); e.setUTCDate(e.getUTCDate() + 1);
        return { s: Date.parse(f + 'T00:00:00Z') / 1000, e: e.getTime() / 1000, ten: f.split('-').reverse().join('/') + '–' + t.split('-').reverse().join('/') }; }
      if (buoc === 'thang') { if (f > t) return null; var fp = f.split('-'), tp = t.split('-');
        return { s: Date.UTC(+fp[0], +fp[1] - 1, 1) / 1000, e: Date.UTC(+tp[0], +tp[1], 1) / 1000, ten: (fp[1] + '/' + fp[0]) + '–' + (tp[1] + '/' + tp[0]) }; }
      var y1 = +f, y2 = +t; if (!y1 || !y2 || y1 > y2) return null;
      return { s: Date.UTC(y1, 0, 1) / 1000, e: Date.UTC(y2 + 1, 0, 1) / 1000, ten: y1 + '–' + y2 };
    }

    el.querySelector('#wuRun').addEventListener('click', function () {
      var out = el.querySelector('#wuOut'), btn = el.querySelector('#wuRun');
      if (!CART.length) { out.innerHTML = '<div class="tbx-sep"></div><div class="tbx-flag">Chưa chọn hồ nào — tìm hồ ở ô trên cùng hoặc bấm nút nhanh.</div>'; return; }
      var per = wuKhoang(); if (!per) { out.innerHTML = '<div class="tbx-err">Thời khoảng không hợp lệ (Từ phải trước/bằng Đến).</div>'; return; }
      btn.disabled = true; btn.textContent = 'Đang tính…';
      var snapshot = CART.slice();
      Promise.all(snapshot.map(function (h, i) {
        var mau = WU_MAU[i % WU_MAU.length];
        if (!h.key) return Promise.resolve({ ma: h.id, ten: h.ten, key: null, mau: mau, hasData: false });
        return wuLay(h.key, per.s, per.e).then(function (res) {
          var r = wuTongHop(res.general || [], buoc, per.s, per.e);
          return { ma: h.id, ten: h.ten, key: h.key, mau: mau, live: res.live, r: r, sd: r.tong.pd + r.tong.tuoi, hasData: r.buckets.length > 0 };
        }).catch(function (e) { return { ma: h.id, ten: h.ten, key: h.key, mau: mau, hasData: false, err: (e && e.message) || '' }; });
      })).then(function (items) {
        btn.disabled = false; btn.textContent = 'Tính sử dụng nước';
        var live = items.filter(function (x) { return x.hasData; });
        var anyLive = live.some(function (x) { return x.live; }), anyOff = live.some(function (x) { return !x.live; });
        var nguonTxt = live.length ? ((anyLive && !anyOff) ? 'HNT trực tiếp' : (!anyLive ? 'đệm offline' : 'HNT + đệm')) : '—';
        var buocTen = { ngay: 'Theo ngày', thang: 'Theo tháng', nam: 'Theo năm' }[buoc];
        var state = { perTen: per.ten, buoc: buoc, buocTen: buocTen, nguonTxt: nguonTxt, items: items, active: live[0] ? live[0].ma : null };
        var thieu = items.length - live.length;
        out.innerHTML = '<div class="tbx-sep"></div><div class="tbx-resHd">Sử dụng nước · ' + so(live.length) + ' hồ có dữ liệu</div>'
          + '<div class="tbx-hint" style="margin:0 0 8px">' + esc(buocTen) + ' · ' + esc(per.ten) + ' · ' + esc(nguonTxt) + (thieu ? ' · ' + thieu + ' hồ không có dữ liệu' : '') + '</div>'
          + '<button class="tbx-run" id="wuOpen" style="margin-top:2px">▣ Mở bảng &amp; đồ thị</button>';
        el.querySelector('#wuOpen').addEventListener('click', function () { wuMoPopup(state); });
        wuMoPopup(state);
      });
    });
  });

  /* ── DỌN MÀN HÌNH: xoá vết tích tính toán (tấm nổi + lớp kết quả + highlight),
     KHÔNG đụng lớp GIS nền / marker hệ thống sông. ── */
  var WU_LOP_SEL = 'input[data-gis]:checked, #panel section[data-panel="kttv"] input[type="checkbox"]:checked';
  window.RIMS_donManHinh = function () {
    var mapEl = document.getElementById('map');
    if (mapEl) mapEl.querySelectorAll('.mlv-float, .wu-float').forEach(function (x) { x.remove(); });
    try { window.RIMS_toolKetQua.danhSach().forEach(function (k) { window.RIMS_toolKetQua.xoa(k.id); }); } catch (e) {}
    try { qcClearSel(); } catch (e) {}
    /* tắt mọi lớp GIS + khí tượng đang bật → trả nền trơn (dispatch change để handler gốc tự tắt lớp) */
    try { document.querySelectorAll(WU_LOP_SEL).forEach(function (cb) { cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); }); } catch (e) {}
    /* gỡ hệ thống sông đang chọn (marker + lưu vực) */
    try { if (window.RIMS_datHeThong) window.RIMS_datHeThong(null); } catch (e) {}
    var sb = document.getElementById('sysBox'); if (sb) sb.value = '';
  };
  window.RIMS_coVetTich = function () {
    var mapEl = document.getElementById('map');
    var f = mapEl && mapEl.querySelector('.mlv-float, .wu-float');
    var kq = (window.RIMS_toolKetQua && window.RIMS_toolKetQua.danhSach().length) || 0;
    var hl = (typeof QC_SEL !== 'undefined' && QC_SEL.hlList && QC_SEL.hlList.length) || 0;
    var lop = document.querySelector(WU_LOP_SEL);
    var ht = (window.RIMS_scopeState && window.RIMS_scopeState() && window.RIMS_scopeState().heThong) || window.RIMS_heThongDangChon;
    return !!(f || kq || hl || lop || ht);
  };

  /* ═══════════════════════ RUỘT: DỰ BÁO MƯA-DÒNG CHẢY ═══════════════════════
     Quét toàn bộ hồ HNT (đọc data/hnt/flood_summary.json do puller tính sẵn):
     mỗi hồ → tổng mưa 3 ngày qua + dự báo 3 ngày tới (mm), đỉnh lũ Q đến trong
     cửa sổ 6 ngày (±3 ngày). Lọc các hồ "có lũ" (lưu lượng gia tăng vượt nền +
     cường suất tăng liên tục ≥ ngưỡng) và xếp hạng theo độ lớn đỉnh. Bấm dòng →
     bay tới hồ trên GIS; marker các hồ có lũ phát sáng (glow) gây chú ý.
     ─────────────────────────────────────────────────────────────────────────── */
  var FLD_URL = 'data/hnt/flood_summary.json';
  function fldNgayGio(iso) {
    if (!iso) return '–';
    var d = new Date(iso); if (isNaN(d)) return '–';
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function fldBatLop() {
    ['ho_thuydien', 'ho_thuyloi'].forEach(function (g) {
      var cb = document.querySelector('input[data-gis="' + g + '"]');
      if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
    });
  }
  function fldMoTamNoi(dams, meta) {
    injMlvCss();
    var mapEl = document.getElementById('map'); if (!mapEl) return;
    var old = mapEl.querySelector('.mlv-float.fld'); if (old) old.remove();
    var box = document.createElement('div'); box.className = 'mlv-float fld';
    box.innerHTML =
      '<div class="bar"><span class="grip">⠿</span><span class="t">Hồ có lũ · ' + so(dams.length) + ' hồ · cửa sổ 6 ngày</span>'
        + '<span class="ic" data-min title="Thu gọn">–</span><span class="ic" data-close title="Đóng">✕</span></div>'
      + '<div class="mlv-body" id="fldBody"></div><span class="mlv-rz">◢</span>';
    mapEl.appendChild(box);
    if (window.L && L.DomEvent) { L.DomEvent.disableClickPropagation(box); L.DomEvent.disableScrollPropagation(box); }
    var body = box.querySelector('#fldBody'), sortKey = 'peak', sortDir = -1;

    function ve() {
      var rows = dams.slice().sort(function (a, b) {
        var va, vb;
        if (sortKey === 'ten') return sortDir * String(a.ten).localeCompare(String(b.ten), 'vi');
        if (sortKey === 'qua') { va = a.rain_past3d; vb = b.rain_past3d; }
        else if (sortKey === 'toi') { va = a.rain_fc3d; vb = b.rain_fc3d; }
        else { va = a.peak; vb = b.peak; }
        return sortDir * ((va == null ? -1 : va) - (vb == null ? -1 : vb));
      });
      function ar(k) { return sortKey === k ? '<span class="ar">' + (sortDir < 0 ? '▼' : '▲') + '</span>' : ''; }
      var h = '';
      if (!rows.length) {
        h = '<div class="tbx-flag" style="margin:0">Chưa phát hiện hồ nào có lũ trong cửa sổ 6 ngày. '
          + 'Dữ liệu tính lúc ' + esc(meta && meta.computedAt ? fldNgayGio(meta.computedAt) : '–') + '.</div>';
        body.innerHTML = h; return;
      }
      h = '<table class="mlv-tbl"><thead><tr>'
        + '<th data-s="ten">Hồ / đập' + ar('ten') + '</th>'
        + '<th data-s="qua" style="text-align:right">Mưa 3ng qua<br><span style="font-weight:600;text-transform:none;letter-spacing:0">mm</span>' + ar('qua') + '</th>'
        + '<th data-s="toi" style="text-align:right">DB 3ng tới<br><span style="font-weight:600;text-transform:none;letter-spacing:0">mm</span>' + ar('toi') + '</th>'
        + '<th data-s="peak" style="text-align:right">Đỉnh lũ<br><span style="font-weight:600;text-transform:none;letter-spacing:0">m³/s</span>' + ar('peak') + '</th></tr></thead><tbody>';
      rows.forEach(function (x) {
        var chip = (x.has_op && !x.peak_future)
          ? '<span class="mlv-chip ok" title="Đỉnh quan trắc, đã/đang xảy ra">TT</span>'
          : '<span class="mlv-chip mid" title="Đỉnh dự báo">DB</span>';
        h += '<tr data-ten="' + esc(x.ten) + '">'
          + '<td>' + esc(x.ten) + ' ' + chip + '<div style="font-size:9.5px;color:var(--txt3);font-weight:600">đỉnh ' + esc(fldNgayGio(x.peak_time)) + (x.has_op ? '' : ' · chỉ dự báo') + '</div></td>'
          + '<td class="num">' + (x.rain_past3d == null ? '–' : so(Math.round(x.rain_past3d))) + '</td>'
          + '<td class="num">' + (x.rain_fc3d == null ? '–' : so(Math.round(x.rain_fc3d))) + '</td>'
          + '<td class="num" style="color:#F2B705">' + (x.peak == null ? '–' : so(Math.round(x.peak))) + '</td></tr>';
      });
      h += '</tbody></table>';
      body.innerHTML = h;
      body.querySelectorAll('th[data-s]').forEach(function (th) {
        th.addEventListener('click', function () {
          var k = th.dataset.s; if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = k === 'ten' ? 1 : -1; } ve();
        });
      });
      body.querySelectorAll('tr[data-ten]').forEach(function (tr) {
        tr.addEventListener('click', function () { try { window.RIMS_bayToiHo(tr.dataset.ten); } catch (e) {} });
      });
    }

    box.querySelector('[data-close]').addEventListener('click', function () {
      box.remove(); try { window.RIMS_glowClear(); } catch (e) {}
    });
    box.querySelector('[data-min]').addEventListener('click', function () {
      var bd = box.querySelector('.mlv-body'), rz = box.querySelector('.mlv-rz');
      var hid = bd.style.display === 'none'; bd.style.display = hid ? '' : 'none'; rz.style.display = hid ? '' : 'none';
      box.querySelector('[data-min]').textContent = hid ? '–' : '▢';
    });
    var bar = box.querySelector('.bar'), drag = null;
    bar.addEventListener('mousedown', function (e) { if (e.target.closest('.ic')) return;
      drag = { x: e.clientX, y: e.clientY, r: box.getBoundingClientRect(), pr: mapEl.getBoundingClientRect() }; bar.classList.add('drag'); e.preventDefault();
      box.style.right = 'auto'; box.style.bottom = 'auto'; box.style.left = (drag.r.left - drag.pr.left) + 'px'; box.style.top = (drag.r.top - drag.pr.top) + 'px'; });
    window.addEventListener('mousemove', function (e) { if (!drag) return;
      box.style.left = Math.max(0, (e.clientX - drag.x) + (drag.r.left - drag.pr.left)) + 'px';
      box.style.top = Math.max(0, (e.clientY - drag.y) + (drag.r.top - drag.pr.top)) + 'px'; });
    window.addEventListener('mouseup', function () { if (drag) { drag = null; bar.classList.remove('drag'); } });
    var rz = box.querySelector('.mlv-rz'), rs = null;
    rz.addEventListener('mousedown', function (e) { rs = { x: e.clientX, w: box.offsetWidth }; e.preventDefault(); e.stopPropagation(); });
    window.addEventListener('mousemove', function (e) { if (!rs) return; box.style.width = Math.max(320, rs.w + (e.clientX - rs.x)) + 'px'; });
    window.addEventListener('mouseup', function () { rs = null; });
    ve();
  }

  window.RIMS_dangKyTool('sosanh', function (el, c) {
    el.innerHTML =
      '<button class="tbx-run" id="fldRun">Quét hồ có lũ</button>'
      + '<div id="fldOut"></div>';
    var out = el.querySelector('#fldOut'), btn = el.querySelector('#fldRun');

    function chay() {
      btn.disabled = true; btn.textContent = 'Đang quét…';
      out.innerHTML = '<div class="tbx-hint">Đang đọc kết quả tính lũ…</div>';
      fetch(FLD_URL, { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (j) {
          btn.disabled = false; btn.textContent = 'Quét lại';
          var all = (j && j.dams) || [];
          var flood = all.filter(function (d) { return d.has_flood; });
          fldBatLop();
          try { window.RIMS_glowDams(flood.map(function (d) { return d.gis || d.ten; })); } catch (e) {}
          var stamp = j && j.computedAt ? fldNgayGio(j.computedAt) : '–';
          out.innerHTML = '<div class="tbx-hint">Đã quét <b>' + so(all.length) + '</b> hồ · '
            + '<b style="color:#F2B705">' + so(flood.length) + '</b> hồ có lũ · tính lúc ' + esc(stamp) + '.</div>';
          fldMoTamNoi(flood, j);
        })
        .catch(function (e) {
          btn.disabled = false; btn.textContent = 'Quét lại';
          out.innerHTML = '<div class="tbx-err">Chưa có kết quả tính lũ (<code>' + esc(FLD_URL) + '</code>): ' + esc(e && e.message || e)
            + '<br><br>Chạy vòng kéo dữ liệu (<code>start_RIMS.bat</code>) để puller tạo <code>flood_summary.json</code>, rồi quét lại.</div>';
        });
    }
    btn.addEventListener('click', chay);
    chay();   // tự chạy khi mở công cụ
  });

  /* ── Khi tab Công cụ mở, đảm bảo launcher đã dựng ── */
  window.RIMS_moToolbox = veLauncher;
  /* Chuyển sang tab rail khác → dọn lớp phủ + viền chọn lưu vực để không kẹt trên bản đồ. */
  document.querySelectorAll('#rail .rtab').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.dataset.panel !== 'tool') {
        qcClearSel();                                  // lớp phủ chọn lưu vực
        window.RIMS_toolKetQua.danhSach().forEach(function (k) {   // + lớp kết quả (QC, đẳng trị)
          window.RIMS_toolKetQua.xoa(k.id);
        });
      }
    });
  });
  if (sec()) veLauncher();
  else {
    var wait = setInterval(function () { if (sec()) { clearInterval(wait); veLauncher(); } }, 200);
    setTimeout(function () { clearInterval(wait); }, 8000);
  }
})();
