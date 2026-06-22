import {
  decryptPassword,
  deriveRuntimeStorageKey,
  encryptPassword,
  generatePasswordWithRuleChain
} from "../crypto-engine/crypto-engine";
import type { EncodingPolicy } from "../crypto-engine/encoding";
import {
  decryptMemoryHint,
  encryptMemoryHint
} from "../recovery-aid/recovery-aid";
import {
  createImportedRule,
  type ActiveRuleId,
  type RuleDefinition
} from "../rule-registry/rules";
import type { Session } from "../session-manager/session-manager";
import {
  createMigrationBatch,
  createMigrationEntry,
  createPasswordGroup,
  createPasswordEntry,
  createSpaceRelation,
  getSpace,
  getMigrationBatch,
  listMigrationEntriesByBatch,
  listPasswordEntriesBySpace,
  listPasswordGroupsBySpace,
  listSuccessorsOfSpace,
  listSpaceProfile,
  refreshMigrationBatchStats,
  saveSpace,
  saveSpaceProfile,
  updateMigrationBatch,
  updateMigrationEntry,
  updateSpace,
  type MigrationBatch,
  type MigrationEntry,
  type MigrationMode,
  type MigrationProfileSnapshot
} from "../storage-engine/storage-engine";
import { canCreateSuccessorSpace } from "./policy";

const DEFAULT_MIGRATION_ENCODING: EncodingPolicy = {
  mode: "base62",
  maxLength: 24
};

export type CreateMigrationBatchFromSpaceInput = {
  sourceSpaceId: string;
  targetSpaceId: string;
  targetDisplayName?: string;
  targetDescription?: string;
  copyProfile: boolean;
  includeEntries: boolean;
};

export type MigrateEntryInput = {
  batchId: string;
  entryId: string;
  mode: MigrationMode;
  sourceSession: Session;
  targetSession: Session;
  oldEntrySecret: string;
  newEntrySecret: string;
  targetRuleIds: ActiveRuleId[];
  targetRuleCatalog: RuleDefinition[];
  externalPasswordUpdated: boolean;
};

export async function createMigrationBatchFromSpace(
  input: CreateMigrationBatchFromSpaceInput
): Promise<MigrationBatch | null> {
  await assertTargetSpaceAvailable(input.targetSpaceId);
  const [sourceProfile, sourceEntries, sourceGroups] = await Promise.all([
    listSpaceProfile(input.sourceSpaceId),
    listPasswordEntriesBySpace(input.sourceSpaceId),
    listPasswordGroupsBySpace(input.sourceSpaceId)
  ]);
  const targetSpace = await saveSpace({
    spaceId: input.targetSpaceId,
    displayName: input.targetDisplayName,
    description: input.targetDescription,
    status: "active"
  });

  const shouldCreateMigrationBatch =
    input.includeEntries && sourceEntries.length > 0;
  if (input.copyProfile && sourceProfile && !shouldCreateMigrationBatch) {
    await saveSpaceProfile({
      spaceId: targetSpace.spaceId,
      ruleChain: [...sourceProfile.ruleChain],
      importedRuleManifests: sourceProfile.importedRuleManifests.map(
        (manifest) => ({ ...manifest })
      )
    });
  }

  const groupIdMap = new Map<string, string>();
  for (const group of sourceGroups) {
    const createdGroup = await createPasswordGroup({
      spaceId: targetSpace.spaceId,
      name: group.name,
      description: group.description,
      outputPolicy: group.outputPolicy
    });
    groupIdMap.set(group.id, createdGroup.id);
  }

  if (!shouldCreateMigrationBatch) {
    return null;
  }

  const batch = await createMigrationBatch({
    sourceSpaceId: input.sourceSpaceId,
    targetSpaceId: targetSpace.spaceId,
    sourceType: "clone",
    status: "draft",
    sourceProfileSnapshot: profileSnapshotFromProfile(sourceProfile),
    totalCount: sourceEntries.length
  });
  await Promise.all(
    sourceEntries.map((entry) =>
      createMigrationEntry({
        batchId: batch.id,
        sourceSpaceId: input.sourceSpaceId,
        targetSpaceId: targetSpace.spaceId,
        sourceEntryId: entry.id,
        sourceEncryptedPassword: entry.encrypted_password,
        sourceEncryptedMemoryHint: entry.encrypted_memory_hint,
        groupId: entry.groupId ? groupIdMap.get(entry.groupId) : undefined,
        platform: entry.platform,
        description: entry.description,
        sourceDeprecatedAt: entry.deprecatedAt
      })
    )
  );
  return refreshMigrationBatchStats(batch.id);
}

async function assertTargetSpaceAvailable(spaceId: string): Promise<void> {
  const [space, entries, profile, groups] = await Promise.all([
    getSpace(spaceId),
    listPasswordEntriesBySpace(spaceId),
    listSpaceProfile(spaceId),
    listPasswordGroupsBySpace(spaceId)
  ]);
  if (space || entries.length > 0 || profile || groups.length > 0) {
    throw new Error("目标存储空间已存在。");
  }
}

export async function markMigrationBatchReady(
  batchId: string
): Promise<MigrationBatch> {
  return updateMigrationBatch(batchId, { status: "ready" });
}

export async function updateMigrationBatchFinalizationPreference(
  batchId: string,
  autoFinalizeSource: boolean
): Promise<MigrationBatch> {
  const batch = await getMigrationBatch(batchId);
  if (!batch) {
    throw new Error("未找到迁移批次。");
  }
  if (batch.sourceFinalizedAt) {
    throw new Error("来源空间已经完成流转，不能再修改流转方式。");
  }
  if (batch.status === "in_progress" || batch.status === "completed") {
    throw new Error("迁移已开始或已完成，不能再修改来源空间流转方式。");
  }
  return updateMigrationBatch(batchId, { autoFinalizeSource });
}

export async function migrateEntry(
  input: MigrateEntryInput
): Promise<{ entryId: string; password: string }> {
  const [batch, entries] = await Promise.all([
    getMigrationBatch(input.batchId),
    listMigrationEntriesByBatch(input.batchId)
  ]);
  if (!batch) {
    throw new Error("未找到迁移批次。");
  }
  if (batch.status === "draft") {
    throw new Error("请先初始化目标空间规则链，再迁移密码条目。");
  }
  const migrationEntry = entries.find((entry) => entry.id === input.entryId);
  if (!migrationEntry) {
    throw new Error("未找到迁移条目。");
  }
  if (migrationEntry.status !== "pending") {
    throw new Error("这条迁移任务已经处理完成。");
  }

  const sourcePlaintextPassword = await decryptSourcePassword(
    input.sourceSession,
    migrationEntry,
    input.oldEntrySecret
  );
  const plaintextPassword =
    input.mode === "preserve_password"
      ? sourcePlaintextPassword
      : await regenerateTargetPassword(input);

  if (input.mode === "regenerate_password" && !input.externalPasswordUpdated) {
    throw new Error("重新生成模式需要先确认外部平台密码已经更新。");
  }

  const newEntryId = crypto.randomUUID();
  const targetStorageKey = await deriveRuntimeStorageKey(
    input.targetSession.cryptoKey,
    input.newEntrySecret
  );
  const encryptedPassword = await encryptPassword(
    targetStorageKey,
    plaintextPassword
  );
  const encryptedMemoryHint = await migrateMemoryHint(
    input.sourceSession,
    input.targetSession,
    migrationEntry,
    newEntryId
  );
  const savedEntry = await createPasswordEntry({
    id: newEntryId,
    spaceId: batch.targetSpaceId,
    encrypted_password: encryptedPassword,
    encrypted_memory_hint: encryptedMemoryHint,
    groupId: migrationEntry.groupId,
    platform: migrationEntry.platform,
    description: migrationEntry.description
  });

  await updateMigrationEntry(migrationEntry.id, {
    mode: input.mode,
    status: "migrated",
    migratedEntryId: savedEntry.id
  });
  const updatedBatch = await refreshMigrationBatchStats(batch.id);
  if (updatedBatch.status === "completed" && updatedBatch.autoFinalizeSource) {
    await finalizeMigrationBatch(updatedBatch);
  }
  return {
    entryId: savedEntry.id,
    password: plaintextPassword
  };
}

export async function verifyMigrationSourceEntry(
  batchId: string,
  entryId: string,
  sourceSession: Session,
  oldEntrySecret: string
): Promise<void> {
  const entries = await listMigrationEntriesByBatch(batchId);
  const migrationEntry = entries.find((entry) => entry.id === entryId);
  if (!migrationEntry) {
    throw new Error("未找到迁移条目。");
  }
  await decryptSourcePassword(sourceSession, migrationEntry, oldEntrySecret);
}

export async function skipMigrationEntry(
  batchId: string,
  entryId: string
): Promise<MigrationBatch> {
  await updateMigrationEntry(entryId, { status: "skipped" });
  const updatedBatch = await refreshMigrationBatchStats(batchId);
  if (updatedBatch.status === "completed" && updatedBatch.autoFinalizeSource) {
    await finalizeMigrationBatch(updatedBatch);
  }
  return updatedBatch;
}

export async function finalizeMigrationBatchManually(
  batchId: string
): Promise<MigrationBatch> {
  const batch = await getMigrationBatch(batchId);
  if (!batch) {
    throw new Error("未找到迁移批次。");
  }
  if (batch.status !== "completed") {
    throw new Error("迁移批次尚未完成，不能流转来源空间状态。");
  }
  return finalizeMigrationBatch(batch);
}

async function decryptSourcePassword(
  sourceSession: Session,
  entry: MigrationEntry,
  oldEntrySecret: string
): Promise<string> {
  const sourceStorageKey = await deriveRuntimeStorageKey(
    sourceSession.cryptoKey,
    oldEntrySecret
  );
  return decryptPassword(sourceStorageKey, entry.sourceEncryptedPassword);
}

async function regenerateTargetPassword(
  input: MigrateEntryInput
): Promise<string> {
  if (input.targetRuleIds.length === 0) {
    throw new Error("请先初始化目标空间规则链。");
  }
  const generated = await generatePasswordWithRuleChain(
    input.targetSession.cryptoKey,
    input.newEntrySecret,
    input.targetRuleIds,
    DEFAULT_MIGRATION_ENCODING,
    input.targetRuleCatalog
  );
  return generated.encodedPassword;
}

async function migrateMemoryHint(
  sourceSession: Session,
  targetSession: Session,
  migrationEntry: MigrationEntry,
  newEntryId: string
): Promise<string | undefined> {
  if (!migrationEntry.sourceEncryptedMemoryHint) {
    return undefined;
  }
  const hint = await decryptMemoryHint(
    sourceSession,
    migrationEntry.sourceSpaceId,
    migrationEntry.sourceEntryId,
    migrationEntry.sourceEncryptedMemoryHint
  );
  return encryptMemoryHint(
    targetSession,
    migrationEntry.targetSpaceId,
    newEntryId,
    hint
  );
}

async function finalizeMigrationBatch(
  batch: MigrationBatch
): Promise<MigrationBatch> {
  if (batch.sourceFinalizedAt) {
    return batch;
  }
  const successors = await listSuccessorsOfSpace(batch.sourceSpaceId);
  const relationExists = successors.some(
    (relation) =>
      relation.fromSpaceId === batch.targetSpaceId &&
      relation.toSpaceId === batch.sourceSpaceId
  );
  if (!relationExists) {
    await createSpaceRelation({
      fromSpaceId: batch.targetSpaceId,
      toSpaceId: batch.sourceSpaceId,
      type: "successor_of"
    });
  }
  const sourceSpace = await getSpace(batch.sourceSpaceId);
  if (
    sourceSpace &&
    canCreateSuccessorSpace({
      spaceStatus: sourceSpace.status,
      sessionAlive: true
    })
  ) {
    await updateSpace(batch.sourceSpaceId, {
      status: "deprecated",
      deprecatedAt: Date.now()
    });
  }
  return updateMigrationBatch(batch.id, { sourceFinalizedAt: Date.now() });
}

function profileSnapshotFromProfile(
  profile: Awaited<ReturnType<typeof listSpaceProfile>>
): MigrationProfileSnapshot {
  return {
    ruleChain: profile?.ruleChain ? [...profile.ruleChain] : [],
    importedRuleManifests: profile?.importedRuleManifests
      ? profile.importedRuleManifests.map((manifest) => ({ ...manifest }))
      : []
  };
}

export function ruleCatalogFromSnapshot(
  snapshot: MigrationProfileSnapshot
): RuleDefinition[] {
  return snapshot.importedRuleManifests.map((manifest) =>
    createImportedRule(manifest)
  );
}
