import {
  diffStorageDataContent,
  hasStorageDataChanges
} from "./storage-data-diff";
import {
  buildNextStorageDataFile,
  buildStorageDataDraftFile,
  createInitialStorageDataFile,
  parseStorageDataFileText,
  serializeStorageDataDraftFile,
  serializeStorageDataFile
} from "./storage-data-format";
import {
  createStorageDataRepository,
  type StorageDataRepository
} from "./storage-data-repository";
import {
  createConflictFileName,
  DEFAULT_REVISION_RETENTION,
  createRevisionFileName
} from "./storage-data-file-names";
import type {
  StorageDataDraftFile,
  StorageDataDraftReason,
  StorageDataFile,
  StorageDataOpenMode,
  StorageDataSaveSummary
} from "./storage-data-types";

export const EXTERNAL_CHANGE_MESSAGE =
  "当前存储数据已在页面打开后发生变化。为避免覆盖其他设备的修改，本次保存已停止。请确认 Syncthing 已同步完成后重新打开存储数据文件夹。";
export type FileSystemAccessMode = "direct-folder" | "download-only";

export type StorageDataWorkspace = {
  mode: StorageDataOpenMode;
  file: StorageDataFile;
  repository: StorageDataRepository;
  openedRevision: number;
  openedHash: string;
  directoryHandle?: FileSystemDirectoryHandle;
};

export type StorageDataSaveResult =
  | {
      mode: "direct-folder";
      file: StorageDataFile;
      revisionFileName: string;
      summary: StorageDataSaveSummary;
      cleanupWarning?: string;
    }
  | {
      mode: "download";
      file: StorageDataFile;
      fileName: string;
      content: string;
      summary: StorageDataSaveSummary;
      openedRevision: number;
      openedHash: string;
    };

export type StorageDataDraftExport = {
  fileName: string;
  content: string;
  draft: StorageDataDraftFile;
};

export class StorageDataSaveError extends Error {
  constructor(
    message: string,
    readonly code:
      | "empty-save"
      | "external-change"
      | "write-failed"
      | "unsupported",
    readonly details: { conflictFileName?: string } = {}
  ) {
    super(message);
  }
}

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
    showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle[]>;
  }

  interface FileSystemDirectoryHandle {
    getDirectoryHandle(
      name: string,
      options?: { create?: boolean }
    ): Promise<FileSystemDirectoryHandle>;
    getFileHandle(
      name: string,
      options?: { create?: boolean }
    ): Promise<FileSystemFileHandle>;
    entries?: () => AsyncIterableIterator<[string, unknown]>;
  }

  interface FileSystemFileHandle {
    getFile(): Promise<File>;
    createWritable(): Promise<FileSystemWritableFileStream>;
  }

  interface FileSystemWritableFileStream {
    write(data: string): Promise<void>;
    close(): Promise<void>;
  }
}

export function detectStorageDataAccessMode(): FileSystemAccessMode {
  return typeof window !== "undefined" &&
    typeof window.showDirectoryPicker === "function"
    ? "direct-folder"
    : "download-only";
}

export async function createStorageDataWorkspaceFromFile(
  file: StorageDataFile
): Promise<StorageDataWorkspace> {
  return {
    mode: "download",
    file,
    repository: createStorageDataRepository(file.data),
    openedRevision: file.revision,
    openedHash: file.contentHash
  };
}

export async function openStorageDataText(
  text: string
): Promise<StorageDataWorkspace> {
  return createStorageDataWorkspaceFromFile(
    await parseStorageDataFileText(text)
  );
}

export async function openStorageDataFolder(
  directoryHandle: FileSystemDirectoryHandle
): Promise<StorageDataWorkspace> {
  const currentHandle = await directoryHandle.getFileHandle("current.json");
  const file = await parseStorageDataFileText(
    await (await currentHandle.getFile()).text()
  );
  await ensureStorageDataDirectories(directoryHandle);
  return {
    mode: "direct-folder",
    file,
    repository: createStorageDataRepository(file.data),
    openedRevision: file.revision,
    openedHash: file.contentHash,
    directoryHandle
  };
}

export async function createStorageDataFolder(
  directoryHandle: FileSystemDirectoryHandle
): Promise<StorageDataWorkspace> {
  await ensureStorageDataDirectories(directoryHandle);
  const file = await createInitialStorageDataFile();
  await writeFile(
    await directoryHandle.getFileHandle("current.json", { create: true }),
    serializeStorageDataFile(file)
  );
  const revisions = await directoryHandle.getDirectoryHandle("revisions", {
    create: true
  });
  await writeFile(
    await revisions.getFileHandle(createRevisionFileName(file.revision), {
      create: true
    }),
    serializeStorageDataFile(file)
  );
  return openStorageDataFolder(directoryHandle);
}

export async function saveStorageDataWorkspace(
  workspace: StorageDataWorkspace
): Promise<StorageDataSaveResult> {
  const summary = diffStorageDataContent(
    workspace.file.data,
    workspace.repository.snapshot()
  );
  if (!hasStorageDataChanges(summary)) {
    throw new StorageDataSaveError("没有可保存的存储数据改动。", "empty-save");
  }
  const openedRevision = workspace.openedRevision;
  const openedHash = workspace.openedHash;
  const nextFile = await buildNextStorageDataFile(
    workspace.file,
    workspace.repository.snapshot()
  );
  if (workspace.mode === "direct-folder") {
    if (!workspace.directoryHandle) {
      throw new StorageDataSaveError(
        "当前浏览器未授权写入存储数据文件夹。",
        "unsupported"
      );
    }
    await assertNoExternalChange(workspace, nextFile);
    const revisions = await workspace.directoryHandle.getDirectoryHandle(
      "revisions",
      { create: true }
    );
    const revisionFileName = createRevisionFileName(nextFile.revision);
    await writeFile(
      await revisions.getFileHandle(revisionFileName, { create: true }),
      serializeStorageDataFile(nextFile)
    );
    await writeFile(
      await workspace.directoryHandle.getFileHandle("current.json", {
        create: true
      }),
      serializeStorageDataFile(nextFile)
    );
    const cleanupWarning = await cleanupOldRevisions(revisions);
    markWorkspaceSaved(workspace, nextFile);
    return {
      mode: "direct-folder",
      file: nextFile,
      revisionFileName,
      summary,
      cleanupWarning
    };
  }

  markWorkspaceSaved(workspace, nextFile);
  return {
    mode: "download",
    file: nextFile,
    fileName: "current.json",
    content: serializeStorageDataFile(nextFile),
    summary,
    openedRevision,
    openedHash
  };
}

export async function exportStorageDataDraft(
  workspace: StorageDataWorkspace,
  reason: StorageDataDraftReason
): Promise<StorageDataDraftExport> {
  const draft = buildStorageDataDraftFile(
    workspace.file,
    workspace.repository.snapshot(),
    reason
  );
  const fileName = createDraftFileName(draft.createdAt);
  const content = serializeStorageDataDraftFile(draft);
  if (workspace.mode === "direct-folder" && workspace.directoryHandle) {
    const drafts = await workspace.directoryHandle.getDirectoryHandle(
      "drafts",
      { create: true }
    );
    await writeFile(
      await drafts.getFileHandle(fileName, { create: true }),
      content
    );
  }
  return { fileName, content, draft };
}

async function assertNoExternalChange(
  workspace: StorageDataWorkspace,
  nextFile: StorageDataFile
) {
  if (!workspace.directoryHandle) {
    return;
  }
  const currentHandle =
    await workspace.directoryHandle.getFileHandle("current.json");
  const current = await parseStorageDataFileText(
    await (await currentHandle.getFile()).text()
  );
  if (
    current.revision !== workspace.openedRevision ||
    current.contentHash !== workspace.openedHash
  ) {
    const conflicts = await workspace.directoryHandle.getDirectoryHandle(
      "conflicts",
      { create: true }
    );
    const conflictFileName = createConflictFileName({
      openedRevision: workspace.openedRevision,
      currentRevision: current.revision,
      nextRevision: nextFile.revision,
      createdAt: new Date().toISOString()
    });
    await writeFile(
      await conflicts.getFileHandle(conflictFileName, { create: true }),
      serializeStorageDataFile(nextFile)
    );
    throw new StorageDataSaveError(EXTERNAL_CHANGE_MESSAGE, "external-change", {
      conflictFileName
    });
  }
}

async function ensureStorageDataDirectories(
  directoryHandle: FileSystemDirectoryHandle
) {
  await directoryHandle.getDirectoryHandle("revisions", { create: true });
  await directoryHandle.getDirectoryHandle("drafts", { create: true });
  await directoryHandle.getDirectoryHandle("conflicts", { create: true });
}

async function cleanupOldRevisions(
  revisions: FileSystemDirectoryHandle,
  retention = DEFAULT_REVISION_RETENTION
): Promise<string | undefined> {
  try {
    if (!revisions.entries || !revisions.removeEntry) {
      return undefined;
    }
    const revisionFiles: string[] = [];
    for await (const [name] of revisions.entries()) {
      if (/^storage-data-rev-\d{6}\.json$/.test(name)) {
        revisionFiles.push(name);
      }
    }
    revisionFiles.sort().reverse();
    for (const name of revisionFiles.slice(retention)) {
      await revisions.removeEntry(name);
    }
    return undefined;
  } catch (error) {
    return error instanceof Error
      ? `历史版本清理失败：${error.message}`
      : "历史版本清理失败。";
  }
}

async function writeFile(fileHandle: FileSystemFileHandle, content: string) {
  try {
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  } catch (error) {
    throw new StorageDataSaveError(
      error instanceof Error ? error.message : "存储数据文件写入失败。",
      "write-failed"
    );
  }
}

function markWorkspaceSaved(
  workspace: StorageDataWorkspace,
  file: StorageDataFile
) {
  workspace.file = file;
  workspace.openedRevision = file.revision;
  workspace.openedHash = file.contentHash;
  workspace.repository.markClean(file.data);
}

export function createDraftFileName(isoString: string): string {
  return `storage-data-draft-${isoString
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[-:]/g, "")
    .replace("T", "T")}.json`;
}
