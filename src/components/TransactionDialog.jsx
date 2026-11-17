import { Button } from './ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { MAX_AMOUNT_AGOROT, fromAgorot } from '../lib/money';
import { TYPE } from '../constants';

// Add/edit transaction dialog with its trigger button. It is controlled by the parent.
//   step 0: choose income or expense; step 1: the details form.
//   amountError: validation message for the amount field ('' when valid).
//   saveError: message shown when the last save failed ('' otherwise); the form keeps its values.
//   onSave: called on submit (button click or Enter); the parent validates and saves.
//   onChange: input change handler for the form fields (named date, category, amount).
//   onSelectType(type): called with TYPE.INCOME or TYPE.EXPENSE from step 0.
export default function TransactionDialog({
  open,
  onOpenChange,
  step,
  formData,
  amountError = '',
  saveError = '',
  categories,
  onChange,
  onSelectType,
  onSave,
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSave();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="bg-green-500 text-white">➕ הוסף פעולה</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{step === 0 ? 'בחר סוג פעולה' : 'פרטי פעולה'}</DialogTitle>
        </DialogHeader>

        {step === 0 ? (
          <div className="flex flex-col gap-4 mt-4">
            <Button className="bg-green-500 hover:bg-green-500 text-lg" onClick={() => onSelectType(TYPE.INCOME)}>💰 הכנסה</Button>
            <Button className="bg-red-500 hover:bg-red-500 text-lg" onClick={() => onSelectType(TYPE.EXPENSE)}>💸 הוצאה</Button>
          </div>
        ) : (
          <form className="space-y-3 mt-4" noValidate onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="transaction-date">תאריך</Label>
              <Input id="transaction-date" type="date" name="date" value={formData.date} onChange={onChange} />
            </div>
            <div>
              <Label htmlFor="transaction-category">קטגוריה</Label>
              <Input
                id="transaction-category"
                list="category-options"
                name="category"
                value={formData.category}
                onChange={onChange}
                className="text-base focus:scale-100 transition-transform"
              />
              <datalist id="category-options">
                {categories.map((cat, idx) => (
                  <option key={idx} value={cat} />
                ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="transaction-amount">סכום</Label>
              <Input
                id="transaction-amount"
                type="number"
                name="amount"
                value={formData.amount}
                onChange={onChange}
                min="0.01"
                max={fromAgorot(MAX_AMOUNT_AGOROT)}
                step="0.01"
                inputMode="decimal"
                required
                aria-invalid={amountError ? 'true' : undefined}
                aria-describedby={amountError ? 'amount-error' : undefined}
              />
              {amountError && (
                <p id="amount-error" role="alert" className="text-red-600 text-sm mt-1">{amountError}</p>
              )}
            </div>
            {saveError && (
              <p role="alert" className="text-red-600 text-sm">{saveError}</p>
            )}
            <Button type="submit" className="w-full bg-green-600 text-white mt-2">שמור</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
