import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import * as fs from 'firebase/firestore';
import * as authMod from 'firebase/auth';
import useTransactions, {
  loadMerchantCategoryMap,
  saveMerchantCategory,
  commitTransactions,
} from './useTransactions';

jest.mock('../firebase', () => ({ db: { __db: true } }));
jest.mock('firebase/auth', () => ({ getAuth: jest.fn(), onAuthStateChanged: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  where: jest.fn(),
  query: jest.fn(),
  onSnapshot: jest.fn(),
  getDocs: jest.fn(),
  doc: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  setDoc: jest.fn(),
  deleteDoc: jest.fn(),
  writeBatch: jest.fn(),
}));

const USER = { uid: 'u1' };
let currentUser;
let seed;
let unsubs;
let batches;

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  currentUser = USER;
  seed = { transactions: [], categories: [] };
  unsubs = [];
  batches = [];

  authMod.getAuth.mockImplementation(() => ({ currentUser }));
  authMod.onAuthStateChanged.mockImplementation((auth, cb) => {
    cb(currentUser);
    return () => unsubs.push('auth');
  });

  fs.collection.mockImplementation((db, name) => ({ __col: name }));
  fs.where.mockImplementation((...args) => ({ __where: args }));
  fs.query.mockImplementation((c, ...w) => ({ __col: c.__col, w: w.map((x) => x.__where) }));
  fs.doc.mockImplementation((db, col, id) => ({ __doc: `${col}/${id}` }));
  fs.onSnapshot.mockImplementation((q, cb) => {
    cb({
      docs: seed[q.__col].map((d) => ({
        id: d.id,
        data: () => {
          const { id, ...rest } = d;
          return rest;
        },
      })),
    });
    return () => unsubs.push(q.__col);
  });
  fs.addDoc.mockResolvedValue({ id: 'new' });
  fs.updateDoc.mockResolvedValue();
  fs.setDoc.mockResolvedValue();
  fs.deleteDoc.mockResolvedValue();
  fs.writeBatch.mockImplementation(() => {
    const batch = { ops: [], set: jest.fn((d, data) => batch.ops.push([d.__doc, data])), commit: jest.fn().mockResolvedValue() };
    batches.push(batch);
    return batch;
  });
});

// Render the hook and expose its latest return value as result.current.
async function renderHook() {
  const result = { current: null };
  function Probe() {
    result.current = useTransactions();
    return null;
  }
  const container = document.createElement('div');
  let root;
  await act(async () => {
    root = createRoot(container);
    root.render(<Probe />);
  });
  return { result, unmount: () => act(async () => root.unmount()) };
}

describe('subscriptions', () => {
  test('subscribes to the signed-in user\'s categories and transactions only', async () => {
    seed.transactions = [{ id: 't1', uid: 'u1', amount: 5 }];
    seed.categories = [{ id: 'c1', uid: 'u1', name: 'food' }];
    const { result } = await renderHook();

    expect(result.current.transactions).toEqual([{ id: 't1', uid: 'u1', amount: 5 }]);
    expect(result.current.categories).toEqual(['food']);
    const queries = fs.query.mock.calls.map(([c, w]) => [c.__col, w.__where]);
    expect(queries).toEqual([
      ['categories', ['uid', '==', 'u1']],
      ['transactions', ['uid', '==', 'u1']],
    ]);
  });

  test('without a user it stays empty and subscribes to nothing', async () => {
    currentUser = null;
    const { result } = await renderHook();
    expect(result.current.transactions).toEqual([]);
    expect(result.current.categories).toEqual([]);
    expect(fs.onSnapshot).not.toHaveBeenCalled();
  });

  test('unmount cancels the auth listeners and both snapshot listeners', async () => {
    const { unmount } = await renderHook();
    expect(unsubs).toEqual([]);
    await unmount();
    expect([...unsubs].sort()).toEqual(['auth', 'auth', 'categories', 'transactions']);
  });

  test('sign-out cancels both snapshot listeners and clears the data', async () => {
    seed.transactions = [{ id: 't1', uid: 'u1', amount: 5 }];
    seed.categories = [{ id: 'c1', uid: 'u1', name: 'food' }];
    const callbacks = [];
    authMod.onAuthStateChanged.mockImplementation((auth, cb) => {
      callbacks.push(cb);
      cb(currentUser);
      return () => unsubs.push('auth');
    });
    const { result, unmount } = await renderHook();
    expect(result.current.transactions).toHaveLength(1);

    await act(async () => callbacks.forEach((cb) => cb(null)));
    expect([...unsubs].sort()).toEqual(['categories', 'transactions']);
    expect(result.current.transactions).toEqual([]);
    expect(result.current.categories).toEqual([]);

    // Unmounting afterwards must not cancel the same listeners a second time.
    await unmount();
    expect([...unsubs].sort()).toEqual(['auth', 'auth', 'categories', 'transactions']);
  });
});

describe('saveTransaction', () => {
  const form = { date: '2025-03-05', category: 'Food', amount: '12.5' };

  test('returns false and writes nothing when nobody is signed in', async () => {
    const { result } = await renderHook();
    currentUser = null;
    await expect(result.current.saveTransaction({ formData: form, type: 'T' })).resolves.toBe(false);
    expect(fs.addDoc).not.toHaveBeenCalled();
    expect(fs.updateDoc).not.toHaveBeenCalled();
  });

  test('adds a new transaction and a new category', async () => {
    const { result } = await renderHook();
    await expect(result.current.saveTransaction({ formData: form, type: 'T' })).resolves.toBe(true);
    expect(fs.addDoc.mock.calls.map(([c, data]) => [c.__col, data])).toEqual([
      ['categories', { name: 'Food', uid: 'u1' }],
      ['transactions', { date: '2025-03-05', category: 'Food', amount: 12.5, amountAgorot: 1250, type: 'T', uid: 'u1' }],
    ]);
  });

  test('does not create a category that already exists (case-insensitive, trimmed)', async () => {
    seed.categories = [{ id: 'c1', uid: 'u1', name: '  FOOD ' }];
    const { result } = await renderHook();
    await result.current.saveTransaction({ formData: form, type: 'T' });
    expect(fs.addDoc.mock.calls.map(([c]) => c.__col)).toEqual(['transactions']);
  });

  test('a category typed in another case reuses the existing spelling and creates nothing new', async () => {
    seed.categories = [{ id: 'c1', uid: 'u1', name: 'Food' }];
    const { result } = await renderHook();
    await result.current.saveTransaction({ formData: { ...form, category: '  fOOD ' }, type: 'T' });
    expect(fs.addDoc.mock.calls.map(([c]) => c.__col)).toEqual(['transactions']);
    expect(fs.addDoc.mock.calls[0][1].category).toBe('Food');
  });

  test('a new category is stored with a cleaned name on both the category and the transaction', async () => {
    const { result } = await renderHook();
    await result.current.saveTransaction({ formData: { ...form, category: '  New   Cat ' }, type: 'T' });
    expect(fs.addDoc.mock.calls[0]).toEqual([{ __col: 'categories' }, { name: 'New Cat', uid: 'u1' }]);
    expect(fs.addDoc.mock.calls[1][1].category).toBe('New Cat');
  });

  test('editing updates the document and remembers the merchant category', async () => {
    seed.categories = [{ id: 'c1', uid: 'u1', name: 'Food' }];
    const { result } = await renderHook();
    const edit = { id: 't9', merchant: ' Some Shop ' };
    await result.current.saveTransaction({ formData: form, type: 'T', editTransaction: edit });

    expect(fs.addDoc).not.toHaveBeenCalled();
    expect(fs.updateDoc).toHaveBeenCalledWith(
      { __doc: 'transactions/t9' },
      { date: '2025-03-05', category: 'Food', amount: 12.5, amountAgorot: 1250, type: 'T', uid: 'u1' }
    );
    expect(fs.setDoc).toHaveBeenCalledWith(
      { __doc: 'merchantCategories/u1_some%20shop' },
      { uid: 'u1', merchantNormalized: 'some shop', merchant: 'Some Shop', category: 'Food' },
      { merge: true }
    );
  });

  test('stores integer agorot and derives amount from it (no float drift)', async () => {
    seed.categories = [{ id: 'c1', uid: 'u1', name: 'Food' }];
    const { result } = await renderHook();
    await result.current.saveTransaction({ formData: { ...form, amount: '19.99' }, type: 'T' });
    const [, data] = fs.addDoc.mock.calls[0];
    expect(data.amountAgorot).toBe(1999);
    expect(data.amount).toBe(19.99);

    fs.addDoc.mockClear();
    await result.current.saveTransaction({ formData: { ...form, amount: 0.1 + 0.2 }, type: 'T' });
    expect(fs.addDoc.mock.calls[0][1].amountAgorot).toBe(30);
  });

  test.each([['0'], ['-5'], [''], ['abc'], ['10000000.01'], [NaN]])(
    'an invalid amount (%p) throws and writes nothing',
    async (amount) => {
      const { result } = await renderHook();
      await expect(result.current.saveTransaction({ formData: { ...form, amount }, type: 'T' })).rejects.toThrow(
        'Invalid amount'
      );
      expect(fs.addDoc).not.toHaveBeenCalled();
      expect(fs.updateDoc).not.toHaveBeenCalled();
    }
  );

  test('editing a transaction without a merchant does not touch the merchant map', async () => {
    seed.categories = [{ id: 'c1', uid: 'u1', name: 'Food' }];
    const { result } = await renderHook();
    await result.current.saveTransaction({ formData: form, type: 'T', editTransaction: { id: 't9' } });
    expect(fs.setDoc).not.toHaveBeenCalled();
  });
});

describe('deleteTransaction and updateTransactionCategory', () => {
  test('deleteTransaction deletes the right document and propagates errors', async () => {
    const { result } = await renderHook();
    await result.current.deleteTransaction('t1');
    expect(fs.deleteDoc).toHaveBeenCalledWith({ __doc: 'transactions/t1' });

    fs.deleteDoc.mockRejectedValueOnce(new Error('denied'));
    await expect(result.current.deleteTransaction('t2')).rejects.toThrow('denied');
  });

  test('updateTransactionCategory updates the document and saves the merchant category', async () => {
    const { result } = await renderHook();
    await expect(
      result.current.updateTransactionCategory({ id: 't1', merchant: 'Cafe' }, 'Coffee')
    ).resolves.toBe(true);
    expect(fs.updateDoc).toHaveBeenCalledWith({ __doc: 'transactions/t1' }, { category: 'Coffee' });
    expect(fs.setDoc.mock.calls[0][0]).toEqual({ __doc: 'merchantCategories/u1_cafe' });
  });

  test('updateTransactionCategory returns false and writes nothing when signed out', async () => {
    const { result } = await renderHook();
    currentUser = null;
    await expect(result.current.updateTransactionCategory({ id: 't1' }, 'x')).resolves.toBe(false);
    expect(fs.updateDoc).not.toHaveBeenCalled();
  });
});

describe('merchant category helpers', () => {
  test('loadMerchantCategoryMap builds a map from complete documents only', async () => {
    fs.getDocs.mockResolvedValue({
      forEach: (fn) =>
        [
          { merchantNormalized: 'a', category: 'A' },
          { merchantNormalized: 'b' },
          { category: 'C' },
        ].forEach((d) => fn({ data: () => d })),
    });
    const map = await loadMerchantCategoryMap('u1');
    expect([...map]).toEqual([['a', 'A']]);
  });

  test('loadMerchantCategoryMap returns an empty map when the read fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    fs.getDocs.mockRejectedValue(new Error('denied'));
    expect((await loadMerchantCategoryMap('u1')).size).toBe(0);
  });

  test('saveMerchantCategory ignores empty input and swallows write errors', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await saveMerchantCategory('u1', '', 'x');
    await saveMerchantCategory('u1', 'shop', '   ');
    await saveMerchantCategory('', 'shop', 'x');
    expect(fs.setDoc).not.toHaveBeenCalled();

    fs.setDoc.mockRejectedValueOnce(new Error('denied'));
    await expect(saveMerchantCategory('u1', 'shop', 'x')).resolves.toBeUndefined();
  });

  test('saveMerchantCategory updates the in-memory map when one is given', async () => {
    const map = new Map();
    await saveMerchantCategory('u1', ' Shop ', ' Food ', map);
    expect([...map]).toEqual([['shop', 'Food']]);
  });
});

describe('commitTransactions', () => {
  const items = (n) => Array.from({ length: n }, (_, i) => ({ id: `id${i}`, data: { uid: 'u1', n: i } }));

  test('writes in batches of at most 500 and returns the total', async () => {
    await expect(commitTransactions(items(1200))).resolves.toBe(1200);
    expect(batches.map((b) => b.ops.length)).toEqual([500, 500, 200]);
    expect(batches[0].ops[0]).toEqual(['transactions/id0', { uid: 'u1', n: 0 }]);
  });

  test('nothing to write means no batches', async () => {
    await expect(commitTransactions([])).resolves.toBe(0);
    expect(batches).toHaveLength(0);
  });

  test('a failed batch is logged and skipped; later batches still run', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    let call = 0;
    fs.writeBatch.mockImplementation(() => {
      call += 1;
      const failing = call === 2;
      const batch = {
        ops: [],
        set: (d, data) => batch.ops.push([d.__doc, data]),
        commit: failing ? jest.fn().mockRejectedValue(new Error('boom')) : jest.fn().mockResolvedValue(),
      };
      batches.push(batch);
      return batch;
    });
    await expect(commitTransactions(items(1200))).resolves.toBe(700);
    expect(batches).toHaveLength(3);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
