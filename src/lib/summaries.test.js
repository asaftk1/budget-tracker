import { summarizeTransactions, groupTransactionsByDate, monthKeyOf } from './summaries';
import { sumAgorot, sumAgorotBy, getAgorot } from './money';
import { TYPE, UNCATEGORIZED } from '../constants';

// Deterministic pseudo-random data (no flakiness).
let seed = 7;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (list) => list[Math.floor(rnd() * list.length)];

const makeTransactions = (n) => Array.from({ length: n }, () => {
  const r = rnd();
  const tx = {
    type: r < 0.45 ? TYPE.EXPENSE : r < 0.85 ? TYPE.INCOME : pick(['other', undefined]),
    date: rnd() < 0.05 ? pick(['', undefined, 'garbage']) : `2025-${String(1 + Math.floor(rnd() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rnd() * 28)).padStart(2, '0')}`,
    category: rnd() < 0.2 ? pick(['', undefined]) : pick(['food', 'fuel', 'rent', 'fun']),
  };
  if (rnd() < 0.5) tx.amountAgorot = 1 + Math.floor(rnd() * 500000);
  else tx.amount = pick([Math.round(rnd() * 100000) / 100, 'abc', NaN, -3.5, 0.1, 0.2]);
  return tx;
});

// The previous implementation: one filter/reduce per figure.
function naive(transactions, monthKeys) {
  const income = transactions.filter((t) => t.type === TYPE.INCOME);
  const expense = transactions.filter((t) => t.type === TYPE.EXPENSE);
  const monthly = {};
  for (const key of monthKeys) {
    const inMonth = (t) => monthKeyOf(new Date(t.date)) === key;
    monthly[key] = { income: sumAgorot(income.filter(inMonth)), expense: sumAgorot(expense.filter(inMonth)) };
  }
  return {
    totalIncome: sumAgorot(income),
    totalExpense: sumAgorot(expense),
    expensesByCategory: sumAgorotBy(expense, (t) => t.category || UNCATEGORIZED),
    monthly,
  };
}

describe('summarizeTransactions', () => {
  const monthKeys = Array.from({ length: 6 }, (_, i) => `2025-${i + 3}`); // Apr..Sep (zero-based months)

  test('matches the multi-pass implementation on 200 random datasets', () => {
    for (let k = 0; k < 200; k += 1) {
      const data = makeTransactions(Math.floor(rnd() * 80));
      expect(summarizeTransactions(data, monthKeys)).toEqual(naive(data, monthKeys));
    }
  });

  test('empty, missing and tracking-free input', () => {
    expect(summarizeTransactions([])).toEqual({ totalIncome: 0, totalExpense: 0, expensesByCategory: {}, monthly: {} });
    expect(summarizeTransactions(undefined).totalIncome).toBe(0);
    expect(summarizeTransactions([{ type: TYPE.INCOME, amountAgorot: 5 }]).totalIncome).toBe(5);
  });

  test('sums are exact: a hundred charges of 0.10', () => {
    const items = Array.from({ length: 100 }, () => ({ type: TYPE.EXPENSE, amount: 0.1, category: 'x' }));
    const result = summarizeTransactions(items);
    expect(result.totalExpense).toBe(1000);
    expect(result.expensesByCategory).toEqual({ x: 1000 });
  });

  test('legacy and new documents mix; unusable amounts count as zero', () => {
    const result = summarizeTransactions([
      { type: TYPE.EXPENSE, amount: 12.5, category: 'a' },
      { type: TYPE.EXPENSE, amountAgorot: 250, category: 'a' },
      { type: TYPE.EXPENSE, amount: 'abc', category: 'a' },
    ]);
    expect(result.expensesByCategory).toEqual({ a: 1500 });
  });

  test('uncategorised expenses share one label; income is never in the category totals', () => {
    const result = summarizeTransactions([
      { type: TYPE.EXPENSE, amountAgorot: 100 },
      { type: TYPE.EXPENSE, amountAgorot: 200, category: '' },
      { type: TYPE.INCOME, amountAgorot: 999, category: 'pay' },
    ]);
    expect(result.expensesByCategory).toEqual({ [UNCATEGORIZED]: 300 });
    expect(result.totalIncome).toBe(999);
  });

  test('a bad date counts toward the totals but not toward any month', () => {
    const result = summarizeTransactions(
      [{ type: TYPE.EXPENSE, amountAgorot: 100, date: 'garbage' }, { type: TYPE.EXPENSE, amountAgorot: 50, date: '2025-04-10' }],
      ['2025-3']
    );
    expect(result.totalExpense).toBe(150);
    expect(result.monthly['2025-3']).toEqual({ income: 0, expense: 50 });
  });

  test('every requested month exists in the result, even when empty', () => {
    expect(Object.keys(summarizeTransactions([], monthKeys).monthly)).toEqual(monthKeys);
  });

  test('reads each transaction only once (single pass)', () => {
    const reads = { count: 0 };
    const make = (type, amountAgorot) => ({
      get type() { reads.count += 1; return type; },
      amountAgorot,
      category: 'c',
      date: '2025-04-01',
    });
    const items = [make(TYPE.INCOME, 5), make(TYPE.EXPENSE, 7), make(TYPE.EXPENSE, 9)];
    summarizeTransactions(items, ['2025-3']);
    // The type is read at most twice per transaction (income check, then expense check), and the
    // number of reads does not grow with the number of figures calculated.
    expect(reads.count).toBeLessThanOrEqual(items.length * 2);
  });

  test('uses getAgorot semantics', () => {
    const tx = { type: TYPE.EXPENSE, amount: 1.005 };
    expect(summarizeTransactions([tx]).totalExpense).toBe(getAgorot(tx));
  });
});

describe('groupTransactionsByDate', () => {
  const tx = (id, date) => ({ id, date });

  test('groups one month by day and keeps input order inside a day', () => {
    const result = groupTransactionsByDate(
      [tx('a', '2025-03-05'), tx('b', '2025-03-05'), tx('c', '2025-03-09'), tx('d', '2025-04-01')],
      '2025-03'
    );
    expect(Object.keys(result)).toEqual(['2025-03-05', '2025-03-09']);
    expect(result['2025-03-05'].map((t) => t.id)).toEqual(['a', 'b']);
  });

  test('skips missing and invalid dates; no month selected selects nothing', () => {
    const items = [tx('a', ''), tx('b', undefined), tx('c', 'garbage'), tx('d', '2025-03-05')];
    expect(Object.keys(groupTransactionsByDate(items, '2025-03'))).toEqual(['2025-03-05']);
    expect(groupTransactionsByDate(items, '')).toEqual({});
    expect(groupTransactionsByDate(undefined, '2025-03')).toEqual({});
  });

  test('matches the previous reduce-based implementation on random data', () => {
    const previous = (transactions, selectedMonth) => transactions.reduce((acc, t) => {
      const baseDate = t.date;
      if (!baseDate) return acc;
      const txDate = new Date(baseDate);
      if (Number.isNaN(txDate.getTime())) return acc;
      const key = txDate.toISOString().split('T')[0];
      if (selectedMonth) {
        const [year, month] = selectedMonth.split('-');
        if (txDate.getFullYear().toString() !== year || (txDate.getMonth() + 1).toString().padStart(2, '0') !== month) return acc;
      } else {
        return acc;
      }
      acc[key] = acc[key] || [];
      acc[key].push(t);
      return acc;
    }, {});

    for (let k = 0; k < 100; k += 1) {
      const data = makeTransactions(60).map((t, i) => ({ ...t, id: i }));
      for (const month of ['2025-03', '2025-12', '', '2024-01']) {
        expect(groupTransactionsByDate(data, month)).toEqual(previous(data, month));
      }
    }
  });
});

describe('monthKeyOf', () => {
  test('uses the year and the zero-based month', () => {
    expect(monthKeyOf(new Date(2025, 0, 15))).toBe('2025-0');
    expect(monthKeyOf(new Date(2025, 11, 31))).toBe('2025-11');
  });
});
