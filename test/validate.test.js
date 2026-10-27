import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePlanRequest, cleanText } from '../src/validate.js';

const good = { eventType: 'Birthday', guests: 60, budget: 80000, city: 'Hyderabad' };

test('accepts a valid request and applies defaults', () => {
  const r = validatePlanRequest(good);
  assert.equal(r.ok, true);
  assert.equal(r.value.guests, 60);
  assert.equal(r.value.honoree, '');
});

test('defaults city to India when empty', () => {
  const r = validatePlanRequest({ ...good, city: '' });
  assert.equal(r.value.city, 'India');
});

test('rejects unknown event types', () => {
  const r = validatePlanRequest({ ...good, eventType: 'Heist' });
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /eventType/);
});

test('rejects out-of-range guests and budget', () => {
  const r = validatePlanRequest({ ...good, guests: 0, budget: 10 });
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 2);
});

test('rejects bad date format', () => {
  const r = validatePlanRequest({ ...good, date: '15/11/2026' });
  assert.equal(r.ok, false);
});

test('handles missing body safely', () => {
  assert.equal(validatePlanRequest(undefined).ok, false);
  assert.equal(validatePlanRequest('text').ok, false);
});

test('cleanText strips tags, control chars and caps length', () => {
  assert.equal(cleanText('<script>alert(1)</script>'), 'script alert(1) /script');
  assert.equal(cleanText('a\n\tb'), 'a b');
  assert.equal(cleanText('x'.repeat(500), 10).length, 10);
  assert.equal(cleanText(null), '');
});
