import { buildFallbackPlan, splitBudget } from './fallback.js';
import { SYSTEM_INSTRUCTION, PLAN_SCHEMA, buildUserPrompt } from './prompt.js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const TIMEOUT_MS = 25000;
const CACHE_MAX = 100;
const CACHE_TTL_MS = 10 * 60 * 1000;

const asArray = (v) => (Array.isArray(v) ? v : []);
const asText = (v) => (typeof v === 'string' ? v : '');

/**
 * Make sure AI budget lines are non-negative integers that add up to the user's total.
 * Models are not reliable at arithmetic, so the code owns the maths.
 */
export function normaliseBudget(lines, total) {
  const valid = asArray(lines)
    .map((l) => ({ category: asText(l?.category), amount: Math.max(0, Math.round(Number(l?.amount) || 0)), notes: asText(l?.notes) }))
    .filter((l) => l.category);
  const sum = valid.reduce((s, l) => s + l.amount, 0);
  if (!valid.length || sum === 0) return splitBudget(total, { 'General expenses': 1 });

  const shares = Object.fromEntries(valid.map((l, i) => [i, l.amount / sum]));
  const scaled = splitBudget(total, shares);
  return valid.map((l, i) => ({ ...l, amount: scaled[i].amount }));
}

/** Coerce model output into the exact shape the frontend expects. */
export function sanitisePlan(raw, input) {
  const ideas = raw?.ideas || {};
  return {
    source: 'gemini',
    summary: asText(raw?.summary),
    totalEstimate: input.budget,
    budget: normaliseBudget(raw?.budget, input.budget),
    timeline: asArray(raw?.timeline).map((t) => ({ when: asText(t?.when), task: asText(t?.task) })),
    vendors: asArray(raw?.vendors).map((v) => ({ vendor: asText(v?.vendor), why: asText(v?.why), questionsToAsk: asArray(v?.questionsToAsk).map(asText) })),
    ideas: {
      theme: asText(ideas.theme),
      colors: asArray(ideas.colors).map(asText),
      decor: asArray(ideas.decor).map(asText),
      food: asArray(ideas.food).map(asText),
      activities: asArray(ideas.activities).map(asText),
      personalTouches: asArray(ideas.personalTouches).map(asText),
    },
    tips: asArray(raw?.tips).map(asText),
  };
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Gemini request timed out')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Create a planner. The AI client is injected so tests can run without network access.
 * @param {{ models: { generateContent: Function } } | null} aiClient
 */
export function createPlanner(aiClient, { logger = console } = {}) {
  const cache = new Map();

  return async function plan(input) {
    const key = JSON.stringify(input);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.plan;

    let result;
    try {
      if (!aiClient) throw new Error('AI client not configured');
      const response = await withTimeout(
        aiClient.models.generateContent({
          model: MODEL,
          contents: buildUserPrompt(input),
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: PLAN_SCHEMA,
            temperature: 0.8,
          },
        }),
        TIMEOUT_MS,
      );
      result = sanitisePlan(JSON.parse(response.text), input);
    } catch (err) {
      logger.error(JSON.stringify({ severity: 'WARNING', message: 'Gemini unavailable, using fallback plan', error: err.message }));
      return buildFallbackPlan(input);
    }

    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, { at: Date.now(), plan: result });
    return result;
  };
}
