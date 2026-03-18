import test from 'node:test';
import assert from 'node:assert/strict';

import {
  updateUserRole,
  updateUserStatus
} from '../adminService.js';
import User from '../../models/User.js';
import AuditEvent from '../../models/AuditEvent.js';
import { ROLES } from '../../utils/roles.js';
import { USER_STATUSES } from '../../utils/userStatus.js';

const adminId = '507f1f77bcf86cd799439011';
const actorId = '507f1f77bcf86cd799439012';

const stubUser = (overrides = {}) => ({
  _id: adminId,
  role: ROLES.ADMIN,
  status: USER_STATUSES.ACTIVE,
  save: async () => {},
  ...overrides
});

const withStubbedModels = async (stubs, fn) => {
  const originals = {
    findById: User.findById,
    countDocuments: User.countDocuments,
    auditCreate: AuditEvent.create
  };

  try {
    if (stubs.findById) User.findById = stubs.findById;
    if (stubs.countDocuments) User.countDocuments = stubs.countDocuments;
    if (stubs.auditCreate) AuditEvent.create = stubs.auditCreate;
    await fn();
  } finally {
    User.findById = originals.findById;
    User.countDocuments = originals.countDocuments;
    AuditEvent.create = originals.auditCreate;
  }
};

test('updateUserRole prevents self role change', async () => {
  await assert.rejects(
    updateUserRole({ targetUserId: adminId, role: ROLES.HR, actorId: adminId }),
    /cannot modify your own role/i
  );
});

test('updateUserStatus prevents self status change', async () => {
  await assert.rejects(
    updateUserStatus({ targetUserId: adminId, status: USER_STATUSES.INACTIVE, actorId: adminId }),
    /cannot modify your own status/i
  );
});

test('updateUserRole rejects removing the last active admin', async () => {
  await withStubbedModels(
    {
      findById: async () => stubUser(),
      countDocuments: async () => 0
    },
    async () => {
      await assert.rejects(
        updateUserRole({ targetUserId: adminId, role: ROLES.HR, actorId }),
        /Cannot remove the last active admin user./
      );
    }
  );
});

test('updateUserRole records before/after in audit log', async () => {
  const auditEvents = [];
  await withStubbedModels(
    {
      findById: async () => stubUser({ role: ROLES.HR }),
      countDocuments: async () => 2,
      auditCreate: async (payload) => {
        auditEvents.push(payload);
        return payload;
      }
    },
    async () => {
      const result = await updateUserRole({ targetUserId: adminId, role: ROLES.ADMIN, actorId });
      assert.equal(result.role, ROLES.ADMIN);
      assert.equal(auditEvents.length, 1);
      assert.equal(auditEvents[0].before.role, ROLES.HR);
      assert.equal(auditEvents[0].after.role, ROLES.ADMIN);
      assert.equal(String(auditEvents[0].targetUserId), adminId);
    }
  );
});

test('updateUserStatus records before/after in audit log', async () => {
  const auditEvents = [];
  await withStubbedModels(
    {
      findById: async () => stubUser({ status: USER_STATUSES.ACTIVE }),
      countDocuments: async () => 2,
      auditCreate: async (payload) => {
        auditEvents.push(payload);
        return payload;
      }
    },
    async () => {
      const result = await updateUserStatus({
        targetUserId: adminId,
        status: USER_STATUSES.INACTIVE,
        actorId
      });
      assert.equal(result.status, USER_STATUSES.INACTIVE);
      assert.equal(auditEvents.length, 1);
      assert.equal(auditEvents[0].before.status, USER_STATUSES.ACTIVE);
      assert.equal(auditEvents[0].after.status, USER_STATUSES.INACTIVE);
    }
  );
});

