import { readFile, writeFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { validatePagePlanAtUrl } from './validate-page-plan-core.mjs';

const root = new URL('../', import.meta.url);
const planUrl = new URL('content/page_plan.json', root);
const planPath = fileURLToPath(planUrl);

async function main() {
  const mode = process.argv[2] ?? 'valid';

  if (mode === 'valid') {
    const res = await validatePagePlanAtUrl(planUrl);
    if (!res.ok) {
      console.error('EXPECTED valid plan, got error:', res.error);
      process.exit(1);
    }
    console.log('OK valid');
    process.exit(0);
  }

  if (mode === 'invalid') {
    const original = await readFile(planUrl, 'utf-8');
    const modified = original.replace(
      /"status"\s*:\s*"draft"/,
      '"status": "not-a-status"',
    );
    await writeFile(planUrl, modified, 'utf-8');

    try {
      const res = await validatePagePlanAtUrl(planUrl);
      if (res.ok) {
        console.error('EXPECTED invalid plan, but it validated.');
        process.exit(1);
      }
      console.log('OK invalid');
    } finally {
      await writeFile(planUrl, original, 'utf-8');
    }

    process.exit(0);
  }

  if (mode === 'missing') {
    if (!existsSync(planPath)) {
      console.log('OK missing (already missing)');
      process.exit(0);
    }

    const tmpUrl = new URL('content/page_plan.json.tmp', root);

    await rename(planUrl, tmpUrl);
    try {
      const res = await validatePagePlanAtUrl(planUrl);
      if (res.ok) {
        console.error('EXPECTED missing error, but it validated.');
        process.exit(1);
      }
      if (res.error.code !== 'MISSING_FILE') {
        console.error('EXPECTED MISSING_FILE, got:', res.error);
        process.exit(1);
      }
      console.log('OK missing');
    } finally {
      await rename(tmpUrl, planUrl);
    }

    process.exit(0);
  }

  console.error('Unknown mode. Use: valid | invalid | missing');
  process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
