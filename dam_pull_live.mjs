/* dam_pull_live.mjs — HHT-DAMPULL v2.0 · Puller LIVE ĐA HỒ (SEHO/HNT) theo ROSTER
   ═══════════════════════════════════════════════════════════════════════════
   v2.0 (17/09/2026): TỔNG QUÁT HOÁ từ 2 đập cứng (Hố Hô/Ngàn Trươi) sang ROSTER.
   Đọc data/hnt/roster.json → kéo MỌI hồ có has_op=true theo ĐÚNG cách cũ:
     login {base}/Auth/login → POST {base}/v1/Dashboard/data/fromto (data vận hành)
     + GET {base}/v1/dashboard/outlet/getall (cửa van) → ghi modules/<key>/dam_history_<key>.json
   Thêm: kéo DỰ BÁO TANK (WTM, không token) → modules/<key>/tank_<key>.json.
   Thêm: chế độ --probe (chỉ THĂM DÒ, không sửa lịch sử) → in bảng + ghi data/hnt/probe.json:
     mỗi hồ: login ok? · số bản ghi vận hành · mốc cuối · số cửa van · tank ok?
   Giữ NGUYÊN cơ chế cũ: kéo tăng dần, chống-lỗi-nguồn 3 bậc, GIỮ-BẢN-TỐT, ghi atomic.

   CHẠY:
     node dam_pull_live.mjs              # kéo mọi hồ has_op, một nhịp rồi thoát
     node dam_pull_live.mjs hoho         # chỉ một hồ (theo key trong roster)
     node dam_pull_live.mjs --loop=5     # vòng lặp mỗi 5'
     node dam_pull_live.mjs --probe      # THĂM DÒ mọi hồ has_op (không sửa lịch sử)
     node dam_pull_live.mjs --dry        # chỉ in cấu hình đã giải, không gọi mạng
   ═══════════════════════════════════════════════════════════════════════════ */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB  = HERE;   // deploy: modules/ & data/ nằm ngay gốc repo
const REPO = HERE;
const ROSTER_FILE = path.join(WEB, "data", "hnt", "roster.json");
const PROBE_FILE  = path.join(WEB, "data", "hnt", "probe.json");

/* ── ĐƯỜNG LUI khi chưa có roster: 2 đập gốc (không phá bản đang chạy) ──────── */
const FALLBACK_DAMS = {
  hoho:      { ten: "Hố Hô",      base: "https://hoho.seho.vn/api/renew",      hydroCode: "", fillSensor: false, sourceCadenceMin: null, keepDays: 15, tank_project: "HoHoWPE" },
  ngantruoi: { ten: "Ngàn Trươi", base: "https://ngantruoi.seho.vn/api/renew", hydroCode: "", fillSensor: false, sourceCadenceMin: null, keepDays: 15, tank_project: "NganTruoiWPE" },
};

/* ── nạp roster → map DAMS (chỉ hồ has_op) ─────────────────────────────────── */
let TANK_BASE = "https://wpe-tools.seho.vn/api/wtm/api/TankModel";
function loadDams() {
  try {
    const j = JSON.parse(fs.readFileSync(ROSTER_FILE, "utf8"));
    if (j && j.tank_base) TANK_BASE = j.tank_base;
    const out = {};
    for (const d of (j && j.dams) || []) {
      if (!d.has_op || !d.base || !d.key) continue;
      out[d.key] = {
        ten: d.ten || d.key,
        base: d.base,
        hydroCode: d.hydroCode || "",
        fillSensor: !!d.fillSensor,
        sourceCadenceMin: (d.sourceCadenceMin ?? null),
        keepDays: d.keepDays || 15,
        tank_project: d.tank_project || "",
      };
    }
    if (Object.keys(out).length) return out;
    warn("roster.json không có hồ has_op — dùng ĐƯỜNG LUI 2 đập gốc.");
  } catch (e) {
    warn("không đọc được roster.json (" + (e && e.message) + ") — dùng ĐƯỜNG LUI 2 đập gốc.");
  }
  return FALLBACK_DAMS;
}

const OBS_DAYS = 3, FC_DAYS = 3, OVERLAP_MIN = 90, CATCHUP_DAYS = 10, TIMEOUT_MS = 45000;
const PROBE_DAYS = 2; // cửa sổ nhỏ khi thăm dò

/* Hồ CHỈ DỰ BÁO (module=true, has_op=false): không có backend vận hành, chỉ có
   dự báo tank (WTM). Đọc từ roster để puller ghi dam_history rỗng-vận-hành + forecast. */
function loadFcDams() {
  try {
    const j = JSON.parse(fs.readFileSync(ROSTER_FILE, "utf8"));
    const out = {};
    for (const d of (j && j.dams) || []) {
      if (!d.module || d.has_op || !d.key) continue;
      out[d.key] = { ten: d.ten || d.key, tank_project: d.tank_project || "", keepDays: d.keepDays || 15 };
    }
    return out;
  } catch (_) { return {}; }
}

/* ── tiện ích ─────────────────────────────────────────────────────────────── */
function readJsonSafe(p) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (_) { return null; } }
function writeJsonAtomic(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(obj)); fs.renameSync(tmp, p);
}
function num(v) { const x = Number(v); return Number.isFinite(x) ? x : null; }
function pad(n) { return String(n).padStart(2, "0"); }
function fmtT(d) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":00";
}
function log(...a) { console.log("[dam-pull]", ...a); }
function warn(...a) { console.warn("[dam-pull] ⚠", ...a); }
function hashOf(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

/* ── credential (giữ nguyên: per-key → chung SEHO_USER/RIMS_SEHO_USER) ──────── */
function parseEnvFile() {
  const p = path.join(REPO, ".env"), out = {};
  if (!fs.existsSync(p)) return out;
  try { for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line); if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, ""); } } catch (_) {}
  return out;
}
function credFor(key) {
  const ENV = parseEnvFile();
  // (1) tài khoản RIÊNG từng hồ trong file JSON (KHÔNG phải .env — tool ghi được): {"<key>":{"user":"","pass":""}}
  try {
    const FILE = JSON.parse(fs.readFileSync(path.join(HERE, "dam_creds.local.json"), "utf8")) || {};
    if (FILE[key] && FILE[key].user && FILE[key].pass) return { user: FILE[key].user, pass: FILE[key].pass, src: "dam_creds.local.json" };
  } catch (_) {}
  const U = `SEHO_${key.toUpperCase()}_USER`, P = `SEHO_${key.toUpperCase()}_PASS`;
  let user = process.env[U] || ENV[U], pass = process.env[P] || ENV[P];
  if (user && pass) return { user, pass, src: process.env[U] ? "env" : ".env(riêng)" };
  user = process.env.SEHO_USER || ENV.SEHO_USER || process.env.RIMS_SEHO_USER || ENV.RIMS_SEHO_USER;
  pass = process.env.SEHO_PASS || ENV.SEHO_PASS || process.env.RIMS_SEHO_PASS || ENV.RIMS_SEHO_PASS;
  if (user && pass) return { user, pass, src: ".env(chung)" };
  return null;
}

/* ── HTTP có JWT ─────────────────────────────────────────────────────────── */
async function login(cfg, cred) {
  const r = await fetch(cfg.base + "/Auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: cred.user, password: cred.pass }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!r.ok) throw new Error("login HTTP " + r.status);
  const j = await r.json();
  const tk = (j && j.data && j.data.token) || (j && j.data) || null;
  if (!tk || !tk.access) {
    const keys = j && j.data ? Object.keys(j.data).join(", ") : "(không có j.data)";
    throw new Error("login: không thấy access token — j.data có: " + keys);
  }
  return tk.access;
}
async function authed(url, token, opts) {
  const o = Object.assign({ signal: AbortSignal.timeout(TIMEOUT_MS) }, opts || {});
  o.headers = Object.assign({}, o.headers, { Authorization: "Bearer " + token });
  return fetch(url, o);
}
function parseBadId(msg, lo, hi) {
  const m = String(msg || "").match(/id\s*=\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const y = +m[3], A = +m[1], B = +m[2], hh = +m[4], mm = +m[5], ss = +m[6];
  const mk = (mo, da) => { if (mo < 1 || mo > 12 || da < 1 || da > 31) return null; const d = new Date(y, mo - 1, da, hh, mm, ss); return isNaN(d.getTime()) ? null : d; };
  const us = mk(A, B), eu = mk(B, A);
  const inWin = (d) => d && (!lo || d.getTime() >= lo.getTime() - 3600000) && (!hi || d.getTime() <= hi.getTime() + 3600000);
  if (inWin(us)) return us; if (inWin(eu)) return eu; return us || eu;
}

/* ── DỰ BÁO TANK (WTM, KHÔNG token) ─────────────────────────────────────────
   Lấy file dự báo mới nhất của dự án rồi parse JSON sẵn. GIỮ-BẢN-TỐT nếu lỗi. */
async function pullTank(key, cfg) {
  const proj = cfg.tank_project; if (!proj) return null;
  const outFile = path.join(WEB, "modules", key, `tank_${key}.json`);
  try {
    const rf = await fetch(`${TANK_BASE}/inflow-forecast/files?project=${encodeURIComponent(proj)}&limit=1`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!rf.ok) throw new Error("files HTTP " + rf.status);
    const jf = await rf.json();
    const file = jf && jf.data && jf.data[0] && jf.data[0].file_name;
    if (!file) return { ok: false, note: "chưa có file dự báo" };
    const rc = await fetch(`${TANK_BASE}/inflow-forecast/content?project=${encodeURIComponent(proj)}&file=${encodeURIComponent(file)}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!rc.ok) throw new Error("content HTTP " + rc.status);
    const jc = await rc.json();
    if (!jc || jc.status !== "success" || !jc.data) throw new Error((jc && jc.message) || "content rỗng");
    writeJsonAtomic(outFile, { meta: { project: proj, file, session: jf.data[0].session, pulledAt: new Date().toISOString() }, forecast: jc.data.forecast });
    return { ok: true, file, session: jf.data[0].session };
  } catch (e) {
    warn(cfg.ten + " tank:", (e && e.message) || e, "— giữ bản cũ.");
    return { ok: false, note: (e && e.message) || String(e) };
  }
}

/* ── KÉO HỒ CHỈ DỰ BÁO ───────────────────────────────────────────────────────
   Không có nguồn vận hành. Kéo dự báo tank (WTM, không token), dựng forecast_flow
   (Q đến dự báo) từ cột AllInflow_*_Wet, ghi dam_history_<key>.json để console hiện
   ĐỒ THỊ DỰ BÁO. Vận hành để rỗng ⇒ console hiện "chưa có số liệu vận hành". */
async function fetchTankForecast(proj) {
  const rf = await fetch(`${TANK_BASE}/inflow-forecast/files?project=${encodeURIComponent(proj)}&limit=1`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!rf.ok) throw new Error("files HTTP " + rf.status);
  const jf = await rf.json();
  const file = jf && jf.data && jf.data[0] && jf.data[0].file_name;
  if (!file) return null;
  const rc = await fetch(`${TANK_BASE}/inflow-forecast/content?project=${encodeURIComponent(proj)}&file=${encodeURIComponent(file)}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!rc.ok) throw new Error("content HTTP " + rc.status);
  const jc = await rc.json();
  if (!jc || jc.status !== "success" || !jc.data) throw new Error((jc && jc.message) || "content rỗng");
  return { file, session: jf.data[0].session, forecast: jc.data.forecast };
}
function tankToForecastFlow(forecast) {
  // Q đến TỔNG mô hình Wet: cột AllInflow_*_Wet. Trả [{forecast_data_time, kiv_forecast_value}].
  const v = forecast && forecast.values; if (!v) return [];
  const key = Object.keys(v).find((k) => /^AllInflow_.*_Wet$/.test(k)) || Object.keys(v).find((k) => /^AllInflow/.test(k));
  if (!key) return [];
  const out = [];
  for (const ts of Object.keys(v[key])) {
    const val = num(v[key][ts]); if (val == null) continue;
    out.push({ forecast_data_time: ts.replace(/\//g, "-") + ":00", kiv_forecast_value: val });
  }
  out.sort((a, b) => Date.parse(a.forecast_data_time.replace(" ", "T")) - Date.parse(b.forecast_data_time.replace(" ", "T")));
  return out;
}
/* Mưa bình quân lưu vực từ tank (cột Ave_1 = nguồn "Observed&72hour": quan trắc ở
   quá khứ, dự báo 72h ở tương lai). Tách theo NOW: rain (quan trắc) + forecast_rain.
   Định dạng khớp với dam_history của hồ vận hành để console + bảng lũ dùng chung. */
function tankToRain(forecast, now) {
  const v = forecast && forecast.values; if (!v) return { rain: [], forecast_rain: [] };
  const key = Object.keys(v).find((k) => /^Ave_1$/.test(k)) || Object.keys(v).find((k) => /^Ave_/.test(k));
  if (!key) return { rain: [], forecast_rain: [] };
  const nowMs = now || Date.now(), rain = [], frain = [];
  for (const ts of Object.keys(v[key])) {
    const val = num(v[key][ts]); if (val == null) continue;
    const ms = Date.parse(ts.replace(/\//g, "-").replace(" ", "T")); if (!Number.isFinite(ms)) continue;
    if (ms <= nowMs) rain.push({ datetime: Math.round(ms / 1000), value: val });
    else frain.push({ forecast_data_time: ts.replace(/\//g, "-") + ":00", rain_value: val });
  }
  rain.sort((a, b) => a.datetime - b.datetime);
  frain.sort((a, b) => Date.parse(a.forecast_data_time.replace(" ", "T")) - Date.parse(b.forecast_data_time.replace(" ", "T")));
  return { rain, forecast_rain: frain };
}
async function pullFcDam(key, cfg) {
  const outFile = path.join(WEB, "modules", key, `dam_history_${key}.json`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const prev = readJsonSafe(outFile) || {};
  const meta = { dam: key, ten: cfg.ten, fcOnly: true, lastPullAt: new Date().toISOString(), lastPullOk: false, error: null,
    lastDataAt: null, nGeneral: 0, forecast: prev.meta ? prev.meta.forecast || null : null };
  try {
    const t = await fetchTankForecast(cfg.tank_project);
    if (!t) { meta.error = "chưa có file dự báo tank"; writeJsonAtomic(outFile, Object.assign({}, prev, { meta })); return meta; }
    const fcFlow = tankToForecastFlow(t.forecast);
    const { rain, forecast_rain } = tankToRain(t.forecast, Date.now());
    const sig = hashOf(JSON.stringify(fcFlow.map((p) => [p.forecast_data_time, p.kiv_forecast_value])));
    const prevFc = meta.forecast || {};
    meta.forecast = { sig, seenAt: prevFc.sig === sig && prevFc.seenAt ? prevFc.seenAt : new Date().toISOString(), changed: prevFc.sig !== sig, nFlow: fcFlow.length, session: t.session, note: "Dự báo tank (WTM) — mưa & dòng chảy dự báo; hồ chưa có nguồn vận hành." };
    meta.lastPullOk = true;
    writeJsonAtomic(outFile, { meta, general: [], rain, forecast_flow: fcFlow, forecast_rain, gates: [] });
    // tank_<key>.json cho panel/khác dùng
    try { writeJsonAtomic(path.join(WEB, "modules", key, `tank_${key}.json`), { meta: { project: cfg.tank_project, file: t.file, session: t.session, pulledAt: new Date().toISOString() }, forecast: t.forecast }); } catch (_) {}
    log(`${cfg.ten} (dự báo): ok · ${fcFlow.length} điểm Q đến · mưa ${rain.length}+${forecast_rain.length} · phiên ${t.session || t.file}`);
    return meta;
  } catch (e) {
    meta.error = (e && e.message) || String(e); warn(cfg.ten + " (dự báo):", meta.error, "— giữ bản cũ.");
    writeJsonAtomic(outFile, Object.assign({}, prev, { meta }));
    return meta;
  }
}

/* ── TÍNH BẢNG XẾP HẠNG LŨ (cho công cụ "Dự báo mưa-dòng chảy") ───────────────
   Cửa sổ 6 ngày = [now-3d, now+3d]. Mỗi hồ có dam_history:
     rain_past3d = tổng mưa quan trắc 3 ngày qua · rain_fc3d = tổng mưa dự báo 3 ngày tới
     inflow(t) = quan trắc (inflow_avg_1h||total_discharge_lake) cho t≤now + dự báo (kiv) cho t>now
     peak = Q đến lớn nhất · base = Q nhỏ nhất TRƯỚC đỉnh (nền trước đó)
     has_flood = đỉnh ≥ base×K & (đỉnh-base) ≥ FLOOR & thời gian dâng ≥ RISE_HRS giờ */
const FLOOD_K = 1.5, FLOOD_FLOOR = 50, FLOOD_RISE_HRS = 6, FLOOD_WIN_DAYS = 3;
function computeFloodSummary() {
  let roster; try { roster = JSON.parse(fs.readFileSync(ROSTER_FILE, "utf8")); } catch (_) { return; }
  const now = Date.now(), lo = now - FLOOD_WIN_DAYS * 86400000, hi = now + FLOOD_WIN_DAYS * 86400000;
  const out = [];
  for (const d of (roster && roster.dams) || []) {
    if (!d.module || !d.key) continue;
    const H = readJsonSafe(path.join(WEB, "modules", d.key, `dam_history_${d.key}.json`));
    if (!H) continue;
    // chuỗi Q đến (quan trắc + dự báo), lọc trong cửa sổ.
    // Quan trắc phủ quá khứ [lo, now]; dự báo phủ phần SAU điểm quan trắc cuối.
    // Hồ CHỈ có dự báo (không quan trắc) → lấy toàn bộ đường dự báo trong cửa sổ
    // [lo, hi], nếu không sẽ mất cả sườn lên (đỉnh nằm ở phần "quá khứ dự báo").
    const ser = [];
    let lastObs = -Infinity;
    for (const p of H.general || []) { const t = num(p.date_time); if (t == null) continue; const ms = t * 1000; if (ms < lo || ms > now) continue; const q = (num(p.inflow_avg_1h) || num(p.total_discharge_lake)); if (q != null) { ser.push([ms, q, false]); if (ms > lastObs) lastObs = ms; } }
    const fcStart = (lastObs > -Infinity) ? lastObs : (lo - 1);
    for (const p of H.forecast_flow || []) { const ms = Date.parse(String(p.forecast_data_time).replace(" ", "T")); const q = num(p.kiv_forecast_value); if (!Number.isFinite(ms) || q == null) continue; if (ms <= fcStart || ms > hi) continue; ser.push([ms, q, true]); }
    ser.sort((a, b) => a[0] - b[0]);
    // mưa
    let rp = 0, rpN = 0; for (const p of H.rain || []) { const t = num(p.datetime); if (t == null) continue; const ms = t * 1000; if (ms >= lo && ms <= now) { const v = num(p.value); if (v != null) { rp += v; rpN++; } } }
    let rf = 0, rfN = 0; for (const p of H.forecast_rain || []) { const ms = Date.parse(String(p.forecast_data_time).replace(" ", "T")); if (!Number.isFinite(ms)) continue; if (ms > now && ms <= hi) { const v = num(p.rain_value); if (v != null) { rf += v; rfN++; } } }
    const row = { key: d.key, ten: d.ten || d.key, gis: d.gis || "", has_op: !!d.has_op,
      rain_past3d: rpN ? Math.round(rp * 10) / 10 : null, rain_fc3d: rfN ? Math.round(rf * 10) / 10 : null,
      peak: null, peak_time: null, peak_future: null, base: null, has_flood: false };
    if (ser.length) {
      let pi = 0; for (let i = 1; i < ser.length; i++) if (ser[i][1] > ser[pi][1]) pi = i;
      const peak = ser[pi][1], peakMs = ser[pi][0];
      // nền = Q nhỏ nhất TRƯỚC đỉnh. Đỉnh ở ngay đầu cửa sổ ⇒ không có "nền trước"
      // trong cửa sổ (lũ đang rút, không phải đang lên) ⇒ nền = chính đỉnh, riseHrs = 0.
      let base = peak, baseMs = peakMs;
      for (let i = 0; i < pi; i++) if (ser[i][1] < base) { base = ser[i][1]; baseMs = ser[i][0]; }
      if (base < 0) base = 0;   // lưu lượng đến âm = nhiễu cân bằng nước ⇒ sàn ở 0
      const riseHrs = (peakMs - baseMs) / 3600000;
      const isFuture = peakMs > now;
      row.peak = Math.round(peak * 10) / 10; row.peak_time = new Date(peakMs).toISOString(); row.peak_future = isFuture; row.base = Math.round(base * 10) / 10;
      // Đỉnh vượt nền trước đó đủ lớn (biên độ + tỉ lệ). Điều kiện "sườn lên ≥ RISE giờ"
      // CHỈ áp cho đỉnh DỰ BÁO (tương lai) — để loại gai nhiễu dự báo 1 giờ; còn lũ ĐÃ
      // xảy ra thì là thật, không cần ràng buộc thời lượng (nếu không sẽ bỏ sót lũ nhọn
      // hoặc lũ có nhánh lên nằm trước cửa sổ, ví dụ Ngàn Trươi).
      row.has_flood = (peak >= base * FLOOD_K) && ((peak - base) >= FLOOD_FLOOR) && (isFuture ? riseHrs >= FLOOD_RISE_HRS : true);
      row.rise_hrs = Math.round(riseHrs * 10) / 10;
    }
    out.push(row);
  }
  const nFlood = out.filter((r) => r.has_flood).length;
  writeJsonAtomic(path.join(WEB, "data", "hnt", "flood_summary.json"),
    { computedAt: new Date().toISOString(), params: { k: FLOOD_K, floor: FLOOD_FLOOR, riseHrs: FLOOD_RISE_HRS, windowDays: FLOOD_WIN_DAYS }, nDams: out.length, nFlood, dams: out });
  log(`flood_summary: ${out.length} hồ · ${nFlood} có lũ`);
}

/* ── THĂM DÒ MỘT HỒ (không sửa lịch sử) ─────────────────────────────────────── */
async function probeDam(key, cfg) {
  const row = { key, ten: cfg.ten, base: cfg.base, login: false, nGeneral: 0, lastDataAt: null, nGates: null, tank: null, err: null };
  const cred = credFor(key);
  if (!cred) { row.err = "thiếu tài khoản SEHO"; return row; }
  try {
    const token = await login(cfg, cred);
    row.login = true;
    const now = new Date(), from = new Date(now.getTime() - PROBE_DAYS * 86400000);
    const rr = await authed(cfg.base + "/v1/Dashboard/data/fromto", token, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startTime: fmtT(from), endTime: fmtT(now), hydro_code: cfg.hydroCode }),
    });
    if (!rr.ok) { row.err = "fromto HTTP " + rr.status; }
    else {
      const jj = await rr.json();
      if (!jj || jj.status === "error" || !jj.data) row.err = (jj && jj.message) || "không có data";
      else {
        const g = jj.data.general_datas || [];
        row.nGeneral = g.length;
        const lt = g.length ? num(g[g.length - 1].date_time) : null;
        row.lastDataAt = lt != null ? new Date(lt * 1000).toISOString() : null;
      }
    }
    try {
      const rg = await authed(cfg.base + "/v1/dashboard/outlet/getall?fillSensor=false", token, { method: "GET" });
      if (rg.ok) { const jg = await rg.json(); const arr = (jg && jg.data) || (Array.isArray(jg) ? jg : []); row.nGates = arr.length; }
    } catch (_) {}
  } catch (e) {
    let msg = e && e.message ? e.message : String(e); const c = e && e.cause; if (c && (c.code || c.message)) msg += " (" + (c.code || c.message) + ")";
    row.err = msg;
  }
  const t = await pullTank(key, cfg); // tank không token — cũng ghi luôn bản mới (vô hại)
  row.tank = t ? (t.ok ? ("ok · " + (t.session || t.file)) : ("KO · " + (t.note || ""))) : "—";
  return row;
}

/* ── KÉO MỘT HỒ (đầy đủ, giữ nguyên cơ chế cũ) ──────────────────────────────── */
async function pullDam(key, cfg) {
  const outFile = path.join(WEB, "modules", key, `dam_history_${key}.json`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const prev = readJsonSafe(outFile) || {};
  const prevGen = Array.isArray(prev.general) ? prev.general : [];
  const meta = {
    dam: key, ten: cfg.ten, sourceCadenceMin: cfg.sourceCadenceMin,
    lastPullAt: new Date().toISOString(), lastPullOk: false, error: null,
    lastDataAt: prev.meta ? prev.meta.lastDataAt || null : null,
    nGeneral: prevGen.length, forecast: prev.meta ? prev.meta.forecast || null : null,
    gatesAt: prev.meta ? prev.meta.gatesAt || null : null, credSrc: null,
  };
  const cred = credFor(key);
  if (!cred) { meta.error = "thiếu tài khoản SEHO (đặt trong .env)"; warn(cfg.ten + ":", meta.error); writeJsonAtomic(outFile, Object.assign({}, prev, { meta })); await pullTank(key, cfg); return meta; }
  meta.credSrc = cred.src;
  try {
    const token = await login(cfg, cred);
    const now = new Date(); let from;
    const lastMs = meta.lastDataAt ? Date.parse(meta.lastDataAt) : NaN;
    if (Number.isFinite(lastMs)) {
      from = new Date(lastMs - OVERLAP_MIN * 60000);
      const floor = new Date(now.getTime() - CATCHUP_DAYS * 86400000);
      if (from < floor) { from = floor; warn(cfg.ten + ": hở > " + CATCHUP_DAYS + " ngày — chỉ lấp tới trần."); }
    } else { from = new Date(now.getTime() - OBS_DAYS * 86400000); log(cfg.ten + ": chưa có lịch sử — nạp mồi " + OBS_DAYS + " ngày."); }
    const toFull = new Date(now.getTime() + FC_DAYS * 86400000);
    async function tryFromto(toD) {
      const rr = await authed(cfg.base + "/v1/Dashboard/data/fromto", token, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startTime: fmtT(from), endTime: fmtT(toD), hydro_code: cfg.hydroCode }),
      });
      if (!rr.ok) return { err: "data/fromto HTTP " + rr.status };
      const jj = await rr.json();
      if (!jj || jj.status === "error" || !jj.data) return { err: (jj && jj.message) || "không có data" };
      return { data: jj.data };
    }
    let D = null, fcOk = true;
    const a1 = await tryFromto(toFull);
    if (!a1.err) { D = a1.data; }
    else {
      warn(cfg.ten + ": nguồn báo lỗi cả lô — thử bóc bản ghi rác (" + a1.err + ")");
      const badTs = parseBadId(a1.err, from, toFull);
      if (badTs && badTs.getTime() - 60000 > from.getTime()) {
        const to2 = new Date(badTs.getTime() - 60000); const a2 = await tryFromto(to2);
        if (!a2.err) { D = a2.data; fcOk = (to2.getTime() >= now.getTime()); meta.sourceWarn = "Nguồn lỗi bản ghi lúc " + fmtT(badTs) + " — đã kéo tới trước mốc đó."; }
      }
      if (!D) { const a3 = await tryFromto(now); if (!a3.err) { D = a3.data; fcOk = false; meta.sourceWarn = "Nguồn lỗi (" + a1.err + ") — kéo quan trắc tới hiện tại; giữ dự báo cũ."; } }
      if (!D) throw new Error(a1.err);
    }
    const byT = new Map();
    for (const p of prevGen) { const t = num(p.date_time); if (t != null) byT.set(t, p); }
    let nNew = 0;
    for (const p of D.general_datas || []) { const t = num(p.date_time); if (t == null) continue; if (!byT.has(t)) nNew++; byT.set(t, p); }
    let general = [...byT.values()].sort((a, b) => num(a.date_time) - num(b.date_time));
    const cutMs = Date.now() - cfg.keepDays * 86400000;
    general = general.filter((p) => num(p.date_time) * 1000 >= cutMs);
    const rainPrev = Array.isArray(prev.rain) ? prev.rain : []; const rMap = new Map();
    for (const p of rainPrev) { const t = num(p.datetime); if (t != null) rMap.set(t, p); }
    for (const p of D.rain_datas || []) { const t = num(p.datetime); if (t != null) rMap.set(t, p); }
    let rain = [...rMap.values()].sort((a, b) => num(a.datetime) - num(b.datetime)).filter((p) => num(p.datetime) * 1000 >= cutMs);
    const fcFlow = fcOk ? (D.flow_forecast_datas || []).slice() : (Array.isArray(prev.forecast_flow) ? prev.forecast_flow : []);
    const fcRain = fcOk ? (D.rain_forecast_datas || []).slice() : (Array.isArray(prev.forecast_rain) ? prev.forecast_rain : []);
    if (!fcOk) meta.forecastStale = true;
    const fcSig = hashOf(JSON.stringify(fcFlow.map((p) => [p.forecast_data_time, p.kiv_forecast_value])));
    const prevFc = meta.forecast || {};
    meta.forecast = { sig: fcSig, seenAt: prevFc.sig === fcSig && prevFc.seenAt ? prevFc.seenAt : new Date().toISOString(), changed: prevFc.sig !== fcSig, nFlow: fcFlow.length, nRain: fcRain.length, note: "SEHO không trả mốc phát phiên — seenAt là lúc thấy chuỗi này lần đầu." };
    let gates = prev.gates || null;
    try {
      const ou = cfg.base + "/v1/dashboard/outlet/getall?fillSensor=" + (cfg.fillSensor ? "true" : "false");
      const rg = await authed(ou, token, { method: "GET" });
      if (!rg.ok) throw new Error("outlet/getall HTTP " + rg.status);
      const jg = await rg.json(); gates = (jg && jg.data) || (Array.isArray(jg) ? jg : []); meta.gatesAt = new Date().toISOString();
    } catch (e) { warn(cfg.ten + " cửa van:", e.message, "— giữ ảnh chụp cũ."); meta.gatesError = e.message; }
    const lastT = general.length ? num(general[general.length - 1].date_time) : null;
    meta.lastDataAt = lastT != null ? new Date(lastT * 1000).toISOString() : meta.lastDataAt;
    meta.nGeneral = general.length; meta.nNew = nNew; meta.lastPullOk = true; meta.error = null;
    writeJsonAtomic(outFile, { meta, general, rain, forecast_flow: fcFlow, forecast_rain: fcRain, gates });
    log(`${cfg.ten}: ok · ${general.length} bản ghi (+${nNew}) · mốc cuối ${meta.lastDataAt || "—"} · dự báo ${fcFlow.length}` + (meta.forecast.changed ? " (PHIÊN MỚI)" : ""));
    await pullTank(key, cfg);
    return meta;
  } catch (e) {
    let msg = e && e.message ? e.message : String(e); const c = e && e.cause; if (c && (c.code || c.message)) msg += " (" + (c.code || c.message) + ")";
    meta.error = msg; meta.lastPullOk = false; warn(cfg.ten + ":", msg, "— GIỮ BẢN TỐT.");
    writeJsonAtomic(outFile, Object.assign({}, prev, { meta }));
    await pullTank(key, cfg);
    return meta;
  }
}

/* ── main ────────────────────────────────────────────────────────────────── */
const args = process.argv.slice(2);
const dry = args.includes("--dry"), probe = args.includes("--probe");
const only = args.find((a) => !a.startsWith("--"));
const DAMS = loadDams();
const FCDAMS = loadFcDams();
const keys = only ? [only] : Object.keys(DAMS);
const fcKeys = only ? (FCDAMS[only] ? [only] : []) : Object.keys(FCDAMS);

if (dry) {
  for (const k of keys) { const c = credFor(k); const d = DAMS[k] || {}; log(`${k}: base=${d.base} · tank=${d.tank_project || "—"} · tài khoản=${c ? c.src : "KHÔNG THẤY"}`); }
} else if (probe) {
  log(`THĂM DÒ ${keys.length} hồ (cửa sổ ${PROBE_DAYS} ngày) — không sửa lịch sử…`);
  const rows = [];
  for (const k of keys) { const cfg = DAMS[k]; if (!cfg) { warn("không biết hồ:", k); continue; } rows.push(await probeDam(k, cfg)); }
  console.log("\nkey            hồ                 login  nBảnGhi  mốc cuối             cửa  tank");
  console.log("─".repeat(104));
  for (const r of rows) {
    const st = r.err ? ("LỖI " + r.err) : "";
    console.log(
      `${(r.key||"").padEnd(14)} ${(r.ten||"").padEnd(17)} ${(r.login?"OK ":"—  ").padEnd(6)} ${String(r.nGeneral).padStart(6)}  ${(r.lastDataAt||"—").padEnd(20)} ${String(r.nGates==null?"—":r.nGates).padStart(3)}  ${(r.tank||"—").slice(0,22)}   ${st}`
    );
  }
  const ok = rows.filter((r) => r.login && r.nGeneral > 0);
  console.log("\n=> KÉO ĐƯỢC VẬN HÀNH (login ok & có bản ghi): " + ok.length + "/" + rows.length);
  console.log("   " + ok.map((r) => r.key).join(", "));
  writeJsonAtomic(PROBE_FILE, { probedAt: new Date().toISOString(), rows });
  log("Đã ghi " + PROBE_FILE);
} else {
  const loopArg = args.find((a) => a.startsWith("--loop"));
  const loopMin = loopArg && loopArg.includes("=") ? Math.max(1, parseFloat(loopArg.split("=")[1]) || 5) : 5;
  async function tickAll() { let bad = 0;
    for (const k of keys) { const cfg = DAMS[k]; if (!cfg && !FCDAMS[k]) { warn("không biết hồ:", k); bad++; continue; } if (!cfg) continue; try { const m = await pullDam(k, cfg); if (!m.lastPullOk) bad++; } catch (e) { warn(k, "tick lỗi:", (e && e.message) || e); bad++; } }
    for (const k of fcKeys) { const cfg = FCDAMS[k]; if (!cfg) continue; try { const m = await pullFcDam(k, cfg); if (!m.lastPullOk) bad++; } catch (e) { warn(k, "tick(fc) lỗi:", (e && e.message) || e); bad++; } }
    try { computeFloodSummary(); } catch (e) { warn("flood_summary lỗi:", (e && e.message) || e); }
    return bad; }
  if (loopArg) { log(`Chạy VÒNG mỗi ${loopMin}′ (${keys.length} hồ vận hành + ${fcKeys.length} hồ dự báo) — Ctrl+C để dừng.`); await tickAll(); setInterval(tickAll, loopMin * 60000); }
  else { const bad = await tickAll(); process.exitCode = (bad >= keys.length + fcKeys.length && (keys.length + fcKeys.length) > 0) ? 1 : 0; }
}
