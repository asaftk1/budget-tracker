import {
  MAX_IMPORT_FILE_BYTES, IMPORT_FILE_ERRORS, checkImportFile, hasZipSignature, hasXlsxExtension,
} from './importFile';

const ZIP = [0x50, 0x4b, 0x03, 0x04, 0x00];
const makeFile = (name, bytes = ZIP, size) => {
  const file = new File([new Uint8Array(bytes)], name);
  if (size !== undefined) Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('limits', () => {
  test('the limit is 10 MB', () => {
    expect(MAX_IMPORT_FILE_BYTES).toBe(10 * 1024 * 1024);
  });
  test('a file exactly at the limit is accepted, one byte over is not', async () => {
    expect(await checkImportFile(makeFile('a.xlsx', ZIP, MAX_IMPORT_FILE_BYTES))).toBeNull();
    expect(await checkImportFile(makeFile('a.xlsx', ZIP, MAX_IMPORT_FILE_BYTES + 1))).toBe('too-large');
  });
  test('size is checked before any byte is read', async () => {
    const spy = jest.spyOn(window, 'FileReader');
    await checkImportFile(makeFile('a.xlsx', ZIP, MAX_IMPORT_FILE_BYTES + 1));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('type', () => {
  test('.xlsx with a zip signature passes, in any letter case', async () => {
    for (const name of ['a.xlsx', 'A.XLSX', 'statement.Xlsx', 'דוח.xlsx']) {
      expect(await checkImportFile(makeFile(name))).toBeNull();
    }
  });
  test('legacy .xls and other extensions are refused', async () => {
    for (const name of ['a.xls', 'a.csv', 'a.xlsm', 'a.xlsx.exe', 'a', 'xlsx', 'a.xlsx ']) {
      expect(await checkImportFile(makeFile(name))).toBe('wrong-type');
    }
  });
  test('a renamed non-zip file is refused even with the right extension', async () => {
    expect(await checkImportFile(makeFile('a.xlsx', [0x4d, 0x5a, 0x90, 0x00]))).toBe('wrong-type'); // an executable
    expect(await checkImportFile(makeFile('a.xlsx', [0xd0, 0xcf, 0x11, 0xe0]))).toBe('wrong-type'); // legacy .xls
    expect(await checkImportFile(makeFile('a.xlsx', [0x50, 0x4b]))).toBe('wrong-type'); // too short
    expect(await checkImportFile(makeFile('a.xlsx', []))).toBe('wrong-type');
  });
  test('no file is refused', async () => {
    expect(await checkImportFile(undefined)).toBe('wrong-type');
  });
  test('hasZipSignature knows the empty-archive form too', () => {
    expect(hasZipSignature(new Uint8Array([0x50, 0x4b, 0x05, 0x06]))).toBe(true);
    expect(hasZipSignature(new Uint8Array([0x50, 0x4b, 0x01, 0x02]))).toBe(false);
  });
  test('hasXlsxExtension ignores case', () => {
    expect(hasXlsxExtension('x.XlSx')).toBe(true);
    expect(hasXlsxExtension(null)).toBe(false);
  });
});

describe('messages', () => {
  test('all three are Hebrew and different, and the type message names xlsx only', () => {
    const values = Object.values(IMPORT_FILE_ERRORS);
    expect(new Set(values).size).toBe(3);
    values.forEach((m) => expect(m).toMatch(/[֐-׿]/));
    expect(IMPORT_FILE_ERRORS['wrong-type']).toContain('XLSX');
    expect(IMPORT_FILE_ERRORS['wrong-type']).not.toMatch(/xls[^x]/i);
  });
});
