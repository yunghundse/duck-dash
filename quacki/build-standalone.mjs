/* Baut aus game.html + den Hilfsskripten + der Schrift EINE eigenstaendige HTML:
   quacki-standalone.html. Diese eine Datei laesst sich aufs Handy uebertragen
   (AirDrop/Datei-App) und direkt oeffnen - kein Server noetig. Die Online-
   Bestenliste funktioniert weiterhin (greift per fetch aufs Backend zu).
   Aufruf:  node quacki/build-standalone.mjs */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
let html = readFileSync(join(dir, "game.html"), "utf8");

// 1) Externe <script src="./X.js"> durch ihren Inhalt ersetzen (Reihenfolge bleibt erhalten)
html = html.replace(/<script\s+src="\.\/([^"]+\.js)"\s*><\/script>/g, (m, file) => {
  const code = readFileSync(join(dir, file), "utf8");
  return "<script>/* inlined: " + file + " */\n" + code + "\n</script>";
});

// 2) Schrift als data:-URI einbetten (relativer woff2 -> base64), damit nichts extern geladen wird
const fontB64 = readFileSync(join(dir, "pressstart2p.woff2")).toString("base64");
html = html.replace(/url\('\.\/pressstart2p\.woff2'\)/g, "url('data:font/woff2;base64," + fontB64 + "')");

// 3) Icon (Apple-Touch) relativ lassen ist ok; es ist optional. Wir lassen es.
writeFileSync(join(dir, "quacki-standalone.html"), html);

// Mini-Verifikation
const out = readFileSync(join(dir, "quacki-standalone.html"), "utf8");
const leftoverScripts = (out.match(/<script\s+src=/g) || []).length;
const leftoverFontUrl = /url\('\.\/pressstart2p\.woff2'\)/.test(out);
const externalHttp = /https?:\/\//.test(out.replace(/SUPABASE_URL:\s*"[^"]*"/, "")); // Backend-URL in der Config ist erlaubt
console.log("quacki-standalone.html geschrieben, " + out.length + " Bytes");
console.log("verbleibende externe <script src>: " + leftoverScripts + (leftoverScripts === 0 ? " (ok)" : " (FEHLER)"));
console.log("Schrift noch extern: " + (leftoverFontUrl ? "JA (FEHLER)" : "nein (inline base64)"));
if (leftoverScripts !== 0 || leftoverFontUrl) process.exit(1);
