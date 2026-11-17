import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Input } from './input';

async function render(ui) {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  await act(async () => { createRoot(container).render(ui); });
  return container.firstChild;
}

describe('Input', () => {
  test('keeps the control border and background tokens and a focus ring', async () => {
    const i = await render(<Input />);
    expect(i.className).toContain('border-input');
    expect(i.className).toContain('bg-background');
    expect(i.className).toContain('focus-visible:ring-2');
  });

  test('invalid sets aria-invalid; a caller-supplied aria-invalid still works', async () => {
    expect((await render(<Input invalid />)).getAttribute('aria-invalid')).toBe('true');
    expect((await render(<Input aria-invalid="true" />)).getAttribute('aria-invalid')).toBe('true');
    expect((await render(<Input />)).hasAttribute('aria-invalid')).toBe(false);
  });

  test('size variants set the height and inputSize is not leaked to the DOM', async () => {
    const sm = await render(<Input inputSize="sm" />);
    expect(sm.className).toContain('h-8');
    expect(sm.hasAttribute('inputsize')).toBe(false);
    expect((await render(<Input inputSize="lg" />)).className).toContain('h-12');
  });

  test('other props such as name, type and disabled reach the element', async () => {
    const i = await render(<Input name="email" type="email" disabled />);
    expect(i.getAttribute('name')).toBe('email');
    expect(i.getAttribute('type')).toBe('email');
    expect(i.disabled).toBe(true);
  });
});
