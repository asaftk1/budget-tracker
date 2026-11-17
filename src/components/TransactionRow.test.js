import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import TransactionRow from './TransactionRow';
import { TX_TYPE } from '../lib/statementParsers';

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
});

const expense = { id: 't1', merchant: 'Shop A', category: 'food', amount: 12.5, type: TX_TYPE.EXPENSE };
const income = { id: 't2', merchant: 'Boss', category: '', amount: 1000, type: TX_TYPE.INCOME };

async function render(ui, wrap = (x) => x) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(wrap(ui));
  });
  return container;
}
const asTable = (row) => (
  <table>
    <tbody>{row}</tbody>
  </table>
);
const handlers = () => ({ onEdit: jest.fn(), onDelete: jest.fn(), onMissingCategory: jest.fn() });
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

describe('TransactionRow card variant', () => {
  test('shows merchant, category, amount and a coloured type', async () => {
    const c = await render(<TransactionRow tx={expense} variant="card" {...handlers()} />);
    expect(c.textContent).toContain('Shop A');
    expect(c.textContent).toContain('food');
    expect(c.textContent).toContain('₪12.5');
    expect(c.querySelector('.text-red-500').textContent).toBe(TX_TYPE.EXPENSE);
  });

  test('income is green', async () => {
    const c = await render(<TransactionRow tx={income} variant="card" {...handlers()} />);
    expect(c.querySelector('.text-green-600').textContent).toBe(TX_TYPE.INCOME);
  });

  test('a transaction without a category shows a dash and the missing-category button', async () => {
    const h = handlers();
    const c = await render(<TransactionRow tx={income} variant="card" {...h} />);
    expect(c.textContent).toContain('—');
    const missing = c.querySelector('button.text-amber-600');
    expect(missing).not.toBeNull();
    await click(missing);
    expect(h.onMissingCategory).toHaveBeenCalledWith(income);
  });

  test('a categorised transaction has no missing-category button', async () => {
    const c = await render(<TransactionRow tx={expense} variant="card" {...handlers()} />);
    expect(c.querySelector('button.text-amber-600')).toBeNull();
  });

  test('a transaction without a merchant shows a placeholder name', async () => {
    const c = await render(<TransactionRow tx={{ ...expense, merchant: '' }} variant="card" {...handlers()} />);
    expect(c.querySelector('.font-semibold').textContent).not.toBe('');
  });

  test('edit and delete buttons call back with the transaction and its id', async () => {
    const h = handlers();
    const c = await render(<TransactionRow tx={expense} variant="card" {...h} />);
    const [edit, del] = c.querySelectorAll('button[aria-label]');
    await click(edit);
    await click(del);
    expect(h.onEdit).toHaveBeenCalledWith(expense);
    expect(h.onDelete).toHaveBeenCalledWith('t1');
  });
});

describe('TransactionRow table variant', () => {
  test('renders five cells with the same data', async () => {
    const c = await render(<TransactionRow tx={expense} variant="table" {...handlers()} />, asTable);
    const cells = [...c.querySelectorAll('td')];
    expect(cells).toHaveLength(5);
    expect(cells.slice(0, 4).map((td) => td.textContent)).toEqual(['Shop A', 'food', '₪12.5', TX_TYPE.EXPENSE]);
  });

  test('zebra striping follows the index', async () => {
    const even = await render(<TransactionRow tx={expense} variant="table" index={0} {...handlers()} />, asTable);
    const odd = await render(<TransactionRow tx={expense} variant="table" index={1} {...handlers()} />, asTable);
    expect(even.querySelector('tr').className).toBe('bg-gray-50');
    expect(odd.querySelector('tr').className).toBe('');
  });

  test('missing-category button and actions work in the table too', async () => {
    const h = handlers();
    const c = await render(<TransactionRow tx={income} variant="table" {...h} />, asTable);
    await click(c.querySelector('button.text-amber-600'));
    const [edit, del] = c.querySelectorAll('button[aria-label]');
    await click(edit);
    await click(del);
    expect(h.onMissingCategory).toHaveBeenCalledWith(income);
    expect(h.onEdit).toHaveBeenCalledWith(income);
    expect(h.onDelete).toHaveBeenCalledWith('t2');
  });
});
