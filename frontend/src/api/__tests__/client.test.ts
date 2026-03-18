import { describe, expect, it, vi } from 'vitest';

import { ApiError, apiRequest } from '../client';

describe('apiRequest', () => {
  it('throws ApiError with server message on failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ message: 'Token invalid' })
    } as any);

    await expect(apiRequest('/test')).rejects.toEqual(
      new ApiError('Token invalid', 401, undefined, { message: 'Token invalid' })
    );
  });
});


