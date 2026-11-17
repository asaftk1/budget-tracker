import {
  MAX_AMOUNT_AGOROT,
  toAgorot,
  amountError,
  getAgorot,
  fromAgorot,
  formatMoney,
  sumAgorot,
  sumAgorotBy,
} from './money';

// Intl adds bidi marks and non-breaking spaces; normalise them for readable assertions.
const plain = (s) => s.replace(/[‎‏]/g, '').replace(/ /g, ' ');

describe('toAgorot', () => {
  test('converts numbers and plain decimal strings to integer agorot', () => {
    expect(toAgorot(12.5)).toBe(1250);
    expect(toAgorot('12.5')).toBe(1250);
    expect(toAgorot('12.50')).toBe(1250);
    expect(toAgorot(' 7 ')).toBe(700);
    expect(toAgorot('.5')).toBe(50);
    expect(toAgorot('0.01')).toBe(1);
    expect(toAgorot('+3')).toBe(300);
  });

  test('floating-point noise does not leak into the result', () => {
    expect(toAgorot(0.1 + 0.2)).toBe(30);
    expect(toAgorot(19.99)).toBe(1999);
    expect(toAgorot(49.900000000000006)).toBe(4990);
    expect(toAgorot(1.1 * 3)).toBe(330);
  });

  test('rounds half up on the decimal text, not on the float', () => {
    expect(toAgorot('1.005')).toBe(101);
    expect(toAgorot(1.005)).toBe(101);
    expect(toAgorot('2.675')).toBe(268);
    expect(toAgorot('0.004')).toBeNull(); // rounds to zero
    expect(toAgorot('0.005')).toBe(1);
  });

  test('rejects NaN, Infinity and non-numeric input', () => {
    expect(toAgorot(NaN)).toBeNull();
    expect(toAgorot(Infinity)).toBeNull();
    expect(toAgorot(-Infinity)).toBeNull();
    expect(toAgorot('abc')).toBeNull();
    expect(toAgorot('')).toBeNull();
    expect(toAgorot('   ')).toBeNull();
    expect(toAgorot(null)).toBeNull();
    expect(toAgorot(undefined)).toBeNull();
    expect(toAgorot(true)).toBeNull();
    expect(toAgorot([5])).toBeNull();
    expect(toAgorot({})).toBeNull();
  });

  test('rejects zero and negative values', () => {
    expect(toAgorot(0)).toBeNull();
    expect(toAgorot('0')).toBeNull();
    expect(toAgorot('0.00')).toBeNull();
    expect(toAgorot(-0)).toBeNull();
    expect(toAgorot(-5)).toBeNull();
    expect(toAgorot('-5')).toBeNull();
    expect(toAgorot('-0.01')).toBeNull();
  });

  test('rejects text that is not a plain decimal', () => {
    expect(toAgorot('1,000')).toBeNull();
    expect(toAgorot('1e3')).toBeNull();
    expect(toAgorot('12.5.1')).toBeNull();
    expect(toAgorot('₪12')).toBeNull();
    expect(toAgorot('12 5')).toBeNull();
  });

  test('accepts the upper bound and rejects anything above it', () => {
    expect(MAX_AMOUNT_AGOROT).toBe(1_000_000_000);
    expect(toAgorot('10000000')).toBe(MAX_AMOUNT_AGOROT);
    expect(toAgorot('10000000.00')).toBe(MAX_AMOUNT_AGOROT);
    expect(toAgorot('10000000.01')).toBeNull();
    expect(toAgorot(1e12)).toBeNull();
    expect(toAgorot(1e21)).toBeNull();
    expect(toAgorot(Number.MAX_VALUE)).toBeNull();
  });

  test('tiny values in exponent notation are rejected as zero', () => {
    expect(toAgorot(1e-7)).toBeNull();
  });
});

describe('amountError', () => {
  test('valid input has no error', () => {
    expect(amountError('12.5')).toBeNull();
    expect(amountError(0.01)).toBeNull();
  });

  test('empty input is required', () => {
    expect(amountError('')).toBe('required');
    expect(amountError('   ')).toBe('required');
    expect(amountError(null)).toBe('required');
    expect(amountError(undefined)).toBe('required');
  });

  test('values above the bound are too-large', () => {
    expect(amountError('10000000.01')).toBe('too-large');
    expect(amountError(1e12)).toBe('too-large');
    expect(amountError(1e21)).toBe('too-large');
  });

  test('everything else is invalid', () => {
    for (const v of ['0', 0, '-5', -5, 'abc', NaN, Infinity, '1e3', '1,000', {}, true, '0.001']) {
      expect(amountError(v)).toBe('invalid');
    }
  });
});

describe('getAgorot', () => {
  test('prefers amountAgorot when it is an integer', () => {
    expect(getAgorot({ amountAgorot: 1250, amount: 999 })).toBe(1250);
  });

  test('falls back to rounding the legacy amount in shekels', () => {
    expect(getAgorot({ amount: 12.5 })).toBe(1250);
    expect(getAgorot({ amount: '12.5' })).toBe(1250);
    expect(getAgorot({ amount: 0.1 + 0.2 })).toBe(30);
    expect(getAgorot({ amount: 1.005 })).toBe(101);
  });

  test('ignores a non-integer amountAgorot', () => {
    expect(getAgorot({ amountAgorot: 12.5, amount: 3 })).toBe(300);
    expect(getAgorot({ amountAgorot: '1250', amount: 3 })).toBe(300);
  });

  test('keeps the sign of legacy negative amounts', () => {
    expect(getAgorot({ amount: -2.5 })).toBe(-250);
  });

  test('unusable values count as zero', () => {
    expect(getAgorot({})).toBe(0);
    expect(getAgorot({ amount: 'abc' })).toBe(0);
    expect(getAgorot({ amount: NaN })).toBe(0);
    expect(getAgorot({ amount: Infinity })).toBe(0);
    expect(getAgorot(null)).toBe(0);
    expect(getAgorot(undefined)).toBe(0);
  });
});

describe('fromAgorot', () => {
  test('converts back to shekels', () => {
    expect(fromAgorot(1250)).toBe(12.5);
    expect(fromAgorot(1)).toBe(0.01);
    expect(fromAgorot(0)).toBe(0);
  });

  test('non-finite input becomes zero', () => {
    expect(fromAgorot(NaN)).toBe(0);
    expect(fromAgorot(undefined)).toBe(0);
  });
});

describe('formatMoney', () => {
  test('formats Hebrew ILS with two decimals and the shekel sign', () => {
    expect(plain(formatMoney(1250))).toBe('12.50 ₪');
    expect(plain(formatMoney(5992173))).toBe('59,921.73 ₪');
    expect(plain(formatMoney(5))).toBe('0.05 ₪');
    expect(plain(formatMoney(0))).toBe('0.00 ₪');
  });

  test('negative amounts keep the minus sign', () => {
    expect(plain(formatMoney(-500))).toContain('-5.00');
  });

  test('can format without decimals', () => {
    expect(plain(formatMoney(123450, { fractionDigits: 0 }))).toBe('1,235 ₪');
  });

  test('non-finite input formats as zero', () => {
    expect(plain(formatMoney(NaN))).toBe('0.00 ₪');
  });

  test('emits right-to-left marks for use inside Hebrew text', () => {
    expect(formatMoney(1250)).toContain('‏');
  });
});

describe('sumAgorot', () => {
  test('0.1 + 0.2 style sums are exact', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumAgorot([{ amount: 0.1 }, { amount: 0.2 }])).toBe(30);
  });

  test('a hundred additions of 0.10 give exactly 10.00', () => {
    const items = Array.from({ length: 100 }, () => ({ amount: 0.1 }));
    expect(items.reduce((s, t) => s + t.amount, 0)).not.toBe(10);
    expect(sumAgorot(items)).toBe(1000);
  });

  test('mixes new and legacy documents', () => {
    expect(sumAgorot([{ amountAgorot: 1999 }, { amount: 0.01 }, { amount: 5 }])).toBe(2500);
  });

  test('empty, missing and unusable entries add nothing', () => {
    expect(sumAgorot([])).toBe(0);
    expect(sumAgorot(undefined)).toBe(0);
    expect(sumAgorot([{ amount: 'abc' }, {}])).toBe(0);
  });

  test('accepts a custom amount getter', () => {
    expect(sumAgorot([1, 2, 3], (n) => n * 100)).toBe(600);
  });
});

describe('sumAgorotBy', () => {
  test('groups exact sums by key', () => {
    const items = [
      { category: 'a', amount: 0.1 },
      { category: 'a', amount: 0.2 },
      { category: 'b', amountAgorot: 505 },
    ];
    expect(sumAgorotBy(items, (t) => t.category)).toEqual({ a: 30, b: 505 });
  });

  test('empty input gives an empty object', () => {
    expect(sumAgorotBy([], (t) => t.x)).toEqual({});
    expect(sumAgorotBy(undefined, (t) => t.x)).toEqual({});
  });
});
