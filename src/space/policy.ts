import type { SpacePersistedStatus, SpacePolicyInput, SpaceRuntimeVerificationStatus } from "./types";

type PolicyContext = {
  spaceStatus: SpacePersistedStatus;
  sessionAlive: boolean;
  ruleProfileInitialized: boolean;
  verificationStatus: SpaceRuntimeVerificationStatus;
};

function hasLiveReadableSpace(input: PolicyContext): boolean {
  return input.sessionAlive && input.verificationStatus !== "pending";
}

function hasActiveWritableSpace(input: PolicyContext): boolean {
  return hasLiveReadableSpace(input) && input.spaceStatus === "active";
}

export function canCreateEntry(input: SpacePolicyInput): boolean {
  return hasActiveWritableSpace(input) && input.ruleProfileInitialized;
}

export function canEditEntryMetadata(input: SpacePolicyInput): boolean {
  return hasActiveWritableSpace(input) && !input.entryDeprecated;
}

export function canEditEntryDescription(input: SpacePolicyInput): boolean {
  return hasActiveWritableSpace(input);
}

export function canEditRuleProfile(input: SpacePolicyInput): boolean {
  return hasActiveWritableSpace(input);
}

export function canViewMemoryHint(input: SpacePolicyInput): boolean {
  if (!input.sessionAlive) {
    return false;
  }
  if (input.verificationStatus === "pending") {
    return Boolean(input.isVerificationTarget);
  }
  return input.spaceStatus === "active" || input.spaceStatus === "deprecated" || input.spaceStatus === "archived";
}

export function canEditMemoryHint(input: SpacePolicyInput): boolean {
  return hasActiveWritableSpace(input);
}

export function canDeprecateEntry(input: SpacePolicyInput): boolean {
  return hasActiveWritableSpace(input) && !input.entryDeprecated;
}

export function canCloneSpace(input: Pick<SpacePolicyInput, "spaceStatus" | "sessionAlive">): boolean {
  return input.sessionAlive && (input.spaceStatus === "active" || input.spaceStatus === "deprecated" || input.spaceStatus === "archived");
}

export function canCreateSuccessorSpace(input: Pick<SpacePolicyInput, "spaceStatus" | "sessionAlive">): boolean {
  return input.sessionAlive && input.spaceStatus === "active";
}

export function canDeriveInSpace(input: SpacePolicyInput): boolean {
  if (!input.sessionAlive) {
    return false;
  }
  if (input.verificationStatus === "pending" && !input.isVerificationTarget) {
    return false;
  }
  return input.spaceStatus === "active" || input.spaceStatus === "deprecated";
}

export function canRunTestCleanup(input: SpacePolicyInput): boolean {
  return hasActiveWritableSpace(input);
}

export function canManageMigration(input: SpacePolicyInput): boolean {
  return hasActiveWritableSpace(input) && input.ruleProfileInitialized;
}
