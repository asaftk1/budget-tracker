import { TYPE, SOURCE, UNCATEGORIZED, CHART_COLORS, IMPORT_COLUMNS } from './constants';

describe('constants', () => {
  // These Hebrew strings are stored in Firestore documents; changing them would orphan data.
  test('stored Hebrew values are unchanged', () => {
    expect(TYPE).toEqual({ INCOME: 'הכנסה', EXPENSE: 'הוצאה' });
    expect(UNCATEGORIZED).toBe('לא מסווג');
  });

  test('sources are the identifiers already stored on imported transactions', () => {
    expect(SOURCE).toEqual({ ISRACARD: 'isracard', MAX: 'max' });
  });

  test('the chart palette is a list of distinct hex colours shared by both charts', () => {
    expect(CHART_COLORS.palette).toHaveLength(8);
    expect(new Set(CHART_COLORS.palette).size).toBe(8);
    for (const colour of [...CHART_COLORS.palette, CHART_COLORS.income, CHART_COLORS.expense]) {
      expect(colour).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  test('import column maps keep the positions the parsers always used', () => {
    expect(IMPORT_COLUMNS.isracard).toEqual({
      firstDataRow: 9, headerScanRows: 6, headerScanColumns: 8, date: 0, merchant: 1, amount: 4,
    });
    expect(IMPORT_COLUMNS.max).toEqual({
      firstDataRow: 4, date: 0, merchant: 1, category: 2, amount: 5, chargeDate: 9,
    });
  });
});
