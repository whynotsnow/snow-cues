import {
  sanitizeStorageDataContent,
  stripForbiddenKeys
} from "./storage-data-security";
import {
  STORAGE_DATA_DRAFT_FORMAT,
  STORAGE_DATA_FORMAT,
  STORAGE_DATA_SCHEMA_VERSION,
  type StorageDataContent,
  type StorageDataDraftFile,
  type StorageDataDraftReason,
  type StorageDataFile,
  createEmptyStorageDataContent
} from "./storage-data-types";
import {
  canonicalizeJson,
  verifyStorageDataHash,
  withStorageDataHash
} from "./storage-data-hash";
import { createStorageDataId } from "../lib/random-id";

export class StorageDataFormatError extends Error {}

export async function createInitialStorageDataFile(
  storageDataId = createStorageDataId()
): Promise<StorageDataFile> {
  return withStorageDataHash({
    format: STORAGE_DATA_FORMAT,
    schemaVersion: STORAGE_DATA_SCHEMA_VERSION,
    storageDataId,
    revision: 1,
    updatedAt: new Date().toISOString(),
    data: createEmptyStorageDataContent()
  });
}

export async function parseStorageDataFileText(
  text: string
): Promise<StorageDataFile> {
  const parsed = parseJsonObject(text);
  if (parsed.format === STORAGE_DATA_DRAFT_FORMAT) {
    throw new StorageDataFormatError("草稿文件不能作为当前存储数据打开。");
  }
  if (parsed.format !== STORAGE_DATA_FORMAT) {
    throw new StorageDataFormatError("不是 Snow Cues 2.3 存储数据文件。");
  }
  if (parsed.schemaVersion !== STORAGE_DATA_SCHEMA_VERSION) {
    throw new StorageDataFormatError("存储数据文件版本不受支持。");
  }
  assertString(parsed.storageDataId, "storageDataId");
  assertNumber(parsed.revision, "revision");
  assertString(parsed.updatedAt, "updatedAt");
  assertString(parsed.contentHash, "contentHash");
  if (
    !parsed.data ||
    typeof parsed.data !== "object" ||
    Array.isArray(parsed.data)
  ) {
    throw new StorageDataFormatError("存储数据内容无效。");
  }
  assertDataArrays(parsed.data as Record<string, unknown>);
  const file: StorageDataFile = {
    format: STORAGE_DATA_FORMAT,
    schemaVersion: STORAGE_DATA_SCHEMA_VERSION,
    storageDataId: parsed.storageDataId,
    revision: parsed.revision,
    updatedAt: parsed.updatedAt,
    contentHash: parsed.contentHash,
    data: sanitizeStorageDataContent(parsed.data as Partial<StorageDataContent>)
  };
  if (!(await verifyStorageDataHash(file))) {
    throw new StorageDataFormatError("存储数据文件完整性校验失败。");
  }
  return file;
}

export function parseStorageDataDraftFileText(
  text: string
): StorageDataDraftFile {
  const parsed = parseJsonObject(text);
  if (parsed.format !== STORAGE_DATA_DRAFT_FORMAT) {
    throw new StorageDataFormatError("不是 Snow Cues 存储数据草稿文件。");
  }
  if (parsed.schemaVersion !== STORAGE_DATA_SCHEMA_VERSION) {
    throw new StorageDataFormatError("存储数据草稿版本不受支持。");
  }
  assertString(parsed.storageDataId, "storageDataId");
  assertNumber(parsed.baseRevision, "baseRevision");
  assertString(parsed.baseHash, "baseHash");
  assertString(parsed.createdAt, "createdAt");
  if (!isDraftReason(parsed.reason)) {
    throw new StorageDataFormatError("存储数据草稿原因无效。");
  }
  if (
    !parsed.draftContent ||
    typeof parsed.draftContent !== "object" ||
    Array.isArray(parsed.draftContent)
  ) {
    throw new StorageDataFormatError("存储数据草稿内容无效。");
  }
  return {
    format: STORAGE_DATA_DRAFT_FORMAT,
    schemaVersion: STORAGE_DATA_SCHEMA_VERSION,
    storageDataId: parsed.storageDataId,
    baseRevision: parsed.baseRevision,
    baseHash: parsed.baseHash,
    createdAt: parsed.createdAt,
    reason: parsed.reason,
    draftContent: sanitizeStorageDataContent(
      parsed.draftContent as Partial<StorageDataContent>
    )
  };
}

export async function buildNextStorageDataFile(
  currentFile: StorageDataFile,
  data: StorageDataContent,
  now = new Date()
): Promise<StorageDataFile> {
  return withStorageDataHash({
    format: STORAGE_DATA_FORMAT,
    schemaVersion: STORAGE_DATA_SCHEMA_VERSION,
    storageDataId: currentFile.storageDataId,
    revision: currentFile.revision + 1,
    updatedAt: now.toISOString(),
    data: sanitizeStorageDataContent(data)
  });
}

export function buildStorageDataDraftFile(
  file: StorageDataFile,
  draftContent: StorageDataContent,
  reason: StorageDataDraftReason,
  now = new Date()
): StorageDataDraftFile {
  return {
    format: STORAGE_DATA_DRAFT_FORMAT,
    schemaVersion: STORAGE_DATA_SCHEMA_VERSION,
    storageDataId: file.storageDataId,
    baseRevision: file.revision,
    baseHash: file.contentHash,
    createdAt: now.toISOString(),
    reason,
    draftContent: sanitizeStorageDataContent(draftContent)
  };
}

export function serializeStorageDataFile(file: StorageDataFile): string {
  return `${canonicalizeJson(stripForbiddenKeys(file))}\n`;
}

export function serializeStorageDataDraftFile(
  file: StorageDataDraftFile
): string {
  return `${canonicalizeJson(stripForbiddenKeys(file))}\n`;
}

function parseJsonObject(text: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new StorageDataFormatError("JSON 顶层必须是对象。");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof StorageDataFormatError) {
      throw error;
    }
    throw new StorageDataFormatError("JSON 文件无法解析。");
  }
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new StorageDataFormatError(`存储数据字段 ${field} 无效。`);
  }
}

function assertNumber(value: unknown, field: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new StorageDataFormatError(`存储数据字段 ${field} 无效。`);
  }
}

function assertDataArrays(data: Record<string, unknown>) {
  for (const key of [
    "spaces",
    "spaceProfiles",
    "passwordEntries",
    "passwordGroups",
    "spaceRelations",
    "migrationBatches",
    "migrationEntries"
  ]) {
    if (!Array.isArray(data[key])) {
      throw new StorageDataFormatError(`存储数据集合 ${key} 缺失或无效。`);
    }
  }
}

function isDraftReason(value: unknown): value is StorageDataDraftReason {
  return (
    value === "save-failed" ||
    value === "external-change-detected" ||
    value === "manual-export"
  );
}
