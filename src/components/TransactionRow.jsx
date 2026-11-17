import { Trash2 } from 'lucide-react';

// One transaction, rendered either as a mobile card (variant "card") or as a desktop
// table row (variant "table"). The two variants share the same data and actions.
//   index: row position, used for zebra striping in the table variant.
export default function TransactionRow({ tx, variant, index = 0, onEdit, onDelete, onMissingCategory }) {
  const isIncome = tx.type === 'הכנסה';
  const typeColor = isIncome ? 'text-green-600' : 'text-red-500';

  const actions = (
    <>
      <button onClick={() => onEdit(tx)} className="text-xs" aria-label="ערוך פעולה">✏️</button>
      <button onClick={() => onDelete(tx.id)} aria-label="מחק פעולה">
        <Trash2 className="text-red-500 hover:text-red-700" size={14} />
      </button>
    </>
  );

  const missingCategoryButton = (title) => (
    <button onClick={() => onMissingCategory(tx)} className="text-amber-600 font-bold" title={title}>!</button>
  );

  if (variant === 'card') {
    return (
      <div className="border rounded-lg p-3 shadow-sm">
        <div className="text-sm font-semibold flex items-center gap-2">
          {tx.merchant || 'ללא שם'}
          {!tx.category && missingCategoryButton('לא נמצאה קטגוריה, לחץ להשלמה')}
        </div>
        <div className="text-sm"><strong>קטגוריה:</strong> {tx.category || '—'}</div>
        <div className="text-sm"><strong>סכום:</strong> ₪{tx.amount}</div>
        <div className={`text-sm font-bold ${typeColor}`}>{tx.type}</div>
        <div className="flex justify-end gap-2 mt-2">{actions}</div>
      </div>
    );
  }

  return (
    <tr className={index % 2 === 0 ? 'bg-gray-50' : ''}>
      <td className="px-2 py-1 text-sm font-semibold">{tx.merchant || 'ללא שם'}</td>
      <td className="px-2 py-1 text-sm">
        <div className="flex items-center gap-1">
          {tx.category || '—'}
          {!tx.category && missingCategoryButton('לא נמצאה קטגוריה')}
        </div>
      </td>
      <td className="px-2 py-1 text-sm">₪{tx.amount}</td>
      <td className={`px-2 py-1 text-sm font-bold ${typeColor}`}>{tx.type}</td>
      <td className="px-2 py-1">
        <div className="flex justify-end items-center gap-2">{actions}</div>
      </td>
    </tr>
  );
}
