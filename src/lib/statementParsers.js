// Parsers for credit-card statement sheets (Isracard and Max).
// Input is a sheet as an array of rows (XLSX.utils.sheet_to_json with header: 1).
// Output is a list of { rowIndex, transaction }; rowIndex is the row's position among the
// data rows and is used to build stable document ids. The caller adds uid and the id.
// Hebrew strings below are statement keywords or user-facing values stored on the transaction.
import { categorizeMerchant } from './categorize';
import { cleanAmount } from './amounts';
import {
  getLastDayOfPreviousMonth,
  computeIsracardChargeDate,
  parseExcelDate,
  parseIsracardDate,
} from './importDates';

export const TX_TYPE = { EXPENSE: 'הוצאה', INCOME: 'הכנסה' };

export const HEBREW_MONTHS = {
  'ינואר': 1, 'פברואר': 2, 'מרץ': 3, 'אפריל': 4,
  'מאי': 5, 'יוני': 6, 'יולי': 7, 'אוגוסט': 8,
  'ספטמבר': 9, 'אוקטובר': 10, 'נובמבר': 11, 'דצמבר': 12,
};

// Matches the "charged on DD.MM" line in the Isracard header.
export const ISRACARD_BILLING_REGEX = /לחיוב ב-(\d{2}\.\d{2})/;

// Note stored on transactions that still need a manual category.
export const NOTE_FILL_CATEGORY = 'השלם קטגוריה ידנית';

const noop = () => {};

// Returns the first regex match (group 1, or the whole match) found in any string cell.
export const extractBillingDate = (rows, regex) => {
  for (const row of rows) {
    for (const cell of row || []) {
      if (typeof cell !== 'string') continue;
      const m = cell.match(regex);
      if (m) return m[1] ?? m[0];
    }
  }
  return null;
};

// Warning codes passed to onWarn(code, detail):
//   'isracard-missing-header'   no "<hebrew month> <year>" cell in the first rows
//   'isracard-invalid-header'   detail: the header cell text
//   'isracard-no-posting-date'  detail: the computed charge date
export function parseIsracardSheet(json, { merchantCategoryMap, onWarn = noop } = {}) {
  let headerCell = null;
  for (let r = 0; r < Math.min(6, json.length) && !headerCell; r++) {
    const row = json[r] || [];
    for (let c = 0; c < Math.min(8, row.length); c++) {
      const cell = row[c];
      if (typeof cell === 'string') {
        const parts = cell.trim().split(/\s+/);
        if (parts.length >= 2 && HEBREW_MONTHS[parts[0]] && /^\d{4}$/.test(parts[1])) {
          headerCell = cell.trim();
          break;
        }
      }
    }
  }

  if (!headerCell) {
    onWarn('isracard-missing-header');
    return [];
  }

  const [hebrewMonth, yearStr] = headerCell.split(/\s+/);
  const headerMonth = HEBREW_MONTHS[hebrewMonth];
  const headerYear = parseInt(yearStr, 10);

  if (!headerMonth || !headerYear) {
    onWarn('isracard-invalid-header', headerCell);
    return [];
  }

  const billingStr = extractBillingDate(json.slice(0, 6), ISRACARD_BILLING_REGEX);

  const chargeDateStr = computeIsracardChargeDate({ headerYear, headerMonth, billingStr });
  const postingDate = getLastDayOfPreviousMonth(chargeDateStr);
  if (!postingDate) {
    onWarn('isracard-no-posting-date', chargeDateStr);
    return [];
  }

  const indexes = { date: 0, merchant: 1, amount: 4 };
  const dataRows = json.slice(9);
  const results = [];

  for (const [rowIndex, row] of dataRows.entries()) {
    const rawDate = row[indexes.date];
    const rawMerchant = row[indexes.merchant];
    const rawAmount = row[indexes.amount];

    const looksLikeDate =
      typeof rawDate === 'string' &&
      /^\d{2}[./]\d{2}[./]\d{2,4}$/.test(rawDate.trim());

    if (!looksLikeDate) continue;

    const merchant = rawMerchant ? String(rawMerchant).trim() : '';
    const amountNum = cleanAmount(rawAmount);
    const parsedOriginalDate = parseIsracardDate(rawDate);

    if (!merchant || amountNum === null) continue;

    const category = categorizeMerchant(merchant, merchantCategoryMap) || '';

    results.push({
      rowIndex,
      transaction: {
        date: postingDate,
        originalDate: parsedOriginalDate || null,
        chargeDate: chargeDateStr,
        merchant,
        category,
        amount: Math.abs(amountNum),
        type: amountNum > 0 ? TX_TYPE.EXPENSE : TX_TYPE.INCOME,
        source: 'isracard',
        ...(category ? {} : { notes: NOTE_FILL_CATEGORY }),
      },
    });
  }

  return results;
}

// Warning codes passed to onWarn(code, detail):
//   'max-no-posting-date'  detail: { rawChargeDate, parsedChargeDate, merchant }
export function parseMaxSheet(json, { onWarn = noop } = {}) {
  // In a Max file the fourth row holds the column headers, so data starts at index 4.
  const dataRows = json.slice(4);
  const results = [];

  for (const [rowIndex, row] of dataRows.entries()) {
    const rawTransactionDate = row[0];
    const rawMerchant = row[1];
    const rawCategory = row[2];
    const rawAmount = row[5];
    const rawChargeDate = row[9];

    // Skip empty rows and rows that are not transactions.
    if (
      !rawMerchant ||
      rawAmount === undefined ||
      rawAmount === null ||
      rawAmount === '' ||
      !rawChargeDate
    ) {
      continue;
    }

    const merchant = String(rawMerchant).trim();
    const category = typeof rawCategory === 'string' ? rawCategory.trim() : '';
    const amountNum = cleanAmount(rawAmount);
    const parsedChargeDate = parseExcelDate(rawChargeDate);
    const parsedOriginalDate = parseExcelDate(rawTransactionDate);

    if (!merchant || amountNum === null || !parsedChargeDate) {
      continue;
    }

    const postingDate = getLastDayOfPreviousMonth(parsedChargeDate);
    if (!postingDate) {
      onWarn('max-no-posting-date', { rawChargeDate, parsedChargeDate, merchant });
      continue;
    }

    results.push({
      rowIndex,
      transaction: {
        date: postingDate,
        originalDate: parsedOriginalDate || null,
        chargeDate: parsedChargeDate,
        merchant,
        category,
        amount: Math.abs(amountNum),
        type: amountNum > 0 ? TX_TYPE.EXPENSE : TX_TYPE.INCOME,
        source: 'max',
      },
    });
  }

  return results;
}
