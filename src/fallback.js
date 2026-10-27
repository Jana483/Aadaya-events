/**
 * Deterministic rule-based planner.
 * Used when Gemini is unreachable so users always get a usable plan,
 * and also used to keep AI budgets honest (see normaliseBudget in planner.js).
 */

const BUDGET_SPLITS = Object.freeze({
  Wedding: { Venue: 0.2, 'Catering': 0.3, 'Decor & Flowers': 0.12, 'Photography & Video': 0.1, 'Attire & Jewellery': 0.12, 'Music & Entertainment': 0.06, 'Invitations & Gifts': 0.05, Contingency: 0.05 },
  Birthday: { Venue: 0.2, Catering: 0.3, 'Cake & Desserts': 0.1, 'Decor & Balloons': 0.15, 'Entertainment & Games': 0.12, 'Return Gifts': 0.08, Contingency: 0.05 },
  'Community Event': { Venue: 0.2, 'Food & Refreshments': 0.25, 'Sound & Stage': 0.15, 'Permits & Safety': 0.1, 'Promotion': 0.1, 'Volunteers & Logistics': 0.1, Contingency: 0.1 },
  default: { Venue: 0.22, Catering: 0.3, Decor: 0.15, 'Photography': 0.1, Entertainment: 0.1, 'Gifts & Stationery': 0.06, Contingency: 0.07 },
});

const VENDORS = Object.freeze({
  Wedding: ['Venue', 'Caterer', 'Decorator', 'Photographer & Videographer', 'Priest / Officiant', 'Makeup Artist', 'DJ / Band', 'Mehendi Artist'],
  Birthday: ['Venue', 'Caterer', 'Baker', 'Decorator', 'Entertainer / Games Host', 'Photographer'],
  'Community Event': ['Venue / Ground', 'Sound & Stage', 'Food Stalls', 'Security', 'Cleaning Crew', 'Printing & Banners'],
  default: ['Venue', 'Caterer', 'Decorator', 'Photographer', 'Entertainment'],
});

const QUESTIONS = Object.freeze([
  'Is the date available, and what is the advance payment?',
  'What is included in the quoted price (taxes, transport, setup)?',
  'What is the cancellation and refund policy?',
]);

/** Largest-remainder rounding so category amounts add up exactly to the total. */
export function splitBudget(total, splits) {
  const entries = Object.entries(splits);
  const raw = entries.map(([category, pct]) => ({ category, exact: total * pct }));
  const floored = raw.map((r) => ({ ...r, amount: Math.floor(r.exact) }));
  let remainder = total - floored.reduce((s, r) => s + r.amount, 0);
  floored
    .map((r, i) => ({ i, frac: r.exact - r.amount }))
    .sort((a, b) => b.frac - a.frac)
    .forEach(({ i }) => {
      if (remainder > 0) {
        floored[i].amount += 1;
        remainder -= 1;
      }
    });
  return floored.map(({ category, amount }) => ({ category, amount, notes: '' }));
}

export function buildFallbackPlan(input) {
  const splits = BUDGET_SPLITS[input.eventType] || BUDGET_SPLITS.default;
  const vendors = VENDORS[input.eventType] || VENDORS.default;
  const who = input.honoree ? ` for ${input.honoree}` : '';
  const perGuest = Math.round(input.budget / input.guests);

  return {
    source: 'fallback',
    summary: `${input.eventType}${who} in ${input.city} for ${input.guests} guests with a budget of INR ${input.budget.toLocaleString('en-IN')} (about INR ${perGuest.toLocaleString('en-IN')} per guest).`,
    totalEstimate: input.budget,
    budget: splitBudget(input.budget, splits),
    timeline: [
      { when: '8-12 weeks before', task: 'Fix the date, guest list and budget; book the venue.' },
      { when: '6-8 weeks before', task: 'Book caterer, decorator and photographer; send save-the-dates.' },
      { when: '4 weeks before', task: 'Finalise menu, theme and entertainment; send invitations.' },
      { when: '2 weeks before', task: 'Confirm RSVPs, order gifts and decor items, plan seating.' },
      { when: '3 days before', task: 'Reconfirm every vendor, share the day-of schedule.' },
      { when: 'Event day', task: 'Arrive early, assign a point person for vendors, enjoy the celebration.' },
    ],
    vendors: vendors.map((vendor) => ({ vendor, why: `Needed for a smooth ${input.eventType.toLowerCase()}.`, questionsToAsk: [...QUESTIONS] })),
    ideas: {
      theme: input.theme || `Classic ${input.eventType.toLowerCase()} celebration`,
      colors: ['Marigold yellow', 'Royal blue', 'Ivory'],
      decor: ['Fresh flower garlands', 'Fairy lights', 'A personalised photo wall'],
      food: input.dietary ? [`Menu planned for: ${input.dietary}`] : ['Regional favourites', 'Live chaat counter'],
      activities: input.interests ? [`Activity inspired by: ${input.interests}`] : ['Photo booth', 'Music and dance'],
      personalTouches: input.culture ? [`Include ${input.culture} traditions`] : ['Handwritten welcome notes'],
    },
    tips: ['Keep 5-10% of the budget for surprises.', 'Get every vendor agreement in writing.'],
  };
}
