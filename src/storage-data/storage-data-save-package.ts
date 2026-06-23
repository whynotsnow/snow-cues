import { bytesToBase64, concatBytes, utf8ToBytes } from "../lib/bytes";
import {
  createCandidateCurrentFileName,
  createDownloadConflictFileName,
  DEFAULT_REVISION_RETENTION,
  createRevisionFileName,
  createSavePackageFileName
} from "./storage-data-file-names";
import { serializeStorageDataFile } from "./storage-data-format";
import type { StorageDataFile } from "./storage-data-types";
import macosCommandTemplate from "./save-package-templates/apply-save.command?raw";
import linuxShellTemplate from "./save-package-templates/apply-save.sh?raw";
import windowsPowerShellTemplate from "./save-package-templates/apply-save.ps1?raw";
import desktopReadmeTemplate from "./save-package-templates/README.desktop.txt?raw";
import mobileReadmeTemplate from "./save-package-templates/README.mobile.txt?raw";
import pathFileTemplate from "./save-package-templates/storageData-path.txt?raw";

export type StorageDataSavePackageManifest = {
  format: "snow-cues-storage-data-save-package";
  schemaVersion: 1;
  storageDataId: string;
  generatedAt: string;
  openedRevision: number;
  openedHash: string;
  nextRevision: number;
  nextHash: string;
  candidateFileName: string;
  revisionFileName: string;
  conflictFileName: string;
  revisionRetention: number;
};

export type StorageDataSavePackage = {
  fileName: string;
  downloadUrl: string;
  desktopScriptsIncluded: boolean;
  manifest: StorageDataSavePackageManifest;
  entries: string[];
};

export type StorageDataSavePackageInput = {
  file: StorageDataFile;
  openedRevision: number;
  openedHash: string;
  mobileLike: boolean;
  generatedAt?: Date;
};

export async function buildStorageDataSavePackage({
  file,
  openedRevision,
  openedHash,
  mobileLike,
  generatedAt = new Date()
}: StorageDataSavePackageInput): Promise<StorageDataSavePackage> {
  const generatedAtIso = generatedAt.toISOString();
  const candidateFileName = createCandidateCurrentFileName({
    openedRevision,
    openedHash,
    nextRevision: file.revision
  });
  const revisionFileName = createRevisionFileName(file.revision);
  const manifest: StorageDataSavePackageManifest = {
    format: "snow-cues-storage-data-save-package",
    schemaVersion: 1,
    storageDataId: file.storageDataId,
    generatedAt: generatedAtIso,
    openedRevision,
    openedHash,
    nextRevision: file.revision,
    nextHash: file.contentHash,
    candidateFileName,
    revisionFileName,
    conflictFileName: createDownloadConflictFileName({
      openedRevision,
      openedHash,
      nextRevision: file.revision,
      createdAt: generatedAtIso
    }),
    revisionRetention: DEFAULT_REVISION_RETENTION
  };
  const serializedFile = serializeStorageDataFile(file);
  const entries: ZipEntryInput[] = [
    { name: candidateFileName, content: serializedFile },
    { name: `revisions/${revisionFileName}`, content: serializedFile },
    {
      name: "manifest.json",
      content: `${JSON.stringify(manifest, null, 2)}\n`
    },
    { name: "storageData-path.txt", content: pathFileTemplate },
    {
      name: "README.txt",
      content: mobileLike ? mobileReadmeTemplate : desktopReadmeTemplate
    }
  ];

  if (!mobileLike) {
    entries.push(
      {
        name: "apply-save.command",
        content: macosCommandTemplate,
        executable: true
      },
      { name: "apply-save.sh", content: linuxShellTemplate, executable: true },
      { name: "apply-save.ps1", content: windowsPowerShellTemplate }
    );
  }

  const zipBytes = createStoredZip(entries);
  return {
    fileName: createSavePackageFileName(file.revision, generatedAtIso),
    downloadUrl: `data:application/zip;base64,${bytesToBase64(zipBytes)}`,
    desktopScriptsIncluded: !mobileLike,
    manifest,
    entries: entries.map((entry) => entry.name)
  };
}

type ZipEntryInput = {
  name: string;
  content: string;
  executable?: boolean;
};

function createStoredZip(entries: ZipEntryInput[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = utf8ToBytes(entry.name);
    const contentBytes = utf8ToBytes(entry.content);
    const crc = crc32(contentBytes);
    const localHeader = concatBytes(
      uint32(0x04034b50),
      uint16(20),
      uint16(0x0800),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(crc),
      uint32(contentBytes.length),
      uint32(contentBytes.length),
      uint16(nameBytes.length),
      uint16(0),
      nameBytes
    );
    localParts.push(localHeader, contentBytes);

    centralParts.push(
      concatBytes(
        uint32(0x02014b50),
        uint16(entry.executable ? 0x0314 : 20),
        uint16(20),
        uint16(0x0800),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(crc),
        uint32(contentBytes.length),
        uint32(contentBytes.length),
        uint16(nameBytes.length),
        uint16(0),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(((entry.executable ? 0o100755 : 0o100644) << 16) >>> 0),
        uint32(offset),
        nameBytes
      )
    );
    offset += localHeader.length + contentBytes.length;
  }

  const centralDirectory = concatBytes(...centralParts);
  const localFiles = concatBytes(...localParts);
  const endOfCentralDirectory = concatBytes(
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(entries.length),
    uint16(entries.length),
    uint32(centralDirectory.length),
    uint32(localFiles.length),
    uint16(0)
  );
  return concatBytes(localFiles, centralDirectory, endOfCentralDirectory);
}

function uint16(value: number): Uint8Array {
  const bytes = new Uint8Array(2);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, value, true);
  return bytes;
}

function uint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, value >>> 0, true);
  return bytes;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
