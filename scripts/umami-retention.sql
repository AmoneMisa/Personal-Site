-- Deletes Umami visit statistics older than 90 days. Run daily by the
-- `umami-retention` compose service. The 90-day period is promised in the
-- privacy policy (shared/legal/legalContent.ts, retention section), so change
-- both together. Umami has no built-in retention setting.
BEGIN;
DELETE FROM event_data WHERE created_at < now() - interval '90 days';
DELETE FROM website_event WHERE created_at < now() - interval '90 days';
DELETE FROM session_data WHERE created_at < now() - interval '90 days';
DELETE FROM session s
WHERE s.created_at < now() - interval '90 days'
  AND NOT EXISTS (SELECT 1 FROM website_event e WHERE e.session_id = s.session_id);
COMMIT;
