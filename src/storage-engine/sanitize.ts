import { DEFAULT_SPACE_ID } from "./constants";
import {
  DEFAULT_PASSWORD_OUTPUT_POLICY,
  normalizePasswordOutputPolicy
} from "../crypto-engine/output-policy";
import type {
  MigrationBatch,
  MigrationBatchStatus,
  MigrationEntry,
  MigrationEntryStatus,
  MigrationMode,
  MigrationSourceType,
  PasswordGroup,
  PasswordEntry,
  SpacePersistedStatus,
  SpaceProfile,
  SpaceRecord,
  SpaceRelation,
  SpaceRelationType
} from "./types";

export function sanitizePasswordEntry(entry: PasswordEntry): PasswordEntry {
  return {
    id: entry.id,
    spaceId: normalizeStoredSpaceId(entry.spaceId),
    encrypted_password: entry.encrypted_password,
    encrypted_memory_hint: entry.encrypted_memory_hint,
    groupId: entry.groupId?.trim() || undefined,
    platform: entry.platform,
    description: entry.description,
    deprecatedAt: entry.deprecatedAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

export function sanitizePasswordGroup(group: PasswordGroup): PasswordGroup {
  return {
    id: group.id,
    spaceId: normalizeStoredSpaceId(group.spaceId),
    name: group.name?.trim() || "未命名密码组",
    description: group.description?.trim() || undefined,
    outputPolicy: normalizePasswordOutputPolicy(group.outputPolicy ?? DEFAULT_PASSWORD_OUTPUT_POLICY),
    createdAt: typeof group.createdAt === "number" ? group.createdAt : Date.now(),
    updatedAt: typeof group.updatedAt === "number" ? group.updatedAt : Date.now()
  };
}

export function sanitizeSpaceProfile(profile: SpaceProfile): SpaceProfile {
  return {
    spaceId: typeof profile.spaceId === "string" && profile.spaceId.trim() ? profile.spaceId.trim() : DEFAULT_SPACE_ID,
    ruleChain: Array.isArray(profile.ruleChain) ? profile.ruleChain.filter((ruleId) => typeof ruleId === "string") : [],
    importedRuleManifests: Array.isArray(profile.importedRuleManifests)
      ? profile.importedRuleManifests.map((manifest) => ({ ...manifest }))
      : [],
    createdAt: typeof profile.createdAt === "number" ? profile.createdAt : Date.now(),
    updatedAt: typeof profile.updatedAt === "number" ? profile.updatedAt : Date.now()
  };
}

export function sanitizeSpaceRecord(space: SpaceRecord): SpaceRecord {
  const status = isSpacePersistedStatus(space.status) ? space.status : "active";
  const sanitized: SpaceRecord = {
    spaceId: normalizeStoredSpaceId(space.spaceId),
    displayName: space.displayName?.trim() || undefined,
    description: space.description?.trim() || undefined,
    status,
    createdAt: typeof space.createdAt === "number" ? space.createdAt : Date.now(),
    updatedAt: typeof space.updatedAt === "number" ? space.updatedAt : Date.now()
  };

  if (typeof space.deprecatedAt === "number") {
    sanitized.deprecatedAt = space.deprecatedAt;
  }
  if (typeof space.archivedAt === "number") {
    sanitized.archivedAt = space.archivedAt;
  }

  return sanitized;
}

export function sanitizeSpaceRelation(relation: SpaceRelation): SpaceRelation {
  return {
    id: relation.id,
    fromSpaceId: normalizeStoredSpaceId(relation.fromSpaceId),
    toSpaceId: normalizeStoredSpaceId(relation.toSpaceId),
    type: isSpaceRelationType(relation.type) ? relation.type : "cloned_from",
    createdAt: typeof relation.createdAt === "number" ? relation.createdAt : Date.now(),
    note: relation.note?.trim() || undefined
  };
}

export function sanitizeMigrationBatch(batch: MigrationBatch): MigrationBatch {
  return {
    id: batch.id,
    sourceSpaceId: normalizeStoredSpaceId(batch.sourceSpaceId),
    targetSpaceId: normalizeStoredSpaceId(batch.targetSpaceId),
    sourceType: isMigrationSourceType(batch.sourceType) ? batch.sourceType : "clone",
    status: isMigrationBatchStatus(batch.status) ? batch.status : "draft",
    sourceProfileSnapshot: {
      ruleChain: Array.isArray(batch.sourceProfileSnapshot?.ruleChain)
        ? batch.sourceProfileSnapshot.ruleChain.filter((ruleId) => typeof ruleId === "string")
        : [],
      importedRuleManifests: Array.isArray(batch.sourceProfileSnapshot?.importedRuleManifests)
        ? batch.sourceProfileSnapshot.importedRuleManifests.map((manifest) => ({ ...manifest }))
        : []
    },
    autoFinalizeSource: batch.autoFinalizeSource !== false,
    migratedCount: typeof batch.migratedCount === "number" ? batch.migratedCount : 0,
    totalCount: typeof batch.totalCount === "number" ? batch.totalCount : 0,
    createdAt: typeof batch.createdAt === "number" ? batch.createdAt : Date.now(),
    updatedAt: typeof batch.updatedAt === "number" ? batch.updatedAt : Date.now(),
    completedAt: typeof batch.completedAt === "number" ? batch.completedAt : undefined,
    sourceFinalizedAt: typeof batch.sourceFinalizedAt === "number" ? batch.sourceFinalizedAt : undefined
  };
}

export function sanitizeMigrationEntry(entry: MigrationEntry): MigrationEntry {
  return {
    id: entry.id,
    batchId: entry.batchId,
    sourceSpaceId: normalizeStoredSpaceId(entry.sourceSpaceId),
    targetSpaceId: normalizeStoredSpaceId(entry.targetSpaceId),
    sourceEntryId: entry.sourceEntryId,
    sourceEncryptedPassword: entry.sourceEncryptedPassword,
    sourceEncryptedMemoryHint: entry.sourceEncryptedMemoryHint,
    groupId: entry.groupId?.trim() || undefined,
    platform: entry.platform?.trim() || undefined,
    description: entry.description?.trim() || undefined,
    sourceDeprecatedAt: typeof entry.sourceDeprecatedAt === "number" ? entry.sourceDeprecatedAt : undefined,
    mode: isMigrationMode(entry.mode) ? entry.mode : undefined,
    status: isMigrationEntryStatus(entry.status) ? entry.status : "pending",
    migratedEntryId: entry.migratedEntryId,
    createdAt: typeof entry.createdAt === "number" ? entry.createdAt : Date.now(),
    updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : Date.now()
  };
}

export function normalizeStoredSpaceId(spaceId: string): string {
  const normalized = typeof spaceId === "string" ? spaceId.trim().toLowerCase() : "";
  return normalized || DEFAULT_SPACE_ID;
}

function isSpacePersistedStatus(status: unknown): status is SpacePersistedStatus {
  return status === "active" || status === "deprecated" || status === "archived";
}

function isSpaceRelationType(type: unknown): type is SpaceRelationType {
  return (
    type === "cloned_from" ||
    type === "successor_of" ||
    type === "forked_from" ||
    type === "restored_from" ||
    type === "imported_from"
  );
}

function isMigrationSourceType(sourceType: unknown): sourceType is MigrationSourceType {
  return sourceType === "clone" || sourceType === "import";
}

function isMigrationBatchStatus(status: unknown): status is MigrationBatchStatus {
  return status === "draft" || status === "ready" || status === "in_progress" || status === "completed";
}

function isMigrationEntryStatus(status: unknown): status is MigrationEntryStatus {
  return status === "pending" || status === "migrated" || status === "skipped";
}

function isMigrationMode(mode: unknown): mode is MigrationMode {
  return mode === "preserve_password" || mode === "regenerate_password";
}
