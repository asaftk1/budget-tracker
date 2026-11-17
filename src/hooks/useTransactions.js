// Firestore access for the transactions page: live subscriptions plus the write operations.
// UI concerns (dialogs, alerts, form state) stay in the component.
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  setDoc,
  writeBatch,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { normalizeMerchantName } from '../lib/categorize';
import { chunk, MAX_BATCH_SIZE } from '../lib/transactionId';

const normalizeCategory = (cat) => (cat || '').trim().toLowerCase();

// Map<normalizedMerchant, category> of the user's saved merchant categories.
export const loadMerchantCategoryMap = async (uid) => {
  const map = new Map();
  try {
    const snap = await getDocs(query(collection(db, 'merchantCategories'), where('uid', '==', uid)));
    snap.forEach((d) => {
      const data = d.data();
      if (data?.merchantNormalized && data?.category) {
        map.set(data.merchantNormalized, data.category);
      }
    });
  } catch (e) {
    console.warn('Failed to load merchant-category map', e);
  }
  return map;
};

// Remember the user's category choice for a merchant. Only call this for explicit user choices.
export const saveMerchantCategory = async (uid, merchant, category, mapRef) => {
  const merchantNormalized = normalizeMerchantName(merchant);
  if (!uid || !merchantNormalized || !category) return;

  const finalCategory = (category || '').trim();
  if (!finalCategory) return;

  const safeDocId = `${uid}_${encodeURIComponent(merchantNormalized)}`;

  try {
    await setDoc(
      doc(db, 'merchantCategories', safeDocId),
      {
        uid,
        merchantNormalized,
        merchant: merchant?.trim() || merchantNormalized,
        category: finalCategory,
      },
      { merge: true }
    );

    if (mapRef) mapRef.set(merchantNormalized, finalCategory);
  } catch (e) {
    console.warn('Failed to save merchant-category map', e);
  }
};

// Write imported transactions in batches. pending: [{ id, data }]. Returns how many were written.
// A failed batch is logged and skipped; the rest are still attempted.
export const commitTransactions = async (pending) => {
  let total = 0;
  for (const group of chunk(pending, MAX_BATCH_SIZE)) {
    const batch = writeBatch(db);
    group.forEach(({ id, data }) => batch.set(doc(db, 'transactions', id), data));
    try {
      await batch.commit();
      total += group.length;
    } catch (error) {
      console.error('Firestore batch write failed:', error);
    }
  }
  return total;
};

export default function useTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setCategories([]);
        return;
      }

      const q = query(collection(db, 'categories'), where('uid', '==', user.uid));
      const unsubscribeSnapshot = onSnapshot(q, (snap) => {
        const data = snap.docs.map(doc => doc.data().name);
        setCategories(data);
      });

      return unsubscribeSnapshot;
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setTransactions([]);
        return;
      }

      const q = query(collection(db, 'transactions'), where('uid', '==', user.uid));
      const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTransactions(data);
      });

      return unsubscribeSnapshot;
    });

    return () => unsubscribe();
  }, []);

  // Create or update a transaction from the add/edit form. Adds the category to the user's
  // category list if it is new. Returns false when nobody is signed in (nothing is written).
  const saveTransaction = async ({ formData, type, editTransaction }) => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return false;

    const transactionData = {
      ...formData,
      amount: parseFloat(formData.amount),
      type,
      uid: user.uid
    };

    const normalizedCategories = categories.map(normalizeCategory);
    const currentCat = normalizeCategory(formData.category);

    if (!normalizedCategories.includes(currentCat)) {
      await addDoc(collection(db, 'categories'), {
        name: formData.category.trim(),
        uid: user.uid
      });
    }

    if (editTransaction) {
      const docRef = doc(db, 'transactions', editTransaction.id);
      await updateDoc(docRef, transactionData);
      if (editTransaction.merchant && transactionData.category) {
        await saveMerchantCategory(user.uid, editTransaction.merchant, transactionData.category, null);
      }
    } else {
      await addDoc(collection(db, 'transactions'), transactionData);
    }

    return true;
  };

  const deleteTransaction = (id) => deleteDoc(doc(db, 'transactions', id));

  // Set the category of an existing transaction and remember it for the merchant.
  // Returns false when nobody is signed in (nothing is written).
  const updateTransactionCategory = async (tx, category) => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return false;

    await updateDoc(doc(db, 'transactions', tx.id), { category });
    await saveMerchantCategory(user.uid, tx.merchant, category, null);
    return true;
  };

  return {
    transactions,
    categories,
    saveTransaction,
    deleteTransaction,
    updateTransactionCategory,
  };
}
