import { useEffect, useState } from 'react';
import { db } from '../firebase';
import {
    collection,
    onSnapshot,
    addDoc,
    deleteDoc,
    doc,
    updateDoc,
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
    const [searchCategory, setSearchCategory] = useState('');
    const [searchDate, setSearchDate] = useState('');
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [cardType, setCardType] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [editTransaction, setEditTransaction] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
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
                const data = snap.docs.map(doc => doc.data().name); // שמור רק את השמות
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
        let txDate = new Date(tx.date);


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

    function parseExcelDate(value) {
        if (typeof value === 'number') {
            // תאריך בפורמט מספרי של Excel - בלי בעיות TimeZone
            const utc_days = Math.floor(value - 25569);
            const date = new Date(utc_days * 86400 * 1000);
            // החזר פורמט אחיד
            return date.toISOString().split('T')[0];  // YYYY-MM-DD
        } else if (typeof value === 'string') {
            const parts = value.split(/[\/\-\.]/); // תומך גם ב־7/9/2025 וגם 2025-09-07
            let day, month, year;

            if (parts[2]?.length === 4) {
                // נניח DD/MM/YYYY
                [day, month, year] = parts;
            } else {
                // נניח YYYY-MM-DD
                [year, month, day] = parts;
            }

            if (!day || !month || !year) return null;

            const date = new Date(`${year}-${month}-${day}`);
            return date.toISOString().split('T')[0];
        }

        return null;
    }

    const handleProcessImport = () => {
        console.log('📥 ייבוא התחיל...');
        if (!selectedFile) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const auth = getAuth();
            const user = auth.currentUser;
            if (!user) {
                console.error("❌ אין משתמש מחובר");
                return;
            }

            const data = evt.target.result;
            const workbook = XLSX.read(data, { type: 'binary' });

            let total = 0;

            for (const sheetName of workbook.SheetNames) {
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                if (json.length < 10) continue;

                // ✅ ישראכרט
                if (cardType === 'isracard') {
                    const titleCell = json[0][2]; // לדוגמה "יוני 2025"
                    if (!titleCell) {
                        console.warn('❌ לא נמצא תאריך חיוב בכותרת');
                        return;
                    }

                    const [hebrewMonth, yearStr] = titleCell.trim().split(' ');
                    const hebrewMonths = {
                        'ינואר': 1, 'פברואר': 2, 'מרץ': 3, 'אפריל': 4,
                        'מאי': 5, 'יוני': 6, 'יולי': 7, 'אוגוסט': 8,
                        'ספטמבר': 9, 'אוקטובר': 10, 'נובמבר': 11, 'דצמבר': 12
                    };
                    const month = hebrewMonths[hebrewMonth];
                    const year = parseInt(yearStr);

                    if (!month || !year) {
                        console.warn('❌ לא הצלחנו להבין את חודש החיוב:', titleCell);
                        return;
                    }

                    const targetDate = new Date(year, month - 2, 28);
                    const formattedDate = targetDate.toISOString().split('T')[0];

                    const dataRows = json.slice(9);  // מתחילים משורה 10

                    for (const row of dataRows) {
                        const firstCell = row[0];
                        const rawCategory = row[1];
                        const rawAmount = row[4];

                        const isDate = typeof firstCell === 'string' && /^\d{2}\.\d{2}\.\d{2}$/.test(firstCell.trim());
                        if (!isDate || !rawCategory || rawAmount === undefined || isNaN(Number(rawAmount))) continue;

                        const transaction = {
                            date: formattedDate,
                            category: String(rawCategory).trim(),
                            amount: Math.abs(Number(rawAmount)),
                            type: Number(rawAmount) > 0 ? 'הוצאה' : 'הכנסה',
                            uid: user.uid
                        };

                        try {
                            await addDoc(collection(db, 'transactions'), transaction);
                            console.log('✅ פעולה הוספה:', transaction);
                            total++;
                        } catch (error) {
                            console.error('❌ שגיאה בהוספה ל־Firestore:', error);
                        }
                    }
                }

                // ✅ מקס
                else if (cardType === 'max') {
                    const dataRows = json.slice(1);
                    const dateIdx = 9;
                    const categoryIdx = 2;
                    const amountIdx = 5;

                    for (const row of dataRows) {
                        const rawDate = row[dateIdx];
                        const rawCategory = row[categoryIdx];
                        const rawAmount = row[amountIdx];

                        if (!rawDate || !rawCategory || rawAmount === undefined) {
                            console.warn('⚠️ שורה חסרה:', row);
                            continue;
                        }

                        const parsedDate = parseExcelDate(rawDate);
                        if (!parsedDate) {
                            console.warn('⚠️ תאריך לא תקין:', rawDate);
                            continue;
                        }
                        const d = new Date(parsedDate);
                        // ↓↓↓ הוספה חשובה ↓↓↓
                        d.setMonth(d.getMonth() - 1);  // חודש קודם
                        d.setDate(28);                 // יום 28 בחודש הקודם
                        const formattedDate = d.toISOString().split('T')[0];

                        const transaction = {
                            date: formattedDate,
                            category: String(rawCategory).trim(),
                            amount: Math.abs(Number(rawAmount)),
                            type: Number(rawAmount) > 0 ? 'הוצאה' : 'הכנסה',
                            uid: user.uid
                        };

                        try {
                            await addDoc(collection(db, 'transactions'), transaction);
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
        // ➕ בדיקה אם הקטגוריה חדשה
        if (!normalizedCategories.includes(currentCat)) {
            await addDoc(collection(db, 'categories'), {
                name: formData.category.trim(),  // שמור את הגרסה הנקייה
                uid: user.uid
            });
        }

        // הוספת פעולה
        if (editTransaction) {
            const docRef = doc(db, 'transactions', editTransaction.id);
            await updateDoc(docRef, transactionData);
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
        // 🗑️ מחיקת פעולה לפי מזהה
        await deleteDoc(doc(db, 'transactions', id));
    };

    const handleEdit = (tx) => {
        // ✏️ מעבר למצב עריכה עם הנתונים הקיימים
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

    const filteredTransactions = transactions.filter((tx) =>
        dayjs(tx.date).format('YYYY-MM') === selectedMonth
    );


    function normalizeCategory(cat) {
        return cat.trim().toLowerCase();
    }

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

                        {/* גרסת מובייל - מציג כל פעולה ככרטיס */}
                        <div className="md:hidden space-y-3">
                            {groupedByDate[date].map((tx) => (
                                <div key={tx.id} className="border rounded-lg p-3 shadow-sm">
                                    <div className="text-sm"><strong>קטגוריה:</strong> {tx.category}</div>
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

                        {/* גרסת דסקטופ - טבלה רגילה */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-right border border-gray-200 text-sm border-collapse">
                                <thead>
                                    <tr className="bg-gray-100 border-b text-right">
                                        <th className="p-2 text-sm">קטגוריה</th>
                                        <th className="p-2 text-sm">סכום</th>
                                        <th className="p-2 text-sm">סוג</th>
                                        <th className="p-2 text-sm text-left">🗑️</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupedByDate[date].map((tx, i) => (
                                        <tr key={tx.id} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                                            <td className="px-2 py-1 text-sm">{tx.category}</td>
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
        </div>
    );
}
