import { buildImportReport, RETRY_NOTE } from './importReport';

const text = (r) => r.lines.join(' ');

describe('buildImportReport', () => {
  test('a clean import reports the row count', () => {
    const r = buildImportReport({ imported: 12, attempted: 12 });
    expect(r.tone).toBe('success');
    expect(text(r)).toContain('12 פעולות יובאו');
    expect(text(r)).not.toContain('דולג');
  });

  test('singular wording for one row', () => {
    expect(text(buildImportReport({ imported: 1, attempted: 1 }))).toContain('1 פעולה יובאה');
  });

  test('skipped rows with an invalid amount and ignored empty sheets are counted', () => {
    const r = buildImportReport({ imported: 5, attempted: 5, invalidAmount: 3, emptySheets: 2 });
    expect(r.tone).toBe('success');
    expect(text(r)).toContain('3 שורות דולגו בגלל סכום לא תקין');
    expect(text(r)).toContain('2 גיליונות ריקים דולגו');
  });

  test('nothing to import is reported as such', () => {
    const r = buildImportReport({ imported: 0, attempted: 0, invalidAmount: 4 });
    expect(r.tone).toBe('info');
    expect(text(r)).toContain('לא נמצאו פעולות לייבוא');
    expect(text(r)).toContain('4 שורות דולגו');
  });

  test('a partial failure says how many rows failed, in how many batches, and that retrying is safe', () => {
    const r = buildImportReport({ imported: 450, attempted: 700, failedRows: 250, failedChunks: 1 });
    expect(r.tone).toBe('partial');
    expect(text(r)).toContain('450 פעולות יובאו');
    expect(text(r)).toContain('250 פעולות לא נכתבו');
    expect(text(r)).toContain('1 קבוצת כתיבה נכשלה');
    expect(r.lines).toContain(RETRY_NOTE);
    expect(RETRY_NOTE).toContain('המזהים קבועים');
  });

  test('when every batch fails the import is reported as failed, with the retry note', () => {
    const r = buildImportReport({ imported: 0, attempted: 300, failedRows: 300, failedChunks: 2 });
    expect(r.tone).toBe('error');
    expect(text(r)).toContain('לא נכתבה אף פעולה');
    expect(text(r)).toContain('300 פעולות');
    expect(text(r)).toContain('2 קבוצות כתיבה');
    expect(r.lines).toContain(RETRY_NOTE);
  });

  test('defaults describe an empty import', () => {
    expect(buildImportReport().tone).toBe('info');
  });
});
