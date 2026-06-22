import type {
  PasswordEntry,
  SpacePersistedStatus,
  SpaceProfile,
  SpaceRecord
} from "../storage-data";

export type { SpacePersistedStatus, SpaceRecord } from "../storage-data";

export type SpaceDiagnosticStatus = "healthy" | "corrupted";

export type SpaceRuntimeVerificationStatus =
  | "not_required"
  | "pending"
  | "verified";

export type SpaceRuntimeContext = {
  sessionAlive: boolean;
  ruleProfileInitialized: boolean;
  verificationStatus: SpaceRuntimeVerificationStatus;
};

export type SpacePolicyInput = SpaceRuntimeContext & {
  spaceStatus: SpacePersistedStatus;
  entryDeprecated?: boolean;
  isVerificationTarget?: boolean;
};

export type SpaceDiagnosticInput = {
  space: SpaceRecord | null;
  profile?: SpaceProfile | null;
  entries?: PasswordEntry[];
};
