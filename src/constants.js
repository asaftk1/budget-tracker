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
  // Colour-blind-safe categorical palette (Okabe-Ito based). Neighbouring slices differ in hue
  // and in lightness; the grouped "other" slice has its own grey below.
  palette: ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00', '#7A5195', '#44505C'],
  income: '#0f766e', // teal, matches the income token
  expense: '#c2410c', // vermilion, matches the expense token
  other: '#9ca3af',
  axis: '#4b5563', // axis labels
  grid: '#e4e7e2', // grid lines
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
