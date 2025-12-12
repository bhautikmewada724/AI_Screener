import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import { authenticate, authorizeRoles } from '../../middlewares/authMiddleware.js';
import { ROLES } from '../../utils/roles.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const signToken = (role) =>
  jwt.sign(
    {
      sub: '507f1f77bcf86cd799439011',
      role
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

const adminToken = signToken(ROLES.ADMIN);
const hrToken = signToken(ROLES.HR);
const candidateToken = signToken(ROLES.CANDIDATE);

const buildReq = (token) => ({
  headers: token ? { authorization: `Bearer ${token}` } : {}
});

const buildRes = () => {
  return {
    statusCode: undefined,
    body: undefined,
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

const runChain = async (middlewares, req) => {
  const res = buildRes();
  let idx = 0;
  let nextCalled = false;
  const next = (err) => {
    if (err) throw err;
    idx += 1;
    const mw = middlewares[idx];
    if (mw) {
      return mw(req, res, next);
    }
    nextCalled = true;
    return null;
  };
  await middlewares[0](req, res, next);
  return { res, nextCalled };
};

test('admin-only routes allow admin and reject hr/candidate/no-token', async () => {
  const guard = [authenticate, authorizeRoles(ROLES.ADMIN)];

  // admin passes
  {
    const { res, nextCalled } = await runChain(guard, buildReq(adminToken));
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, undefined);
  }

  // hr rejected
  {
    const { res, nextCalled } = await runChain(guard, buildReq(hrToken));
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  }

  // candidate rejected
  {
    const { res, nextCalled } = await runChain(guard, buildReq(candidateToken));
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  }

  // unauthenticated
  {
    const { res, nextCalled } = await runChain(guard, buildReq());
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  }
});

test('hr+admin routes allow hr/admin and reject candidate/no-token', async () => {
  const guard = [authenticate, authorizeRoles(ROLES.HR, ROLES.ADMIN)];

  {
    const { res, nextCalled } = await runChain(guard, buildReq(hrToken));
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, undefined);
  }
  {
    const { res, nextCalled } = await runChain(guard, buildReq(adminToken));
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, undefined);
  }
  {
    const { res, nextCalled } = await runChain(guard, buildReq(candidateToken));
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  }
  {
    const { res, nextCalled } = await runChain(guard, buildReq());
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  }
});

test('candidate-only routes allow candidate and reject hr/admin/no-token', async () => {
  const guard = [authenticate, authorizeRoles(ROLES.CANDIDATE)];

  {
    const { res, nextCalled } = await runChain(guard, buildReq(candidateToken));
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, undefined);
  }
  {
    const { res, nextCalled } = await runChain(guard, buildReq(hrToken));
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  }
  {
    const { res, nextCalled } = await runChain(guard, buildReq(adminToken));
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  }
  {
    const { res, nextCalled } = await runChain(guard, buildReq());
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  }
});

