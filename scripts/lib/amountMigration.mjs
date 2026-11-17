// Pure logic for the amountAgorot migration (no Firebase imports, so it can be unit tested).
// The conversion itself is toAgorot() from the app, reused so there is a single definition.
import { toAgorot, amountError, MAX_AMOUNT_AGOROT } from '../../src/lib/money.js';
import { chunk, MAX_BATCH_SIZE } from '../../src/lib/transactionId.js';

export const COLLECTION = 'transactions';

// Reasons a document is skipped (never modified) and listed for manual review.
export const SKIP_REASONS = {
  missing: 'amount is missing, null or blank',
  nan: 'amount is NaN',
  'not-finite': 'amount is Infinity',
  zero: 'amount is zero',
  negative: 'amount is negative',
  'rounds-to-zero': 'amount is positive but smaller than half an agora',
  'above-bound': 'amount is above the 10,000,000 ILS upper bound',
  'not-a-number': 'amount is not a number',
  'unsupported-format': 'amount is text in a format toAgorot does not accept (exponent, commas, ...)',
};

// Why toAgorot() rejected a legacy amount.
function skipReason(raw) {
  if (raw === undefined || raw === null) return 'missing';

  let n;
  if (typeof raw === 'number') {
    n = raw;
  } else if (typeof raw === 'string') {
    if (raw.trim() === '') return 'missing';
    n = Number(raw.trim());
  } else {
    return 'not-a-number';
  }

  if (Number.isNaN(n)) return typeof raw === 'number' ? 'nan' : 'not-a-number';
  if (!Number.isFinite(n)) return 'not-finite';
  if (n === 0) return 'zero';
  if (n < 0) return 'negative';
  if (amountError(raw) === 'too-large' || n * 100 > MAX_AMOUNT_AGOROT) return 'above-bound';
  return typeof raw === 'number' ? 'rounds-to-zero' : 'unsupported-format';
}

// Decide what to do with one transaction document's data.
//   { status: 'migrated', outOfRange }      already has an integer amountAgorot; never touched
//   { status: 'migrate', amountAgorot, replaces }
//   { status: 'skip', reason }
export function classifyDocument(data) {
  const existing = data?.amountAgorot;
  if (Number.isInteger(existing)) {
    return { status: 'migrated', outOfRange: existing < 1 || existing > MAX_AMOUNT_AGOROT };
  }

  const raw = data?.amount;
  const amountAgorot = toAgorot(raw);
  if (amountAgorot !== null) {
    // existing is a leftover non-integer value (float, string, ...), reported and replaced.
    return { status: 'migrate', amountAgorot, replaces: existing };
  }
  return { status: 'skip', reason: skipReason(raw) };
}

// Printable form of a raw value (JSON.stringify would turn NaN into null).
export function describeValue(value) {
  if (value === undefined) return 'undefined';
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

// docs: iterable of { id, data, updateTime? }. updateTime is an opaque value from the scan that
// is passed back as a write precondition, so a document edited meanwhile is not overwritten.
export function planMigration(docs) {
  const plan = {
    scanned: 0,
    alreadyMigrated: 0,
    toMigrate: [],
    skipped: [],
    skippedByReason: {},
    outOfRange: [], // already-migrated documents whose integer is outside 1..max (informational)
  };

  for (const doc of docs) {
    plan.scanned += 1;
    const result = classifyDocument(doc.data);

    if (result.status === 'migrated') {
      plan.alreadyMigrated += 1;
      if (result.outOfRange) plan.outOfRange.push({ id: doc.id, amountAgorot: doc.data.amountAgorot });
    } else if (result.status === 'migrate') {
      plan.toMigrate.push({
        id: doc.id,
        amount: doc.data.amount,
        amountAgorot: result.amountAgorot,
        replaces: result.replaces,
        updateTime: doc.updateTime,
      });
    } else {
      plan.skipped.push({ id: doc.id, uid: doc.data?.uid, reason: result.reason, amount: doc.data?.amount });
      plan.skippedByReason[result.reason] = (plan.skippedByReason[result.reason] || 0) + 1;
    }
  }

  return plan;
}

// Write the planned changes. db must provide collection(name).doc(id) and batch(); each batch
// has update(ref, data, precondition) and commit(). Only { amountAgorot } is ever written, with
// update (never set), so every other field, including the old amount, stays as it is.
// If a batch is rejected (for example a document was deleted or changed since the scan) its
// documents are retried one by one so only the offending ones fail.
// Returns { updated, failed: [{ id, error }] }.
export async function applyPlan(db, items, { batchSize = MAX_BATCH_SIZE, onBatch = () => {} } = {}) {
  const size = Math.min(batchSize, MAX_BATCH_SIZE);
  let updated = 0;
  const failed = [];

  const precondition = (item) => (item.updateTime ? { lastUpdateTime: item.updateTime } : undefined);
  const refOf = (item) => db.collection(COLLECTION).doc(item.id);

  let index = 0;
  for (const group of chunk(items, size)) {
    index += 1;
    const batch = db.batch();
    for (const item of group) {
      batch.update(refOf(item), { amountAgorot: item.amountAgorot }, precondition(item));
    }

    try {
      await batch.commit();
      updated += group.length;
      onBatch({ index, size: group.length, retried: false });
    } catch (batchError) {
      let ok = 0;
      for (const item of group) {
        try {
          await refOf(item).update({ amountAgorot: item.amountAgorot }, precondition(item));
          ok += 1;
        } catch (error) {
          failed.push({ id: item.id, error: error?.message || String(error) });
        }
      }
      updated += ok;
      onBatch({ index, size: group.length, retried: true, error: batchError?.message || String(batchError) });
    }
  }

  return { updated, failed };
}

// Human-readable report of a plan, as an array of lines.
export function formatReport(plan, { sample = 10 } = {}) {
  const lines = [];
  lines.push(`Scanned:           ${plan.scanned}`);
  lines.push(`Already migrated:  ${plan.alreadyMigrated}`);
  lines.push(`To migrate:        ${plan.toMigrate.length}`);
  lines.push(`Skipped (review):  ${plan.skipped.length}`);
  for (const [reason, count] of Object.entries(plan.skippedByReason)) {
    lines.push(`  ${reason}: ${count}  (${SKIP_REASONS[reason] || reason})`);
  }

  if (plan.toMigrate.length > 0) {
    const shown = plan.toMigrate.slice(0, sample);
    lines.push('');
    lines.push(`Sample of planned changes (${shown.length} of ${plan.toMigrate.length}):`);
    for (const item of shown) {
      const replaces = item.replaces === undefined ? '' : `  (replaces existing amountAgorot ${describeValue(item.replaces)})`;
      lines.push(`  ${item.id}  amount ${describeValue(item.amount)} -> amountAgorot ${item.amountAgorot}${replaces}`);
    }
  }

  if (plan.skipped.length > 0) {
    lines.push('');
    lines.push('Skipped documents, NOT modified (review manually):');
    for (const item of plan.skipped) {
      lines.push(`  ${item.id}  uid=${item.uid ?? '?'}  reason=${item.reason}  amount=${describeValue(item.amount)}`);
    }
  }

  if (plan.outOfRange.length > 0) {
    lines.push('');
    lines.push('Already-migrated documents whose amountAgorot is outside 1..1,000,000,000 (not modified):');
    for (const item of plan.outOfRange) lines.push(`  ${item.id}  amountAgorot=${item.amountAgorot}`);
  }

  return lines;
}
