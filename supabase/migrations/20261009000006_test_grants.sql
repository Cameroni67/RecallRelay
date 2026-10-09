-- Hosted test support: `supabase test db --linked` connects as the Supabase
-- CLI's login role (e.g. cli_login_postgres), which by default has no USAGE
-- on the extensions schema where the harness installs pgTAP. Without it the
-- schema is silently skipped in search_path and plan()/finish() resolve as
-- "function does not exist". Supabase already grants extensions usage to the
-- standard API roles; this extends it to PUBLIC so remote test sessions and
-- any future roles can resolve extension functions.
grant usage on schema extensions to public;
