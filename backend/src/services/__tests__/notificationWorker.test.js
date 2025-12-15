import test from 'node:test';
import assert from 'node:assert/strict';

import { processLog } from '../../workers/notificationEmailWorker.js';

const stubLog = (overrides = {}) => ({
  status: 'queued',
  userId: '507f1f77bcf86cd799439011',
  notificationId: '507f191e810c19729de860ea',
  save: async function () {
    this.saved = true;
    return this;
  },
  ...overrides
});

test('processLog sends email and marks log as sent', async () => {
  let sendCount = 0;
  const userModel = {
    async findById() {
      return { _id: '507f1f77bcf86cd799439011', email: 'user@example.com' };
    }
  };
  const notificationModel = {
    async findById() {
      return { type: 'demo', data: { title: 'Hello' } };
    }
  };

  const result = await processLog(stubLog(), {
    send: async () => {
      sendCount += 1;
      return { messageId: 'm-1' };
    },
    NotificationModel: notificationModel,
    UserModel: userModel,
    getUnsubscribeToken: async () => ({ token: 'abc', scope: 'global' })
  });

  assert.equal(sendCount, 1);
  assert.equal(result.status, 'sent');
  assert.equal(result.providerMessageId, 'm-1');
});

test('processLog skips when user email missing', async () => {
  const userModel = { async findById() { return null; } };
  const notificationModel = { async findById() { return null; } };

  const result = await processLog(stubLog(), {
    send: async () => {
      throw new Error('should not send');
    },
    NotificationModel: notificationModel,
    UserModel: userModel
  });

  assert.equal(result.status, 'skipped');
  assert.equal(result.error, 'User email unavailable');
});




