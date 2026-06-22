import { SPACE_STORE_NAME } from "./constants";
import { openDatabase, requestToPromise, runTransaction, transactionDone } from "./database";
import { normalizeStoredSpaceId, sanitizeSpaceRecord } from "./sanitize";
import type { SpaceRecord, SpaceRecordInput, SpaceRecordPatch } from "./types";

export async function getSpace(spaceId: string): Promise<SpaceRecord | null> {
  const space = await runTransaction(SPACE_STORE_NAME, "readonly", (tx) =>
    requestToPromise<SpaceRecord | undefined>(
      tx.objectStore(SPACE_STORE_NAME).get(normalizeStoredSpaceId(spaceId))
    )
  );
  return space ? sanitizeSpaceRecord(space) : null;
}

export async function saveSpace(input: SpaceRecordInput): Promise<SpaceRecord> {
  const db = await openDatabase();
  const now = Date.now();
  const spaceId = normalizeStoredSpaceId(input.spaceId);
  const existing = await getSpace(spaceId);
  const space = sanitizeSpaceRecord({
    spaceId,
    displayName: input.displayName,
    description: input.description,
    status: input.status ?? existing?.status ?? "active",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    deprecatedAt: existing?.deprecatedAt,
    archivedAt: existing?.archivedAt
  });

  const tx = db.transaction(SPACE_STORE_NAME, "readwrite");
  await requestToPromise(tx.objectStore(SPACE_STORE_NAME).put(space));
  await transactionDone(tx);
  return space;
}

export async function listSpaces(): Promise<SpaceRecord[]> {
  const spaces = await runTransaction(SPACE_STORE_NAME, "readonly", (tx) =>
    requestToPromise<SpaceRecord[]>(tx.objectStore(SPACE_STORE_NAME).getAll())
  );
  return spaces.map(sanitizeSpaceRecord).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function updateSpace(spaceId: string, patch: SpaceRecordPatch): Promise<SpaceRecord> {
  const db = await openDatabase();
  const tx = db.transaction(SPACE_STORE_NAME, "readwrite");
  const store = tx.objectStore(SPACE_STORE_NAME);
  const normalizedSpaceId = normalizeStoredSpaceId(spaceId);
  const existing = await requestToPromise<SpaceRecord | undefined>(store.get(normalizedSpaceId));

  if (!existing) {
    throw new Error("未找到存储空间。");
  }

  const nextStatus = patch.status ?? existing.status;
  const now = Date.now();
  const updated = sanitizeSpaceRecord({
    ...existing,
    displayName: patch.displayName === undefined ? existing.displayName : patch.displayName,
    description: patch.description === undefined ? existing.description : patch.description,
    status: nextStatus,
    deprecatedAt:
      patch.deprecatedAt === undefined
        ? nextStatus === "deprecated" && existing.deprecatedAt === undefined
          ? now
          : existing.deprecatedAt
        : patch.deprecatedAt,
    archivedAt:
      patch.archivedAt === undefined
        ? nextStatus === "archived" && existing.archivedAt === undefined
          ? now
          : existing.archivedAt
        : patch.archivedAt,
    updatedAt: now
  });

  await requestToPromise(store.put(updated));
  await transactionDone(tx);
  return updated;
}
