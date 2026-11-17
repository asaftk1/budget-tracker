// Deterministic document ids and batching helpers for imported transactions.

export const MAX_BATCH_SIZE = 500; // Firestore writeBatch limit

// cyrb53: small, fast, non-cryptographic 53-bit string hash.
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// Same inputs always give the same id, so re-importing a file overwrites the same
// documents instead of creating duplicates.
// - uid is part of the hash so two users importing identical rows never share a document.
// - rowKey must be unique per row within a file (for example "<sheet name>#<row index>").
// Two independent 53-bit hashes are concatenated to make accidental collisions negligible.
export function buildTransactionId({ uid, source, date, merchant, amount, rowKey }) {
  const key = JSON.stringify([uid, source, date, merchant, Number(amount).toFixed(2), rowKey]);
  const part1 = cyrb53(key, 0).toString(36);
  const part2 = cyrb53(key, 1).toString(36);
  return `${source}_${part1}${part2}`;
}

// Split items into groups of at most `size` (Firestore allows 500 writes per batch).
export function chunk(items, size = MAX_BATCH_SIZE) {
  const groups = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
}
