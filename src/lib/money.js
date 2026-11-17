// Money helpers. Amounts are handled as integer agorot (1 ILS = 100 agorot) so sums and
// comparisons never suffer from floating-point error (0.1 + 0.2 !== 0.3).

// Upper bound for a single transaction: 10,000,000.00 ILS.
export const MAX_AMOUNT_AGOROT = 1_000_000_000;

// Convert a finite number of shekels to integer agorot, rounding half away from zero.
// Works on the decimal text of the number so values like 1.005 round to 101, not 100.
function shekelsToAgorot(n) {
  const abs = Math.abs(n);
  const text = String(abs);
  // Exponent notation (very small or very large numbers): fall back to plain arithmetic.
  const agorot = /e/i.test(text) ? Math.round(abs * 100) : Math.round(Number(`${text}e2`));
  return n < 0 ? -agorot : agorot;
}

const PLAIN_DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)$/;

// Validate user or statement input and convert it to integer agorot.
// Accepts a number or a plain decimal string ("12.5"). Returns null for anything else:
// NaN, Infinity, zero (or rounding to zero), negatives, text, exponents, and values above
// MAX_AMOUNT_AGOROT. Amounts in this app are always positive; the transaction type carries the sign.
export function toAgorot(input) {
  let n;
  if (typeof input === 'number') {
    n = input;
  } else if (typeof input === 'string') {
    const text = input.trim();
    if (!PLAIN_DECIMAL.test(text)) return null;
    n = Number(text);
  } else {
    return null;
  }

  if (!Number.isFinite(n) || n <= 0) return null;

  const agorot = shekelsToAgorot(n);
  if (agorot < 1 || agorot > MAX_AMOUNT_AGOROT) return null;
  return agorot;
}

// Why an input was rejected by toAgorot: 'required' (empty), 'too-large' (above the upper
// bound) or 'invalid' (anything else). Returns null when the input is valid.
export function amountError(input) {
  if (toAgorot(input) !== null) return null;
  if (input === null || input === undefined || (typeof input === 'string' && input.trim() === '')) {
    return 'required';
  }

  let n = NaN;
  if (typeof input === 'number') n = input;
  else if (typeof input === 'string' && PLAIN_DECIMAL.test(input.trim())) n = Number(input.trim());

  if (Number.isFinite(n) && n > 0 && shekelsToAgorot(n) > MAX_AMOUNT_AGOROT) return 'too-large';
  return 'invalid';
}

// Read the amount of a stored transaction in integer agorot.
// New documents carry amountAgorot; older documents only have amount (in shekels).
// Unusable values count as 0 so one bad document cannot break a total.
export function getAgorot(tx) {
  if (!tx) return 0;
  if (Number.isInteger(tx.amountAgorot)) return tx.amountAgorot;

  const legacy = Number(tx.amount);
  return Number.isFinite(legacy) ? shekelsToAgorot(legacy) : 0;
}

// Integer agorot -> shekels as a number, for chart libraries and display math only.
// Do not accumulate the result; sum agorot first.
export function fromAgorot(agorot) {
  return (Number.isFinite(agorot) ? agorot : 0) / 100;
}

const formatters = new Map();
const getFormatter = (fractionDigits) => {
  if (!formatters.has(fractionDigits)) {
    formatters.set(
      fractionDigits,
      new Intl.NumberFormat('he-IL', {
        style: 'currency',
        currency: 'ILS',
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      })
    );
  }
  return formatters.get(fractionDigits);
};

// Format integer agorot as Hebrew ILS currency, e.g. "12.50 ₪" (with RTL marks from Intl).
export function formatMoney(agorot, { fractionDigits = 2 } = {}) {
  return getFormatter(fractionDigits).format(fromAgorot(agorot));
}

// Sum of the amounts of a list of transactions, in integer agorot.
export function sumAgorot(items, getAmount = getAgorot) {
  let total = 0;
  for (const item of items || []) total += getAmount(item);
  return total;
}

// Sum amounts per key: returns { [key]: agorot }.
export function sumAgorotBy(items, getKey, getAmount = getAgorot) {
  const totals = {};
  for (const item of items || []) {
    const key = getKey(item);
    totals[key] = (totals[key] || 0) + getAmount(item);
  }
  return totals;
}
