import { formatDisplayDate } from './formatDate';

describe('formatDisplayDate', () => {
  test('turns YYYY-MM-DD into dd/mm/yyyy', () => {
    expect(formatDisplayDate('2026-10-31')).toBe('31/10/2026');
    expect(formatDisplayDate('2025-01-05')).toBe('05/01/2025');
  });

  test('ignores a time part and does not shift the day', () => {
    expect(formatDisplayDate('2026-10-31T23:30:00')).toBe('31/10/2026');
    expect(formatDisplayDate('2026-10-31 00:00')).toBe('31/10/2026');
  });

  test('leaves other text unchanged and maps a missing value to an empty string', () => {
    expect(formatDisplayDate('31/10/2026')).toBe('31/10/2026');
    expect(formatDisplayDate('2026-10')).toBe('2026-10');
    expect(formatDisplayDate('junk')).toBe('junk');
    expect(formatDisplayDate('')).toBe('');
    expect(formatDisplayDate(undefined)).toBe('');
    expect(formatDisplayDate(null)).toBe('');
  });
});
