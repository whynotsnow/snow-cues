import { PASSWORD_GROUP_STORE_NAME } from "./constants";
import { openDatabase, requestToPromise, runTransaction, transactionDone } from "./database";
import { sanitizePasswordGroup } from "./sanitize";
import { listPasswordEntriesBySpace } from "./passwordEntries";
import type { PasswordGroup, PasswordGroupInput, PasswordGroupPatch } from "./types";

export async function createPasswordGroup(input: PasswordGroupInput): Promise<PasswordGroup> {
  const now = Date.now();
  const group = sanitizePasswordGroup({
    id: input.id ?? crypto.randomUUID(),
    spaceId: input.spaceId,
    name: input.name,
    description: input.description,
    outputPolicy: input.outputPolicy,
    createdAt: now,
    updatedAt: now
  });

  const db = await openDatabase();
  const tx = db.transaction(PASSWORD_GROUP_STORE_NAME, "readwrite");
  await requestToPromise(tx.objectStore(PASSWORD_GROUP_STORE_NAME).add(group));
  await transactionDone(tx);
  return group;
}

export async function listPasswordGroupsBySpace(spaceId: string): Promise<PasswordGroup[]> {
  const groups = await runTransaction(PASSWORD_GROUP_STORE_NAME, "readonly", (tx) =>
    requestToPromise<PasswordGroup[]>(tx.objectStore(PASSWORD_GROUP_STORE_NAME).getAll())
  );
  return groups
    .map(sanitizePasswordGroup)
    .filter((group) => group.spaceId === spaceId)
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN") || b.updatedAt - a.updatedAt);
}

export async function updatePasswordGroup(id: string, patch: PasswordGroupPatch): Promise<PasswordGroup> {
  const db = await openDatabase();
  const tx = db.transaction(PASSWORD_GROUP_STORE_NAME, "readwrite");
  const store = tx.objectStore(PASSWORD_GROUP_STORE_NAME);
  const existing = await requestToPromise<PasswordGroup | undefined>(store.get(id));

  if (!existing) {
    throw new Error("未找到密码组。");
  }

  const updated = sanitizePasswordGroup({
    ...existing,
    name: patch.name === undefined ? existing.name : patch.name,
    description: patch.description === undefined ? existing.description : patch.description,
    outputPolicy: patch.outputPolicy ?? existing.outputPolicy,
    updatedAt: Date.now()
  });

  await requestToPromise(store.put(updated));
  await transactionDone(tx);
  return updated;
}

export async function deletePasswordGroup(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(PASSWORD_GROUP_STORE_NAME, "readonly");
  const existing = await requestToPromise<PasswordGroup | undefined>(tx.objectStore(PASSWORD_GROUP_STORE_NAME).get(id));
  await transactionDone(tx);

  if (!existing) {
    return;
  }
  const entries = await listPasswordEntriesBySpace(existing.spaceId);
  if (entries.some((entry) => entry.groupId === id)) {
    throw new Error("密码组仍有关联条目，请先移动条目后再删除。");
  }

  const deleteTx = db.transaction(PASSWORD_GROUP_STORE_NAME, "readwrite");
  await requestToPromise(deleteTx.objectStore(PASSWORD_GROUP_STORE_NAME).delete(id));
  await transactionDone(deleteTx);
}
