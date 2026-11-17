import { buildSuggestions } from './useSuggestions';
import { TX_TYPE } from '../lib/statementParsers';

const exp = (date, category, amount, extra = {}) => ({ type: TX_TYPE.EXPENSE, date, category, amount, ...extra });
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
      { type: TX_TYPE.INCOME, date: '2025-01-01', category: 'fee', amount: 5000 },
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
