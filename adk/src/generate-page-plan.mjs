import { readFile } from 'node:fs/promises';

import { Gemini, InMemoryRunner, LlmAgent, LogLevel, setLogLevel } from '@google/adk';

import { PagePlanSchema } from './page-plan-output-schema.mjs';

// Silence ADK internal logs that may include ANSI escapes.
setLogLevel(LogLevel.ERROR);

// NOTE: This generator is invoked by the Python pipeline when pagePlanJson is missing.
// stdin: { "intake": { ... } }
// stdout: a valid page_plan.json object (JSON only)

function readStdin() {
  return new Promise((resolve) => {
    let s = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => (s += d));
    process.stdin.on('end', () => resolve(s));
  });
}

function debug(...args) {
  if (process.env.DEBUG_ADK === '1') {
    // eslint-disable-next-line no-console
    console.error('[adk]', ...args);
  }
}

function stripCodeFences(s) {
  if (!s) return s;
  const trimmed = s.trim();
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```[a-zA-Z]*\s*/m, '').replace(/\s*```$/m, '').trim();
  }
  return trimmed;
}

function isoNow() {
  return new Date().toISOString();
}

function buildInstruction(intake) {
  const projectName = String(intake.projectName || intake.name || 'Untitled Project');

  return `You MUST output ONE JSON object that matches this exact TypeScript-like shape:
{
  "$schema"?: string,
  "meta": { "projectName": string, "generatedAt": string, "status": "draft"|"review"|"approved" },
  "site": { "title": string, "description": string, "favicon"?: string },
  "tokens": { "colorPrimary": string, "colorAccent": string },
  "sections": Array<
    | { "type":"hero", "variant":"centered"|"split"|"video-bg", "props": { "headline": string, "subheadline"?: string, "ctaText"?: string, "ctaLink"?: string, "backgroundImage"?: string } }
    | { "type":"services", "variant":"grid"|"list"|"cards", "props": { "headline": string, "items": Array<{"title": string, "description": string, "icon"?: string}> } }
    | { "type":"about", "variant":"split"|"centered"|"timeline", "props": { "headline": string, "content": string, "image"?: string } }
    | { "type":"testimonials", "variant":"carousel"|"grid"|"single", "props": { "headline"?: string, "items": Array<{"quote": string, "author": string, "role"?: string, "avatar"?: string}> } }
    | { "type":"faq", "variant":"accordion"|"two-column"|"simple", "props": { "headline"?: string, "items": Array<{"question": string, "answer": string}> } }
    | { "type":"cta", "variant":"banner"|"split"|"minimal", "props": { "headline": string, "subheadline"?: string, "ctaText": string, "ctaLink": string } }
    | { "type":"contact", "variant":"simple"|"split-map"|"form", "props": { "headline": string, "email"?: string, "phone"?: string, "address"?: string, "formAction"?: string } }
  >
}

Hard rules:
- Output MUST be valid JSON only (no markdown, no commentary, no code fences).
- Do NOT add any extra top-level keys other than $schema/meta/site/tokens/sections.
- "sections" must be an array of objects (not strings).
- Fill "meta.generatedAt" with an ISO timestamp string.
- Keep copy concise and realistic.

Project: ${projectName}
Intake (JSON): ${JSON.stringify(intake)}
`;
}

function coerceAndValidate(rawJsonText, intake) {
  const parsed = JSON.parse(rawJsonText);

  // Fill meta fields deterministically if the model omitted them.
  if (parsed?.meta && !parsed.meta.generatedAt) parsed.meta.generatedAt = isoNow();
  if (parsed?.meta && !parsed.meta.projectName) parsed.meta.projectName = String(intake.projectName || '');
  if (parsed?.meta && !parsed.meta.status) parsed.meta.status = 'review';

  return PagePlanSchema.parse(parsed);
}

async function generateOnce({ intake }) {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.VERTEX_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  const modelName = process.env.VERTEX_MODEL || 'gemini-2.0-flash';

  debug('vertex config', { project, location, modelName });

  const model = new Gemini({
    vertexai: true,
    project,
    location,
    model: modelName,
  });

  // IMPORTANT:
  // ADK's outputSchema mode has been returning null/partial objects for this use-case.
  // We instead force JSON via responseMimeType + very explicit prompt, then validate locally.
  const agent = new LlmAgent({
    name: 'page_plan_generator',
    description: 'Generates a sitegen page plan JSON document from business intake.',
    model,
    instruction: '',
    generateContentConfig: {
      temperature: 0.2,
      topP: 0.9,
      responseMimeType: 'application/json',
    },
    disallowTransferToParent: true,
    disallowTransferToPeers: true,
  });

  const runner = new InMemoryRunner({ agent, appName: 'sitegen-adk-generator' });
  const session = await runner.sessionService.createSession({
    appName: runner.appName,
    userId: 'local',
    state: {},
  });

  const basePrompt = buildInstruction(intake);

  async function runOnce(promptText) {
    let last;
    let lastError;

    for await (const event of runner.runAsync({
      userId: session.userId,
      sessionId: session.id,
      newMessage: { role: 'user', parts: [{ text: promptText }] },
    })) {
      last = event;
      if (event?.errorCode || event?.errorMessage) lastError = event;
      debug('event', {
        author: event?.author,
        hasContent: !!event?.content,
        partial: !!event?.partial,
        errorCode: event?.errorCode,
      });
    }

    if (lastError && (!last?.content || !(last.content.parts || []).length)) {
      throw new Error(
        `Vertex/ADK error (${lastError.errorCode || 'unknown'}): ${lastError.errorMessage || 'unknown error'}`,
      );
    }

    const joined = (last?.content?.parts || []).map((p) => p.text || '').join('\n');
    return stripAnsi(stripCodeFences(joined).trim());
  }

  // Up to 3 attempts: initial + 2 repairs.
  let candidate = await runOnce(basePrompt);

  for (let attempt = 0; attempt < 3; attempt++) {
    if (!candidate) {
      throw new Error('Model returned empty output (no content parts).');
    }

    let parsed;
    try {
      parsed = JSON.parse(candidate);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const repairPrompt = `${basePrompt}\n\nYour previous output was not valid JSON (${msg}). Output ONLY valid JSON that matches the required shape. Previous output: ${candidate}`;
      candidate = await runOnce(repairPrompt);
      continue;
    }

    const validated = PagePlanSchema.safeParse(parsed);
    if (validated.success) {
      // Fill meta defaults if needed (rare, but safe).
      const obj = validated.data;
      if (obj.meta && !obj.meta.generatedAt) obj.meta.generatedAt = isoNow();
      if (obj.meta && !obj.meta.projectName) obj.meta.projectName = String(intake.projectName || '');
      if (obj.meta && !obj.meta.status) obj.meta.status = 'review';
      return PagePlanSchema.parse(obj);
    }

    // Build a concise repair prompt from zod errors.
    const zodIssues = validated.error.issues
      .slice(0, 12)
      .map((iss) => `- ${iss.path.join('.') || '<root>'}: ${iss.message}`)
      .join('\n');

    const repairPrompt = `${basePrompt}\n\nThe JSON did not validate. Fix it and output ONLY the corrected JSON.\nValidation issues:\n${zodIssues}\nPrevious JSON:\n${candidate}`;
    candidate = await runOnce(repairPrompt);
  }

  throw new Error('Failed to produce a valid page plan after multiple attempts.');
}

async function main() {
  const stdin = await readStdin();

  /** @type {{ intakePath?: string, intake?: any }} */
  const input = stdin ? JSON.parse(stdin) : {};

  let intake = input.intake;
  if (!intake && input.intakePath) {
    const raw = await readFile(input.intakePath, 'utf-8');
    intake = JSON.parse(raw);
  }

  if (!intake || typeof intake !== 'object') {
    console.error('Missing intake. Provide JSON on stdin: {"intake": {...}}');
    process.exit(2);
  }

  try {
    const plan = await generateOnce({ intake });
    // stdout must be ONLY JSON.
    process.stdout.write(JSON.stringify(plan));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`ADK generator failed: ${msg}`);
    process.exit(3);
  }
}

function stripAnsi(s) {
  if (!s) return s;
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
}

await main();
