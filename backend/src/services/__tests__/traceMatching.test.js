import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureMatchResultPayload } from '../traceMatching.js';

test('trace payload is persisted when enabled and provided', () => {
  const trace = { backend: { requestId: 'abc' } };

  const payload = ensureMatchResultPayload({ trace, traceEnabled: true });

  assert.deepEqual(payload, { trace });
});

test('trace is omitted when disabled or missing', () => {
  const trace = { backend: { requestId: 'abc' } };

  const disabledPayload = ensureMatchResultPayload({ trace, traceEnabled: false });
  const missingTracePayload = ensureMatchResultPayload({ trace: undefined, traceEnabled: true });

  assert.deepEqual(disabledPayload, {});
  assert.deepEqual(missingTracePayload, {});
});
