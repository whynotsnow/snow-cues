import type { StorageDataContent, StorageDataSaveSummary } from "./storage-data-types";

export function createEmptyStorageDataSaveSummary(): StorageDataSaveSummary {
  return {
    addedSpaces: 0,
    modifiedSpaceStatus: 0,
    addedPasswordEntries: 0,
    modifiedPasswordEntries: 0,
    deprecatedPasswordEntries: 0,
    modifiedMemoryHints: 0,
    addedPasswordGroups: 0,
    modifiedPasswordGroups: 0,
    deletedPasswordGroups: 0,
    changedRuleProfiles: 0,
    changedMigrationBatches: 0,
    changedMigrationEntries: 0
  };
}

export function diffStorageDataContent(base: StorageDataContent, draft: StorageDataContent): StorageDataSaveSummary {
  const summary = createEmptyStorageDataSaveSummary();
  const baseSpaces = new Map(base.spaces.map((space) => [space.spaceId, space]));
  for (const space of draft.spaces) {
    const existing = baseSpaces.get(space.spaceId);
    if (!existing) {
      summary.addedSpaces += 1;
    } else if (existing.status !== space.status) {
      summary.modifiedSpaceStatus += 1;
    }
  }

  const baseEntries = new Map(base.passwordEntries.map((entry) => [entry.id, entry]));
  for (const entry of draft.passwordEntries) {
    const existing = baseEntries.get(entry.id);
    if (!existing) {
      summary.addedPasswordEntries += 1;
      continue;
    }
    if (existing.deprecatedAt !== entry.deprecatedAt && entry.deprecatedAt) {
      summary.deprecatedPasswordEntries += 1;
    }
    if (existing.encrypted_memory_hint !== entry.encrypted_memory_hint) {
      summary.modifiedMemoryHints += 1;
    }
    if (safeComparable(existing) !== safeComparable(entry)) {
      summary.modifiedPasswordEntries += 1;
    }
  }

  const baseGroups = new Map(base.passwordGroups.map((group) => [group.id, group]));
  const draftGroupIds = new Set(draft.passwordGroups.map((group) => group.id));
  for (const group of draft.passwordGroups) {
    const existing = baseGroups.get(group.id);
    if (!existing) {
      summary.addedPasswordGroups += 1;
    } else if (safeComparable(existing) !== safeComparable(group)) {
      summary.modifiedPasswordGroups += 1;
    }
  }
  for (const group of base.passwordGroups) {
    if (!draftGroupIds.has(group.id)) {
      summary.deletedPasswordGroups += 1;
    }
  }

  summary.changedRuleProfiles = countChangedById(base.spaceProfiles, draft.spaceProfiles, "spaceId");
  summary.changedMigrationBatches = countChangedById(base.migrationBatches, draft.migrationBatches, "id", "status");
  summary.changedMigrationEntries = countChangedById(base.migrationEntries, draft.migrationEntries, "id", "status");
  return summary;
}

export function hasStorageDataChanges(summary: StorageDataSaveSummary): boolean {
  return Object.values(summary).some((value) => value > 0);
}

function countChangedById<T extends Record<string, unknown>>(
  base: T[],
  draft: T[],
  idKey: keyof T,
  field?: keyof T
): number {
  const baseMap = new Map(base.map((item) => [item[idKey], item]));
  let count = 0;
  for (const item of draft) {
    const existing = baseMap.get(item[idKey]);
    if (!existing) {
      count += 1;
    } else if (field ? existing[field] !== item[field] : safeComparable(existing) !== safeComparable(item)) {
      count += 1;
    }
  }
  return count;
}

function safeComparable(value: unknown): string {
  return JSON.stringify(value, (key, nested) => {
    if (key === "encrypted_password" || key === "encrypted_memory_hint" || key === "sourceEncryptedPassword" || key === "sourceEncryptedMemoryHint") {
      return nested ? "[redacted]" : nested;
    }
    return nested;
  });
}

