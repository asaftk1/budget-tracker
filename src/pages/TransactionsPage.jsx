
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
  where
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { getAuth } from 'firebase/auth';
import { Button } from '../components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Trash2 } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import 'dayjs/locale/he';
import { normalizeMerchantName } from '../lib/categorize';
import { parseIsracardSheet, parseMaxSheet } from '../lib/statementParsers';
import { buildTransactionId, chunk, MAX_BATCH_SIZE } from '../lib/transactionId';

dayjs.locale('he');

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [type, setType] = useState('');
  const [formData, setFormData] = useState({ date: '', category: '', amount: '' });
  const [searchType, setSearchType] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [cardType, setCardType] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [editTransaction, setEditTransaction] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [categories, setCategories] = useState([]);
  const [missingCatOpen, setMissingCatOpen] = useState(false);
  const [missingCatTx, setMissingCatTx] = useState(null);
  const [missingCatValue, setMissingCatValue] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const normalizeCategory = (cat) => (cat || '').trim().toLowerCase();

  const loadMerchantCategoryMap = async (uid) => {
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

  const saveMerchantCategory = async (uid, merchant, category, mapRef) => {
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

  const groupedByDate = transactions.reduce((acc, tx) => {
    const baseDate = tx.date;
    if (!baseDate) return acc;

    const txDate = new Date(baseDate);
    if (Number.isNaN(txDate.getTime())) return acc;

    const key = txDate.toISOString().split('T')[0];

    if (selectedMonth) {
      const [year, month] = selectedMonth.split('-');
      if (
        txDate.getFullYear().toString() !== year ||
        (txDate.getMonth() + 1).toString().padStart(2, '0') !== month
      ) {
        return acc;
      }
    } else {
      return acc;
    }

    acc[key] = acc[key] || [];
    acc[key].push(tx);
    return acc;
  }, {});

  // Maps parser warning codes to console messages.
  const warnImport = (code, detail) => {
    switch (code) {
      case 'isracard-missing-header':
        console.warn('לא נמצא חודש חיוב בכותרת של ישראכרט');
        break;
      case 'isracard-invalid-header':
        console.warn('כותרת חודש/שנה לא תקינה בישראכרט:', detail);
        break;
      case 'isracard-no-posting-date':
        console.warn('לא הצלחנו לחשב תאריך שיוך לישראכרט:', detail);
        break;
      case 'max-no-posting-date':
        console.warn('⚠️ לא הצלחנו לחשב תאריך שיוך ל-MAX:', detail);
        break;
      default:
        break;
    }
  };

  const handleFileSelection = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      console.log('Selected file:', file.name);
    }
  };

  const handleProcessImport = () => {
    console.log('📥 ייבוא התחיל...');
    if (!selectedFile) return;

    const reader = new FileReader();

    reader.onload = async (evt) => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        console.error('❌ אין משתמש מחובר');
        return;
      }

      const data = evt.target.result;
      const workbook = XLSX.read(data, { type: 'binary' });

      let total = 0;
      // Transactions to write, collected across all sheets: { id, data }.
      const pending = [];
      const merchantCategoryMap = await loadMerchantCategoryMap(user.uid);

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (json.length < 2) continue;

        let parsed = [];
        if (cardType === 'isracard') {
          parsed = parseIsracardSheet(json, { merchantCategoryMap, onWarn: warnImport });
        } else if (cardType === 'max') {
          parsed = parseMaxSheet(json, { onWarn: warnImport });
        }

        for (const { rowIndex, transaction } of parsed) {
          const docData = { ...transaction, uid: user.uid };
          pending.push({
            id: buildTransactionId({
              uid: user.uid,
              source: docData.source,
              date: docData.date,
              merchant: docData.merchant,
              amount: docData.amount,
              rowKey: `${sheetName}#${rowIndex}`,
            }),
            data: docData,
          });
        }
      }

      // Deterministic ids: re-importing the same file overwrites the same documents.
      // Every document carries uid === the signed-in user, as firestore.rules requires.
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

      console.log(`✔️ הסתיים ייבוא: נוספו ${total} פעולות`);
      setSelectedFile(null);
      setCardType('');
      setImportDialogOpen(false);
    };

    reader.readAsBinaryString(selectedFile);
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    if (!formData.date || !formData.category || !formData.amount || !type) return;

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

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

    setFormData({ date: '', category: '', amount: '' });
    setType('');
    setEditTransaction(null);
    setStep(0);
    setIsOpen(false);
  };

  const handleConfirmDelete = async () => {
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (e) {
      console.error('Failed to delete transaction', e);
      alert('מחיקת הפעולה נכשלה');
    }
  };

  const handleEdit = (tx) => {
    setEditTransaction(tx);
    setFormData({
      date: tx.date,
      category: tx.category,
      amount: tx.amount,
    });
    setType(tx.type);
    setIsOpen(true);
    setStep(1);
  };

  const handleOpenMissingCat = (tx) => {
    setMissingCatTx(tx);
    setMissingCatValue('');
    setMissingCatOpen(true);
  };

  const handleSaveMissingCat = async () => {
    if (!missingCatTx || !missingCatValue.trim()) return;

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    const category = missingCatValue.trim();

    try {
      await updateDoc(doc(db, 'transactions', missingCatTx.id), { category });
      await saveMerchantCategory(user.uid, missingCatTx.merchant, category, null);
    } catch (e) {
      console.error('Failed to update missing category', e);
    }

    setMissingCatOpen(false);
    setMissingCatTx(null);
    setMissingCatValue('');
  };

  const filteredTransactions = transactions.filter((tx) =>
    dayjs(tx.date).format('YYYY-MM') === selectedMonth
  );

  return (
    <div dir="rtl" className="p-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-4">
        <h2 className="text-2xl font-bold">כל הפעולות</h2>
        <div className="flex gap-2 items-center">
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-black border text-gray-700 hover:bg-gray-100">🔍 חיפוש</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>בחר סוג חיפוש</DialogTitle>
              </DialogHeader>

              {!searchType && (
                <div className="flex flex-col gap-3 mt-4">
                  <Button onClick={() => setSearchType('category')} className="bg-blue-100 hover:bg-blue-200">🔤 לפי קטגוריה</Button>
                  <Button onClick={() => setSearchType('date')} className="bg-blue-100 hover:bg-blue-200">📅 לפי תאריך</Button>
                </div>
              )}

              {searchType === 'category' && (
                <div className="space-y-3 mt-4">
                  <Label>קטגוריה</Label>
                  <Input
                    list="categories"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                  />
                  <datalist id="categories">
                    {categories.map((cat, index) => (
                      <option key={index} value={cat} />
                    ))}
                  </datalist>
                  <Button onClick={() => setSearchType('')}>🔙 חזור</Button>
                </div>
              )}

              {searchType === 'date' && (
                <div className="space-y-3 mt-4">
                  <Label>בחר תאריך או חודש:</Label>
                  <Input type="month" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} />
                  <Input type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} />
                  <Button onClick={() => setSearchType('')}>🔙 חזור</Button>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            setStep(0);
            setEditTransaction(null);
            if (!open) {
              setFormData({ date: '', category: '', amount: '' });
              setType('');
            }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-green-500 text-white">➕ הוסף פעולה</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>{step === 0 ? 'בחר סוג פעולה' : 'פרטי פעולה'}</DialogTitle>
              </DialogHeader>

              {step === 0 ? (
                <div className="flex flex-col gap-4 mt-4">
                  <Button className="bg-green-500 hover:bg-green-500 text-lg" onClick={() => { setType('הכנסה'); setStep(1); }}>💰 הכנסה</Button>
                  <Button className="bg-red-500 hover:bg-red-500 text-lg" onClick={() => { setType('הוצאה'); setStep(1); }}>💸 הוצאה</Button>
                </div>
              ) : (
                <div className="space-y-3 mt-4">
                  <div>
                    <Label htmlFor="date">תאריך</Label>
                    <Input type="date" name="date" value={formData.date} onChange={handleChange} />
                  </div>
                  <div>
                    <Label htmlFor="category">קטגוריה</Label>
                    <Input
                      list="category-options"
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      className="text-base focus:scale-100 transition-transform"
                    />
                    <datalist id="category-options">
                      {categories.map((cat, idx) => (
                        <option key={idx} value={cat} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <Label htmlFor="amount">סכום</Label>
                    <Input type="number" name="amount" value={formData.amount} onChange={handleChange} />
                  </div>
                  <Button className="w-full bg-green-600 text-white mt-2" onClick={handleSave}>שמור</Button>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-500 text-white">📂 ייבוא קובץ אשראי</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>ייבוא קובץ לפי סוג כרטיס</DialogTitle>
              </DialogHeader>

              {!cardType ? (
                <div className="flex flex-col gap-3">
                  <Button onClick={() => setCardType('max')} className="bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold border border-gray-300">💳 Max</Button>
                  <Button onClick={() => setCardType('isracard')} className="bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold border border-gray-300">💳 ישראכרט</Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 mt-4">
                  <p className="text-gray-700 font-medium">בחר קובץ מסוג XLSX</p>
                  <input type="file" accept=".xlsx" onChange={handleFileSelection} className="border p-1 rounded" />
                  <Button onClick={handleProcessImport} className="bg-green-500 text-white">📥 ייבוא</Button>
                  <Button onClick={() => { setCardType(''); setSelectedFile(null); }}>🔙 חזור</Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-white rounded shadow p-4">
        <h3 className="text-xl font-semibold mb-4">📋 טבלת פעולות</h3>
        <div className="mb-4">
          <label className="font-semibold mr-2">בחר שנה וחודש:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border px-2 py-1 rounded"
          />
        </div>

        {Object.keys(groupedByDate).map(date => (
          <div key={date} className="mb-6">
            <h4 className="text-lg font-bold mb-2 border-b pb-1 text-green-700">{date}</h4>

            <div className="md:hidden space-y-3">
              {groupedByDate[date].map((tx) => (
                <div key={tx.id} className="border rounded-lg p-3 shadow-sm">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    {tx.merchant || 'ללא שם'}
                    {!tx.category && (
                      <button
                        onClick={() => handleOpenMissingCat(tx)}
                        className="text-amber-600 font-bold"
                        title="לא נמצאה קטגוריה, לחץ להשלמה"
                      >
                        !
                      </button>
                    )}
                  </div>
                  <div className="text-sm"><strong>קטגוריה:</strong> {tx.category || '—'}</div>
                  <div className="text-sm"><strong>סכום:</strong> ₪{tx.amount}</div>
                  <div className={`text-sm font-bold ${tx.type === 'הכנסה' ? 'text-green-600' : 'text-red-500'}`}>{tx.type}</div>
                  <div className="flex justify-end gap-2 mt-2">
                    <button onClick={() => handleEdit(tx)} className="text-xs" aria-label="ערוך פעולה">✏️</button>
                    <button onClick={() => setPendingDeleteId(tx.id)} aria-label="מחק פעולה">
                      <Trash2 className="text-red-500 hover:text-red-700" size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right border border-gray-200 text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b text-right">
                    <th className="p-2 text-sm">בית עסק</th>
                    <th className="p-2 text-sm">קטגוריה</th>
                    <th className="p-2 text-sm">סכום</th>
                    <th className="p-2 text-sm">סוג</th>
                    <th className="p-2 text-sm text-left">🗑️</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedByDate[date].map((tx, i) => (
                    <tr key={tx.id} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                      <td className="px-2 py-1 text-sm font-semibold">{tx.merchant || 'ללא שם'}</td>
                      <td className="px-2 py-1 text-sm">
                        <div className="flex items-center gap-1">
                          {tx.category || '—'}
                          {!tx.category && (
                            <button onClick={() => handleOpenMissingCat(tx)} className="text-amber-600 font-bold" title="לא נמצאה קטגוריה">!</button>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1 text-sm">₪{tx.amount}</td>
                      <td className={`px-2 py-1 text-sm font-bold ${tx.type === 'הכנסה' ? 'text-green-600' : 'text-red-500'}`}>{tx.type}</td>
                      <td className="px-2 py-1">
                        <div className="flex justify-end items-center gap-2">
                          <button onClick={() => handleEdit(tx)} className="text-xs" aria-label="ערוך פעולה">✏️</button>
                          <button onClick={() => setPendingDeleteId(tx.id)} aria-label="מחק פעולה">
                            <Trash2 className="text-red-500 hover:text-red-700" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {pendingDeleteId && (
        <ConfirmDialog
          message="למחוק את הפעולה?"
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}

      <Dialog open={missingCatOpen} onOpenChange={setMissingCatOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>לא נמצאה קטגוריה במפה</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="text-sm text-gray-700">
              בית עסק: <span className="font-semibold">{missingCatTx?.merchant || '—'}</span>
            </div>
            <div>
              <Label htmlFor="missingCat">הזן קטגוריה</Label>
              <Input
                id="missingCat"
                value={missingCatValue}
                onChange={(e) => setMissingCatValue(e.target.value)}
                placeholder="לדוגמה: מזון וצריכה"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMissingCatOpen(false)}>בטל</Button>
              <Button className="bg-green-600 text-white" onClick={handleSaveMissingCat}>שמור</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
