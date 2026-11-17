import {
  getLastDayOfPreviousMonth,
  computeIsracardChargeDate,
  parseExcelDate,
  parseIsracardDate,
} from './importDates';

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

describe('parseExcelDate', () => {
  test('falsy values return null', () => {
    expect(parseExcelDate(null)).toBeNull();
    expect(parseExcelDate(0)).toBeNull();
    expect(parseExcelDate('')).toBeNull();
  });

  test('Excel serial numbers (whole and fractional) map to the calendar date', () => {
    expect(parseExcelDate(45658)).toBe('2025-01-01');
    expect(parseExcelDate(45658.75)).toBe('2025-01-01');
    expect(parseExcelDate(45747)).toBe('2025-03-31');
  });

  test('DD/MM/YYYY with any of / - . as separator', () => {
    expect(parseExcelDate('05/03/2025')).toBe('2025-03-05');
    expect(parseExcelDate('05-03-2025')).toBe('2025-03-05');
    expect(parseExcelDate('05.03.2025')).toBe('2025-03-05');
  });

  test('YYYY-MM-DD is kept as is', () => {
    expect(parseExcelDate('2025-03-05')).toBe('2025-03-05');
  });

  test('two-digit years: 70-99 are 19xx, 00-69 are 20xx', () => {
    expect(parseExcelDate('05/03/25')).toBe('2025-03-05');
    expect(parseExcelDate('05/03/70')).toBe('1970-03-05');
    expect(parseExcelDate('05/03/69')).toBe('2069-03-05');
  });

  test('surrounding spaces are ignored', () => {
    expect(parseExcelDate(' 05/03/2025 ')).toBe('2025-03-05');
  });

  test('unrecognised input returns null', () => {
    expect(parseExcelDate('garbage')).toBeNull();
    expect(parseExcelDate({})).toBeNull();
  });
});

describe('parseIsracardDate', () => {
  test('falsy values return null', () => {
    expect(parseIsracardDate(null)).toBeNull();
    expect(parseIsracardDate('')).toBeNull();
  });

  test('two-digit year with dots', () => {
    expect(parseIsracardDate('05.03.25')).toBe('2025-03-05');
  });

  test('four-digit year with slashes or dashes', () => {
    expect(parseIsracardDate('05/03/2025')).toBe('2025-03-05');
    expect(parseIsracardDate('05-03-2025')).toBe('2025-03-05');
  });

  test('Excel serial numbers are delegated to parseExcelDate', () => {
    expect(parseIsracardDate(45658)).toBe('2025-01-01');
  });

  test('ISO strings fall through to parseExcelDate', () => {
    expect(parseIsracardDate('2025-03-05')).toBe('2025-03-05');
  });

  test('unrecognised input returns null', () => {
    expect(parseIsracardDate('garbage')).toBeNull();
  });
});

// The date patterns once wrote the slash as "\/" inside the separator class. The class is now
// "[/\-.]". These tests pin that the two spellings are the same pattern and that parsing is
// unchanged for every separator, shape and odd input.
describe('separator class spelling', () => {
  const OLD_SEP = String.raw`[\/\-.]`;
  const NEW_SEP = String.raw`[/\-.]`;
  const shapes = (sep) => [
    new RegExp(String.raw`^(\d{2})${sep}(\d{2})${sep}(\d{4})$`),
    new RegExp(String.raw`^(\d{4})${sep}(\d{2})${sep}(\d{2})$`),
    new RegExp(String.raw`^(\d{2})${sep}(\d{2})${sep}(\d{2})$`),
  ];
  const oldShapes = shapes(OLD_SEP);
  const newShapes = shapes(NEW_SEP);

  // Every separator character the old class could or could not match, in both positions.
  const seps = ['/', '-', '.', '\\', ' ', ',', ':', '_', 'x', '', '//', '\n'];
  const bodies = [
    ['05', '03', '2025'], ['2025', '03', '05'], ['05', '03', '25'], ['31', '12', '1999'],
    ['5', '3', '2025'], ['05', '03', '202'], ['0a', '03', '2025'], ['00', '00', '0000'],
  ];
  const inputs = [];
  for (const [a, b, c] of bodies) {
    for (const s1 of seps) for (const s2 of seps) inputs.push(`${a}${s1}${b}${s2}${c}`);
  }
  inputs.push('', ' ', '2025', '05/03', '05/03/2025/1', ' 05/03/2025', '05/03/2025 ');

  test('the old and new patterns match exactly the same strings with the same groups', () => {
    for (const str of inputs) {
      oldShapes.forEach((oldRe, i) => {
        expect(str.match(newShapes[i])).toEqual(str.match(oldRe));
      });
    }
  });

  test('the separators that match are exactly slash, dash and dot', () => {
    const accepted = seps.filter((s) => s.length === 1 && newShapes[0].test(`05${s}03${s}2025`));
    expect(accepted.sort()).toEqual(['-', '.', '/']);
  });

  test('the escape no longer appears in the source patterns', () => {
    expect(NEW_SEP).not.toContain('\\/');
  });

  test('parseExcelDate results for slash, dash and dot dates are unchanged', () => {
    expect(parseExcelDate('05/03/2025')).toBe('2025-03-05');
    expect(parseExcelDate('05-03-2025')).toBe('2025-03-05');
    expect(parseExcelDate('05.03.2025')).toBe('2025-03-05');
    expect(parseExcelDate('2025/03/05')).toBe('2025-03-05');
    expect(parseExcelDate('05/03/25')).toBe('2025-03-05');
    expect(parseExcelDate('05/03/70')).toBe('1970-03-05');
    expect(parseExcelDate('05\\03\\2025')).toBeNull();
    expect(parseExcelDate('05 03 2025')).toBeNull();
    expect(parseExcelDate('5/3/2025')).toBeNull();
  });
});
