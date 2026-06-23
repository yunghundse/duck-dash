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
const HTML = join(__dir, "..", "game.html");

let failed = 0;
function ok(name) { console.log("  \x1b[32mPASS\x1b[0m " + name); }
function bad(name, err) { failed++; console.log("  \x1b[31mFAIL\x1b[0m " + name + (err ? "  -> " + err : "")); }
function assert(cond, name, detail) { cond ? ok(name) : bad(name, detail); }

/* ---------- DOM / Canvas / Audio Stubs ---------- */
const grad = { addColorStop() {} };
// Layout-Instrumentierung: fillRect-Aufrufe optional aufzeichnen (Bounding-Boxes)
let recordOn = false; const drawRects = [];
const ctxStub = new Proxy({}, {
  get(t, p) {
    if (p in t) return t[p];
    if (p === "createLinearGradient" || p === "createRadialGradient" || p === "createPattern") return () => grad;
    if (p === "measureText") return () => ({ width: 0 });
    if (p === "fillRect") return (x, y, w, h) => { if (recordOn) drawRects.push([x, y, w, h]); };
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
    querySelectorAll: () => [],
    createElement: () => makeEl("dyn"),
    addEventListener: (t, fn) => { (winListeners[t] || (winListeners[t] = [])).push(fn); },
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
  try { Object.defineProperty(g,"score",{get:()=>score}); } catch(e){}
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
G.setSel = 0; G.settingsToggle();
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

// Intro ueberspringbar: startGame -> STORY -> skipScene -> direkt im Hub
frameErr = null;
G.startGame();
assert(G.state === G.ST.STORY, "Intro zeigt Cutscene (STORY)", "state=" + G.state);
G.skipScene();
assert(G.state === G.ST.HUB, "Intro ueberspringbar -> direkt im Hub", "state=" + G.state);
step(2);
assert(!frameErr, "Nach Intro-Skip laufen Frames fehlerfrei", frameErr);

console.log("\n  Frames gesamt gelaufen: " + framesRun);
finish();

function finish() {
  if (failed > 0) { console.log("\n\x1b[31m" + failed + " Test(s) fehlgeschlagen.\x1b[0m"); process.exit(1); }
  console.log("\n\x1b[32mAlle Smoke-Tests gruen.\x1b[0m"); process.exit(0);
}
