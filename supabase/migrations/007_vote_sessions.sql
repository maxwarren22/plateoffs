-- ============================================================
-- Multiplayer vote sessions (async individual bracket model)
-- Each participant plays the full bracket solo; champions are
-- compared on the results screen.
-- ============================================================

-- Generates a random 4-char uppercase alphanumeric code
CREATE OR REPLACE FUNCTION generate_session_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I ambiguity
  code  text := '';
  i     int;
BEGIN
  FOR i IN 1..4 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN code;
END;
$$;

CREATE TABLE vote_sessions (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 text        NOT NULL UNIQUE DEFAULT generate_session_code(),
  division_id          uuid        REFERENCES plateoffs_divisions(id),
  division_name        text        NOT NULL,
  host_id              uuid        NOT NULL,
  status               text        NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'complete')),
  recipe_ids           uuid[]      NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  expires_at           timestamptz NOT NULL DEFAULT now() + interval '72 hours'
);

CREATE TABLE session_participants (
  session_id         uuid NOT NULL REFERENCES vote_sessions(id) ON DELETE CASCADE,
  voter_id           uuid NOT NULL,
  champion_recipe_id uuid REFERENCES recipes(id),  -- set when participant finishes their bracket
  joined_at          timestamptz NOT NULL DEFAULT now(),
  finished_at        timestamptz,
  PRIMARY KEY (session_id, voter_id)
);

CREATE INDEX idx_session_participants_session ON session_participants(session_id);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE vote_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "create own session"   ON vote_sessions FOR INSERT TO authenticated WITH CHECK (host_id = auth.uid());
CREATE POLICY "read sessions"        ON vote_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "host updates session" ON vote_sessions FOR UPDATE TO authenticated USING (host_id = auth.uid());

CREATE POLICY "join session"         ON session_participants FOR INSERT TO authenticated WITH CHECK (voter_id = auth.uid());
CREATE POLICY "read participants"    ON session_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "submit champion"      ON session_participants FOR UPDATE TO authenticated USING (voter_id = auth.uid());

-- Cleanup cron (add in Supabase Dashboard → Integrations → Cron):
--   Name:     expire-vote-sessions
--   Schedule: 0 4 * * *
--   SQL:      DELETE FROM vote_sessions WHERE expires_at < now();
