import { describe, it, expect } from 'vitest';
import { diceCoefficient, jaroWinkler, tokenSetRatio } from '../src/resolve';
import { normaliseName, normaliseAddress } from '../src/normalise';

describe('Entity Resolution & Similarity Metrics (§9.5)', () => {
  it('computes Bigram Dice coefficient correctly for street names', () => {
    const dice1 = diceCoefficient('N MAIN ST', 'N MAIN STREET');
    expect(dice1).toBeGreaterThan(0.7);

    const dice2 = diceCoefficient('BROADWAY AVE', 'BROADWAY AVE');
    expect(dice2).toBe(1.0);
  });

  it('computes Jaro-Winkler string similarity for business names', () => {
    const sim = jaroWinkler('JOES PIZZA', 'JOE PIZZA');
    expect(sim).toBeGreaterThan(0.9);
  });

  it('computes Token Set Ratio for out-of-order words and legal suffixes', () => {
    const n1 = normaliseName("Joe's Pizza #2");
    const n2 = normaliseName("JOES PIZZA INC");
    expect(n1).toBe("JOES PIZZA");
    expect(n2).toBe("JOES PIZZA");
    const score = Math.max(jaroWinkler(n1, n2), tokenSetRatio(n1, n2));
    expect(score).toBe(1.0);
  });

  it('enforces house-number exact matching gate', () => {
    const addr1 = normaliseAddress("123 N Main St");
    const addr2 = normaliseAddress("125 N Main St");
    expect(addr1.house_number).toBe("123");
    expect(addr2.house_number).toBe("125");
    expect(addr1.house_number === addr2.house_number).toBe(false);
  });
});
