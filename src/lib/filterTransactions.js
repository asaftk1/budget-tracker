import { categoryKey } from './categories';

// Search filter for the transactions page.
//   filters: { text, category, from, to }
//     text      case-insensitive substring over merchant, description and category
//     category  the same category as this name (case and spacing ignored)
//     from, to  inclusive "YYYY-MM-DD" bounds; either may be empty
// Dates are compared as strings. A Date object would shift a plain calendar date across the
// timezone boundary, and "YYYY-MM-DD" strings sort in calendar order.

export const EMPTY_FILTERS = { text: '', category: '', from: '', to: '' };

// "YYYY-MM-DD" for a stored date (a plain date or an ISO timestamp), or null when it has none.
export function dayKey(date) {
  const match = typeof date === 'string' ? date.match(/^(\d{4}-\d{2}-\d{2})(?:$|T|\s)/) : null;
  return match ? match[1] : null;
}

const norm = (value) => categoryKey(value);

// True when at least one filter is set (blank strings do not count).
export function hasActiveFilter(filters) {
  const f = { ...EMPTY_FILTERS, ...filters };
  return Boolean(norm(f.text) || norm(f.category) || f.from || f.to);
}

// The transactions that match every set filter, in their original order. With no filter set it
// returns all of them. A transaction without a usable date never matches a date bound.
// Missing fields (older documents have no merchant or description) are treated as empty.
export function filterTransactions(transactions, filters) {
  const f = { ...EMPTY_FILTERS, ...filters };
  const text = norm(f.text);
  const category = norm(f.category);
  const { from, to } = f;
  if (!text && !category && !from && !to) return transactions || [];

  return (transactions || []).filter((tx) => {
    if (category && norm(tx.category) !== category) return false;

    if (text) {
      const haystack = [tx.merchant, tx.description, tx.category].map(norm);
      if (!haystack.some((field) => field.includes(text))) return false;
    }

    if (from || to) {
      const key = dayKey(tx.date);
      if (!key) return false;
      if (from && key < from) return false;
      if (to && key > to) return false;
    }
    return true;
  });
}
