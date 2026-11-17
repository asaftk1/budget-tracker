import { AlertCircle, Pencil, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { getAgorot } from '../lib/money';
import { TYPE } from '../constants';
import { cn } from '../lib/utils';
import Money from './Money';

// One transaction, rendered either as a mobile card (variant "card") or as a desktop
// table row (variant "table"). The two variants share the same data and actions.
//   index: row position, used for zebra striping in the table variant.
// Type is shown as a badge (colour, icon and word); amounts stay neutral so colour is never
// the only carrier of the type.

// 36px hit area for icon-only buttons.
const ICON_BUTTON = 'inline-flex size-9 shrink-0 items-center justify-center rounded-control transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function TransactionRow({ tx, variant, index = 0, onEdit, onDelete, onMissingCategory }) {
  const isIncome = tx.type === TYPE.INCOME;
  const TypeIcon = isIncome ? TrendingUp : TrendingDown;

  const merchantLabel = tx.merchant || <span className="font-normal text-muted-foreground">ללא שם</span>;
  const amount = <Money agorot={getAgorot(tx)} />;

  const typeBadge = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
        isIncome ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'
      )}
    >
      <TypeIcon size={12} aria-hidden="true" />{tx.type}
    </span>
  );

  const actions = (
    <>
      <button
        type="button"
        onClick={() => onEdit(tx)}
        className={cn(ICON_BUTTON, 'text-muted-foreground hover:bg-muted hover:text-foreground')}
        aria-label="ערוך פעולה"
      >
        <Pencil size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onDelete(tx.id)}
        className={cn(ICON_BUTTON, 'text-danger hover:bg-danger/10')}
        aria-label="מחק פעולה"
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </>
  );

  const missingCategoryButton = (title) => (
    <button
      type="button"
      onClick={() => onMissingCategory(tx)}
      className={cn(ICON_BUTTON, 'text-amber-600 hover:bg-amber-50')}
      title={title}
      aria-label={title}
    >
      <AlertCircle size={18} aria-hidden="true" />
    </button>
  );

  if (variant === 'card') {
    return (
      <div className="rounded-card border bg-card p-4 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 text-sm font-semibold text-foreground">{merchantLabel}</div>
          <span className="shrink-0 text-base font-semibold text-foreground">{amount}</span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
          {tx.category || '—'}
          {!tx.category && missingCategoryButton('לא נמצאה קטגוריה, לחץ להשלמה')}
        </div>
        <div className="mt-3 flex items-center justify-between">
          {typeBadge}
          <div className="flex items-center">{actions}</div>
        </div>
      </div>
    );
  }

  return (
    <tr className={index % 2 === 0 ? 'bg-gray-50' : ''}>
      <td className="truncate px-3 py-2 text-sm font-semibold text-foreground">{merchantLabel}</td>
      <td className="px-3 py-2 text-sm text-foreground">
        <div className="flex items-center gap-1">
          <span className="truncate">{tx.category || '—'}</span>
          {!tx.category && missingCategoryButton('לא נמצאה קטגוריה')}
        </div>
      </td>
      <td className="px-3 py-2 text-sm font-medium text-foreground">{amount}</td>
      <td className="px-3 py-2">{typeBadge}</td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">{actions}</div>
      </td>
    </tr>
  );
}
