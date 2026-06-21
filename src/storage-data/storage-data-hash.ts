import { bytesToBase64, utf8ToBytes } from "../lib/bytes";
import type { StorageDataFile } from "./storage-data-types";

export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export async function computeStorageDataHash(file: Omit<StorageDataFile, "contentHash"> | StorageDataFile): Promise<string> {
  const { contentHash: _contentHash, ...hashable } = file as StorageDataFile;
  const digest = await crypto.subtle.digest("SHA-256", utf8ToBytes(canonicalizeJson(hashable)));
  return `sha256:${bytesToHex(new Uint8Array(digest))}`;
}

export async function withStorageDataHash(file: Omit<StorageDataFile, "contentHash">): Promise<StorageDataFile> {
  const contentHash = await computeStorageDataHash(file);
  return { ...file, contentHash };
}

export async function verifyStorageDataHash(file: StorageDataFile): Promise<boolean> {
  return file.contentHash === await computeStorageDataHash(file);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    const nested = (value as Record<string, unknown>)[key];
    if (nested !== undefined) {
      output[key] = sortValue(nested);
    }
  }
  return output;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function storageDataFileToDownloadUrl(content: string): string {
  return `data:application/json;base64,${bytesToBase64(utf8ToBytes(content))}`;
}

