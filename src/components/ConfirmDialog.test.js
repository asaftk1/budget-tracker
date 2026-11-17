import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ConfirmDialog from './ConfirmDialog';

beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; document.body.innerHTML = ''; });

async function render(props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => { createRoot(container).render(<ConfirmDialog {...props} />); });
  return container;
}
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

describe('ConfirmDialog', () => {
  test('is announced as a modal alert dialog labelled by its message', async () => {
    const c = await render({ message: 'Delete it?', onConfirm: jest.fn(), onCancel: jest.fn() });
    const dialog = c.querySelector('[role=alertdialog]');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const label = document.getElementById(dialog.getAttribute('aria-labelledby'));
    expect(label.textContent).toBe('Delete it?');
  });

  test('two dialogs get different label ids', async () => {
    const a = await render({ message: 'A', onConfirm: jest.fn(), onCancel: jest.fn() });
    const b = await render({ message: 'B', onConfirm: jest.fn(), onCancel: jest.fn() });
    expect(a.querySelector('[role=alertdialog]').getAttribute('aria-labelledby'))
      .not.toBe(b.querySelector('[role=alertdialog]').getAttribute('aria-labelledby'));
  });

  test('confirm and cancel call their handlers and are plain buttons', async () => {
    const props = { message: 'm', onConfirm: jest.fn(), onCancel: jest.fn() };
    const c = await render(props);
    const [cancel, confirm] = c.querySelectorAll('button');
    expect(cancel.getAttribute('type')).toBe('button');
    await click(confirm);
    await click(cancel);
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });
});
