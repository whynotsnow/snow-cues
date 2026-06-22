import { beforeEach, describe, expect, it } from "vitest";
import {
  allowedSpaceFields,
  allowedSpaceRelationFields,
  allowedStorageFields,
  allowedPasswordGroupFields,
  clearSystemProfile,
  createPasswordGroup,
  createSpaceRelation,
  createPasswordEntry,
  deletePasswordGroup,
  DB_NAME,
  DB_VERSION,
  getSpace,
  listPasswordGroupsBySpace,
  listRelationsForSpace,
  listPasswordEntriesBySpace,
  listSpaces,
  listSuccessorsOfSpace,
  listSystemProfile,
  resetLocalData,
  sanitizeSpaceRecord,
  sanitizeSpaceRelation,
  sanitizePasswordEntry,
  saveSpace,
  saveSystemProfile,
  updateSpace,
  updatePasswordGroup,
  updatePasswordEntry,
  type PasswordEntry,
  type SpaceRecord,
  type SpaceRelation
} from "./storage-engine";
import { closeDatabaseConnection } from "./database";

describe("storage-engine 存储结构", () => {
  beforeEach(async () => {
    await resetLocalData();
  });

  it("只允许加密输出和非敏感元数据", () => {
    expect(allowedStorageFields).toEqual([
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
  });

  it("只允许 Space 本体非敏感字段", () => {
    expect(allowedSpaceFields).toEqual([
      "spaceId",
      "displayName",
      "description",
      "status",
      "createdAt",
      "updatedAt",
      "deprecatedAt",
      "archivedAt"
    ]);
    expect(allowedSpaceRelationFields).toEqual([
      "id",
      "fromSpaceId",
      "toSpaceId",
      "type",
      "createdAt",
      "note"
    ]);
  });

  it("持久化前会剥离禁止的派生字段", () => {
    const entryWithForbiddenFields = {
      id: "id",
      encrypted_password: "sealed",
      encrypted_memory_hint: "sealed-hint",
      groupId: "group-1",
      platform: "example",
      description: "account",
      deprecatedAt: 3,
      createdAt: 1,
      updatedAt: 2,
      master_password: "forbidden",
      runtime_salt: "forbidden",
      entrySecret: "forbidden",
      entry_secret: "forbidden",
      encrypted_entry_secret: "forbidden",
      memory_hint: "forbidden",
      ruleId: "v1-hmac"
    } as unknown as PasswordEntry;

    const sanitized = sanitizePasswordEntry(entryWithForbiddenFields);

    expect(sanitized).toEqual({
      id: "id",
      spaceId: "default",
      encrypted_password: "sealed",
      encrypted_memory_hint: "sealed-hint",
      groupId: "group-1",
      platform: "example",
      description: "account",
      deprecatedAt: 3,
      createdAt: 1,
      updatedAt: 2
    });
  });

  it("只允许密码组的空间内输出适配字段", () => {
    expect(allowedPasswordGroupFields).toEqual([
      "id",
      "spaceId",
      "name",
      "description",
      "outputPolicy",
      "createdAt",
      "updatedAt"
    ]);
  });

  it("可以保存和读取系统级规则链 profile", async () => {
    await clearSystemProfile();

    await saveSystemProfile({
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

    const profile = await listSystemProfile();

    expect(profile?.ruleChain).toEqual(["v1-hmac", "imported-office"]);
    expect(profile?.importedRuleManifests[0]).toMatchObject({
      id: "imported-office",
      algorithm: "hmac-sha256"
    });
  });

  it("SpaceRecord 持久化前会剥离禁止字段", () => {
    const spaceWithForbiddenFields = {
      spaceId: " Work ",
      displayName: " 工作 ",
      description: " 账号 ",
      status: "active",
      createdAt: 1,
      updatedAt: 2,
      master_password: "forbidden",
      entrySecret: "forbidden",
      encrypted_entry_secret: "forbidden",
      memory_hint: "forbidden"
    } as unknown as SpaceRecord;

    expect(sanitizeSpaceRecord(spaceWithForbiddenFields)).toEqual({
      spaceId: "work",
      displayName: "工作",
      description: "账号",
      status: "active",
      createdAt: 1,
      updatedAt: 2
    });
  });

  it("可以保存、列出和更新 SpaceRecord", async () => {
    await saveSpace({
      spaceId: "Work",
      displayName: "工作空间",
      status: "active"
    });

    const updated = await updateSpace("work", {
      status: "deprecated"
    });
    const spaces = await listSpaces();

    expect(await getSpace(" work ")).toMatchObject({
      spaceId: "work",
      displayName: "工作空间",
      status: "deprecated"
    });
    expect(updated.deprecatedAt).toEqual(expect.any(Number));
    expect(spaces.map((space) => space.spaceId)).toContain("work");
  });

  it("SpaceRelation 持久化前会剥离禁止字段并支持 successor 查询", async () => {
    const relationWithForbiddenFields = {
      id: "rel-1",
      fromSpaceId: "New",
      toSpaceId: "Old",
      type: "successor_of",
      createdAt: 1,
      note: " 迁移 ",
      master_password: "forbidden",
      entrySecret: "forbidden"
    } as unknown as SpaceRelation;

    expect(sanitizeSpaceRelation(relationWithForbiddenFields)).toEqual({
      id: "rel-1",
      fromSpaceId: "new",
      toSpaceId: "old",
      type: "successor_of",
      createdAt: 1,
      note: "迁移"
    });

    await createSpaceRelation({
      id: "rel-1",
      fromSpaceId: "new",
      toSpaceId: "old",
      type: "successor_of"
    });

    expect(await listRelationsForSpace("old")).toHaveLength(1);
    expect(await listSuccessorsOfSpace("old")).toMatchObject([
      {
        fromSpaceId: "new",
        toSpaceId: "old",
        type: "successor_of"
      }
    ]);
  });

  it("按存储空间隔离密码条目", async () => {
    await createPasswordEntry({
      spaceId: "default",
      encrypted_password: "sealed-default",
      platform: "default"
    });
    await createPasswordEntry({
      spaceId: "work",
      encrypted_password: "sealed-work",
      platform: "work"
    });

    const defaultEntries = await listPasswordEntriesBySpace("default");
    const workEntries = await listPasswordEntriesBySpace("work");

    expect(defaultEntries).toHaveLength(1);
    expect(workEntries).toHaveLength(1);
    expect(defaultEntries[0].encrypted_password).toBe("sealed-default");
    expect(workEntries[0].encrypted_password).toBe("sealed-work");
  });

  it("可以按空间保存、更新和删除空密码组", async () => {
    const group = await createPasswordGroup({
      spaceId: "default",
      name: "代码托管",
      description: "隐私元数据",
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
        forbiddenChars: "O0"
      }
    });
    await createPasswordGroup({
      spaceId: "work",
      name: "工作系统",
      outputPolicy: group.outputPolicy
    });

    expect(await listPasswordGroupsBySpace("default")).toHaveLength(1);
    expect(await listPasswordGroupsBySpace("work")).toHaveLength(1);

    await updatePasswordGroup(group.id, {
      name: "代码平台",
      outputPolicy: {
        ...group.outputPolicy,
        length: 24
      }
    });
    expect((await listPasswordGroupsBySpace("default"))[0]).toMatchObject({
      name: "代码平台",
      outputPolicy: expect.objectContaining({ length: 24 })
    });

    await deletePasswordGroup(group.id);
    expect(await listPasswordGroupsBySpace("default")).toHaveLength(0);
  });

  it("非空密码组不能删除", async () => {
    const group = await createPasswordGroup({
      spaceId: "default",
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
      spaceId: "default",
      encrypted_password: "sealed",
      groupId: group.id
    });

    await expect(deletePasswordGroup(group.id)).rejects.toThrow("仍有关联条目");
  });

  it("数据库版本已存在但缺密码组仓库时会自动补齐 schema", async () => {
    await closeDatabaseConnection();
    await deleteCurrentDatabase();
    await createIncompleteCurrentVersionDatabase();

    await expect(listPasswordGroupsBySpace("default")).resolves.toEqual([]);
    const request = indexedDB.open(DB_NAME);
    const db = await requestToDb(request);

    expect(db.version).toBeGreaterThan(DB_VERSION);
    expect(db.objectStoreNames.contains("password_groups")).toBe(true);
    db.close();
  });

  it("可以更新加密记忆提示，废弃后仍允许更新描述和提示但不允许改平台", async () => {
    const entry = await createPasswordEntry({
      spaceId: "default",
      encrypted_password: "sealed",
      encrypted_memory_hint: "sealed-hint",
      platform: "Example",
      description: "old"
    });

    await updatePasswordEntry(entry.id, {
      encrypted_memory_hint: "new-sealed-hint"
    });
    await updatePasswordEntry(entry.id, {
      deprecatedAt: Date.now()
    });
    await updatePasswordEntry(entry.id, {
      platform: "Changed",
      description: "new",
      encrypted_memory_hint: undefined
    });

    const [updated] = await listPasswordEntriesBySpace("default");
    expect(updated.platform).toBe("Example");
    expect(updated.description).toBe("new");
    expect(updated.encrypted_memory_hint).toBeUndefined();
  });
});

async function deleteCurrentDatabase() {
  const request = indexedDB.deleteDatabase(DB_NAME);
  await new Promise<void>((resolve, reject) => {
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("测试数据库删除被阻止。"));
  });
}

async function createIncompleteCurrentVersionDatabase() {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    db.createObjectStore("password_entries", { keyPath: "id" });
    db.createObjectStore("space_profiles", { keyPath: "spaceId" });
    db.createObjectStore("spaces", { keyPath: "spaceId" });
    db.createObjectStore("space_relations", { keyPath: "id" });
    db.createObjectStore("migration_batches", { keyPath: "id" });
    db.createObjectStore("migration_entries", { keyPath: "id" });
  };
  const db = await requestToDb(request);
  db.close();
}

function requestToDb(request: IDBOpenDBRequest): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("测试数据库打开被阻止。"));
  });
}
