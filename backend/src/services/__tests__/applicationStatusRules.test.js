import test from 'node:test';
import assert from 'node:assert/strict';

import {
  APPLICATION_STATUSES,
  canTransition,
  assertValidTransition
} from '../applicationStatusRules.js';

test('allows forward progression and rejection from allowed states', () => {
  assert.equal(canTransition('applied', 'in_review'), true);
  assert.equal(canTransition('in_review', 'shortlisted'), true);
  assert.equal(canTransition('shortlisted', 'hired'), true);
  assert.equal(canTransition('applied', 'rejected'), true);
  assert.equal(canTransition('in_review', 'rejected'), true);
  assert.equal(canTransition('shortlisted', 'rejected'), true);
});

test('disallows backwards or illegal transitions', () => {
  assert.equal(canTransition('hired', 'in_review'), false);
  assert.equal(canTransition('rejected', 'shortlisted'), false);
  assert.equal(canTransition('shortlisted', 'applied'), false);
});

test('no-op transitions are allowed', () => {
  APPLICATION_STATUSES.forEach((status) => {
    assert.equal(canTransition(status, status), true);
  });
});

test('assertValidTransition throws 400 on invalid transitions', () => {
  try {
    assertValidTransition('hired', 'in_review');
    assert.fail('Expected error not thrown');
  } catch (error) {
    assert.equal(error.status, 400);
    assert.ok(error.message.includes('Invalid status transition'));
  }
});

