import { buildSuggestions, findRecurringCharges } from './useSuggestions';
import { TYPE } from '../constants';

const exp = (date, category, amount, extra = {}) => ({ type: TYPE.EXPENSE, date, category, amount, ...extra });
const digits = (s) => s.replace(/\D/g, '');

describe('buildSuggestions', () => {
  test('no transactions means no suggestions', () => {
    expect(buildSuggestions([])).toEqual([]);
    expect(buildSuggestions()).toEqual([]);
  });

  test('a category charged in three different months is flagged with its exact monthly average', () => {
    const result = buildSuggestions([
      exp('2025-01-10', 'gym', 99.9),
      exp('2025-02-10', 'gym', 99.9),
      exp('2025-03-10', 'gym', 99.9),
    ]);
    const sub = result.find((s) => s.kind === 'subscription');
    expect(sub).toBeDefined();
    expect(sub.meta.avgMonthly).toBeCloseTo(99.9, 10);
    expect(sub.score).toBe(100);
    expect(digits(sub.detail)).toContain('100'); // whole shekels, rounded
  });

  test('two months are not enough for a subscription', () => {
    const result = buildSuggestions([exp('2025-01-10', 'gym', 50), exp('2025-02-10', 'gym', 50)]);
    expect(result.find((s) => s.kind === 'subscription')).toBeUndefined();
  });

  test('a 40% month-over-month rise above 200 ILS is a spike', () => {
    const result = buildSuggestions([exp('2025-01-10', 'food', 100), exp('2025-02-10', 'food', 300)]);
    const spike = result.find((s) => s.kind === 'mom_spike');
    expect(spike).toBeDefined();
    expect(spike.meta.currVal).toBe(300);
    expect(spike.meta.prevVal).toBe(100);
    expect(spike.meta.pct).toBeCloseTo(200, 10);
    expect(spike.score).toBe(30);
  });

  test('a rise below 200 ILS or below 40% is not a spike', () => {
    expect(buildSuggestions([exp('2025-01-10', 'a', 50), exp('2025-02-10', 'a', 150)]).some((s) => s.kind === 'mom_spike')).toBe(false);
    expect(buildSuggestions([exp('2025-01-10', 'b', 1000), exp('2025-02-10', 'b', 1300)]).some((s) => s.kind === 'mom_spike')).toBe(false);
    expect(buildSuggestions([exp('2025-01-10', 'c', 500), exp('2025-02-10', 'c', 700)]).some((s) => s.kind === 'mom_spike')).toBe(true);
  });

  test('the spike threshold sits exactly at 200 ILS', () => {
    const at = buildSuggestions([exp('2025-01-10', 'a', 100), exp('2025-02-10', 'a', 200)]);
    const below = buildSuggestions([exp('2025-01-10', 'a', 100), exp('2025-02-10', 'a', 199.99)]);
    expect(at.some((s) => s.kind === 'mom_spike')).toBe(true);
    expect(below.some((s) => s.kind === 'mom_spike')).toBe(false);
  });

  test('big purchases need to be at least 500 ILS and in the top decile, largest first, max 3', () => {
    const items = [
      exp('2025-01-01', 'a', 600),
      exp('2025-01-02', 'b', 900),
      exp('2025-01-03', 'c', 700),
      exp('2025-01-04', 'd', 800),
      // 26 small purchases make 30 in total, so the 90th percentile is the second-largest of the four big ones.
      ...Array.from({ length: 26 }, (_, i) => exp(`2025-02-${String(1 + i).padStart(2, '0')}`, `small${i}`, 20)),
    ];
    const big = buildSuggestions(items).filter((s) => s.kind === 'big_one');
    expect(big.map((s) => s.meta.amount)).toEqual([900, 800, 700]);
  });

  test('a purchase just under 500 ILS is not a big purchase', () => {
    const big = buildSuggestions([exp('2025-01-01', 'a', 499.99), exp('2025-01-02', 'b', 10)]).filter((s) => s.kind === 'big_one');
    expect(big).toHaveLength(0);
  });

  test('fee-like categories are flagged', () => {
    const fees = buildSuggestions([exp('2025-01-01', 'bank fee', 12)]).filter((s) => s.kind === 'fees');
    expect(fees).toHaveLength(1);
    expect(fees[0].meta.amount).toBe(12);
  });

  test('income is ignored', () => {
    const items = [
      { type: TYPE.INCOME, date: '2025-01-01', category: 'fee', amount: 5000 },
    ];
    expect(buildSuggestions(items)).toEqual([]);
  });

  test('new documents (amountAgorot) and legacy documents give the same suggestions', () => {
    const legacy = [exp('2025-01-10', 'food', 100.1), exp('2025-02-10', 'food', 300.2), exp('2025-03-10', 'food', 700.3)];
    const modern = legacy.map((t) => ({ ...t, amount: undefined, amountAgorot: Math.round(t.amount * 100) }));
    expect(buildSuggestions(modern)).toEqual(buildSuggestions(legacy));
  });

  test('amountAgorot wins over a conflicting legacy amount', () => {
    const items = [
      exp('2025-01-10', 'gym', 1, { amountAgorot: 9990 }),
      exp('2025-02-10', 'gym', 1, { amountAgorot: 9990 }),
      exp('2025-03-10', 'gym', 1, { amountAgorot: 9990 }),
    ];
    expect(buildSuggestions(items).find((s) => s.kind === 'subscription').meta.avgMonthly).toBeCloseTo(99.9, 10);
  });

  test('float noise does not change the totals (0.1 + 0.2 per month)', () => {
    const items = [
      exp('2025-01-10', 'x', 0.1), exp('2025-01-11', 'x', 0.2),
      exp('2025-02-10', 'x', 0.1), exp('2025-02-11', 'x', 0.2),
      exp('2025-03-10', 'x', 0.1), exp('2025-03-11', 'x', 0.2),
    ];
    expect(buildSuggestions(items).find((s) => s.kind === 'subscription').meta.avgMonthly).toBe(0.3);
  });

  test('documents without a usable amount count as zero and never break the result', () => {
    const items = [exp('2025-01-10', 'x', 'abc'), exp('2025-02-10', 'x', undefined), exp('2025-03-10', 'x', NaN)];
    expect(() => buildSuggestions(items)).not.toThrow();
  });
});

describe('recurring charge detection (F11)', () => {
  const sub = (items) => buildSuggestions(items).filter((x) => x.kind === 'subscription');
  const charge = (date, merchant, amount, extra = {}) => exp(date, extra.category ?? 'misc', amount, { merchant });

  test('a merchant billed the same amount in three months is a subscription, titled with the merchant', () => {
    const result = sub([
      charge('2025-01-05', 'Netflix', 49.9, { category: 'fun' }),
      charge('2025-02-05', 'Netflix', 49.9, { category: 'fun' }),
      charge('2025-03-05', 'Netflix', 49.9, { category: 'fun' }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toContain('Netflix');
    expect(result[0].meta.merchant).toBe('Netflix');
    expect(result[0].meta.avgMonthly).toBeCloseTo(49.9, 10);
  });

  test('different merchants in one category are not mistaken for one subscription', () => {
    // The old logic grouped by category and flagged "food" as a recurring charge.
    const result = sub([
      charge('2025-01-05', 'Shop A', 80, { category: 'food' }),
      charge('2025-02-05', 'Shop B', 90, { category: 'food' }),
      charge('2025-03-05', 'Shop C', 85, { category: 'food' }),
      charge('2025-04-05', 'Shop D', 88, { category: 'food' }),
    ]);
    expect(result).toHaveLength(0);
  });

  test('the same merchant under different categories still counts as one', () => {
    const result = sub([
      charge('2025-01-05', 'Gym', 200, { category: 'health' }),
      charge('2025-02-05', 'Gym', 200, { category: 'sport' }),
      charge('2025-03-05', 'Gym', 200, { category: 'misc' }),
    ]);
    expect(result).toHaveLength(1);
  });

  test('merchant names are matched ignoring case and surrounding spaces', () => {
    const result = sub([
      charge('2025-01-05', 'Spotify', 20),
      charge('2025-02-05', ' SPOTIFY ', 20),
      charge('2025-03-05', 'spotify', 20),
    ]);
    expect(result).toHaveLength(1);
  });

  test('a merchant with wildly different monthly totals is not a subscription (groceries)', () => {
    expect(sub([
      charge('2025-01-05', 'Supermarket', 120),
      charge('2025-02-05', 'Supermarket', 480),
      charge('2025-03-05', 'Supermarket', 90),
      charge('2025-04-05', 'Supermarket', 310),
    ])).toHaveLength(0);
  });

  test('amounts within 10% of the typical month count as similar', () => {
    expect(sub([
      charge('2025-01-05', 'Phone', 100),
      charge('2025-02-05', 'Phone', 105),
      charge('2025-03-05', 'Phone', 110),
    ])).toHaveLength(1);
  });

  test('amounts further than 10% apart do not', () => {
    expect(sub([
      charge('2025-01-05', 'X', 100),
      charge('2025-02-05', 'X', 150),
      charge('2025-03-05', 'X', 200),
    ])).toHaveLength(0);
  });

  test('one outlier month is ignored: the average covers the similar months only', () => {
    const result = sub([
      charge('2025-01-05', 'Cloud', 100),
      charge('2025-02-05', 'Cloud', 100),
      charge('2025-03-05', 'Cloud', 100),
      charge('2025-04-05', 'Cloud', 160), // a one-off extra charge
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].meta.avgMonthly).toBe(100);
  });

  test('two similar months plus an outlier are not enough', () => {
    expect(sub([
      charge('2025-01-05', 'Y', 100),
      charge('2025-02-05', 'Y', 100),
      charge('2025-03-05', 'Y', 400),
    ])).toHaveLength(0);
  });

  test('small subscriptions get a 5 ILS tolerance floor', () => {
    expect(sub([
      charge('2025-01-05', 'App', 10),
      charge('2025-02-05', 'App', 12),
      charge('2025-03-05', 'App', 14.5),
    ])).toHaveLength(1);
    expect(sub([
      charge('2025-01-05', 'App2', 10),
      charge('2025-02-05', 'App2', 12),
      charge('2025-03-05', 'App2', 20),
    ])).toHaveLength(0);
  });

  test('several charges in one month are summed before comparing', () => {
    const result = sub([
      charge('2025-01-05', 'Parking', 30), charge('2025-01-20', 'Parking', 30),
      charge('2025-02-06', 'Parking', 60),
      charge('2025-03-07', 'Parking', 20), charge('2025-03-25', 'Parking', 40),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].meta.avgMonthly).toBe(60);
  });

  test('without a merchant (manual entries) the category is used', () => {
    const result = sub([
      exp('2025-01-01', 'Rent', 3500),
      exp('2025-02-01', 'Rent', 3500),
      exp('2025-03-01', 'Rent', 3500),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].meta.merchant).toBe('Rent');
  });

  test('transactions with neither merchant nor category are ignored', () => {
    expect(sub([
      { type: TYPE.EXPENSE, date: '2025-01-01', amount: 50 },
      { type: TYPE.EXPENSE, date: '2025-02-01', amount: 50 },
      { type: TYPE.EXPENSE, date: '2025-03-01', amount: 50 },
    ])).toHaveLength(0);
  });

  test('invalid dates no longer count as a month', () => {
    expect(sub([
      charge('2025-01-05', 'Z', 50),
      charge('2025-02-05', 'Z', 50),
      charge('garbage', 'Z', 50),
      charge('', 'Z', 50),
    ])).toHaveLength(0);
  });

  test('income and zero-amount months never make a subscription', () => {
    expect(sub([
      { type: TYPE.INCOME, date: '2025-01-01', merchant: 'Boss', amount: 5000 },
      { type: TYPE.INCOME, date: '2025-02-01', merchant: 'Boss', amount: 5000 },
      { type: TYPE.INCOME, date: '2025-03-01', merchant: 'Boss', amount: 5000 },
      charge('2025-01-05', 'Free', 0), charge('2025-02-05', 'Free', 0), charge('2025-03-05', 'Free', 0),
    ])).toHaveLength(0);
  });

  test('works for new documents (amountAgorot) exactly like legacy ones', () => {
    const legacy = ['2025-01-05', '2025-02-05', '2025-03-05'].map((d) => charge(d, 'Netflix', 49.9));
    const modern = legacy.map((t) => ({ ...t, amount: undefined, amountAgorot: 4990 }));
    expect(sub(modern)).toEqual(sub(legacy));
  });

  test('findRecurringCharges reports how many months were similar', () => {
    const found = findRecurringCharges([
      charge('2025-01-05', 'Cloud', 100),
      charge('2025-02-05', 'Cloud', 100),
      charge('2025-03-05', 'Cloud', 100),
      charge('2025-04-05', 'Cloud', 400),
    ]);
    expect(found).toEqual([{ label: 'Cloud', avgAgorot: 10000, months: 3 }]);
  });
});
