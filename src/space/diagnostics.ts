import type { SpaceDiagnosticInput, SpaceDiagnosticStatus } from "./types";

const allowedSpaceStatuses = new Set(["active", "deprecated", "archived"]);

export function diagnoseSpace(
  input: SpaceDiagnosticInput
): SpaceDiagnosticStatus {
  if (!input.space || !allowedSpaceStatuses.has(input.space.status)) {
    return "corrupted";
  }

  if (input.profile && input.profile.spaceId !== input.space.spaceId) {
    return "corrupted";
  }

  if (input.profile && !Array.isArray(input.profile.ruleChain)) {
    return "corrupted";
  }

  if (input.profile && !Array.isArray(input.profile.importedRuleManifests)) {
    return "corrupted";
  }

  if (
    input.entries?.some(
      (entry) =>
        entry.spaceId !== input.space?.spaceId || !entry.encrypted_password
    )
  ) {
    return "corrupted";
  }

  return "healthy";
}
