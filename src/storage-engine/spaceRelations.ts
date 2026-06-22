import { RELATION_STORE_NAME } from "./constants";
import {
  openDatabase,
  requestToPromise,
  runTransaction,
  transactionDone
} from "./database";
import { normalizeStoredSpaceId, sanitizeSpaceRelation } from "./sanitize";
import type { SpaceRelation, SpaceRelationInput } from "./types";

export async function createSpaceRelation(
  input: SpaceRelationInput
): Promise<SpaceRelation> {
  const db = await openDatabase();
  const relation = sanitizeSpaceRelation({
    id: input.id ?? crypto.randomUUID(),
    fromSpaceId: input.fromSpaceId,
    toSpaceId: input.toSpaceId,
    type: input.type,
    createdAt: Date.now(),
    note: input.note
  });
  const tx = db.transaction(RELATION_STORE_NAME, "readwrite");
  await requestToPromise(tx.objectStore(RELATION_STORE_NAME).add(relation));
  await transactionDone(tx);
  return relation;
}

export async function listRelationsForSpace(
  spaceId: string
): Promise<SpaceRelation[]> {
  const normalizedSpaceId = normalizeStoredSpaceId(spaceId);
  const relations = await runTransaction(
    RELATION_STORE_NAME,
    "readonly",
    (tx) =>
      requestToPromise<SpaceRelation[]>(
        tx.objectStore(RELATION_STORE_NAME).getAll()
      )
  );
  return relations
    .map(sanitizeSpaceRelation)
    .filter(
      (relation) =>
        relation.fromSpaceId === normalizedSpaceId ||
        relation.toSpaceId === normalizedSpaceId
    )
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function listSourceRelations(
  spaceId: string
): Promise<SpaceRelation[]> {
  const normalizedSpaceId = normalizeStoredSpaceId(spaceId);
  const relations = await runTransaction(
    RELATION_STORE_NAME,
    "readonly",
    (tx) =>
      requestToPromise<SpaceRelation[]>(
        tx.objectStore(RELATION_STORE_NAME).getAll()
      )
  );
  return relations
    .map(sanitizeSpaceRelation)
    .filter((relation) => relation.fromSpaceId === normalizedSpaceId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function listSuccessorsOfSpace(
  spaceId: string
): Promise<SpaceRelation[]> {
  const normalizedSpaceId = normalizeStoredSpaceId(spaceId);
  const relations = await runTransaction(
    RELATION_STORE_NAME,
    "readonly",
    (tx) =>
      requestToPromise<SpaceRelation[]>(
        tx.objectStore(RELATION_STORE_NAME).getAll()
      )
  );
  return relations
    .map(sanitizeSpaceRelation)
    .filter(
      (relation) =>
        relation.toSpaceId === normalizedSpaceId &&
        relation.type === "successor_of"
    )
    .sort((a, b) => b.createdAt - a.createdAt);
}
