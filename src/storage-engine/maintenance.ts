import {
  DEFAULT_SPACE_ID,
  MIGRATION_BATCH_STORE_NAME,
  MIGRATION_ENTRY_STORE_NAME,
  PASSWORD_GROUP_STORE_NAME,
  PROFILE_STORE_NAME,
  RELATION_STORE_NAME,
  SPACE_STORE_NAME,
  STORE_NAME
} from "./constants";
import { openDatabase, requestToPromise, transactionDone } from "./database";
import {
  normalizeStoredSpaceId,
  sanitizeMigrationBatch,
  sanitizeMigrationEntry,
  sanitizePasswordGroup,
  sanitizePasswordEntry,
  sanitizeSpaceRelation
} from "./sanitize";
import type {
  MigrationBatch,
  MigrationEntry,
  PasswordEntry,
  PasswordGroup,
  SpaceRelation
} from "./types";

export async function clearPasswordEntries(): Promise<void> {
  return clearPasswordEntriesBySpace(DEFAULT_SPACE_ID);
}

export async function clearPasswordEntriesBySpace(
  spaceId: string
): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const entries = await requestToPromise<PasswordEntry[]>(store.getAll());
  await Promise.all(
    entries
      .map(sanitizePasswordEntry)
      .filter((entry) => entry.spaceId === spaceId)
      .map((entry) => requestToPromise(store.delete(entry.id)))
  );
  await transactionDone(tx);
}

export async function clearSystemProfile(): Promise<void> {
  return clearSpaceProfile(DEFAULT_SPACE_ID);
}

export async function clearSpaceProfile(spaceId: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(PROFILE_STORE_NAME, "readwrite");
  await requestToPromise(tx.objectStore(PROFILE_STORE_NAME).delete(spaceId));
  await transactionDone(tx);
}

export async function deleteSpaceData(spaceId: string): Promise<void> {
  const normalizedSpaceId = normalizeStoredSpaceId(spaceId);
  const db = await openDatabase();
  const tx = db.transaction(
    [
      STORE_NAME,
      PROFILE_STORE_NAME,
      SPACE_STORE_NAME,
      RELATION_STORE_NAME,
      MIGRATION_BATCH_STORE_NAME,
      MIGRATION_ENTRY_STORE_NAME,
      PASSWORD_GROUP_STORE_NAME
    ],
    "readwrite"
  );
  const entryStore = tx.objectStore(STORE_NAME);
  const profileStore = tx.objectStore(PROFILE_STORE_NAME);
  const spaceStore = tx.objectStore(SPACE_STORE_NAME);
  const relationStore = tx.objectStore(RELATION_STORE_NAME);
  const batchStore = tx.objectStore(MIGRATION_BATCH_STORE_NAME);
  const migrationEntryStore = tx.objectStore(MIGRATION_ENTRY_STORE_NAME);
  const groupStore = tx.objectStore(PASSWORD_GROUP_STORE_NAME);
  const [entries, relations, batches, migrationEntries, groups] =
    await Promise.all([
      requestToPromise<PasswordEntry[]>(entryStore.getAll()),
      requestToPromise<SpaceRelation[]>(relationStore.getAll()),
      requestToPromise<MigrationBatch[]>(batchStore.getAll()),
      requestToPromise<MigrationEntry[]>(migrationEntryStore.getAll()),
      requestToPromise<PasswordGroup[]>(groupStore.getAll())
    ]);
  const deletedBatchIds = new Set(
    batches
      .map(sanitizeMigrationBatch)
      .filter(
        (batch) =>
          batch.sourceSpaceId === normalizedSpaceId ||
          batch.targetSpaceId === normalizedSpaceId
      )
      .map((batch) => batch.id)
  );
  await Promise.all([
    requestToPromise(profileStore.delete(normalizedSpaceId)),
    requestToPromise(spaceStore.delete(normalizedSpaceId)),
    ...entries
      .map(sanitizePasswordEntry)
      .filter((entry) => entry.spaceId === normalizedSpaceId)
      .map((entry) => requestToPromise(entryStore.delete(entry.id))),
    ...groups
      .map(sanitizePasswordGroup)
      .filter((group) => group.spaceId === normalizedSpaceId)
      .map((group) => requestToPromise(groupStore.delete(group.id))),
    ...relations
      .map(sanitizeSpaceRelation)
      .filter(
        (relation) =>
          relation.fromSpaceId === normalizedSpaceId ||
          relation.toSpaceId === normalizedSpaceId
      )
      .map((relation) => requestToPromise(relationStore.delete(relation.id))),
    ...Array.from(deletedBatchIds).map((batchId) =>
      requestToPromise(batchStore.delete(batchId))
    ),
    ...migrationEntries
      .map(sanitizeMigrationEntry)
      .filter(
        (entry) =>
          deletedBatchIds.has(entry.batchId) ||
          entry.sourceSpaceId === normalizedSpaceId ||
          entry.targetSpaceId === normalizedSpaceId
      )
      .map((entry) => requestToPromise(migrationEntryStore.delete(entry.id)))
  ]);
  await transactionDone(tx);
}

export async function resetLocalData(): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(
    [
      STORE_NAME,
      PROFILE_STORE_NAME,
      SPACE_STORE_NAME,
      RELATION_STORE_NAME,
      MIGRATION_BATCH_STORE_NAME,
      MIGRATION_ENTRY_STORE_NAME,
      PASSWORD_GROUP_STORE_NAME
    ],
    "readwrite"
  );
  await requestToPromise(tx.objectStore(STORE_NAME).clear());
  await requestToPromise(tx.objectStore(PROFILE_STORE_NAME).clear());
  await requestToPromise(tx.objectStore(SPACE_STORE_NAME).clear());
  await requestToPromise(tx.objectStore(RELATION_STORE_NAME).clear());
  await requestToPromise(tx.objectStore(MIGRATION_BATCH_STORE_NAME).clear());
  await requestToPromise(tx.objectStore(MIGRATION_ENTRY_STORE_NAME).clear());
  await requestToPromise(tx.objectStore(PASSWORD_GROUP_STORE_NAME).clear());
  await transactionDone(tx);
}
