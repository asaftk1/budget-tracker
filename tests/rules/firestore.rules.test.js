// Dev-only Firestore rules tests. Run with: npm run test:rules
// Uses the Firestore emulator started by `firebase emulators:exec`.
const { describe, it, before, after, beforeEach } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');

const PROJECT_ID = 'demo-budget-tracker';
const OWNER = 'alice';
const OTHER = 'bob';

// Each collection with a sample document id and a valid payload for a given uid.
const COLLECTIONS = {
  transactions: {
    id: 'tx1',
    data: (uid) => ({ uid, date: '2026-01-15', type: 'expense', amount: 10, category: 'food' }),
  },
  categories: {
    id: 'cat1',
    data: (uid) => ({ uid, name: 'food' }),
  },
  merchantCategories: {
    // Custom document id: "<uid>_<merchant>"
    id: `${OWNER}_shop`,
    data: (uid) => ({ uid, merchant: 'shop', merchantNormalized: 'shop', category: 'food' }),
  },
};

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: fs.readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8') },
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed one document per collection, owned by OWNER, bypassing rules.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [name, c] of Object.entries(COLLECTIONS)) {
      await db.collection(name).doc(c.id).set(c.data(OWNER));
    }
  });
});

const verified = (uid) => testEnv.authenticatedContext(uid, { email_verified: true }).firestore();
const unverified = (uid) => testEnv.authenticatedContext(uid, { email_verified: false }).firestore();
const anonymous = () => testEnv.unauthenticatedContext().firestore();

for (const [name, c] of Object.entries(COLLECTIONS)) {
  describe(name, () => {
    const doc = (db) => db.collection(name).doc(c.id);
    const newDoc = (db, id = 'new1') => db.collection(name).doc(id);
    const ownList = (db, uid) => db.collection(name).where('uid', '==', uid).get();

    describe('verified owner', () => {
      it('can get', async () => assertSucceeds(doc(verified(OWNER)).get()));
      it('can list own documents', async () => assertSucceeds(ownList(verified(OWNER), OWNER)));
      it('can create with own uid', async () => {
        const id = name === 'merchantCategories' ? `${OWNER}_other` : 'new1';
        await assertSucceeds(newDoc(verified(OWNER), id).set(c.data(OWNER)));
      });
      it('can update without changing uid', async () =>
        assertSucceeds(doc(verified(OWNER)).update({ category: 'changed' })));
      it('can delete', async () => assertSucceeds(doc(verified(OWNER)).delete()));
    });

    describe('verified user on another user\'s document', () => {
      it('cannot get', async () => assertFails(doc(verified(OTHER)).get()));
      it('cannot list the other user\'s documents', async () =>
        assertFails(ownList(verified(OTHER), OWNER)));
      it('cannot update', async () =>
        assertFails(doc(verified(OTHER)).update({ category: 'hacked' })));
      it('cannot delete', async () => assertFails(doc(verified(OTHER)).delete()));
    });

    describe('create and update with a foreign or changed uid', () => {
      it('cannot create with someone else\'s uid', async () =>
        assertFails(newDoc(verified(OWNER)).set(c.data(OTHER))));
      it('owner cannot reassign the document to another uid', async () =>
        assertFails(doc(verified(OWNER)).update({ uid: OTHER })));
    });

    describe('unverified user (email_verified false), even on own document', () => {
      it('cannot get', async () => assertFails(doc(unverified(OWNER)).get()));
      it('cannot list', async () => assertFails(ownList(unverified(OWNER), OWNER)));
      it('cannot create', async () => {
        const id = name === 'merchantCategories' ? `${OWNER}_other` : 'new1';
        await assertFails(newDoc(unverified(OWNER), id).set(c.data(OWNER)));
      });
      it('cannot update', async () =>
        assertFails(doc(unverified(OWNER)).update({ category: 'changed' })));
      it('cannot delete', async () => assertFails(doc(unverified(OWNER)).delete()));
    });

    describe('unauthenticated', () => {
      it('cannot get', async () => assertFails(doc(anonymous()).get()));
      it('cannot list', async () => assertFails(ownList(anonymous(), OWNER)));
      it('cannot create', async () => assertFails(newDoc(anonymous()).set(c.data(OWNER))));
      it('cannot update', async () => assertFails(doc(anonymous()).update({ category: 'x' })));
      it('cannot delete', async () => assertFails(doc(anonymous()).delete()));
    });
  });
}

describe('merchantCategories document id prefix', () => {
  const create = (id, uid) =>
    verified(OWNER).collection('merchantCategories').doc(id).set(COLLECTIONS.merchantCategories.data(uid));

  it('allows create when the id starts with own uid + "_"', async () =>
    assertSucceeds(create(`${OWNER}_new`, OWNER)));
  it('denies create with another user\'s uid prefix (own uid field)', async () =>
    assertFails(create(`${OTHER}_shop`, OWNER)));
  it('denies create with no prefix', async () => assertFails(create('shop', OWNER)));
  it('denies create when the id is only the uid (no underscore)', async () =>
    assertFails(create(OWNER, OWNER)));
  it('denies create with a lookalike prefix (alice2_)', async () =>
    assertFails(create(`${OWNER}2_shop`, OWNER)));
});

// The importer writes imported transactions with deterministic ids via writeBatch + set().
describe('transactions bulk import writes (deterministic ids, batched set)', () => {
  const tx = (uid, extra = {}) => ({ uid, date: '2025-02-28', type: 'expense', amount: 10, source: 'max', ...extra });
  const col = (db) => db.collection('transactions');

  it('set on a new deterministic id is allowed (create)', async () =>
    assertSucceeds(col(verified(OWNER)).doc('max_newid').set(tx(OWNER))));

  it('set again on the same id is allowed (re-import overwrites as an update)', async () => {
    const db = verified(OWNER);
    await assertSucceeds(col(db).doc('max_newid').set(tx(OWNER)));
    await assertSucceeds(col(db).doc('max_newid').set(tx(OWNER, { amount: 11 })));
  });

  it('set over another user\'s document id is denied', async () =>
    assertFails(col(verified(OTHER)).doc('tx1').set(tx(OTHER))));

  it('set over own document cannot change the uid', async () =>
    assertFails(col(verified(OWNER)).doc('tx1').set(tx(OTHER))));

  it('set without a uid field is denied', async () =>
    assertFails(col(verified(OWNER)).doc('max_nouid').set({ amount: 1 })));

  it('a batch mixing creates and overwrites of own documents is allowed', async () => {
    const db = verified(OWNER);
    const batch = db.batch();
    batch.set(col(db).doc('max_a'), tx(OWNER));
    batch.set(col(db).doc('max_b'), tx(OWNER));
    batch.set(col(db).doc('tx1'), tx(OWNER, { amount: 99 }));
    await assertSucceeds(batch.commit());
  });

  it('a full batch of 500 writes is allowed', async () => {
    const db = verified(OWNER);
    const batch = db.batch();
    for (let i = 0; i < 500; i += 1) batch.set(col(db).doc(`max_bulk${i}`), tx(OWNER));
    await assertSucceeds(batch.commit());
  });

  it('a batch containing one foreign-uid document is rejected as a whole', async () => {
    const db = verified(OWNER);
    const batch = db.batch();
    batch.set(col(db).doc('max_ok'), tx(OWNER));
    batch.set(col(db).doc('max_bad'), tx(OTHER));
    await assertFails(batch.commit());
    // Nothing from the failed batch was written.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const snap = await ctx.firestore().collection('transactions').doc('max_ok').get();
      if (snap.exists) throw new Error('partial batch was written');
    });
  });

  it('an unverified user cannot batch-write', async () => {
    const db = unverified(OWNER);
    const batch = db.batch();
    batch.set(col(db).doc('max_unv'), tx(OWNER));
    await assertFails(batch.commit());
  });
});

describe('catch-all', () => {
  it('denies access to collections that are not listed', async () => {
    const db = verified(OWNER);
    await assertFails(db.collection('somethingElse').doc('x').set({ uid: OWNER }));
    await assertFails(db.collection('somethingElse').doc('x').get());
  });
});
