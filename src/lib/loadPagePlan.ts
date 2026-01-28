import { readFile } from 'fs/promises';

import { PagePlanSchema, type PagePlan } from './schema';

export type PagePlanLoadErrorCode =
  | 'MISSING_FILE'
  | 'READ_ERROR'
  | 'INVALID_JSON'
  | 'SCHEMA_VALIDATION';

export type PagePlanLoadError = {
  code: PagePlanLoadErrorCode;
  message: string;
  details?: string;
};

export type PagePlanLoadResult =
  | { ok: true; data: PagePlan }
  | { ok: false; error: PagePlanLoadError };

function formatZodIssues(issues: Array<{ path: Array<string | number>; message: string }>): string {
  return issues
    .map((i) => {
      const path = i.path.length ? i.path.join('.') : '(root)';
      return `- ${path}: ${i.message}`;
    })
    .join('\n');
}

/**
 * Loads and validates `content/page_plan.json`.
 *
 * Returns a result object so routes can show a friendly error UI.
 */
export async function loadPagePlan(): Promise<PagePlanLoadResult> {
  // Resolve relative to this module so it works in dev/build/Docker regardless of CWD.
  const pagePlanUrl = new URL('../../content/page_plan.json', import.meta.url);

  let raw: string;
  try {
    raw = await readFile(pagePlanUrl, 'utf-8');
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      return {
        ok: false,
        error: {
          code: 'MISSING_FILE',
          message: `Missing page plan file at ${pagePlanUrl.pathname}`,
        },
      };
    }

    return {
      ok: false,
      error: {
        code: 'READ_ERROR',
        message: `Failed to read page plan file at ${pagePlanUrl.pathname}`,
        details: String(err?.message ?? err),
      },
    };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err: any) {
    return {
      ok: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Invalid JSON in content/page_plan.json',
        details: String(err?.message ?? err),
      },
    };
  }

  const result = PagePlanSchema.safeParse(json);
  if (!result.success) {
    return {
      ok: false,
      error: {
        code: 'SCHEMA_VALIDATION',
        message: 'page_plan.json failed schema validation',
        details: formatZodIssues(result.error.issues),
      },
    };
  }

  return { ok: true, data: result.data };
}

/**
 * Strict helper for use in builds/CI where you want to fail fast.
 */
export async function loadPagePlanOrThrow(): Promise<PagePlan> {
  const result = await loadPagePlan();
  if (result.ok) return result.data;

  const details = result.error.details ? `\n${result.error.details}` : '';
  throw new Error(`${result.error.message}${details}`);
}
