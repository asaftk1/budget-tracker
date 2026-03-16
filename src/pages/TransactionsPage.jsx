
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
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import 'dayjs/locale/he';

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

  const normalizeCategory = (cat) => (cat || '').trim().toLowerCase();
  const normalizeMerchantName = (name) => (name || '').trim().toLowerCase();

  const extractBillingDate = (rows, regex) => {
    for (const row of rows) {
      for (const cell of row || []) {
        if (typeof cell !== 'string') continue;
        const m = cell.match(regex);
        if (m) return m[1] ?? m[0];
      }
    }
    return null;
  };

  const cleanAmount = (value) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return value;

    const cleaned = String(value)
      .replace(/₪/g, '')
      .replace(/,/g, '')
      .replace(/\s/g, '')
      .replace(/[^\d().-]/g, '');

    if (!cleaned) return null;

    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
      const num = parseFloat(cleaned.slice(1, -1));
      return Number.isNaN(num) ? null : -num;
    }

    const num = parseFloat(cleaned);
    return Number.isNaN(num) ? null : num;
  };

  function parseExcelDate(value) {
    if (!value) return null;

    if (typeof value === 'number') {
      const utc_days = Math.floor(value - 25569);
      const date = new Date(utc_days * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }

    if (typeof value === 'string') {
      const str = value.trim();

      let m = str.match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})$/);
      if (m) {
        const [, day, month, year] = m;
        return `${year}-${month}-${day}`;
      }

      m = str.match(/^(\d{4})[\/\-.](\d{2})[\/\-.](\d{2})$/);
      if (m) {
        const [, year, month, day] = m;
        return `${year}-${month}-${day}`;
      }

      m = str.match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{2})$/);
      if (m) {
        const [, day, month, year] = m;
        const fullYear = Number(year) >= 70 ? `19${year}` : `20${year}`;
        return `${fullYear}-${month}-${day}`;
      }
    }

    return null;
  }

  function getLastDayOfPreviousMonth(dateStr) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;

    const lastDayPrev = new Date(d.getFullYear(), d.getMonth(), 0);
    return lastDayPrev.toISOString().split('T')[0];
  }

  const parseIsracardDate = (value) => {
    if (!value) return null;
    if (typeof value === 'number') return parseExcelDate(value);

    const str = String(value).trim();

    let m = str.match(/^(\d{2})[./-](\d{2})[./-](\d{2})$/);
    if (m) {
      const [, day, month, year] = m;
      const fullYear = Number(year) >= 70 ? `19${year}` : `20${year}`;
      return `${fullYear}-${month}-${day}`;
    }

    m = str.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
    if (m) {
      const [, day, month, year] = m;
      return `${year}-${month}-${day}`;
    }

    return parseExcelDate(str);
  };

  const inferCategoryFromMerchant = (merchant, merchantCategoryMap) => {
    const normalized = normalizeMerchantName(merchant);
    if (!normalized) return '';

    // קודם נסה חוקים מובנים
    const rules = [
      { keywords: ['שופרסל', 'רמי לוי', 'ויקטורי', 'יוחננוף', 'קרפור', 'מחסני השוק', 'אושר עד', 'טיב טעם', 'סיטי מרקט', 'מגה', 'יש בשכונה'], category: 'מזון וצריכה' },
      { keywords: ['סופר פארם', 'סופר-פארם', 'superpharm', 'גוד פארם', 'pharm', 'בית מרקחת', 'רוקח'], category: 'פארם וטיפוח' },
      { keywords: ['פז', 'דור אלון', 'סונול', 'דלק', 'yellow', 'ten', 'טן', 'אקסון', 'חניון', 'קנגורו'], category: 'דלק ורכב' },
      { keywords: ['ארומה', 'מקדונלד', 'מקדונלס', 'בורגר', 'קפה', 'מסעד', 'רולדין', 'greg', 'גרג', 'פיצה', 'סושי', 'שווארמה', 'פלאפל', 'מאפייה', 'בית קפה', 'שוק', 'אוכל', 'wolt', 'וולט', 'טעים', 'ברבהר', 'נונה'], category: 'מסעדות ובתי קפה' },
      { keywords: ['fox', 'zara', 'hm', 'h&m', 'castro', 'terminal x', 'טרמינל', 'מנגו', 'pull', 'bear', 'להב', 'bbw', 'victorias'], category: 'ביגוד והנעלה' },
      { keywords: ['אייבורי', 'ksp', 'מחסני חשמל', 'באג', 'bug', 'ivory', 'apple', 'samsung', 'אפל'], category: 'חשמל ואלקטרוניקה' },
      { keywords: ['אגד', 'רכבת', 'דן', 'gett', 'yango', 'פנגו', 'cellopark', 'מונית', 'אוטובוס'], category: 'תחבורה' },
      { keywords: ['בזק', 'סלקום', 'פרטנר', 'הוט', 'yes', ' 012', 'רשת'], category: 'תקשורת' },
      { keywords: ['חשמל', 'מים', 'ארנונה', 'גז', 'ועד בית'], category: 'חשבונות' },
      { keywords: ['ביטוח', 'מגדל', 'הראל', 'כלל', 'מנורה', 'איי.די.איי', 'ישיר'], category: 'ביטוח' },
      { keywords: ['בנק', 'העברה', 'bit', 'ביט', 'paybox', 'פייבוקס'], category: 'העברות כספים' },
      { keywords: ['netflix', 'spotify', 'disney', 'apple tv', 'youtube', 'openai', 'chatgpt', 'google', 'amazon', 'prime', 'patreon'], category: 'מנויים דיגיטליים' },
      { keywords: ['סופר פארם', 'מכבי', 'קופת חולים', 'רופא', 'מרפאה', 'שיניים', 'אופטיקה'], category: 'בריאות' },
    ];

    for (const rule of rules) {
      if (rule.keywords.some((kw) => normalized.includes(kw.toLowerCase()))) {
        return rule.category;
      }
    }

    // אם לא נמצא בחוקים — בדוק במפה השמורה
    if (merchantCategoryMap?.has(normalized)) {
      return merchantCategoryMap.get(normalized);
    }

    return '';
  };

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
      const merchantCategoryMap = await loadMerchantCategoryMap(user.uid);

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (json.length < 2) continue;

        if (cardType === 'isracard') {
          const hebrewMonths = {
            'ינואר': 1, 'פברואר': 2, 'מרץ': 3, 'אפריל': 4,
            'מאי': 5, 'יוני': 6, 'יולי': 7, 'אוגוסט': 8,
            'ספטמבר': 9, 'אוקטובר': 10, 'נובמבר': 11, 'דצמבר': 12
          };

          let headerCell = null;
          for (let r = 0; r < Math.min(6, json.length) && !headerCell; r++) {
            const row = json[r] || [];
            for (let c = 0; c < Math.min(8, row.length); c++) {
              const cell = row[c];
              if (typeof cell === 'string') {
                const parts = cell.trim().split(/\s+/);
                if (parts.length >= 2 && hebrewMonths[parts[0]] && /^\d{4}$/.test(parts[1])) {
                  headerCell = cell.trim();
                  break;
                }
              }
            }
          }

          if (!headerCell) {
            console.warn('לא נמצא חודש חיוב בכותרת של ישראכרט');
            continue;
          }

          const [hebrewMonth, yearStr] = headerCell.split(/\s+/);
          const headerMonth = hebrewMonths[hebrewMonth];
          const headerYear = parseInt(yearStr, 10);

          if (!headerMonth || !headerYear) {
            console.warn('כותרת חודש/שנה לא תקינה בישראכרט:', headerCell);
            continue;
          }

          const billingStr = extractBillingDate(json.slice(0, 6), /לחיוב ב-(\d{2}\.\d{2})/);

          let chargeDate = null;
          if (billingStr) {
            const [ddStr, mmStr] = billingStr.split('.');
            const dd = parseInt(ddStr, 10);
            const mm = parseInt(mmStr, 10);

            if (!Number.isNaN(dd) && !Number.isNaN(mm)) {
              chargeDate = new Date(headerYear, mm - 1, dd);
            }
          }

          if (!chargeDate) {
            chargeDate = new Date(headerYear, headerMonth - 1, 10);
          }

          const chargeDateStr = chargeDate.toISOString().split('T')[0];
          const postingDate = getLastDayOfPreviousMonth(chargeDateStr);
          if (!postingDate) {
            console.warn('לא הצלחנו לחשב תאריך שיוך לישראכרט:', chargeDateStr);
            continue;
          }

          const indexes = { date: 0, merchant: 1, amount: 4 };
          const dataRows = json.slice(9);

          for (const row of dataRows) {
            const rawDate = row[indexes.date];
            const rawMerchant = row[indexes.merchant];
            const rawAmount = row[indexes.amount];

            const looksLikeDate =
              typeof rawDate === 'string' &&
              /^\d{2}[./]\d{2}[./]\d{2,4}$/.test(rawDate.trim());

            if (!looksLikeDate) continue;

            const merchant = rawMerchant ? String(rawMerchant).trim() : '';
            const amountNum = cleanAmount(rawAmount);
            const parsedOriginalDate = parseIsracardDate(rawDate);

            if (!merchant || amountNum === null) continue;

            const category = inferCategoryFromMerchant(merchant, merchantCategoryMap) || '';

            const transaction = {
              date: postingDate,
              originalDate: parsedOriginalDate || null,
              chargeDate: chargeDateStr,
              merchant,
              category,
              amount: Math.abs(amountNum),
              type: amountNum > 0 ? 'הוצאה' : 'הכנסה',
              uid: user.uid,
              source: 'isracard',
              ...(category ? {} : { notes: 'השלם קטגוריה ידנית' }),
            };

            try {
              await addDoc(collection(db, 'transactions'), transaction);

              if (transaction.merchant && transaction.category) {
                await saveMerchantCategory(user.uid, transaction.merchant, transaction.category, merchantCategoryMap);
              }

              console.log('✅ פעולה הוספה:', transaction);
              total++;
            } catch (error) {
              console.error('שגיאה בהוספה ל-Firestore (ישראכרט):', error);
            }
          }
        } else if (cardType === 'max') {
          // בקובץ MAX השורה הרביעית היא כותרות, לכן הנתונים מתחילים באינדקס 4
          const dataRows = json.slice(4);

          for (const row of dataRows) {
            const rawTransactionDate = row[0];
            const rawMerchant = row[1];
            const rawCategory = row[2];
            const rawAmount = row[5];
            const rawChargeDate = row[9];

            // דילוג על שורות ריקות / שורות שאינן עסקאות
            if (
              !rawMerchant ||
              rawAmount === undefined ||
              rawAmount === null ||
              rawAmount === '' ||
              !rawChargeDate
            ) {
              continue;
            }

            const merchant = String(rawMerchant).trim();
            const category = typeof rawCategory === 'string' ? rawCategory.trim() : '';
            const amountNum = cleanAmount(rawAmount);
            const parsedChargeDate = parseExcelDate(rawChargeDate);
            const parsedOriginalDate = parseExcelDate(rawTransactionDate);

            if (!merchant || amountNum === null || !parsedChargeDate) {
              continue;
            }

            const postingDate = getLastDayOfPreviousMonth(parsedChargeDate);
            if (!postingDate) {
              console.warn('⚠️ לא הצלחנו לחשב תאריך שיוך ל-MAX:', { rawChargeDate, parsedChargeDate, merchant });
              continue;
            }

            const transaction = {
              date: postingDate,
              originalDate: parsedOriginalDate || null,
              chargeDate: parsedChargeDate,
              merchant,
              category,
              amount: Math.abs(amountNum),
              type: amountNum > 0 ? 'הוצאה' : 'הכנסה',
              uid: user.uid,
              source: 'max'
            };

            try {
              await addDoc(collection(db, 'transactions'), transaction);

              if (merchant && category) {
                await saveMerchantCategory(user.uid, merchant, category, merchantCategoryMap);
              }

              console.log('✅ פעולה הוספה:', transaction);
              total++;
            } catch (error) {
              console.error('❌ שגיאה בהוספה ל־Firestore:', error);
            }
          }
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

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, 'transactions', id));
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

          <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); setStep(0); setEditTransaction(null); }}>
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
                    <button onClick={() => handleEdit(tx)} className="text-xs">✏️</button>
                    <button onClick={() => handleDelete(tx.id)}>
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
                          <button onClick={() => handleEdit(tx)} className="text-xs">✏️</button>
                          <button onClick={() => handleDelete(tx.id)}>
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
