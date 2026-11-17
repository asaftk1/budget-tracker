import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

// One live subscription to the signed-in user's transactions and one to their categories, shared
// by every page. Listeners are opened when a user signs in and cancelled on sign-out, when the user
// changes, and on unmount. Pages read the data with useData() and never open listeners themselves.
//
// Value:
//   transactions  [{ id, ...fields }]
//   categoryDocs  [{ id, ...fields }]   (the category page needs the document ids)
//   categories    [name]                (what the transaction forms need)
//   loading       true until both first snapshots have arrived; false after an error
//   error         Hebrew message or null. A failure after data loaded keeps the data.
// The user's merchant-category map is not listened to; the import reads it once when it runs.

export const LOAD_ERROR_MESSAGE = 'טעינת הנתונים נכשלה. נסה/י לרענן את הדף.';

const DataContext = createContext(null);

const INITIAL = { transactions: [], categoryDocs: [], txReady: false, catReady: false, error: null };

export function DataProvider({ children }) {
  const { user } = useAuth();
  // undefined: auth still pending. null: signed out. Otherwise the signed-in user's id.
  const uid = user === undefined ? undefined : user?.uid ?? null;
  const [state, setState] = useState(INITIAL);

  useEffect(() => {
    // Start every user, and every sign-out, from a clean slate.
    setState(INITIAL);
    if (!uid) return undefined;

    const fail = (source) => (e) => {
      console.error(`Failed to listen to ${source}`, e);
      setState((prev) => ({ ...prev, error: LOAD_ERROR_MESSAGE }));
    };

    const stopTransactions = onSnapshot(
      query(collection(db, 'transactions'), where('uid', '==', uid)),
      (snap) => {
        const transactions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // A good snapshot after an error means the listener recovered.
        setState((prev) => ({ ...prev, transactions, txReady: true, error: null }));
      },
      fail('transactions')
    );
    const stopCategories = onSnapshot(
      query(collection(db, 'categories'), where('uid', '==', uid)),
      (snap) => {
        const categoryDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setState((prev) => ({ ...prev, categoryDocs, catReady: true, error: null }));
      },
      fail('categories')
    );

    return () => {
      stopTransactions();
      stopCategories();
    };
  }, [uid]);

  const value = useMemo(
    () => ({
      transactions: state.transactions,
      categoryDocs: state.categoryDocs,
      categories: state.categoryDocs.map((c) => c.name),
      loading: !state.error && (uid === undefined || (uid !== null && !(state.txReady && state.catReady))),
      error: state.error,
    }),
    [state, uid]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => {
  const value = useContext(DataContext);
  if (!value) throw new Error('useData must be used inside <DataProvider>');
  return value;
};
