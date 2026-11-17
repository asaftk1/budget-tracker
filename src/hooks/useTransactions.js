// Firestore access for the transactions page: the write operations (live data comes from DataContext).
// UI concerns (dialogs, alerts, form state) stay in the component.
import { db } from '../firebase';
import {
  collection,
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
import { getAuth } from 'firebase/auth';
import { useData } from '../contexts/DataContext';
import { normalizeMerchantName } from '../lib/categorize';
import { chunk, MAX_BATCH_SIZE } from '../lib/transactionId';
import { toAgorot, fromAgorot } from '../lib/money';
import { cleanCategoryName, hasCategory, resolveCategory } from '../lib/categories';

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
// A failed batch is logged and skipped; the rest are still attempted. The optional onChunkError
// receives { rows, error } for each failed batch so the caller can report it.
export const commitTransactions = async (pending, onChunkError) => {
  let total = 0;
  for (const group of chunk(pending, MAX_BATCH_SIZE)) {
    const batch = writeBatch(db);
    group.forEach(({ id, data }) => batch.set(doc(db, 'transactions', id), data));
    try {
      await batch.commit();
      total += group.length;
    } catch (error) {
      console.error('Firestore batch write failed:', error);
      if (onChunkError) onChunkError({ rows: group.length, error });
    }
  }
  return total;
};

export default function useTransactions() {
  // Live data comes from the shared provider; this hook adds the write operations.
  const { transactions, categories, loading, error } = useData();

  // Create or update a transaction from the add/edit form. Adds the category to the user's
  // category list if it is new. Returns false when nobody is signed in (nothing is written).
  // The caller validates the amount first; an invalid amount here throws.
  const saveTransaction = async ({ formData, type, editTransaction }) => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return false;

    const amountAgorot = toAgorot(formData.amount);
    if (amountAgorot === null) throw new Error('Invalid amount');

    const transactionData = {
      ...formData,
      // Store the spelling of an existing category if there is one (case-insensitive match).
      category: resolveCategory(categories, formData.category),
      // amount (shekels) is derived from amountAgorot for older readers; amountAgorot is the source of truth.
      amount: fromAgorot(amountAgorot),
      amountAgorot,
      type,
      uid: user.uid
    };

    if (!hasCategory(categories, formData.category)) {
      await addDoc(collection(db, 'categories'), {
        name: cleanCategoryName(formData.category),
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
    loading,
    error,
    saveTransaction,
    deleteTransaction,
    updateTransactionCategory,
  };
}
