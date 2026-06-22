import {
  DB_NAME,
  DB_VERSION,
  DEFAULT_SPACE_ID,
  LEGACY_PROFILE_STORE_NAME,
  MIGRATION_BATCH_STORE_NAME,
  MIGRATION_ENTRY_STORE_NAME,
  PASSWORD_GROUP_STORE_NAME,
  PROFILE_STORE_NAME,
  RELATION_STORE_NAME,
  SPACE_STORE_NAME,
  STORE_NAME
} from "./constants";
import {
  normalizeStoredSpaceId,
  sanitizePasswordEntry,
  sanitizeSpaceProfile,
  sanitizeSpaceRecord
} from "./sanitize";
import type { PasswordEntry, SpaceProfile, SpaceRecord } from "./types";

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise.then((db) => {
      if (isUsableDatabase(db)) {
        return db;
      }
      try {
        db.close();
      } catch {
        // 连接已经在关闭流程中时，直接丢弃缓存并重新打开。
      }
      dbPromise = null;
      return openDatabase();
    });
  }

  dbPromise = openDatabaseAtVersion(DB_VERSION);

  return dbPromise;
}

function openDatabaseAtVersion(version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, version);

    request.onupgradeneeded = () => {
      const db = request.result;
      ensureRequiredStores(db, request.transaction);

      void migrateLegacyData(request);
    };

    request.onblocked = () => {
      dbPromise = null;
      reject(new Error("数据库升级被其他页面阻止，请关闭同一应用的其他标签页后重试。"));
    };
    request.onsuccess = () => {
      const db = request.result;
      if (!hasRequiredStores(db)) {
        const repairVersion = db.version + 1;
        resetCachedDatabase(db);
        dbPromise = openDatabaseAtVersion(repairVersion);
        resolve(dbPromise);
        return;
      }
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
}

export async function runTransaction<T>(
  storeNames: string | string[],
  mode: IDBTransactionMode,
  operation: (tx: IDBTransaction) => Promise<T>
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const db = await openDatabase();
    try {
      const tx = db.transaction(storeNames, mode);
      const done = transactionDone(tx);
      const result = await operation(tx);
      await done;
      return result;
    } catch (error) {
      lastError = error;
      if (!isRecoverableDatabaseError(error) || attempt > 0) {
        throw error;
      }
      resetCachedDatabase(db);
    }
  }
  throw lastError;
}

export async function closeDatabaseConnection(): Promise<void> {
  if (!dbPromise) {
    return;
  }
  const db = await dbPromise.catch(() => null);
  if (db) {
    resetCachedDatabase(db);
  } else {
    dbPromise = null;
  }
}

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function hasRequiredStores(db: IDBDatabase): boolean {
  return (
    db.objectStoreNames.contains(STORE_NAME) &&
    db.objectStoreNames.contains(PROFILE_STORE_NAME) &&
    db.objectStoreNames.contains(SPACE_STORE_NAME) &&
    db.objectStoreNames.contains(RELATION_STORE_NAME) &&
    db.objectStoreNames.contains(MIGRATION_BATCH_STORE_NAME) &&
    db.objectStoreNames.contains(MIGRATION_ENTRY_STORE_NAME) &&
    db.objectStoreNames.contains(PASSWORD_GROUP_STORE_NAME)
  );
}

function ensureRequiredStores(db: IDBDatabase, tx: IDBTransaction | null): void {
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
    store.createIndex("updatedAt", "updatedAt");
    store.createIndex("spaceId", "spaceId");
  } else {
    const store = tx?.objectStore(STORE_NAME);
    if (store && !store.indexNames.contains("spaceId")) {
      store.createIndex("spaceId", "spaceId");
    }
  }
  if (!db.objectStoreNames.contains(PROFILE_STORE_NAME)) {
    db.createObjectStore(PROFILE_STORE_NAME, { keyPath: "spaceId" });
  }
  if (!db.objectStoreNames.contains(SPACE_STORE_NAME)) {
    db.createObjectStore(SPACE_STORE_NAME, { keyPath: "spaceId" });
  }
  if (!db.objectStoreNames.contains(RELATION_STORE_NAME)) {
    const relationStore = db.createObjectStore(RELATION_STORE_NAME, { keyPath: "id" });
    relationStore.createIndex("fromSpaceId", "fromSpaceId");
    relationStore.createIndex("toSpaceId", "toSpaceId");
    relationStore.createIndex("type", "type");
  }
  if (!db.objectStoreNames.contains(MIGRATION_BATCH_STORE_NAME)) {
    const batchStore = db.createObjectStore(MIGRATION_BATCH_STORE_NAME, { keyPath: "id" });
    batchStore.createIndex("sourceSpaceId", "sourceSpaceId");
    batchStore.createIndex("targetSpaceId", "targetSpaceId");
    batchStore.createIndex("status", "status");
  }
  if (!db.objectStoreNames.contains(MIGRATION_ENTRY_STORE_NAME)) {
    const entryStore = db.createObjectStore(MIGRATION_ENTRY_STORE_NAME, { keyPath: "id" });
    entryStore.createIndex("batchId", "batchId");
    entryStore.createIndex("targetSpaceId", "targetSpaceId");
    entryStore.createIndex("status", "status");
  }
  if (!db.objectStoreNames.contains(PASSWORD_GROUP_STORE_NAME)) {
    const groupStore = db.createObjectStore(PASSWORD_GROUP_STORE_NAME, { keyPath: "id" });
    groupStore.createIndex("spaceId", "spaceId");
  }
}

function isUsableDatabase(db: IDBDatabase): boolean {
  if (!hasRequiredStores(db)) {
    return false;
  }
  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    tx.abort();
    return true;
  } catch {
    return false;
  }
}

function resetCachedDatabase(db: IDBDatabase): void {
  try {
    db.close();
  } catch {
    // Chrome can throw while the connection is already closing; clearing the cache is enough.
  }
  dbPromise = null;
}

function isRecoverableDatabaseError(error: unknown): boolean {
  if (!(error instanceof DOMException)) {
    return false;
  }
  return error.name === "InvalidStateError" || error.name === "NotFoundError";
}

async function migrateLegacyData(request: IDBOpenDBRequest): Promise<void> {
  const tx = request.transaction;
  if (!tx) {
    return;
  }

  const passwordStore = tx.objectStore(STORE_NAME);
  const entries = await requestToPromise<PasswordEntry[]>(passwordStore.getAll());
  const migratedEntries = await Promise.all(
    entries.map(async (entry) => {
      if (entry.spaceId) {
        return sanitizePasswordEntry(entry);
      }
      const migratedEntry = sanitizePasswordEntry({ ...entry, spaceId: DEFAULT_SPACE_ID });
      await requestToPromise(passwordStore.put(migratedEntry));
      return migratedEntry;
    })
  );

  if (request.result.objectStoreNames.contains(LEGACY_PROFILE_STORE_NAME)) {
    const legacyProfileStore = tx.objectStore(LEGACY_PROFILE_STORE_NAME);
    const legacyProfile = await requestToPromise<SpaceProfile | undefined>(legacyProfileStore.get(DEFAULT_SPACE_ID));
    if (legacyProfile) {
      const profileStore = tx.objectStore(PROFILE_STORE_NAME);
      await requestToPromise(
        profileStore.put(
          sanitizeSpaceProfile({
            ...legacyProfile,
            spaceId: DEFAULT_SPACE_ID
          })
        )
      );
    }
  }

  await migrateSpaceRecords(tx, migratedEntries);
}

async function migrateSpaceRecords(tx: IDBTransaction, entries: PasswordEntry[]): Promise<void> {
  const profileStore = tx.objectStore(PROFILE_STORE_NAME);
  const spaceStore = tx.objectStore(SPACE_STORE_NAME);
  const [profiles, existingSpaces] = await Promise.all([
    requestToPromise<SpaceProfile[]>(profileStore.getAll()),
    requestToPromise<SpaceRecord[]>(spaceStore.getAll())
  ]);
  const existingSpaceIds = new Set(existingSpaces.map((space) => sanitizeSpaceRecord(space).spaceId));
  const candidates = new Map<string, { createdAt: number; updatedAt: number }>();
  const collect = (spaceId: string | undefined, createdAt: number | undefined, updatedAt: number | undefined) => {
    const normalizedSpaceId = normalizeStoredSpaceId(spaceId ?? DEFAULT_SPACE_ID);
    const now = Date.now();
    const current = candidates.get(normalizedSpaceId);
    candidates.set(normalizedSpaceId, {
      createdAt: Math.min(current?.createdAt ?? createdAt ?? now, createdAt ?? now),
      updatedAt: Math.max(current?.updatedAt ?? updatedAt ?? now, updatedAt ?? now)
    });
  };

  profiles.map(sanitizeSpaceProfile).forEach((profile) => collect(profile.spaceId, profile.createdAt, profile.updatedAt));
  entries.map(sanitizePasswordEntry).forEach((entry) => collect(entry.spaceId, entry.createdAt, entry.updatedAt));

  await Promise.all(
    [...candidates.entries()]
      .filter(([spaceId]) => !existingSpaceIds.has(spaceId))
      .map(([spaceId, timestamps]) =>
        requestToPromise(
          spaceStore.put(
            sanitizeSpaceRecord({
              spaceId,
              status: "active",
              createdAt: timestamps.createdAt,
              updatedAt: timestamps.updatedAt
            })
          )
        )
      )
  );
}
