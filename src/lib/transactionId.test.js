import { buildTransactionId, chunk, MAX_BATCH_SIZE } from './transactionId';

const base = {
  uid: 'user-1',
  source: 'isracard',
  date: '2025-02-28',
  merchant: 'Some Shop',
  amount: 12.5,
  rowKey: 'Sheet1#3',
};

describe('buildTransactionId', () => {
  test('same input gives the same id (re-import overwrites instead of duplicating)', () => {
    expect(buildTransactionId(base)).toBe(buildTransactionId({ ...base }));
  });

  test('amount formatting does not change the id', () => {
    expect(buildTransactionId({ ...base, amount: 12.5 })).toBe(buildTransactionId({ ...base, amount: '12.50' }));
  });

  test.each([
    ['uid', { uid: 'user-2' }],
    ['source', { source: 'max' }],
    ['date', { date: '2025-03-31' }],
    ['merchant', { merchant: 'Other Shop' }],
    ['amount', { amount: 12.51 }],
    ['rowKey', { rowKey: 'Sheet1#4' }],
  ])('a different %s gives a different id', (_name, change) => {
    expect(buildTransactionId({ ...base, ...change })).not.toBe(buildTransactionId(base));
  });

  test('field boundaries cannot be confused', () => {
    const a = buildTransactionId({ ...base, merchant: 'ab', rowKey: 'c' });
    const b = buildTransactionId({ ...base, merchant: 'a', rowKey: 'bc' });
    expect(a).not.toBe(b);
  });

  test('is a valid Firestore document id', () => {
    const id = buildTransactionId(base);
    expect(id).toMatch(/^[a-z0-9_]+$/);
    expect(id.length).toBeLessThan(64);
    expect(id.startsWith('__')).toBe(false);
  });

  test('is stable across many rows without collisions', () => {
    const ids = new Set();
    for (let i = 0; i < 5000; i += 1) {
      ids.add(buildTransactionId({ ...base, rowKey: `Sheet1#${i}` }));
    }
    expect(ids.size).toBe(5000);
  });
});

describe('chunk', () => {
  const range = (n) => Array.from({ length: n }, (_, i) => i);

  test('splits into groups of at most 500 by default', () => {
    const groups = chunk(range(1200));
    expect(groups.map((g) => g.length)).toEqual([500, 500, 200]);
    expect(MAX_BATCH_SIZE).toBe(500);
  });

  test('exactly 500 items is a single group', () => {
    expect(chunk(range(500)).map((g) => g.length)).toEqual([500]);
  });

  test('501 items is two groups', () => {
    expect(chunk(range(501)).map((g) => g.length)).toEqual([500, 1]);
  });

  test('empty input gives no groups', () => {
    expect(chunk([])).toEqual([]);
  });

  test('keeps order and every item', () => {
    expect(chunk(range(7), 3)).toEqual([[0, 1, 2], [3, 4, 5], [6]]);
  });
});
