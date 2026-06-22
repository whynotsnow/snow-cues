export const DB_NAME = "snow-cues";
export const STORE_NAME = "password_entries";
export const LEGACY_PROFILE_STORE_NAME = "system_profile";
export const PROFILE_STORE_NAME = "space_profiles";
export const SPACE_STORE_NAME = "spaces";
export const RELATION_STORE_NAME = "space_relations";
export const MIGRATION_BATCH_STORE_NAME = "migration_batches";
export const MIGRATION_ENTRY_STORE_NAME = "migration_entries";
export const PASSWORD_GROUP_STORE_NAME = "password_groups";
export const DB_VERSION = 9;
export const DEFAULT_SPACE_ID = "default";

export const allowedStorageFields = Object.freeze([
  "id",
  "spaceId",
  "encrypted_password",
  "encrypted_memory_hint",
  "groupId",
  "platform",
  "description",
  "deprecatedAt",
  "createdAt",
  "updatedAt"
]);

export const allowedPasswordGroupFields = Object.freeze([
  "id",
  "spaceId",
  "name",
  "description",
  "outputPolicy",
  "createdAt",
  "updatedAt"
]);

export const allowedSpaceFields = Object.freeze([
  "spaceId",
  "displayName",
  "description",
  "status",
  "createdAt",
  "updatedAt",
  "deprecatedAt",
  "archivedAt"
]);

export const allowedSpaceRelationFields = Object.freeze([
  "id",
  "fromSpaceId",
  "toSpaceId",
  "type",
  "createdAt",
  "note"
]);

export const allowedMigrationBatchFields = Object.freeze([
  "id",
  "sourceSpaceId",
  "targetSpaceId",
  "sourceType",
  "status",
  "sourceProfileSnapshot",
  "autoFinalizeSource",
  "migratedCount",
  "totalCount",
  "createdAt",
  "updatedAt",
  "completedAt",
  "sourceFinalizedAt"
]);

export const allowedMigrationEntryFields = Object.freeze([
  "id",
  "batchId",
  "sourceSpaceId",
  "targetSpaceId",
  "sourceEntryId",
  "sourceEncryptedPassword",
  "sourceEncryptedMemoryHint",
  "groupId",
  "platform",
  "description",
  "sourceDeprecatedAt",
  "mode",
  "status",
  "migratedEntryId",
  "createdAt",
  "updatedAt"
]);
