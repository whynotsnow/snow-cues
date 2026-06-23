export const DEFAULT_REVISION_RETENTION = 50;

export function createRevisionFileName(revision: number): string {
  return `storage-data-rev-${formatRevision(revision)}.json`;
}

export function createCandidateCurrentFileName({
  openedRevision,
  openedHash,
  nextRevision
}: {
  openedRevision: number;
  openedHash: string;
  nextRevision: number;
}): string {
  return `storage-data-current-o${formatRevision(openedRevision)}-h${shortHash(
    openedHash
  )}-n${formatRevision(nextRevision)}.json`;
}

export function createConflictFileName({
  openedRevision,
  currentRevision,
  nextRevision,
  createdAt
}: {
  openedRevision: number;
  currentRevision: number;
  nextRevision: number;
  createdAt: string;
}): string {
  const stamp = formatTimestamp(createdAt);
  return `storage-data-conflict-o${formatRevision(
    openedRevision
  )}-c${formatRevision(currentRevision)}-n${formatRevision(
    nextRevision
  )}-${stamp}.json`;
}

export function createDownloadConflictFileName({
  openedRevision,
  openedHash,
  nextRevision,
  createdAt
}: {
  openedRevision: number;
  openedHash: string;
  nextRevision: number;
  createdAt: string;
}): string {
  const stamp = formatTimestamp(createdAt);
  return `storage-data-conflict-o${formatRevision(openedRevision)}-h${shortHash(
    openedHash
  )}-n${formatRevision(nextRevision)}-${stamp}.json`;
}

export function createSavePackageFileName(
  revision: number,
  generatedAt: string
): string {
  return `snow-cues-save-package-rev-${formatRevision(
    revision
  )}-${formatTimestamp(generatedAt)}.zip`;
}

export function formatRevision(revision: number): string {
  return String(Math.max(0, revision)).padStart(6, "0");
}

export function shortHash(contentHash: string): string {
  const normalized = contentHash.startsWith("sha256:")
    ? contentHash.slice("sha256:".length)
    : contentHash;
  return normalized.slice(0, 8).padEnd(8, "0");
}

function formatTimestamp(isoString: string): string {
  return isoString.replace(/\.\d{3}Z$/, "Z").replace(/[-:]/g, "");
}
