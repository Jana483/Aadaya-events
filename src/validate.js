/**
 * Input validation and sanitisation for event planning requests.
 * Every field is length-limited and type-checked before it reaches the model.
 */

export const EVENT_TYPES = Object.freeze([
  'Wedding',
  'Birthday',
  'Engagement',
  'Anniversary',
  'Baby Shower',
  'Housewarming',
  'Community Event',
  'Festival Celebration',
  'Corporate Event',
]);

const LIMITS = Object.freeze({
  text: 120,
  longText: 300,
  minGuests: 1,
  maxGuests: 5000,
  minBudget: 1000,
  maxBudget: 100000000,
});

/** Strip control characters and angle brackets, collapse whitespace, cap length. */
export function cleanText(value, max = LIMITS.text) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/[\u0000-\u001F\u007F<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

/**
 * Validate a raw request body.
 * @returns {{ ok: true, value: object } | { ok: false, errors: string[] }}
 */
export function validatePlanRequest(body) {
  const errors = [];
  const b = body && typeof body === 'object' ? body : {};

  const eventType = cleanText(b.eventType, 40);
  if (!EVENT_TYPES.includes(eventType)) {
    errors.push(`eventType must be one of: ${EVENT_TYPES.join(', ')}`);
  }

  const guests = toInt(b.guests);
  if (!(guests >= LIMITS.minGuests && guests <= LIMITS.maxGuests)) {
    errors.push(`guests must be a number between ${LIMITS.minGuests} and ${LIMITS.maxGuests}`);
  }

  const budget = toInt(b.budget);
  if (!(budget >= LIMITS.minBudget && budget <= LIMITS.maxBudget)) {
    errors.push(`budget must be a number between ${LIMITS.minBudget} and ${LIMITS.maxBudget} (INR)`);
  }

  const date = cleanText(b.date, 10);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.push('date must be in YYYY-MM-DD format');
  }

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      eventType,
      guests,
      budget,
      date,
      honoree: cleanText(b.honoree),
      city: cleanText(b.city) || 'India',
      theme: cleanText(b.theme),
      interests: cleanText(b.interests, LIMITS.longText),
      culture: cleanText(b.culture),
      dietary: cleanText(b.dietary),
      notes: cleanText(b.notes, LIMITS.longText),
    },
  };
}
