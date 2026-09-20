/* =====================================================================
 * RIMS — MÁY CHỦ CỤC BỘ (serve.mjs)
 * ---------------------------------------------------------------------
 * Chạy:  node app/services/server/serve.mjs [cổng]
 * Mặc định cổng 8080, chỉ nghe 127.0.0.1 (không lộ ra mạng LAN).
 *
 * VÌ SAO CẦN MÁY CHỦ RIÊNG (không dùng `python -m http.server`)
 *   1. KHOÁ KHÔNG ĐƯỢC Ở TRÌNH DUYỆT. Trình duyệt gọi same-origin
 *      `/api/rma/*`; máy chủ mới gắn `x-api-key` rồi chuyển tiếp.
 *      Đây là điều docs/NGUON_DU_LIEU.md đã ghi là bắt buộc trước môi
 *      trường thật — làm luôn từ prototype để không phải sửa lại.
 *   2. CÓ VAN TIẾT LƯU. Lưới trạm toàn quốc gọi một request mỗi trạm.
 *      Van đặt Ở MÁY CHỦ, không đặt ở trình duyệt: một tab cũ còn mở
 *      cũng không nện được vào gateway.
 *   3. CÓ SỔ ĐẾM. Mỗi lời gọi được đếm; `/api/rma/_thongke` trả số thật
 *      để làm việc với đội Dev về bài toán tải.
 *
 * KHÔNG DÙNG GÓI NGOÀI — chỉ module có sẵn của Node (>= 18).
 * ===================================================================== */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));   // app/services/server
const ROOT = HERE;   // deploy: phục vụ ngay từ gốc repo (index.html ở đây)
const REPO = HERE;
const ENV_FILE = path.join(REPO, ".env");
const POLICY_FILE = path.join(ROOT, "data", "fetch_policy.json");

const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";  // Render: phải nghe 0.0.0.0

/* ── ĐỌC .env (không cần gói dotenv) ─────────────────────────────────── */
function loadEnv(file) {
  const out = {};
  let raw;
  try { raw = fs.readFileSync(file, "utf8"); } catch { return out; }
  for (const line of raw.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const i = s.indexOf("=");
    if (i < 1) continue;
    let v = s.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[s.slice(0, i).trim()] = v;
  }
  return out;
}
const ENV = { ...loadEnv(ENV_FILE), ...process.env };

const RMA_KEY = ENV.RIMS_RMA_API_KEY || ENV.RMA_API_KEY || "";
const RMA_GATEWAY = (ENV.RIMS_RMA_GATEWAY || "https://wpe-tools.seho.vn/api/portal/gateway/rma").replace(/\/+$/, "");
/* RainLab QC API — nghe loopback 127.0.0.1:8600 trên chính máy chạy serve.mjs.
   Trình duyệt KHÔNG gọi loopback trực tiếp được (khác cổng), nên proxy same-origin
   /api/rainlab/* -> RainLab, y như /api/rma/*. Không cần khoá (loopback, không auth). */
const RAINLAB_BASE = (ENV.RIMS_RAINLAB_BASE || "http://127.0.0.1:8600").replace(/\/+$/, "");
const RAINLAB_KEY = ENV.RIMS_RAINLAB_KEY || ENV.RAINLAB_API_KEY || "";   // gắn X-API-Key phía máy chủ, KHÔNG lộ ra trình duyệt
const RESOURCES_BASE = (ENV.RIMS_RESOURCES_BASE || "").replace(/\/+$/, "");
const TANK_BASE = (ENV.RIMS_TANK_BASE || "").replace(/\/+$/, "");

/* ── CHÍNH SÁCH GỌI DỮ LIỆU ──────────────────────────────────────────── *
 * Nguồn sự thật: app/web/data/fetch_policy.json (trình duyệt đọc được,
 * sửa được qua màn hình Cài đặt). Thiếu file thì dùng mặc định dưới đây.
 * MẶC ĐỊNH CỐ Ý ĐẶT THƯA — lưới trạm toàn quốc chưa đo được tải thật.  */
const POLICY_DEFAULT = {
  schema: "rims.fetch_policy/v1",
  nhip: {
    tram_mua:     { bat: true,  phut: 60, mo_ta: "Mưa tích luỹ theo trạm — mỗi trạm một request" },
    tram_thuyvan: { bat: true,  phut: 30, mo_ta: "Mực nước trạm thuỷ văn — mỗi trạm một request" },
    radar:        { bat: true,  phut: 10, mo_ta: "Ảnh radar — tile, không theo trạm" },
    mua_phan_tich:{ bat: true,  phut: 15, mo_ta: "Mưa phân tích — tile" },
    mua_du_bao:   { bat: true,  phut: 60, mo_ta: "Mưa dự báo — theo phiên mô hình" },
    gio:          { bat: true,  phut: 60, mo_ta: "Trường gió — tile" },
    ve_tinh:      { bat: true,  phut: 15, mo_ta: "Ảnh vệ tinh — tile" },
    bao:          { bat: true,  phut: 30, mo_ta: "Vệt bão" },
  },
  gioi_han: {
    goi_moi_phut:      120,
    song_song:           3,
    tram_toi_da_moi_vong: 400,
    ghi_chu: "Van đặt Ở MÁY CHỦ. Vượt goi_moi_phut thì trả 429 kèm số giây phải chờ — lớp gọi phải nhận 429 như tín hiệu hợp lệ, KHÔNG coi là hỏng và KHÔNG xoá bản tốt đang có.",
  },
  ghi_chu_chung:
    "Đặt THƯA có chủ đích cho giai đoạn prototype. Chưa đo được số trạm thật của mạng RMA toàn quốc, nên chưa biết một vòng tính mưa tốn bao nhiêu lời gọi. Sau khi có số ở /api/rma/_thongke thì bàn với đội Dev rồi mới nới.",
};

function readJsonSafe(p) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } }
function policy() {
  const f = readJsonSafe(POLICY_FILE);
  if (!f) return POLICY_DEFAULT;
  return {
    ...POLICY_DEFAULT, ...f,
    nhip:     { ...POLICY_DEFAULT.nhip,     ...(f.nhip     || {}) },
    gioi_han: { ...POLICY_DEFAULT.gioi_han, ...(f.gioi_han || {}) },
  };
}

/* ── VAN TIẾT LƯU + SỔ ĐẾM ───────────────────────────────────────────── */
const hits = [];                 // mốc thời gian từng lời gọi RMA (ms)
const byPath = new Map();        // đường dẫn → số lần
let blocked = 0;                 // số lời gọi bị van chặn
let lastErr = null;

function trimHits(now) { const cut = now - 3600_000; while (hits.length && hits[0] < cut) hits.shift(); }
function countSince(now, ms) { let n = 0; for (let i = hits.length - 1; i >= 0 && hits[i] >= now - ms; i--) n++; return n; }

/* ⚑ LÀN ƯU TIÊN — KHÔNG BAO GIỜ CHẶN.
 * Hai lời gọi này là CẤU TRÚC, không phải tải: mỗi lần làm mới chỉ gọi MỘT
 * lần, và chúng quyết định toàn bộ màn hình.
 *   · station/getall  → danh mục trạm (vị trí, loại). Mất nó = bản đồ trắng.
 *   · station/status  → sức khoẻ + số đo gần nhất của CẢ MẠNG trong 1 lời gọi.
 *                       Mất nó = MỌI trạm bị tô "lỗi", kể cả trạm đang tốt.
 * Chặn chúng để nhường chỗ cho hàng nghìn lời gọi lẻ từng trạm là đổi cái
 * sống lấy cái phụ. Vẫn ĐẾM để sổ thống kê trung thực, chỉ không chặn.   */
const LAN_UU_TIEN = ["/api/setting/station/getall", "/api/map/station/status"];
function uuTien(rest) { return LAN_UU_TIEN.some((p) => rest.indexOf(p) === 0); }

function throttleCheck() {
  const now = Date.now();
  trimHits(now);
  const cap = Number(policy().gioi_han.goi_moi_phut) || 120;
  const used = countSince(now, 60_000);
  if (used >= cap) {
    // còn bao lâu thì lời gọi cũ nhất trong cửa sổ rơi ra ngoài
    const oldest = hits[hits.length - used] ?? now;
    return { ok: false, retryAfter: Math.max(1, Math.ceil((oldest + 60_000 - now) / 1000)), used, cap };
  }
  return { ok: true, used, cap };
}

function jsonRes(res, code, obj) {
  const b = Buffer.from(JSON.stringify(obj), "utf8");
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Content-Length": b.length });
  res.end(b);
}

/* ── PROXY /api/rma/* ────────────────────────────────────────────────── */
function handleRma(req, res, urlPath, search) {
  if (!RMA_KEY) {
    return jsonRes(res, 503, {
      ok: false,
      msg: "Máy chủ chưa có RIMS_RMA_API_KEY. Đặt trong .env ở gốc RIMS (xem .env.example).",
    });
  }

  const rest = urlPath.slice("/api/rma".length) || "/";

  // Thống kê: xem tải thật, không tính vào van
  if (rest === "/_thongke") {
    const now = Date.now(); trimHits(now);
    const top = [...byPath.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
      .map(([duong_dan, so_lan]) => ({ duong_dan, so_lan }));
    return jsonRes(res, 200, {
      ok: true,
      cong_don_tu: new Date(bootAt).toISOString(),
      phut_qua: countSince(now, 60_000),
      gio_qua: hits.length,
      tran_moi_phut: Number(policy().gioi_han.goi_moi_phut) || 120,
      bi_van_chan: blocked,
      lan_uu_tien: LAN_UU_TIEN,
      loi_gan_nhat: lastErr,
      duong_dan_goi_nhieu_nhat: top,
    });
  }

  const t = uuTien(rest) ? { ok: true } : throttleCheck();
  if (!t.ok) {
    blocked++;
    res.writeHead(429, { "Content-Type": "application/json; charset=utf-8", "Retry-After": String(t.retryAfter) });
    return res.end(JSON.stringify({
      ok: false, van: true, cho_giay: t.retryAfter, da_goi: t.used, tran: t.cap,
      msg: `Van tiết lưu: đã gọi ${t.used}/${t.cap} lời gọi trong 1 phút. Chờ ${t.retryAfter}s. Giữ nguyên bản số tốt đang có, đừng xoá.`,
    }));
  }

  hits.push(Date.now());
  byPath.set(rest, (byPath.get(rest) || 0) + 1);

  let body = "";
  req.on("data", (c) => { body += c; if (body.length > 1_000_000) req.destroy(); });
  req.on("end", async () => {
    const target = RMA_GATEWAY + rest + (search || "");
    try {
      const opts = {
        method: req.method,
        headers: { "x-api-key": RMA_KEY },
        signal: AbortSignal.timeout(Number(ENV.RIMS_HTTP_TIMEOUT || 30) * 1000),
      };
      if (req.method !== "GET" && req.method !== "HEAD" && body) {
        opts.body = body;
        opts.headers["Content-Type"] = req.headers["content-type"] || "application/json";
      }
      const up = await fetch(target, opts);
      const buf = Buffer.from(await up.arrayBuffer());
      res.writeHead(up.status, {
        "Content-Type": up.headers.get("content-type") || "application/json; charset=utf-8",
        "Content-Length": buf.length,
        "Cache-Control": "no-store",
      });
      res.end(buf);
    } catch (e) {
      lastErr = { luc: new Date().toISOString(), duong_dan: rest, loi: String(e && e.message || e) };
      jsonRes(res, 502, { ok: false, msg: "Không gọi được gateway RMA: " + (e && e.message || e) });
    }
  });
}

/* ── /api/health — trạng thái kết nối các API (server tự kiểm, tránh CORS + ẩn khoá) ── */
let _healthCache = { at: 0, data: null };
async function handleHealth(res) {
  const now = Date.now();
  if (_healthCache.data && now - _healthCache.at < 15000) return jsonRes(res, 200, _healthCache.data);
  async function ping(url, headers) {
    if (!url) return { ok: null, note: "chưa cấu hình" };
    try {
      const r = await fetch(url, { method: "GET", headers: headers || {}, signal: AbortSignal.timeout(6000) });
      return { ok: (r.status >= 200 && r.status < 500), note: "HTTP " + r.status };
    } catch (e) { return { ok: false, note: String((e && e.message) || e) }; }
  }
  const results = await Promise.all([
    ping(RMA_GATEWAY, RMA_KEY ? { "x-api-key": RMA_KEY } : null),
    ping(RAINLAB_BASE + "/health"),
    ping(RESOURCES_BASE),
    ping(TANK_BASE),
  ]);
  const hnt = await hntHealth();
  const data = { ok: true, nguon: { rma: results[0], rainlab: results[1], resources: results[2], tank: results[3], hnt: hnt } };
  _healthCache = { at: now, data: data };
  jsonRes(res, 200, data);
}

/* ── PROXY /api/rainlab/* → RainLab QC API (loopback, không khoá) ─────── */
function handleRainlab(req, res, urlPath, search) {
  const rest = urlPath.slice("/api/rainlab".length) || "/";
  const target = RAINLAB_BASE + rest + (search || "");
  // classify mất 5–9 s; cho chờ rộng hơn timeout RMA.
  const to = Number(ENV.RIMS_RAINLAB_TIMEOUT || 45) * 1000;
  (async () => {
    try {
      const opts = { method: req.method, signal: AbortSignal.timeout(to), headers: {} };
      if (RAINLAB_KEY) opts.headers["X-API-Key"] = RAINLAB_KEY;
      const up = await fetch(target, opts);
      const buf = Buffer.from(await up.arrayBuffer());
      res.writeHead(up.status, {
        "Content-Type": up.headers.get("content-type") || "application/json; charset=utf-8",
        "Content-Length": buf.length,
        "Cache-Control": "no-store",
      });
      res.end(buf);
    } catch (e) {
      var code = (e && e.cause && e.cause.code) || (e && e.code) || "";
      var chi = (e && e.message || String(e)) + (code ? " [" + code + "]" : "");
      console.error("[rainlab] " + req.method + " " + target + " -> " + chi);
      jsonRes(res, 502, { ok: false, target: target, code: code, msg: "Không gọi được RainLab QC (" + RAINLAB_BASE + "). Lỗi: " + chi + ". Kiểm dịch vụ RainLab + địa chỉ RIMS_RAINLAB_BASE trong .env." });
    }
  })();
}

/* ── /api/settings — đọc & ghi chính sách gọi dữ liệu ────────────────── */
function handleSettingsGet(res) { jsonRes(res, 200, { ok: true, chinh_sach: policy() }); }

function handleSettingsPost(req, res) {
  let body = "", tooBig = false;
  req.on("data", (c) => { body += c; if (body.length > 65536) { tooBig = true; req.destroy(); } });
  req.on("end", () => {
    if (tooBig) return jsonRes(res, 413, { ok: false, msg: "Nội dung quá lớn" });
    let obj;
    try { obj = JSON.parse(body || "{}"); } catch { return jsonRes(res, 400, { ok: false, msg: "JSON lỗi" }); }

    const cur = policy();
    if (obj.nhip && typeof obj.nhip === "object") {
      for (const [k, v] of Object.entries(obj.nhip)) {
        if (!cur.nhip[k] || !v || typeof v !== "object") continue;
        const p = Number(v.phut);
        if (isFinite(p)) cur.nhip[k].phut = Math.max(1, Math.min(1440, Math.round(p)));   // 1 phút .. 24 giờ
        if (typeof v.bat === "boolean") cur.nhip[k].bat = v.bat;
      }
    }
    if (obj.gioi_han && typeof obj.gioi_han === "object") {
      const g = obj.gioi_han;
      if (isFinite(Number(g.goi_moi_phut)))         cur.gioi_han.goi_moi_phut      = Math.max(6,  Math.min(3000, Math.round(Number(g.goi_moi_phut))));
      if (isFinite(Number(g.song_song)))            cur.gioi_han.song_song         = Math.max(1,  Math.min(16,   Math.round(Number(g.song_song))));
      if (isFinite(Number(g.tram_toi_da_moi_vong))) cur.gioi_han.tram_toi_da_moi_vong = Math.max(10, Math.min(100000, Math.round(Number(g.tram_toi_da_moi_vong))));
    }
    try {
      fs.mkdirSync(path.dirname(POLICY_FILE), { recursive: true });
      fs.writeFileSync(POLICY_FILE, JSON.stringify(cur, null, 2) + "\n", "utf8");
    } catch (e) {
      return jsonRes(res, 500, { ok: false, msg: e.message });
    }
    jsonRes(res, 200, { ok: true, chinh_sach: cur });
  });
}

/* ── PHỤC VỤ TỆP TĨNH ────────────────────────────────────────────────── */
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".geojson": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".webp": "image/webp", ".woff": "font/woff", ".woff2": "font/woff2",
};

const bootAt = Date.now();

/* ── /api/hnt/* — nguồn vận hành đập HNT/SEHO (login server-side, ẩn khoá, tránh CORS) ──
   Mỗi hồ 1 subdomain; đăng nhập lấy JWT rồi POST data/fromto để lấy chuỗi vận hành
   theo kỳ. KHÔNG để trình duyệt gọi thẳng (lộ khoá + CORS). Khoá đọc từ .env. */
const DAM_HNT = {
  hoho:      { ten: "Hố Hô",      base: "https://hoho.seho.vn/api/renew" },
  ngantruoi: { ten: "Ngàn Trươi", base: "https://ngantruoi.seho.vn/api/renew" },
};
function hntCredFor(key) {
  const U = "SEHO_" + key.toUpperCase() + "_USER", P = "SEHO_" + key.toUpperCase() + "_PASS";
  let user = ENV[U], pass = ENV[P];
  if (user && pass) return { user, pass };
  user = ENV.SEHO_USER || ENV.RIMS_SEHO_USER; pass = ENV.SEHO_PASS || ENV.RIMS_SEHO_PASS;
  if (user && pass) return { user, pass };
  try {
    const txt = fs.readFileSync(path.join(REPO, "app", "web", "secret.local.js"), "utf8");
    const mu = /username\s*:\s*['"]([^'"]+)['"]/.exec(txt), mp = /password\s*:\s*['"]([^'"]+)['"]/.exec(txt);
    if (mu && mp && mu[1] && mp[1] && !/^\*+$/.test(mu[1])) return { user: mu[1], pass: mp[1] };
  } catch (_) {}
  return null;
}
function hntFmtT(d) {
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":00";
}
async function hntLogin(base, cred) {
  const r = await fetch(base + "/Auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: cred.user, password: cred.pass }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error("login HTTP " + r.status);
  const j = await r.json();
  const tk = (j && j.data && j.data.token) || (j && j.data) || null;
  if (!tk || !tk.access) throw new Error("không thấy access token");
  return tk.access;
}
async function hntFromto(base, token, fromD, toD) {
  const r = await fetch(base + "/v1/Dashboard/data/fromto", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ startTime: hntFmtT(fromD), endTime: hntFmtT(toD), hydro_code: "" }),
    signal: AbortSignal.timeout(Number(ENV.RIMS_HTTP_TIMEOUT || 45) * 1000),
  });
  if (!r.ok) throw new Error("data/fromto HTTP " + r.status);
  const j = await r.json();
  const D = (j && j.data) || {};
  return Array.isArray(D.general_datas) ? D.general_datas : [];
}
async function hntHealth() {
  const dam = "hoho", cfg = DAM_HNT[dam], cred = hntCredFor(dam);
  if (!cred) return { ok: false, note: "thiếu tài khoản SEHO trong .env" };
  try { await hntLogin(cfg.base, cred); return { ok: true, note: "đăng nhập HNT OK (" + dam + ")" }; }
  catch (e) { return { ok: false, note: String((e && e.message) || e) }; }
}
function handleHntUsage(req, res, search) {
  const q = new URLSearchParams(search || "");
  const dam = (q.get("dam") || "").toLowerCase(), cfg = DAM_HNT[dam];
  if (!cfg) return jsonRes(res, 400, { ok: false, msg: "dam không hợp lệ (hoho|ngantruoi)" });
  const fromSec = Number(q.get("from")), toSec = Number(q.get("to"));
  if (!fromSec || !toSec || toSec <= fromSec) return jsonRes(res, 400, { ok: false, msg: "from/to (epoch giây) không hợp lệ" });
  const cred = hntCredFor(dam);
  if (!cred) return jsonRes(res, 503, { ok: false, msg: "Máy chủ chưa có tài khoản SEHO cho " + dam + " (đặt SEHO_" + dam.toUpperCase() + "_USER/PASS hoặc SEHO_USER/PASS trong .env)" });
  (async () => {
    try {
      const token = await hntLogin(cfg.base, cred);
      const gen = await hntFromto(cfg.base, token, new Date(fromSec * 1000), new Date(toSec * 1000));
      jsonRes(res, 200, { ok: true, dam: dam, ten: cfg.ten, nguon: "HNT", n: gen.length, general: gen });
    } catch (e) {
      jsonRes(res, 502, { ok: false, dam: dam, msg: "Gọi API HNT thất bại: " + String((e && e.message) || e) });
    }
  })();
}


const server = http.createServer((req, res) => {
  let urlPath, search = "";
  try {
    const u = new URL(req.url, "http://x");
    urlPath = decodeURIComponent(u.pathname);
    search = u.search || "";
  } catch { res.writeHead(400); return res.end("Bad request"); }

  if (urlPath === "/" || urlPath === "") urlPath = "/index.html";

  if (urlPath === "/api/rma" || urlPath.startsWith("/api/rma/")) return handleRma(req, res, urlPath, search);
  if (urlPath === "/api/rainlab" || urlPath.startsWith("/api/rainlab/")) return handleRainlab(req, res, urlPath, search);
  if (urlPath === "/api/health") return handleHealth(res);
  if (urlPath === "/api/hnt/usage") return handleHntUsage(req, res, search);
  if (urlPath === "/api/settings") {
    if (req.method === "GET")  return handleSettingsGet(res);
    if (req.method === "POST") return handleSettingsPost(req, res);
    res.writeHead(405); return res.end("Method not allowed");
  }

  // chặn path traversal
  const abs = path.normalize(path.join(ROOT, urlPath));
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end("Forbidden"); }

  fs.stat(abs, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("404 · " + urlPath);
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(abs).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Content-Length": st.size,
    });
    fs.createReadStream(abs).pipe(res);
  });
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`\n  [LỖI] Cổng ${PORT} đang bận. Chạy cổng khác:  node app/services/server/serve.mjs 8081\n`);
    process.exit(1);
  }
  throw e;
});

server.listen(PORT, HOST, () => {
  const p = policy();
  console.log(`
  RIMS — Hệ thống tích hợp quản lý hồ chứa
  ────────────────────────────────────────────────────────────
    Địa chỉ      :  http://localhost:${PORT}/index.html
    Thư mục      :  ${ROOT}
    Khoá RMA     :  ${RMA_KEY ? "đã nạp từ .env (trình duyệt KHÔNG thấy)" : "⚑ CHƯA CÓ — lớp Trạm và Mưa dự báo sẽ tắt"}
    Gateway RMA  :  ${RMA_GATEWAY}
    RainLab QC   :  ${RAINLAB_BASE}  (proxy: /api/rainlab/*) ${RAINLAB_KEY ? "· có khoá" : "· CHƯA CÓ KHOÁ"}
    Van tiết lưu :  ${p.gioi_han.goi_moi_phut} lời gọi/phút · ${p.gioi_han.song_song} luồng song song
    Chính sách   :  ${fs.existsSync(POLICY_FILE) ? "data/fetch_policy.json" : "MẶC ĐỊNH (chưa có fetch_policy.json)"}
    Tải thật     :  http://localhost:${PORT}/api/rma/_thongke
  ────────────────────────────────────────────────────────────
    Dừng: Ctrl+C
`);
});

// PULLER NỀN: tự kéo dam_history/tank định kỳ (server-side, live)
if (process.env.RIMS_PULLER !== "off") {
  const mins = String(Number(process.env.RIMS_PULLER_MIN) || 10);
  const startPuller = () => {
    const c = spawn(process.execPath, [path.join(HERE, "dam_pull_live.mjs"), "--loop=" + mins],
      { cwd: HERE, env: process.env, stdio: "inherit" });
    c.on("exit", (code) => { console.log("[puller] thoát code=" + code + " — khởi động lại sau 60s"); setTimeout(startPuller, 60000); });
    c.on("error", (e) => console.error("[puller] lỗi spawn:", e && e.message));
  };
  startPuller();
  console.log("[puller] đã bật — nhịp " + mins + " phút (tắt bằng RIMS_PULLER=off)");
}

