
import { useMemo, useState } from 'react';
import { getAuth } from 'firebase/auth';
import useTransactions, { loadMerchantCategoryMap, commitTransactions } from '../hooks/useTransactions';
import { Button } from '../components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import TransactionRow from '../components/TransactionRow';
import TransactionDialog from '../components/TransactionDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import 'dayjs/locale/he';
import { parseIsracardSheet, parseMaxSheet } from '../lib/statementParsers';
import { buildTransactionId } from '../lib/transactionId';
import { dedupeCategories } from '../lib/categories';
import { amountError, formatMoney, getAgorot, fromAgorot, MAX_AMOUNT_AGOROT } from '../lib/money';

// Form messages for amountError() codes.
const AMOUNT_MESSAGES = {
  required: 'יש להזין סכום',
  invalid: 'הסכום חייב להיות מספר גדול מאפס',
  'too-large': `הסכום גבוה מדי (מקסימום ${formatMoney(MAX_AMOUNT_AGOROT, { fractionDigits: 0 })})`,
};

dayjs.locale('he');

export default function TransactionsPage() {
  const {
    transactions,
    categories,
    saveTransaction,
    deleteTransaction,
    updateTransactionCategory,
  } = useTransactions();
  // One entry per category in the suggestion lists (existing duplicates are not deleted).
  const categoryOptions = useMemo(() => dedupeCategories(categories), [categories]);
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [type, setType] = useState('');
  const [formData, setFormData] = useState({ date: '', category: '', amount: '' });
  const [amountErrorCode, setAmountErrorCode] = useState(null);
  const [searchType, setSearchType] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [cardType, setCardType] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [editTransaction, setEditTransaction] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [missingCatOpen, setMissingCatOpen] = useState(false);
  const [missingCatTx, setMissingCatTx] = useState(null);
  const [missingCatValue, setMissingCatValue] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

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
      case 'invalid-amount':
        console.warn('Skipped a row with an invalid amount:', detail);
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
      total = await commitTransactions(pending);

      console.log(`✔️ הסתיים ייבוא: נוספו ${total} פעולות`);
      setSelectedFile(null);
      setCardType('');
      setImportDialogOpen(false);
    };

    reader.readAsBinaryString(selectedFile);
  };

  const handleChange = (e) => {
    if (e.target.name === 'amount') setAmountErrorCode(null);
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleTransactionDialogOpenChange = (open) => {
    setIsOpen(open);
    setStep(0);
    setEditTransaction(null);
    setAmountErrorCode(null);
    if (!open) {
      setFormData({ date: '', category: '', amount: '' });
      setType('');
    }
  };

  const handleSelectType = (selectedType) => {
    setType(selectedType);
    setStep(1);
  };

  const handleSave = async () => {
    const invalidAmount = amountError(formData.amount);
    if (invalidAmount) {
      setAmountErrorCode(invalidAmount);
      return;
    }
    if (!formData.date || !formData.category || !type) return;

    const saved = await saveTransaction({ formData, type, editTransaction });
    if (!saved) return;

    setFormData({ date: '', category: '', amount: '' });
    setAmountErrorCode(null);
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
      await deleteTransaction(id);
    } catch (e) {
      console.error('Failed to delete transaction', e);
      alert('מחיקת הפעולה נכשלה');
    }
  };

  const handleEdit = (tx) => {
    setEditTransaction(tx);
    setAmountErrorCode(null);
    setFormData({
      date: tx.date,
      category: tx.category,
      amount: fromAgorot(getAgorot(tx)),
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

    const category = missingCatValue.trim();

    // proceed is false only when nobody is signed in; errors are logged and the dialog still closes.
    let proceed = true;
    try {
      proceed = await updateTransactionCategory(missingCatTx, category);
    } catch (e) {
      console.error('Failed to update missing category', e);
    }
    if (!proceed) return;

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
                    {categoryOptions.map((cat) => (
                      <option key={cat} value={cat} />
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

          <TransactionDialog
            open={isOpen}
            onOpenChange={handleTransactionDialogOpenChange}
            step={step}
            formData={formData}
            amountError={amountErrorCode ? AMOUNT_MESSAGES[amountErrorCode] : ''}
            categories={categoryOptions}
            onChange={handleChange}
            onSelectType={handleSelectType}
            onSave={handleSave}
          />

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
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  variant="card"
                  onEdit={handleEdit}
                  onDelete={setPendingDeleteId}
                  onMissingCategory={handleOpenMissingCat}
                />
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
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      variant="table"
                      index={i}
                      onEdit={handleEdit}
                      onDelete={setPendingDeleteId}
                      onMissingCategory={handleOpenMissingCat}
                    />
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
