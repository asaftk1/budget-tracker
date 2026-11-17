import fs from 'fs';
import path from 'path';
import { devLog } from './devLog';

describe('devLog', () => {
  const original = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = original; });

  test('logs in development and test', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    process.env.NODE_ENV = 'development';
    devLog('a', 1);
    expect(spy).toHaveBeenCalledWith('a', 1);
    process.env.NODE_ENV = 'test';
    devLog('b');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('is silent in production', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    process.env.NODE_ENV = 'production';
    devLog('secret', { amount: 5 });
    expect(spy).not.toHaveBeenCalled();
  });
});

// Guard: application code must not call console.log directly (use devLog), so data can never be
// logged to a production console by accident. Warnings and errors are allowed.
describe('no raw console.log in application code', () => {
  const root = path.join(__dirname, '..');
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|jsx)$/.test(entry.name) && !/\.test\.js$/.test(entry.name)) files.push(full);
    }
  };
  walk(root);

  test('finds the application source files', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  test('only devLog.js calls console.log', () => {
    const offenders = files
      .filter((f) => !f.endsWith(path.join('lib', 'devLog.js')))
      .filter((f) => /console\.log\s*\(/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(root, f));
    expect(offenders).toEqual([]);
  });
});
