import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import TransactionRow from './TransactionRow';
import { TYPE } from '../constants';

const plain = (s) => s.replace(/[\u200e\u200f]/g, '').replace(/\u00a0/g, ' ');

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
});

const expense = { id: 't1', merchant: 'Shop A', category: 'food', amount: 12.5, type: TYPE.EXPENSE };
const income = { id: 't2', merchant: 'Boss', category: '', amount: 1000, type: TYPE.INCOME };

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
    expect(plain(c.textContent)).toContain('12.50 ₪');
    expect(c.querySelector('.text-expense').textContent).toBe(TYPE.EXPENSE);
  });

  test('amounts come from amountAgorot when present and from legacy amount otherwise', async () => {
    const modern = await render(<TransactionRow tx={{ ...expense, amount: 1, amountAgorot: 1999 }} variant="card" {...handlers()} />);
    expect(plain(modern.textContent)).toContain('19.99 ₪');
    const noisy = await render(<TransactionRow tx={{ ...expense, amount: 12.299999999999999 }} variant="card" {...handlers()} />);
    expect(plain(noisy.textContent)).toContain('12.30 ₪');
    expect(noisy.textContent).not.toContain('12.2999');
  });

  test('income is green', async () => {
    const c = await render(<TransactionRow tx={income} variant="card" {...handlers()} />);
    expect(c.querySelector('.text-income').textContent).toBe(TYPE.INCOME);
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

describe('TransactionRow accessible names', () => {
  test.each([['card'], ['table']])('every button in the %s variant has an accessible name', async (variant) => {
    const ui = <TransactionRow tx={income} variant={variant} {...handlers()} />;
    const c = await render(ui, variant === 'table' ? asTable : (x) => x);
    const buttons = [...c.querySelectorAll('button')];
    expect(buttons).toHaveLength(3); // missing category, edit, delete
    for (const b of buttons) expect((b.getAttribute('aria-label') || b.textContent).trim().length).toBeGreaterThan(1);
  });
});

describe('TransactionRow table variant', () => {
  test('renders five cells with the same data', async () => {
    const c = await render(<TransactionRow tx={expense} variant="table" {...handlers()} />, asTable);
    const cells = [...c.querySelectorAll('td')];
    expect(cells).toHaveLength(5);
    expect(cells.slice(0, 4).map((td) => plain(td.textContent))).toEqual(['Shop A', 'food', '12.50 ₪', TYPE.EXPENSE]);
  });

  test('zebra striping follows the index', async () => {
    const even = await render(<TransactionRow tx={expense} variant="table" index={0} {...handlers()} />, asTable);
    const odd = await render(<TransactionRow tx={expense} variant="table" index={1} {...handlers()} />, asTable);
    expect(even.querySelector('tr').className).toContain('bg-canvas');
    expect(odd.querySelector('tr').className).not.toContain('bg-canvas');
  });

  test('every row has a hover style', async () => {
    const row = await render(<TransactionRow tx={expense} variant="table" index={1} {...handlers()} />, asTable);
    expect(row.querySelector('tr').className).toContain('hover:bg-muted');
  });

  test('missing-category button and actions work in the table too', async () => {
    const h = handlers();
    const c = await render(<TransactionRow tx={income} variant="table" {...h} />, asTable);
    await click(c.querySelector('button.text-amber-600'));
    const [edit, del] = c.querySelectorAll('button[aria-label]:not(.text-amber-600)');
    await click(edit);
    await click(del);
    expect(h.onMissingCategory).toHaveBeenCalledWith(income);
    expect(h.onEdit).toHaveBeenCalledWith(income);
    expect(h.onDelete).toHaveBeenCalledWith('t2');
  });
});
