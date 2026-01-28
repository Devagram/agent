import { readFile } from 'node:fs/promises';

import { PagePlanSchema } from '../src/lib/schema.ts';

function formatZodIssues(issues) {
  return issues
    .map((i) => {
      const path = i.path?.length ? i.path.join('.') : '(root)';
      return `- ${path}: ${i.message}`;
    })
    .join('\n');
}

export async function validatePagePlanAtUrl(planUrl) {
  let raw;
  try {
    raw = await readFile(planUrl, 'utf-8');
  } catch (err) {
    if (err?.code === 'ENOENT') {
      return {
        ok: false,
        error: {
          code: 'MISSING_FILE',
          message: `Missing page plan file at ${planUrl.pathname}`,
        },
      };
    }

    return {
      ok: false,
      error: {
        code: 'READ_ERROR',
        message: `Failed to read page plan file at ${planUrl.pathname}`,
        details: String(err?.message ?? err),
      },
    };
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Invalid JSON in content/page_plan.json',
        details: String(err?.message ?? err),
      },
    };
  }

  const parsed = PagePlanSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'SCHEMA_VALIDATION',
        message: 'page_plan.json failed schema validation',
        details: formatZodIssues(parsed.error.issues),
      },
    };
  }

  return { ok: true, data: parsed.data };
}
