import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import * as fs from 'firebase/firestore';
import { DataProvider, useData, LOAD_ERROR_MESSAGE } from './DataContext';

jest.mock('../firebase', () => ({ db: { __db: true } }));
let mockAuthUser;
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: mockAuthUser }) }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  where: jest.fn(),
  query: jest.fn(),
  onSnapshot: jest.fn(),
}));

let listeners; // [{ col, uid, next, error, cancelled }]
let root;

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = '';
  listeners = [];
  mockAuthUser = { uid: 'u1' };
  fs.collection.mockImplementation((db, name) => ({ __col: name }));
  fs.where.mockImplementation((...args) => ({ __where: args }));
  fs.query.mockImplementation((c, w) => ({ col: c.__col, uid: w.__where[2] }));
  // Listeners stay silent until a test pushes a snapshot or an error.
  fs.onSnapshot.mockImplementation((q, next, error) => {
    const l = { col: q.col, uid: q.uid, next, error, cancelled: false };
    listeners.push(l);
    return () => { l.cancelled = true; };
  });
});

const snap = (rows) => ({ docs: rows.map(({ id, ...rest }) => ({ id, data: () => rest })) });
const emit = (col, rows) => act(async () => listeners.filter((l) => l.col === col && !l.cancelled).forEach((l) => l.next(snap(rows))));
const fail = (col) => act(async () => listeners.filter((l) => l.col === col && !l.cancelled).forEach((l) => l.error(new Error('denied'))));
const live = () => listeners.filter((l) => !l.cancelled).map((l) => l.col).sort();

let latest;
function Probe() {
  latest = useData();
  return null;
}
function Second() {
  useData();
  return null;
}

let tree;
async function mount(children = <Probe />) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  tree = children;
  await act(async () => {
    root = createRoot(container);
    root.render(<DataProvider>{children}</DataProvider>);
  });
}
const rerender = () => act(async () => root.render(<DataProvider>{tree}</DataProvider>));

describe('listeners', () => {
  test('opens exactly one transactions and one categories listener for the signed-in user', async () => {
    await mount();
    expect(listeners.map((l) => [l.col, l.uid]).sort()).toEqual([['categories', 'u1'], ['transactions', 'u1']]);
  });

  test('any number of consumers share those two listeners', async () => {
    await mount(<><Probe /><Second /><Second /></>);
    expect(listeners).toHaveLength(2);
  });

  test('re-rendering does not open new listeners', async () => {
    await mount();
    await rerender();
    await rerender();
    expect(listeners).toHaveLength(2);
  });

  test('sign-out cancels both listeners and clears the data', async () => {
    await mount();
    await emit('transactions', [{ id: 't1', amount: 5 }]);
    await emit('categories', [{ id: 'c1', name: 'food' }]);
    expect(latest.transactions).toHaveLength(1);

    mockAuthUser = null;
    await rerender();
    expect(live()).toEqual([]);
    expect(listeners).toHaveLength(2);
    expect(latest.transactions).toEqual([]);
    expect(latest.categories).toEqual([]);
    expect(latest.loading).toBe(false);
  });

  test('signing in as someone else cancels the old listeners and opens new ones', async () => {
    await mount();
    mockAuthUser = { uid: 'u2' };
    await rerender();
    expect(live()).toEqual(['categories', 'transactions']);
    expect(listeners.filter((l) => !l.cancelled).every((l) => l.uid === 'u2')).toBe(true);
    expect(listeners.filter((l) => l.cancelled).every((l) => l.uid === 'u1')).toBe(true);
  });

  test('unmount cancels both listeners', async () => {
    await mount();
    expect(live()).toEqual(['categories', 'transactions']);
    await act(async () => root.unmount());
    expect(live()).toEqual([]);
  });

  test('while auth is pending nothing is opened and the app is loading', async () => {
    mockAuthUser = undefined;
    await mount();
    expect(listeners).toHaveLength(0);
    expect(latest.loading).toBe(true);
  });
});

describe('data, loading and error', () => {
  test('loading lasts until both first snapshots arrive', async () => {
    await mount();
    expect(latest.loading).toBe(true);
    await emit('transactions', [{ id: 't1', amount: 5 }]);
    expect(latest.loading).toBe(true);
    await emit('categories', []);
    expect(latest.loading).toBe(false);
    expect(latest.transactions).toEqual([{ id: 't1', amount: 5 }]);
  });

  test('exposes category names and category documents', async () => {
    await mount();
    await emit('categories', [{ id: 'c1', name: 'food', uid: 'u1' }]);
    expect(latest.categories).toEqual(['food']);
    expect(latest.categoryDocs).toEqual([{ id: 'c1', name: 'food', uid: 'u1' }]);
  });

  test('a listener error ends loading and sets the error, so a page cannot stay loading forever', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await mount();
    expect(latest.loading).toBe(true);
    await fail('transactions');
    expect(latest.loading).toBe(false);
    expect(latest.error).toBe(LOAD_ERROR_MESSAGE);
  });

  test('an error from the categories listener alone also ends loading', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await mount();
    await emit('transactions', []);
    await fail('categories');
    expect(latest.loading).toBe(false);
    expect(latest.error).toBeTruthy();
  });

  test('an error after data has loaded keeps the loaded data', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await mount();
    await emit('transactions', [{ id: 't1', amount: 5 }]);
    await emit('categories', [{ id: 'c1', name: 'food' }]);
    await fail('transactions');
    expect(latest.error).toBe(LOAD_ERROR_MESSAGE);
    expect(latest.transactions).toEqual([{ id: 't1', amount: 5 }]);
    expect(latest.categories).toEqual(['food']);
    expect(latest.loading).toBe(false);
  });

  test('a good snapshot after an error clears it', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await mount();
    await fail('transactions');
    await emit('transactions', [{ id: 't1' }]);
    expect(latest.error).toBeNull();
  });

  test('useData outside the provider fails loudly', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const container = document.createElement('div');
    expect(() => act(() => { createRoot(container).render(<Probe />); })).toThrow(/DataProvider/);
    spy.mockRestore();
  });
});
