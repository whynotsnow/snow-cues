import { beforeEach, describe, expect, it } from "vitest";
import {
  createPasswordEntry,
  createPasswordGroup,
  listMigrationEntriesByBatch,
  listPasswordGroupsBySpace,
  resetLocalData,
  saveSpace
} from "../storage-engine/storage-engine";
import {
  exportSpacePackage,
  importSpacePackage,
  stringifySpaceExportPackage
} from "./transfer";

describe("Space import/export", () => {
  beforeEach(async () => {
    await resetLocalData();
  });

  it("导出和导入会保留密码组配置，并让迁移条目关联目标组", async () => {
    await saveSpace({ spaceId: "source", status: "active" });
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
      encrypted_password: "sealed",
      groupId: group.id,
      platform: "Example"
    });

    const exported = await exportSpacePackage({
      spaceId: "source",
      includeEntries: true
    });
    expect(exported.groups).toMatchObject([{ name: "代码托管" }]);

    const batch = await importSpacePackage({
      targetSpaceId: "target",
      packageText: stringifySpaceExportPackage(exported),
      importProfile: true,
      importEntries: true
    });
    const targetGroups = await listPasswordGroupsBySpace("target");
    const migrationEntries = await listMigrationEntriesByBatch(batch?.id ?? "");

    expect(targetGroups).toMatchObject([{ name: "代码托管" }]);
    expect(migrationEntries).toMatchObject([{ groupId: targetGroups[0].id }]);
  });
});
