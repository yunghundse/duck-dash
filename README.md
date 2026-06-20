# 🦆 Duck Dash – Die Kicker-Ente auf WM-Tour

Ein **gewaltfreier, kinderfreundlicher Endless Runner**. Die Spielfigur ist eine
**Gummiente**, die auf WM-Tour durch sechs Länder watschelt: springen, sliden,
Fußbälle sammeln und fair-fordernde Hindernisse meistern.

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

| Aktion    | Tastatur                | Touch / Maus     |
|-----------|-------------------------|------------------|
| Springen  | Leertaste / ↑ / W       | Tippen / Klick   |
| Ducken    | ↓ / S                   | Wisch nach unten |

- **Doppelsprung** (genau einer), **Coyote-Time** und **Input-Buffer** für wendiges,
  sofort reagierendes Spielgefühl.
- **3 Leben** (Herzen) mit kurzer Unverwundbarkeit nach einem Treffer.

## Features

- **6 WM-Etappen**: Brasilien, Deutschland, Japan, USA, Argentinien, WM-Finale –
  je mit gedämpfter Farbpalette, Flagge, Story-Intro und Stadion-Parallax.
- **Sammeln**: Fußbälle (Punkte + Münzen), selten ein goldener Pokal.
- **Sound** (WebAudio): Sprung, Münze, Pokal, Treffer, Level-up, Game Over, Sieg.
  Mute-Toggle wird gemerkt.
- **4 Sprachen**: Deutsch, Englisch, Spanisch, Französisch.
- **Shop**: Enten-Skins/Kosmetik (Trikots, Hut, Brille, Goldene Ente) und
  gewaltfreie Power-ups (Schild, Münz-Magnet, Extra-Leben, Doppelpunkte, Tempo-Boost).
  Münzen werden dauerhaft gespeichert.
- **Bestenliste**: Top-20-Speicher mit Namens-Eingabe, Top-10-Anzeige.
- **Easter Egg**: Wer das Spiel in **allen 4 Sprachen** durchspielt, schaltet den
  „Golden Quack"-Bonus-Skin frei (mit Konfetti-Glückwunsch). Fortschritt x/4 im Menü.
- **PWA**: installierbar (`manifest.json` + `sw.js`), funktioniert offline.

## Terminal-Version (`play.py`)

Eine vereinfachte ASCII-Variante – nur Python-3-Standardbibliothek, keine Pakete.

```bash
python3 play.py
```

- Ente `Q`, Hindernisse `^`, Bälle `o`, Boden `=`
- Steuerung: **Leertaste / W** = springen, **Q** = beenden
- 3 Leben, Länder-Etappen, Sieg nach dem Finale
- Ohne interaktives Terminal (z. B. in einer Pipe) läuft eine kurze **Auto-Demo**.

## Technik

- Eine selbst-enthaltene `index.html`, Grafik per Canvas (interne Auflösung 960×540,
  responsiv skaliert, 16:9).
- Game-Loop mit `requestAnimationFrame` und begrenzter Delta-Zeit.
- Zustands-Automat: Menü, Story, Spiel, Game Over, Sieg, Shop, Bestenliste, Egg.
- Persistenz über `localStorage` (Bestwert, Münzen, Skins, Sprache, Scores).
  Die Bestenliste ist hinter einem gekapselten `ScoreStore` (async `load()`/`submit()`)
  abstrahiert – später leicht gegen ein Online-Backend austauschbar.

## Dateien

| Datei           | Zweck                                  |
|-----------------|----------------------------------------|
| `index.html`    | Komplettes Spiel (Web)                 |
| `manifest.json` | PWA-Manifest                           |
| `sw.js`         | Service Worker (Offline-Cache)         |
| `icon.svg`      | App-Icon                               |
| `play.py`       | Terminal-Version (ASCII)               |
