import { describe, expect, it } from "vitest";
import { base64ToBytes, bytesToUtf8 } from "../lib/bytes";
import { DEFAULT_PASSWORD_OUTPUT_POLICY } from "../crypto-engine/output-policy";
import {
  EXTERNAL_CHANGE_MESSAGE,
  buildStorageDataSavePackage,
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
  shortHash,
  StorageDataSaveError,
  verifyStorageDataHash
} from "./index";

describe("storage-data core", () => {
  it("canonicalizes object keys while preserving array order", () => {
    expect(canonicalizeJson({ b: 1, a: [{ d: 2, c: 1 }] })).toBe(
      '{"a":[{"c":1,"d":2}],"b":1}'
    );
  });

  it("creates and verifies content hashes", async () => {
    const file = await createInitialStorageDataFile("storage_data_test");
    expect(file.contentHash).toMatch(/^sha256:/);
    await expect(verifyStorageDataHash(file)).resolves.toBe(true);
    const changed = await buildNextStorageDataFile(file, {
      ...file.data,
      spaces: [
        {
          spaceId: "alpha",
          status: "active",
          createdAt: 1,
          updatedAt: 1
        }
      ]
    });
    expect(changed.contentHash).not.toBe(file.contentHash);
  });

  it("creates ids when crypto.randomUUID is unavailable", async () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      value: {
        getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
        subtle: originalCrypto.subtle
      } as Crypto,
      configurable: true
    });

    try {
      const file = await createInitialStorageDataFile();
      expect(file.storageDataId).toMatch(
        /^storage_data_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );

      const repository = createStorageDataRepository();
      const entry = await repository.createPasswordEntry({
        spaceId: "default",
        encrypted_password: "ciphertext"
      });
      expect(entry.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        value: originalCrypto,
        configurable: true
      });
    }
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
    await expect(parseStorageDataFileText(draftText)).rejects.toThrow(
      "草稿文件不能作为当前存储数据打开"
    );
    expect(parseStorageDataDraftFileText(draftText).format).toBe(
      "snow-cues-storage-data-draft"
    );
    await expect(
      parseStorageDataFileText(
        serializeStorageDataFile({ ...file, contentHash: "sha256:bad" })
      )
    ).rejects.toThrow("完整性校验失败");
  });

  it("strips forbidden password derivation fields", async () => {
    const file = await createInitialStorageDataFile("storage_data_test");
    const next = await buildNextStorageDataFile(file, {
      ...file.data,
      passwordEntries: [
        {
          id: "entry",
          spaceId: "default",
          encrypted_password: "ciphertext",
          createdAt: 1,
          updatedAt: 1,
          entrySecret: "secret",
          ruleId: "v1-hmac",
          memory_hint: "plain hint"
        } as never
      ]
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
    const summary = diffStorageDataContent(
      repository.baseSnapshot(),
      repository.snapshot()
    );
    expect(hasStorageDataChanges(summary)).toBe(true);
    expect(summary.addedPasswordEntries).toBe(1);
    expect(summary.addedPasswordGroups).toBe(1);
    expect(JSON.stringify(summary)).not.toContain("ciphertext");
    expect(JSON.stringify(summary)).not.toContain("Private Platform");
  });

  it("derives the local space index from imported business data without explicit space records", async () => {
    const repository = createStorageDataRepository({
      spaces: [],
      spaceProfiles: [
        {
          spaceId: "Vault",
          ruleChain: ["v1-hmac"],
          importedRuleManifests: [],
          createdAt: 10,
          updatedAt: 20
        }
      ],
      passwordEntries: [
        {
          id: "entry",
          spaceId: "Vault",
          encrypted_password: "ciphertext",
          createdAt: 30,
          updatedAt: 40
        }
      ],
      passwordGroups: [],
      spaceRelations: [],
      migrationBatches: [],
      migrationEntries: []
    });

    await expect(repository.listSpaces()).resolves.toMatchObject([
      {
        spaceId: "vault",
        status: "active",
        createdAt: 10,
        updatedAt: 40
      }
    ]);
    await expect(repository.getSpace(" vault ")).resolves.toMatchObject({
      spaceId: "vault",
      status: "active"
    });
    await expect(
      repository.listPasswordEntriesBySpace("vault")
    ).resolves.toHaveLength(1);
    expect(repository.isDirty()).toBe(false);
  });

  it("uses the latest space-scoped business timestamp in the local space index", async () => {
    const repository = createStorageDataRepository({
      spaces: [
        {
          spaceId: "vault",
          status: "active",
          createdAt: 1,
          updatedAt: 2
        }
      ],
      spaceProfiles: [],
      passwordEntries: [
        {
          id: "entry",
          spaceId: "vault",
          encrypted_password: "ciphertext",
          createdAt: 3,
          updatedAt: 50
        }
      ],
      passwordGroups: [],
      spaceRelations: [],
      migrationBatches: [],
      migrationEntries: []
    });

    await expect(repository.listSpaces()).resolves.toMatchObject([
      {
        spaceId: "vault",
        status: "active",
        createdAt: 1,
        updatedAt: 50
      }
    ]);
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

  it("keeps only the latest 50 revision files after direct folder saves", async () => {
    const root = createMockDirectoryHandle();
    const workspace = await createStorageDataFolder(root);
    for (let index = 0; index < 55; index += 1) {
      await workspace.repository.saveSpace({ spaceId: `space-${index}` });
      await saveStorageDataWorkspace(workspace);
    }

    const revisionFiles = root
      .listFiles("revisions")
      .filter((path) => /storage-data-rev-\d{6}\.json$/.test(path))
      .sort();
    expect(revisionFiles).toHaveLength(50);
    expect(revisionFiles[0]).toBe("revisions/storage-data-rev-000007.json");
    expect(revisionFiles.at(-1)).toBe("revisions/storage-data-rev-000056.json");
  });

  it("refuses empty saves and external changes", async () => {
    const root = createMockDirectoryHandle();
    const workspace = await createStorageDataFolder(root);
    await expect(saveStorageDataWorkspace(workspace)).rejects.toThrow(
      "没有可保存"
    );
    await workspace.repository.saveSpace({ spaceId: "alpha" });
    const external = await buildNextStorageDataFile(workspace.file, {
      ...workspace.file.data,
      spaces: [
        { spaceId: "other", status: "active", createdAt: 1, updatedAt: 1 }
      ]
    });
    root.setFile("current.json", serializeStorageDataFile(external));
    await expect(saveStorageDataWorkspace(workspace)).rejects.toThrow(
      EXTERNAL_CHANGE_MESSAGE
    );
    const conflictPath = root.writeLog.find((path) =>
      path.startsWith(
        "conflicts/storage-data-conflict-o000001-c000002-n000002-"
      )
    );
    expect(conflictPath).toBeTruthy();
    expect(root.writeLog).not.toContain(
      "revisions/storage-data-rev-000002.json"
    );
    expect(
      root.writeLog.filter((path) => path === "current.json")
    ).toHaveLength(1);
    await expect(
      parseStorageDataFileText(root.getFile(conflictPath!))
    ).resolves.toMatchObject({
      revision: 2,
      data: {
        spaces: [
          {
            spaceId: "alpha"
          }
        ]
      }
    });
  });

  it("exposes conflict file name on external-change save errors", async () => {
    const root = createMockDirectoryHandle();
    const workspace = await createStorageDataFolder(root);
    await workspace.repository.saveSpace({ spaceId: "alpha" });
    const external = await buildNextStorageDataFile(workspace.file, {
      ...workspace.file.data,
      spaces: [
        { spaceId: "other", status: "active", createdAt: 1, updatedAt: 1 }
      ]
    });
    root.setFile("current.json", serializeStorageDataFile(external));

    try {
      await saveStorageDataWorkspace(workspace);
      throw new Error("expected save to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(StorageDataSaveError);
      expect((error as StorageDataSaveError).details.conflictFileName).toMatch(
        /^storage-data-conflict-o000001-c000002-n000002-\d{8}T\d{6}Z\.json$/
      );
    }
  });

  it("builds desktop save packages with manifest, data files, and scripts", async () => {
    const file = await createInitialStorageDataFile("storage_data_test");
    const next = await buildNextStorageDataFile(file, {
      ...file.data,
      spaces: [
        { spaceId: "alpha", status: "active", createdAt: 1, updatedAt: 1 }
      ]
    });
    const savePackage = await buildStorageDataSavePackage({
      file: next,
      openedRevision: file.revision,
      openedHash: file.contentHash,
      mobileLike: false,
      generatedAt: new Date("2026-06-23T10:00:00.000Z")
    });
    const entries = unzipStoredDataUrl(savePackage.downloadUrl);
    const manifest = JSON.parse(entries.get("manifest.json") ?? "{}");
    const expectedCandidateFileName = `storage-data-current-o000001-h${shortHash(
      file.contentHash
    )}-n000002.json`;

    expect(savePackage.fileName).toBe(
      "snow-cues-save-package-rev-000002-20260623T100000Z.zip"
    );
    expect(savePackage.desktopScriptsIncluded).toBe(true);
    expect(entries.has("apply-save.command")).toBe(true);
    expect(entries.has("apply-save.sh")).toBe(true);
    expect(entries.has("apply-save.ps1")).toBe(true);
    expect(entries.has("storageData-path.txt")).toBe(true);
    expect(entries.has("README.txt")).toBe(true);
    expect(entries.has(expectedCandidateFileName)).toBe(true);
    expect(entries.has("revisions/storage-data-rev-000002.json")).toBe(true);
    expect(manifest).toMatchObject({
      storageDataId: "storage_data_test",
      openedRevision: 1,
      openedHash: file.contentHash,
      nextRevision: 2,
      nextHash: next.contentHash,
      revisionRetention: 50,
      candidateFileName: expectedCandidateFileName,
      revisionFileName: "storage-data-rev-000002.json"
    });
    expect(manifest.conflictFileName).toMatch(
      new RegExp(
        `^storage-data-conflict-o000001-h${shortHash(
          file.contentHash
        )}-n000002-20260623T100000Z\\.json$`
      )
    );
    expect(entries.get("apply-save.sh")).toContain("storageData-path.txt");
    expect(entries.get("apply-save.sh")).toContain("contentHash");
    expect(entries.get("apply-save.sh")).not.toMatch(/\bcurl\b|\bwget\b/);
  });

  it("builds mobile save packages without executable scripts", async () => {
    const file = await createInitialStorageDataFile("storage_data_test");
    const savePackage = await buildStorageDataSavePackage({
      file,
      openedRevision: 0,
      openedHash: "",
      mobileLike: true,
      generatedAt: new Date("2026-06-23T10:00:00.000Z")
    });
    const entries = unzipStoredDataUrl(savePackage.downloadUrl);

    expect(savePackage.desktopScriptsIncluded).toBe(false);
    expect(entries.has("apply-save.command")).toBe(false);
    expect(entries.has("apply-save.sh")).toBe(false);
    expect(entries.has("apply-save.ps1")).toBe(false);
    expect(entries.get("README.txt")).toContain("不包含可执行脚本");
    expect(
      entries.has("storage-data-current-o000000-h00000000-n000001.json")
    ).toBe(true);
  });
});

type MockFileHandle = FileSystemFileHandle & {
  content: string;
  path: string;
};

type MockDirectoryHandle = FileSystemDirectoryHandle & {
  writeLog: string[];
  setFile(path: string, content: string): void;
  getFile(path: string): string;
  listFiles(path?: string): string[];
};

function createMockDirectoryHandle(
  name = "",
  root?: { files: Map<string, string>; writeLog: string[] }
): MockDirectoryHandle {
  const state = root ?? { files: new Map<string, string>(), writeLog: [] };
  return {
    writeLog: state.writeLog,
    setFile(path: string, content: string) {
      state.files.set(path, content);
    },
    getFile(path: string) {
      return state.files.get(path) ?? "";
    },
    listFiles(path = "") {
      const prefix = path ? `${path}/` : "";
      return Array.from(state.files.keys()).filter((filePath) =>
        filePath.startsWith(prefix)
      );
    },
    async getDirectoryHandle(
      childName: string,
      options?: { create?: boolean }
    ) {
      const path = pathJoin(name, childName);
      if (options?.create) {
        state.files.set(
          pathJoin(path, ".keep"),
          state.files.get(pathJoin(path, ".keep")) ?? ""
        );
      }
      return createMockDirectoryHandle(path, state);
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
    },
    async *entries() {
      const prefix = name ? `${name}/` : "";
      const childNames = new Set<string>();
      for (const filePath of state.files.keys()) {
        if (!filePath.startsWith(prefix)) {
          continue;
        }
        const childName = filePath.slice(prefix.length).split("/")[0];
        if (childName && childName !== ".keep") {
          childNames.add(childName);
        }
      }
      for (const childName of childNames) {
        yield [childName, {}] as [string, unknown];
      }
    },
    async removeEntry(fileName: string) {
      state.files.delete(pathJoin(name, fileName));
    }
  } as unknown as MockDirectoryHandle;
}

function pathJoin(parent: string, child: string): string {
  return parent ? `${parent}/${child}` : child;
}

function unzipStoredDataUrl(downloadUrl: string): Map<string, string> {
  const [, base64] = downloadUrl.split(",");
  const bytes = base64ToBytes(base64);
  const entries = new Map<string, string>();
  let offset = 0;
  while (readUint32(bytes, offset) === 0x04034b50) {
    const compressedSize = readUint32(bytes, offset + 18);
    const fileNameLength = readUint16(bytes, offset + 26);
    const extraLength = readUint16(bytes, offset + 28);
    const nameStart = offset + 30;
    const contentStart = nameStart + fileNameLength + extraLength;
    const name = bytesToUtf8(
      bytes.slice(nameStart, nameStart + fileNameLength)
    );
    const content = bytesToUtf8(
      bytes.slice(contentStart, contentStart + compressedSize)
    );
    entries.set(name, content);
    offset = contentStart + compressedSize;
  }
  return entries;
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(
    0,
    true
  );
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(
    0,
    true
  );
}
