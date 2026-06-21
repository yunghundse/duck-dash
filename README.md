# 🦆 Duck Dash – Die Kicker-Ente auf WM-Tour

Ein **gewaltfreier, kinderfreundlicher Retro-Endless-Runner** im Look alter
8-/16-Bit-Spiele. Die Spielfigur ist eine **Gummiente**, die auf WM-Tour durch
sechs Länder watschelt: springen, sliden, Fußbälle sammeln und fair-fordernde
Hindernisse meistern – mit echtem **Pixel-Art-Gefühl**, Chiptune-Sound und
abschaltbarem CRT-Look.

Pflicht-Thema der Challenge (eine Gummiente kommt vor) ist hier zur Hauptfigur gemacht.
Komplett **gewaltfrei**: Gegner werden nur über- oder unterlaufen – kein Schlagen,
kein Schießen. Keine Werbung, keine Echtgeld-Käufe.

## Spielen (Web)

Einfach `index.html` im Browser öffnen – alles steckt in dieser **einen Datei**
(CSS + JS inline, keine externen Bibliotheken).

```bash
open index.html      # macOS
# oder einen kleinen Server:
python3 -m http.server 8000   # dann http://localhost:8000
```

### Steuerung

| Aktion    | Tastatur                | Touch / Maus              |
|-----------|-------------------------|---------------------------|
| Springen  | Leertaste / ↑ / W       | Tippen / großes Feld rechts |
| Ducken/Slide | ↓ / S                | Wisch runter / Feld links halten |
| Gleiten   | nochmal Springen in der Luft 🪶 | nochmal tippen     |
| Pause     | Esc / P                 | ⏸-Button (auto bei Tab-Wechsel) |

- **Doppelsprung** (genau einer), **Coyote-Time** und **Input-Buffer** für wendiges,
  sofort reagierendes Spielgefühl.
- Gewaltfreier Zusatz-Move: kurzes **Gleiten/Flattern** einmal pro Luftphase.
- **3 Leben** (Easy: 5) mit kurzer Unverwundbarkeit nach einem Treffer.

## Modi & Schwierigkeit

- **♾️ Endlos (Standard)**: zeitloser, unendlicher Lauf mit steigenden **Wellen**
  und neutralem Retro-Setting (Tag/Dämmerung/Nacht).
- **🏆 WM-Tour (Feature)**: die 6 Länder-Etappen mit Story und großem Finale.
- **🐣 Einfach / 🦆 Normal**: Einfach deckelt das Tempo, vergrößert Lücken, bringt
  weniger Slide-Hindernisse, 5 Herzen und längere Unverwundbarkeit.

## Kinderfreundlich

- Einmalige, überspringbare **How-to-Anleitung** (in allen 4 Sprachen, jederzeit
  aus den Einstellungen wiederholbar).
- Große **On-Screen-Touch-Felder** (Springen rechts, Halten-zum-Sliden links);
  Wisch-Gesten funktionieren weiterhin.
- **Kindersichere Namen**: Preset-/Emoji-Namen per Tipp + einfacher Wortfilter
  (Tippen ist optional).
- **Auto-Pause** beim Tab-Wechsel, klarer Pause-Button, kontrastreiche Hinweise.

## Retro-Look

- **Pixel-Art-Rendering**: intern wird in **320×180** auf einen Offscreen-Canvas
  gezeichnet und mit **Nearest-Neighbor** formatfüllend hochskaliert
  (`imageSmoothingEnabled = false`, CSS `image-rendering: pixelated`) → chunky Pixel,
  kein weiches Anti-Aliasing.
- **Feste 16-Farben-Palette** (`PALETTE`), gedämpft aber kontrastreich.
- **Pixel-UI**: monospace Pixel-Font (deckt alle Umlaute + ES/FR-Akzente ab,
  offline-tauglich), eckige Retro-Buttons mit hartem Rahmen, blinkendes „PRESS START",
  Score mit führenden Nullen, Pixel-Herzen.
- **CRT-Effekte** (abschaltbar): Scanlines, Vignette, sanftes Glühen, plus
  Fade-Übergänge zwischen den Szenen.
- **Chiptune-Sound**: Square/Triangle/Noise-SFX und eine loopende
  Hintergrundmelodie – alles per WebAudio, ohne Dateien.

## Features

- **6 WM-Etappen**: Brasilien, Deutschland, Japan, USA, Argentinien, WM-Finale –
  je mit eigener Farbpalette, Flagge, Story-Intro und erkennbarer
  **Pixel-Parallax-Skyline** (Rio-Berge, Brandenburger Tor, Fuji/Pagode,
  NYC-Skyline, Obelisk, Stadion).
- **Kombo-System**: Bälle in Folge ohne Treffer erhöhen den Multiplikator (bis x5).
- **Sammeln**: Fußbälle (Punkte + Münzen), selten ein goldener Pokal.
- **Sound**: Sprung, Münze, Pokal, Treffer, Etappe, Game Over, Sieg + Musik –
  Ton und Musik getrennt schaltbar, Auswahl wird gemerkt.
- **4 Sprachen**: Deutsch, Englisch, Spanisch, Französisch (mit korrekten Sonderzeichen
  im DOM **und** auf dem Canvas).
- **Einstellungen**: Sprache, Ton, Musik, CRT – erreichbar aus Menü und Pause.
- **Shop**: Enten-Skins/Kosmetik (Trikots, Hut, Brille, Goldene Ente) und
  gewaltfreie Power-ups (Schild, Münz-Magnet, Extra-Leben, Doppelpunkte, Tempo-Boost).
  Münzen werden dauerhaft gespeichert.
- **Bestenliste**: Top-20-Speicher mit Namens-Eingabe, Top-10-Anzeige,
  „NEW HIGHSCORE"-Banner.
- **Easter Egg**: Wer das Spiel in **allen 4 Sprachen** durchspielt, schaltet den
  „Golden Quack"-Bonus-Skin frei (mit Konfetti-Glückwunsch). Fortschritt x/4 im Menü.
- **PWA**: installierbar (`manifest.json` + `sw.js`), funktioniert offline.

## Terminal-Version (`play.py`)

Eine vereinfachte ASCII-Variante mit Retro-Titelbanner – nur
Python-3-Standardbibliothek, keine Pakete.

```bash
python3 play.py
```

- Ente `Q`, Hindernisse `^`, Bälle `o`, Boden `=`
- Steuerung: **Leertaste / W** = springen, **Q** = beenden
- 3 Leben, Länder-Etappen mit Fortschrittsbalken, Sieg nach dem Finale
- Ohne interaktives Terminal (z. B. in einer Pipe) läuft eine kurze **Auto-Demo**.

## Technik / Engine-Gerüst

Sauber getrennte Module in der einen `index.html`:

| Modul        | Aufgabe                                                         |
|--------------|-----------------------------------------------------------------|
| `CONFIG`     | alle Tuning-Werte (Physik, Tempo, Spawn, Auflösung)             |
| `PALETTE`    | feste 16-Farben-Retro-Palette                                   |
| `SAVE`       | gekapselter `localStorage`-Zugriff (get/set, try/catch)         |
| `INPUT`      | vereinheitlichte Eingabe (Tastatur + Touch/Maus) → Aktionen     |
| `AUDIO`      | Chiptune-Engine (Square/Triangle/Noise) + SFX                   |
| `RENDER`     | Pixel-Renderer (Low-Res-Buffer, Sprites, HUD)                   |
| `SCENES`     | State-Manager mit `enter/update/draw/exit`                      |
| `ENTITIES`   | Ente, Hindernisse, Sammelobjekte, Partikel                      |
| `Store`/`ScoreStore` | Geldbörse/Skins bzw. Bestenliste (Online-Backend-ready) |

- Game-Loop mit `requestAnimationFrame` und begrenzter Delta-Zeit.
- Szenen: Menü, Story, Spiel, Pause, Game Over, Sieg, Shop, Bestenliste, Egg, Einstellungen.
- Persistenz über `localStorage` (Bestwert, Münzen, Skins, Sprache, Ton/Musik/CRT, Scores).
- **UTF-8** durchgängig: `<meta charset="utf-8">`, echte Sonderzeichen überall
  (ä ö ü Ä Ö Ü ß, á é í ó ú ñ ¡ ¿ à â ç è ê î ô û) – im DOM und per `fillText` auf dem Canvas.

## Dateien

| Datei           | Zweck                                  |
|-----------------|----------------------------------------|
| `index.html`    | Komplettes Spiel (Web)                 |
| `manifest.json` | PWA-Manifest                           |
| `sw.js`         | Service Worker (Offline-Cache)         |
| `icon.svg`      | App-Icon                               |
| `play.py`       | Terminal-Version (ASCII, Retro-Banner) |
