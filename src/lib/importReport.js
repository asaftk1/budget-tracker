// The message shown after an import. It reports only what is counted for certain:
//   imported       rows written to Firestore
//   attempted      rows the importer handed to the writer
//   failedRows     rows in write batches that failed (attempted minus imported)
//   failedChunks   number of write batches that failed
//   invalidAmount  rows the parser skipped because the amount was not valid (onWarn 'invalid-amount')
//   emptySheets    sheets ignored because they have no data rows
// Returns { tone: 'success' | 'info' | 'partial' | 'error', lines: [Hebrew strings] }.
// Importing the same file again is safe: document ids are deterministic, so rows that were already
// written are overwritten, not duplicated.

const plural = (n, one, many) => (n === 1 ? one : many);

export const RETRY_NOTE =
  'אפשר לייבא את אותו קובץ שוב בבטחה: המזהים קבועים, ולכן פעולות שכבר נכתבו יידרסו ולא יוכפלו.';

export function buildImportReport({
  imported = 0,
  attempted = 0,
  failedRows = 0,
  failedChunks = 0,
  invalidAmount = 0,
  emptySheets = 0,
} = {}) {
  const lines = [];
  let tone;

  if (failedRows > 0 && imported === 0) {
    tone = 'error';
    lines.push(`הייבוא נכשל: לא נכתבה אף פעולה (${failedRows} ${plural(failedRows, 'פעולה', 'פעולות')} ב-${failedChunks} ${plural(failedChunks, 'קבוצת כתיבה', 'קבוצות כתיבה')} שנכשלו).`);
    lines.push(RETRY_NOTE);
  } else if (failedRows > 0) {
    tone = 'partial';
    lines.push(`הייבוא הושלם חלקית: ${imported} ${plural(imported, 'פעולה יובאה', 'פעולות יובאו')}, אך ${failedRows} ${plural(failedRows, 'פעולה', 'פעולות')} לא נכתבו (${failedChunks} ${plural(failedChunks, 'קבוצת כתיבה נכשלה', 'קבוצות כתיבה נכשלו')}).`);
    lines.push(RETRY_NOTE);
  } else if (attempted === 0) {
    tone = 'info';
    lines.push('לא נמצאו פעולות לייבוא בקובץ.');
  } else {
    tone = 'success';
    lines.push(`הייבוא הסתיים: ${imported} ${plural(imported, 'פעולה יובאה', 'פעולות יובאו')}.`);
  }

  if (invalidAmount > 0) {
    lines.push(`${invalidAmount} ${plural(invalidAmount, 'שורה דולגה', 'שורות דולגו')} בגלל סכום לא תקין.`);
  }
  if (emptySheets > 0) {
    lines.push(`${emptySheets} ${plural(emptySheets, 'גיליון ריק דולג', 'גיליונות ריקים דולגו')}.`);
  }
  return { tone, lines };
}
