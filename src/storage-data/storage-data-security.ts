import {
  sanitizeMigrationBatch,
  sanitizeMigrationEntry,
  sanitizePasswordEntry,
  sanitizePasswordGroup,
  sanitizeSpaceProfile,
  sanitizeSpaceRecord,
  sanitizeSpaceRelation
} from "../storage-engine/sanitize";
import type { StorageDataContent } from "./storage-data-types";

const FORBIDDEN_KEYS = new Set([
  "master_password",
  "masterPassword",
  "entrySecret",
  "runtime_salt",
  "runtimeSalt",
  "encrypted_entry_secret",
  "encryptedEntrySecret",
  "password",
  "plainPassword",
  "plaintextPassword",
  "memory_hint",
  "memoryHint",
  "verificationMaterial",
  "passwordVerifier",
  "ruleId",
  "scene",
  "context"
]);

export function sanitizeStorageDataContent(input: Partial<StorageDataContent>): StorageDataContent {
  const cleaned = stripForbiddenKeys(input) as Partial<StorageDataContent>;
  return {
    spaces: Array.isArray(cleaned.spaces) ? cleaned.spaces.map(sanitizeSpaceRecord) : [],
    spaceProfiles: Array.isArray(cleaned.spaceProfiles) ? cleaned.spaceProfiles.map(sanitizeSpaceProfile) : [],
    passwordEntries: Array.isArray(cleaned.passwordEntries) ? cleaned.passwordEntries.map(sanitizePasswordEntry) : [],
    passwordGroups: Array.isArray(cleaned.passwordGroups) ? cleaned.passwordGroups.map(sanitizePasswordGroup) : [],
    spaceRelations: Array.isArray(cleaned.spaceRelations) ? cleaned.spaceRelations.map(sanitizeSpaceRelation) : [],
    migrationBatches: Array.isArray(cleaned.migrationBatches) ? cleaned.migrationBatches.map(sanitizeMigrationBatch) : [],
    migrationEntries: Array.isArray(cleaned.migrationEntries) ? cleaned.migrationEntries.map(sanitizeMigrationEntry) : []
  };
}

export function stripForbiddenKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripForbiddenKeys);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      continue;
    }
    output[key] = stripForbiddenKeys(nested);
  }
  return output;
}

