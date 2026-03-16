const DEFAULT_ML_ENDPOINT = process.env.REACT_APP_CATEGORY_API_URL || '';

export const NOTE_NEEDS_REVIEW = 'Needs manual review';

export const CATEGORY_SOURCE_LABELS = {
  statement: 'Statement category',
  ml: 'Auto (ML)',
  manual: 'Manual',
  unknown: 'Needs review',
};

const EMPTY_CATEGORY_VALUES = new Set([
  '',
  '-',
  '—',
  'n/a',
  'not available',
  'uncategorized',
  'לא מסווג',
  'ללא',
  'ללא קטגוריה',
]);

const clean = (value = '') => String(value ?? '').trim();
const isMeaningfulCategory = (raw) =>
  raw && !EMPTY_CATEGORY_VALUES.has(clean(raw).toLowerCase());

async function callMl({ merchant, amount = 0, uid, endpoint = DEFAULT_ML_ENDPOINT }) {
  if (!endpoint) return null;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant: clean(merchant),
        amount: Number.isFinite(amount) ? amount : 0,
        uid,
      }),
    });

    if (!res.ok) {
      console.warn('ML service returned', res.status);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error('Failed to reach ML service', err);
    return null;
  }
}

/**
 * Return the final category decision.
 * 1. Use the statement category, if available.
 * 2. Otherwise ask the ML service (when configured).
 * 3. Otherwise fall back to merchant name and flag for review.
 */
export async function deriveCategory({
  statementCategory,
  merchant,
  amount = 0,
  uid,
  mlEndpoint = DEFAULT_ML_ENDPOINT,
} = {}) {
  const cleanStatement = clean(statementCategory);
  const cleanMerchant = clean(merchant);

  if (isMeaningfulCategory(cleanStatement)) {
    return {
      category: cleanStatement,
      autoCategory: null,
      source: 'statement',
      notes: null,
      confidence: null,
    };
  }

  const mlResult = await callMl({
    merchant: cleanMerchant || cleanStatement,
    amount,
    uid,
    endpoint: mlEndpoint,
  });

  if (mlResult?.category) {
    return {
      category: clean(mlResult.category),
      autoCategory: clean(mlResult.category),
      source: 'ml',
      notes: null,
      confidence: typeof mlResult.confidence === 'number' ? mlResult.confidence : null,
    };
  }

  return {
    category: cleanStatement || cleanMerchant,
    autoCategory: null,
    source: 'unknown',
    notes: NOTE_NEEDS_REVIEW,
    confidence: null,
  };
}