/* ===================================================================
   Quacki — Online-Bestenliste (eigenstaendig, ohne Fremd-Bibliothek)
   - Spricht Supabase per REST (fetch) an: INSERT (POST) + Top-N (GET).
   - Echtzeit via Polling (alle ~5 s), funktioniert auf Vercel UND GitHub Pages.
   - Faellt automatisch auf eine lokale Liste (localStorage) zurueck, wenn keine
     Config gesetzt oder das Backend nicht erreichbar ist -> Spiel laeuft immer.
   - Keine fest verdrahtete URL: die Basis-URL kommt aus leaderboard-config.js.
   Oeffentliche API:  window.Leaderboard = { configured, clean, escapeHtml,
                       submit, top, startPolling, stopPolling }
   =================================================================== */
(function () {
  "use strict";
  var CFG = (typeof window !== "undefined" && window.LEADERBOARD_CONFIG) || {};
  var BASE = String(CFG.SUPABASE_URL || "").replace(/\/+$/, "");
  var ANON = String(CFG.SUPABASE_ANON_KEY || "");
  var TABLE = "scores";
  var LOCAL_KEY = "quacki_scores";
  var MAX_NAME = 20;
  var hasFetch = (typeof fetch === "function");
  var setI = (typeof setInterval === "function") ? setInterval : function () { return 0; };
  var clrI = (typeof clearInterval === "function") ? clearInterval : function () {};

  function configured() { return !!(BASE && ANON && hasFetch); }

  // Namen kindersicher + speichersicher machen: Steuerzeichen (Code < 32 oder 127)
  // und HTML-gefaehrliche Zeichen entfernen, trimmen, auf MAX_NAME kappen.
  function clean(name) {
    var raw = String(name == null ? "" : name), out = "";
    for (var i = 0; i < raw.length && out.length < MAX_NAME; i++) {
      var code = raw.charCodeAt(i), ch = raw.charAt(i);
      if (code < 32 || code === 127) continue;
      if (ch === "<" || ch === ">" || ch === "&" || ch === '"' || ch === "'") continue;
      out += ch;
    }
    out = out.replace(/\s+/g, " ").trim();
    return out || "Quacki";
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- lokale Fallback-Liste ---------- */
  function localAll() {
    try { var a = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function localSave(a) { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(a.slice(0, 100))); } catch (e) {} }
  function localInsert(r) {
    var a = localAll(); a.push(r);
    a.sort(function (x, y) { return (y.score | 0) - (x.score | 0); });
    localSave(a); return a;
  }
  function localTop(n) { return localAll().slice(0, n || 20); }
  function nowISO() { try { return new Date().toISOString(); } catch (e) { return ""; } }
  function makeRec(name, score, mode) {
    return { name: clean(name), score: Math.max(0, score | 0), mode: (mode === "arcade" ? "arcade" : "story") };
  }
  function headers() {
    return { "apikey": ANON, "Authorization": "Bearer " + ANON, "Content-Type": "application/json" };
  }

  /* ---------- absenden ---------- */
  // Promise auf { ok, online, name }. Schreibt IMMER auch lokal, damit der eigene
  // Eintrag sofort sichtbar ist (auch offline).
  function submit(name, score, mode) {
    var r = makeRec(name, score, mode);
    var local = { name: r.name, score: r.score, mode: r.mode, created_at: nowISO(), _local: true };
    if (!configured()) { localInsert(local); return Promise.resolve({ ok: true, online: false, name: r.name }); }
    var h = headers(); h["Prefer"] = "return=minimal";
    return fetch(BASE + "/rest/v1/" + TABLE, { method: "POST", headers: h, body: JSON.stringify(r) })
      .then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); localInsert(local); return { ok: true, online: true, name: r.name }; })
      .catch(function () { localInsert(local); return { ok: true, online: false, name: r.name }; });
  }

  /* ---------- Top-N abrufen ---------- */
  // Promise auf { rows:[{name,score,mode,created_at}], online }.
  function top(n) {
    n = n || 20;
    if (!configured()) return Promise.resolve({ rows: localTop(n), online: false });
    var url = BASE + "/rest/v1/" + TABLE + "?select=name,score,mode,created_at&order=score.desc&limit=" + n;
    return fetch(url, { headers: headers() })
      .then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
      .then(function (rows) { return { rows: Array.isArray(rows) ? rows : [], online: true }; })
      .catch(function () { return { rows: localTop(n), online: false }; });
  }

  /* ---------- Echtzeit via Polling ---------- */
  var pollId = null;
  function startPolling(cb, ms) {
    stopPolling();
    var tick = function () { top(20).then(function (res) { if (cb) cb(res); }); };
    tick();
    pollId = setI(tick, ms || 5000);
  }
  function stopPolling() { if (pollId) { clrI(pollId); pollId = null; } }

  window.Leaderboard = {
    configured: configured, clean: clean, escapeHtml: escapeHtml,
    submit: submit, top: top, startPolling: startPolling, stopPolling: stopPolling,
    _localTop: localTop, _localAll: localAll
  };
})();
