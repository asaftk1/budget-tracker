import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import PageState from './PageState';

async function render(props, children = <p>content</p>) {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => { createRoot(container).render(<PageState {...props}>{children}</PageState>); });
  return container;
}
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const retryButton = (c) => [...c.querySelectorAll('button')].find((b) => b.textContent.includes('נסה שוב'));

beforeEach(() => { document.body.innerHTML = ''; });

describe('PageState', () => {
  test('loading: a busy status line, placeholders hidden from screen readers, no content', async () => {
    const c = await render({ loading: true });
    expect(c.querySelector('[aria-busy=true]')).not.toBeNull();
    expect(c.querySelector('[role=status]').textContent).toContain('טוען');
    expect(c.querySelector('[aria-hidden=true] .animate-pulse')).not.toBeNull();
    expect(c.textContent).not.toContain('content');
  });

  test('error without data: the message as an alert and a retry button that calls onRetry', async () => {
    const onRetry = jest.fn();
    const c = await render({ error: 'failed', hasData: false, onRetry });
    expect(c.querySelector('[role=alert]').textContent).toBe('failed');
    expect(c.textContent).not.toContain('content');
    await click(retryButton(c));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('error with data: a banner with retry above the content, which stays', async () => {
    const onRetry = jest.fn();
    const c = await render({ error: 'failed', hasData: true, onRetry });
    expect(c.querySelector('[role=alert]').textContent).toBe('failed');
    expect(c.textContent).toContain('content');
    await click(retryButton(c));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('empty: the message as a status, no retry button', async () => {
    const c = await render({ isEmpty: true, emptyMessage: 'nothing yet' });
    expect(c.querySelector('[role=status]').textContent).toBe('nothing yet');
    expect(retryButton(c)).toBeUndefined();
    expect(c.textContent).not.toContain('content');
  });

  test('data and no error: just the content, no status and no alert', async () => {
    const c = await render({ hasData: true });
    expect(c.textContent).toBe('content');
    expect(c.querySelector('[role=status], [role=alert]')).toBeNull();
  });
});
