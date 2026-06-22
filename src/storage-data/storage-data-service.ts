import {
  createStorageDataRepository,
  type StorageDataRepository
} from "./storage-data-repository";
import {
  createEmptyStorageDataContent,
  type StorageDataContent
} from "./storage-data-types";

let repository: StorageDataRepository = createStorageDataRepository();

export function getStorageDataRepository(): StorageDataRepository {
  return repository;
}

export function resetStorageDataRepository(
  content: StorageDataContent = createEmptyStorageDataContent()
): void {
  repository = createStorageDataRepository(content);
}

export const createPasswordEntry = (
  ...args: Parameters<StorageDataRepository["createPasswordEntry"]>
) => repository.createPasswordEntry(...args);
export const listPasswordEntries = (
  ...args: Parameters<StorageDataRepository["listPasswordEntries"]>
) => repository.listPasswordEntries(...args);
export const listPasswordEntriesBySpace = (
  ...args: Parameters<StorageDataRepository["listPasswordEntriesBySpace"]>
) => repository.listPasswordEntriesBySpace(...args);
export const updatePasswordEntry = (
  ...args: Parameters<StorageDataRepository["updatePasswordEntry"]>
) => repository.updatePasswordEntry(...args);
export const deletePasswordEntry = (
  ...args: Parameters<StorageDataRepository["deletePasswordEntry"]>
) => repository.deletePasswordEntry(...args);

export const createPasswordGroup = (
  ...args: Parameters<StorageDataRepository["createPasswordGroup"]>
) => repository.createPasswordGroup(...args);
export const listPasswordGroupsBySpace = (
  ...args: Parameters<StorageDataRepository["listPasswordGroupsBySpace"]>
) => repository.listPasswordGroupsBySpace(...args);
export const updatePasswordGroup = (
  ...args: Parameters<StorageDataRepository["updatePasswordGroup"]>
) => repository.updatePasswordGroup(...args);
export const deletePasswordGroup = (
  ...args: Parameters<StorageDataRepository["deletePasswordGroup"]>
) => repository.deletePasswordGroup(...args);

export const getSpace = (
  ...args: Parameters<StorageDataRepository["getSpace"]>
) => repository.getSpace(...args);
export const saveSpace = (
  ...args: Parameters<StorageDataRepository["saveSpace"]>
) => repository.saveSpace(...args);
export const listSpaces = (
  ...args: Parameters<StorageDataRepository["listSpaces"]>
) => repository.listSpaces(...args);
export const updateSpace = (
  ...args: Parameters<StorageDataRepository["updateSpace"]>
) => repository.updateSpace(...args);

export const listSystemProfile = (
  ...args: Parameters<StorageDataRepository["listSystemProfile"]>
) => repository.listSystemProfile(...args);
export const listSpaceProfile = (
  ...args: Parameters<StorageDataRepository["listSpaceProfile"]>
) => repository.listSpaceProfile(...args);
export const saveSystemProfile = (
  ...args: Parameters<StorageDataRepository["saveSystemProfile"]>
) => repository.saveSystemProfile(...args);
export const saveSpaceProfile = (
  ...args: Parameters<StorageDataRepository["saveSpaceProfile"]>
) => repository.saveSpaceProfile(...args);

export const createSpaceRelation = (
  ...args: Parameters<StorageDataRepository["createSpaceRelation"]>
) => repository.createSpaceRelation(...args);
export const listRelationsForSpace = (
  ...args: Parameters<StorageDataRepository["listRelationsForSpace"]>
) => repository.listRelationsForSpace(...args);
export const listSourceRelations = (
  ...args: Parameters<StorageDataRepository["listSourceRelations"]>
) => repository.listSourceRelations(...args);
export const listSuccessorsOfSpace = (
  ...args: Parameters<StorageDataRepository["listSuccessorsOfSpace"]>
) => repository.listSuccessorsOfSpace(...args);

export const createMigrationBatch = (
  ...args: Parameters<StorageDataRepository["createMigrationBatch"]>
) => repository.createMigrationBatch(...args);
export const getMigrationBatch = (
  ...args: Parameters<StorageDataRepository["getMigrationBatch"]>
) => repository.getMigrationBatch(...args);
export const listMigrationBatchesForTarget = (
  ...args: Parameters<StorageDataRepository["listMigrationBatchesForTarget"]>
) => repository.listMigrationBatchesForTarget(...args);
export const updateMigrationBatch = (
  ...args: Parameters<StorageDataRepository["updateMigrationBatch"]>
) => repository.updateMigrationBatch(...args);
export const createMigrationEntry = (
  ...args: Parameters<StorageDataRepository["createMigrationEntry"]>
) => repository.createMigrationEntry(...args);
export const listMigrationEntriesByBatch = (
  ...args: Parameters<StorageDataRepository["listMigrationEntriesByBatch"]>
) => repository.listMigrationEntriesByBatch(...args);
export const updateMigrationEntry = (
  ...args: Parameters<StorageDataRepository["updateMigrationEntry"]>
) => repository.updateMigrationEntry(...args);
export const refreshMigrationBatchStats = (
  ...args: Parameters<StorageDataRepository["refreshMigrationBatchStats"]>
) => repository.refreshMigrationBatchStats(...args);

export const clearPasswordEntries = (
  ...args: Parameters<StorageDataRepository["clearPasswordEntries"]>
) => repository.clearPasswordEntries(...args);
export const clearPasswordEntriesBySpace = (
  ...args: Parameters<StorageDataRepository["clearPasswordEntriesBySpace"]>
) => repository.clearPasswordEntriesBySpace(...args);
export const clearSystemProfile = (
  ...args: Parameters<StorageDataRepository["clearSystemProfile"]>
) => repository.clearSystemProfile(...args);
export const clearSpaceProfile = (
  ...args: Parameters<StorageDataRepository["clearSpaceProfile"]>
) => repository.clearSpaceProfile(...args);
export const deleteSpaceData = (
  ...args: Parameters<StorageDataRepository["deleteSpaceData"]>
) => repository.deleteSpaceData(...args);

export async function resetLocalData(): Promise<void> {
  resetStorageDataRepository();
}
