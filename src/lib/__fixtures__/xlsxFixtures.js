// Workbooks used to pin the spreadsheet reader's behaviour. They are written in code with the
// installed SheetJS and returned as binary strings, like FileReader.readAsBinaryString gives.
import * as XLSX from 'xlsx';
import { HEBREW_MONTHS, ISRACARD_BILLING_REGEX } from '../statementParsers';

const APRIL = Object.keys(HEBREW_MONTHS)[3];
const BILLING_LABEL = ISRACARD_BILLING_REGEX.source.split('(')[0];

const maxLine = (date, merchant, category, amount, charge) => [date, merchant, category, '', '', amount, '', '', '', charge];
const maxHeader = [['\u05d3\u05d5\u05d7'], ['\u05db\u05e8\u05d8\u05d9\u05e1 1234'], [], ['\u05ea\u05d0\u05e8\u05d9\u05da', '\u05d1\u05d9\u05ea \u05e2\u05e1\u05e7', '\u05e7\u05d8\u05d2\u05d5\u05e8\u05d9\u05d4', '', '', '\u05e1\u05db\u05d5\u05dd', '', '', '', '\u05de\u05d5\u05e2\u05d3 \u05d7\u05d9\u05d5\u05d1']];
const isHeader = (monthCell, billing) => [['title'], [], [monthCell], billing ? [`${BILLING_LABEL}${billing}`] : [], [], [], [], [], []];

// Hebrew text is written as unicode escapes: the fixtures stand in for Hebrew bank exports
// (headers, merchants, categories) but keep this source file ASCII-only for Hebrew.
const build = (sheets, opts = {}) => {
  const wb = XLSX.utils.book_new();
  sheets.forEach(([name, rows, sheetOpts]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows, sheetOpts), name));
  return XLSX.write(wb, { type: 'binary', bookType: 'xlsx', ...opts });
};

const FIXTURES = {
  'max: strings, serials, signs, floats, Hebrew, blank rows': build([['\u05d2\u05d9\u05dc\u05d9\u05d5\u05df1', [
    ...maxHeader,
    maxLine('02/03/2025', ' \u05e1\u05d5\u05e4\u05e8 \u05e4\u05d0\u05e8\u05dd ', ' \u05d1\u05e8\u05d9\u05d0\u05d5\u05ea ', 77.5, '10/04/2025'),
    maxLine('2025-03-05', 'Netflix', 'fun', '₪1,234.50', '2025-04-10'),
    maxLine(45720, 'Shufersal', 'food', -19.99, 45758), // Excel serials in the date columns
    maxLine('3.3.2025', 'bad date shape', '', 5, '10.04.2025'),
    [],
    maxLine('01.03.25', 'Two digit year', 'x', 0.1 + 0.2, '10-04-25'),
    maxLine('01.03.2025', 'Huge', 'x', 9999999.99, '10.04.2025'),
    maxLine('01.03.2025', 'Zero', 'x', 0, '10.04.2025'),
    maxLine('01.03.2025', 'Not a number', 'x', 'abc', '10.04.2025'),
    maxLine('01.03.2025', '', 'x', 5, '10.04.2025'),
    maxLine('01.03.2025', 'No charge date', 'x', 5, ''),
    maxLine('01.03.2025', 'Boolean amount', 'x', true, '10.04.2025'),
    maxLine('‏01.03.2025', 'RTL mark in date', 'x', 5, '10.04.2025'),
    maxLine('01.03.2025', '  ‏\u05de\u05e8\u05db\u05d6  ', 5, 12, '10.04.2025'),
  ]]]),

  'max: several sheets, an empty one and one with only a header': build([
    ['a', [...maxHeader, maxLine('02.03.2025', 'One', 'c', 10, '10.04.2025')]],
    ['empty', [[]]],
    ['header only', [maxHeader[3]]],
    ['b', [...maxHeader, maxLine('03.03.2025', 'Two', 'c', 20, '10.05.2025')]],
  ]),

  'max: formulas, errors, merges and wide sparse ranges': (() => {
    const ws = XLSX.utils.aoa_to_sheet([
      ...maxHeader,
      maxLine('02.03.2025', 'Formula amount', 'c', 0, '10.04.2025'),
      maxLine('02.03.2025', 'Error cell', 'c', 7, '10.04.2025'),
    ], { cellDates: true });
    ws.F8 = { t: 'n', f: 'SUM(1,2)', v: 3 };
    ws.F9 = { t: 'e', v: 15 };
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
    ws.ZZ500 = { t: 's', v: 'far away' };
    ws['!ref'] = 'A1:ZZ500';
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'odd');
    return XLSX.write(wb, { type: 'binary', bookType: 'xlsx' });
  })(),

  'isracard: header block, two-digit years, amounts as text and numbers': build([['\u05d9\u05e9\u05e8\u05d0\u05db\u05e8\u05d8', [
    ...isHeader(`${APRIL} 2025`, '01.05'),
    ['03.04.25', 'qzxv unknown shop', '', '', 49.9],
    ['04.04.2025', 'second shop', '', '', '1,000.25'],
    ['05/04/25', 'refund', '', '', -12.5],
    ['06.04.25', 'zero', '', '', 0],
    ['07.04.25', 'text amount', '', '', 'n/a'],
    ['', '', '', '', ''],
    [45750, 'serial date', '', '', 3.1],
  ]]]),

  'isracard: missing and invalid header cells': build([
    ['no header', [...isHeader('', ''), ['03.04.25', 'a', '', '', 5]]],
    ['bad month', [...isHeader('foo 2025', '01.05'), ['03.04.25', 'b', '', '', 6]]],
  ]),

  'strings with characters that need XML escaping and long text': build([['x', [
    ...maxHeader,
    maxLine('02.03.2025', 'A & B <C> "D" \'E\'', 'c', 10, '10.04.2025'),
    maxLine('02.03.2025', 'x'.repeat(2000), 'c', 11, '10.04.2025'),
    maxLine('02.03.2025', 'line\nbreak\ttab', 'c', 12, '10.04.2025'),
    maxLine('02.03.2025', '=1+1', 'c', 13, '10.04.2025'),
    maxLine('02.03.2025', '😀 emoji', 'c', 14, '10.04.2025'),
  ]]]),
};


// Cells stored as ISO date strings (t="d") are not what Excel writes (it stores serial numbers),
// but some generators do. 0.18.5 leaked the local timezone's historical offset into the serial's
// fraction (+40 s here); 0.20.x does not. The parsers floor the serial, so their output is the same.
export const DATE_TYPED = build([['d', [
  ...maxHeader,
  maxLine(new Date(Date.UTC(2025, 2, 2)), 'Date object', 'c', 10, new Date(Date.UTC(2025, 3, 10))),
]]], { cellDates: true });


export { FIXTURES };
