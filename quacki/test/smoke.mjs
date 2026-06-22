/* ===================================================================
   QUACKI Smoke-Test — dependency-frei (Node 18+, ESM).
   Laedt quacki/index.html, stubbt DOM/Canvas/Audio, durchlaeuft das
   Menue, spielt Level 1 automatisiert an, baut alle Welten-Level und
   prueft die Boss-Arena. Exit 0 = gruen, Exit 1 = Fehler.
   Aufruf:  node quacki/test/smoke.mjs
   =================================================================== */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const __dir = dirname(fileURLToPath(import.meta.url));
const HTML = join(__dir, "..", "index.html");

let failed = 0;
function ok(name) { console.log("  \x1b[32mPASS\x1b[0m " + name); }
function bad(name, err) { failed++; console.log("  \x1b[31mFAIL\x1b[0m " + name + (err ? "  -> " + err : "")); }
function assert(cond, name, detail) { cond ? ok(name) : bad(name, detail); }

/* ---------- DOM / Canvas / Audio Stubs ---------- */
const grad = { addColorStop() {} };
const ctxStub = new Proxy({}, {
  get(t, p) {
    if (p in t) return t[p];
    if (p === "createLinearGradient" || p === "createRadialGradient" || p === "createPattern") return () => grad;
    if (p === "measureText") return () => ({ width: 0 });
    return () => {};
  },
  set(t, p, v) { t[p] = v; return true; },
});

const els = new Map();
function makeEl(id) {
  const listeners = {};
  return {
    id, width: 384, height: 224, textContent: "", style: {},
    classList: { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, contains(c){return this._s.has(c);}, toggle(c,f){f?this._s.add(c):this._s.delete(c);} },
    getContext() { return ctxStub; },
    addEventListener(t, fn) { (listeners[t] || (listeners[t] = [])).push(fn); },
    setAttribute() {}, getAttribute() { return null; },
    _fire(t, e) { (listeners[t] || []).forEach(fn => fn(e || { preventDefault(){} })); },
  };
}
function getEl(id) { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); }

let clock = 0;
let pendingRaf = null;
const winListeners = {};

class GainStub { constructor(){ this.gain = { setValueAtTime(){}, exponentialRampToValueAtTime(){}, value:0 }; } connect(){ return this; } }
class OscStub { constructor(){ this.frequency = { value:0, setValueAtTime(){}, exponentialRampToValueAtTime(){} }; this.type=""; } connect(){ return this; } start(){} stop(){} }
class ACStub { constructor(){ this.currentTime=0; this.destination={}; this.state="running"; } createOscillator(){ return new OscStub(); } createGain(){ return new GainStub(); } resume(){ this.state="running"; } }

const sandbox = {
  console,
  Math, JSON, Date, Object, Array, String, Number, Boolean, isNaN, parseInt, parseFloat,
  setTimeout: () => 0, clearTimeout: () => {},
  performance: { now: () => clock },
  requestAnimationFrame: (cb) => { pendingRaf = cb; return 1; },
  cancelAnimationFrame: () => {},
  addEventListener: (t, fn) => { (winListeners[t] || (winListeners[t] = [])).push(fn); },
  removeEventListener: () => {},
  document: {
    getElementById: getEl,
    createElement: () => makeEl("dyn"),
    addEventListener: (t, fn) => { (winListeners[t] || (winListeners[t] = [])).push(fn); },
    body: { appendChild(){}, classList: { add(){}, remove(){} } },
  },
  localStorage: (() => { const m = new Map(); return { getItem:k=>m.has(k)?m.get(k):null, setItem:(k,v)=>m.set(k,String(v)), removeItem:k=>m.delete(k) }; })(),
  navigator: { serviceWorker: { register: () => ({ then: () => ({ catch: () => {} }) }) } },
};
sandbox.window = sandbox;
sandbox.window.AudioContext = ACStub;
sandbox.window.webkitAudioContext = ACStub;
sandbox.globalThis = sandbox;

/* ---------- Script extrahieren ---------- */
const html = readFileSync(HTML, "utf8");
const blocks = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
assert(blocks.length >= 1, "script-Block gefunden", "kein <script> in index.html");

/* Instrumentierung anhaengen: interne let/const-Bindings nach __game spiegeln.
   Wir referenzieren nur Bindings, die sicher existieren; optionale via try. */
const probe = `
;globalThis.__game = (function(){
  const g = {};
  try { Object.defineProperty(g,"state",{get:()=>state}); } catch(e){}
  try { Object.defineProperty(g,"L",{get:()=>L}); } catch(e){}
  try { Object.defineProperty(g,"worldIdx",{get:()=>worldIdx}); } catch(e){}
  try { Object.defineProperty(g,"lives",{get:()=>lives}); } catch(e){}
  try { Object.defineProperty(g,"score",{get:()=>score}); } catch(e){}
  try { Object.defineProperty(g,"boss",{get:()=>boss}); } catch(e){}
  try { Object.defineProperty(g,"subSel",{get:()=>subSel}); } catch(e){}
  try { Object.defineProperty(g,"curLevelIdx",{get:()=>curLevelIdx}); } catch(e){}
  try { g.worldProgress = worldProgress; } catch(e){}
  try { g.duck = duck; } catch(e){}
  try { g.keys = keys; } catch(e){}
  try { g.ST = ST; } catch(e){}
  try { g.WORLDS = WORLDS; } catch(e){}
  try { g.startGame = startGame; } catch(e){}
  try { g.storyAdvance = storyAdvance; } catch(e){}
  try { g.enterOverworld = enterOverworld; } catch(e){}
  try { g.enterSubmap = enterSubmap; } catch(e){}
  try { g.enterSelectedNode = enterSelectedNode; } catch(e){}
  try { g.beginLevel = beginLevel; } catch(e){}
  try { g.loadPlatform = loadPlatform; } catch(e){}
  try { g.nodeCount = nodeCount; } catch(e){}
  try { g.startBossIntro = startBossIntro; } catch(e){}
  try { g.pressJump = pressJump; } catch(e){}
  try { g.buildLevel = buildLevel; } catch(e){}
  return g;
})();
`;

/* ---------- Ausfuehren ---------- */
const ctx = vm.createContext(sandbox);
let loadErr = null;
try {
  vm.runInContext(blocks.join("\n;\n") + probe, ctx, { filename: "quacki-inline.js" });
} catch (e) { loadErr = e; }
assert(!loadErr, "Script laedt ohne Exception", loadErr && (loadErr.message + "\n" + loadErr.stack));
if (loadErr) finish();

const G = sandbox.__game;
assert(G, "Instrumentierung __game verfuegbar");
if (!G) finish();

/* ---------- Frame-Stepper ---------- */
let frameErr = null, framesRun = 0;
function step(n = 1) {
  for (let i = 0; i < n && !frameErr; i++) {
    const cb = pendingRaf; pendingRaf = null;
    if (!cb) { frameErr = "kein requestAnimationFrame registriert"; return; }
    clock += 16;
    try { cb(clock); framesRun++; } catch (e) { frameErr = e.message + "\n" + e.stack; }
  }
}

/* ---------- Ablauf ---------- */
// Loop einmal antreten, damit der erste draw() laeuft
step(2);
assert(!frameErr, "Title-Frames laufen fehlerfrei", frameErr);
assert(G.state === G.ST.TITLE, "Startzustand = TITLE", "state=" + G.state);

// Start -> Story -> Overworld
G.startGame();
assert(G.state === G.ST.STORY, "startGame -> STORY", "state=" + G.state);
G.storyAdvance(); // Intro-Cutscene -> Overworld
step(2);
assert(!frameErr, "Overworld-Frames laufen fehlerfrei", frameErr);

// Sub-Map: Welt 1 betreten
G.enterSubmap(0);
assert(G.state === G.ST.SUBMAP, "enterSubmap -> SUBMAP", "state=" + G.state);
step(2);
assert(!frameErr, "Sub-Map-Frames laufen fehlerfrei", frameErr);

// ALLE Welten x ALLE Level bauen + 1 Frame laufen (Tilemap-Parsing aller Packs)
const nWorlds = G.WORLDS.length;
let buildOk = true, buildDetail = "", levelsTotal = 0;
for (let i = 0; i < nWorlds && buildOk; i++) {
  const nLv = G.WORLDS[i].levels.length;
  for (let li = 0; li < nLv; li++) {
    try {
      frameErr = null;
      G.loadPlatform(i, li);   // direkt -> PLAY
      step(1);
      levelsTotal++;
      if (!G.L || !Array.isArray(G.L.foes)) { buildOk = false; buildDetail = "W" + (i+1) + "-L" + (li+1) + ": L/foes fehlt"; break; }
      if (frameErr) { buildOk = false; buildDetail = "W" + (i+1) + "-L" + (li+1) + ": " + frameErr; break; }
    } catch (e) { buildOk = false; buildDetail = "W" + (i+1) + "-L" + (li+1) + ": " + e.message; break; }
  }
}
assert(buildOk, "Alle " + levelsTotal + " Level (6 Welten x 2) bauen + laufen", buildDetail);

// Zurueck zu Welt 1, Level 1 automatisiert anspielen
frameErr = null;
G.loadPlatform(0, 0); step(1);
assert(G.state === G.ST.PLAY, "Level 1 aktiv (PLAY)", "state=" + G.state);
assert(G.L && G.L.foes.length > 0, "Level 1 hat Gegner", "foes=" + (G.L && G.L.foes.length));
const startX = G.duck.x;
for (let i = 0; i < 400 && !frameErr; i++) {
  G.keys.right = true;
  if (i % 35 === 0) G.pressJump();           // regelmaessig springen
  step(1);
}
G.keys.right = false;
assert(!frameErr, "Level 1: 400 Frames Gameplay fehlerfrei", frameErr);
assert(G.duck.x > startX, "Ente bewegt sich nach rechts", "startX=" + startX + " x=" + G.duck.x);

// Sub-Map Boss-Gating + Knoten-Routing
frameErr = null;
G.worldProgress[0] = G.WORLDS[0].levels.length; // alle Level erledigt -> Boss frei
G.enterSubmap(0);
assert(G.subSel === G.WORLDS[0].levels.length, "Sub-Map waehlt Boss-Knoten wenn Level fertig", "subSel=" + G.subSel);
G.enterSelectedNode(); // Boss-Knoten -> startBossIntro (Banter-Sequenz) -> STORY
assert(G.state === G.ST.STORY, "Boss-Knoten -> Boss-Intro (STORY)", "state=" + G.state);
// Durch alle Banter-Beats steppen bis der Kampf startet
let guard = 0;
while (G.state === G.ST.STORY && guard++ < 12) G.storyAdvance();
assert(guard < 12, "Boss-Banter-Sequenz endet im Kampf", "haengt in STORY nach " + guard + " Beats");
step(1);
assert(G.state === G.ST.BOSS, "Boss-Kampf aktiv (BOSS)", "state=" + G.state);
assert(G.boss && G.boss.hp === 3, "Boss geladen mit 3 HP", "boss=" + JSON.stringify(G.boss && {hp:G.boss.hp}));
assert(G.L && G.L.boss === true, "Arena ist Boss-Level");
for (let i = 0; i < 200 && !frameErr; i++) {
  G.keys.right = (i % 60 < 30); G.keys.left = !(i % 60 < 30);
  if (i % 30 === 0) G.pressJump();
  step(1);
}
G.keys.right = G.keys.left = false;
assert(!frameErr, "Boss: 200 Frames Kampf fehlerfrei", frameErr);

console.log("\n  Frames gesamt gelaufen: " + framesRun);
finish();

function finish() {
  if (failed > 0) { console.log("\n\x1b[31m" + failed + " Test(s) fehlgeschlagen.\x1b[0m"); process.exit(1); }
  console.log("\n\x1b[32mAlle Smoke-Tests gruen.\x1b[0m"); process.exit(0);
}
