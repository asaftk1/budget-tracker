import { getLastDayOfPreviousMonth, computeIsracardChargeDate } from './importDates';

// Tests run with TZ=Asia/Jerusalem (see src/jestGlobalSetup.js), where local midnight
// is 2-3 hours before UTC midnight, so toISOString() shifts dates back by one day.

describe('getLastDayOfPreviousMonth', () => {
  test('mid-month date', () => {
    expect(getLastDayOfPreviousMonth('2025-03-15')).toBe('2025-02-28');
  });

  test('leap year February', () => {
    expect(getLastDayOfPreviousMonth('2024-03-15')).toBe('2024-02-29');
  });

  test('first day of month', () => {
    expect(getLastDayOfPreviousMonth('2025-03-01')).toBe('2025-02-28');
  });

  test('last day of month', () => {
    expect(getLastDayOfPreviousMonth('2025-03-31')).toBe('2025-02-28');
    expect(getLastDayOfPreviousMonth('2025-12-31')).toBe('2025-11-30');
  });

  test('crosses the year boundary', () => {
    expect(getLastDayOfPreviousMonth('2025-01-10')).toBe('2024-12-31');
    expect(getLastDayOfPreviousMonth('2025-01-01')).toBe('2024-12-31');
  });

  test('invalid input returns null', () => {
    expect(getLastDayOfPreviousMonth('not a date')).toBeNull();
    expect(getLastDayOfPreviousMonth('')).toBeNull();
  });
});

describe('computeIsracardChargeDate', () => {
  test('uses the billing date from the header', () => {
    expect(computeIsracardChargeDate({ headerYear: 2025, headerMonth: 3, billingStr: '10.03' })).toBe('2025-03-10');
  });

  test('charge date on the 1st', () => {
    expect(computeIsracardChargeDate({ headerYear: 2025, headerMonth: 3, billingStr: '01.03' })).toBe('2025-03-01');
  });

  test('charge date on the last day of the month', () => {
    expect(computeIsracardChargeDate({ headerYear: 2025, headerMonth: 3, billingStr: '31.03' })).toBe('2025-03-31');
  });

  test('falls back to the 10th of the header month', () => {
    expect(computeIsracardChargeDate({ headerYear: 2025, headerMonth: 3, billingStr: null })).toBe('2025-03-10');
  });

  test('posting date for a charge on the 1st lands in the previous month', () => {
    const charge = computeIsracardChargeDate({ headerYear: 2025, headerMonth: 3, billingStr: '01.03' });
    expect(getLastDayOfPreviousMonth(charge)).toBe('2025-02-28');
  });
});
