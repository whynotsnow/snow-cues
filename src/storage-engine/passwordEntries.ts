import { DEFAULT_SPACE_ID, STORE_NAME } from "./constants";
import {
  openDatabase,
  requestToPromise,
  runTransaction,
  transactionDone
} from "./database";
import { sanitizePasswordEntry } from "./sanitize";
import type {
  PasswordEntry,
  PasswordEntryInput,
  PasswordEntryPatch
} from "./types";

export async function createPasswordEntry(
  input: PasswordEntryInput
): Promise<PasswordEntry> {
  const now = Date.now();
  const entry = sanitizePasswordEntry({
    id: input.id ?? crypto.randomUUID(),
    spaceId: input.spaceId,
    encrypted_password: input.encrypted_password,
    encrypted_memory_hint: input.encrypted_memory_hint,
    groupId: input.groupId?.trim() || undefined,
    platform: input.platform?.trim() || undefined,
    description: input.description?.trim() || undefined,
    deprecatedAt: undefined,
    createdAt: now,
    updatedAt: now
  });

  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, "readwrite");
  await requestToPromise(tx.objectStore(STORE_NAME).add(entry));
  await transactionDone(tx);
  return entry;
}

export async function listPasswordEntries(): Promise<PasswordEntry[]> {
  return listPasswordEntriesBySpace(DEFAULT_SPACE_ID);
}

export async function listPasswordEntriesBySpace(
  spaceId: string
): Promise<PasswordEntry[]> {
  const entries = await runTransaction(STORE_NAME, "readonly", (tx) =>
    requestToPromise<PasswordEntry[]>(tx.objectStore(STORE_NAME).getAll())
  );
  return entries
    .map(sanitizePasswordEntry)
    .filter((entry) => entry.spaceId === spaceId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function updatePasswordEntry(
  id: string,
  patch: PasswordEntryPatch
): Promise<PasswordEntry> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const existing = await requestToPromise<PasswordEntry | undefined>(
    store.get(id)
  );

  if (!existing) {
    throw new Error("未找到密码条目。");
  }

  const updated = sanitizePasswordEntry({
    ...existing,
    platform:
      existing.deprecatedAt || patch.platform === undefined
        ? existing.platform
        : patch.platform.trim() || undefined,
    description:
      patch.description === undefined
        ? existing.description
        : patch.description.trim() || undefined,
    encrypted_memory_hint:
      "encrypted_memory_hint" in patch
        ? patch.encrypted_memory_hint
        : existing.encrypted_memory_hint,
    groupId:
      patch.groupId === undefined
        ? existing.groupId
        : patch.groupId.trim() || undefined,
    deprecatedAt: patch.deprecatedAt ?? existing.deprecatedAt,
    updatedAt: Date.now()
  });

  await requestToPromise(store.put(updated));
  await transactionDone(tx);
  return updated;
}

export async function deletePasswordEntry(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, "readwrite");
  await requestToPromise(tx.objectStore(STORE_NAME).delete(id));
  await transactionDone(tx);
}
