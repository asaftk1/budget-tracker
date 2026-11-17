// Shared constants. The Hebrew values of TYPE and UNCATEGORIZED are stored in Firestore
// (transaction.type) or shown in reports, so they must not change.

// Transaction types as stored in the transactions collection.
export const TYPE = { INCOME: 'הכנסה', EXPENSE: 'הוצאה' };

// Where a transaction came from (transaction.source).
export const SOURCE = { ISRACARD: 'isracard', MAX: 'max' };

// Label for expenses without a category in reports.
export const UNCATEGORIZED = 'לא מסווג';

// Colours shared by the charts. Slices cycle through palette.
export const CHART_COLORS = {
  palette: ['#FF6384', '#36A2EB', '#FFCE56', '#4CAF50', '#FF9800', '#9C27B0', '#795548', '#00BCD4'],
  income: '#22c55e',
  expense: '#ef4444',
};

// Column and row positions in the credit-card statement exports (zero-based).
export const IMPORT_COLUMNS = {
  [SOURCE.ISRACARD]: {
    firstDataRow: 9,
    headerScanRows: 6, // the month/year and billing lines are in the first rows
    headerScanColumns: 8,
    date: 0,
    merchant: 1,
    amount: 4,
  },
  [SOURCE.MAX]: {
    firstDataRow: 4, // the fourth row holds the column headers
    date: 0,
    merchant: 1,
    category: 2,
    amount: 5,
    chargeDate: 9,
  },
};
