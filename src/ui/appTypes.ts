import type {
  ActiveRuleId,
  ImportedRuleManifest,
  RuleDefinition
} from "../rule-registry/rules";
import type { SpacePersistedStatus } from "../storage-engine/storage-engine";

export type UiState = "OUT_OF_SPACE" | "IN_SPACE" | "ACTIVE" | "LEFT_SPACE";
export type AppPage = "passwords" | "rules" | "groups" | "space" | "detached";

export type ImportedRuleState = {
  manifest: ImportedRuleManifest;
  definition: RuleDefinition;
  enabled: boolean;
};

export const DEFAULT_RULE_ID: ActiveRuleId = "v1-hmac";
export const DEFAULT_RULE_CHAIN: ActiveRuleId[] = ["v1-hmac", "v2-pbkdf2"];

export const spaceStatusLabels: Record<SpacePersistedStatus, string> = {
  active: "正常",
  deprecated: "历史",
  archived: "归档"
};

export function normalizeSpaceId(spaceId: string): string {
  return spaceId.trim().toLowerCase();
}
