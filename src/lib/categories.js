// Category name helpers. One definition of "the same category", used by every page and hook,
// so uniqueness is case-insensitive and ignores extra spaces everywhere.

// Display form of a name: Unicode-normalised, trimmed, inner whitespace collapsed to one space.
export const cleanCategoryName = (name) =>
  String(name ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');

// Comparison key: two names are the same category when their keys are equal.
export const categoryKey = (name) => cleanCategoryName(name).toLowerCase();

// The existing name (as stored) that matches `name`, or undefined. names: array of strings.
export function findCategory(names, name) {
  const key = categoryKey(name);
  if (!key) return undefined;
  return (names || []).find((existing) => categoryKey(existing) === key);
}

export const hasCategory = (names, name) => findCategory(names, name) !== undefined;

// The spelling to store on a transaction: the existing category's spelling when there is one,
// otherwise the cleaned input.
export function resolveCategory(names, name) {
  const existing = findCategory(names, name);
  return existing !== undefined ? cleanCategoryName(existing) : cleanCategoryName(name);
}

// One entry per category (first spelling wins), blanks removed. For display lists only;
// stored categories are never changed.
export function dedupeCategories(names) {
  const seen = new Set();
  const result = [];
  for (const name of names || []) {
    const key = categoryKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(cleanCategoryName(name));
  }
  return result;
}
