/* ===================================================================
   QUACKI Smoke-Test — dependency-frei (Node 18+, ESM).
   Laedt quacki/index.html, stubbt DOM/Canvas/Audio, durchlaeuft das
   Menue, spielt Level 1 automatisiert an, baut alle Welten-Level und
   prueft die Boss-Arena. Exit 0 = gruen, Exit 1 = Fehler.
   Aufruf:  node quacki/test/smoke.mjs
   =================================================================== */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const __dir = dirname(fileURLToPath(import.meta.url));
const HTML = join(__dir, "..", "game.html");

let failed = 0;
function ok(name) { console.log("  \x1b[32mPASS\x1b[0m " + name); }
function bad(name, err) { failed++; console.log("  \x1b[31mFAIL\x1b[0m " + name + (err ? "  -> " + err : "")); }
function assert(cond, name, detail) { cond ? ok(name) : bad(name, detail); }

/* ---------- DOM / Canvas / Audio Stubs ---------- */
const grad = { addColorStop(off, col) { if (recordOn && typeof col === "string") fillStyles.push(col); } };
// Layout-Instrumentierung: fillRect-Aufrufe optional aufzeichnen (Bounding-Boxes + Farbe)
let recordOn = false; const drawRects = []; const fillStyles = [];
const ctxStub = new Proxy({}, {
  get(t, p) {
    if (p in t) return t[p];
    if (p === "createLinearGradient" || p === "createRadialGradient" || p === "createPattern") return () => grad;
    if (p === "measureText") return () => ({ width: 0 });
    if (p === "fillRect") return (x, y, w, h) => { if (recordOn) drawRects.push([x, y, w, h, t.fillStyle, (t.globalAlpha == null ? 1 : t.globalAlpha)]); };
    return () => {};
  },
  set(t, p, v) { t[p] = v; if (recordOn && p === "fillStyle" && typeof v === "string") fillStyles.push(v); return true; },
});

const els = new Map();
function makeEl(id) {
  const listeners = {};
  const attrs = {};
  return {
    id, width: 384, height: 224, textContent: "", style: {},
    classList: { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, contains(c){return this._s.has(c);}, toggle(c,f){f?this._s.add(c):this._s.delete(c);} },
    getContext() { return ctxStub; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 384, height: 224, right: 384, bottom: 224 }; },
    addEventListener(t, fn) { (listeners[t] || (listeners[t] = [])).push(fn); },
    setAttribute(k, v) { attrs[k] = String(v); }, getAttribute(k) { return (k in attrs) ? attrs[k] : null; }, removeAttribute(k) { delete attrs[k]; }, hasAttribute(k) { return k in attrs; },
    _fire(t, e) { (listeners[t] || []).forEach(fn => fn(e || { preventDefault(){}, stopPropagation(){} })); },
  };
}
function getEl(id) { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); }
const htmlEl = makeEl("__html");  // document.documentElement-Stub (data-portrait-Tracking)

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
    querySelectorAll: () => [],
    createElement: () => makeEl("dyn"),
    addEventListener: (t, fn) => { (winListeners[t] || (winListeners[t] = [])).push(fn); },
    documentElement: htmlEl,
    body: { appendChild(){}, classList: { add(){}, remove(){} } },
  },
  localStorage: (() => { const m = new Map(); return { getItem:k=>m.has(k)?m.get(k):null, setItem:(k,v)=>m.set(k,String(v)), removeItem:k=>m.delete(k) }; })(),
  navigator: { serviceWorker: { register: () => Promise.resolve() } },
  location: { protocol: "file:", hash: "", href: "file:///quacki/index.html" },
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
  try { Object.defineProperty(g,"score",{get:()=>score,set:v=>{score=v;}}); } catch(e){}
  try { Object.defineProperty(g,"boss",{get:()=>boss}); } catch(e){}
  try { Object.defineProperty(g,"subSel",{get:()=>subSel}); } catch(e){}
  try { Object.defineProperty(g,"setSel",{get:()=>setSel,set:(v)=>{setSel=v;}}); } catch(e){}
  try { g.SET = SET; } catch(e){}
  try { g.openSettings = openSettings; } catch(e){}
  try { g.closeSettings = closeSettings; } catch(e){}
  try { g.settingsActivate = settingsActivate; } catch(e){}
  try { g.settingsToggle = settingsToggle; } catch(e){}
  try { Object.defineProperty(g,"curLevelIdx",{get:()=>curLevelIdx}); } catch(e){}
  try { g.worldProgress = worldProgress; } catch(e){}
  try { g.duck = duck; } catch(e){}
  try { g.keys = keys; } catch(e){}
  try { g.ST = ST; } catch(e){}
  try { g.WORLDS = WORLDS; } catch(e){}
  try { g.t = t; } catch(e){}
  try { Object.defineProperty(g,"wallet",{get:()=>wallet,set:v=>{wallet=v;}}); } catch(e){}
  try { Object.defineProperty(g,"equippedSkin",{get:()=>equippedSkin}); } catch(e){}
  try { Object.defineProperty(g,"shopSel",{get:()=>shopSel,set:v=>{shopSel=v;}}); } catch(e){}
  try { g.owned = owned; } catch(e){}
  try { g.SKINS = SKINS; } catch(e){}
  try { g.openShop = openShop; } catch(e){}
  try { g.enterHub = enterHub; } catch(e){}
  try { g.hubInteract = hubInteract; } catch(e){}
  try { g.updateHub = updateHub; } catch(e){}
  try { g.HUB_NPCS = HUB_NPCS; } catch(e){}
  try { Object.defineProperty(g,"dlgActive",{get:()=>dlgActive}); } catch(e){}
  try { Object.defineProperty(g,"hubNear",{get:()=>hubNear}); } catch(e){}
  try { g.shopAction = shopAction; } catch(e){}
  try { g.shopList = shopList; } catch(e){}
  try { g.closeShop = closeShop; } catch(e){}
  try { g.setLang = setLang; } catch(e){}
  try { g.worldName = worldName; } catch(e){}
  try { g.bossName = bossName; } catch(e){}
  try { g.startGame = startGame; } catch(e){}
  try { g.pauseSet = pauseSet; } catch(e){}
  try { g.skipScene = skipScene; } catch(e){}
  try { g.toggleTheme = toggleTheme; } catch(e){}
  try { g.settingsRows = settingsRows; } catch(e){}
  try { g.DIFFNAME = DIFFNAME; } catch(e){}
  try { g.makeFoe = makeFoe; } catch(e){}
  try { g.unlockSecret = unlockSecret; } catch(e){}
  try { Object.defineProperty(g,"equippedSkin2",{get:()=>equippedSkin}); } catch(e){}
  try { g.isGameplay = isGameplay; } catch(e){}
  try { Object.defineProperty(g,"paused",{get:()=>paused}); } catch(e){}
  try { g.loadPlatform = loadPlatform; } catch(e){}
  try { g.SET = SET; } catch(e){}
  try { g.storyAdvance = storyAdvance; } catch(e){}
  try { g.enterOverworld = enterOverworld; } catch(e){}
  try { g.continueGame = continueGame; } catch(e){}
  try { g.goToMenu = goToMenu; } catch(e){}
  try { g.moveY = moveY; } catch(e){}
  try { g.TILE = TILE; } catch(e){}
  try { g.FONT = FONT; } catch(e){}
  try { g.ACCMAP = ACCMAP; } catch(e){}
  try { g.bmExpand = bmExpand; } catch(e){}
  try { g.SHOPTXT = SHOPTXT; } catch(e){}
  try { g.ITEMNAMES = ITEMNAMES; } catch(e){}
  try { g.HUBTXT = HUBTXT; } catch(e){}
  try { g.enterSubmap = enterSubmap; } catch(e){}
  try { g.enterSelectedNode = enterSelectedNode; } catch(e){}
  try { g.beginLevel = beginLevel; } catch(e){}
  try { g.loadPlatform = loadPlatform; } catch(e){}
  try { g.nodeCount = nodeCount; } catch(e){}
  try { g.startBossIntro = startBossIntro; } catch(e){}
  try { g.pressJump = pressJump; } catch(e){}
  try { g.buildLevel = buildLevel; } catch(e){}
  try { g.drawWorldBG = drawWorldBG; } catch(e){}
  try { g.drawDuck = drawDuck; } catch(e){}
  try { g.checkOrientation = checkOrientation; } catch(e){}
  try { g.isPortraitPhone = isPortraitPhone; } catch(e){}
  try { g.dismissPortHint = dismissPortHint; } catch(e){}
  try { Object.defineProperty(g,"portHintDismissed",{get:()=>portHintDismissed,set:v=>{portHintDismissed=v;}}); } catch(e){}
  try { g.BGS = BGS; } catch(e){}
  try { g.startArcade = startArcade; } catch(e){}
  try { g.levelCleared = levelCleared; } catch(e){}
  try { Object.defineProperty(g,"gameMode",{get:()=>gameMode}); } catch(e){}
  try { g.applyDuckName = applyDuckName; } catch(e){}
  try { g.heroName = heroName; } catch(e){}
  try { g.sanitizeName = sanitizeName; } catch(e){}
  try { g.fillBios = fillBios; } catch(e){}
  try { g.applyTitleI18n = applyTitleI18n; } catch(e){}
  return g;
})();
`;

/* ---------- Ausfuehren ---------- */
const ctx = vm.createContext(sandbox);
let loadErr = null;
// Externe i18n.js zuerst im selben Kontext laden (setzt window.I18N etc.)
try {
  const i18nSrc = readFileSync(join(__dir, "..", "i18n.js"), "utf8");
  vm.runInContext(i18nSrc, ctx, { filename: "i18n.js" });
  const extraSrc = readFileSync(join(__dir, "..", "i18n_extra.js"), "utf8");
  vm.runInContext(extraSrc, ctx, { filename: "i18n_extra.js" });
} catch (e) { loadErr = e; }
assert(!loadErr, "i18n.js + i18n_extra.js laden ohne Exception", loadErr && loadErr.message);
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

// Onboarding: How-to vor erstem Level -> PLAY
frameErr = null;
G.beginLevel(0, 0);
assert(G.state === G.ST.STORY, "beginLevel zeigt How-to (STORY)", "state=" + G.state);
let g2 = 0; while (G.state === G.ST.STORY && g2++ < 8) G.storyAdvance();
step(1);
assert(G.state === G.ST.PLAY, "How-to fuehrt ins Level (PLAY)", "state=" + G.state);
// Schwierigkeit Einfach: mehr Leben
G.SET.diff = 0; G.startGame(); G.storyAdvance();
assert(G.lives === 5, "Einfach startet mit 5 Leben", "lives=" + G.lives);
G.SET.diff = 2; G.startGame(); G.storyAdvance();
assert(G.lives === 2, "Schwer startet mit 2 Leben", "lives=" + G.lives);
G.SET.diff = 1;

// Einstellungen-Menue
frameErr = null;
G.enterOverworld();              // definierter Ausgangspunkt
G.openSettings();
assert(G.state === G.ST.SETTINGS, "openSettings -> SETTINGS", "state=" + G.state);
step(2);
assert(!frameErr, "Settings-Frames laufen fehlerfrei", frameErr);
const sfxBefore = G.SET.sfx;
// Sound ist Zeile 1 (Zeile 0 = Enten-Name)
const soundRow = G.settingsRows().findIndex(r => r.label === G.t("sound"));
G.setSel = soundRow >= 0 ? soundRow : 1; G.settingsToggle();
assert(G.SET.sfx === !sfxBefore, "Ton-Toggle wirkt", "sfx=" + G.SET.sfx);
const stored = JSON.parse(sandbox.localStorage.getItem("quacki_settings") || "{}");
assert(stored.sfx === G.SET.sfx, "Einstellung in localStorage persistiert", "stored=" + JSON.stringify(stored));
G.settingsToggle(); // zuruecksetzen
G.closeSettings();
assert(G.state === G.ST.OVERWORLD, "closeSettings kehrt zurueck", "state=" + G.state);

// i18n: Sprachwechsel wirkt auf Texte
const deWorld = G.worldName(0), dePoints = G.t("points");
G.setLang("en"); const enWorld = G.worldName(0), enPoints = G.t("points");
G.setLang("es"); const esBoss = G.bossName(0);
G.setLang("fr"); const frPoints = G.t("points");
G.setLang("de");
assert(deWorld && enWorld && deWorld !== enWorld, "Weltname wechselt mit Sprache (de!=en)", "de=" + deWorld + " en=" + enWorld);
assert(dePoints !== enPoints, "UI-Begriff wechselt (Punkte/Points)", "de=" + dePoints + " en=" + enPoints);
assert(typeof esBoss === "string" && esBoss.length > 0, "ES Boss-Name vorhanden", "esBoss=" + esBoss);
assert(typeof frPoints === "string" && frPoints.length > 0, "FR UI-Begriff vorhanden", "frPoints=" + frPoints);

// Shop: kaufen + ausruesten + Geldboerse
frameErr = null;
G.openShop();
assert(G.state === G.ST.SHOP, "openShop -> SHOP", "state=" + G.state);
step(2);
assert(!frameErr, "Shop-Frames laufen fehlerfrei", frameErr);
const list = G.shopList();
let idx = list.findIndex(id => G.SKINS[id] && G.SKINS[id].price > 0); // erster kaufbarer Skin
const skinId = list[idx], price = G.SKINS[skinId].price;
G.wallet = price + 50; const before = G.wallet;
G.shopSel = idx; G.shopAction(); // kaufen
assert(G.owned[skinId] === true, "Skin gekauft (owned)", "skinId=" + skinId);
assert(G.wallet === before - price, "Geldboerse sinkt um Preis", "before=" + before + " now=" + G.wallet + " price=" + price);
assert(G.equippedSkin === skinId, "Gekaufter Skin ist ausgeruestet", "equipped=" + G.equippedSkin);
const w2 = G.wallet; G.shopAction(); // erneut: nur ausruesten, kein Abzug
assert(G.wallet === w2, "Erneute Aktion zieht keine Muenzen ab", "w2=" + w2 + " now=" + G.wallet);
G.closeShop();

// Hub: betreten, NPC ansprechen (Dialog), Ausgang -> Weltkarte
frameErr = null;
G.enterHub();
assert(G.state === G.ST.HUB, "enterHub -> HUB", "state=" + G.state);
step(2);
assert(!frameErr, "Hub-Frames laufen fehlerfrei", frameErr);
// Bug-Fix: Ente muss im Hub sichtbar sein (drawDuck darf nicht per Blink-Skip verschwinden)
function duckVisible(){ const b=G.duck.blink; return !(b>0 && Math.floor(b*16)%2===0); }
assert(G.duck.blink <= 0.0001, "Hub: Blink abgebaut (Ente nicht dauerhaft unsichtbar)", "blink=" + G.duck.blink);
assert(duckVisible(), "Hub: Spieler-Ente ist sichtbar (kein Blink-Skip)", "blink=" + G.duck.blink);
// auch waehrend Dialog sichtbar
G.duck.x = (G.HUB_NPCS.find(n=>n.kind==="elder").x)*16; G.updateHub(0.016); G.hubInteract();
assert(G.dlgActive===true && duckVisible(), "Hub: Ente bleibt im Dialog sichtbar", "dlg="+G.dlgActive+" blink="+G.duck.blink);
while(G.dlgActive){ G.hubInteract(); }
const elder = G.HUB_NPCS.find(n => n.kind === "elder");
G.duck.x = elder.x * 16; // direkt zum Aeltesten
G.updateHub(0.016);
assert(G.hubNear && G.hubNear.kind === "elder", "NPC in Reichweite erkannt", "hubNear=" + JSON.stringify(G.hubNear));
G.hubInteract();
assert(G.dlgActive === true, "Dialog oeffnet beim Ansprechen", "dlgActive=" + G.dlgActive);
let dg = 0; while (G.dlgActive && dg++ < 8) G.hubInteract();
assert(G.dlgActive === false, "Dialog laesst sich durchklicken", "haengt nach " + dg);
G.duck.x = 70 * 16; G.updateHub(0.016); // zum Wegweiser
G.hubInteract();
assert(G.state === G.ST.OVERWORLD, "Wegweiser fuehrt zur Weltkarte", "state=" + G.state);

// Pause: einfrieren + fortsetzen, Position bleibt
frameErr = null; G.SET.diff = 1;
G.loadPlatform(0, 0); step(1);
assert(G.state === G.ST.PLAY, "Vor Pause: PLAY", "state=" + G.state);
G.keys.right = true; for (let i = 0; i < 30; i++) step(1); G.keys.right = false;
const xBeforePause = G.duck.x;
G.pauseSet(true);
assert(G.paused === true, "pauseSet(true) pausiert", "paused=" + G.paused);
for (let i = 0; i < 30; i++) step(1); // im Pause-Zustand frieren Frames ein
assert(Math.abs(G.duck.x - xBeforePause) < 0.001, "Pause friert Spielwelt ein", "dx=" + (G.duck.x - xBeforePause));
assert(!frameErr, "Pause-Frames laufen fehlerfrei", frameErr);
G.pauseSet(false);
assert(G.paused === false, "Fortsetzen hebt Pause auf", "paused=" + G.paused);

// ===== Pflicht-Erweiterung: alle Schwierigkeiten, Menue/Settings/Theme/Sprache, Layout, Konzept =====

// (1) Alle 3 Schwierigkeiten: Leben korrekt, alle Level bauen, Gegner-Tempo skaliert, Level-1 spielbar
const diffLives = [5, 3, 2];
let foeFast = [];
for (let d = 0; d < 3; d++) {
  frameErr = null; G.SET.diff = d;
  G.startGame(); G.storyAdvance();
  assert(G.lives === diffLives[d], "Diff " + d + ": " + diffLives[d] + " Leben", "lives=" + G.lives);
  // alle 12 Level bauen + 1 Frame
  let okBuild = true;
  for (let wi = 0; wi < G.WORLDS.length && okBuild; wi++) for (let li = 0; li < G.WORLDS[wi].levels.length; li++) {
    frameErr = null; G.loadPlatform(wi, li); step(1);
    if (!G.L || frameErr) { okBuild = false; assert(false, "Diff " + d + " Bau W" + (wi+1) + "-L" + (li+1), frameErr || "L fehlt"); break; }
  }
  assert(okBuild, "Diff " + d + ": alle 12 Level bauen fehlerfrei");
  // Gegner-Tempo messen (Betrag der vx eines walk-Foes)
  const f = G.makeFoe(0, 0, "walk"); foeFast[d] = Math.abs(f.vx);
  // Level 1 anspielen, Bewegung
  frameErr = null; G.loadPlatform(0, 0); const sx0 = G.duck.x;
  for (let i = 0; i < 200 && !frameErr; i++) { G.keys.right = true; if (i % 30 === 0) G.pressJump(); step(1); }
  G.keys.right = false;
  assert(!frameErr && G.duck.x > sx0, "Diff " + d + ": Level 1 spielbar (Bewegung, kein Fehler)", frameErr || ("dx=" + (G.duck.x - sx0)));
}
assert(foeFast[0] < foeFast[1] && foeFast[1] < foeFast[2], "Gegner-Tempo steigt mit Schwierigkeit", "easy=" + foeFast[0] + " normal=" + foeFast[1] + " hard=" + foeFast[2]);
G.SET.diff = 1;

// (2) Theme-Umschaltung wirkt + fehlerfrei
const th0 = G.SET.theme; G.toggleTheme();
assert(G.SET.theme !== th0, "Theme-Toggle wechselt Hell/Dunkel", "vorher=" + th0 + " nachher=" + G.SET.theme);
G.toggleTheme();

// (3) Sprachen DE/EN/ES/FR: Menue-Begriffe vorhanden + verschieden
const menuKeys = {};
for (const lng of ["de","en","es","fr"]) { G.setLang(lng); menuKeys[lng] = G.t("menuPlay"); }
assert(menuKeys.de && menuKeys.en && menuKeys.de !== menuKeys.en, "Menue-Texte uebersetzt (de!=en)", JSON.stringify(menuKeys));
assert(G.t("diffHard") && G.t("pause") && G.t("biosTitle"), "Neue i18n-Keys (Schwer/Pause/Steckbriefe) in aktiver Sprache vorhanden");
G.setLang("de");

// (4) Settings-Render Layout: nichts zeichnet weit ausserhalb des Canvas (Clipping-Check)
// Grobe Layout-Pruefung: kein UI-Element zeichnet katastrophal weit weg (Hintergrund-Wolken duerfen leicht ueberstehen, werden geclippt)
const M = 150;
function grossOff() { return drawRects.filter(r => { const x=r[0],y=r[1],w=r[2]||0,h=r[3]||0; return x < -M || y < -M || x + w > 384 + M || y + h > 224 + M; }); }
function recordScene(setup) { drawRects.length = 0; recordOn = true; setup(); step(1); recordOn = false; return drawRects.length; }
const nSet = recordScene(() => G.openSettings());
assert(nSet > 0, "Settings rendert (fillRect-Aufrufe)", "n=" + nSet);
assert(grossOff().length === 0, "Settings: kein UI grob ausserhalb des Canvas", grossOff().slice(0,3).map(r=>r.join(",")).join(" | "));
G.closeSettings();
recordScene(() => G.openShop());
assert(grossOff().length === 0, "Shop: kein UI grob ausserhalb des Canvas", grossOff().slice(0,3).map(r=>r.join(",")).join(" | "));
G.closeShop();

// (5) Easter Egg: Code schaltet goldene Ente frei + ruestet aus
G.unlockSecret();
assert(G.owned.golden === true && G.equippedSkin2 === "golden", "Easter Egg schaltet goldene Ente frei", "owned=" + G.owned.golden + " skin=" + G.equippedSkin2);

// (6) Konzept-Kohaerenz (roter Faden Entfuehrung -> 6 Welten -> Gummi-Tier-Bosse -> Rettung)
assert(G.WORLDS.length === 6, "Genau 6 Welten");
let bossesOk = true; for (let i = 0; i < 6; i++) if (!G.bossName(i) || !G.WORLDS[i].levels || G.WORLDS[i].levels.length < 1) bossesOk = false;
assert(bossesOk, "Jede Welt hat Level + benannten Boss");
assert(!!G.t("introText") && !!G.t("bioBaron") && !!G.t("bioGoldi"), "Story-Bogen vorhanden (Intro + Baron + Goldi)");

// Schneller Weg: startGame -> STORY -> skipScene -> DIREKT Welt 1 Level 1 (kein Hub-Gate)
frameErr = null;
G.startGame();
assert(G.state === G.ST.STORY, "Intro zeigt Cutscene (STORY)", "state=" + G.state);
G.skipScene();
assert(G.state === G.ST.PLAY, "Intro ueberspringbar -> direkt ins Level (PLAY)", "state=" + G.state);
assert(G.worldIdx === 0 && G.curLevelIdx === 0, "Direkt in Welt 1, Level 1", "w=" + G.worldIdx + " l=" + G.curLevelIdx);
assert(G.L && !G.L.boss, "Level-1-Tilemap geladen (kein Hub/Arena)");
step(2);
assert(!frameErr, "Nach Intro-Skip laufen Frames fehlerfrei", frameErr);
// Auch ohne Skip: ganze Sequenz durchklicken endet im Level 1 (PLAY), nie im Hub
frameErr = null; G.startGame();
let gi = 0; while (G.state === G.ST.STORY && gi++ < 10) G.storyAdvance();
assert(G.state === G.ST.PLAY && G.worldIdx === 0, "Intro durchklicken -> Welt 1 Level 1 (kein Hub davor)", "state=" + G.state + " w=" + G.worldIdx);

// (Modi) Mini-Game / Arcade: sofort spielbar, eigener Modus, Highscore-Loop, schneller Restart
frameErr = null;
G.startArcade();
assert(G.gameMode === "arcade", "startArcade setzt Modus arcade", "mode=" + G.gameMode);
assert(G.state === G.ST.PLAY, "Mini-Game startet sofort im Level (PLAY, kein Intro/Karte)", "state=" + G.state);
assert(G.L && !G.L.boss, "Mini-Game laedt Einzel-Level (keine Boss-Arena)");
const ax0 = G.duck.x;
for (let i=0;i<150 && !frameErr;i++){ G.keys.right=true; if(i%30===0)G.pressJump(); step(1); }
G.keys.right=false;
assert(!frameErr && G.duck.x > ax0, "Mini-Game spielbar (Bewegung, kein Fehler)", frameErr || ("dx="+(G.duck.x-ax0)));
G.score = 1234; const arcW = G.worldIdx;
G.levelCleared(); // Runde geschafft -> Score-Attack-Loop
assert(G.state === G.ST.PLAY && G.gameMode === "arcade", "Mini-Game: Runde geschafft -> sofort weiter (PLAY)", "state=" + G.state);
assert(G.score >= 1234 && G.worldIdx === arcW, "Mini-Game: Score laeuft weiter, selber Level", "score=" + G.score + " w=" + G.worldIdx);
G.startGame();
assert(G.gameMode === "story", "startGame setzt Modus story (Trennung der Modi)", "mode=" + G.gameMode);

// (Modi-Leak) Arcade -> Menue -> Weltkarte (continueGame) darf NICHT als Arcade weiterlaufen.
// Sonst nimmt levelCleared() den Arcade-Zweig und die Story-Welt loopt = Progressions-Softlock.
if (typeof G.continueGame === "function") {
  frameErr = null;
  G.startArcade();                       // gameMode = arcade
  assert(G.gameMode === "arcade", "Leak-Setup: Arcade aktiv", "mode=" + G.gameMode);
  if (typeof G.goToMenu === "function") G.goToMenu();   // wie 'Hauptmenue' im Pause-Menue
  G.continueGame();                      // wie 'Weltkarte'/'Weiter' im Hauptmenue
  assert(G.gameMode === "story", "continueGame setzt Modus zurueck auf story (kein Arcade-Leak)", "mode=" + G.gameMode);
  G.loadPlatform(0, 0); step(1);
  assert(G.state === G.ST.PLAY && !G.L.boss, "Story-Level nach continueGame aktiv", "state=" + G.state);
  G.levelCleared();                      // Level geschafft
  assert(G.state !== G.ST.PLAY, "Story-Level schreitet fort (kein Arcade-Loop in PLAY)", "state=" + G.state);
  assert(G.gameMode === "story", "Nach Level-Clear weiterhin Story-Modus", "mode=" + G.gameMode);
  G.startGame();
} else { bad("continueGame instrumentiert", "continueGame nicht exponiert"); }

// (Name) Enten-Name: setzen, persistieren, kindersicher filtern, anzeigen, mehrsprachig
G.applyDuckName("Donald");
assert(G.heroName() === "Donald", "Enten-Name gesetzt (heroName)", "name=" + G.heroName());
assert(G.SET.duckName === "Donald", "Name in SET", "SET.duckName=" + G.SET.duckName);
const namedStore = JSON.parse(sandbox.localStorage.getItem("quacki_settings") || "{}");
assert(namedStore.duckName === "Donald", "Name in localStorage persistiert", "stored=" + JSON.stringify(namedStore.duckName));
assert(sandbox.localStorage.getItem("quacki_named") === "1", "Erststart-Namensflag gesetzt");
G.applyTitleI18n();
assert(String(getEl("tDuck").textContent).includes("Donald"), "Name auf dem Titel sichtbar", "tDuck=" + getEl("tDuck").textContent);
G.fillBios();
assert(String(getEl("biosBody").innerHTML).includes("Donald"), "Name im Steckbrief sichtbar");
G.applyDuckName("fuck");
assert(G.heroName() === "Quacki", "Wortfilter: unangemessener Name -> Standard 'Quacki'", "name=" + G.heroName());
assert(!/[^\p{L}\p{N} ]/u.test(G.sanitizeName("Lo@@tt!!")), "Name wird gesaeubert (Sonderzeichen weg)", "san=" + G.sanitizeName("Lo@@tt!!"));
assert(G.sanitizeName("ABCDEFGHIJKLMNOP").length <= 12, "Name auf 12 Zeichen begrenzt", "len=" + G.sanitizeName("ABCDEFGHIJKLMNOP").length);
// Wortfilter haerter: Leetspeak- und Umlaut-Umgehungen werden geblockt
{
  const blocked = ["fück", "b1tch", "a55hole", "Sh1t", "H1tler", "f u c k", "sche1ss", "p3nis"];
  let leaked = "";
  for (const n of blocked) { if (G.sanitizeName(n) !== "") { leaked = n + " -> " + G.sanitizeName(n); break; } }
  assert(!leaked, "Wortfilter: Leetspeak/Umlaut-Umgehungen werden geblockt", leaked);
  // Echte Namen mit Akzenten bleiben erhalten (keine Falsch-Positiven)
  const kept = ["Quacki", "José", "Lümmel", "Anna"];
  let fp = "";
  for (const n of kept) { if (G.sanitizeName(n) === "") { fp = n; break; } }
  assert(!fp, "Wortfilter: echte (auch akzentuierte) Namen bleiben erhalten", "faelschlich geblockt: " + fp);
}
G.setLang("fr"); assert(typeof G.t("nameTitle") === "string" && G.t("nameTitle").length > 0, "FR Namens-Frage vorhanden"); G.setLang("de");
G.applyDuckName(""); // zuruecksetzen auf Standard fuer Folgetests

// (7) Welten-Kulissen: jede der 6 Welten hat eine eigene, atmosphaerische Parallax-Kulisse (datengetrieben)
assert(Array.isArray(G.BGS) && G.BGS.length === 6, "6 Welten-Kulissen definiert (BGS)", "len=" + (G.BGS && G.BGS.length));
assert((G.BGS || []).every(b => Array.isArray(b.sky) && b.sky.length === 3), "Jede Kulisse hat 3-Stop-Himmel");
assert((G.BGS || []).every(b => typeof b.style === "string" && typeof b.detail === "string"), "Jede Kulisse hat style + animiertes Detail");
assert(typeof G.drawWorldBG === "function", "drawWorldBG verfuegbar");

// Warm-hell = Enten-/Muenz-naehe (Gelb/Gold/Hell-Orange) -> als grosse BG-Flaeche verboten
function isWarmBright(col){ if (typeof col !== "string" || col[0] !== "#" || col.length < 7) return false;
  const n = parseInt(col.slice(1,7),16), r=(n>>16)&255, g=(n>>8)&255, b=n&255; return r>205 && g>165 && b<145; }
// pro Welt die BG isoliert rendern und Signatur (Farben, Rect-Zahl, Lesbarkeits-Flag) sammeln
function bgSignature(wi){ drawRects.length=0; fillStyles.length=0; recordOn=true;
  let err=null; try { G.drawWorldBG(wi); } catch(e){ err=e.message; } recordOn=false;
  // Lesbarkeit: grosse warm-helle Vollflaeche tief im Gameplay-Band (y+h>120) verschluckt die gelbe Ente
  const badFill = drawRects.some(r => isWarmBright(r[4]) && (r[2]||0) > 384*0.5 && (r[3]||0) > 16 && (r[1]+(r[3]||0)) > 120);
  return { err, colors:[...new Set(fillStyles.filter(c => typeof c === "string"))], nRects:drawRects.length, badFill }; }
const sigs = []; let bgErr = "", readErr = "";
for (let wi=0; wi<6; wi++){ const s = bgSignature(wi); sigs.push(s);
  if (s.err) bgErr = "W" + (wi+1) + ": " + s.err;
  if (s.badFill) readErr = "W" + (wi+1) + ": grosse warm-helle BG-Flaeche im Gameplay-Band"; }
assert(!bgErr, "Alle 6 Welten-Kulissen rendern fehlerfrei", bgErr);
assert(sigs.every(s => s.colors.length >= 6), "Jede Kulisse zeichnet mehrere Ebenen (>=6 Farben)", sigs.map(s=>s.colors.length).join(","));
// Datengetrieben: die in BGS hinterlegte Welt-Palette (sky + c.*) wird tatsaechlich gezeichnet
function paletteHexes(b){ const out = b.sky.slice(); const c = b.c || {};
  for (const k in c){ const v = c[k];
    if (typeof v === "string" && v[0] === "#") out.push(v);
    else if (Array.isArray(v)) for (const x of v) if (typeof x === "string" && x[0] === "#") out.push(x); }
  return out; }
assert(G.BGS.every((b,wi)=>{ const pal = paletteHexes(b), used = new Set(sigs[wi].colors);
  return pal.filter(h => used.has(h)).length >= 4; }),
  "Kulisse nutzt die Daten-Palette (sky + c.*) -> datengetrieben verdrahtet",
  G.BGS.map((b,wi)=> paletteHexes(b).filter(h => sigs[wi].colors.includes(h)).length).join(","));
const sigKeys = sigs.map(s => s.colors.slice().sort().join("|"));
assert(new Set(sigKeys).size === 6, "Alle 6 Welten-Kulissen sind optisch verschieden (eigene Farb-Signatur)", "uniq=" + new Set(sigKeys).size);
assert(!readErr, "Lesbarkeit: keine grosse warm-helle BG-Flaeche im Gameplay-Band (gelbe Ente bleibt lesbar)", readErr);

// Integration: PLAY-Vollbild jeder Welt rendert mit neuer Kulisse fehlerfrei (BG + Vordergrund zusammen)
frameErr = null; let playBgOk = true, playBgDetail = "";
for (let wi=0; wi<6 && playBgOk; wi++){ frameErr=null; G.loadPlatform(wi, 0); step(2);
  if (frameErr){ playBgOk=false; playBgDetail = "W"+(wi+1)+": "+frameErr; } }
assert(playBgOk, "Alle 6 Welten als Vollbild (Kulisse + Vordergrund) rendern fehlerfrei", playBgDetail);

/* ===================================================================
   BODEN-INTEGRITAET — kein unsichtbarer Rand-Pit. Frueher fuellte
   buildLevel kurze Boden-Reihen mit Luft auf -> in 5/6 L2-Leveln ein
   1-Tile-Loch in der letzten Spalte hinter der Flagge (Durchfall = Tod).
   =================================================================== */
if (typeof G.buildLevel === "function") {
  const isSolid = (ch) => ch === "#" || ch === "=" || ch === "?" || ch === "P" || ch === "Q";
  let pitDetail = "";
  for (let w = 0; w < G.WORLDS.length && !pitDetail; w++) for (let li = 0; li < G.WORLDS[w].levels.length; li++) {
    const lvl = G.buildLevel(G.WORLDS[w].levels[li]);
    const b = lvl.grid[lvl.H - 1], b2 = lvl.grid[lvl.H - 2];
    // jede Spalte muss in mindestens einer der zwei Bodenreihen solide sein -> kein Durchfall-Loch
    for (let tx = 0; tx < lvl.W; tx++) {
      if (!isSolid(b[tx]) && !isSolid(b2[tx])) { pitDetail = "W" + (w+1) + "-L" + (li+1) + ": Boden-Loch in Spalte " + tx; break; }
    }
  }
  assert(!pitDetail, "Boden-Integritaet: kein Durchfall-Loch in allen 12 Leveln (auch rechter Rand)", pitDetail);
} else { bad("buildLevel instrumentiert", "buildLevel nicht exponiert"); }

/* ===================================================================
   ANTI-TUNNELING — bei einem Frame-Ausreisser (grosses dt) faellt ein
   schneller Fall-Schritt (MAXFALL*0.05 = 26px > TILE 16px). Ohne Substep
   wuerde die Ente durch eine 1-Tile-Plattform fallen. Wir suchen eine
   echte 1-Tile-Plattform (Luft drueber und drunter), lassen die Ente mit
   max. Fallschritt knapp darueber fallen und pruefen, dass sie landet.
   =================================================================== */
if (typeof G.moveY === "function") {
  const T = G.TILE || 16;
  const isSolidCh = (ch) => ch === "#" || ch === "=" || ch === "?" || ch === "P" || ch === "Q";
  let tested = false, tunnelDetail = "";
  for (let w = 0; w < G.WORLDS.length && !tested; w++) {
    G.loadPlatform(w, 1); step(1);                 // L2 hat schwebende Plattformen
    const grid = G.L.grid, H = G.L.H, W = G.L.W;
    for (let ty = 2; ty < H - 2 && !tested; ty++) for (let tx = 1; tx < W - 1; tx++) {
      // 1-Tile-Plattform: solide, Luft drueber UND drunter
      if (isSolidCh(grid[ty][tx]) && !isSolidCh(grid[ty-1][tx]) && !isSolidCh(grid[ty+1][tx])) {
        const d = G.duck;
        d.x = tx * T + 2; d.w = 12; d.h = 14;
        d.y = ty * T - d.h - 2;                     // Fuesse 2px ueber der Plattform
        d.vy = 520; d.onGround = false;
        G.moveY(d, 520 * 0.05);                     // ein voller Fall-Step bei dt=0.05 (26px)
        const landed = d.onGround && (d.y + d.h) <= (ty * T + 1);
        if (!landed) tunnelDetail = "W" + (w+1) + " ty=" + ty + " tx=" + tx + ": y=" + d.y.toFixed(1) + " onG=" + d.onGround;
        tested = true;
      }
    }
  }
  assert(tested, "Anti-Tunneling: 1-Tile-Testplattform gefunden", "keine schwebende 1-Tile-Plattform gefunden");
  assert(tested && !tunnelDetail, "Anti-Tunneling: Ente faellt bei grossem Fall-Step (26px) NICHT durch 1-Tile-Plattform", tunnelDetail);
} else { bad("moveY instrumentiert", "moveY nicht exponiert"); }
// Source-Guard: Substep-Aufloesung vorhanden
assert(/moveYStep/.test(html) && /Substep/.test(html), "Source-Guard: Kollisions-Substepping (moveYStep) vorhanden");

/* ===================================================================
   TOUCH-ZURUECK auf Weltkarte/Sub-Map — frueher gab es per Touch keinen
   Rueckweg (mobile Sackgasse). Jetzt: Canvas-Zurueck-Chip oben links +
   Tipp-Trefferflaeche. Wir feuern einen Touch auf den Chip.
   =================================================================== */
{
  const cvEl = getEl("cv");
  const tapCanvas = (x, y) => cvEl._fire("pointerdown", { clientX: x, clientY: y, preventDefault(){}, stopPropagation(){} });
  // Weltkarte -> Zurueck fuehrt ins Hauptmenue
  G.SET.diff = 1; G.startGame(); let gg=0; while (G.state === G.ST.STORY && gg++ < 10) G.storyAdvance();
  G.enterOverworld(); step(1);
  assert(G.state === G.ST.OVERWORLD, "Setup: Weltkarte offen", "state=" + G.state);
  tapCanvas(9, 10);
  assert(G.state === G.ST.TITLE, "Weltkarte: Touch-Zurueck-Chip fuehrt ins Hauptmenue", "state=" + G.state);
  // Sub-Map -> Zurueck fuehrt zur Weltkarte
  G.startGame(); gg=0; while (G.state === G.ST.STORY && gg++ < 10) G.storyAdvance();
  G.enterOverworld(); G.enterSubmap(0); step(1);
  assert(G.state === G.ST.SUBMAP, "Setup: Sub-Map offen", "state=" + G.state);
  tapCanvas(9, 10);
  assert(G.state === G.ST.OVERWORLD, "Sub-Map: Touch-Zurueck-Chip fuehrt zur Weltkarte", "state=" + G.state);
}
// Source-Guard: Zurueck-Pfade verdrahtet
assert(/inBackChip/.test(html) && /drawBackChip/.test(html), "Source-Guard: Touch-Zurueck-Chip (inBackChip/drawBackChip) vorhanden");

/* ===================================================================
   VIEWPORTS / ORIENTIERUNG — Hochformat ist VOLL spielbar. Es gibt
   keinen Dreh-Zwang und keine Pause mehr. Im Handy-Hochformat erscheint
   nur ein dezenter, WEGKLICKBARER Hinweis ("Querformat empfohlen").
   Desktop, Phone-Quer und Tablet-Hoch zeigen keinen Hinweis. Das
   Layout schaltet im Hochformat auf eine Portrait-Anordnung (Canvas
   oben, Touch-Tasten unten) via data-portrait am <html>.
   =================================================================== */
if (typeof G.checkOrientation === "function") {
  const hint = getEl("portHint");
  const hintShown = () => !hint.classList.contains("hidden");
  const portraitLayout = () => htmlEl.getAttribute("data-portrait") === "1";
  function setVP(w, h) { sandbox.innerWidth = w; sandbox.innerHeight = h; G.checkOrientation(); }
  // ins Gameplay, damit der (frueher pausierende) Pfad mitgeprueft wird
  G.SET.diff = 1; G.loadPlatform(0, 0); step(1);
  G.portHintDismissed = false;

  setVP(1280, 720); assert(!hintShown(), "Desktop (1280x720): kein Hinweis"); assert(!portraitLayout(), "Desktop: kein Portrait-Layout");
  setVP(844, 390);  assert(!hintShown(), "Phone-Querformat (844x390): kein Hinweis"); assert(!portraitLayout(), "Querformat: kein Portrait-Layout");
  assert(G.paused === false, "Querformat: Spiel laeuft (nicht pausiert)", "paused=" + G.paused);
  setVP(768, 1024); assert(!hintShown(), "Tablet-Hochformat (768x1024): kein Hinweis (kein Handy)");

  // Handy-Hochformat: spielbar (KEINE Pause), dezenter Hinweis sichtbar, Portrait-Layout aktiv
  setVP(390, 844);
  assert(hintShown(), "Handy-Hochformat (390x844): dezenter Hinweis sichtbar");
  assert(portraitLayout(), "Handy-Hochformat: Portrait-Layout aktiv (data-portrait)");
  assert(G.paused === false, "Handy-Hochformat: Spiel laeuft VOLL weiter (keine Pause)", "paused=" + G.paused);

  // Hochformat ist wirklich spielbar: Frames laufen + Ente bewegt sich per Touch-Eingabe
  frameErr = null; const pX0 = G.duck.x;
  for (let i = 0; i < 120 && !frameErr; i++) { G.keys.right = true; if (i % 30 === 0) G.pressJump(); step(1); }
  G.keys.right = false;
  assert(!frameErr, "Hochformat: 120 Frames Gameplay fehlerfrei", frameErr);
  assert(G.duck.x > pX0, "Hochformat: Ente bewegt sich (Steuerung funktioniert)", "dx=" + (G.duck.x - pX0));

  // Hinweis ist wegklickbar und bleibt dann weg (auch bei erneutem Hochformat-Check)
  getEl("portHintClose")._fire("click");
  assert(!hintShown(), "Hinweis ist wegklickbar (X schliesst ihn)");
  setVP(844, 390); setVP(390, 844);
  assert(!hintShown(), "Weggeklickter Hinweis bleibt weg (Session-Merker)");
  assert(portraitLayout(), "Nach Wiederkehr ins Hochformat: Portrait-Layout weiterhin aktiv");

  // Drehen zurueck ins Querformat: Hinweis weg, Portrait-Layout aus, Spiel laeuft
  setVP(844, 390);
  assert(!hintShown(), "Zurueck auf Querformat: kein Hinweis");
  assert(!portraitLayout(), "Zurueck auf Querformat: Portrait-Layout aus");
  assert(G.paused === false, "Querformat: Spiel laeuft", "paused=" + G.paused);

  // Mehrere Viewports rendern fehlerfrei (kein Layout-Bruch / kein Frame-Fehler)
  let vpErr = "";
  for (const [w, h] of [[320,568],[375,667],[390,844],[414,896],[768,1024],[844,390],[1024,768],[1280,720]]) {
    frameErr = null; setVP(w, h); step(2);
    if (frameErr) { vpErr = w + "x" + h + ": " + frameErr; break; }
  }
  assert(!vpErr, "Mehrere Viewports (Hoch + Quer, Phone + Tablet + Desktop) rendern fehlerfrei", vpErr);
  // Quell-Garantie: kein Dreh-Zwang/Pause mehr im Orientierungs-Pfad
  setVP(844, 390);
} else { bad("checkOrientation instrumentiert", "checkOrientation nicht exponiert"); }

/* Source-Guard: der erzwungene "Bitte drehen"-Blocker darf NICHT zurueckkehren. */
assert(!/scRotate/.test(html), "Source-Guard: kein erzwungener Dreh-Overlay (#scRotate) mehr");
assert(!/rotatePaused/.test(html), "Source-Guard: keine Pause-bei-Hochformat-Logik (rotatePaused) mehr");
assert(/data-portrait/.test(html), "Source-Guard: Portrait-Layout per data-portrait vorhanden");
assert(/portHint/.test(html), "Source-Guard: dezenter, wegklickbarer Portrait-Hinweis vorhanden");

/* ===================================================================
   ANTI-FLACKER — der Kern-Fix: Ente (und Boss) duerfen waehrend der
   Unverwundbarkeit NICHT hart blinken/verschwinden. Wir rendern drawDuck
   isoliert ueber eine volle Puls-Periode und pruefen pro Frame:
   (1) die Ente wird IMMER gezeichnet (>=1 Rect, nie komplett weg),
   (2) das Alpha faellt nie unter den Boden (sichtbar), bleibt <=1,
   (3) der Alpha-Verlauf ist weich (kein harter Sprung Frame-zu-Frame).
   =================================================================== */
if (typeof G.drawDuck === "function") {
  G.loadPlatform(0, 0); step(1);                 // gueltiges Level -> Ente platziert
  G.duck.blink = 1.0; G.duck.onGround = true; G.duck.vx = 0;
  const FLOOR = 0.5;                             // Sichtbarkeits-Boden (Alpha)
  let minA = 1, maxA = 0, maxJump = 0, prevA = null, everEmpty = false;
  for (let i = 0; i < 60; i++) {                 // 60 Frames a 16ms = ~960ms > eine Puls-Periode (~754ms)
    clock += 16; ctxStub.globalAlpha = 1;
    drawRects.length = 0; recordOn = true;
    try { G.drawDuck(); } catch (e) { frameErr = e.message; }
    recordOn = false;
    if (drawRects.length === 0) { everEmpty = true; continue; }
    // Alpha, mit dem der Enten-Koerper gezeichnet wurde (alle Rects in drawDuck teilen das Invuln-Alpha)
    const a = drawRects.reduce((m, r) => Math.min(m, r[5] == null ? 1 : r[5]), 1);
    minA = Math.min(minA, a); maxA = Math.max(maxA, a);
    if (prevA != null) maxJump = Math.max(maxJump, Math.abs(a - prevA));
    prevA = a;
  }
  assert(!everEmpty, "Anti-Flacker: Ente waehrend Unverwundbarkeit in JEDEM Frame gezeichnet (verschwindet nie)");
  assert(minA >= FLOOR, "Anti-Flacker: Ente nie fast unsichtbar (Alpha-Boden >= " + FLOOR + ")", "minAlpha=" + minA.toFixed(3));
  assert(maxA <= 1.000001, "Anti-Flacker: Alpha bleibt im gueltigen Bereich (<=1)", "maxAlpha=" + maxA.toFixed(3));
  assert(maxJump <= 0.12, "Anti-Flacker: weicher Alpha-Verlauf, kein harter Sprung Frame-zu-Frame", "maxJump=" + maxJump.toFixed(3));
  // Nicht-invulnerable Ente: voll sichtbar (Alpha == 1), kein Rest-Schimmern
  G.duck.blink = 0; clock += 16; ctxStub.globalAlpha = 1;
  drawRects.length = 0; recordOn = true; try { G.drawDuck(); } catch (e) { frameErr = e.message; } recordOn = false;
  const solidA = drawRects.reduce((m, r) => Math.min(m, r[5] == null ? 1 : r[5]), 1);
  assert(drawRects.length > 0 && solidA >= 0.999, "Anti-Flacker: Ente ohne Treffer voll deckend gezeichnet", "alpha=" + solidA.toFixed(3));
} else { bad("drawDuck instrumentiert", "drawDuck nicht exponiert"); }

// Source-Guard: die alten harten Stroboskop-Muster duerfen NICHT zurueckkehren
assert(!/Math\.floor\(\s*d\.blink\s*\*\s*\d+\s*\)\s*%\s*2/.test(html), "Source-Guard: kein hartes Enten-Blink-Toggle (d.blink%2) mehr");
assert(!/Math\.floor\(\s*b\.invuln\s*\*\s*\d+\s*\)\s*%\s*2/.test(html), "Source-Guard: kein hartes Boss-Blink-Toggle (b.invuln%2) mehr");
assert(/d\.blink>0\)ctx\.globalAlpha=/.test(html), "Source-Guard: Ente nutzt weichen Alpha-Puls bei Unverwundbarkeit");
assert(/b\.invuln>0&&b\.defeated<=0\)ctx\.globalAlpha=/.test(html), "Source-Guard: Boss nutzt weichen Alpha-Puls bei Unverwundbarkeit");

/* ===================================================================
   SELF-CONTAINMENT / OFFLINE — keine externen URLs, Pixel-Schrift lokal.
   =================================================================== */
{
  const idxHtml = readFileSync(join(__dir, "..", "index.html"), "utf8");
  const swSrc = readFileSync(join(__dir, "..", "sw.js"), "utf8");
  const manifest = JSON.parse(readFileSync(join(__dir, "..", "manifest.json"), "utf8"));
  const httpRe = /https?:\/\//;
  assert(!httpRe.test(html), "Self-Containment: game.html ohne externe http(s)-URL", (html.match(httpRe) || [])[0]);
  assert(!httpRe.test(idxHtml), "Self-Containment: quacki/index.html ohne externe http(s)-URL", (idxHtml.match(httpRe) || [])[0]);
  assert(/@font-face/.test(html) && /pressstart2p\.woff2/.test(html), "Self-Containment: game.html bindet Pixel-Schrift lokal ein (@font-face)");
  assert(/pressstart2p\.woff2/.test(idxHtml), "Self-Containment: index.html bindet Pixel-Schrift lokal ein");
  let fontOk = true; try { const st = readFileSync(join(__dir, "..", "pressstart2p.woff2")); fontOk = st.length > 1000 && st.slice(0,4).toString() === "wOF2"; } catch(e){ fontOk = false; }
  assert(fontOk, "Self-Containment: lokale Schrift-Datei pressstart2p.woff2 vorhanden (gueltiges wOF2)");
  assert(swSrc.includes("pressstart2p.woff2"), "Self-Containment: Service Worker cacht die Schrift (App-Shell offline)");
  assert(manifest.orientation === "any", "manifest orientation=any (Hoch- UND Querformat erlaubt)", "orientation=" + manifest.orientation);
  // keine verwaisten Screenshot-/Scratch-Dateien mehr im Auslieferungsordner
  const stray = readdirSync(join(__dir, "..")).filter(f => /^_.*\.html$/.test(f));
  assert(stray.length === 0, "Aufgeraeumt: keine verwaisten _*.html im quacki-Ordner", stray.join(", "));
  // keine geschuetzten Markennamen im ausgelieferten Code (Urheberrecht)
  assert(!/\bMario\b/i.test(html), "Kein geschuetzter Markenname (Mario) in game.html");
  assert(!/\b4 Welten\b/.test(html), "Kommentar aktuell: 6 Welten (kein veraltetes '4 Welten')");
}

/* ===================================================================
   SONDERZEICHEN — jeder anzeigbare Text (alle 4 Sprachen, alle Tabellen)
   muss vom Canvas-Pixel-Font darstellbar sein (FONT oder ACCMAP), sonst
   erscheinen Kaestchen/Luecken. Zusaetzlich: ES/FR MUESSEN echte Akzente
   bzw. ES die umgedrehten Satzzeichen nutzen (Kriterium 3).
   =================================================================== */
if (G.FONT && G.ACCMAP && typeof G.bmExpand === "function") {
  const FONT = G.FONT, ACC = G.ACCMAP, exp = G.bmExpand;
  // Replik der bmText-Glyphaufloesung: ist ein Zeichen renderbar?
  function badChar(s) {
    // {platzhalter} werden zur Laufzeit ersetzt -> nie woertlich gerendert
    const text = String(s).replace(/\{[^}]*\}/g, "");
    for (const raw of exp(text)) {
      if (raw === " ") continue;
      const ch = raw.toUpperCase();
      if (ACC[ch]) continue;                       // Akzent -> Basis + Diakritikum
      if (FONT[ch] || FONT[raw]) continue;         // direktes Glyph (auch ß via FONT[raw])
      return raw;
    }
    return null;
  }
  // Alle Strings aus allen i18n-Tabellen + Inline-Tabellen einsammeln
  const tables = [sandbox.I18N, sandbox.I18N_EXTRA, G.SHOPTXT, G.ITEMNAMES, G.HUBTXT];
  const strings = [];
  function collect(v) {
    if (v == null) return;
    if (typeof v === "string") { strings.push(v); return; }
    if (Array.isArray(v)) { v.forEach(collect); return; }
    if (typeof v === "object") { for (const k in v) collect(v[k]); }
  }
  tables.forEach(collect);
  let uncovered = "";
  for (const s of strings) { const b = badChar(s); if (b) { uncovered = JSON.stringify(b) + " in: " + s.slice(0, 48); break; } }
  assert(strings.length > 200, "Sonderzeichen: viele i18n-Strings eingesammelt", "n=" + strings.length);
  assert(!uncovered, "Sonderzeichen: JEDER i18n-Text ist im Pixel-Font darstellbar (keine Kaestchen/Luecken)", uncovered);

  // ES/FR muessen Akzente tragen (kein flaches ASCII); ES zusaetzlich ¡/¿
  const EX = sandbox.I18N_EXTRA;
  const esBlob = JSON.stringify(EX.es), frBlob = JSON.stringify(EX.fr);
  assert(/[áéíóúñü]/.test(esBlob), "Sonderzeichen ES: echte Akzente vorhanden");
  assert(/[¡¿]/.test(esBlob), "Sonderzeichen ES: umgedrehte Satzzeichen (¡/¿) vorhanden");
  assert(/[àâäéèêëîïôûùç]/.test(frBlob), "Sonderzeichen FR: echte Akzente vorhanden");
  assert(/[äöüß]/.test(JSON.stringify(EX.de)), "Sonderzeichen DE: echte Umlaute/ß vorhanden");
  // Auswahl-Cursor '>' (Settings/Shop) hat jetzt ein echtes Glyph (vorher leere Luecke)
  assert(Array.isArray(FONT[">"]) && Array.isArray(FONT["<"]), "Pixel-Font: Auswahl-Cursor-Glyphen > und < vorhanden");
} else { bad("FONT/ACCMAP instrumentiert", "FONT/ACCMAP/bmExpand nicht exponiert"); }

console.log("\n  Frames gesamt gelaufen: " + framesRun);
finish();

function finish() {
  if (failed > 0) { console.log("\n\x1b[31m" + failed + " Test(s) fehlgeschlagen.\x1b[0m"); process.exit(1); }
  console.log("\n\x1b[32mAlle Smoke-Tests gruen.\x1b[0m"); process.exit(0);
}
