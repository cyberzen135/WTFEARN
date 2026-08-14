export interface Env {
  DB: D1Database;
  SNAPSHOTS?: R2Bucket;
  API_KEY?: string;
  LLM_API_KEY?: string;
  SOCRATA_APP_TOKEN?: string;
  MIN_SCORE_AUTO?: string;
  MIN_SCORE_LLM?: string;
  MISSING_STREAK_CLOSED?: string;
}

export type LicenceStatus = 'ACTIVE' | 'LAPSED' | 'REVOKED' | 'CLOSED';

export type OutputStatus = 
  | LicenceStatus 
  | 'NOT_IN_LICENSED_CATEGORY' 
  | 'NO_COVERAGE' 
  | 'AMBIGUOUS'
  | 'TEMPORARILY_UNAVAILABLE';

export type MatchMethod = 'deterministic' | 'llm_adjudicated' | 'cached';

export interface PortalRow {
  portal_id: string;
  domain: string;
  resource_id: string;
  jurisdiction: string;
  field_map: string; // JSON
  closure_method: 'status' | 'end_date' | 'delta';
  status_map?: string | null; // JSON
  licensed_categories?: string | null; // JSON array
  last_sync_at?: string | null;
  last_sync_row_count?: number | null;
  data_as_of?: string | null;
  stale: number;
}

export interface LicenceRow {
  licence_uid: string;
  portal_id: string;
  source_pk: string;
  licence_number?: string | null;
  legal_name?: string | null;
  dba_name?: string | null;
  name_norm: string;
  addr_raw?: string | null;
  house_number?: string | null;
  street_norm?: string | null;
  unit?: string | null;
  city?: string | null;
  state?: string | null;
  zip5?: string | null;
  lat?: number | null;
  lon?: number | null;
  category_raw?: string | null;
  category_norm?: string | null;
  status_raw?: string | null;
  status_derived: LicenceStatus;
  issued_date?: string | null;
  start_date?: string | null;
  expiry_date?: string | null;
  end_date?: string | null;
  first_seen: string;
  last_seen: string;
  missing_streak: number;
  source_url: string;
  slug?: string | null;
  updated_at: string;
}

export interface StatusEventRow {
  event_id?: number;
  licence_uid: string;
  observed_on: string;
  from_status?: string | null;
  to_status: string;
  evidence?: string | null;
}

export interface InputRecord {
  id?: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface VerificationResult {
  id: string;
  input: InputRecord;
  status: OutputStatus;
  billable: boolean;
  confidence: number;
  match_method: MatchMethod | null;
  licence: {
    jurisdiction: string;
    licence_number: string;
    legal_name: string | null;
    dba_name: string | null;
    category: string | null;
    status_raw: string | null;
    issued_date: string | null;
    start_date: string | null;
    expiry_date: string | null;
    end_date: string | null;
    address: string | null;
    source_url: string;
  } | null;
  history: Array<{
    observed_on: string;
    from: string | null;
    to: string;
    evidence: string | null;
  }>;
  coverage: {
    city_supported: boolean;
    data_as_of: string | null;
    stale: boolean;
  };
  reason: string | null;
}
