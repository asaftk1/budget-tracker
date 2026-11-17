import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Money, { displayMoney } from './Money';
import { formatMoney } from '../lib/money';

async function render(ui) {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  await act(async () => { createRoot(container).render(ui); });
  return container.firstChild;
}

describe('Money', () => {
  test('is a left-to-right unit and keeps the sign in front of the number', async () => {
    const el = await render(<Money agorot={1999} prefix="-" />);
    expect(el.getAttribute('dir')).toBe('ltr');
    expect(el.textContent.startsWith('-19.99')).toBe(true);
    expect(el.textContent).toContain('₪');
  });

  test('has the same digits as formatMoney, only without direction marks', () => {
    for (const agorot of [0, 5, 1999, 5992173, -336414]) {
      const marks = /[‎‏]/g;
      expect(displayMoney(agorot)).toBe(formatMoney(agorot).replace(marks, ''));
      expect(displayMoney(agorot)).not.toMatch(marks);
    }
    expect(displayMoney(5992173)).toContain('59,921.73');
    expect(displayMoney(-336414).replace(/\s/g, ' ')).toMatch(/^-3,364\.14/);
  });

  test('whole shekels for axes', () => {
    expect(displayMoney(1200000, { fractionDigits: 0 })).toContain('12,000');
    expect(displayMoney(1200000, { fractionDigits: 0 })).not.toContain('.');
  });
});
