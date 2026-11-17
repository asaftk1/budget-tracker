// Single-pass summaries of a transaction list. Amounts are exact integer agorot (see money.js).
import { getAgorot } from './money';
import { TYPE, UNCATEGORIZED } from '../constants';

// Bucket key for a Date: year and zero-based month. Matches how the charts pick a month.
export const monthKeyOf = (date) => `${date.getFullYear()}-${date.getMonth()}`;

// One pass over the transactions. Returns:
//   totalIncome, totalExpense      integer agorot
//   expensesByCategory             { [category]: agorot }, uncategorised under UNCATEGORIZED
//   monthly                        { [monthKey]: { income, expense } } for the requested monthKeys
// monthKeys are monthKeyOf() strings; a transaction counts toward a month by its date, and one
// with an invalid or missing date still counts toward the totals and categories.
export function summarizeTransactions(transactions, monthKeys = []) {
  let totalIncome = 0;
  let totalExpense = 0;
  const expensesByCategory = {};
  const monthly = {};
  for (const key of monthKeys) monthly[key] = { income: 0, expense: 0 };
  const trackMonths = monthKeys.length > 0;

  for (const tx of transactions || []) {
    const isIncome = tx.type === TYPE.INCOME;
    const isExpense = !isIncome && tx.type === TYPE.EXPENSE;
    if (!isIncome && !isExpense) continue;

    const agorot = getAgorot(tx);

    if (isIncome) {
      totalIncome += agorot;
    } else {
      totalExpense += agorot;
      const category = tx.category || UNCATEGORIZED;
      expensesByCategory[category] = (expensesByCategory[category] || 0) + agorot;
    }

    if (trackMonths) {
      const bucket = monthly[monthKeyOf(new Date(tx.date))];
      if (bucket) {
        if (isIncome) bucket.income += agorot;
        else bucket.expense += agorot;
      }
    }
  }

  return { totalIncome, totalExpense, expensesByCategory, monthly };
}

// Group transactions by calendar day (key "YYYY-MM-DD") for one month ("YYYY-MM").
// Transactions with a missing or invalid date are left out; an empty month selects nothing.
export function groupTransactionsByDate(transactions, selectedMonth) {
  const groups = {};
  if (!selectedMonth) return groups;

  const [year, month] = selectedMonth.split('-');
  for (const tx of transactions || []) {
    if (!tx.date) continue;

    const txDate = new Date(tx.date);
    if (Number.isNaN(txDate.getTime())) continue;

    if (
      txDate.getFullYear().toString() !== year ||
      (txDate.getMonth() + 1).toString().padStart(2, '0') !== month
    ) {
      continue;
    }

    const key = txDate.toISOString().split('T')[0];
    (groups[key] = groups[key] || []).push(tx);
  }
  return groups;
}

// Group transactions by calendar day (key "YYYY-MM-DD") across all months, newest day first.
// Used for search results. Missing or invalid dates are left out; the order inside a day is the
// input order.
export function groupTransactionsByDay(transactions) {
  const groups = {};
  for (const tx of transactions || []) {
    if (!tx.date) continue;
    const txDate = new Date(tx.date);
    if (Number.isNaN(txDate.getTime())) continue;
    const key = txDate.toISOString().split('T')[0];
    (groups[key] = groups[key] || []).push(tx);
  }
  const sorted = {};
  for (const key of Object.keys(groups).sort().reverse()) sorted[key] = groups[key];
  return sorted;
}
