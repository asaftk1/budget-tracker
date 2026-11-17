import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Dashboard from './Dashboard';
import AnalyticsPage from './AnalyticsPage';
import { TYPE } from '../constants';
import { DataProvider } from '../contexts/DataContext';

let mockDocs = [];

jest.mock('../firebase', () => ({ db: {} }));
jest.mock('firebase/auth', () => ({ getAuth: () => ({ currentUser: { uid: 'u1' } }) }));
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
jest.mock('firebase/firestore', () => ({
  collection: () => ({}),
  where: () => ({}),
  query: () => ({}),
  onSnapshot: (q, cb) => {
    cb({ docs: mockDocs.map((d) => ({ id: d.id, data: () => d })) });
    return () => {};
  },
}));
// Charts need a real layout; the totals and lists under test are plain DOM.
jest.mock('recharts', () => {
  const Passthrough = ({ children }) => <div>{children}</div>;
  return new Proxy({}, { get: () => Passthrough });
});

const plain = (s) => s.replace(/[‎‏]/g, '').replace(/ /g, ' ');
const month = new Date().toISOString().slice(0, 7);
const day = (d) => `${month}-${String(d).padStart(2, '0')}`;

async function render(Page) {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => { createRoot(container).render(<DataProvider><Page /></DataProvider>); });
  return plain(container.textContent);
}

describe('Dashboard money display', () => {
  test('totals are exact sums of legacy and new documents, formatted in Hebrew ILS', async () => {
    mockDocs = [
      { id: '1', type: TYPE.INCOME, date: day(1), category: 'pay', amount: 0.1 },
      { id: '2', type: TYPE.INCOME, date: day(2), category: 'pay', amount: 0.2 },
      { id: '3', type: TYPE.EXPENSE, date: day(3), category: 'food', amountAgorot: 5, amount: 0.05 },
      { id: '4', type: TYPE.INCOME, date: day(4), category: 'pay', amountAgorot: 5992173 },
    ];
    const text = await render(Dashboard);
    expect(text).toContain('59,922.03 ₪'); // income: 10 + 20 + 5,992,173 agorot
    expect(text).toContain('0.05 ₪'); // expense
    expect(text).toContain('59,921.98 ₪'); // balance: income minus 5 agorot
  });

  test('a hundred charges of 0.10 add up to exactly 10.00', async () => {
    mockDocs = Array.from({ length: 100 }, (_, i) => ({
      id: `e${i}`, type: TYPE.EXPENSE, date: day(5), category: 'x', amount: 0.1,
    }));
    const text = await render(Dashboard);
    expect(text).toContain('10.00 ₪');
    expect(text).not.toContain('9.99');
    expect(text).not.toContain('10.0000');
  });

  test('recent transactions show a sign and the formatted amount', async () => {
    mockDocs = [{ id: 'r1', type: TYPE.EXPENSE, date: day(7), category: 'food', amountAgorot: 1999 }];
    const text = await render(Dashboard);
    expect(text).toContain('-19.99 ₪');
  });

  test('documents with an unusable amount count as zero', async () => {
    mockDocs = [{ id: 'b1', type: TYPE.EXPENSE, date: day(7), category: 'food', amount: 'abc' }];
    const text = await render(Dashboard);
    expect(text).toContain('0.00 ₪');
    expect(text).not.toContain('NaN');
  });
});

describe('Analytics money display', () => {
  test('category totals, the grand total and percentages use exact agorot', async () => {
    mockDocs = [
      { id: 'a1', type: TYPE.EXPENSE, date: day(1), category: 'a', amount: 0.1 },
      { id: 'a2', type: TYPE.EXPENSE, date: day(2), category: 'a', amount: 0.2 },
      { id: 'b1', type: TYPE.EXPENSE, date: day(3), category: 'b', amountAgorot: 505 },
    ];
    const text = await render(AnalyticsPage);
    expect(text).toContain('5.35 ₪'); // total: 30 + 505 agorot
    expect(text).toContain('0.30 ₪');
    expect(text).toContain('5.05 ₪');
    expect(text).toContain('5.6%');
    expect(text).toContain('94.4%');
  });

  test('uncategorised expenses are grouped under one label', async () => {
    mockDocs = [
      { id: 'u1', type: TYPE.EXPENSE, date: day(1), category: '', amount: 1 },
      { id: 'u2', type: TYPE.EXPENSE, date: day(2), amount: 2 },
    ];
    const text = await render(AnalyticsPage);
    expect(text).toContain('3.00 ₪');
  });
});

describe('Analytics form labels', () => {
  test('the two date filters are labelled', async () => {
    mockDocs = [];
    await render(AnalyticsPage);
    for (const id of ['analytics-from', 'analytics-to']) {
      const label = document.body.querySelector(`label[for=${id}]`);
      expect(label).not.toBeNull();
      expect(document.getElementById(id).tagName).toBe('INPUT');
    }
  });
});
