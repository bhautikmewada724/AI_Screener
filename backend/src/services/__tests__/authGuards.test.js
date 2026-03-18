import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveRegistrationRole } from '../../controllers/authController.js';
import { authorizeRoles } from '../../middlewares/authMiddleware.js';
import { ROLES } from '../../utils/roles.js';

test('resolveRegistrationRole always forces candidate role', () => {
  assert.equal(resolveRegistrationRole(), ROLES.CANDIDATE);
  assert.equal(resolveRegistrationRole('admin'), ROLES.CANDIDATE);
  assert.equal(resolveRegistrationRole('hr'), ROLES.CANDIDATE);
});

test('authorizeRoles enforces admin-only access', async () => {
  const middleware = authorizeRoles(ROLES.ADMIN);

  const buildRes = () => {
    return {
      statusCode: 0,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      }
    };
  };

  // Missing user should be forbidden
  {
    const res = buildRes();
    let nextCalled = false;
    await middleware({}, res, () => {
      nextCalled = true;
    });
    assert.equal(res.statusCode, 403);
    assert.equal(nextCalled, false);
  }

  // HR user should be forbidden
  {
    const res = buildRes();
    let nextCalled = false;
    await middleware({ user: { role: ROLES.HR } }, res, () => {
      nextCalled = true;
    });
    assert.equal(res.statusCode, 403);
    assert.equal(nextCalled, false);
  }

  // Admin user should pass through
  {
    const res = buildRes();
    let nextCalled = false;
    await middleware({ user: { role: ROLES.ADMIN } }, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 0);
    assert.equal(res.body, null);
  }
});
