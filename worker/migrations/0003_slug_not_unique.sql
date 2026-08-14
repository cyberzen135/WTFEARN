DROP INDEX IF EXISTS idx_lic_slug;
CREATE INDEX IF NOT EXISTS idx_lic_slug ON licence(slug);
