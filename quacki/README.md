# Quacki - Die Entenrettung

Ein gewaltfreies, kinderfreundliches Retro-Jump'n'Run im echten Pixel-Look.
Hilf Quacki, die goldene Gummiente Goldi aus dem Quakschloss von Baron von Quak
zu retten: 6 Welten, je ein Gummi-Tier-Boss, 3 Schwierigkeiten. Story-Modus mit
Spielstand + Checkpoints und ein Mini-Game (Score-Jagd) mit Online-Bestenliste.

Alles steckt selbst-enthalten in diesem Ordner (relative Pfade, keine externen
Bibliotheken, offline lauffaehig als PWA).

## Spielen

`quacki/game.html` im Browser oeffnen, oder einen kleinen Server starten:

```bash
cd quacki
python3 -m http.server 8000   # dann http://localhost:8000/game.html
```

### Steuerung

- **Desktop:** Pfeiltasten / A D laufen, Leertaste / Pfeil hoch / W springen
  (in der Luft halten = gleiten), P oder Esc Pause, Maus fuer Menues.
- **Handy:** grosse Touch-Tasten unten (links/rechts = laufen, rechts = springen);
  laufen und springen gleichzeitig moeglich. Hoch- UND Querformat spielbar.

## Spielstand

Der Fortschritt wird automatisch im Browser gespeichert (`localStorage`, ein
versioniertes Save-Objekt). Im Hauptmenue laedt **Weiter** den letzten Stand;
**Story / Neues Spiel** setzt mit Sicherheitsabfrage zurueck. Bei Game Over geht
es am letzten Welt-/Level-Start weiter (nie zurueck zum Spielanfang) - der
Welt-Fortschritt bleibt erhalten.

## Online-Bestenliste aktivieren (optional, ~5 Min)

Ohne Konfiguration nutzt das Spiel automatisch eine **lokale** Bestenliste (im
Browser) - es funktioniert also sofort. Fuer eine **echte, geteilte** Online-Liste
(alle Spieler weltweit) mit Supabase (kostenlos, Echtzeit, statisch-tauglich):

1. **Supabase-Projekt anlegen** auf <https://supabase.com> (kostenloser Free-Plan).

2. Im Supabase **SQL Editor** dieses SQL **einmal** ausfuehren:

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

   (Nur INSERT + SELECT fuer `anon` - niemand kann die Liste aendern oder loeschen.)

3. In Supabase unter **Project Settings -> API** die beiden Werte kopieren und in
   **`quacki/leaderboard-config.js`** eintragen:

   ```js
   window.LEADERBOARD_CONFIG = {
     SUPABASE_URL: "https://DEIN-PROJEKT.supabase.co",  // = "Project URL"
     SUPABASE_ANON_KEY: "DEIN-ANON-PUBLIC-KEY"          // = "anon public"
   };
   ```

   - Der **anon public** Key DARF oeffentlich im Repo stehen (durch die RLS-Regeln
     oben abgesichert).
   - **NIEMALS** den `service_role`-Key eintragen oder committen!

4. Fertig. Neue Eintraege erscheinen live (Polling alle ~5 s). Faellt das Backend
   aus, schaltet das Spiel automatisch auf die lokale Liste zurueck.

## Tests

Dependency-freier Headless-Smoke-Test (Node 18+):

```bash
node quacki/test/smoke.mjs
```

Deckt u.a. ab: Spielstand-Roundtrip + Migration, Checkpoint-Respawn, faires
Game Over, Online-Highscore (Insert/Fetch gemockt) + Offline-Fallback +
Namensfilter/Escaping, Sonderzeichen in 4 Sprachen, Hoch-/Querformat,
Desktop/Touch-Trennung.

## Eigenstaendigkeit

Alle Figuren, Texte, Grafiken (Pixel-Art im Code gezeichnet), Musik (Chiptune im
Code) und die Pixel-Schrift (lokal gebundelt) sind original bzw. frei lizenziert.
Keine urheberrechtlich geschuetzten Inhalte, keine Werbung, keine Echtgeld-Kaeufe.
