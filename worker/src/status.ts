import { LicenceStatus } from './types';

export function deriveStatus(
  r: {
    status_raw?: string | null;
    end_date?: string | null;
    expiry_date?: string | null;
  },
  closureMethod: 'status' | 'end_date' | 'delta',
  statusMap: Record<string, LicenceStatus> | null,
  today: string
): LicenceStatus {
  // 1. Explicit revocation / cancellation wins
  if (r.status_raw && statusMap) {
    const rawUpper = r.status_raw.trim().toUpperCase();
    const mapped = statusMap[rawUpper];
    if (mapped === "REVOKED") return "REVOKED";
    if (mapped === "CLOSED") return "CLOSED";
  }

  // 2. Explicit end date
  if (r.end_date && r.end_date <= today) {
    return "CLOSED";
  }

  // 3. Expiry date check
  if (r.expiry_date && r.expiry_date.slice(0, 10) < today) {
    return "LAPSED";
  }

  // 4. Mapped active status
  if (r.status_raw && statusMap) {
    const rawUpper = r.status_raw.trim().toUpperCase();
    const mapped = statusMap[rawUpper];
    if (mapped === "ACTIVE") return "ACTIVE";
    if (mapped === "LAPSED") return "LAPSED";
  }

  // 5. Delta-only portals (e.g. Los Angeles): presence in snapshot == active
  if (closureMethod === "delta") {
    return "ACTIVE";
  }

  // 6. Default to ACTIVE if unmapped but active portal record present
  return "ACTIVE";
}
