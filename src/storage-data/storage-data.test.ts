import { describe, expect, it } from "vitest";
import { DEFAULT_PASSWORD_OUTPUT_POLICY } from "../crypto-engine/output-policy";
import {
  EXTERNAL_CHANGE_MESSAGE,
  buildNextStorageDataFile,
  canonicalizeJson,
  createInitialStorageDataFile,
  createStorageDataFolder,
  createStorageDataRepository,
  diffStorageDataContent,
  hasStorageDataChanges,
  parseStorageDataDraftFileText,
  parseStorageDataFileText,
  saveStorageDataWorkspace,
  serializeStorageDataDraftFile,
  serializeStorageDataFile,
  verifyStorageDataHash
} from "./index";
import type { StorageDataContent } from "./storage-data-types";

describe("storage-data core", () => {
  it("canonicalizes object keys while preserving array order", () => {
    expect(canonicalizeJson({ b: 1, a: [{ d: 2, c: 1 }] })).toBe('{"a":[{"c":1,"d":2}],"b":1}');
  });

  it("creates and verifies content hashes", async () => {
    const file = await createInitialStorageDataFile("storage_data_test");
    expect(file.contentHash).toMatch(/^sha256:/);
    await expect(verifyStorageDataHash(file)).resolves.toBe(true);
    const changed = await buildNextStorageDataFile(file, {
      ...file.data,
      spaces: [{
        spaceId: "alpha",
        status: "active",
        createdAt: 1,
        updatedAt: 1
      }]
    });
    expect(changed.contentHash).not.toBe(file.contentHash);
  });

  it("rejects drafts and invalid hashes in the main open flow", async () => {
    const file = await createInitialStorageDataFile("storage_data_test");
    const draftText = serializeStorageDataDraftFile({
      format: "snow-cues-storage-data-draft",
      schemaVersion: 1,
      storageDataId: file.storageDataId,
      baseRevision: file.revision,
      baseHash: file.contentHash,
      createdAt: new Date().toISOString(),
      reason: "manual-export",
      draftContent: file.data
    });
    await expect(parseStorageDataFileText(draftText)).rejects.toThrow("草稿文件不能作为当前存储数据打开");
    expect(parseStorageDataDraftFileText(draftText).format).toBe("snow-cues-storage-data-draft");
    await expect(parseStorageDataFileText(serializeStorageDataFile({ ...file, contentHash: "sha256:bad" }))).rejects.toThrow(
      "完整性校验失败"
    );
  });

  it("strips forbidden password derivation fields", async () => {
    const file = await createInitialStorageDataFile("storage_data_test");
    const next = await buildNextStorageDataFile(file, {
      ...file.data,
      passwordEntries: [{
        id: "entry",
        spaceId: "default",
        encrypted_password: "ciphertext",
        createdAt: 1,
        updatedAt: 1,
        entrySecret: "secret",
        ruleId: "v1-hmac",
        memory_hint: "plain hint"
      } as never]
    });
    const text = serializeStorageDataFile(next);
    expect(text).not.toContain("entrySecret");
    expect(text).not.toContain("ruleId");
    expect(text).not.toContain("plain hint");
    expect(text).toContain("encrypted_password");
  });

  it("keeps repository mutations in memory and reports safe summary diff", async () => {
    const repository = createStorageDataRepository();
    await repository.createPasswordGroup({
      id: "group",
      spaceId: "default",
      name: "隐私组名",
      outputPolicy: DEFAULT_PASSWORD_OUTPUT_POLICY
    });
    await repository.createPasswordEntry({
      id: "entry",
      spaceId: "default",
      encrypted_password: "ciphertext",
      encrypted_memory_hint: "hint-ciphertext",
      groupId: "group",
      platform: "Private Platform"
    });
    const summary = diffStorageDataContent(repository.baseSnapshot(), repository.snapshot());
    expect(hasStorageDataChanges(summary)).toBe(true);
    expect(summary.addedPasswordEntries).toBe(1);
    expect(summary.addedPasswordGroups).toBe(1);
    expect(JSON.stringify(summary)).not.toContain("ciphertext");
    expect(JSON.stringify(summary)).not.toContain("Private Platform");
  });
});

describe("storage-data folder access", () => {
  it("creates folder structure and saves revision before current", async () => {
    const root = createMockDirectoryHandle();
    const workspace = await createStorageDataFolder(root);
    await workspace.repository.saveSpace({ spaceId: "alpha" });
    const result = await saveStorageDataWorkspace(workspace);
    expect(result.mode).toBe("direct-folder");
    expect(root.writeLog).toEqual([
      "current.json",
      "revisions/storage-data-rev-000001.json",
      "revisions/storage-data-rev-000002.json",
      "current.json"
    ]);
  });

  it("refuses empty saves and external changes", async () => {
    const root = createMockDirectoryHandle();
    const workspace = await createStorageDataFolder(root);
    await expect(saveStorageDataWorkspace(workspace)).rejects.toThrow("没有可保存");
    await workspace.repository.saveSpace({ spaceId: "alpha" });
    const external = await buildNextStorageDataFile(workspace.file, {
      ...workspace.file.data,
      spaces: [{ spaceId: "other", status: "active", createdAt: 1, updatedAt: 1 }]
    });
    root.setFile("current.json", serializeStorageDataFile(external));
    await expect(saveStorageDataWorkspace(workspace)).rejects.toThrow(EXTERNAL_CHANGE_MESSAGE);
  });
});

type MockFileHandle = FileSystemFileHandle & {
  content: string;
  path: string;
};

type MockDirectoryHandle = FileSystemDirectoryHandle & {
  writeLog: string[];
  setFile(path: string, content: string): void;
};

function createMockDirectoryHandle(name = "", root?: { files: Map<string, string>; writeLog: string[] }): MockDirectoryHandle {
  const state = root ?? { files: new Map<string, string>(), writeLog: [] };
  return {
    writeLog: state.writeLog,
    setFile(path: string, content: string) {
      state.files.set(path, content);
    },
    async getDirectoryHandle(childName: string) {
      return createMockDirectoryHandle(pathJoin(name, childName), state);
    },
    async getFileHandle(fileName: string, options?: { create?: boolean }) {
      const path = pathJoin(name, fileName);
      if (!state.files.has(path)) {
        if (!options?.create) {
          throw new Error(`missing ${path}`);
        }
        state.files.set(path, "");
      }
      return {
        path,
        content: state.files.get(path) ?? "",
        async getFile() {
          return {
            async text() {
              return state.files.get(path) ?? "";
            }
          } as File;
        },
        async createWritable() {
          return {
            async write(data: string) {
              state.files.set(path, data);
              state.writeLog.push(path);
            },
            async close() {
              return undefined;
            }
          };
        }
      } as MockFileHandle;
    }
  } as unknown as MockDirectoryHandle;
}

function pathJoin(parent: string, child: string): string {
  return parent ? `${parent}/${child}` : child;
}
