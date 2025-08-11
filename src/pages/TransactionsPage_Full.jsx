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
  const [selectedFile, setSelectedFile] = useState(null);
  const [cardType, setCardType] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editTransaction, setEditTransaction] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('');

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    const q = query(collection(db, 'transactions'), where('uid', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sorted = data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(sorted);
    });

    return () => unsub();
  }, []);

  const groupedByDate = transactions.reduce((acc, tx) => {
    let txDate = new Date(tx.date);
    if (txDate.getDate() === 10) {
      const year = txDate.getFullYear();
      const month = txDate.getMonth();
      const lastDayPrevMonth = new Date(year, month, 0);
      txDate = lastDayPrevMonth;
    }

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

  const parseExcelDate = (value) => {
    if (typeof value === 'number') {
      const utc_days = Math.floor(value - 25569);
      const date = new Date(utc_days * 86400 * 1000);
      return date.toISOString().split('T')[0];
    } else if (typeof value === 'string') {
      const parts = value.split(/[\/\-\.]/);
      let day, month, year;
      if (parts[2]?.length === 4) {
        [day, month, year] = parts;
      } else {
        [year, month, day] = parts;
      }
      if (!day || !month || !year) return null;
      const date = new Date(`${year}-${month}-${day}`);
      return date.toISOString().split('T')[0];
    }
    return null;
  };

  const handleProcessImport = () => {
    if (!selectedFile) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;

      const data = evt.target.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      let total = 0;

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (cardType === 'max') {
          const dataRows = json.slice(1);
          for (const row of dataRows) {
            const rawDate = row[9];
            const rawCategory = row[2];
            const rawAmount = row[5];
            const parsedDate = parseExcelDate(rawDate);
            if (!parsedDate || !rawCategory || rawAmount === undefined) continue;

            const transaction = {
              date: parsedDate,
              category: String(rawCategory).trim(),
              amount: Math.abs(Number(rawAmount)),
              type: Number(rawAmount) > 0 ? 'הוצאה' : 'הכנסה',
              uid: user.uid
            };

            try {
              await addDoc(collection(db, 'transactions'), transaction);
              total++;
            } catch (err) {
              console.error('שגיאה בהוספה:', err);
            }
          }
        }

        // 🔁 הוספה ל־isracard יכולה להיות כאן
      }

      setSelectedFile(null);
      setCardType('');
      setImportDialogOpen(false);
      console.log(`נוספו ${total} פעולות`);
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, 'transactions', id));
  };

  const handleEdit = (tx) => {
    setEditTransaction(tx);
    setFormData({ date: tx.date, category: tx.category, amount: tx.amount });
    setType(tx.type);
    setIsOpen(true);
    setStep(1);
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!formData.date || !formData.category || !formData.amount || !type || !user) return;

    const transactionData = {
      ...formData,
      amount: parseFloat(formData.amount),
      type,
      uid: user.uid,
    };

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

  return (
    <div>
      {/* שאר רכיבי הממשק – ייבוא, טבלה, כפתורים – כבר קיימים בקוד שלך */}
    </div>
  );
}
