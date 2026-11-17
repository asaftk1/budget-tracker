import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import CategoriesPage from './CategoriesPage';
import * as fs from 'firebase/firestore';
import { DataProvider } from '../contexts/DataContext';

let existing;

jest.mock('../firebase', () => ({ db: {} }));
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
// The page uses currentUser as an effect dependency, so it must be the same object on every call
// (the real SDK guarantees that).
jest.mock('firebase/auth', () => {
  const auth = { currentUser: { uid: 'u1' } };
  return { getAuth: () => auth };
});
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  where: jest.fn(),
  query: jest.fn(),
  onSnapshot: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
}));

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = '';
  existing = [{ id: 'c1', name: 'Food' }, { id: 'c2', name: 'Travel' }];
  fs.collection.mockImplementation((db, name) => ({ __col: name }));
  fs.query.mockImplementation((c) => ({ __col: c.__col }));
  fs.onSnapshot.mockImplementation((q, cb) => {
    cb({ docs: existing.map((d) => ({ id: d.id, data: () => ({ name: d.name, uid: 'u1' }) })) });
    return () => {};
  });
  fs.getDocs.mockImplementation(async () => ({
    docs: existing.map((d) => ({ id: d.id, data: () => ({ name: d.name, uid: 'u1' }) })),
  }));
  fs.addDoc.mockResolvedValue({ id: 'new' });
  window.alert = jest.fn(); // must stay unused: errors are shown inline
});

async function renderPage() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => { createRoot(container).render(<DataProvider><CategoriesPage /></DataProvider>); });
}
const typeAndAdd = async (value) => {
  const input = document.body.querySelector('input');
  await act(async () => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const add = [...document.body.querySelectorAll('button')].find((b) => b.textContent.includes('➕'));
  await act(async () => { add.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
};

describe('CategoriesPage uniqueness', () => {
  test.each([['food'], ['FOOD'], ['  Food  '], ['tRaVeL']])('refuses %p because it already exists in another case', async (value) => {
    await renderPage();
    await typeAndAdd(value);
    expect(window.alert).not.toHaveBeenCalled();
    expect(document.body.querySelector('[role=alert]').textContent).toContain('כבר קיימת');
    expect(fs.addDoc).not.toHaveBeenCalled();
  });

  test('adds a genuinely new category with a cleaned name', async () => {
    await renderPage();
    await typeAndAdd('  Brand   New ');
    expect(window.alert).not.toHaveBeenCalled();
    expect(fs.addDoc).toHaveBeenCalledWith({ __col: 'categories' }, { name: 'Brand New', uid: 'u1' });
  });

  test('a blank name is ignored', async () => {
    await renderPage();
    await typeAndAdd('   ');
    expect(fs.getDocs).not.toHaveBeenCalled();
    expect(fs.addDoc).not.toHaveBeenCalled();
  });

  test('the list still shows every stored category, including existing duplicates', async () => {
    existing = [{ id: 'c1', name: 'Food' }, { id: 'c2', name: 'food' }];
    await renderPage();
    expect(document.body.querySelectorAll('li')).toHaveLength(2);
  });
});

describe('CategoriesPage failed writes', () => {
  const input = () => document.body.querySelector('input');
  const alertText = () => document.body.querySelector('[role=alert]')?.textContent;

  test('a failed add shows a Hebrew error and keeps the typed name', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    fs.addDoc.mockRejectedValue(new Error('offline'));
    await renderPage();
    await typeAndAdd('Brand New');
    expect(alertText()).toContain('הוספת הקטגוריה נכשלה');
    expect(input().value).toBe('Brand New');
    expect(window.alert).not.toHaveBeenCalled();
  });

  test('a failed duplicate check also shows an error instead of throwing', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    fs.getDocs.mockRejectedValue(new Error('offline'));
    await renderPage();
    await typeAndAdd('Brand New');
    expect(alertText()).toContain('הוספת הקטגוריה נכשלה');
    expect(fs.addDoc).not.toHaveBeenCalled();
  });

  test('a failed delete shows a Hebrew error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    fs.deleteDoc.mockRejectedValue(new Error('offline'));
    await renderPage();
    await act(async () => { document.body.querySelector('[aria-label^="מחק קטגוריה"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    const confirm = [...document.body.querySelectorAll('button')].find((b) => b.textContent.includes('אישור'));
    await act(async () => { confirm.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(alertText()).toContain('מחיקת הקטגוריה נכשלה');
  });

  test('a successful add clears any earlier error and the field', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    fs.addDoc.mockRejectedValueOnce(new Error('offline'));
    await renderPage();
    await typeAndAdd('Brand New');
    expect(alertText()).toBeTruthy();
    const add = [...document.body.querySelectorAll('button')].find((b) => b.textContent.includes('➕'));
    await act(async () => { add.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(alertText()).toBeUndefined();
    expect(input().value).toBe('');
  });
});
