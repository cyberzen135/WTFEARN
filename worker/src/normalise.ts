const LEGAL_SUFFIX = /\b(INC|INCORPORATED|LLC|L\.L\.C|LLP|LP|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|PC|PLLC|DBA|THE)\b/g;
const BRANCH_NOISE = /(\s#\s?\d+|\s-\s?\d+|\bNO\.?\s?\d+\b|\bSTORE\s?\d+\b|\bLOCATION\s?\d+\b)/g;

export function normaliseName(s: string): string {
  return (s ?? "")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/['’]/g, "")
    .replace(BRANCH_NOISE, " ")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(LEGAL_SUFFIX, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STREET_TYPE: Record<string, string> = {
  STREET: "ST", ST: "ST", AVENUE: "AVE", AVE: "AVE", BOULEVARD: "BLVD", BLVD: "BLVD",
  ROAD: "RD", RD: "RD", DRIVE: "DR", DR: "DR", LANE: "LN", LN: "LN", COURT: "CT", CT: "CT",
  PLACE: "PL", PL: "PL", TERRACE: "TER", PARKWAY: "PKWY", HIGHWAY: "HWY", SQUARE: "SQ",
  CIRCLE: "CIR", TRAIL: "TRL", WAY: "WAY"
};

const DIRECTION: Record<string, string> = {
  NORTH: "N", SOUTH: "S", EAST: "E", WEST: "W",
  NORTHEAST: "NE", NORTHWEST: "NW", SOUTHEAST: "SE", SOUTHWEST: "SW"
};

const UNIT_RE = /\b(STE|SUITE|UNIT|APT|APARTMENT|RM|ROOM|FL|FLOOR|BLDG|#)\s*([A-Z0-9-]+)\b/;

export function normaliseAddress(raw: string) {
  const s = (raw ?? "").toUpperCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  const unitMatch = s.match(UNIT_RE);
  const unit = unitMatch ? unitMatch[2] : null;
  const body = s.replace(UNIT_RE, " ").replace(/\s+/g, " ").trim();
  const parts = body.split(" ");
  const house_number = /^\d+[A-Z]?$/.test(parts[0]) ? parts[0] : null;
  const streetTokens = (house_number ? parts.slice(1) : parts)
    .map(t => DIRECTION[t] ?? STREET_TYPE[t] ?? t);
  return { house_number, street_norm: streetTokens.join(" "), unit };
}

export function generateSlug(nameNorm: string, streetNorm: string, zip5: string): string {
  const kebabName = nameNorm.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const kebabStreet = streetNorm.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const zip = (zip5 || '00000').slice(0, 5);
  return `${kebabName}-${kebabStreet}-${zip}`;
}
