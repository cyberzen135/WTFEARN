import { describe, it, expect } from 'vitest';
import { deriveStatus } from '../src/status';

describe('Status Derivation Engine (§19.2)', () => {
  const today = '2026-08-14';

  it('derives LAPSED for expired licences', () => {
    expect(deriveStatus({ expiry_date: '2020-01-01' }, 'status', null, today)).toBe('LAPSED');
  });

  it('derives CLOSED when end_date has passed', () => {
    expect(deriveStatus({ end_date: '2015-02-19' }, 'end_date', null, today)).toBe('CLOSED');
  });

  it('derives ACTIVE for presence in delta-only active dataset', () => {
    expect(deriveStatus({}, 'delta', null, today)).toBe('ACTIVE');
  });

  it('respects explicit revocation in status_map', () => {
    const map = { 'REV': 'REVOKED' as const, 'AAI': 'ACTIVE' as const };
    expect(deriveStatus({ status_raw: 'REV' }, 'status', map, today)).toBe('REVOKED');
  });
});
