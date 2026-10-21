-- Deletes Umami visit statistics older than 90 days. Run daily by the
-- `umami-retention` compose service. The 90-day period is promised in the
-- privacy policy (shared/legal/legalContent.ts, retention section), so change
-- both together. Umami has no built-in retention setting.
--
-- Umami creates its tables on first start, so until then this is a no-op.
DO $$
BEGIN
  IF to_regclass('website_event') IS NULL THEN
    RAISE NOTICE 'umami tables not created yet; skipping retention';
    RETURN;
  END IF;
  DELETE FROM event_data WHERE created_at < now() - interval '90 days';
  DELETE FROM website_event WHERE created_at < now() - interval '90 days';
  DELETE FROM session_data WHERE created_at < now() - interval '90 days';
  DELETE FROM session s
  WHERE s.created_at < now() - interval '90 days'
    AND NOT EXISTS (SELECT 1 FROM website_event e WHERE e.session_id = s.session_id);
END
$$;
