import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncPayload } from '@/utils/sync';
import { pullFromServer, pushToServer } from './syncApi';

const emptyPayload: SyncPayload = {
  accounts: [],
  categories: [],
  transactions: [],
  disciplineState: null,
};

const dirtyAccount = {
  id: 'acc_1',
  name: 'Salary',
  type: 'spendable' as const,
  balance: 100,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  syncedAt: null,
  deletedAt: null,
};

describe('pushToServer / pullFromServer', () => {
  const originalUrl = process.env.EXPO_PUBLIC_SYNC_SERVER_URL;
  const originalKey = process.env.EXPO_PUBLIC_SYNC_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_SYNC_SERVER_URL = 'https://folio-server.example';
    process.env.EXPO_PUBLIC_SYNC_API_KEY = 'test-secret';
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_SYNC_SERVER_URL = originalUrl;
    process.env.EXPO_PUBLIC_SYNC_API_KEY = originalKey;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('pushToServer', () => {
    it('returns false without making a request when sync is not configured', async () => {
      delete process.env.EXPO_PUBLIC_SYNC_SERVER_URL;
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy as unknown as typeof fetch;

      const result = await pushToServer(emptyPayload);

      expect(result).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('PUTs the payload to /api/sync with a Bearer auth header', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
      global.fetch = fetchSpy as unknown as typeof fetch;

      await pushToServer(emptyPayload);

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://folio-server.example/api/sync',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-secret',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(emptyPayload),
        }),
      );
    });

    it('strips syncedAt from every record before sending — the server has no such field', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
      global.fetch = fetchSpy as unknown as typeof fetch;

      await pushToServer({
        accounts: [dirtyAccount],
        categories: [],
        transactions: [],
        disciplineState: null,
      });

      const [, options] = fetchSpy.mock.calls[0];
      const sentBody = JSON.parse(options.body);

      expect(sentBody.accounts[0]).not.toHaveProperty('syncedAt');
      expect(sentBody.accounts[0].id).toBe('acc_1');
    });

    it('returns true on a 2xx response', async () => {
      global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 })) as unknown as typeof fetch;

      expect(await pushToServer(emptyPayload)).toBe(true);
    });

    it('returns false on a non-2xx response', async () => {
      global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 401 })) as unknown as typeof fetch;

      expect(await pushToServer(emptyPayload)).toBe(false);
    });

    it('returns false (rather than throwing) when the network request fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;

      await expect(pushToServer(emptyPayload)).resolves.toBe(false);
    });
  });

  describe('pullFromServer', () => {
    it('returns null without making a request when sync is not configured', async () => {
      delete process.env.EXPO_PUBLIC_SYNC_API_KEY;
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy as unknown as typeof fetch;

      const result = await pullFromServer();

      expect(result).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('GETs /api/sync with a Bearer auth header and returns the parsed payload', async () => {
      const fetchSpy = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(emptyPayload), { status: 200 }));
      global.fetch = fetchSpy as unknown as typeof fetch;

      const result = await pullFromServer();

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://folio-server.example/api/sync',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer test-secret' }),
        }),
      );
      expect(result).toEqual(emptyPayload);
    });

    it('returns null on a non-2xx response', async () => {
      global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 401 })) as unknown as typeof fetch;

      expect(await pullFromServer()).toBeNull();
    });

    it('returns null (rather than throwing) when the network request fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;

      await expect(pullFromServer()).resolves.toBeNull();
    });
  });
});
