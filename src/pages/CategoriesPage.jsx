import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc } from 'firebase/firestore'; // ✅ הוספנו deleteDoc, doc
import { getAuth } from 'firebase/auth';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { getDocs } from 'firebase/firestore';
import ConfirmDialog from '../components/ConfirmDialog';
import { cleanCategoryName, hasCategory } from '../lib/categories';


export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const user = getAuth().currentUser;

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'categories'), where('uid', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user]);

  const addCategory = async () => {
    const name = cleanCategoryName(newCategory);
    if (!name || !user) return;

    // Read the user's categories and compare case-insensitively; Firestore cannot do that itself.
    const snapshot = await getDocs(query(collection(db, 'categories'), where('uid', '==', user.uid)));
    if (hasCategory(snapshot.docs.map((d) => d.data().name), name)) {
      alert('⚠️ הקטגוריה כבר קיימת');
      return;
    }

    await addDoc(collection(db, 'categories'), { name, uid: user.uid });
    setNewCategory('');
  };

  const handleConfirmDelete = async () => {
    const id = pendingDelete?.id;
    setPendingDelete(null);
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (e) {
      console.error('Failed to delete category', e);
      alert('מחיקת הקטגוריה נכשלה');
    }
  };

  return (
    <div dir = "rtl" className="p-4">
      <h2 className="text-xl font-bold mb-4">📁 הקטגוריות שלי</h2>
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
      <div className="flex gap-2">
        <Input
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          placeholder="הוסף קטגוריה חדשה"
        />
        <Button onClick={addCategory}>➕ הוסף</Button>
      </div>
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
