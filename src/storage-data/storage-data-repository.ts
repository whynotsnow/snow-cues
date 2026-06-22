import { DEFAULT_SPACE_ID } from "../storage-engine/constants";
import {
  normalizeStoredSpaceId,
  sanitizeMigrationBatch,
  sanitizeMigrationEntry,
  sanitizePasswordEntry,
  sanitizePasswordGroup,
  sanitizeSpaceProfile,
  sanitizeSpaceRecord,
  sanitizeSpaceRelation
} from "../storage-engine/sanitize";
import type {
  MigrationBatch,
  MigrationBatchInput,
  MigrationBatchPatch,
  MigrationEntry,
  MigrationEntryInput,
  MigrationEntryPatch,
  PasswordEntry,
  PasswordEntryInput,
  PasswordEntryPatch,
  PasswordGroup,
  PasswordGroupInput,
  PasswordGroupPatch,
  SpaceProfile,
  SpaceProfileInput,
  SpaceRecord,
  SpaceRecordInput,
  SpaceRecordPatch,
  SpaceRelation,
  SpaceRelationInput
} from "../storage-engine/types";
import {
  diffStorageDataContent,
  hasStorageDataChanges
} from "./storage-data-diff";
import { sanitizeStorageDataContent } from "./storage-data-security";
import {
  createEmptyStorageDataContent,
  type StorageDataContent
} from "./storage-data-types";

export type StorageDataRepository = ReturnType<
  typeof createStorageDataRepository
>;

export function createStorageDataRepository(
  initialContent: StorageDataContent = createEmptyStorageDataContent()
) {
  let base = cloneContent(sanitizeStorageDataContent(initialContent));
  let draft = cloneContent(base);

  const markDirty = () => undefined;
  const replaceDraft = (next: StorageDataContent) => {
    draft = sanitizeStorageDataContent(next);
    markDirty();
  };

  return {
    snapshot: () => cloneContent(draft),
    baseSnapshot: () => cloneContent(base),
    reset: (content: StorageDataContent = createEmptyStorageDataContent()) => {
      base = cloneContent(sanitizeStorageDataContent(content));
      draft = cloneContent(base);
    },
    markClean: (content: StorageDataContent = draft) => {
      base = cloneContent(sanitizeStorageDataContent(content));
      draft = cloneContent(base);
    },
    isDirty: () => hasStorageDataChanges(diffStorageDataContent(base, draft)),

    async createPasswordEntry(
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
      replaceDraft({
        ...draft,
        passwordEntries: [...draft.passwordEntries, entry]
      });
      return entry;
    },
    async listPasswordEntries(): Promise<PasswordEntry[]> {
      return this.listPasswordEntriesBySpace(DEFAULT_SPACE_ID);
    },
    async listPasswordEntriesBySpace(
      spaceId: string
    ): Promise<PasswordEntry[]> {
      const normalized = normalizeStoredSpaceId(spaceId);
      return draft.passwordEntries
        .map(sanitizePasswordEntry)
        .filter((entry) => entry.spaceId === normalized)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async updatePasswordEntry(
      id: string,
      patch: PasswordEntryPatch
    ): Promise<PasswordEntry> {
      const existing = draft.passwordEntries.find((entry) => entry.id === id);
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
      replaceDraft({
        ...draft,
        passwordEntries: draft.passwordEntries.map((entry) =>
          entry.id === id ? updated : entry
        )
      });
      return updated;
    },
    async deletePasswordEntry(id: string): Promise<void> {
      replaceDraft({
        ...draft,
        passwordEntries: draft.passwordEntries.filter(
          (entry) => entry.id !== id
        )
      });
    },

    async createPasswordGroup(
      input: PasswordGroupInput
    ): Promise<PasswordGroup> {
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
      replaceDraft({
        ...draft,
        passwordGroups: [...draft.passwordGroups, group]
      });
      return group;
    },
    async listPasswordGroupsBySpace(spaceId: string): Promise<PasswordGroup[]> {
      const normalized = normalizeStoredSpaceId(spaceId);
      return draft.passwordGroups
        .map(sanitizePasswordGroup)
        .filter((group) => group.spaceId === normalized)
        .sort(
          (a, b) =>
            a.name.localeCompare(b.name, "zh-Hans-CN") ||
            b.updatedAt - a.updatedAt
        );
    },
    async updatePasswordGroup(
      id: string,
      patch: PasswordGroupPatch
    ): Promise<PasswordGroup> {
      const existing = draft.passwordGroups.find((group) => group.id === id);
      if (!existing) {
        throw new Error("未找到密码组。");
      }
      const updated = sanitizePasswordGroup({
        ...existing,
        name: patch.name === undefined ? existing.name : patch.name,
        description:
          patch.description === undefined
            ? existing.description
            : patch.description,
        outputPolicy: patch.outputPolicy ?? existing.outputPolicy,
        updatedAt: Date.now()
      });
      replaceDraft({
        ...draft,
        passwordGroups: draft.passwordGroups.map((group) =>
          group.id === id ? updated : group
        )
      });
      return updated;
    },
    async deletePasswordGroup(id: string): Promise<void> {
      const existing = draft.passwordGroups.find((group) => group.id === id);
      if (!existing) {
        return;
      }
      if (
        draft.passwordEntries.some(
          (entry) => entry.groupId === id && entry.spaceId === existing.spaceId
        )
      ) {
        throw new Error("密码组仍有关联条目，请先移动条目后再删除。");
      }
      replaceDraft({
        ...draft,
        passwordGroups: draft.passwordGroups.filter((group) => group.id !== id)
      });
    },

    async getSpace(spaceId: string): Promise<SpaceRecord | null> {
      const normalized = normalizeStoredSpaceId(spaceId);
      const space = listSpacesFromContent(draft).find(
        (item) => item.spaceId === normalized
      );
      return space ?? null;
    },
    async saveSpace(input: SpaceRecordInput): Promise<SpaceRecord> {
      const now = Date.now();
      const spaceId = normalizeStoredSpaceId(input.spaceId);
      const existing = draft.spaces.find((space) => space.spaceId === spaceId);
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
      replaceDraft({
        ...draft,
        spaces: existing
          ? draft.spaces.map((item) =>
              item.spaceId === spaceId ? space : item
            )
          : [...draft.spaces, space]
      });
      return space;
    },
    async listSpaces(): Promise<SpaceRecord[]> {
      return listSpacesFromContent(draft);
    },
    async updateSpace(
      spaceId: string,
      patch: SpaceRecordPatch
    ): Promise<SpaceRecord> {
      const normalized = normalizeStoredSpaceId(spaceId);
      const existing = draft.spaces.find(
        (space) => space.spaceId === normalized
      );
      if (!existing) {
        throw new Error("未找到存储空间。");
      }
      const nextStatus = patch.status ?? existing.status;
      const now = Date.now();
      const updated = sanitizeSpaceRecord({
        ...existing,
        displayName:
          patch.displayName === undefined
            ? existing.displayName
            : patch.displayName,
        description:
          patch.description === undefined
            ? existing.description
            : patch.description,
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
      replaceDraft({
        ...draft,
        spaces: draft.spaces.map((space) =>
          space.spaceId === normalized ? updated : space
        )
      });
      return updated;
    },

    async listSystemProfile(): Promise<SpaceProfile | null> {
      return this.listSpaceProfile(DEFAULT_SPACE_ID);
    },
    async listSpaceProfile(spaceId: string): Promise<SpaceProfile | null> {
      const normalized = normalizeStoredSpaceId(spaceId);
      const profile = draft.spaceProfiles.find(
        (item) => normalizeStoredSpaceId(item.spaceId) === normalized
      );
      return profile ? sanitizeSpaceProfile(profile) : null;
    },
    async saveSystemProfile(
      input: Omit<SpaceProfileInput, "spaceId">
    ): Promise<SpaceProfile> {
      return this.saveSpaceProfile({ ...input, spaceId: DEFAULT_SPACE_ID });
    },
    async saveSpaceProfile(input: SpaceProfileInput): Promise<SpaceProfile> {
      const now = Date.now();
      const normalized = normalizeStoredSpaceId(input.spaceId);
      const existing = draft.spaceProfiles.find(
        (profile) => normalizeStoredSpaceId(profile.spaceId) === normalized
      );
      const profile = sanitizeSpaceProfile({
        spaceId: normalized,
        ruleChain: input.ruleChain,
        importedRuleManifests: input.importedRuleManifests ?? [],
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      });
      replaceDraft({
        ...draft,
        spaceProfiles: existing
          ? draft.spaceProfiles.map((item) =>
              normalizeStoredSpaceId(item.spaceId) === normalized
                ? profile
                : item
            )
          : [...draft.spaceProfiles, profile]
      });
      return profile;
    },

    async createSpaceRelation(
      input: SpaceRelationInput
    ): Promise<SpaceRelation> {
      const relation = sanitizeSpaceRelation({
        id: input.id ?? crypto.randomUUID(),
        fromSpaceId: input.fromSpaceId,
        toSpaceId: input.toSpaceId,
        type: input.type,
        createdAt: Date.now(),
        note: input.note
      });
      replaceDraft({
        ...draft,
        spaceRelations: [...draft.spaceRelations, relation]
      });
      return relation;
    },
    async listRelationsForSpace(spaceId: string): Promise<SpaceRelation[]> {
      const normalized = normalizeStoredSpaceId(spaceId);
      return draft.spaceRelations
        .map(sanitizeSpaceRelation)
        .filter(
          (relation) =>
            relation.fromSpaceId === normalized ||
            relation.toSpaceId === normalized
        )
        .sort((a, b) => b.createdAt - a.createdAt);
    },
    async listSourceRelations(spaceId: string): Promise<SpaceRelation[]> {
      const normalized = normalizeStoredSpaceId(spaceId);
      return draft.spaceRelations
        .map(sanitizeSpaceRelation)
        .filter((relation) => relation.fromSpaceId === normalized)
        .sort((a, b) => b.createdAt - a.createdAt);
    },
    async listSuccessorsOfSpace(spaceId: string): Promise<SpaceRelation[]> {
      const normalized = normalizeStoredSpaceId(spaceId);
      return draft.spaceRelations
        .map(sanitizeSpaceRelation)
        .filter(
          (relation) =>
            relation.toSpaceId === normalized &&
            relation.type === "successor_of"
        )
        .sort((a, b) => b.createdAt - a.createdAt);
    },

    async createMigrationBatch(
      input: MigrationBatchInput
    ): Promise<MigrationBatch> {
      const now = Date.now();
      const batch = sanitizeMigrationBatch({
        id: input.id ?? crypto.randomUUID(),
        sourceSpaceId: input.sourceSpaceId,
        targetSpaceId: input.targetSpaceId,
        sourceType: input.sourceType,
        status: input.status ?? "draft",
        sourceProfileSnapshot: input.sourceProfileSnapshot,
        autoFinalizeSource: input.autoFinalizeSource ?? true,
        migratedCount: 0,
        totalCount: input.totalCount,
        createdAt: now,
        updatedAt: now
      });
      replaceDraft({
        ...draft,
        migrationBatches: [...draft.migrationBatches, batch]
      });
      return batch;
    },
    async getMigrationBatch(batchId: string): Promise<MigrationBatch | null> {
      const batch = draft.migrationBatches.find((item) => item.id === batchId);
      return batch ? sanitizeMigrationBatch(batch) : null;
    },
    async listMigrationBatchesForTarget(
      targetSpaceId: string
    ): Promise<MigrationBatch[]> {
      const normalized = normalizeStoredSpaceId(targetSpaceId);
      return draft.migrationBatches
        .map(sanitizeMigrationBatch)
        .filter((batch) => batch.targetSpaceId === normalized)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async updateMigrationBatch(
      batchId: string,
      patch: MigrationBatchPatch
    ): Promise<MigrationBatch> {
      const existing = draft.migrationBatches.find(
        (batch) => batch.id === batchId
      );
      if (!existing) {
        throw new Error("未找到迁移批次。");
      }
      const updated = sanitizeMigrationBatch({
        ...existing,
        ...patch,
        updatedAt: Date.now()
      });
      replaceDraft({
        ...draft,
        migrationBatches: draft.migrationBatches.map((batch) =>
          batch.id === batchId ? updated : batch
        )
      });
      return updated;
    },
    async createMigrationEntry(
      input: MigrationEntryInput
    ): Promise<MigrationEntry> {
      const now = Date.now();
      const entry = sanitizeMigrationEntry({
        id: input.id ?? crypto.randomUUID(),
        batchId: input.batchId,
        sourceSpaceId: input.sourceSpaceId,
        targetSpaceId: input.targetSpaceId,
        sourceEntryId: input.sourceEntryId,
        sourceEncryptedPassword: input.sourceEncryptedPassword,
        sourceEncryptedMemoryHint: input.sourceEncryptedMemoryHint,
        groupId: input.groupId,
        platform: input.platform,
        description: input.description,
        sourceDeprecatedAt: input.sourceDeprecatedAt,
        status: "pending",
        createdAt: now,
        updatedAt: now
      });
      replaceDraft({
        ...draft,
        migrationEntries: [...draft.migrationEntries, entry]
      });
      return entry;
    },
    async listMigrationEntriesByBatch(
      batchId: string
    ): Promise<MigrationEntry[]> {
      return draft.migrationEntries
        .map(sanitizeMigrationEntry)
        .filter((entry) => entry.batchId === batchId)
        .sort((a, b) => a.createdAt - b.createdAt);
    },
    async updateMigrationEntry(
      entryId: string,
      patch: MigrationEntryPatch
    ): Promise<MigrationEntry> {
      const existing = draft.migrationEntries.find(
        (entry) => entry.id === entryId
      );
      if (!existing) {
        throw new Error("未找到迁移条目。");
      }
      const updated = sanitizeMigrationEntry({
        ...existing,
        ...patch,
        updatedAt: Date.now()
      });
      replaceDraft({
        ...draft,
        migrationEntries: draft.migrationEntries.map((entry) =>
          entry.id === entryId ? updated : entry
        )
      });
      return updated;
    },
    async refreshMigrationBatchStats(batchId: string): Promise<MigrationBatch> {
      const batch = await this.getMigrationBatch(batchId);
      const entries = await this.listMigrationEntriesByBatch(batchId);
      if (!batch) {
        throw new Error("未找到迁移批次。");
      }
      const migratedCount = entries.filter(
        (entry) => entry.status === "migrated" || entry.status === "skipped"
      ).length;
      const completed = entries.length > 0 && migratedCount === entries.length;
      return this.updateMigrationBatch(batchId, {
        migratedCount,
        totalCount: entries.length,
        status: completed
          ? "completed"
          : migratedCount > 0
            ? "in_progress"
            : batch.status === "draft"
              ? "draft"
              : "ready",
        completedAt: completed ? Date.now() : undefined
      });
    },

    async clearPasswordEntries(): Promise<void> {
      return this.clearPasswordEntriesBySpace(DEFAULT_SPACE_ID);
    },
    async clearPasswordEntriesBySpace(spaceId: string): Promise<void> {
      const normalized = normalizeStoredSpaceId(spaceId);
      replaceDraft({
        ...draft,
        passwordEntries: draft.passwordEntries.filter(
          (entry) => entry.spaceId !== normalized
        )
      });
    },
    async clearSystemProfile(): Promise<void> {
      return this.clearSpaceProfile(DEFAULT_SPACE_ID);
    },
    async clearSpaceProfile(spaceId: string): Promise<void> {
      const normalized = normalizeStoredSpaceId(spaceId);
      replaceDraft({
        ...draft,
        spaceProfiles: draft.spaceProfiles.filter(
          (profile) => normalizeStoredSpaceId(profile.spaceId) !== normalized
        )
      });
    },
    async deleteSpaceData(spaceId: string): Promise<void> {
      const normalized = normalizeStoredSpaceId(spaceId);
      const deletedBatchIds = new Set(
        draft.migrationBatches
          .filter(
            (batch) =>
              batch.sourceSpaceId === normalized ||
              batch.targetSpaceId === normalized
          )
          .map((batch) => batch.id)
      );
      replaceDraft({
        ...draft,
        spaces: draft.spaces.filter((space) => space.spaceId !== normalized),
        spaceProfiles: draft.spaceProfiles.filter(
          (profile) => normalizeStoredSpaceId(profile.spaceId) !== normalized
        ),
        passwordEntries: draft.passwordEntries.filter(
          (entry) => entry.spaceId !== normalized
        ),
        passwordGroups: draft.passwordGroups.filter(
          (group) => group.spaceId !== normalized
        ),
        spaceRelations: draft.spaceRelations.filter(
          (relation) =>
            relation.fromSpaceId !== normalized &&
            relation.toSpaceId !== normalized
        ),
        migrationBatches: draft.migrationBatches.filter(
          (batch) => !deletedBatchIds.has(batch.id)
        ),
        migrationEntries: draft.migrationEntries.filter(
          (entry) =>
            !deletedBatchIds.has(entry.batchId) &&
            entry.sourceSpaceId !== normalized &&
            entry.targetSpaceId !== normalized
        )
      });
    }
  };
}

export function cloneContent(content: StorageDataContent): StorageDataContent {
  return structuredClone(sanitizeStorageDataContent(content));
}

function listSpacesFromContent(content: StorageDataContent): SpaceRecord[] {
  const explicitSpaces = new Map<string, SpaceRecord>();
  for (const space of content.spaces.map(sanitizeSpaceRecord)) {
    explicitSpaces.set(space.spaceId, space);
  }

  const observedSpaces = new Map<
    string,
    { createdAt: number; updatedAt: number }
  >();
  const observeSpace = (
    spaceId: string,
    createdAt?: number,
    updatedAt?: number
  ) => {
    const normalized = normalizeStoredSpaceId(spaceId);
    const observedCreatedAt =
      safeTimestamp(createdAt) ?? safeTimestamp(updatedAt) ?? 0;
    const observedUpdatedAt = safeTimestamp(updatedAt) ?? observedCreatedAt;
    const existing = observedSpaces.get(normalized);
    observedSpaces.set(normalized, {
      createdAt: existing
        ? Math.min(existing.createdAt, observedCreatedAt)
        : observedCreatedAt,
      updatedAt: existing
        ? Math.max(existing.updatedAt, observedUpdatedAt)
        : observedUpdatedAt
    });
  };

  for (const profile of content.spaceProfiles.map(sanitizeSpaceProfile)) {
    observeSpace(profile.spaceId, profile.createdAt, profile.updatedAt);
  }
  for (const entry of content.passwordEntries.map(sanitizePasswordEntry)) {
    observeSpace(entry.spaceId, entry.createdAt, entry.updatedAt);
  }
  for (const group of content.passwordGroups.map(sanitizePasswordGroup)) {
    observeSpace(group.spaceId, group.createdAt, group.updatedAt);
  }
  for (const relation of content.spaceRelations.map(sanitizeSpaceRelation)) {
    observeSpace(relation.fromSpaceId, relation.createdAt, relation.createdAt);
    observeSpace(relation.toSpaceId, relation.createdAt, relation.createdAt);
  }
  for (const batch of content.migrationBatches.map(sanitizeMigrationBatch)) {
    const updatedAt = Math.max(
      batch.updatedAt,
      safeTimestamp(batch.completedAt) ?? 0,
      safeTimestamp(batch.sourceFinalizedAt) ?? 0
    );
    observeSpace(batch.sourceSpaceId, batch.createdAt, updatedAt);
    observeSpace(batch.targetSpaceId, batch.createdAt, updatedAt);
  }
  for (const entry of content.migrationEntries.map(sanitizeMigrationEntry)) {
    observeSpace(entry.sourceSpaceId, entry.createdAt, entry.updatedAt);
    observeSpace(entry.targetSpaceId, entry.createdAt, entry.updatedAt);
  }

  const explicitRecords = Array.from(explicitSpaces.values()).map((space) => {
    const observed = observedSpaces.get(space.spaceId);
    return observed
      ? {
          ...space,
          createdAt: Math.min(space.createdAt, observed.createdAt),
          updatedAt: Math.max(space.updatedAt, observed.updatedAt)
        }
      : space;
  });
  const inferredRecords = Array.from(observedSpaces.entries())
    .filter(([spaceId]) => !explicitSpaces.has(spaceId))
    .map(([spaceId, timestamps]) =>
      sanitizeSpaceRecord({
        spaceId,
        status: "active",
        createdAt: timestamps.createdAt,
        updatedAt: timestamps.updatedAt
      })
    );

  return [...explicitRecords, ...inferredRecords].sort(
    (a, b) => b.updatedAt - a.updatedAt
  );
}

function safeTimestamp(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}
