// Amount parsing for credit-card statement cells.

// Returns a number, or null when the cell is empty or not a number.
// Accepts numbers, strings with a currency sign or thousands separators, and
// accounting-style negatives such as "(45.00)".
export const cleanAmount = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;

  const cleaned = String(value)
    .replace(/₪/g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .replace(/[^\d().-]/g, '');

  if (!cleaned) return null;

  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    const num = parseFloat(cleaned.slice(1, -1));
    return Number.isNaN(num) ? null : -num;
  }

  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
};
