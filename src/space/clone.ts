import {
  createSpaceRelation,
  createPasswordGroup,
  getSpace,
  listPasswordEntriesBySpace,
  listPasswordGroupsBySpace,
  listSpaceProfile,
  saveSpace,
  saveSpaceProfile,
  updateSpace,
  type SpaceRecord
} from "../storage-engine/storage-engine";
import { canCloneSpace, canCreateSuccessorSpace } from "./policy";

export type CloneSpaceConfigInput = {
  sourceSpaceId: string;
  targetSpaceId: string;
  targetDisplayName?: string;
  targetDescription?: string;
};

export type CreateSuccessorSpaceInput = CloneSpaceConfigInput;

export async function cloneSpaceConfig(
  input: CloneSpaceConfigInput
): Promise<SpaceRecord> {
  const sourceSpace = await getRequiredSpace(input.sourceSpaceId);
  if (!canCloneSpace({ spaceStatus: sourceSpace.status, sessionAlive: true })) {
    throw new Error("当前存储空间不允许克隆配置。");
  }
  await assertTargetSpaceAvailable(input.targetSpaceId);

  const targetSpace = await saveSpace({
    spaceId: input.targetSpaceId,
    displayName: input.targetDisplayName,
    description: input.targetDescription,
    status: "active"
  });
  await copySpaceProfile(input.sourceSpaceId, input.targetSpaceId);
  await copyPasswordGroups(input.sourceSpaceId, input.targetSpaceId);

  return targetSpace;
}

export async function createSuccessorSpace(
  input: CreateSuccessorSpaceInput
): Promise<SpaceRecord> {
  const sourceSpace = await getRequiredSpace(input.sourceSpaceId);
  if (
    !canCreateSuccessorSpace({
      spaceStatus: sourceSpace.status,
      sessionAlive: true
    })
  ) {
    throw new Error("当前存储空间不允许创建后继空间。");
  }
  await assertTargetSpaceAvailable(input.targetSpaceId);

  const targetSpace = await saveSpace({
    spaceId: input.targetSpaceId,
    displayName: input.targetDisplayName,
    description: input.targetDescription,
    status: "active"
  });
  await copySpaceProfile(input.sourceSpaceId, input.targetSpaceId);
  await copyPasswordGroups(input.sourceSpaceId, input.targetSpaceId);
  await createSpaceRelation({
    fromSpaceId: targetSpace.spaceId,
    toSpaceId: sourceSpace.spaceId,
    type: "successor_of"
  });
  await updateSpace(sourceSpace.spaceId, {
    status: "deprecated",
    deprecatedAt: Date.now()
  });

  return targetSpace;
}

async function getRequiredSpace(spaceId: string): Promise<SpaceRecord> {
  const space = await getSpace(spaceId);
  if (!space) {
    throw new Error("未找到来源存储空间。");
  }
  return space;
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

async function copyPasswordGroups(
  sourceSpaceId: string,
  targetSpaceId: string
): Promise<void> {
  const sourceGroups = await listPasswordGroupsBySpace(sourceSpaceId);
  await Promise.all(
    sourceGroups.map((group) =>
      createPasswordGroup({
        spaceId: targetSpaceId,
        name: group.name,
        description: group.description,
        outputPolicy: group.outputPolicy
      })
    )
  );
}

async function copySpaceProfile(
  sourceSpaceId: string,
  targetSpaceId: string
): Promise<void> {
  const sourceProfile = await listSpaceProfile(sourceSpaceId);
  if (!sourceProfile) {
    return;
  }
  await saveSpaceProfile({
    spaceId: targetSpaceId,
    ruleChain: [...sourceProfile.ruleChain],
    importedRuleManifests: sourceProfile.importedRuleManifests.map(
      (manifest) => ({ ...manifest })
    )
  });
}
