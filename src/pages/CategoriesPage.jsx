import { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, deleteDoc, doc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { getDocs } from 'firebase/firestore';
import ConfirmDialog from '../components/ConfirmDialog';
import { cleanCategoryName, hasCategory } from '../lib/categories';
import { useData } from '../contexts/DataContext';
import PageState from '../components/PageState';


export default function CategoriesPage() {
  // Live list from the shared provider (documents with their ids).
  const { categoryDocs: categories, loading, error: loadError } = useData();
  const [newCategory, setNewCategory] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  // Inline Hebrew message for a refused or failed add/delete (replaces alert()).
  const [error, setError] = useState('');
  const user = getAuth().currentUser;

  const addCategory = async () => {
    const name = cleanCategoryName(newCategory);
    if (!name || !user) return;

    setError('');
    try {
      // Read the user's categories and compare case-insensitively; Firestore cannot do that itself.
      const snapshot = await getDocs(query(collection(db, 'categories'), where('uid', '==', user.uid)));
      if (hasCategory(snapshot.docs.map((d) => d.data().name), name)) {
        setError('⚠️ הקטגוריה כבר קיימת');
        return;
      }

      await addDoc(collection(db, 'categories'), { name, uid: user.uid });
    } catch (e) {
      // The typed name stays in the field so the user can retry.
      console.error('Failed to add category', e);
      setError('הוספת הקטגוריה נכשלה. נסה/י שוב.');
      return;
    }
    setNewCategory('');
  };

  const handleConfirmDelete = async () => {
    const id = pendingDelete?.id;
    setPendingDelete(null);
    if (!id) return;
    setError('');
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (e) {
      console.error('Failed to delete category', e);
      setError('מחיקת הקטגוריה נכשלה. נסה/י שוב.');
    }
  };

  return (
    <div dir = "rtl" className="p-4">
      <h2 className="text-xl font-bold mb-4">📁 הקטגוריות שלי</h2>
      <PageState
        loading={loading}
        error={loadError}
        hasData={categories.length > 0}
        isEmpty={categories.length === 0}
        emptyMessage="אין עדיין קטגוריות. הוסף/י את הראשונה למטה."
      >
      <ul className="mb-4 space-y-2">
        {categories.map(cat => (
          <li key={cat.id} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded shadow-sm">
            <span>📌 {cat.name}</span>
            <button
              aria-label={`מחק קטגוריה ${cat.name}`}
              onClick={() => setPendingDelete(cat)}
              className="text-red-500 hover:text-red-700"
            >
              🗑️
            </button>
          </li>
        ))}
      </ul>
      </PageState>
      <div className="flex gap-2">
        <Input
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          placeholder="הוסף קטגוריה חדשה"
          aria-label="שם קטגוריה חדשה"
        />
        <Button onClick={addCategory}>➕ הוסף</Button>
      </div>
      {error && <p role="alert" className="text-red-600 text-sm mt-2">{error}</p>}
      {pendingDelete && (
        <ConfirmDialog
          message={`למחוק את הקטגוריה "${pendingDelete.name}"?`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
