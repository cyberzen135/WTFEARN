import { PortalRow } from './types';

export const SEED_PORTALS: PortalRow[] = [
  {
    portal_id: 'chicago',
    domain: 'data.cityofchicago.org',
    resource_id: 'r5kz-chrr',
    jurisdiction: 'Chicago, IL',
    field_map: JSON.stringify({
      source_pk: 'license_id',
      licence_number: 'license_number',
      legal_name: 'legal_name',
      dba_name: 'doing_business_as_name',
      address: 'address',
      city: 'city',
      state: 'state',
      zip5: 'zip_code',
      category_raw: 'license_description',
      status_raw: 'license_status',
      issued_date: 'date_issued',
      start_date: 'license_start_date',
      expiry_date: 'expiration_date',
      end_date: null
    }),
    closure_method: 'status',
    status_map: JSON.stringify({
      'AAI': 'ACTIVE',
      'AAC': 'ACTIVE',
      'REV': 'REVOKED',
      'REA': 'ACTIVE',
      'INQ': 'CLOSED'
    }),
    licensed_categories: JSON.stringify([
      'Retail Food Establishment',
      'Liquor',
      'Tavern',
      'Public Place of Amusement',
      'Consumption on Premises',
      'Package Goods',
      'Caterer\'s Liquor License'
    ]),
    stale: 0
  },
  {
    portal_id: 'nyc',
    domain: 'data.cityofnewyork.us',
    resource_id: 'w7w3-xahh',
    jurisdiction: 'New York, NY',
    field_map: JSON.stringify({
      source_pk: 'business_unique_id',
      licence_number: 'license_nbr',
      legal_name: 'business_name',
      dba_name: 'dba_trade_name',
      address_building: 'address_building',
      address_street: 'address_street_name',
      city: 'address_city',
      state: 'address_state',
      zip5: 'address_zip',
      category_raw: 'business_category',
      status_raw: 'license_status',
      issued_date: 'license_creation_date',
      start_date: 'license_creation_date',
      expiry_date: 'lic_expir_dd',
      end_date: null
    }),
    closure_method: 'status',
    status_map: JSON.stringify({
      'Active': 'ACTIVE',
      'Ready for Renewal': 'ACTIVE',
      'Expired': 'LAPSED',
      'Inactive': 'CLOSED',
      'Revoked': 'REVOKED',
      'Surrendered': 'CLOSED'
    }),
    licensed_categories: JSON.stringify([
      'Cigarette Retail Dealer',
      'Electronic Cigarette Retail Dealer',
      'Sightseeing Guide',
      'General Vendor',
      'Laundry',
      'Cabaret',
      'Catering Establishment'
    ]),
    stale: 0
  },
  {
    portal_id: 'sf',
    domain: 'data.sfgov.org',
    resource_id: 'g8m3-pdis',
    jurisdiction: 'San Francisco, CA',
    field_map: JSON.stringify({
      source_pk: 'uniqueid',
      licence_number: 'certificate_number',
      legal_name: 'ownership_name',
      dba_name: 'dba_name',
      address: 'full_business_address',
      city: 'city',
      state: 'state',
      zip5: 'business_zip',
      category_raw: 'ownership_name',
      status_raw: null,
      issued_date: 'dba_start_date',
      start_date: 'location_start_date',
      expiry_date: null,
      end_date: 'dba_end_date'
    }),
    closure_method: 'end_date',
    status_map: null,
    licensed_categories: null,
    stale: 0
  },
  {
    portal_id: 'la',
    domain: 'data.lacity.org',
    resource_id: '6rrh-rzua',
    jurisdiction: 'Los Angeles, CA',
    field_map: JSON.stringify({
      source_pk: 'location_account',
      licence_number: 'location_account',
      legal_name: 'business_name',
      dba_name: 'business_name',
      address: 'street_address',
      city: 'city',
      state: null,
      zip5: 'zip_code',
      category_raw: 'primary_naics_description',
      status_raw: null,
      issued_date: 'location_start_date',
      start_date: 'location_start_date',
      expiry_date: null,
      end_date: null
    }),
    closure_method: 'delta',
    status_map: null,
    licensed_categories: null,
    stale: 0
  }
];
