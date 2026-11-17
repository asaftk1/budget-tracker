import { filterTransactions, hasActiveFilter, dayKey, EMPTY_FILTERS } from './filterTransactions';

const T = [
  { id: 1, date: '2025-03-01', merchant: 'Super-Pharm', category: 'Health', description: 'vitamins', amountAgorot: 100 },
  { id: 2, date: '2025-03-15', merchant: 'Shufersal', category: 'Food', amountAgorot: 200 },
  { id: 3, date: '2025-04-01', merchant: 'Netflix', category: 'Entertainment', amountAgorot: 300 },
  { id: 4, date: '2025-04-30', merchant: 'Cafe Food Court', category: 'Eating out', amountAgorot: 400 },
  // A legacy document: only the old fields, and an ISO timestamp for the date.
  { id: 5, date: '2025-05-02T21:30:00.000Z', category: 'Food', amount: 12.5 },
  { id: 6, date: 'not a date', merchant: 'Broken', category: 'Food' },
  { id: 7, merchant: 'No date at all' },
];
const ids = (list) => list.map((t) => t.id);

describe('empty filters', () => {
  test('return every transaction, undated ones included, in order', () => {
    expect(ids(filterTransactions(T, EMPTY_FILTERS))).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(ids(filterTransactions(T, undefined))).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  test('blank or whitespace-only text and category count as empty', () => {
    expect(hasActiveFilter({ text: '   ', category: ' ' })).toBe(false);
    expect(ids(filterTransactions(T, { text: '  ', category: '' }))).toHaveLength(7);
  });
  test('hasActiveFilter is true when any filter is set', () => {
    expect(hasActiveFilter({ text: 'x' })).toBe(true);
    expect(hasActiveFilter({ category: 'x' })).toBe(true);
    expect(hasActiveFilter({ from: '2025-01-01' })).toBe(true);
    expect(hasActiveFilter({ to: '2025-01-01' })).toBe(true);
  });
  test('null or missing input gives an empty list', () => {
    expect(filterTransactions(null, { text: 'x' })).toEqual([]);
    expect(filterTransactions(undefined, EMPTY_FILTERS)).toEqual([]);
  });
});

describe('free text', () => {
  test('matches merchant, ignoring case', () => {
    expect(ids(filterTransactions(T, { text: 'NETFLIX' }))).toEqual([3]);
  });
  test('matches a substring of the description', () => {
    expect(ids(filterTransactions(T, { text: 'vitam' }))).toEqual([1]);
  });
  test('matches the category too, and any field is enough', () => {
    // "food" is the category of 2, 5 and 6, and part of the merchant "Cafe Food Court" (4).
    expect(ids(filterTransactions(T, { text: 'food' }))).toEqual([2, 4, 5, 6]);
  });
  test('trims the query and ignores spacing differences in stored values', () => {
    expect(ids(filterTransactions(T, { text: '  shufersal  ' }))).toEqual([2]);
  });
  test('no match gives an empty list', () => {
    expect(filterTransactions(T, { text: 'zzz' })).toEqual([]);
  });
  test('legacy documents without merchant or description are searchable by category', () => {
    expect(ids(filterTransactions([T[4]], { text: 'food' }))).toEqual([5]);
    expect(filterTransactions([T[4]], { text: 'netflix' })).toEqual([]);
  });
  test('Hebrew text matches', () => {
    const rows = [{ id: 1, merchant: 'סופר פארם', category: 'בריאות', date: '2025-01-01' }];
    expect(ids(filterTransactions(rows, { text: 'פארם' }))).toEqual([1]);
  });
});

describe('category filter', () => {
  test('is an exact match, ignoring case and extra spaces', () => {
    expect(ids(filterTransactions(T, { category: ' food ' }))).toEqual([2, 5, 6]);
  });
  test('is not a substring match', () => {
    expect(ids(filterTransactions(T, { category: 'Eat' }))).toEqual([]);
    expect(ids(filterTransactions(T, { category: 'Eating out' }))).toEqual([4]);
  });
  test('a transaction with no category never matches', () => {
    expect(filterTransactions([T[6]], { category: 'Food' })).toEqual([]);
  });
  test('combines with text: both must match', () => {
    expect(ids(filterTransactions(T, { category: 'Food', text: 'shuf' }))).toEqual([2]);
  });
});

describe('date range', () => {
  test('both bounds are inclusive', () => {
    expect(ids(filterTransactions(T, { from: '2025-03-15', to: '2025-04-01' }))).toEqual([2, 3]);
  });
  test('from only', () => {
    expect(ids(filterTransactions(T, { from: '2025-04-01' }))).toEqual([3, 4, 5]);
  });
  test('to only', () => {
    expect(ids(filterTransactions(T, { to: '2025-03-15' }))).toEqual([1, 2]);
  });
  test('a single day when from equals to', () => {
    expect(ids(filterTransactions(T, { from: '2025-04-30', to: '2025-04-30' }))).toEqual([4]);
  });
  test('from after to matches nothing', () => {
    expect(filterTransactions(T, { from: '2025-05-01', to: '2025-01-01' })).toEqual([]);
  });
  test('compares calendar strings, so an ISO timestamp counts as its written date (no timezone shift)', () => {
    // 21:30Z is already the next day in Israel, but the stored date is 2025-05-02.
    expect(ids(filterTransactions(T, { from: '2025-05-02', to: '2025-05-02' }))).toEqual([5]);
    expect(filterTransactions(T, { from: '2025-05-03' })).toEqual([]);
  });
  test('transactions with a missing or invalid date never match a date bound', () => {
    const result = ids(filterTransactions(T, { from: '1900-01-01', to: '2999-12-31' }));
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });
  test('combines with category', () => {
    expect(ids(filterTransactions(T, { category: 'Food', from: '2025-04-01' }))).toEqual([5]);
  });
});

describe('dayKey', () => {
  test('reads plain dates and ISO timestamps', () => {
    expect(dayKey('2025-03-05')).toBe('2025-03-05');
    expect(dayKey('2025-03-05T23:59:59.000Z')).toBe('2025-03-05');
  });
  test('returns null for anything else', () => {
    for (const v of [undefined, null, '', 'x', 20250305, '2025-3-5', '03/05/2025', '2025-03-055']) {
      expect(dayKey(v)).toBeNull();
    }
  });
});
