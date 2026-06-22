import { RuleRegistry, type ActiveRuleId } from "../rule-registry/rules";
import type { MigrationBatchStatus, MigrationProfileSnapshot, SpaceRelationType } from "../storage-engine/storage-engine";

const relationTypeLabels: Record<SpaceRelationType, string> = {
  cloned_from: "克隆自",
  successor_of: "接替自",
  forked_from: "分支自",
  restored_from: "恢复自",
  imported_from: "导入自"
};

const migrationBatchStatusLabels: Record<MigrationBatchStatus, string> = {
  draft: "等待初始化目标规则链",
  ready: "可迁移",
  in_progress: "迁移中",
  completed: "已完成"
};

export function formatSpaceRelationLabel(fromSpaceId: string, toSpaceId: string, type: SpaceRelationType): string {
  return `${fromSpaceId} → ${toSpaceId} · ${relationTypeLabels[type]}`;
}

export function formatMigrationBatchStatus(status: MigrationBatchStatus): string {
  return migrationBatchStatusLabels[status];
}

export function formatMigrationRuleSnapshot(snapshot: MigrationProfileSnapshot): string {
  const importedRuleNames = new Map(snapshot.importedRuleManifests.map((manifest) => [manifest.id, manifest.name]));
  const labels = snapshot.ruleChain.map((ruleId) => formatRuleId(ruleId, importedRuleNames));
  return labels.join(" → ") || "未保存规则链";
}

function formatRuleId(ruleId: ActiveRuleId, importedRuleNames: Map<string, string>): string {
  return RuleRegistry[ruleId as keyof typeof RuleRegistry]?.label ?? importedRuleNames.get(ruleId) ?? `未知规则（${ruleId}）`;
}
