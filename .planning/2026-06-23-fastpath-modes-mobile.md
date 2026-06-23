# Plan — Quacki: Schneller Einstieg, Modi, Name, Palette, Mobile (2026-06-23)

Ausgangsablauf (zu lang): Titel -> Intro-Cutscene -> HUB (NPC) -> Wegweiser -> Weltkarte -> Submap -> Level.
Ziel: Titel -> kurzes Skip-Intro -> DIREKT Welt 1 Level 1.

## Schritte (je Schritt: smoke gruen + commit + push)

1. **Schneller Weg ins Spiel** — `startGame()` umbauen: nach 1 kurzem (skipbarem) Intro-Beat direkt `beginLevel(0,0)`.
   HUB nicht mehr als Start-Gate (enterHub bleibt als Code erhalten, nur nicht am Anfang). How-to einmalig + Welt-1-Story in EINER skipbaren Sequenz. Smoke an neuen Flow anpassen.

2. **Zwei Modi im Menue** — Story (Kampagne) + Mini-Game (Arcade-Einzellevel, Highscore, schneller Restart).
   `gameMode` global ("story"|"arcade"). Menue-Buttons + Tastatur/Touch. Arcade: eigener Level, R=Restart, kein Map/Boss.

3. **Enten-Name** — `SET.duckName`, Eingabe-Overlay beim ersten Start + in Settings aenderbar. localStorage. Anzeige HUD/Story. Wortfilter (DE/EN) + Fallback "Quacki". Mehrsprachig.

4. **Gelb entschaerfen** — `#ffd23f` (R255 G210 B63, zu grell) -> waermeres, weniger gesaettigtes Gold `#f2c14e`. Konsistent: game.html (C.duck/coin, --ui-edge, h1/h2/.btn, UITHEME) + index.html (--gold). Dunkle Schatten/Boden bleiben.

5. **Mobile + Querformat** — responsives Canvas-Scaling (resize/orientationchange), Portrait-"Bitte drehen"-Overlay (Spiel pausiert), Touch-Buttons gross + pointer events + touch-action none, safe-area, 100dvh, kein Zoom/Pull-to-Refresh, Audio-Unlock bei erstem Tap.

6. **Spielgefuehl** — Blink/CRT dezent, kein Stroboskop; Tempo/Timing fair; sofortiges Feedback. Konkrete Tunings dokumentieren.

7. **Tests** — Smoke erweitern: Direkt-ins-Level, beide Modi, Name setzen/persistieren/anzeigen, mehrere Viewports+Orientierungen ohne Overlap + erreichbare Buttons, "Bitte drehen" nur Handy-Portrait, keine Fehler.

## Regeln
gewaltfrei, kinderfreundlich, keine Emojis, keine Copyright-Inhalte, UTF-8, selbst-enthalten unter quacki/, relative Pfade. Root-index.html NIE anfassen. Nach jedem Schritt push + verifizieren (git log/status).
