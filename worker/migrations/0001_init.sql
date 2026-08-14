-- ============ PORTAL REGISTRY ============
CREATE TABLE IF NOT EXISTS portal (
  portal_id            TEXT PRIMARY KEY,          -- 'chicago'
  domain               TEXT NOT NULL,             -- 'data.cityofchicago.org'
  resource_id          TEXT NOT NULL,             -- 'r5kz-chrr'
  jurisdiction         TEXT NOT NULL,             -- 'Chicago, IL'
  field_map            TEXT NOT NULL,             -- JSON
  closure_method       TEXT NOT NULL,             -- 'status' | 'end_date' | 'delta'
  status_map           TEXT,                      -- JSON: raw code -> ACTIVE/LAPSED/REVOKED/CLOSED
  licensed_categories  TEXT,                      -- JSON array of in-scope raw category values
  last_sync_at         TEXT,
  last_sync_row_count  INTEGER,
  data_as_of           TEXT,
  stale                INTEGER NOT NULL DEFAULT 0
);

-- ============ CURRENT STATE ============
CREATE TABLE IF NOT EXISTS licence (
  licence_uid     TEXT PRIMARY KEY,   -- portal_id:source_pk
  portal_id       TEXT NOT NULL,
  source_pk       TEXT NOT NULL,
  licence_number  TEXT,
  legal_name      TEXT,
  dba_name        TEXT,
  name_norm       TEXT NOT NULL,
  addr_raw        TEXT,
  house_number    TEXT,
  street_norm     TEXT,
  unit            TEXT,
  city            TEXT,
  state           TEXT,
  zip5            TEXT,
  lat             REAL,
  lon             REAL,
  category_raw    TEXT,
  category_norm   TEXT,
  status_raw      TEXT,
  status_derived  TEXT NOT NULL,      -- ACTIVE | LAPSED | REVOKED | CLOSED
  issued_date     TEXT,
  start_date      TEXT,
  expiry_date     TEXT,
  end_date        TEXT,
  first_seen      TEXT NOT NULL,
  last_seen       TEXT NOT NULL,
  missing_streak  INTEGER NOT NULL DEFAULT 0,
  source_url      TEXT NOT NULL,
  slug            TEXT,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lic_block   ON licence(zip5, house_number);
CREATE INDEX IF NOT EXISTS idx_lic_street  ON licence(city, street_norm, house_number);
CREATE INDEX IF NOT EXISTS idx_lic_name    ON licence(name_norm);
CREATE INDEX IF NOT EXISTS idx_lic_portal  ON licence(portal_id, last_seen);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lic_slug ON licence(slug);

-- ============ THE MOAT ============
CREATE TABLE IF NOT EXISTS status_event (
  event_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  licence_uid  TEXT NOT NULL,
  observed_on  TEXT NOT NULL,
  from_status  TEXT,
  to_status    TEXT NOT NULL,
  evidence     TEXT,
  UNIQUE(licence_uid, observed_on, to_status)
);
CREATE INDEX IF NOT EXISTS idx_evt_uid  ON status_event(licence_uid, observed_on);
CREATE INDEX IF NOT EXISTS idx_evt_date ON status_event(observed_on, to_status);

-- ============ ACCUMULATING RESOLVER MEMORY ============
CREATE TABLE IF NOT EXISTS match_cache (
  query_hash   TEXT PRIMARY KEY,   -- sha256(name_norm|house_number|street_norm|zip5)
  licence_uid  TEXT,               -- NULL = confirmed no-match
  score        REAL,
  method       TEXT NOT NULL,      -- deterministic | llm_adjudicated | confirmed_none
  decided_at   TEXT NOT NULL
);

-- ============ pSEO AGGREGATES ============
CREATE TABLE IF NOT EXISTS city_month_rollup (
  portal_id     TEXT NOT NULL,
  month         TEXT NOT NULL,     -- 'YYYY-MM'
  category_norm TEXT NOT NULL,
  opened        INTEGER NOT NULL DEFAULT 0,
  closed        INTEGER NOT NULL DEFAULT 0,
  lapsed        INTEGER NOT NULL DEFAULT 0,
  revoked       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (portal_id, month, category_norm)
);

-- ============ OPS ============
CREATE TABLE IF NOT EXISTS snapshot_run (
  run_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  portal_id    TEXT NOT NULL,
  started_at   TEXT NOT NULL,
  finished_at  TEXT,
  rows_seen    INTEGER,
  rows_changed INTEGER,
  ok           INTEGER,
  note         TEXT
);
