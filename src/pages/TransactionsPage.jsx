
import { useMemo, useState } from 'react';
import { getAuth } from 'firebase/auth';
import useTransactions, { loadMerchantCategoryMap, commitTransactions } from '../hooks/useTransactions';
import { ArrowRight, CreditCard, Eraser, Search, Table, Upload } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import PageState from '../components/PageState';
import TransactionRow from '../components/TransactionRow';
import TransactionDialog from '../components/TransactionDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import 'dayjs/locale/he';
import { parseIsracardSheet, parseMaxSheet } from '../lib/statementParsers';
import { buildTransactionId } from '../lib/transactionId';
import { dedupeCategories } from '../lib/categories';
import { formatDisplayDate } from '../lib/formatDate';
import { groupTransactionsByDate, groupTransactionsByDay } from '../lib/summaries';
import { EMPTY_FILTERS, filterTransactions, hasActiveFilter } from '../lib/filterTransactions';
import { SOURCE } from '../constants';
import { devLog } from '../lib/devLog';
import { buildImportReport } from '../lib/importReport';
import { checkImportFile, IMPORT_FILE_ERRORS } from '../lib/importFile';
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
    loading,
    error: loadError,
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
  // Search filters (see lib/filterTransactions). Separate from formData, which belongs to the add form.
  const [search, setSearch] = useState(EMPTY_FILTERS);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  // Outcome of the last import, shown in the import dialog: { tone, lines } or null.
  const [importResult, setImportResult] = useState(null);
  // Hebrew message for a rejected or unreadable file, shown in the import dialog ('' when none).
  const [importError, setImportError] = useState('');
  const [cardType, setCardType] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [editTransaction, setEditTransaction] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [missingCatOpen, setMissingCatOpen] = useState(false);
  const [missingCatTx, setMissingCatTx] = useState(null);
  const [missingCatValue, setMissingCatValue] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  // Hebrew messages for failed writes. saveError shows inside the open dialog; deleteError above the table.
  const [saveError, setSaveError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // What the table shows, grouped by day. An active search covers all months and ignores the
  // month picker; otherwise it is the selected month.
  const searchActive = hasActiveFilter(search);
  const groupedByDate = useMemo(
    () => (searchActive
      ? groupTransactionsByDay(filterTransactions(transactions, search))
      : groupTransactionsByDate(transactions, selectedMonth)),
    [transactions, selectedMonth, search, searchActive]
  );
  const updateSearch = (field) => (e) => setSearch((prev) => ({ ...prev, [field]: e.target.value }));

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

  const handleImportDialogOpenChange = (open) => {
    setImportDialogOpen(open);
    if (open) {
      setImportResult(null);
      setImportError('');
    }
  };

  const handleFileSelection = async (e) => {
    const input = e.target;
    const file = input.files?.[0];
    setImportError('');
    if (!file) return;

    // Reject by size and type before the file is read or parsed.
    const problem = await checkImportFile(file);
    if (problem) {
      setSelectedFile(null);
      setImportError(IMPORT_FILE_ERRORS[problem]);
      input.value = '';
      return;
    }
    setSelectedFile(file);
    devLog('Selected file:', file.name);
  };

  const handleProcessImport = () => {
    devLog('📥 ייבוא התחיל...');
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
      // A corrupt or unsupported file must not fail silently: report it in the dialog.
      const failRead = (err) => {
        console.error('Failed to read the import file', err);
        setSelectedFile(null);
        setImportError(IMPORT_FILE_ERRORS.unreadable);
      };

      let workbook;
      try {
        workbook = XLSX.read(data, { type: 'binary' });
      } catch (err) {
        failRead(err);
        return;
      }

      let total = 0;
      // Counts for the result message. Only the parser's own 'invalid-amount' warning means a skipped row.
      let invalidAmount = 0;
      let emptySheets = 0;
      const failedChunks = { count: 0, rows: 0 };
      const onWarn = (code, detail) => {
        if (code === 'invalid-amount') invalidAmount += 1;
        warnImport(code, detail);
      };
      // Transactions to write, collected across all sheets: { id, data }.
      const pending = [];
      const merchantCategoryMap = await loadMerchantCategoryMap(user.uid);

      try {
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (json.length < 2) {
            emptySheets += 1;
            continue;
          }

          let parsed = [];
          if (cardType === SOURCE.ISRACARD) {
            parsed = parseIsracardSheet(json, { merchantCategoryMap, onWarn });
          } else if (cardType === SOURCE.MAX) {
            parsed = parseMaxSheet(json, { onWarn });
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
      } catch (err) {
        failRead(err);
        return;
      }

      // Deterministic ids: re-importing the same file overwrites the same documents.
      // Every document carries uid === the signed-in user, as firestore.rules requires.
      total = await commitTransactions(pending, ({ rows }) => {
        failedChunks.count += 1;
        failedChunks.rows += rows;
      });

      devLog(`✔️ הסתיים ייבוא: נוספו ${total} פעולות`);
      setSelectedFile(null);
      setCardType('');
      // The dialog stays open to show what happened.
      setImportResult(buildImportReport({
        imported: total,
        attempted: pending.length,
        failedRows: failedChunks.rows,
        failedChunks: failedChunks.count,
        invalidAmount,
        emptySheets,
      }));
    };

    reader.onerror = () => {
      console.error('Failed to read the import file', reader.error);
      setSelectedFile(null);
      setImportError(IMPORT_FILE_ERRORS.unreadable);
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
    setSaveError('');
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

    // A failed write keeps the dialog open and the form as typed, so nothing is lost.
    let saved;
    try {
      setSaveError('');
      saved = await saveTransaction({ formData, type, editTransaction });
    } catch (e) {
      console.error('Failed to save transaction', e);
      setSaveError('השמירה נכשלה. בדוק/י את החיבור ונסה/י שוב.');
      return;
    }
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
    setDeleteError('');
    if (!id) return;
    try {
      await deleteTransaction(id);
    } catch (e) {
      console.error('Failed to delete transaction', e);
      setDeleteError('מחיקת הפעולה נכשלה. נסה/י שוב.');
    }
  };

  const handleEdit = (tx) => {
    setEditTransaction(tx);
    setAmountErrorCode(null);
    setSaveError('');
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

  const days = Object.keys(groupedByDate);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">כל הפעולות</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline"><Search size={18} aria-hidden="true" />חיפוש</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>חיפוש פעולות</DialogTitle>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="search-text">טקסט (בית עסק, תיאור או קטגוריה)</Label>
                  <Input id="search-text" value={search.text} onChange={updateSearch('text')} />
                </div>

                <div>
                  <Label htmlFor="search-category">קטגוריה</Label>
                  <Input
                    id="search-category"
                    list="categories"
                    value={search.category}
                    onChange={updateSearch('category')}
                  />
                  <datalist id="categories">
                    {categoryOptions.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="search-from">מתאריך</Label>
                    <Input id="search-from" type="date" value={search.from} onChange={updateSearch('from')} />
                  </div>
                  <div>
                    <Label htmlFor="search-to">עד תאריך</Label>
                    <Input id="search-to" type="date" value={search.to} onChange={updateSearch('to')} />
                  </div>
                </div>

                <Button variant="outline" className="w-full" onClick={() => setSearch(EMPTY_FILTERS)}>
                  <Eraser size={16} aria-hidden="true" />נקה חיפוש
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <TransactionDialog
            open={isOpen}
            onOpenChange={handleTransactionDialogOpenChange}
            step={step}
            formData={formData}
            amountError={amountErrorCode ? AMOUNT_MESSAGES[amountErrorCode] : ''}
            saveError={saveError}
            categories={categoryOptions}
            onChange={handleChange}
            onSelectType={handleSelectType}
            onSave={handleSave}
          />

          <Dialog open={importDialogOpen} onOpenChange={handleImportDialogOpenChange}>
            <DialogTrigger asChild>
              <Button variant="secondary"><Upload size={18} aria-hidden="true" />ייבוא קובץ אשראי</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>ייבוא קובץ לפי סוג כרטיס</DialogTitle>
              </DialogHeader>

              {importResult ? (
                <div className="mt-4 flex flex-col gap-4">
                  <div role={importResult.tone === 'success' || importResult.tone === 'info' ? 'status' : 'alert'}
                    className={importResult.tone === 'success' || importResult.tone === 'info' ? 'text-foreground' : 'text-danger'}>
                    {importResult.lines.map((line) => <p key={line} className="mb-1">{line}</p>)}
                  </div>
                  <Button onClick={() => handleImportDialogOpenChange(false)}>סגור</Button>
                </div>
              ) : !cardType ? (
                <div className="mt-4 flex flex-col gap-3">
                  <Button variant="outline" size="lg" onClick={() => setCardType(SOURCE.MAX)} className="justify-start">
                    <CreditCard size={20} aria-hidden="true" />Max
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => setCardType(SOURCE.ISRACARD)} className="justify-start">
                    <CreditCard size={20} aria-hidden="true" />ישראכרט
                  </Button>
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-3">
                  <p id="import-file-label" className="font-medium text-foreground">בחר קובץ מסוג XLSX</p>
                  <input
                    type="file"
                    accept=".xlsx"
                    aria-labelledby="import-file-label"
                    onChange={handleFileSelection}
                    className="block w-full rounded-control border border-input bg-background p-2 text-sm file:me-3 file:rounded-control file:border-0 file:bg-primary-soft file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary"
                  />
                  {importError && <p role="alert" className="text-sm text-danger">{importError}</p>}
                  <Button onClick={handleProcessImport}><Upload size={18} aria-hidden="true" />ייבוא</Button>
                  <Button variant="outline" onClick={() => { setCardType(''); setSelectedFile(null); setImportError(''); }}>
                    <ArrowRight size={18} aria-hidden="true" />חזור
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="p-4 sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Table size={20} className="text-muted-foreground" aria-hidden="true" />
          טבלת פעולות
        </h2>
        {deleteError && <p role="alert" className="mb-3 text-sm text-danger">{deleteError}</p>}
        {searchActive && (
          <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-control border border-primary/30 bg-primary-soft px-3 py-2 text-sm text-foreground">
            <Search size={16} className="text-primary" aria-hidden="true" />
            <span>מציג תוצאות חיפוש מכל החודשים</span>
            <Button size="sm" variant="outline" onClick={() => setSearch(EMPTY_FILTERS)}>נקה חיפוש</Button>
          </div>
        )}
        <div className="mb-6 flex items-center gap-2">
          <label htmlFor="selected-month" className="text-sm font-medium text-foreground">בחר שנה וחודש:</label>
          <Input
            id="selected-month"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            disabled={searchActive}
            inputSize="sm"
            className="max-w-[11rem]"
          />
        </div>

        <PageState
          loading={loading}
          error={loadError}
          hasData={transactions.length > 0}
          isEmpty={transactions.length === 0}
          emptyMessage="אין עדיין פעולות. הוסף/י פעולה או ייבא/י קובץ אשראי."
        >
        {searchActive && days.length === 0 && (
          <p className="text-muted-foreground">לא נמצאו תוצאות</p>
        )}
        {!searchActive && days.length === 0 && (
          <p className="text-muted-foreground">אין פעולות בחודש הזה</p>
        )}

        {/* Mobile: one card per transaction under a heading for each day */}
        <div className="space-y-6 md:hidden">
          {days.map(date => (
            <section key={date}>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{formatDisplayDate(date)}</h3>
              <div className="space-y-3">
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
            </section>
          ))}
        </div>

        {/* Desktop: one table, fixed column widths, one body per day with its date as a heading
            row, so the columns line up across days */}
        {days.length > 0 && (
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[28%]" />
                <col className="w-[16%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th scope="col" className="px-3 py-2 text-start text-xs font-medium">בית עסק</th>
                  <th scope="col" className="px-3 py-2 text-start text-xs font-medium">קטגוריה</th>
                  <th scope="col" className="px-3 py-2 text-start text-xs font-medium">סכום</th>
                  <th scope="col" className="px-3 py-2 text-start text-xs font-medium">סוג</th>
                  <th scope="col" className="px-3 py-2 text-end text-xs font-medium"><span className="sr-only">פעולות</span></th>
                </tr>
              </thead>
              {days.map(date => (
                <tbody key={date}>
                  <tr>
                    <th scope="colgroup" colSpan={5} className="px-3 pb-1 pt-5 text-start text-sm font-semibold text-foreground">
                      {formatDisplayDate(date)}
                    </th>
                  </tr>
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
              ))}
            </table>
          </div>
        )}
        </PageState>
      </Card>

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
          <div className="mt-4 space-y-4">
            <div className="text-sm text-muted-foreground">
              בית עסק: <span className="font-semibold text-foreground">{missingCatTx?.merchant || '—'}</span>
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
              <Button onClick={handleSaveMissingCat}>שמור</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
