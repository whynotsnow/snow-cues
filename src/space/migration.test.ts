import { beforeEach, describe, expect, it } from "vitest";
import { decryptPassword, deriveRuntimeStorageKey, encryptPassword, generatePasswordWithRuleChain } from "../crypto-engine/crypto-engine";
import { createSession } from "../session-manager/session-manager";
import {
  createPasswordEntry,
  createPasswordGroup,
  getSpace,
  listMigrationBatchesForTarget,
  listMigrationEntriesByBatch,
  listPasswordEntriesBySpace,
  listPasswordGroupsBySpace,
  listSpaceProfile,
  listSuccessorsOfSpace,
  resetLocalData,
  saveSpace,
  saveSpaceProfile
} from "../storage-engine/storage-engine";
import {
  createMigrationBatchFromSpace,
  finalizeMigrationBatchManually,
  markMigrationBatchReady,
  migrateEntry,
  updateMigrationBatchFinalizationPreference
} from "./migration";

describe("Space migration", () => {
  beforeEach(async () => {
    await resetLocalData();
  });

  it("clone 密码条目只创建迁移队列，不直接写入目标正式密码", async () => {
    await seedSourceEntry("old-password");

    const batch = await createMigrationBatchFromSpace({
      sourceSpaceId: "source",
      targetSpaceId: "target",
      copyProfile: true,
      includeEntries: true
    });

    expect(batch).toMatchObject({
      sourceSpaceId: "source",
      targetSpaceId: "target",
      totalCount: 1
    });
    expect(await listPasswordEntriesBySpace("target")).toEqual([]);
    await expect(listSpaceProfile("target")).resolves.toBeNull();
    expect(await listPasswordGroupsBySpace("target")).toMatchObject([
      {
        name: "代码托管",
        outputPolicy: expect.objectContaining({ length: 20 })
      }
    ]);
    expect(await listMigrationBatchesForTarget("target")).toHaveLength(1);
    expect(await listMigrationEntriesByBatch(batch?.id ?? "")).toMatchObject([
      {
        groupId: expect.any(String)
      }
    ]);
  });

  it("preserve_password 模式会保持平台密码明文并重新加密到目标空间", async () => {
    const { sourceSession, targetSession } = await seedSourceEntry("old-password");
    const batch = await createMigrationBatchFromSpace({
      sourceSpaceId: "source",
      targetSpaceId: "target",
      copyProfile: true,
      includeEntries: true
    });
    await markMigrationBatchReady(batch?.id ?? "");
    const [migrationEntry] = await listMigrationEntriesByBatch(batch?.id ?? "");

    await migrateEntry({
      batchId: batch?.id ?? "",
      entryId: migrationEntry.id,
      mode: "preserve_password",
      sourceSession,
      targetSession,
      oldEntrySecret: "old-secret",
      newEntrySecret: "new-secret",
      targetRuleIds: ["v1-hmac"],
      targetRuleCatalog: [],
      externalPasswordUpdated: true
    });

    const [targetEntry] = await listPasswordEntriesBySpace("target");
    expect(targetEntry.groupId).toBe(migrationEntry.groupId);
    const targetKey = await deriveRuntimeStorageKey(targetSession.cryptoKey, "new-secret");
    await expect(decryptPassword(targetKey, targetEntry.encrypted_password)).resolves.toBe("old-password");
    await expect(decryptPassword(await deriveRuntimeStorageKey(targetSession.cryptoKey, "wrong"), targetEntry.encrypted_password)).rejects.toThrow();
    expect(await getSpace("source")).toMatchObject({ status: "deprecated" });
    expect(await listSuccessorsOfSpace("source")).toMatchObject([
      {
        fromSpaceId: "target",
        toSpaceId: "source",
        type: "successor_of"
      }
    ]);
  });

  it("regenerate_password 模式按目标规则生成新平台密码", async () => {
    const { sourceSession, targetSession } = await seedSourceEntry("old-password");
    const batch = await createMigrationBatchFromSpace({
      sourceSpaceId: "source",
      targetSpaceId: "target",
      copyProfile: true,
      includeEntries: true
    });
    await markMigrationBatchReady(batch?.id ?? "");
    const [migrationEntry] = await listMigrationEntriesByBatch(batch?.id ?? "");
    const expected = await generatePasswordWithRuleChain(targetSession.cryptoKey, "new-secret", ["v1-hmac"], {
      mode: "base62",
      maxLength: 24
    });

    await migrateEntry({
      batchId: batch?.id ?? "",
      entryId: migrationEntry.id,
      mode: "regenerate_password",
      sourceSession,
      targetSession,
      oldEntrySecret: "old-secret",
      newEntrySecret: "new-secret",
      targetRuleIds: ["v1-hmac"],
      targetRuleCatalog: [],
      externalPasswordUpdated: true
    });

    const [targetEntry] = await listPasswordEntriesBySpace("target");
    const targetKey = await deriveRuntimeStorageKey(targetSession.cryptoKey, "new-secret");
    await expect(decryptPassword(targetKey, targetEntry.encrypted_password)).resolves.toBe(expected.encodedPassword);
  });

  it("迁移批次可以关闭自动流转并由用户手动流转来源空间状态", async () => {
    const { sourceSession, targetSession } = await seedSourceEntry("old-password");
    const batch = await createMigrationBatchFromSpace({
      sourceSpaceId: "source",
      targetSpaceId: "target",
      copyProfile: true,
      includeEntries: true
    });
    await updateMigrationBatchFinalizationPreference(batch?.id ?? "", false);
    await markMigrationBatchReady(batch?.id ?? "");
    const [migrationEntry] = await listMigrationEntriesByBatch(batch?.id ?? "");

    await migrateEntry({
      batchId: batch?.id ?? "",
      entryId: migrationEntry.id,
      mode: "preserve_password",
      sourceSession,
      targetSession,
      oldEntrySecret: "old-secret",
      newEntrySecret: "new-secret",
      targetRuleIds: ["v1-hmac"],
      targetRuleCatalog: [],
      externalPasswordUpdated: true
    });

    expect(await getSpace("source")).toMatchObject({ status: "active" });
    expect(await listSuccessorsOfSpace("source")).toEqual([]);

    await finalizeMigrationBatchManually(batch?.id ?? "");
    expect(await getSpace("source")).toMatchObject({ status: "deprecated" });
    expect(await listSuccessorsOfSpace("source")).toMatchObject([
      {
        fromSpaceId: "target",
        toSpaceId: "source",
        type: "successor_of"
      }
    ]);
  });
});

async function seedSourceEntry(password: string) {
  const sourceSession = await createSession("old-master");
  const targetSession = await createSession("new-master");
  const sourceKey = await deriveRuntimeStorageKey(sourceSession.cryptoKey, "old-secret");
  await saveSpace({ spaceId: "source", status: "active" });
  await saveSpaceProfile({
    spaceId: "source",
    ruleChain: ["v1-hmac"],
    importedRuleManifests: []
  });
  const group = await createPasswordGroup({
    spaceId: "source",
    name: "代码托管",
    outputPolicy: {
      length: 20,
      useUppercase: true,
      useLowercase: true,
      useDigits: true,
      useSymbols: false,
      minUppercase: 1,
      minLowercase: 1,
      minDigits: 1,
      minSymbols: 0,
      allowedSymbols: "",
      forbiddenChars: ""
    }
  });
  await createPasswordEntry({
    spaceId: "source",
    encrypted_password: await encryptPassword(sourceKey, password),
    groupId: group.id,
    platform: "Example"
  });
  return { sourceSession, targetSession };
}
