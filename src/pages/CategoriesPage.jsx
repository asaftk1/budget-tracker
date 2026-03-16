import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc } from 'firebase/firestore'; // ✅ הוספנו deleteDoc, doc
import { getAuth } from 'firebase/auth';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { getDocs } from 'firebase/firestore';


export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState('');
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
  if (!newCategory.trim() || !user) return;

  const normalizedNew = newCategory.trim().toLowerCase();

  // בקשת בדיקה מול פיירבייס אם קטגוריה כזו כבר קיימת
  const q = query(
    collection(db, 'categories'),
    where('uid', '==', user.uid),
    where('name', '==', newCategory.trim())
  );

  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    alert('⚠️ הקטגוריה כבר קיימת');
    return;
  }

  // אם לא קיימת – הוספה
  await addDoc(collection(db, 'categories'), {
    name: newCategory.trim(),
    uid: user.uid,
  });
  setNewCategory('');
};



  const handleDeleteCategory = async (id) => {
    await deleteDoc(doc(db, 'categories', id));
  };

  return (
    <div dir = "rtl" className="p-4">
      <h2 className="text-xl font-bold mb-4">📁 הקטגוריות שלי</h2>
      <ul className="mb-4 space-y-2">
        {categories.map(cat => (
          <li key={cat.id} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded shadow-sm">
            <span>📌 {cat.name}</span>
            <button
              onClick={() => handleDeleteCategory(cat.id)}
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
    </div>
  );
}
