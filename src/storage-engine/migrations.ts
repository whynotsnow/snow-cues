import { MIGRATION_BATCH_STORE_NAME, MIGRATION_ENTRY_STORE_NAME } from "./constants";
import { openDatabase, requestToPromise, runTransaction, transactionDone } from "./database";
import { normalizeStoredSpaceId, sanitizeMigrationBatch, sanitizeMigrationEntry } from "./sanitize";
import type {
  MigrationBatch,
  MigrationBatchInput,
  MigrationBatchPatch,
  MigrationEntry,
  MigrationEntryInput,
  MigrationEntryPatch
} from "./types";

export async function createMigrationBatch(input: MigrationBatchInput): Promise<MigrationBatch> {
  const db = await openDatabase();
  const now = Date.now();
  const batch = sanitizeMigrationBatch({
    id: input.id ?? crypto.randomUUID(),
    sourceSpaceId: input.sourceSpaceId,
    targetSpaceId: input.targetSpaceId,
    sourceType: input.sourceType,
    status: input.status ?? "draft",
    sourceProfileSnapshot: input.sourceProfileSnapshot,
    autoFinalizeSource: input.autoFinalizeSource ?? true,
    migratedCount: 0,
    totalCount: input.totalCount,
    createdAt: now,
    updatedAt: now
  });
  const tx = db.transaction(MIGRATION_BATCH_STORE_NAME, "readwrite");
  await requestToPromise(tx.objectStore(MIGRATION_BATCH_STORE_NAME).add(batch));
  await transactionDone(tx);
  return batch;
}

export async function getMigrationBatch(batchId: string): Promise<MigrationBatch | null> {
  const batch = await runTransaction(MIGRATION_BATCH_STORE_NAME, "readonly", (tx) =>
    requestToPromise<MigrationBatch | undefined>(tx.objectStore(MIGRATION_BATCH_STORE_NAME).get(batchId))
  );
  return batch ? sanitizeMigrationBatch(batch) : null;
}

export async function listMigrationBatchesForTarget(targetSpaceId: string): Promise<MigrationBatch[]> {
  const normalizedTargetSpaceId = normalizeStoredSpaceId(targetSpaceId);
  const batches = await runTransaction(MIGRATION_BATCH_STORE_NAME, "readonly", (tx) =>
    requestToPromise<MigrationBatch[]>(tx.objectStore(MIGRATION_BATCH_STORE_NAME).getAll())
  );
  return batches
    .map(sanitizeMigrationBatch)
    .filter((batch) => batch.targetSpaceId === normalizedTargetSpaceId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function updateMigrationBatch(batchId: string, patch: MigrationBatchPatch): Promise<MigrationBatch> {
  const db = await openDatabase();
  const tx = db.transaction(MIGRATION_BATCH_STORE_NAME, "readwrite");
  const store = tx.objectStore(MIGRATION_BATCH_STORE_NAME);
  const existing = await requestToPromise<MigrationBatch | undefined>(store.get(batchId));
  if (!existing) {
    throw new Error("未找到迁移批次。");
  }
  const updated = sanitizeMigrationBatch({
    ...existing,
    ...patch,
    updatedAt: Date.now()
  });
  await requestToPromise(store.put(updated));
  await transactionDone(tx);
  return updated;
}

export async function createMigrationEntry(input: MigrationEntryInput): Promise<MigrationEntry> {
  const db = await openDatabase();
  const now = Date.now();
  const entry = sanitizeMigrationEntry({
    id: input.id ?? crypto.randomUUID(),
    batchId: input.batchId,
    sourceSpaceId: input.sourceSpaceId,
    targetSpaceId: input.targetSpaceId,
    sourceEntryId: input.sourceEntryId,
    sourceEncryptedPassword: input.sourceEncryptedPassword,
    sourceEncryptedMemoryHint: input.sourceEncryptedMemoryHint,
    groupId: input.groupId,
    platform: input.platform,
    description: input.description,
    sourceDeprecatedAt: input.sourceDeprecatedAt,
    status: "pending",
    createdAt: now,
    updatedAt: now
  });
  const tx = db.transaction(MIGRATION_ENTRY_STORE_NAME, "readwrite");
  await requestToPromise(tx.objectStore(MIGRATION_ENTRY_STORE_NAME).add(entry));
  await transactionDone(tx);
  return entry;
}

export async function listMigrationEntriesByBatch(batchId: string): Promise<MigrationEntry[]> {
  const entries = await runTransaction(MIGRATION_ENTRY_STORE_NAME, "readonly", (tx) =>
    requestToPromise<MigrationEntry[]>(tx.objectStore(MIGRATION_ENTRY_STORE_NAME).getAll())
  );
  return entries
    .map(sanitizeMigrationEntry)
    .filter((entry) => entry.batchId === batchId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function updateMigrationEntry(entryId: string, patch: MigrationEntryPatch): Promise<MigrationEntry> {
  const db = await openDatabase();
  const tx = db.transaction(MIGRATION_ENTRY_STORE_NAME, "readwrite");
  const store = tx.objectStore(MIGRATION_ENTRY_STORE_NAME);
  const existing = await requestToPromise<MigrationEntry | undefined>(store.get(entryId));
  if (!existing) {
    throw new Error("未找到迁移条目。");
  }
  const updated = sanitizeMigrationEntry({
    ...existing,
    ...patch,
    updatedAt: Date.now()
  });
  await requestToPromise(store.put(updated));
  await transactionDone(tx);
  return updated;
}

export async function refreshMigrationBatchStats(batchId: string): Promise<MigrationBatch> {
  const [batch, entries] = await Promise.all([getMigrationBatch(batchId), listMigrationEntriesByBatch(batchId)]);
  if (!batch) {
    throw new Error("未找到迁移批次。");
  }
  const migratedCount = entries.filter((entry) => entry.status === "migrated" || entry.status === "skipped").length;
  const completed = entries.length > 0 && migratedCount === entries.length;
  return updateMigrationBatch(batchId, {
    migratedCount,
    totalCount: entries.length,
    status: completed ? "completed" : migratedCount > 0 ? "in_progress" : batch.status === "draft" ? "draft" : "ready",
    completedAt: completed ? Date.now() : undefined
  });
}
