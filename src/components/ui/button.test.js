import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from './button';

async function render(ui) {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  await act(async () => { createRoot(container).render(ui); });
  return container.firstChild;
}

describe('Button', () => {
  test('a plain button gets the primary background so its white text is readable', async () => {
    const b = await render(<Button>go</Button>);
    expect(b.className).toContain('bg-primary');
    expect(b.className).toContain('text-white');
  });

  test('an explicit background class replaces the primary one (no class conflict)', async () => {
    const b = await render(<Button className="bg-green-500 text-white">go</Button>);
    expect(b.className).toContain('bg-green-500');
    expect(b.className).not.toContain('bg-primary');
  });

  test('a hover-only background class does not count as a background', async () => {
    const b = await render(<Button className="hover:bg-gray-100">go</Button>);
    expect(b.className).toContain('bg-primary');
  });

  test('the outline variant has a border and a light background, not the primary one', async () => {
    const b = await render(<Button variant="outline">cancel</Button>);
    expect(b.className).toContain('border');
    expect(b.className).toContain('bg-background');
    expect(b.className).not.toContain('bg-primary');
    expect(b.className).not.toContain('text-white');
  });

  test('the variant prop is not leaked to the DOM', async () => {
    const b = await render(<Button variant="outline">cancel</Button>);
    expect(b.hasAttribute('variant')).toBe(false);
  });

  test('other props such as type and onClick still reach the element', async () => {
    const onClick = jest.fn();
    const b = await render(<Button type="submit" onClick={onClick}>go</Button>);
    expect(b.getAttribute('type')).toBe('submit');
    await act(async () => { b.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
