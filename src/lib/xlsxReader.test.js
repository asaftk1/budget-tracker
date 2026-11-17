// Pins what the spreadsheet reader gives the parsers. The expected results in
// __fixtures__/xlsxReader.expected.json were produced by SheetJS 0.20.3 after checking, on the same
// workbook bytes, that SheetJS 0.18.5 (the version used before) returned identical sheet rows,
// parser output and warnings. Any future reader upgrade must keep these results.
import * as XLSX from 'xlsx';
import { TYPE } from '../constants';
import { parseMaxSheet, parseIsracardSheet } from './statementParsers';
import { FIXTURES, DATE_TYPED } from './__fixtures__/xlsxFixtures';
import expected from './__fixtures__/xlsxReader.expected.json';

const readSheets = (binary) => {
  const wb = XLSX.read(binary, { type: 'binary' });
  return wb.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 }) }));
};
const parseSheets = (sheets) => sheets.map(({ name, rows }) => ({
  name,
  max: rows.length < 2 ? null : parseMaxSheet(rows, { onWarn: () => {} }),
  isracard: rows.length < 2 ? null : parseIsracardSheet(rows, { merchantCategoryMap: new Map(), onWarn: () => {} }),
}));
const warnings = (sheets) => {
  const out = [];
  sheets.forEach(({ rows }) => {
    if (rows.length < 2) return;
    parseMaxSheet(rows, { onWarn: (c, d) => out.push(['max', c, JSON.stringify(d)]) });
    parseIsracardSheet(rows, { merchantCategoryMap: new Map(), onWarn: (c, d) => out.push(['isr', c, JSON.stringify(d)]) });
  });
  return out;
};
// Sparse rows have holes; compare after a JSON round trip, like the stored expectations.
const plain = (value) => JSON.parse(JSON.stringify(value));

describe('installed SheetJS', () => {
  test('is 0.20.2 or newer, which has the fix for the ReDoS issue (CVE-2024-22363); 0.19.3 fixed the prototype pollution', () => {
    const [major, minor, patch] = XLSX.version.split('.').map(Number);
    expect(major).toBe(0);
    expect(minor > 20 || (minor === 20 && patch >= 2)).toBe(true);
  });
});

describe('workbook reading is unchanged', () => {
  test('there is an expectation for every fixture, and no stale ones', () => {
    expect(Object.keys(expected).sort()).toEqual(Object.keys(FIXTURES).sort());
  });

  test.each(Object.keys(FIXTURES))('%s', (name) => {
    const sheets = readSheets(FIXTURES[name]);
    expect(plain(sheets)).toEqual(expected[name].sheets);
    expect(plain(parseSheets(sheets))).toEqual(expected[name].parsed);
    expect(plain(warnings(sheets))).toEqual(expected[name].warnings);
  });

  test('the fixtures produce parsed rows and warnings, so the pins are not vacuous', () => {
    const parsed = Object.values(expected).flatMap((e) => e.parsed);
    const rows = parsed.reduce((n, s) => n + (s.max?.length || 0) + (s.isracard?.length || 0), 0);
    expect(rows).toBeGreaterThan(8);
    expect(Object.values(expected).some((e) => e.warnings.length > 0)).toBe(true);
  });

  test('cells stored as ISO date strings parse to the same rows (raw serials may differ by seconds)', () => {
    const [sheet] = parseSheets(readSheets(DATE_TYPED));
    expect(plain(sheet.max)).toEqual([{
      rowIndex: 0,
      transaction: {
        date: '2025-03-31',
        originalDate: '2025-03-02',
        chargeDate: '2025-04-10',
        merchant: 'Date object',
        category: 'c',
        amount: 10,
        amountAgorot: 1000,
        type: TYPE.EXPENSE,
        source: 'max',
      },
    }]);
  });
});
