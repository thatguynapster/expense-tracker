import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetItem = vi.fn();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: mockGetItem, setItem: vi.fn() },
}));

const { isFirstLaunch } = await import('./storage');

describe('isFirstLaunch', () => {
  beforeEach(() => {
    mockGetItem.mockReset();
  });

  it('returns true when nothing has ever been stored', async () => {
    mockGetItem.mockResolvedValue(null);

    expect(await isFirstLaunch()).toBe(true);
  });

  it('returns false once any data has been saved', async () => {
    mockGetItem.mockResolvedValue('{"accounts":[]}');

    expect(await isFirstLaunch()).toBe(false);
  });
});
