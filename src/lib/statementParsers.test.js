import {
  extractBillingDate,
  parseIsracardSheet,
  parseMaxSheet,
  HEBREW_MONTHS,
  ISRACARD_BILLING_REGEX,
  NOTE_FILL_CATEGORY,
} from './statementParsers';
import { TYPE } from '../constants';

// Tests run with TZ=Asia/Jerusalem (see src/jestGlobalSetup.js).

describe('extractBillingDate', () => {
  const regex = /due (\d{2}\.\d{2})/;

  test('returns capture group 1 from the first matching string cell', () => {
    expect(extractBillingDate([[1, 'x'], [null, 'pay due 10.05 please']], regex)).toBe('10.05');
  });

  test('returns the whole match when the regex has no capture group', () => {
    expect(extractBillingDate([['abc 123']], /\d+/)).toBe('123');
  });

  test('ignores non-string cells and missing rows', () => {
    expect(extractBillingDate([null, undefined, [42, {}, null]], regex)).toBeNull();
  });

  test('returns null when nothing matches', () => {
    expect(extractBillingDate([['nothing here']], regex)).toBeNull();
    expect(extractBillingDate([], regex)).toBeNull();
  });
});

describe('parseIsracardSheet', () => {
  const APRIL = Object.keys(HEBREW_MONTHS)[3];
  const BILLING_LABEL = ISRACARD_BILLING_REGEX.source.split('(')[0];

  // Header block: rows 0-8; the month/year cell is in row 2 and the billing line in row 3.
  const sheet = (dataRows, { billing = '01.05', monthCell = `${APRIL} 2025` } = {}) => [
    ['title'],
    [],
    [monthCell],
    billing ? [`${BILLING_LABEL}${billing}`] : [],
    [], [], [], [], [],
    ...dataRows,
  ];

  test('builds transactions with the posting date at the end of the previous month', () => {
    const rows = parseIsracardSheet(sheet([['03.04.25', 'qzxv unknown shop', '', '', 49.9]]));
    expect(rows).toEqual([
      {
        rowIndex: 0,
        transaction: {
          date: '2025-04-30',
          originalDate: '2025-04-03',
          chargeDate: '2025-05-01',
          merchant: 'qzxv unknown shop',
          category: '',
          amount: 49.9,
          amountAgorot: 4990,
          type: TYPE.EXPENSE,
          source: 'isracard',
          notes: NOTE_FILL_CATEGORY,
        },
      },
    ]);
  });

  test('falls back to the 10th of the header month when there is no billing line', () => {
    const [row] = parseIsracardSheet(sheet([['03.04.25', 'qzxv', '', '', 5]], { billing: null }));
    expect(row.transaction.chargeDate).toBe('2025-04-10');
    expect(row.transaction.date).toBe('2025-03-31');
  });

  test('a saved merchant category wins and removes the "fill category" note', () => {
    const map = new Map([['netflix', 'Mine']]);
    const [row] = parseIsracardSheet(sheet([['03.04.25', 'Netflix', '', '', 5]]), { merchantCategoryMap: map });
    expect(row.transaction.category).toBe('Mine');
    expect(row.transaction).not.toHaveProperty('notes');
  });

  test('a built-in keyword rule categorises when nothing is saved', () => {
    const [row] = parseIsracardSheet(sheet([['03.04.25', 'Netflix', '', '', 5]]));
    expect(row.transaction.category).not.toBe('');
    expect(row.transaction).not.toHaveProperty('notes');
  });

  test('amount cleaning and sign: parentheses mean income, positive means expense', () => {
    const rows = parseIsracardSheet(sheet([
      ['03.04.25', 'qzxv a', '', '', '₪1,200.50'],
      ['04.04.25', 'qzxv b', '', '', '(30.00)'],
    ]));
    expect(rows.map((r) => [r.transaction.amount, r.transaction.type])).toEqual([
      [1200.5, TYPE.EXPENSE],
      [30, TYPE.INCOME],
    ]);
  });

  test('skips rows without a date-like first cell, a merchant or a numeric amount', () => {
    const rows = parseIsracardSheet(sheet([
      ['not a date', 'skip', '', '', 5],
      ['03.04.25', '', '', '', 5],
      ['03.04.25', 'qzxv bad amount', '', '', 'abc'],
      ['03.04.25', 'qzxv kept', '', '', 5],
    ]));
    expect(rows.map((r) => [r.rowIndex, r.transaction.merchant])).toEqual([[3, 'qzxv kept']]);
  });

  test('zero and above-bound Isracard amounts are skipped with a warning', () => {
    const onWarn = jest.fn();
    const rows = parseIsracardSheet(
      sheet([
        ['03.04.25', 'qzxv zero', '', '', 0],
        ['03.04.25', 'qzxv huge', '', '', 20000000],
        ['03.04.25', 'qzxv kept', '', '', 0.1 + 0.2],
      ]),
      { onWarn }
    );
    expect(rows.map((r) => [r.transaction.merchant, r.transaction.amountAgorot])).toEqual([['qzxv kept', 30]]);
    expect(onWarn.mock.calls.map(([code, d]) => [code, d.merchant])).toEqual([
      ['invalid-amount', 'qzxv zero'],
      ['invalid-amount', 'qzxv huge'],
    ]);
  });

  test('accepts 4-digit years and slashes in row dates', () => {
    const [row] = parseIsracardSheet(sheet([['03/04/2025', 'qzxv', '', '', 5]]));
    expect(row.transaction.originalDate).toBe('2025-04-03');
  });

  test('missing month header warns and returns nothing', () => {
    const onWarn = jest.fn();
    expect(parseIsracardSheet([['no header'], [], [], []], { onWarn })).toEqual([]);
    expect(onWarn).toHaveBeenCalledWith('isracard-missing-header');
  });

  test('a header below the first 6 rows is not found', () => {
    const onWarn = jest.fn();
    const json = [[], [], [], [], [], [], [`${APRIL} 2025`]];
    expect(parseIsracardSheet(json, { onWarn })).toEqual([]);
    expect(onWarn).toHaveBeenCalledWith('isracard-missing-header');
  });

  test('an invalid header year warns with the header text', () => {
    const onWarn = jest.fn();
    const monthCell = `${APRIL} 0000`;
    expect(parseIsracardSheet(sheet([], { monthCell }), { onWarn })).toEqual([]);
    expect(onWarn).toHaveBeenCalledWith('isracard-invalid-header', monthCell);
  });
});

describe('parseMaxSheet', () => {
  const header = [['h'], ['h'], ['h'], ['h']];
  // Columns: 0 date, 1 merchant, 2 category, 5 amount, 9 charge date.
  const line = (date, merchant, category, amount, charge) =>
    [date, merchant, category, '', '', amount, '', '', '', charge];

  test('builds a transaction with the posting date at the end of the previous month', () => {
    const rows = parseMaxSheet([...header, line('2025-03-02', ' Max Shop ', ' food ', 77.5, '2025-04-10')]);
    expect(rows).toEqual([
      {
        rowIndex: 0,
        transaction: {
          date: '2025-03-31',
          originalDate: '2025-03-02',
          chargeDate: '2025-04-10',
          merchant: 'Max Shop',
          category: 'food',
          amount: 77.5,
          amountAgorot: 7750,
          type: TYPE.EXPENSE,
          source: 'max',
        },
      },
    ]);
  });

  test('accepts DD/MM/YYYY strings and Excel serial numbers for dates', () => {
    const rows = parseMaxSheet([
      ...header,
      line('03/03/2025', 'a', 'x', 1, '10/04/2025'),
      line(45717, 'b', 'x', 1, 45757),
    ]);
    expect(rows[0].transaction.chargeDate).toBe('2025-04-10');
    expect(rows[1].transaction.chargeDate).toBe('2025-04-10');
    expect(rows[1].transaction.originalDate).toBe('2025-03-01');
  });

  test('amount cleaning and sign: parentheses mean income, positive means expense', () => {
    const rows = parseMaxSheet([
      ...header,
      line('2025-03-02', 'a', 'x', '₪1,000', '2025-04-10'),
      line('2025-03-02', 'b', 'x', '(15)', '2025-04-10'),
    ]);
    expect(rows.map((r) => [r.transaction.amount, r.transaction.type])).toEqual([
      [1000, TYPE.EXPENSE],
      [15, TYPE.INCOME],
    ]);
  });

  test('skips rows with no merchant, no amount, no charge date or unparseable values', () => {
    const rows = parseMaxSheet([
      ...header,
      line('2025-03-02', '', 'x', 5, '2025-04-10'),
      line('2025-03-02', 'no amount', 'x', undefined, '2025-04-10'),
      line('2025-03-02', 'null amount', 'x', null, '2025-04-10'),
      line('2025-03-02', 'empty amount', 'x', '', '2025-04-10'),
      line('2025-03-02', 'no charge date', 'x', 5, ''),
      line('2025-03-02', 'bad amount', 'x', 'abc', '2025-04-10'),
      line('2025-03-02', 'bad charge date', 'x', 5, 'garbage'),
      line('2025-03-02', 'kept', 'x', 5, '2025-04-10'),
    ]);
    expect(rows.map((r) => [r.rowIndex, r.transaction.merchant])).toEqual([[7, 'kept']]);
  });

  test('a non-string category becomes an empty string', () => {
    const [row] = parseMaxSheet([...header, line('2025-03-02', 'a', 123, 5, '2025-04-10')]);
    expect(row.transaction.category).toBe('');
  });

  test('a charge date with an impossible month warns and skips the row', () => {
    const onWarn = jest.fn();
    const rows = parseMaxSheet([...header, line('2025-03-02', 'a', 'x', 5, '10/13/2025')], { onWarn });
    expect(rows).toEqual([]);
    expect(onWarn).toHaveBeenCalledWith('max-no-posting-date', {
      rawChargeDate: '10/13/2025',
      parsedChargeDate: '2025-13-10',
      merchant: 'a',
    });
  });

  test('zero, sub-agora and above-bound amounts are skipped with a warning', () => {
    const onWarn = jest.fn();
    const rows = parseMaxSheet(
      [
        ...header,
        line('2025-03-02', 'zero', 'x', 0, '2025-04-10'),
        line('2025-03-02', 'tiny', 'x', 0.004, '2025-04-10'),
        line('2025-03-02', 'huge', 'x', 10000000.01, '2025-04-10'),
        line('2025-03-02', 'at the bound', 'x', 10000000, '2025-04-10'),
      ],
      { onWarn }
    );
    expect(rows.map((r) => r.transaction.merchant)).toEqual(['at the bound']);
    expect(rows[0].transaction.amountAgorot).toBe(1_000_000_000);
    expect(onWarn.mock.calls.map(([code, d]) => [code, d.merchant])).toEqual([
      ['invalid-amount', 'zero'],
      ['invalid-amount', 'tiny'],
      ['invalid-amount', 'huge'],
    ]);
  });

  test('floating-point noise in the statement is rounded away', () => {
    const [row] = parseMaxSheet([...header, line('2025-03-02', 'a', 'x', 49.900000000000006, '2025-04-10')]);
    expect(row.transaction.amountAgorot).toBe(4990);
    expect(row.transaction.amount).toBe(49.9);
  });

  test('the stored amount is positive even for refunds', () => {
    const [row] = parseMaxSheet([...header, line('2025-03-02', 'a', 'x', '(15.10)', '2025-04-10')]);
    expect(row.transaction.type).toBe(TYPE.INCOME);
    expect(row.transaction.amountAgorot).toBe(1510);
  });

  test('the header rows are not parsed', () => {
    expect(parseMaxSheet(header)).toEqual([]);
  });
});
