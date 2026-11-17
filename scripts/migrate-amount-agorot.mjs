#!/usr/bin/env node
// One-off migration: add the integer field amountAgorot to every transaction that lacks it.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/migrate-amount-agorot.mjs [options]
//
// Default is a DRY RUN that only reads. Writing requires --apply (and --project).
// Only amountAgorot is written; the old amount and every other field are left untouched.
// Re-running is safe: documents that already have an integer amountAgorot are never touched.
//
// Credentials: Application Default Credentials. Point GOOGLE_APPLICATION_CREDENTIALS at a
// service account JSON key file. With FIRESTORE_EMULATOR_HOST set, the emulator is used instead.
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { COLLECTION, planMigration, applyPlan, formatReport } from './lib/amountMigration.mjs';

const USAGE = `Usage: node scripts/migrate-amount-agorot.mjs [options]

  --dry-run          Read only; print counts and a sample of planned changes (default).
  --apply            Write amountAgorot to the documents that need it. Requires --project.
  --project <id>     Firebase project id. Required with --apply; printed in every run.
  --sample <n>       How many planned changes to print (default 10).
  --out <file>       Also save the full plan (to migrate, skipped) as JSON.
  -h, --help         Show this help.

Authentication: set GOOGLE_APPLICATION_CREDENTIALS to the path of a service account key file.
`;

function fail(message) {
  console.error(`Error: ${message}\n`);
  console.error(USAGE);
  process.exit(1);
}

let args;
try {
  args = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      apply: { type: 'boolean', default: false },
      project: { type: 'string' },
      sample: { type: 'string', default: '10' },
      out: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  }).values;
} catch (error) {
  fail(error.message);
}

if (args.help) {
  console.log(USAGE);
  process.exit(0);
}
if (args.apply && args['dry-run']) fail('use either --dry-run or --apply, not both');
if (args.apply && !args.project) fail('--apply requires an explicit --project <id>');

const sample = Number.parseInt(args.sample, 10);
if (!Number.isInteger(sample) || sample < 0) fail('--sample must be a non-negative integer');

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const projectId = args.project || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;

if (!emulatorHost && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  fail('set GOOGLE_APPLICATION_CREDENTIALS to the path of a service account key file');
}

const app = initializeApp(emulatorHost ? { projectId } : { credential: applicationDefault(), projectId });
const db = getFirestore(app);
const resolvedProject = app.options.projectId || projectId || '(from credentials)';

console.log(`Mode:      ${args.apply ? 'APPLY (writes enabled)' : 'DRY RUN (nothing will be written)'}`);
console.log(`Project:   ${resolvedProject}`);
console.log(`Firestore: ${emulatorHost ? `emulator at ${emulatorHost}` : 'PRODUCTION'}`);
console.log('');

// Read every transaction, fetching only the fields the plan needs.
const docs = [];
try {
  for await (const snap of db.collection(COLLECTION).select('amount', 'amountAgorot', 'uid').stream()) {
    docs.push({ id: snap.id, data: snap.data(), updateTime: snap.updateTime });
  }
} catch (error) {
  console.error(`Failed to read ${COLLECTION}: ${error.message}`);
  process.exit(1);
}

const plan = planMigration(docs);
for (const line of formatReport(plan, { sample })) console.log(line);

if (args.out) {
  const serialisable = {
    ...plan,
    toMigrate: plan.toMigrate.map(({ updateTime, ...rest }) => ({ ...rest, updateTime: updateTime?.toDate?.().toISOString() })),
    skipped: plan.skipped.map((s) => ({ ...s, amount: String(s.amount) })),
  };
  fs.writeFileSync(args.out, JSON.stringify(serialisable, null, 2));
  console.log(`\nPlan saved to ${args.out}`);
}

if (!args.apply) {
  console.log('\nDry run complete. Nothing was written. Re-run with --apply --project <id> to write.');
  process.exit(0);
}

if (plan.toMigrate.length === 0) {
  console.log('\nNothing to migrate.');
  process.exit(0);
}

if (!emulatorHost) {
  console.log(`\nApplying to PRODUCTION project "${resolvedProject}" in 5 seconds. Press Ctrl+C to abort.`);
  await new Promise((resolve) => setTimeout(resolve, 5000));
}

console.log(`\nWriting ${plan.toMigrate.length} documents in batches of up to 500 (update of amountAgorot only)...`);
const result = await applyPlan(db, plan.toMigrate, {
  onBatch: ({ index, size, retried, error }) =>
    console.log(`  batch ${index}: ${size} documents${retried ? ` (batch rejected, retried one by one: ${error})` : ''}`),
});

console.log('');
console.log(`Updated: ${result.updated}`);
console.log(`Failed:  ${result.failed.length}`);
for (const f of result.failed) console.log(`  ${f.id}: ${f.error}`);
if (result.failed.length > 0) {
  console.log('\nSome documents were not updated (for example deleted or edited since the scan). Re-run to retry.');
  process.exit(1);
}
