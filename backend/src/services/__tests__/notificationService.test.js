import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildIdempotencyKey,
  matchesTypePattern,
  resolveChannelTargets,
  emitNotification,
  markAllNotificationsRead
} from '../notificationService.js';
import Notification from '../../models/Notification.js';
import NotificationDeliveryLog from '../../models/NotificationDeliveryLog.js';
import NotificationPreference from '../../models/NotificationPreference.js';

test('matchesTypePattern supports wildcards and exact matches', () => {
  assert.equal(matchesTypePattern('project.invite', '*'), true);
  assert.equal(matchesTypePattern('project.invite', 'project.*'), true);
  assert.equal(matchesTypePattern('project.invite', 'project.invite'), true);
  assert.equal(matchesTypePattern('project.invite', 'application.*'), false);
});

test('resolveChannelTargets respects preferences and requested channels', () => {
  const prefs = [
    { typePattern: '*', inAppEnabled: true, emailEnabled: true },
    { typePattern: 'application.*', inAppEnabled: true, emailEnabled: false }
  ];

  const result = resolveChannelTargets('application.status_changed', prefs, {
    inApp: true,
    email: true
  });

  assert.equal(result.inApp, true);
  assert.equal(result.email, false);

  const requestedOff = resolveChannelTargets('application.status_changed', prefs, {
    inApp: false,
    email: true
  });
  assert.equal(requestedOff.inApp, false);
});

test('buildIdempotencyKey uses stable payload identifiers when provided', () => {
  const keyWithId = buildIdempotencyKey({
    type: 'foo.bar',
    userId: 'u1',
    payload: { entityId: 'xyz' }
  });
  assert.equal(keyWithId, 'foo.bar:u1:xyz');

  const explicit = buildIdempotencyKey({
    type: 'foo.bar',
    userId: 'u1',
    idempotencyKey: 'custom-key'
  });
  assert.equal(explicit, 'custom-key');
});

test('emitNotification short-circuits when idempotency key already exists', async () => {
  NotificationPreference.find = async () => [];
  NotificationDeliveryLog.findOne = async () => ({ _id: 'log1' });

  let created = 0;
  Notification.create = async () => {
    created += 1;
    return { _id: 'n1' };
  };

  const result = await emitNotification({ type: 'demo', userId: 'user-1' });
  assert.equal(created, 0);
  assert.equal(result.deliveryLog._id, 'log1');
});

test('markAllNotificationsRead returns unreadCount after update', async () => {
  Notification.updateMany = async () => ({ modifiedCount: 2 });
  Notification.countDocuments = async () => 0;

  const result = await markAllNotificationsRead('user-2');
  assert.equal(result.unreadCount, 0);
});




