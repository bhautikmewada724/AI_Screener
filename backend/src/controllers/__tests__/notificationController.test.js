import test from 'node:test';
import assert from 'node:assert/strict';

import {
  listNotifications,
  markAllRead,
  markRead,
  updatePreferences
} from '../notificationController.js';

const buildRes = () => {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    }
  };
};

test('markRead rejects missing ids', async () => {
  const res = buildRes();
  await markRead({ user: { id: 'u1' }, body: {} }, res, () => {});
  assert.equal(res.statusCode, 400);
});

test('updatePreferences validates typePattern', async () => {
  let capturedError = null;
  const next = (err) => {
    capturedError = err;
  };
  await updatePreferences({ user: { id: 'u1' }, body: { preferences: [{}] } }, {}, next);
  assert.ok(capturedError);
});

test('listNotifications requires auth', async () => {
  const res = buildRes();
  await listNotifications({ user: null, query: {} }, res, () => {});
  assert.equal(res.statusCode, 401);
});




