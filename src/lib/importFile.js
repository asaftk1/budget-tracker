// Checks on an uploaded statement file before it is handed to the spreadsheet reader.

// Largest file accepted. Real card statements are a few hundred KB.
export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

// Hebrew messages shown in the import dialog.
export const IMPORT_FILE_ERRORS = {
  'too-large': 'הקובץ גדול מדי (מקסימום 10MB).',
  'wrong-type': 'סוג הקובץ אינו נתמך. בחר/י קובץ XLSX (‎.xlsx‎) בלבד.',
  unreadable: 'לא הצלחנו לקרוא את הקובץ. ודא/י שהוא קובץ Excel תקין.',
};

// An .xlsx file is a zip archive; every zip starts with "PK" followed by 0x03 0x04
// (or 0x05 0x06 for an empty archive).
export function hasZipSignature(bytes) {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) || (bytes[2] === 0x05 && bytes[3] === 0x06))
  );
}

export const hasXlsxExtension = (name) => /\.xlsx$/i.test(String(name || ''));

// First four bytes of a File/Blob. FileReader is used instead of Blob.arrayBuffer for older browsers.
function readHead(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file.slice(0, 4));
  });
}

// Returns null when the file may be parsed, otherwise a key of IMPORT_FILE_ERRORS:
// 'too-large' (size is checked first, from file.size, before any bytes are read),
// 'wrong-type' (not .xlsx by name, or not a zip by its first bytes) or 'unreadable'.
export async function checkImportFile(file) {
  if (!file) return 'wrong-type';
  if (file.size > MAX_IMPORT_FILE_BYTES) return 'too-large';
  if (!hasXlsxExtension(file.name)) return 'wrong-type';
  try {
    return hasZipSignature(await readHead(file)) ? null : 'wrong-type';
  } catch {
    return 'unreadable';
  }
}
