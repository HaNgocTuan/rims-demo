/* =============================================================================
 * _MAU_adapter.js  ·  RIMS  ·  KHUÔN MẪU ADAPTER NGUỒN DỮ LIỆU
 * -----------------------------------------------------------------------------
 * CẮM MỘT NGUỒN MỚI VÀO RIMS — 3 BƯỚC, KHÔNG ĐỤNG MÃ LÕI:
 *
 *   B1. Khai báo nguồn trong  app/web/data/sources.json  (khối trong mảng "nguon").
 *       Bắt buộc: id · ten · nha_cung_cap · phan_loai · trang_thai · cap_du_lieu
 *       Nếu cần khoá: auth.key_ref = TÊN khoá (KHÔNG BAO GIỜ ghi giá trị vào đây).
 *
 *   B2. Copy file này thành  core/adapters/<id>.js  và điền phần thân.
 *       Trỏ trường "adapter" của khối khai báo tới đường dẫn file.
 *
 *   B3. Nạp file trong index.html (hoặc settings.html) SAU rims-sources.js.
 *
 * QUY TẮC BẮT BUỘC CỦA ADAPTER
 *   · KHÔNG hardcode khoá. Luôn: RIMSSources.getKey('<key_ref>')
 *   · KHÔNG hardcode đường dẫn. Luôn: RIMSSources.url('<id>', '<path>')
 *   · Lấy hỏng thì GIỮ BẢN TỐT trước đó — không ghi đè bằng rỗng, không bịa số.
 *   · Báo tình trạng về sổ đăng ký: RIMSSources.report('<id>', {ok, note})
 *   · toRims() phải trả dữ liệu kèm nhãn nguồn để truy vết được về sau.
 * =========================================================================== */
(function () {
  "use strict";

  var ID = "vidu.nguon";     // ĐỔI: đúng bằng "id" trong sources.json

  if (!window.RIMSSources) {
    console.error("[RIMS/adapter " + ID + "] thiếu rims-sources.js — nạp nó trước.");
    return;
  }

  window.RIMSSources.registerAdapter(ID, {

    mo_ta: "Mô tả ngắn gọn adapter làm gì (hiển thị trong Cài đặt).",

    /* --- Nút "Kiểm tra" trong Cài đặt gọi hàm này ------------------------ *
     * Trả Promise<{ok: boolean, note: string}>. Nên gọi một endpoint NHẸ.  */
    check: function () {
      var u = window.RIMSSources.url(ID, "duong/dan/nhe");
      if (!u) return Promise.resolve({ ok: false, note: "chưa khai báo base_url" });
      return fetch(u, { headers: window.RIMSSources.authHeaders(ID) })
        .then(function (r) {
          return { ok: r.ok, note: "HTTP " + r.status };
        });
    },

    /* --- Lấy dữ liệu thô ------------------------------------------------- */
    fetch: function (params) {
      var u = window.RIMSSources.url(ID, "duong/dan/du/lieu");
      return fetch(u, { headers: window.RIMSSources.authHeaders(ID) })
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (raw) {
          window.RIMSSources.report(ID, { ok: true, note: "lấy dữ liệu thành công" });
          return raw;
        })
        .catch(function (e) {
          window.RIMSSources.report(ID, { ok: false, note: String(e.message || e) });
          throw e;   // tầng trên quyết định GIỮ BẢN TỐT
        });
    },

    /* --- Chuẩn hoá về schema RIMS ---------------------------------------- *
     * Luôn kèm khối "nguon" để truy vết dữ liệu về gốc.                     */
    toRims: function (raw) {
      return {
        nguon: { id: ID, lay_luc: new Date().toISOString() },
        du_lieu: raw
      };
    }
  });
})();
