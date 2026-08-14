import { describe, it, expect } from 'vitest';
import { normaliseName, normaliseAddress, generateSlug } from '../src/normalise';

describe('Normalisation Logic (§19.2)', () => {
  it('normalises business names by stripping suffixes, noise, diacritics', () => {
    expect(normaliseName("Joe's Pizza #2")).toBe("JOES PIZZA");
    expect(normaliseName("JOES PIZZA INC")).toBe("JOES PIZZA");
    expect(normaliseName("Café Del Mar LLC")).toBe("CAFE DEL MAR");
    expect(normaliseName("Taco Stand - Store 45")).toBe("TACO STAND");
  });

  it('normalises street addresses and parses units', () => {
    expect(normaliseAddress("123 N Main St Ste B")).toEqual({
      house_number: "123",
      street_norm: "N MAIN ST",
      unit: "B"
    });

    expect(normaliseAddress("456 South Broadway Avenue Apt 104")).toEqual({
      house_number: "456",
      street_norm: "S BROADWAY AVE",
      unit: "104"
    });
  });

  it('generates consistent pSEO URL slugs', () => {
    expect(generateSlug("JOES PIZZA", "N MAIN ST", "60601")).toBe("joes-pizza-n-main-st-60601");
  });
});
