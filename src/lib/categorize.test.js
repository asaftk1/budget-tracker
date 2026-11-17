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

// Real-looking merchant names from statements. Hebrew names are statement data.
describe('categorizeMerchant: keyword matching on real-looking names', () => {
  const groceries = categorizeMerchant('שופרסל דיל');
  const fuel = categorizeMerchant('פז תחנת דלק');
  const clothing = categorizeMerchant('ZARA');
  const electronics = categorizeMerchant('KSP');
  const subscriptions = categorizeMerchant('Netflix');
  const telecom = categorizeMerchant('סלקום');
  const insurance = categorizeMerchant('הראל ביטוח');
  const health = categorizeMerchant('מכבי שירותי בריאות');
  const transfers = categorizeMerchant('BIT');
  const restaurants = categorizeMerchant('ארומה אספרסו בר');
  const pharmacy = categorizeMerchant('SUPER-PHARM');

  test('anchor categories are all distinct and non-empty', () => {
    const all = [groceries, fuel, clothing, electronics, subscriptions, telecom, insurance, health, transfers, restaurants, pharmacy];
    expect(all.every(Boolean)).toBe(true);
    expect(new Set(all).size).toBe(all.length);
  });

  describe('short keywords must match whole words only', () => {
    test.each([
      ['Foxtrot', 'a supermarket chain, not the "fox" clothing brand'],
      ['Attention Agency', 'contains "ten"'],
      ['Yesterday Bar', 'contains "yes"'],
      ['Debug Labs', 'contains "bug"'],
      ['Orbit Travel', 'contains "bit"'],
      ['Ohm Studio', 'contains "hm"'],
      ['שוקולד בלגי', 'contains "שוק"'],
      ['פזית קוסמטיקה', 'contains "פז"'],
      ['אדן ספרים', 'contains "דן"'],
      ['גזית גלוב', 'contains "גז"'],
      ['תמימים', 'contains "מים"'],
    ])('%s is not categorised by a keyword hidden inside it (%s)', (merchant) => {
      expect(categorizeMerchant(merchant)).toBe('');
    });

    test.each([
      ['TEN', fuel],
      ['Ten Petroleum', fuel],
      ['H&M', clothing],
      ['FOX HOME', clothing],
      ['Pull&Bear', clothing],
      ['BIT תשלום', transfers],
      ['yes', telecom],
      ['012 סמייל', telecom],
      ['WOLT*Tel Aviv', restaurants],
      ['פז', fuel],
      ['פז-ירוק', fuel],
      ['מגדל ביטוח', insurance],
      ['כלל חברה לביטוח', insurance],
      ['חברת החשמל', categorizeMerchant('מים')],
      ['שוק מחנה יהודה', restaurants],
    ])('%s still matches as a whole word', (merchant, expected) => {
      expect(categorizeMerchant(merchant)).toBe(expected);
    });
  });

  test('a Hebrew one-letter prefix does not hide a short keyword', () => {
    const utilities = categorizeMerchant('חשמל');
    expect(utilities).not.toBe('');
    expect(categorizeMerchant('החשמל')).toBe(utilities);
    expect(categorizeMerchant('לחשמל')).toBe(utilities);
    expect(categorizeMerchant('חברת החשמל לישראל')).toBe(utilities);
    expect(categorizeMerchant('בפז')).toBe(fuel);
  });

  test('...but a non-prefix letter in front still blocks the match', () => {
    expect(categorizeMerchant('אדן ספרים')).toBe(''); // "דן" preceded by א
    expect(categorizeMerchant('רגז')).toBe(''); // "גז" preceded by ר
  });

  test('keywords inside longer words are fine (ordinary substring rules)', () => {
    expect(categorizeMerchant('SUPERPHARM TLV')).toBe(pharmacy);
    expect(categorizeMerchant('NETFLIX.COM')).toBe(subscriptions);
    expect(categorizeMerchant('GOOGLE*YOUTUBE')).toBe(subscriptions);
  });

  test('the health fund Clalit is health, not insurance', () => {
    expect(categorizeMerchant('כללית שירותי בריאות')).toBe(health);
  });

  test('Apple TV is a digital subscription, not electronics', () => {
    expect(categorizeMerchant('Apple TV')).toBe(subscriptions);
    expect(categorizeMerchant('APPLE.COM/BILL')).toBe(electronics);
    expect(categorizeMerchant('Apple Store')).toBe(electronics);
  });

  test('a rule keyword with a leading space still matches at the start of the name', () => {
    expect(categorizeMerchant('012 Mobile')).toBe(telecom);
  });

  test('"Super-Pharm" is a pharmacy, never health', () => {
    expect(categorizeMerchant('סופר פארם')).toBe(pharmacy);
    expect(categorizeMerchant('סופר-פארם דיזנגוף')).toBe(pharmacy);
  });

  test('matching is case-insensitive', () => {
    expect(categorizeMerchant('KSP')).toBe(categorizeMerchant('ksp'));
    expect(categorizeMerchant('Zara')).toBe(clothing);
  });
});
