# Duck Dash – Die Entenrettung

Ein gewaltfreies, kinderfreundliches Retro-Jump'n'Run im echten Pixel-Look.
Hilf der Gummiente **Quacki**, die goldene Gummiente Goldi aus dem Quakschloss von
Baron von Quak zu retten: 6 Welten, je ein Gummi-Tier-Boss, 3 Schwierigkeiten.
Story-Modus mit Spielstand + Checkpoints und ein Mini-Game (Score-Jagd) mit echter
Online-Bestenliste.

**▶ Live spielen: <https://quacki.vercel.app>**

Das Spiel ist selbst-enthalten (relative Pfade, keine externen Bibliotheken,
offline lauffaehig als PWA) und liegt im Ordner [`quacki/`](./quacki).

## Spielen

Online unter <https://quacki.vercel.app> – oder lokal `quacki/game.html` im Browser
oeffnen bzw. einen kleinen Server starten:

```bash
cd quacki
python3 -m http.server 8000   # dann http://localhost:8000/game.html
```

### Steuerung

- **Desktop:** Pfeiltasten / A D laufen, Leertaste / Pfeil hoch / W springen
  (in der Luft halten = gleiten), P oder Esc Pause, Maus fuer Menues. Das Spielfeld
  ist fest im Browserfenster verankert (zentriert + letterboxed); die Pfeiltasten
  scrollen die Seite nie. Vollbild per Knopf oben links.
- **Handy:** grosse Touch-Tasten unten (links/rechts = laufen, rechts = springen);
  laufen und springen gleichzeitig moeglich. Hoch- UND Querformat spielbar.

## Modi

- **Story:** 6 Welten mit je einem Gummi-Tier-Boss und grossem Finale. Fortschritt,
  Checkpoints und faires Game Over (nie zurueck zum Spielanfang).
- **Mini-Game (Score-Jagd):** ein durchgehender Lauf auf Punkte – mit echter
  Online-Bestenliste.

## Spielstand

Der Fortschritt wird automatisch im Browser gespeichert (`localStorage`, ein
versioniertes Save-Objekt). Im Hauptmenue laedt **Weiter** den letzten Stand;
**Story / Neues Spiel** setzt mit Sicherheitsabfrage zurueck. Bei Game Over geht
es am letzten Welt-/Level-Start weiter – der Welt-Fortschritt bleibt erhalten.

## Online-Bestenliste

Die geteilte Online-Bestenliste ist **bereits aktiv** (Supabase-Backend, Echtzeit,
statisch-tauglich). Faellt das Backend aus, schaltet das Spiel automatisch auf eine
lokale Bestenliste (im Browser) zurueck – es funktioniert also immer.

Eigenes Backend einrichten (optional, ~5 Min): ein kostenloses Supabase-Projekt
anlegen, im SQL-Editor eine `scores`-Tabelle mit RLS (nur INSERT + SELECT fuer
`anon`) erstellen und Project-URL + **anon public** Key in
**`quacki/leaderboard-config.js`** eintragen. Der `anon public` Key darf oeffentlich
im Repo stehen (durch die RLS-Regeln abgesichert); den `service_role`-Key **niemals**
committen.

```sql
create table scores (
  id bigint generated always as identity primary key,
  name text not null,
  score int not null,
  mode text not null default 'story',
  created_at timestamptz not null default now()
);
alter table scores enable row level security;
create policy "anon insert" on scores for insert to anon
  with check (char_length(name) between 1 and 20 and score >= 0);
create policy "anon read" on scores for select to anon using (true);
```

## Tests

Dependency-freier Headless-Smoke-Test (Node 18+):

```bash
node quacki/test/smoke.mjs
```

Deckt u.a. ab: Spielstand-Roundtrip + Migration, Checkpoint-Respawn, faires
Game Over, Online-Highscore (Insert/Fetch gemockt) + Offline-Fallback +
Namensfilter/Escaping, Sonderzeichen in 4 Sprachen, Hoch-/Querformat,
Desktop/Touch-Trennung, Browser-Verankerung (fixierte Stage + preventDefault).

## Deploy

Statische Seite auf Vercel (Deploy-Root = `quacki/`). Live:
<https://quacki.vercel.app>.

## Eigenstaendigkeit

Alle Figuren, Texte, Grafiken (Pixel-Art im Code gezeichnet), Musik (Chiptune im
Code) und die Pixel-Schrift (lokal gebundelt) sind original bzw. frei lizenziert.
Keine urheberrechtlich geschuetzten Inhalte, keine Werbung, keine Echtgeld-Kaeufe.
