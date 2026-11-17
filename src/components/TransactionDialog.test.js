import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import TransactionDialog from './TransactionDialog';
import { TYPE } from '../constants';

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = '';
});

const baseProps = () => ({
  open: true,
  onOpenChange: jest.fn(),
  step: 0,
  formData: { date: '2025-03-05', category: 'food', amount: '12.5' },
  categories: ['food', 'travel'],
  onChange: jest.fn(),
  onSelectType: jest.fn(),
  onSave: jest.fn(),
});

async function render(props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(<TransactionDialog {...props} />);
  });
  return container;
}
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const buttonWith = (text) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.includes(text));

describe('TransactionDialog', () => {
  test('when closed only the trigger is rendered', async () => {
    await render({ ...baseProps(), open: false });
    expect(document.body.querySelector('[role=dialog]')).toBeNull();
    expect(document.body.querySelectorAll('button')).toHaveLength(1);
  });

  test('step 0 offers income and expense and reports the choice', async () => {
    const props = baseProps();
    await render(props);
    expect(document.body.querySelector('input')).toBeNull();
    await click(buttonWith('💰'));
    await click(buttonWith('💸'));
    expect(props.onSelectType.mock.calls).toEqual([[TYPE.INCOME], [TYPE.EXPENSE]]);
  });

  test('step 1 shows the form fields with their values and the category suggestions', async () => {
    await render({ ...baseProps(), step: 1 });
    expect(document.body.querySelector('input[name=date]').value).toBe('2025-03-05');
    expect(document.body.querySelector('input[name=category]').value).toBe('food');
    expect(document.body.querySelector('input[name=amount]').value).toBe('12.5');
    const options = [...document.body.querySelectorAll('datalist#category-options option')].map((o) => o.value);
    expect(options).toEqual(['food', 'travel']);
  });

  test('the amount field has min, max, step and required, and no error by default', async () => {
    await render({ ...baseProps(), step: 1 });
    const amount = document.body.querySelector('input[name=amount]');
    expect(amount.getAttribute('min')).toBe('0.01');
    expect(amount.getAttribute('max')).toBe('10000000');
    expect(amount.getAttribute('step')).toBe('0.01');
    expect(amount.required).toBe(true);
    expect(document.body.querySelector('[role=alert]')).toBeNull();
    expect(amount.getAttribute('aria-invalid')).toBeNull();
  });

  test('an amount error is shown and linked to the field', async () => {
    await render({ ...baseProps(), step: 1, amountError: 'bad amount' });
    const alert = document.body.querySelector('[role=alert]');
    const amount = document.body.querySelector('input[name=amount]');
    expect(alert.textContent).toBe('bad amount');
    expect(amount.getAttribute('aria-invalid')).toBe('true');
    expect(amount.getAttribute('aria-describedby')).toBe(alert.id);
  });

  test('submitting the form (Enter key) calls onSave once without a page reload', async () => {
    const props = { ...baseProps(), step: 1 };
    await render(props);
    const form = document.body.querySelector('form');
    const event = new Event('submit', { bubbles: true, cancelable: true });
    await act(async () => { form.dispatchEvent(event); });
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  test('typing calls onChange and the save button calls onSave', async () => {
    const props = { ...baseProps(), step: 1 };
    await render(props);
    const amount = document.body.querySelector('input[name=amount]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(amount), 'value').set.call(amount, '99');
      amount.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(props.onChange).toHaveBeenCalledTimes(1);
    const save = [...document.body.querySelectorAll('button')].find((b) => b.className.includes('bg-green-600'));
    await click(save);
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });
});
