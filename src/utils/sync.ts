import type { Account, AppData, Category, DisciplineState, Transaction } from '@/lib/types';

/**
 * The sync push payload: only the records considered dirty locally
 * (`syncedAt: null`), not the full dataset. A record with `deletedAt` set
 * is a tombstone — the server deletes it instead of upserting it. This
 * type mirrors the server's `SyncBlob` shape (folio-server/lib/sync.ts).
 */
export type SyncPayload = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  disciplineState: DisciplineState | null;
};

export function collectDirtyRecords(data: AppData): SyncPayload {
  return {
    accounts: data.accounts.filter((a) => a.syncedAt === null),
    categories: data.categories.filter((c) => c.syncedAt === null),
    transactions: data.transactions.filter((t) => t.syncedAt === null),
    disciplineState: data.disciplineState.syncedAt === null ? data.disciplineState : null,
  };
}

/**
 * The shape actually sent over the wire — every field of `SyncPayload`
 * except `syncedAt`, which is purely local bookkeeping (the server's
 * Prisma schema has no such field, and Prisma's argument validation
 * rejects unknown fields outright).
 */
export type WirePayload = {
  accounts: Omit<Account, 'syncedAt'>[];
  categories: Omit<Category, 'syncedAt'>[];
  transactions: Omit<Transaction, 'syncedAt'>[];
  disciplineState: Omit<DisciplineState, 'syncedAt'> | null;
};

function stripSyncedAt<T extends { syncedAt: string | null }>(record: T): Omit<T, 'syncedAt'> {
  const { syncedAt: _syncedAt, ...rest } = record;
  return rest;
}

export function toWirePayload(payload: SyncPayload): WirePayload {
  return {
    accounts: payload.accounts.map(stripSyncedAt),
    categories: payload.categories.map(stripSyncedAt),
    transactions: payload.transactions.map(stripSyncedAt),
    disciplineState: payload.disciplineState ? stripSyncedAt(payload.disciplineState) : null,
  };
}

export function hasDirtyRecords(payload: SyncPayload): boolean {
  return (
    payload.accounts.length > 0 ||
    payload.categories.length > 0 ||
    payload.transactions.length > 0 ||
    payload.disciplineState !== null
  );
}

function reconcileCollection<T extends { id: string; syncedAt: string | null; deletedAt: string | null }>(
  records: T[],
  pushedIds: Set<string>,
  pushedDeletedIds: Set<string>,
  syncedAt: string,
): T[] {
  return records
    .filter((record) => !pushedDeletedIds.has(record.id))
    .map((record) => (pushedIds.has(record.id) ? { ...record, syncedAt } : record));
}

/**
 * Applies the result of a successful push: pushed non-deleted records are
 * marked synced; pushed deleted (tombstoned) records are purged entirely
 * from local storage, since the server has already deleted its copy.
 * Records that weren't part of this push are left untouched.
 */
export function applyPushResult(data: AppData, pushed: SyncPayload, syncedAt: string): AppData {
  const idsOf = (records: { id: string }[]) => new Set(records.map((r) => r.id));
  const deletedIdsOf = (records: { id: string; deletedAt: string | null }[]) =>
    new Set(records.filter((r) => r.deletedAt !== null).map((r) => r.id));

  const disciplineStatePushed =
    pushed.disciplineState !== null && pushed.disciplineState.id === data.disciplineState.id;
  const disciplineState = disciplineStatePushed
    ? { ...data.disciplineState, syncedAt }
    : data.disciplineState;

  return {
    accounts: reconcileCollection(
      data.accounts,
      idsOf(pushed.accounts),
      deletedIdsOf(pushed.accounts),
      syncedAt,
    ),
    categories: reconcileCollection(
      data.categories,
      idsOf(pushed.categories),
      deletedIdsOf(pushed.categories),
      syncedAt,
    ),
    transactions: reconcileCollection(
      data.transactions,
      idsOf(pushed.transactions),
      deletedIdsOf(pushed.transactions),
      syncedAt,
    ),
    disciplineState,
  };
}

/**
 * Applies the result of a full pull (fresh install / new device restore):
 * every pulled record replaces local state and is marked synced at the
 * given timestamp. If the server has no disciplineState yet (nothing has
 * ever been pushed), falls back to the given default rather than leaving
 * AppData in an invalid (disciplineState-less) shape.
 */
export function applyPullResult(
  pulled: SyncPayload,
  syncedAt: string,
  fallbackDisciplineState: DisciplineState,
): AppData {
  const markSynced = <T extends { syncedAt: string | null }>(records: T[]): T[] =>
    records.map((record) => ({ ...record, syncedAt }));

  return {
    accounts: markSynced(pulled.accounts),
    categories: markSynced(pulled.categories),
    transactions: markSynced(pulled.transactions),
    disciplineState: { ...(pulled.disciplineState ?? fallbackDisciplineState), syncedAt },
  };
}
