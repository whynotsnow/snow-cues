import {
  createMigrationBatch,
  createMigrationEntry,
  createPasswordGroup,
  getSpace,
  listPasswordEntriesBySpace,
  listPasswordGroupsBySpace,
  listRelationsForSpace,
  listSpaceProfile,
  refreshMigrationBatchStats,
  saveSpace,
  saveSpaceProfile,
  type MigrationBatch,
  type PasswordEntry,
  type PasswordGroup,
  type SpaceProfile,
  type SpaceRecord,
  type SpaceRelation
} from "../storage-engine/storage-engine";

export type SpaceExportPackage = {
  format: "snow-cues-space-export";
  version: 1;
  exportedAt: number;
  sourceSpaceId: string;
  space: SpaceRecord | null;
  profile: SpaceProfile | null;
  relations: SpaceRelation[];
  groups?: PasswordGroup[];
  entries?: PasswordEntry[];
};

export type ExportSpaceInput = {
  spaceId: string;
  includeEntries: boolean;
};

export type ImportSpaceInput = {
  targetSpaceId: string;
  packageText: string;
  importProfile: boolean;
  importEntries: boolean;
};

export type CreateBlankSpaceInput = {
  targetSpaceId: string;
};

export async function createBlankSpace(input: CreateBlankSpaceInput): Promise<SpaceRecord> {
  await assertTargetSpaceAvailable(input.targetSpaceId);
  return saveSpace({
    spaceId: input.targetSpaceId,
    status: "active"
  });
}

export async function exportSpacePackage(input: ExportSpaceInput): Promise<SpaceExportPackage> {
  const [space, profile, relations, groups, entries] = await Promise.all([
    getSpace(input.spaceId),
    listSpaceProfile(input.spaceId),
    listRelationsForSpace(input.spaceId),
    listPasswordGroupsBySpace(input.spaceId),
    input.includeEntries ? listPasswordEntriesBySpace(input.spaceId) : Promise.resolve(undefined)
  ]);

  return {
    format: "snow-cues-space-export",
    version: 1,
    exportedAt: Date.now(),
    sourceSpaceId: space?.spaceId ?? input.spaceId,
    space,
    profile,
    relations,
    groups,
    entries
  };
}

export async function importSpacePackage(input: ImportSpaceInput): Promise<MigrationBatch | null> {
  const parsed = parseSpaceExportPackage(input.packageText);
  await assertTargetSpaceAvailable(input.targetSpaceId);
  const savedSpace = await saveSpace({
    spaceId: input.targetSpaceId,
    displayName: parsed.space?.displayName,
    description: parsed.space?.description,
    status: "active"
  });

  const parsedEntries = parsed.entries ?? [];
  const importEntries = Boolean(input.importEntries && parsedEntries.length > 0);
  if (input.importProfile && parsed.profile && !importEntries) {
    await saveSpaceProfile({
      spaceId: savedSpace.spaceId,
      ruleChain: [...parsed.profile.ruleChain],
      importedRuleManifests: parsed.profile.importedRuleManifests.map((manifest) => ({ ...manifest }))
    });
  }

  const groupIdMap = new Map<string, string>();
  for (const group of parsed.groups ?? []) {
    const createdGroup = await createPasswordGroup({
      spaceId: savedSpace.spaceId,
      name: group.name,
      description: group.description,
      outputPolicy: group.outputPolicy
    });
    groupIdMap.set(group.id, createdGroup.id);
  }

  if (!importEntries) {
    return null;
  }

  const batch = await createMigrationBatch({
    sourceSpaceId: parsed.sourceSpaceId,
    targetSpaceId: savedSpace.spaceId,
    sourceType: "import",
    status: "draft",
    sourceProfileSnapshot: {
      ruleChain: parsed.profile?.ruleChain ? [...parsed.profile.ruleChain] : [],
      importedRuleManifests: parsed.profile?.importedRuleManifests
        ? parsed.profile.importedRuleManifests.map((manifest) => ({ ...manifest }))
        : []
    },
    totalCount: parsedEntries.length
  });

  await Promise.all(
    parsedEntries.map((entry) =>
      createMigrationEntry({
        batchId: batch.id,
        sourceSpaceId: parsed.sourceSpaceId,
        targetSpaceId: savedSpace.spaceId,
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

export function stringifySpaceExportPackage(pkg: SpaceExportPackage): string {
  return JSON.stringify(pkg, null, 2);
}

function parseSpaceExportPackage(packageText: string): SpaceExportPackage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(packageText);
  } catch {
    throw new Error("导入数据不是有效 JSON。");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("导入数据格式无效。");
  }
  const candidate = parsed as Partial<SpaceExportPackage>;
  if (candidate.format !== "snow-cues-space-export" || candidate.version !== 1 || !candidate.sourceSpaceId) {
    throw new Error("导入数据不是受支持的空间备份格式。");
  }
  return {
    format: "snow-cues-space-export",
    version: 1,
    exportedAt: typeof candidate.exportedAt === "number" ? candidate.exportedAt : Date.now(),
    sourceSpaceId: candidate.sourceSpaceId,
    space: candidate.space ?? null,
    profile: candidate.profile ?? null,
    relations: Array.isArray(candidate.relations) ? candidate.relations : [],
    groups: Array.isArray(candidate.groups) ? candidate.groups : [],
    entries: Array.isArray(candidate.entries) ? candidate.entries : undefined
  };
}
