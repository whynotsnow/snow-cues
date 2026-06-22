import { DEFAULT_SPACE_ID, PROFILE_STORE_NAME } from "./constants";
import { openDatabase, requestToPromise, runTransaction, transactionDone } from "./database";
import { sanitizeSpaceProfile } from "./sanitize";
import type { SpaceProfile, SpaceProfileInput } from "./types";

export async function listSystemProfile(): Promise<SpaceProfile | null> {
  return listSpaceProfile(DEFAULT_SPACE_ID);
}

export async function listSpaceProfile(spaceId: string): Promise<SpaceProfile | null> {
  const profile = await runTransaction(PROFILE_STORE_NAME, "readonly", (tx) =>
    requestToPromise<SpaceProfile | undefined>(tx.objectStore(PROFILE_STORE_NAME).get(spaceId))
  );
  return profile ? sanitizeSpaceProfile(profile) : null;
}

export async function saveSystemProfile(input: Omit<SpaceProfileInput, "spaceId">): Promise<SpaceProfile> {
  return saveSpaceProfile({ ...input, spaceId: DEFAULT_SPACE_ID });
}

export async function saveSpaceProfile(input: SpaceProfileInput): Promise<SpaceProfile> {
  const db = await openDatabase();
  const now = Date.now();
  const existing = await listSpaceProfile(input.spaceId);
  const profile = sanitizeSpaceProfile({
    spaceId: input.spaceId,
    ruleChain: input.ruleChain,
    importedRuleManifests: input.importedRuleManifests ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  });

  const tx = db.transaction(PROFILE_STORE_NAME, "readwrite");
  await requestToPromise(tx.objectStore(PROFILE_STORE_NAME).put(profile));
  await transactionDone(tx);
  return profile;
}
