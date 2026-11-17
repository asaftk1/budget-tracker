import { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, deleteDoc, doc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Input } from '../components/ui/input';
import { Plus, Tag, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">הקטגוריות שלי</h1>

      <Card className="p-4 sm:p-6">
        <div className="flex gap-2">
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="הוסף קטגוריה חדשה"
            aria-label="שם קטגוריה חדשה"
          />
          <Button onClick={addCategory} className="shrink-0"><Plus size={18} aria-hidden="true" />הוסף</Button>
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      </Card>

      <PageState
        loading={loading}
        error={loadError}
        hasData={categories.length > 0}
        isEmpty={categories.length === 0}
        emptyMessage="אין עדיין קטגוריות. הוסף/י את הראשונה למעלה."
      >
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map(cat => (
          <li key={cat.id} className="flex items-center justify-between gap-2 rounded-control border bg-card ps-3 pe-1 py-1 shadow-card">
            <span className="flex min-w-0 items-center gap-2 text-foreground">
              <Tag size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{cat.name}</span>
            </span>
            <button
              type="button"
              aria-label={`מחק קטגוריה ${cat.name}`}
              onClick={() => setPendingDelete(cat)}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-control text-danger transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      </PageState>

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
