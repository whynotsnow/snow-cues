import { beforeEach, describe, expect, it } from "vitest";
import {
  createPasswordEntry,
  createPasswordGroup,
  getSpace,
  listPasswordEntriesBySpace,
  listPasswordGroupsBySpace,
  listRelationsForSpace,
  listSpaceProfile,
  listSuccessorsOfSpace,
  resetLocalData,
  saveSpace,
  saveSpaceProfile
} from "../storage-data";
import { cloneSpaceConfig, createSuccessorSpace } from "./clone";

describe("Space config-only clone 与 successor", () => {
  beforeEach(async () => {
    await resetLocalData();
    await saveSpace({
      spaceId: "source",
      displayName: "来源空间",
      status: "active"
    });
    await saveSpaceProfile({
      spaceId: "source",
      ruleChain: ["v1-hmac", "imported-office"],
      importedRuleManifests: [
        {
          id: "imported-office",
          name: "办公规则",
          algorithm: "hmac-sha256",
          namespace: "office"
        }
      ]
    });
    await createPasswordEntry({
      spaceId: "source",
      encrypted_password: "sealed-password",
      encrypted_memory_hint: "sealed-hint",
      platform: "Example"
    });
    await createPasswordGroup({
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
  });

  it("clone 只复制 Space 配置，不复制密码条目或创建关系", async () => {
    const target = await cloneSpaceConfig({
      sourceSpaceId: "source",
      targetSpaceId: "target",
      targetDisplayName: "目标空间"
    });
    const targetProfile = await listSpaceProfile("target");

    expect(target).toMatchObject({
      spaceId: "target",
      displayName: "目标空间",
      status: "active"
    });
    expect(targetProfile?.ruleChain).toEqual(["v1-hmac", "imported-office"]);
    expect(targetProfile?.importedRuleManifests).toEqual([
      {
        id: "imported-office",
        name: "办公规则",
        algorithm: "hmac-sha256",
        namespace: "office"
      }
    ]);
    expect(targetProfile?.importedRuleManifests).not.toBe(
      (await listSpaceProfile("source"))?.importedRuleManifests
    );
    expect(await listPasswordGroupsBySpace("target")).toMatchObject([
      {
        spaceId: "target",
        name: "代码托管",
        outputPolicy: expect.objectContaining({ length: 20 })
      }
    ]);
    expect(await listPasswordEntriesBySpace("target")).toEqual([]);
    expect(await listRelationsForSpace("target")).toEqual([]);
  });

  it("目标 Space 已存在时拒绝 clone", async () => {
    await saveSpace({
      spaceId: "target",
      status: "active"
    });

    await expect(
      cloneSpaceConfig({
        sourceSpaceId: "source",
        targetSpaceId: "target"
      })
    ).rejects.toThrow("目标存储空间已存在。");
  });

  it("successor 创建新 active 空间、废弃旧空间，并记录单向 successor_of", async () => {
    await createSuccessorSpace({
      sourceSpaceId: "source",
      targetSpaceId: "next",
      targetDisplayName: "后继空间"
    });

    expect(await getSpace("source")).toMatchObject({
      spaceId: "source",
      status: "deprecated"
    });
    expect(await getSpace("next")).toMatchObject({
      spaceId: "next",
      status: "active",
      displayName: "后继空间"
    });
    expect(await listPasswordEntriesBySpace("next")).toEqual([]);
    expect(await listSuccessorsOfSpace("source")).toMatchObject([
      {
        fromSpaceId: "next",
        toSpaceId: "source",
        type: "successor_of"
      }
    ]);
  });
});
