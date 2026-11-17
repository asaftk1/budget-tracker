import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Suggestions from './Suggestions';
import useSuggestions from '../insights/useSuggestions';

jest.mock('../insights/useSuggestions', () => ({ __esModule: true, default: jest.fn() }));

const make = (n) => Array.from({ length: n }, (_, i) => ({ title: `title ${i}`, detail: `detail ${i}`, score: 100 }));

async function render(props) {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => { createRoot(container).render(<Suggestions transactions={[{ id: 1 }]} {...props} />); });
  return container;
}
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

describe('Suggestions', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  test('shows the first five, then all of them after "show more", and hides them again', async () => {
    useSuggestions.mockReturnValue(make(12));
    const c = await render();
    expect(c.querySelectorAll('li')).toHaveLength(5);
    const toggle = c.querySelector('button[aria-expanded]');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.textContent).toContain('7');
    await click(toggle);
    expect(c.querySelectorAll('li')).toHaveLength(12);
    expect(c.querySelector('button[aria-expanded]').getAttribute('aria-expanded')).toBe('true');
    await click(c.querySelector('button[aria-expanded]'));
    expect(c.querySelectorAll('li')).toHaveLength(5);
  });

  test('no toggle when everything fits, and no score badge', async () => {
    useSuggestions.mockReturnValue(make(3));
    const c = await render();
    expect(c.querySelectorAll('li')).toHaveLength(3);
    expect(c.querySelector('button[aria-expanded]')).toBeNull();
    expect(c.textContent).not.toContain('ציון');
    expect(c.textContent).toContain('title 0');
  });

  test('empty list and empty transactions have their own messages', async () => {
    useSuggestions.mockReturnValue([]);
    expect((await render()).textContent).toContain('אין ממצאים מיוחדים');
    document.body.innerHTML = '';
    const c = await render({ transactions: [] });
    expect(c.textContent).toContain('אין נתונים להצגה');
  });
});
