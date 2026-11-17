import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import TransactionsPage from './TransactionsPage';
import useTransactions from '../hooks/useTransactions';
import { groupTransactionsByDate } from '../lib/summaries';

// A spy around the real function. (CRA resets mock implementations before each test, so the real
// one is put back in beforeEach.)
jest.mock('../lib/summaries', () => ({
  ...jest.requireActual('../lib/summaries'),
  groupTransactionsByDate: jest.fn(),
}));
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
    await click(buttonWith('🔤'));
    expect(document.body.querySelector('label[for=search-category]')).not.toBeNull();
    expect(document.getElementById('search-category')).not.toBeNull();
  });
});
