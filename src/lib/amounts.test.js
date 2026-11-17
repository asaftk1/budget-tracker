import { cleanAmount } from './amounts';

describe('cleanAmount', () => {
  test('empty cells return null', () => {
    expect(cleanAmount(null)).toBeNull();
    expect(cleanAmount(undefined)).toBeNull();
    expect(cleanAmount('')).toBeNull();
  });

  test('numbers pass through unchanged, including zero and negatives', () => {
    expect(cleanAmount(12.5)).toBe(12.5);
    expect(cleanAmount(0)).toBe(0);
    expect(cleanAmount(-3)).toBe(-3);
  });

  test('strips the shekel sign, thousands separators and spaces', () => {
    expect(cleanAmount('₪1,234.50')).toBe(1234.5);
    expect(cleanAmount('  12.30 ')).toBe(12.3);
    expect(cleanAmount('1 000')).toBe(1000);
  });

  test('accounting parentheses mean a negative amount', () => {
    expect(cleanAmount('(45.00)')).toBe(-45);
    expect(cleanAmount('(₪1,000)')).toBe(-1000);
  });

  test('a leading minus sign is kept', () => {
    expect(cleanAmount('-12.5')).toBe(-12.5);
  });

  test('non-numeric text returns null', () => {
    expect(cleanAmount('abc')).toBeNull();
    expect(cleanAmount('₪')).toBeNull();
  });

  test('stops at the second decimal point (current behaviour)', () => {
    expect(cleanAmount('1.2.3')).toBe(1.2);
  });
});
