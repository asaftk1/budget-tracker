// Tests for scripts/lib/amountMigration.mjs. They live under src/ only because the CRA test
// runner discovers tests there; the code under test is the one-off script in /scripts and is
// never imported by the app. No real Firestore is used: everything runs on in-memory fixtures.
import {
  classifyDocument,
  planMigration,
  applyPlan,
  formatReport,
  describeValue,
  COLLECTION,
  SKIP_REASONS,
} from '../../scripts/lib/amountMigration.mjs';
import { toAgorot, MAX_AMOUNT_AGOROT } from '../lib/money';

const doc = (id, data, updateTime) => ({ id, data, updateTime });

describe('classifyDocument: conversion', () => {
  test('legacy numeric amounts are converted with the same rounding as toAgorot', () => {
    const values = [12.5, 0.01, 19.99, 0.1 + 0.2, 49.900000000000006, 1.005, 2.675, 1234567.89, 10000000, 7, '12.5', ' 3 ', '.5'];
    for (const amount of values) {
      const result = classifyDocument({ amount });
      expect(result.status).toBe('migrate');
      expect(result.amountAgorot).toBe(toAgorot(amount));
    }
    expect(classifyDocument({ amount: 1.005 }).amountAgorot).toBe(101);
    expect(classifyDocument({ amount: 0.1 + 0.2 }).amountAgorot).toBe(30);
  });

  test('the upper bound itself converts, one agora above is skipped', () => {
    expect(classifyDocument({ amount: 10000000 }).amountAgorot).toBe(MAX_AMOUNT_AGOROT);
    expect(classifyDocument({ amount: 10000000.01 })).toEqual({ status: 'skip', reason: 'above-bound' });
  });

  test('an existing integer amountAgorot means already migrated and is never recomputed', () => {
    expect(classifyDocument({ amount: 99, amountAgorot: 1250 })).toEqual({ status: 'migrated', outOfRange: false });
  });

  test('an out-of-range integer amountAgorot is still "migrated" but flagged', () => {
    expect(classifyDocument({ amountAgorot: 0 })).toEqual({ status: 'migrated', outOfRange: true });
    expect(classifyDocument({ amountAgorot: -5 }).outOfRange).toBe(true);
    expect(classifyDocument({ amountAgorot: MAX_AMOUNT_AGOROT + 1 }).outOfRange).toBe(true);
  });

  test('a leftover non-integer amountAgorot is replaced and reported', () => {
    expect(classifyDocument({ amount: 12.5, amountAgorot: 12.5 })).toEqual({ status: 'migrate', amountAgorot: 1250, replaces: 12.5 });
    expect(classifyDocument({ amount: 3, amountAgorot: '300' })).toEqual({ status: 'migrate', amountAgorot: 300, replaces: '300' });
  });
});

describe('classifyDocument: skip logic', () => {
  const cases = [
    ['missing field', {}, 'missing'],
    ['undefined', { amount: undefined }, 'missing'],
    ['null', { amount: null }, 'missing'],
    ['blank string', { amount: '   ' }, 'missing'],
    ['NaN', { amount: NaN }, 'nan'],
    ['Infinity', { amount: Infinity }, 'not-finite'],
    ['-Infinity', { amount: -Infinity }, 'not-finite'],
    ['zero', { amount: 0 }, 'zero'],
    ['negative zero', { amount: -0 }, 'zero'],
    ['string zero', { amount: '0.00' }, 'zero'],
    ['negative', { amount: -5 }, 'negative'],
    ['negative string', { amount: '-0.01' }, 'negative'],
    ['rounds to zero', { amount: 0.004 }, 'rounds-to-zero'],
    ['above the bound', { amount: 10000000.01 }, 'above-bound'],
    ['far above the bound', { amount: 1e12 }, 'above-bound'],
    ['huge exponent', { amount: 1e300 }, 'above-bound'],
    ['text', { amount: 'abc' }, 'not-a-number'],
    ['boolean', { amount: true }, 'not-a-number'],
    ['object', { amount: {} }, 'not-a-number'],
    ['array', { amount: [5] }, 'not-a-number'],
    ['thousands separator', { amount: '1,000' }, 'not-a-number'],
    ['exponent text', { amount: '1e3' }, 'unsupported-format'],
  ];

  test.each(cases)('%s is skipped', (_name, data, reason) => {
    expect(classifyDocument(data)).toEqual({ status: 'skip', reason });
  });

  test('every reason used has a description', () => {
    for (const [, , reason] of cases) expect(SKIP_REASONS[reason]).toBeTruthy();
  });

  test('a null document is skipped rather than crashing', () => {
    expect(classifyDocument(undefined)).toEqual({ status: 'skip', reason: 'missing' });
  });
});

describe('describeValue', () => {
  test('prints values that JSON would hide', () => {
    expect(describeValue(NaN)).toBe('NaN');
    expect(describeValue(-0)).toBe('-0');
    expect(describeValue(undefined)).toBe('undefined');
    expect(describeValue(null)).toBe('null');
    expect(describeValue('abc')).toBe('"abc"');
    expect(describeValue(12.5)).toBe('12.5');
  });
});

describe('planMigration', () => {
  const docs = [
    doc('a', { uid: 'u1', amount: 12.5 }),
    doc('b', { uid: 'u1', amount: 0.1 + 0.2 }),
    doc('c', { uid: 'u2', amount: 5, amountAgorot: 500 }),
    doc('d', { uid: 'u2', amount: 0 }),
    doc('e', { uid: 'u3', amount: -3 }),
    doc('f', { uid: 'u3' }),
    doc('g', { uid: 'u3', amount: NaN }),
    doc('h', { uid: 'u3', amount: 99999999 }),
    doc('i', { uid: 'u4', amount: 1, amountAgorot: 0 }),
  ];

  test('counts add up: scanned = already migrated + to migrate + skipped', () => {
    const plan = planMigration(docs);
    expect(plan.scanned).toBe(9);
    expect(plan.alreadyMigrated).toBe(2);
    expect(plan.toMigrate.map((i) => [i.id, i.amountAgorot])).toEqual([['a', 1250], ['b', 30]]);
    expect(plan.skipped.map((s) => [s.id, s.reason])).toEqual([
      ['d', 'zero'], ['e', 'negative'], ['f', 'missing'], ['g', 'nan'], ['h', 'above-bound'],
    ]);
    expect(plan.scanned).toBe(plan.alreadyMigrated + plan.toMigrate.length + plan.skipped.length);
    expect(plan.skippedByReason).toEqual({ zero: 1, negative: 1, missing: 1, nan: 1, 'above-bound': 1 });
    expect(plan.outOfRange).toEqual([{ id: 'i', amountAgorot: 0 }]);
  });

  test('skipped entries keep the id, uid and the raw value for manual review', () => {
    const plan = planMigration(docs);
    expect(plan.skipped.find((s) => s.id === 'e')).toEqual({ id: 'e', uid: 'u3', reason: 'negative', amount: -3 });
  });

  test('accepts any iterable and handles an empty collection', () => {
    expect(planMigration(new Set(docs).values()).scanned).toBe(9);
    expect(planMigration([])).toMatchObject({ scanned: 0, alreadyMigrated: 0, toMigrate: [], skipped: [] });
  });

  test('planning does not mutate the documents', () => {
    const data = { uid: 'u', amount: 12.5 };
    planMigration([doc('x', data)]);
    expect(data).toEqual({ uid: 'u', amount: 12.5 });
  });
});

// In-memory stand-in for the Admin SDK: a store of documents with update(), atomic batches and
// lastUpdateTime preconditions. set() is deliberately absent, so a script that used it would crash.
function fakeDb(initial) {
  const store = new Map(Object.entries(initial).map(([id, data]) => [id, { data: { ...data }, time: 1 }]));
  const log = { updates: [], commits: [] };

  const check = (id, precondition) => {
    const entry = store.get(id);
    if (!entry) throw new Error(`NOT_FOUND: ${id}`);
    if (precondition?.lastUpdateTime !== undefined && precondition.lastUpdateTime !== entry.time) {
      throw new Error(`FAILED_PRECONDITION: ${id} changed`);
    }
    return entry;
  };
  const write = (id, data, precondition) => {
    const entry = check(id, precondition);
    Object.assign(entry.data, data);
    entry.time += 1;
    log.updates.push({ id, keys: Object.keys(data) });
  };
  const ref = (id) => ({ id, update: async (data, precondition) => write(id, data, precondition) });

  return {
    store,
    log,
    collection: (name) => {
      if (name !== COLLECTION) throw new Error(`unexpected collection ${name}`);
      return { doc: ref };
    },
    batch: () => {
      const ops = [];
      return {
        update: (r, data, precondition) => ops.push({ id: r.id, data, precondition }),
        commit: async () => {
          ops.forEach((op) => check(op.id, op.precondition)); // validate everything first: atomic
          log.commits.push(ops.length);
          ops.forEach((op) => write(op.id, op.data, op.precondition));
        },
      };
    },
  };
}

const scanFrom = (db) =>
  [...db.store].map(([id, { data, time }]) => doc(id, data, time));

describe('applyPlan', () => {
  test('writes only amountAgorot and leaves every other field, including amount, untouched', async () => {
    const original = { uid: 'u1', amount: 12.5, category: 'food', merchant: 'm', date: '2025-01-01' };
    const db = fakeDb({ a: original });
    const plan = planMigration(scanFrom(db));
    const result = await applyPlan(db, plan.toMigrate);

    expect(result).toEqual({ updated: 1, failed: [] });
    expect(db.store.get('a').data).toEqual({ ...original, amountAgorot: 1250 });
    expect(db.log.updates).toEqual([{ id: 'a', keys: ['amountAgorot'] }]);
  });

  test('batches of at most 500', async () => {
    const initial = Object.fromEntries(Array.from({ length: 1200 }, (_, i) => [`d${i}`, { uid: 'u', amount: 1 + i / 100 }]));
    const db = fakeDb(initial);
    const plan = planMigration(scanFrom(db));
    const result = await applyPlan(db, plan.toMigrate);
    expect(result.updated).toBe(1200);
    expect(db.log.commits).toEqual([500, 500, 200]);
  });

  test('never asks for a batch bigger than 500 even if a larger size is requested', async () => {
    const initial = Object.fromEntries(Array.from({ length: 600 }, (_, i) => [`d${i}`, { amount: 5 }]));
    const db = fakeDb(initial);
    await applyPlan(db, planMigration(scanFrom(db)).toMigrate, { batchSize: 10000 });
    expect(db.log.commits).toEqual([500, 100]);
  });

  test('is idempotent: a second run plans and changes nothing', async () => {
    const db = fakeDb({ a: { amount: 12.5 }, b: { amount: 0.1 + 0.2 }, c: { amount: 0 }, d: { amount: 3, amountAgorot: 300 } });
    await applyPlan(db, planMigration(scanFrom(db)).toMigrate);
    const snapshot = JSON.stringify([...db.store]);
    const updatesAfterFirstRun = db.log.updates.length;

    const second = planMigration(scanFrom(db));
    expect(second.toMigrate).toHaveLength(0);
    expect(second.alreadyMigrated).toBe(3);
    expect(second.skipped.map((s) => s.id)).toEqual(['c']);
    const result = await applyPlan(db, second.toMigrate);
    expect(result).toEqual({ updated: 0, failed: [] });
    expect(db.log.updates).toHaveLength(updatesAfterFirstRun);
    expect(JSON.stringify([...db.store])).toBe(snapshot);
  });

  test('skipped documents are never written', async () => {
    const db = fakeDb({ ok: { amount: 5 }, zero: { amount: 0 }, neg: { amount: -1 }, nan: { amount: NaN }, none: {}, big: { amount: 1e9 } });
    await applyPlan(db, planMigration(scanFrom(db)).toMigrate);
    expect(db.log.updates.map((u) => u.id)).toEqual(['ok']);
    for (const id of ['zero', 'neg', 'nan', 'none', 'big']) expect(db.store.get(id).data).not.toHaveProperty('amountAgorot');
  });

  test('a document deleted since the scan fails alone; the rest of its batch is still written', async () => {
    const db = fakeDb({ a: { amount: 1 }, b: { amount: 2 }, c: { amount: 3 } });
    const plan = planMigration(scanFrom(db));
    db.store.delete('b');
    const retried = [];
    const result = await applyPlan(db, plan.toMigrate, { onBatch: (info) => retried.push(info.retried) });

    expect(result.updated).toBe(2);
    expect(result.failed.map((f) => f.id)).toEqual(['b']);
    expect(result.failed[0].error).toContain('NOT_FOUND');
    expect(retried).toEqual([true]);
    expect(db.store.get('a').data.amountAgorot).toBe(100);
    expect(db.store.get('c').data.amountAgorot).toBe(300);
  });

  test('a document edited since the scan is not overwritten (precondition on update time)', async () => {
    const db = fakeDb({ a: { amount: 1 }, b: { amount: 2 } });
    const plan = planMigration(scanFrom(db));
    // A user edits b through the new app after the scan: both fields change.
    const entry = db.store.get('b');
    entry.data.amount = 50;
    entry.data.amountAgorot = 5000;
    entry.time += 1;

    const result = await applyPlan(db, plan.toMigrate);
    expect(result.updated).toBe(1);
    expect(result.failed.map((f) => f.id)).toEqual(['b']);
    expect(db.store.get('b').data).toEqual({ amount: 50, amountAgorot: 5000 });
    expect(db.store.get('a').data.amountAgorot).toBe(100);
  });

  test('items without an update time are written without a precondition', async () => {
    const db = fakeDb({ a: { amount: 1 } });
    const plan = planMigration([doc('a', { amount: 1 })]); // no updateTime in the scan
    const result = await applyPlan(db, plan.toMigrate);
    expect(result.updated).toBe(1);
  });

  test('nothing to do means no batches', async () => {
    const db = fakeDb({});
    expect(await applyPlan(db, [])).toEqual({ updated: 0, failed: [] });
    expect(db.log.commits).toEqual([]);
  });
});

describe('formatReport', () => {
  const plan = planMigration([
    doc('a', { uid: 'u1', amount: 12.5 }),
    doc('b', { uid: 'u1', amount: 5, amountAgorot: 500 }),
    doc('c', { uid: 'u2', amount: NaN }),
    doc('d', { uid: 'u2', amount: -3 }),
    doc('e', { amount: 1, amountAgorot: 0 }),
  ]);
  const text = formatReport(plan).join('\n');

  test('prints the summary counts', () => {
    expect(text).toMatch(/Scanned:\s+5/);
    expect(text).toMatch(/Already migrated:\s+2/);
    expect(text).toMatch(/To migrate:\s+1/);
    expect(text).toMatch(/Skipped \(review\):\s+2/);
  });

  test('lists a sample of planned changes with old and new values', () => {
    expect(text).toContain('a  amount 12.5 -> amountAgorot 1250');
  });

  test('lists skipped documents with id, uid, reason and raw value', () => {
    expect(text).toContain('c  uid=u2  reason=nan  amount=NaN');
    expect(text).toContain('d  uid=u2  reason=negative  amount=-3');
  });

  test('flags out-of-range existing amountAgorot values', () => {
    expect(text).toContain('e  amountAgorot=0');
  });

  test('respects the sample size', () => {
    const many = planMigration(Array.from({ length: 25 }, (_, i) => doc(`d${i}`, { amount: 1 })));
    const lines = formatReport(many, { sample: 3 }).filter((l) => l.includes('->'));
    expect(lines).toHaveLength(3);
    expect(formatReport(many, { sample: 3 }).join('\n')).toContain('3 of 25');
  });

  test('an empty plan prints zeros and no sections', () => {
    const lines = formatReport(planMigration([]));
    expect(lines.join('\n')).toMatch(/Scanned:\s+0/);
    expect(lines.join('\n')).not.toContain('Skipped documents');
  });
});
