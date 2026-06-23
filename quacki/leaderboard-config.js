/* ===================================================================
   Quacki — Online-Bestenliste: Konfiguration
   -------------------------------------------------------------------
   So aktivierst du die echte, geteilte Online-Bestenliste (einmalig, ~5 Min):

   1) Kostenloses Supabase-Projekt anlegen:  https://supabase.com  (nur DU)
   2) Im Supabase "SQL Editor" dieses SQL EINMAL ausfuehren:

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

      (Nur INSERT + SELECT fuer anon — niemand kann die Liste aendern/loeschen.)

   3) In Supabase unter  Project Settings -> API  die beiden Werte kopieren
      und unten eintragen:
        - "Project URL"   ->  SUPABASE_URL
        - "anon public"   ->  SUPABASE_ANON_KEY

   WICHTIG: Der "anon public" Key DARF oeffentlich im Repo stehen (durch die
   RLS-Regeln oben abgesichert). NIEMALS den "service_role"-Key eintragen!

   Solange diese Werte leer sind, nutzt das Spiel automatisch eine lokale
   Bestenliste (im Browser gespeichert) — es funktioniert also immer.
   =================================================================== */
window.LEADERBOARD_CONFIG = {
  SUPABASE_URL: "",       // z.B. "https://xxxxxxxx.supabase.co"
  SUPABASE_ANON_KEY: ""   // der lange "anon public" Key
};
