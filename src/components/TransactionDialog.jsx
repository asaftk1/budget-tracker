import { Button } from './ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';

// Add/edit transaction dialog with its trigger button. It is controlled by the parent.
//   step 0: choose income or expense; step 1: the details form.
//   onChange: input change handler for the form fields (named date, category, amount).
//   onSelectType(type): called with 'הכנסה' or 'הוצאה' from step 0.
export default function TransactionDialog({
  open,
  onOpenChange,
  step,
  formData,
  categories,
  onChange,
  onSelectType,
  onSave,
}) {
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
            <Button className="bg-green-500 hover:bg-green-500 text-lg" onClick={() => onSelectType('הכנסה')}>💰 הכנסה</Button>
            <Button className="bg-red-500 hover:bg-red-500 text-lg" onClick={() => onSelectType('הוצאה')}>💸 הוצאה</Button>
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            <div>
              <Label htmlFor="date">תאריך</Label>
              <Input type="date" name="date" value={formData.date} onChange={onChange} />
            </div>
            <div>
              <Label htmlFor="category">קטגוריה</Label>
              <Input
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
              <Label htmlFor="amount">סכום</Label>
              <Input type="number" name="amount" value={formData.amount} onChange={onChange} />
            </div>
            <Button className="w-full bg-green-600 text-white mt-2" onClick={onSave}>שמור</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
