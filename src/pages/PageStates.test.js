import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Dashboard from './Dashboard';
import AnalyticsPage from './AnalyticsPage';
import CategoriesPage from './CategoriesPage';
import { useData } from '../contexts/DataContext';
import { TYPE } from '../constants';

jest.mock('../firebase', () => ({ db: {} }));
jest.mock('firebase/auth', () => ({ getAuth: () => ({ currentUser: { uid: 'u1' } }) }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), where: jest.fn(), query: jest.fn(), getDocs: jest.fn(),
  addDoc: jest.fn(), deleteDoc: jest.fn(), doc: jest.fn(),
}));
jest.mock('../contexts/DataContext', () => ({ useData: jest.fn() }));
jest.mock('recharts', () => {
  const Passthrough = ({ children }) => <div>{children}</div>;
  return new Proxy({}, { get: () => Passthrough });
});

const month = new Date().toISOString().slice(0, 7);
const TX = [{ id: '1', type: TYPE.EXPENSE, date: `${month}-03`, category: 'food', amountAgorot: 5000 }];
const CATS = [{ id: 'c1', name: 'Food' }];

const base = { transactions: [], categoryDocs: [], categories: [], loading: false, error: null };

async function render(Page, data) {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = '';
  useData.mockReturnValue({ ...base, ...data });
  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => { createRoot(container).render(<Page />); });
  return container;
}
const status = () => document.body.querySelector('[role=status]')?.textContent;
const alertText = () => document.body.querySelector('[role=alert]')?.textContent;

const PAGES = [
  ['Dashboard', Dashboard, 'transactions', TX, 'אין עדיין פעולות'],
  ['Analytics', AnalyticsPage, 'transactions', TX, 'אין נתונים להצגה'],
  ['Categories', CategoriesPage, 'categoryDocs', CATS, 'אין עדיין קטגוריות'],
];

describe.each(PAGES)('%s states', (name, Page, key, rows, emptyText) => {
  test('loading shows a Hebrew status and none of the content', async () => {
    await render(Page, { loading: true });
    expect(status()).toContain('טוען');
    expect(document.body.textContent).not.toContain(emptyText);
  });

  test('loaded but empty shows the empty message', async () => {
    await render(Page, {});
    expect(status()).toContain(emptyText);
  });

  test('an error with no data shows the error alone, never the loading text or the empty text', async () => {
    await render(Page, { error: 'טעינת הנתונים נכשלה.' });
    expect(alertText()).toContain('נכשלה');
    expect(document.body.textContent).not.toContain('טוען');
    expect(document.body.textContent).not.toContain(emptyText);
  });

  test('an error after data loaded shows the error and keeps the data', async () => {
    await render(Page, { [key]: rows, categories: ['Food'], error: 'טעינת הנתונים נכשלה.' });
    expect(alertText()).toContain('נכשלה');
    expect(document.body.textContent).not.toContain(emptyText);
    expect(document.body.textContent).not.toContain('טוען');
    // The content is still there: each page shows something that comes from the data.
    const expected = { Dashboard: 'יתרה נוכחית', Analytics: 'פילוח הוצאות', Categories: 'Food' }[name];
    expect(document.body.textContent).toContain(expected);
  });

  test('with data and no error there is no status and no alert', async () => {
    await render(Page, { [key]: rows, categories: ['Food'] });
    expect(status()).toBeUndefined();
    expect(alertText()).toBeUndefined();
  });
});

describe('Categories keeps the add field in every state', () => {
  test.each([[{ loading: true }], [{ error: 'x' }], [{}]])('%j', async (data) => {
    await render(CategoriesPage, data);
    expect(document.body.querySelector('input[aria-label]')).not.toBeNull();
  });
});
