import { cleanCategoryName, categoryKey, findCategory, hasCategory, resolveCategory, dedupeCategories } from './categories';

describe('cleanCategoryName', () => {
  test('trims and collapses inner whitespace but keeps the case', () => {
    expect(cleanCategoryName('  Food   and  Drink ')).toBe('Food and Drink');
    expect(cleanCategoryName('\tFood\n')).toBe('Food');
  });

  test('handles empty and non-string input', () => {
    expect(cleanCategoryName('')).toBe('');
    expect(cleanCategoryName(null)).toBe('');
    expect(cleanCategoryName(undefined)).toBe('');
    expect(cleanCategoryName(42)).toBe('42');
  });

  test('normalises Unicode so composed and decomposed forms are the same', () => {
    expect(cleanCategoryName('Café')).toBe('Café');
  });
});

describe('categoryKey', () => {
  test('is case-insensitive and ignores extra spaces', () => {
    expect(categoryKey(' FOOD  Court ')).toBe(categoryKey('food court'));
  });

  test('Hebrew names compare by their letters', () => {
    expect(categoryKey(' מזון  וצריכה ')).toBe(categoryKey('מזון וצריכה'));
  });
});

describe('findCategory / hasCategory', () => {
  const names = ['Food', 'מזון וצריכה', 'Travel'];

  test('matches regardless of case, spacing and edges', () => {
    expect(findCategory(names, 'food')).toBe('Food');
    expect(findCategory(names, '  FOOD ')).toBe('Food');
    expect(findCategory(names, ' מזון   וצריכה')).toBe('מזון וצריכה');
    expect(hasCategory(names, 'travel')).toBe(true);
  });

  test('returns undefined for unknown, blank or missing input', () => {
    expect(findCategory(names, 'Sports')).toBeUndefined();
    expect(findCategory(names, '')).toBeUndefined();
    expect(findCategory(names, '   ')).toBeUndefined();
    expect(findCategory(undefined, 'food')).toBeUndefined();
    expect(hasCategory(names, 'Sports')).toBe(false);
  });

  test('a substring is not a match', () => {
    expect(hasCategory(names, 'Foo')).toBe(false);
  });
});

describe('resolveCategory', () => {
  test('uses the existing spelling when the category already exists', () => {
    expect(resolveCategory(['Food'], 'food')).toBe('Food');
    expect(resolveCategory(['  Food '], ' FOOD')).toBe('Food');
  });

  test('uses the cleaned input for a new category', () => {
    expect(resolveCategory(['Food'], '  New   thing ')).toBe('New thing');
    expect(resolveCategory([], 'Anything')).toBe('Anything');
  });
});

describe('dedupeCategories', () => {
  test('keeps the first spelling of each category and drops blanks', () => {
    expect(dedupeCategories(['Food', 'food', ' FOOD ', 'Travel', '', '  ', 'travel'])).toEqual(['Food', 'Travel']);
  });

  test('does not mutate its input and tolerates undefined', () => {
    const input = ['a', 'A'];
    dedupeCategories(input);
    expect(input).toEqual(['a', 'A']);
    expect(dedupeCategories(undefined)).toEqual([]);
  });
});
