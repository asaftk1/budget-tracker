import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import TransactionsPage from './TransactionsPage';
import useTransactions, { commitTransactions } from '../hooks/useTransactions';
import { parseMaxSheet } from '../lib/statementParsers';
import { getAuth } from 'firebase/auth';
import * as XLSX from 'xlsx';
import { groupTransactionsByDate } from '../lib/summaries';

// A spy around the real function. (CRA resets mock implementations before each test, so the real
// one is put back in beforeEach.)
jest.mock('../lib/summaries', () => ({
  ...jest.requireActual('../lib/summaries'),
  groupTransactionsByDate: jest.fn(),
}));
jest.mock('xlsx', () => ({
  read: jest.fn(() => ({ SheetNames: ['s1'], Sheets: { s1: {} } })),
  utils: { sheet_to_json: jest.fn(() => [['h'], ['row']]) },
}));
jest.mock('../lib/statementParsers', () => ({ parseIsracardSheet: jest.fn(), parseMaxSheet: jest.fn() }));
jest.mock('firebase/auth', () => ({ getAuth: jest.fn(() => ({ currentUser: { uid: 'u1' } })) }));
jest.mock('../hooks/useTransactions', () => ({
  __esModule: true,
  default: jest.fn(),
  loadMerchantCategoryMap: jest.fn(),
  commitTransactions: jest.fn(),
}));

let hook;

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = '';
  hook = {
    transactions: [],
    categories: ['food'],
    saveTransaction: jest.fn().mockResolvedValue(true),
    deleteTransaction: jest.fn(),
    updateTransactionCategory: jest.fn(),
  };
  useTransactions.mockReturnValue(hook);
  groupTransactionsByDate.mockImplementation(jest.requireActual('../lib/summaries').groupTransactionsByDate);
});

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const buttonWith = (text) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.includes(text));
const setInput = (el, value) => act(async () => {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});

async function openAddForm() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => { createRoot(container).render(<TransactionsPage />); });
  await click(buttonWith('➕'));
  await click(buttonWith('💸'));
  await setInput(document.body.querySelector('input[name=date]'), '2025-03-05');
  await setInput(document.body.querySelector('input[name=category]'), 'food');
}
const submit = async () => {
  await act(async () => {
    document.body.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await flush();
};
const amountInput = () => document.body.querySelector('input[name=amount]');

describe('add form amount validation', () => {
  test.each([['', 'empty'], ['0', 'zero'], ['-5', 'negative'], ['abc', 'text'], ['10000000.01', 'above the bound']])(
    'rejects %p (%s) with a visible error and saves nothing',
    async (value) => {
      await openAddForm();
      await setInput(amountInput(), value);
      await submit();
      const alert = document.body.querySelector('[role=alert]');
      expect(alert).not.toBeNull();
      expect(alert.textContent.length).toBeGreaterThan(0);
      expect(hook.saveTransaction).not.toHaveBeenCalled();
    }
  );

  test('different problems give different messages', async () => {
    await openAddForm();
    const messages = [];
    for (const value of ['', '0', '10000000.01']) {
      await setInput(amountInput(), value);
      await submit();
      messages.push(document.body.querySelector('[role=alert]').textContent);
    }
    expect(new Set(messages).size).toBe(3);
  });

  test('the error disappears as soon as the amount is edited', async () => {
    await openAddForm();
    await setInput(amountInput(), '0');
    await submit();
    expect(document.body.querySelector('[role=alert]')).not.toBeNull();
    await setInput(amountInput(), '5');
    expect(document.body.querySelector('[role=alert]')).toBeNull();
  });

  test('a valid amount is saved and the dialog closes', async () => {
    await openAddForm();
    await setInput(amountInput(), '12.5');
    await submit();
    expect(hook.saveTransaction).toHaveBeenCalledTimes(1);
    const arg = hook.saveTransaction.mock.calls[0][0];
    expect(arg.formData).toEqual({ date: '2025-03-05', category: 'food', amount: '12.5' });
    expect(document.body.querySelector('form')).toBeNull();
  });

  test('the upper bound itself is accepted', async () => {
    await openAddForm();
    await setInput(amountInput(), '10000000');
    await submit();
    expect(hook.saveTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('failed writes', () => {
  beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); });

  test('a failed save keeps the dialog open and the form as typed, with a Hebrew error', async () => {
    hook.saveTransaction.mockRejectedValue(new Error('offline'));
    await openAddForm();
    await setInput(amountInput(), '12.5');
    await submit();
    expect(document.body.querySelector('form')).not.toBeNull();
    expect(amountInput().value).toBe('12.5');
    expect(document.body.querySelector('input[name=category]').value).toBe('food');
    expect(document.body.querySelector('[role=alert]').textContent).toContain('השמירה נכשלה');
  });

  test('after a failure, retrying and succeeding closes the dialog', async () => {
    hook.saveTransaction.mockRejectedValueOnce(new Error('offline'));
    await openAddForm();
    await setInput(amountInput(), '12.5');
    await submit();
    await submit();
    expect(hook.saveTransaction).toHaveBeenCalledTimes(2);
    expect(document.body.querySelector('form')).toBeNull();
  });

  test('a failed delete shows an inline error and does not use alert()', async () => {
    window.alert = jest.fn();
    hook.transactions = [{ id: 't1', date: new Date().toISOString().slice(0, 10), type: 'expense', category: 'food', amountAgorot: 100 }];
    hook.deleteTransaction.mockRejectedValue(new Error('offline'));
    const container = document.createElement('div');
    document.body.appendChild(container);
    await act(async () => { createRoot(container).render(<TransactionsPage />); });
    await click(document.body.querySelector('[aria-label*="מחק"]'));
    await click(document.body.querySelector('.confirm'));
    await flush();
    expect(document.body.querySelector('[role=alert]').textContent).toContain('מחיקת הפעולה נכשלה');
    expect(window.alert).not.toHaveBeenCalled();
  });
});

describe('search', () => {
  const thisMonth = new Date().toISOString().slice(0, 10);
  const otherMonth = '2020-02-10';
  const rows = () => [
    { id: 't1', date: thisMonth, type: 'expense', category: 'food', merchant: 'Shufersal', amountAgorot: 100 },
    { id: 't2', date: otherMonth, type: 'expense', category: 'fun', merchant: 'Netflix', amountAgorot: 200 },
    { id: 't3', date: otherMonth, type: 'expense', category: 'food', merchant: 'Cafe', amountAgorot: 300 },
  ];
  const merchants = () => [...document.body.querySelectorAll('tbody tr td:first-child')].map((td) => td.textContent);
  const status = () => document.body.querySelector('[role=status]');

  async function renderPage() {
    hook.transactions = rows();
    const container = document.createElement('div');
    document.body.appendChild(container);
    await act(async () => { createRoot(container).render(<TransactionsPage />); });
  }
  const openSearch = () => click(buttonWith('🔍'));

  test('without a search it shows the selected month only, with no indicator', async () => {
    await renderPage();
    expect(merchants()).toEqual(['Shufersal']);
    expect(status()).toBeNull();
    expect(document.body.querySelector('#selected-month').disabled).toBe(false);
  });

  test('typing searches all months, shows the indicator and disables the month picker', async () => {
    await renderPage();
    await openSearch();
    await setInput(document.body.querySelector('#search-text'), 'netflix');
    expect(merchants()).toEqual(['Netflix']);
    expect(status().textContent).toContain('מכל החודשים');
    expect(document.body.querySelector('#selected-month').disabled).toBe(true);
  });

  test('category and date range filters apply, newest day first', async () => {
    await renderPage();
    await openSearch();
    await setInput(document.body.querySelector('#search-category'), 'food');
    expect(merchants()).toEqual(['Shufersal', 'Cafe']);
    await setInput(document.body.querySelector('#search-to'), '2021-01-01');
    expect(merchants()).toEqual(['Cafe']);
  });

  test('searching never touches the add form data', async () => {
    await renderPage();
    await openSearch();
    await setInput(document.body.querySelector('#search-category'), 'food');
    await click(document.body.querySelector('[role=dialog] button[aria-label], [role=dialog] button'));
    // The add form starts empty even after a category was typed into the search.
    await click(buttonWith('➕ הוסף'));
    await click(buttonWith('💸'));
    expect(document.body.querySelector('input[name=category]').value).toBe('');
  });

  test('no results shows a message; clear search returns to the monthly view', async () => {
    await renderPage();
    await openSearch();
    await setInput(document.body.querySelector('#search-text'), 'zzz');
    expect(merchants()).toEqual([]);
    expect(document.body.textContent).toContain('לא נמצאו תוצאות');
    await click([...document.body.querySelectorAll('[role=status] button')].find((b) => b.textContent.includes('נקה חיפוש')));
    expect(status()).toBeNull();
    expect(merchants()).toEqual(['Shufersal']);
    expect(document.body.querySelector('#selected-month').disabled).toBe(false);
  });
});

describe('loading, error and empty states', () => {
  const render = async (data) => {
    Object.assign(hook, data);
    const container = document.createElement('div');
    document.body.appendChild(container);
    await act(async () => { createRoot(container).render(<TransactionsPage />); });
  };
  const status = () => [...document.body.querySelectorAll('[role=status]')].map((n) => n.textContent).join('|');
  const alerts = () => [...document.body.querySelectorAll('[role=alert]')].map((n) => n.textContent).join('|');
  const thisMonth = new Date().toISOString().slice(0, 10);
  const row = { id: 't1', date: thisMonth, type: 'expense', category: 'food', merchant: 'Shufersal', amountAgorot: 100 };

  test('loading shows a Hebrew status, and the add and import buttons stay available', async () => {
    await render({ loading: true });
    expect(status()).toContain('טוען');
    expect(buttonWith('➕ הוסף')).toBeTruthy();
    expect(buttonWith('📂')).toBeTruthy();
  });

  test('no transactions at all shows the empty message', async () => {
    await render({});
    expect(status()).toContain('אין עדיין פעולות');
    expect(document.body.textContent).not.toContain('טוען');
  });

  test('transactions exist but none in the selected month', async () => {
    await render({ transactions: [{ ...row, date: '2020-01-05' }] });
    expect(document.body.textContent).toContain('אין פעולות בחודש הזה');
    expect(status()).not.toContain('אין עדיין פעולות');
  });

  test('an error with no data shows the error and nothing else in the table area', async () => {
    await render({ error: 'טעינת הנתונים נכשלה.' });
    expect(alerts()).toContain('נכשלה');
    expect(document.body.textContent).not.toContain('טוען');
    expect(document.body.textContent).not.toContain('אין עדיין פעולות');
  });

  test('an error after data loaded shows the error and keeps the rows', async () => {
    await render({ transactions: [row], error: 'טעינת הנתונים נכשלה.' });
    expect(alerts()).toContain('נכשלה');
    expect(document.body.textContent).toContain('Shufersal');
  });
});

describe('import result', () => {
  const parsedRows = (n) => Array.from({ length: n }, (_, i) => ({
    rowIndex: i,
    transaction: { date: '2025-03-05', merchant: `m${i}`, amount: 1, source: 'max' },
  }));
  const alerts = () => [...document.body.querySelectorAll('[role=alert]')].map((n) => n.textContent).join('|');
  const statuses = () => [...document.body.querySelectorAll('[role=status]')].map((n) => n.textContent).join('|');

  async function runImport({ parsed, commit }) {
    parseMaxSheet.mockImplementation((json, { onWarn }) => {
      parsed.warnings?.forEach((code) => onWarn(code, {}));
      return parsed.rows;
    });
    commitTransactions.mockImplementation(commit);
    const container = document.createElement('div');
    document.body.appendChild(container);
    await act(async () => { createRoot(container).render(<TransactionsPage />); });
    await click(buttonWith('📂'));
    await click(buttonWith('Max'));
    const input = document.body.querySelector('input[type=file]');
    const file = new File(['x'], 'max.xlsx');
    Object.defineProperty(input, 'files', { value: [file] });
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
    await click(buttonWith('📥'));
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
  }

  // CRA resets mock implementations before every test, so they are set up here.
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    getAuth.mockReturnValue({ currentUser: { uid: 'u1' } });
    XLSX.read.mockReturnValue({ SheetNames: ['s1'], Sheets: { s1: {} } });
    XLSX.utils.sheet_to_json.mockReturnValue([['h'], ['row']]);
  });

  test('a clean import reports the rows written and keeps the dialog open', async () => {
    await runImport({ parsed: { rows: parsedRows(3) }, commit: async (pending) => pending.length });
    expect(statuses()).toContain('3 פעולות יובאו');
    expect(buttonWith('סגור')).toBeTruthy();
    expect(alerts()).toBe('');
  });

  test('skipped rows are counted from the parser warnings', async () => {
    await runImport({
      parsed: { rows: parsedRows(2), warnings: ['invalid-amount', 'invalid-amount', 'max-no-posting-date'] },
      commit: async (pending) => pending.length,
    });
    expect(statuses()).toContain('2 שורות דולגו בגלל סכום לא תקין');
  });

  test('a partial failure reports the failed rows and that re-importing is safe', async () => {
    await runImport({
      parsed: { rows: parsedRows(7) },
      commit: async (pending, onChunkError) => { onChunkError({ rows: 3 }); return pending.length - 3; },
    });
    expect(alerts()).toContain('4 פעולות יובאו');
    expect(alerts()).toContain('3 פעולות לא נכתבו');
    expect(alerts()).toContain('המזהים קבועים');
  });

  test('when nothing is written the import is reported as failed', async () => {
    await runImport({
      parsed: { rows: parsedRows(5) },
      commit: async (pending, onChunkError) => { onChunkError({ rows: 5 }); return 0; },
    });
    expect(alerts()).toContain('לא נכתבה אף פעולה');
  });

  test('a sheet with no data rows is counted as ignored', async () => {
    XLSX.utils.sheet_to_json.mockReturnValue([['only a header']]);
    await runImport({ parsed: { rows: [] }, commit: async () => 0 });
    expect(statuses()).toContain('לא נמצאו פעולות לייבוא');
    expect(statuses()).toContain('1 גיליון ריק דולג');
  });

  test('closing the result and reopening the dialog starts fresh', async () => {
    await runImport({ parsed: { rows: parsedRows(1) }, commit: async (pending) => pending.length });
    await click(buttonWith('סגור'));
    await click(buttonWith('📂'));
    expect(statuses()).not.toContain('יובא');
    expect(buttonWith('Max')).toBeTruthy();
  });
});

describe('memoised derivations', () => {
  test('typing in the add form does not regroup the transactions', async () => {
    hook.transactions = [{ id: 't1', date: new Date().toISOString().slice(0, 10), type: 'x', amount: 1 }];
    await openAddForm();
    const callsAfterOpen = groupTransactionsByDate.mock.calls.length;
    expect(callsAfterOpen).toBeGreaterThan(0);

    await setInput(amountInput(), '1');
    await setInput(amountInput(), '12');
    await setInput(amountInput(), '12.5');
    expect(groupTransactionsByDate.mock.calls.length).toBe(callsAfterOpen);
  });
});

describe('labels', () => {
  test('the month picker is labelled', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    await act(async () => { createRoot(container).render(<TransactionsPage />); });
    expect(document.body.querySelector('label[for=selected-month]')).not.toBeNull();
    expect(document.getElementById('selected-month').type).toBe('month');
  });

  test('search and import controls are labelled once their dialogs are open', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    await act(async () => { createRoot(container).render(<TransactionsPage />); });

    await click(buttonWith('🔍'));
    for (const id of ['search-text', 'search-category', 'search-from', 'search-to']) {
      expect(document.body.querySelector(`label[for=${id}]`)).not.toBeNull();
      expect(document.getElementById(id)).not.toBeNull();
    }
  });
});
