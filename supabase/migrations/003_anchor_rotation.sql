-- ============================================================
-- Phase 4 addendum: Anchor recipe rotation (5-day cycle)
-- Safe to re-run: uses ON CONFLICT DO NOTHING
-- ============================================================

INSERT INTO app_config (key, value) VALUES
  ('anchor_epoch',            '0'),
  ('next_anchor_rotation_at', '2025-06-06T00:00:00Z')
ON CONFLICT (key) DO NOTHING;
