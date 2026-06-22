import type { ImportedRuleManifest } from "../rule-registry/rules";
import type { PasswordOutputPolicy } from "../crypto-engine/output-policy";

export type PasswordEntry = {
  id: string;
  spaceId: string;
  encrypted_password: string;
  encrypted_memory_hint?: string;
  groupId?: string;
  platform?: string;
  description?: string;
  deprecatedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type PasswordEntryInput = {
  id?: string;
  spaceId: string;
  encrypted_password: string;
  encrypted_memory_hint?: string;
  groupId?: string;
  platform?: string;
  description?: string;
};

export type PasswordEntryPatch = {
  platform?: string;
  description?: string;
  groupId?: string;
  encrypted_memory_hint?: string;
  deprecatedAt?: number;
};

export type PasswordGroup = {
  id: string;
  spaceId: string;
  name: string;
  description?: string;
  outputPolicy: PasswordOutputPolicy;
  createdAt: number;
  updatedAt: number;
};

export type PasswordGroupInput = {
  id?: string;
  spaceId: string;
  name: string;
  description?: string;
  outputPolicy: PasswordOutputPolicy;
};

export type PasswordGroupPatch = {
  name?: string;
  description?: string;
  outputPolicy?: PasswordOutputPolicy;
};

export type SpaceProfile = {
  spaceId: string;
  ruleChain: string[];
  importedRuleManifests: ImportedRuleManifest[];
  createdAt: number;
  updatedAt: number;
};

export type SpaceProfileInput = {
  spaceId: string;
  ruleChain: string[];
  importedRuleManifests?: ImportedRuleManifest[];
};

export type SpacePersistedStatus = "active" | "deprecated" | "archived";

export type SpaceRecord = {
  spaceId: string;
  displayName?: string;
  description?: string;
  status: SpacePersistedStatus;
  createdAt: number;
  updatedAt: number;
  deprecatedAt?: number;
  archivedAt?: number;
};

export type SpaceRecordInput = {
  spaceId: string;
  displayName?: string;
  description?: string;
  status?: SpacePersistedStatus;
};

export type SpaceRecordPatch = {
  displayName?: string;
  description?: string;
  status?: SpacePersistedStatus;
  deprecatedAt?: number;
  archivedAt?: number;
};

export type SpaceRelationType =
  | "cloned_from"
  | "successor_of"
  | "forked_from"
  | "restored_from"
  | "imported_from";

export type SpaceRelation = {
  id: string;
  fromSpaceId: string;
  toSpaceId: string;
  type: SpaceRelationType;
  createdAt: number;
  note?: string;
};

export type SpaceRelationInput = {
  id?: string;
  fromSpaceId: string;
  toSpaceId: string;
  type: SpaceRelationType;
  note?: string;
};

export type MigrationSourceType = "clone" | "import";

export type MigrationBatchStatus = "draft" | "ready" | "in_progress" | "completed";

export type MigrationEntryStatus = "pending" | "migrated" | "skipped";

export type MigrationMode = "preserve_password" | "regenerate_password";

export type MigrationProfileSnapshot = {
  ruleChain: string[];
  importedRuleManifests: ImportedRuleManifest[];
};

export type MigrationBatch = {
  id: string;
  sourceSpaceId: string;
  targetSpaceId: string;
  sourceType: MigrationSourceType;
  status: MigrationBatchStatus;
  sourceProfileSnapshot: MigrationProfileSnapshot;
  autoFinalizeSource: boolean;
  migratedCount: number;
  totalCount: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  sourceFinalizedAt?: number;
};

export type MigrationBatchInput = {
  id?: string;
  sourceSpaceId: string;
  targetSpaceId: string;
  sourceType: MigrationSourceType;
  status?: MigrationBatchStatus;
  sourceProfileSnapshot: MigrationProfileSnapshot;
  autoFinalizeSource?: boolean;
  totalCount: number;
};

export type MigrationBatchPatch = {
  status?: MigrationBatchStatus;
  migratedCount?: number;
  totalCount?: number;
  completedAt?: number;
  autoFinalizeSource?: boolean;
  sourceFinalizedAt?: number;
};

export type MigrationEntry = {
  id: string;
  batchId: string;
  sourceSpaceId: string;
  targetSpaceId: string;
  sourceEntryId: string;
  sourceEncryptedPassword: string;
  sourceEncryptedMemoryHint?: string;
  groupId?: string;
  platform?: string;
  description?: string;
  sourceDeprecatedAt?: number;
  mode?: MigrationMode;
  status: MigrationEntryStatus;
  migratedEntryId?: string;
  createdAt: number;
  updatedAt: number;
};

export type MigrationEntryInput = {
  id?: string;
  batchId: string;
  sourceSpaceId: string;
  targetSpaceId: string;
  sourceEntryId: string;
  sourceEncryptedPassword: string;
  sourceEncryptedMemoryHint?: string;
  groupId?: string;
  platform?: string;
  description?: string;
  sourceDeprecatedAt?: number;
};

export type MigrationEntryPatch = {
  mode?: MigrationMode;
  status?: MigrationEntryStatus;
  migratedEntryId?: string;
};
