import { toWirePayload, type SyncPayload } from '@/utils/sync';

type ServerConfig = {
  baseUrl: string;
  apiKey: string;
};

function getServerConfig(): ServerConfig | null {
  const baseUrl = process.env.EXPO_PUBLIC_SYNC_SERVER_URL;
  const apiKey = process.env.EXPO_PUBLIC_SYNC_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

/**
 * Pushes only the dirty records in `payload` to the server. Returns false
 * (rather than throwing) both when sync isn't configured and when the
 * request fails for any reason — callers leave the records dirty and let
 * the next sync attempt retry, so a network blip here should never crash
 * the app or block the mutation that triggered it.
 */
export async function pushToServer(payload: SyncPayload): Promise<boolean> {
  const config = getServerConfig();
  if (!config) return false;

  try {
    const response = await fetch(`${config.baseUrl}/api/sync`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(toWirePayload(payload)),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Pulls the full current server state — used for fresh-install/new-device
 * restore, not for ordinary sync. Returns null on any failure (not
 * configured, network error, non-2xx response).
 */
export async function pullFromServer(): Promise<SyncPayload | null> {
  const config = getServerConfig();
  if (!config) return null;

  try {
    const response = await fetch(`${config.baseUrl}/api/sync`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!response.ok) return null;
    return (await response.json()) as SyncPayload;
  } catch {
    return null;
  }
}
