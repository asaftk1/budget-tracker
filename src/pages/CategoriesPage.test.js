import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import CategoriesPage from './CategoriesPage';
import * as fs from 'firebase/firestore';

let existing;

jest.mock('../firebase', () => ({ db: {} }));
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
  window.alert = jest.fn();
});

async function renderPage() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => { createRoot(container).render(<CategoriesPage />); });
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
    expect(window.alert).toHaveBeenCalledTimes(1);
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
