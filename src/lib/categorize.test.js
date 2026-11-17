import { categorizeMerchant, normalizeMerchantName } from './categorize';

// "netflix" and "spotify" are built-in keyword rules (digital subscriptions).
const savedMap = (entries) => new Map(Object.entries(entries));

describe('categorizeMerchant', () => {
  test('a saved user category wins over a matching keyword rule', () => {
    const map = savedMap({ netflix: 'Entertainment' });
    expect(categorizeMerchant('Netflix', map)).toBe('Entertainment');
  });

  test('saved map lookup ignores case and surrounding spaces', () => {
    const map = savedMap({ netflix: 'Entertainment' });
    expect(categorizeMerchant('  NETFLIX ', map)).toBe('Entertainment');
  });

  test('falls back to keyword rules when the merchant is not in the map', () => {
    const map = savedMap({ somethingelse: 'Other' });
    const result = categorizeMerchant('Spotify', map);
    expect(result).not.toBe('');
    expect(result).not.toBe('Other');
  });

  test('works without a map', () => {
    expect(categorizeMerchant('Spotify')).not.toBe('');
    expect(categorizeMerchant('Spotify', null)).not.toBe('');
  });

  test('unknown merchant with no saved entry returns an empty string', () => {
    expect(categorizeMerchant('qzxv unknown shop', savedMap({}))).toBe('');
  });

  test('empty merchant returns an empty string', () => {
    expect(categorizeMerchant('', savedMap({ '': 'x' }))).toBe('');
    expect(categorizeMerchant(null, null)).toBe('');
  });
});

describe('normalizeMerchantName', () => {
  test('trims and lowercases', () => {
    expect(normalizeMerchantName('  AbC ')).toBe('abc');
    expect(normalizeMerchantName(undefined)).toBe('');
  });
});
