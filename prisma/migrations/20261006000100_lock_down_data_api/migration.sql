-- Supabase exposes the public schema through its REST API (PostgREST) to the `anon` and
-- `authenticated` roles, and the anon key is public. This app never uses that API: it talks
-- to Postgres directly through Prisma as the table owner, which bypasses RLS.
-- RLS on with no policies = the REST API can read and write nothing.

ALTER TABLE "Admin"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Brand"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LogoType"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LogoVariant"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Color"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FileObject"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- Belt and braces: the API roles get no table privileges at all.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Tables created by later migrations (run as this same role) don't get API grants either.
-- New tables still need `ENABLE ROW LEVEL SECURITY` in their own migration.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
