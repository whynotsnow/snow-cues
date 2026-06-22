import type {
  MigrationBatch,
  MigrationEntry,
  PasswordEntry,
  PasswordGroup,
  SpaceProfile,
  SpaceRecord,
  SpaceRelation
} from "../storage-engine/types";

export const STORAGE_DATA_FORMAT = "snow-cues-storage-data";
export const STORAGE_DATA_DRAFT_FORMAT = "snow-cues-storage-data-draft";
export const STORAGE_DATA_SCHEMA_VERSION = 1;

export type StorageDataContent = {
  spaces: SpaceRecord[];
  spaceProfiles: SpaceProfile[];
  passwordEntries: PasswordEntry[];
  passwordGroups: PasswordGroup[];
  spaceRelations: SpaceRelation[];
  migrationBatches: MigrationBatch[];
  migrationEntries: MigrationEntry[];
};

export type StorageDataFile = {
  format: typeof STORAGE_DATA_FORMAT;
  schemaVersion: typeof STORAGE_DATA_SCHEMA_VERSION;
  storageDataId: string;
  revision: number;
  updatedAt: string;
  contentHash: string;
  data: StorageDataContent;
};

export type StorageDataDraftReason =
  | "save-failed"
  | "external-change-detected"
  | "manual-export";

export type StorageDataDraftFile = {
  format: typeof STORAGE_DATA_DRAFT_FORMAT;
  schemaVersion: typeof STORAGE_DATA_SCHEMA_VERSION;
  storageDataId: string;
  baseRevision: number;
  baseHash: string;
  createdAt: string;
  reason: StorageDataDraftReason;
  draftContent: StorageDataContent;
};

export type StorageDataOpenMode = "direct-folder" | "download";

export type StorageDataOpenState = {
  mode: StorageDataOpenMode;
  file: StorageDataFile;
  openedRevision: number;
  openedHash: string;
};

export type StorageDataSaveSummary = {
  addedSpaces: number;
  modifiedSpaceStatus: number;
  addedPasswordEntries: number;
  modifiedPasswordEntries: number;
  deprecatedPasswordEntries: number;
  modifiedMemoryHints: number;
  addedPasswordGroups: number;
  modifiedPasswordGroups: number;
  deletedPasswordGroups: number;
  changedRuleProfiles: number;
  changedMigrationBatches: number;
  changedMigrationEntries: number;
};

export function createEmptyStorageDataContent(): StorageDataContent {
  return {
    spaces: [],
    spaceProfiles: [],
    passwordEntries: [],
    passwordGroups: [],
    spaceRelations: [],
    migrationBatches: [],
    migrationEntries: []
  };
}
