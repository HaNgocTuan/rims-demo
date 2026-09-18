/* HHT Module Client — adapter phía module (nạp trong mỗi console) v0.1
 * Nói giao thức HHT-MODULEHOST: công bố module:ready, tham gia bus 'hydronet',
 * nhận host:focus / select để lấy nét đối tượng. Thuần vanilla, không phụ thuộc framework.
 *
 * Cách dùng trong một console (chèn qua build script, KHÔNG sửa file đã build tay):
 *   <script src="hht-module-client.js"></script>
 *   HHTModule.init({
 *     id: 'dam.hoho',
 *     objects: [ {ref:'dam/hoho/gate/1', label:'Cửa van số 1', kind:'gate'}, ... ],
 *     onFocus: function(ref){ ...cuộn tới / tô sáng đối tượng ref trong console... }
 *   });
 */
(function (w) {
  'use strict';
  var api = { id: null, objects: [], _onFocus: null, _bc: null, _ready: false };

  function qp(name) {
    try { return new URLSearchParams(w.location.search).get(name); } catch (e) { return null; }
  }

  api.init = function (opt) {
    opt = opt || {};
    api.id = opt.id || qp('moduleId') || 'unknown';
    if (opt.objects) api.objects = opt.objects.slice();
    if (opt.onFocus) api._onFocus = opt.onFocus;
    // bus dùng chung — hoạt động cả khi nhúng iframe lẫn khi đã tách sang cửa sổ/màn hình khác
    try { api._bc = new BroadcastChannel('hydronet'); api._bc.onmessage = onBus; } catch (e) { api._bc = null; }
    // kênh trực tiếp host -> module (dành cho iframe nhúng)
    w.addEventListener('message', onMsg, false);
    announce();
    return api;
  };

  api.registerObjects = function (list) {
    api.objects = (list || []).slice();
    if (api._ready) announce();
    return api;
  };
  api.onFocus = function (fn) { api._onFocus = fn; return api; };
  api.emit = function (type, extra) {
    var msg = { type: type, moduleId: api.id };
    if (extra) { for (var k in extra) if (extra.hasOwnProperty(k)) msg[k] = extra[k]; }
    send(msg);
  };

  function announce() {
    api._ready = true;
    send({ type: 'module:ready', moduleId: api.id, capabilities: ['focus'], objects: api.objects });
  }
  function send(msg) {
    try { if (w.parent && w.parent !== w) w.parent.postMessage(msg, '*'); } catch (e) {}
    try { if (w.opener && w.opener !== w) w.opener.postMessage(msg, '*'); } catch (e) {}
    try { if (api._bc) api._bc.postMessage(msg); } catch (e) {}
  }
  function doFocus(ref) {
    if (typeof api._onFocus === 'function') { try { api._onFocus(ref); } catch (e) {} }
    send({ type: 'module:objectSelected', moduleId: api.id, ref: ref });
  }
  function onMsg(ev) {
    var d = ev && ev.data; if (!d || typeof d !== 'object') return;
    if (d.type === 'host:focus') doFocus(d.ref);
    else if (d.type === 'host:requestReady') announce();
  }
  function onBus(ev) {
    var d = ev && ev.data; if (!d || typeof d !== 'object') return;
    if (d.kind === 'select' && belongsHere(d.ref)) doFocus(d.ref);
  }
  // ref dạng "{category}/{site}/{kind}/{id}"; module chỉ nhận ref thuộc phạm vi của mình
  function belongsHere(ref) {
    if (typeof ref !== 'string') return false;
    var prefix = String(api.id).replace(/\./g, '/'); // dam.hoho -> dam/hoho
    return ref.indexOf(prefix) === 0;
  }

  w.HHTModule = api;
})(window);
